const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const { buildSync } = require("esbuild");

const compiled = buildSync({
  stdin: { contents: ['core', 'custom-library', 'parameters', 'matrix', 'plot', 'plugin', 'drawing', 'typography', 'backup', 'workspace-state', 'ui'].map((name) => `export * from './src/${name}.js';`).join('\n'), resolveDir: process.cwd() },
  bundle: true, write: false, platform: "node", format: "cjs", external: ["obsidian"],
}).outputFiles[0].text;
class Base { constructor(app) { this.app = app; } }
const sandbox = { module: { exports: {} }, console: { log() {}, warn() {}, error() {} }, navigator: { language: "zh-CN" }, window: { setTimeout, clearTimeout }, setTimeout, clearTimeout,
  require: (id) => {
    assert.equal(id, "obsidian");
    return { Plugin: Base, Modal: Base, PluginSettingTab: Base, ItemView: Base, MarkdownView: Base, Notice: Base, getLanguage:()=>"en" };
  },
};
vm.runInNewContext(compiled, sandbox);
const api = sandbox.module.exports;
const plain = (value) => JSON.parse(JSON.stringify(value));
const files = new Map();
const adapter = {
  async read(path) { if (!files.has(path)) throw new Error("not found: " + path); return files.get(path); },
  async list(folder) { return { files: [...files.keys()].filter((path) => path.startsWith(folder + "/")) }; },
  async exists(path) { return files.has(path); },
  async mkdir(path) { files.set(path, ""); },
  async write(path, value) { files.set(path, value); },
  async remove(path) { files.delete(path); },
};
const plugin = () => ({ settings: { ...plain(api.DEFAULT_SETTINGS), locale: "zh" }, manifest: { id: "formula-library" }, app: { vault: { adapter }, workspace: { getLeavesOfType: () => [] } }, async saveSettings() {}, async reloadFormulas() { await api.loadFormulas(this); } });

test("embedded library respects category and master switches, and accepts an empty library", async () => {
  const p = plugin();
  p.settings.enabledGroups.greek = false;
  await api.loadFormulas(p);
  assert.equal(api.FORMULA_DATA.GROUPS.some((group) => group.id === "greek"), false);
  p.settings.builtinLibraryEnabled = false;
  await api.loadFormulas(p);
  assert.equal(api.FORMULA_DATA.GROUPS.length, 0);
  assert.equal(p.settings.builtinLibraryEnabled, false);
});

test("custom library retains structures and counts formulas rather than section labels", async () => {
  const p = plugin();
  p.settings.customFormulasPath = "my-formulas";
  files.set("my-formulas/example.json", JSON.stringify({ id: "example", structures: true, items: [{ section: "Section" }, ["Test", "x"]] }));
  await api.loadFormulas(p);
  assert.equal(api.FORMULA_DATA.GROUPS.find((group) => group.id === "example").structures, true);
  assert.equal(api.FORMULA_INDEX.custom[0].count, 1);
});

test("changing custom folder does not keep writing to the previously loaded folder", () => {
  const p = plugin();
  api.FORMULA_INDEX.customFolder = "old-folder";
  p.settings.customFormulasPath = "new-folder";
  assert.equal(api.customFolderFor(p), "new-folder");
});

test("a malformed existing formula file is not converted into an empty file", async () => {
  const p = plugin();
  p.settings.customFormulasPath = "my-formulas";
  files.set("my-formulas/broken.json", "{invalid json");
  await assert.rejects(api.readCustomGroup(p, { id: "broken" }));
  assert.equal(files.get("my-formulas/broken.json"), "{invalid json");
});

test("import retains formula tags, notes and English labels", () => {
  const item = ["名称", "x^2", "Quadratic", { tags: ["代数", "exam"], note: "变量说明" }];
  assert.deepEqual(plain(api.sanitizeImportedEntries([item]).items[0]), item);
});

test("re-importing the same backup is idempotent and restores category enable state", async () => {
  files.clear();
  const p = plugin();
  p.settings.customFormulasPath = "restore";
  await p.reloadFormulas();
  const modal = new api.ImportFormulasModal(p.app, p);
  modal.statusEl = { setText() {} };
  const backup = { groups: [{ id: "algebra", name: "我的代数", enabled: false, items: [["平方", "x^2", "Square", { tags: ["exam"], note: "说明" }]] }] };
  await modal.importBackup(backup);
  await modal.importBackup(backup);
  const data = JSON.parse(files.get("restore/algebra.json"));
  assert.equal(data.items.length, 1);
  assert.equal(data.items[0][3].note, "说明");
  assert.equal(p.settings.customEnabledGroups.algebra, false);
});

