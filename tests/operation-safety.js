const fs=require('fs');
const path=require('path');
const s=fs.readFileSync(path.join(__dirname,'..','server','cpanel-mcp.js'),'utf8');
function assert(ok,msg){if(!ok)throw new Error(msg);}
assert(s.includes("async function api2FileOp(c,op,sourcefiles)"),'remote delete API2 helper missing');
assert(s.includes("cpanel_jsonapi_apiversion','2'"),'API2 version missing');
assert(s.includes("async function withOperationLock(c,operation,fn)"),'operation lock helper missing');
assert(s.includes("fss.open(lockPath,'wx')") || s.includes("fsp.open(lockPath,'wx')"),'lock must use exclusive file creation');
assert(s.includes("protectionEnabled(c,'locks')"),'lock protection gate missing');
assert(s.includes("cleanupRetention(backupRoot(),normalizeSettings(c.settings).backupRetention)"),'local backup retention cleanup missing');
assert(s.includes("async function cleanupRemoteBackups(c)"),'remote backup retention cleanup missing');
assert(s.includes("api2FileOp(c,'trash',item.path)"),'remote backup retention must use trash operation');
assert(s.includes("withOperationLock(c,'deploy'"),'deploy lock missing');
assert(s.includes("withOperationLock(c,'remote-sync'"),'remote sync lock missing');
assert(s.includes("withOperationLock(c,'workspace-setup'"),'workspace setup lock missing');
console.log('Operation safety regression: PASS');
