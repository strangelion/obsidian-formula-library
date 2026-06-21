const fs = require("fs");
const path = require("path");

const mlPath = path.join(__dirname, "vendor", "mathlive.min.js");
const mainPath = path.join(__dirname, "main.js");

const mlContent = fs.readFileSync(mlPath, "utf8");
const b64 = Buffer.from(mlContent).toString("base64");

let mainSrc = fs.readFileSync(mainPath, "utf8");

// Replace the loadMathLive function
const oldFunc = mainSrc.match(/function loadMathLive\(plugin\) \{[\s\S]*?^\}/m);
if (!oldFunc) {
  console.error("Could not find loadMathLive function");
  process.exit(1);
}

const newFunc = `const MATHLIVE_B64 = "${b64}";

function loadMathLive(plugin) {
  if (mathliveReady) return Promise.resolve();
  return new Promise((resolve) => {
    if (window.MathfieldElement) { mathliveReady = true; resolve(); return; }
    try {
      const code = atob(MATHLIVE_B64);
      const fn = new Function(code + "\\n; if(typeof MathfieldElement!=='undefined'){window.MathfieldElement=MathfieldElement; window.MathLive=MathLive;}");
      fn();
      if (window.MathfieldElement) {
        mathliveReady = true;
        log("MathLive loaded (embedded)");
        resolve();
      } else {
        logWarn("MathLive loaded but MathfieldElement not found");
        resolve();
      }
    } catch (e) {
      logWarn("MathLive eval failed:", e.message);
      resolve();
    }
  });
}`;

mainSrc = mainSrc.replace(oldFunc[0], newFunc);

// Also update the fontsDirectory to try CDN as fallback
mainSrc = mainSrc.replace(
  /try \{ MathfieldElement\.fontsDirectory = plugin\.app\.vault\.adapter\.getResourcePath[\s\S]*?catch \(_\) \{\}/,
  `try { MathfieldElement.fontsDirectory = plugin.app.vault.adapter.getResourcePath(plugin.manifest.dir + "/vendor/fonts"); } catch (_) {}
      try { if (!MathfieldElement.fontsDirectory) MathfieldElement.fontsDirectory = plugin.manifest.dir + "/vendor/fonts"; } catch (_) {}
      try { if (!MathfieldElement.fontsDirectory) MathfieldElement.fontsDirectory = "https://cdn.jsdelivr.net/npm/mathlive@0.104.0/dist/fonts"; } catch (_) {}`
);

fs.writeFileSync(mainPath, mainSrc, "utf8");
console.log("Embedded MathLive (base64) into main.js");
console.log("main.js size:", (mainSrc.length / 1024).toFixed(0), "KB");
