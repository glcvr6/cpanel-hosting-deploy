'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'server', 'cpanel-mcp.js'), 'utf8');
const start = source.indexOf('function parseWorkspaceCandidates(raw) {');
const end = source.indexOf('\nconst WORKSPACE_INFO = resolveWorkspace();', start);
if (start < 0 || end < 0) throw new Error('workspace resolver source not found');
const resolverSource = source.slice(start, end);

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cpanel-workspace-test-'));
const workspace = path.join(temp, 'GSSIHostFilesTest');
const pluginRoot = path.join(temp, 'Programs', 'cursor');
fs.mkdirSync(workspace, { recursive: true });
fs.mkdirSync(pluginRoot, { recursive: true });

function resolver(env, cwd = pluginRoot) {
  const fakeProcess = { platform: process.platform, env, cwd: () => cwd };
  return vm.runInNewContext(
    `(() => { ${resolverSource}; return { parseWorkspaceCandidates, resolveWorkspace }; })()`,
    { fs, path, process: fakeProcess }
  );
}
function assertEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}
function assertThrows(fn, pattern, label) {
  let error;
  try { fn(); } catch (e) { error = e; }
  if (!error || !pattern.test(error.message)) throw new Error(`${label}: expected error matching ${pattern}, got ${error && error.message}`);
}

try {
  let r = resolver({ CURSOR_PROJECT_DIR: workspace });
  assertEqual(r.resolveWorkspace().path, workspace, 'CURSOR_PROJECT_DIR resolves active workspace');
  assertEqual(r.resolveWorkspace().source, 'CURSOR_PROJECT_DIR', 'workspace source is reported');

  r = resolver({ WORKSPACE_FOLDER_PATHS: JSON.stringify([workspace]) });
  assertEqual(r.resolveWorkspace().path, workspace, 'WORKSPACE_FOLDER_PATHS resolves active workspace');

  r = resolver({
    CURSOR_PROJECT_DIR: path.join(temp, 'missing'),
    WORKSPACE_FOLDER_PATHS: JSON.stringify([workspace])
  });
  assertEqual(r.resolveWorkspace().path, workspace, 'invalid env candidate falls through to valid workspace');

  r = resolver({
    CURSOR_PROJECT_DIR: '${workspaceFolder}',
    WORKSPACE_FOLDER_PATHS: '${workspaceFolder}',
    CURSOR_WORKSPACE: '',
    VSCODE_CWD: ''
  });
  assertThrows(() => r.resolveWorkspace(), /Unable to determine the active Cursor workspace/, 'unresolved placeholders fail closed');

  r = resolver({
    CURSOR_PROJECT_DIR: pluginRoot,
    CURSOR_PLUGIN_ROOT: pluginRoot
  });
  assertThrows(() => r.resolveWorkspace(), /Unable to determine the active Cursor workspace/, 'plugin installation root is not accepted as workspace');

  r = resolver({}, pluginRoot);
  assertThrows(() => r.resolveWorkspace(), /will not use its own working directory/, 'missing workspace variables never fall back to MCP cwd');

  console.log('Workspace resolution safety: PASS');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
