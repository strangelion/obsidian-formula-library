import * as obsidian from "obsidian";
import { labelControl, runModalAction } from "./ui.js";
import { log, logWarn, loc, ui, normalizeFolderPath } from "./core.js";
import { downloadTextFile, writeClipboard, ConfirmModal } from "./custom-library.js";
import { readDraft, writeDraft, DraftSession, validatePlotConfig, clone } from "./workspace-state.js";

// ==================== Function plotting ====================
// Expression parsing stays inside this file: no eval, no Function constructor.
const PLOT_COLORS = ["#d9534f", "#337ab7", "#5cb85c", "#f0ad4e", "#9b59b6", "#16a085"];
const PLOT_CONSTANTS = { pi: Math.PI, e: Math.E, tau: Math.PI * 2, phi: (1 + Math.sqrt(5)) / 2 };
const PLOT_FUNCTIONS = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  asinh: Math.asinh, acosh: Math.acosh, atanh: Math.atanh,
  exp: Math.exp, ln: Math.log, log: Math.log10, log2: Math.log2, log10: Math.log10,
  sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, sign: Math.sign,
  floor: Math.floor, ceil: Math.ceil, round: Math.round,
  min: Math.min, max: Math.max, pow: Math.pow, hypot: Math.hypot, atan2: Math.atan2,
  mod: function(a, b) { return a % b; },
};
const PLOT_FUNCTION_NAMES = Object.keys(PLOT_FUNCTIONS).sort(function(a, b) { return b.length - a.length; });
const PLOT_CALL_DEPTH = 32;
const PLOT_PARAM_MIN = -10;
const PLOT_PARAM_MAX = 10;
const PLOT_PARAM_STEP = 0.1;

// Splits "sinx", "xsinx" and "sin2x" so the parser sees a function name plus its implicit argument.
function splitPlotIdentifier(raw) {
  const parts = [];
  let rest = String(raw == null ? "" : raw);
  let offset = 0;
  const pushIdent = function(value) {
    if (value) parts.push({ type: "ident", value: value, offset: offset });
    offset += value.length;
  };
  const matchFunction = function(value) {
    return PLOT_FUNCTION_NAMES.find(function(name) {
      return value.length > name.length && value.slice(0, name.length).toLowerCase() === name;
    });
  };
  while (rest) {
    const digits = rest.match(/^[0-9]+(?:\.[0-9]+)?/);
    if (digits) {
      parts.push({ type: "num", value: Number(digits[0]), offset: offset });
      offset += digits[0].length;
      rest = rest.slice(digits[0].length);
      continue;
    }
    const hit = matchFunction(rest);
    if (hit) {
      pushIdent(rest.slice(0, hit.length));
      rest = rest.slice(hit.length);
      continue;
    }
    let stop = rest.length;
    for (let at = 1; at < rest.length; at++) {
      if (matchFunction(rest.slice(at))) { stop = at; break; }
    }
    pushIdent(rest.slice(0, stop));
    rest = rest.slice(stop);
  }
  return parts;
}

function tokenizeExpression(source) {
  const text = String(source == null ? "" : source);
  const tokens = [];
  let index = 0;
  while (index < text.length) {
    const ch = text[index];
    if (/\s/.test(ch)) { index++; continue; }
    if (/[0-9.]/.test(ch)) {
      const number = text.slice(index).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
      if (!number) throw new Error("bad number: " + ch);
      const raw = number[0];
      const end = index + raw.length;
      tokens.push({ type: "num", value: Number(raw), pos: index });
      index = end;
      continue;
    }
    if (ch === "`") {
      const close = text.indexOf("`", index + 1);
      if (close < 0) throw new Error("unterminated name");
      const literal = text.slice(index + 1, close).trim();
      if (!literal) throw new Error("empty name");
      tokens.push({ type: "ident", value: literal, literal: true, pos: index });
      index = close + 1;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let end = index;
      while (end < text.length && /[A-Za-z0-9_]/.test(text[end])) end++;
      splitPlotIdentifier(text.slice(index, end)).forEach(function(part) {
        tokens.push({ type: part.type, value: part.value, pos: index + part.offset });
      });
      index = end;
      continue;
    }
    if ("+-*/^(),".indexOf(ch) >= 0) {
      tokens.push({ type: "op", value: ch, pos: index });
      index++;
      continue;
    }
    throw new Error("unexpected character: " + ch);
  }
  return tokens;
}

// Drops a leading "y =" or "f(x) =" so users can paste an equation as-is.
function stripEquationPrefix(source) {
  const text = String(source == null ? "" : source).trim();
  const match = text.match(/^(?:y|f\s*\(\s*x\s*\)|[a-z]\s*\(\s*x\s*\))\s*=\s*(.+)$/i);
  return (match ? match[1] : text).trim();
}

