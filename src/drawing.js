import * as obsidian from "obsidian";
import { logWarn, loc, ui } from "./core.js";
import { downloadTextFile } from "./custom-library.js";

const DRAWING_TEMPLATES = {
  flowchart: {
    zh: "流程图",
    en: "Flowchart",
    visualType: "flowchart",
    source: "flowchart LR\n  A[开始] --> B{条件}\n  B -->|是| C[处理]\n  B -->|否| D[调整]\n  C --> E[完成]\n  D --> B",
    sourceEn: "flowchart LR\n  A[Start] --> B{Condition}\n  B -->|Yes| C[Process]\n  B -->|No| D[Adjust]\n  C --> E[Done]\n  D --> B",
  },
  mindmap: {
    zh: "思维导图",
    en: "Mind map",
    source: "mindmap\n  root((主题))\n    分支 A\n      要点 A1\n      要点 A2\n    分支 B\n      要点 B1",
    sourceEn: "mindmap\n  root((Topic))\n    Branch A\n      Point A1\n      Point A2\n    Branch B\n      Point B1",
  },
  sequence: {
    zh: "时序图",
    en: "Sequence",
    source: "sequenceDiagram\n  participant U as 用户\n  participant P as 插件\n  participant O as Obsidian\n  U->>P: 提交内容\n  P->>O: 写入笔记\n  O-->>U: 更新完成",
    sourceEn: "sequenceDiagram\n  participant U as User\n  participant P as Plugin\n  participant O as Obsidian\n  U->>P: Submit content\n  P->>O: Write to note\n  O-->>U: Update complete",
  },
  state: {
    zh: "状态图",
    en: "State",
    visualType: "state",
    source: "stateDiagram-v2\n  [*] --> 编辑\n  编辑 --> 预览\n  预览 --> 编辑: 修改\n  预览 --> 完成: 插入\n  完成 --> [*]",
    sourceEn: "stateDiagram-v2\n  [*] --> Edit\n  Edit --> Preview\n  Preview --> Edit: Revise\n  Preview --> Done: Insert\n  Done --> [*]",
  },
  classDiagram: {
    zh: "类图",
    en: "Class diagram",
    source: "classDiagram\n  class Formula {\n    +String latex\n    +String label\n    +insert()\n  }\n  class Library {\n    +search(query)\n    +pin(formula)\n  }\n  Library o-- Formula",
    sourceEn: "classDiagram\n  class Formula {\n    +String latex\n    +String label\n    +insert()\n  }\n  class Library {\n    +search(query)\n    +pin(formula)\n  }\n  Library o-- Formula",
  },
  er: {
    zh: "实体关系图",
    en: "ER diagram",
    source: "erDiagram\n  USER ||--o{ NOTE : creates\n  USER {\n    string id PK\n    string name\n  }\n  NOTE {\n    string id PK\n    string title\n  }",
    sourceEn: "erDiagram\n  USER ||--o{ NOTE : creates\n  USER {\n    string id PK\n    string name\n  }\n  NOTE {\n    string id PK\n    string title\n  }",
  },
  gantt: {
    zh: "甘特图",
    en: "Gantt",
    source: "gantt\n  title 项目计划\n  dateFormat YYYY-MM-DD\n  section 设计\n  需求分析 :done, a1, 2026-08-01, 3d\n  界面设计 :active, a2, after a1, 4d\n  section 开发\n  功能实现 :a3, after a2, 7d\n  测试发布 :a4, after a3, 3d",
    sourceEn: "gantt\n  title Project plan\n  dateFormat YYYY-MM-DD\n  section Design\n  Requirements :done, a1, 2026-08-01, 3d\n  Interface design :active, a2, after a1, 4d\n  section Development\n  Implementation :a3, after a2, 7d\n  Test and release :a4, after a3, 3d",
  },
  timeline: {
    zh: "时间线",
    en: "Timeline",
    source: "timeline\n  title 版本路线图\n  2026 Q1 : 搜索与收藏\n  2026 Q2 : 公式编辑器\n  2026 Q3 : 可视化绘图\n  2026 Q4 : 扩展与同步",
    sourceEn: "timeline\n  title Release roadmap\n  2026 Q1 : Search and favorites\n  2026 Q2 : Formula editor\n  2026 Q3 : Visual diagrams\n  2026 Q4 : Extensions and sync",
  },
  pie: {
    zh: "饼图",
    en: "Pie chart",
    source: "pie showData\n  title 公式分类\n  \"代数\" : 42\n  \"微积分\" : 30\n  \"几何\" : 18\n  \"其他\" : 10",
    sourceEn: "pie showData\n  title Formula categories\n  \"Algebra\" : 42\n  \"Calculus\" : 30\n  \"Geometry\" : 18\n  \"Other\" : 10",
  },
  quadrant: {
    zh: "象限图",
    en: "Quadrant chart",
    source: "quadrantChart\n  title 功能优先级\n  x-axis 低成本 --> 高成本\n  y-axis 低价值 --> 高价值\n  quadrant-1 战略投入\n  quadrant-2 快速收益\n  quadrant-3 暂缓\n  quadrant-4 谨慎评估\n  搜索优化: [0.25, 0.82]\n  绘图编辑: [0.62, 0.76]",
    sourceEn: "quadrantChart\n  title Feature priorities\n  x-axis Low cost --> High cost\n  y-axis Low value --> High value\n  quadrant-1 Strategic investment\n  quadrant-2 Quick wins\n  quadrant-3 Defer\n  quadrant-4 Evaluate carefully\n  Search: [0.25, 0.82]\n  Diagrams: [0.62, 0.76]",
  },
  gitGraph: {
    zh: "Git 分支图",
    en: "Git graph",
    source: "gitGraph\n  commit id: \"初始化\"\n  branch feature\n  checkout feature\n  commit id: \"功能开发\"\n  checkout main\n  merge feature\n  commit id: \"发布\"",
    sourceEn: "gitGraph\n  commit id: \"Initialize\"\n  branch feature\n  checkout feature\n  commit id: \"Develop feature\"\n  checkout main\n  merge feature\n  commit id: \"Release\"",
  },
};

export function drawingTemplateSource(plugin, key) {
  const template = DRAWING_TEMPLATES[key] || DRAWING_TEMPLATES.flowchart;
  return loc(plugin) === "en" ? (template.sourceEn || template.source) : template.source;
}

