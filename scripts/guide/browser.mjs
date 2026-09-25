/**
 * The smallest Chrome DevTools Protocol client the user guide needs. No npm
 * package: it launches the installed Chrome, headless, and talks to it over
 * Node's global WebSocket (Node 22 and later).
 *
 *   const browser = await openBrowser();          // launches Chrome
 *   const context = await browser.newContext();   // cookies of its own
 *   const page = await browser.newPage({ context });
 *   await page.setViewport(VIEWPORTS.desktop);
 *   await page.goto("http://localhost:3000/en");
 *   const png = await page.screenshot();          // Buffer
 *   await browser.close();                        // Chrome and its temp profile go
 *
 * One WebSocket to the browser, one CDP session per page in "flatten" mode
 * (Target.attachToTarget with flatten: true), so every message carries its
 * sessionId and every command has its own numeric id. Nothing here knows
 * about the platform: scenes, sessions and drawing live next door.
 *
 * Chrome is found at CHROME_PATH, else the usual Windows, macOS and Linux
 * places. It starts with --headless=new, a free --remote-debugging-port and
 * a throwaway --user-data-dir, and the browser endpoint is read from
 * http://127.0.0.1:<port>/json/version.
 */

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const VIEWPORTS = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false },
  phone: {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  },
};

const CHROME_CANDIDATES = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe") : null,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);

export function findChrome(explicit) {
  const wanted = explicit || process.env.CHROME_PATH;
  if (wanted) {
    if (!existsSync(wanted)) throw new Error(`Chrome not found at ${wanted}`);
    return wanted;
  }
  const found = CHROME_CANDIDATES.find((path) => existsSync(path));
  if (!found) throw new Error("Chrome not found. Set CHROME_PATH to chrome.exe.");
  return found;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function browserEndpoint(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const body = await res.json();
        if (body.webSocketDebuggerUrl) return body.webSocketDebuggerUrl;
      }
    } catch (error) {
      lastError = error;
    }
    await sleep(150);
  }
  throw new Error(`Chrome did not open its debugging port in time (${lastError?.message ?? "no answer"})`);
}

/**
 * Starts Chrome. Returns the browser WebSocket URL and a `kill` that also
 * removes the temporary profile.
 */
