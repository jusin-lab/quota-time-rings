import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const version=JSON.parse(readFileSync('plugins/quota-rings/.codex-plugin/plugin.json','utf8')).version;
const client=new Client({name:'quota-rings-validation',version});
const transport=new StdioClientTransport({command:'/bin/sh',args:['plugins/quota-rings/launch.sh'],stderr:'pipe'});
await client.connect(transport);
try {
 const tools=await client.listTools();assert.deepEqual(tools.tools.map(t=>t.name).sort(),['demo_quota','read_quota','read_reset_signal']);
 for(const tool of tools.tools){assert.equal(tool.annotations.readOnlyHint,true);assert.ok(tool._meta.ui.resourceUri.startsWith('ui://quota-rings/panel-v'+version+'-'));assert.match(tool._meta.ui.resourceUri,/-[a-f0-9]{12}\.html$/);}
 const resource=await client.readResource({uri:tools.tools[0]._meta.ui.resourceUri});assert.match(resource.contents[0].mimeType,/text\/html/);assert.match(resource.contents[0].text,/quota-value/);
 const legacy=await client.readResource({uri:'ui://quota-rings/panel.html'});assert.equal(legacy.contents[0].text,resource.contents[0].text);
 const demo=await client.callTool({name:'demo_quota',arguments:{}});assert.equal(demo.structuredContent.source,'demo');assert.equal(demo.structuredContent.buckets[0].windows[0].usedPercent,20);
 console.log(JSON.stringify({tools:tools.tools.map(t=>t.name),resourceMime:resource.contents[0].mimeType,demo:'passed'}));
 if(process.argv.includes('--live')){const result=await client.callTool({name:'read_quota',arguments:{}});console.log(JSON.stringify({live:result.structuredContent},null,2));assert.ok(!result.structuredContent.error,'Live quota read failed');}
} finally{await client.close();}
