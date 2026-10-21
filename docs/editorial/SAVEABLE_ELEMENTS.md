# Saveable elements

Every article has **one hero element**: the thing she'd come back to next week, and the reason she saves the page. The interactive checklist is one option, not the default. If every article opens with a five-item checklist, she stops seeing it.

This is the menu to draw from for current and future articles. All are MDX components in `src/components/resources/`, available in every article without importing. Placement in the page: [ARTICLE_FORMAT.md → The interactive guide layout](ARTICLE_FORMAT.md#the-interactive-guide-layout-standard-owner-approved-2026-10-20), row 4.

## The test

**Would she use this again next week, or show it to someone in her family?** If not, it isn't a hero element. It's a speed bump. A checklist she ticks once is used up; a chart she checks every Sunday, words she says tonight or a plan she printed is kept.

## Choose by what she searched

| She searched… | Hero element | Component |
| --- | --- | --- |
| A routine she'll do now ("bathroom reset", "launch pad check") | Interactive checklist | `<StepChecklist>` |
| "Chores by age", "what can a 6-year-old do", "who does what" | Chart by age / who owns what | `<WhoCanHelp>`, `<ChoresByAge>` (IF-03) |
| "How to get kids to…", "how to ask my husband to help", "share the mental load" | Say this, not that | `<SayThis>` |
| "X vs Y", "is it worth it", "which one is right for us" | Three-question picker | `<Picker>` |
| "Schedule", "plan", "routine for busy weeks" | Filled-in example plus week sizes | A table or worked example, plus `<Versions>` |
| "Habits", "system", "how to start" | Fill-in builder | `<Builder>` |
| "Cleaning schedule", "deep cleaning", "zones" | Rotation graphic | `<CleaningWeek>`, a month table |
| "After-school routine", "morning routine", "family meeting" | Hour-by-hour or agenda timeline | `<Timeline>` |
| A pattern or formula ("habit stacking", "usual vs busy day") | Two-column reference chart | `<ReferenceChart>` |

**Supporting elements** (one at most per article, below the hero, in a different section): `<DayCompare>` (the brand story: the same day, Mom carrying it vs everyone having a part), `<ReferenceChart>`, `<Timeline>`, `<SayThis>`, `<SplitList>`, `<Versions>`, `<ToolSpotlight>` (has its own rules: [ARTICLE_FORMAT.md → Tool spotlights](ARTICLE_FORMAT.md#tool-spotlights)).

## Rules

1. **One hero per article.** It sits where the checklist sits today: right after the short answer, with `quick.jump` pointing at it (`id`).
2. **Checklists are capped at about 40% of the library.** Before adding one, check the content inventory: if the last two articles in the same pillar opened with a checklist, choose another hero unless the article really is a do-it-now routine.
3. **One supporting element at most**, in a different section from the hero, never next to a `Tip`, `Figure` or another element. Most of the article stays open text on white.
4. **Content is real.** Scripts, examples and days are illustrative, never presented as a real family, a quote or a customer (BRAND_VOICE.md). Picker results are honest: "a free option" or "you don't need anything new" are valid outcomes, and the calendar is only recommended where it genuinely fits.
5. **Market to Mom, design for the family.** Scripts hand over ownership instead of making Mom a better reminder; the builder's "who" slot names someone other than Mom by default; the timeline shows owners.
6. **Words count toward the 300–600.** Keep items short; the element replaces prose, it doesn't add to it.
7. **Tracking:** the interactive elements report use (`element_use`, `element_complete`, `element_print`, `element_copy` with `element_type` and `element_id`) through `src/lib/element-events.ts`; tool spotlight buttons report clicks as `cta_click` with placement `tool-spotlight:{slug}`. Use the data before converting many articles from one element to another.

## Current heroes (2026-10-21)

Every element takes an `id`; give the hero `id="checklist"` so the header's `quick.jump` reaches it.

| Hero | Articles |
| --- | --- |
| `<Picker>` | FP-14, FP-17, FP-18 |
| `<SayThis>` | IF-08 (plus a backpack-week `<Timeline>`) |
| `<Timeline>` | FP-13 |
| Comparison tables | FP-11, FP-15 |
| Chart by age / week graphic | IF-03 (`ChoresByAge`), HC-01 (`CleaningWeek`) |
| `<StepChecklist>` | the other 23: do-it-now routines (HC-02, HC-07, HC-08, HC-09, FP-04, FP-06, FP-10), setups (FP-02, FP-03, FP-09, FP-16, HC-03), and the rest |

Supporting elements added: `<SayThis>` in IF-02 (the handoff words), `<Timeline>` in FP-20 (the after-school example), `<ReferenceChart>` in IF-10.

**Still over the cap.** Checklists remain in about 75% of articles. The ones left are mostly genuine do-it-now routines, so the next conversions wait for element data (two weeks). Candidates, in order: IF-10 → `<Builder>` (owner asked to keep its checklist on 2026-10-21; ask before changing), IF-01 → `<Builder>` ("This week, we'll make room for…"), IF-07 and IF-09 → lead with their `<WhoCanHelp>` by-age chart, HC-04 → its 12-month rotation, FP-08 → `<DayCompare>` as a supporting element. New articles follow the cap from now on.

## The components

### `<StepChecklist>`: do it now
Interactive, ticks save in the browser. Reference HC-07. Props and rules: ARTICLE_FORMAT.md row 4.

### `<SayThis>`: the exact words
3–5 rows: the usual phrasing, what to say instead (a full sentence she can use tonight), optional one-line `why`.

```mdx
<SayThis
  title="Hand over the job, not just the task"
  items={[
    { instead: 'Can you help me with the dishes?', say: 'After dinner, you load the dishwasher.', why: 'A cue and an owner, so nobody has to ask again.' },
    { instead: 'Just tell me what you need.', say: 'You own Thursday groceries, including checking what’s low.' },
  ]}
/>
```

Options: `kicker` (default "Say this, not that"), `labels` (default `['Instead of', 'Try']`). Best for IF and FP articles about ownership. Strong as a Pinterest text pin.

### `<Picker>`: a decision, not a summary
2–4 questions, 2–3 options each; every option points at a result key. Most-picked result wins; ties go to the earlier question, so ask the most decisive question first. Answers save in the browser; without JavaScript every result is listed.

```mdx
<Picker
  id="checklist"
  title="Which calendar fits your family?"
  storageKey="omc:skylight-vs-paper-picker:v1"
  questions={[
    { question: 'Where do your plans live now?', options: [{ label: 'Mostly phones', result: 'digital' }, { label: 'Paper and memory', result: 'paper' }] },
    { question: 'Who needs to see it?', options: [{ label: 'The adults', result: 'digital' }, { label: 'The kids too', result: 'paper' }] },
  ]}
  results={{
    digital: { title: 'Start with a shared phone calendar', body: '…' },
    paper: { title: 'A wall calendar by the door', body: '…', href: '/calendar', cta: 'See the calendar' },
  }}
/>
```

Best for comparison articles (FP-11, FP-14, FP-17, FP-18). Result links get `data-cta="picker:{id}"`.

### `<Builder>`: she makes it, she keeps it
One sentence pattern with two or three blanks, suggestions she can pick or overwrite, a list she adds to (up to `max`, default 6), then Print or Copy. Saves in the browser; printing prints only her list.

```mdx
<Builder
  id="checklist"
  title="Write your first habit stack"
  storageKey="omc:habit-stack-builder:v1"
  template="After {cue}, {who} {action}."
  listTitle="Our habit stacks"
  slots={{
    cue: { label: 'After…', options: ['dinner', 'school', 'breakfast'] },
    who: { label: 'Who', options: ['everyone', 'the kids', 'Dad'] },
    action: { label: 'Does what', options: ['clears their place', 'hangs their backpack'] },
  }}
/>
```

Best for habits, handoffs and family rules (IF-10, IF-02, IF-08). Patterns to reuse: habit stacks ("After {cue}, {who} {action}."), handoffs ("{who} owns {job}, including {remembering}."), house rules ("In our family, we {rule} {when}.").

### `<ReferenceChart>`: the chart she screenshots
A sage card of pairs under two column headings, with an optional note (the formula) in the slot. Reference IF-10.

```mdx
<ReferenceChart kicker="Habit stacking · a chart to save" title="After we…, we…" columns={['After we…', 'We…']} rows={[['Finish dinner', 'Clear the table together']]}>

**The after–then formula:** “After we finish dinner, we each clear our place.”

</ReferenceChart>
```

### `<Timeline>`: the stretch of day, or the meeting
4–8 stops: a time stamp ("3:30" or "5 min"), a short title, optional line, optional owner (`who`).

```mdx
<Timeline kicker="Sunday check-in" title="The 15-minute family check-in" items={[
  { time: '3 min', title: 'Look at the week', body: 'Practices, appointments, anything unusual.', who: 'Everyone' },
  { time: '5 min', title: 'Name an owner for each pickup', body: 'A list without owners becomes Mom’s list again.' },
]} />
```

Best for after-school (FP-13), mornings (FP-09), the weekly reset agenda (FP-04).

### `<DayCompare>`: the same day, two ways
4–7 shared times; the left column is Mom carrying it, the right is everyone having a part. Supporting element for mental load, habits and pillar articles (IF-01, IF-02, IF-10, FP-08). Illustrative, never "a real mom's day".

```mdx
<DayCompare title="A Tuesday afternoon" rows={[
  { time: '3:30', before: 'Mom asks where the backpacks are.', after: 'Backpacks go on their hooks.' },
]} />
```

Options: `labels` (default `['When Mom carries it', 'When everyone has a part']`), `kicker`.

### Existing elements in the menu
`<WhoCanHelp>` (jobs by age), `<Versions>` (normal / busy / hard), `<SplitList>` (do vs skip), `<CleaningWeek>` (the week at a glance, with print), `<ToolSpotlight>` (a free tool), `<PinterestPin>` (a save-ready image). See BLOG_EDITORIAL_STYLE.md → components.

## Backlog (build when the data says so)

| Element | What it would do | Build when |
| --- | --- | --- |
| Timed run-through | Each checklist step with its own timer, then "you're done, stop" | Checklist completion data shows timed resets get finished |
| Fridge card | The article's core on one printable US Letter page (reuse `src/lib/printable.ts`) | Builder prints show readers want paper |
| Tool-specific charts (bathroom, zone) | Spread tool spotlights beyond the chore chart | The chore chart spotlight shows up in more than half the cleaning and kids articles |