const DRAWING_NODE_ID_RE = /^[\p{L}\p{N}_-]+$/u;
const DRAWING_SHAPE_RE = /^[\p{L}\p{N}_-]+(?:\(\(.*\)\)|\{.*\}|\[.*\])$/u;
const DRAWING_FLOW_HEADER_RE = /^(?:flowchart|graph)(?:\s+(?:TB|TD|BT|RL|LR))?$/i;
const DRAWING_STATE_HEADER_RE = /^stateDiagram(?:-v2)?$/i;
const DRAWING_DIRECTION_RE = /^direction\s+(TB|BT|RL|LR)$/i;
const DRAWING_STATE_ALIAS_RE = /^state\s+"([^"]*)"\s+as\s+([\p{L}\p{N}_-]+)$/u;

function isDrawingNodeToken(token) {
  const value = String(token || "").trim();
  return DRAWING_NODE_ID_RE.test(value) || DRAWING_SHAPE_RE.test(value);
}

// Lists the source lines the visual editor cannot represent. The visual editor
// re-serializes the whole diagram, so unsupported syntax has to be detected
// first: it would otherwise be dropped without warning.
function analyzeDrawingSource(source, visualType) {
  const unsupported = [];
  if (!visualType) return { compatible: false, unsupported: unsupported };
  const lines = String(source || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  if (visualType === "flowchart") {
    lines.forEach((line, index) => {
      if (index === 0) {
        if (!DRAWING_FLOW_HEADER_RE.test(line)) unsupported.push({ line: index + 1, text: line });
        return;
      }
      const parts = line.split("-->");
      if (parts.length === 2) {
        const from = parts[0].trim();
        let rest = parts[1].trim();
        const label = rest.match(/^\|([^|]*)\|\s*(.*)$/);
        if (label) rest = label[2].trim();
        if (isDrawingNodeToken(from) && isDrawingNodeToken(rest)) return;
      } else if (parts.length === 1 && isDrawingNodeToken(line)) {
        return;
      }
      unsupported.push({ line: index + 1, text: line });
    });
    return { compatible: unsupported.length === 0, unsupported: unsupported };
  }

  if (visualType === "state") {
    lines.forEach((line, index) => {
      if (index === 0) {
        if (!DRAWING_STATE_HEADER_RE.test(line)) unsupported.push({ line: index + 1, text: line });
        return;
      }
      if (DRAWING_DIRECTION_RE.test(line) || DRAWING_STATE_ALIAS_RE.test(line)) return;
      const parts = line.split("-->");
      if (parts.length === 2) {
        const from = parts[0].trim();
        const to = parts[1].split(":")[0].trim();
        const fromOk = from === "[*]" || isDrawingNodeToken(from);
        const toOk = to === "[*]" || isDrawingNodeToken(to);
        if (fromOk && toOk) return;
      }
      unsupported.push({ line: index + 1, text: line });
    });
    return { compatible: unsupported.length === 0, unsupported: unsupported };
  }

  return { compatible: false, unsupported: unsupported };
}

function parseDrawingNodeToken(token) {
  const value = String(token || "").trim();
  const match = value.match(/^([\p{L}\p{N}_-]+)(?:\(\((.*?)\)\)|\{(.*?)\}|\[(.*?)\])$/u);
  if (!match) return { id: value, label: value, shape: "rect" };
  if (match[2] !== undefined) return { id: match[1], label: match[2], shape: "circle" };
  if (match[3] !== undefined) return { id: match[1], label: match[3], shape: "diamond" };
  return { id: match[1], label: match[4], shape: "rect" };
}

// ---- Drawing workflow helpers: locating an existing diagram and zoom math ----

// Locate the fenced mermaid block that contains the given character offset.
// Returns the block body plus the offsets needed to replace the block in place.
function findMermaidBlockAt(text, offset) {
  const source = String(text == null ? "" : text);
  const pos = Number(offset) || 0;
  const re = /^[ \t]*```[ \t]*\{?mermaid\}?[ \t]*\r?\n([\s\S]*?)^[ \t]*```[ \t]*$/gm;
  let match;
  while ((match = re.exec(source)) !== null) {
    const bodyStart = match.index + match[0].indexOf(match[1]);
    const bodyEnd = bodyStart + match[1].length;
    const end = match.index + match[0].length;
    if (pos >= match.index && pos <= end) {
      return { source: match[1].replace(/\s+$/, ""), bodyStart, bodyEnd, start: match.index, end };
    }
  }
  return null;
}

// Map a source's first meaningful line back to the matching template key, so an
// existing diagram opens with the right mode and preview.
const DRAWING_TEMPLATE_PATTERNS = [
  [/^[ \t]*(?:flowchart|graph)\b/i, "flowchart"],
  [/^[ \t]*stateDiagram\b/i, "state"],
  [/^[ \t]*sequenceDiagram\b/i, "sequence"],
  [/^[ \t]*classDiagram\b/i, "classDiagram"],
  [/^[ \t]*erDiagram\b/i, "er"],
  [/^[ \t]*gantt\b/i, "gantt"],
  [/^[ \t]*mindmap\b/i, "mindmap"],
  [/^[ \t]*pie\b/i, "pie"],
  [/^[ \t]*timeline\b/i, "timeline"],
  [/^[ \t]*quadrantChart\b/i, "quadrant"],
  [/^[ \t]*gitGraph\b/i, "gitGraph"]
];

function detectDrawingTemplateKey(source) {
  const lines = String(source || "").split(/\r?\n/);
  const first = lines.find((line) => line.trim() && !line.trim().startsWith("%%"));
  if (!first) return "flowchart";
  for (const [re, key] of DRAWING_TEMPLATE_PATTERNS) {
    if (re.test(first) && DRAWING_TEMPLATES[key]) return key;
  }
  return "flowchart";
}

// Natural size of an exported diagram: the viewBox wins, the zoomed pane is the fallback.
function svgNaturalSize(viewBox, zoom, boxWidth, boxHeight) {
  const parts = String(viewBox || "").trim().split(/[\s,]+/).map(Number);
  if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) return { w: parts[2], h: parts[3] };
  const factor = zoom > 0 ? zoom : 1;
  return {
    w: Math.max(1, Math.round((boxWidth || 0) / factor)),
    h: Math.max(1, Math.round((boxHeight || 0) / factor)),
  };
}

const DRAWING_MIN_ZOOM = 0.25;
const DRAWING_MAX_ZOOM = 6;

function clampZoom(value) {
  const z = Number(value);
  if (!isFinite(z) || z <= 0) return 1;
  return Math.min(DRAWING_MAX_ZOOM, Math.max(DRAWING_MIN_ZOOM, z));
}

