---
version: alpha
name: image-compressor-design
description: A dark-first, single-purpose image compression tool. All processing runs locally in the browser; the interface is a quiet workbench, not a showcase: one upload card, one result list, one settings panel. Indigo accent, green only for real savings, grey for already-optimal files. Desktop puts settings in a sticky right sidebar; mobile stacks upload, results, then settings. Six languages, light and dark themes, no marketing decoration.

colors:
  # Dark theme is the default (:root). Light values are listed with a -light suffix.
  canvas: "#010102"
  canvas-light: "#f5f6f6"
  card: "#0f1011"
  card-light: "#ffffff"
  surface-2: "#141516"
  surface-2-light: "#f5f6f6"
  text: "#f7f8f8"
  text-light: "#17181c"
  muted: "#d0d6e0"
  muted-light: "#52525b"
  subtle: "#8a8f98"
  subtle-light: "#6b7280"
  border: "#23252a"
  border-light: "#e5e7eb"
  border-strong: "#34343a"
  border-strong-light: "#d4d4d8"
  accent: "#5e6ad2"
  accent-hover: "#828fff"
  accent-soft: "rgba(94,106,210,.12)"
  accent-soft-light: "rgba(94,106,210,.08)"
  green: "#27a644"
  green-light: "#15803d"
  green-soft: "rgba(39,166,68,.16)"
  green-soft-light: "rgba(21,128,61,.10)"
  warn: "#f59e0b"
  warn-light: "#b45309"
  red: "#f87171"
  red-light: "#dc2626"
  on-accent: "#ffffff"
  pill-bg: "rgba(20,20,20,.85)"
  overlay: "rgba(0,0,0,.82)"
  thumb-tag-bg: "rgba(0,0,0,.65)"

typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: 30px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: -0.6px
  display-mobile:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: 26px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: -0.6px
  sum-big:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: 28px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: -0.5px
  drop-title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: -0.2px
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: -0.05px
  body-sm:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: -0.05px
  caption:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: -0.05px
  item-name:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: 15px
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: -0.05px
  button:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: -0.05px
  badge:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: -0.05px
  tag-bold:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: 12px
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: -0.05px

rounded:
  xs: 8px
  md: 12px
  pill: 999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 20px
  xl: 24px
  xxl: 36px
  section: 48px

