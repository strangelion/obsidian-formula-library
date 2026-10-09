// Only library typography is controlled here. MathLive's editing font remains
// independent, and host font changes propagate through --font-text-size.
const LIBRARY_FONT_MIN = 14;
const LIBRARY_FONT_MAX = 32;
const LIBRARY_FONT_DEFAULT = 18;

function normalizeLibraryFontSize(value) {
  if (value === "" || value === null || typeof value === "boolean") return LIBRARY_FONT_DEFAULT;
  const size = Number(value);
  if (!Number.isFinite(size)) return LIBRARY_FONT_DEFAULT;
  return Math.min(LIBRARY_FONT_MAX, Math.max(LIBRARY_FONT_MIN, Math.round(size)));
}

function applyLibraryTypography(root, settings) {
  if (!root) return;
  root.dataset.density = ["compact", "comfortable", "spacious"].includes(settings.libraryDensity) ? settings.libraryDensity : "comfortable";
  if (settings.libraryFontFollowObsidian !== false) {
    root.style.removeProperty("--fl-library-font-size");
  } else {
    root.style.setProperty("--fl-library-font-size", normalizeLibraryFontSize(settings.libraryFontSize) + "px");
  }
}

export { LIBRARY_FONT_MIN, LIBRARY_FONT_MAX, LIBRARY_FONT_DEFAULT, normalizeLibraryFontSize, applyLibraryTypography };
