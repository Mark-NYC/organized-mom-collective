/** "Choose your colors": the three shared tool palettes (docs/brand/TOOL-OUTPUT-DESIGN.md), swatches with an underline on the choice. */
import { toolPalettes, type ToolPaletteId } from '../../data/tool-palettes';

export default function PalettePicker({ value, onChange, disabled }: { value: ToolPaletteId; onChange: (p: ToolPaletteId) => void; disabled?: boolean }) {
  return (
    <div role="group" aria-label="Choose your colors" className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <span className="text-[0.85rem] font-semibold text-warm-ink">Choose your colors</span>
      {(Object.keys(toolPalettes) as ToolPaletteId[]).map((id) => (
        <button
          key={id}
          type="button"
          disabled={disabled}
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          className="inline-flex min-h-11 items-center gap-2 text-[0.88rem] text-warm-soft aria-pressed:text-warm-ink aria-pressed:underline aria-pressed:underline-offset-[6px] focus-visible:outline-2 focus-visible:outline-warm-ink"
        >
          <span className="flex" aria-hidden="true">
            {toolPalettes[id].colors.map((c) => <span key={c} className="-mr-1 h-4 w-4 rounded-full ring-2 ring-white" style={{ background: c }} />)}
          </span>
          {toolPalettes[id].label}
        </button>
      ))}
    </div>
  );
}
