// Coalesce callers, but bypass the 30-second successful-read cache on every
// explicit page entry/manual refresh. Never cache an error as fresh data.
export function createQuotaCache(read,{now=()=>Date.now(),ttlMs=30000}={}){
 let cached=null,inFlight=null;
 return async({forceRefresh=false}={})=>{
  if(!forceRefresh&&cached&&now()-Date.parse(cached.fetchedAt)>=0&&now()-Date.parse(cached.fetchedAt)<ttlMs)return cached;
  inFlight??=Promise.resolve().then(read).then(x=>{if(!x.error)cached=x;return x}).finally(()=>{inFlight=null});
  return inFlight;
 };
}
