# Verification: prefab-first workflow and roadmap

Date: 2026-11-03

Scope: [task](task.md), based on `dee5bcf82740a151ca77fe42e51c4037118cee34`
with local policy changes. macOS 27.0.1, Node 26.12.0, npm 11.20.0. Consumer
fixture was a fresh directory using the locally packed SDK and existing
esbuild/TypeScript installations. No production game assets were required.

| Check | Command or procedure | Result and artifact |
| --- | --- | --- |
| MCP regression | `node --test --test-name-pattern='an agent can discover the visual gates' tests/compiler-and-mcp.test.mjs` | Failed before the change because the RPC result lacked visualWorkflow. Passed after the change. The deliberate missing-policy fixture reports AGENT_FILE_MISSING with the policy path and a restore hint. Fixture is in `tests/compiler-and-mcp.test.mjs`. |
| Engine build, types, Doctor and regression | `npm run verify` from the root of a temporary copy of the working tree with the same dependencies | PASS, 92/92. The generated transcript and gate images are local ignored artifacts and are recreated by the command when needed. |
| Published shape | Run `npm pack` locally, unpack the tarball into a fresh consumer's `node_modules/zhuda-laya-engine`, then run `node node_modules/zhuda-laya-engine/packages/mcp-server/index.mjs --tool get_agent_contract` from the consumer | PASS. The installed record has five ordered stages, passed audit and a readable policy file. Inspect the output's `visualWorkflow`. |
| Independent consumer build | Provide `public/index.html` with the two documented template markers and `src/Main.ts` importing ZhudaEngine from the package root. Use `runConsumerBuild({projectRoot:process.cwd(),config:{features:['core','2d','ui']}})` from `zhuda-laya-engine/compiler/consumer` | PASS. The temporary fixture produced `dist/web/app.js` without injecting builtin prefab assets. |
| Links and diff | Resolve relative Markdown links in the changed guidance from their containing file. Run `git diff --check` and `git status --short` in the working checkout. | PASS. The policy, consumer adoption instructions, plan, templates and records are reachable. |

The accepted result is the documented workflow and its MCP discovery. Doctor
checks for the policy file. No test in this change decides whether a consumer
image matches its source. Browser, device and resource teardown measurements
are outside this documentation/tooling change. The [roadmap](../../prefab-toolchain.md)
remains Proposed, including public type parity, a general consumer prefab
preview and a CI gate for prefab evidence.
