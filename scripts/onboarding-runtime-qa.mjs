import {createServer} from 'node:http';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
// Synthetic host only: no authentication or real account reads.
const html=readFileSync('plugins/quota-rings/ui.html','utf8');
const version=JSON.parse(readFileSync('package.json')).version;
const out=`.validation/onboarding-qa-${version}`;mkdirSync(out,{recursive:true});
const parent=`<!doctype html><style>body{margin:0}iframe{width:100%;height:100vh;border:0}</style><iframe src="/panel"></iframe><script>
window.calls=[];window.mode='signed_out';window.quotaError=false;window.signalError=false;window.holdSetup=false;window.waiting=[];
window.addEventListener('message',e=>{if(e.source!==frames[0]||!e.data.id)return;const m=e.data;calls.push(m);
if(m.method==='ui/initialize'){frames[0].postMessage({jsonrpc:'2.0',id:m.id,result:{hostContext:{locale:'en'}}},location.origin);return;}
const now=new Date().toISOString();let result;
if(m.params.name==='check_setup'){if(holdSetup){waiting.push(m);return;}result={schemaVersion:1,source:'setup-check',checkedAt:now,node:'ok',codex:'ok',login:mode};if(mode==='unknown')result.errorCode='TIMEOUT';}
else if(m.params.name==='read_reset_signal')result={schemaVersion:1,source:'reset-signal',checkedAt:now,status:'unknown',verification:'unavailable',retrieval:signalError?'error':'ok',signal:null,...(signalError?{error:{code:'SOURCE_FUTURE_TIMESTAMP'}}:{})};
else result={schemaVersion:1,source:'codex-app-server',fetchedAt:now,buckets:quotaError?[]:[{id:'synthetic',name:'Example',windows:[{kind:'primary',usedPercent:20,windowDurationMins:300,resetsAt:Date.now()/1000+9000}]}],...(quotaError?{error:{code:'ACCOUNT_UNAVAILABLE'}}:{})};
frames[0].postMessage({jsonrpc:'2.0',id:m.id,result:{structuredContent:result}},location.origin);
});</script>`;
const server=createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(req.url==='/panel'?html:parent);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',headless:true});const errors=[];
try{
 const context=await browser.newContext({viewport:{width:390,height:850},locale:'en-US'}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);const frame=page.frameLocator('iframe');
 await frame.locator('#setup-status').filter({hasText:'Setup needs attention'}).waitFor();assert.equal(await frame.locator('#quota-value').textContent(),'80');
 for(const locale of ['en','zh-CN','zh-TW','ja','es','fr','de']){
  await frame.locator('#settings-toggle').click();await frame.locator('#language').selectOption(locale);await page.keyboard.press('Escape');
  await frame.locator('#help-toggle').click();await frame.locator('#help-panel').waitFor({state:'visible'});
  assert.equal(await page.frames()[1].evaluate(()=>document.activeElement.id),'help-title');
  assert.ok((await frame.locator('#setup-guidance').textContent()).length>20);
  for(const width of [320,390,720]){await page.setViewportSize({width,height:850});assert.equal(await page.frames()[1].evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${locale} ${width}`);}
  await page.setViewportSize({width:390,height:850});
  await page.frames()[1].evaluate(()=>document.getElementById('help-panel').scrollIntoView());
  await page.screenshot({path:`${out}/help-${locale}.png`,fullPage:true});
  await frame.locator('#help-close').click();assert.equal(await page.frames()[1].evaluate(()=>document.activeElement.id),'help-toggle');
 }
 await frame.locator('#settings-toggle').click();await frame.locator('#language').selectOption('en');await page.keyboard.press('Escape');
 await page.evaluate(()=>{mode='unsupported';});await frame.locator('#help-toggle').click();await frame.locator('#setup-retry').click();await frame.locator('#setup-login').filter({hasText:'Not supported'}).waitFor();
 await page.evaluate(()=>{mode='unknown';});await frame.locator('#setup-retry').click();await frame.locator('#setup-status').filter({hasText:'unavailable'}).waitFor();assert.equal(await frame.locator('#setup-login').textContent(),'Unknown');
 await page.evaluate(()=>{mode='chatgpt';});await frame.locator('#setup-retry').click();await frame.locator('#setup-status').filter({hasText:'detected'}).waitFor();assert.match(await frame.locator('#setup-guidance').textContent(),/Only a successful quota read/);
 await frame.locator('#help-close').click();await page.evaluate(()=>{quotaError=true;});await frame.locator('#refresh').click();await frame.locator('#quota-recovery').waitFor({state:'visible'});assert.equal(await frame.locator('#quota-value').textContent(),'80');
 await frame.locator('#quota-help').click();assert.equal(await frame.locator('#help-panel').isVisible(),true);await frame.locator('#help-close').click();
 await page.evaluate(()=>{quotaError=false;});await frame.locator('#quota-retry').click();await frame.locator('#quota-recovery').waitFor({state:'hidden'});
 await page.evaluate(()=>{signalError=true;});await frame.locator('#settings-toggle').click();await frame.locator('#details-label').click();await frame.locator('#signal-refresh').click();await frame.locator('#source-recovery').waitFor({state:'visible'});await page.keyboard.press('Escape');assert.match(await frame.locator('#source-recovery-text').textContent(),/date and time/);
 await page.evaluate(()=>{signalError=false;});await frame.locator('#source-retry').click();await frame.locator('#source-recovery').waitFor({state:'hidden'});
 // A standalone view has no host bridge and must offer instructions, not pass setup.
 await page.goto(`http://127.0.0.1:${server.address().port}/panel`);await page.locator('#quota-recovery').waitFor({state:'visible'});assert.match(await page.locator('#quota-recovery-text').textContent(),/installed plugin/);await page.locator('#help-toggle').click();assert.equal(await page.locator('#setup-login').textContent(),'Unknown');
 assert.deepEqual(errors,[]);const report={version,syntheticData:true,languages:7,widths:[320,390,720],checks:['help focus and closing','localized help and setup','signed out / unsupported / unknown / configured','retry recovery keeps quota','independent source recovery','standalone host guidance'],pageErrors:errors};writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();await new Promise(r=>server.close(r));}
