#!/usr/bin/env node
/**
 * Removes a production build left behind in .next before the dev server starts.
 *
 * `next build` and `next dev` share the .next directory. Starting dev on top of
 * production artefacts makes every route answer 404, with no error to explain
 * it. That cost an investigation once, so this runs as `predev`.
 *
 * It only deletes when BUILD_ID is present, which `next build` writes and
 * `next dev` does not. A normal dev session keeps its cache and its fast start.
 */

import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const next = join(process.cwd(), ".next");

if (existsSync(join(next, "BUILD_ID"))) {
  rmSync(next, { recursive: true, force: true });
  console.log("Removed a production build from .next so dev starts clean.");
}
