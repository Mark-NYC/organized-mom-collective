/** Default printable-tool palettes. Keep paper white and text warm charcoal. */
export const toolPalettes = {
  'rose-lavender': { label: 'Rose & Lavender', colors: ['#FBE9E8', '#EAE3F3', '#F8E3D6'] },
  'blue-green': { label: 'Blue & Green', colors: ['#DFECF5', '#E6EEEA', '#FFF0C9'] },
  'warm-neutrals': { label: 'Warm Neutrals', colors: ['#EFEBE7', '#E6EEEA', '#F6F1E7'] },
} as const;
export type ToolPaletteId = keyof typeof toolPalettes;
export const defaultToolPalette: ToolPaletteId = 'warm-neutrals';
export function resolveToolPalette(value: string): ToolPaletteId {
  return Object.hasOwn(toolPalettes, value) ? value as ToolPaletteId : defaultToolPalette;
}
