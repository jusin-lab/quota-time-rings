import {readFileSync} from 'node:fs';
export const WEEK_MS=7*24*60*60*1000;
const MAX_BYTES=64*1024;
const validDate=x=>{if(typeof x!=='string')return false;const m=x.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/);if(!m)return false;const[y,mo,d,h,mi,se]=m.slice(1,7).map(v=>Number(v||0));return mo>=1&&mo<=12&&d>=1&&d<=new Date(Date.UTC(y,mo,0)).getUTCDate()&&h<=23&&mi<=59&&se<=59&&Number.isFinite(Date.parse(x));};
const cleanText=(x,n=500)=>typeof x==='string'?x.replace(/[\u0000-\u001f]/g,' ').slice(0,n):'';
const publicUrl=x=>{try{const u=new URL(x);return u.protocol==='https:'&&!u.username&&!u.password&&['x.com','twitter.com','github.com','raw.githubusercontent.com','openai.com','developers.openai.com','learn.chatgpt.com'].includes(u.hostname)?u.href:null}catch{return null}};
export function normalizeSignal(raw,now=Date.now()){
 const empty={schemaVersion:1,source:'reset-signal',readAt:new Date(now).toISOString(),checkedAt:null,status:'unknown',verification:'unavailable',retrieval:'not-configured',staleAfterMs:86400000,signal:null};
 if(!raw)return {...empty,error:{code:'NOT_CONFIGURED'}};
 if(raw.schemaVersion!==1||raw.source!=='reset-signal'||!validDate(raw.checkedAt)||Date.parse(raw.checkedAt)>now+60000)return {...empty,retrieval:'error',error:{code:'SOURCE_CHANGED'}};
 const signal=raw.signal;const originalUrl=publicUrl(signal?.originalUrl),evidenceUrl=publicUrl(signal?.evidenceUrl);
 if(!signal||!originalUrl||!evidenceUrl||!validDate(signal.publishedAt))return {...empty,checkedAt:raw.checkedAt,retrieval:'error',error:{code:'SOURCE_CHANGED'}};
 const pred=signal.prediction||{},earliest=validDate(pred.earliestAt)?pred.earliestAt:null,latest=validDate(pred.latestAt)?pred.latestAt:null;
 const timezone=cleanText(pred.timeZone,80)||null;let validZone=false;try{if(timezone){new Intl.DateTimeFormat('en',{timeZone:timezone});validZone=true}}catch{}
 // Offset-bearing timestamps alone do not establish the source's timezone.
 const timed=Boolean(earliest&&latest&&Date.parse(earliest)<=Date.parse(latest)&&validZone&&pred.timeBasis==='explicit-source');
 const summary={};for(const [locale,value]of Object.entries(signal.summary||{}).slice(0,20))if(/^[a-z]{2}(?:-[A-Za-z]{2,4})?$/.test(locale)&&typeof value==='string')summary[locale]=cleanText(value);
 const status=['hint','announced','confirmed'].includes(raw.status)?raw.status:'unknown';
 const verification=['primary','secondary-only'].includes(raw.verification)?raw.verification:'unavailable';
 // “confirmed” is accepted only with explicitly reviewed primary evidence. It still does not establish this account was reset.
 const safeStatus=status==='confirmed'&&verification!=='primary'?'unknown':status;
 return {...empty,checkedAt:raw.checkedAt,status:safeStatus,verification,retrieval:verification==='primary'?'ok':'partial',signal:{publishedAt:signal.publishedAt,publishedPrecision:signal.publishedPrecision==='minute'?'minute':'second',originalUrl,evidenceUrl,attribution:cleanText(signal.attribution,120),evidenceKind:verification==='primary'?'primary':'secondary-archive',summary,prediction:{earliestAt:timed?earliest:null,latestAt:timed?latest:null,timeZone:validZone?timezone:null,timeBasis:timed?'explicit-source':'unspecified',assumption:cleanText(pred.assumption),assumptionKey:timed?'explicitSource':'noTimezone'}},...(!timed?{error:{code:'NO_RELIABLE_SIGNAL'}}:{})};
}
export function readResetSignal({file=new URL('./signals.local.json',import.meta.url),now=Date.now(),read=readFileSync}={}){
 try{const raw=read(file);if(raw.length>MAX_BYTES)return {...normalizeSignal(null,now),retrieval:'error',error:{code:'SOURCE_CHANGED'}};return normalizeSignal(JSON.parse(raw.toString('utf8')),now)}catch(e){return {...normalizeSignal(null,now),...(e?.code==='ENOENT'?{}:{retrieval:'error',error:{code:'SOURCE_UNAVAILABLE'}})}}
}
export function derivePrediction(signal,now=Date.now()){
 const p=signal?.prediction;if(!p||!validDate(p.earliestAt)||!validDate(p.latestAt)||!p.timeZone||p.timeBasis!=='explicit-source')return {known:false,lowerPercent:null,upperPercent:null,expired:false};
 const start=Date.parse(p.earliestAt),end=Date.parse(p.latestAt);if(start>end)return {known:false,lowerPercent:null,upperPercent:null,expired:false};
 const pct=x=>Math.max(0,Math.min(100,(x-now)/WEEK_MS*100));
 return {known:true,lowerPercent:pct(start),upperPercent:pct(end),expired:end<=now,windowStarted:start<=now,beyondScale:start-now>WEEK_MS||end-now>WEEK_MS};
}
