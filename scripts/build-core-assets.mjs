import { build } from "esbuild";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export async function buildCoreAssets() {
  const vendor = resolve(root, "vendor/core");
  const manifest = JSON.parse(await readFile(resolve(vendor, "manifest.json"), "utf8"));
  for (const [path, expected] of Object.entries(manifest.files)) {
    const actual = createHash("sha256").update(await readFile(resolve(vendor, path))).digest("hex");
    if (actual !== expected) throw new Error(`Pinned Core asset changed: ${path}. Update provenance deliberately, not just the checksum.`);
  }
  const wasm = await readFile(resolve(vendor, "latexsnipper_wasm_bg.wasm"));
  const module = await WebAssembly.compile(wasm);
  const exported = WebAssembly.Module.exports(module).map((entry) => entry.name);
  for (const name of ["api_info_v3", "formula_capabilities_v3", "convert_formula_v3", "convert_formula_fragment_v3"]) {
    if (!exported.includes(name)) throw new Error(`Core conversion export missing: ${name}`);
  }
  if (exported.some((name) => /recognize|load_model|clear_models/.test(name))) throw new Error("Core asset contains the recognition profile.");
  const worker = await build({ entryPoints: [resolve(vendor, "runtime-src/worker-entry.ts")], bundle: true,
    write: false, platform: "browser", format: "esm", target: "es2020", minify: false });
  const payload = {
    CORE_ASSET_INFO: { ...manifest, wasmBytes: wasm.length, workerProtocolVersion: 1, apiEnvelopeVersion: 3 },
    GLUE_SOURCE: await readFile(resolve(vendor, "latexsnipper_wasm.js"), "utf8"),
    WORKER_SOURCE: worker.outputFiles[0].text,
    WASM_BASE64: wasm.toString("base64"),
  };
  await mkdir(resolve(root, "src/generated"), { recursive: true });
  await writeFile(resolve(root, "src/generated/core-payload.js"), "// Generated from pinned Core assets. Do not edit.\n"
    + Object.entries(payload).map(([key, value]) => `export const ${key} = ${JSON.stringify(value)};`).join("\n") + "\n");
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await buildCoreAssets();
