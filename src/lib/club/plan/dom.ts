/**
 * A small element builder for the plan screens: properties are assigned, `class` sets className, and `aria-*` / `data-*`
 * keys are set as attributes (as properties they would do nothing: no label for a screen reader, nothing hidden).
 */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] {
  const { class: cls, ...all } = props;
  const rest: Record<string, unknown> = {};
  const attrs: [string, string][] = [];
  for (const [k, v] of Object.entries(all)) {
    if (/^(aria|data)-/.test(k)) { if (v !== undefined && v !== null && v !== false) attrs.push([k, String(v)]); } else rest[k] = v;
  }
  const node = Object.assign(document.createElement(tag), rest) as HTMLElementTagNameMap[K];
  for (const [k, v] of attrs) node.setAttribute(k, v);
  if (typeof cls === 'string') node.className = cls;
  node.append(...kids);
  return node;
}