test("escaped braces are valid but unmatched grouping braces are refused", () => {
  assert.equal(api.validateLatex("\\left\\{x\\right."), "");
  assert.equal(api.validateLatex("\\frac{x}{"), "latexBraces");
});

test("matrix trailing blank cells and explicitly added rows and columns survive", () => {
  const grid = api.parseMatrixGrid("1\t2\t\n3\t4\t", "tab");
  assert.equal(grid.width, 3);
  const modal = new api.MatrixPasteModal({}, plugin());
  modal.textarea = { value: "" };
  modal.delimSelect = { value: "tab" };
  modal.envSelect = { value: "bmatrix" };
  modal.applyGrid(api.addMatrixColumn(grid));
  assert.equal(modal.grid.width, 4);
  modal.applyGrid(api.addMatrixRow(modal.grid));
  assert.equal(modal.grid.height, 3);
});

test("plot expressions handle scientific notation and x followed by parentheses", () => {
  assert.equal(api.evaluateAst(api.parseExpressionAst("1e-3*x"), { x: 2 }), 0.002);
  assert.equal(api.evaluateAst(api.parseExpressionAst("x(x+1)"), { x: 2 }), 6);
  assert.throws(() => api.parseExpressionAst("."));
});

test("local constants may contain multi-argument calls", () => {
  const result = api.parsePlotLocals("a=max(1,2), b=a+1");
  assert.equal(result.errors.length, 0);
  assert.equal(result.values.a, 2);
  assert.equal(result.values.b, 3);
});

test("duplicate, forward-referenced and recursive plot functions are refused", () => {
  assert.equal(api.parsePlotDefinitions("f(t)=t\nf(t)=t+1").errors.length, 1);
  assert.equal(api.parsePlotDefinitions("f(t)=g(t)\ng(t)=t").errors.length, 1);
  assert.equal(api.parsePlotDefinitions("f(t)=f(t)+1").errors.length, 1);
});

test("reversed plot range gives an inline error instead of throwing or exporting stale SVG", () => {
  const p = plugin();
  const modal = new api.PlotFunctionModal({}, p);
  const input = (value) => ({ value, setAttribute() {} });
  modal.xMinInput = input("10"); modal.xMaxInput = input("-10");
  modal.yMinInput = input("-5"); modal.yMaxInput = input("5"); modal.autoY = { checked: true };
  modal.preview = { empty() {}, createDiv() {} };
  let message = "";
  modal.statusEl = { setAttribute() {}, setText(value) { message = value; } };
  modal.svgText = "old svg";
  assert.doesNotThrow(() => modal.renderPlot());
  assert.equal(modal.svgText, "");
  assert.match(message, /最大值/);
});

test("Mermaid compatibility refuses lossy source and preserves standalone nodes", () => {
  const source = "flowchart LR\nA[开始] --> B[完成]\nC[独立节点]";
  assert.equal(api.analyzeDrawingSource(source, "flowchart").compatible, true);
  assert.match(api.serializeVisualDrawing(api.parseVisualDrawing(source, "flowchart")), /C\[独立节点\]/);
  assert.equal(api.analyzeDrawingSource(source + "\nstyle A fill:red", "flowchart").compatible, false);
});

test("multiline formula insertion uses offsets to put the cursor on the correct line", () => {
  let document = "prefix\n";
  let cursor;
  const editor = {
    getCursor: () => ({ line: 1, ch: 0 }), posToOffset: () => document.length,
    replaceRange(value) { document += value; },
    offsetToPos(offset) { const lines = document.slice(0, offset).split("\n"); return { line: lines.length - 1, ch: lines.at(-1).length }; },
    setCursor(value) { cursor = value; }, focus() {},
  };
  const p = plugin(); p.findMarkdownEditor = () => editor;
  api.FormulaLibraryPlugin.prototype.insertFormula.call(p, "x\ny");
  assert.deepEqual(plain(cursor), { line: 2, ch: 3 });
});

