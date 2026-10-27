---
version: "2.1"
name: image-compressor-design
description: "A dark-first, single-purpose image compression workbench. Linear's near-black canvas, hairline surface ladder, and single-accent discipline, adapted for a local-first utility: a dense result table, a fixed settings and preview rail, a light inverse theme, and green reserved strictly for measured savings. The interface is a quiet workbench; the product output — the compressed image — is the protagonist."

colors:
  # Reference: Linear (design-md/linear.app in VoltAgent/awesome-design-md).
  # The accent is shifted one step toward blue for the light inverse theme;
  # it remains the only chromatic action color.
  canvas: "#010102"
  surface-1: "#0f1011"
  surface-2: "#141516"
  ink: "#f7f8f8"
  ink-muted: "#d0d6e0"
  ink-subtle: "#8a8f98"
  hairline: "#23252a"
  hairline-strong: "#34343a"
  primary: "#5b8cff"
  primary-hover: "#7aa6ff"
  primary-soft: "rgba(91,140,255,.16)"
  on-primary: "#ffffff"
  success: "#27a644"
  success-text: "#5fb97a"
  success-soft: "rgba(39,166,68,.16)"
  warning: "#f59e0b"
  danger: "#f87171"
  overlay: "#000000"
  busy-scrim: "rgba(1,1,2,.55)"
  # Light inverse theme (first-class; Linear's marketing site has no light mode).
  canvas-light: "#eef4ff"
  surface-1-light: "#ffffff"
  surface-2-light: "#f0f6ff"
  ink-light: "#17181c"
  ink-muted-light: "#52525b"
  ink-subtle-light: "#6b7280"
  hairline-light: "#dbe7ff"
  hairline-strong-light: "#d4d4d8"
  primary-light: "#2563eb"
  primary-hover-light: "#1d4ed8"
  primary-soft-light: "rgba(37,99,235,.08)"
  success-light: "#15803d"
  success-text-light: "#2f7d4a"
  success-soft-light: "rgba(21,128,61,.10)"
  warning-light: "#b45309"
  danger-light: "#dc2626"
  busy-scrim-light: "rgba(238,244,255,.72)"

typography:
  # System UI stack only: no webfont is downloaded, and the tool must render
  # Chinese, Japanese, Korean, French and German natively.
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
  stat-value:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: 0
    fontVariantNumeric: tabular-nums
  drop-title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: -0.2px
  section-title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: -0.1px
  item-name:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: 13px
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: -0.05px
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
  micro:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: 0
  stat-sub:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: 11px
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: 0
  tag:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: 11px
    fontWeight: 500
    lineHeight: 1.6
    letterSpacing: 0
  tab-label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: 11px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0
  button:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: -0.05px
  numeric:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
    fontVariantNumeric: tabular-nums

