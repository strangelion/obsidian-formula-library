// Portable, JSON-only workspace state. Never evaluate imported expressions.
const clone = (value) => JSON.parse(JSON.stringify(value));
const unsafeKeys = new Set(["__proto__", "prototype", "constructor"]);

function safeJson(value, depth = 0) {
  if (depth > 16) throw new Error("Data is nested too deeply");
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.length <= 100000) return value;
  if (Array.isArray(value) && value.length <= 10000) return value.map((item) => safeJson(item, depth + 1));
  if (value && typeof value === "object") {
    const result = {};
    for (const [key, item] of Object.entries(value)) {
      if (unsafeKeys.has(key)) throw new Error("Unsafe data key: " + key);
      result[key] = safeJson(item, depth + 1);
    }
    return result;
  }
  throw new Error("Invalid or oversized data");
}

function readDraft(settings, kind) {
  if (settings.rememberDrafts === false) return null;
  const draft = settings[kind + "Draft"];
  return draft && draft.version === 1 && draft.data ? clone(draft.data) : null;
}

async function writeDraft(plugin, kind, data, owner) {
  if (plugin.settings.rememberDrafts === false) return;
  plugin.settings[kind + "Draft"] = data ? { version: 1, savedAt: new Date().toISOString(), data: clone(data), ...(owner ? { owner } : {}) } : null;
  await plugin.saveSettings();
}

// Multiple editors can be open. One editor must not clear another's saved work.
class DraftSession {
  constructor(plugin, kind) { this.plugin = plugin; this.kind = kind; this.owner = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2); }
  save(data) { return writeDraft(this.plugin, this.kind, data, this.owner); }
  clear() {
    if (this.plugin.settings[this.kind + "Draft"]?.owner !== this.owner) return Promise.resolve();
    return writeDraft(this.plugin, this.kind, null);
  }
}

function validatePlotConfig(input) {
  const config = safeJson(input);
  if (!config || config.version !== 1) throw new Error("Unsupported plot configuration version");
  if (!Array.isArray(config.curves) || config.curves.length < 1 || config.curves.length > 30) throw new Error("Use 1–30 curves");
  config.curves.forEach((curve) => {
    if (typeof curve.expression !== "string" || typeof curve.locals !== "string") throw new Error("Invalid curve");
  });
  if (typeof config.definitions !== "string") throw new Error("Invalid function definitions");
  const range = config.range;
  if (!range || ![range.xMin, range.xMax, range.yMin, range.yMax].every(Number.isFinite)
    || range.xMax <= range.xMin || (!config.autoY && range.yMax <= range.yMin)) throw new Error("Invalid plot range");
  if (typeof config.autoY !== "boolean" || !["auto", "light", "dark"].includes(config.theme)) throw new Error("Invalid plot options");
  if (!config.parameters || Array.isArray(config.parameters) || typeof config.parameters !== "object") throw new Error("Invalid plot parameters");
  for (const [name, param] of Object.entries(config.parameters)) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name) || !param
      || ![param.value, param.min, param.max, param.step].every(Number.isFinite)
      || param.max <= param.min || param.step <= 0 || param.step > param.max - param.min
      || param.value < param.min || param.value > param.max) throw new Error("Invalid parameter range: " + name);
  }
  return config;
}

// Comment metadata travels with the SVG/embed without adding a renderer or dependency.
function plotConfigComment(config) {
  return "<!-- formula-library-plot:" + encodeURIComponent(JSON.stringify(validatePlotConfig(config))) + " -->";
}

function findPlotBlockAt(text, offset) {
  const pattern = /<!-- formula-library-plot:([^\s]+) -->\r?\n(<svg\b[\s\S]*?<\/svg>|!\[\[[^\n]+\]\])/g;
  let match;
  while ((match = pattern.exec(text))) {
    if (offset < match.index || offset > match.index + match[0].length) continue;
    try { return { start: match.index, end: match.index + match[0].length, original: match[0], config: validatePlotConfig(JSON.parse(decodeURIComponent(match[1]))) }; }
    catch { return null; }
  }
  return null;
}

export { clone, safeJson, readDraft, writeDraft, DraftSession, validatePlotConfig, plotConfigComment, findPlotBlockAt };
