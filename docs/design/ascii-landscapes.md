# ASCII landscape surfaces

## Direction contract

THESIS: Cognera's learning space opens onto a living landscape made of halftone dots. The artwork carries the personality; the existing learning tasks and account forms stay familiar.

OWN-WORLD: Ink #101312, panel #1b211f, line #48514a, chalk #f3f5ee, mist #bec7be; each landscape supplies a small natural accent. Locally bundled Inter stays the interface voice. Landscape pixels are colored dots, never a filter over real learning records. Buttons remain solid and labels readable.

STORY: Sign in, connect a provider, choose the three model roles, start learning. Landscape shuffle/pause is optional and does not reset any form or draft.

FIRST VIEWPORT: One continuous video sits under two equally sized onboarding cards, separated by an ink gutter. Existing heading and form copy stay above localized dark scrims. The main page uses a wide landscape above the real learning desk/atlas; conversations keep a clear reading surface. Mobile stacks the panels and keeps every control available.

FORM: seed: none (pinned). User: “Half the video should be on the left card, half the video should be on the right card” and “all the same [text] should be on top … easily clickable and viewable.” Code-led implementation using the supplied five ASCII Magic exports. Every full page load selects a different landscape from the previous load. Route/form steps keep the same scene.

FINISH: Ship verdict after review: all five supplied scenes remain faithful; forms are legible; motion and performance meet the runtime constraints below. The 320px atlas action clipping found during review is resolved. DESIGN.md and its sidecar record the implemented system; shipping landscape derivatives carry their provenance in public/landscapes/SOURCES.md.

## Sources

- https://www.ascii-magic.com/ascii — gallery reports 89 landscape pieces across 24 categories overall. Inspected the complete landscape listing: mountains, forests, underwater scenes, deserts, rivers, architecture and coasts. Gallery FAQ states the pieces are MIT licensed.
- Five user-supplied 1920×1080 MP4 exports: rainforest-falls-mist, lighthouse-storm, cherry-blossom-river, camel-caravan-dusk, autumn-pagoda-maples. Local shipping MP4s and WebP posters are optimized derivatives of these exports; no generated substitute art or remote embed.
- `public/landscapes/SOURCES.md` records file provenance and processing. A credit link is available with the scene controls.

## Runtime constraints

One native video per active scene surface. Muted inline playback; static poster for reduced motion, data saving, blocked autoplay, loading and errors. Pause when offscreen or document hidden. No animation-driven React updates. Background media never captures pointer events. Scene selection and motion preference use versioned browser storage and remain optional when storage is unavailable. No auth/model/storage behavior changes in this visual refresh.
