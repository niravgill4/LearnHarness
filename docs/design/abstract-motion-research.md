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

## Chosen treatment: Clarity

The user requests serious, abstract, distinctive motion while retaining the dark onboarding UI. The focal work is an original optical surface made from connected strata. Light travels across the field and brings ordered traces into focus. Small irregularities diminish as account setup advances: a visual metaphor for information becoming organized understanding, rather than a literal quiz or a claim about a learner's progress.

The material is monochrome, with fine contour structure, diffuse shading, a narrow moving caustic and restrained spatial grain. The finite, open surface has no closed spinning knot, cartoon illustration, simulated study records, lesson cards or chapter controls. The signup forms keep their hierarchy and position. The scene persists across the shared welcome layout.

## Runtime contract

- Original WebGL 2 shaders, two draw calls per frame, geometry uploaded once. No asset downloads or added rendering dependency.
- Animation capped at approximately 30fps and device pixel density at 1.5. Pointer response is bounded; it does not move forms.
- Pause freezes the animation clock. Hidden/offscreen scenes stop scheduling frames. Live Reduce Motion changes produce a still composition while preserving manual setup.
- An SVG rendering of the same underlying surface remains available before hydration, without WebGL, and during context loss. Context restoration rebuilds resources. GPU resources and observers are released on unmount.
- The animation is an expressive brand surface. It does not represent saved knowledge, API activity or measured learning progress.