rounded:
  xs: 4px      # format tag
  sm: 6px      # zoom buttons, small inline controls
  md: 8px      # buttons, inputs, thumbnails, row icons
  lg: 12px     # cards, dropzone, preview stage
  pill: 999px  # badges, chips, status pills, progress track

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
  page:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    maxWidth: 1400px
  header:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.display}"
    padding: "{spacing.xxl} {spacing.md} {spacing.xxs}"
    maxWidth: 1400px
    desktopRightPadding: 376px   # clears the fixed 340px rail + 20px gap + 16px page inset
    wideRightPadding: 436px      # clears the 400px rail at >= 1600px
  privacy-badge:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-muted}"
    border: 1px solid "{colors.hairline}"
    typography: "{typography.micro}"
    fontWeight: 500
    subFontSize: 10px
    rounded: "{rounded.pill}"
    padding: 2px 8px
  sidebar-link:
    backgroundColor: transparent
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    fontWeight: 500
    rounded: "{rounded.md}"
    padding: 10px 12px
    minHeight: 44px
  sidebar-link-active:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary}"
    border: 1px solid "{colors.hairline}"
  sidebar-card:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.caption}"
    border: 1px solid "{colors.hairline}"
    rounded: "{rounded.lg}"
    padding: 14px
  card:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    border: 1px solid "{colors.hairline}"
    rounded: "{rounded.lg}"
    padding: "{spacing.xl}"
    shadowDark: "inset 0 1px 0 rgba(255,255,255,.04)"
    shadowLight: "0 1px 2px rgba(15,23,42,.06), 0 8px 24px rgba(37,99,235,.08)"
  dropzone:
    backgroundColor: transparent
    textColor: "{colors.ink}"
    border: 2px dashed "{colors.hairline-strong}"
    rounded: "{rounded.lg}"
    padding: 42px 20px
    hoverBorder: "{colors.primary}"
    dragoverBackground: "{colors.primary-soft}"
  dropzone-compact:
    border: 2px dashed "{colors.hairline-strong}"
    rounded: "{rounded.lg}"
    padding: 14px 16px
  chip:
    backgroundColor: transparent
    textColor: "{colors.ink-subtle}"
    border: 1px solid "{colors.hairline}"
    typography: "{typography.micro}"
    rounded: "{rounded.pill}"
    padding: 2px 10px
  button:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    border: 1px solid "{colors.hairline}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    minHeight: 44px
    padding: 10px 18px
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    border: 1px solid "{colors.primary}"
    rounded: "{rounded.md}"
    hoverBackground: "{colors.primary-hover}"
  button-danger-confirm:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.danger}"
    border: 1px solid "{colors.danger}"
  field-label:
    textColor: "{colors.ink-subtle}"
    typography: "{typography.caption}"
    fontWeight: 500
  select:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    border: 1px solid "{colors.hairline}"
    rounded: "{rounded.md}"
    padding: 10px 36px 10px 12px
  number-input:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    border: 1px solid "{colors.hairline}"
    rounded: "{rounded.md}"
    fontSize: 16px
    padding: 8px 10px
  segmented-control:
    backgroundColor: transparent
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    gap: 6px
    fontSize: 12px
  segmented-control-active:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary}"
    border: 1px solid "{colors.primary}"
    fontWeight: 600
  advanced-fold:
    borderTop: 1px solid "{colors.hairline}"
    textColor: "{colors.ink}"
    fontSize: 12px
    fontWeight: 600
  settings-collapse:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    border: 1px solid "{colors.hairline}"
    rounded: "{rounded.sm}"
    size: 32px
    icon: "chevron-up; rotates 180deg when collapsed"
  summary-strip:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    border: 1px solid "{colors.hairline}"
    rounded: 10px
    padding: 10px 0
    columns: 4
  summary-stat:
    backgroundColor: transparent
    textColor: "{colors.ink}"
    padding: 0 6px
    textAlign: center
  summary-stat-label:
    textColor: "{colors.ink-subtle}"
    typography: "{typography.micro}"
  summary-stat-value:
    textColor: "{colors.ink}"
    typography: "{typography.stat-value}"
  summary-saving:
    textColor: "{colors.success-text}"
    typography: "{typography.stat-value}"
  summary-saving-zero:
    textColor: "{colors.ink-subtle}"
    typography: "{typography.stat-value}"
  clear-button:
    backgroundColor: transparent
    textColor: "{colors.ink-subtle}"
    border: 1px solid transparent
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    hoverTextColor: "{colors.danger}"
    hoverBorder: 1px solid "{colors.danger}"
  clear-button-armed:
    backgroundColor: transparent
    textColor: "{colors.danger}"
    border: 1px solid "{colors.danger}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
  result-row:
    backgroundColor: transparent
    textColor: "{colors.ink}"
    borderTop: 1px solid "{colors.hairline}"
    padding: 12px 0
  result-thumb:
    backgroundColor: "{colors.surface-2}"
    rounded: "{rounded.md}"
    size: 48px
  result-thumb-stacked:
    size: 84px
  masonry-card:
    rounded: 12px
    padding: 8px
    gap: 8px
    maxThumbHeightSmallPhone: 166px
  format-tag:
    backgroundColor: transparent
    textColor: "{colors.ink-subtle}"
    border: 1px solid "{colors.hairline}"
    fontSize: 11px
    fontWeight: 400
    rounded: "{rounded.xs}"
    padding: 0 5px
  status-pill-done:
    backgroundColor: transparent
    textColor: "{colors.success-text}"
    typography: "{typography.tag}"
    rounded: "{rounded.pill}"
    padding: 1px 8px
  status-pill-processing:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary}"
    typography: "{typography.tag}"
    rounded: "{rounded.pill}"
    padding: 1px 8px
  status-pill-failed:
    backgroundColor: transparent
    textColor: "{colors.danger}"
    border: 1px solid "{colors.danger}"
    typography: "{typography.tag}"
    rounded: "{rounded.pill}"
    padding: 1px 8px
  save-tag:
    textColor: "{colors.success-text}"
    typography: "{typography.caption}"
    fontWeight: 500
  already-best-tag:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-subtle}"
    border: 1px solid "{colors.hairline}"
    fontSize: 11px
    fontWeight: 400
    rounded: "{rounded.xs}"
    padding: 0 5px
    note: "Also used for the small-saving 'Can skip' / 'Try quantize' verdict."
  row-icon:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    border: 1px solid "{colors.hairline}"
    rounded: "{rounded.md}"
    size: 36px          # dense desktop table
    sizeTouch: 44px     # stacked / touch layout
  row-icon-remove-hover:
    textColor: "{colors.danger}"
    border: 1px solid "{colors.danger}"
  note-line:
    textColor: "{colors.ink-subtle}"
    typography: "{typography.caption}"
  table-header:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-muted}"
    border: 1px solid "{colors.hairline}"
    rounded: "{rounded.md}"
    fontSize: 11px
    fontWeight: 600
    letterSpacing: "0.02em"
    padding: "8px 0"
    note: "Image / Format / Original / Compressed / Saved / Dimensions / Status / Actions"
  color-input:
    width: 18px
    height: 18px
    rounded: 4px
    border: 1px solid "{colors.hairline}"
    note: "same size as the advanced checkboxes; show the hex value at the row end"
  sticky-strip:
    position: "sticky, top 0, z 20"
    background: "{colors.canvas}"
    borderBottom: "transparent; hairline when stuck"
    stuck: "only the bottom hairline changes; height and labels stay fixed to avoid jitter"
  progress-track:
    backgroundColor: "{colors.surface-2}"
    border: 1px solid "{colors.hairline}"
    rounded: "{rounded.pill}"
    height: 6px
  progress-fill:
    backgroundColor: "{colors.primary}"
    animation: "stripes 1s linear infinite"
  busy-scrim:
    backgroundColor: "{colors.busy-scrim}"
    position: "fixed inset 0, z 90"
    interaction: "pointer-events auto, cursor wait, touch-action none; page sections are inert; body overflow hidden"
  global-loading-pill:
    backgroundColor: "rgba(20,20,20,.88)"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: 10px 18px
    position: "fixed, viewport centre, z 91"
    interaction: "pointer-events: none; opacity/visibility fade only; role=status"
    subtext: "11px, 75% opacity: wait hint"
  busy-cancel:
    backgroundColor: transparent
    textColor: "#ffffff"
    border: 1px solid rgba(255,255,255,.35)
    rounded: "{rounded.sm}"
    minHeight: 32px
    minHeightTouch: 44px
    interaction: "pointer-events auto inside the status pill"
  preview-card:
    backgroundColor: "{colors.surface-1}"
    border: 1px solid "{colors.hairline}"
    rounded: "{rounded.lg}"
    padding: "{spacing.xl}"
    stageBackground: "{colors.surface-2}"
    stageMaxHeight: 60vh
    compareWidth: "min(100%, calc(55vh * w / h))"
    infoRow: "text left, download button right, one line"
    closeSize: "32px (44px on touch)"
    note: "No zoom controls; zoom lives in the lightbox."
  preview-info:
    textColor: "{colors.ink-subtle}"
    typography: "{typography.micro}"
    layout: "flex, space-between: text left, download button right, one row"
  zoom-button:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    border: 1px solid "{colors.hairline}"
    rounded: "{rounded.sm}"
    typography: "{typography.micro}"
    padding: 3px 8px
    minHeightTouch: 44px
  zoom-button-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    border: 1px solid "{colors.primary}"
  pager:
    textColor: "{colors.ink-subtle}"
    typography: "{typography.caption}"
    buttonMinHeight: 36px
    buttonMinHeightTouch: 44px
  lightbox-overlay:
    backgroundColor: "{colors.overlay}"
    padding: "{spacing.md}"
    zIndex: 50
  lightbox-divider:
    backgroundColor: "#ffffff"
    width: 2px
    handleSize: 40px
    grabStrip: 44px
  lightbox-tag:
    backgroundColor: "rgba(0,0,0,.75)"
    textColor: "#ffffff"
    border: "1px solid rgba(255,255,255,.25)"
    typography: "{typography.micro}"
    rounded: "{rounded.pill}"
  history-row:
    borderTop: 1px solid "{colors.hairline}"
    padding: 10px 0
    typography: "{typography.caption}"
  mobile-tab-bar:
    backgroundColor: "{colors.surface-1}"
    borderTop: 1px solid "{colors.hairline}"
    textColor: "{colors.ink-subtle}"
    activeTextColor: "{colors.primary}"
    typography: "{typography.tab-label}"
    minHeight: 56px
  mobile-sticky-bar:
    backgroundColor: "{colors.surface-1}"
    borderTop: 1px solid "{colors.hairline}"
    padding: 10px 12px
    shadow: "0 -4px 16px rgba(0,0,0,.15)"
  more-menu:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    border: 1px solid "{colors.hairline}"
    rounded: "{rounded.lg}"
    shadow: "0 8px 24px rgba(0,0,0,.18)"
    itemMinHeight: 44px
  footer:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink-subtle}"
    typography: "{typography.caption}"
    padding: "0 16px 40px"
    alignedToMiddleColumn: true
  focus-ring:
    outline: "2px solid {colors.primary}"
    offset: 2px
---

## Overview

This is a **workbench, not a showcase**. The page exists to do one thing: take
images in, hand smaller images back, and never upload them anywhere. Linear's
marketing canvas is the closest reference in the collection — the same
`{colors.canvas}` `#010102`, the same charcoal surface ladder, the same
single-accent discipline and negative display tracking — but the page is
organized as an application, not a landing page.

The page has one fixed frame and three working areas:

1. **Header** — title, a neutral privacy badge, theme / language / GitHub.
2. **Sidebar** — Compress and History at desktop widths; hidden below 1080px.
3. **Work surface** — upload, results, and settings; the settings and preview
   form a fixed 340px (400px on wide screens) rail at the right from 720px up.
4. **Mobile shell** — results, then settings; the compare preview card is
   desktop-only (a row tap opens the full-screen lightbox instead), and a sticky action bar
   and a bottom tab bar replace the desktop chrome.

The compressed image is the protagonist. The interface never decorates the data:
no gradients on surfaces, no hero illustrations, no marketing sections. The only
motion is functional feedback (spinners, a striped progress fill, a thumbnail
crossfade), and the only large color area is the image being compared.

