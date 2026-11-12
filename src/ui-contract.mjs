import {createHash} from 'node:crypto';
/** UI revisions must never reuse a cached resource identity. */
export function uiResourceUri(html,version){
 if(typeof html!=='string'||!/^\d+\.\d+\.\d+$/.test(version))throw new Error('Invalid UI release');
 return `ui://quota-rings/panel-v${version}-${createHash('sha256').update(html).digest('hex').slice(0,12)}.html`;
}
