# Tool output design

Owner direction, October 13, 2026: use the lunch and snack station as the visual reference for future printable tool outputs. Handwritten Kalam headings, white paper, warm charcoal text, soft highlighter swipes, rounded outlines and simple line details. Fun for children and pleasing on the family fridge.

## Default color choices
Use the shared palette source in `src/data/tool-palettes.ts`:
- Rose & Lavender: blush, lavender, peach.
- Blue & Green: sky blue, sage, butter yellow.
- Warm Neutrals: sand, muted sage, cream. Default selection.

Label options by color names, not gender. Place three swatch buttons above the output with “Choose your colors.” Use accessible buttons with aria-pressed and visible keyboard focus. Keep text charcoal and paper white; swap accents only. Save the selected palette with the tool’s existing browser state; downloads must inherit the palette. Invalid or missing stored selections fall back to Warm Neutrals. Clearing content keeps the chosen palette.

Implemented on the chore chart. Apply to new tools and future redesigns; existing tools have not all been migrated. Keep dense charts readable rather than forcing icons into every cell. Preserve output dimensions and existing download/edit behavior.

## Controls around the output

Owner direction October 13: use restrained editorial controls, not rows of outlined cards or pills. Routine types are text tabs with an underline on the selected choice. Palette choices show swatches and text with an underline on selection, not boxed buttons. One solid primary download button; reset is a plain underlined action. Suggested steps are simple text links. Keep 44–48px hit targets and visible keyboard focus. The printable itself retains the playful typography and soft colors.