// Zoom factor that fits a w x h box into bw x bh while keeping a padding gutter.
function computeFitZoom(w, h, bw, bh, padding) {
  const pad = Number(padding) || 0;
  const innerW = Math.max(1, Number(bw) - pad * 2);
  const innerH = Math.max(1, Number(bh) - pad * 2);
  const contentW = Math.max(1, Number(w));
  const contentH = Math.max(1, Number(h));
  return clampZoom(Math.min(innerW / contentW, innerH / contentH));
}

function parseVisualDrawing(source, visualType) {
  const lines = String(source || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const graph = { visualType, direction: "LR", nodes: [], edges: [] };
  const nodeMap = new Map();
  const stateAliases = new Map();
  const addNode = (token) => {
    if (visualType === "state") {
      if (token === "[*]") return token;
      if (nodeMap.has(token)) return nodeMap.get(token).id;
      const node = { id: `S${nodeMap.size + 1}`, label: stateAliases.get(token) || token, shape: "rect" };
      nodeMap.set(token, node);
      graph.nodes.push(node);
      return node.id;
    }
    const parsed = parseDrawingNodeToken(token);
    if (!parsed.id) return "";
    const existing = nodeMap.get(parsed.id);
    if (existing) {
      if (parsed.label && parsed.label !== parsed.id) existing.label = parsed.label;
      if (DRAWING_SHAPE_RE.test(token)) existing.shape = parsed.shape;
      return existing.id;
    }
    nodeMap.set(parsed.id, parsed);
    graph.nodes.push(parsed);
    return parsed.id;
  };

  if (visualType === "flowchart") {
    const header = lines.shift() || "";
    const headerMatch = header.match(/^(?:flowchart|graph)\s+(TB|TD|BT|RL|LR)$/i);
    graph.direction = headerMatch ? headerMatch[1].toUpperCase() : "LR";
    for (const line of lines) {
      const edge = line.match(/^(.+?)\s*-->\s*(?:\|([^|]*)\|\s*)?(.+?)$/);
      if (!edge) {
        // Standalone node declaration (`B{condition}`): creating the node here
        // keeps it alive across a visual round-trip instead of dropping it.
        if (isDrawingNodeToken(line)) addNode(line);
        continue;
      }
      graph.edges.push({ from: addNode(edge[1]), to: addNode(edge[3]), label: (edge[2] || "").trim() });
    }
  } else if (visualType === "state") {
    lines.shift();
    for (const line of lines) {
      const alias = line.match(/^state\s+"([^"]*)"\s+as\s+([\p{L}\p{N}_-]+)$/u);
      if (alias) stateAliases.set(alias[2], alias[1]);
    }
    for (const line of lines) {
      const direction = line.match(DRAWING_DIRECTION_RE);
      if (direction) {
        graph.direction = direction[1].toUpperCase();
        continue;
      }
      const alias = line.match(DRAWING_STATE_ALIAS_RE);
      if (alias) {
        // Declared states must exist even without any transition.
        addNode(alias[2]);
        continue;
      }
      if (/^state\s+/.test(line)) continue;
      const edge = line.match(/^(.+?)\s*-->\s*([^:]+?)(?:\s*:\s*(.+))?$/);
      if (!edge) continue;
      const fromToken = edge[1].trim();
      const toToken = edge[2].trim();
      graph.edges.push({
        from: fromToken === "[*]" ? "__start__" : addNode(fromToken),
        to: toToken === "[*]" ? "__end__" : addNode(toToken),
        label: (edge[3] || "").trim(),
      });
    }
  }
  return graph;
}

function serializeVisualDrawing(graph) {
  if (graph.visualType === "state") {
    const aliases = graph.nodes.map((node) => `  state "${String(node.label || node.id).replace(/"/g, "'")}" as ${node.id}`);
    const edges = graph.edges.map((edge) => {
      const from = edge.from === "__start__" ? "[*]" : edge.from;
      const to = edge.to === "__end__" ? "[*]" : edge.to;
      return `  ${from} --> ${to}${edge.label ? `: ${edge.label}` : ""}`;
    });
    return ["stateDiagram-v2", `  direction ${graph.direction}`, ...aliases, ...edges].join("\n");
  }
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  const token = (id) => {
    const node = nodeMap.get(id) || { id, label: id, shape: "rect" };
    const label = String(node.label || node.id).replace(/[\[\]{}]/g, "");
    if (node.shape === "diamond") return `${node.id}{${label}}`;
    if (node.shape === "circle") return `${node.id}((${label}))`;
    return `${node.id}[${label}]`;
  };
  const edges = graph.edges.map((edge) => `  ${token(edge.from)} -->${edge.label ? `|${edge.label.replace(/\|/g, "/")}|` : ""} ${token(edge.to)}`);
  const connected = new Set(graph.edges.flatMap((edge) => [edge.from, edge.to]));
  const isolated = graph.nodes.filter((node) => !connected.has(node.id)).map((node) => `  ${token(node.id)}`);
  return [`flowchart ${graph.direction}`, ...edges, ...isolated].join("\n");
}

class DrawingModal extends obsidian.Modal {
  constructor(app, plugin, options) {
    super(app);
    const opts = options || {};
    this.plugin = plugin;
    // Set when this modal edits a ```mermaid block that already lives in the note
    // instead of inserting a new one.
    this.existingSource = typeof opts.source === "string" && opts.source.trim() ? opts.source : null;
    this.drawingInfo = opts.drawingInfo || null;
    // Preview navigation state (scale factor plus pan offsets in px).
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.previewSvg = null;
    this.panState = null;
    this.renderVersion = 0;
    this.renderTimer = null;
    this.mode = "visual";
    this.currentTemplateKey = "flowchart";
    this.visualGraph = null;
    // Drawing source protection: undo/redo snapshots, the last hand-written
    // source ("original") and the debounced draft writer.
    this.undoStack = [];
    this.redoStack = [];
    this.lastHistoryAt = 0;
    this.lastTextValue = "";
    this.lastSerialized = "";
    this.originalSource = "";
    this.originalState = null;
    this.draftTimer = null;
    this.accepted = false;
  }

