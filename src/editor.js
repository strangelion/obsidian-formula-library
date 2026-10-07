import * as obsidian from "obsidian";
import { FORMULA_DATA, MATHLIVE_ZH, log, logWarn, loc, ui, tabName, groupSourceSuffix, itemLabel, itemTags, itemNote, formatTags, trackUsage, getUsageCount, isFavorite, toggleFavorite, sortByUsage, isPinned, formulaMatchesView, createLibraryFilterBar, openFormulaMenu, searchLibrary, searchSummaryText, searchMoreText } from "./core.js";
import { loadMathLive } from "./mathlive.js";
import { SaveToLibraryModal } from "./personal-library.js";
import { ParamTemplateModal } from "./parameters.js";
import { MatrixPasteModal } from "./matrix.js";
import { PlotFunctionModal } from "./plot.js";
import { applyLibraryTypography } from "./typography.js";

// ======================== Editor Modal ========================
class EditorModal extends obsidian.Modal {
  constructor(app, plugin, mode, latex, formulaInfo) {
    super(app);
    this.plugin = plugin;
    this.initMode = mode;
    this.initLatex = latex;
    this.formulaInfo = formulaInfo;
    this.viewMode = "all";
    this.libLimit = 0;
  }

  async onOpen() {
    log("Modal onOpen, mode=" + this.initMode);

    this.containerEl.addClass("formula-library-modal-container");
    this.modalEl.addClass("formula-library-modal");
    this.modalEl.dataset.density = this.plugin.settings.libraryDensity || "comfortable";
    if (this.plugin.trackOpenModal) this.plugin.trackOpenModal(this);
    this.contentEl.addClass("formula-editor-modal");
    this.titleEl.setText(ui(this.plugin, "title"));

    const top = this.contentEl.createDiv({ cls: "fe-top-bar" });
    const tg = top.createDiv({ cls: "fe-mode-toggle" });
    this.btnV = tg.createEl("button", { text: ui(this.plugin, "visual"), cls: "active" });
    this.btnS = tg.createEl("button", { text: ui(this.plugin, "source") });
    const tools = this.contentEl.createDiv({ cls: "fe-tools-bar", attr: { role: "group", "aria-label": loc(this.plugin) === "zh" ? "公式工具" : "Formula tools" } });
    this.toolsBar = tools;
    this.btnParams = tools.createEl("button", { cls: "fe-btn", text: ui(this.plugin, "paramTemplates") });
    this.btnParams.addEventListener("click", () => {
      new ParamTemplateModal(this.app, this.plugin, { onInsert: (latex) => this.insertIntoEditor(latex) }).open();
    });
    this.btnMatrix = tools.createEl("button", { cls: "fe-btn", text: ui(this.plugin, "matrixPaste") });
    this.btnMatrix.addEventListener("click", () => {
      new MatrixPasteModal(this.app, this.plugin, { onInsert: (latex) => this.insertIntoEditor(latex) }).open();
    });
    this.btnSave = tools.createEl("button", { cls: "fe-btn", text: ui(this.plugin, "saveToLibrary") });
    this.btnSave.addEventListener("click", () => this.saveToLibrary());
    this.btnPlot = tools.createEl("button", { cls: "fe-btn", text: ui(this.plugin, "plotTitle") });
    this.btnPlot.addEventListener("click", () => {
      new PlotFunctionModal(this.app, this.plugin, {}).open();
    });
    top.createDiv({ cls: "fe-spacer" });
    this.btnCancel = top.createEl("button", { cls: "fe-btn", text: ui(this.plugin, "cancel") });
    this.btnCancel.addEventListener("click", () => this.close());
    this.btnAccept = top.createEl("button", { cls: "fe-btn fe-btn-primary", text: ui(this.plugin, "acceptInsert") });
    this.btnAccept.addEventListener("click", () => this.accept());

    const ml = this.contentEl.createDiv({ cls: "fe-main-layout" });
    const ep = ml.createDiv({ cls: "fe-editor-pane" });

    this.visualPane = ep.createDiv({ cls: "fe-visual-pane" });
    this.previewEl = this.visualPane.createDiv({ cls: "fe-preview-area" });

    this.sourcePane = ep.createDiv({ cls: "fe-source-pane" });
    this.sourceTA = this.sourcePane.createEl("textarea", { cls: "fe-textarea", attr: { spellcheck: "false", placeholder: "Enter LaTeX..." } });

    if (this.plugin.settings.defaultEditorMode === "source") {
      this.visualPane.style.display = "none";
      this.sourcePane.style.display = "";
      this.btnS.addClass("active");
      this.btnV.removeClass("active");
    } else {
      this.sourcePane.style.display = "none";
    }

    this.statusEl = ep.createDiv({ cls: "fe-status-bar" });
    this.statusEl.setText(ui(this.plugin, "ready"));

    this.latexInline = ep.createDiv({ cls: "fe-latex-inline-wrap" });
    this.latexSource = this.latexInline.createEl("textarea", {
      cls: "fe-latex-inline",
      attr: { spellcheck: "false", placeholder: "LaTeX source...", rows: "2" },
    });
    if (this.plugin.settings.defaultEditorMode === "source") {
      this.latexInline.style.display = "none";
    }

    const lp = ml.createDiv({ cls: "fe-library-panel" });
    this.libraryPanel = lp;
    applyLibraryTypography(lp, this.plugin.settings);
    const lc = lp.createDiv({ cls: "fl-search-container" });
    this.libSI = lc.createEl("input", { cls: "fl-search-input", attr: { type: "text", placeholder: ui(this.plugin, "search") } });
    this.libSI.addEventListener("input", () => { this.libLimit = 0; this.renderLibGrid(); });
    const hintZh = loc(this.plugin) === "zh";
    this.libHint = lc.createDiv({ cls: "fl-search-hint" }).createEl("span", { text: hintZh ? "拼音首字母 · frac sqrt lim · 模糊" : "pinyin · frac sqrt lim · fuzzy", cls: "fl-search-hint-text" });
    this.libCountEl = lc.createDiv({ cls: "fl-search-count" });

    this.libFilterBar = createLibraryFilterBar(this.plugin, lp, this.viewMode, (view) => {
      this.viewMode = view;
      this.libLimit = 0;
      this.renderLibGrid();
    });

    this.libTabs = lp.createDiv({ cls: "fl-tabs" });
    this.libScroll = lp.createDiv({ cls: "fl-grid-scroll" });
    this.libGrid = this.libScroll.createDiv({ cls: "fl-grid" });
    this.libMoreEl = this.libScroll.createDiv({ cls: "fl-load-more-wrap" });
    this.libCurG = FORMULA_DATA.GROUPS[0];
    this.renderLibTabs(); this.renderLibGrid();

    await loadMathLive(this);

    if (window.MathfieldElement) {
      if (loc(this.plugin) === "zh") {
        try { MathfieldElement.strings = { "zh-CN": MATHLIVE_ZH }; } catch {}
        try { MathfieldElement.locale = "zh-CN"; } catch {}
      }
      try { MathfieldElement.locale = loc(this.plugin) === "zh" ? "zh-CN" : "en"; } catch {}
      this.mf = new MathfieldElement();
      this.mf.classList.add("fe-mathfield");
      this.mf.mathVirtualKeyboardPolicy = this.plugin.settings.mathliveKeyboard ? "auto" : "manual";
      this.mf.smartFence = true;

      try {
        if (window.mathVirtualKeyboard) {
          window.mathVirtualKeyboard.container = document.body;
          window.mathVirtualKeyboard.style = {
            position: "fixed",
            bottom: "0",
            left: "0",
            right: "0",
            zIndex: "99999",
          };
          setTimeout(() => {
            const kbd = document.querySelector(".ML__virtual-keyboard");
            if (kbd) {
              ["mousedown", "click"].forEach((evt) => {
                kbd.addEventListener(evt, (e) => e.stopPropagation(), true);
              });
              const observer = new MutationObserver(() => {
                const modalEl = this.contentEl.closest(".modal");
                if (!modalEl) return;
                const visible = kbd.offsetHeight > 0;
                modalEl.toggleClass("is-keyboard-open", visible);
              });
              observer.observe(kbd, { attributes: true, attributeFilter: ["style", "class"] });
              observer.observe(kbd, { childList: true, subtree: true });
            }
          }, 500);
        }
      } catch {}

      this.mf.style.width = "100%";
      this.mf.style.fontSize = (this.plugin.settings.previewFontSize || 20) + "px";
      this.mf.style.border = "none";
      this.mf.style.background = "transparent";
      this.mf.style.padding = "0";
      this.mf.style.userSelect = "text";
      this.mf.style.webkitUserSelect = "text";
      this.mf.style.pointerEvents = "auto";
      if (this.plugin.settings.mathFontStyle === "upright") {
        this.mf.style.setProperty("--math-font-style", "upright");
      }
      if (this.plugin.settings.mathFontFamily) {
        this.mf.style.setProperty("--math-font-family", this.plugin.settings.mathFontFamily);
      }
      this.previewEl.appendChild(this.mf);

      try {
        const container = this.mf.shadowRoot?.querySelector(".ML__container");
        if (container) {
          container.removeAttribute("aria-hidden");
          log("Removed aria-hidden from ML__container");
          new MutationObserver(() => {
            if (container.hasAttribute("aria-hidden")) {
              container.removeAttribute("aria-hidden");
              log("Removed re-added aria-hidden");
            }
          }).observe(container, { attributes: true, attributeFilter: ["aria-hidden"] });
        } else {
          logWarn("ML__container not found in shadow root");
        }
        const kbdToggle = this.mf.shadowRoot?.querySelector(".ML__virtual-keyboard-toggle");
        if (kbdToggle) {
          log("Virtual keyboard toggle found");
          kbdToggle.addEventListener("click", () => {
            log("Virtual keyboard toggle clicked");
          });
        } else {
          logWarn("Virtual keyboard toggle not found");
        }
      } catch (e) { logWarn("aria-hidden cleanup error:", e.message); }

      this.mf.addEventListener("input", () => {
        const val = this.mf.value || "";
        this.sourceTA.value = val;
        if (this.latexSource !== document.activeElement) {
          this.latexSource.value = val;
        }
      });

      this.latexSource.addEventListener("input", () => {
        const val = this.latexSource.value;
        this.mf.value = val;
        this.sourceTA.value = val;
      });
      this.latexSource.addEventListener("focus", () => {
        this.latexSource.value = this.mf.value || "";
      });

      if (this.initLatex) {
        this.mf.value = this.initLatex;
        this.latexSource.value = this.initLatex;
      }
    } else {
      this.previewEl.createEl("div", { cls: "fe-preview-placeholder", text: "MathLive unavailable" });
    }

    this.ta = this.visualPane.createEl("textarea", { cls: "fe-textarea", attr: { spellcheck: "false", placeholder: "Enter LaTeX here..." } });
    this.ta.style.display = "none";

    this.sourceTA.addEventListener("input", () => {
      if (this.mf) this.mf.value = this.sourceTA.value;
      else if (this.ta) this.ta.value = this.sourceTA.value;
    });

    this.btnV.addEventListener("click", () => {
      this.btnV.addClass("active"); this.btnS.removeClass("active");
      this.visualPane.style.display = ""; this.sourcePane.style.display = "none";
      if (this.latexInline) this.latexInline.style.display = "";
    });
    this.btnS.addEventListener("click", () => {
      this.btnS.addClass("active"); this.btnV.removeClass("active");
      this.visualPane.style.display = "none"; this.sourcePane.style.display = "";
      if (this.latexInline) this.latexInline.style.display = "none";
      this.sourceTA.value = this.mf ? this.mf.getValue("latex") : this.ta.value;
    });
    [this.sourceTA].forEach(el => el.addEventListener("keydown", (e) => this.onKey(e)));

    this.btnAccept.setText(this.initMode === "update" ? ui(this.plugin, "acceptUpdate") : ui(this.plugin, "acceptInsert"));
    this.statusEl.setText(this.initMode === "update" ? ui(this.plugin, "editMode") : ui(this.plugin, "ready"));
  }