function parseExpressionAst(source) {
  const tokens = tokenizeExpression(stripEquationPrefix(source));
  let index = 0;
  const peek = function() { return tokens[index]; };
  const next = function() { return tokens[index++]; };
  const isOp = function(value) { const token = peek(); return !!token && token.type === "op" && token.value === value; };

  const parsePower = function() {
    const base = parseAtom();
    if (isOp("^")) {
      next();
      return { kind: "binary", op: "^", left: base, right: parseUnary() };
    }
    return base;
  };
  const parseUnary = function() {
    if (isOp("-")) { next(); return { kind: "unary", op: "-", arg: parseUnary() }; }
    if (isOp("+")) { next(); return parseUnary(); }
    return parsePower();
  };
  const parseAtom = function() {
    const token = peek();
    if (!token) throw new Error("expression ended early");
    if (token.type === "num") { next(); return { kind: "num", value: token.value }; }
    if (token.type === "ident") {
      next();
      const lower = token.value.toLowerCase();
      if (isOp("(") && (token.value === "x" || PLOT_CONSTANTS[lower] !== undefined)) {
        return { kind: "var", name: token.value };
      }
      if (isOp("(")) {
        next();
        const args = [];
        if (!isOp(")")) {
          args.push(parseExpression());
          while (isOp(",")) { next(); args.push(parseExpression()); }
        }
        if (!isOp(")")) throw new Error("missing )");
        next();
        return { kind: "call", name: token.value, args: args };
      }
      // Implicit function argument: "sin x", "sinx" and "sin2x" all become calls.
      if (!token.literal && PLOT_FUNCTIONS[lower] !== undefined) {
        return { kind: "call", name: token.value, args: [parseUnary()] };
      }
      return { kind: "var", name: token.value };
    }
    if (token.type === "op" && token.value === "(") {
      next();
      const inner = parseExpression();
      if (!isOp(")")) throw new Error("missing )");
      next();
      return inner;
    }
    throw new Error("unexpected token: " + token.value);
  };
  const startsFactor = function() {
    const token = peek();
    if (!token) return false;
    if (token.type === "num" || token.type === "ident") return true;
    return token.type === "op" && token.value === "(";
  };
  const parseTerm = function() {
    let left = parseUnary();
    for (;;) {
      if (isOp("*")) { next(); left = { kind: "binary", op: "*", left: left, right: parseUnary() }; continue; }
      if (isOp("/")) { next(); left = { kind: "binary", op: "/", left: left, right: parseUnary() }; continue; }
      // Implicit multiplication: 2x, 3(x+1), x sin(x).
      if (startsFactor()) { left = { kind: "binary", op: "*", left: left, right: parseUnary() }; continue; }
      return left;
    }
  };
  const parseExpression = function() {
    let left = parseTerm();
    for (;;) {
      if (isOp("+")) { next(); left = { kind: "binary", op: "+", left: left, right: parseTerm() }; continue; }
      if (isOp("-")) { next(); left = { kind: "binary", op: "-", left: left, right: parseTerm() }; continue; }
      return left;
    }
  };

  const ast = parseExpression();
  if (index < tokens.length) throw new Error("unexpected token: " + tokens[index].value);
  if (ast.kind === "num" && !Number.isFinite(ast.value)) throw new Error("bad number");
  return ast;
}

function evaluateAst(ast, scope, functions, locals, depth) {
  if (!ast) return NaN;
  const level = depth || 0;
  if (ast.kind === "num") return ast.value;
  if (ast.kind === "var") {
    if (locals && Object.prototype.hasOwnProperty.call(locals, ast.name)) return locals[ast.name];
    const vars = scope || {};
    if (Object.prototype.hasOwnProperty.call(vars, ast.name)) return vars[ast.name];
    const constant = PLOT_CONSTANTS[ast.name.toLowerCase()];
    if (constant !== undefined) return constant;
    throw new Error("unknown name: " + ast.name);
  }
  if (ast.kind === "unary") return -evaluateAst(ast.arg, scope, functions, locals, level);
  if (ast.kind === "call") {
    // User functions are keyed by lower case name and bind their parameters in a child frame.
    const user = functions ? functions[ast.name.toLowerCase()] : null;
    if (user) {
      if (level >= PLOT_CALL_DEPTH) throw new Error("recursion limit reached: " + ast.name);
      if (ast.args.length !== user.params.length) throw new Error("wrong number of arguments: " + ast.name);
      const args = ast.args.map(function(arg) { return evaluateAst(arg, scope, functions, locals, level); });
      const frame = Object.assign(Object.create(null), locals || null);
      user.params.forEach(function(param, index) { frame[param] = args[index]; });
      return evaluateAst(user.ast, scope, functions, frame, level + 1);
    }
    const fn = PLOT_FUNCTIONS[ast.name.toLowerCase()];
    if (typeof fn !== "function") throw new Error("unknown function: " + ast.name);
    const args = ast.args.map(function(arg) { return evaluateAst(arg, scope, functions, locals, level); });
    return fn.apply(null, args);
  }
  const left = evaluateAst(ast.left, scope, functions, locals, level);
  const right = evaluateAst(ast.right, scope, functions, locals, level);
  if (ast.op === "+") return left + right;
  if (ast.op === "-") return left - right;
  if (ast.op === "*") return left * right;
  if (ast.op === "/") return left / right;
  if (ast.op === "^") return Math.pow(left, right);
  return NaN;
}

function walkPlotAst(node, visit) {
  if (!node) return;
  visit(node);
  if (node.kind === "unary") return walkPlotAst(node.arg, visit);
  if (node.kind === "binary") { walkPlotAst(node.left, visit); walkPlotAst(node.right, visit); return; }
  if (node.kind === "call") node.args.forEach(function(arg) { walkPlotAst(arg, visit); });
}

// Everything that is neither x nor a known constant becomes a slider.
function expressionVariables(ast) {
  const found = {};
  walkPlotAst(ast, function(node) {
    if (node.kind !== "var") return;
    if (node.name !== "x" && PLOT_CONSTANTS[node.name.toLowerCase()] === undefined) found[node.name] = true;
  });
  return Object.keys(found).sort();
}

function expressionCalls(ast) {
  const found = {};
  walkPlotAst(ast, function(node) { if (node.kind === "call") found[node.name] = true; });
  return Object.keys(found).sort();
}

