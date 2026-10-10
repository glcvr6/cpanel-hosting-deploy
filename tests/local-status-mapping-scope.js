const fs = require('fs');
const path = require('path');
const source = fs.readFileSync(path.join(__dirname, '..', 'server', 'cpanel-mcp.js'), 'utf8');

function blockBetween(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error('Could not locate source block: ' + startMarker);
  return source.slice(start, end);
}

const mapping = blockBetween('function mappingForLocal(c,rel)', '\nfunction remoteFromRel');
if (!mapping.includes('m.enabled!==false')) {
  throw new Error('Local status must resolve only enabled mappings');
}

const plan = blockBetween('async function buildPlanUnlocked(c)', '\nasync function ensureRemoteDir');
if (!plan.includes('for(const m of (c.mappings||[])){\n    if(m.enabled===false) continue;')) {
  throw new Error('Local status must walk only enabled mapping roots');
}
const deletedStart = plan.indexOf('for (const rel of Object.keys(manifest)) {');
const deletedBlock = plan.slice(deletedStart);
const mappedCheck = deletedBlock.indexOf('if (!mapped) continue;');
const remoteConversion = deletedBlock.indexOf('const remote = remoteFromRel(c, rel);');
if (deletedStart < 0 || mappedCheck < 0 || remoteConversion < 0 || mappedCheck > remoteConversion) {
  throw new Error('Local status must skip stale manifest entries outside enabled mappings before remote path conversion');
}
if (!plan.includes('const remoteFilesForDeleted = remoteFiles || await listRemoteFiles(c);')) {
  throw new Error('Local status deleted-file comparison must use the active mapping inventory');
}

console.log('Local status enabled-mapping scope regression: PASS');
