import{test}from'node:test';import assert from'node:assert/strict';import{readFileSync,existsSync}from'node:fs';
test('MBA-compatible package exposes MCP through supported legacy manifest and relative paths',()=>{
 const root=new URL('../plugins/quota-rings/',import.meta.url);const manifest=JSON.parse(readFileSync(new URL('.codex-plugin/plugin.json',root)));assert.equal(manifest.version,JSON.parse(readFileSync(new URL('../package.json',import.meta.url))).version);assert.equal(manifest.mcpServers,'./.mcp.json');assert.ok(!existsSync(new URL('plugin.json',root)),'Current MBA portable loader silently omits MCP');
 const mcp=JSON.parse(readFileSync(new URL('.mcp.json',root))).mcpServers['quota-rings'];assert.equal(mcp.command,'/bin/sh');assert.equal(mcp.cwd,'.');assert.deepEqual(mcp.args,['./launch.sh']);assert.ok(existsSync(new URL(mcp.args[0],root)));assert.ok(!JSON.stringify(mcp).includes('${PLUGIN_ROOT}'));
});
