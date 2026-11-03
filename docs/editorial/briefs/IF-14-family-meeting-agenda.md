# Brief: IF-14 family-meeting-agenda

- **Pillar:** Intentional Family Life (not a pillar guide)
- **URL:** /resources/family-meeting-agenda
- **Researched:** 2026-11-03
- **Status:** Article and public printable implemented in the associated feature branch

## Search intent

**Primary query:** family meeting agenda printable. **Type:** reusable printable/template.

The reader needs a one-page meeting agenda she can use with her family, without having to invent questions or turn it into another adult-led planning project.

Secondary keywords: family meeting template, family meeting with kids, ten minute family meeting, family meeting ideas.

Question themes (not verified as Google People Also Ask): how long should a family meeting be; what should kids do; how to make decisions stick; what if someone won't participate.

## Existing format, source of truth

Use the established *Organized Family Club* four-part meeting model, not a new five-part agenda:

1. **Our Focus**, 2 minutes
2. **Let’s Talk**, 3 minutes
3. **Everyone’s Part**, 3 minutes
4. **Let’s Practice**, 2 minutes

Source: `src/data/club/meeting-guide.ts`. The public printable imports its section labels and timing from that module, so the formats stay aligned. It uses generic prompts instead of member-specific monthly questions or private profile data. It is not the personalized Club monthly meeting and should not claim to be.

## What currently ranks

Public examples surfaced in initial research:
- https://alpacto.com/printables/family-meeting-agenda/ : printable agenda
- https://upkeeppapers.com/resources/kids-and-family-life/family-meeting-agenda-and-actions-sheet/ : agenda plus actions sheet

These support the practical template format, not claimed keyword volume or Google rankings. Pinterest autocomplete, guided search and Trends still need direct research.

## Differentiation

**The Shift:** The meeting doesn't end with one grown-up getting a longer reminder list. It ends with each person agreeing to an appropriate next action and trying one part together.

**Unique usefulness:** Free browser-printable US Letter sheet, with four timed steps, blank space for the family focus and discussion, the named owner and when, and a first practice. Reuses the current Club meeting structure rather than contradicting it. No account required.

## Structure

1. **Tension:** Everyone has ideas; a long meeting becomes another project.
2. **Short answer:** Four parts, ten minutes; same named format as the Club.
3. **Saveable hero:** Timeline, `id="checklist"`, with all four sections and times.
4. **Primary free action:** Print `/family-meeting-agenda`.
5. **Shift:** No one adult owns the reminder list.
6. **Worked example:** Backpacks by the door.
7. **When Life Happens:** Silent participant, five-minute option, plan that didn't stick.
8. **Next steps:** Existing weekly reset and independence articles.
9. **Product CTA:** Verified 11×17 paper wall calendar, with no promise that calendar alone changes household habits.
10. **Next Small Win:** Choose a meeting time and print the sheet.

## Internal links

- Parent: `intentional-family-life` (inbound link added)
- Sibling: `how-to-share-the-mental-load`
- Bridge: `weekly-family-reset`
- Next: `weekly-family-reset`
- Tool: `/family-meeting-agenda`
- Future incoming: optional contextual link from `weekly-family-reset` only if that article's scope benefits

## Product and access rules

Printable is public and generic. Club personalized monthly meetings and the Welcome Kit's own printed guide remain separate. The printable must not be described as a personalized Club resource, and no private household data is used.

## Pinterest

The three-concept plan is `docs/editorial/pinterest/IF-14.md`, written from the finished article. Pinterest search-term research is explicitly marked unverified. Assets have not been generated or scheduled.

## Verification gate

Run `npm run verify`, inspect US Letter portrait print preview, check mobile overflow and download/print behavior, then review and publish. Update auto-generated content inventory if the repository's check regenerates it. No print QA or local build execution has been claimed from the GitHub-only connector.