test("settings maps and favorite arrays do not leak across plugin instances", async () => {
  const first = new api.FormulaLibraryPlugin({}); first.loadData = async () => null;
  const second = new api.FormulaLibraryPlugin({}); second.loadData = async () => null;
  await first.loadSettings(); await second.loadSettings();
  first.settings.favorites.push("x"); first.settings.usageCounts.x = 1;
  first.settings.customParamTemplates.push({ key: "custom-first" });
  assert.equal(second.settings.customParamTemplates.length, 0);
  assert.equal(second.settings.favorites.length, 0);
  assert.equal(second.settings.usageCounts.x, undefined);
});

test("custom parameter templates support both token syntaxes, repeated names and LaTeX defaults", () => {
  const template = { key: 'custom-demo', name: 'Demo', latex: String.raw`y = \frac{ {{a}}^{2} }{ {{b}} } + #a#`, params: [{name:'a',label:'A',value:'-2'},{name:'b',label:'B',value:String.raw`\alpha`}] };
  assert.deepEqual(plain(api.paramTemplateTokens(template.latex)), ['a','b']);
  assert.equal(api.validateCustomParamTemplate(template), '');
  const output = api.renderParamTemplate(template, {});
  assert.equal(output.includes('{{'), false);
  assert.equal(output.includes('#a#'), false);
  assert.equal(output.includes(String.raw`\left(-2\right)^{2}`), true);
  assert.equal(output.includes(String.raw`\alpha`), true);
  const p = plugin(); p.settings.customParamTemplates.push(template);
  assert.equal(api.paramTemplateByKey('custom-demo', p).name, 'Demo');
  assert.equal(api.paramTemplateByKey('custom-demo'), null);
});

test("custom template validation rejects missing names, invalid tokens and undefined defaults", () => {
  const template = {name:'Demo',latex:'{{a}}',params:[{name:'a',value:'a'}]};
  assert.notEqual(api.validateCustomParamTemplate({...template, name:''}), '');
  assert.notEqual(api.validateCustomParamTemplate({...template, latex:'{{1a}}'}), '');
  assert.notEqual(api.validateCustomParamTemplate({...template, params:[]}), '');
  assert.notEqual(api.validateCustomParamTemplate({...template, params:[{name:'a',value:String.raw`\frac{` }]}), '');
  assert.equal(api.validateCustomParamTemplate({...template, latex:String.raw`\frac{ {{a}} }{ x^{2}}`}), '');
});

function drawingModal() {
  const modal = new api.DrawingModal({}, plugin());
  modal.source = {value:api.DRAWING_TEMPLATES.flowchart.source, style:{}, focus(){}};
  modal.templateSelect = {value:'flowchart'};
  modal.visualEditor = {style:{}};
  modal.visualModeButton = {toggleClass(){}};
  modal.sourceModeButton = {toggleClass(){}};
  modal.editorTitle = {setText(){}};
  modal.status = {setText(){}};
  modal.renderVisualEditor = () => {};
  modal.scheduleRender = () => {};
  modal.scheduleDraftSave = () => {};
  modal.setMode('visual');
  return modal;
}

test("cross-template undo/redo restores template selection and safe editing mode together", () => {
  const modal = drawingModal();
  modal.pushHistoryValue(modal.source.value, {force:true});
  modal.currentTemplateKey='er'; modal.source.value=api.DRAWING_TEMPLATES.er.source; modal.setMode('source');
  modal.pushHistoryValue(modal.source.value, {force:true});
  modal.currentTemplateKey='state'; modal.source.value=api.DRAWING_TEMPLATES.state.source; modal.setMode('visual');
  modal.undo();
  assert.equal(modal.currentTemplateKey,'er'); assert.equal(modal.templateSelect.value,'er');
  assert.equal(modal.mode,'source'); assert.equal(modal.visualModeButton.disabled,true);
  assert.equal(modal.visualGraph,null);
  modal.undo();
  assert.equal(modal.mode,'visual'); assert.equal(modal.visualGraph.visualType,'flowchart');
  modal.redo(); modal.redo();
  assert.equal(modal.currentTemplateKey,'state'); assert.equal(modal.visualGraph.visualType,'state');
});

test("history refuses incompatible visual syntax and new typing invalidates redo", () => {
  const modal = drawingModal();
  const source = 'flowchart LR\n subgraph group\n A --> B\n end';
  modal.applyHistoryValue({source,key:'flowchart',mode:'visual'});
  assert.equal(modal.mode,'source'); assert.equal(modal.source.value,source);
  modal.redoStack.push(modal.historyState());
  modal.lastHistoryAt=Date.now();
  modal.pushHistoryValue(source);
  assert.equal(modal.redoStack.length,0);
});