components:
  header:
    maxWidth: 920px
    padding: "36px 16px 4px"
    title: "display"
    subtitle: "body-sm, subtle"
    badge: "12px pill, surface-2 bg, muted text, margin-left 8px"
  card:
    background: "card"
    border: "1px solid border"
    radius: "12px"
    padding: "24px (16px mobile)"
    marginBottom: "16px (0 in desktop grid, gap 20px)"
    shadow-dark: "inset 0 1px 0 rgba(255,255,255,.04)"
    shadow-light: "0 1px 3px rgba(0,0,0,.06)"
  dropzone:
    border: "2px dashed border-strong"
    radius: "12px"
    padding: "42px 20px (28px 16px mobile)"
    title: "drop-title"
    hint: "caption, subtle"
    hover: "border accent"
    dragover: "border accent, bg accent-soft"
    icon: "32px, subtle, centered"
  button:
    minHeight: "44px"
    padding: "10px 18px"
    radius: "8px"
    border: "1px solid border"
    background: "surface-2"
    hover: "border border-strong"
    disabled: "opacity .5, cursor not-allowed"
  button-primary:
    background: "accent"
    borderColor: "accent"
    color: "#ffffff"
    hoverBackground: "accent-hover"
  button-danger-confirm:
    color: "red"
    borderColor: "red"
  field-label:
    fontSize: "13px"
    fontWeight: 500
    color: "subtle"
    marginBottom: "6px"
  select:
    padding: "10px 36px 10px 12px"
    radius: "8px"
    chevron: "custom 12px svg, 12px off right edge, native arrow hidden"
  number-input:
    padding: "10px 12px"
    fontSize: "16px"
    radius: "8px"
  range-checkbox:
    accentColor: "accent"
    checkboxSize: "18px"
  preset-btn:
    minHeight: "36px"
    padding: "6px 12px"
    fontSize: "13px"
    active: "border accent, text accent, bg accent-soft"
  summary-big:
    style: "sum-big, green"
  summary-detail:
    style: "body-sm, muted"
  global-loading-pill:
    position: "fixed, viewport center, z 40"
    note: "the single loading indicator; the summary carries no spinner"
    padding: "8px 16px"
    radius: "pill"
    background: "rgba(20,20,20,.85)"
    color: "#ffffff"
    spinner: "18px, white on translucent"
    interaction: "pointer-events none, fade-only (.25s)"
  progress-bar:
    height: "6px"
    track: "surface-2 bg, 1px border, pill"
    fill: "accent + diagonal stripes, animated 1s linear"
    text: "caption, subtle"
  item-row:
    layout: "flex, gap 16px, padding 18px 0, border-top 1px border (first has none)"
    name: "item-name, ellipsis"
    sizes: "body-sm, subtle"
    save-tag: "12px/700 pill, green-soft bg, green text"
    best-tag: "13px/700 pill, surface-2 bg, 1px border, subtle text"
    dims: "caption, subtle"
    dims-warn: "caption, warn"
    error: "body-sm, red"
  thumb:
    size: "104px (84px mobile)"
    radius: "8px"
    background: "surface-2"
    tag: "12px pill, rgba(0,0,0,.65) bg, white text, left 6px bottom 6px"
    crossfade: "opacity .35s ease, top layer only"
  row-icon:
    size: "44px square (40px mobile)"
    layout: "flex-centered"
    radius: "8px"
    border: "1px solid border"
    background: "surface-2"
    remove-hover: "text red, border red"
  lightbox:
    overlay: "fixed inset 0, z 50, rgba(0,0,0,.82), padding 16px"
    box: "max 94vw / 94vh"
    image: "max 92vw / 76vh, contain, zoom-in cursor; zoomed: no max, zoom-out cursor"
    compare: "wrapper shrink-wraps base image; original clipped left of divider"
    divider: "2px white line, 40px round handle, ew-resize, slider role, 44px invisible grab strip, touch-action none"
    side-tag: "12px pill, rgba(0,0,0,.65) bg, white text, top corners"
    hint: "13px #bbb, centered"
  note:
    style: "caption, subtle"
    placement: "summary-adjacent only, never duplicated"

## Overview

A workbench for one job: shrink images without uploading them. The page
has exactly three cards: upload, results, settings. Nothing else competes
for attention. The header is a title, one subtitle line, and three quiet
controls (theme, language, GitHub). The footer is a short privacy note.
Dark is the default theme; light is a user choice, not a marketing variant.

The visual language is restrained on purpose: near-black surfaces, one
indigo accent for actions and focus, green reserved for measured savings,
grey for "already optimal". No gradients on surfaces, no decorative
illustrations, no hero. The only motion is functional: spinners while
work runs, a crossfade between original and compressed previews, a
striped progress fill.

## Colors

### Brand & Accent

Indigo `#5e6ad2` is the single accent, identical in both themes. It marks
interactive emphasis only: primary buttons, active preset and view
buttons, focus outlines, progress fill, spinner arcs, dropzone hover and
dragover states. Hover deepens it to `#828fff`. A translucent wash
(`accent-soft`) marks active presets and the dragover dropzone.

### Surface

Dark (default): canvas `#010102`, cards `#0f1011`, raised controls
`#141516`. Light: canvas and raised controls `#f5f6f6`, cards `#ffffff`.
Borders are hairlines (`#23252a` dark, `#e5e7eb` light) with a stronger
variant for dashed and hover states. Cards never float: dark cards get an
inset top highlight, light cards get a single soft shadow.

