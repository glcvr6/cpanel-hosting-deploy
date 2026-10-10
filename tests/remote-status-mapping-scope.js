const fs = require('fs');
const path = require('path');
const source = fs.readFileSync(path.join(__dirname, '..', 'server', 'cpanel-mcp.js'), 'utf8');

function blockBetween(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error('Could not locate source block: ' + startMarker);
  return source.slice(start, end);
}

const mappingFilter = source.slice(source.indexOf('function mappingForLocal(c,rel)'), source.indexOf('\nfunction remoteFromRel', source.indexOf('function mappingForLocal(c,rel)')));
if (!mappingFilter.includes("m.enabled!==false")) {
  throw new Error('mappingForLocal must exclude disabled mappings');
}

for (const [name, start, end] of [
  ['unprotected', 'async function buildRemoteStatus(c, options={})', 'async function buildRemoteStatusProtected(c, options={})'],
  ['protected', 'async function buildRemoteStatusProtected(c, options={})', 'async function remoteSync(c, actions, confirm){']
]) {
  const block = blockBetween(start, end);
  const filter = block.indexOf('if(!mappingForLocal(c,rel)) continue;');
  const conversion = block.indexOf('const rp=remoteFromRel(c,rel);');
  if (filter < 0 || conversion < 0 || filter > conversion) {
    throw new Error(name + ' remote status must filter manifest entries to enabled mappings before remote path conversion');
  }
}

console.log('Remote status enabled-mapping scope regression: PASS');