test("the first typing after a template switch is independently undoable", () => {
  const modal = drawingModal();
  modal.pushHistoryValue(modal.source.value,{force:true});
  modal.currentTemplateKey='er'; modal.source.value=api.DRAWING_TEMPLATES.er.source; modal.setMode('source');
  modal.lastTextValue=modal.source.value;
  modal.source.value+='\n%% a comment';
  modal.onSourceInput();
  modal.undo();
  assert.equal(modal.currentTemplateKey,'er');
  assert.equal(modal.source.value,api.DRAWING_TEMPLATES.er.source);
});

test("existing settings default to following the host without changing MathLive font", async () => {
  const p = new api.FormulaLibraryPlugin({});
  p.loadData = async () => ({previewFontSize:27});
  await p.loadSettings();
  assert.equal(p.settings.libraryFontFollowObsidian,true);
  assert.equal(p.settings.previewFontSize,27);
});

test("independent library font sizes are validated and switching back removes overrides", () => {
  assert.equal(api.normalizeLibraryFontSize(undefined),18);
  assert.equal(api.normalizeLibraryFontSize('not a size'),18);
  assert.equal(api.normalizeLibraryFontSize(null),18);
  assert.equal(api.normalizeLibraryFontSize(''),18);
  assert.equal(api.normalizeLibraryFontSize(1),14);
  assert.equal(api.normalizeLibraryFontSize(100),32);
  assert.equal(api.normalizeLibraryFontSize('21.6'),22);
  const styles = new Map();
  const root = { dataset: {}, style: {setProperty:(name,value)=>styles.set(name,value),removeProperty:(name)=>styles.delete(name)} };
  api.applyLibraryTypography(root,{libraryFontFollowObsidian:false,libraryFontSize:22});
  assert.equal(styles.get('--fl-library-font-size'),'22px');
  api.applyLibraryTypography(root,{});
  assert.equal(styles.has('--fl-library-font-size'),false);
});

test("automatic locale follows the Obsidian API rather than OS language", () => {
  assert.equal(api.loc({settings:{locale:'auto'}}),'en');
  assert.equal(api.loc({settings:{locale:'zh'}}),'zh');
});

test("all bundled diagram samples have English sources without changing their Chinese originals", () => {
  for(const [key,template] of Object.entries(api.DRAWING_TEMPLATES)) {
    const en=api.drawingTemplateSource({settings:{locale:'en'}},key);
    assert.equal(/[\u4e00-\u9fff]/.test(en),false,key);
    assert.equal(api.drawingTemplateSource({settings:{locale:'zh'}},key),template.source);
    assert.equal(api.detectDrawingTemplateKey(en),key);
    if(template.visualType) assert.equal(api.analyzeDrawingSource(en,template.visualType).compatible,true);
  }
});

test("bare references do not erase a flowchart node's decision shape", () => {
  const graph=api.parseVisualDrawing('flowchart LR\n A --> B{Condition}\n B --> C\n D --> B','flowchart');
  assert.equal(graph.nodes.find((node)=>node.id==='B').shape,'diamond');
});

test("MathJax box-model protection uses lint-compatible container attributes", () => {
  const css=fs.readFileSync('src/styles/usability.css','utf8');
  assert.doesNotMatch(css,/\bmjx-container\b/);
  assert.match(css,/\.formula-library-modal \[jax\]/);
  assert.match(css,/\.formula-custom-modal \[jax\]/);
  assert.match(css,/box-sizing: content-box/);
});

const plotConfig = () => ({ version: 1, definitions: "f(t)=t^2+a", curves: [{ expression: "f(x)", locals: "b=2" }], range: { xMin: -4, xMax: 4, yMin: -3, yMax: 9 }, autoY: true, theme: "auto", parameters: { a: { value: 2, min: -20, max: 20, step: 0.25 } } });
const workspaceBackup = (settings = {}) => ({ format: "formula-library-workspace", version: 1, groups: [{ id: "personal", name: "Personal", structures: false, enabled: true, items: [["Test", "x^2", "Test", { tags: ["exam"], note: "original", units: "m" }]] }], settings });

