import * as obsidian from "obsidian";
import { log, loc, ui, groupDisplayName, FORMULA_INDEX, normalizeFolderPath } from "./core.js";
import { customFolderFor, ImportFormulasModal, ExportFormulasModal, CustomFormulasModal } from "./custom-library.js";
import { LIBRARY_FONT_MIN, LIBRARY_FONT_MAX, normalizeLibraryFontSize } from "./typography.js";

// ======================== Settings Tab ========================
class FormulaLibrarySettingTab extends obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  async display() {
    const { containerEl } = this;
    containerEl.empty();
    const p = this.plugin;
    containerEl.createEl("h2", { text: ui(p, "settingsTitle") });

    new obsidian.Setting(containerEl)
      .setName(ui(p, "language"))
      .setDesc(ui(p, "languageDesc"))
      .addDropdown((d) => d
        .addOption("auto", "Auto")
        .addOption("zh", "中文")
        .addOption("en", "English")
        .setValue(p.settings.locale)
        .onChange(async (v) => { p.settings.locale = v; await p.saveSettings(); p.refreshViews(); this.display(); }));

    new obsidian.Setting(containerEl)
      .setName(ui(p, "insertFormat"))
      .setDesc(ui(p, "insertFormatDesc"))
      .addDropdown((d) => d
        .addOption("display", "$$...$$")
        .addOption("inline", "$...$")
        .setValue(p.settings.insertFormat)
        .onChange(async (v) => { p.settings.insertFormat = v; await p.saveSettings(); }));

    new obsidian.Setting(containerEl)
      .setName(ui(p, "defaultMode"))
      .setDesc(ui(p, "defaultModeDesc"))
      .addDropdown((d) => d
        .addOption("visual", "Visual (MathLive)")
        .addOption("source", "Source (LaTeX)")
        .setValue(p.settings.defaultEditorMode)
        .onChange(async (v) => { p.settings.defaultEditorMode = v; await p.saveSettings(); }));

    new obsidian.Setting(containerEl)
      .setName(ui(p, "mathliveKbd"))
      .setDesc(ui(p, "mathliveKbdDesc"))
      .addToggle((t) => t
        .setValue(p.settings.mathliveKeyboard)
        .onChange(async (v) => { p.settings.mathliveKeyboard = v; await p.saveSettings(); p.refreshViews(); }));

    new obsidian.Setting(containerEl)
      .setName(ui(p, "formulasFolder"))
      .setDesc(ui(p, "formulasFolderDesc"))
      .addText((t) => t
        .setPlaceholder("formulas")
        .setValue(p.settings.formulasPath)
        .onChange(async (v) => { p.settings.formulasPath = v; await p.saveSettings(); p.debouncedReload(); }));

    new obsidian.Setting(containerEl)
      .setName(ui(p, "fontSize"))
      .setDesc(ui(p, "fontSizeDesc"))
      .addSlider((s) => s
        .setLimits(12, 40, 1)
        .setValue(p.settings.previewFontSize)
        .setDynamicTooltip()
        .onChange(async (v) => { p.settings.previewFontSize = v; await p.saveSettings(); p.refreshViews(); }));

    let libraryFontSlider;
    new obsidian.Setting(containerEl)
      .setName(ui(p, "libraryFontFollow"))
      .setDesc(ui(p, "libraryFontFollowDesc"))
      .addToggle((toggle) => toggle
        .setValue(p.settings.libraryFontFollowObsidian !== false)
        .onChange(async (value) => {
          p.settings.libraryFontFollowObsidian = value;
          libraryFontSlider?.setDisabled(value);
          await p.saveSettings();
          p.refreshViews();
        }));

    new obsidian.Setting(containerEl)
      .setName(ui(p, "libraryFontSize"))
      .setDesc(ui(p, "libraryFontSizeDesc"))
      .addSlider((slider) => {
        libraryFontSlider = slider;
        slider.sliderEl.setAttribute("aria-label", ui(p, "libraryFontSize"));
        return slider.setLimits(LIBRARY_FONT_MIN, LIBRARY_FONT_MAX, 1)
          .setValue(normalizeLibraryFontSize(p.settings.libraryFontSize))
          .setDisabled(p.settings.libraryFontFollowObsidian !== false)
          .setDynamicTooltip()
          .onChange(async (value) => {
            p.settings.libraryFontSize = normalizeLibraryFontSize(value);
            await p.saveSettings();
            p.refreshViews();
          });
      });

