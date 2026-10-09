// Project CSS guardrails, not a replacement for a full stylelint ruleset.
import { readFile, readdir } from "node:fs/promises";
import { transform } from "esbuild";

let failures = 0;
for (const file of (await readdir("src/styles")).filter((name) => name.endsWith(".css") && name !== "mathlive.css")) {
  const source = await readFile("src/styles/" + file, "utf8");
  const result = await transform(source, { loader: "css", sourcefile: file });
  const rules = [
    [/!important\b/i, "Avoid !important; use scoped specificity or variables"],
    [/(?:^|[\s>,+~])mjx-[a-z-]+\b/m, "Use the MathJax [jax] attribute scope, not unknown custom type selectors"],
  ];
  for (const [pattern, message] of rules) if (pattern.test(source.replace(/\/\*[\s\S]*?\*\//g, ""))) {
    console.error(file + ": " + message); failures++;
  }
  for (const warning of result.warnings) { console.error(file + ": " + warning.text); failures++; }
}
if (failures) process.exitCode = 1;
else console.log("PASS CSS parsing, !important and MathJax selector guardrails (plugin-authored styles)");