### Text

Three levels, no more. Primary text (near-white dark, near-black light)
for names, values, and titles. Muted for secondary facts (summary detail,
header badge). Subtle for hints, notes, dimensions, and captions. Never
use muted or subtle for the one number the user came for: the summary
percentage is large and green.

### Semantic

- Green (`#27a644` dark, `#15803d` light) means a measured saving: the
  summary percentage and the per-row save tag. Green is earned by a
  number, never decorative.
- Grey means already optimal: the "already best, keep original" badge is
  a bordered grey pill, never green. 0% is not a success and must not
  look like one.
- Amber (`warn`) marks a dimension line that changed by upscaling.
- Red marks errors and the armed clear-confirm state only.

## Typography

System stack everywhere, with PingFang SC and Microsoft YaHei so Chinese
renders natively: `-apple-system, BlinkMacSystemFont, "SF Pro Display",
"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`. No webfonts,
no display face. Body is 16px at 1.5 with -0.05px tracking; the page never
shouts. Hierarchy is size and weight only: 30px/600 page title, 28px/600
summary number, 18px/600 dropzone title, 15px/600 file names, 14px labels
and buttons, 13px notes and dimensions, 12px tags. All copy comes from
the i18n dictionary in six languages (zh, en, ja, ko, fr, de); no
hardcoded user-facing string may appear in a component.

### Principles

- One number per row of hierarchy: the summary shows the saving as one
  large percentage, with the byte detail as small text beneath it.
- File names truncate with an ellipsis; they never wrap and push the row
  taller.
- Notes are 13px subtle and appear exactly once per concern, under the
  summary, never repeated per row.

## Layout

### Spacing System

Base unit 4px. Card padding 24px (16px mobile), card gap 16px (20px in the
desktop grid), settings grid gap 16px, row gap 16px, control gaps 8-10px.
Section padding under the page is 48px; the header sits 36px from the top
(24px mobile).

### Grid & Container

Max width 920px, centered, 16px side padding (12px mobile). DOM order is
upload, settings, results. Desktop (min-width 720px) reorders them into
a two-column grid: upload left, results left below it, settings as a
sticky right sidebar (`position: sticky, top 20px`), so tuning never
means scrolling past the list. Mobile is a single column in DOM order:
upload, settings, results, so the controls sit right where the user
just uploaded, not below a growing list.

### Whitespace Philosophy

Generous but not airy: the dropzone is the tallest element on first load
(42px vertical padding) because it is the only action. Result rows are
separated by hairlines, not cards-in-cards. The settings panel is a grid
of fields, not a form with sections.

## Elevation & Depth

There is almost no elevation. Dark cards use an inset 1px top highlight;
light cards use one 3px soft shadow. Floating elements are the only
things allowed a real shadow: the global loading pill (`0 4px 16px
rgba(0,0,0,.25)`) and the lightbox overlay, which is a scrim, not a card.
Nothing else casts a shadow.

## Shapes

Radius scale is two steps: 12px for cards and the dropzone, 8px for
controls, thumbnails, and row icons. Pills (999px) are reserved for tags,
badges, the progress track, and the loading pill. The dropzone's dashed
border is the only dashed line on the page.

## Components

### Header

Title left, actions right, wrapping on narrow screens. The "local" badge
sits inline after the title (12px pill, raised background, muted text).
Header actions are 44px-tall quiet buttons; the language select hides
the native arrow and draws its own chevron 12px off the right edge.

### Upload Card

The dropzone is a dashed well with a 32px upload icon, an 18px title,
and a subtle hint line (tap wording on touch devices). Hover and
dragover both switch the border to accent; dragover additionally washes
the well with accent-soft. Once results exist, the dropzone collapses to
a one-line "+ Add more" row (same dashed well, slim padding, still
clickable, still a drop target). Files can be dropped anywhere on the
page, not just on the well: while files are dragged over the page, a
fixed dashed overlay hints "drop to add images"; drops on the well
itself are handled by the well, drops elsewhere by the page handler.
Below the dropzone, a single 13px subtle line
reports files skipped by the drop/paste/picker funnel (non-images); it
clears itself after 5 seconds and never blocks the list.

