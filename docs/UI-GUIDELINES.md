# UI acceptance rules

These rules apply the useful form, state, and responsive requirements from
`design-taste-frontend-v1` to the existing native Obsidian plugin architecture.

- Keep native Obsidian theme variables and icons. Do not add a framework to move controls.
- Separate primary actions from auxiliary tools. Keep insert/cancel reachable while content scrolls.
- Put descriptive labels above fields and provide accessible names for inputs and icon buttons.
- Use 36–38 px controls on desktop and at least 40 px targets on narrow/touch layouts.
- Formula choices follow the host text size by default, with a separately adjustable library font. Avoid fixed tiny labels; verify open-view updates and wrapping at 18–32 px.
- Keep search, filters, categories and footers out of flex compression. Only results/editing areas scroll.
- At narrow widths, use one column and contained scrolling rather than hiding overflowing content.
- Leave padding around scrolling form edges and draw focus indicators inward.
- Do not reset MathJax's internal box model. Long equations must be scrollable from their first symbol.
- A chart has one coordinate grid. Mermaid's decorative canvas background does not belong behind plots.
- Zoom acceptance checks must measure the displayed SVG, not just the percentage text.
- Undo snapshots must restore source, template type and editing mode together; validate compatibility before rebuilding a visual form.
- Preview a draft formula independently of its metadata validation. Separate preview headings from parameter controls.
- Provide visible empty, validation-error, loading and async-save states; prevent duplicate submissions.
- Test every nested dialog in desktop and portrait layouts, including long labels, matrices, lower/upper
  limits, saved categories, disabled libraries, and re-rendered diagrams. Inspect screenshots as well
  as element geometry, and distinguish other installed plugins' errors from this plugin's errors.
- Do not mark a release ready until data regressions and native Obsidian interactions have passed.
