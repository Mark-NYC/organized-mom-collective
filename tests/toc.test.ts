import { describe, expect, it } from 'vitest';
import { tableOfContents } from '../src/lib/toc';

const body = `Intro paragraph.

## The answer up front

<Shift title="Not in the contents">text</Shift>

<RealLifeVersion title="The 20-minute method">
steps
</RealLifeVersion>

\`\`\`mdx
## Not a heading (inside a code fence)
\`\`\`

## Adapting it

<WhenLifeHappens title='When the plan falls apart' id="plan-b">
</WhenLifeHappens>

<WhenLifeHappens>
</WhenLifeHappens>
`;

const headings = [
  { depth: 2, slug: 'the-answer-up-front', text: 'The answer up front' },
  { depth: 3, slug: 'sub', text: 'Sub' },
  { depth: 2, slug: 'adapting-it', text: 'Adapting it' },
];

describe('tableOfContents', () => {
  it('lists Markdown h2s and branded sections in reading order', () => {
    expect(tableOfContents(body, headings)).toEqual([
      { slug: 'the-answer-up-front', text: 'The answer up front' },
      { slug: 'the-real-life-version', text: 'The 20-minute method' },
      { slug: 'adapting-it', text: 'Adapting it' },
      { slug: 'plan-b', text: 'When the plan falls apart' },
      { slug: 'when-life-happens', text: 'When life happens' },
    ]);
  });
});