### Settings Panel

Four rows on a two-column grid (`max-content` label column shared by all
rows, control column `minmax(0, 1fr)`, gap 14px 16px): scene, format,
compression, size. Labels are 13px/500 subtle. Scene, format and size
are selects (8px radius, raised background, custom chevron); compression
is a three-button segmented control (Smart / Quality / Size) whose own
parameter sits directly under it: the quality slider with its value, or
the KB input with 200 / 500 / 1000 chips. Choosing "Custom..." in the
size select reveals the resize segments (longest / width / height /
percent / crop to W x H) and the number input(s) under it.

Smart is the default for both format and compression. The scene select
shows "Custom" whenever the settings match no scene; picking a scene
applies it, picking "Custom" while a scene is active restores the
settings from before the scene. Five scenes: WeChat image (JPEG 85,
1920), WeChat article image (JPEG 85, 900), ID photo (1-inch 295x413
crop, JPEG <= 200KB), website/blog (WebP 80, 1600), email attachment
(JPEG <= 1000KB).

Below the rows, at most one 13px subtle note line (AVIF download
warning, lossless PNG, target mechanism, or what smart does), then the
"Advanced" fold (closed by default: quantize, keep EXIF, JPEG fill,
no-upscale, keep file name; each shown only where it applies). Hidden
controls use `v-show`, never unmount, so their values survive toggling.
Last-used settings persist to localStorage except the compression mode;
a corrupt save falls back to defaults per key, and pre-2.1 saves migrate.

### Summary

The result card opens with the summary: one large green percentage, one
muted byte-detail line, one subtle hint line. While a recompress runs,
a fixed 16px spinner appears inline after the percentage (margin-left
8px, vertical-align -2px) by fading in only: it is always in the DOM at
a fixed size, so toggling it never reflows the line. A second, floating
indicator mirrors the same state at the top center of the viewport
(18px spinner plus "processing" text) for when the summary is scrolled
out of view; it fades in and out, never intercepts taps
(`pointer-events: none`), and never blocks a tap mid-run.

### Progress

A 6px pill track with an accent fill carrying a diagonal stripe
animation while work runs, plus a 13px subtle text line. It sits above
the summary and disappears into the card, not above it.

### Result Rows

Each row is thumb, meta, actions. The thumbnail is a 104px square (84px
mobile) with rounded corners; original and compressed layers crossfade
(.35s) and only the top layer is visible. Row thumbnails carry no tags;
comparison labels live in the lightbox only. The meta column holds the truncated
file name, and one main line only: original size → compressed size, plus
an inline green saving percent (no percent when nothing was saved). The
already-best grey badge ("best kept, original retained") sits inline
after the sizes. Dimensions, target notes and type notes do not stack
under the row; they live in the lightbox info line.
Errors are 14px red. Row actions are exactly two 44px squares,
flex-centered the same way so their icons align: download (link icon)
and remove (trash icon, turning red on hover). No per-row settings gear,
no third button.

### Lightbox

A full-viewport scrim (z 50, 82% black) with a centered column: a bar
(close only, right-aligned), a compare stage, and a centered 13px hint.
The stage holds a compare wrapper shrink-wrapped to the compressed
image: the original layer is clipped to the left of a draggable white
divider (2px line, 40px round handle, ew-resize cursor, keyboard arrows
and Home/End, slider role), with small dark side labels (original left,
compressed right). Both layers share the wrapper's box at any zoom, so
scrolling the stage pans them together. Below the stage, a centered
13px info line carries the dimensions (amber when the output was
upscaled), the target note, and the type note. Clicking an image toggles full
size (cursor flips from zoom-in to zoom-out). Esc, backdrop click, and
the close button all dismiss it.

