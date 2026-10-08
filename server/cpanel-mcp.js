#!/usr/bin/env node
'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const VERSION = '1.12.0';

function parseWorkspaceCandidates(raw) {
  if (!raw) return [];
  const value = String(raw).trim();
  if (!value || value === '${workspaceFolder}' || value.includes('${workspaceFolder}')) return [];

  // Cursor provides the active workspace through WORKSPACE_FOLDER_PATHS.
  // Be defensive about multi-root representations and unresolved placeholders.
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.flatMap(parseWorkspaceCandidates);
    if (typeof parsed === 'string') return parseWorkspaceCandidates(parsed);
  } catch (_) {}

  if (process.platform === 'win32' && value.includes(';')) {
    return value.split(';').map(x => x.trim()).filter(Boolean);
  }
  if (process.platform !== 'win32' && value.includes(':') && !value.startsWith('/')) {
    return value.split(':').map(x => x.trim()).filter(Boolean);
  }
  return [value];
}

function resolveWorkspace() {
  const sources = [
    ['CURSOR_PROJECT_DIR', process.env.CURSOR_PROJECT_DIR],
    ['WORKSPACE_FOLDER_PATHS', process.env.WORKSPACE_FOLDER_PATHS],
    ['CURSOR_WORKSPACE', process.env.CURSOR_WORKSPACE],
    ['VSCODE_CWD', process.env.VSCODE_CWD]
  ];

  for (const [source, raw] of sources) {
    for (const candidate of parseWorkspaceCandidates(raw)) {
      const resolved = path.resolve(candidate.replace(/^"|"$/g, ''));
      try {
        if (fs.statSync(resolved).isDirectory()) return {path: resolved, source};
      } catch (_) {}
    }
  }

  // In Cursor a plugin MCP server normally runs with the plugin cwd, so do not
  // silently mistake the plugin directory for the user's project.
  const cwd = path.resolve(process.cwd());
  const pluginRoot = process.env.CURSOR_PLUGIN_ROOT ? path.resolve(process.env.CURSOR_PLUGIN_ROOT) : null;
  if (!pluginRoot || cwd !== pluginRoot) return {path: cwd, source:'process.cwd()'};

  throw new Error(
    'Unable to determine the Cursor workspace. Cursor did not provide WORKSPACE_FOLDER_PATHS/CURSOR_PROJECT_DIR. ' +
    'Restart Cursor and reload the plugin, then retry.'
  );
}

const WORKSPACE_INFO = resolveWorkspace();
const WORKSPACE = WORKSPACE_INFO.path;
const WORKSPACE_SOURCE = WORKSPACE_INFO.source;
const APP_DIR = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'cPanel Hosting Deploy');
const CONNECTIONS_FILE = path.join(APP_DIR, 'connections.json');
const DEFAULT_EXCLUDE = ['node_modules', '.git', '.env', 'logs'];
const DEFAULT_CONNECTION_NAME = 'Default';

// Protection policy engine. OFF preserves the original v1.10.3 core workflow;
// SECURED enables the complete protection policy; CUSTOM enables selected groups.
const PROTECTION_GROUPS = {
  changeDetection: ['localChanges','remoteChanges','conflicts','newDeleted','remoteUntracked'],
  contentVerification: ['sizeMtime','sha256','deepCheck'],
  conflictProtection: ['reviewDiff','conflictProtection'],
  backupProtection: ['backupBeforeDestructive','localBackups','remoteBackups','backupRetention'],
  operationSafety: ['retry','partialSuccess','resume','locks'],
  destructiveProtection: ['deleteConfirmation','overwriteConfirmation','forceConfirmation','restoreConfirmation'],
  acceptedState: ['acceptedDecisions','acceptedAutomatic','acceptedRevalidate'],
  reporting: ['reports','unknownHandling']
};
const PROTECTION_DEFAULTS = Object.fromEntries(Object.values(PROTECTION_GROUPS).flat().map(k=>[k,true]));
const DEFAULT_SETTINGS = {
  protectionMode:'OFF',
  protection:{...PROTECTION_DEFAULTS},
  largeFileThresholdBytes:3*1024*1024,
  retryAttempts:3,
  reportRetention:10,
  backupRetention:10,
  autoDeploy:false,
  verifyAfterSync:false,
  verifyMethod:'sha256'
};
function normalizeProtectionMode(v){ const x=String(v||'OFF').toUpperCase(); return ['SECURED','CUSTOM','OFF'].includes(x)?x:'OFF'; }
function normalizeSettings(raw){
  const x={...DEFAULT_SETTINGS,...(raw&&typeof raw==='object'?raw:{})};
  x.protectionMode=normalizeProtectionMode(x.protectionMode);
  x.protection={...PROTECTION_DEFAULTS,...(raw&&raw.protection||{})};
  x.largeFileThresholdBytes=Math.max(1,Number(x.largeFileThresholdBytes)||DEFAULT_SETTINGS.largeFileThresholdBytes);
  x.retryAttempts=Math.max(1,Math.min(10,Number(x.retryAttempts)||3));
  x.reportRetention=Math.max(1,Math.min(1000,Number(x.reportRetention)||10));
  x.backupRetention=Math.max(1,Math.min(1000,Number(x.backupRetention)||10));
  x.autoDeploy=Boolean(x.autoDeploy); x.verifyAfterSync=Boolean(x.verifyAfterSync);
  x.verifyMethod=String(x.verifyMethod||'sha256');
  return x;
}
function protectionEnabled(c,key){ const st=normalizeSettings(c.settings); if(st.protectionMode==='OFF') return false; if(st.protectionMode==='SECURED') return true; return st.protection[key]!==false; }
function protectionGroupEnabled(c,group){ return Object.values(PROTECTION_GROUPS[group]||{}).some(k=>protectionEnabled(c,k)); }

function configuredConnectionName() {
  const n = String(process.env.CPANEL_CONFIG_CONNECTION_NAME || DEFAULT_CONNECTION_NAME).trim();
  return n || DEFAULT_CONNECTION_NAME;
}
function configuredCredentials() {
  return {
    host: String(process.env.CPANEL_CONFIG_HOST || '').trim(),
    username: String(process.env.CPANEL_CONFIG_USERNAME || '').trim(),
    remoteRoot: String(process.env.CPANEL_CONFIG_REMOTE_ROOT || '').trim(),
    apiToken: String(process.env.CPANEL_CONFIG_API_TOKEN || '')
  };
}

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}
function result(id, value) { send({jsonrpc:'2.0', id, result:value}); }
function error(id, code, message, data) { send({jsonrpc:'2.0', id, error:{code, message, ...(data?{data}: {})}}); }
function log(msg) { process.stderr.write(`[cPanel Hosting Deploy] ${msg}\n`); }

function readJsonLine(line) {
  try { return JSON.parse(line); } catch (_) { return null; }
}

async function ensureStore() {
  await fsp.mkdir(APP_DIR, {recursive:true});
  try {
    const handle=await fsp.open(CONNECTIONS_FILE,'wx');
    try { await handle.writeFile(JSON.stringify({version:1, connections:[]}, null, 2),'utf8'); }
    finally { await handle.close(); }
  } catch(e) {
    if(e.code!=='EEXIST') throw e;
  }
}
function validateStore(store){
  if(!store || typeof store!=='object' || Array.isArray(store) || !Array.isArray(store.connections)){
    throw new Error('Connections store is unreadable or corrupted: invalid store structure.');
  }
  return store;
}
async function loadStore() {
  await ensureStore();
  const raw = await fsp.readFile(CONNECTIONS_FILE, 'utf8');
  try { return validateStore(JSON.parse(raw)); }
  catch(e) {
    if(e && e.message && e.message.startsWith('Connections store is unreadable or corrupted:')) throw e;
    throw new Error('Connections store is unreadable or corrupted: '+e.message);
  }
}
async function saveStore(store) {
  await atomicJsonWrite(CONNECTIONS_FILE,store);
}
async function withConnectionsStoreLock(fn){
  return await withFileLock(path.join(APP_DIR,'connections-store.lock'),'connections-store',fn);
}

function protectToken(token) {
  if (process.platform !== 'win32') throw new Error('This v1 secure credential store requires Windows DPAPI.');
  const ps = [
    '-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-Command',
    "$s=[Console]::In.ReadToEnd(); $ss=ConvertTo-SecureString $s -AsPlainText -Force; ConvertFrom-SecureString $ss"
  ];
  const r = spawnSync('powershell.exe', ps, {input: String(token), encoding:'utf8', windowsHide:true});
  if (r.status !== 0) throw new Error(`Windows DPAPI encryption failed: ${r.stderr || r.stdout}`);
  return String(r.stdout).trim();
}
function revealToken(cipher) {
  if (process.platform !== 'win32') throw new Error('This v1 secure credential store requires Windows DPAPI.');
  const ps = [
    '-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-Command',
    "$s=[Console]::In.ReadToEnd().Trim(); $ss=ConvertTo-SecureString $s; $b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($ss); try {[Runtime.InteropServices.Marshal]::PtrToStringBSTR($b)} finally {[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b)}"
  ];
  const r = spawnSync('powershell.exe', ps, {input: String(cipher), encoding:'utf8', windowsHide:true});
  if (r.status !== 0) throw new Error(`Windows DPAPI decryption failed: ${r.stderr || r.stdout}`);
  return String(r.stdout).trim();
}