**Key characteristics**

- Near-black canvas, three-step surface ladder, 1px hairlines, almost no shadow.
- One chromatic action color (`{colors.primary}`). It marks primary buttons,
  active segments, focus rings, links, the progress fill, and selected presets —
  never a card fill or a decorative background.
- Green is **earned**: it appears only where bytes were actually saved.
  Already-optimal files are grey. Errors are red. Upscaled dimensions are amber.
- The result summary is a **flat four-cell bar**, not a hero metric: labels
  12px, values 14px, and the saved value in softened green (`{colors.success-text}`).
- Dense data, calm chrome: a 48px-thumbnail table on wide screens, an 84px
  stacked row on tablets (720–1365px), and a two-column image-first masonry on
  phones. Phone cards show a clamped-aspect thumbnail, filename, one meta line
  and a 28px download/share action; dimensions and full notes move into a
  bottom detail sheet.
- System fonts only. No webfont request, no font swap, no layout shift.
- Full local-first promise: the badge, the dropzone line, and the footer all say
  it once; no row repeats it.

## Reference & Adaptation

### Primary reference

**Linear** — [`design-md/linear.app/DESIGN.md`](https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/linear.app/DESIGN.md)
in *VoltAgent/awesome-design-md*. It is the best fit because the project already
uses the same visual grammar:

| Linear principle | This project |
|---|---|
| `#010102` near-black canvas | `{colors.canvas}` = `#010102` |
| `#0f1011` / `#141516` surface ladder | `{colors.surface-1}` / `{colors.surface-2}` |
| `#23252a` / `#34343a` hairlines | `{colors.hairline}` / `{colors.hairline-strong}` |
| `#f7f8f8` / `#d0d6e0` / `#8a8f98` ink tiers | `{colors.ink}` / `{colors.ink-muted}` / `{colors.ink-subtle}` |
| One lavender-blue accent, used scarcely | `{colors.primary}` = `#5b8cff` |
| `#27a644` success green + softened text | `{colors.success}` = `#27a644`, `{colors.success-text}` = `#5fb97a` |
| Negative display tracking, 4px spacing base | `{typography.display}`, `{spacing}` |

### Why Linear

Linear is the closest match in the collection for a **dark, dense, single-purpose
workbench**: the near-black canvas, the charcoal surface ladder, hairline
borders, one scarce accent, and product UI as the protagonist. The alternatives
were weaker fits: Vercel is monochrome and marketing-first; IBM/Carbon is
enterprise and light-first; GitHub has the right data density but not the brand
palette; Figma and Claude are too colorful/editorial for a utility. Linear's
marketing spec still needs a workbench extension, which is why the data table,
stat strip, preview rail and mobile shell are specified here.

### Deliberate adaptations

1. **The accent is shifted toward blue.** Linear's `#5e6ad2` lavender is tuned
   for a dark marketing canvas. This tool also ships a light inverse theme and
   uses the accent on large primary buttons and focus rings; `#5b8cff` (dark) /
   `#2563eb` (light) keeps the same indigo-blue family with better separation
   from the blue-tinted light canvas. It is still the **only** action color.
   The app icon and favicon keep Linear's `#5e6ad2` as the brand mark; that is a
   logo color, not a third UI accent.
2. **Light mode is first-class.** Linear's marketing site does not ship a light
   theme. This is an application, often used beside a document, so the inverse
   theme is complete: `{colors.canvas-light}` `#eef4ff`, white cards, tinted
   hairlines, and a darker primary.
3. **The data table is a workbench extension.** Linear's public spec documents
   marketing cards and changelog rows, not a compression result table. The
   result table, stat strip, preview card, mobile tab bar and sticky action bar
   are specified here in the same token language.
4. **Density is higher than the marketing reference.** Table rows are 12px
   vertical padding, 48px thumbnails, 36px row icons on pointer devices, and
   44px icons on touch. Marketing-sized 24px padding is reserved for cards.

## Colors

### Surfaces

The palette is a three-step ladder. Do not invent a fourth.

| Token | Dark | Light | Use |
|---|---|---|---|
| `{colors.canvas}` | `#010102` | `#eef4ff` | Page background, header, footer |
| `{colors.surface-1}` | `#0f1011` | `#ffffff` | Cards, settings rail, preview card, mobile bar |
| `{colors.surface-2}` | `#141516` | `#f0f6ff` | Controls, thumbnails, stat tiles, chips, row icons |
| `{colors.hairline}` | `#23252a` | `#dbe7ff` | Card borders, dividers, table rules |
| `{colors.hairline-strong}` | `#34343a` | `#d4d4d8` | Dashed dropzone, hover borders |

Dark cards get only an inset top highlight (`inset 0 1px 0 rgba(255,255,255,.04)`).
Light cards get the single soft shadow in `{components.card}.shadowLight`. No
card floats with a large drop shadow.

### Ink

Three text levels, no more:

- `{colors.ink}` — names, values, titles, the thing the user came for.
- `{colors.ink-muted}` — secondary facts, summary details, the privacy badge.
- `{colors.ink-subtle}` — hints, dimensions, notes, captions, disabled-ish text.

Never render the one number the user came for (saved percentage, compressed size)
in `{colors.ink-subtle}`. Never use muted ink for the primary row value.

### Accent

`{colors.primary}` is the single action color:

- Primary button fill, active segmented control, active preset, focus ring,
  progress fill, link actions, selected thumbnail outline.
- `{colors.primary-hover}` for hover; `{colors.primary-soft}` for the active
  wash on segmented controls, presets and the dragover dropzone.
- **Never** use it as a card background, a page section fill, or a decorative
  gradient. One accent, used scarcely.

### Semantic colors

| Token | Meaning | Where |
|---|---|---|
| `{colors.success-text}` | A measured saving (text) | Stat-strip saved value, per-row save tag, history total, preview percentage, done status |
| `{colors.success}` | Success icon/fill | Copy-confirmation check; a stronger green where a fill is needed |
| `{colors.success-soft}` | Reserved success wash | Kept for future success fills; the done status is text-only in 2.1.2 |
| Grey (`{colors.ink-subtle}` + `{colors.surface-2}`) | Already optimal, 0% saving | Already-best tag under the name, zero-saving stat value |
| `{colors.warning}` | Output dimensions grew by upscaling | Lightbox dimension line |
| `{colors.danger}` | Error, failed encode, armed clear | Row error, retry, clear-confirm |
| `{colors.overlay}` | Modal scrim | Lightbox only |

Rules:

- Green is **never** decorative. No green badge for "local processing"; the
  privacy badge is neutral. No green for a 0% saving. No green for an
  already-best file.
- A saving below 10% gets the quiet note line, not a celebration.
- A failed encode is red and offers Retry; it is never a green "done" pill.
- Amber is only for "the output is larger than the input in one dimension".

## Typography

### Family

System UI stack, no webfonts:

```
-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI",
"PingFang SC", "Microsoft YaHei", sans-serif
```

This is also Linear's documented fallback on macOS. It renders Chinese, Japanese,
Korean, French and German natively and costs zero requests.

### Hierarchy

