const assert=require('assert');
const fs=require('fs');
const os=require('os');
const path=require('path');
const cp=require('child_process');

const root=path.resolve(__dirname,'..');
const server=path.join(root,'server','cpanel-mcp.js');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'cpanel-workspace-test-'));
const workspace=path.join(temp,'Desktop 2','GSSIHostFilesTest');
const pluginRoot=path.join(temp,'plugin-install');
const appData=path.join(temp,'appdata');
fs.mkdirSync(workspace,{recursive:true});
fs.mkdirSync(pluginRoot,{recursive:true});
fs.mkdirSync(appData,{recursive:true});

function envWithoutWorkspace(){
  const env={...process.env,APPDATA:appData};
  for(const key of ['CURSOR_PROJECT_DIR','WORKSPACE_FOLDER_PATHS','CURSOR_WORKSPACE','VSCODE_CWD']) delete env[key];
  return env;
}
function run(extraEnv={},cwd=pluginRoot){
  return cp.spawnSync(process.execPath,[server],{
    cwd,
    env:{...envWithoutWorkspace(),...extraEnv,CURSOR_PLUGIN_ROOT:pluginRoot},
    input:'{"jsonrpc":"2.0","id":1,"method":"initialize"}\n',
    encoding:'utf8',
    timeout:10000
  });
}

try{
  // A plugin/install cwd is not a valid substitute for the active workspace.
  const missing=run();
  assert.notStrictEqual(missing.status,0,'server must fail closed without workspace context');
  assert.match(missing.stderr,/Unable to determine the Cursor workspace/);
  assert.match(missing.stderr,/Refusing to use the MCP working directory/);

  // Cursor's workspace variable wins and paths containing spaces are preserved.
  const valid=run({WORKSPACE_FOLDER_PATHS:JSON.stringify([workspace])});
  assert.strictEqual(valid.status,0,valid.stderr||'server failed with valid workspace');
  assert.match(valid.stdout,/"serverInfo":\{"name":"cpanel-hosting-deploy","version":"1\.13\.3"\}/);

  // Invalid high-priority values do not prevent a valid Cursor workspace fallback.
  const fallback=run({
    CURSOR_PROJECT_DIR:path.join(temp,'does-not-exist'),
    WORKSPACE_FOLDER_PATHS:JSON.stringify([workspace])
  });
  assert.strictEqual(fallback.status,0,fallback.stderr||'server failed with valid workspace fallback');
  assert.match(fallback.stdout,/"serverInfo":\{"name":"cpanel-hosting-deploy","version":"1\.13\.3"\}/);

  console.log('workspace-resolution: PASS');
}finally{
  fs.rmSync(temp,{recursive:true,force:true});
}