const PLOT_DEFINITION_RE = /^([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*=\s*([\s\S]+)$/;
const PLOT_PARAM_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

function isReservedPlotName(name) {
  const lower = String(name || "").toLowerCase();
  return lower === "x" || PLOT_CONSTANTS[lower] !== undefined || PLOT_FUNCTIONS[lower] !== undefined;
}

// Parses "f(x) = x^2 + a" lines. Later lines can call functions defined above them.
function parsePlotDefinitions(source) {
  const functions = Object.create(null);
  const order = [];
  const errors = [];
  String(source == null ? "" : source).split(/\r?\n/).forEach(function(line, index) {
    const text = line.trim();
    if (!text || text.charAt(0) === "#") return;
    const lineNumber = index + 1;
    const match = text.match(PLOT_DEFINITION_RE);
    if (!match) {
      errors.push({ line: lineNumber, code: "plotDefSyntax", detail: text });
      return;
    }
    const name = match[1];
    if (Object.prototype.hasOwnProperty.call(functions, name.toLowerCase())) {
      errors.push({ line: lineNumber, code: "plotDefName", detail: name });
      return;
    }
    if (isReservedPlotName(name)) {
      errors.push({ line: lineNumber, code: "plotDefName", detail: name });
      return;
    }
    const params = match[2].split(",").map(function(part) { return part.trim(); }).filter(Boolean);
    const seen = {};
    const bad = params.filter(function(param) {
      if (!PLOT_PARAM_NAME_RE.test(param)) return true;
      if (PLOT_CONSTANTS[param.toLowerCase()] !== undefined || PLOT_FUNCTIONS[param.toLowerCase()] !== undefined) return true;
      if (seen[param]) return true;
      seen[param] = true;
      return false;
    });
    if (bad.length) {
      errors.push({ line: lineNumber, code: "plotDefParams", detail: bad.join(", ") });
      return;
    }
    let ast = null;
    try {
      ast = parseExpressionAst(match[3]);
    } catch (parseError) {
      errors.push({ line: lineNumber, code: "plotDefBody", detail: parseError.message });
      return;
    }
    const unknown = expressionCalls(ast).filter(function(called) {
      const lower = called.toLowerCase();
      return PLOT_FUNCTIONS[lower] === undefined && functions[lower] === undefined;
    });
    if (unknown.length) {
      errors.push({ line: lineNumber, code: "plotDefUnknownFunction", detail: unknown.join(", ") });
      return;
    }
    const key = name.toLowerCase();
    functions[key] = { name: name, params: params, ast: ast, line: lineNumber };
    if (order.indexOf(key) < 0) order.push(key);
  });
  return { functions: functions, order: order, errors: errors };
}

// Parameters stay sliders; names bound by a definition stay inside it.
function definitionFreeVariables(definition) {
  if (!definition) return [];
  const params = definition.params || [];
  return expressionVariables(definition.ast).filter(function(name) { return params.indexOf(name) < 0; });
}

// Parses "a=2, b=a+1" so one letter can mean different things in different curves.
function parsePlotLocals(source) {
  const values = {};
  const errors = [];
  // A comma inside min(1, 2) belongs to the expression, not the next constant.
  let depth = 0;
  const entries = [];
  let entryStart = 0;
  const textSource = String(source == null ? "" : source);
  for (let index = 0; index < textSource.length; index++) {
    if (textSource[index] === "(") depth++;
    if (textSource[index] === ")") depth--;
    if (depth === 0 && /[,;\n]/.test(textSource[index])) {
      entries.push(textSource.slice(entryStart, index));
      entryStart = index + 1;
    }
  }
  entries.push(textSource.slice(entryStart));
  entries.forEach(function(entry) {
    const text = entry.trim();
    if (!text) return;
    const match = text.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([\s\S]+)$/);
    if (!match) {
      errors.push({ code: "plotLocalsSyntax", detail: text });
      return;
    }
    const name = match[1];
    if (isReservedPlotName(name)) {
      errors.push({ code: "plotLocalsName", detail: name });
      return;
    }
    const detail = name + " = " + match[2];
    let value = NaN;
    try {
      value = evaluateAst(parseExpressionAst(match[2]), values, null, null, 0);
    } catch {
      errors.push({ code: "plotLocalsValue", detail: detail });
      return;
    }
    if (!Number.isFinite(value)) {
      errors.push({ code: "plotLocalsValue", detail: detail });
      return;
    }
    values[name] = value;
  });
  return { values: values, errors: errors };
}

function plotDefinitionErrorText(plugin, error) {
  const where = ui(plugin, "plotLine").replace("{n}", String(error.line));
  return ui(plugin, error.code) + " · " + where + (error.detail ? " (" + error.detail + ")" : "");
}

function plotLocalErrorText(plugin, error) {
  return ui(plugin, error.code) + (error.detail ? " (" + error.detail + ")" : "");
}

// A saved SVG is a standalone document: currentColor cannot follow the note theme there.
function plotDocumentIsDark() {
  try {
    if (typeof document === "undefined" || !document.body || !document.body.classList) return false;
    return document.body.classList.contains("theme-dark");
  } catch {
    return false;
  }
}

function plotThemeResolved(theme) {
  if (theme !== "auto") return theme || "light";
  return plotDocumentIsDark() ? "dark" : "light";
}

function samplePlotCurve(ast, scope, range, count, functions, locals) {
  const total = Math.max(2, count || 480);
  const span = range.xMax - range.xMin;
  const points = [];
  for (let i = 0; i < total; i++) {
    const x = range.xMin + span * (i / (total - 1));
    let y = NaN;
    try {
      y = evaluateAst(ast, Object.assign({}, scope || {}, { x: x }), functions, locals, 0);
    } catch {
      y = NaN;
    }
    points.push({ x: x, y: Number.isFinite(y) ? y : NaN });
  }
  return points;
}

// Auto Y range ignores the extreme 2% on both ends so a single pole cannot flatten the plot.
function autoYRange(curves, range, samples) {
  const values = [];
  curves.forEach(function(curve) {
    samplePlotCurve(curve.ast, curve.scope, range, samples || 240, curve.functions).forEach(function(point) {
      if (Number.isFinite(point.y)) values.push(point.y);
    });
  });
  if (!values.length) return { yMin: -1, yMax: 1 };
  values.sort(function(a, b) { return a - b; });
  const low = values[Math.floor(values.length * 0.02)];
  const high = values[Math.min(values.length - 1, Math.ceil(values.length * 0.98))];
  let yMin = Math.min(low, high);
  let yMax = Math.max(low, high);
  if (yMax - yMin < 1e-9) { yMin -= 1; yMax += 1; }
  const pad = (yMax - yMin) * 0.08;
  return { yMin: yMin - pad, yMax: yMax + pad };
}

function niceTicks(min, max, target) {
  const span = max - min;
  if (!(span > 0)) return [min];
  const raw = span / Math.max(1, target || 8);
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const steps = [1, 2, 2.5, 5, 10].map(function(multiplier) { return multiplier * magnitude; });
  const step = steps.find(function(candidate) { return candidate >= raw; }) || steps[steps.length - 1];
  const ticks = [];
  const start = Math.ceil(min / step) * step;
  for (let value = start; value <= max + step * 1e-6; value += step) {
    ticks.push(Number((Math.round(value / step) * step).toPrecision(12)));
  }
  return ticks;
}

function formatTickValue(value) {
  const rounded = Math.abs(value) < 1e-9 ? 0 : value;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-9) return String(Math.round(rounded));
  return String(Number(rounded.toPrecision(4)));
}

