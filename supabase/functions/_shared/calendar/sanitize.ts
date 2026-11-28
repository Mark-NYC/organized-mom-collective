/**
 * Sanitize an imported event description before it is stored (docs/intelligence/STAGE_B_REPORT.md → Descriptions).
 *
 * Imported text is untrusted: it comes from schools, teams, other people's calendars. We keep at most 280 characters of
 * what helps understand the event ("Bring a packed lunch", "Wear the blue jersey") and remove what identifies or
 * routes people: links, emails, phone numbers, video-meeting join details and passcodes, street addresses, and markup.
 * The result is stored only. It is never shown back as instructions, never sent to an AI provider automatically, and
 * whatever it says can never become an action (the engine's outputs are closed vocabularies validated by code).
 *
 * Plain TypeScript (no Deno APIs) so the importers, the engine and the unit tests share one implementation.
 */
export const DESCRIPTION_MAX = 280;

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

export function sanitizeDescription(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = String(raw).slice(0, 8000);
  // markup → text
  s = s.replace(/<(br|p|div|li)\b[^>]*>/gi, '\n').replace(/<[^>]*>/g, ' ');
  s = s.replace(/&(#?\w+);/g, (m, e: string) => ENTITIES[e.toLowerCase()] ?? (/^#\d+$/.test(e) ? String.fromCharCode(Number(e.slice(1))) : ' '));
  // video-meeting boilerplate: whole lines about joining, dialing in, passcodes or meeting ids
  s = s.split(/\r?\n/).filter((line) => !/(join (the )?(zoom|teams|meet|webex|meeting)|zoom\.us|teams\.microsoft|meet\.google|webex|dial[- ]?in|one tap mobile|passcode|password|meeting id|conference id|pin:|-{4,}|_{4,}|::)/i.test(line)).join('\n');
  // contacts and routes
  s = s.replace(/https?:\/\/\S+|www\.\S+/gi, ' ')
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, ' ')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, ' ')
    .replace(/\b\d{1,6}\s+(?:[A-Z][a-z]+\s+){1,4}(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Dr|Drive|Ln|Lane|Way|Ct|Court|Pl|Place|Pkwy|Hwy)\b\.?/g, ' ')
    .replace(/\b\d{5}(?:-\d{4})?\b/g, ' ');
  // control characters, then whitespace
  s = s.replace(/[\u0000-\u0008\u000B-\u001F\u007F​-‏‪-‮⁦-⁩]/g, ' ').replace(/\s+/g, ' ').trim();
  if (s.length < 3) return null;
  if (s.length > DESCRIPTION_MAX) {
    const cut = s.slice(0, DESCRIPTION_MAX);
    const word = cut.lastIndexOf(' ');
    s = (word > DESCRIPTION_MAX * 0.6 ? cut.slice(0, word) : cut).trim();
  }
  return s;
}
