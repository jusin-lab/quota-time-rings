# Privacy and local data

Quota Time Rings runs on the user's computer. The official local Codex App Server performs authenticated account access using the user's existing sign-in. This plugin does not read passwords, browser cookies, authentication files, API keys or conversation history.

On panel startup and explicit rechecks, the plugin checks Node.js and asks the official local service for `account/read` with `refreshToken: false`. That service response may contain profile fields; the adapter discards them and returns only runtime, service and sign-in status enums plus a check time and a safe error code. No account email, account ID, plan details, raw error, executable path or credentials leave this check. Results are kept only in panel memory, not persisted in browser storage. A configured ChatGPT sign-in does not prove that its token is still valid or that a quota query will succeed. The check never initiates sign-in, switches accounts or changes settings.

The plugin receives normalized quota bucket names, percentages, window lengths, reset times and retrieval times. It returns those display values through the MCP host; depending on how the host invokes the tool, the result can appear in the conversation or model context. It does not transmit quota readings to the public-source provider.

Quota reads are cached in memory for 30 seconds. The panel can save its latest successful quota and community-source display snapshots in browser storage and reuse them for up to 24 hours. It keeps their original timestamps and labels restored readings as cached. This is one last snapshot, not a quota history. Invalid or older snapshots are ignored. Clearing the panel's site storage removes these snapshots and its language/refresh preferences. Disabling or uninstalling the plugin does not necessarily erase browser storage or host-retained conversation content.

The separate prediction provider makes anonymous, read-only HTTPS requests to a fixed public GitHub archive at raw.githubusercontent.com/PengZoneLab/thsottiaux-Tibo-x-monitor. It sends no authentication headers or account data. GitHub receives ordinary network request metadata such as the connecting IP address. Original source links open only when the user chooses them. The provider keeps parsed results in memory for 15 minutes; the panel may save the last display snapshot as described above.

There is no plugin telemetry, hosted account service or public network listener. The optional developer preview listens only on loopback and uses a temporary request token. Its live mode and verification scripts can print real quota readings, which should remain in local ignored directories. Source and release packages exclude those readings, personal configuration, backups and credentials.

The community estimate is independent of official quota resets. Source failures, uncertain time zones and future-dated source timestamps are displayed explicitly. No forecast proves that an account quota has reset.
