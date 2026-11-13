# Cognera: abstract onboarding motion

## Live-site research, 13 November 2026

Inspected the current homepages in Chromium, captured two frames per site, and examined rendered media and animation state. Public requests used the environment's verified TLS/proxy trust; no certificate checks were disabled. Research captures are local working evidence, not assets shipped in Cognera.

| First-party reference | What was visible | What informs this work |
| --- | --- | --- |
| [Anthropic](https://www.anthropic.com/) | Large editorial typography above a grainy, luminous field video. The inspected video had reached its eight-second endpoint. | One cinematic material can carry the identity without becoming a miniature product UI. |
| [Google DeepMind](https://deepmind.google/) | An immersive blue field, a large translucent form and small repeated numerals behind the main statement. Some external media requests did not complete, so the captures establish composition rather than full animation behavior. | Use scale, depth and atmosphere; let the form occupy space instead of looking like a small badge. |
| [OpenAI](https://openai.com/) | A restrained white homepage, a direct prompt surface, editorial cards and large negative spaces. No hero canvas/video was present in this inspected viewport. | Restraint around the main task matters as much as the animation. Abstract motion is not universal across these sites. |
| [xAI](https://x.ai/) | Large typography, rotating headline language and product demonstrations, with numerous active animations. | Establish one dominant focal treatment and keep primary actions easy to scan. |
| [Mistral](https://mistral.ai/) | A strict layout with bold typography, brand-specific pixel figures and geometric colored blocks. | A committed visual identity is memorable. Its playful material is outside Cognera's requested tone. |

## Current treatment: neural connections

The user rejected the folded optical surfaces as unpolished and asked for abstract brain-related motion, specifically neurons firing. The approved dark signup UI stays intact. The replacement is an original, anatomy-inspired neural micrograph: a close foreground cell and two smaller cells receding in depth, with uneven branching dendrites and long axons carrying a deliberate firing sequence. It relates learning to forming connections without pretending to show real neural or account activity.

The material uses silver-blue fibres over graphite, with warmer ivory signals. Continuous tapered processes, unequal lateral offshoots, fine internal filaments and restrained membrane texture give the anatomy its detail. A larger cropped foreground arbor overlaps softer, dimmer distant cells; their silhouettes and orientations differ. Each arriving signal briefly gathers in the receiving cell, then spreads through a readable extent of its dendritic arbor before receding. The complete sequence lasts fourteen seconds. The composition extends toward the panel edges with a soft vertical mask protecting text and controls. Signup forms keep their hierarchy and position; the scene persists across the shared welcome layout. The subject is recognizable without a literal brain silhouette or a medical claim.

## Runtime contract

- Canvas 2D with deterministic branching geometry, original cell contours and cached anatomy. The complete structural drawing is cached on resize, leaving only travelling signals and brief activation highlights to draw per frame. No asset downloads or added rendering dependency.
- Animation capped at approximately 30fps and device pixel density at 1.5. Pointer response is bounded to a few pixels; it does not move forms.
- Pause freezes the animation clock. Hidden/offscreen scenes stop scheduling frames. Live Reduce Motion changes produce a still composition while preserving manual setup.
- An SVG rendering of the same underlying cells and fibres remains available before hydration, without Canvas 2D, and during context loss. Context restoration rebuilds the renderer; cached canvases and observers are released on unmount.
- The animation is an expressive brand surface. It does not represent saved knowledge, API activity or measured learning progress.
