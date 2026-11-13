---
name: Cognera
description: A focused learning workspace with sculpted surfaces and a continuous reading canvas.
colors:
  canvas: "#1a1a1e"
  surface: "#24242a"
  edge: "#3b3b43"
  text: "#f2f1f5"
  text-muted: "#b0adbd"
  accent: "#007aff"
  mark-secondary: "rgb(148,148,148)"
typography:
  metadata:
    fontFamily: "lh-interface, sans-serif"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: 1.4
  caption:
    fontFamily: "lh-interface, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.4
  input:
    fontFamily: "lh-interface, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  display:
    fontFamily: "lh-interface, sans-serif"
    fontSize: "44px"
    fontWeight: 450
    lineHeight: 1.16
    letterSpacing: "-0.04em"
  body:
    fontFamily: "lh-interface, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.8
  control:
    fontFamily: "lh-interface, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  control: "12px"
  sidebar: "26px"
  composer: "29px"
  workspace: "30px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.text}"
    textColor: "{colors.canvas}"
    rounded: "{rounded.control}"
  composer:
    rounded: "{rounded.composer}"
---

## Overview

**Creative North Star: "Keep the learning in focus."**

The user-approved expressive direction combines Bloom's monochrome active controls and sculpted materials with a continuous conversational reading canvas. A floating sidebar and inset workspace establish the frame. Home uses one flow-based grid: the primary working desk leads on the left and the actual knowledge atlas aligns beside it. One shared heading replaces competing hero text and duplicate actions. Narrow containers stack the desk above the atlas with a consistent gap. A phase-derived learning journey orients active sessions. A restrained light edge identifies the composer and learning-status island; decorative illustration does not compete with learning content.

## Colors

The values above describe the Default theme. Custom themes and explicit appearance overrides remain authoritative. The black surfaces derive from the active background; light variants derive from white. Semantic success, warning, and error colors retain their meanings. Default bold text is neutral, while configured emphasis colors are preserved.

## Typography

Inter is bundled locally as `lh-interface`. Interface labels use one family with restrained size/weight changes. Reading text defaults to 16px, with comfortable leading; users retain reading-family, size, heading-weight, and serif-title preferences. Source Sans 3 and JetBrains Mono remain bundled choices. Use balanced headings and truncate navigation titles without truncating conversation content.

## Layout

The desktop frame has 16px outer padding and a 12px gap. The sidebar is 240px wide. Conversation content is constrained to a 48rem column. The composer remains narrower and uses the existing question-height and scroll-reserve machinery. Under 928px, browser navigation becomes an independently toggled overlay; widening restores the desktop preference. Phone layouts retain all input controls, wrapping as needed. Short windows keep the editor below the heading.

## Elevation & Depth

Use offset, diffuse shadows for floating surfaces and menus. Assistant text has no surrounding card or shadow. The composer's one-pixel iridescent rim becomes clearer on focus; its focus indicator must not suppress focus in plugin editors outside that surface. Popovers portal out of clipped containers.

## Shapes

Control, navigation, sidebar, composer, and workspace radii have distinct roles. White actions and circular send controls establish hierarchy; secondary controls remain tonal or transparent. Do not turn every label into a bordered capsule.

## Components

Home, draft, and chat share the same Composer. Its toolbar groups attachment, mode/model, thinking, voice, and send. Question and practice docks preserve their folding and editor ownership. Learner messages use neutral bubbles; assistant responses read as a continuous document. Settings use labeled groups and rows with consistent monochrome switches and triggers. Preserve plugin-supplied button colors and native disabled/focus behavior.

## Do's and Don'ts

- Use actual learning records and truthful empty states.
- Preserve user themes, configured emphasis, keyboard shortcuts, and plugin contracts.
- Verify menus, expanded questions, long text, and narrow/short layouts in the rendered application.
- Avoid stock hero illustrations, saturated action clusters, nested message cards, and decorative motion.
- Do not replace accessible focus with visual subtlety.