export async function launchChrome({ chromePath, headless = true, windowSize = [1440, 900], extraArgs = [] } = {}) {
  const executable = findChrome(chromePath);
  const port = await freePort();
  const userDataDir = mkdtempSync(join(tmpdir(), "alttavia-guide-chrome-"));
  const args = [
    ...(headless ? ["--headless=new"] : []),
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    `--window-size=${windowSize[0]},${windowSize[1]}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--disable-sync",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-default-apps",
    "--disable-features=Translate,MediaRouter,OptimizationHints",
    "--hide-scrollbars",
    "--mute-audio",
    "--force-color-profile=srgb",
    "--lang=en-GB",
    ...extraArgs,
    "about:blank",
  ];
  const child = spawn(executable, args, { stdio: "ignore", windowsHide: true });
  let exited = false;
  child.on("exit", () => {
    exited = true;
  });
  let wsUrl;
  try {
    wsUrl = await browserEndpoint(port, 30_000);
  } catch (error) {
    child.kill();
    throw error;
  }

  async function kill() {
    if (!exited) {
      child.kill();
      for (let i = 0; i < 40 && !exited; i += 1) await sleep(100);
    }
    // Chrome lets go of its profile a moment after it exits on Windows.
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        rmSync(userDataDir, { recursive: true, force: true });
        return;
      } catch {
        await sleep(300);
      }
    }
  }

  return { wsUrl, port, process: child, userDataDir, kill };
}

/**
 * One WebSocket, commands with ids, events by method and session.
 */
export class CDP {
  static async connect(wsUrl, { timeoutMs = 15_000 } = {}) {
    if (typeof WebSocket !== "function") throw new Error("This Node has no global WebSocket. Use Node 22 or later.");
    const socket = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("DevTools WebSocket did not open")), timeoutMs);
      socket.addEventListener("open", () => {
        clearTimeout(timer);
        resolve();
      });
      socket.addEventListener("error", (event) => {
        clearTimeout(timer);
        reject(new Error(`DevTools WebSocket error: ${event?.message ?? "unknown"}`));
      });
    });
    return new CDP(socket);
  }

  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Set();
    this.closed = false;
    socket.addEventListener("message", (event) => this.#onMessage(event.data));
    socket.addEventListener("close", () => {
      this.closed = true;
      for (const { reject } of this.pending.values()) reject(new Error("DevTools connection closed"));
      this.pending.clear();
    });
  }

  #onMessage(data) {
    let message;
    try {
      message = JSON.parse(typeof data === "string" ? data : Buffer.from(data).toString("utf8"));
    } catch {
      return;
    }
    if (message.id !== undefined) {
      const waiter = this.pending.get(message.id);
      if (!waiter) return;
      this.pending.delete(message.id);
      if (message.error) {
        waiter.reject(new Error(`${waiter.method}: ${message.error.message}${message.error.data ? ` (${message.error.data})` : ""}`));
      } else {
        waiter.resolve(message.result ?? {});
      }
      return;
    }
    for (const listener of [...this.listeners]) {
      if (listener.method !== message.method) continue;
      if (listener.sessionId !== undefined && listener.sessionId !== (message.sessionId ?? null)) continue;
      listener.handler(message.params ?? {}, message.sessionId ?? null);
    }
  }

  send(method, params = {}, sessionId = null, { timeoutMs = 120_000 } = {}) {
    if (this.closed) return Promise.reject(new Error("DevTools connection closed"));
    const id = this.nextId++;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.delete(id)) reject(new Error(`${method} timed out after ${timeoutMs} ms`));
      }, timeoutMs);
      this.pending.set(id, {
        method,
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      this.socket.send(JSON.stringify(payload));
    });
  }

  /** Calls `handler(params, sessionId)` for every event; returns an unsubscribe. */
  on(method, handler, sessionId) {
    const listener = { method, handler, sessionId: sessionId === undefined ? undefined : sessionId ?? null };
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** The next event of that name (on that session), or a timeout error. */
  waitForEvent(method, { sessionId, timeoutMs = 60_000, predicate } = {}) {
    return new Promise((resolve, reject) => {
      const off = this.on(
        method,
        (params) => {
          if (predicate && !predicate(params)) return;
          clearTimeout(timer);
          off();
          resolve(params);
        },
        sessionId,
      );
      const timer = setTimeout(() => {
        off();
        reject(new Error(`${method} did not arrive within ${timeoutMs} ms`));
      }, timeoutMs);
    });
  }

  close() {
    try {
      this.socket.close();
    } catch {
      // Already gone.
    }
  }
}

/**
 * One tab, driven through its own flattened session.
 */
export class Page {
  constructor(cdp, targetId, sessionId) {
    this.cdp = cdp;
    this.targetId = targetId;
    this.sessionId = sessionId;
    this.viewport = VIEWPORTS.desktop;
  }

  send(method, params = {}, options) {
    return this.cdp.send(method, params, this.sessionId, options);
  }

  on(method, handler) {
    return this.cdp.on(method, handler, this.sessionId);
  }

  waitForEvent(method, options = {}) {
    return this.cdp.waitForEvent(method, { ...options, sessionId: this.sessionId });
  }

  async setViewport(viewport = VIEWPORTS.desktop) {
    this.viewport = viewport;
    await this.send("Emulation.setDeviceMetricsOverride", {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: viewport.deviceScaleFactor ?? 1,
      mobile: !!viewport.mobile,
    });
    await this.send("Emulation.setTouchEmulationEnabled", { enabled: !!viewport.mobile, maxTouchPoints: viewport.mobile ? 5 : 1 });
    if (viewport.userAgent) {
      await this.send("Emulation.setUserAgentOverride", {
        userAgent: viewport.userAgent,
        acceptLanguage: "en-GB,en;q=0.9",
        platform: viewport.mobile ? "iPhone" : "Win32",
      });
    }
  }

  /** Runs before any script of every document this tab loads. */
  addInitScript(source) {
    return this.send("Page.addScriptToEvaluateOnNewDocument", { source, runImmediately: false });
  }

  /**
   * Navigates and waits for the load event of the new document. A redirect
   * is followed; an HTTP error page still loads and is left to the caller.
   */
  async goto(url, { timeoutMs = 120_000 } = {}) {
    const loaded = this.waitForEvent("Page.loadEventFired", { timeoutMs });
    const result = await this.send("Page.navigate", { url }, { timeoutMs });
    if (result.errorText) {
      loaded.catch(() => undefined);
      throw new Error(`Navigation to ${url} failed: ${result.errorText}`);
    }
    await loaded;
  }

  /**
   * Evaluates an expression, or a function with JSON arguments, in the page.
   * Awaits a returned promise and hands back the value as JSON.
   */
  async evaluate(fnOrExpression, ...args) {
    const expression =
      typeof fnOrExpression === "function"
        ? `(${fnOrExpression.toString()})(...${JSON.stringify(args)})`
        : String(fnOrExpression);
    const { result, exceptionDetails } = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    });
    if (exceptionDetails) {
      const text = exceptionDetails.exception?.description || exceptionDetails.text || "evaluation failed";
      throw new Error(text.split("\n")[0]);
    }
    return result?.value;
  }

  /**
   * Polls an expression (or a function with arguments) until it returns a
   * truthy value, which is returned. Throws after the timeout.
   */
  async waitFor(fnOrExpression, { timeoutMs = 20_000, intervalMs = 150, args = [], label } = {}) {
    const deadline = Date.now() + timeoutMs;
    let lastError = null;
    while (Date.now() < deadline) {
      try {
        const value = await this.evaluate(fnOrExpression, ...args);
        if (value) return value;
        lastError = null;
      } catch (error) {
        // A navigation in flight destroys the context; try again.
        lastError = error;
      }
      await sleep(intervalMs);
    }
    throw new Error(`Timed out waiting for ${label ?? "a condition"}${lastError ? ` (${lastError.message})` : ""}`);
  }

  /** Waits for a CSS selector to match a visible element. */
  waitForSelector(selector, options = {}) {
    return this.waitFor(
      (css) => {
        const el = document.querySelector(css);
        if (!el) return false;
        const box = el.getBoundingClientRect();
        return box.width > 0 && box.height > 0;
      },
      { ...options, args: [selector], label: options.label ?? `selector ${selector}` },
    );
  }

  /** Fonts loaded, two frames painted. */
  async settle(extraMs = 300) {
    await this.evaluate(async () => {
      if (document.fonts?.ready) await document.fonts.ready;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }).catch(() => undefined);
    if (extraMs > 0) await sleep(extraMs);
  }

  /** A real mouse move, for hover states. Coordinates are CSS pixels in the viewport. */
  async hover(x, y) {
    await this.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none" });
  }

  async click(x, y) {
    await this.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none" });
    await this.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
    await this.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  }

  /**
   * PNG of the viewport, of a clip ({ x, y, width, height } in page CSS
   * pixels), or of the whole page (fullPage).
   */
  async screenshot({ clip, fullPage = false } = {}) {
    const params = { format: "png", fromSurface: true };
    if (fullPage) {
      const size = await this.evaluate(() => ({
        width: Math.ceil(document.documentElement.scrollWidth),
        height: Math.ceil(document.documentElement.scrollHeight),
      }));
      params.captureBeyondViewport = true;
      params.clip = { x: 0, y: 0, width: size.width, height: size.height, scale: 1 };
    } else if (clip) {
      params.clip = { ...clip, scale: 1 };
    }
    const { data } = await this.send("Page.captureScreenshot", params);
    return Buffer.from(data, "base64");
  }

  /** PDF bytes. Options are Page.printToPDF's own. */
  async pdf(options = {}) {
    const { data } = await this.send("Page.printToPDF", { transferMode: "ReturnAsBase64", ...options }, { timeoutMs: 180_000 });
    return Buffer.from(data, "base64");
  }

  async close() {
    try {
      await this.cdp.send("Target.closeTarget", { targetId: this.targetId });
    } catch {
      // Already closed.
    }
  }
}

/**
 * Blocks every request to `origin` that could change something (anything
 * but GET, HEAD and OPTIONS), so a capture only ever reads. Returns the list
 * of what it blocked, filled as it goes.
 */
export async function guardReadOnly(page, origin) {
  const blocked = [];
  page.on("Fetch.requestPaused", (params) => {
    const method = params.request.method;
    const safe = method === "GET" || method === "HEAD" || method === "OPTIONS";
    if (safe) {
      page.send("Fetch.continueRequest", { requestId: params.requestId }).catch(() => undefined);
    } else {
      let path = params.request.url;
      try {
        path = new URL(params.request.url).pathname;
      } catch {
        // Keep the raw URL.
      }
      blocked.push(`${method} ${path}`);
      page.send("Fetch.failRequest", { requestId: params.requestId, errorReason: "BlockedByClient" }).catch(() => undefined);
    }
  });
  await page.send("Fetch.enable", { patterns: [{ urlPattern: `${origin.replace(/\/+$/, "")}/*`, requestStage: "Request" }] });
  return blocked;
}

/**
 * Launches Chrome and connects. `newContext()` gives an isolated cookie jar
 * (an incognito-like browser context); `newPage({ context })` opens a tab in
 * it and attaches a flattened session.
 */
export async function openBrowser({ chromePath, headless = true, windowSize } = {}) {
  const chrome = await launchChrome({ chromePath, headless, windowSize });
  let cdp;
  try {
    cdp = await CDP.connect(chrome.wsUrl);
  } catch (error) {
    await chrome.kill();
    throw error;
  }
  const contexts = [];

  return {
    cdp,
    chrome,
    async newContext() {
      const { browserContextId } = await cdp.send("Target.createBrowserContext", { disposeOnDetach: true });
      contexts.push(browserContextId);
      return browserContextId;
    },
    /** Sets cookies in a context before any of its pages loads. */
    async setCookies(context, cookies) {
      if (!cookies?.length) return;
      await cdp.send("Storage.setCookies", { cookies, ...(context ? { browserContextId: context } : {}) });
    },
    async newPage({ context, viewport = VIEWPORTS.desktop } = {}) {
      const { targetId } = await cdp.send("Target.createTarget", {
        url: "about:blank",
        ...(context ? { browserContextId: context } : {}),
        background: false,
      });
      const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
      const page = new Page(cdp, targetId, sessionId);
      await page.send("Page.enable");
      await page.send("Runtime.enable");
      await page.send("Network.enable");
      await page.send("Emulation.setFocusEmulationEnabled", { enabled: true }).catch(() => undefined);
      await page.send("Page.bringToFront").catch(() => undefined);
      await page.setViewport(viewport);
      return page;
    },
    async close() {
      try {
        await cdp.send("Browser.close", {}, null, { timeoutMs: 5000 });
      } catch {
        // Killed below anyway.
      }
      cdp.close();
      await chrome.kill();
    },
  };
}