function escapeXmlText(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function plotTransform(bounds, size, padding) {
  const pad = padding == null ? 34 : padding;
  const width = Math.max(1, size.width - pad * 2);
  const height = Math.max(1, size.height - pad * 2);
  const xSpan = bounds.xMax - bounds.xMin || 1;
  const ySpan = bounds.yMax - bounds.yMin || 1;
  return function(x, y) {
    return {
      x: pad + ((x - bounds.xMin) / xSpan) * width,
      y: size.height - pad - ((y - bounds.yMin) / ySpan) * height,
    };
  };
}

function buildPlotPath(points, project, jumpLimit) {
  const limit = jumpLimit == null ? Infinity : jumpLimit;
  let data = "";
  let previous = null;
  let open = false;
  points.forEach(function(point) {
    if (!Number.isFinite(point.y)) { previous = null; open = false; return; }
    const projected = project(point.x, point.y);
    const px = Number(projected.x.toFixed(2));
    const py = Number(projected.y.toFixed(2));
    const jump = previous !== null && Math.abs(point.y - previous) > limit;
    if (!open || jump) { data += " M" + px + " " + py; open = true; }
    else data += " L" + px + " " + py;
    previous = point.y;
  });
  return data.trim();
}

function buildPlotSvg(model) {
  const settings = model || {};
  const width = Math.max(120, Math.round(settings.width || 640));
  const height = Math.max(120, Math.round(settings.height || 400));
  const padding = settings.padding == null ? 38 : settings.padding;
  const theme = settings.theme || "auto";
  const dark = theme === "dark";
  const ink = theme === "auto" ? "currentColor" : dark ? "#e6e6e6" : "#333333";
  const gridInk = theme === "auto" ? "currentColor" : dark ? "#4a4a4a" : "#dcdcdc";
  const background = theme === "light" ? "#ffffff" : dark ? "#1e1e1e" : null;
  const bounds = {
    xMin: settings.xMin,
    xMax: settings.xMax,
    yMin: settings.yMin,
    yMax: settings.yMax,
  };
  if (!(bounds.xMax > bounds.xMin)) bounds.xMax = bounds.xMin + 1;
  if (!(bounds.yMax > bounds.yMin)) bounds.yMax = bounds.yMin + 1;
  const project = plotTransform(bounds, { width: width, height: height }, padding);
  const parts = [];
  parts.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + " " + height + '" role="img">');
  if (background) parts.push('<rect x="0" y="0" width="' + width + '" height="' + height + '" fill="' + background + '"/>');

  const xTicks = niceTicks(bounds.xMin, bounds.xMax, 8);
  const yTicks = niceTicks(bounds.yMin, bounds.yMax, 6);
  xTicks.forEach(function(value) {
    const p = project(value, bounds.yMin);
    parts.push('<line x1="' + p.x.toFixed(2) + '" y1="' + padding + '" x2="' + p.x.toFixed(2) + '" y2="' + (height - padding) + '" stroke="' + gridInk + '" stroke-width="1" stroke-opacity="0.45"/>');
    parts.push('<text x="' + p.x.toFixed(2) + '" y="' + (height - padding + 14) + '" fill="' + ink + '" font-size="11" text-anchor="middle">' + escapeXmlText(formatTickValue(value)) + "</text>");
  });
  yTicks.forEach(function(value) {
    const p = project(bounds.xMin, value);
    parts.push('<line x1="' + padding + '" y1="' + p.y.toFixed(2) + '" x2="' + (width - padding) + '" y2="' + p.y.toFixed(2) + '" stroke="' + gridInk + '" stroke-width="1" stroke-opacity="0.45"/>');
    if (Math.abs(value) > 1e-9) {
      parts.push('<text x="' + (padding - 6) + '" y="' + (p.y + 4).toFixed(2) + '" fill="' + ink + '" font-size="11" text-anchor="end">' + escapeXmlText(formatTickValue(value)) + "</text>");
    }
  });

  // Axes are drawn last among the grid lines so they stay readable.
  if (bounds.xMin <= 0 && bounds.xMax >= 0) {
    const axisX = project(0, 0).x.toFixed(2);
    parts.push('<line x1="' + axisX + '" y1="' + padding + '" x2="' + axisX + '" y2="' + (height - padding) + '" stroke="' + ink + '" stroke-width="1.4"/>');
  }
  if (bounds.yMin <= 0 && bounds.yMax >= 0) {
    const axisY = project(0, 0).y.toFixed(2);
    parts.push('<line x1="' + padding + '" y1="' + axisY + '" x2="' + (width - padding) + '" y2="' + axisY + '" stroke="' + ink + '" stroke-width="1.4"/>');
  }

  const jumpLimit = (bounds.yMax - bounds.yMin) * 0.5;
  const curves = settings.curves || [];
  curves.forEach(function(curve, index) {
    const color = curve.color || PLOT_COLORS[index % PLOT_COLORS.length];
    const points = samplePlotCurve(curve.ast, curve.scope, bounds, settings.samples || 480, curve.functions);
    const data = buildPlotPath(points, project, jumpLimit);
    if (!data) return;
    parts.push('<path d="' + data + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>');
  });

  // Legend keeps the original expression text, escaped.
  let legendY = padding + 4;
  curves.forEach(function(curve, index) {
    const color = curve.color || PLOT_COLORS[index % PLOT_COLORS.length];
    parts.push('<line x1="' + (padding + 4) + '" y1="' + legendY + '" x2="' + (padding + 26) + '" y2="' + legendY + '" stroke="' + color + '" stroke-width="2"/>');
    parts.push('<text x="' + (padding + 32) + '" y="' + (legendY + 4) + '" fill="' + ink + '" font-size="12">' + escapeXmlText(curve.label || ("y = " + curve.expression)) + "</text>");
    legendY += 18;
  });

  parts.push("</svg>");
  return parts.join("\n");
}

function plotFileName(prefix, stamp) {
  return (prefix || "plot") + "-" + (stamp || Date.now()) + ".svg";
}

class PlotFunctionModal extends obsidian.Modal {
  constructor(app, plugin, options) {
    super(app);
    this.plugin = plugin;
    this.options = options || {};
    this.rows = [];
    this.curves = [];
    this.params = {};
    this.paramRanges = {};
    this.paramNames = "";
    this.functions = {};
    this.model = null;
    this.svgText = "";
  }

  onOpen() {
    this.containerEl.addClass("formula-library-modal-container");
    this.modalEl.addClass("formula-library-modal");
    this.modalEl.addClass("formula-plot-modal");
    this.contentEl.addClass("ft-modal");
    const p = this.plugin;
    this.draftSession = new DraftSession(p, "plot");
    this.titleEl.setText(ui(p, "plotTitle"));
    this.contentEl.createDiv({ cls: "fl-manage-file", text: ui(p, "plotDesc") });
    this.installPresets();
    const workspace = this.contentEl.createDiv({ cls: "ft-workspace" });
    const inspector = workspace.createDiv({ cls: "ft-inspector" });

    const definitions = inspector.createEl("details", { cls: "fl-manage-section ft-advanced" });
    definitions.createEl("summary", { text: ui(p, "plotDefinitions") });
    const definitionsHead = definitions.createDiv({ cls: "fl-manage-head" });
    definitionsHead.createDiv({ cls: "fl-manage-title", text: ui(p, "plotDefinitions") });
    definitionsHead.createDiv({ cls: "fl-manage-file", text: ui(p, "plotDefinitionsHint") });
    this.defInput = definitions.createEl("textarea", { cls: "fl-import-textarea", attr: { rows: "2", placeholder: ui(p, "plotDefinitionsPlaceholder") } });
    this.defInput.setAttribute("aria-label", ui(p, "plotDefinitions"));
    this.defInput.addEventListener("input", () => this.refresh());
    this.defError = definitions.createDiv({ cls: "fl-field-error" });

    const functions = inspector.createDiv({ cls: "fl-manage-section" });
    const head = functions.createDiv({ cls: "fl-manage-head" });
    head.createDiv({ cls: "fl-manage-title", text: ui(p, "plotFunctions") });
    const addButton = head.createEl("button", { cls: "fe-btn", text: ui(p, "plotAddFunction") });
    addButton.addEventListener("click", () => { this.addRow(""); this.refresh(); });
    this.rowsEl = functions.createDiv({ cls: "fl-field" });

    const rangeBar = inspector.createDiv({ cls: "mt-controls ft-range-controls" });
    const rangeField = (label, value) => {
      const wrap = rangeBar.createEl("label", { cls: "mt-check fl-control-field" });
      wrap.createEl("span", { text: label });
      const input = wrap.createEl("input", { cls: "fl-field-input mt-number", attr: { type: "number", step: "1", value: value } });
      input.value = value;
      input.addEventListener("input", () => this.refresh());
      return input;
    };
    this.xMinInput = rangeField(ui(p, "plotXMin"), "-10");
    this.xMaxInput = rangeField(ui(p, "plotXMax"), "10");
    this.yMinInput = rangeField(ui(p, "plotYMin"), "-5");
    this.yMaxInput = rangeField(ui(p, "plotYMax"), "5");
    const autoWrap = rangeBar.createEl("label", { cls: "mt-check" });
    this.autoY = autoWrap.createEl("input", { attr: { type: "checkbox" } });
    this.autoY.checked = true;
    this.autoY.addEventListener("change", () => this.refresh());
    autoWrap.createEl("span", { text: ui(p, "plotAutoY") });

    const paramsBar = inspector.createDiv({ cls: "mt-controls ft-parameters" });
    paramsBar.createEl("span", { cls: "fl-manage-title", text: ui(p, "plotParameters") });
    this.paramsEl = paramsBar;

    const themeBar = inspector.createDiv({ cls: "mt-controls" });
    const themeLabel = themeBar.createEl("label", { cls: "mt-check fl-control-field" });
    themeLabel.createEl("span", { text: ui(p, "plotTheme") });
    this.themeSelect = themeLabel.createEl("select", { cls: "ft-select" });
    ["auto", "light", "dark"].forEach((id) => {
      this.themeSelect.createEl("option", { value: id, text: ui(p, "plotTheme" + id.charAt(0).toUpperCase() + id.slice(1)) });
    });
    this.themeSelect.value = "auto";
    this.themeSelect.addEventListener("change", () => this.refresh());

    const folderLabel = themeBar.createEl("label", { cls: "mt-check fl-control-field" });
    folderLabel.createEl("span", { text: ui(p, "plotFolder") });
    this.folderInput = folderLabel.createEl("input", { cls: "fl-field-input", attr: { type: "text" } });
    this.folderInput.value = normalizeFolderPath(p.settings.plotFolder || "plots") || "plots";
    inspector.createDiv({ cls: "fd-compat-hint", text: ui(p, "plotThemeHint") });

    const viewport = workspace.createDiv({ cls: "fd-preview-viewport ft-plot-preview" });
    this.preview = viewport.createDiv({ cls: "fd-preview" });

    const footer = this.contentEl.createDiv({ cls: "ft-footer" });
    this.statusEl = footer.createDiv({ cls: "ft-status" });
    const actions = footer.createDiv({ cls: "ft-actions" });
    this.outputActions = actions;
    const inlineButton = actions.createEl("button", { cls: "fe-btn fe-btn-primary", text: ui(p, "plotInsertSvg") });
    inlineButton.addEventListener("click", () => this.insertInline());
    const fileButton = actions.createEl("button", { cls: "fe-btn", text: ui(p, "plotInsertFile") });
    fileButton.addEventListener("click", () => runModalAction(this, () => this.insertFile()));
    const copyButton = actions.createEl("button", { cls: "fe-btn", text: ui(p, "plotCopySvg") });
    copyButton.addEventListener("click", () => runModalAction(this, () => this.copySvg()));
    const downloadButton = actions.createEl("button", { cls: "fe-btn", text: ui(p, "plotDownloadSvg") });
    downloadButton.addEventListener("click", () => this.downloadSvg());
    const cancelButton = actions.createEl("button", { cls: "fe-btn", text: ui(p, "cancel") });
    cancelButton.addEventListener("click", () => this.close());

    this._hydrating = true;
    this.addRow("x^2");
    if (this.options.config) this.applyConfig(this.options.config);
    else this.refresh();
    this._hydrating = false;
    this.initialConfig = JSON.stringify(this.readConfig());
    const draft = !this.options.config && readDraft(p.settings, "plot");
    if (draft) {
      const bar = this.contentEl.createDiv({ cls: "fl-draft-bar" });
      this.contentEl.insertBefore(bar, workspace);
      const t = (zh, en) => loc(p) === "zh" ? zh : en;
      bar.createSpan({ text: t("有未完成的绘图草稿", "An unfinished plot draft is available") });
      bar.createEl("button", { cls: "fe-btn", text: t("恢复草稿", "Restore draft") }).addEventListener("click", () => runModalAction(this, async () => { this.applyConfig(draft, false); await this.draftSession.save(draft); bar.remove(); }));
      bar.createEl("button", { cls: "fe-btn", text: t("丢弃草稿", "Discard draft") }).addEventListener("click", () => runModalAction(this, async () => { await writeDraft(p, "plot", null); bar.remove(); }));
    }
  }

  installPresets() {
    const p = this.plugin, t = (zh, en) => loc(p) === "zh" ? zh : en;
    const bar = this.contentEl.createDiv({ cls: "ft-preset-bar" });
    this.presetSelect = bar.createEl("select");
    labelControl(this.presetSelect, t("绘图预设", "Plot preset"));
    const name = bar.createEl("input", { attr: { type: "text", maxlength: "80" } });
    labelControl(name, t("预设名称", "Preset name"));
    this.presetSelect.addEventListener("change", () => {
      const preset = (p.settings.plotPresets || []).find((entry) => entry.name === this.presetSelect.value);
      if (!preset) return;
      try { this.applyConfig(preset.config); name.value = preset.name; }
      catch (error) { this.statusEl.setText(error.message); }
    });
    const save = bar.createEl("button", { cls: "fe-btn", text: ui(p, "save") });
    save.addEventListener("click", () => runModalAction(this, async () => {
      const label = name.value.trim();
      if (!label) throw new Error(t("请输入预设名称", "Enter a preset name"));
      if (!this.svgText) throw new Error(t("请先修正绘图错误", "Fix plot errors before saving"));
      const config = validatePlotConfig(this.readConfig());
      const presets = [...(p.settings.plotPresets || [])];
      const at = presets.findIndex((entry) => entry.name === label);
      if (at >= 0) throw new Error(t("名称已存在，请使用新名称或先删除原预设", "Name already exists; use a new name or delete the old preset first"));
      if (presets.length >= 50) throw new Error(t("最多保存 50 个绘图预设", "At most 50 plot presets"));
      presets.push({ name: label, config });
      p.settings.plotPresets = presets;
      try { await p.saveSettings(); } catch (error) { p.settings.plotPresets = presets.slice(0, -1); throw error; }
      this.refreshPresetOptions(label); this.statusEl.setText(t("预设已保存", "Preset saved"));
    }));
    const remove = bar.createEl("button", { cls: "fe-btn", text: t("删除预设", "Delete preset") });
    remove.addEventListener("click", () => {
      const selected = this.presetSelect.value;
      if (!selected) return;
      new ConfirmModal(this.app, p, t("删除绘图预设？", "Delete plot preset?"), selected, () => runModalAction(this, async () => {
        const previous = p.settings.plotPresets;
        p.settings.plotPresets = previous.filter((entry) => entry.name !== selected);
        try { await p.saveSettings(); } catch (error) { p.settings.plotPresets = previous; throw error; }
        this.refreshPresetOptions();
      })).open();
    });
    this.refreshPresetOptions();
  }

  refreshPresetOptions(selected = "") {
    this.presetSelect.empty();
    this.presetSelect.createEl("option", { value: "", text: loc(this.plugin) === "zh" ? "未选择预设" : "No preset selected" });
    (this.plugin.settings.plotPresets || []).forEach((entry) => this.presetSelect.createEl("option", { value: entry.name, text: entry.name }));
    this.presetSelect.value = selected;
  }

  readConfig() {
    return { version: 1, definitions: this.defInput.value,
      curves: this.rows.map((row) => ({ expression: row.input.value, locals: row.locals.value })),
      range: { xMin: this.readNumber(this.xMinInput, -10), xMax: this.readNumber(this.xMaxInput, 10), yMin: this.readNumber(this.yMinInput, -5), yMax: this.readNumber(this.yMaxInput, 5) },
      autoY: this.autoY.checked, theme: this.themeSelect.value,
      parameters: Object.fromEntries(this.paramNames.split(",").filter(Boolean).map((name) => [name, { value: this.params[name], ...this.paramRanges[name] }])) };
  }

  applyConfig(input, validate = true) {
    const config = validate ? validatePlotConfig(input) : clone(input);
    this.rowsEl.empty(); this.rows = [];
    config.curves.forEach((curve) => { this.addRow(curve.expression); this.rows.at(-1).locals.value = curve.locals; });
    this.defInput.value = config.definitions;
    for (const key of ["xMin", "xMax", "yMin", "yMax"]) this[key + "Input"].value = String(config.range[key]);
    this.autoY.checked = config.autoY; this.themeSelect.value = config.theme;
    this.params = {}; this.paramRanges = {}; this.paramNames = "\0";
    for (const [name, param] of Object.entries(config.parameters)) {
      this.params[name] = param.value;
      this.paramRanges[name] = { min: param.min, max: param.max, step: param.step };
    }
    this.refresh();
  }

  scheduleDraft() {
    if (this._hydrating || this.accepted) return;
    clearTimeout(this.draftTimer);
    this.draftTimer = setTimeout(() => { this.draftTimer = null; this.persistDraft(); }, 600);
  }

  persistDraft() {
    if (!this.rowsEl || this.accepted || this._hydrating) return;
    const config = this.readConfig();
    return (JSON.stringify(config) === this.initialConfig ? this.draftSession.clear() : this.draftSession.save(config)).catch((error) => logWarn("plot draft save failed:", error.message));
  }

  onClose() { this._closed = true; clearTimeout(this.draftTimer); this.persistDraft(); this.contentEl.empty(); }
  onActionSettled() { this.renderPlot(); }

  addRow(value) {
    if (this.rows.length >= 30) { this.statusEl?.setText(loc(this.plugin) === "zh" ? "最多 30 条曲线" : "At most 30 curves"); return; }
    const p = this.plugin;
    const row = this.rowsEl.createDiv({ cls: "ft-input-row" });
    const chip = row.createDiv({ cls: "ft-color-chip" });
    chip.style.background = PLOT_COLORS[this.rows.length % PLOT_COLORS.length];
    const input = row.createEl("input", { cls: "fl-field-input", attr: { type: "text", placeholder: ui(p, "plotExpressionPlaceholder") } });
    input.value = value;
    input.addEventListener("input", () => this.refresh());
    const locals = row.createEl("input", { cls: "fl-field-input ft-locals-input", attr: { type: "text", placeholder: ui(p, "plotLocalsPlaceholder") } });
    locals.addEventListener("input", () => this.refresh());
    const remove = row.createEl("button", { cls: "fe-btn", text: ui(p, "plotRemoveFunction") });
    remove.addEventListener("click", () => {
      const index = this.rows.findIndex((entry) => entry.row === row);
      if (index >= 0) this.rows.splice(index, 1);
      this.rowsEl.removeChild(row);
      this.refresh();
    });
    this.rows.push({ row: row, input: input, locals: locals, chip: chip });
    labelControl(input, loc(p) === "zh" ? "函数表达式" : "Expression");
    labelControl(locals, ui(p, "plotLocalsPlaceholder"));
    remove.setAttribute("aria-label", ui(p, "plotRemoveFunction") + " " + this.rows.length);
  }

  parseRows() {
    const curves = [];
    let error = "";
    this.rows.forEach((entry, index) => {
      const raw = (entry.input.value || "").trim();
      if (!raw) return;
      const locals = parsePlotLocals(entry.locals ? entry.locals.value : "");
      if (!error && locals.errors.length) {
        error = ui(this.plugin, "plotLocalsError") + ": " + plotLocalErrorText(this.plugin, locals.errors[0]);
      }
      try {
        const ast = parseExpressionAst(raw);
        curves.push({ expression: raw, ast: ast, color: PLOT_COLORS[index % PLOT_COLORS.length], label: "y = " + stripEquationPrefix(raw), scope: {}, locals: locals.values, functions: this.functions });
      } catch (parseError) {
        if (!error) error = raw + " - " + parseError.message;
      }
    });
    return { curves: curves, error: error };
  }

  readNumber(input, fallback) {
    if (!input || !String(input.value).trim()) return fallback;
    const value = Number(input && input.value);
    return Number.isFinite(value) ? value : fallback;
  }

  syncParameters(names) {
    const key = names.join(",");
    if (key === this.paramNames) return;
    this.paramNames = key;
    Array.from(this.paramsEl.querySelectorAll ? this.paramsEl.querySelectorAll(".ft-param") : []).forEach((el) => this.paramsEl.removeChild(el));
    names.forEach((name) => {
      const wrap = this.paramsEl.createDiv({ cls: "ft-param" });
      wrap.createEl("span", { text: name, cls: "fl-manage-title" });
      const value = this.params[name] === undefined ? 1 : this.params[name];
      this.params[name] = value;
      const bounds = this.paramRanges[name] || { min: PLOT_PARAM_MIN, max: PLOT_PARAM_MAX, step: PLOT_PARAM_STEP };
      this.paramRanges[name] = bounds;
      const display = wrap.createEl("input", { cls: "fl-field-input ft-param-value", attr: { type: "number", step: "any", "aria-label": name + (loc(this.plugin) === "zh" ? " 值" : " value") } });
      display.value = String(value);
      labelControl(display, loc(this.plugin) === "zh" ? "值" : "Value");
      const slider = wrap.createEl("input", { cls: "ft-param-slider", attr: { type: "range", min: String(bounds.min), max: String(bounds.max), step: String(bounds.step), "aria-label": name } });
      slider.value = String(value);
      slider.addEventListener("input", () => {
        const next = Number(slider.value);
        this.params[name] = next;
        display.value = String(next);
        this.renderPlot();
      });
      display.addEventListener("input", () => {
        this.params[name] = display.value.trim() ? Number(display.value) : NaN;
        slider.value = display.value; this.renderPlot();
      });
      const details = wrap.createEl("details", { cls: "ft-param-bounds" });
      details.createEl("summary", { text: loc(this.plugin) === "zh" ? "范围与步长" : "Range and step" });
      const fields = details.createDiv({ cls: "ft-param-range-grid" });
      for (const key of ["min", "max", "step"]) {
        const field = fields.createEl("input", { cls: "fl-field-input", attr: { type: "number", step: "any" } });
        field.value = String(bounds[key]);
        labelControl(field, loc(this.plugin) === "zh" ? { min: "最小值", max: "最大值", step: "步长" }[key] : key);
        field.addEventListener("input", () => {
          bounds[key] = field.value.trim() ? Number(field.value) : NaN;
          slider.setAttribute(key, String(bounds[key])); this.renderPlot();
        });
      }
    });
  }

  renderPlot() {
    const p = this.plugin;
    const xMin = this.readNumber(this.xMinInput, -10);
    let xMax = this.readNumber(this.xMaxInput, 10);
    let yMin = this.readNumber(this.yMinInput, -5);
    let yMax = this.readNumber(this.yMaxInput, 5);
    const rangeError = !(xMax > xMin) || (!this.autoY.checked && !(yMax > yMin));
    [this.xMinInput, this.xMaxInput, this.yMinInput, this.yMaxInput].forEach((input) => input.setAttribute("aria-invalid", String(rangeError)));
    const paramError = this.paramNames.split(",").filter(Boolean).some((name) => {
      const bounds = this.paramRanges[name];
      return !bounds || ![bounds.min, bounds.max, bounds.step, this.params[name]].every(Number.isFinite) || bounds.min >= bounds.max || bounds.step <= 0 || bounds.step > bounds.max - bounds.min || this.params[name] < bounds.min || this.params[name] > bounds.max;
    });
    const invalid = rangeError || paramError || this.parseError || this.definitionError;
    this.scheduleDraft();
    Array.from(this.outputActions?.querySelectorAll("button") || []).slice(0, 4).forEach((button) => { button.disabled = !!invalid || !this.curves.length; });
    this.yMinInput.disabled = this.autoY.checked;
    this.yMaxInput.disabled = this.autoY.checked;
    if (invalid) {
      this.svgText = "";
      this.model = null;
      this.preview.empty();
      const message = rangeError
        ? (loc(p) === "zh" ? "坐标范围的最大值必须大于最小值" : "Each maximum must be greater than its minimum")
        : paramError ? (loc(p) === "zh" ? "参数值须在有效范围内，步长须为正且不超过范围" : "Parameter values must be within valid bounds, with a positive step no larger than the range") : this.parseError || this.definitionError;
      this.preview.createDiv({ cls: "fl-empty-state", text: message });
      this.statusEl.setText(message);
      this.statusEl.setAttribute("role", "alert");
      return;
    }
    this.statusEl.setAttribute("role", "status");
    const range = { xMin: xMin, xMax: xMax };
    this.curves.forEach((curve) => { curve.scope = Object.assign({}, this.params, curve.locals || {}); });
    if (this.autoY.checked && this.curves.length) {
      const auto = autoYRange(this.curves, range);
      yMin = auto.yMin;
      yMax = auto.yMax;
    }
    if (!(yMax > yMin)) { yMin = -1; yMax = 1; }
    this.model = {
      width: 640,
      height: 400,
      xMin: range.xMin,
      xMax: range.xMax,
      yMin: yMin,
      yMax: yMax,
      curves: this.curves,
    };
    this.svgText = this.curves.length ? this.buildSvg(this.themeSelect ? this.themeSelect.value : "auto") : "";
    if (this.preview) {
      if (this.preview.empty) this.preview.empty();
      if (this.svgText) this.preview.innerHTML = this.svgText;
    }
    if (this.statusEl) {
      if (this.parseError) this.statusEl.setText(ui(p, "plotParseError") + ": " + this.parseError);
      else if (!this.curves.length) this.statusEl.setText(ui(p, "plotNoFunction"));
      else this.statusEl.setText(ui(p, "plotStatus")
        .replace("{n}", String(this.curves.length))
        .replace("{params}", this.paramNames ? this.paramNames.split(",").join(", ") : ui(p, "plotNoParams")));
    }
  }

  refresh() {
    const p = this.plugin;
    const definitions = parsePlotDefinitions(this.defInput ? this.defInput.value : "");
    this.functions = definitions.functions;
    const parsed = this.parseRows();
    this.curves = parsed.curves;
    this.parseError = parsed.error;
    // A curve calling a name that is neither built in nor defined draws nothing, so say so.
    const unknownCalls = [];
    parsed.curves.forEach(function(curve) {
      expressionCalls(curve.ast).forEach(function(called) {
        const lower = called.toLowerCase();
        if (PLOT_FUNCTIONS[lower] === undefined && definitions.functions[lower] === undefined && unknownCalls.indexOf(called) < 0) unknownCalls.push(called);
      });
    });
    this.definitionError = definitions.errors.length
        ? plotDefinitionErrorText(p, definitions.errors[0])
        : unknownCalls.length ? ui(p, "plotDefUnknownFunction") + ": " + unknownCalls.join(", ") : "";
    if (this.defError) {
      this.defError.setText(this.definitionError);
      if (this.definitionError) this.defInput.parentElement.open = true;
    }
    const names = {};
    parsed.curves.forEach(function(curve) {
      const locals = curve.locals || {};
      const visited = new Set();
      const addNames = (ast, bound = []) => {
        expressionVariables(ast).forEach((name) => {
          if (!bound.includes(name) && !Object.prototype.hasOwnProperty.call(locals, name)) names[name] = true;
        });
        expressionCalls(ast).forEach((called) => {
          const definition = definitions.functions[called.toLowerCase()];
          if (!definition || visited.has(called.toLowerCase())) return;
          visited.add(called.toLowerCase());
          addNames(definition.ast, definition.params);
        });
      };
      addNames(curve.ast);
    });
    this.syncParameters(Object.keys(names).sort());
    this.renderPlot();
  }

  buildSvg(theme) {
    if (!this.model || !this.curves.length) return "";
    return buildPlotSvg(Object.assign({}, this.model, { theme: theme || "auto" }));
  }

  // Anything leaving the note (file, clipboard, download) gets explicit colors and a background.
  buildSvgForExport() {
    return this.buildSvg(plotThemeResolved(this.themeSelect ? this.themeSelect.value : "auto"));
  }

  insertInline() {
    if (!this.svgText) {
      this.statusEl.setText(ui(this.plugin, "plotNoFunction"));
      return;
    }
    if (this.plugin.insertPlotSvg(this.svgText, validatePlotConfig(this.readConfig()), this.options.plotInfo, this.options.editor)) {
      this.accepted = true;
      this.draftSession.clear().catch((error) => logWarn("clear plot draft failed:", error.message));
      this.statusEl.setText(ui(this.plugin, "plotInserted"));
      this.close();
    }
  }

  async insertFile() {
    if (!this.svgText) {
      this.statusEl.setText(ui(this.plugin, "plotNoFunction"));
      return;
    }
    const folder = normalizeFolderPath(this.folderInput.value) || "plots";
    this.folderInput.value = folder;
    this.plugin.settings.plotFolder = folder;
    await this.plugin.saveSettings();
    const ok = await this.plugin.insertPlotFile(this.buildSvgForExport(), folder, validatePlotConfig(this.readConfig()));
    this.statusEl.setText(ui(this.plugin, ok ? "plotInserted" : "plotInsertFailed"));
    if (ok) { this.accepted = true; await this.draftSession.clear(); this.close(); }
  }

  async copySvg() {
    if (!this.svgText) {
      this.statusEl.setText(ui(this.plugin, "plotNoFunction"));
      return;
    }
    const ok = await writeClipboard(this.buildSvgForExport());
    this.statusEl.setText(ui(this.plugin, ok ? "plotCopied" : "exportCopyFailed"));
  }

  downloadSvg() {
    if (!this.svgText) {
      this.statusEl.setText(ui(this.plugin, "plotNoFunction"));
      return;
    }
    const ok = downloadTextFile(plotFileName("function"), this.buildSvgForExport(), "image/svg+xml;charset=utf-8");
    if (!ok) this.statusEl.setText(ui(this.plugin, "plotInsertFailed"));
  }
}

export { PLOT_COLORS, PLOT_CONSTANTS, PLOT_FUNCTIONS, PLOT_FUNCTION_NAMES, PLOT_CALL_DEPTH, PLOT_PARAM_MIN, PLOT_PARAM_MAX, PLOT_PARAM_STEP, splitPlotIdentifier, tokenizeExpression, stripEquationPrefix, parseExpressionAst, evaluateAst, walkPlotAst, expressionVariables, expressionCalls, PLOT_DEFINITION_RE, PLOT_PARAM_NAME_RE, isReservedPlotName, parsePlotDefinitions, definitionFreeVariables, parsePlotLocals, plotDefinitionErrorText, plotLocalErrorText, plotDocumentIsDark, plotThemeResolved, samplePlotCurve, autoYRange, niceTicks, formatTickValue, escapeXmlText, plotTransform, buildPlotPath, buildPlotSvg, plotFileName, PlotFunctionModal };
