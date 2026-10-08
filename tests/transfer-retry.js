const fs=require('fs');
const path=require('path');
const s=fs.readFileSync(path.join(__dirname,'..','server','cpanel-mcp.js'),'utf8');
function assert(ok,msg){if(!ok)throw new Error(msg);}
assert(s.includes("function transferAttempts(c){return protectionEnabled(c,'retry') ? normalizeSettings(c.settings).retryAttempts : 1;}"),'retry policy helper missing');
assert(s.includes("retryOperation(()=>apiUpload(c,path.posix.dirname(remote),item.localPath),transferAttempts(c))"),'deploy upload retry missing');
assert(s.includes("retryOperation(()=>downloadOne(c,item.remote,item.path,true),transferAttempts(c))"),'remote sync download retry missing');
assert(s.includes("retryOperation(()=>apiUpload(c,path.posix.dirname(f.remote),path.join(WORKSPACE,...f.path.split('/'))),transferAttempts(c))"),'full upload retry missing');
assert(s.includes("retryOperation(()=>remoteBackup(c,remote,item.relativePath,'local-deleted'),transferAttempts(c))"),'remote delete backup retry missing');
assert(s.includes("retryOperation(()=>remoteBackup(c,remote,item.relativePath,'remote-overwritten'),transferAttempts(c))"),'remote overwrite backup retry missing');
assert(s.includes("retryOperation(()=>remoteBackup(c,f.remote,f.path,'remote-overwritten'),transferAttempts(c))"),'full upload backup retry missing');
console.log('Transfer retry enforcement regression: PASS');
