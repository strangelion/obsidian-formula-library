// Maintenance-only: collect license texts from the exact locally built Core tree.
// The ordinary plugin build does not need Rust or the Core checkout.
import { execFileSync } from "node:child_process";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const core = process.argv[2] && resolve(process.argv[2]);
if (!core) throw new Error("Usage: node scripts/collect-core-licenses.mjs <clean pinned Core checkout>");
const pin = JSON.parse(await readFile(resolve(root, "vendor/core/manifest.json"), "utf8"));
const command = (name, args) => execFileSync(name, args, { cwd: core, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();
if (command("git", ["rev-parse", "HEAD"]) !== pin.sourceCommit || command("git", ["status", "--porcelain"])) {
  throw new Error("Core source must be the clean pinned revision.");
}
const selection = ["--locked", "-p", "latexsnipper-wasm", "--no-default-features", "--features", "conversion-only",
  "--target", "wasm32-unknown-unknown", "--edges", "normal", "--prefix", "none", "--format", "{p}"];
const identities = new Set(command("cargo", ["tree", ...selection]).split("\n").map((line) => line.match(/^([\w-]+) v([^\s]+)/))
  .filter(Boolean).map((match) => `${match[1]}@${match[2]}`));
const metadata = JSON.parse(command("cargo", ["metadata", "--locked", "--format-version", "1"]));
const texts = new Map(), packages = [];
for (const pkg of metadata.packages.filter((entry) => identities.has(`${entry.name}@${entry.version}`))) {
  const folder = dirname(pkg.manifest_path);
  let paths = (await readdir(folder)).filter((name) => /^(LICENSE|LICENCE|COPYING|NOTICE)(\b|[-_.])/i.test(name));
  if (!pkg.source) paths = [resolve(core, "LICENSE")];
  if (!paths.length) throw new Error(`No license text found for ${pkg.name}@${pkg.version}`);
  const licenseFiles = [];
  for (const path of paths) {
    const content = await readFile(resolve(folder, path), "utf8");
    const sha256 = createHash("sha256").update(content).digest("hex");
    if (!texts.has(sha256)) texts.set(sha256, { content, users: [] });
    texts.get(sha256).users.push(`${pkg.name}@${pkg.version}: ${path.startsWith(core) ? "Core LICENSE" : path}`);
    licenseFiles.push(sha256);
  }
  packages.push({ name: pkg.name, version: pkg.version, license: pkg.license || pin.license,
    source: pkg.source || `${pin.sourceRepository}/tree/${pin.sourceCommit}`, licenseFiles });
}
if (packages.length !== identities.size) throw new Error("Dependency inventory is incomplete.");
await writeFile(resolve(root, "vendor/core/dependencies.json"), JSON.stringify({ sourceCommit: pin.sourceCommit,
  profile: pin.profile, selection: "cargo tree normal dependency closure; includes compile-time proc macros, not a binary SBOM",
  packages: packages.sort((a, b) => a.name.localeCompare(b.name)) }, null, 2) + "\n");
await writeFile(resolve(root, "vendor/core/THIRD-PARTY-LICENSES.txt"), "Pinned Core conversion-only build dependency licenses\n\n"
  + [...texts.values()].map(({ content, users }) => users.join("\n") + "\n\n" + content).join("\n\n----------------------------------------\n\n"));
console.log(`Collected ${packages.length} dependency entries and ${texts.size} distinct license texts.`);
