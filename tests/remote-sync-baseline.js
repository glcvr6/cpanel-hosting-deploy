const fs=require('fs'),path=require('path');
const source=fs.readFileSync(path.join(__dirname,'..','server','cpanel-mcp.js'),'utf8');

if(!source.includes("async function buildRemoteStatus(c, options={})")) throw Error('buildRemoteStatus options missing');
if(!source.includes("async function buildRemoteStatusProtected(c, options={})")) throw Error('protected status options missing');
if(!source.includes("if(advanceBaseline) await saveRemoteMeta(current);")) throw Error('unprotected baseline guard missing');
if(!source.includes("if(advanceBaseline && (!hasDifferences || (!remoteChanged.length && !remoteDeleted.length && !conflicts.length))) await saveRemoteMeta(current);")) throw Error('protected baseline guard missing');

const start=source.indexOf("async function remoteSync(c, actions, confirm){");
const end=source.indexOf("\nasync function buildPlan(c){",start);
if(start<0||end<0) throw Error('remoteSync block not found');
const block=source.slice(start,end);

if(!block.includes("buildRemoteStatus(c,{advanceBaseline:false})")) throw Error('OFF sync refresh must not advance baseline');
if(!block.includes("buildRemoteStatusProtected(c,{advanceBaseline:false})")) throw Error('protected sync refresh must not advance baseline');
if(!block.includes("const previousBaseline=await loadRemoteMeta();")) throw Error('sync must load previous baseline');
if(!block.includes("const nextBaseline={...previousBaseline};")) throw Error('sync must preserve previous baseline');
if(!block.includes("await saveRemoteMeta(nextBaseline);")) throw Error('successful sync must advance baseline selectively');
if(block.includes("saveRemoteMeta(await listRemoteFiles(c).then")) throw Error('sync must not replace baseline with full current inventory');
console.log('Remote sync baseline preservation: PASS');
