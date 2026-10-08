const fs=require('fs'),path=require('path');
const source=fs.readFileSync(path.join(__dirname,'..','server','cpanel-mcp.js'),'utf8');
function assert(ok,msg){if(!ok)throw new Error(msg);}

assert(source.includes("async function assertSafeLocalPath(target)"),'local path safety helper missing');
assert(source.includes("const st=await fsp.lstat(current);"),'local safety must inspect path components without following symlinks');
assert(source.includes("if(st.isSymbolicLink()) throw new Error"),'symbolic links must be rejected');
assert(source.includes("withOperationLock(c,'local-upload'"),'full local upload must use the operation lock');
assert(source.includes("withOperationLock(c,'download'"),'explicit download must use the operation lock');
assert(source.includes("if(overwriteSnapshot) await verifyRemoteSnapshot"),'full upload overwrite targets must be revalidated before upload');
assert(source.includes("AbortSignal.timeout(120000)"),'remote API calls must have bounded timeouts');

console.log('Local filesystem and operation safety regression: PASS');
