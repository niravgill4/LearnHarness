# Notebook refinement — proposed revision

## Visual direction

Use Cognera's existing theme tokens, typography, rounded controls, and quiet
charcoal surfaces. Replace the stacked header/toolbar rows with a compact page
header and contextual tool palette. Keep destructive and occasional actions in
menus rather than permanently competing with writing tools.

```text
Cognera sidebar | Notebook / page title                 Saved  ···
                | compact colored section tabs
                | page rail |                                  |
                | search    |     continuous writing canvas    |
                | pages     |                                  |
                |           |  [Write Draw Hand | tools]        |
                |           |                [− 100% +  Fit]   |
```

- Slim, collapsible notebook/page navigation with clear selected states.
- Notebook/section/page creation remains easy to find; rename, move, reorder,
  delete, backup/restore, and printing remain available in contextual menus.
- Floating palette for Write, Draw, and Hand. In Draw mode expose pen,
  highlighter, eraser, ink colors, thickness, and undo/redo. Keep rich text
  formatting contextual to the selected text block.
- Plain, ruled, and grid surfaces with a light/dark paper choice. Existing notes
  retain light paper on first open so their original ink remains readable.
  New dark-paper notes start with an appropriate contrasting ink color.
- Use touch targets of at least 44 pixels on tablets, safe-area spacing, clear
  focus indicators, and no decorative animation behind the writing surface.

## Continuous canvas

- Replace the fixed paper rectangle with a camera over document coordinates.
  Pan and write beyond every former page edge, including left/up; do not grow an
  enormous canvas bitmap as the document expands.
- Render ink at viewport resolution, accounting for pixel density, and position
  text blocks using the same camera transform. Keep paper patterns aligned with
  document coordinates during pan and zoom.
- Preserve existing saved coordinates exactly. Accept expanded coordinates in
  storage validation without requiring users to recreate their notes.
- Keep drawing updates out of React's per-point render path. Cache gesture
  geometry and schedule camera rendering with animation frames.
- Keep persistence/recovery/conflict protections and editable vector backups.
  Print/PDF uses content bounds rather than the former fixed sheet boundary.

## Gestures and navigation

- Two-finger pan and pinch-to-zoom on the canvas in both Write and Draw modes.
- Zoom is anchored to the gesture midpoint: the content under the fingers stays
  there while the fingers move. Support 0.1–500% view zoom so very large notes
  can also fit on screen.
- Apple Pencil writes; fingers navigate by default. Finger drawing remains an
  explicit option. A second finger switches a finger gesture to navigation and
  must not leave an accidental ink stroke.
- Hand mode pans with mouse or one finger. Add trackpad pinch/Ctrl-wheel zoom,
  zoom buttons, and Fit content as alternatives to touch gestures.
- Remember the camera per page on the current device; do not force another
  device to use a camera sized for a different screen.

## Verification

Check old-note compatibility, drawing/text beyond the old bounds, negative
coordinates, reload and recovery, pinch anchoring, two-finger pan, transition
between finger drawing and navigation, Pencil/palm separation, undo/redo,
eraser/highlighter behavior after zoom, export bounds, keyboard controls, and
tablet/phone layouts. Use synthetic browser pointer tests and explicitly
distinguish those from physical iPad/Safari testing.

Cloud notebook tables still require the existing migration if it has not been
applied. This redesign does not remove authentication, privacy policies, or
optimistic save version checks.
