/**
 * Marks on a page before its screenshot: a red rounded rectangle around
 * what the guide talks about, an optional red arrow pointing at it, an
 * optional numbered badge, and blur over what must not be shown (a real
 * client's email). Everything is drawn by a small library injected through
 * Runtime.evaluate, so the page itself is never changed on the server.
 *
 * Targets. Anywhere a target is asked for, it may be:
 *   "css selector"                          the first visible match
 *   { css, text, exact, label, within, closest, nth, all }
 *     css      a CSS selector (default: any element)
 *     text     the element's text contains this (case and spacing ignored);
 *              the deepest match wins, not its ancestors (deepest: false
 *              keeps them), so { css: "section", text: "Report" } is the
 *              innermost section holding the word
 *     exact    the text must be equal, not just contained
 *     label    the aria-label contains this
 *     within   another target: search only inside it (every match of it)
 *     closest  climb from the match to this CSS selector
 *     nth      which match (0 first, -1 last); default the first
 *     all      every match (for highlighting several at once)
 * Visible matches are preferred; an element with no size is never drawn.
 *
 * Drawing. The overlay is a `popover="manual"` element shown last, so it
 * sits in the browser's top layer above an open modal <dialog> (the order
 * modals are ones): an ordinary z-index cannot get above a modal dialog.
 * In "viewport" mode the SVG is fixed over the viewport; in "document" mode
 * (full page screenshots) it covers the whole document.
 */

export const RED = "#D0302B";

