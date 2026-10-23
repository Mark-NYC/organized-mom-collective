# July 2027 mailer: Ready to Go

**Status (2026-10-23): design draft for owner review. Not printed, not quoted, not sent.** Kit config: `src/data/club/kits/2027-07-ready-to-go.ts`; the printable twin is the kit's "This month's letter" (`LetterSheets` in `src/components/club/print/LetterPrintables.tsx`), the same component as the other three-part kits.

**One sheet, two sides:** a double-sided 8.5 × 11 in letter, sent flat in a quality envelope. One letter, one outing, one personalized packing tool. Useful without scanning: the front is a complete family challenge on its own.

Mailer cutoff 2027-06-15, mail drop around 2027-06-20, kit opens 2027-07-01.

## Audit: what the site already had

| Looked for | Found | Used? |
| --- | --- | --- |
| Packing list or trip generator | `/travel-checklist`: a free two-page family travel checklist (a countdown, must-haves, what to pack for "everyone" and "the kids", coming home), static and family-level, no people, ages or owners | Kept as it is, unchanged (routes, SEO, saved sheets). It answers "what does the trip need?"; July answers "who packs what?" |
| Per-person lists, ages, owners | The job planners' shared "who's helping" (`src/lib/household-helpers.ts`, `HelpersEditor.astro`), owner spreading with the account holder leaning last (April, May) | Reused |
| Illustrations | The responsibility library (`src/data/responsibilities.ts`): Pack My Backpack, Get Dressed, Get Ready for Bed, Brush My Teeth | Reused on the printouts |
| Printing, saving, the Club handoff | Measured US Letter pages, PNG download, palettes, browser saving, `tool-handoff` (every site tool) | Reused |

No suitable generator existed, so July adds one canonical site tool, **PackingBuilder**, hosted in the Club today and ready for a public page.

## Design

The Club stationery with July's one touch (`mailer.accent: 'travel'`): a fine-line compass in sage and soft blue, its needle tipped in pale apricot, above the title and beside the back heading. Soft blue panels, an apricot calendar note. No luggage patterns, no cartoon cars. The front sits a little tighter (the outing and when lines and five steps with a sentence each).

## Front

1. **Header:** ORGANIZED FAMILY CLUB · JULY 2027, then the compass.
2. **Title:** Ready to Go. **Subtitle:** Less packing for Mom. More independence for everyone.
3. **The letter: They Can Get Themselves Ready** (158 words with greeting and sign-off). **A draft for Megan to approve or rewrite.** No guilt, no criticism of children or other adults, no expectation of perfection, nothing safety-critical handed to children, no assumption of expensive trips. "Hi Ana," when her first name is on her profile; otherwise "Hi friend,".

   > Getting everyone out the door can feel like a project. Before an outing even starts, someone has to remember the swimsuits, snacks and water bottles. Often, that someone is Mom.
   >
   > But children can learn to get themselves ready, one small step at a time. A six-year-old can gather a swimsuit, towel and water bottle from a picture list. An older child can pack a camp bag and check it on their own. Teenagers can take care of more of their own things, while grown-ups share the supplies, the driving and anything to do with safety.
   >
   > Nobody needs to be independent overnight. They just need chances to practice. And when everyone gets home, they can unpack their own bags instead of leaving them by the door.
   >
   > Pick one outing this month and try the challenge below.
   >
   > At dinner this week, ask: "What's one thing you think you could get ready by yourself before we leave?"
   >
   > Warmly, *Megan*

4. **Our Ready-to-Go Challenge** (soft blue panel): "One outing. Everyone gets ready together." Note: "Any outing counts, near or far. One successful outing is enough." **Where we're going ______**, **When ______**, then five checkboxes, each with its sentence:
   1. **Choose one upcoming outing.** A camp day, pool visit, road trip, sleepover, or family activity.
   2. **Figure out what everyone needs.** Make a short list of personal and shared supplies.
   3. **Let everyone pack their own things.** Give children age-appropriate ownership, with help where needed.
   4. **Check together before leaving.** Make sure important items are packed and adults verify essential supplies.
   5. **Unpack when you get home.** Everyone puts away their own belongings and helps reset shared supplies.

   Online: tap the outing (or type one), an optional day, check steps off, saved, and print her copy. No trip dashboard.

## Back

