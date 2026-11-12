import{mkdirSync,rmSync,cpSync,readFileSync,writeFileSync,readdirSync}from'node:fs';import{resolve,relative,join}from'node:path';import{execFileSync}from'node:child_process';import{createHash}from'node:crypto';
const root=process.cwd(),version=JSON.parse(readFileSync('plugins/quota-rings/.codex-plugin/plugin.json')).version;
const stage=resolve('.validation/public-release-'+version),plugin=join(stage,'plugins/quota-rings');
rmSync(stage,{recursive:true,force:true});mkdirSync(plugin,{recursive:true});
const allowed=['.codex-plugin','.mcp.json','launch.sh','server.mjs','ui.html','skills','licenses','LICENSE','THIRD_PARTY_NOTICES.md','PRIVACY.md','README.md','GETTING_STARTED.zh-CN.md','assets'];
for(const name of allowed){try{cpSync('plugins/quota-rings/'+name,join(plugin,name),{recursive:true,errorOnExist:true})}catch(e){if(e.code!=='ENOENT')throw e}}
mkdirSync(join(stage,'.agents/plugins'),{recursive:true});cpSync('.agents/plugins/marketplace.json',join(stage,'.agents/plugins/marketplace.json'));cpSync('release',join(stage,'release'),{recursive:true});
function walk(p){return readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(p,e.name)):[join(p,e.name)])}
const files=walk(stage);for(const p of files){const rel=relative(stage,p),b=readFileSync(p);if(/signals\.local|\.local-backup|\.validation|auth\.json|config\.toml|snapshot|verification\.json/.test(rel))throw new Error('Forbidden release file: '+rel);if(/\.(?:json|mjs|html|md|sh|txt)$/.test(p)){const s=b.toString();if(/\/(?:Users|home)\/[A-Za-z0-9_.-]+|gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{24,}|-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(s))throw new Error('Local identity or private research snapshot leaked in '+rel);}}
mkdirSync('artifacts',{recursive:true});const personal=resolve(`artifacts/quota-rings-${version}-personal-marketplace.zip`),submission=resolve(`artifacts/quota-rings-${version}-plugin.zip`);for(const p of[personal,submission])rmSync(p,{force:true});
execFileSync('/usr/bin/zip',['-q','-r',personal,'.'],{cwd:stage});execFileSync('/usr/bin/zip',['-q','-r',submission,'.'],{cwd:plugin});
console.log(JSON.stringify({version,fileCount:files.length,signalSnapshotIncluded:false,publiclySubmitted:false,packages:[personal,submission].map(path=>({path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')}))},null,2));
