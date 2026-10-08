const fs=require('fs'),path=require('path');
const source=fs.readFileSync(path.join(__dirname,'..','server','cpanel-mcp.js'),'utf8');
function assert(ok,msg){if(!ok)throw new Error(msg);}

assert(source.includes("if(raw.includes('\\0')) throw new Error('Local folder mapping cannot contain NUL bytes.');"),'local mapping must reject the actual NUL character');
assert(source.includes("Deployment manifest is unreadable or corrupted:"),'manifest corruption must fail closed');
assert(source.includes("Remote baseline is unreadable or corrupted:"),'remote baseline corruption must fail closed');

const manifestBlock=source.slice(source.indexOf('async function loadManifest()'),source.indexOf('async function saveManifest'));
assert(manifestBlock.includes("if(e.code==='ENOENT') return {};"),'missing manifest must remain recoverable');
assert(manifestBlock.includes("throw new Error('Deployment manifest is unreadable or corrupted: '+e.message);"),'manifest read/parse errors must not be swallowed');

const remoteBlock=source.slice(source.indexOf('async function loadRemoteMeta()'),source.indexOf('async function saveRemoteMeta'));
assert(remoteBlock.includes("if(e.code==='ENOENT') return {};"),'missing remote baseline must remain recoverable');
assert(remoteBlock.includes("throw new Error('Remote baseline is unreadable or corrupted: '+e.message);"),'remote baseline read/parse errors must not be swallowed');
const protectedStatus=source.slice(source.indexOf("async function buildRemoteStatusProtected"),source.indexOf("\nasync function remoteSync"));
assert(protectedStatus.includes("if(advanceBaseline && !hasDifferences) await saveRemoteMeta(current);"),'protected remote baseline must only advance when there are no differences');

console.log('State recovery regression: PASS');
