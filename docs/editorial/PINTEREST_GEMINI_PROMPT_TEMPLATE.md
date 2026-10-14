# Gemini Pinterest image prompt recipe

**Use with:** [PINTEREST_GEMINI_WORKFLOW.md](PINTEREST_GEMINI_WORKFLOW.md). The existing strategy, production rules and QA checklist override this template.

## Copyable master image prompt

Create one premium Organized Mom Collective Pinterest editorial image in a **2:3 portrait** composition, targeting 1000 × 1500 pixels (confirm actual exported dimensions).

**Article's core idea:** [exact grounded idea from article]
**Exact headline, once only:** "[HEADLINE]"
**What viewer sees:** [specific actual objects or real-world action]
**Setting and mood:** [lived-in family space, time of day, warm believable light]
**Photography/art direction:** [close-up / overhead / full-bleed / asymmetric editorial / typography-led / genuine licensed photo plus layout]
**Composition:** [focal point, camera perspective, breathing room and clear space for text]
**Typography:** [restrained serif/sans hierarchy, sufficient mobile-size contrast, no cut-off letters or repeated headline]
**Brand:** understated "ORGANIZEDMOMCOLLECTIVE.COM" once, only if required by current brand/strategy.

The visual must clearly make the same promise as the destination article. Warm, ordinary, tactile home life rather than a perfect staged showroom. Use cream, muted sage, earth colors and honest texture as appropriate, without forcing the same palette onto every composition.

**Hard exclusions:** duplicated words, tiny illegible mandatory text, nonsensical papers, warped furniture, strange hands, fake UI, fictional OMC products, decorative template clutter, and images that show a different subject from the headline. **Do not generate visible synthetic faces under the current QA rules.** Never invent chart/calendar content; composite approved originals using the established production procedure.

## Prompt strategy
- Make the subject, action, location, light and composition concrete. Do not request six identical layouts.
- Prioritize a single bold idea. Use only approved factual copy from the source article.
- Ask for a deliberate photographic action: a hand wiping one bathroom sink; a parent placing a permission slip in the outgoing backpack; real meal ingredients alongside a schedule.
- For product/tool Pins, preserve and insert actual image assets; the product is not a generator's interpretation.
- If Gemini renders bad text, use a clean photo and add accurate typography in controlled editing instead.

## Targeted edit prompt
"Preserve [what works: specific objects/crop/light/photograph]. Change **only** [named defect]. Keep [specific elements] unchanged. Render [EXACT TEXT] **once**. Do not add objects or captions. Recheck realism, text and mobile readability."

## Output expected from the assistant before image generation
For each concept provide:
1. Exact article title, file path/URL and supporting section.
2. Distinct hook/headline and job (search, curiosity, save).
3. One-sentence visual rationale and form.
4. A full copy-ready Gemini prompt.
5. Duplication check against inventory.
6. Any unknown/unverified article URL or design dependency.

Do not write fake alt text before seeing the resulting image. Do not write publication dates as if scheduled.
