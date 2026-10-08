# Test Matrix

## Automated checks

| Check | Expected |
|---|---|
| `node --check server/cpanel-mcp.js` | PASS |
| `node tests/validate-plugin.js` | PASS |\n| Operation/state safety regression suite | PASS |\n| Remote revalidation regression suite | PASS |\n| Partial-success baseline regression suite | PASS |
| CI Node.js 20 | PASS |
| CI Node.js 22 | PASS |

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
| Atomic JSON/state recovery | Regression-covered |\n| Operation lock / stale-lock recovery | Regression-covered |\n| Connections-store concurrency | Regression-covered |\n| Manifest transaction concurrency | Regression-covered |\n| Remote TOCTOU revalidation | Regression-covered |\n| Local symlink/path safety | Regression-covered |\n| API timeout behavior | Regression-covered |\n| Download stale-manifest runtime regression | Regression-covered |\n| Protection real-world policy matrix | **Next development phase** |

The Protection row is intentionally open: the implementation and core safety mechanisms have automated regression coverage, but broader real-world Protection policy testing across different cPanel environments remains a project goal.