/** Installed once per document as window.__guide. Runs in the page. */
function pageLibrary() {
  if (window.__guide) return true;
  const SVG_NS = "http://www.w3.org/2000/svg";
  const norm = (value) => String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();

  function isVisible(el) {
    if (!(el instanceof Element)) return false;
    const box = el.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) return false;
    const style = getComputedStyle(el);
    return style.visibility !== "hidden" && style.display !== "none";
  }

  function asSpec(spec) {
    return typeof spec === "string" ? { css: spec } : { ...spec };
  }

  function resolveAll(input, scope) {
    if (input == null) return [];
    const spec = asSpec(input);
    const scopes = spec.within ? resolveAll({ ...asSpec(spec.within), all: true }, scope) : [scope || document];
    let found = [];
    for (const root of scopes) {
      let list;
      try {
        list = [...root.querySelectorAll(spec.css || "*")];
      } catch (error) {
        throw new Error(`bad selector ${spec.css}: ${error.message}`);
      }
      if (spec.label != null) {
        const wanted = norm(spec.label);
        list = list.filter((el) => norm(el.getAttribute("aria-label")).includes(wanted));
      }
      if (spec.text != null) {
        const wanted = norm(spec.text);
        const test = (el) => {
          const text = norm(el.textContent);
          return spec.exact ? text === wanted : text.includes(wanted);
        };
        list = list.filter(test);
        if (spec.deepest !== false) {
          // The deepest holder of the text, not every ancestor of it.
          const hits = list;
          list = list.filter((el) => !hits.some((other) => other !== el && el.contains(other)));
        }
      }
      found.push(...list);
    }
    if (spec.closest) found = found.map((el) => el.closest(spec.closest)).filter(Boolean);
    found = [...new Set(found)];
    const visible = found.filter(isVisible);
    if (visible.length) found = visible;
    if (spec.all) return found;
    if (spec.nth != null) {
      const picked = found.at(spec.nth);
      return picked ? [picked] : [];
    }
    return found.slice(0, 1);
  }

  const resolve = (spec) => resolveAll(spec)[0] ?? null;

  function describe(spec) {
    if (typeof spec === "string") return spec;
    const parts = [];
    if (spec.css) parts.push(spec.css);
    if (spec.label) parts.push(`[label~"${spec.label}"]`);
    if (spec.text) parts.push(`"${spec.text}"`);
    if (spec.within) parts.push(`in ${describe(spec.within)}`);
    if (spec.closest) parts.push(`^${spec.closest}`);
    return parts.join(" ");
  }

  function info(spec) {
    const all = resolveAll({ ...asSpec(spec), all: true });
    const el = resolveAll(spec)[0] ?? null;
    if (!el) return { found: false, visible: false, count: 0 };
    const box = el.getBoundingClientRect();
    return {
      found: true,
      visible: isVisible(el),
      count: all.length,
      tag: el.tagName.toLowerCase(),
      text: norm(el.textContent).slice(0, 80),
      rect: { x: box.left, y: box.top, width: box.width, height: box.height },
      disabled: !!el.disabled || el.getAttribute("aria-disabled") === "true",
    };
  }

  function svgEl(name, attrs) {
    const node = document.createElementNS(SVG_NS, name);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    return node;
  }

  function clear() {
    const old = document.getElementById("__guide_overlay");
    if (old) {
      try {
        if (old.matches(":popover-open")) old.hidePopover();
      } catch {
        // Not a popover.
      }
      old.remove();
    }
  }

  function arrowPoints(box, side, length, viewport) {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const gap = 3;
    const points = {
      left: { end: [box.x - gap, cy], start: [box.x - gap - length, cy] },
      right: { end: [box.x + box.width + gap, cy], start: [box.x + box.width + gap + length, cy] },
      top: { end: [cx, box.y - gap], start: [cx, box.y - gap - length] },
      bottom: { end: [cx, box.y + box.height + gap], start: [cx, box.y + box.height + gap + length] },
    };
    const opposite = { left: "right", right: "left", top: "bottom", bottom: "top" };
    const inside = ([x, y]) => x >= 12 && y >= 12 && x <= viewport.width - 12 && y <= viewport.height - 12;
    let chosen = side;
    if (!inside(points[side].start) && inside(points[opposite[side]].start)) chosen = opposite[side];
    return { side: chosen, ...points[chosen] };
  }

  /**
   * items: [{ target, arrow?: "left"|"right"|"top"|"bottom", label?: "1", pad? }]
   * options: { pad = 6, arrowLength = 80, mode = "viewport" | "document", color, halo = true }
   */
  function annotate(items, options = {}) {
    clear();
    const color = options.color || "#D0302B";
    const mode = options.mode === "document" ? "document" : "viewport";
    const halo = options.halo !== false;
    const offsetX = mode === "document" ? window.scrollX : 0;
    const offsetY = mode === "document" ? window.scrollY : 0;
    const width = mode === "document" ? document.documentElement.scrollWidth : window.innerWidth;
    const height = mode === "document" ? document.documentElement.scrollHeight : window.innerHeight;
    const viewport = { width, height };

    const overlay = document.createElement("div");
    overlay.id = "__guide_overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.style.cssText = [
      `position:${mode === "document" ? "absolute" : "fixed"}`,
      "left:0",
      "top:0",
      "right:auto",
      "bottom:auto",
      `width:${width}px`,
      `height:${height}px`,
      "max-width:none",
      "max-height:none",
      "margin:0",
      "padding:0",
      "border:0",
      "background:transparent",
      "overflow:visible",
      "pointer-events:none",
      "z-index:2147483647",
    ].join(";");
    const svg = svgEl("svg", { width, height, viewBox: `0 0 ${width} ${height}` });
    svg.style.cssText = "position:absolute;left:0;top:0;overflow:visible";
    overlay.appendChild(svg);

    const missing = [];
    let drawn = 0;
    for (const item of items) {
      const spec = item.target ?? item;
      const elements = resolveAll(spec);
      const el = elements[0];
      if (!el || !isVisible(el)) {
        missing.push(describe(spec));
        continue;
      }
      const pad = item.pad ?? options.pad ?? 6;
      const r = el.getBoundingClientRect();
      const box = { x: r.left - pad + offsetX, y: r.top - pad + offsetY, width: r.width + pad * 2, height: r.height + pad * 2 };
      const radius = Math.min(10, box.height / 2);
      if (halo) {
        svg.appendChild(svgEl("rect", { ...rectAttrs(box), rx: radius, fill: "none", stroke: "#FFFFFF", "stroke-width": 5, "stroke-opacity": 0.85 }));
      }
      svg.appendChild(svgEl("rect", { ...rectAttrs(box), rx: radius, fill: "none", stroke: color, "stroke-width": 2 }));
      drawn += 1;

      let badgeAt = [box.x - 2, box.y - 2];
      if (item.arrow) {
        const length = item.arrowLength ?? options.arrowLength ?? 80;
        const { start, end } = arrowPoints(box, item.arrow, length, viewport);
        const angle = Math.atan2(end[1] - start[1], end[0] - start[0]);
        const head = 14;
        const spread = 8;
        const base = [end[0] - head * Math.cos(angle), end[1] - head * Math.sin(angle)];
        const left = [base[0] + spread * Math.sin(angle), base[1] - spread * Math.cos(angle)];
        const right = [base[0] - spread * Math.sin(angle), base[1] + spread * Math.cos(angle)];
        const line = { x1: start[0], y1: start[1], x2: base[0], y2: base[1] };
        const headPoints = `${end[0]},${end[1]} ${left[0]},${left[1]} ${right[0]},${right[1]}`;
        if (halo) {
          svg.appendChild(svgEl("line", { ...line, stroke: "#FFFFFF", "stroke-width": 7, "stroke-linecap": "round", "stroke-opacity": 0.85 }));
          svg.appendChild(svgEl("polygon", { points: headPoints, fill: "#FFFFFF", stroke: "#FFFFFF", "stroke-width": 4, "stroke-linejoin": "round", "fill-opacity": 0.85 }));
        }
        svg.appendChild(svgEl("line", { ...line, stroke: color, "stroke-width": 3, "stroke-linecap": "round" }));
        svg.appendChild(svgEl("polygon", { points: headPoints, fill: color }));
        badgeAt = [start[0] - 14 * Math.cos(angle), start[1] - 14 * Math.sin(angle)];
      }

      if (item.label != null && item.label !== "") {
        const [bx, by] = badgeAt;
        const group = svgEl("g", {});
        group.appendChild(svgEl("circle", { cx: bx, cy: by, r: 14, fill: color, stroke: "#FFFFFF", "stroke-width": 2.5 }));
        const text = svgEl("text", {
          x: bx,
          y: by,
          fill: "#FFFFFF",
          "font-family": "Inter, Arial, sans-serif",
          "font-size": 14,
          "font-weight": 700,
          "text-anchor": "middle",
          "dominant-baseline": "central",
        });
        text.textContent = String(item.label);
        group.appendChild(text);
        svg.appendChild(group);
      }
    }

    // Into the top layer, above an open modal dialog; else inside the last open dialog.
    document.body.appendChild(overlay);
    let layer = "body";
    if (typeof overlay.showPopover === "function") {
      try {
        overlay.setAttribute("popover", "manual");
        overlay.style.cssText += ";position:" + (mode === "document" ? "absolute" : "fixed");
        overlay.showPopover();
        layer = "popover";
      } catch {
        overlay.removeAttribute("popover");
      }
    }
    if (layer === "body") {
      const dialogs = [...document.querySelectorAll("dialog[open]")];
      if (dialogs.length) {
        dialogs[dialogs.length - 1].appendChild(overlay);
        layer = "dialog";
      }
    }
    return { drawn, missing, layer };
  }

  function rectAttrs(box) {
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  }

  function scrollTo(spec, block = "center") {
    const el = resolve(spec);
    if (!el) return false;
    el.scrollIntoView({ block, inline: "nearest", behavior: "instant" });
    return true;
  }

  /** The union of the targets' boxes plus padding, in page coordinates, clamped to the document. */
  function rectOf(specs, pad = 24) {
    const list = Array.isArray(specs) ? specs : [specs];
    let box = null;
    for (const spec of list) {
      const el = resolve(spec);
      if (!el || !isVisible(el)) continue;
      const r = el.getBoundingClientRect();
      const next = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      box = box
        ? {
            left: Math.min(box.left, next.left),
            top: Math.min(box.top, next.top),
            right: Math.max(box.right, next.right),
            bottom: Math.max(box.bottom, next.bottom),
          }
        : next;
    }
    if (!box) return null;
    const left = Math.max(0, box.left - pad);
    const top = Math.max(0, box.top - pad);
    const right = Math.min(window.innerWidth, box.right + pad);
    const bottom = Math.min(window.innerHeight, box.bottom + pad);
    return {
      x: Math.round(left + window.scrollX),
      y: Math.round(top + window.scrollY),
      width: Math.round(right - left),
      height: Math.round(bottom - top),
    };
  }

  function click(spec) {
    const el = resolve(spec);
    if (!el) return false;
    el.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
    el.click();
    return true;
  }

  function setValue(spec, value) {
    const el = resolve(spec);
    if (!el) return false;
    if (el instanceof HTMLSelectElement) {
      const option = [...el.options].find((o) => o.value === String(value) || norm(o.textContent) === norm(value));
      el.value = option ? option.value : String(value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
      if (el.checked !== !!value) el.click();
      return true;
    }
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, String(value));
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    if (el.isContentEditable) {
      el.textContent = String(value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    }
    return false;
  }

  const masked = [];

  function mask(specs, style = "blur") {
    let count = 0;
    for (const spec of Array.isArray(specs) ? specs : [specs]) {
      for (const el of resolveAll({ ...asSpec(spec), all: true })) {
        masked.push({ el, css: el.style.cssText });
        if (style === "box") {
          el.style.background = "#C9CED6";
          el.style.color = "transparent";
          el.style.borderRadius = "4px";
          el.style.textShadow = "none";
        } else {
          el.style.filter = "blur(6px)";
        }
        count += 1;
      }
    }
    return count;
  }

  const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

  /** Blurs every email address on the page whose domain is not in `keep`. */
  function maskEmails(keep = []) {
    const kept = (address) => keep.some((domain) => address.toLowerCase().endsWith(`@${domain}`) || address.toLowerCase().endsWith(`.${domain}`));
    let count = 0;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || parent.closest("script,style,noscript,textarea,[data-guide-email]")) return NodeFilter.FILTER_REJECT;
        EMAIL.lastIndex = 0;
        return EMAIL.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const text = node.nodeValue;
      EMAIL.lastIndex = 0;
      const fragment = document.createDocumentFragment();
      let last = 0;
      let changed = false;
      for (const match of text.matchAll(EMAIL)) {
        if (kept(match[0])) continue;
        fragment.appendChild(document.createTextNode(text.slice(last, match.index)));
        const span = document.createElement("span");
        span.setAttribute("data-guide-email", "");
        span.style.filter = "blur(5px)";
        span.textContent = match[0];
        fragment.appendChild(span);
        last = match.index + match[0].length;
        changed = true;
        count += 1;
      }
      if (!changed) continue;
      fragment.appendChild(document.createTextNode(text.slice(last)));
      masked.push({ node, original: text, fragmentParent: node.parentNode });
      node.parentNode.replaceChild(fragment, node);
    }
    for (const field of document.querySelectorAll("input, textarea")) {
      EMAIL.lastIndex = 0;
      const value = field.value || "";
      const hits = value.match(EMAIL) || [];
      if (hits.some((address) => !kept(address))) {
        masked.push({ el: field, css: field.style.cssText });
        field.style.filter = "blur(5px)";
        count += 1;
      }
    }
    return count;
  }

  function unmask() {
    for (const span of document.querySelectorAll("[data-guide-email]")) span.replaceWith(document.createTextNode(span.textContent));
    for (const entry of masked.splice(0)) {
      if (entry.el) entry.el.style.cssText = entry.css;
    }
    document.body.normalize();
  }

  /** Hides what only a developer sees: the Next.js dev indicator, the text caret. */
  function tidy() {
    if (document.getElementById("__guide_tidy")) return;
    const style = document.createElement("style");
    style.id = "__guide_tidy";
    style.textContent = [
      "nextjs-portal, [data-nextjs-toast], [data-next-badge-root], #__next-build-watcher { display: none !important; }",
      "* { caret-color: transparent !important; }",
    ].join("\n");
    document.head.appendChild(style);
  }

  /**
   * An HTML drag and drop from one target to another, with synthetic events
   * sharing one DataTransfer (what the orders board listens to).
   */
  async function drag(fromSpec, toSpec) {
    const from = resolve(fromSpec);
    const to = resolve(toSpec);
    if (!from || !to) return false;
    const data = new DataTransfer();
    const fire = (el, type) => el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, composed: true, dataTransfer: data }));
    const pause = () => new Promise((done) => setTimeout(done, 80));
    fire(from, "dragstart");
    await pause();
    fire(to, "dragenter");
    fire(to, "dragover");
    await pause();
    fire(to, "drop");
    fire(from, "dragend");
    return true;
  }

  /** Whether React has hydrated the target (it attaches its props to the node). */
  function hydrated(spec) {
    const el = resolve(spec);
    return !!el && Object.keys(el).some((key) => key.startsWith("__reactProps$") || key.startsWith("__reactFiber$"));
  }

  window.__guide = { resolveAll, resolve, info, describe, annotate, clear, scrollTo, rectOf, click, setValue, mask, maskEmails, unmask, tidy, hydrated, drag };
  return true;
}

