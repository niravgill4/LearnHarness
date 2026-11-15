---
name: Cognera
description: A focused learning workspace opening onto living halftone landscapes.
colors:
  canvas: "#1a1a1e"
  surface: "#24242a"
  edge: "#3b3b43"
  text: "#f2f1f5"
  text-muted: "#b0adbd"
  accent: "#007aff"
  mark-secondary: "rgb(148,148,148)"
  onboarding-ground: "#101312"
  onboarding-surface: "#1b211f"
  onboarding-line: "#48514a"
  onboarding-ink: "#f3f5ee"
  onboarding-muted: "#bec7be"
  onboarding-action-ink: "#17231a"
  scene-rainforest: "#b8d5aa"
  scene-lighthouse: "#b8cddd"
  scene-cherry-blossom: "#e3b9cc"
  scene-caravan: "#e4c69c"
  scene-maples: "#e3b59c"
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
  onboarding-display:
    fontFamily: "lh-interface, sans-serif"
    fontSize: "58px"
    fontWeight: 450
    lineHeight: 1.08
    letterSpacing: "-0.04em"
  studio-display:
    fontFamily: "lh-interface, sans-serif"
    fontSize: "36px"
    fontWeight: 450
    lineHeight: 1.17
    letterSpacing: "-0.035em"
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
  onboarding-action: "10px"
  onboarding-input: "11px"
  onboarding: "24px"
  onboarding-phone: "20px"
  sidebar: "22px"
  composer: "20px"
  workspace: "23px"
  workspace-phone: "18px"
  hero: "17px"
spacing:
  xs: "8px"
  sm: "12px"
  frame: "14px"
  md: "16px"
  landscape-gutter: "20px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.text}"
    textColor: "{colors.canvas}"
    rounded: "{rounded.control}"
  onboarding-primary:
    backgroundColor: "var(--landscape-accent)"
    textColor: "{colors.onboarding-action-ink}"
    rounded: "{rounded.onboarding-action}"
    padding: "13px 16px"
  onboarding-input:
    backgroundColor: "{colors.onboarding-surface}"
    textColor: "{colors.onboarding-ink}"
    rounded: "{rounded.onboarding-input}"
    padding: "0 14px"
    height: "47px"
  composer:
    rounded: "{rounded.composer}"
---

## Overview

**Creative North Star: "Keep the learning in focus."**

Cognera opens onto the user's five supplied ASCII Magic halftone landscapes. Their colored dots carry the visual personality, while account forms, the learning desk, and the knowledge atlas retain their familiar copy and behavior. One continuous landscape plane crosses the two onboarding cards; the main workspace gives the landscape a wide header and a small still in navigation.

Floating monochrome navigation and an inset workspace frame the actual learning content. Home keeps the working desk on the left and the real knowledge atlas beside it, stacking them in narrow containers. Conversations retain a continuous reading canvas with neutral learner bubbles and unboxed assistant replies.

**Key Characteristics:**

- Supplied halftone landscapes with scene-derived accents.
- One continuous onboarding video beneath two equal desktop cards.
- Quiet, theme-aware learning surfaces and a unified composer.
- Readable forms, optional landscape controls, and still-image fallbacks.

## Colors

The Default workspace neutrals above remain theme-aware. The onboarding palette supplies a deep green-black ground, a legible field surface and line, chalk text, and muted supporting text. Scene accents follow the selected rainforest, lighthouse, cherry blossom, caravan, or maple landscape; they color onboarding primary actions, scene indicators, and restrained focus or active details.

Custom themes and explicit appearance overrides remain authoritative in the workspace. Black surfaces derive from the active background; light variants derive from white. Semantic success, warning, and error colors retain their meanings. Default bold text is neutral, while configured emphasis colors are preserved.

**The Readable Foreground Rule.** Keep text and controls above localized dark scrims; landscape pixels must not become a filter over forms or learning records.

## Typography

Inter is bundled locally as `lh-interface`. Interface labels use one family with restrained size and weight changes. The onboarding display grows to 66px on wide screens and reduces to 39px on phones; the studio display reduces to 29px on phones. Reading text defaults to 16px with comfortable leading; users retain reading-family, size, heading-weight, and serif-title preferences. Source Sans 3 and JetBrains Mono remain bundled choices. Use balanced headings and truncate navigation titles without truncating conversation content.

