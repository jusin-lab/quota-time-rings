# Independent reset-source provider

Version 0.3.0 reads the current public index and recent daily records from https://github.com/PengZoneLab/thsottiaux-Tibo-x-monitor. This is an independent archive, not an OpenAI announcement service. The plugin returns short original factual summaries and source links, not raw posts or logs. Its code is not installed or executed.

The supported parser recognizes reset-related English weekday hints in Tibo's own archived words, not quoted third-party conversations. A weekday estimate is anchored to the original publication date. The monitor's Pacific-time display convention is explicitly assumed as America/Los_Angeles; Tibo's own timezone remains unconfirmed. The estimate is the mentioned day's local noon, and the interval covers the full day. IANA timezone conversion handles DST. Ambiguous, conditional, negative, past-event or unsupported explicit-hour expressions do not produce a new estimate.

The third ring uses (estimatedAt - now) / seven days. Its pale arc represents the interval's upper bound. It is not a probability or a natural quota reset. The natural reset ring continues to use the account service's actual window duration and reset time. Passed prediction windows remain expired without asserting that quota replenished.

The reader supports independent provider IDs, sources[] health/last-check records and predictions[] source attribution. Currently one provider is configured. Adding a provider requires its own authorized destination, parser, privacy and licensing review; arbitrary source URLs are not accepted. Failures do not erase the last good in-process result or masquerade as no news. Partial reads and stale upstream scans are visible.

Quota and signal requests are separate. Signals use anonymous GET, fixed-host URL validation, no credentials, no redirects, a 1 MiB response cap and bounded timeout. Cache: 15 minutes on success; one-minute failure backoff. Visible panels refresh every 15 minutes; off, hidden and demo states pause automatic refresh. Opening a panel reads the source independently of the quota result.

External source data is not covered by this project's MIT license. We distribute our parser with synthetic tests; no archive records, screenshots, full posts or monitor source code are bundled. Source links do not imply endorsement. Verify upstream terms before distributing a republished feed. No AIHOT service dependency is used.

The earlier signals.local.json snapshot adapter remains only as a legacy unit-tested helper and is not called by the runtime. Local personal snapshots are excluded from all distribution archives.
