# Neural motion: physiology and visual interpretation

Research consulted for this update:

- [OpenStax Anatomy & Physiology 2e, 12.4: The Action Potential](https://openstax.org/books/anatomy-and-physiology-2e/pages/12-4-the-action-potential). Successfully retrieved the source. Action potentials begin at the axon initial segment, propagate by local voltage-gated channel activation, and have absolute/relative refractory periods. Myelinated axons conduct between nodes of Ranvier. Real events occur on millisecond timescales.
- [OpenAI Codex authentication](https://developers.openai.com/codex/auth/). Successfully retrieved the source: ChatGPT subscription sign-in and API-key billing are distinct supported methods for local Codex work.
- [Claude Code authentication](https://code.claude.com/docs/en/authentication). Retrieval was denied by the source; implementation claims here are verified against the repository's existing Claude Code integration rather than an unread page.

The previous dendritic outward light wave was an artistic metaphor. The revised animation instead depicts quiet, decremental inputs converging towards the soma, a short localized initial-segment activation, and narrow action-potential propagation along axons. Axon arrivals precede the receiving cell's event. The rest interval between events represents recovery; whole cell bodies no longer flash as if they were light bulbs.

All timing is deliberately slowed for visibility, and highlights represent membrane activity rather than particles travelling inside a tube. This remains anatomy-inspired decorative motion, not a biophysical simulation: no membrane-voltage, channel-kinetic or clinical measurements are claimed. The original branching detail, depth, soft focus, full-card sprawl, Pause and Reduce Motion behaviors are retained.

Provider logos are locally hosted SVG assets sourced from [Lobe Icons](https://github.com/lobehub/lobe-icons/tree/master/packages/static-svg/icons) (MIT-licensed icon collection; provider marks remain their owners' trademarks). They are used to identify the provider/model family, without external image requests from account forms.

Existing-account onboarding deliberately records only that connection selection was deferred. It does not claim a provider is connected, fabricate a model choice, import laptop credentials, or turn subscription credentials into API keys. It opens the original workspace Providers controls. Profile name and email changes use Supabase Auth for the signed-in user; email-change confirmation remains controlled by Supabase.
