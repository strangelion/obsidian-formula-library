const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { buildSync } = require("esbuild");

const compiled = buildSync({
  stdin: { contents: ['core', 'custom-library', 'parameters', 'matrix', 'plot', 'plugin', 'drawing'].map((name) => `export * from './src/${name}.js';`).join('\n'), resolveDir: process.cwd() },
  bundle: true, write: false, platform: "node", format: "cjs", external: ["obsidian"],
}).outputFiles[0].text;
class Base { constructor(app) { this.app = app; } }
const sandbox = { module: { exports: {} }, console: { log() {}, warn() {}, error() {} }, navigator: { language: "zh-CN" }, window: { setTimeout, clearTimeout }, setTimeout, clearTimeout,
  require: (id) => {
    assert.equal(id, "obsidian");
    return { Plugin: Base, Modal: Base, PluginSettingTab: Base, ItemView: Base, MarkdownView: Base, Notice: Base };
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
