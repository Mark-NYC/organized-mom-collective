/**
 * A stable 32-bit FNV-1a hash for tie-breaks. Same text, same number, on every device and every run, so two
 * equally good owners are always chosen the same way for the same family (never Math.random).
 */
export function stableHash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