### Actions Bar

Download-all (primary) and clear (quiet) sit below a hairline at the
card's foot. Clear sits at the far right, away from the primary button,
because it is destructive: the first click only arms it ("confirm?") in
red, the second clears, and the armed state expires after 3 seconds.

### Footer

A 13px subtle privacy note, same 920px container, generous bottom
padding. It states the local-processing promise in plain words.

## Do's and Don'ts

### Do

- Keep theme tokens as CSS custom properties: the theme switches at
  runtime, so they must never become compile-time Less variables.
- Keep loading indicators fixed-size and opacity-only; never let a
  spinner reflow a line or shift a layout.
- Keep the global pill pointer-events none and fade-only.
- Keep row actions to download and remove, both 44px, both flex-centered.
- Keep notes to one place per concern, under the summary.
- Keep the default "do not upscale" behavior checked in every mode, and
  show the upscaled dimension line in amber when upscaling happens.
- Keep every user-facing string in the i18n dictionary, in all six
  languages; a missing key throws, by design.
- Keep the summary's big number green only when a real saving exists.
- Keep touch targets at 44px (40px for row icons on mobile).
- Keep `touch-action: manipulation` on html: it kills double-tap zoom
  while preserving pinch zoom. Never add `user-scalable=no`.

### Don't

- Don't use green for 0% or for already-best files; already-best is grey.
- Don't put tags on row thumbnails; comparison labels live in the
  lightbox only.
- Don't stack three lines of size, target note, and type note per row;
  the main line carries the saving, the rest belongs in the preview.
- Don't put a settings gear on each row.
- Don't place the destructive clear button next to the primary action,
  and don't clear without the armed second click.
- Don't duplicate a hint in two places; one concern, one line.
- Don't hardcode copy, colors, or font sizes in components; tokens live
  in style.less and the i18n dictionary.
- Don't animate layout properties; opacity and transform only, and
  honor `prefers-reduced-motion` (thumb fade and stripe animation off).

## Responsive Behavior

### Breakpoints

- Desktop grid at min-width 720px: two columns, sticky settings sidebar.
- Mobile compact at max-width 600px: tighter header (24px top, 26px
  title), 16px card padding, 28px dropzone padding, rows reflow to a
  grid (84px thumb left, meta and actions stacked right), row icons
  shrink to 40px.
- Between 600px and 720px the page is a single column at full padding;
  nothing breaks, nothing hides.

### Touch Targets

44px minimum for buttons, selects, and row icons (40px for row icons on
mobile). Checkboxes are 18px with a full-row label hit area. Number
inputs render at 16px so iOS does not zoom on focus.

### Collapsing Strategy

Settings never collapse on desktop (sticky sidebar). On mobile they sit
between upload and results in DOM order, always visible: tuning is a
high-frequency action in this tool, and hiding it behind a drawer would
add a tap to every adjustment. The result list never paginates; rows
wrap within the card.

### Image Behavior

Thumbnails are fixed squares with cover fit; the lightbox fits images
within the viewport and zooms to full size on click. No image is ever
stretched: aspect is preserved everywhere.

## Iteration Guide

- Change a color, radius, or spacing in one place: the `:root` custom
  properties in style.less. Light-theme overrides live in
  `:root[data-theme="light"]` in the same file.
- Add a component variant by extending its existing class, not by
  inventing a new visual language (a third button style, a second card
  shadow, a new accent color all need explicit justification).
- Add a user-facing string by adding the key to all six languages at
  once; the dictionary throws on a missing key, which is the test.
- Add a state by reusing an existing signal first (spinner opacity,
  pill fade, tag color, amber dimension line) before adding a new one.
- Verify UI changes with the Playwright suite against the built docs/
  output, not against dev-server rendering; the suite is the source of
  truth for regressions.
- Never edit built output in docs/ by hand; change src/ and rebuild.
