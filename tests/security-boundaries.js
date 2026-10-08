const fs=require('fs'),path=require('path'),vm=require('vm');
const source=fs.readFileSync(path.join(__dirname,'..','server','cpanel-mcp.js'),'utf8');
function assert(ok,msg){if(!ok)throw new Error(msg);}
assert(source.includes("Local folder mapping must be relative to the workspace."),'absolute Windows/UNC local mapping guard missing');
assert(source.includes("if(raw.includes('\\0')) throw new Error('Local folder mapping cannot contain NUL bytes.');"),'NUL byte validation must check the actual NUL character');
assert(source.includes("Remote folder mapping must stay inside the connection remote root"),'remote mapping root guard missing');
assert(source.includes("cPanel host must use HTTPS so the API token is not sent over cleartext HTTP."),'HTTPS API guard missing');
assert(source.includes("Remote folder path must stay inside the connection remote root"),'remote folder listing root guard missing');
assert(source.includes("const hasDifferences = remoteNew.length||remoteUntracked.length||remoteChanged.length||remoteDeleted.length||conflicts.length;"),'remote status difference guard missing');
assert(source.includes("if(advanceBaseline && !hasDifferences) await saveRemoteMeta(current);"),'remote status must not advance baseline when changes are present');
console.log('Security boundaries and remote-status regression: PASS');

assert(source.includes("Deployment manifest is unreadable or corrupted:"),'manifest corruption must fail closed');
assert(source.includes("Remote baseline is unreadable or corrupted:"),'remote baseline corruption must fail closed');
assert(source.includes("if(e.code==='ENOENT') return {};"),'missing state files must remain recoverable as empty state');
