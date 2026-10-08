const fs=require('fs');
const path=require('path');

const server=fs.readFileSync(path.join(__dirname,'..','server','cpanel-mcp.js'),'utf8');

function assert(ok,msg){if(!ok)throw new Error(msg);}

assert(server.includes("async function deploy(c, confirm, deletionActions=[], confirmation='')"),'deploy must accept explicit protection confirmation');
assert(server.includes("protectionConfirmation:'OVERWRITE'"),'protected deploy must request OVERWRITE');
assert(server.includes("String(confirmation||'').toUpperCase()!=='OVERWRITE'"),'protected deploy must reject missing/incorrect OVERWRITE');
assert(server.includes("a.confirmation||''"),'deploy tool must pass confirmation');
assert(server.includes("const overwriteTargets=files.filter(f=>remoteFiles.has(f.remote));"),'full upload must detect existing remote targets generically');
assert(server.includes("overwriteFiles:overwriteTargets.map(x=>x.path)"),'full upload must report overwrite targets');
assert(server.includes("Protection may require OVERWRITE"),'tool description must document protected overwrite confirmation');
console.log('Protection overwrite enforcement regression: PASS');