/** An expression that is window.__guide, installing it first when the document has none. */
const GUIDE = () => `(window.__guide || ((${pageLibrary.toString()})(), window.__guide))`;

/** Makes sure window.__guide exists in the current document. */
export async function ensureGuide(page) {
  await page.evaluate(`!!${GUIDE()}`);
}

function call(page, name, ...args) {
  return page.evaluate(`${GUIDE()}.${name}(...${JSON.stringify(args)})`);
}

/** A short text for a target, for messages. */
export function describeTarget(spec) {
  if (spec == null) return "(none)";
  if (typeof spec === "string") return spec;
  const parts = [];
  if (spec.css) parts.push(spec.css);
  if (spec.label) parts.push(`[label~"${spec.label}"]`);
  if (spec.text) parts.push(`"${spec.text}"`);
  if (spec.within) parts.push(`in ${describeTarget(spec.within)}`);
  if (spec.closest) parts.push(`^${spec.closest}`);
  return parts.join(" ");
}

/** { found, visible, count, tag, text, rect, disabled } for a target. */
export const targetInfo = (page, spec) => call(page, "info", spec);

/** Waits until the target is on the page and visible. Returns its info. */
export async function waitForTarget(page, spec, { timeoutMs = 20_000 } = {}) {
  return page.waitFor(
    `(() => { const i = ${GUIDE()}.info(${JSON.stringify(spec)}); return i.found && i.visible ? i : false; })()`,
    { timeoutMs, label: describeTarget(spec) },
  );
}

