import { describe, expect, it } from 'vitest';
import { MEETING_GUIDE } from '../src/data/club/meeting-guide';

const text = JSON.stringify(MEETING_GUIDE);

describe('the Family Meeting guide (Welcome Kit insert)', () => {
  it('is the four-part, ten-minute weekly rhythm', () => {
    expect(MEETING_GUIDE.parts.map((p) => p.title)).toEqual(['Our Focus', 'Let’s Talk', 'Everyone’s Part', 'Let’s Practice']);
    expect(MEETING_GUIDE.parts.reduce((n, p) => n + p.minutes, 0)).toBe(10);
    // Weekly meetings, a new Family Focus each month: never a monthly meeting.
    expect(MEETING_GUIDE.subtitle).toMatch(/once a week/);
    expect(text).not.toMatch(/once a month|each month, so|last month|Next month/i);
  });
  it('follows the writing rules', () => {
    expect(text).not.toMatch(/\b(Mom|Dad|parents?)\b/i);
    expect(text).not.toMatch(/\bapp\b/i);
    expect(text).not.toMatch(/remind (them|everyone)/i);
  });
});
