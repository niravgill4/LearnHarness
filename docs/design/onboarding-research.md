# Cognera onboarding research — November 2026

This pass refines the approved dark, abstract neural onboarding. It keeps the account → provider → model → first question workflow and adds a continuous visual scene rather than a separate decorative landing page.

## First-party references inspected

| Source | Observation | Application to Cognera |
| --- | --- | --- |
| [Cursor quickstart](https://cursor.com/docs/get-started/quickstart) | Sign in, open a folder, make one useful change, then review it. | Setup ends at the learner's own first question; no extra product tour. |
| [Perplexity getting started](https://www.perplexity.ai/help-center/en/articles/10354975-getting-started-with-perplexity) | Plain-language example questions precede optional personalization. | Topic is optional and phrased as a question, with a clear next action. |
| [Replit get started](https://docs.replit.com/home/get-started) | A coherent project carries the getting-started journey. | One evolving thought sculpture carries all steps, including route navigation. |
| [Granola](https://www.granola.ai/) | A visible raw-notes → enhanced-notes demonstration explains the benefit. | Animation represents ideas becoming connected; the home atlas continues the same visual language. |
| [Notion AI](https://www.notion.com/product/ai) | Concrete activities explain the product before model and administration details. | Learning purpose leads the welcome; provider cost and model details appear at their relevant steps. |
| [OpenAI sign-in troubleshooting](https://help.openai.com/en/articles/6613629-why-cant-i-log-in-to-chatgpt) | The retrieved article concerns API Platform sign-in and stresses using the original authentication method. | Account creation and login share one stable form, with explicit provider choices, pending states and recovery messages. |

Research used publicly accessible first-party page content and help documentation. The interactive ChatGPT, Claude, Replit and Perplexity sign-in pages could not be inspected reliably in the research browser because of this environment's certificate chain. These notes do not claim completed accounts or a pixel-level audit of those private flows.

## Visual and motion decisions

- A quiet two-panel composition: one expressive thought sculpture and one readable task area. No dashboard controls appear before setup completes.
- A single persistent canvas in the shared welcome layout. Contours rotate in depth, signals travel along them, pointer movement shifts the view, and each step changes the sculpture's shape and orientation.
- Headline and form transitions, a shared moving progress selection, and a continuous bottom track explain movement through the journey. Controls never wait for animation to finish.
- Phone and tablet layouts retain a smaller artwork above the form. Inputs remain readable and scrollable, with no horizontal overflow.
- Pause, Reduce Motion, document visibility and intersection handling bound animation. Density and frame rate are capped; drawing does not rerender React each frame.

## Authentication boundaries

The browser uses Supabase's real email/password and PKCE OAuth APIs. `/api/auth/providers` reads public project capabilities before enabling Google or GitHub. The callback exchanges the authorization code into the app session and restricts the onward destination to a local path. Disabled providers are explained instead of sending users to a known failing authorization URL.

Google and GitHub must be enabled in Supabase with each provider's OAuth credentials. Their provider-side callback is the project's `/auth/v1/callback`; Supabase's redirect allowlist must also contain the app's `/auth/callback` on each deployment origin. No provider client secret belongs in this repository or browser. An original, persistent `ENCRYPTION_SECRET` is separately required to save and later read model API keys. A browser fixture proves app behavior, not provider console configuration or a live OAuth round trip.
