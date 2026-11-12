# Official-directory submission notes

These are historical directory-submission research notes checked on 2026-11-11. Source-code publication is separate. The plugin has not been submitted to or approved by an official directory; recheck current official requirements before such a submission.

## Verified blockers before a public submission
- OpenAI currently limits local/stdio MCP submissions to approved partners. The publishing organization needs allowlisting by an OpenAI representative. The documented approved local route is Skills only -> Upload ZIP, including the local MCP configuration.
- Verify publisher identity, organization and submission access. Do not use the developer's personal account credentials for reviewers.
- Confirm this read-only quota integration is eligible under the unofficial-connector/usefulness rules; a working official API integration is not directory approval.
- Confirm directory publisher identity and support ownership. Project-authored source is MIT licensed under LICENSE.
- Provide public HTTPS product, support, privacy and terms pages; verified square icon assets and accessible demo video. The included privacy text is a draft.
- Base listing text is English. Listing translation imports do not currently change Directory/API display; widget localization is independent.
- Agree a reviewer workflow for local Codex authentication; do not send account tokens, private configurations, quota snapshots or credentials.
- Approve the exact destination, submitted package/version, listing and consequences immediately before public submission. A later Publish action is separate.

## Distribution scope
The package targets macOS with Node.js 20+ and an authenticated official Codex CLI or ChatGPT desktop installation. Only the MBA build has been exercised. Windows, Linux, web/mobile and cloud-thread execution are not certified. Other users run against their own existing Codex account. No publisher service or API key is bundled.

## Signal sourcing
The runtime now uses anonymous public GETs to the independent GitHub archive named in SIGNALS.md. It provides factual paraphrases and source links, not bundled raw archive content. Repository metadata reports license=null; personal read/use does not establish general redistribution permission. Review public distribution before publishing the provider or any republished data feed. AIHOT is not used.

Weekday estimates are explicitly inferred using the monitor's assumed Pacific-time convention. The author's actual timezone remains unconfirmed. The whole-day interval, midpoint assumption, original publication date and local/upstream check times must remain available. Predictions never replace official natural account resets or assert account entitlement.

## Review test cases
Positive: (1) local signed-in real quota; (2) non-week natural window; (3) explicitly simulated mode; (4) seven UI locales and Auto fallback; (5) a separately sourced extra-reset estimate with disclosed timezone assumptions and DST handling.
Negative: (1) no CLI/no account/query failure stays error, never demo; (2) source errors, unsupported phrasing and missing valid assumptions stay unknown or visibly stale; (3) expired/stale/past signals never claim quota replenished.
Additional: no account identifiers/secrets in responses; bounded parsing; unsafe evidence URL rejected; source/install hashes; official host MCP discovery and resource retrieval; no network listener in installed plugin.

## Sources checked 2026-11-11
- https://developers.openai.com/plugins/deploy/desktop-only
- https://developers.openai.com/plugins/deploy/submission
- https://developers.openai.com/plugins/plugin-guidelines
- https://developers.openai.com/plugins/deploy/app-review
- https://developers.openai.com/plugins/build/plugins
- https://learn.chatgpt.com/docs/app-server
- https://aihot.news/terms
