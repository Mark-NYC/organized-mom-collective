# Article format: The Real-Life Reset

The structure every resource article follows, the components that build it, and how it looks on the page. Copy-ready skeleton: [templates/article.mdx](templates/article.mdx).

Related: [BRAND_VOICE.md](BRAND_VOICE.md) (how it sounds) · [SEO_STRATEGY.md](SEO_STRATEGY.md) (metadata, headings) · [INTERNAL_LINKING.md](INTERNAL_LINKING.md) (links).

## The seven requirements

Every article must:

1. **Match one specific search intent and satisfy it early.** The answer, or a compact version of it, appears in the first screen or two on a phone. Never make her scroll past a story to get what she searched for.
2. **Start with relatable tension**, in two to four sentences, without a long introduction. Name the real moment the problem bites (5 pm, Wednesday, the pickup line). No invented anecdotes.
3. **Introduce a useful insight that challenges an unhelpful assumption** → `<Shift>`.
4. **Explain a concrete, easy-to-follow routine or solution** → `<RealLifeVersion>`.
5. **Include a memorable visual, checklist or example** → `<Checklist>`, `<CleaningWeek>`, a table, an entry formula, or a worked example week.
6. **Explain how to adapt when life doesn't go to plan** → `<WhenLifeHappens>`.
7. **Close with one small action and a relevant next article** → `<NextSmallWin>`, then the `next` article (set in frontmatter; the template renders it).

## Structure, in order

| # | Section | Element | Notes |
| --- | --- | --- | --- |
| 1 | H1 + summary | `title`, `summary` (frontmatter) | Rendered by the template, with breadcrumbs, date and reading time. |
| 2 | Tension | 2–4 sentences of body copy | First lines of the MDX body. |
| 3 | The short answer | One paragraph, often starting "Here's the short answer:" with the answer in bold | Or the visual itself (e.g. `<CleaningWeek />` under an H2 "… at a glance"). Must appear before The Shift. |
| 4 | The Shift | `<Shift title="…">` | One per article. The assumption, why it fails, the better frame. |
| 5 | Why it works | H2, optional | Short. Only if the reasoning helps her trust and adapt the routine. |
| 6 | The Real-Life Version | `<RealLifeVersion title="…">` | The routine: numbered steps and/or `<Checklist>`. The centre of the article. |
| 7 | Example / visual | Table, `<Checklist>`, worked example | Inside or right after the Real-Life Version. |
| 8 | Adapting it | H2 "Adapting it to your …" | Bulleted by situation: working full-time, little kids, partner, older kids, budget, bigger home. |
| 9 | When Life Happens | `<WhenLifeHappens title="…">` | Bold-led paragraphs: missed day, bad week, starting over. |
| 10 | Bridge link | One sentence | Optional: a natural cross-cluster link (see INTERNAL_LINKING.md). |
| 11 | Product note | `<ProductNote product="…">` | Optional, at most one, never before section 6. |
| 12 | Your Next Small Win | `<NextSmallWin>` | One action, doable in the next few minutes. Last thing in the body. |
| 13 | Read next / related | Frontmatter `next`, `related` | Rendered by the template. |

Use descriptive H2s between components as needed (e.g. "What goes on the calendar (and what doesn't)"). Keep H3s for sub-points inside an H2 section.

## Curiosity loops

A curiosity loop is a question the reader wants answered, opened in one place and closed shortly after. Used well, it keeps her reading past the quick answer. Used badly, it's clickbait.

**Rules**

1. **Never loop the search answer.** The thing she searched for is answered up front, in full or compact form. Loops are for the *why* and the *better way*, not the *what*.
2. **Close every loop within the next section.** If she has to scroll more than about two phone screens for the payoff, cut the loop.
3. **One open loop at a time.**
4. **The payoff must be worth it**: a real insight or a specific rule, not a restatement.

**Patterns that work**

| Pattern | Opens | Closes |
| --- | --- | --- |
| The hidden failure | "That isn't a discipline problem. Most schedules are built for a week that never happens." | The Shift, immediately after the answer. |
| The one rule | "There's one rule that keeps this from falling apart on a bad week." | The first bold line of When Life Happens… only if When Life Happens is the next section. Otherwise state the rule where you tease it. |
| The surprising first step | "Start with the nights you *can't* cook." | The next numbered step explains why. |
| The double-duty move | "Notice that Monday's dinner is doing two jobs." | The next sentence. |
| The section bridge | A last line that raises the next question: "So what happens on the day you miss?" | The next section's heading answers it. |

