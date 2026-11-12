# Quota Time Rings · 额度时间环

A local, read-only Codex quota panel with three rings: remaining quota, time until the natural reset, and a separate community reset estimate. Supports seven interface languages, loading indicators, and cached readings while refreshing.

本地只读额度插件：展示 Codex 额度剩余、自然重置倒计时，以及独立的网友重置预测。没有缓存时显示加载状态，有缓存时先展示并后台刷新。

## Requirements and sign-in / 安装与登录

- Node.js 20+.
- An official Codex CLI or desktop installation signed in with the user's own ChatGPT account.
- A desktop host that supports local stdio MCP plugins. Only macOS has been tested; this is not a web/mobile GPT or a hosted remote service.

**No API key, password or token is entered into this plugin.** Sign in through the official Codex flow (for the CLI, run `codex login` and select ChatGPT sign-in). The plugin starts the official local App Server and requests `account/rateLimits/read`; it never reads authentication files itself. Being signed in to the ChatGPT website alone does not verify that the local Codex service is ready. The quota endpoint must be supported for that account.

**无需向插件填写 API Key、密码或令牌。** 用户先在本机通过官方 Codex 登录自己的 ChatGPT 账号，再安装插件。它读取的是使用者本机账号的 Codex 额度，不是开发者的账号，也不是所有 ChatGPT 模型的额度。

Download the source archive or clone the public repository, then run the installation commands from its root:

```sh
git clone https://github.com/jusin-lab/quota-time-rings.git
cd quota-time-rings
codex plugin marketplace add "$PWD"
codex plugin add quota-rings@quota-rings-personal
```

Open “Quota Time Rings / 额度时间环” in the desktop host's plugin/sidebar entry. The server is bundled: installation does not require `npm install`. Local plugin support and the final entrypoint must be verified in the user's host; this repository is not an official directory listing or approval.

Official sign-in reference: https://learn.chatgpt.com/docs/auth

## What the rings mean

1. Quota: `max(0, 100 - usedPercent)` from the official local endpoint.
2. Natural reset: time remaining relative to the service-reported quota window. A completed countdown does not confirm replenishment; refresh to confirm.
3. Community estimate: independent public evidence, separate from official account data. Weekday-only hints assume the monitor's Pacific-time convention and use noon with the entire day as the range. This is an estimate, not an announced reset or a probability.

The community source is https://github.com/PengZoneLab/thsottiaux-Tibo-x-monitor. Anonymous reads send no quota or account information to it. Source links and timing assumptions remain visible. The repository contains our parser and synthetic tests, not copies of archived posts or the monitor's source code. External source content is not covered by this project's license.

## Loading, cache and errors

- An empty panel shows loading while connecting and reading.
- Reopening restores a successful local display snapshot, labeled as cached, and revalidates it. Original timestamps are preserved.
- Cached snapshots older than 24 hours, malformed snapshots, demos and failures are not used as a new successful cache entry.
- Failed reads retain previous values. Unknown values remain unknown.
- `来源扫描时间晚于本机时间` means the monitor's scan timestamp is more than five minutes ahead of the local clock. The source is rejected and any prior reading retained; this does not indicate failed account authentication.
- Quota polling defaults to one minute; five minutes and Off are available. Public-source reads use a separate 15-minute cache. Hidden panels stop polling.

## Privacy

See [PRIVACY.md](PRIVACY.md). No credentials, private configuration, real account snapshots or local test reports are included in the distribution. The UI may store the latest display values in its own browser storage; those are not part of the Git repository. The plugin has no telemetry and listens on no network port. The optional development preview binds to loopback only.

## Development

```sh
npm ci
npm test
npm run build
npm run test:loading
node scripts/smoke-mcp.mjs
node scripts/package-release.mjs
```

`test:loading` uses synthetic data and a locally installed Chrome. `preview:live`, `check:live` and `verify-installed.mjs` explicitly read the developer's own account: keep their output local. Packages are built from an allowlist, excluding caches and local data. Never upload a whole development directory or installed cache.

## License

Project-authored code is MIT licensed; see [LICENSE](LICENSE). Bundled dependencies retain their own notices in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and `licenses/`. The icon was generated with AI and retains its provenance metadata. This project is independent and is not an OpenAI endorsement or an official reset announcement service.

## 0.3.4

Clarifies future-dated source errors while retaining the timestamp checks. Removes machine-specific examples from packaging checks, uses synthetic source fixtures, and includes licensing and installation documentation for source distribution.
