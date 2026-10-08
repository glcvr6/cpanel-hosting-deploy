const fs=require('fs'),path=require('path');
const source=fs.readFileSync(path.join(__dirname,'..','server','cpanel-mcp.js'),'utf8');
function assert(ok,msg){if(!ok)throw new Error(msg);}

assert(source.includes("async function withConnectionsStoreLock(fn)"),'connections store lock helper missing');
assert(source.includes("path.join(APP_DIR,'connections-store.lock')"),'connections store must have a dedicated lock file');
assert(source.includes("await atomicJsonWrite(CONNECTIONS_FILE,store);"),'connections store writes must use unique atomic temp files');
assert(!source.includes("CONNECTIONS_FILE + '.tmp'"),'shared connections temp file must not remain');

const add=source.slice(source.indexOf("if(name==='cpanel_add_connection')"),source.indexOf("if(name==='cpanel_edit_connection')"));
const edit=source.slice(source.indexOf("if(name==='cpanel_edit_connection')"),source.indexOf("if(name==='cpanel_remove_connection')"));
const remove=source.slice(source.indexOf("if(name==='cpanel_remove_connection')"),source.indexOf("if(name==='cpanel_list_remote_folders')"));
assert(add.includes("withConnectionsStoreLock(async()=>"),'add connection must lock the full read-modify-write transaction');
assert(edit.includes("withConnectionsStoreLock(async()=>"),'edit connection must lock the full read-modify-write transaction');
assert(remove.includes("withConnectionsStoreLock(async()=>"),'remove connection must lock the full read-modify-write transaction');
assert(edit.includes("A connection with that name already exists."),'rename must reject a duplicate connection name');

const settings=source.slice(source.indexOf("async function updateSettings"),source.indexOf("function protectionWarning"));
assert(settings.includes("withConnectionsStoreLock(async()=>"),'settings update must lock the full read-modify-write transaction');
assert(settings.includes("const store=await loadStore();"),'settings update must reload store while holding the lock');

console.log('Connections store concurrency regression: PASS');
