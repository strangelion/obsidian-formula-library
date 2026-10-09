import { readFile, mkdir, writeFile } from "node:fs/promises";

const version = process.env.VERSION || JSON.parse(await readFile("manifest.json", "utf8")).version;
const changelog = await readFile("CHANGELOG.md", "utf8");
const heading = "## [" + version + "]";
const start = changelog.indexOf(heading);
if (start < 0) throw new Error("Missing changelog for " + version);
const end = changelog.indexOf("\n## [", start + heading.length);
const notes = changelog.slice(start, end < 0 ? undefined : end).trim();
await mkdir("output", { recursive: true });
await writeFile("output/release-notes.md", notes + "\n");
console.log("Prepared release notes for " + version);
