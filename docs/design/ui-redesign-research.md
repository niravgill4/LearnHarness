# Cognera UI research and redesign

## Approved direction

The user approved the expressive study: a floating black sidebar, sculpted inset workspace, large left-aligned home typography, a unified composer, neutral learner messages, unboxed assistant text, and a restrained Siri-inspired edge light. Preserve learning, practice, graph, settings, plugin, and keyboard workflows. The study's session text is synthetic, not user history.

## Sources actually inspected

- [Bloom](https://github.com/little-systems/bloom), commit `0ab9f2f08b75cfeffd3040330e312c2244d7726a`: `src/App.css` (control-center tiles, active monochrome buttons), `src/components/QuickPanel.css` (switches, list rows, focus hierarchy), `src/components/EdgeSurface.css` (continuous surface edges), `src/Settings.css`, and spring transitions in `src/App.tsx`. Also compared the user's two Bloom screenshots. Bloom's small notch control sizes were not copied into a reading application.
- [OpenAI Apps SDK UI](https://github.com/openai/apps-sdk-ui), commit `0f00143c7a639906f1621fe58e1b6be7b5bea46d`: typography, primitive/semantic/component tokens, Button and Textarea CSS. This is OpenAI's public kit for apps inside ChatGPT, not the private ChatGPT application source.
- [Vercel Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md): labeling, keyboard focus, portals, reduced motion, content overflow, dark mode, and component state checks.
- Anthropic Frontend Design, Impeccable's Operate and craft-floor guidance, and Vercel React Best Practices: a shared component vocabulary, readable measure, state-driven motion, local editor state, and preserving custom theme/plugin contracts.
- Apple's Human Interface Guidelines, Apple Intelligence, chatgpt.com, and OpenAI brand pages were attempted directly. The environment proxy denied those destinations (403 CONNECT). No claim is made that their live pages were inspected. Siri is the user's named visual reference; its influence here is limited to a bounded active-edge treatment.

## Findings and implementation

1. The old assistant card, blue learner bubble, and broad transcript gave every message equal visual weight. Responses now form a continuous reading column; learner text remains visually distinct in a neutral bubble.
2. Independent capsules below the input fragmented the conversation controls. Home, draft, and active chat now share the same editor and unified toolbar. Active question docks retain their dedicated scroll and morph behavior.
3. The sidebar mixed prominent blue actions, capsule filters, strong borders, and tiny secondary text. It now uses one white primary action, quieter secondary navigation, tonal selection, and an independent floating surface.
4. Surface hierarchy is implemented through theme-derived materials and different corner radii rather than a single rounded-card treatment everywhere. Dark and light custom themes remain usable.
5. Typography uses locally bundled Inter for interface text, with existing reading-font and code-font choices preserved. Bundled Source Sans 3 and JetBrains Mono remove build-time Google Fonts downloads. Font licenses are included beside the assets.
6. Portaled menus and the usage popup escape clipped composers. Hidden navigation is inert. Responsive browser navigation preserves the desktop preference.
7. A populated fixture exposed an existing development SSR failure: React ref objects are sealed, and the input-view reader attached extra fields to them. These reader bridges now use stable extensible objects; populated pages return HTTP 200.

## Verification

Validation uses existing tests plus the running app. Populated lesson/question screenshots use a separate copy of the application and a disposable `/tmp` profile populated through the real ChatStore. No real provider call or paid model is needed. The real profile is not populated with illustrative sessions.

Review desktop, 390px phone, short landscape, expanded questions, settings, stats popovers, attachment popups, model menus, narrow navigation resize/reload, and the no-graph home. Keep explicit user colors and reading-font choices authoritative.

## Final evidence

Production build and lint passed. The selected regression run passed 239 tests; the additional markdown-render suite passed 25. A later 62-test question/editor check also passed (overlapping the regression run, not an additional unique count). The Impeccable component detector reported zero findings. Independent visual/source review returned ship for the supplied home, conversation, settings, question, mobile, and no-graph captures. Browser checks confirmed portaled model/stats/attachment popups, Escape dismissal, preserved desktop navigation preferences after mobile use, and no home overlap in a 640×480 viewport. Provider-backed model turns and every third-party plugin were not exercised.


## Learning-studio revision

The user delegated a further learning-specific redesign while asking to conserve usage. A focused second pass inspected Obsidian's public [JSON Canvas specification](https://github.com/obsidianmd/jsoncanvas/blob/main/spec/1.0.md), [Canvas API types](https://github.com/obsidianmd/obsidian-api/blob/master/canvas.d.ts), [Excalidraw's README](https://github.com/excalidraw/excalidraw), and [Anki's README](https://github.com/ankitects/anki). These support a comparison of spatial connections, whiteboard interaction, and recall-oriented workflows; no claims of improved learning outcomes are inferred from the source inspection.

Home now pairs the actual knowledge atlas with a working desk. Explore and recall controls select existing session modes; Browse connections opens the existing graph picker. The empty atlas is explicitly an explanatory diagram rather than fabricated saved ideas. Active sessions show stages derived from the existing probe/plan/teach phase, without mastery scores. This revision reuses existing editors, providers, graph storage, and question handling.
