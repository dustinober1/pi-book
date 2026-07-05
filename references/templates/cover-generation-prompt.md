# Cover Generation Prompt

## Purpose

Create a ready-to-run ebook cover generation prompt for the approved final package. This is for image generation only; final typography should usually be added manually in a cover/layout tool unless the image model is known to render text reliably.

## Output specification

- Format: ebook front cover image
- Recommended KDP ebook size: 1600 px wide x 2560 px high
- Aspect ratio: 1.6:1 height-to-width / 0.625 width-to-height
- Minimum practical size: 1000 px high x 625 px wide
- File type target after final design: JPEG or TIFF for KDP ebook upload
- Generation instruction: create at or above 1600 x 2560, preserving clean negative space for title, subtitle, author name, and optional tagline
- Typography recommendation: generate art without text first unless using a professional design workflow; add text manually for readability and to avoid misspellings

## Book metadata

- Title:
- Subtitle:
- Author name:
- Genre / shelf:
- Audience promise:
- Tagline, if approved:
- Comparable cover lane:

## Cover strategy

- Mood:
- Core visual metaphor:
- What the cover must communicate at thumbnail size:
- What the cover must not imply:
- Color palette:
- Typography direction, if adding text manually:

## Paste-ready image prompt

```text
Create a high-definition commercial ebook cover illustration for [TITLE].

Output: vertical ebook front cover, 1600 px wide by 2560 px high, 1.6:1 height-to-width ratio, suitable for Kindle/Amazon thumbnail visibility. Make it look like a premium published book cover in the stated genre, not a poster, not concept art, and not a social-media graphic.

Genre / shelf: [GENRE].
Audience promise: [READER PROMISE].
Mood: [MOOD].
Core concept: [ONE-SENTENCE BOOK HOOK OR VISUAL METAPHOR].

Main visual:
[DETAILED COMPOSITION: foreground image, background, symbolic object, character/no-character choice, spatial layout, light source, and focal point. Specify what should be readable at thumbnail size.]

Color palette:
[COLORS]. High contrast. Clean negative space. Professional publishing quality.

Typography / layout space:
Leave clear negative space at the top for a large readable title: [TITLE]. Leave smaller clean space near the bottom for author name and optional subtitle/tagline. If text is included, use bold, modern, genre-appropriate typography and ensure every word is spelled exactly. Prefer no text if the model is unreliable with typography.

Optional tagline:
[TAGLINE]

Style:
Premium commercial book cover, sharp focus, cinematic lighting or genre-appropriate lighting, clean composition, strong thumbnail readability, polished publishing design.

Avoid:
No clutter, no fake reviews, no watermark, no extra words, no misspelled text, no distorted letters, no generic stock-photo look, no cheap clichés for this genre, no elements that imply the wrong subgenre, no gore or explicit content unless approved by the risk budget.
```

## Negative prompt / avoid list

- genre clichés to avoid:
- misleading subgenre signals:
- visual taboos from author/taste profile:
- typography risks:

## Manual finishing notes

- Add title, subtitle, author name, and tagline manually unless generated text is perfect.
- Check title readability at thumbnail size.
- Export final ebook cover at 1600 x 2560 px or higher in the same ratio.
- Keep a layered source file if using Canva, Photoshop, Affinity, or another cover tool.
- Verify current retailer specs before upload if not using KDP or if platform requirements changed.