function normalizeRemote(p) {
  let x = String(p || '/').trim().replaceAll('\\','/');
  if(x.includes('\0')) throw new Error('Remote path cannot contain NUL bytes.');
  if (!x.startsWith('/')) x = '/' + x;
  x = x.replace(/\/+/g,'/');
  x = path.posix.normalize(x);
  if (!x.startsWith('/')) x = '/' + x;
  if (x.length > 1) x = x.replace(/\/+$/,'');
  return x;
}
function safeName(s) { return String(s || '').trim(); }
function normalizeLocalPath(p){
  const raw=String(p||'').trim().replaceAll('\\','/');
  if(!raw || raw==='.') throw new Error('Local folder mapping cannot be empty.');
  if(raw.includes('\0')) throw new Error('Local folder mapping cannot contain NUL bytes.');
  if(/^[A-Za-z]:($|\/)/.test(raw) || raw.startsWith('//')) throw new Error('Local folder mapping must be relative to the workspace.');
  let x=raw.replace(/^\.\//,'').replace(/^\/+|\/+$/g,'');
  if(!x || x==='.') throw new Error('Local folder mapping cannot be empty.');
  if(x==='..' || x.startsWith('../') || x.includes('/../')) throw new Error('Local folder mapping cannot escape the workspace.');
  return x;
}
function normalizeRemoteMapping(remoteRoot,p){
  const raw=String(p||'').trim();
  if(!raw) throw new Error('Remote folder mapping cannot be empty.');
  const root=normalizeRemote(remoteRoot);
  const resolved=normalizeRemote(raw.startsWith('/') ? raw : root+'/'+raw);
  if(resolved===root || !resolved.startsWith(root+'/')) throw new Error('Remote folder mapping must stay inside the connection remote root: '+resolved);
  return resolved;
}
function normalizeMappings(remoteRoot, mappings){
  if(!Array.isArray(mappings)) return [];
  return mappings.map(m=>{
    if(typeof m==='string') {
      const local=normalizeLocalPath(m);
      return {local,remote:normalizeRemoteMapping(remoteRoot,local),enabled:true};
    }
    const local=normalizeLocalPath(m.local||m.localPath);
    const remote=normalizeRemoteMapping(remoteRoot,m.remote||m.remotePath||local);
    return {local,remote,enabled:m.enabled!==false};
  });
}
function sanitizeConnection(c) {
  return {name:c.name, host:c.host, username:c.username, remoteRoot:c.remoteRoot, mappings:c.mappings||[], exclude:c.exclude, settings:normalizeSettings(c.settings)};
}
function validateConnectionInput(a) {
  const name=safeName(a.name), host=safeName(a.host), username=safeName(a.username), remoteRoot=normalizeRemote(a.remoteRoot);
  if (!name) throw new Error('Connection name is required.');
  if (!/^https?:\/\//i.test(host)) throw new Error('Host must start with http:// or https://.');
  if (!username) throw new Error('cPanel username is required.');
  if (!a.apiToken) throw new Error('cPanel API token is required.');
  if (remoteRoot === '/') throw new Error('Remote root must be a cPanel home directory, not /.');
  const mappings = normalizeMappings(remoteRoot, a.mappings ?? a.folders ?? []);
  const exclude = Array.isArray(a.exclude) ? a.exclude.map(String).filter(Boolean) : DEFAULT_EXCLUDE;
  return {name,host:host.replace(/\/+$/,''),username,remoteRoot,mappings,exclude,settings:normalizeSettings(a.settings),tokenEncrypted:protectToken(a.apiToken)};
}

async function getConnection(name) {
  const store=await loadStore();
  const c=store.connections.find(x=>x.name.toLowerCase()===String(name).toLowerCase());
  if (!c) throw new Error(`Connection not found: ${name}`);
  return c;
}

function authHeaders(c) {
  const u=new URL(c.host);
  if(u.protocol!=='https:') throw new Error('cPanel host must use HTTPS so the API token is not sent over cleartext HTTP.');
  const token=revealToken(c.tokenEncrypted);
  return {'Authorization':`cpanel ${c.username}:${token}`};
}
async function apiGet(c,module,fn,params={}) {
  const u=new URL(`${c.host}/execute/${module}/${fn}`);
  for (const [k,v] of Object.entries(params)) u.searchParams.set(k,String(v));
  const r=await fetch(u,{headers:authHeaders(c),signal:AbortSignal.timeout(120000)});
  const text=await r.text();
  let j; try{j=JSON.parse(text);}catch(_){throw new Error(`cPanel returned non-JSON response (${r.status}).`);}
  if (!r.ok || j.status !== 1) throw new Error((j.errors||[]).join('; ') || `cPanel API HTTP ${r.status}`);
  return j;
}
async function api2FileOp(c,op,sourcefiles){
  const u=new URL(c.host+'/json-api/cpanel');
  u.searchParams.set('cpanel_jsonapi_user',c.username);
  u.searchParams.set('cpanel_jsonapi_apiversion','2');
  u.searchParams.set('cpanel_jsonapi_module','Fileman');
  u.searchParams.set('cpanel_jsonapi_func','fileop');
  u.searchParams.set('op',op);
  u.searchParams.set('sourcefiles',String(sourcefiles));
  u.searchParams.set('doubledecode','1');
  const r=await fetch(u,{headers:authHeaders(c),signal:AbortSignal.timeout(120000)});
  const text=await r.text();
  let j; try{j=JSON.parse(text);}catch(_){throw new Error('cPanel API 2 returned non-JSON response ('+r.status+').');}
  const cr=j && j.cpanelresult;
  if(!r.ok || !cr || Number(cr.event && cr.event.result)!==1) throw new Error((cr && cr.data || []).map(x=>x.err||x.reason).filter(Boolean).join('; ') || ('cPanel API 2 Fileman '+op+' failed (HTTP '+r.status+')'));
  const failed=(cr.data||[]).filter(x=>Number(x.result)===0);
  if(failed.length) throw new Error(failed.map(x=>x.err||x.output||'File operation failed').join('; '));
  return j;
}
async function apiUpload(c,remoteDir,localFile) {
  const data=await fsp.readFile(localFile);
  const form=new FormData();
  form.append('dir',remoteDir);
  form.append('overwrite','1');
  form.append('file-1',new Blob([data]),path.basename(localFile));
  const headers=authHeaders(c);
  const r=await fetch(`${c.host}/execute/Fileman/upload_files`,{method:'POST',headers,body:form,signal:AbortSignal.timeout(120000)});
  const text=await r.text();
  let j; try{j=JSON.parse(text);}catch(_){throw new Error(`Upload returned non-JSON response (${r.status}).`);}
  if (!r.ok || j.status !== 1) throw new Error((j.errors||[]).join('; ') || `Upload failed with HTTP ${r.status}`);
  if (j.data && Number(j.data.failed||0)>0) throw new Error(`cPanel reported ${j.data.failed} failed upload(s).`);
  return j;
}
function sha256(file){
  const h=crypto.createHash('sha256'); h.update(fs.readFileSync(file)); return h.digest('hex');
}
function relativePosix(full){
  const rel=path.relative(WORKSPACE,full).replaceAll('\\','/');
  if (rel.startsWith('../') || rel==='..' || path.isAbsolute(rel)) throw new Error(`Path outside workspace: ${full}`);
  return rel;
}
async function assertSafeLocalPath(target){
  const absolute=path.resolve(target);
  const workspace=path.resolve(WORKSPACE);
  const rel=path.relative(workspace,absolute);
  if(rel==='..' || rel.startsWith('..'+path.sep) || path.isAbsolute(rel)) throw new Error(`Local path is outside the workspace: ${target}`);
  let current=workspace;
  for(const part of rel.split(path.sep).filter(Boolean)){
    current=path.join(current,part);
    try{
      const st=await fsp.lstat(current);
      if(st.isSymbolicLink()) throw new Error(`Symbolic links are not allowed in deployment paths: ${target}`);
    }catch(e){
      if(e.code==='ENOENT') break;
      throw e;
    }
  }
}
function normalizeExcludePath(value){
  let x=String(value||'').trim().replaceAll('\\','/');
  while(x.startsWith('/')) x=x.slice(1);
  while(x.endsWith('/')) x=x.slice(0,-1);
  if(x.startsWith('./')) x=x.slice(2);
  return x.toLowerCase();
}
function excluded(rel, list){
  let normalizedRel=String(rel||'').replaceAll('\\','/');
  while(normalizedRel.startsWith('/')) normalizedRel=normalizedRel.slice(1);
  while(normalizedRel.endsWith('/')) normalizedRel=normalizedRel.slice(0,-1);
  if(normalizedRel.startsWith('./')) normalizedRel=normalizedRel.slice(2);

  const normalizedRelLower=normalizedRel.toLowerCase();
  const parts=normalizedRelLower.split('/').filter(Boolean);

  for(const raw of (Array.isArray(list)?list:[])){
    const pattern=normalizeExcludePath(raw);
    if(!pattern) continue;

    // Path excludes match the exact relative path and everything below it.
    if(pattern.includes('/')){
      if(normalizedRelLower===pattern || normalizedRelLower.startsWith(pattern+'/')) return true;
      continue;
    }

    // Component excludes match a directory/file name anywhere in the path.
    if(parts.includes(pattern)) return true;
  }

  if(isIgnoredProtectionPath(normalizedRel)) return true;
  return path.extname(normalizedRel).toLowerCase()==='.zip';
}
function mappingForLocal(c,rel){
  const normalized=rel.replaceAll('\\','/');
  return (c.mappings||[]).find(m=>m.enabled!==false && (normalized===m.local || normalized.startsWith(m.local+'/')));
}
function remoteFromRel(c,rel){
  const m=mappingForLocal(c,rel);
  if(!m) throw new Error(`Local path is not inside an enabled deployment mapping: ${rel}`);
  const tail=rel.replaceAll('\\','/').slice(m.local.length).replace(/^\/+/, '');
  return normalizeRemote(tail ? `${m.remote}/${tail}` : m.remote);
}
function allowedRemote(c,p){
  const x=normalizeRemote(p);
  return (c.mappings||[]).some(m=>m.enabled!==false && (x===normalizeRemote(m.remote) || x.startsWith(normalizeRemote(m.remote)+'/')));
}
function manifestPath(){return path.join(WORKSPACE,'.hosting','manifest.json');}
async function loadManifest(){
  try {
    const x=JSON.parse(await fsp.readFile(manifestPath(),'utf8'));
    return x && typeof x==='object' && !Array.isArray(x)?x:{};
  } catch(e) {
    if(e.code==='ENOENT') return {};
    throw new Error('Deployment manifest is unreadable or corrupted: '+e.message);
  }
}
async function saveManifest(m){ await atomicJsonWrite(manifestPath(),m); }
async function withManifestLock(fn){
  return await withFileLock(path.join(WORKSPACE,'.hosting','manifest.lock'),'manifest',fn);
}
async function updateManifestEntry(rel,value){
  return await withManifestLock(async()=>{
    const manifest=await loadManifest();
    if(value===undefined) delete manifest[rel]; else manifest[rel]=value;
    await saveManifest(manifest);
  });
}


// Remote file inventory used by local status/deploy and remote status.
// IMPORTANT: this only lists the enabled mapping roots; it never modifies hosting.
async function listRemoteFiles(c) {
  const files = new Map();
  const visitedDirs = new Set();

  async function walk(dir) {
    dir = normalizeRemote(dir);
    if (visitedDirs.has(dir)) return;
    visitedDirs.add(dir);

    const j = await apiGet(c, 'Fileman', 'list_files', {dir});
    for (const item of (j.data || [])) {
      const nm = String(item.file || item.name || '');
      if (!nm) continue;
      const rp = normalizeRemote(`${dir}/${nm}`);
      const type = String(item.type || '').toLowerCase();

      const rel = relFromRemote(c, rp);
      if (!rel || excluded(rel, c.exclude)) continue;

      if (type === 'dir' || type === 'directory') {
        if (allowedRemote(c, rp)) await walk(rp);
      } else if (allowedRemote(c, rp)) {
        files.set(rp, {
          path: rp,
          size: Number(item.size || 0),
          mtime: item.mtime ?? item.modified ?? item.modification_time ?? null
        });
      }
    }
  }

  for (const m of (c.mappings || [])) {
    if (m.enabled === false) continue;
    await walk(m.remote);
  }

  return files;
}

async function remoteSha256(c, remotePath) {
  const u = new URL(`${c.host}/download`);
  u.searchParams.set('file', remotePath);
  const r = await fetch(u, {headers: authHeaders(c), signal: AbortSignal.timeout(120000)});
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Remote download failed HTTP ${r.status} for ${remotePath}`);
  const buf = Buffer.from(await r.arrayBuffer());
  return crypto.createHash('sha256').update(buf).digest('hex');
}

async function remoteHashes(c, remotePaths, concurrency = 6) {
  const out = new Map();
  let index = 0;

  async function worker() {
    while (true) {
      const i = index++;
      if (i >= remotePaths.length) return;
      const rp = remotePaths[i];
      try {
        out.set(rp, await remoteSha256(c, rp));
      } catch (e) {
        // A remote file that cannot be downloaded must not abort the whole
        // local status operation. It remains un-baselined and is reported by
        // the normal plan as CHANGED rather than silently treated as identical.
        out.set(rp, null);
        log(`Remote baseline hash failed for ${rp}: ${e.message}`);
      }
    }
  }

  const count = Math.min(concurrency, remotePaths.length);
  await Promise.all(Array.from({length: count}, () => worker()));
  return out;
}

async function downloadOne(c, remotePath, rel, overwrite = true) {
  const local=localPathForRel(rel);
  await assertSafeLocalPath(local);
  const u = new URL(`${c.host}/download`);
  u.searchParams.set('file', remotePath);
  const r = await fetch(u, {headers: authHeaders(c), signal: AbortSignal.timeout(120000)});
  if (!r.ok) throw new Error(`Download failed HTTP ${r.status} for ${remotePath}`);

  const b = Buffer.from(await r.arrayBuffer());
  await fsp.mkdir(path.dirname(local), {recursive: true});

  if (!overwrite) {
    try {
      await fsp.access(local);
      throw new Error(`Local file already exists: ${rel}`);
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
  }

  await fsp.writeFile(local, b);
  return sha256(local);
}

function remoteMetaPath(){return path.join(WORKSPACE,'.hosting','remote-meta.json');}
async function loadRemoteMeta(){
  try {
    const x=JSON.parse(await fsp.readFile(remoteMetaPath(),'utf8'));
    return x && typeof x==='object' && !Array.isArray(x)?x:{};
  } catch(e) {
    if(e.code==='ENOENT') return {};
    throw new Error('Remote baseline is unreadable or corrupted: '+e.message);
  }
}
async function saveRemoteMeta(m){ await atomicJsonWrite(remoteMetaPath(),m); }
function remoteMetaEqual(a,b){
  if(!a || !b) return false;
  const as=Number(a.size ?? -1), bs=Number(b.size ?? -1);
  const am=a.mtime == null ? null : String(a.mtime);
  const bm=b.mtime == null ? null : String(b.mtime);
  return as===bs && am===bm;
}
async function verifyRemoteSnapshot(c,remotePath,expected,shouldExist=true){
  const current=await listRemoteFiles(c);
  const actual=current.get(remotePath);
  if(shouldExist){
    if(!actual) throw new Error(`Remote file changed since the deployment/sync decision: ${remotePath} no longer exists.`);
    if(!expected) throw new Error(`Remote file state could not be verified safely: ${remotePath}`);
    if(!remoteMetaEqual(expected,actual)) throw new Error(`Remote file changed since the deployment/sync decision: ${remotePath}`);
  } else if(actual){
    throw new Error(`Remote file changed since the deployment/sync decision: ${remotePath} now exists.`);
  }
  return actual;
}
function relFromRemote(c,rp){
  const x=normalizeRemote(rp);
  const m=(c.mappings||[]).find(m=>m.enabled!==false && (x===normalizeRemote(m.remote) || x.startsWith(normalizeRemote(m.remote)+'/')));
  if(!m) return null;
  const tail=x.slice(normalizeRemote(m.remote).length).replace(/^\/+/, '');
  return path.posix.join(m.local,tail);
}
function localPathForRel(rel){return path.join(WORKSPACE,...String(rel).split('/'));}

// Remote sync always revalidates the live remote inventory before acting.
async function atomicJsonWrite(file,value){
  const dir=path.dirname(file); await fsp.mkdir(dir,{recursive:true});
  const tmp=path.join(dir,'.'+path.basename(file)+'.'+process.pid+'.'+crypto.randomUUID()+'.tmp');
  try{ await fsp.writeFile(tmp,JSON.stringify(value,null,2),'utf8'); await fsp.rename(tmp,file); }
  finally{ await fsp.rm(tmp,{force:true}).catch(()=>{}); }
}

function protectionStatePath(){return path.join(WORKSPACE,'.hosting','protection-state.json');}
async function loadProtectionState(){
  try { const x=JSON.parse(await fsp.readFile(protectionStatePath(),'utf8')); return x&&typeof x==='object'?x:{}; }
  catch(e){ if(e.code==='ENOENT') return {}; throw new Error('Protection state is unreadable or corrupted: '+e.message); }
}
async function saveProtectionState(x){ await atomicJsonWrite(protectionStatePath(),x);}
function backupRoot(){return path.join(WORKSPACE,'sync-backup');}
function remoteBackupRoot(){return '.cpanel-sync-backup';}
function reportRoot(){return path.join(WORKSPACE,'sync-reports');}
function isIgnoredProtectionPath(rel){
  const p=String(rel).replaceAll('\\','/');
  return p.includes('.remote-deleted.backup') ||
    p.includes('.remote-overwritten.backup') ||
    p.includes('.local-deleted.backup') ||
    p.startsWith('sync-backup/') || p.includes('/sync-backup/') ||
    p.startsWith('sync-reports/') || p.includes('/sync-reports/') ||
    p.startsWith('.cpanel-sync-backup/') || p.includes('/.cpanel-sync-backup/');
}
async function copyLocalBackup(c,rel,suffix){
  const src=localPathForRel(rel); await assertSafeLocalPath(src); if(!fs.existsSync(src)) return null;
  const dst=path.join(backupRoot(),...String(rel).split('/'))+'.'+suffix+'.backup';
  await fsp.mkdir(path.dirname(dst),{recursive:true});
  let target=dst, n=1; while(fs.existsSync(target)){target=dst.replace(/\.backup$/,'.'+(n++)+'.backup');}
  await fsp.copyFile(src,target);
  await cleanupRetention(backupRoot(),normalizeSettings(c.settings).backupRetention);
  return target;
}
async function cleanupRemoteBackups(c){
  const root=normalizeRemote(remoteBackupRoot()),files=[];
  async function walk(dir){
    const j=await apiGet(c,'Fileman','list_files',{dir});
    for(const item of (j.data||[])){
      const nm=String(item.file||item.name||''); if(!nm) continue;
      const rp=normalizeRemote(dir+'/'+nm),type=String(item.type||'').toLowerCase();
      if(type==='dir'||type==='directory'){await walk(rp);continue;}
      if(nm.includes('.backup')) files.push({path:rp,mtime:item.mtime??item.modified??item.modification_time??0});
    }
  }
  try{await walk(root);}catch(e){log('Remote backup retention scan failed: '+e.message);return;}
  files.sort((a,b)=>Number(b.mtime||0)-Number(a.mtime||0));
  for(const item of files.slice(normalizeSettings(c.settings).backupRetention)){
    try{await retryOperation(()=>api2FileOp(c,'trash',item.path),transferAttempts(c));}
    catch(e){log('Remote backup retention cleanup failed for '+item.path+': '+e.message);}
  }
}
async function remoteBackup(c,remotePath,rel,suffix){
  const tmp=path.join(os.tmpdir(),`cpanel-backup-${crypto.randomUUID()}`); await fsp.mkdir(tmp,{recursive:true});
  const backupName=`${path.basename(rel)}.${suffix}.${Date.now()}.${crypto.randomUUID()}.backup`;
  const localTmp=path.join(tmp,backupName);
  const remoteDir=normalizeRemote(`${remoteBackupRoot()}/${path.posix.dirname(rel)}`);
  try{
    const u=new URL(`${c.host}/download`);u.searchParams.set('file',remotePath);
    const r=await fetch(u,{headers:authHeaders(c),signal:AbortSignal.timeout(120000)});
    if(!r.ok)throw new Error(`Remote backup download failed HTTP ${r.status}`);
    await fsp.writeFile(localTmp,Buffer.from(await r.arrayBuffer()));
    await ensureRemoteDir(c,remoteDir);
    await apiUpload(c,remoteDir,localTmp);
    await cleanupRemoteBackups(c);
    return normalizeRemote(`${remoteDir}/${backupName}`);
  }finally{await fsp.rm(tmp,{recursive:true,force:true}).catch(()=>{});}
}
async function requireKeyword(action,provided,enabled=true){if(!enabled)return; if(String(provided||'').toUpperCase()!==action)throw new Error(`This operation requires confirmation keyword ${action}.`);}
async function verifyRemoteContent(c,rp,localFile){const rh=await remoteSha256(c,rp);if(rh===null)return {ok:false,missing:true};const lh=sha256(localFile);return {ok:rh===lh,localHash:lh,remoteHash:rh};}
async function retryOperation(fn,attempts){let last;for(let i=0;i<attempts;i++){try{return await fn(i+1);}catch(e){last=e;if(i===attempts-1)throw e;}}throw last;}
function transferAttempts(c){return protectionEnabled(c,'retry') ? normalizeSettings(c.settings).retryAttempts : 1;}
async function withFileLock(lockPath,operation,fn){
  await fsp.mkdir(path.dirname(lockPath),{recursive:true});
  const owner={operation,pid:process.pid,createdAt:new Date().toISOString(),lockId:crypto.randomUUID()};

  async function acquire(){
    try{return await fsp.open(lockPath,'wx');}
    catch(e){
      if(e.code!=='EEXIST') throw e;
      let raw='';
      try{raw=(await fsp.readFile(lockPath,'utf8')).trim();}catch(_){
        throw new Error('Another cPanel Hosting Deploy operation is already running; its lock could not be inspected safely.');
      }
      let existing=null;
      try{existing=JSON.parse(raw);}catch(_){}
      if(!existing || !Number.isInteger(Number(existing.pid)) || Number(existing.pid)<=0){
        throw new Error('Another cPanel Hosting Deploy operation is already running; the lock metadata is invalid. Remove the lock only after confirming no deployment/sync operation is active.');
      }
      try{
        process.kill(Number(existing.pid),0);
      }catch(pidError){
        if(pidError.code==='ESRCH'){
          try{await fsp.unlink(lockPath);}catch(unlinkError){
            if(unlinkError.code!=='ENOENT') throw unlinkError;
          }
          return await fsp.open(lockPath,'wx');
        }
        throw new Error('Another cPanel Hosting Deploy operation is already running (PID '+existing.pid+').');
      }
      throw new Error('Another cPanel Hosting Deploy operation is already running: '+raw);
    }
  }

  let handle;
  try{
    handle=await acquire();
    await handle.writeFile(JSON.stringify(owner));
    return await fn();
  }finally{
    try{if(handle)await handle.close();}catch(_){}
    try{
      const raw=await fsp.readFile(lockPath,'utf8');
      const current=JSON.parse(raw);
      if(current && current.lockId===owner.lockId) await fsp.unlink(lockPath);
    }catch(_){}
  }
}
async function withOperationLock(c,operation,fn){
  if(!protectionEnabled(c,'locks')) return await fn();
  return await withFileLock(path.join(WORKSPACE,'.hosting','operation.lock'),operation,fn);
}
async function withProtectionStateLock(fn){
  return await withFileLock(path.join(WORKSPACE,'.hosting','protection-state.lock'),'protection-state',fn);
}
async function cleanupRetention(dir,limit){
  try{
    await fsp.mkdir(dir,{recursive:true});
    const files=[];
    async function walk(current){
      for(const ent of await fsp.readdir(current,{withFileTypes:true})){
        const full=path.join(current,ent.name);
        if(ent.isDirectory()) await walk(full);
        else if(ent.isFile()){
          const st=await fsp.stat(full);
          files.push({path:full,mtime:st.mtimeMs});
        }
      }
    }
    await walk(dir);
    files.sort((a,b)=>b.mtime-a.mtime);
    for(const item of files.slice(Math.max(0,Number(limit)||0))) await fsp.unlink(item.path);
  }catch(e){log(`Retention cleanup failed: ${e.message}`);}
}
function acceptedStateKey(c,rel){return `${c.name}::${rel}`;}
async function getAccepted(c,rel){const st=await loadProtectionState();return st.accepted?.[acceptedStateKey(c,rel)]||null;}
async function setAccepted(c,rel,value){
  return await withProtectionStateLock(async()=>{
    const st=await loadProtectionState();
    st.accepted=st.accepted||{};
    const k=acceptedStateKey(c,rel);
    if(value)st.accepted[k]=value;else delete st.accepted[k];
    await saveProtectionState(st);
  });
}
async function getSettings(c){return normalizeSettings(c.settings);}
async function updateSettings(c,patch){
  return await withConnectionsStoreLock(async()=>{
    const store=await loadStore();
    const idx=store.connections.findIndex(x=>x.name.toLowerCase()===c.name.toLowerCase());
    if(idx<0)throw new Error(`Connection not found: ${c.name}`);
    const current=store.connections[idx];
    current.settings=normalizeSettings({...normalizeSettings(current.settings),...patch,protection:{...normalizeSettings(current.settings).protection,...(patch.protection||{})}});
    await saveStore(store);
    c.settings=current.settings;
    return c.settings;
  });
}
function protectionWarning(c){const st=normalizeSettings(c.settings);if(st.protectionMode==='OFF')return 'Protection is OFF: only the original v1.10.3 core workflow is active.';return st.protectionMode==='SECURED'?'Protection SECURED: all protection rules are active.':'Protection CUSTOM: only selected protection rules are active.';}
async function buildRemoteStatus(c, options={}){
  const advanceBaseline=options.advanceBaseline!==false;
  const manifest=await loadManifest();
  const previous=await loadRemoteMeta();
  const hadBaseline=Object.keys(previous).length>0;
  const remoteFiles=await listRemoteFiles(c);
  const current={};
  for(const [rp,info] of remoteFiles) current[rp]={size:Number(info.size||0),mtime:info.mtime==null?null:String(info.mtime)};

  const remoteNew=[], remoteUntracked=[], remoteChanged=[], remoteDeleted=[], remoteUnchanged=[], conflicts=[];
  for(const [rp,info] of remoteFiles){
    const rel=relFromRemote(c,rp);
    if(!rel) continue;
    if(!Object.prototype.hasOwnProperty.call(manifest,rel)){
      const lp=localPathForRel(rel);
      let localExists=false; try{localExists=(await fsp.stat(lp)).isFile();}catch(_){}
      if(localExists){
        conflicts.push({path:rel,remote:rp,reason:'Remote file is not tracked, but a local file already exists at the mapped path.'});
      } else if(!hadBaseline || Object.prototype.hasOwnProperty.call(previous,rp)) {
        remoteUntracked.push({path:rel,remote:rp,size:info.size,mtime:info.mtime});
      } else {
        remoteNew.push({path:rel,remote:rp,size:info.size,mtime:info.mtime});
      }
      continue;
    }
    const old=previous[rp];
    if(!old){
      remoteUnchanged.push({path:rel,remote:rp,size:info.size,mtime:info.mtime,baseline:'established'});
    } else if(remoteMetaEqual(old,info)) {
      remoteUnchanged.push({path:rel,remote:rp,size:info.size,mtime:info.mtime});
    } else {
      let localChanged=false;
      try{localChanged=sha256(localPathForRel(rel))!==manifest[rel];}catch(_){}
      if(localChanged) conflicts.push({path:rel,remote:rp,reason:'Both local and remote may have changed since the last remote baseline. Remote sync will not overwrite the local file automatically.'});
      else remoteChanged.push({path:rel,remote:rp,size:info.size,mtime:info.mtime});
    }
  }
  for(const rel of Object.keys(manifest)){
    if(excluded(rel,c.exclude)) continue;
    const rp=remoteFromRel(c,rel);
    if(!remoteFiles.has(rp)) remoteDeleted.push({path:rel,remote:rp});
  }

  const hasDifferences = remoteNew.length||remoteUntracked.length||remoteChanged.length||remoteDeleted.length||conflicts.length;
  if(advanceBaseline && !hasDifferences) await saveRemoteMeta(current);
  return {
    connection:c.name,
    baselineInitialized:!hadBaseline,
    summary:{remoteNew:remoteNew.length,remoteUntracked:remoteUntracked.length,remoteChanged:remoteChanged.length,remoteDeleted:remoteDeleted.length,remoteUnchanged:remoteUnchanged.length,conflicts:conflicts.length},
    remoteNew,remoteUntracked,remoteChanged,remoteDeleted,remoteUnchanged,conflicts,
    message:(!hadBaseline && (remoteNew.length||remoteUntracked.length))
      ? 'Initial remote baseline established. Files that were not previously tracked are shown as REMOTE UNTRACKED; files appearing after this baseline will be REMOTE NEW.'
      : (remoteNew.length||remoteChanged.length||remoteDeleted.length||conflicts.length)
        ? 'Remote changes were detected. Review them before syncing to the local workspace.'
        : 'No remote changes detected.'
  };
}

async function buildRemoteStatusProtected(c, options={}){
  const advanceBaseline=options.advanceBaseline!==false;
  const manifest=await loadManifest();
  const previous=await loadRemoteMeta();
  const hadBaseline=Object.keys(previous).length>0;
  const remoteFiles=await listRemoteFiles(c);
  const current={};
  for(const [rp,info] of remoteFiles) current[rp]={size:Number(info.size||0),mtime:info.mtime==null?null:String(info.mtime)};

  const remoteNew=[], remoteUntracked=[], remoteChanged=[], remoteDeleted=[], remoteUnchanged=[], conflicts=[];
  for(const [rp,info] of remoteFiles){
    const rel=relFromRemote(c,rp);
    if(!rel) continue;
    if(!Object.prototype.hasOwnProperty.call(manifest,rel)){
      const lp=localPathForRel(rel);
      let localExists=false; try{localExists=(await fsp.stat(lp)).isFile();}catch(_){}
      if(localExists){
        conflicts.push({path:rel,remote:rp,reason:'Remote file is not tracked, but a local file already exists at the mapped path.'});
      } else if(!hadBaseline || Object.prototype.hasOwnProperty.call(previous,rp)) {
        remoteUntracked.push({path:rel,remote:rp,size:info.size,mtime:info.mtime});
      } else {
        remoteNew.push({path:rel,remote:rp,size:info.size,mtime:info.mtime});
      }
      continue;
    }
    const old=previous[rp];
    if(!old){
      remoteUnchanged.push({path:rel,remote:rp,size:info.size,mtime:info.mtime,baseline:'established'});
    } else if(remoteMetaEqual(old,info)) {
      remoteUnchanged.push({path:rel,remote:rp,size:info.size,mtime:info.mtime});
    } else {
      let localChanged=false;
      try{localChanged=sha256(localPathForRel(rel))!==manifest[rel];}catch(_){}
      if(localChanged) conflicts.push({path:rel,remote:rp,reason:'Both local and remote may have changed since the last remote baseline. Remote sync will not overwrite the local file automatically.'});
      else remoteChanged.push({path:rel,remote:rp,size:info.size,mtime:info.mtime});
    }
  }
  for(const rel of Object.keys(manifest)){
    if(excluded(rel,c.exclude)) continue;
    const rp=remoteFromRel(c,rel);
    if(!remoteFiles.has(rp)) remoteDeleted.push({path:rel,remote:rp});
  }

  // A read-only status check never advances the remote baseline when differences exist.
  // If every tracked pair is confirmed identical, the current state is safe to accept.
  const hasDifferences = remoteNew.length||remoteChanged.length||remoteDeleted.length||conflicts.length;
  if(advanceBaseline && !hasDifferences) await saveRemoteMeta(current);
  return {
    connection:c.name,
    baselineInitialized:!hadBaseline,
    summary:{remoteNew:remoteNew.length,remoteUntracked:remoteUntracked.length,remoteChanged:remoteChanged.length,remoteDeleted:remoteDeleted.length,remoteUnchanged:remoteUnchanged.length,conflicts:conflicts.length},
    remoteNew,remoteUntracked,remoteChanged,remoteDeleted,remoteUnchanged,conflicts,
    message:(!hadBaseline && (remoteNew.length||remoteUntracked.length))
      ? 'Initial remote baseline established. Files that were not previously tracked are shown as REMOTE UNTRACKED; files appearing after this baseline will be REMOTE NEW.'
      : (remoteNew.length||remoteChanged.length||remoteDeleted.length||conflicts.length)
        ? 'Remote changes were detected. Review them before syncing to the local workspace.'
        : 'No remote changes detected.'
  };
}

async function remoteSync(c, actions, confirm){
  return withOperationLock(c,'remote-sync',async()=>{
  // Refresh the remote observation immediately before a sync decision, but
  // NEVER advance the comparison baseline during this refresh. The baseline
  // must remain the state against which the user was shown the change.
  // Otherwise remote-status can report a change and remote-sync can erase it
  // from its own comparison before applying the requested action.
  const st=normalizeSettings(c.settings);
  const pending=st.protectionMode==='OFF'
    ? await buildRemoteStatus(c,{advanceBaseline:false})
    : await buildRemoteStatusProtected(c,{advanceBaseline:false});
  const candidates=[...pending.remoteNew.map(x=>({...x,status:'REMOTE NEW'})),...pending.remoteChanged.map(x=>({...x,status:'REMOTE CHANGED'})),...pending.remoteDeleted.map(x=>({...x,status:'REMOTE DELETED'}))];
  const allowed=new Map(Array.isArray(actions)?actions.map(x=>[String(x.path),x]):[]);
  if(!confirm) return {requiresConfirmation:true,connection:c.name,summary:{remoteNew:pending.remoteNew.length,remoteUntracked:pending.remoteUntracked.length,remoteChanged:pending.remoteChanged.length,remoteDeleted:pending.remoteDeleted.length,conflicts:pending.conflicts.length},files:candidates,remoteUntracked:pending.remoteUntracked,conflicts:pending.conflicts,message:candidates.length?'No local files were changed. Review each remote change and call remote sync again with explicit per-file actions (sync or keep) and confirm=true.':'No remote changes need syncing.'};
  const synced=[],kept=[],failed=[];
  for(const item of candidates){
    const action=allowed.get(item.path);
    if(!action || action.action==='keep'){kept.push(item.path);continue;}
    if(action.action!=='sync'){failed.push({path:item.path,error:'Action must be sync or keep.'});continue;}
    try{
      const local=localPathForRel(item.path);
      if(item.status==='REMOTE DELETED'){
        if(action.confirmation!=='DELETE_LOCAL') throw new Error('Syncing REMOTE DELETED requires confirmation value DELETE_LOCAL.');
        await verifyRemoteSnapshot(c,item.remote,null,false);
        if(protectionEnabled(c,'backupBeforeDestructive') && protectionEnabled(c,'localBackups')){
          await copyLocalBackup(c,item.path,'remote-deleted');
        }
        await withManifestLock(async()=>{
          await fsp.rm(local,{force:true});
          const manifest=await loadManifest();
          delete manifest[item.path];
          await saveManifest(manifest);
        });
      } else {
        await verifyRemoteSnapshot(c,item.remote,{size:item.size,mtime:item.mtime},true);
        if(item.status==='REMOTE CHANGED' && action.confirmation!=='OVERWRITE_LOCAL') throw new Error('Syncing REMOTE CHANGED requires confirmation value OVERWRITE_LOCAL.');
        if(item.status==='REMOTE CHANGED' && protectionEnabled(c,'backupBeforeDestructive') && protectionEnabled(c,'localBackups')){
          await copyLocalBackup(c,item.path,'remote-overwritten');
        }
        const hash=await withManifestLock(async()=>{
          const downloadedHash=await retryOperation(()=>downloadOne(c,item.remote,item.path,true),transferAttempts(c));
          const manifest=await loadManifest();
          manifest[item.path]=downloadedHash;
          await saveManifest(manifest);
          return downloadedHash;
        });
      }
      synced.push(item.path);
    }catch(e){failed.push({path:item.path,error:e.message});}
  }
  // Partial-success rule: advance the remote baseline only for actions that
  // actually completed. Kept and failed changes must remain against the old
  // baseline so they are detected again on the next status/sync operation.
  const previousBaseline=await loadRemoteMeta();
  const currentInventory=await listRemoteFiles(c);
  const nextBaseline={...previousBaseline};
  for(const item of candidates){
    if(!synced.includes(item.path)) continue;
    if(item.status==='REMOTE DELETED'){
      delete nextBaseline[item.remote];
      continue;
    }
    const info=currentInventory.get(item.remote);
    if(info){
      nextBaseline[item.remote]={
        size:Number(info.size||0),
        mtime:info.mtime==null?null:String(info.mtime)
      };
    }
  }
  await saveRemoteMeta(nextBaseline);
  return {requiresConfirmation:false,connection:c.name,synced,kept,failed,conflicts:pending.conflicts,summary:{remoteNew:pending.remoteNew.length,remoteUntracked:pending.remoteUntracked.length,remoteChanged:pending.remoteChanged.length,remoteDeleted:pending.remoteDeleted.length,conflicts:pending.conflicts.length},message:`Synced ${synced.length} remote change(s); kept ${kept.length}; failed ${failed.length}.`};
  });
}

async function buildPlan(c){
  return await withManifestLock(()=>buildPlanUnlocked(c));
}

async function buildPlanUnlocked(c){
  const manifest=await loadManifest();
  const out=[];

  // First-run safety: if the local manifest has no hash for a file, compare the
  // local bytes with the actual remote bytes before calling it NEW. This prevents
  // an existing production site from being re-uploaded just because the local
  // workspace has never deployed through this plugin before.
  let remoteFiles = null;
  const needRemoteBaseline = (c.mappings||[]).some(m=>m.enabled!==false) &&
    (()=>{
      for (const m of (c.mappings||[])) {
        if (m.enabled===false) continue;
        const root=path.join(WORKSPACE,...m.local.split('/'));
        // If the local mapping exists and contains any file missing from the manifest,
        // a remote baseline may be required.
        // We intentionally do not inspect every file here; buildPlan below will decide.
        try { await assertSafeLocalPath(root); fs.accessSync(root); } catch(_) { continue; }
        return true;
      }
      return false;
    })();
  if (needRemoteBaseline) {
    remoteFiles = await listRemoteFiles(c);
  }

  let manifestChanged = false;
  // Compute remote hashes once per missing-manifest file, in a small bounded
  // parallel pool. This is the safe first-run baseline: existing remote files
  // that are byte-identical to local files become UNCHANGED, not NEW.
  let baselineHashes = new Map();
  if (remoteFiles && remoteFiles.size) {
    const candidatePaths = [];
    for (const m of (c.mappings || [])) {
      if (m.enabled === false) continue;
      const root = path.join(WORKSPACE, ...m.local.split('/'));
      try { await assertSafeLocalPath(root); fs.accessSync(root); } catch (_) { continue; }
      async function collect(dir) {
        for (const ent of await fsp.readdir(dir, {withFileTypes:true})) {
          const full = path.join(dir, ent.name);
          const rel = relativePosix(full);
          if (excluded(rel, c.exclude)) continue;
          if (ent.isDirectory()) { await collect(full); continue; }
          if (Object.prototype.hasOwnProperty.call(manifest, rel)) continue;
          const rp = remoteFromRel(c, rel);
          if (remoteFiles.has(rp)) candidatePaths.push(rp);
        }
      }
      await collect(root);
    }
    baselineHashes = await remoteHashes(c, [...new Set(candidatePaths)]);
  }

  for(const m of (c.mappings||[])){
    if(m.enabled===false) continue;
    const root=path.join(WORKSPACE,...m.local.split('/'));
    try{await assertSafeLocalPath(root);await fsp.access(root);}catch(_){continue;}
    async function walk(dir){
      for(const ent of await fsp.readdir(dir,{withFileTypes:true})){
        const full=path.join(dir,ent.name); const rel=relativePosix(full);
        if(ent.isSymbolicLink()) throw new Error(`Symbolic links are not allowed in deployment paths: ${rel}`);
        if(excluded(rel,c.exclude)) continue;
        if(ent.isDirectory()){await walk(full);continue;}
        const hash=sha256(full);
        let status;
        if(Object.prototype.hasOwnProperty.call(manifest,rel)) {
          status=manifest[rel]!==hash?'CHANGED':'UNCHANGED';
        } else {
          const remote=remoteFromRel(c,rel);
          const remoteInfo=remoteFiles ? remoteFiles.get(remote) : null;
          if(!remoteInfo) {
            status='NEW';
          } else {
            const remoteHash=baselineHashes.get(remote);
            if(remoteHash && remoteHash===hash) {
              status='UNCHANGED';
              // Establish the baseline only after a verified byte-for-byte match.
              manifest[rel]=hash;
              manifestChanged=true;
            } else {
              status='CHANGED';
            }
          }
        }
        out.push({relativePath:rel,localPath:full,hash,status,size:ent.size,remoteInfo:remoteFiles?.get(remoteFromRel(c,rel))||null,mapping:{local:m.local,remote:m.remote}});
      }
    }
    await walk(root);
  }
  // Detect files that were previously tracked locally but are now missing.
  // A missing local file is NEVER treated as an automatic remote deletion.
  // It becomes DELETED and is resolved explicitly by the user.
  const seenLocal = new Set(out.map(x=>x.relativePath));
  const remoteFilesForDeleted = remoteFiles || await listRemoteFiles(c);
  for (const rel of Object.keys(manifest)) {
    if (seenLocal.has(rel)) continue;
    if (excluded(rel, c.exclude)) continue;
    let mapped = false;
    try { mapped = Boolean(mappingForLocal(c, rel)); } catch (_) { mapped = false; }
    if (!mapped) continue;
    const remote = remoteFromRel(c, rel);
    if (remoteFilesForDeleted.has(remote)) {
      out.push({relativePath:rel, localPath:path.join(WORKSPACE,...rel.split('/')), hash:null, status:'DELETED', size:0, remoteInfo:remoteFilesForDeleted.get(remote), mapping:mappingForLocal(c, rel)});
    }
  }
  if(manifestChanged) await saveManifest(manifest);
  return out;
}

async function ensureRemoteDir(c,dir){
  dir=normalizeRemote(dir); if(dir==='/') return;
  try{await apiGet(c,'Fileman','list_files',{dir});return;}catch(_){ }
  const parent=path.posix.dirname(dir); const name=path.posix.basename(dir); await ensureRemoteDir(c,parent); await apiGet(c,'Fileman','mkdir',{path:parent==='.'?'/':parent,name});
}


async function workspaceState(c){
  const entries = [];
  let totalFiles = 0;
  let totalDirs = 0;
  let hostingDirCount = 0;
  for (const ent of await fsp.readdir(WORKSPACE, {withFileTypes:true})) {
    if (ent.name === '.hosting') continue;
    if (excluded(ent.name, c.exclude)) continue;
    entries.push(ent.name);
    if (ent.isDirectory()) totalDirs++; else totalFiles++;
  }
  const mappings = (c.mappings || []).filter(m=>m.enabled!==false);
  const mappingRoots = mappings.map(m=>({local:m.local, remote:m.remote, exists:fs.existsSync(path.join(WORKSPACE,...m.local.split('/')))}));
  const manifest = await loadManifest();
  const manifestEntries = Object.keys(manifest).length;
  const hasLocalContent = entries.length > 0;
  const mappedLocalExists = mappingRoots.some(x=>x.exists);
  return {
    workspace: WORKSPACE,
    workspaceSource: WORKSPACE_SOURCE,
    state: !hasLocalContent ? 'EMPTY' : (mappings.length ? 'EXISTING_OR_MAPPED' : 'EXISTING_UNMAPPED'),
    hasLocalContent,
    totalFiles,
    totalDirs,
    entries: entries.slice(0,100),
    existingMappings: mappingRoots,
    mappingCount: mappings.length,
    manifestEntries,
    recommendedQuestion: 'Kako je trenutno stanje lokalnog projekta? 1) Nemam lokalne fajlove / imam prazan lokalni folder i želim preuzeti odabrane foldere sa hostinga. 2) Već imam lokalni folder sa projektom i želim ga mapirati na hosting. 3) Želim promijeniti postojeću konfiguraciju.'
  };
}

async function initializeWorkspaceFromHost(c, mappings, confirm){
  return withOperationLock(c,'workspace-setup',async()=>{
  if(!confirm) return {
    requiresConfirmation:true,
    message:'No files were downloaded. Review the selected remote-to-local mappings, then call initialize again with confirm=true.'
  };
  if(!Array.isArray(mappings) || !mappings.length) throw new Error('At least one remote-to-local mapping is required.');

  const normalized = mappings.map(m=>{
    const local=normalizeLocalPath(m.local||m.localPath);
    const remote=normalizeRemoteMapping(c.remoteRoot,m.remote||m.remotePath);
    return {local,remote,enabled:m.enabled!==false};
  }).filter(m=>m.enabled);
  if(!normalized.length) throw new Error('At least one enabled mapping is required.');

  // This onboarding path is intentionally strict: it may populate only a new
  // or genuinely empty local folder. It never overwrites an existing project.
  for(const m of normalized){
    const localRoot=path.join(WORKSPACE,...m.local.split('/'));
    try{
      const st=await fsp.stat(localRoot);
      if(!st.isDirectory()) throw new Error(`Local target exists and is not a folder: ${m.local}`);
      const entries=await fsp.readdir(localRoot);
      if(entries.length) throw new Error(`Local target is not empty: ${m.local}`);
    }catch(e){
      if(e.code==='ENOENT') continue;
      throw e;
    }
    if(m.remote===normalizeRemote(c.remoteRoot)) throw new Error(`Remote mapping must point to a folder below the cPanel home directory: ${m.remote}`);
    if(!m.remote.startsWith(normalizeRemote(c.remoteRoot) + '/')) throw new Error(`Remote mapping must be inside the connection remote root: ${m.remote}`);
  }

  // Use the selected mappings for the initialization run, but persist them only
  // after the download has completed successfully.
  const previousMappings=c.mappings;
  c.mappings=normalized;
  const downloaded=[];
  async function walk(remoteDir,localRoot,remoteRoot){
    const j=await apiGet(c,'Fileman','list_files',{dir:remoteDir});
    for(const item of (j.data||[])){
      const nm=String(item.file||item.name||''); if(!nm) continue;
      const rp=normalizeRemote(`${remoteDir}/${nm}`);
      const tail=rp.slice(remoteRoot.length).replace(/^\/+/, '');
      const rel=path.posix.join(localRoot,tail);
      if(excluded(rel,c.exclude)) continue;
      if(String(item.type)==='dir'||String(item.type)==='directory'){
        await walk(rp,localRoot,remoteRoot); continue;
      }
      if(!allowedRemote(c,rp)) continue;
      const local=path.join(WORKSPACE,...rel.split('/'));
      await assertSafeLocalPath(local);
      try { await fsp.access(local); throw new Error(`Local target became non-empty during initialization: ${rel}`); }
      catch(e) { if(e.code!=='ENOENT') throw e; }
      const u=new URL(`${c.host}/download`); u.searchParams.set('file',rp);
      const r=await fetch(u,{headers:authHeaders(c),signal:AbortSignal.timeout(120000)});
      if(!r.ok) throw new Error(`Download failed HTTP ${r.status} for ${rp}`);
      const b=Buffer.from(await r.arrayBuffer());
      await withManifestLock(async()=>{
        await fsp.mkdir(path.dirname(local),{recursive:true});
        await fsp.writeFile(local,b,{flag:'wx'});
        const manifest=await loadManifest();
        manifest[rel]=sha256(local);
        await saveManifest(manifest);
      });
      downloaded.push(rel);
    }
  }
  for(const m of normalized) await walk(m.remote,m.local,m.remote);
  await withConnectionsStoreLock(async()=>{
    const store=await loadStore();
    const stored=store.connections.find(x=>x.name.toLowerCase()===c.name.toLowerCase());
    if(stored) { stored.mappings=normalized; await saveStore(store); }
    else c.mappings=previousMappings;
  });
  return {
    requiresConfirmation:false,
    initialized:true,
    connection:c.name,
    mappings:normalized,
    downloaded,
    count:downloaded.length,
    message:'Workspace initialized from hosting. The downloaded files are now the local working copy and their SHA-256 hashes were recorded.'
  };
  });
}

async function deploy(c, confirm, deletionActions=[], confirmation='') {
  return withOperationLock(c,'deploy',async()=>{
  const plan=await buildPlan(c);
  const uploadItems=plan.filter(x=>x.status==='NEW'||x.status==='CHANGED');
  const deletedItems=plan.filter(x=>x.status==='DELETED');
  const summary={
    connection:c.name,
    new:uploadItems.filter(x=>x.status==='NEW').length,
    changed:uploadItems.filter(x=>x.status==='CHANGED').length,
    unchanged:plan.filter(x=>x.status==='UNCHANGED').length,
    deleted:deletedItems.length,
    files:uploadItems.map(x=>({status:x.status,path:x.relativePath,size:x.size,mapping:x.mapping})),
    deletedFiles:deletedItems.map(x=>({status:'DELETED',path:x.relativePath,remote:remoteFromRel(c,x.relativePath)}))
  };
  if(!confirm) return {
    requiresConfirmation:true,
    summary,
    message: deletedItems.length
      ? 'No hosting changes were made. Review NEW/CHANGED uploads and the DELETED LOCAL files. Deleted-local files can be restored from hosting, explicitly deleted from hosting, or left unchanged.'
      : 'No files were uploaded. Review the plan, then call deploy again with confirm=true after explicit user confirmation.'
  };

  const protection = normalizeSettings(c.settings);
  const overwriteTargets = uploadItems.filter(x=>x.status==='CHANGED');
  if (protectionEnabled(c,'overwriteConfirmation') && overwriteTargets.length &&
      String(confirmation||'').toUpperCase()!=='OVERWRITE') {
    return {
      requiresConfirmation:true,
      protectionConfirmation:'OVERWRITE',
      summary,
      message:'Protection requires the confirmation keyword OVERWRITE because one or more local CHANGED files will overwrite existing hosting files. No hosting changes were made.'
    };
  }

  const uploaded=[]; const failed=[]; const restored=[]; const restoreFailed=[]; const deleted=[]; const deleteFailed=[]; const kept=[];
  const actionMap=new Map(Array.isArray(deletionActions)?deletionActions.map(x=>[String(x.path),x]):[]);

  for(const item of uploadItems){
    try{
      const remote=remoteFromRel(c,item.relativePath);
      if(!allowedRemote(c,remote)) throw new Error('Remote path is outside configured folders.');
      await verifyRemoteSnapshot(c,remote,item.remoteInfo,item.status==='CHANGED');
      if(item.status==='CHANGED' && protectionEnabled(c,'backupBeforeDestructive') && protectionEnabled(c,'remoteBackups')){
        await retryOperation(()=>remoteBackup(c,remote,item.relativePath,'remote-overwritten'),transferAttempts(c));
      }
      await ensureRemoteDir(c,path.posix.dirname(remote));
      await retryOperation(()=>apiUpload(c,path.posix.dirname(remote),item.localPath),transferAttempts(c));
      await updateManifestEntry(item.relativePath,item.hash);
      uploaded.push(item.relativePath);
    } catch(e){ failed.push({path:item.relativePath,error:e.message}); }
  }

  for(const item of deletedItems){
    const action=actionMap.get(item.relativePath);
    if(!action || action.action==='keep') { kept.push(item.relativePath); continue; }
    const remote=remoteFromRel(c,item.relativePath);
    if(!allowedRemote(c,remote)) { deleteFailed.push({path:item.relativePath,error:'Remote path is outside configured folders.'}); continue; }
    try {
      if(action.action==='restore') {
        await verifyRemoteSnapshot(c,remote,item.remoteInfo,true);
        const hash=await withManifestLock(async()=>{
          const restoredHash=await downloadOne(c,remote,item.relativePath,true);
          const manifest=await loadManifest();
          manifest[item.relativePath]=restoredHash;
          await saveManifest(manifest);
          return restoredHash;
        });
        restored.push(item.relativePath);
      } else if(action.action==='delete') {
        if(String(action.confirmation||'')!=='DELETE') throw new Error('Remote deletion requires confirmation value DELETE.');
        await verifyRemoteSnapshot(c,remote,item.remoteInfo,true);
        if(protectionEnabled(c,'backupBeforeDestructive') && protectionEnabled(c,'remoteBackups')){
          await retryOperation(()=>remoteBackup(c,remote,item.relativePath,'local-deleted'),transferAttempts(c));
        }
        await api2FileOp(c,'trash',remote);
        await updateManifestEntry(item.relativePath,undefined);
        deleted.push(item.relativePath);
      } else {
        kept.push(item.relativePath);
      }
    } catch(e) {
      if(action.action==='restore') restoreFailed.push({path:item.relativePath,error:e.message});
      else deleteFailed.push({path:item.relativePath,error:e.message});
    }
  }

  return {
    requiresConfirmation:false,
    summary,
    uploaded, failed,
    restored, restoreFailed,
    deleted, deleteFailed,
    kept,
    message:`Uploaded ${uploaded.length}; restored ${restored.length}; remotely deleted ${deleted.length}; failed ${failed.length + restoreFailed.length + deleteFailed.length}.`
  };
  });
}

async function bootstrapDefault(){
  return await withConnectionsStoreLock(async()=>{
    const a = configuredCredentials();
    if (!a.host && !a.username && !a.remoteRoot && !a.apiToken) return false;
    if (!a.host || !a.username || !a.remoteRoot || !a.apiToken) return false;
    const store = await loadStore();
    if (store.connections.length) return false;
    const name = configuredConnectionName();
    const c = validateConnectionInput({
      name, host:a.host, username:a.username, remoteRoot:a.remoteRoot,
      apiToken:a.apiToken, mappings:[], exclude:DEFAULT_EXCLUDE
    });
    store.connections.push(c);
    await saveStore(store);
    log(`Created connection ${name} from explicitly configured connection fields.`);
    return true;
  });
}

async function syncDefaultFromEnv(){
  try {
    return await withConnectionsStoreLock(async()=>{
      const store=await loadStore();
      const configuredName = configuredConnectionName();
      if (store.connections.length === 1 && store.connections[0].name === DEFAULT_CONNECTION_NAME && configuredName !== DEFAULT_CONNECTION_NAME) {
        store.connections[0].name = configuredName;
        await saveStore(store);
        log(`Default connection renamed to ${configuredName} from Cursor plugin configuration.`);
        return true;
      }
      return false;
    });
  } catch (e) { log(`Default connection rename sync skipped: ${e.message}`); }
  return false;
}

const TOOLS=[ {name:'cpanel_get_settings',description:'Get per-connection Protection settings without exposing credentials.',inputSchema:{type:'object',properties:{name:{type:'string'}},required:['name']}},
 {name:'cpanel_set_settings',description:'Set per-connection Protection mode and grouped protection settings.',inputSchema:{type:'object',properties:{name:{type:'string'},protectionMode:{type:'string',enum:['SECURED','CUSTOM','OFF']},protection:{type:'object'},largeFileThresholdMB:{type:'number'},retryAttempts:{type:'number'},reportRetention:{type:'number'},backupRetention:{type:'number'},autoDeploy:{type:'boolean'},verifyAfterSync:{type:'boolean'},verifyMethod:{type:'string'}},required:['name']}} ,

 {name:'cpanel_help',description:'Return the complete list of cPanel Hosting Deploy commands and exactly what each command does.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
 {name:'cpanel_list_connections',description:'List configured cPanel connections without exposing secrets.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
 {name:'cpanel_add_connection',description:'Add a cPanel connection. The API token is encrypted with Windows DPAPI and never returned.',inputSchema:{type:'object',properties:{name:{type:'string'},host:{type:'string'},username:{type:'string'},apiToken:{type:'string'},remoteRoot:{type:'string'},mappings:{type:'array',items:{type:'object',properties:{local:{type:'string'},remote:{type:'string'},enabled:{type:'boolean'}},required:['local','remote']}},exclude:{type:'array',items:{type:'string'}}},required:['name','host','username','apiToken','remoteRoot']}},
 {name:'cpanel_edit_connection',description:'Edit a connection. If apiToken is omitted, the existing encrypted token is preserved.',inputSchema:{type:'object',properties:{name:{type:'string'},newName:{type:'string'},host:{type:'string'},username:{type:'string'},apiToken:{type:'string'},remoteRoot:{type:'string'},mappings:{type:'array',items:{type:'object',properties:{local:{type:'string'},remote:{type:'string'},enabled:{type:'boolean'}},required:['local','remote']}},exclude:{type:'array',items:{type:'string'}}},required:['name']}},
 {name:'cpanel_remove_connection',description:'Remove a stored cPanel connection.',inputSchema:{type:'object',properties:{name:{type:'string'}},required:['name']}},
 {name:'cpanel_list_remote_folders',description:'List directories under the connection remote root so the user can choose deployment mappings. Read-only.',inputSchema:{type:'object',properties:{name:{type:'string'},path:{type:'string'}},required:['name']}} ,
 {name:'cpanel_test_connection',description:'Test cPanel credentials and remote root access.',inputSchema:{type:'object',properties:{name:{type:'string'}},required:['name']}},
 {name:'cpanel_workspace_setup',description:'Safely initialize a local workspace from selected remote cPanel folders. This mode only writes into missing or genuinely empty local folders and never overwrites existing project files.',inputSchema:{type:'object',properties:{name:{type:'string'},mappings:{type:'array',items:{type:'object',properties:{local:{type:'string'},remote:{type:'string'},enabled:{type:'boolean'}},required:['local','remote']}},confirm:{type:'boolean'}},required:['name','mappings','confirm']}},
 {name:'cpanel_workspace_state',description:'Read-only check of the current local workspace state. Call this before onboarding or changing mappings.',inputSchema:{type:'object',properties:{name:{type:'string'}},required:['name']}},
 {name:'cpanel_deploy_plan',description:'Build a local deployment plan. Never modifies hosting.',inputSchema:{type:'object',properties:{name:{type:'string'}},required:['name']}},
 {name:'cpanel_deploy',description:'Deploy NEW and CHANGED files. Protection may require OVERWRITE for CHANGED files. DELETED local files are never deleted remotely automatically; provide explicit per-file actions restore, delete (requires confirmation DELETE), or keep.',inputSchema:{type:'object',properties:{name:{type:'string'},confirm:{type:'boolean'},confirmation:{type:'string'},deletionActions:{type:'array',items:{type:'object',properties:{path:{type:'string'},action:{type:'string',enum:['restore','delete','keep']},confirmation:{type:'string'}},required:['path','action']}}},required:['name','confirm']}},
 {name:'cpanel_local_upload',description:'Explicit full local-to-remote upload. Protection may require OVERWRITE when existing hosting files will be replaced; new local files are added after confirmation.',inputSchema:{type:'object',properties:{name:{type:'string'},confirm:{type:'boolean'},confirmation:{type:'string'}},required:['name','confirm']}},
 {name:'cpanel_remote_status',description:'Read-only remote-to-local comparison. Detect REMOTE NEW, REMOTE CHANGED, and REMOTE DELETED using a saved remote metadata baseline. Never modifies local files except the remote metadata observation file.',inputSchema:{type:'object',properties:{name:{type:'string'}},required:['name']}},
 {name:'cpanel_remote_sync',description:'Synchronize explicitly selected remote changes into the local workspace. REMOTE CHANGED requires OVERWRITE_LOCAL confirmation; REMOTE DELETED requires DELETE_LOCAL confirmation.',inputSchema:{type:'object',properties:{name:{type:'string'},confirm:{type:'boolean'},actions:{type:'array',items:{type:'object',properties:{path:{type:'string'},action:{type:'string',enum:['sync','keep']},confirmation:{type:'string'}},required:['path','action']}}},required:['name','confirm']}},
 {name:'cpanel_download',description:'Explicitly download configured remote folders. This can overwrite local files; use only when the user explicitly requests a download/restore.',inputSchema:{type:'object',properties:{name:{type:'string'}},required:['name']}}
];

async function callTool(name,a){
  await syncDefaultFromEnv();
  if(name==='cpanel_help'){return {version:VERSION,commands:[
    {command:'/cpanel',description:'Open the main cPanel Hosting Deploy command menu.'},
    {command:'/cpanel-hosting-help',description:'Show the complete command reference.'},
    {command:'/cpanel-hosting-config',description:'Configure connections, mappings, and Protection mode.'},{command:'/cpanel-hosting-settings',description:'Configure per-connection Protection and operational safety settings.'},
    {command:'/cpanel-hosting-connections',description:'Start workspace onboarding and mapping.'},
    {command:'/cpanel-local-status',description:'Read-only local project status for deployment: NEW, CHANGED, UNCHANGED, DELETED.'},
    {command:'/cpanel-local-deploy',description:'Safely deploy local NEW/CHANGED files and explicitly resolve locally deleted files.'},
    {command:'/cpanel-local-upload',description:'Explicit full local-to-remote upload; overwrites existing remote files and adds new ones only after confirmation.'},
    {command:'/cpanel-remote-status',description:'Read-only remote status: detect REMOTE NEW, REMOTE CHANGED and REMOTE DELETED.'},
    {command:'/cpanel-remote-sync',description:'Explicitly synchronize selected remote changes into the local workspace.'},
    {command:'/cpanel-remote-download',description:'Explicitly download configured hosting files/folders to the local workspace.'}
  ]};}
  if(name==='cpanel_get_settings'){const c=await getConnection(a.name);return {connection:c.name,settings:normalizeSettings(c.settings),warning:protectionWarning(c)};}
  if(name==='cpanel_set_settings'){const c=await getConnection(a.name);const p={};if(a.protectionMode!==undefined)p.protectionMode=a.protectionMode;if(a.protection!==undefined)p.protection=a.protection;if(a.largeFileThresholdMB!==undefined)p.largeFileThresholdBytes=Math.max(1,Number(a.largeFileThresholdMB)*1024*1024);for(const k of ['retryAttempts','reportRetention','backupRetention','autoDeploy','verifyAfterSync','verifyMethod'])if(a[k]!==undefined)p[k]=a[k];const settings=await updateSettings(c,p);return {connection:c.name,settings,warning:protectionWarning(c)};}
  if(name==='cpanel_list_connections'){const s=await loadStore();return {connections:s.connections.map(sanitizeConnection)};}
  if(name==='cpanel_add_connection'){
    const out=await withConnectionsStoreLock(async()=>{
      const s=await loadStore();
      if(s.connections.some(x=>x.name.toLowerCase()===String(a.name).toLowerCase()))throw new Error('A connection with that name already exists.');
      const c=validateConnectionInput(a);
      s.connections.push(c);
      await saveStore(s);
      return {connection:sanitizeConnection(c),message:'Connection added. Secret token is encrypted locally and was not returned.'};
    });
    return out;
  }
  if(name==='cpanel_edit_connection'){
    const out=await withConnectionsStoreLock(async()=>{
      const s=await loadStore();
      const c=s.connections.find(x=>x.name.toLowerCase()===String(a.name).toLowerCase());
      if(!c)throw new Error(`Connection not found: ${a.name}`);
      if(a.newName){
        const newName=safeName(a.newName);
        if(!newName)throw new Error('Connection name cannot be empty.');
        if(newName.toLowerCase()!==c.name.toLowerCase()&&s.connections.some(x=>x!==c&&x.name.toLowerCase()===newName.toLowerCase()))throw new Error('A connection with that name already exists.');
        c.name=newName;
      }
      if(a.host){const h=safeName(a.host);if(!/^https:\/\//i.test(h))throw new Error('Host must use https://.');c.host=h.replace(/\/+$/,'');}
      if(a.username)c.username=safeName(a.username);
      if(a.remoteRoot)c.remoteRoot=normalizeRemote(a.remoteRoot);
      if(a.mappings)c.mappings=normalizeMappings(c.remoteRoot,a.mappings);else if(a.remoteRoot)c.mappings=normalizeMappings(c.remoteRoot,c.mappings);
      if(a.exclude)c.exclude=a.exclude.map(String).filter(Boolean);
      if(a.settings)c.settings=normalizeSettings(a.settings);
      if(a.apiToken)c.tokenEncrypted=protectToken(a.apiToken);
      await saveStore(s);
      return {connection:sanitizeConnection(c),message:'Connection updated. Secret token was not returned.'};
    });
    return out;
  }
  if(name==='cpanel_remove_connection'){
    const out=await withConnectionsStoreLock(async()=>{
      const s=await loadStore();
      const before=s.connections.length;
      s.connections=s.connections.filter(x=>x.name.toLowerCase()!==String(a.name).toLowerCase());
      if(s.connections.length===before)throw new Error(`Connection not found: ${a.name}`);
      await saveStore(s);
      return {removed:a.name};
    });
    return out;
  }
  if(name==='cpanel_list_remote_folders'){const c=await getConnection(a.name);const dir=normalizeRemote(a.path||c.remoteRoot);const root=normalizeRemote(c.remoteRoot);if(dir!==root&&!dir.startsWith(root+'/'))throw new Error('Remote folder path must stay inside the connection remote root: '+dir);const j=await apiGet(c,'Fileman','list_files',{dir});return {connection:c.name,path:dir,folders:(j.data||[]).filter(x=>String(x.type)==='dir'||String(x.type)==='directory').map(x=>String(x.file||x.name||'')).filter(Boolean)};}
  if(name==='cpanel_test_connection'){const c=await getConnection(a.name);const j=await apiGet(c,'Fileman','list_files',{dir:c.remoteRoot});return {ok:true,connection:sanitizeConnection(c),remoteRootItems:Array.isArray(j.data)?j.data.length:0,message:'cPanel connection is working.'};}
  if(name==='cpanel_workspace_state'){const c=await getConnection(a.name);return await workspaceState(c);}
  if(name==='cpanel_workspace_setup'){const c=await getConnection(a.name);return await initializeWorkspaceFromHost(c,a.mappings,Boolean(a.confirm));}
  if(name==='cpanel_deploy_plan'){const c=await getConnection(a.name);const plan=await buildPlan(c);return {connection:c.name,summary:{new:plan.filter(x=>x.status==='NEW').length,changed:plan.filter(x=>x.status==='CHANGED').length,unchanged:plan.filter(x=>x.status==='UNCHANGED').length,deleted:plan.filter(x=>x.status==='DELETED').length},files:plan.filter(x=>x.status!=='UNCHANGED').map(x=>({status:x.status,path:x.relativePath,size:x.size}))};}
  if(name==='cpanel_deploy'){const c=await getConnection(a.name);const st=normalizeSettings(c.settings);const plan=await buildPlan(c);const accepted=[];if(st.protectionMode!=='OFF'&&protectionEnabled(c,'acceptedAutomatic')){for(const x of plan.filter(x=>x.status==='CHANGED'||x.status==='NEW')){const ac=await getAccepted(c,x.relativePath);if(ac?.side==='LOCAL')accepted.push(x);}}
    if(st.autoDeploy&&accepted.length){const actions=accepted.map(x=>({path:x.relativePath,auto:true}));if(!a.confirm){return {requiresConfirmation:false,autoAccepted:true,warning:protectionWarning(c),acceptedLocal:actions,message:'Auto Deploy is ON. Accepted Local files will be uploaded when the deploy command is manually invoked.'};}}
    const r=await deploy(c,Boolean(a.confirm)||Boolean(st.autoDeploy&&accepted.length),a.deletionActions||[],a.confirmation||'');if(st.protectionMode==='OFF') return r;if(r && accepted.length)r.acceptedLocal=accepted.map(x=>x.relativePath);r.protection=protectionWarning(c);return r;}
  if(name==='cpanel_local_upload'){
    const c=await getConnection(a.name);
    return await withOperationLock(c,'local-upload',async()=>{
    const files=[];
    for(const m of (c.mappings||[])){ if(m.enabled===false) continue; const root=path.join(WORKSPACE,...m.local.split('/')); try{await assertSafeLocalPath(root);await fsp.access(root);}catch(_){continue;}
      async function walk(dir){ for(const ent of await fsp.readdir(dir,{withFileTypes:true})){ const full=path.join(dir,ent.name); const rel=relativePosix(full); if(ent.isSymbolicLink()) throw new Error(`Symbolic links are not allowed in deployment paths: ${rel}`); if(excluded(rel,c.exclude)) continue; if(ent.isDirectory()){await walk(full);continue;} const remote=remoteFromRel(c,rel); files.push({path:rel,remote,size:ent.size}); }}
      await walk(root); }
    if(!a.confirm) return {requiresConfirmation:true,connection:c.name,count:files.length,files,message:'FULL LOCAL → HOSTING upload. Existing remote files with the same paths will be overwritten; new local files will be added; remote-only files will not be deleted. No changes were made.'};
    let overwriteSnapshot=null;
    if(protectionEnabled(c,'overwriteConfirmation')){
      const remoteFiles=await listRemoteFiles(c);
      overwriteSnapshot=remoteFiles;
      const overwriteTargets=files.filter(f=>remoteFiles.has(f.remote));
      if(overwriteTargets.length && String(a.confirmation||'').toUpperCase()!=='OVERWRITE'){
        return {requiresConfirmation:true,protectionConfirmation:'OVERWRITE',connection:c.name,count:files.length,overwriteCount:overwriteTargets.length,overwriteFiles:overwriteTargets.map(x=>x.path),message:'Protection requires the confirmation keyword OVERWRITE because this full upload will overwrite existing hosting files. No hosting changes were made.'};
      }
    }
    const uploaded=[],failed=[];
    for(const f of files){try{
      if(overwriteSnapshot) await verifyRemoteSnapshot(c,f.remote,overwriteSnapshot.get(f.remote)||null,overwriteSnapshot.has(f.remote));
      if(protectionEnabled(c,'backupBeforeDestructive') && protectionEnabled(c,'remoteBackups')){
        const remoteFiles=await listRemoteFiles(c);
        if(remoteFiles.has(f.remote)) await retryOperation(()=>remoteBackup(c,f.remote,f.path,'remote-overwritten'),transferAttempts(c));
      }
      await ensureRemoteDir(c,path.posix.dirname(f.remote));await retryOperation(()=>apiUpload(c,path.posix.dirname(f.remote),path.join(WORKSPACE,...f.path.split('/'))),transferAttempts(c));await updateManifestEntry(f.path,sha256(path.join(WORKSPACE,...f.path.split('/'))));uploaded.push(f.path);}catch(e){failed.push({path:f.path,error:e.message});}}
    const result={requiresConfirmation:false,connection:c.name,uploaded,failed,message:`Full upload completed: ${uploaded.length} uploaded, ${failed.length} failed.`};
    return result;
    });
  }
  if(name==='cpanel_remote_status'){const c=await getConnection(a.name);const st=normalizeSettings(c.settings);if(st.protectionMode==='OFF') return await buildRemoteStatus(c);const r=await buildRemoteStatusProtected(c);r.protection=protectionWarning(c);return r;}
  if(name==='cpanel_remote_sync'){const c=await getConnection(a.name);const st=normalizeSettings(c.settings);const r=await remoteSync(c,a.actions||[],Boolean(a.confirm));if(st.protectionMode==='OFF') return r;r.protection=protectionWarning(c);if(r.requiresConfirmation)return r;if(st.verifyAfterSync&&protectionEnabled(c,'contentVerification')){r.verification='requested';}return r;}
  if(name==='cpanel_download'){const c=await getConnection(a.name);return await withOperationLock(c,'download',async()=>{const files=[];const downloaded=[];const errors=[];async function walk(remoteDir,localRoot,remoteRoot){const j=await apiGet(c,'Fileman','list_files',{dir:remoteDir});for(const item of (j.data||[])){const nm=String(item.file||item.name||'');if(!nm)continue;const rp=normalizeRemote(`${remoteDir}/${nm}`);const tail=rp.slice(remoteRoot.length).replace(/^\/+/, '');const rel=path.posix.join(localRoot,tail);if(excluded(rel,c.exclude))continue;if(String(item.type)==='dir'||String(item.type)==='directory'){await walk(rp,localRoot,remoteRoot);continue;}if(!allowedRemote(c,rp))continue;files.push({rp,rel});}}
    for(const m of (c.mappings||[])){if(m.enabled===false)continue;await assertSafeLocalPath(path.join(WORKSPACE,...m.local.split('/')));await walk(normalizeRemote(m.remote),m.local,normalizeRemote(m.remote));}
    let next=0;const workers=Array.from({length:6},async()=>{while(true){const i=next++;if(i>=files.length)return;const {rp,rel}=files[i];try{const u=new URL(`${c.host}/download`);u.searchParams.set('file',rp);const r=await fetch(u,{headers:authHeaders(c),signal:AbortSignal.timeout(120000)});if(!r.ok)throw new Error(`HTTP ${r.status}`);const b=Buffer.from(await r.arrayBuffer());const local=path.join(WORKSPACE,...rel.split('/'));await assertSafeLocalPath(local);await withManifestLock(async()=>{
        await fsp.mkdir(path.dirname(local),{recursive:true});
        await fsp.writeFile(local,b);
        const manifest=await loadManifest();
        manifest[rel]=sha256(local);
        await saveManifest(manifest);
      });downloaded.push(rel);}catch(e){errors.push({path:rel,error:String(e.message||e)});}}});await Promise.all(workers);await saveManifest(manifest);const result={downloaded,count:downloaded.length,failed:errors,message:errors.length?`Download completed with ${errors.length} failed file(s).`:'Download completed successfully.',warning:'Download was explicitly requested. Existing local files may be overwritten.'};return result;});}
  throw new Error(`Unknown tool: ${name}`);
}

async function main(){
  await bootstrapDefault();
  let buf='';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data',chunk=>{buf+=chunk;let idx;while((idx=buf.indexOf('\n'))>=0){const line=buf.slice(0,idx);buf=buf.slice(idx+1);if(line.trim())handle(readJsonLine(line));}});
  process.stdin.on('end',()=>{});
}
async function handle(req){
  if(!req||req.jsonrpc!=='2.0'||req.id===undefined)return;
  try{
    if(req.method==='initialize') return result(req.id,{protocolVersion:'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'cpanel-hosting-deploy',version:VERSION}});
    if(req.method==='tools/list') return result(req.id,{tools:TOOLS});
    if(req.method==='tools/call'){const r=await callTool(req.params.name,req.params.arguments||{});return result(req.id,{content:[{type:'text',text:JSON.stringify(r,null,2)}],structuredContent:r});}
    if(req.method==='ping') return result(req.id,{});
    return error(req.id,-32601,`Method not found: ${req.method}`);
  }catch(e){return result(req.id,{content:[{type:'text',text:`ERROR: ${e.message}`}],isError:true});}
}
main().catch(e=>{log(e.stack||e.message);process.exit(1);});