| Token | Size / weight | Use |
|---|---|---|
| `{typography.display}` | 30 / 600 / -0.6px | Page title (26px on mobile) |
| `{typography.stat-value}` | 14 / 600 | Stat-strip values, including the saved percentage |
| `{typography.drop-title}` | 18 / 600 / -0.2px | Dropzone title |
| `{typography.section-title}` | 16 / 600 | "Compression settings" title |
| 15 / 600 (component) | — | "Results" and preview titles |
| `{typography.item-name}` | 13 / 600 | File name in a row |
| `{typography.body}` | 16 / 400 / -0.05px | Default body, number inputs (16px prevents iOS zoom) |
| `{typography.body-sm}` | 14 / 400 | Buttons, sidebar links |
| `{typography.caption}` | 13 / 400 | Notes, dimensions, history rows, save tag (500) |
| `{typography.micro}` | 12 / 400 | Stat labels, preview info, mobile tab labels |
| `{typography.stat-sub}` | 11 / 400 | Stat byte detail, compressed byte detail |
| `{typography.tag}` | 11 / 500 | Status pills |
| `{typography.button}` | 13 / 500 | Buttons; segmented controls use 12px |
| `{typography.numeric}` | 13 / 400, tabular-nums | Sizes, percentages, quality values |

### Principles

- The result summary is a compact four-cell bar: no hero number, no nested
  cards. The saved percentage is the only green value, but it is 14px, not a
  display size; the compressed byte count is the primary detail.
- Negative tracking is reserved for the page title. Body stays at `-0.05px`;
  11–13px labels use `0`.
- File names truncate with an ellipsis and keep the extension visible; they
  never wrap and push the row taller.
- Notes are `{typography.caption}` in `{colors.ink-subtle}` and appear once per
  concern, under the relevant surface, never repeated per row.

## Layout

### Spacing system

Base unit 4px. Tokens: `{spacing.xxs}` 4 · `{spacing.xs}` 8 · `{spacing.sm}` 12
· `{spacing.md}` 16 · `{spacing.lg}` 20 · `{spacing.xl}` 24 · `{spacing.xxl}` 36
· `{spacing.section}` 48.

- Card padding: 24px (16px on mobile).
- Header: 36px top, 16px sides, 4px bottom (24px top on mobile).
- Settings grid: 14px row gap, 16px column gap.
- Result row: 12px vertical padding on the table and stacked tablet row;
  phone masonry cards use 8px internal padding and 8px gaps.
- Page bottom: 48px.

### Container and grid

- Max content width: **1400px**, centered, 16px side padding (12px on mobile).
- **≥ 720px**: two tracks — `minmax(0, 1fr) 340px`, 20px gap. The right rail is
  `position: fixed`, 340px wide, 20px from the top, viewport-height with its own
  scroll. The middle column stacks upload then results.
- **≥ 1080px**: three tracks — `220px minmax(0, 1fr) 340px`. The left sidebar is
  sticky at 20px. History spans all columns.
- **≥ 1366px**: the middle column is wide enough for the fixed-column result
  table (48px thumb + 8px gap + 626px of columns, 682px row minimum). Below
  1366px, rows stack instead of scrolling sideways.
- **≥ 1600px**: the right rail grows to 400px; the middle column keeps the
  remaining space. Header/footer right padding grows to 436px.
- **< 720px**: single column. Empty state shows upload; once results exist the
  upload card is hidden (the sticky Add button takes over), so the visible
  order is results then settings. Results are a two-column masonry (8px gap,
  12px card radius) distributed by JS shortest-column height; the compare
  preview card is not mounted. Tapping a card opens the bottom detail sheet,
  and the mobile shell adds a three-button sticky action bar and a bottom tab
  bar.

The middle column is always `minmax(0, 1fr)` with `min-width: 0`; long
unbreakable names must truncate inside the column, never widen it.

### Vertical rhythm

- Header → work surface: 20px.
- Upload card → results card: 12px at desktop; 16px on mobile.
- Result head → stat strip → rows: 12px each.
- Settings rows: 14px; advanced fold separated by a hairline.
- Footer: 40px bottom padding, aligned to the middle column's left edge at
  desktop (256px left inset at ≥1080px) and clear of the right rail.

### Whitespace philosophy

The dark canvas is the whitespace. Hierarchy comes from surface lift and
hairlines, not from large empty gaps. Empty states may be generous: with no
results, the upload card fills 520px of viewport height and centers the
dropzone; once results exist, the dropzone collapses to a single "+ Add more"
row so the data takes the space.

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| 0 | No shadow, no border | Page canvas, body text, footer |
| 1 | `{colors.surface-1}` + 1px `{colors.hairline}` | Cards, settings rail, preview card |
| 2 | `{colors.surface-2}` + 1px `{colors.hairline}` | Inputs, stat tiles, thumbnails, row icons |
| 3 | Fixed overlay + scrim | Lightbox (`{colors.overlay}`), page drop hint |
| 4 | Blocking scrim + loading pill | Compression/ZIP; locks the page (z 90/91) |

There are no floating cards with large shadows. The only real shadow is the
global loading pill (`0 4px 16px rgba(0,0,0,.25)`), the mobile sticky bar
(`0 -4px 16px rgba(0,0,0,.15)`), and the more-menu (`0 8px 24px rgba(0,0,0,.18)`).
The lightbox is a scrim, not a card.

## Shapes

| Token | Value | Use |
|---|---|---|
| `{rounded.xs}` | 4px | Format tag |
| `{rounded.sm}` | 6px | Zoom buttons, small inline controls |
| `{rounded.md}` | 8px | Buttons, inputs, thumbnails, row icons, stat tiles |
| `{rounded.lg}` | 12px | Cards, dropzone, preview stage, more menu |
| `{rounded.pill}` | 999px | Privacy badge, chips, status pills, progress track, loading pill |

The dropzone's dashed 2px border is the only dashed line on the page. Cards are
never pill-shaped; pills are reserved for tags and tracks.

## Components

### Header

- Title left (`{typography.display}`), subtitle `{typography.body-sm}` in
  `{colors.ink-subtle}`.
- The privacy badge is a **neutral** pill: `{colors.surface-2}` background,
  `{colors.ink-muted}` text, 1px `{colors.hairline}`, 12px/10px two-line text.
  It is not green.
- Right actions: theme icon button, language select, GitHub link. 44px minimum
  height; 8px radius; `{colors.surface-2}` fill.
- Mobile (≤600px): subtitle hidden; the title and badge stack vertically inside
  the `h1`; the action group keeps to the right and wraps to its own row when
  the translated title plus controls do not fit (French/German are much wider
  than Chinese). At ≤380px the GitHub icon is redundant (it is in the More
  menu) and hides, and the badge/controls compact further.

### Sidebar

- Visible only at ≥1080px. Two links: Compress, History.
- 44px minimum height, 10px × 12px padding, 14px/500 text, 8px radius.
- Active: `{colors.primary-soft}` background, `{colors.primary}` text, hairline
  border. Inactive: transparent, `{colors.ink}`.
- Below the links, one small card: "Supported formats" with the format list in
  `{colors.ink-muted}`.

### Upload card & dropzone

- Card: `{components.card}`. The dropzone inside is a dashed well with a 32px
  upload icon, 18px title, 14px hint, a 12px local-processing line, a primary
  "Choose images" button and a secondary "Paste" button, then three chips
  (multiple, max 50 MB, paste shortcut).
- Hover: border `{colors.primary}`. Dragover: border `{colors.primary}` +
  `{colors.primary-soft}` wash.
- With results: on desktop, collapse to a 14px "+ Add more" row, still
  clickable and still a drop target. On phones the whole card is hidden once
  results exist; the sticky bar's Add button opens the same picker, which
  removes ~140px of chrome above the list. If a skipped-file note needs to be
  shown, the compact card reappears for that hint.
