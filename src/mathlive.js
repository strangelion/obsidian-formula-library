import { log, logWarn } from "./core.js";

let mathliveReady = false;
function loadBundledMathLive() {
  const mathlive = require("../vendor/mathlive-embedded.js");
  if (typeof window !== "undefined") window.MathLive = mathlive;
}

function loadMathLive(plugin) {
  if (mathliveReady) return Promise.resolve();
  if (typeof window !== "undefined" && window.MathfieldElement) {
    mathliveReady = true;
    return Promise.resolve();
  }
  try {
    loadBundledMathLive();
    const mathlive = (typeof window !== "undefined" && window.MathLive) || (typeof globalThis !== "undefined" && globalThis.MathLive);
    if (mathlive && mathlive.MathfieldElement && typeof window !== "undefined") {
      window.MathLive = mathlive;
      window.MathfieldElement = mathlive.MathfieldElement;
    }
    if (typeof window !== "undefined" && window.MathfieldElement) {
      mathliveReady = true;
      log("MathLive loaded from bundled source");
    } else {
      logWarn("MathLive loaded but MathfieldElement not found");
    }
  } catch (e) {
    logWarn("MathLive load failed:", e.message);
  }
  return Promise.resolve();
}

export { mathliveReady, loadBundledMathLive, loadMathLive };
