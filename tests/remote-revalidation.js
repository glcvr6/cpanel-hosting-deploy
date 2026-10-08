const fs=require('fs');
const path=require('path');
const s=fs.readFileSync(path.join(__dirname,'..','server','cpanel-mcp.js'),'utf8');
function assert(ok,msg){if(!ok)throw new Error(msg);}
assert(s.includes('async function verifyRemoteSnapshot(c,remotePath,expected,shouldExist=true)'), 'remote snapshot revalidation helper missing');
assert(s.includes('await verifyRemoteSnapshot(c,remote,item.remoteInfo,item.status===\'CHANGED\')'), 'deploy uploads must revalidate the remote state before acting');
assert(s.includes('await verifyRemoteSnapshot(c,remote,item.remoteInfo,true);'), 'deploy restore/delete must revalidate the remote state');
assert(s.includes('await verifyRemoteSnapshot(c,item.remote,null,false);'), 'remote sync DELETE_LOCAL must verify the remote file is still absent');
assert(s.includes('await verifyRemoteSnapshot(c,item.remote,{size:item.size,mtime:item.mtime},true);'), 'remote sync downloads must revalidate the observed remote snapshot');
assert(s.includes('remoteInfo:remoteFiles?.get(remoteFromRel(c,rel))||null'), 'deployment plan must carry the remote snapshot used for revalidation');
assert(s.includes('remoteInfo:remoteFilesForDeleted.get(remote)'), 'deleted deployment entries must carry the remote snapshot');
assert(!s.includes('remote-pending.json'), 'stale pending journal must not remain as an unused state file');
assert(!s.includes('saveRemotePending'), 'unused pending-state writer must be removed');
assert(!s.includes('clearRemotePending'), 'unused pending-state clearer must be removed');
console.log('Remote revalidation regression: PASS');
