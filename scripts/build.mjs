import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {build} from 'esbuild';
const manifest=JSON.parse(readFileSync('plugins/quota-rings/.codex-plugin/plugin.json','utf8'));
const uiPath='plugins/quota-rings/ui.html';
// Ship the same onboarding instructions with source and installed packages.
writeFileSync('plugins/quota-rings/README.md',readFileSync('README.md','utf8'));
writeFileSync('plugins/quota-rings/GETTING_STARTED.zh-CN.md',readFileSync('GETTING_STARTED.zh-CN.md','utf8').replaceAll('(plugins/quota-rings/.codex-plugin/plugin.json)','(.codex-plugin/plugin.json)'));
writeFileSync(uiPath,readFileSync(uiPath,'utf8').replace(/(id="build-version"[^>]*>)[^<]*/,`$1v${manifest.version}`));
const result=await build({entryPoints:['src/server.mjs'],outfile:'plugins/quota-rings/server.mjs',bundle:true,metafile:true,platform:'node',format:'esm',target:'node20',banner:{js:'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);'}});
// Keep licenses for every dependency actually bundled, including transitive ones.
const packages=new Map();
for(const file of Object.keys(result.metafile.inputs)){
 if(!file.includes('node_modules/'))continue;
 let dir=dirname(file);
 while(dir!=='.'){
  const path=join(dir,'package.json');
  if(existsSync(path)){
   const pkg=JSON.parse(readFileSync(path,'utf8'));
   if(pkg.name){packages.set(pkg.name,{dir,pkg});break;}
  }
  dir=dirname(dir);
 }
}
let notices='# Bundled third-party notices\n\nThese dependencies are included in server.mjs. Their original licenses apply independently of the project license. External prediction-source content is not bundled or relicensed.\n';
for(const [name,{dir,pkg}]of [...packages].sort(([a],[b])=>a.localeCompare(b))){
 const license=['LICENSE','LICENSE.md','LICENSE.txt','license','license.md','license.txt','COPYING'].map(x=>join(dir,x)).find(existsSync);
 if(!license)throw new Error('Missing bundled license: '+name);
 notices+=`\n## ${name} ${pkg.version} (${pkg.license})\n\n`+readFileSync(license,'utf8').trim()+'\n';
}
for(const prefix of ['','plugins/quota-rings/'])writeFileSync(prefix+'THIRD_PARTY_NOTICES.md',notices);
