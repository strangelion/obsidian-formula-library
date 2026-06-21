let _bridgeUrl = null;
let _bridgeAvailable = false;

async function initBridge(plugin) {
  const settings = plugin.settings;
  if (!settings.bridgeEnabled || !settings.bridgeUrl) {
    log("Bridge disabled");
    return;
  }
  _bridgeUrl = settings.bridgeUrl.replace(/\/$/, "");
  try {
    const resp = await fetch(_bridgeUrl + "/health", { signal: AbortSignal.timeout(3000) });
    const data = await resp.json();
    if (data.ok) {
      _bridgeAvailable = true;
      log("Bridge connected:", _bridgeUrl, "KaTeX:", data.katex);
    }
  } catch (e) {
    logWarn("Bridge not available:", e.message);
    _bridgeAvailable = false;
  }
}

function isBridgeAvailable() {
  return _bridgeAvailable;
}

async function bridgeConvert(latex, targets) {
  if (!_bridgeAvailable) return null;
  try {
    const resp = await fetch(_bridgeUrl + "/convert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latex, targets }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await resp.json();
    return data.ok ? data.result : null;
  } catch (e) {
    logWarn("bridgeConvert failed:", e.message);
    _bridgeAvailable = false;
    return null;
  }
}

async function bridgeExport(latex, format) {
  if (!_bridgeAvailable) return null;
  try {
    const resp = await fetch(_bridgeUrl + "/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latex, format }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await resp.json();
    return data.ok ? data.output : null;
  } catch (e) {
    logWarn("bridgeExport failed:", e.message);
    _bridgeAvailable = false;
    return null;
  }
}

module.exports = { initBridge, isBridgeAvailable, bridgeConvert, bridgeExport };
