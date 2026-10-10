import * as obsidian from "obsidian";
import { applyLibraryTypography } from "./typography.js";
import { keyboardButton, wireSearchNavigation } from "./ui.js";
import { isToolEnabled } from "./tools.js";
import { FORMULA_DATA, log, logErr, loc, ui, tabName, groupSourceSuffix, itemLabel, itemTags, itemNote, formatTags, trackUsage, getUsageCount, isFavorite, toggleFavorite, sortByUsage, isPinned, formulaMatchesView, createLibraryFilterBar, openFormulaMenu, searchLibrary, searchSummaryText, searchMoreText } from "./core.js";

// ======================== Sidebar (simplified) ========================
class SidebarView extends obsidian.ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; this.currentGroup = null; this.globalQ = ""; this.viewMode = "all"; this.searchLimit = 0; }
  getViewType() { return "formula-library-sidebar"; }
  getDisplayText() { return "Formula Library"; }
  getIcon() { return "sigma"; }

  async onOpen() {
    log("Sidebar onOpen");
    if (!FORMULA_DATA) { logErr("Sidebar: no data"); return; }
    this.currentGroup = FORMULA_DATA.GROUPS[0];
    const c = this.containerEl.children[1]; c.empty(); c.addClass("formula-library-sidebar");
    applyLibraryTypography(c, this.plugin.settings);

    const sc = c.createDiv({ cls: "fl-search-container" });
    const si = sc.createEl("input", { cls: "fl-search-input", attr: { type: "text", placeholder: ui(this.plugin, "search") } });
    this.searchInput = si;
    si.addEventListener("input", () => { this.globalQ = si.value; this.searchLimit = 0; this.renderList(); });

    const isZh = loc(this.plugin) === "zh";
    const hint = sc.createDiv({ cls: "fl-search-hint" });
    this.hintEl = hint.createEl("span", { text: isZh ? "支持: 拼音首字母 · LaTeX命令( frac sqrt lim ) · 模糊匹配" : "Smart: pinyin initials · LaTeX commands (frac sqrt lim) · fuzzy match", cls: "fl-search-hint-text" });
    this.searchCountEl = sc.createDiv({ cls: "fl-search-count" });

    this.filterBar = createLibraryFilterBar(this.plugin, c, this.viewMode, (view) => {
      this.viewMode = view;
      this.searchLimit = 0;
      this.renderList();
    });

    this.tabsEl = c.createDiv({ cls: "fl-tabs" });
    this.listEl = c.createDiv({ cls: "fl-list" });
    this.resetKeyboardSelection = wireSearchNavigation(si, this.listEl, ".fl-list-item");

    const bar = c.createDiv({ cls: "fl-action-bar" });
    this.openEditorButton = bar.createEl("button", { cls: "fl-btn fl-btn-primary", text: ui(this.plugin, "openEditor") });
    this.openEditorButton.addEventListener("click", () => {
        this.plugin.openEditor("insert");
      });
    const drawingButton = bar.createEl("button", { cls: "fl-btn", attr: { type: "button" } });
    this.drawingButton = drawingButton;
    drawingButton.hidden = !isToolEnabled(this.plugin, "mermaid");
    obsidian.setIcon(drawingButton, "workflow");
    this.drawingLabel = drawingButton.createSpan({ text: ui(this.plugin, "drawing") });
    drawingButton.addEventListener("click", () => this.plugin.openDrawing());

    this.renderTabs(); this.renderList();
  }

  renderTabs() {
    this.tabsEl.empty();
    this.currentGroup = FORMULA_DATA.GROUPS.find((g) => this.currentGroup && g.id === this.currentGroup.id && g.source === this.currentGroup.source) || FORMULA_DATA.GROUPS[0] || null;
    if (!FORMULA_DATA.GROUPS.length) {
      this.tabsEl.createEl("span", { text: loc(this.plugin) === "zh" ? "没有启用的分类" : "No enabled groups", cls: "fl-tab" });
      return;
    }
    const sel = this.tabsEl.createEl("select", { cls: "fl-group-select" });
    FORMULA_DATA.GROUPS.forEach((g, index) => {
      const opt = sel.createEl("option", { value: String(index), text: tabName(this.plugin, g) + groupSourceSuffix(this.plugin, g) });
      if (g === this.currentGroup) opt.selected = true;
    });
    sel.addEventListener("change", () => {
      const g = FORMULA_DATA.GROUPS[Number(sel.value)];
      if (g) { this.currentGroup = g; this.renderList(); }
    });
  }

  refreshLocalization() {
    if (this.drawingButton) this.drawingButton.hidden = !isToolEnabled(this.plugin, "mermaid");
    if (this.searchInput) { this.searchInput.placeholder = ui(this.plugin, "search"); this.searchInput.setAttribute("aria-label", ui(this.plugin, "search")); }
    if (this.hintEl) this.hintEl.setText(loc(this.plugin) === "zh" ? "支持: 拼音首字母 · LaTeX命令( frac sqrt lim ) · 模糊匹配" : "Smart: pinyin initials · LaTeX commands (frac sqrt lim) · fuzzy match");
    this.filterBar?.refreshLabels(this.plugin);
    this.openEditorButton?.setText(ui(this.plugin, "openEditor"));
    this.drawingLabel?.setText(ui(this.plugin, "drawing"));
  }

  renderList() {
    this.resetKeyboardSelection?.();
    applyLibraryTypography(this.containerEl.children[1], this.plugin.settings);
    this.listEl.empty();
    const q = this.globalQ.trim();
    const limit = Number(this.plugin.settings.searchResultLimit) || 160;
    if (!q && this.searchCountEl) this.searchCountEl.textContent = "";
    let rendered = 0;
    if (q) {
      // One ranked list across every category: the best matches come first and
      // the remaining hits stay reachable through "show more".
      const results = searchLibrary(this.plugin, q, this.viewMode);
      const shown = Math.max(limit, this.searchLimit || 0);
      if (this.searchCountEl) this.searchCountEl.textContent = searchSummaryText(this.plugin, results.length, Math.min(shown, results.length));
      let lastName = null;
      for (const hit of results) {
        if (rendered >= shown) break;
        const name = tabName(this.plugin, hit.group) + groupSourceSuffix(this.plugin, hit.group);
        if (name !== lastName) {
          this.listEl.createDiv({ cls: "fl-section-label" }).textContent = name;
          lastName = name;
        }
        this.listEl.appendChild(this.makeItem(hit.item));
        rendered++;
      }
      if (results.length > rendered) {
        const more = this.listEl.createEl("button", { cls: "fl-btn fl-load-more", text: searchMoreText(this.plugin, results.length - rendered) });
        more.addEventListener("click", () => { this.searchLimit = rendered + limit; this.renderList(); });
      }
    } else if (this.viewMode !== "all") {
      for (const g of FORMULA_DATA.GROUPS) {
        const hits = g.items.filter(i => !i.section && formulaMatchesView(this.plugin, i, this.viewMode));
        if (!hits.length) continue;
        const sorted = sortByUsage(this.plugin, hits);
        this.listEl.createDiv({ cls: "fl-section-label" }).textContent = tabName(this.plugin, g);
        for (const item of sorted) {
          if (rendered >= limit) break;
          this.listEl.appendChild(this.makeItem(item));
          rendered++;
        }
        if (rendered >= limit) break;
      }
    } else if (this.currentGroup) {
      let section = null;
      let bucket = [];
      const flush = () => {
        const visible = sortByUsage(this.plugin, bucket.filter((item) => formulaMatchesView(this.plugin, item, "all")));
        if (visible.length && section) this.listEl.createDiv({ cls: "fl-section-label" }).textContent = section;
        for (const item of visible) {
          this.listEl.appendChild(this.makeItem(item));
          rendered++;
        }
        bucket = [];
      };
      for (const item of this.currentGroup.items) {
        if (item.section) {
          flush();
          section = loc(this.plugin) === "zh" ? item.section : item.sectionEn;
        } else bucket.push(item);
      }
      flush();
    }
    if (rendered === 0) {
      this.listEl.createDiv({ cls: "fl-empty-state", text: ui(this.plugin, "noResults") });
    }
  }

  makeItem(i) {
    const label = itemLabel(this.plugin, i);
    const cnt = getUsageCount(this.plugin, i[1]);
    const b = document.createElement("button");
    b.className = "fl-list-item";

    const row = b.createDiv({ cls: "fl-list-item-row" });

    const star = row.createEl("span", { cls: "fl-fav-star", attr: { role: "button", tabindex: "0", "aria-label": ui(this.plugin, "favorites") } });
    obsidian.setIcon(star, "star");
    keyboardButton(star);
    star.toggleClass("active", isFavorite(this.plugin, i[1]));
    star.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleFavorite(this.plugin, i[1]);
      this.renderList();
    });

    const info = row.createDiv({ cls: "fl-list-item-info" });
    info.createEl("span", { cls: "fl-list-item-symbol", text: label });
    if (this.plugin.settings.showLatexLabels !== false) info.createEl("span", { cls: "fl-list-item-latex", text: i[1] });
    const itemTagList = itemTags(i);
    if (itemTagList.length) info.createEl("span", { cls: "fl-list-item-tags", text: formatTags(itemTagList) });

    if (isPinned(this.plugin, i[1])) {
      const pin = row.createEl("span", { cls: "fl-item-pin", attr: { title: ui(this.plugin, "pinned") } });
      obsidian.setIcon(pin, "pin");
    }

    if (cnt > 0) {
      row.createEl("span", { cls: "fl-usage-badge", text: cnt >= 100 ? "99+" : String(cnt) });
    }

    const menuButton = row.createEl("span", { cls: "fl-item-menu", attr: { role: "button", tabindex: "0", "aria-label": loc(this.plugin) === "zh" ? "公式操作" : "Formula actions" } });
    obsidian.setIcon(menuButton, "more-horizontal");
    keyboardButton(menuButton);
    menuButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openFormulaMenu(this.plugin, i, event, () => this.renderList());
    });

    b.title = [i[2], i[1], itemNote(i)].filter(Boolean).join("\n");
    b.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      openFormulaMenu(this.plugin, i, event, () => this.renderList());
    });
    b.addEventListener("click", (e) => {
      e.preventDefault();
      trackUsage(this.plugin, i[1]);
      let ed = this.plugin.findMarkdownEditor();
      if (!ed) { logErr("Sidebar: no editor"); new obsidian.Notice(ui(this.plugin, "noEditor")); return; }
      const fmt = this.plugin.settings.insertFormat || "display";
      const w = fmt === "inline" ? "$" : "$$";
      const cur = ed.getCursor(), t = w + i[1] + w;
      ed.replaceRange(t, cur);
      const ph = i[1].indexOf("#?");
      if (ph >= 0) {
        const pos = { line: cur.line, ch: cur.ch + w.length + ph };
        ed.setSelection(pos, { line: pos.line, ch: pos.ch + 2 });
      } else {
        ed.setCursor({ line: cur.line, ch: cur.ch + t.length });
      }
      ed.focus();
      this.renderList();
    });
    return b;
  }

  async onClose() { log("Sidebar onClose"); }
}

export { SidebarView };