  onOpen() {
    this.containerEl.addClass("formula-drawing-modal-container");
    this.modalEl.addClass("formula-drawing-modal");
    this.titleEl.setText(this.drawingInfo ? ui(this.plugin, "drawingEditExisting") : ui(this.plugin, "drawingTitle"));

    const toolbar = this.contentEl.createDiv({ cls: "fd-toolbar" });
    const templateField = toolbar.createDiv({ cls: "fd-template-field" });
    templateField.createEl("label", { text: ui(this.plugin, "drawingTemplate") });
    const select = templateField.createEl("select", { cls: "fl-group-select" });
    this.templateSelect = select;
    for (const [key, template] of Object.entries(DRAWING_TEMPLATES)) {
      select.createEl("option", { value: key, text: template[loc(this.plugin)] });
    }

    const modeToggle = toolbar.createDiv({ cls: "fd-mode-toggle" });
    this.visualModeButton = modeToggle.createEl("button", { cls: "fd-mode-button", text: loc(this.plugin) === "zh" ? "可视化" : "Visual", attr: { type: "button" } });
    this.sourceModeButton = modeToggle.createEl("button", { cls: "fd-mode-button", text: ui(this.plugin, "drawingSource"), attr: { type: "button" } });

    const actions = toolbar.createDiv({ cls: "fd-actions" });
    if (this.app.plugins?.getPlugin?.("obsidian-excalidraw-plugin")) {
      const excalidrawButton = actions.createEl("button", { cls: "fe-btn", text: "Excalidraw", attr: { type: "button" } });
      excalidrawButton.addEventListener("click", () => {
        this.close();
        window.setTimeout(() => {
          const opened = this.app.commands?.executeCommandById?.("obsidian-excalidraw-plugin:excalidraw-autocreate");
          if (!opened) new obsidian.Notice(loc(this.plugin) === "zh" ? "无法打开 Excalidraw，请确认插件已启用" : "Unable to open Excalidraw. Make sure the plugin is enabled.");
        }, 0);
      });
    }
    this.undoButton = actions.createEl("button", { cls: "fe-btn", text: ui(this.plugin, "drawingUndo"), attr: { type: "button" } });
    this.undoButton.addEventListener("click", () => this.undo());
    this.redoButton = actions.createEl("button", { cls: "fe-btn", text: ui(this.plugin, "drawingRedo"), attr: { type: "button" } });
    this.redoButton.addEventListener("click", () => this.redo());
    this.restoreButton = actions.createEl("button", { cls: "fe-btn", text: ui(this.plugin, "drawingRestoreOriginal"), attr: { type: "button" } });
    this.restoreButton.addEventListener("click", () => this.restoreOriginal());
    actions.createEl("button", { cls: "fe-btn", text: ui(this.plugin, "cancel") }).addEventListener("click", () => this.close());
    const insertButton = actions.createEl("button", { cls: "fe-btn fe-btn-primary", text: ui(this.plugin, "drawingInsert") });

    const workspace = this.contentEl.createDiv({ cls: "fd-workspace" });
    const sourcePane = workspace.createDiv({ cls: "fd-pane fd-source-pane" });
    this.editorTitle = sourcePane.createEl("label", { text: ui(this.plugin, "drawingSource") });
    this.source = sourcePane.createEl("textarea", { cls: "fd-source", attr: { spellcheck: "false", "aria-label": ui(this.plugin, "drawingSource") } });
    this.visualEditor = sourcePane.createDiv({ cls: "fd-visual-editor" });
    // Always-visible hint about whether visual editing can represent the source.
    this.compatHint = sourcePane.createDiv({ cls: "fd-compat-hint" });

    const previewPane = workspace.createDiv({ cls: "fd-pane fd-preview-pane" });
    const previewHead = previewPane.createDiv({ cls: "fd-pane-head" });
    previewHead.createEl("div", { cls: "fd-pane-title", text: ui(this.plugin, "drawingPreview") });
    const zoomBar = previewHead.createDiv({ cls: "fd-zoom-bar" });
    const zoomButton = (key, text, handler) => {
      const button = zoomBar.createEl("button", { cls: "fd-zoom-btn", text, attr: { type: "button", title: ui(this.plugin, key), "aria-label": ui(this.plugin, key) } });
      button.addEventListener("click", handler);
      if (key === "drawingZoomOut" || key === "drawingZoomIn") {
        button.empty();
        button.addClass("fd-zoom-icon");
        obsidian.setIcon(button, key === "drawingZoomIn" ? "plus" : "minus");
      }
      return button;
    };
    zoomButton("drawingZoomOut", "-", () => this.zoomBy(1 / 1.2));
    this.zoomValueEl = zoomBar.createEl("span", { cls: "fd-zoom-value", text: "100%" });
    zoomButton("drawingZoomIn", "+", () => this.zoomBy(1.2));
    zoomButton("drawingFit", ui(this.plugin, "drawingFit"), () => this.fitPreview());
    zoomButton("drawingZoomReset", "100%", () => this.resetZoom());
    this.exportSvgButton = zoomBar.createEl("button", { cls: "fd-zoom-btn fd-export-svg", text: ui(this.plugin, "drawingExportSvg"), attr: { type: "button" } });
    this.exportSvgButton.addEventListener("click", () => this.exportSvg());
    this.previewViewport = previewPane.createDiv({ cls: "fd-preview-viewport" });
    this.preview = this.previewViewport.createDiv({ cls: "fd-preview" });
    this.previewObserver = new MutationObserver(() => {
      const svg = this.preview.querySelector(".mermaid svg[viewBox], svg[aria-roledescription]");
      if (svg !== this.previewSvg) this.applyZoom();
    });
    this.previewObserver.observe(this.preview, { childList: true, subtree: true });
    previewPane.createEl("div", { cls: "fd-preview-hint", text: ui(this.plugin, "drawingPanHint") });
    this.status = previewPane.createDiv({ cls: "fd-status" });
    this.bindPreviewInteraction();

    const applyTemplate = (initial) => {
      const key = select.value in DRAWING_TEMPLATES ? select.value : "flowchart";
      const template = DRAWING_TEMPLATES[key];
      const source = drawingTemplateSource(this.plugin, key);
      const previous = this.source.value;
      if (!initial && previous && previous !== source) {
        // Applying a template overwrites the current source: keep it undoable.
        this.pushHistoryValue(previous, { force: true });
      }
      this.currentTemplateKey = key;
      this.source.value = source;
      this.lastTextValue = source;
      this.lastSerialized = source;
      // "Restore original" returns to the text this session started from; a later
      // template switch stays recoverable through undo instead.
      if (initial) this.originalSource = source;
      this.visualGraph = template.visualType ? parseVisualDrawing(source, template.visualType) : null;
      if (template.visualType) {
        this.setMode(this.mode === "source" ? "source" : "visual");
        if (!initial) this.status.setText(ui(this.plugin, "drawingTemplateReplaced"));
      } else {
        this.setMode("source");
        this.status.setText(loc(this.plugin) === "zh" ? "此图型使用 Mermaid 源码编辑" : "This diagram type uses Mermaid source editing");
      }
      if (initial) this.originalState = this.historyState();
      this.handleSourceChanged({ syncVisual: false, saveDraft: !initial });
    };
    select.addEventListener("change", () => applyTemplate(false));
    this.source.addEventListener("input", () => this.onSourceInput());
    this.source.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && event.shiftKey && !event.isComposing) {
        event.preventDefault();
        this.accept();
      }
    });
    this.visualModeButton.addEventListener("click", () => this.setMode("visual"));
    this.sourceModeButton.addEventListener("click", () => this.setMode("source"));
    insertButton.addEventListener("click", () => this.accept());
    this.containerEl.addEventListener("keydown", (event) => {
      const mod = event.ctrlKey || event.metaKey;
      if (!mod || event.isComposing) return;
      const key = String(event.key || "").toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        this.undo();
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault();
        this.redo();
      }
    });

    const draft = this.plugin.settings.rememberDrafts === false ? null : this.plugin.settings.drawingDraft;
    if (this.existingSource) {
      // Editing a diagram that already lives in the note: the note content wins
      // over any leftover draft.
      this.loadSource(this.existingSource, {});
    } else if (draft && typeof draft.source === "string" && draft.source.trim()) {
      const key = DRAWING_TEMPLATES[draft.templateKey] ? draft.templateKey : this.currentTemplateKey;
      const template = DRAWING_TEMPLATES[key];
      this.loadSource(draft.source, { key, mode: template.visualType && draft.mode === "visual" ? "visual" : "source", status: "drawingDraftRestored" });
    } else {
      applyTemplate(true);
    }
    this.updateHistoryButtons();
  }

  // Load a source into the editor: pick the matching template, keep the text as
  // this session's original (so "restore original" can return to it) and render.
  loadSource(source, options) {
    const opts = options || {};
    const key = opts.key && DRAWING_TEMPLATES[opts.key] ? opts.key : detectDrawingTemplateKey(source);
    const template = DRAWING_TEMPLATES[key] || DRAWING_TEMPLATES.flowchart;
    this.currentTemplateKey = key;
    if (this.templateSelect) this.templateSelect.value = key;
    this.source.value = source;
    this.lastTextValue = source;
    this.lastSerialized = source;
    this.originalSource = source;
    this.visualGraph = template.visualType ? parseVisualDrawing(source, template.visualType) : null;
    if (opts.status) this.status.setText(ui(this.plugin, opts.status));
    this.setMode(template.visualType && opts.mode === "visual" ? "visual" : "source");
    this.originalState = this.historyState();
    this.handleSourceChanged({ syncVisual: false, saveDraft: false });
    this.updateHistoryButtons();
  }

  setMode(mode) {
    const template = DRAWING_TEMPLATES[this.currentTemplateKey];
    if (mode === "visual") {
      if (!template.visualType) {
        mode = "source";
      } else {
        const analysis = analyzeDrawingSource(this.source.value, template.visualType);
        if (!analysis.compatible) {
          // Refuse the switch rather than let the visual editor re-serialize a
          // source whose unsupported parts would be lost.
          this.showIncompatible(analysis);
          mode = "source";
        }
      }
    }
    if (mode === "visual") this.visualGraph = parseVisualDrawing(this.source.value, template.visualType);
    this.mode = mode;
    const visual = mode === "visual";
    this.source.style.display = visual ? "none" : "";
    this.visualEditor.style.display = visual ? "" : "none";
    this.visualModeButton.toggleClass("is-active", visual);
    this.sourceModeButton.toggleClass("is-active", !visual);
    this.visualModeButton.disabled = !template.visualType;
    this.editorTitle.setText(visual ? (loc(this.plugin) === "zh" ? "可视化编辑" : "Visual editor") : ui(this.plugin, "drawingSource"));
    this.updateCompatibilityHint();
    if (visual) this.renderVisualEditor();
    else this.source.focus();
  }

  // Single entry point for "the source text changed", whatever caused it.
  // syncVisual must stay false when the caller already re-parsed and rendered
  // the visual editor, otherwise the form would keep editing a stale graph.
  handleSourceChanged(options) {
    const opts = options || {};
    const detectedKey = detectDrawingTemplateKey(this.source.value);
    if (detectedKey !== this.currentTemplateKey) {
      this.currentTemplateKey = detectedKey;
      this.templateSelect.value = detectedKey;
      this.setMode("source");
    }
    const template = DRAWING_TEMPLATES[this.currentTemplateKey];
    if (opts.syncVisual !== false && this.mode === "visual" && template.visualType) {
      if (analyzeDrawingSource(this.source.value, template.visualType).compatible) {
        this.visualGraph = parseVisualDrawing(this.source.value, template.visualType);
        this.renderVisualEditor();
      } else {
        this.setMode("source");
      }
    }
    this.updateCompatibilityHint();
    this.updateHistoryButtons();
    this.scheduleRender();
    if (opts.saveDraft !== false) this.scheduleDraftSave();
  }

  // Typing or pasting in the source textarea. The session's original text is
  // kept untouched so "restore original" can bring the whole draft back.
  onSourceInput() {
    const value = this.source.value;
    this.pushHistoryValue(this.lastTextValue);
    this.lastTextValue = value;
    this.lastSerialized = value;
    this.handleSourceChanged();
  }

  historyState(source = this.source.value) {
    return { source, key: this.currentTemplateKey, mode: this.mode };
  }

  pushHistoryValue(value, options) {
    if (value == null) return;
    const state = typeof value === "string" ? this.historyState(value) : value;
    // Any new edit branches history, even within a coalesced typing burst.
    this.redoStack.length = 0;
    this.updateHistoryButtons();
    const previous = this.undoStack[this.undoStack.length - 1];
    if (previous && previous.source === state.source && previous.key === state.key && previous.mode === state.mode) return;
    const force = !!(options && options.force);
    const now = Date.now();
    // Coalesce typing bursts, but always record structural edits.
    if (!force && now - this.lastHistoryAt < 700) return;
    this.undoStack.push(state);
    if (this.undoStack.length > 50) this.undoStack.shift();
    this.redoStack.length = 0;
    this.lastHistoryAt = force ? 0 : now;
    this.updateHistoryButtons();
  }

  updateHistoryButtons() {
    if (this.undoButton) this.undoButton.disabled = !this.undoStack.length;
    if (this.redoButton) this.redoButton.disabled = !this.redoStack.length;
    if (this.restoreButton) this.restoreButton.disabled = !this.originalSource || this.originalSource === this.source.value;
  }

  undo() {
    if (!this.undoStack.length) return;
    this.redoStack.push(this.historyState());
    this.lastHistoryAt = 0;
    this.applyHistoryValue(this.undoStack.pop());
  }

  redo() {
    if (!this.redoStack.length) return;
    this.undoStack.push(this.historyState());
    this.lastHistoryAt = 0;
    this.applyHistoryValue(this.redoStack.pop());
  }

  applyHistoryValue(value) {
    const state = typeof value === "string" ? { source: value, mode: this.mode } : value;
    const key = detectDrawingTemplateKey(state.source);
    this.currentTemplateKey = key;
    this.templateSelect.value = key;
    this.source.value = state.source;
    this.lastTextValue = state.source;
    this.lastSerialized = state.source;
    this.visualGraph = null;
    // setMode validates the restored source before rebuilding the visual form.
    this.setMode(state.mode === "visual" ? "visual" : "source");
    this.handleSourceChanged({ syncVisual: false });
    this.updateHistoryButtons();
  }

  restoreOriginal() {
    if (!this.originalSource || this.originalSource === this.source.value) return;
    this.pushHistoryValue(this.source.value, { force: true });
    this.applyHistoryValue(this.originalState || this.originalSource);
    this.status.setText(ui(this.plugin, "drawingRestoreOriginal"));
  }

  updateCompatibilityHint() {
    if (!this.compatHint) return;
    const template = DRAWING_TEMPLATES[this.currentTemplateKey];
    this.compatHint.empty();
    this.compatHint.removeClass("is-warning");
    if (!template.visualType) return;
    const analysis = analyzeDrawingSource(this.source.value, template.visualType);
    if (analysis.compatible) {
      this.compatHint.setText(ui(this.plugin, "drawingLossless"));
      return;
    }
    this.compatHint.addClass("is-warning");
    const lines = analysis.unsupported.map((item) => "L" + item.line).join(", ");
    this.compatHint.setText(ui(this.plugin, "drawingIncompatible") + " (" + ui(this.plugin, "drawingUnsupported") + ": " + lines + ")");
  }

  showIncompatible(analysis) {
    this.updateCompatibilityHint();
    this.status.setText(ui(this.plugin, "drawingIncompatible"));
    const lines = analysis.unsupported.slice(0, 3).map((item) => "L" + item.line + ": " + item.text).join("\n");
    if (lines) new obsidian.Notice(ui(this.plugin, "drawingIncompatible") + "\n" + lines);
  }

  scheduleDraftSave() {
    if (this.draftTimer) window.clearTimeout(this.draftTimer);
    this.draftTimer = window.setTimeout(() => {
      this.draftTimer = null;
      this.saveDraft();
    }, 800);
  }

  saveDraft() {
    if (this.plugin.settings.rememberDrafts === false) return;
    if (this.accepted) return Promise.resolve();
    this.plugin.settings.drawingDraft = {
      source: this.source.value,
      templateKey: this.currentTemplateKey,
      mode: this.mode,
      savedAt: Date.now(),
    };
    return this.plugin.saveSettings();
  }

  clearDraft() {
    if (this.draftTimer) {
      window.clearTimeout(this.draftTimer);
      this.draftTimer = null;
    }
    if (!this.plugin.settings.drawingDraft) return Promise.resolve();
    this.plugin.settings.drawingDraft = null;
    return this.plugin.saveSettings();
  }

  syncVisualDrawing() {
    const template = DRAWING_TEMPLATES[this.currentTemplateKey];
    if (template.visualType) {
      // Safety net: never overwrite a source the visual editor cannot represent.
      const analysis = analyzeDrawingSource(this.source.value, template.visualType);
      if (!analysis.compatible) {
        this.showIncompatible(analysis);
        return;
      }
    }
    const previous = this.lastSerialized || this.source.value;
    const next = serializeVisualDrawing(this.visualGraph);
    if (previous !== next) this.pushHistoryValue(previous, { force: true });
    this.lastSerialized = next;
    this.lastTextValue = next;
    this.source.value = next;
    this.scheduleDraftSave();
    this.scheduleRender();
  }

  createVisualSelect(parent, value, options, onChange) {
    const select = parent.createEl("select");
    for (const option of options) select.createEl("option", { value: option.value, text: option.label });
    select.value = value;
    select.addEventListener("change", () => onChange(select.value));
    return select;
  }

  renderVisualEditor() {
    const graph = this.visualGraph;
    this.visualEditor.empty();
    if (!graph) {
      this.visualEditor.createDiv({ cls: "fd-visual-empty", text: loc(this.plugin) === "zh" ? "当前图型暂不支持可视化编辑" : "Visual editing is not available for this diagram type" });
      return;
    }

    const toolbar = this.visualEditor.createDiv({ cls: "fd-visual-toolbar" });
    const directionLabel = toolbar.createEl("label", { text: loc(this.plugin) === "zh" ? "方向" : "Direction" });
    this.createVisualSelect(directionLabel, graph.direction, [
      { value: "LR", label: "→" }, { value: "RL", label: "←" }, { value: "TB", label: "↓" }, { value: "BT", label: "↑" },
    ], (value) => { graph.direction = value; this.syncVisualDrawing(); });

    const nodeSection = this.visualEditor.createDiv({ cls: "fd-visual-section" });
    const nodeHead = nodeSection.createDiv({ cls: "fd-visual-section-head" });
    nodeHead.createSpan({ text: loc(this.plugin) === "zh" ? `节点 · ${graph.nodes.length}` : `Nodes · ${graph.nodes.length}` });
    const addNode = nodeHead.createEl("button", { cls: "fe-btn", text: loc(this.plugin) === "zh" ? "+ 节点" : "+ Node", attr: { type: "button" } });
    addNode.addEventListener("click", () => {
      const prefix = graph.visualType === "state" ? "S" : "N";
      let index = graph.nodes.length + 1;
      while (graph.nodes.some((node) => node.id === `${prefix}${index}`)) index++;
      graph.nodes.push({ id: `${prefix}${index}`, label: loc(this.plugin) === "zh" ? `节点 ${index}` : `Node ${index}`, shape: "rect" });
      this.syncVisualDrawing();
      this.renderVisualEditor();
    });

    if (!graph.nodes.length) nodeSection.createDiv({ cls: "fd-visual-empty", text: loc(this.plugin) === "zh" ? "添加节点开始绘图" : "Add a node to start drawing" });
    graph.nodes.forEach((node, index) => {
      const row = nodeSection.createDiv({ cls: "fd-visual-row" });
      row.createSpan({ cls: "fd-visual-node-id", text: node.id });
      const input = row.createEl("input", { value: node.label, attr: { "aria-label": loc(this.plugin) === "zh" ? "节点名称" : "Node label" } });
      input.addEventListener("input", () => { node.label = input.value; this.syncVisualDrawing(); });
      if (graph.visualType === "flowchart") {
        this.createVisualSelect(row, node.shape, [
          { value: "rect", label: loc(this.plugin) === "zh" ? "矩形" : "Rectangle" },
          { value: "diamond", label: loc(this.plugin) === "zh" ? "判断" : "Decision" },
          { value: "circle", label: loc(this.plugin) === "zh" ? "圆形" : "Circle" },
        ], (value) => { node.shape = value; this.syncVisualDrawing(); });
      }
      const remove = row.createEl("button", { cls: "fd-icon-button", attr: { type: "button", "aria-label": loc(this.plugin) === "zh" ? "删除节点" : "Delete node" } });
      obsidian.setIcon(remove, "trash-2");
      remove.addEventListener("click", () => {
        graph.nodes.splice(index, 1);
        graph.edges = graph.edges.filter((edge) => edge.from !== node.id && edge.to !== node.id);
        this.syncVisualDrawing();
        this.renderVisualEditor();
      });
    });

    const edgeSection = this.visualEditor.createDiv({ cls: "fd-visual-section" });
    const edgeHead = edgeSection.createDiv({ cls: "fd-visual-section-head" });
    edgeHead.createSpan({ text: loc(this.plugin) === "zh" ? `连线 · ${graph.edges.length}` : `Connections · ${graph.edges.length}` });
    const addEdge = edgeHead.createEl("button", { cls: "fe-btn", text: loc(this.plugin) === "zh" ? "+ 连线" : "+ Connection", attr: { type: "button" } });
    addEdge.disabled = graph.nodes.length < 1;
    addEdge.addEventListener("click", () => {
      const first = graph.nodes[0]?.id;
      const second = graph.nodes[1]?.id || first;
      if (!first) return;
      graph.edges.push({ from: first, to: second, label: "" });
      this.syncVisualDrawing();
      this.renderVisualEditor();
    });

    const endpointOptions = graph.nodes.map((node) => ({ value: node.id, label: node.label || node.id }));
    if (graph.visualType === "state") {
      endpointOptions.unshift({ value: "__start__", label: loc(this.plugin) === "zh" ? "● 开始" : "● Start" });
      endpointOptions.push({ value: "__end__", label: loc(this.plugin) === "zh" ? "◎ 结束" : "◎ End" });
    }
    if (!graph.edges.length) edgeSection.createDiv({ cls: "fd-visual-empty", text: loc(this.plugin) === "zh" ? "添加连线建立节点关系" : "Add a connection between nodes" });
    graph.edges.forEach((edge, index) => {
      const row = edgeSection.createDiv({ cls: "fd-visual-row" });
      this.createVisualSelect(row, edge.from, endpointOptions, (value) => { edge.from = value; this.syncVisualDrawing(); });
      row.createSpan({ cls: "fd-visual-edge-arrow", text: "→" });
      this.createVisualSelect(row, edge.to, endpointOptions, (value) => { edge.to = value; this.syncVisualDrawing(); });
      const label = row.createEl("input", { value: edge.label, attr: { placeholder: loc(this.plugin) === "zh" ? "连线文字（可选）" : "Label (optional)", "aria-label": loc(this.plugin) === "zh" ? "连线文字" : "Connection label" } });
      label.addEventListener("input", () => { edge.label = label.value; this.syncVisualDrawing(); });
      const remove = row.createEl("button", { cls: "fd-icon-button", attr: { type: "button", "aria-label": loc(this.plugin) === "zh" ? "删除连线" : "Delete connection" } });
      obsidian.setIcon(remove, "trash-2");
      remove.addEventListener("click", () => {
        graph.edges.splice(index, 1);
        this.syncVisualDrawing();
        this.renderVisualEditor();
      });
    });
  }

  scheduleRender() {
    if (this.renderTimer) window.clearTimeout(this.renderTimer);
    this.renderVersion++;
    this.previewSvg = null;
    this.preview.empty();
    this.preview.createDiv({ cls: "fd-skeleton" });
    this.status.setText(loc(this.plugin) === "zh" ? "正在渲染预览" : "Rendering preview");
    this.renderTimer = window.setTimeout(() => this.renderPreview(), 220);
  }

  async renderPreview() {
    this.renderTimer = null;
    const version = ++this.renderVersion;
    const source = this.source.value.trim();
    this.previewSvg = null;
    this.preview.empty();
    if (!source) {
      this.preview.createDiv({ cls: "fl-empty-state", text: loc(this.plugin) === "zh" ? "输入 Mermaid 源码后显示预览" : "Enter Mermaid source to preview" });
      this.status.setText("");
      return;
    }
    const component = new obsidian.Component();
    component.load();
    try {
      const stage = document.createElement("div");
      stage.className = "fd-render-stage";
      await obsidian.MarkdownRenderer.render(this.app, "```mermaid\n" + source + "\n```", stage, "", component);
      if (version !== this.renderVersion) { component.unload(); return; }
      if (this.previewComponent) this.previewComponent.unload();
      this.previewComponent = component;
      this.preview.replaceChildren(...stage.childNodes);
      const svg = this.preview.querySelector(".mermaid svg[viewBox], svg[aria-roledescription]");
      this.previewSvg = svg;
      if (svg) {
        svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
        svg.setAttribute("width", "100%");
        svg.setAttribute("height", "100%");
      }
      // A render replaces the SVG element, so re-apply the current zoom/pan.
      this.applyZoom();
      this.status.setText(svg ? (loc(this.plugin) === "zh" ? "预览已更新" : "Preview updated")
        : (loc(this.plugin) === "zh" ? "等待宿主渲染图表；如出现信任提示，请自行确认" : "Waiting for the host to render; review any trust prompt manually"));
    } catch (error) {
      component.unload();
      if (version !== this.renderVersion) return;
      this.preview.empty();
      this.preview.createDiv({ cls: "fd-error", text: error instanceof Error ? error.message : String(error) });
      this.status.setText(loc(this.plugin) === "zh" ? "源码存在错误" : "Source contains an error");
    }
  }

  // ---- Preview navigation: zoom, pan, fit and SVG export ----

  applyZoom() {
    if (this.zoomValueEl) this.zoomValueEl.setText(Math.round(this.zoom * 100) + "%");
    // MarkdownRenderer can resolve before Mermaid installs/replaces its SVG.
    this.previewSvg = this.preview ? this.preview.querySelector(".mermaid svg[viewBox], svg[aria-roledescription]") : null;
    if (!this.previewSvg) return;
    this.status?.setText(loc(this.plugin) === "zh" ? "预览已更新" : "Preview updated");
    this.previewSvg.style.transformOrigin = "50% 50%";
    this.previewSvg.style.transform = "translate(" + this.panX + "px, " + this.panY + "px) scale(" + this.zoom + ")";
  }

  setZoom(value) {
    this.zoom = clampZoom(value);
    this.applyZoom();
  }

  zoomBy(factor) {
    this.setZoom(this.zoom * factor);
  }

  resetZoom() {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.applyZoom();
  }

  // Scale the drawing so its content fills the preview pane. Mermaid letterboxes
  // the drawing inside a 100%-wide SVG, so the inner group is what gets measured.
  fitPreview() {
    this.previewSvg = this.preview ? this.preview.querySelector(".mermaid svg[viewBox], svg[aria-roledescription]") : null;
    const content = this.previewSvg ? (this.previewSvg.querySelector("g") || this.previewSvg) : null;
    if (!content || !this.previewViewport) {
      this.resetZoom();
      return;
    }
    const pane = this.previewViewport.getBoundingClientRect();
    const box = content.getBoundingClientRect();
    if (!pane.width || !pane.height || !box.width || !box.height) {
      this.resetZoom();
      return;
    }
    const zoom = computeFitZoom(box.width / this.zoom, box.height / this.zoom, pane.width, pane.height, 12);
    // The content keeps its offset from the pane center scaled by the zoom, so
    // the pan that re-centers it follows from that offset.
    const offsetX = (box.left + box.width / 2 - (pane.left + pane.width / 2) - this.panX) / this.zoom;
    const offsetY = (box.top + box.height / 2 - (pane.top + pane.height / 2) - this.panY) / this.zoom;
    this.zoom = zoom;
    this.panX = -offsetX * zoom;
    this.panY = -offsetY * zoom;
    this.applyZoom();
  }

  exportSvg() {
    const svg = this.preview ? this.preview.querySelector(".mermaid svg[viewBox], svg[aria-roledescription]") : null;
    if (!svg) {
      this.status.setText(ui(this.plugin, "drawingExportSvgFailed"));
      new obsidian.Notice(ui(this.plugin, "drawingExportSvgFailed"));
      return;
    }
    try {
      const box = svg.getBoundingClientRect();
      const clone = svg.cloneNode(true);
      clone.style.transform = "";
      clone.removeAttribute("class");
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
      // Export at the diagram's own size: prefer the viewBox, fall back to the pane size.
      const natural = svgNaturalSize(svg.getAttribute("viewBox"), this.zoom, box.width, box.height);
      clone.setAttribute("width", String(Math.round(natural.w)));
      clone.setAttribute("height", String(Math.round(natural.h)));
      const markup = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
      const name = (this.currentTemplateKey || "diagram") + "-" + Date.now() + ".svg";
      if (!downloadTextFile(name, markup, "image/svg+xml;charset=utf-8")) {
        this.status.setText(ui(this.plugin, "drawingExportSvgFailed"));
        return;
      }
      this.status.setText(ui(this.plugin, "drawingExportSvgDone"));
    } catch (error) {
      logWarn("exportSvg failed:", error.message);
      this.status.setText(ui(this.plugin, "drawingExportSvgFailed"));
      new obsidian.Notice(ui(this.plugin, "drawingExportSvgFailed"));
    }
  }

  // Drag to pan and Ctrl/Cmd+wheel to zoom. Touch pointers keep native scrolling.
  bindPreviewInteraction() {
    if (!this.previewViewport) return;
    this.previewViewport.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.pointerType === "touch") return;
      const target = event.target;
      if (target && target.closest && target.closest("a, button")) return;
      this.panState = { x: event.clientX, y: event.clientY, panX: this.panX, panY: this.panY };
      this.previewViewport.addClass("is-panning");
      if (this.previewViewport.setPointerCapture) this.previewViewport.setPointerCapture(event.pointerId);
    });
    this.previewViewport.addEventListener("pointermove", (event) => {
      if (!this.panState) return;
      this.panX = this.panState.panX + (event.clientX - this.panState.x);
      this.panY = this.panState.panY + (event.clientY - this.panState.y);
      this.applyZoom();
    });
    const stopPan = (event) => {
      if (!this.panState) return;
      this.panState = null;
      this.previewViewport.removeClass("is-panning");
      if (this.previewViewport.releasePointerCapture) {
        try { this.previewViewport.releasePointerCapture(event.pointerId); } catch (error) { logWarn("releasePointerCapture failed:", error.message); }
      }
    };
    this.previewViewport.addEventListener("pointerup", stopPan);
    this.previewViewport.addEventListener("pointercancel", stopPan);
    this.previewViewport.addEventListener("wheel", (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      this.zoomBy(event.deltaY < 0 ? 1.12 : 1 / 1.12);
    }, { passive: false });
  }

  async accept() {
    const source = this.source.value.trim();
    if (!source) {
      this.status.setText(loc(this.plugin) === "zh" ? "请先输入绘图源码" : "Enter diagram source first");
      this.source.focus();
      return;
    }
    if (this.drawingInfo) this.plugin.replaceDrawing(source, this.drawingInfo);
    else this.plugin.insertDrawing(source);
    this.accepted = true;
    await this.clearDraft();
    this.close();
  }

  onClose() {
    if (this.previewObserver) this.previewObserver.disconnect();
    if (this.renderTimer) window.clearTimeout(this.renderTimer);
    if (this.draftTimer) {
      window.clearTimeout(this.draftTimer);
      this.draftTimer = null;
    }
    // Keep the unsaved drawing so it can be recovered on the next open.
    if (!this.accepted && this.source.value.trim()) this.saveDraft();
    this.renderVersion++;
    if (this.previewComponent) { this.previewComponent.unload(); this.previewComponent = null; }
    this.contentEl.empty();
  }
}

export { DRAWING_TEMPLATES, DRAWING_NODE_ID_RE, DRAWING_SHAPE_RE, DRAWING_FLOW_HEADER_RE, DRAWING_STATE_HEADER_RE, DRAWING_DIRECTION_RE, DRAWING_STATE_ALIAS_RE, isDrawingNodeToken, analyzeDrawingSource, parseDrawingNodeToken, findMermaidBlockAt, DRAWING_TEMPLATE_PATTERNS, detectDrawingTemplateKey, svgNaturalSize, DRAWING_MIN_ZOOM, DRAWING_MAX_ZOOM, clampZoom, computeFitZoom, parseVisualDrawing, serializeVisualDrawing, DrawingModal };
