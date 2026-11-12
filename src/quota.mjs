// Only the fields used by the panel leave this adapter. No credentials, account
// identifiers, credit balances, transcripts, or raw errors are returned.
export const STALE_AFTER_MS = 5 * 60 * 1000;
const finite = x => typeof x === 'number' && Number.isFinite(x);
const text = (x, fallback) => typeof x === 'string' && x.trim() ? x.slice(0,120) : fallback;
export function normalizeRateLimits(result, now = Date.now()) {
  const map = result?.rateLimitsByLimitId;
  const entries = map && typeof map === 'object' && !Array.isArray(map) && Object.keys(map).length
    ? Object.entries(map) : result?.rateLimits ? [[result.rateLimits.limitId ?? 'reported-bucket', result.rateLimits]] : [];
  const buckets = entries.slice(0,50).filter(([,b]) => b && typeof b === 'object').map(([key,b]) => ({
    id: text(b.limitId, String(key)), name: text(b.limitName, text(b.limitId, String(key))),
    windows: ['primary','secondary'].filter(k => b[k] && typeof b[k] === 'object').map(kind => {
      const w = b[kind];
      return { kind,
        usedPercent: finite(w.usedPercent) && w.usedPercent >= 0 ? w.usedPercent : null,
        windowDurationMins: finite(w.windowDurationMins) && w.windowDurationMins > 0 ? w.windowDurationMins : null,
        resetsAt: finite(w.resetsAt) && w.resetsAt > 0 && w.resetsAt < 8.64e12 ? w.resetsAt : null };
    })
  }));
  return {schemaVersion:1, source:'codex-app-server', fetchedAt:new Date(now).toISOString(), buckets,
    ...(buckets.length ? {} : {error:{code:'NO_LIMITS',message:'账户未返回可展示的额度窗口；没有使用模拟数据替代。'}})};
}
export function deriveWindow(window, fetchedAt, now = Date.now()) {
  const remaining = finite(window.usedPercent) && window.usedPercent >= 0 ? Math.min(100,Math.max(0,100-window.usedPercent)) : null;
  const validReset = finite(window.resetsAt) && window.resetsAt > 0 && window.resetsAt < 8.64e12;
  const validDuration = finite(window.windowDurationMins) && window.windowDurationMins > 0;
  const ms = validReset ? window.resetsAt * 1000 - now : null;
  const ratio = validDuration && ms !== null ? ms / (window.windowDurationMins * 60000) : null;
  const stamp = Date.parse(fetchedAt);
  return {quotaRemaining:remaining, timeRemaining:ratio === null ? null : Math.min(100,Math.max(0,ratio*100)),
    expired: ms !== null && ms <= 0, stale: !Number.isFinite(stamp) || now-stamp > STALE_AFTER_MS || stamp-now > 60000,
    inconsistent:ratio !== null && ratio > 1.001};
}
export function demoSnapshot(now = Date.now()) {
  return {schemaVersion:1,source:'demo',fetchedAt:new Date(now).toISOString(),buckets:[{id:'demo-codex',name:'Codex · 演示',windows:[
    {kind:'secondary',usedPercent:20,windowDurationMins:10080,resetsAt:Math.floor(now/1000 + 10080*60*0.3)},
    {kind:'primary',usedPercent:32,windowDurationMins:300,resetsAt:Math.floor(now/1000 + 300*60*0.72)}]}]};
}
export function safeError(code, now=Date.now()) {
  const messages={
    CODEX_NOT_FOUND:'未找到 Codex CLI。请在运行插件的这台电脑上安装官方 Codex，并先登录。',
    TIMEOUT:'读取超时，请稍后重试。未读取凭证或切换到模拟数据。',
    ACCOUNT_UNAVAILABLE:'本机 Codex 未返回账户额度。请确认该电脑上的 Codex 已登录 ChatGPT，且账户支持此查询。',
    INVALID_RESPONSE:'Codex 返回的数据无法解析，请检查版本后重试。',
    SERVER_EXITED:'Codex App Server 提前结束，请检查本机 Codex 是否可以正常运行。',
    READ_FAILED:'读取本机 Codex 额度失败。请检查本机登录状态后重试。'
  };
  return {schemaVersion:1,source:'codex-app-server',fetchedAt:new Date(now).toISOString(),buckets:[],error:{code:messages[code]?code:'READ_FAILED',message:messages[code]??messages.READ_FAILED}};
}
