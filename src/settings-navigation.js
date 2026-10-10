let navigationSequence = 0;
export const SETTINGS_SECTIONS = Object.freeze([
  { id: "general", zh: "常规", en: "General" },
  { id: "appearance", zh: "界面", en: "Appearance" },
  { id: "tools", zh: "工具", en: "Tools" },
  { id: "library", zh: "公式库", en: "Libraries" },
  { id: "backup", zh: "备份", en: "Backups" },
]);

export function createSettingsNavigation(container, { locale, active = "general", onSelect = () => {} }) {
  const prefix = `formula-settings-${++navigationSequence}`;
  const nav = container.createDiv({ cls: "fl-settings-nav", attr: { role: "tablist", "aria-label": locale === "zh" ? "设置分类" : "Settings sections" } });
  const panels = {}, buttons = new Map();
  const select = (id, focus = false) => {
    if (!panels[id]) return;
    for (const [key, button] of buttons) {
      const selected = key === id;
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
      panels[key].hidden = !selected;
    }
    onSelect(id);
    if (focus) buttons.get(id).focus();
  };
  for (const section of SETTINGS_SECTIONS) {
    const button = nav.createEl("button", { text: section[locale] || section.en, attr: { type: "button", role: "tab",
      id: `${prefix}-tab-${section.id}`, "aria-controls": `${prefix}-panel-${section.id}` } });
    buttons.set(section.id, button);
    panels[section.id] = container.createDiv({ cls: "fl-settings-panel", attr: { role: "tabpanel",
      id: `${prefix}-panel-${section.id}`, "aria-labelledby": button.id } });
    panels[section.id].dataset.settingsSection = section.id;
    button.addEventListener("click", () => select(section.id));
    button.addEventListener("keydown", (event) => {
      const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
      if (!keys.includes(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      const index = SETTINGS_SECTIONS.findIndex(({ id }) => id === section.id);
      const next = event.key === "Home" ? 0 : event.key === "End" ? SETTINGS_SECTIONS.length - 1
        : (index + (event.key === "ArrowRight" ? 1 : -1) + SETTINGS_SECTIONS.length) % SETTINGS_SECTIONS.length;
      select(SETTINGS_SECTIONS[next].id, true);
    });
  }
  select(buttons.has(active) ? active : "general");
  return panels;
}