test("workspace backup refuses unknown versions, invalid data and unsafe keys before writes", () => {
  assert.throws(() => api.parseWorkspaceBackup(JSON.stringify({ ...workspaceBackup(), version: 2 })));
  assert.throws(() => api.parseWorkspaceBackup(JSON.stringify({ ...workspaceBackup(), groups: [{ id: "../unsafe", items: [] }] })));
  assert.throws(() => api.parseWorkspaceBackup(JSON.stringify(workspaceBackup({ enabledGroups: [] }))));
  assert.throws(() => api.parseWorkspaceBackup(JSON.stringify(workspaceBackup({ libraryDensity: "invalid" }))));
  assert.throws(() => api.parseWorkspaceBackup('{"format":"formula-library-workspace","version":1,"groups":[],"settings":{"__proto__":{}}}'));
  assert.throws(() => api.parseWorkspaceBackup(JSON.stringify(workspaceBackup({ plotPresets: [{ name: "bad", config: { version: 1 } }] }))));
});

test("full backup includes disabled categories, templates, presets, favorites and drafts", async () => {
  files.clear(); const p = plugin(); p.settings.customFormulasPath = "full";
  files.set("full/personal.json", JSON.stringify({ id: "personal", structures: false, items: [["Test", "x^2"]] }));
  p.settings.customEnabledGroups.personal = false; p.settings.favorites = ["x^2"];
  p.settings.plotPresets = [{ name: "Quadratic", config: plotConfig() }];
  await api.writeDraft(p, "formula", { latex: "x+y", mode: "source", context: "" });
  await p.reloadFormulas();
  const backup = api.parseWorkspaceBackup(await api.buildWorkspaceBackup(p));
  assert.equal(backup.groups.length, 1); assert.equal(backup.groups[0].enabled, false);
  assert.deepEqual(plain(backup.settings.favorites), ["x^2"]);
  assert.equal(backup.settings.plotPresets[0].config.parameters.a.step, 0.25);
  assert.equal(backup.settings.formulaDraft.data.latex, "x+y");
});

test("workspace restore is additive, keeps paths/preferences and handles conflicts explicitly", async () => {
  files.clear(); const p = plugin(); p.settings.customFormulasPath = "target"; p.settings.locale = "zh";
  files.set("target/personal.json", JSON.stringify({ id: "personal", extra: "preserve", structures: false, items: [["Current", "x^2"], ["Other", "y"]] }));
  await p.reloadFormulas();
  const backup = workspaceBackup({ locale: "en", customFormulasPath: "wrong", plotFolder: "wrong", favorites: ["x^2"], plotPresets: [{ name: "test", config: plotConfig() }] });
  await api.restoreWorkspaceBackup(p, backup);
  assert.equal(p.settings.customFormulasPath, "target"); assert.equal(p.settings.locale, "zh"); assert.equal(p.settings.plotFolder, "plots");
  assert.equal(JSON.parse(files.get("target/personal.json")).items[0][0], "Current");
  await api.restoreWorkspaceBackup(p, backup, { conflict: "replace", preferences: true });
  const result = JSON.parse(files.get("target/personal.json"));
  assert.equal(result.items.length, 2); assert.equal(result.items[0][0], "Test"); assert.equal(result.extra, "preserve");
  assert.equal(result.items[0][3].units, "m"); assert.equal(p.settings.locale, "en");
  assert.equal(p.settings.plotPresets.length, 1);
});

test("restore rolls back exact file bytes and settings after a write fails", async () => {
  files.clear(); const p = plugin(); p.settings.customFormulasPath = "rollback";
  const original = '{"id":"personal","structures":false,"items":[["Original","y"]]}';
  files.set("rollback/personal.json", original); await p.reloadFormulas();
  const previous = plain(p.settings);
  const originalWrite = adapter.write; let failed = false;
  adapter.write = async (path, value) => { if (!failed && path.endsWith("_index.json")) { failed = true; throw new Error("simulated disk failure"); } return originalWrite(path, value); };
  try { await assert.rejects(api.restoreWorkspaceBackup(p, workspaceBackup()), /rolled back/); }
  finally { adapter.write = originalWrite; }
  assert.equal(files.get("rollback/personal.json"), original);
  assert.equal(files.has("rollback/_index.json"), false);
  assert.deepEqual(plain(p.settings), previous);
});

test("restore refuses damaged destination files and vault traversal without changing bytes", async () => {
  files.clear(); const p = plugin(); p.settings.customFormulasPath = "broken";
  files.set("broken/_index.json", "{broken");
  await assert.rejects(api.restoreWorkspaceBackup(p, workspaceBackup()));
  assert.equal(files.get("broken/_index.json"), "{broken");
  p.settings.customFormulasPath = "../outside";
  await assert.rejects(api.restoreWorkspaceBackup(p, workspaceBackup()));
  assert.equal(files.has("../outside/personal.json"), false);
});