**Avoid:** "You won't believe…", "The secret is…", "Keep reading to find out…", ending a section on a question that's answered three sections later.

## Recurring features

All are MDX components, available in every article without importing (the template passes them in). Source: `src/components/resources/`.

### The Shift
A useful change in perspective. One per article, right after the short answer.

```mdx
<Shift title="A schedule's real job is to tell you what to skip.">

Most schedules quietly assume you'll do every task, every day…

</Shift>
```

Shape: the common assumption → why it fails in a real week → the better frame, in bold. 60–120 words.

### The Real-Life Version
The practical routine. Renders an H2 with the anchor `#the-real-life-version` (override with `id` if an article needs two).

```mdx
<RealLifeVersion title="The 20-minute meal planning method">

1. **Look at the week.** …
2. **Label each night.** …

</RealLifeVersion>
```

Steps start with a bold imperative. Each step is something she can do, not something to think about. Give times and quantities.

### When Life Happens
The realistic fallback. Renders an H2 with the anchor `#when-life-happens`.

```mdx
<WhenLifeHappens title="When you miss a day (or a whole week)">

**Skip it. Don't stack it.** …

**On sick weeks, run the minimum version.** …

</WhenLifeHappens>
```

Cover, as relevant: the missed day, the chaotic week, the minimum version, starting again after a long break.

### Your Next Small Win
One immediate action. Concrete, small, doable tonight or in the next ten minutes.

```mdx
<NextSmallWin>

Tonight, set a 15-minute timer and do the Daily Reset. When the timer goes off, stop.

</NextSmallWin>
```

Not "start your journey". Not three actions. One.

## Visual elements

Every article needs at least one thing she could screenshot.

