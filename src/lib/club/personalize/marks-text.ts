/** Cue text rules, shared by the pure engines and the marks (./marks.ts). */
/** Cues are short: a few words naming the event ("After breakfast", "When I get home"). */
export const CUE_LIMIT = 36;
export const tidyCue = (text: string) => text.replace(/\s+/g, ' ').trim().replace(/[.]$/, '').slice(0, CUE_LIMIT);
