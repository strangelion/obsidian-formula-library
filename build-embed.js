const fs = require("fs");
const path = require("path");

const mlPath = path.join(__dirname, "vendor", "mathlive.min.js");
const mainPath = path.join(__dirname, "main.js");

const mlContent = fs.readFileSync(mlPath, "utf8");
const b64 = Buffer.from(mlContent).toString("base64");

let mainSrc = fs.readFileSync(mainPath, "utf8");

// Remove any existing MATHLIVE_B64 declarations
const lines = mainSrc.split("\n");
const filtered = lines.filter(l => !l.startsWith("const MATHLIVE_B64 = "));
mainSrc = filtered.join("\n");

// Remove old loadMathLive function
const oldFunc = mainSrc.match(/function loadMathLive\(plugin\) \{[\s\S]*?^\}/m);
if (oldFunc) {
  mainSrc = mainSrc.replace(oldFunc[0], "");
}

// Insert MATHLIVE_B64 and loadMathLive before the settings tab
const insertBefore = "// ======================== Settings Tab ========================";
const insertIdx = mainSrc.indexOf(insertBefore);

const newCode = `const MATHLIVE_B64 = "${b64}";

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
}

`;

mainSrc = mainSrc.slice(0, insertIdx) + newCode + mainSrc.slice(insertIdx);

// Also fix the fontsDirectory to try local first, CDN as fallback
mainSrc = mainSrc.replace(
  /try \{ MathfieldElement\.fontsDirectory = plugin\.app\.vault\.adapter\.getResourcePath[\s\S]*?catch \(_\) \{\}/,
  `try { MathfieldElement.fontsDirectory = plugin.app.vault.adapter.getResourcePath(plugin.manifest.dir + "/vendor/fonts"); } catch (_) {}
      try { if (!MathfieldElement.fontsDirectory) MathfieldElement.fontsDirectory = plugin.manifest.dir + "/vendor/fonts"; } catch (_) {}`
);

// Fix loadMathLive calls
mainSrc = mainSrc.replace(/loadMathLive\(\);/g, "loadMathLive(this);");
mainSrc = mainSrc.replace(/await loadMathLive\(\);/g, "await loadMathLive(this);");

fs.writeFileSync(mainPath, mainSrc, "utf8");
console.log("Embedded MathLive (base64) into main.js");
console.log("main.js size:", (mainSrc.length / 1024).toFixed(0), "KB");
