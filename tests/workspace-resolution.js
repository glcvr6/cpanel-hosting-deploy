const assert=require('assert');
const fs=require('fs');
const os=require('os');
const path=require('path');
const cp=require('child_process');

const root=path.resolve(__dirname,'..');
const server=path.join(root,'server','cpanel-mcp.js');
const source=fs.readFileSync(server,'utf8');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'cpanel-workspace-test-'));
const workspace=path.join(temp,'Desktop 2','GSSIHostFilesTest');
const pluginRoot=path.join(temp,'plugin-install');
const appData=path.join(temp,'appdata');
const cursorInstall=path.join(temp,'Cursor');
fs.mkdirSync(workspace,{recursive:true});
fs.mkdirSync(pluginRoot,{recursive:true});
fs.mkdirSync(appData,{recursive:true});
fs.mkdirSync(cursorInstall,{recursive:true});
fs.writeFileSync(path.join(cursorInstall,'Cursor.exe'),'test');

function envWithoutWorkspace(){
  const env={...process.env,APPDATA:appData,CURSOR_PLUGIN_ROOT:pluginRoot};
  for(const key of ['CURSOR_PROJECT_DIR','WORKSPACE_FOLDER_PATHS','CURSOR_WORKSPACE','VSCODE_CWD']) delete env[key];
  return env;
}
function run(input,extraEnv={},cwd=pluginRoot){
  return cp.spawnSync(process.execPath,[server],{
    cwd,
    env:{...envWithoutWorkspace(),...extraEnv},
    input,
    encoding:'utf8',
    timeout:10000
  });
}
function line(obj){return JSON.stringify(obj)+'\\n';}

try{
  // Missing workspace context no longer prevents startup or falls back to cwd.
  const noWorkspace=run(line({jsonrpc:'2.0',id:1,method:'initialize'}));
  assert.strictEqual(noWorkspace.status,0,noWorkspace.stderr||'server should start without workspace context');
  assert.match(noWorkspace.stdout,/cpanel-hosting-deploy/);
  assert(!source.includes("return {path: cwd, source:'process.cwd()'}"),'must not fall back to process.cwd()');

  // The download schema exposes an explicit workspace parameter.
  const list=run(line({jsonrpc:'2.0',id:1,method:'tools/list'}));
  assert.strictEqual(list.status,0,list.stderr||'tools/list failed');
  const toolsResponse=JSON.parse(list.stdout.trim().split('\\n').at(-1));
  const download=toolsResponse.result.tools.find(t=>t.name==='cpanel_download');
  assert(download && download.inputSchema.properties.workspace,'download schema must accept an explicit workspace');

  // A valid path containing spaces is accepted and reaches tool dispatch.
  const valid=run(line({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'test_unknown_tool',arguments:{workspace}}}));
  assert.strictEqual(valid.status,0,valid.stderr||'server failed with explicit workspace');
  assert.match(valid.stdout,/Unknown tool: test_unknown_tool/,'valid workspace should pass validation');

  // Cursor's application installation folder is rejected even when explicitly passed.
  const invalid=run(line({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'test_unknown_tool',arguments:{workspace:cursorInstall}}}));
  assert.strictEqual(invalid.status,0,invalid.stderr||'server process failed for invalid workspace');
  assert.match(invalid.stdout,/Refusing to use the Cursor application installation directory/);

  // A nonexistent path is rejected.
  const missing=run(line({jsonrpc:'2.0',id:4,method:'tools/call',params:{name:'test_unknown_tool',arguments:{workspace:path.join(temp,'missing')}}}));
  assert.strictEqual(missing.status,0,missing.stderr||'server process failed for missing workspace');
  assert.match(missing.stdout,/Workspace folder does not exist/);

  console.log('workspace-resolution: PASS');
}finally{
  fs.rmSync(temp,{recursive:true,force:true});
}
