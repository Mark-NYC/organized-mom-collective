/**
 * Entry-source hook for later analytics. /start sends calendar owners to
 * /app?source=calendar; the app records the source for this session and
 * removes the parameter from the address bar.
 */

const VALID = /^[a-z0-9-]{1,32}$/;

/** Splits ?source=… out of a path (+query/hash). Other params (e.g. ?day=) are kept. */
export function takeSourceParam(pathWithQuery: string): { source: string | null; cleaned: string } {
  const url = new URL(pathWithQuery, 'https://x.invalid');
  const raw = url.searchParams.get('source');
  if (raw === null) return { source: null, cleaned: pathWithQuery };
  url.searchParams.delete('source');
  const source = VALID.test(raw.toLowerCase()) ? raw.toLowerCase() : null;
  return { source, cleaned: url.pathname + url.search + url.hash };
}