- Files can be dropped anywhere on the page; a fixed dashed overlay with
  `{colors.primary}` border and `{colors.primary-soft}` wash says "drop to add
  images" while files are dragged.
- One transient 13px note line below the dropzone reports skipped non-images,
  oversized files, and duplicate files; it clears after 5 seconds.

### Thumbnail strip (desktop, results present)

- A horizontal carousel that now sits **after** the upload card, not inside it:
  96×64px thumbs, 12px gap, 12px name, 11px size, selected tile outlined 2px
  `{colors.primary}` with 2px offset.
- It is **sticky at the viewport top** (`top: 0`, z 20) once the page scrolls
  past it. While stuck it keeps its full height and visible names/sizes; only
  a bottom hairline appears. Do **not** change padding, height or label
  visibility in the stuck state: that reflows the strip at the 0px threshold
  and makes it flip in and out (jitter). Hysteresis alone is not enough if the
  stuck class changes layout.
- No autoplay, no dots. Arrow buttons (32px) page the viewport by whole tiles
  and hide when the tiles fit.
- Each tile is a container with two sibling buttons: a full-tile **select**
  button (`aria-pressed`) and the × **remove** button. No interactive control
  is nested inside another. The full name remains on the tile title.

### Settings panel

Four rows on a shared label column (`max-content`) and a control column
(`minmax(0, 1fr)`), 14px row gap, 16px column gap:

1. **Scene** — a select of five presets plus "Custom". Picking a preset applies
   it; picking "Custom" while a preset is active restores the pre-preset
   settings.
2. **Format** — Smart, Keep original, JPEG, PNG, WebP, AVIF.
3. **Compression** — a three-button segmented control (Smart / Quality / Size)
   with the parameter directly beneath: a quality slider + value, or a KB input
   + 200/500/1000 chips.
4. **Size** — a select of no-resize, 2560/1920/1280 longest side, 1-inch
   (295×413) and 2-inch (413×579) ID photos, plus "Custom…". Custom reveals a
   second segmented control (longest / width / height / percent / crop) and the
   number input(s).

On phones every select/text input is 16px: iOS zooms the page when a focused
control is smaller, which broke the 320px shell when changing language. At
≤360px the two-column grid collapses to one column (label above, control
below) so German/French option text ("Benutzerdefiniert", "Personnalisé") is
not clipped inside a ~150px select.

Below the rows, at most one 13px note line (AVIF download warning, lossless PNG,
target mechanism, or what Smart does). Then the Advanced fold, closed by default:
PNG quantization, keep metadata (JPEG only), JPEG fill color, no-upscale, keep
original filename. Controls use `v-show`, never unmount, so values survive
toggling. The JPEG fill control is the same 18px square as the checkboxes and
shows its hex value at the row's right edge, so a white fill never reads as an
empty checkbox.

At the bottom, a full-width primary button. It is disabled when the list is
empty and reads "Start compression"; with results it becomes "Recompress" (a
manual re-run; uploads and settings changes already run automatically).