    new obsidian.Setting(containerEl)
      .setName(ui(p, "fontStyle"))
      .setDesc(ui(p, "fontStyleDesc"))
      .addDropdown((d) => d
        .addOption("italic", "Italic")
        .addOption("upright", "Upright")
        .setValue(p.settings.mathFontStyle)
        .onChange(async (v) => { p.settings.mathFontStyle = v; await p.saveSettings(); p.refreshViews(); }));

    new obsidian.Setting(containerEl)
      .setName(ui(p, "fontFamily"))
      .setDesc(ui(p, "fontFamilyDesc"))
      .addText((t) => t
        .setPlaceholder("KaTeX")
        .setValue(p.settings.mathFontFamily)
        .onChange(async (v) => { p.settings.mathFontFamily = v; await p.saveSettings(); p.refreshViews(); }));

    new obsidian.Setting(containerEl)
      .setName(ui(p, "density"))
      .setDesc(ui(p, "densityDesc"))
      .addDropdown((d) => d
        .addOption("compact", loc(p) === "zh" ? "紧凑" : "Compact")
        .addOption("comfortable", loc(p) === "zh" ? "舒适" : "Comfortable")
        .addOption("spacious", loc(p) === "zh" ? "宽松" : "Spacious")
        .setValue(p.settings.libraryDensity || "comfortable")
        .onChange(async (v) => { p.settings.libraryDensity = v; await p.saveSettings(); p.refreshViews(); }));

    new obsidian.Setting(containerEl)
      .setName(ui(p, "sortMode"))
      .setDesc(ui(p, "sortModeDesc"))
      .addDropdown((d) => d
        .addOption("smart", loc(p) === "zh" ? "智能" : "Smart")
        .addOption("usage", loc(p) === "zh" ? "使用次数" : "Usage")
        .addOption("recent", loc(p) === "zh" ? "最近使用" : "Recent")
        .addOption("alphabetical", loc(p) === "zh" ? "名称" : "Name")
        .setValue(p.settings.librarySort || "smart")
        .onChange(async (v) => { p.settings.librarySort = v; await p.saveSettings(); p.refreshViews(); }));

    new obsidian.Setting(containerEl)
      .setName(ui(p, "resultLimit"))
      .setDesc(ui(p, "resultLimitDesc"))
      .addDropdown((d) => d
        .addOption("80", "80")
        .addOption("160", "160")
        .addOption("320", "320")
        .setValue(String(p.settings.searchResultLimit || 160))
        .onChange(async (v) => { p.settings.searchResultLimit = Number(v); await p.saveSettings(); p.refreshViews(); }));

    new obsidian.Setting(containerEl)
      .setName(ui(p, "showLatexLabels"))
      .setDesc(ui(p, "showLatexLabelsDesc"))
      .addToggle((t) => t
        .setValue(p.settings.showLatexLabels !== false)
        .onChange(async (v) => { p.settings.showLatexLabels = v; await p.saveSettings(); p.refreshViews(); }));

    new obsidian.Setting(containerEl)
      .setName(ui(p, "resetHidden"))
      .setDesc(ui(p, "resetHiddenDesc"))
      .addButton((button) => button
        .setButtonText(loc(p) === "zh" ? "全部恢复" : "Restore all")
        .onClick(async () => {
          p.settings.hiddenFormulas = [];
          await p.saveSettings();
          p.refreshViews();
          new obsidian.Notice(loc(p) === "zh" ? "已恢复全部隐藏公式" : "All hidden formulas restored");
        }));

    containerEl.createEl("h3", { text: ui(p, "shortcuts") });
    containerEl.createEl("p", { text: ui(p, "shortcutsDesc"), cls: "setting-item-description" });

    const sc = p.settings.shortcuts || {};
    const shortcutDefs = [
      { key: "fraction", label: ui(p, "shortcutFraction"), placeholder: "e.g. ctrl+f" },
      { key: "sqrt", label: ui(p, "shortcutSqrt"), placeholder: "e.g. ctrl+r" },
      { key: "superscript", label: ui(p, "shortcutSuper"), placeholder: "e.g. ctrl+h" },
      { key: "subscript", label: ui(p, "shortcutSub"), placeholder: "e.g. ctrl+l" },
      { key: "subSuper", label: ui(p, "shortcutSubSuper"), placeholder: "e.g. ctrl+j" },
    ];

