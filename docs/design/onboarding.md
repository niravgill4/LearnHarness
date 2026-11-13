# Cognera onboarding

## Approved experience

The user approved a sculpted dark account surface with an interactive neural ribbon, followed by account, provider key, model choice, and optional learning direction. The existing Cognera workspace remains the visual foundation. Account and setup pages are outside workspace providers, so plugins, session lists, keyboard shortcuts, and activity feeds do not mount during setup.

## Routes and persistence

- `/login`: email/password sign-up and sign-in, confirmation/resend, Google and GitHub OAuth through the configured Supabase project.
- `/auth/callback`: exchanges the code, preserves the session cookie, and opens onboarding. Redirect destinations are restricted to local paths.
- `/onboarding`: reads the signed-in user's profile, resumes after a saved key, skips completed setup, and records the chosen model and learning direction.
- `/api/onboarding`: authenticates every read/write, uses the user's Supabase client/RLS, saves encrypted keys in `profiles.encrypted_keys`, and saves model choices and versioned completion in `profiles.model_settings.onboarding`. No migration beyond the upstream profiles table is required.
- The first topic seeds the home composer on the completion redirect only. It does not automatically create a lesson or incur model charges.

API-key entry uses the existing format validation. Saving a key is not a provider-health check: account entitlements and billing are checked when a real provider request runs. Keys are held only in temporary React state until submitted, cleared after saving, and never placed in localStorage, sessionStorage, URLs, or logs. Profile edits compare the old encrypted value before updating and retry collisions, preserving concurrently saved sibling keys. A missing encryption secret or unreadable ciphertext fails closed.

## Motion

One bounded Canvas sculpture responds to pointer movement and morphs between setup stages. A shared welcome route layout keeps it mounted between login and setup. It reappears behind the explanatory empty atlas, where the connection lines draw on arrival. Animation uses no React state per frame, caps frame rate and pixel density, and stops offscreen, while the document is hidden, or when paused. Reduce Motion produces a static composition and removes spatial step transitions. Forms remain available during the effect. Small screens prioritize forms and retain a smaller welcome illustration above them.

The scoped onboarding palette is ground `#0c0e12`, form surface `#1c1f27`, edge `#353a46`, text `#f4f5fa`, secondary text `#b3b9c8`, and accent `#d6e8e0` with dark `#14241f` action text. Display sizes range from 62px on wide screens to 31px on phones, with 34/30px form headings and 16px mobile fields. The sculpture's silver, mist-blue, lilac, and green inks belong to the illustration. Existing workspace theme tokens still govern home. These are scoped onboarding refinements; they do not replace the workspace's design system. First-party sources and the resulting decisions are recorded in [onboarding-research.md](onboarding-research.md).

## Verification and deployment limits

Browser checks exercise form errors, key visibility, provider save, model selection, completion, desktop/iPad/phone layouts and reduced motion. Setup-save browser responses are fixtures; they do not establish live Supabase readiness. Unit coverage checks authenticated key-record round trips, no fallback encryption secret, owner-only edits, concurrent key preservation, failure reporting, and existing API request protections.

The checked-out upstream migration (`9f1767a`) does **not** finish the multi-tenant runtime. The model runtime still reads shared process credentials and local settings, and several activity, settings, plugin and storage paths remain local. This change stops cloud key edits from writing credentials into those shared paths; it does not claim that executing lessons is fully tenant-scoped. The remaining runtime migration must be completed before treating the application as a production multi-user service.

Live verification requires `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and a strong `ENCRYPTION_SECRET` (at least 32 UTF-8 bytes), plus the upstream database migration and configured auth callback URLs. Do not put a service-role key in the browser. Existing encrypted data requires the original encryption secret.