  renderLibTabs() {
    this.libTabs.empty();
    const sel = this.libTabs.createEl("select", { cls: "fl-group-select" });
    FORMULA_DATA.GROUPS.forEach((g, index) => {
      const opt = sel.createEl("option", { value: String(index), text: tabName(this.plugin, g) + groupSourceSuffix(this.plugin, g) });
      if (g === this.libCurG) opt.selected = true;
    });
    sel.addEventListener("change", () => {
      const g = FORMULA_DATA.GROUPS[Number(sel.value)];
      if (g) { this.libCurG = g; this.renderLibGrid(); }
    });
  }

  renderLibGrid() {
    this.libGrid.empty();
    if (this.libMoreEl) this.libMoreEl.empty();
    const q = this.libSI?.value?.trim() || "";
    const limit = Number(this.plugin.settings.searchResultLimit) || 160;
    if (!q && this.libCountEl) this.libCountEl.textContent = "";
    let rendered = 0;
    if (q) {
      // Ranked across every category: best matches first, the remainder stays
      // reachable through the "show more" button.
      this.libGrid.className = "fl-grid structures";
      const results = searchLibrary(this.plugin, q, this.viewMode);
      const shown = Math.max(limit, this.libLimit || 0);
      if (this.libCountEl) this.libCountEl.textContent = searchSummaryText(this.plugin, results.length, Math.min(shown, results.length));
      let lastName = null;
      for (const hit of results) {
        if (rendered >= shown) break;
        const name = tabName(this.plugin, hit.group) + groupSourceSuffix(this.plugin, hit.group);
        if (name !== lastName) {
          this.libGrid.createDiv({ cls: "fl-group-label" }).textContent = name;
          lastName = name;
        }
        this.libGrid.appendChild(this.makeLibBtn(hit.item));
        rendered++;
      }
      if (results.length > rendered && this.libMoreEl) {
        const more = this.libMoreEl.createEl("button", { cls: "fl-btn fl-load-more", text: searchMoreText(this.plugin, results.length - rendered) });
        more.addEventListener("click", () => { this.libLimit = rendered + limit; this.renderLibGrid(); });
      }
    } else if (this.viewMode !== "all") {
      this.libGrid.className = "fl-grid structures";
      for (const group of FORMULA_DATA.GROUPS) {
        const visible = sortByUsage(this.plugin, group.items.filter((item) => !item.section && formulaMatchesView(this.plugin, item, this.viewMode)));
        if (!visible.length) continue;
        this.libGrid.createDiv({ cls: "fl-group-label" }).textContent = tabName(this.plugin, group);
        for (const item of visible) {
          if (rendered >= limit) break;
          this.libGrid.appendChild(this.makeLibBtn(item));
          rendered++;
        }
        if (rendered >= limit) break;
      }
    } else if (this.libCurG) {
      this.libGrid.className = this.libCurG.structures ? "fl-grid structures" : "fl-grid";
      let section = null;
      let bucket = [];
      const flush = () => {
        const visible = sortByUsage(this.plugin, bucket.filter((item) => formulaMatchesView(this.plugin, item, "all")));
        if (visible.length && section) this.libGrid.createDiv({ cls: "fl-section-label" }).textContent = section;
        for (const item of visible) {
          if (rendered >= limit) break;
          this.libGrid.appendChild(this.makeLibBtn(item));
          rendered++;
        }
        bucket = [];
      };
      for (const item of this.libCurG.items) {
        if (item.section) {
          flush();
          section = loc(this.plugin) === "zh" ? item.section : item.sectionEn;
        } else bucket.push(item);
      }
      flush();
    }
    if (rendered === 0) {
      this.libGrid.createDiv({ cls: "fl-empty-state", text: ui(this.plugin, "noResults") });
    }
  }

