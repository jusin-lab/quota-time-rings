import {readFileSync} from 'node:fs';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {registerAppResource,registerAppTool,RESOURCE_MIME_TYPE} from '@modelcontextprotocol/ext-apps/server';
import {readCodexLimits} from './codex-reader.mjs';
import {demoSnapshot} from './quota.mjs';
import {createResetSignalReader} from './reset-provider.mjs';
import {createQuotaCache} from './quota-cache.mjs';
import {z} from 'zod';
import {uiResourceUri} from './ui-contract.mjs';
import {checkSetup} from './setup-check.mjs';
const VERSION=JSON.parse(readFileSync(new URL('./.codex-plugin/plugin.json',import.meta.url),'utf8')).version;
const html=readFileSync(new URL('./ui.html',import.meta.url),'utf8');
const URI=uiResourceUri(html,VERSION);
const LEGACY_URI='ui://quota-rings/panel.html';
const iconBytes=readFileSync(new URL('./assets/icon-v0.3.0.png',import.meta.url));
const icons=[{src:'data:image/png;base64,'+iconBytes.toString('base64'),mimeType:'image/png',sizes:['1254x1254']}];
// Official entrypoint fallback uses initialize.serverInfo.icons for local MCP servers.
const server=new McpServer({name:'quota-rings',title:'Quota Time Rings',version:VERSION,icons});
for(const resourceUri of [URI,LEGACY_URI]) registerAppResource(server,resourceUri===URI?'quota-rings-panel-'+VERSION:'quota-rings-panel-legacy',resourceUri,{},async()=>({contents:[{uri:resourceUri,mimeType:RESOURCE_MIME_TYPE,text:html,
  _meta:{'openai/ui':{preferredDisplayMode:'fullscreen',availableDisplayModes:['inline','fullscreen']},ui:{prefersBorder:true,csp:{connectDomains:[],resourceDomains:[]}},'openai/widgetDescription':'Three nested rings show remaining Codex quota, natural-window time, and a separately sourced community reset prediction. Unknown prediction remains unknown.'}}]}));
const meta={ui:{resourceUri:URI},'openai/outputTemplate':URI,'openai/widgetAccessible':true};
const sidebarMeta={...meta,'openai/ui':{entrypoints:[{type:'global'}]}};
const annotations={readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false};
const reply=snapshot=>({structuredContent:snapshot,content:[{type:'text',text:snapshot.error?snapshot.error.message:
  snapshot.source==='demo'?'演示数据，不是账户的真实用量。三环分别显示额度、自然周期剩余时间与独立预测。':
  `已读取本机 Codex App Server 返回的 ${snapshot.buckets.length} 个额度桶。此数据不代表其他 ChatGPT 模型的全部限额。`}]});
const readQuota=createQuotaCache(readCodexLimits);
const readResetSignal=createResetSignalReader();
registerAppTool(server,'check_setup',{title:'Check setup',description:'Read-only local startup check for Node.js 20+, Codex App Server and ChatGPT sign-in mode via account/read with refreshToken false. Returns only status enums, never account details or credentials. Does not sign in, switch accounts or change settings. A recognized sign-in does not prove quota availability.',inputSchema:{},annotations,_meta:{...meta,ui:{...meta.ui,visibility:['app']}}},async()=>({structuredContent:await checkSetup(),content:[{type:'text',text:'Local setup check completed. See the localized status and next steps in the panel.'}]}));
registerAppTool(server,'read_quota',{title:'额度时间环',description:'Read quota windows through the official local Codex App Server account/rateLimits/read endpoint and show remaining quota and reset-window time in nested rings. Read-only. No credentials, history, browser cookies, API keys, or raw account identifiers are read by this quota reader. Not a general ChatGPT model quota API.',inputSchema:{forceRefresh:z.boolean().optional()},annotations,_meta:sidebarMeta},async(args)=>reply(await readQuota(args)));
registerAppTool(server,'demo_quota',{title:'演示额度时间环',description:'Show explicitly simulated data for UI evaluation: 80% quota and 30% time remaining in an example window. Does not read any account. Use only when the user requests demo or simulated data.',inputSchema:{},annotations,_meta:meta},async()=>reply(demoSnapshot()));
registerAppTool(server,'read_reset_signal',{title:'Extra reset prediction',description:'Read current public Tibo reset signals from the independent GitHub archive and return a clearly labeled, reproducible weekday estimate. Assumed Pacific timezone is disclosed, never asserted as the author’s location. Separate from official account quota resets. Anonymous public GET only; no account data sent, no credentials, no probabilities. Cached 15 minutes; retains old data with error status if refresh fails.',inputSchema:{forceRefresh:z.boolean().optional()},annotations:{...annotations,openWorldHint:true},_meta:meta},async(args)=>{const snapshot=await readResetSignal(args);return {structuredContent:snapshot,content:[{type:'text',text:snapshot.retrieval==='error'?'The public source could not be refreshed. Any retained forecast is marked stale.':snapshot.signal?'Read public community reset evidence. Any countdown is a stated estimate, separate from the official natural account reset. Source and assumptions are shown in the panel.':'The public source contains no supported reset estimate. No countdown was invented.'}]};});
await server.connect(new StdioServerTransport());
