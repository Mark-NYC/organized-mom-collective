/** Table of contents for resource articles. Pure, so it's unit-tested (tests/toc.test.ts). */
/**
 * The article's sections in reading order: Markdown `##` headings plus the
 * branded sections that render their own h2 (The Real-Life Version, When Life
 * Happens). Read from the MDX source, so components need a plain string `title`
 * (and an `id` if they override the default).
 */
export function tableOfContents(body: string, headings: { depth: number; slug: string; text: string }[]) {
  const h2 = headings.filter((h) => h.depth === 2);
  const defaults: Record<string, string> = { RealLifeVersion: 'the-real-life-version', WhenLifeHappens: 'when-life-happens' };
  const toc: { slug: string; text: string }[] = [];
  let i = 0;
  let inFence = false;
  for (const line of body.split('\n')) {
    if (line.startsWith('```')) inFence = !inFence;
    if (inFence) continue;
    if (/^## /.test(line)) {
      const h = h2[i++];
      if (h) toc.push({ slug: h.slug, text: h.text });
      continue;
    }
    const m = line.match(/^<(RealLifeVersion|WhenLifeHappens)\b(.*)/);
    if (m) {
      const title = m[2].match(/title=(?:"([^"]*)"|'([^']*)')/);
      const id = m[2].match(/id=(?:"([^"]*)"|'([^']*)')/);
      toc.push({
        slug: (id?.[1] ?? id?.[2] ?? defaults[m[1]]) as string,
        text: title?.[1] ?? title?.[2] ?? (m[1] === 'WhenLifeHappens' ? 'When life happens' : 'The Real-Life Version'),
      });
    }
  }
  return toc;
}