  makeLibBtn(i) {
    const label = itemLabel(this.plugin, i);
    const latex = i[1];
    const cnt = getUsageCount(this.plugin, latex);
    const b = document.createElement("button");
    b.className = "fl-symbol-btn";

    const star = b.createDiv({ cls: "fl-grid-fav-star", attr: { role: "button", tabindex: "0", "aria-label": ui(this.plugin, "favorites") } });
    obsidian.setIcon(star, "star");
    star.toggleClass("active", isFavorite(this.plugin, latex));
    star.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleFavorite(this.plugin, latex);
      this.renderLibGrid();
    });

    b.createDiv({ cls: "fl-sym-label", text: label });
    if (this.plugin.settings.showLatexLabels !== false) b.createEl("code", { cls: "fl-sym-fallback", text: latex.length > 28 ? latex.slice(0, 26) + "..." : latex });
    const libTags = itemTags(i);
    if (libTags.length) b.createDiv({ cls: "fl-sym-tags", text: formatTags(libTags) });
    b.title = [i[2], latex, itemNote(i)].filter(Boolean).join("\n");

    if (isPinned(this.plugin, latex)) {
      const pin = b.createDiv({ cls: "fl-grid-pin", attr: { title: ui(this.plugin, "pinned") } });
      obsidian.setIcon(pin, "pin");
    }

    const menuButton = b.createDiv({ cls: "fl-grid-menu", attr: { role: "button", tabindex: "0", "aria-label": loc(this.plugin) === "zh" ? "公式操作" : "Formula actions" } });
    obsidian.setIcon(menuButton, "more-horizontal");
    menuButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openFormulaMenu(this.plugin, i, event, () => this.renderLibGrid());
    });

    if (cnt > 0) {
      b.createEl("span", { cls: "fl-grid-usage-badge", text: cnt >= 100 ? "99+" : String(cnt) });
    }

    b.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      trackUsage(this.plugin, latex);
      this.insertIntoEditor(latex);
    });
    b.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      openFormulaMenu(this.plugin, i, event, () => this.renderLibGrid());
    });

    return b;
  }

  insertIntoEditor(latex) {
    if (latex.startsWith("matrix:")) latex = this.matrixTemplate(latex.slice(7));
    if (this.mf) {
      const mlLatex = latex.replace(/#\?/g, "\\square").replace(/#0/g, "\\square").replace(/#@/g, "\\square");
      this.mf.insert(mlLatex);
      this.sourceTA.value = this.mf.value || "";
      if (this.latexSource) this.latexSource.value = this.mf.value || "";
      this.mf.focus();
    } else {
      const s = this.ta.selectionStart, end = this.ta.selectionEnd, t = this.ta.value;
      this.ta.value = t.slice(0, s) + latex + t.slice(end);
      const ph = latex.indexOf("#?");
      if (ph >= 0) {
        this.ta.selectionStart = s + ph;
        this.ta.selectionEnd = s + ph + 2;
      } else {
        this.ta.selectionStart = this.ta.selectionEnd = s + latex.length;
      }
      this.ta.focus();
      this.sourceTA.value = this.ta.value;
    }
  }

  currentLatex() {
    return this.mf ? (this.mf.value || "").trim() : ((this.sourceTA?.value || this.ta?.value || "").trim());
  }

  saveToLibrary() {
    const latex = this.currentLatex();
    if (!latex) {
      this.statusEl.setText(ui(this.plugin, "saveToLibraryNoLatex"));
      return;
    }
    new SaveToLibraryModal(this.app, this.plugin, latex, { label: "" }).open();
  }

  matrixTemplate(env) {
    const R = 2, C = 2;
    const cells = (r, c, fn) => Array.from({ length: r }, (_, i) => Array.from({ length: c }, (_, j) => fn(i, j)).join(" & ")).join(" \\\\ ");
    if (env === "jacobian") return `\\begin{bmatrix} ${cells(R, C, (r, c) => `\\frac{\\partial f_{${r+1}}}{\\partial x_{${c+1}}}`)} \\end{bmatrix}`;
    if (env === "hessian") return `\\begin{bmatrix} ${cells(R, C, (r, c) => `\\frac{\\partial^2 f}{\\partial x_{${r+1}}\\partial x_{${c+1}}}`)} \\end{bmatrix}`;
    if (env === "identity") return `\\begin{bmatrix} ${cells(R, R, (r, c) => r === c ? "1" : "0")} \\end{bmatrix}`;
    if (env === "diagonal") return `\\begin{bmatrix} ${cells(R, R, (r, c) => r === c ? `a_{${r+1}}` : "0")} \\end{bmatrix}`;
    if (env === "augmented") return `\\left[\\begin{array}{cc|c} ${cells(R, C + 1, () => "#?")} \\end{array}\\right]`;
    return `\\begin{${env}} ${cells(env === "cases" ? R : R, env === "cases" ? 2 : C, () => "#?")} \\end{${env}}`;
  }

  cleanLatex(latex) {
    if (latex.startsWith("matrix:")) return "\\text{" + latex.slice(7) + "}";
    return latex.replace(/#\?/g, "\\square").replace(/#0/g, "\\square").replace(/#@/g, "\\square");
  }

  renderMath(el, latex) {
    if (!el || !latex) return;
    try {
      const cleaned = this.cleanLatex(latex);
      const rendered = obsidian.renderMath(cleaned, el);
      if (rendered) el.appendChild(rendered);
    } catch (e) {
      logWarn("renderMath failed:", e.message);
    }
  }

  updatePreview() {
    if (this.mf) {
      this.mf.setValue(this.ta.value);
    }
  }

  onKey(e) {
    const sc = this.plugin.settings.shortcuts || {};
    const map = {};
    if (sc.fraction) map[sc.fraction] = "\\frac{}{}";
    if (sc.sqrt) map[sc.sqrt] = "\\sqrt{}";
    if (sc.superscript) map[sc.superscript] = "^{}";
    if (sc.subscript) map[sc.subscript] = "_{}";
    if (sc.subSuper) map[sc.subSuper] = "_{}^{}";
    const combo = (e.ctrlKey ? "ctrl+" : "") + (e.shiftKey ? "shift+" : "") + (e.altKey ? "alt+" : "") + (e.metaKey ? "meta+" : "") + e.key.toLowerCase();
    if (map[combo]) {
      e.preventDefault();
      this.insertIntoEditor(map[combo]);
      return;
    }
    if (e.key === "Enter" && e.shiftKey && !e.isComposing && !e.altKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      this.accept();
    }
  }

  accept() {
    const latex = this.mf ? (this.mf.value || "").trim() : ((this.sourceTA?.value || this.ta?.value || "").trim());
    if (!latex) { this.statusEl.setText("Please enter a formula"); return; }
    log("accept: writing formula to editor");
    if (this.initMode === "update" && this.formulaInfo) this.plugin.replaceFormula(latex, this.formulaInfo);
    else this.plugin.insertFormula(latex, true);
    this.close();
  }

  onClose() {
    log("Modal onClose");
    if (this.plugin.untrackOpenModal) this.plugin.untrackOpenModal(this);
    this.contentEl.empty();
  }

  // Re-applies settings that are read while the modal is already open, so a
  // change in the settings tab shows up without reopening the editor.
  refreshLibrary() {
    if (!FORMULA_DATA) return;
    this.refreshLocalization();
    this.libCurG = FORMULA_DATA.GROUPS.find((g) => this.libCurG && g.id === this.libCurG.id && g.source === this.libCurG.source) || FORMULA_DATA.GROUPS[0] || null;
    this.renderLibTabs();
    this.renderLibGrid();
    this.applyDisplaySettings();
  }

  applyDisplaySettings() {
    const s = this.plugin.settings;
    applyLibraryTypography(this.libraryPanel, s);
    this.modalEl.dataset.density = s.libraryDensity || "comfortable";
    if (!this.mf) return;
    this.mf.style.fontSize = (s.previewFontSize || 20) + "px";
    if (s.mathFontStyle === "upright") this.mf.style.setProperty("--math-font-style", "upright");
    else this.mf.style.removeProperty("--math-font-style");
    if (s.mathFontFamily) this.mf.style.setProperty("--math-font-family", s.mathFontFamily);
    else this.mf.style.removeProperty("--math-font-family");
    this.mf.mathVirtualKeyboardPolicy = s.mathliveKeyboard ? "auto" : "manual";
  }

  refreshLocalization() {
    this.titleEl.setText(ui(this.plugin, "title"));
    const labels = [
      [this.btnV, "visual"], [this.btnS, "source"], [this.btnParams, "paramTemplates"],
      [this.btnMatrix, "matrixPaste"], [this.btnSave, "saveToLibrary"], [this.btnPlot, "plotTitle"],
      [this.btnCancel, "cancel"], [this.btnAccept, this.initMode === "update" ? "acceptUpdate" : "acceptInsert"],
    ];
    for (const [button, key] of labels) button?.setText(ui(this.plugin, key));
    this.libSI.placeholder = ui(this.plugin,"search");
    this.libSI.setAttribute("aria-label",ui(this.plugin,"search"));
    this.libHint?.setText(loc(this.plugin) === "zh" ? "拼音首字母 · frac sqrt lim · 模糊" : "pinyin · frac sqrt lim · fuzzy");
    this.libFilterBar?.refreshLabels(this.plugin);
    this.toolsBar?.setAttribute("aria-label",loc(this.plugin) === "zh" ? "公式工具" : "Formula tools");
    if (["Ready", "就绪"].includes(this.statusEl?.textContent)) this.statusEl.setText(ui(this.plugin,"ready"));
    if (typeof window.MathfieldElement !== "undefined") {
      try { window.MathfieldElement.locale = loc(this.plugin) === "zh" ? "zh-CN" : "en"; } catch {}
    }
  }
}

export { EditorModal };
