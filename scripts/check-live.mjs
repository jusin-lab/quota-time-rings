import {readCodexLimits} from '../src/codex-reader.mjs';
console.log(JSON.stringify(await readCodexLimits(),null,2));
