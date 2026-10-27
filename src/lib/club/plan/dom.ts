/** A small element builder for the plan screens: properties are assigned, `class` sets className. */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] {
  const { class: cls, ...rest } = props;
  const node = Object.assign(document.createElement(tag), rest) as HTMLElementTagNameMap[K];
  if (typeof cls === 'string') node.className = cls;
  node.append(...kids);
  return node;
}