/** Scrolls the target to the middle of its scroll container (a modal's body too). */
export const scrollIntoView = (page, spec, { block = "center" } = {}) => call(page, "scrollTo", spec, block);

/**
 * Draws the rectangles, arrows and badges. `items` is a list of
 * { target, arrow?, label?, pad?, arrowLength? } (a bare target works too).
 * Answers { drawn, missing, layer }.
 */
export const annotate = (page, items, options = {}) =>
  call(page, "annotate", (Array.isArray(items) ? items : [items]).map((item) => (item && item.target !== undefined ? item : { target: item })), options);

export const clearAnnotations = (page) => call(page, "clear");

/** Blurs (or covers, style "box") every element the targets match. */
export const mask = (page, specs, style = "blur") => call(page, "mask", specs, style);

/** Blurs every email address whose domain is not in `keep`. Answers how many. */
export const maskEmails = (page, keep = []) => call(page, "maskEmails", keep);

export const unmask = (page) => call(page, "unmask");

/** Page coordinates of the targets' union plus padding, for a clipped screenshot. */
export const rectOf = (page, specs, pad = 24) => call(page, "rectOf", specs, pad);

/** element.click() on the target. Answers false when it is not there. */
export const clickTarget = (page, spec) => call(page, "click", spec);

/** Drags one target onto another (HTML drag and drop events). Answers false when either is missing. */
export const dragTo = (page, from, to) => call(page, "drag", from, to);

/** Sets an input, textarea, select or checkbox the way typing would, events included. */
export const setValue = (page, spec, value) => call(page, "setValue", spec, value);

export const tidyPage = (page) => call(page, "tidy");

/** Waits until React has hydrated the target, so a click reaches its handler. False on timeout. */
export async function waitForHydration(page, spec, { timeoutMs = 20_000 } = {}) {
  try {
    await page.waitFor(`${GUIDE()}.hydrated(${JSON.stringify(spec)})`, { timeoutMs, label: "hydration" });
    return true;
  } catch {
    return false;
  }
}
