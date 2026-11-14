# Cognera onboarding

## Approved experience

The user requested the sculpted dark account surface with a serious, abstract animation tied to learning and understanding. The flow is account, provider key, model choice, and optional learning direction. The existing Cognera workspace remains the visual foundation. Account and setup pages are outside workspace providers, so plugins, session lists, keyboard shortcuts, and activity feeds do not mount during setup.

## Routes and persistence

- `/login`: email/password sign-up and sign-in, confirmation/resend, Google and GitHub OAuth through the configured Supabase project.
- `/auth/callback`: exchanges the code, preserves the session cookie, and opens onboarding. Redirect destinations are restricted to local paths.
- `/onboarding`: reads the signed-in user's profile, resumes after a saved key, skips completed setup, and records the chosen model and learning direction.
- `/api/onboarding`: authenticates every read/write, uses the user's Supabase client/RLS, saves encrypted keys in `profiles.encrypted_keys`, and saves model choices and versioned completion in `profiles.model_settings.onboarding`. No migration beyond the upstream profiles table is required.
- The first topic seeds the home composer on the completion redirect only. It does not automatically create a lesson or incur model charges.

API-key entry uses the existing format validation. Saving a key is not a provider-health check: account entitlements and billing are checked when a real provider request runs. Keys are held only in temporary React state until submitted, cleared after saving, and never placed in localStorage, sessionStorage, URLs, or logs. Profile edits compare the old encrypted value before updating and retry collisions, preserving concurrently saved sibling keys. A missing encryption secret or unreadable ciphertext fails closed.

## Motion

A persistent neural micrograph spans both cards. A large foreground cell anchors the left panel with tapering processes and an irregular cropped arbor; two smaller cells recede in scale and light. Three further cells form a shared background across the whole welcome, with extensive branching behind the account form. Cell bodies merge into their processes rather than appearing as separate circular nodes. Quiet dendritic inputs converge towards the soma; a localized initial-segment activation sends a narrow signal down the axon. Arrival precedes the next firing event, with rest between events. Timing is deliberately slowed for visibility. Silver-blue anatomy remains visible between signals. This is an anatomy-inspired illustration, not a biophysical simulation, saved activity or measured learning score. Research and limitations are recorded in [neural-physiology.md](neural-physiology.md). A shared welcome layout preserves it through account navigation. No model requests occur.

Directional edge light, shaded fibre cross-sections, offset contact shadows and small attached dendritic spines give the foreground material depth. Distant anatomy stays softer, including its fine filaments. The user rejected the separate margin connections and requested sprawling anatomy across both cards. The shared field now crosses the gap and fills the card backgrounds. Controls sit above it and occlude the drawing; a cached feathered mask softens the field behind text without rectangular cutouts around whole form sections. Geometry and occlusion update when the layout or form contents change. The field cannot intercept pointer or keyboard input.

The animation clock stops when paused, offscreen or hidden. Canvas 2D caches the complete anatomy once per size change, then draws only the cached image and active signals. Motion has a roughly 30fps cap and pixel density is capped at 1.5. React never rerenders per frame. Live Reduce Motion changes select a still neural composition and remove spatial transitions. A matching SVG fallback preserves the same cells and fibres before hydration, without Canvas 2D or during context loss. Context restoration rebuilds the cache. Phone layouts retain a direct link to account setup. The home atlas keeps its existing connection animation.

The main scene and shared background use one animation clock and one Pause control. Each canvas stops drawing when its own area is offscreen; the clock stops when both are offscreen or the document is hidden. The shared field uses a separate cached canvas in a noninteractive layer above the card ground and below its text and controls. Its matching SVG mounts after layout measurement, including when Canvas 2D is unavailable. The core neural anatomy remains server-rendered. Entering text does not regenerate the field; only changed layout/occlusion geometry invalidates the cache.

The scoped onboarding palette is ground `#0c0e12`, form surface `#1c1f27`, edge `#353a46`, text `#f4f5fa`, secondary text `#b3b9c8`, and accent `#d6e8e0` with dark `#14241f` action text. Display sizes range from 62px on wide screens to 31px on phones, with 34/30px form headings and 16px mobile fields. The neural field uses subdued silver-blue anatomy and a small ivory activation highlight. Existing workspace theme tokens still govern home. These are scoped onboarding refinements; they do not replace the workspace's design system. Current first-party visual research and the material decision are recorded in [abstract-motion-research.md](abstract-motion-research.md).

## Verification and deployment limits

Browser checks exercise form errors, key visibility, provider save, model selection, completion, desktop/iPad/phone layouts and reduced motion. Setup-save browser responses are fixtures; they do not establish live Supabase readiness. Unit coverage checks authenticated key-record round trips, no fallback encryption secret, owner-only edits, concurrent key preservation, failure reporting, and existing API request protections.

The checked-out upstream migration (`9f1767a`) does **not** finish the multi-tenant runtime. The model runtime still reads shared process credentials and local settings, and several activity, settings, plugin and storage paths remain local. This change stops cloud key edits from writing credentials into those shared paths; it does not claim that executing lessons is fully tenant-scoped. The remaining runtime migration must be completed before treating the application as a production multi-user service.

Live verification requires `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and a strong `ENCRYPTION_SECRET` (at least 32 UTF-8 bytes), plus the upstream database migration and configured auth callback URLs. Do not put a service-role key in the browser. Existing encrypted data requires the original encryption secret.