1. **Raising Kids Who Can Get Themselves Ready.** "Independence grows one bag at a time. Start with what your child can carry, and let the rest be practice."
2. **Pack · Check · Unpack**, three large framed words: **Pack** Gather your things. **Check** Make sure you have what you need. **Unpack** Put everything away when you get home.
3. **Getting ready, by age** (beside the travel bag note): 3–5 find a few things from a picture list, carry their own bag · 6–9 gather a short list, check the boxes, then show a grown-up · 10–12 pack a whole bag and check their own list · 13+ plan and pack their own things, bring medicine to a grown-up. "Starting points, not rules. Grown-ups keep medicine, documents and safety items."
4. **Before your next outing** (optional): "Check your family's go-to travel bag, water bottles, and reusable supplies so they're ready for next time."
5. **Ask at dinner this week:** *What's one thing you think you could get ready by yourself before we leave?*
6. **Make Your Family's Packing Lists:** the QR code beside "Choose where you're going and who's coming. We'll create packing lists that help everyone get ready: a list for each person and a short shared one. Scan the code, then tap "Build Our Packing Lists."" and **organizedmomcollective.com/club/kits/2027-07-ready-to-go**. The code encodes `https://www.organizedmomcollective.com/club/kits/2027-07-ready-to-go?source=mailer`, verified by decoding the printed code.
7. **On the family calendar:** Add your upcoming outings and trips to the family calendar. Let everyone know when they'll need to have their bags ready.

## The Family Packing & Independence Builder

Component `src/components/site/PackingBuilder.astro` + `packing-builder.ts`, items and rules `src/data/packing.ts`. Hosted at `/club/tools/packing`; no public page yet, built to take one.

- **Three questions.** Where (summer camp, pool or beach, road trip, family vacation, day outing, sleepover, something else; each with a fine-line mark). Who's going (the family profile, or Adult / Teen / School-age / Young child in a tap; remove anyone staying home). How long (a few hours, one day, overnight, multiple days with a number of nights). Then only the details that matter for that outing: swimming, outdoor activities, cool or rainy weather, a camp's own packing list, laundry where you're staying.
- **Lists that fit.** A pool afternoon gets swim things, not pajamas; a day camp has no sleeping bag; a sleepover has no beach gear; a long trip counts outfits by days (nights + 1), capped at four days with laundry. Lists are short for the youngest (about six things) and fuller with age.
- **Independence, by age.** Each child's list has "I can pack myself" and "A grown-up helps with". A 4-year-old packs their bag, swimsuit and towel and a grown-up handles the water bottle; a 6-year-old gathers the whole pool list; tweens pack it all and check it; teens pack their own and bring medicine to a grown-up. Medicine and allergy supplies, camp forms, documents and putting sunscreen on are a grown-up's at every age. Any item can be moved between sections ("Do not infer competence from age": the age is only where it starts).
- **Shared supplies, shared work.** A short shared list for the outing (snacks, water, sunscreen, first-aid kit, documents, the car, drop-off and pickup…), each with an owner. Grown-ups take the safety items, spread between them with the account holder leaning last; a teen can take a non-critical item; nothing goes to a child under 13. A sleepover's shared list is just the pickup plan.
- **Pack · Check · Unpack** on screen and on every printout, in words for the person's age.
- **Editing.** Check off, reword, reorder (arrows), move between sections, remove, add, reassign. "New suggestions (keeps your changes)". Everything saves in this browser.
- **Saved lists.** Save under a name ("Elena's Pool Bag", "Family Road Trip Essentials") and open it again next time, checks cleared. Saved on this device only, and it says so.
- **Printing.** One US Letter page per person: name, outing and length, Pack · Check · Unpack, big checkboxes, library illustrations where they fit, "I can pack myself" and "A grown-up helps with", the shared things they're bringing, and an unpack line. A young child's page is picture-first (larger illustrations and type). The shared list prints on its own page with owners and note lines. Print one person, the shared list, or everyone. Grayscale-safe: every box and line has a dark edge.
- **Not in it:** trip dates, itineraries, bookings, a trip calendar, weather lookups, accounts or syncing.

## Not the other months

June sets ordinary summer days (rhythm, screens); August gets ready for school. July is getting yourself ready for outings: packing, checking, unpacking.

## Open questions

- Megan's approval or rewrite of the letter.
- The item lists and age cut-offs are reasonable defaults to tune with a family test.
- A public page for the builder (SEO and a page brief) is a separate decision.
- The mail-house quote (D1, D9), same format as August.
