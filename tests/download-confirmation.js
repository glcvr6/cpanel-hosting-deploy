const fs=require('fs');
const path=require('path');
const s=fs.readFileSync(path.join(__dirname,'..','server','cpanel-mcp.js'),'utf8');
function assert(ok,msg){if(!ok)throw new Error(msg);}
const start=s.indexOf("if(name==='cpanel_download')");
const end=s.indexOf("\n  throw new Error(`Unknown tool:",start);
const block=s.slice(start,end);
assert(start>=0&&end>start,'download handler boundaries missing');
assert(block.includes("if(a.confirm!==true) return {"),'download must preview unless explicitly confirmed');
assert(block.includes('requiresConfirmation:true'),'preview must signal confirmation required');
assert(block.includes('workspace:WORKSPACE'),'preview must display resolved workspace');
assert(block.includes('workspaceSource:WORKSPACE_SOURCE'),'preview must display workspace source for diagnosis');
assert(block.includes('remotePath'),'preview must display each mapped remote path');
assert(block.includes('localMappedPath:localPath'),'preview must display each absolute local mapped path');
assert(block.includes('existing local files at the displayed paths may be overwritten'),'preview must warn about overwrites');
assert(block.indexOf('if(a.confirm!==true) return {')<block.indexOf("withOperationLock(c,'download'"),'preview must occur before the download lock and transfer');
assert(block.includes("await assertSafeLocalPath(localPath)"),'preview must validate local path safety');
assert(block.includes("throw new Error('No enabled folder mappings are configured for this connection.')"),'download must reject empty mappings');
console.log('download-confirmation: PASS');
