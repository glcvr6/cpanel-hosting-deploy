const fs=require('fs'),path=require('path'),vm=require('vm');
const source=fs.readFileSync(path.join(__dirname,'..','server','cpanel-mcp.js'),'utf8');
function assert(ok,msg){if(!ok)throw new Error(msg);}

const start=source.indexOf("function normalizeRemote(p)");
const end=source.indexOf("\nfunction safeName",start);
assert(start>=0&&end>start,'normalizeRemote helper not found');
const block=source.slice(start,end);
assert(block.includes("path.posix.normalize(x)"),'remote paths must be canonicalized before boundary checks');
assert(block.includes("if(x.includes('\\0')) throw new Error('Remote path cannot contain NUL bytes.');"),'remote paths must reject NUL bytes');

const mappingStart=source.indexOf("function normalizeRemoteMapping(remoteRoot,p)");
const mappingEnd=source.indexOf("\nfunction normalizeMappings",mappingStart);
const mapping=source.slice(mappingStart,mappingEnd);
assert(mapping.includes("resolved===root || !resolved.startsWith(root+'/')"),'remote mappings must remain inside remote root after canonicalization');

console.log('Remote path safety regression: PASS');