## Layout

The desktop workspace has 14px outer padding and a 14px gap. The sidebar is 240px wide. Conversation content is constrained to a 48rem column. The composer uses the existing question-height and scroll-reserve machinery. Under 928px, browser navigation becomes an independently toggled overlay; widening restores the desktop preference. At phone widths the workspace frame uses 8px padding.

Onboarding has a maximum width of 1440px and two equal desktop cards separated by a 20px ground-colored gutter. A single video covers the shared plane beneath both cards; each card clips and scrims its own foreground. The desktop plane has a 680px minimum height, and the form card scrolls independently when needed. At 950px and below, the cards stack with a 16px gutter and the page scrolls. At 520px and below, cards use the phone corners and form inputs retain a readable 16px size.

Home places the landscape header above one flow-based desk/atlas grid with 24px gaps and margins. At a studio container width of 800px and below, the desk stacks above the atlas. Atlas actions wrap inside the available width, including at 320px. Phone layouts retain all input controls; short windows keep the editor below the heading.

## Elevation & Depth

Use tonal layers, fine borders, and localized scrims to separate the landscape from interaction. Onboarding cards have no drop shadow; the form content receives an additional dark scrim. The composer has a quiet diffuse shadow and a scene-tinted focus border. Its earlier iridescent rim and the learning-status island rim are suppressed in the landscape workspace.

Menus retain offset diffuse shadows and portal out of clipped containers. Assistant text has no surrounding card or shadow. Preserve accessible focus in plugin editors outside the composer surface.

## Shapes

Use the distinct corner roles in the frontmatter: broad onboarding cards, slightly tighter workspace and sidebar frames, a compact composer, and a landscape header that shares its corners with the atlas. Onboarding cards tighten on phones; the workspace frame also has its own phone radius. White workspace actions, solid scene-colored onboarding actions, and circular scene/send controls establish hierarchy. Secondary controls remain tonal or transparent. Do not turn every label into a bordered capsule.

## Components

Home, draft, and chat share the same Composer. Its toolbar groups attachment, mode/model, thinking, voice, and send. Question and practice docks preserve their folding and editor ownership. Learner messages use neutral bubbles; assistant responses read as a continuous document. Settings use labeled groups and rows with consistent monochrome switches and triggers. Preserve plugin-supplied button colors and native disabled/focus behavior.

Onboarding keeps existing account, provider, model-role, and first-question flows and copy. Fields use the onboarding surface and line tokens. Primary actions take the current scene accent and dark action ink; hover lightens the accent, and focus stays explicit. Account availability and provider requirements remain truthful.

The landscape uses local MP4 derivatives and matching WebP posters of the five supplied exports: rainforest falls, lighthouse in the storm, cherry blossom river, caravan at dusk, and autumn among the maples. A full page load chooses a scene different from the preceding load when browser storage is available. Route and form steps keep the same scene; shuffle and pause do not reset forms or drafts. The sidebar thumbnail is a static poster that also shuffles the shared scene.

One native muted, inline video serves each active landscape surface. Reduced motion and data saving retain the still without loading the video. Offscreen or hidden surfaces pause; blocked autoplay and media errors retain the poster. Background media is decorative and never captures pointer events. Motion uses no frame-by-frame React updates. Scene controls offer shuffle, pause/play, and an artwork credit on onboarding; controls grow from 36px to 40px on phones.

## Do's and Don'ts

- Do use actual learning records and truthful empty states.
- Do preserve user themes, configured emphasis, reading preferences, keyboard shortcuts, and plugin contracts.
- Do use the five supplied landscape exports and their local derivatives; retain the provenance in `public/landscapes/SOURCES.md`.
- Do keep forms legible above the shared landscape and preserve all existing copy and product flows.
- Do verify menus, expanded questions, long text, and narrow or short layouts in the rendered application.
- Don't replace accessible focus with visual subtlety.
- Don't replace supplied artwork with generated substitutes, decorative stock scenes, or remote embeds.
- Don't add landscape motion to the reading canvas or use it to obscure learning records.