| Element | Use for | How |
| --- | --- | --- |
| `<Checklist title time icon items />` | Any routine with discrete tasks | `<Checklist title="Weekly check" time="15 min" items={['…', '…']} />`. A softly outlined card with empty boxes on ruled lines, like the printed calendar; `icon` takes a zone icon. Keep to 4–8 items. |
| `<ChecklistGrid>` | Several checklists | Wrap 2–4 `<Checklist>` cards to show them side by side (a breakout row) on wider screens. |
| `<Figure image alt caption size />` | Photographs | `image` is a name from `src/data/images.ts`; `size="wide"` breaks out of the reading column. See [BLOG_EDITORIAL_STYLE.md](BLOG_EDITORIAL_STYLE.md#photography). |
| `<Tip title label>` | One practical aside | Lightly tinted (sage). At most one or two per article. |
| `<ProductCTA title image alt>` | The article's one product callout | Real product photo, a heading, one or two sentences, and the "See the Wall Calendar" button to `/app/reorder`. See "Product notes" below. |
| `<CleaningWeek />` | Cleaning articles | The real cleaning week (Daily Reset, Mon–Thu zones, weekend) as a planner page, read from `src/data/cleaning.ts`. Never retype the schedule by hand. `<CleaningWeek print />` adds a "Print the schedule" button that prints only this figure plus any `<RealLifeVersion print>` (two pages: the week, then the checklists). Used in HC-01. |
| `<Versions title items />` | "Sizes" of a routine for different weeks | `items={[{ name: 'Normal week', when?: '…', body: '…', time: '25–30 min' }, …]}`. Ruled rows with a time stamp; use instead of a three-column table, which is cramped on phones. Used in HC-01's When Life Happens. |
| Data-driven checklists | Zone task lists | `import { weeklySchedule } from '../../data/cleaning';` then map to `<Checklist>`, so articles match the companion website. |
| Markdown table | Comparisons, example weeks, on/off lists | Keep to 2–4 columns so it fits a phone. |
| Entry formula | A pattern to copy | A blockquote: `> 3:30 · Soccer · Sam, Dad drives · cleats, water` |
| Worked example | Showing the method applied | A table or short list, followed by one line on what to notice. |

Photos: aim for 2–4 relevant ones when suitable imagery exists (a `hero` in frontmatter, `<Figure>` in the body, the product photo in `<ProductCTA>`). Every image must show something real and relevant, with descriptive alt text. Direction, how to add one, and the shot list: [BLOG_EDITORIAL_STYLE.md](BLOG_EDITORIAL_STYLE.md#photography). Articles without photos still render cleanly.

## Visual hierarchy

How an article reads on the page, top to bottom (template: `src/pages/resources/[slug].astro`; styles: `.article-*` in `src/styles/global.css`). Design rules: [BLOG_EDITORIAL_STYLE.md](BLOG_EDITORIAL_STYLE.md#design-rules).

1. Category eyebrow (breadcrumbs) → **H1** in Georgia (`.article-title`) → the `summary` as a deck → byline, date and reading time.
2. Optional **hero photo** (3:2, slightly wider than the text), then the collapsed "In this article" list.
3. Body (`.article-body`): a ~700px column of 17–18px Montserrat in warm charcoal, Georgia H2s, generous spacing; `.breakout` elements (photos, checklist grids, the product callout) widen to ~960px.
4. **The Shift**: a pull quote between a month-color rule and a thin rule. The visual "aha".
5. **The Real-Life Version** and **When Life Happens**: unboxed sections with a small labelled eyebrow; their checklists and week sizes carry the structure.
6. **Tip**: one lightly tinted aside.
7. **Product callout** (`<ProductCTA>`): a cream panel with the real product photo; the only promotional block.
8. **Your Next Small Win**: a soft blush panel, the article's full stop.
9. "Read next" as a feature card, related cards, then the pillar link.

The month color (current month, from `src/theme.ts`) is the only accent, exactly as on the companion website.

## Product notes

One product callout per article, after the routine, where the article naturally leads to it. Use `<ProductCTA>` (photo, heading, one or two sentences, "See the Wall Calendar" button to the existing calendar page `/app/reorder`). The older, smaller `<ProductNote product="calendar">` / `<ProductNote product="companion">` still works for a quieter mention. Copy is specific to the article and describes only what the product actually does. Call the companion a *website* (or "the cleaning companion"), never an app, and don't promise features that don't exist.

**Verified features only.** Describe nothing that isn't in these sources:

- **Wall calendar** (11 × 17 portrait, one week per page): the labeled sections in `design/etsy-listing/02.webp`: daily schedule (a column per day), each day's cleaning zone, self-care habits, word of the week, family and friends, grateful for (prayer and gratitude), meal plan, grocery list, to-do list, notes. Editions and prices: `src/config.ts`.
- **Companion cleaning website** (included with every calendar; always call it a website or "the cleaning companion", never an app): `src/data/cleaning.ts` and `src/pages/app/`. The 15-minute Daily Reset; Monday–Thursday zones (Living Room, Bedrooms, Entry/Bathroom, Kitchen Reset); Friday–Sunday optional (Deep Cleaning, Home Project, Catch-Up / Reset); a home project for each month; a "catch up instead" option; progress saved in the browser, no account.

If a feature isn't listed here, check the companion website and the listing images before mentioning it, and add it here once verified.

`cta` in frontmatter records which product the callout points to: `calendar`, `companion` or `none`.

## Example sections

A compact example of sections 2–4 and 12, for tone and rhythm. **HC-01 (`src/content/articles/weekly-cleaning-schedule-for-busy-moms.mdx`) is the reference article**: read it before writing a new one.

```mdx
You've probably printed a cleaning schedule before. It looked great on Monday. By Wednesday a kid
was sick, and by the weekend the schedule felt like a list of things you'd failed to do.

That isn't a discipline problem. Most schedules are built for a week that never happens.

## The weekly cleaning schedule

<CleaningWeek />

<Shift title="A schedule's real job is to tell you what to skip.">

Most schedules quietly assume you'll do every task, every day. So the first missed day leaves you
two days behind. A schedule that works makes two decisions for you: **what to clean today, and what
to drop when today goes sideways.**

</Shift>

…

<NextSmallWin>

Tonight, set a 15-minute timer and do the Daily Reset. When the timer goes off, stop.

</NextSmallWin>
```