test("parameter presets merge by name rather than dropping unrelated saved values", async () => {
  files.clear(); const p = plugin(); p.settings.customFormulasPath = "presets"; await p.reloadFormulas();
  p.settings.paramPresets.line = [{ name: "Existing", values: { a: "1" } }];
  const backup = workspaceBackup({ paramPresets: { line: [{ name: "Imported", values: { a: "2" } }] } });
  await api.restoreWorkspaceBackup(p, backup);
  assert.equal(p.settings.paramPresets.line.length, 2);
});

test("draft settings are isolated, opt-out is respected and successful clear removes the draft", async () => {
  const a = plugin(), b = plugin();
  await api.writeDraft(a, "plot", plotConfig());
  assert.equal(api.readDraft(b.settings, "plot"), null);
  const restored = api.readDraft(a.settings, "plot"); restored.range.xMin = 50;
  assert.equal(a.settings.plotDraft.data.range.xMin, -4);
  a.settings.rememberDrafts = false;
  assert.equal(api.readDraft(a.settings, "plot"), null);
  a.settings.rememberDrafts = true; await api.writeDraft(a, "plot", null);
  assert.equal(api.readDraft(a.settings, "plot"), null);
});

test("plot metadata round-trips safely and can locate either SVG or image-embed blocks", () => {
  const config = plotConfig(); config.curves[0].locals = ""; config.definitions += "\n// --> <script>";
  const comment = api.plotConfigComment(config);
  assert.equal(comment.includes("<script>"), false);
  for (const graphic of ['<svg viewBox="0 0 1 1"><g></g></svg>', '![[plots/example.svg]]']) {
    const note = 'Before\n' + comment + '\n' + graphic + '\nAfter';
    const info = api.findPlotBlockAt(note, note.indexOf(graphic) + 2);
    assert.deepEqual(plain(info.config), config); assert.equal(note.slice(info.start, info.end), info.original);
    assert.equal(api.findPlotBlockAt(note, 0), null);
  }
});

test("invalid plot parameter ranges, values, step and config versions are refused", () => {
  for (const change of [{ step: 0 }, { min: 30 }, { value: 21 }, { step: 50 }]) {
    const config = plotConfig(); Object.assign(config.parameters.a, change);
    assert.throws(() => api.validatePlotConfig(config));
  }
  assert.throws(() => api.validatePlotConfig({ ...plotConfig(), version: 2 }));
});

test("formula detail fields survive import and remain searchable", () => {
  const item = api.withItemMeta(["Test", "x"], [], "", { variables: "distance", units: "metres", conditions: "positive", reference: "Textbook" });
  assert.deepEqual(plain(api.sanitizeImportedEntries([item]).items[0]), plain(item));
  assert.ok(api.searchRank(plugin(), "metres", item) > 0);
});

test("one draft session cannot clear another editor's unfinished work", async () => {
  const p = plugin(), first = new api.DraftSession(p, "formula"), second = new api.DraftSession(p, "formula");
  await first.save({ latex: "x", mode: "source", context: "" });
  await second.save({ latex: "y", mode: "visual", context: "" });
  await first.clear();
  assert.equal(api.readDraft(p.settings, "formula").latex, "y");
  await second.clear(); assert.equal(api.readDraft(p.settings, "formula"), null);
});

test("plot replacement refuses a stale note block instead of overwriting other content", () => {
  const p = new api.FormulaLibraryPlugin({}); p.settings = plain(api.DEFAULT_SETTINGS);
  const config = plotConfig(), original = api.plotConfigComment(config) + '\n<svg></svg>';
  const editor = { text: original, getValue() { return this.text; }, getCursor:()=>({line:0,ch:0}), offsetToPos:(offset)=>({line:0,ch:offset}), replaceRange(value,start,end) { this.text=this.text.slice(0,start.ch)+value+this.text.slice(end.ch); }, focus(){} };
  const info = api.findPlotBlockAt(original, original.length-2);
  assert.equal(p.insertPlotSvg('<svg><g></g></svg>',config,info,editor),true);
  const updated = editor.text;
  assert.equal(p.insertPlotSvg('<svg><text>stale</text></svg>',config,info,editor),false);
  assert.equal(editor.text,updated);
});