    for (const def of shortcutDefs) {
      new obsidian.Setting(containerEl)
        .setName(def.label)
        .setDesc(sc[def.key] || (loc(p) === "zh" ? "未绑定" : "Unbound"))
        .addText((t) => t
          .setPlaceholder(def.placeholder)
          .setValue(sc[def.key] || "")
          .onChange(async (v) => {
            p.settings.shortcuts[def.key] = v.trim();
            await p.saveSettings();
          }));
    }

    await this.renderGroupToggles(containerEl);
  }

  async renderGroupToggles(containerEl) {
    const p = this.plugin;
    const zh = loc(p) === "zh";
    containerEl.createEl("h3", { text: ui(p, "libraryTitle") });
    containerEl.createEl("p", { text: ui(p, "libraryDesc"), cls: "setting-item-description" });

    const statusEl = containerEl.createDiv({ cls: "fl-library-status" });
    const paintStatus = () => {
      statusEl.empty();
      const builtinEnabled = p.settings.builtinLibraryEnabled !== false;
      const builtinMap = p.settings.enabledGroups || {};
      const customMap = p.settings.customEnabledGroups || {};
      const on = (list, map) => list.filter((m) => map[m.id] !== false);
      const total = (list) => list.reduce((sum, m) => sum + m.count, 0);
      const origin = FORMULA_INDEX.origin === "folder"
        ? (zh ? "公式文件夹 " : "formulas folder ") + (FORMULA_INDEX.folder || "")
        : FORMULA_INDEX.origin === "bundled"
          ? (zh ? "插件内置（无 formulas 文件夹）" : "embedded in plugin (no formulas folder)")
          : (zh ? "无" : "none");

      statusEl.createEl("div", { text: (zh ? "内置来源：" : "Built-in source: ") + origin });
      statusEl.createEl("div", {
        text: (zh ? "内置分类：" : "Built-in groups: ")
          + (builtinEnabled
            ? on(FORMULA_INDEX.builtin, builtinMap).length + "/" + FORMULA_INDEX.builtin.length + " · " + (zh ? "公式 " : "formulas ") + total(on(FORMULA_INDEX.builtin, builtinMap))
            : (zh ? "总开关已关闭" : "master switch off")),
      });
      statusEl.createEl("div", {
        text: FORMULA_INDEX.customFolder
          ? (zh ? "自定义：" : "Custom: ") + FORMULA_INDEX.customFolder + " · " + on(FORMULA_INDEX.custom, customMap).length + "/" + FORMULA_INDEX.custom.length + " · " + (zh ? "公式 " : "formulas ") + total(on(FORMULA_INDEX.custom, customMap))
          : (zh ? "自定义：未设置" : "Custom: not set"),
      });
      if (FORMULA_INDEX.errors.length) {
        statusEl.createEl("div", { text: (zh ? "加载错误：" : "Load errors: ") + FORMULA_INDEX.errors.length, cls: "fl-library-error" });
        for (const err of FORMULA_INDEX.errors.slice(0, 8)) {
          statusEl.createEl("div", { text: err, cls: "fl-library-error" });
        }
      }
    };
    paintStatus();

    new obsidian.Setting(containerEl)
      .setName(ui(p, "builtinLibrary"))
      .setDesc(ui(p, "builtinLibraryDesc"))
      .addToggle((t) => t
        .setValue(p.settings.builtinLibraryEnabled !== false)
        .onChange(async (v) => {
          p.settings.builtinLibraryEnabled = v;
          await p.saveSettings();
          await p.reloadFormulas();
          paintStatus();
        }));

    new obsidian.Setting(containerEl)
      .setName(ui(p, "refreshBtn"))
      .setDesc(ui(p, "refreshDesc"))
      .addButton((btn) => btn
        .setButtonText(ui(p, "refreshBtn"))
        .setCta()
        .onClick(async () => {
          await p.reloadFormulas();
          this.display();
        }));

    const renderGroupList = (metas, settingsKey) => {
      const map = p.settings[settingsKey] || (p.settings[settingsKey] = {});
      for (const meta of metas) {
        new obsidian.Setting(containerEl)
          .setName(groupDisplayName(p, meta.id) + " (" + meta.count + ")")
          .setDesc(meta.file + " · " + meta.id)
          .addToggle((t) => t
            .setValue(map[meta.id] !== false)
            .onChange(async (v) => {
              log("Toggle " + meta.id + " → " + v);
              map[meta.id] = v;
              await p.saveSettings();
              await p.reloadFormulas();
              paintStatus();
            }));
      }
    };

    containerEl.createEl("h4", { text: ui(p, "groupsTitle") });
    containerEl.createEl("p", { text: ui(p, "groupsDesc"), cls: "setting-item-description" });

    if (!FORMULA_INDEX.builtin.length) {
      containerEl.createEl("p", { text: ui(p, "groupsEmpty"), cls: "setting-item-description" });
    } else {
      new obsidian.Setting(containerEl)
        .setName(ui(p, "enableAllGroups"))
        .setDesc(ui(p, "enableAllGroupsDesc"))
        .addButton((btn) => btn
          .setButtonText(ui(p, "enableAll"))
          .onClick(async () => { await this.setAllGroups("enabledGroups", true); }))
        .addButton((btn) => btn
          .setButtonText(ui(p, "disableAll"))
          .onClick(async () => { await this.setAllGroups("enabledGroups", false); }));

      renderGroupList(FORMULA_INDEX.builtin, "enabledGroups");
    }

    containerEl.createEl("h4", { text: ui(p, "customLibrary") });
    containerEl.createEl("p", { text: ui(p, "customLibraryDesc"), cls: "setting-item-description" });

    new obsidian.Setting(containerEl)
      .setName(ui(p, "customPath"))
      .setDesc(ui(p, "customPathDesc"))
      .addText((t) => t
        .setPlaceholder("my-formulas")
        .setValue(p.settings.customFormulasPath || "")
        .onChange(async (v) => {
          p.settings.customFormulasPath = normalizeFolderPath(v);
          await p.saveSettings();
          p.debouncedReload();
        }))
      .addButton((btn) => btn
        .setButtonText(ui(p, "refreshBtn"))
        .onClick(async () => {
          await p.reloadFormulas();
          this.display();
        }));

    new obsidian.Setting(containerEl)
      .setName(ui(p, "customManage"))
      .setDesc(ui(p, "customManageDesc"))
      .addButton((btn) => btn
        .setButtonText(ui(p, "customManage"))
        .setCta()
        .onClick(() => { this.openCustomManager(); }))
      .addButton((btn) => btn
        .setButtonText(ui(p, "customImport"))
        .onClick(() => { this.openCustomImport(); }))
      .addButton((btn) => btn
        .setButtonText(ui(p, "customExport"))
        .onClick(() => { new ExportFormulasModal(this.app, p, null).open(); }));

    if (!FORMULA_INDEX.custom.length) {
      containerEl.createEl("p", { text: ui(p, "customEmpty"), cls: "setting-item-description" });
    } else {
      renderGroupList(FORMULA_INDEX.custom, "customEnabledGroups");
    }
  }

  // The manager needs a folder: without one there is nowhere to write.
  customFolderReady() {
    if (customFolderFor(this.plugin)) return true;
    new obsidian.Notice(ui(this.plugin, "customPathDesc"));
    return false;
  }

  async openCustomManager() {
    if (!this.customFolderReady()) return;
    await this.plugin.reloadFormulas();
    new CustomFormulasModal(this.app, this.plugin, () => { this.display(); }).open();
  }

  async openCustomImport() {
    if (!this.customFolderReady()) return;
    await this.plugin.reloadFormulas();
    new ImportFormulasModal(this.app, this.plugin, () => { this.display(); }).open();
  }

  async setAllGroups(settingsKey, value) {
    const p = this.plugin;
    const metas = settingsKey === "customEnabledGroups" ? FORMULA_INDEX.custom : FORMULA_INDEX.builtin;
    const map = p.settings[settingsKey] || (p.settings[settingsKey] = {});
    for (const meta of metas) map[meta.id] = value;
    await p.saveSettings();
    await p.reloadFormulas();
    this.display();
  }
}

export { FormulaLibrarySettingTab };
