const fs=require('fs');
const path=require('path');
const server=fs.readFileSync(path.join(__dirname,'..','server','cpanel-mcp.js'),'utf8');
function assert(ok,msg){if(!ok)throw new Error(msg);}
assert(server.includes("protectionEnabled(c,'backupBeforeDestructive')"),'destructive backup gate missing');
assert(server.includes("protectionEnabled(c,'localBackups')"),'local backup gate missing');
assert(server.includes("protectionEnabled(c,'remoteBackups')"),'remote backup gate missing');
assert(server.includes("copyLocalBackup(item.path,'remote-deleted')"),'remote-deleted local backup missing');
assert(server.includes("copyLocalBackup(item.path,'remote-overwritten')"),'remote-overwritten local backup missing');
assert(server.includes("remoteBackup(c,remote,item.relativePath,'local-deleted')"),'local-deleted remote backup missing');
assert(server.includes("remoteBackup(c,remote,item.relativePath,'remote-overwritten')"),'remote-overwritten remote backup missing');
assert(server.includes("p.includes('.remote-overwritten.backup')"),'generated backup exclusion missing');
assert(server.includes("p.startsWith('.cpanel-sync-backup/')"),'remote backup exclusion missing');
console.log('Protection backup enforcement regression: PASS');