Desktop shows a settings header with a 32px chevron icon button (the
`aria-label`/`title` still say Collapse/Expand; the chevron rotates 180° when
collapsed). Mobile hides the header and shows a one-line summary row ("Smart
format · 1920px") that toggles the body; it starts collapsed on narrow screens
so results stay visible. Button labels run 13px (segmented controls and the
Advanced fold 12px).

### Result card

Order inside the card:

1. `ProgressBar` (6px pill track, striped accent fill, 13px text; hidden when
   finished).
2. **Result head** — 15px/600 title, then the actions group: a quiet ghost
   Clear button (two-step confirm, red when armed) and the primary Download all.
   Result-head buttons are 34px tall, 13px, 8px gap. On mobile this group is
   hidden; the sticky bar carries it. The mobile card itself uses 12px padding
   and the head has an 8px bottom margin.
3. **Stat strip** — one flat bar with four centred cells separated by
   hairlines (4 columns at every width; labels 12px, values 14px, byte detail
   11px): Done, Original total, Compressed total, Saved. On phones the padding
   drops to 6px, labels to 10px, values to 13px, and the byte-detail sub-line
   is hidden, leaving a 45px summary. The saved value is
   `{typography.stat-value}` in `{colors.success-text}` only when saved > 0; at
   0% it is `{colors.ink-subtle}` and reads `0%`, never `−0%`. The bar is a
   single 10px-radius surface-2 container, never nested cards.
4. **Rows** — table with a header row at ≥1366px; a stacked 84px-thumb row from
   720–1365px; a two-column masonry below 720px. Stats, thumbnail strip and
   downloads are global. Mobile has no pager, so adding a file never replaces
   the visible page or scrolls back to the top.
5. **Pager** — desktop only, 20 rows per page, previous/label/next, only when
   needed. A new import resets the list to page 1. Changing page scrolls the
   result card back into view instead of leaving the viewport at the pager.
6. If every item is already optimal, a 13px note: "N images uncompressed,
   originals will be kept."

### Result row — table (≥1366px)

Grid: `48px minmax(0, 1fr)` with 10px/8px gaps, 12px vertical padding, 698px
row minimum (48px thumb + 8px gap + 642px of columns), hairline top border
(none on the first row). The meta grid inside is:

```
48px  minmax(96px, 1fr) 68px 68px 46px 144px 80px 116px
image format            orig  comp  save  dims   status  actions
```

A visual header row appears above the table at ≥1366px: a quiet
`{colors.surface-2}` band with an 8px radius, 11px/600 `{colors.ink-muted}`
labels and 0.02em tracking, sharing the same rows template: Image / Format /
Original / Compressed / Saved / Dimensions / Status / Actions. Format and
Dimensions labels and their cells are centered; the other value columns stay
left-aligned. It is hidden below 1366px where rows stack.

- Format: the existing format tag (11px, 1px hairline, 4px radius) occupies
  the first column and is centered there. The filename is deliberately omitted from the desktop
  table: it was truncated in a 118px column and the thumbnail strip already
  names the file. The full name remains on the row's `title`, in the strip, and
  in the stacked mobile row. The already-best and small-saving verdict tags
  sit beside the format tag in the same `name-tags` row.
- Original / compressed: 13px; compressed is the primary value, original is
  `{colors.ink-subtle}`.
- Save: 13px/500 `{colors.success-text}`, `−NN%`; absent at 0%.
- Dimensions: 12px, centered in the column. Always show both values: when
  unchanged they sit on one line as `original → output` (same numbers); a real
  resize stacks vertically (original above, a down arrow, output below); amber
  if the output was upscaled.
- Status: 11px/500 text pill — done (transparent, green-text), processing
  (accent-soft), failed (red outline), cancelled (neutral outline). The pill
  wraps for long translations instead of overflowing its 80px column.
- Actions: copy, download (or share on touch devices with file sharing), remove;
  an error row adds a retry icon before remove. 36px square, 8px radius,
  hairline border, 4px gap. Remove turns red on hover.

No per-row settings gear. No third action beyond copy/share, download, remove.

### Result row — stacked (720–1365px)

`84px minmax(0, 1fr)` with 12px gap, 18px vertical padding. The meta column
wraps: name + format tag on their own line, then original → compressed → save,
then dimensions (stacked with a rotated arrow when changed, one line when
unchanged), status, then actions. Touch row icons are 44px. The arrow is a `→`
rotated 90°.

### Mobile masonry (<720px)

No `column-count` and no `grid-template-rows: masonry`. `src/lib/masonry.ts`
estimates each card as `thumbnail height + fixed information height`, where the
thumbnail height uses the original aspect clamped to 3:4–4:3 (1:1 when unknown)
and a 166px cap on ≤479px viewports. Two arrays of card ids are rendered as two
flex columns; each new card goes to the currently shorter column. Existing ids
stay in their column through queued → processing → done and through imports;
only deletion/clear (and re-entering the mobile layout) rebuilds the columns.

- Card: `{colors.surface}`/`{colors.hairline}`/12px radius; 8px padding; 8px
  column and row gaps. No shadow.
- Thumbnail: `object-fit: cover`; images with either side <64px use
  `object-fit: contain` over a subtle 8px grid. `loading="lazy"` and
  `decoding="async"` on every card image.
- Overlays: top-right translucent pill (11px) for −% / already-best / queued /
  processing / failed; top-left `GIF` chip; bottom-left 14px amber note dot;
  bottom-right 28px download/share button in the card footer; a 3px accent
  indeterminate bar while encoding; failed items get a faint red wash and a
  centered 44px Retry button.
- Text: filename 13px/500, up to two lines with the extension kept visible;
  meta 12px `{colors.ink-subtle}` one line (`388 KB → 156 KB · WebP`). The
  information block reserves the two-line filename height and a 28px action
  row so the height estimate is stable. The card overlay is a sibling button, not a wrapper
  around the download/retry buttons.
- Dimensions are intentionally not on the card; they live in the detail sheet.

### Mobile detail sheet

Tapping a card (other than its download button) opens a bottom sheet
(`role="dialog"`, `aria-modal`, focus trap, Esc/overlay/down-swipe close, body
scroll locked):

1. Original/compressed comparison slider reusing `.pv-*` geometry and
   `useCompareSlider`; clicking the comparison opens the existing Lightbox.
2. Full filename, `orig → out` size, saved %, dimensions (`dimsUnchanged` when
   unchanged), and source → output format.
3. Full note list: errors/cancellations, target note, type note, GIF first
   frame, transparent-to-JPEG note + "Use WebP", small-saving note, already
   optimal, and copy failure.
4. Bottom actions: Copy / Delete / primary. The primary reads "Save to Photos"
   on touch devices whose `navigator.canShare({files})` is true and invokes the
   share sheet; otherwise it reads "Download". Safe-area padding is included.

### Already-best and note states

- Already-best: the output is the original file; a grey 11px tag "No
  compression needed" sits under the name beside the format tag, never in the
  compressed-size column and never green.
- Small saving (<10%): the **same grey bordered tag** as already-best, in the
  same `name-tags` row beside the format tag. The text is "Can skip" (or
  "Try quantize" when the result was lossless PNG). It is a verdict, not an
  error or a status; there is no separate note line.
- Transparent source flattened to JPEG: a 13px note plus a one-tap "Use WebP
  instead" link. Already-best items never show this (no fill happened).
- Animated GIF: a 12px neutral pill "First frame only".
- Error: red 14px message (wraps in the compressed-size cell) + a Retry icon
  in the actions, so long translations never collide with the status column.
  A cancellation uses the same retry path with a neutral label. The row never
  shows a green status while failed.

### Preview card (desktop rail)

- Placed directly under the settings card in the rail (20px gap, no auto
  margin): the old bottom-pinned placement left a large empty band above it.
- Head: 15px/600 title + × close.
- Stage: `{colors.surface-2}` well, max-height 60vh, cursor zoom-in.
- Compare: base compressed image; original layer clipped left of a 2px white
  divider with a 36px round handle and a 44px invisible grab strip. Tags
  "Original" / "Compressed" at the top corners. The wrapper fills the card
  width, capped at `min(100%, calc(55vh * w / h))` for portrait images, so both
  layers stay aligned and the divider spans the picture.
- Info line and download share **one row**: a filename line, then sizes →
  saved percentage on the left (dimensions wrap under the text only when they
  changed), and one primary "Download image" button (or Retry on failure) on
  the right. The name is ellipsized. 12px subtle, percentage in
  `{colors.success-text}`. There are no zoom controls here; zoom lives in the
  lightbox.
- Clicking the stage opens the lightbox; clicks right after a divider drag do
  not.

### Lightbox

- A true `role="dialog"` + `aria-modal="true"` overlay, labelled by the preview
  title. Full-viewport scrim `{colors.overlay}` at z 50, 16px padding, scroll
  locked (body position fixed, restored on close).
- Focus management: the previously focused element is saved, the close button
  receives focus on open, Tab/Shift+Tab are trapped inside the dialog, and
  closing restores focus to the opener.
- Bar: zoom group (Fit / 100% / 200%) left, prev/next 44px buttons, close 44px.
  These controls use dark translucent fills (#fff 12%) independent of the page
  theme, so the light theme never paints a white bar on the black scrim.
- Stage: the compare wrapper shrink-wraps the compressed image; both layers
  share its box at any zoom, so panning scrolls them together.
- Divider: 2px white line, 40px handle, ew-resize, slider role, keyboard
  arrows/Home/End, 44px grab strip, `touch-action: none`.
- Info: filename, dimensions (amber when upscaled), target note, type note.
  Hint: drag to compare; click to cycle fit/100/200; ←/→ switch images; Space
  flips.
- Esc, backdrop click, and × close. Switching images resets zoom to Fit and the
  divider to 50%.

### History view

- A card with a 18px/600 title, a "Clear history" link, and a summary line
  ("N records · total saved").
- Rows: 13px, name (ellipsis), sizes, green percentage, local date, hairline
  between rows. Max 200 records in `localStorage`; nothing leaves the device.
- Empty state: one 14px subtle line, no illustration.

### Mobile shell (<720px)

- Settings card becomes a one-line summary row that expands.
- Result card actions hide; a fixed sticky bar sits above the tab bar with
  three actions: "+ Add", "Clear" (two-step), and "Download all" (primary,
  flex 1), with safe-area padding. Buttons shrink below min-content width so
  the German labels wrap instead of overflowing a 320px screen. The bar is
  shown only on the tool view; the history view hides it (and its spacer) and
  reserves the tab-bar height at the list bottom.
- Bottom tab bar: Home, Settings, More. 56px min height, 20px icons, 11px
  labels, active accent. The bar sits above the More backdrop so tapping
  "More" again closes the menu. "More" opens a 290px, 14px-radius menu above
  the bar with exactly two coming-soon tools:
  - Image format conversion — common formats, one-tap conversion.
  - PDF to Word — local conversion, files never uploaded.
  Each row has a 32px icon, title, one 11px description line and a grey
  "Coming soon" pill. Rows carry `aria-disabled="true"`; clicking only shows a
  lightweight toast. The menu closes on backdrop, More toggle, or Esc. Theme
  and GitHub remain in the header; Clear lives in the sticky bar; History
  remains on desktop.
- The compare preview card is **not mounted** on phones; tapping a card opens
  the detail sheet. The sheet is the only large overlay below the Lightbox.
- The sticky spacer reserves 120px on the tool view so the footer is reachable;
  it is hidden on the history view.
- Card order: empty state upload → results → settings; once results exist the
  upload card is hidden and the sticky Add button takes over, so results sit
  directly under the header. The settings card is collapsed by default on
  narrow screens.

### Progress, loading, motion

- `progress-track` is a 6px pill track; `progress-fill` is an accent fill with
  a 45° stripe animation (1s linear) while work runs.
- The **global loading layer is blocking**. A full-viewport scrim (z 90)
  captures pointer and touch, locks body scroll, and the page sections
  (header, layout, sticky bar, tab bar, more menu, lightbox, footer) are
  `inert`; a centered pill (z 91, 18px spinner + status + an 11px wait hint,
  `role="status"`) sits above it. A fresh batch shows finished/total; a
  recompress shows the generic label. While a compression run is active the
  pill also has a Cancel button (44px on touch) that resolves the run as
  cancelled and terminates the workers. The layer clears only when
  `activeRuns` and `zipping` are zero. New drops/pastes/picker additions are
  ignored while it is up; an attempted add flips the wait hint to "add images
  when it finishes" instead of failing silently. A `beforeunload` prompt
  protects a batch in flight. The summary carries no spinner and no layout
  shift.
- Thumbnails crossfade over 350ms with opacity only; the top layer is the
  current view. Recompressing keeps the old result visible until the new one
  replaces it — never flash back to "processing".
- `prefers-reduced-motion: reduce` disables the thumb fade and the stripe
  animation. Never animate width/height/top/left.

## Interaction rules

- **Automatic by default.** Uploading and changing settings start compression.
  The bottom button is disabled when empty and becomes "Recompress" once
  results exist; it is only a manual re-run. Settings changes never clear the
  current results.
- **Debounce.** Quality slider 300ms; number inputs 500ms; target chips and
  selects commit immediately. No-change updates are ignored.
- **Generation guard.** Each run captures a settings snapshot and a generation
  number; stale results are revoked, never applied over a newer run. A settings
  change during a run marks one trailing run instead of stacking encodes.
- **Already-best is cheap.** If a new setting cannot make an already-optimal
  file smaller, the item is skipped rather than re-encoded.
- **Clear is destructive.** First click arms ("Confirm clear?"), second click
  clears; the armed state expires after 3 seconds. Clear is a ghost button
  (transparent fill, subtle text, red on hover/armed) so it never competes with
  the primary download action; the two-step confirm is the safety, not distance.
- **Global lock.** While a compression run or ZIP packaging is active, the
  blocking loading layer disables pointer/touch, focus, page scroll and the
  lightbox keyboard shortcuts; document-level drops and pastes are ignored.
  It clears only when the run count and the zip flag both return to zero.
  Compression runs can be cancelled from the pill; ZIP packaging currently has
  no cancel path (the button is hidden when only zipping). A cancelled fresh
  item gets a neutral "Cancelled" status and Retry; an existing result is kept
  unchanged.
- **Downloads.** One finished image downloads directly; two or more become one
  ZIP (level 0, folder structure preserved, duplicate names suffixed `-2`).
  Browsers block consecutive downloads, so never fire N downloads.
- **Pagination.** Desktop only, 20 rows per page; a new import resets to page 1;
  selecting an item from another page moves the list there; the preview falls
  back to the first item on the current page; changing page scrolls the result
  card back to the top. Phones render the full masonry without a pager, so an
  import never replaces the visible page or scrolls to the top.
- **Keyboard.** Lightbox: Esc closes, ←/→ switch, Space flips original/compressed;
  the divider keeps its own arrow keys. Dropzone and thumbnails are Enter/Space
  operable.

## Accessibility

- Touch targets: 44px minimum for buttons, selects, row icons and tab items;
  36px is allowed only for dense desktop table icons. Checkboxes are 18px with a
  full-row label hit area.
- Focus: a 2px `{colors.primary}` outline with 2px offset on every focusable
  element. Never remove the outline without a replacement.
- ARIA: dropzone `role="button"` + label; compare divider `role="slider"` with
  min/max/now; progress `role="progressbar"`; expanded/collapsed controls use
  `aria-expanded`; selected strip tiles use `aria-pressed`; buttons without text
  carry `aria-label`.
- Images: row thumbs have the file name as alt; the secondary layer is
  decorative (`alt=""`); the lightbox layers use the file name.
- The blocking loading layer has a `role="status"` pill and an `aria-hidden`
  scrim; the page sections are `inert` and body scroll is locked while it is
  visible, so keyboard and screen-reader users cannot act either.
- The lightbox is `role="dialog" aria-modal="true"`, focuses its close button,
  traps Tab/Shift+Tab, and restores focus to the opener on close.
- The visual table header is `aria-hidden`; each result cell carries a
  visually hidden column label (Name / Format / Original / Compressed / Saved /
  Dimensions / Status), and the filename stays in the accessibility tree even
  when it is visually hidden in the desktop table.
- The thumbnail strip has sibling select/remove buttons, never a button nested
  in a `role="button"` tile.
- `html { touch-action: manipulation }` to remove double-tap zoom while keeping
  pinch zoom. Never use `user-scalable=no`.
- Number inputs render at 16px so iOS does not zoom on focus.
- Contrast: `{colors.ink}` on `{colors.canvas}` and `{colors.ink-muted}` on
  `{colors.surface-1}` must stay above 4.5:1. `{colors.success-text}` is a
  softened green for measured savings: `#5fb97a` on the dark canvas (7.9:1)
  and `#2f7d4a` on the light canvas (4.58:1), so it passes AA at 11px+ in both
  themes. The darker light value is intentional; do not brighten it without
  re-checking the ratio.

## Content & i18n

- Six languages: 中文, English, 日本語, 한국어, Français, Deutsch. Every
  user-facing string lives in `src/i18n/index.ts`; a missing key throws at
  startup by design.
- File sizes use `fmtSize` (1024 base, `B` / `KB` / `MB`). Numbers use tabular
  figures where they change during a run.
- Copy is plain and specific: "Processed locally, never uploaded" — not
  "military-grade privacy". One trust line per surface (badge, dropzone,
  footer); never repeat it on every row.
- Errors say what failed and what to do ("Cannot decode this image", "Retry"),
  never a raw exception.
- File names are user content: truncate with an ellipsis, keep the extension,
  never inject them into `v-html`.

## Do's and Don'ts

### Do

- Keep `{colors.canvas}` (`#010102`) as the anchor surface; the faint blue tint
  is intentional.
- Use the three-step surface ladder for hierarchy; don't skip or invent steps.
- Keep `{colors.primary}` scarce: primary buttons, active segments, focus,
  links, progress, selected tiles.
- Earn green: show it only when bytes were saved. Zero is grey.
- Keep the result summary a compact flat four-cell bar; the saved percentage is
  the only green value, not a hero number.
- Use hairlines for structure; use shadows only for the loading pill, mobile
  bar, and menus.
- Keep the global loading layer blocking: scrim + inert page + locked scroll,
  with `pointer-events: none` only on the status pill itself.
- Keep rows dense: 12px vertical padding, 48px thumbs, 36px icons on pointer
  devices, 44px on touch. Show the visual table header only at ≥1366px.
- Keep the compare divider keyboard-operable and the 44px grab strip invisible
  but real.
- Keep every string in all six languages, and every color/radius/font size in
  `style.less` tokens.
- Verify at 390, 430, 719, 720, 1024, 1440 and 1600px. Run typecheck, unit tests, build,
  and commit `docs/` with `src/`.

### Don't

- Don't use green for branding, privacy, 0% savings, or already-best files.
- Don't put a second chromatic accent on the page; no orange/pink/green
  decoration.
- Don't use gradients on surfaces or cards; no atmospheric backgrounds.
- Don't pill-round cards, buttons, or inputs; pills are for tags and tracks.
- Don't let a spinner reflow a line; indicators are fixed-size and fade only.
- Don't leave the page interactive under the loading pill; the scrim and
  `inert` attributes are the lock, not decoration.
- Don't clear results before a recompress finishes; the old result stays
  visible and downloadable until replaced.
- Don't add a per-row settings gear or a third destructive action.
- Don't fill the destructive clear button like a primary or secondary action;
  keep it ghost and always require the armed second click.
- Don't repeat the privacy promise per row; one line per surface is enough.
- Don't ship a hardcoded string, color, radius, or font size in a component.
- Don't edit `docs/` by hand; it is generated build output.

## Responsive Behavior

### Breakpoints

| Width | Name | Key changes |
|---|---|---|
| ≥1600px | Wide desktop | Right rail 400px; header/footer right padding 436px |
| 1366–1599px | Desktop table | Result table with fixed columns; rail 340px |
| 1080–1365px | Desktop sidebar | Sidebar 220px; results stack (table minimum not met) |
| 720–1079px | Tablet | No sidebar; fixed 340px rail; stacked result rows; desktop preview card |
| 601–719px | Small tablet | Single column, two-column masonry, bottom detail sheet, sticky 3-button bar + tab bar; 16px/12px page padding; header still desktop-style |
| ≤600px | Mobile compact | 16px cards, 28px dropzone, 26px title, stacked header; masonry cards; actions wrap to a right-aligned row when the translated title is long |
| ≤480px | Small phone | Masonry thumbnails capped at 166px; stat labels 10px, values 13px |
| ≤380px | Narrow phone | 24px title; GitHub icon hidden; badge 11/9px, action gap 4px; header wraps with right-aligned actions when the translated title is long |

The stat strip stays four columns at every width; at ≤480px labels shrink to
11px and values to 13px. The header's badge stacks under the title at ≤600px.

### Touch targets

- 44px minimum for buttons, selects, row icons, tab items and menu items.
  36px is allowed only for dense pointer-device controls: desktop table row
  icons and the desktop pager; on touch the pager grows to 44px.
- The preview close button is 32px on pointer devices and 44px on touch; the
  lightbox zoom buttons grow to 44px on touch.
- The compare divider has a 44px invisible grab strip; the visible line stays
  2px.
- Checkbox labels are full-row hit areas; the box itself is 18px.

### Image behavior

- Thumbnails are fixed squares with `object-fit: cover`; never stretch.
- The lightbox fits within 92vw / 76vh and scales to 100/200% without cropping
  the stage (the stage scrolls).
- The preview card always fits the card width (capped for portrait images);
  zoom and panning live in the lightbox, where both layers share one box so
  they never drift.
- Never upscale by default; when the user disables "don't upscale", show the
  output dimensions in amber.

## Implementation Map

### CSS variable mapping (`src/style.less`)

| Spec token | CSS variable |
|---|---|
| `{colors.canvas}` | `--bg` |
| `{colors.surface-1}` | `--card` |
| `{colors.surface-2}` | `--surface-2` |
| `{colors.ink}` | `--text` |
| `{colors.ink-muted}` | `--muted` |
| `{colors.ink-subtle}` | `--subtle` |
| `{colors.hairline}` | `--border` |
| `{colors.hairline-strong}` | `--border-strong` |
| `{colors.primary}` | `--accent` |
| `{colors.primary-hover}` | `--accent-hover` |
| `{colors.primary-soft}` | `--accent-soft` |
| `{colors.success}` | `--green` |
| `{colors.success-text}` | `--green-text` |
| `{colors.success-soft}` | `--green-soft` |
| `{colors.warning}` | `--warn` |
| `{colors.danger}` | `--red` |
| `{rounded.lg}` | `--radius` (12px) |
| `{rounded.md}` | `--radius-sm` (8px) |
| fade | `--fade` (0.35s) |
| easing | `--ease` (`cubic-bezier(.4,0,.2,1)`) |

The light theme lives in `:root[data-theme="light"]`; the dark theme is `:root`.
Theme tokens are CSS custom properties, never Less variables, because the theme
switches at runtime.

### Component map

| Surface | Component |
|---|---|
| Header / badge / theme / language | `src/App.vue` |
| Sidebar, history, mobile tab bar, more menu | `src/App.vue` |
| Dropzone, paste, folder drop | `src/components/DropZone.vue` |
| Settings, presets, advanced | `src/components/SettingsPanel.vue` |
| Desktop result row, thumbnails, copy/share | `src/components/ImageItem.vue` |
| Mobile masonry card (badge, note dot, download/share, retry) | `src/components/MobileCard.vue` |
| Mobile bottom detail sheet | `src/components/MobileDetailSheet.vue` |
| Shared compare-slider mechanics (preview + sheet) | `src/composables/useCompareSlider.ts` |
| Masonry aspect/height estimate + stable two-column distribution | `src/lib/masonry.ts` |
| Lightbox compare + zoom | `src/components/Lightbox.vue` |
| Progress | `src/components/ProgressBar.vue` |
| Preview card (rail, ≥720px) | `src/App.vue` |
| Compression behavior | `src/lib/compress.ts`, `compress-pool.ts` |
| Recompress skip logic | `src/lib/recompress.ts` |
| Pixel safety limit | `src/lib/limits.ts` |
| Tokens / layout / responsive | `src/style.less` |

### Build and verification

- `pnpm dev` — local Vite server.
- `pnpm typecheck` — `vue-tsc --noEmit`.
- `pnpm test` — Vitest unit tests (`tests/unit`, 45 tests, including masonry allocation/aspect and i18n coverage).
- `pnpm build` — Vite build to `docs/` + language shells via
  `scripts/seo-pages.mjs`.
- CI (`.github/workflows/ci.yml`) runs typecheck, tests, build, and fails if the
  committed `docs/` differs from a fresh build. Always commit `src/` and `docs/`
  together.
- The Playwright suite (`tests/suite-vue.js`) runs against the built `docs/`,
  not the dev server.

## Iteration Guide

1. Change a color, radius, or spacing token in `:root` / `:root[data-theme="light"]`
   first. Never hardcode a one-off value in a component.
2. Reuse an existing component and variant before inventing a new visual
   language. A third button style, a second card shadow, or a new accent needs
   explicit justification.
3. Add a user-facing string to all six dictionaries in `src/i18n/index.ts` at
   once; the missing-key guard is the test.
4. Add a state by reusing an existing signal first: `{colors.success}` for a
   real saving, grey for already-best, amber for upscaling, red for errors,
   opacity fades for loading.
5. Verify at 390, 768, 1024, 1440 and 1600px. Check the table breakpoint at
   1366px, the mobile header at 380px, and the sticky bar above the tab bar.
6. Run `pnpm typecheck && pnpm test && pnpm build`; commit `docs/` with `src/`.
7. If the Google DESIGN.md toolchain is available, run
   `npx @google/design.md lint DESIGN.md` after edits.
8. Update this document when a token, breakpoint, or component rule changes —
   a design change that is not in DESIGN.md is a regression.

## Known Gaps

- The light inverse theme is an adaptation, not part of Linear's public spec;
  its contrast should be re-checked whenever the accent or canvas changes.
- Linear's marketing spec has no data table; the result table, stat strip and
  pagination rules here are project-specific extensions.
- The custom Linear Display/Text/Mono families are proprietary. This project
  deliberately uses the system UI stack instead of loading a substitute webfont.
- The app has no automatic contrast test; the light `success-text` was
  darkened to `#2f7d4a` to pass AA, and should be re-checked if the canvas or
  accent changes.
- Mobile screenshot verification uses Chrome's minimum window width (500px) as
  a quirk; use device emulation at 390px for a true narrow-phone check.
- The table's fixed columns assume the 340px right rail; if the rail width
  changes, recompute the 1366px breakpoint (row minimum 698px).
