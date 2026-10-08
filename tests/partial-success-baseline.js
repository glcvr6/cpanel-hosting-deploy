const fs=require('fs');
const path=require('path');
const s=fs.readFileSync(path.join(__dirname,'..','server','cpanel-mcp.js'),'utf8');
function assert(ok,msg){if(!ok)throw new Error(msg);}
const start=s.indexOf("async function remoteSync(c, actions, confirm){");
const end=s.indexOf("\nasync function buildPlan(c){",start);
assert(start>=0&&end>start,'remoteSync block not found');
const block=s.slice(start,end);
assert(block.includes("const previousBaseline=await loadRemoteMeta();"),'partial-success baseline must load previous baseline');
assert(block.includes("const currentInventory=await listRemoteFiles(c);"),'partial-success baseline must inspect current remote inventory');
assert(block.includes("const nextBaseline={...previousBaseline};"),'partial-success baseline must preserve previous state');
assert(block.includes("if(!synced.includes(item.path)) continue;"),'failed/kept actions must not advance baseline');
assert(block.includes("delete nextBaseline[item.remote];"),'successful remote deletions must be removed from baseline');
assert(block.includes("nextBaseline[item.remote]={"),'successful remote syncs must advance their own baseline entries');
assert(block.includes("await saveRemoteMeta(nextBaseline);"),'partial-success baseline must save merged baseline');
assert(!block.includes("saveRemoteMeta(await listRemoteFiles(c).then"),'remote sync must not replace baseline with full current inventory');
console.log('Partial-success remote baseline regression: PASS');
