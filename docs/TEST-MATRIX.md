# Test Matrix

## Automated checks

| Check | Expected |
|---|---|
| `node --check server/cpanel-mcp.js` | PASS |
| `node tests/validate-plugin.js` | PASS |
| Operation/state safety regression suite | PASS |
| Remote revalidation regression suite | PASS |
| Partial-success baseline regression suite | PASS |
| Workspace-resolution regression suite | PASS |
| Download confirmation regression suite | PASS |
| UAPI download transport regression suite | PASS |
| Enabled-mapping status-scope regression suite | PASS |
| CI Node.js 20 | PASS |
| CI Node.js 22 | PASS |

Run the full local suite with:

```bash
node --check server/cpanel-mcp.js
node tests/validate-plugin.js
for f in tests/*.js; do node "$f"; done
```

CI currently runs the syntax check plus `tests/validate-plugin.js` on Node.js 20 and 22. The remaining `tests/*.js` files are source/behavior regression guards intended for local and PR validation.

## Core workflow coverage

| Area | Status |
|---|---|
| Connection/authentication | Tested during development |
| Mapping | Tested during development |
| Initial remote baseline | Tested during development |
| Local status | Tested |
| Local deploy | Tested |
| Remote status | Tested |
| Remote changed/deleted detection | Tested |
| Remote sync | Tested |
| Conflict detection | Tested |
| Remote untracked preservation | Tested |
| Protection OFF code-path isolation | Static/code-path verified |
| Atomic JSON/state recovery | Regression-covered |
| Operation lock / stale-lock recovery | Regression-covered |
| Connections-store concurrency | Regression-covered |
| Manifest transaction concurrency | Regression-covered |
| Remote TOCTOU revalidation | Regression-covered |
| Local symlink/path safety | Regression-covered |
| API timeout behavior | Regression-covered |
| Download stale-manifest runtime regression | Regression-covered |
| Workspace resolution / install-path refusal | Regression-covered |
| Explicit download destination confirmation | Regression-covered |
| UAPI-first download with legacy fallback diagnostics | Regression-covered |
| Enabled-mapping scope for local/remote status | Regression-covered |
| Protection real-world policy matrix | **Next development phase** |

The Protection row is intentionally open: the implementation and core safety mechanisms have automated regression coverage, but broader real-world Protection policy testing across different cPanel environments remains a project goal.
