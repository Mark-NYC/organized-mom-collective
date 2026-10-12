# Organized Mom Collective | Lifestyle photo color standard

**Approved visual direction:** Kaboompics is the baseline. Reference IDs K01, K02, K03, K05, K06 from [Batch 01](photo-approval-batch-01.md). Family face favorites F03, F04, F05, F07, F08, F09, F10, F11, F12 from [Batch 02](faces-approval-batch-02.md). **Visual taste approval does not grant publishing clearance.**

## The target
Real American home life, warm muted neutrals, soft daylight, modest contrast, believable skin tones and subtle lived-in textures. Don't fake film grain or use aggressive beige filters. No cold teal shadows, orange skin, crushed blacks, ultrawhite/high-key studio scenes, over-sharpening or heavy background blur.

## Working image criteria
- Light: diffuse natural window light, warm-neutral (not yellow). Exclude mixed blue/orange artificial lighting unless easy to correct.
- Contrast: gentle midtone contrast, hold detail in white fabric and dark hair. Avoid harsh black-and-white punch.
- Color: neutral creams, soft sage, tan, muted wood tones. Keep reds and skin natural; don't force brand palette into photographed reality.
- Composition: slight imperfection and convincing daily-life moment, framed wide enough for crop variants. A staged happy family looking at camera is less useful than a small interaction.
- Facial scenes should sit between household-detail photos, typically one people photo to two or three details.

## Editing procedure (reproducible)
1. Sort candidates into **daylight warm**, **daylight cool**, **mixed light**, and **harsh/studio**. Reject harsh/studio first; don't make every image conform through a single heavy preset.
2. Choose a Kaboompics reference next to each candidate. Compare at equal thumbnail size on neutral background.
3. Normalize exposure/white balance *per image* first. Preserve natural skin tones.
4. Normalize white/black points and reduce oversaturated channels gently if required.
5. Inspect face, fabric, paper, wall and wood tones at 100% size. Check that the image still looks photographic, not smoothed or AI-rendered.
6. Export sRGB responsive WebP sizes only after source, provenance and release checks. Preserve original and recipe metadata in a private source archive.

## Starter transform for local previews (not an automatic final grade)
Pillow/ImageMagick-type baselines may begin with contrast 0.96, saturation 0.94, brightness 1.01. **These are test values, not an approved preset**; don't apply identical settings blindly. Evaluate each after normalization. Target subjective consistency over numeric color matching.

## Approval and rights gates
- `owner_visual_status`: liked / rejected / undecided, unchanged by edits.
- `human_provenance`: verified / unclear / not reviewed.
- `license_status`: verified / unclear / not reviewed.
- `release_status`: confirmed / unknown / not needed after documented review.
- `publishing_clearance`: false until all applicable rights and contexts are vetted.
- `grade_status`: unprocessed / draft / visually_approved. A visually approved graded image does not become cleared for use.

## Next review
Make side-by-side contact sheets of Kaboompics baseline photos and the nine liked face photos, normalize copies in a *separate review artifact*, and reject any face shot that remains visually incompatible after light adjustment. Do not deploy.
