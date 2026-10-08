# Test Matrix

## Automated checks

| Check | Expected |
|---|---|
| `node --check server/cpanel-mcp.js` | PASS |
| `node tests/validate-plugin.js` | PASS |
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
| Protection real-world policy matrix | **Next development phase** |

The final row is intentionally open: v1.11.0 introduces Protection and invites broader community testing before those policies are treated as production-proven across environments.
