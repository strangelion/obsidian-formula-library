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
    if (!modal._closed) modal.onActionSettled?.();
  }
}

// A nested role=button must not activate its enclosing formula card.
function keyboardButton(control) {
  control.addEventListener("keydown", (event) => {
    if (!event.isComposing && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault(); event.stopPropagation(); control.click();
    }
  });
  control.addEventListener("keyup", (event) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); }
  });
}

function wireSearchNavigation(input, list, selector) {
  let active = -1;
  const reset = () => {
    active = -1;
    list.querySelectorAll(".fl-keyboard-active").forEach((el) => el.classList.remove("fl-keyboard-active"));
  };
  input.addEventListener("input", reset);
  input.addEventListener("keydown", (event) => {
    if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const items = [...list.querySelectorAll(selector)];
    if (!items.length) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      active = Math.max(0, Math.min(items.length - 1, active + (event.key === "ArrowDown" ? 1 : -1)));
      items.forEach((el, index) => el.classList.toggle("fl-keyboard-active", index === active));
      items[active].scrollIntoView({ block: "nearest" });
      input.setAttribute("aria-label", (input.placeholder || "Search") + " — " + (items[active].title || items[active].textContent));
    } else if (event.key === "Enter" && input.value.trim()) {
      event.preventDefault(); items[Math.min(Math.max(active, 0), items.length - 1)].click(); reset();
    } else if (event.key === "Escape" && active >= 0) { event.preventDefault(); event.stopPropagation(); reset(); }
  });
  return reset;
}

export { labelControl, runModalAction, keyboardButton, wireSearchNavigation };
