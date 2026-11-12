import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {uiResourceUri} from '../src/ui-contract.mjs';
test('a client cache containing the old side-by-side panel cannot satisfy the new advertised identity',()=>{
 const oldUri='ui://quota-rings/panel.html';
 const oldHtml='<main><section id="old-side-by-side-rings"></section></main>';
 const cache=new Map([[oldUri,oldHtml]]);
 const html=readFileSync('plugins/quota-rings/ui.html','utf8');
 const version=JSON.parse(readFileSync('plugins/quota-rings/.codex-plugin/plugin.json')).version;
 const advertisedUri=uiResourceUri(html,version);
 assert.equal(cache.has(advertisedUri),false);
 cache.set(advertisedUri,html);
 assert.match(cache.get(advertisedUri),/id="nested-rings"/);
 assert.doesNotMatch(cache.get(advertisedUri),/old-side-by-side-rings/);
 assert.equal(cache.get(oldUri),oldHtml,'Never purge or alter the host cache as a workaround');
});
