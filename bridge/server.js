const http = require("http");
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const PORT = process.env.BRIDGE_PORT || 28765;
const LOG_PREFIX = "[Bridge]";

function log(...args) { console.log(LOG_PREFIX, ...args); }
function logErr(...args) { console.error(LOG_PREFIX, ...args); }

let katex = null;
try {
  katex = require("katex");
  log("KaTeX loaded");
} catch (e) {
  log("KaTeX not available, SVG/PNG rendering disabled:", e.message);
}

function renderKaTeX(latex, displayMode) {
  if (!katex) throw new Error("KaTeX not installed. Run: cd bridge && npm install");
  return katex.renderToString(latex, {
    displayMode: displayMode || false,
    throwOnError: false,
    output: "html",
  });
}

function renderToSVG(latex) {
  if (!katex) throw new Error("KaTeX not installed");
  return katex.renderToString(latex, {
    displayMode: true,
    throwOnError: false,
    output: "svg",
  });
}

function renderToMathML(latex) {
  if (!katex) throw new Error("KaTeX not installed");
  return katex.renderToString(latex, {
    displayMode: true,
    throwOnError: false,
    output: "mathml",
  });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try { resolve(JSON.parse(body)); }
      catch (e) { reject(new Error("Invalid JSON")); }
    });
    req.on("error", reject);
  });
}

function sendJSON(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  log(req.method, req.url);

  try {
    if (req.method === "GET" && req.url === "/health") {
      sendJSON(res, 200, { ok: true, version: "1.0.0", katex: !!katex });
      return;
    }

    if (req.method === "POST" && req.url === "/convert") {
      const { latex, targets } = await parseBody(req);
      if (!latex) { sendJSON(res, 400, { ok: false, error: "latex required" }); return; }

      const result = {};
      if (!targets || targets.includes("html")) {
        result.html = renderKaTeX(latex, true);
      }
      if (targets && targets.includes("svg")) {
        result.svg = renderToSVG(latex);
      }
      if (targets && targets.includes("mathml")) {
        result.mathml = renderToMathML(latex);
      }

      sendJSON(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && req.url === "/export") {
      const { latex, format } = await parseBody(req);
      if (!latex) { sendJSON(res, 400, { ok: false, error: "latex required" }); return; }

      let output = "";
      if (format === "html" || format === "svg" || format === "mathml") {
        output = renderKaTeX(latex, true);
      } else {
        output = latex;
      }

      sendJSON(res, 200, { ok: true, output, format: format || "latex" });
      return;
    }

    sendJSON(res, 404, { ok: false, error: "Not found" });
  } catch (e) {
    logErr("Error:", e.message);
    sendJSON(res, 500, { ok: false, error: e.message });
  }
});

server.listen(PORT, () => {
  log(`Bridge server running on http://127.0.0.1:${PORT}`);
  log(`Health: http://127.0.0.1:${PORT}/health`);
});
