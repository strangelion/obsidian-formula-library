// Shared interaction rules for native Obsidian controls.
function labelControl(control, text) {
  control.setAttribute("aria-label", text);
  const parent = control.parentElement;
  if (!parent) return;
  const label = document.createElement("label");
  label.className = "fl-control-field";
  const caption = document.createElement("span");
  caption.textContent = text;
  parent.insertBefore(label, control);
  label.append(caption, control);
}

async function runModalAction(modal, action) {
  if (modal._actionPending) return;
  modal._actionPending = true;
  const buttons = Array.from(modal.contentEl.querySelectorAll("button"));
  const states = buttons.map((button) => button.disabled);
  buttons.forEach((button) => { button.disabled = true; });
  modal.contentEl.setAttribute("aria-busy", "true");
  try {
    await action();
  } catch (error) {
    const status = modal.errorEl || modal.statusEl;
    if (status) {
      status.setAttribute("role", "alert");
      status.setText(error instanceof Error ? error.message : String(error));
    }
  } finally {
    buttons.forEach((button, index) => { button.disabled = states[index]; });
    modal.contentEl.removeAttribute("aria-busy");
    modal._actionPending = false;
  }
}

export { labelControl, runModalAction };
