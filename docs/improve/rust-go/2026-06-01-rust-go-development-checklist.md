# Rust / Go 优化重构开发跟踪清单

> 日期：2026-06-01
> 依据方案：`docs/improve/rust-go/2026-06-01-rust-go-optimization-plan.md`
> 当前分支：`rust-go-refactor`
> 适用范围：CodeInsights Electron main / preload / renderer、`packages/shared` 契约、JSON / JSONL 本地事实源、Agent / Pipeline 搜索与 records tail、workspace 文件索引、大文件预览、native runtime diagnostics、Rust sidecar、可选 Go supervisor、打包与发布验收。
> 说明：本文是后续迭代开发的执行清单，不代表 Rust / Go native 功能已经实现。每个阶段都必须先满足入口条件，再按清单开发、验证、Review 和单独提交。

## 最新开发状态

> 更新时间：2026-06-01
> 最新开发基线：`58cc241d feat(rust-go): 完成 Phase 1 TypeScript 搜索 fallback 重构`。
> 最新已确认恢复入口：`58cc241d feat(rust-go): 完成 Phase 1 TypeScript 搜索 fallback 重构`；如果本文件所在提交之后还有 Rust / Go 状态同步提交，下次启动时以 `git log -5 --oneline` 中最新的 Rust / Go docs / tasks / feat 提交为准。
> 当前结论：Rust / Go 优化重构 Phase 0 和 Phase 1 已完成；已建立 shared NativeRuntime DTO / fixtures / benchmark，并在 TypeScript fallback 内收敛 Chat / Agent / Pipeline 搜索 facade。尚未实现 Pipeline cursor tail、workspace index、SearchDialog Pipeline 内容接入、Native Runtime Diagnostics UI、Rust sidecar、Go supervisor 或任何 native binary。
> 当前策略：下一阶段先做 Phase 2 Pipeline records cursor / tail 与 SearchDialog Pipeline 内容接入，继续复用 Phase 1 EventSearchService 和 Phase 0 benchmark 基线；只有 benchmark 证明收益且 fallback / packaged smoke / 安全门禁齐全后，才进入 Rust sidecar。Go supervisor 仅作为有条件 spike，不进入默认主线。

### 当前阶段完成状态

- [x] Rust / Go 优化重构方案文档已生成：`docs/improve/rust-go/2026-06-01-rust-go-optimization-plan.md`。
- [x] Rust / Go 优化方案已按工程实践深化：目标、不变量、分层、后端、前端、数据契约、BDD、验证、风险与 MVP 已补齐。
- [x] Rust / Go 开发跟踪清单已生成：`docs/improve/rust-go/2026-06-01-rust-go-development-checklist.md`。
- [x] 阶段提交纪律已固化：`fe34b231 docs(tasks): 固化阶段完成即提交纪律`。
- [x] 已补齐 Rust / Go 下次启动提示词入口：`docs/improve/rust-go/next-session-prompt.md`。
- [x] Phase 0：基线、契约与 benchmark。
- [x] Phase 1：TypeScript fallback 与 EventSearchService 重构。
- [ ] Phase 2：Pipeline records cursor / tail 与全局搜索接入。
- [ ] Phase 3：Workspace 文件索引 TS cache 与 watcher invalidation。
- [ ] Phase 4：前端可见体验、Jotai 状态和 diagnostics。
- [ ] Phase 5：Rust search sidecar 试点。
- [ ] Phase 6：大文件 / 日志 chunk preview。
- [ ] Phase 7：PathSafety 与 GitOutputParser 抽象。
- [ ] Phase 8：打包、CI、版本与发布收口。
- [ ] Phase 9：Go supervisor 可选 spike。

### 当前未完成的关键能力

- [x] NativeRuntime shared DTO / IPC 草案已完成；preload API 尚未实现。
- [x] 主进程 `NativeRuntimeAdapter` TypeScript interface 与 diagnostics 空实现已完成。
- [x] Contract fixtures 和 benchmark runner 已完成；基线数字见 Phase 0 Review。
- [x] EventSearchService 已统一 Chat / Agent / Pipeline 搜索 facade，并保留旧 IPC / preload / renderer 行为兼容。
- [ ] Pipeline records tail 尚未改为 cursor / offset 读取。
- [ ] Workspace 文件索引尚未建立可取消、可重建的缓存层。
- [ ] SearchDialog 尚未接入 Pipeline 内容搜索、索引状态、分页和 stale result 丢弃。
- [ ] Native Runtime Diagnostics 设置页尚未实现。
- [ ] Rust sidecar、Rust optional package、native-cache schema 和 packaged smoke 尚未实现。
- [ ] Go supervisor 未进入主线，必须等 Phase 9 触发条件成立。
- [ ] 根 `README.md` / 根 `AGENTS.md` 未同步；需要用户明确允许后才可修改。

### 下次启动入口

下次启动 Codex 后先执行以下动作：

1. 读取 `tasks/lessons.md`，特别是阶段提交、状态同步、路径安全、Git 防护、测试隔离、README / AGENTS 修改授权边界和 packaged smoke 纪律。
2. 读取 Rust / Go 优化方案、本文和 `docs/improve/rust-go/next-session-prompt.md`，确认当前状态为“Phase 0 基线、契约与 benchmark 已完成；Phase 1 TypeScript fallback 与 EventSearchService 重构已完成；下一步从 Phase 2 Pipeline records cursor / tail 与 SearchDialog Pipeline 内容接入开始”。
3. 运行 `git status --short --branch` 和 `git log -5 --oneline`，确认最近历史包含 `58cc241d feat(rust-go): 完成 Phase 1 TypeScript 搜索 fallback 重构` 或其后的 Rust / Go 状态同步提交。
4. 如果开始 Phase 2，先在 `tasks/todo.md` 新增该阶段计划，写清范围、文件边界、验证命令和禁止事项；用户已明确计划写清后无需等待确认。
5. 不要直接写 Rust / Go。Phase 2 仍然只做 TypeScript fallback 的 Pipeline cursor tail、SearchDialog Pipeline 内容搜索、旧行为回归测试和 benchmark 对比。

## 使用规则

后续所有 Rust / Go 优化开发必须以本文为执行入口。每次开始新阶段时，先在 `tasks/todo.md` 写本阶段计划；阶段完成后，在本文对应阶段勾选、追加阶段 Review，并单独提交该阶段相关文件。

### 强制规则

- [ ] 每个阶段开始前，先确认上一阶段满足完成定义。
- [ ] 每个阶段开始前，在 `tasks/todo.md` 写清本轮范围、文件边界、验证命令和不做事项。
- [ ] 非文档阶段必须先补契约测试、fixture 或 BDD 测试，再实现功能。
- [ ] 所有新增 IPC 必须按“shared 类型与常量 -> main handler -> preload API -> renderer 调用”四步同步。
- [ ] Renderer 状态管理继续使用 Jotai，不引入 localStorage 作为主状态源，不引入本地数据库。
- [ ] Native 结果进入业务流程前，必须在 main process 做 schema 校验、错误规范化和脱敏。
- [ ] Native cache 只能写入 `~/.codeinsights/native-cache/`，不能替代 JSON / JSONL 事实源。
- [ ] Rust / Go 依赖新增前必须先做依赖搜索和 decision record，不能默认添加最新版。
- [ ] 功能代码改动必须递增受影响 package 的 patch 版本，并同步 `bun.lock`。
- [ ] 每个阶段完成后必须运行本阶段验证命令、`git diff --check` 和 `git status --short`。
- [ ] 每个阶段完成后必须在 `tasks/todo.md` 追加 Review，并在本文对应阶段记录验证结果。
- [ ] 每个阶段完成后必须单独提交，提交范围只包含本阶段相关文件。
- [ ] 未经用户明确要求，不 push、不创建 PR、不执行真实远端写。
- [ ] 未经用户明确允许，不修改根 `README.md` / 根 `AGENTS.md`。
- [ ] 不把清单阶段、方案或 spike 描述为已实现功能。

### 状态标记

| 标记 | 含义 |
|------|------|
| `[ ]` | 未开始 |
| `[x]` | 已完成并通过该项验证 |
| `[!]` | 阻塞，需要在阶段 Review 写明 blocker |
| `[~]` | 进行中，只能短期存在于当前阶段 |
| `[skip]` | 明确跳过，必须写明原因、替代方案和风险接受人 |

### 全局不变量

- [ ] TypeScript 仍是产品壳、业务编排和跨进程契约的主语言。
- [ ] `packages/shared` 继续作为 DTO、IPC 常量和跨语言 fixture 的源头。
- [ ] Renderer 不能直接调用 Rust / Go binary，也不能知道 native binary 的真实路径。
- [ ] Preload 只能暴露白名单 API，不暴露任意文件路径、binary path 或 shell 能力。
- [ ] Agent / Pipeline 业务编排、权限 gate、人工审核、Git commit / push / PR 创建不迁移到 native。
- [ ] Native 只能做可替换的 IO / CPU / parsing / indexing helper。
- [ ] 没有 native binary 时，核心 Agent / Pipeline / Search / File Preview 必须有可用 TS fallback。
- [ ] Native cache 损坏、缺失、版本不兼容时，应自动 fallback 或重建，不影响会话事实源。
- [ ] 所有 native 任务必须支持 cancellation / timeout / crash fallback。
- [ ] 所有错误、diagnostics、stderr、benchmark report 不得泄露 token、Authorization、credentialed remote URL 或用户隐私内容。
- [ ] `patch-work/**`、Pipeline gate、Git 防护和远端写确认策略不能因 native helper 放宽。
- [ ] 打包后的应用必须使用 bundled binary，不允许从系统 `PATH` 隐式寻找同名 native 程序。

### 质量门禁

| 类别 | 最低要求 |
|------|----------|
| 契约 | shared DTO、IPC input / output、fixture、schema 校验同时更新。 |
| 测试 | TS fallback、native available、native missing、timeout、crash、contract violation 都有覆盖。 |
| 性能 | benchmark 记录 P50 / P95 / P99、内存峰值、event loop blocking 和数据规模。 |
| 安全 | path traversal、symlink、reserved path、credentialed URL、token redaction、loopback auth 有 fixture。 |
| 前端 | loading、empty、indexed、fallback、error、rebuild、stale request 都有可见状态。 |
| 打包 | unpacked smoke、native missing smoke、bundled binary path 检查必须通过。 |
| 回滚 | feature flag 可关闭 native；cache 可清理；protocol mismatch 自动禁用 native。 |

## 里程碑总览

| 里程碑 | 阶段 | 目标 | 初始状态 | 是否必须 |
|--------|------|------|----------|----------|
| M0 | Phase 0 | 建立基线、契约草案、benchmark 和 fixture | [x] | 必须 |
| M1 | Phase 1 | 收敛 TS fallback 与 EventSearchService | [x] | 必须 |
| M2 | Phase 2 | Pipeline records cursor / tail 与 SearchDialog 接入 | [ ] | 必须 |
| M3 | Phase 3 | Workspace 文件索引 TS cache 与 watcher invalidation | [ ] | 必须 |
| M4 | Phase 4 | 前端索引状态、诊断、可取消搜索和大文件入口 | [ ] | 必须 |
| M5 | Phase 5 | Rust search sidecar 试点 | [ ] | 有条件 |
| M6 | Phase 6 | 大文件 / 日志 chunk preview | [ ] | 有条件 |
| M7 | Phase 7 | PathSafety 与 GitOutputParser 抽象，可选 Rust helper | [ ] | 有条件 |
| M8 | Phase 8 | native 打包、CI、发布和回滚收口 | [ ] | native 默认启用前必须 |
| M9 | Phase 9 | Go supervisor 可选 spike | [ ] | 可选 |

## Phase 0：基线、契约与 Benchmark

### 阶段状态

- [x] 阶段开始
- [x] 测试 / fixture 先行完成
- [x] 实现完成
- [x] 验证完成
- [x] 阶段 Review 完成
- [x] 阶段提交完成

### 目标

在不引入 Rust / Go、不改变用户可见行为的前提下，证明当前瓶颈、建立 shared 契约草案、沉淀 benchmark 数据和 contract fixtures。Phase 0 的成功标准不是性能提升，而是后续所有阶段都有可回归的事实基线。

### 入口条件

- [x] 已阅读 Rust / Go 优化方案的“工程目标与不变量”“目标架构”“分阶段路线”和“最小可交付切片”。
- [x] 当前工作树无无关未提交改动，或已明确只会 stage 本阶段文件。
- [x] 已确认本阶段不创建 Rust / Go 工程、不添加 native binary、不修改 UI 主流程。
- [x] 已在 `tasks/todo.md` 写入 Phase 0 计划和边界。

### 契约任务

- [x] 在 `packages/shared` 设计 `NativeRuntimeStatus`、`NativeCapability`、`NativeImplementationKind`、`NativeRuntimeErrorCode`。
- [x] 设计搜索输入 / 输出 DTO：query、scope、limit、cursor、requestId、sessionId、sourceKind、snippet、matchedRanges、implementation。
- [x] 设计 JSONL tail DTO：fileKind、sessionId、cursor、limit、direction、records、nextCursor、implementation。
- [x] 设计 workspace index DTO：workspaceId、rootPath fingerprint、ignoreSummary、indexedFiles、status、startedAt、completedAt。
- [x] 设计 file chunk DTO：path token、offset、length、encoding、truncated、binaryDetected、nextOffset。
- [x] 设计 diagnostics DTO：binaryPath、protocolVersion、cacheSchemaVersion、fallbackReason、lastError、capabilities。
- [x] 定义 operation model：operationId、requestId、startedAt、cancelledAt、completedAt、status、progress、source。
- [x] 定义 feature flag 和环境变量名称，例如 `CODEINSIGHTS_NATIVE_RUNTIME`、`CODEINSIGHTS_NATIVE_SEARCH`，默认关闭。
- [x] 定义 fallback reason 枚举：missing_binary、disabled、version_mismatch、contract_violation、timeout、crashed、cache_corrupted。
- [x] 为每类 DTO 准备 JSON fixture，fixture 只放脱敏样本，不放真实用户路径和 token。

### Benchmark 任务

- [x] 新增或规划 `apps/electron/scripts/native-runtime-benchmark.ts`。
- [x] 生成 `chat-search-large-history` fixture：多会话、多 JSONL 文件、含中英文、代码块和坏行。
- [x] 生成 `agent-runtime-search` fixture：SDK message、tool_start、tool_result、error、done 混合。
- [x] 生成 `pipeline-tail-large-records` fixture：单 session 50000 records，覆盖 node output、artifact、gate、error。
- [x] 生成 `workspace-file-name-search` fixture：100000 文件路径，覆盖 ignore、hidden、symlink、nested packages。
- [x] 生成 `large-log-preview` fixture：已跑到 500MB 合成文本，不把大文件提交进仓库。
- [x] 记录当前实现 P50 / P95 / P99、最大内存、event loop delay、冷启动和热缓存差异。

### 实现任务

- [x] 新增 `NativeRuntimeAdapter` TypeScript interface，仅作为主进程内部类型。
- [x] 新增 diagnostics service 的空实现，返回 `implementation: "typescript"` 或 `nativeEnabled: false`。
- [x] 将 benchmark 与 production service 解耦，避免 benchmark 写入真实 `~/.codeinsights/`。
- [x] 给 benchmark 输出增加 JSON summary，便于阶段 Review 记录真实数字。
- [x] 明确 feature flag 名称和默认值，默认关闭 native。

### 触达文件

- [x] `packages/shared/src/types/native-runtime.ts`
- [skip] `packages/shared/src/index.ts`：现有包根已 re-export `./types/index`，本阶段只需更新 `packages/shared/src/types/index.ts`。
- [x] `apps/electron/src/main/lib/native-runtime/native-runtime-types.ts`
- [x] `apps/electron/src/main/lib/native-runtime/native-runtime-diagnostics.ts`
- [x] `apps/electron/scripts/native-runtime-benchmark.ts`
- [skip] `apps/electron/src/main/lib/native-runtime/__fixtures__/`：Phase 0 contract fixture 放在 shared 包；benchmark fixture 运行时生成到临时目录。
- [x] `docs/improve/rust-go/2026-06-01-rust-go-development-checklist.md`
- [x] `tasks/todo.md`

### 验证命令

```bash
bun test packages/shared/src/types/native-runtime.test.ts
bun test apps/electron/src/main/lib/native-runtime
bun test apps/electron/scripts/native-runtime-benchmark.test.ts
bun run --filter='@codeinsights/shared' typecheck
bun run --filter='@codeinsights/electron' typecheck
bun run --filter='@codeinsights/electron' build:main
bun run --filter='@codeinsights/electron' build:preload
bun run --filter='@codeinsights/electron' build:renderer
bun run --filter='@codeinsights/electron' native-runtime:benchmark --records 50000 --payload-bytes 256 --workspace-files 100000 --log-bytes 524288000 --iterations 3
git diff --check
git status --short --branch
```

### 完成定义

- [x] shared DTO、main 内部 interface 和 fixtures 已提交。
- [x] benchmark 可重复运行，输出包含数据规模和真实性能数字。
- [x] 未引入 Rust / Go 工程、native binary 或新运行时依赖。
- [x] 没有 native 能力时，现有产品行为完全不变。
- [x] Phase 0 Review 写明后续是否具备进入 Phase 1 的条件。

### 禁止事项

- [x] 不直接重写现有搜索服务。
- [x] 不新增 Rust / Go crate、module、binary、optionalDependencies。
- [x] 不把 benchmark 合成大文件提交进仓库。
- [x] 不把用户真实 `~/.codeinsights/` 数据复制进 fixture。

### 阶段 Review

- 已完成 shared DTO / IPC 草案：`packages/shared/src/types/native-runtime.ts` 定义 status、capability、implementation、fallback reason、error code、operation model、search、JSONL tail、workspace index、file chunk、diagnostics 与 `NATIVE_RUNTIME_IPC_CHANNELS`；`packages/shared/src/types/index.ts` 已 re-export；`@codeinsights/shared` 版本递增到 `0.1.58`。
- 已完成 contract fixtures：`packages/shared/fixtures/native-runtime/` 覆盖 search input / result、tail input / result、diagnostics、operation progress、workspace index 和 file chunk；样本均为脱敏合成数据。
- 已完成主进程内部边界：`apps/electron/src/main/lib/native-runtime/native-runtime-types.ts` 新增 `NativeRuntimeAdapter` interface；`native-runtime-diagnostics.ts` 返回 TypeScript fallback diagnostics，native 默认关闭，不接入 UI / preload / IPC 主流程。
- 已完成 benchmark runner：`apps/electron/scripts/native-runtime-benchmark.ts` 运行时在临时目录生成合成 JSONL、workspace path list 和 log，不写真实 `~/.codeinsights/`，默认自动清理；`@codeinsights/electron` 版本递增到 `0.0.131` 并新增 `native-runtime:benchmark` 脚本。
- 大规模 benchmark 基线：macOS arm64、Bun 1.3.13、records 50000、payload 256 bytes、workspace files 100000、log 500MB、iterations 3。`chat-search-large-history` P50 55.331ms / P95 93.134ms / P99 93.134ms / event loop delay 107.361ms / memory delta 52,150,272 bytes；`agent-runtime-search` P50 39.888ms / P95 52.886ms / P99 52.886ms / event loop delay 52.938ms / memory delta 360,448 bytes；`pipeline-tail-large-records` P50 33.376ms / P95 34.611ms / P99 34.611ms / event loop delay 34.644ms / memory delta 147,456 bytes；`workspace-file-name-search` P50 11.366ms / P95 13.074ms / P99 13.074ms / event loop delay 13.105ms / memory delta 5,881,856 bytes；`large-log-preview` P50 343.660ms / P95 394.817ms / P99 394.817ms / event loop delay 395.802ms / memory delta 251,740,160 bytes。
- Benchmark 清理边界：默认会清理临时合成数据；只有显式传 `--keep-artifacts` 时才会保留系统临时目录中的合成文件，调试后需要手动删除输出中的 artifact 目录。
- 验证通过：`bun test packages/shared/src/types/native-runtime.test.ts`；`bun test apps/electron/src/main/lib/native-runtime`；`bun test apps/electron/scripts/native-runtime-benchmark.test.ts`；`bun run --filter='@codeinsights/shared' typecheck`；`bun run --filter='@codeinsights/electron' typecheck`；`bun run --filter='@codeinsights/electron' build:main`；`bun run --filter='@codeinsights/electron' build:preload`；`bun run --filter='@codeinsights/electron' build:renderer`；`bun install --frozen-lockfile --dry-run`；`git diff --check`。`build:renderer` 仅有既有大 chunk 警告。
- 边界确认：本阶段未写 Rust / Go，未安装依赖，未创建 native binary，未新增 optionalDependencies，未修改根 `README.md` / 根 `AGENTS.md`，未接入 renderer / preload / IPC 主流程，未重写现有搜索服务或 Pipeline records 读取路径，未复制真实用户数据进 fixture。
- 进入 Phase 1 条件：已具备。下一阶段应以本阶段 DTO / fixtures / benchmark 为基线，先做 TypeScript fallback 与 EventSearchService 重构，保留旧 IPC 行为回归测试，仍然不要开始 Rust sidecar。
- 阶段提交：已提交 `987d600e feat(rust-go): 完成 Phase 0 基线契约与 benchmark`。

## Phase 1：TypeScript Fallback 与 EventSearchService 重构

### 阶段状态

- [x] 阶段开始
- [x] 测试先行完成
- [x] 实现完成
- [x] 验证完成
- [x] 阶段 Review 完成
- [x] 阶段提交完成

### 目标

先在 TypeScript 内把 Chat / Agent / Pipeline 搜索接口收敛到可替换 facade，确保未来 Rust sidecar 只是替换实现，而不是改变产品语义。Pipeline cursor tail 保留到 Phase 2。

### 入口条件

- [x] Phase 0 已完成并提交。
- [x] benchmark 已记录当前 JSONL 搜索和 tail 基线。
- [x] shared DTO 已稳定，至少覆盖 search、tail、diagnostics、error。
- [x] 已确认本阶段仍不写 Rust / Go。

### 契约任务

- [x] 将旧搜索返回字段映射到新的 NativeRuntime search result，保证旧 IPC / renderer 兼容。
- [x] 定义 source kind：`chat_message`、`agent_message`、`pipeline_record`、`workspace_file`、`patch_work_file`。
- [x] 定义稳定排序策略：Chat / Agent 保持旧 source 顺序和每会话第一条命中，Pipeline 保持旧分页顺序。
- [x] 定义坏 JSONL 行处理策略：跳过并记录 diagnostics，不让整次搜索失败。
- [x] 定义 request cancellation 语义：abort 后抛出可识别错误，不返回旧结果。

### 后端任务

- [x] 新增 `apps/electron/src/main/lib/native-runtime/native-runtime-service.ts` facade。
- [x] 新增 `ts-event-search-service.ts`，统一 Chat / Agent / Pipeline JSONL 搜索。
- [x] 新增 `jsonl-event-reader.ts` helper，集中处理 JSONL 读取、坏行、source metadata 和 AbortSignal。
- [x] 将 `jsonl-search.ts` 内部转调新 reader / service，保留旧函数入口降低破坏面。
- [x] 将 Chat / Agent / Pipeline 旧搜索入口内部改为调用统一 TypeScript fallback service；IPC handler、preload API 和 renderer 行为未变。
- [skip] per-request generation 保留到 Phase 2 / Phase 4，因为本阶段未改 renderer 搜索状态和 SearchDialog。
- [skip] 内存缓存上限和 LRU / TTL 保留到 workspace index / native cache 阶段；Phase 1 未引入常驻搜索 cache。

### 测试任务

- [x] 为 Chat JSONL 搜索建立旧字段兼容测试。
- [x] 为 Agent SDK message / tool result 搜索建立 fixture 测试。
- [x] 为 Pipeline records 搜索建立 fixture 测试。
- [x] 覆盖坏 JSONL 行、空文件、缺失会话文件、读取失败 diagnostics、超大 snippet 截断。
- [x] 覆盖 abort 后不返回结果。
- [x] 覆盖同 query 多 source 聚合排序稳定性。

### 触达文件

- [x] `apps/electron/src/main/lib/jsonl-search.ts`
- [x] `apps/electron/src/main/lib/native-runtime/native-runtime-service.ts`
- [x] `apps/electron/src/main/lib/native-runtime/ts-event-search-service.ts`
- [x] `apps/electron/src/main/lib/native-runtime/jsonl-event-reader.ts`
- [skip] `apps/electron/src/main/ipc/*-handlers.ts`：旧 handler 签名和通道未变，继续调用 manager / service facade。
- [x] `apps/electron/src/main/lib/conversation-manager.ts`
- [x] `apps/electron/src/main/lib/agent-session-manager.ts`
- [x] `apps/electron/src/main/lib/pipeline-session-manager.ts`
- [x] `packages/shared/src/types/native-runtime.ts`
- [x] `packages/shared/fixtures/native-runtime/`
- [x] `apps/electron/scripts/native-runtime-benchmark.ts`
- [x] `apps/electron/package.json`
- [x] `packages/shared/package.json`
- [x] `bun.lock`

### 验证命令

```bash
bun test apps/electron/src/main/lib/jsonl-search.test.ts apps/electron/src/main/lib/native-runtime apps/electron/src/main/lib/conversation-manager.test.ts apps/electron/src/main/lib/agent-session-manager.test.ts apps/electron/src/main/lib/pipeline-session-manager.test.ts packages/shared/src/types/native-runtime.test.ts apps/electron/scripts/native-runtime-benchmark.test.ts
bun run --filter='@codeinsights/shared' typecheck
bun run --filter='@codeinsights/electron' typecheck
bun run --filter='@codeinsights/electron' build:main
bun run --filter='@codeinsights/electron' native-runtime:benchmark --records 50000 --payload-bytes 256 --workspace-files 100000 --log-bytes 524288000 --iterations 3
bun install --frozen-lockfile --dry-run
git diff --check
git status --short --branch
```

### 完成定义

- [x] Chat / Agent / Pipeline 内容搜索都能通过统一 TS fallback 路径完成。
- [x] 旧 IPC 行为兼容，renderer 不需要一次性大改。
- [x] 大 JSONL fixture 下搜索不再重复实现多套解析逻辑。
- [x] abort、坏行、缺失文件、超大结果都有测试覆盖。
- [x] Review 中记录 Phase 1 相对 Phase 0 的性能变化。

### 禁止事项

- [x] 不删除旧 IPC 通道。
- [x] 不在本阶段新增 native binary。
- [x] 不改变 JSON / JSONL 事实源格式。
- [x] 不把搜索 cache 当作唯一数据源；本阶段未引入搜索 cache。

### 阶段 Review

- 阶段提交：已提交 `58cc241d feat(rust-go): 完成 Phase 1 TypeScript 搜索 fallback 重构`。
- 实现完成：新增 `jsonl-event-reader.ts`、`ts-event-search-service.ts` 和 `native-runtime-service.ts`；`jsonl-search.ts` 保留旧入口并转调新 reader；Chat / Agent / Pipeline 旧搜索入口内部改为统一 TypeScript fallback service，旧 IPC 通道、preload 方法和 renderer 行为未改。
- 契约完成：`NativeRuntimeSearchSourceKind` 最小扩展到 `chat_message` / `agent_message` / `pipeline_record` / `workspace_file` / `patch_work_file`；shared search result fixture 已改为 `pipeline_record`；`@codeinsights/shared` 版本升到 `0.1.59`。
- 兼容边界：Chat / Agent 保持 query 长度小于 2 返回空、每会话第一条命中、最多 30 条、坏行跳过、读取失败不阻断；Agent 继续兼容旧 `AgentMessage` 与新 `SDKMessage` text block，未知 role 回退 assistant；Pipeline 保持 stage filter、分页、tab 归属和摘要长度行为。
- 版本与锁文件：`@codeinsights/electron` 升到 `0.0.132`，`bun.lock` 已同步；未新增依赖。
- Benchmark 对比 Phase 0：同为 macOS arm64 / Bun 1.3.13 / 50k records / 100k workspace paths / 500MB log / iterations 3。Phase 1 `chat-search-large-history` P50 113.440ms / P95 141.404ms / P99 141.404ms / event loop delay 9.716ms / memory 42,663,936 bytes；Phase 0 对应为 P50 55.331ms / P95 93.134ms / P99 93.134ms / event loop delay 107.361ms / memory 52,150,272 bytes。Phase 1 `agent-runtime-search` P50 109.687ms / P95 117.410ms / P99 117.410ms / event loop delay 1.822ms / memory 5,734,400 bytes；Phase 0 对应为 P50 39.888ms / P95 52.886ms / P99 52.886ms / event loop delay 52.938ms / memory 360,448 bytes。
- Benchmark 结论：Phase 1 将 Chat / Agent 搜索 benchmark 切到真实 EventSearchService 流式 reader；wall-clock 明显变慢，但 main-thread event loop delay 明显下降。Pipeline tail、workspace search 和 large-log preview 仍未优化，数据分别为 P50 68.114ms / 20.163ms / 530.734ms，保留到后续阶段处理。
- 验证通过：`bun test apps/electron/src/main/lib/jsonl-search.test.ts apps/electron/src/main/lib/native-runtime apps/electron/src/main/lib/conversation-manager.test.ts apps/electron/src/main/lib/agent-session-manager.test.ts apps/electron/src/main/lib/pipeline-session-manager.test.ts packages/shared/src/types/native-runtime.test.ts apps/electron/scripts/native-runtime-benchmark.test.ts`；`bun run --filter='@codeinsights/shared' typecheck`；`bun run --filter='@codeinsights/electron' typecheck`；`bun run --filter='@codeinsights/electron' build:main`；`bun run --filter='@codeinsights/electron' native-runtime:benchmark --records 50000 --payload-bytes 256 --workspace-files 100000 --log-bytes 524288000 --iterations 3`；`bun install --frozen-lockfile --dry-run`；`git diff --check`。
- 边界确认：本阶段未写 Rust / Go，未安装依赖，未创建 native binary，未新增 optionalDependencies，未修改根 `README.md` / 根 `AGENTS.md`，未改 preload / renderer，未接入 SearchDialog Pipeline 内容搜索，未实现 Pipeline cursor tail、workspace index、Diagnostics UI、Rust sidecar 或 Go supervisor，未 push，未创建 PR。
- 后续入口：Phase 2 应从 Pipeline records cursor / tail 与 SearchDialog Pipeline 内容接入开始；继续复用 Phase 1 EventSearchService，不要直接写 Rust / Go。

## Phase 2：Pipeline Records Cursor / Tail 与全局搜索接入

### 阶段状态

- [ ] 阶段开始
- [ ] 测试先行完成
- [ ] 实现完成
- [ ] 验证完成
- [ ] 阶段 Review 完成
- [ ] 阶段提交完成

### 目标

让 Pipeline records tail 不再依赖全量读取再 slice，并把 Pipeline 内容纳入 SearchDialog / 全局搜索。该阶段仍以 TypeScript fallback 为主，不引入 Rust。

### 入口条件

- [ ] Phase 1 已完成并提交。
- [ ] Pipeline records fixture 已覆盖大历史和坏行。
- [ ] SearchDialog 当前行为有回归测试。
- [ ] 已确认 cursor 格式只作为 service 内部或 shared DTO，不泄露本地绝对路径。

### 后端任务

- [ ] 为 Pipeline JSONL records 建立 byte offset / logical cursor 读取策略。
- [ ] 增加 cursor schema version，避免后续格式变化导致旧 cursor 误用。
- [ ] `getPipelineRecordsTail()` 内部转调 cursor tail service。
- [ ] 对 append 中的部分写入、坏行、空行做容错。
- [ ] 增加 tail 方向：latest、before cursor、after cursor。
- [ ] 保证新增 records 读取复杂度不随历史总量线性增长。

### 前端任务

- [ ] SearchDialog 增加 Pipeline source 分组。
- [ ] 搜索结果展示 session title、stage、record kind、时间和 snippet。
- [ ] 支持点击 Pipeline 搜索结果打开对应 session，并尽量定位到 record。
- [ ] PipelineRecords 使用 cursor 加载更多，避免一次性渲染大列表。
- [ ] 快速切换 session 时丢弃旧 records 请求结果。

### 测试任务

- [ ] Pipeline records cursor tail 单测覆盖 50000 records fixture。
- [ ] 覆盖 cursor schema mismatch、文件截断、append 后继续 tail。
- [ ] SearchDialog renderer 测试覆盖 Pipeline 结果分组和点击行为。
- [ ] 覆盖 requestId / generation：旧 session 结果不能覆盖新 session。
- [ ] 覆盖空结果、搜索失败、fallback 状态。

### 触达文件

- [ ] `apps/electron/src/main/lib/pipeline-session-manager.ts`
- [ ] `apps/electron/src/main/lib/native-runtime/ts-event-search-service.ts`
- [ ] `apps/electron/src/main/ipc/pipeline-handlers.ts`
- [ ] `apps/electron/src/preload/index.ts`
- [ ] `apps/electron/src/renderer/components/app-shell/SearchDialog.tsx`
- [ ] `apps/electron/src/renderer/components/pipeline/PipelineRecords.tsx`
- [ ] `apps/electron/src/renderer/hooks/usePipelineRecordsTail.ts`
- [ ] `packages/shared/src/types/native-runtime.ts`

### 验证命令

```bash
bun test apps/electron/src/main/lib/pipeline-session-manager.test.ts
bun test apps/electron/src/main/lib/native-runtime
bun test apps/electron/src/renderer/components/app-shell/SearchDialog.indexed.test.tsx
bun test apps/electron/src/renderer/components/pipeline
bun run --filter='@codeinsights/electron' typecheck
bun run --filter='@codeinsights/electron' build:renderer
git diff --check
git status --short
```

### 完成定义

- [ ] Pipeline records tail 支持 cursor，历史越大时 tail 性能不再明显线性退化。
- [ ] SearchDialog 可搜索 Chat / Agent / Pipeline 三类内容。
- [ ] 快速输入、切换 session、关闭弹窗均不会出现 stale result。
- [ ] Review 中记录大 records fixture 的 tail 基线对比。

### 禁止事项

- [ ] 不为了定位 record 读取整个 Pipeline JSONL。
- [ ] 不把 cursor 设计成绝对文件路径或不可脱敏内容。
- [ ] 不在 renderer 中解析 JSONL。
- [ ] 不改变 Pipeline record 的持久化事实格式。

### 阶段 Review

待 Phase 2 完成后追加。

## Phase 3：Workspace 文件索引 TS Cache 与 Watcher Invalidation

### 阶段状态

- [ ] 阶段开始
- [ ] 测试先行完成
- [ ] 实现完成
- [ ] 验证完成
- [ ] 阶段 Review 完成
- [ ] 阶段提交完成

### 目标

在 TypeScript 中先建立 workspace 文件索引、ignore 规则、watcher invalidation 和可重建缓存，为后续 Rust / Go 接手扫描提供稳定契约。

### 入口条件

- [ ] Phase 0 benchmark 包含大 workspace fixture。
- [ ] Phase 1 facade 已支持 workspace source kind 或已有扩展点。
- [ ] 已确认本阶段不引入本地数据库，不把索引作为事实源。

### 后端任务

- [ ] 新增 `ts-workspace-index-service.ts`，负责文件名、相对路径、mtime、size、fingerprint。
- [ ] 支持 workspace root fingerprint，root 变化后自动废弃旧索引。
- [ ] 支持 ignore 规则：`.git`、`node_modules`、构建产物、用户配置 ignore、二进制大文件。
- [ ] 支持 watcher invalidation：新增、删除、重命名、批量变更、watcher overflow。
- [ ] 支持手动 rebuild，rebuild 不影响 Agent / Pipeline 会话事实源。
- [ ] 对 symlink 默认保守处理：不跟随仓库外 symlink，不递归循环。
- [ ] 限制索引 cache 体积，超过阈值时降级为按需扫描并记录 diagnostics。

### 前端任务

- [ ] Agent workspace selector 或 SidePanel 展示简短索引状态。
- [ ] SearchDialog 支持 workspace file source，展示 path、size、last modified。
- [ ] 搜索结果打开文件时走现有安全文件浏览 / 预览入口，不直接打开任意路径。
- [ ] Settings diagnostics 提供 rebuild workspace index 操作。

### 测试任务

- [ ] 覆盖大 workspace fixture 文件名搜索。
- [ ] 覆盖 ignore 规则、hidden 文件、symlink、权限错误。
- [ ] 覆盖 watcher invalidation 后搜索结果更新。
- [ ] 覆盖 root fingerprint 变化后 cache 重建。
- [ ] 覆盖 cache 损坏后自动隔离和重建。

### 触达文件

- [ ] `apps/electron/src/main/lib/native-runtime/ts-workspace-index-service.ts`
- [ ] `apps/electron/src/main/lib/agent-workspace-manager.ts`
- [ ] `apps/electron/src/main/lib/workspace-watcher.ts`
- [ ] `apps/electron/src/main/ipc/agent-handlers.ts`
- [ ] `apps/electron/src/renderer/components/agent/WorkspaceSelector.tsx`
- [ ] `apps/electron/src/renderer/components/app-shell/SearchDialog.tsx`
- [ ] `packages/shared/src/types/native-runtime.ts`

### 验证命令

```bash
bun test apps/electron/src/main/lib/native-runtime/ts-workspace-index-service.test.ts
bun test apps/electron/src/main/lib/agent-workspace-manager.test.ts
bun test apps/electron/src/main/lib/workspace-watcher.test.ts
bun test apps/electron/src/renderer/components/app-shell/SearchDialog.indexed.test.tsx
bun run --filter='@codeinsights/electron' typecheck
bun run --filter='@codeinsights/electron' build:main
git diff --check
git status --short
```

### 完成定义

- [ ] Workspace 文件名搜索首次索引后 P95 达到 Phase 0 设定目标或记录未达原因。
- [ ] watcher invalidation 可测试、可解释、可手动 rebuild。
- [ ] cache 可删除重建，不影响 workspace files 和会话数据。
- [ ] 大仓库扫描不阻塞主窗口交互。

### 禁止事项

- [ ] 不索引被 ignore 的 secret 文件内容。
- [ ] 不把完整文件正文默认写入 cache。
- [ ] 不在 renderer 中递归扫描文件系统。
- [ ] 不跟随仓库外 symlink。

### 阶段 Review

待 Phase 3 完成后追加。

## Phase 4：前端可见体验、Jotai 状态与 Diagnostics

### 阶段状态

- [ ] 阶段开始
- [ ] 测试先行完成
- [ ] 实现完成
- [ ] 验证完成
- [ ] 阶段 Review 完成
- [ ] 阶段提交完成

### 目标

把用户能感知的搜索、索引、fallback、失败和重建体验补齐。该阶段重点是 React / Jotai / IPC listener，不改变 native 后端实现策略。

### 入口条件

- [ ] Phase 1 到 Phase 3 的 TS fallback 服务已稳定。
- [ ] diagnostics DTO 已包含 status、capability、fallbackReason、lastError。
- [ ] SearchDialog 已具备 requestId / cancellation 基础。

### 契约与 IPC 任务

- [ ] 新增 `NATIVE_RUNTIME_IPC_CHANNELS`：status、diagnostics、rebuildIndex、clearCache、search、tail、readFileChunk。
- [ ] preload 暴露最小 API：不暴露 binary path，不允许 renderer 传任意 native command。
- [ ] 主进程增加 native runtime status event，只推送脱敏状态。
- [ ] 所有 IPC input 在 main process 做运行时校验。

### Jotai 与 Hook 任务

- [ ] 新增 `native-runtime-atoms.ts`：status、diagnostics、indexing map、lastError、operation map。
- [ ] 新增 `useGlobalNativeRuntimeListeners`，在 `main.tsx` 顶层挂载。
- [ ] 搜索请求状态按 requestId 存储，关闭弹窗后清理 pending UI state。
- [ ] workspace indexing 状态按 workspaceId 隔离。
- [ ] Pipeline tail loading 状态按 sessionId 隔离。

### UI 任务

- [ ] SearchDialog 增加 source tabs 或分组：全部、Chat、Agent、Pipeline、Workspace。
- [ ] SearchDialog 增加 indexed / fallback / rebuilding / unavailable 状态。
- [ ] SearchDialog 支持分页或 “更多结果”，避免一次性渲染过多结果。
- [ ] PipelineRecords 增加 cursor loading 和加载失败重试。
- [ ] Settings 增加 `NativeRuntimeDiagnostics` 面板：状态、能力、缓存、重建、清理、复制脱敏诊断。
- [ ] 普通用户界面只展示简短状态；详细技术信息只放 diagnostics。

### 测试任务

- [ ] Renderer 测试覆盖 SearchDialog 快速输入、stale result 丢弃、source 分组。
- [ ] Renderer 测试覆盖 diagnostics loading、fallback、clear cache confirmation。
- [ ] Hook 测试覆盖 listener 挂载、卸载、重复事件和 session/workspace 隔离。
- [ ] Electron smoke 覆盖打开搜索、执行搜索、打开 diagnostics 面板。
- [ ] 无障碍检查：按钮可聚焦、状态文本可读、错误操作有明确恢复动作。

### 触达文件

- [ ] `packages/shared/src/constants/native-runtime.ts`
- [ ] `packages/shared/src/types/native-runtime.ts`
- [ ] `apps/electron/src/main/ipc/native-runtime-handlers.ts`
- [ ] `apps/electron/src/preload/index.ts`
- [ ] `apps/electron/src/renderer/atoms/native-runtime-atoms.ts`
- [ ] `apps/electron/src/renderer/hooks/useGlobalNativeRuntimeListeners.ts`
- [ ] `apps/electron/src/renderer/main.tsx`
- [ ] `apps/electron/src/renderer/components/app-shell/SearchDialog.tsx`
- [ ] `apps/electron/src/renderer/components/settings/NativeRuntimeDiagnostics.tsx`

### 验证命令

```bash
bun test apps/electron/src/renderer/atoms/native-runtime-atoms.test.ts
bun test apps/electron/src/renderer/hooks/useGlobalNativeRuntimeListeners.test.ts
bun test apps/electron/src/renderer/components/app-shell/SearchDialog.indexed.test.tsx
bun test apps/electron/src/renderer/components/settings/NativeRuntimeDiagnostics.test.tsx
bun run --filter='@codeinsights/electron' typecheck
bun run --filter='@codeinsights/electron' build:renderer
git diff --check
git status --short
```

### 完成定义

- [ ] 用户可以看到搜索索引状态、fallback 状态和重建入口。
- [ ] 快速输入和视图切换不会出现旧结果覆盖新结果。
- [ ] Diagnostics 可复制脱敏信息，不暴露 token、home path、credentialed URL。
- [ ] UI 组件拆分清晰，没有把 diagnostics 逻辑塞进单个大组件。

### 禁止事项

- [ ] 不在普通搜索界面展示 native binary path、protocol version 等内部细节。
- [ ] 不引入非 Jotai 的全局状态管理。
- [ ] 不用 localStorage 持久化 native 状态。
- [ ] 不用 renderer 直接清理 `~/.codeinsights/native-cache/`。

### 阶段 Review

待 Phase 4 完成后追加。

## Phase 5：Rust Search Sidecar 试点

### 阶段状态

- [ ] 阶段开始
- [ ] 依赖评估完成
- [ ] 测试先行完成
- [ ] 实现完成
- [ ] 验证完成
- [ ] 阶段 Review 完成
- [ ] 阶段提交完成

### 目标

在 TS fallback 已稳定、benchmark 证明收益的前提下，用最小 Rust sidecar 替换 search / tail 热点。Rust sidecar 只做索引、搜索和 tail，不接手业务编排、权限、Git 写入或 UI。

### 入口条件

- [ ] Phase 0 到 Phase 4 已完成并提交。
- [ ] benchmark 显示 TS fallback 在目标数据规模下仍不满足门槛。
- [ ] Rust sidecar 的收益门槛已写入 `tasks/todo.md`：例如 100MB JSONL 搜索 P95 至少快 3 倍。
- [ ] 已完成 Rust 依赖 decision record，比较继续 TS、Rust crate、Go package。
- [ ] 已确认 packaged smoke 计划覆盖 native available / missing。

### Rust 工程任务

- [ ] 新增 native workspace，目录命名与 package 策略在 Review 中确认。
- [ ] 定义 sidecar protocol：stdin/stdout JSON-RPC 或 loopback + random auth，默认优先 stdin/stdout。
- [ ] 实现 `status`、`index_jsonl`、`tail_jsonl`、`search`、`shutdown`。
- [ ] 实现 protocol version、cache schema version、capability handshake。
- [ ] 所有返回 JSON 通过 schema / fixture 与 TS fallback 对齐。
- [ ] stderr 只输出脱敏 diagnostics，不输出原始 prompt、token、完整 home path。
- [ ] 对 timeout、panic、bad request、corrupted cache 返回 typed error。

### 主进程集成任务

- [ ] 新增 `native-runtime-sidecar-manager.ts`，复用 opencode server manager 的 lifecycle 思路。
- [ ] main process 启动时只做轻量探测，不阻塞应用可交互。
- [ ] 首次搜索或 rebuild 时懒启动 sidecar。
- [ ] sidecar crash 后本进程禁用 native 并 fallback TS。
- [ ] contract violation 后本进程禁用 native，记录 diagnostics。
- [ ] 所有 native 结果进入 service 前做 schema 校验和二次脱敏。

### 测试任务

- [ ] `cargo test` 覆盖 parser、index、tail、bad line、cache corruption。
- [ ] Contract parity 测试：同一 fixture 对比 TS fallback 与 Rust 输出。
- [ ] Sidecar manager 测试覆盖 missing binary、version mismatch、timeout、crash、shutdown。
- [ ] Packaged smoke 覆盖 bundled binary path，不使用系统 `PATH`。
- [ ] Benchmark 对比 Phase 0 / Phase 1 / Phase 5 的性能。

### 触达文件

- [ ] `native/search/` 或最终确认的 Rust 目录。
- [ ] `apps/electron/src/main/lib/native-runtime/native-runtime-sidecar-manager.ts`
- [ ] `apps/electron/src/main/lib/native-runtime/native-runtime-service.ts`
- [ ] `apps/electron/src/main/lib/native-runtime/native-runtime-diagnostics.ts`
- [ ] `apps/electron/scripts/native-runtime-smoke.ts`
- [ ] `apps/electron/package.json`
- [ ] `electron-builder.yml`
- [ ] `bun.lock`

### 验证命令

```bash
cargo test
bun test apps/electron/src/main/lib/native-runtime
bun test apps/electron/src/main/lib/native-runtime/path-safety-contract.test.ts
bun run --filter='@codeinsights/electron' typecheck
bun run --filter='@codeinsights/electron' build:main
bun run --filter='@codeinsights/electron' pack
bun run --filter='@codeinsights/electron' smoke:native-runtime
git diff --check
git status --short
```

### 完成定义

- [ ] TS fallback 与 Rust sidecar contract fixtures 输出一致。
- [ ] Rust sidecar 缺失、崩溃、超时、协议不兼容时自动 fallback。
- [ ] packaged app 使用 bundled sidecar。
- [ ] 性能报告证明达到预设收益门槛；若未达到，不默认启用 native。
- [ ] Review 明确是否进入默认启用候选，或保留为实验功能。

### 禁止事项

- [ ] 不让 Rust sidecar 读取或写入业务 JSON / JSONL 事实源以外的非 cache 数据。
- [ ] 不让 Rust sidecar 直接执行 Git 写操作。
- [ ] 不在 renderer 暴露 sidecar endpoint 或 binary path。
- [ ] 不因为 Rust 成功返回就跳过 TS main process 校验。

### 阶段 Review

待 Phase 5 完成后追加。

## Phase 6：大文件 / 日志 Chunk Preview

### 阶段状态

- [ ] 阶段开始
- [ ] 测试先行完成
- [ ] 实现完成
- [ ] 验证完成
- [ ] 阶段 Review 完成
- [ ] 阶段提交完成

### 目标

为大日志、大文本和超出当前预览上限的文件提供只读 chunk preview。先使用 TS fallback，若 benchmark 证明需要，再复用 Rust sidecar 的 chunk read 能力。

### 入口条件

- [ ] Phase 4 diagnostics 和 request cancellation 已完成。
- [ ] 文件预览安全边界已复核：renderer 不传任意绝对路径直接读取。
- [ ] 大文件 fixture 生成方式已确定，不提交大文件。

### 后端任务

- [ ] 新增 `readFileChunk()` service，支持 offset、length、encoding、binary detection。
- [ ] 对路径 token / workspace scope 做 main process 校验。
- [ ] 默认只读，不提供保存、编辑或覆盖写。
- [ ] 支持 UTF-8 边界处理，避免 chunk 中间截断造成乱码。
- [ ] 支持 line index 或 approximate line number，便于跳转。
- [ ] 超过阈值时只返回 preview metadata，不整文件读入内存。

### 前端任务

- [ ] FilePreview 增加 chunk viewer 模式。
- [ ] 显示文件大小、当前 offset、编码、二进制检测、加载更多。
- [ ] 支持按关键词在当前 chunk 搜索；全文件搜索走索引服务，不在 renderer 全量读取。
- [ ] 大文件模式禁用编辑和保存。
- [ ] 加载失败提供重试和复制脱敏错误。

### 测试任务

- [ ] 覆盖 500MB 合成文本首屏 chunk 加载。
- [ ] 覆盖 UTF-8 多字节边界、Windows 换行、超长行。
- [ ] 覆盖 binary 文件拒绝或安全预览。
- [ ] 覆盖 path traversal、symlink、权限错误。
- [ ] 覆盖关闭预览窗口后 abort pending chunk request。

### 触达文件

- [ ] `apps/electron/src/main/lib/file-preview-service.ts`
- [ ] `apps/electron/src/main/lib/native-runtime/native-runtime-service.ts`
- [ ] `apps/electron/src/main/ipc/file-preview-handlers.ts`
- [ ] `apps/electron/src/preload/file-preview-preload.ts`
- [ ] `apps/electron/src/renderer/components/file-browser/FilePreview*.tsx`
- [ ] `packages/shared/src/types/native-runtime.ts`

### 验证命令

```bash
bun test apps/electron/src/main/lib/file-preview-service.test.ts
bun test apps/electron/src/main/lib/native-runtime
bun test apps/electron/src/renderer/components/file-browser
bun run --filter='@codeinsights/electron' typecheck
bun run --filter='@codeinsights/electron' build:main
bun run --filter='@codeinsights/electron' build:renderer
git diff --check
git status --short
```

### 完成定义

- [ ] 500MB 合成日志首屏 preview 不阻塞主窗口。
- [ ] 路径安全、symlink、binary detection 和 abort 有测试覆盖。
- [ ] 大文件预览不改变现有小文件预览体验。
- [ ] Review 记录 TS fallback 是否足够，是否需要 Rust chunk reader。

### 禁止事项

- [ ] 不在 renderer 中读完整大文件。
- [ ] 不把大 fixture 文件提交进仓库。
- [ ] 不提供大文件编辑 / 保存能力。
- [ ] 不绕过现有 file dialog / workspace 安全入口。

### 阶段 Review

待 Phase 6 完成后追加。

## Phase 7：PathSafety 与 GitOutputParser 抽象

### 阶段状态

- [ ] 阶段开始
- [ ] 安全 fixture 先行完成
- [ ] 实现完成
- [ ] 验证完成
- [ ] 安全 Review 完成
- [ ] 阶段提交完成

### 目标

集中当前 patch-work 路径安全、Git porcelain / diff / remote URL parsing 和脱敏逻辑。先用 TypeScript 抽象和 fixture 锁定行为，再决定是否用 Rust helper 增强 parser / fuzz。

### 入口条件

- [ ] Pipeline patch-work、Git submission、preflight 当前测试全部通过。
- [ ] `tasks/lessons.md` 中路径安全和 Git 防护经验已复习。
- [ ] 已确认 native helper 只能先接入 read-only 解析路径，不接手写操作决策。

### 安全 fixture 任务

- [ ] 覆盖 symlink 指向仓库外、symlink loop、missing parent、existing parent、reserved path。
- [ ] 覆盖 Windows drive、UNC path、case-insensitive collision、NUL byte、路径归一化。
- [ ] 覆盖 credentialed remote URL、query/hash token、Authorization、Bearer、短 token。
- [ ] 覆盖 git status porcelain v1 / v2、rename、copy、deleted、untracked、ignored。
- [ ] 覆盖 diff 文件名带空格、引号、中文、特殊字符。

### TypeScript 抽象任务

- [ ] 新增 `PathSafetyService`，集中 containment、realpath、lstat、symlink 策略。
- [ ] 新增 `GitOutputParser`，集中 status、diff name、remote URL、branch context 解析。
- [ ] 现有 Pipeline patch-work 和 Git submission service 内部转调新 parser。
- [ ] 所有 parser 返回结构化 result，不向上游抛未分类字符串错误。
- [ ] 对不确定场景默认拒绝，不默认放行。

### Rust Helper 可选任务

- [ ] 只有 TS fixtures 稳定且 parser 仍复杂时，新增 Rust read-only helper。
- [ ] Rust helper 与 TS fallback 跑同一 fixture。
- [ ] Rust 返回结果进入 Pipeline service 前，TS 再 assert 一次。
- [ ] Rust helper 异常时默认使用 TS fallback 或拒绝高风险操作。

### 测试任务

- [ ] `path-safety-contract.test.ts` 覆盖 TS fallback 与可选 native。
- [ ] Git parser fixture test 覆盖所有 status / diff / remote URL 样例。
- [ ] Pipeline patch-work service 原有测试保持通过。
- [ ] Pipeline Git submission service 原有测试保持通过。
- [ ] 安全审查无 P0 / P1 blocker。

### 触达文件

- [ ] `apps/electron/src/main/lib/pipeline-patch-work-service.ts`
- [ ] `apps/electron/src/main/lib/pipeline-git-submission-service.ts`
- [ ] `apps/electron/src/main/lib/pipeline-preflight-service.ts`
- [ ] `apps/electron/src/main/lib/native-runtime/path-safety-service.ts`
- [ ] `apps/electron/src/main/lib/native-runtime/git-output-parser.ts`
- [ ] `apps/electron/src/main/lib/native-runtime/__fixtures__/path-safety/`
- [ ] `apps/electron/src/main/lib/native-runtime/__fixtures__/git-output/`

### 验证命令

```bash
bun test apps/electron/src/main/lib/pipeline-patch-work-service.test.ts
bun test apps/electron/src/main/lib/pipeline-git-submission-service.test.ts
bun test apps/electron/src/main/lib/pipeline-preflight-service.test.ts
bun test apps/electron/src/main/lib/native-runtime/path-safety-contract.test.ts
bun test apps/electron/src/main/lib/native-runtime/git-output-parser.test.ts
bun run --filter='@codeinsights/electron' typecheck
git diff --check
git status --short
```

### 完成定义

- [ ] 路径安全和 Git 输出解析集中到可测试 service。
- [ ] 现有 Pipeline 提交、preflight 和 patch-work 行为不变。
- [ ] 任何 parser 不确定场景默认拒绝或 fallback，不放宽安全边界。
- [ ] Review 明确是否需要 Rust helper；如不需要，记录“不引入 native”的理由。

### 禁止事项

- [ ] 不让 native 直接执行 `git commit`、`git push`、`git reset`、`gh pr create`。
- [ ] 不把 remote URL 原文写入 renderer error。
- [ ] 不只用词法路径判断替代 realpath / lstat。
- [ ] 不用“解析失败则放行”的策略。

### 阶段 Review

待 Phase 7 完成后追加。

## Phase 8：打包、CI、版本与发布收口

### 阶段状态

- [ ] 阶段开始
- [ ] 打包配置完成
- [ ] CI / smoke 完成
- [ ] 文档同步完成
- [ ] 验证完成
- [ ] 阶段 Review 完成
- [ ] 阶段提交完成

### 目标

在 native 能力准备默认启用前，完成 optional platform package、electron-builder files、packaged smoke、CI 矩阵、版本兼容和回滚策略。

### 入口条件

- [ ] 至少一个 native 能力已完成 TS fallback 和 native available / missing 测试。
- [ ] Phase 5 或其他 native 阶段 Review 明确建议默认启用或灰度启用。
- [ ] 用户已确认是否允许同步根 `README.md` / 根 `AGENTS.md`；未授权则不修改。

### 打包任务

- [ ] 在 `apps/electron/package.json` 增加目标平台 optionalDependencies。
- [ ] 在 `electron-builder.yml` files 中包含 native 主包和平台子包。
- [ ] 确认 `asar`、签名、notarization、NSIS 安装后 binary 可执行。
- [ ] 确认 packaged app 不从系统 `PATH` 加载 native binary。
- [ ] 增加 binary fingerprint diagnostics。

### CI 任务

- [ ] PR fast：TS fallback、typecheck、renderer tests、contract fixtures。
- [ ] Native unit：Rust `cargo test` / Go `go test`。
- [ ] Native integration：sidecar manager、crash、timeout、fallback。
- [ ] Packaged smoke：native available / missing、bundled binary path。
- [ ] Cross-platform：macOS arm64 / x64、Windows x64、Linux x64 说明和脚本。

### 版本与兼容任务

- [ ] 建立 app version -> native protocol version -> binary version -> cache schema version 的兼容表。
- [ ] protocol mismatch 时禁用 native，不尝试兼容执行旧 binary。
- [ ] cache schema mismatch 时删除或隔离旧 cache 并重建。
- [ ] release notes 写清 fallback、diagnostics 和 cache 清理。
- [ ] 受影响 package patch version 递增并同步 `bun.lock`。

### 验证任务

- [ ] 本机 unpacked app smoke。
- [ ] Native missing smoke：移除或隐藏 binary 后确认 fallback。
- [ ] Native available smoke：确认 bundled binary path。
- [ ] Cache corruption smoke：损坏 native-cache 后自动隔离 / 重建。
- [ ] App quit cleanup：sidecar 退出，无残留进程。

### 触达文件

- [ ] `apps/electron/package.json`
- [ ] `package.json`
- [ ] `bun.lock`
- [ ] `electron-builder.yml`
- [ ] `.github/workflows/*`
- [ ] `apps/electron/scripts/native-runtime-smoke.ts`
- [ ] `docs/improve/rust-go/2026-06-01-rust-go-development-checklist.md`
- [ ] 根 `README.md` / 根 `AGENTS.md` 仅在用户明确允许时触达。

### 验证命令

```bash
bun run test
bun run typecheck
bun install --frozen-lockfile --dry-run
bun run electron:build
bun run --filter='@codeinsights/electron' pack
bun run --filter='@codeinsights/electron' smoke:native-runtime
git diff --check
git status --short --branch
```

### 完成定义

- [ ] packaged app native available / missing 两条路径都通过。
- [ ] native 缺失或禁用时 Agent / Pipeline 核心功能不受阻断。
- [ ] CI 分层和 release smoke 策略写入文档或 workflow。
- [ ] 版本递增、lockfile、打包配置和 smoke 结果在 Review 中记录。
- [ ] 如果根文档未授权修改，Review 明确记录未触达。

### 禁止事项

- [ ] 不把 native 打包问题留给用户手动安装系统 binary。
- [ ] 不把 platform optional dependency 缺失伪装为成功。
- [ ] 不只验证开发模式而跳过 packaged smoke。
- [ ] 未授权不修改根 README / AGENTS。

### 阶段 Review

待 Phase 8 完成后追加。

## Phase 9：Go Supervisor 可选 Spike

### 阶段状态

- [ ] 触发条件确认
- [ ] Spike 计划完成
- [ ] 非模型 mock 验证完成
- [ ] 跨平台 lifecycle 验证完成
- [ ] 是否合入主线决策完成
- [ ] 阶段 Review 完成

### 触发条件

只有满足以下任一条件，才允许进入 Phase 9：

- [ ] Codex / opencode / bridge 进程树问题成为高频用户 bug。
- [ ] TS runner 难以可靠处理 Windows `taskkill`、POSIX process group、idle cleanup。
- [ ] 多 runtime 后台服务需要统一 supervisor / health / log redaction。
- [ ] 用户明确要求做 Go supervisor spike，并接受它不一定合入主线。

### 目标

评估 Go 是否适合承担长期运行的 local supervisor。Go supervisor 只负责进程 lifecycle、health 和 cleanup，不解释 Agent / Pipeline 业务事件，不接管权限、prompt、模型调用或 Git 写入。

### Spike 任务

- [ ] 写明 Go supervisor 的非目标：不做搜索、不做 UI、不做业务编排、不持久化用户数据。
- [ ] 定义 JSON-RPC protocol：start、stop、status、health、shutdown。
- [ ] 先接入 mock command，不接真实模型、不读取凭证。
- [ ] 验证 macOS / Windows / Linux 的进程组、子进程清理、crash recovery。
- [ ] 验证 stdout / stderr 脱敏和日志大小限制。
- [ ] 与现有 TS runner 对比复杂度、可靠性、打包成本。

### Go 工程实践任务

- [ ] 使用 `context.Context` 做 timeout / cancellation。
- [ ] 所有错误用 `%w` 包装并映射到 typed error。
- [ ] package 边界保持简单，避免抽象过早泛化。
- [ ] 标准库优先，确需 `fsnotify` 等依赖时先做 dependency decision record。
- [ ] `go test` 覆盖 start / stop / crash / timeout / cleanup。

### 验证命令

```bash
go test ./...
bun test apps/electron/src/main/lib/native-runtime
bun run --filter='@codeinsights/electron' typecheck
bun run --filter='@codeinsights/electron' build:main
git diff --check
git status --short
```

### 完成定义

- [ ] Review 给出明确决策：合入主线、继续实验或放弃。
- [ ] 如果收益不足，只保留 spike 文档，不把 Go supervisor 接入默认路径。
- [ ] 如果建议合入，必须先补 packaged smoke、optional package 和 rollback 策略。

### 禁止事项

- [ ] 不在 spike 中接真实模型、真实凭证或真实远端写。
- [ ] 不让 Go supervisor 解释 Agent / Pipeline domain event。
- [ ] 不因为 Go 并发模型方便就重写现有 TS runner。
- [ ] 不在无跨平台验证时默认启用。

### 阶段 Review

待 Phase 9 完成后追加。

## 横向工作流

### 测试纪律清单

- [ ] 每个阶段先写或更新测试，再实现功能。
- [ ] 每个新增 DTO 至少有 fixture round-trip 测试。
- [ ] 每个 native 能力都要覆盖 TS fallback、native available、native missing。
- [ ] 每个 async UI 请求都要覆盖 stale result 丢弃。
- [ ] 每个 sidecar 请求都要覆盖 timeout / abort / crash。
- [ ] 每个安全边界都要覆盖成功和拒绝路径。
- [ ] 每次阶段完成前运行 `git diff --check`。

### 性能工作流

- [ ] benchmark 数据必须写入阶段 Review。
- [ ] benchmark 必须包含数据规模、机器环境、冷 / 热缓存、P50 / P95 / P99。
- [ ] 性能收益不足时，默认保留 TS fallback，不默认启用 native。
- [ ] 不以单次手动体感作为 native 引入依据。
- [ ] 不把 benchmark fixture 的大文件提交进仓库。

### 安全审查清单

- [ ] Renderer input 不可信，main process 重新校验。
- [ ] Native output 不可信，main process schema 校验和脱敏。
- [ ] Symlink、path traversal、reserved path 默认拒绝。
- [ ] Native stderr、diagnostics、report 先脱敏再展示。
- [ ] Sidecar 如使用 loopback，只绑定 `127.0.0.1`，随机 auth，不启用 CORS。
- [ ] Native 不能执行 Git 写入、远端写、权限变更或 gate 决策。
- [ ] Security reviewer 或人工安全 review 在 Phase 7 / Phase 8 必须执行。

### 前端体验清单

- [ ] 搜索输入响应不能被索引或 IO 阻塞。
- [ ] 每种状态都有清晰 UI：loading、empty、partial、fallback、error、rebuild。
- [ ] 普通界面少展示技术细节，诊断页展示完整但脱敏的信息。
- [ ] 结果列表使用稳定尺寸和虚拟化策略，避免大结果导致布局抖动。
- [ ] 按 sessionId / workspaceId 隔离后台状态。
- [ ] 关闭弹窗或切换 workspace 后清理 pending UI state。

### 打包与发布清单

- [ ] optionalDependencies 覆盖目标平台。
- [ ] `electron-builder.yml` files 包含主包和平台子包。
- [ ] packaged smoke 覆盖 native available / missing。
- [ ] macOS arm64、macOS x64、Windows x64、Linux x64 的验证差异写清楚。
- [ ] code signing / notarization / installer 路径问题在发布前验证。
- [ ] release notes 包含 native fallback 和 diagnostics 故障排查。

### 依赖评估清单

- [ ] 新增 Rust crate / Go package 前先搜索当前版本、维护状态、license、CVE 和跨平台支持。
- [ ] 至少比较继续 TypeScript、Rust crate、Go package 三种路线。
- [ ] 评估二进制体积、transitive dependencies、构建时间和 release 签名影响。
- [ ] 优先使用标准库或项目已有依赖；只有收益明确时添加新依赖。
- [ ] dependency decision record 写入阶段 Review 或独立文档，不能只口头说明。

### 文档与状态同步清单

- [ ] 每个阶段完成后更新本文最新状态。
- [ ] 每个阶段完成后更新 `tasks/todo.md` Review。
- [ ] 需要下次继续时，给出可复制启动提示词。
- [ ] 根 `README.md` / 根 `AGENTS.md` 只有用户明确允许后才修改。
- [ ] 文档不能把未实现阶段描述为已完成。

## 后续积压池

这些事项不进入当前主线，只有当对应价值被验证后再提升为阶段：

- [ ] Rust `tree-sitter` 代码结构索引：符号搜索、依赖图、贡献影响面。
- [ ] Pipeline Evidence Index：按 artifact / gate / test evidence 建立可搜索证据图。
- [ ] 本地贡献分析器：基于 Git diff、Pipeline records 和 workspace index 给出贡献摘要。
- [ ] 本地隐私扫描：在提交或报告导出前扫描明显 secret 和 credentialed URL。
- [ ] WASM policy engine：仅当权限规则复杂化后评估。
- [ ] Tauri 替换 Electron：近期不进入主线，只能作为独立长期研究。
- [ ] Rust N-API：只有 sidecar hop 成本被 benchmark 证明不可接受时评估。
- [ ] Go watcher 聚合：只有 TS watcher 风暴成为高频问题时评估。

## 阶段 Review 统一模板

```markdown
## YYYY-MM-DD Rust/Go Phase N Review

- 阶段范围：
- 真实完成项：
- 未完成项 / [!]：
- 触达文件：
- 验证命令与结果：
- benchmark 数据：
- 安全与隐私结论：
- fallback / rollback 结论：
- 是否需要更新 README / AGENTS：未授权 / 已授权并完成 / 不需要
- 下一阶段入口：
- 阶段提交：
```

## 下一轮启动入口

可直接复制给下一次 Codex：

```text
请继续 CodeInsights Rust / Go 优化重构迭代。先读取 tasks/lessons.md、tasks/todo.md、docs/improve/rust-go/2026-06-01-rust-go-optimization-plan.md、docs/improve/rust-go/2026-06-01-rust-go-development-checklist.md 和 docs/improve/rust-go/next-session-prompt.md。当前状态是：Rust / Go 优化方案、开发跟踪清单、阶段提交纪律、Phase 0“基线、契约与 benchmark”和 Phase 1“TypeScript fallback 与 EventSearchService 重构”已经完成。Phase 0 已建立 shared NativeRuntime DTO / IPC 草案、contract fixtures、主进程 NativeRuntimeAdapter TypeScript interface、diagnostics 空实现和 native-runtime benchmark runner；Phase 1 已新增 jsonl-event-reader.ts、ts-event-search-service.ts 和 native-runtime-service.ts，统一 Chat / Agent / Pipeline TypeScript 搜索 fallback facade，并保留旧 IPC / preload / renderer 行为兼容。目前尚未实现 Pipeline cursor tail、workspace index、SearchDialog Pipeline 内容接入、Native Runtime Diagnostics UI、Rust sidecar、Go supervisor 或任何 native binary。最新已确认开发基线是 58cc241d feat(rust-go): 完成 Phase 1 TypeScript 搜索 fallback 重构。请先运行 git status --short --branch 和 git log -5 --oneline，若存在其后的 Rust / Go 状态同步提交，以最新提交为准。下一步应从 Phase 2“Pipeline records cursor / tail 与全局搜索接入”开始；先在 tasks/todo.md 写 Phase 2 计划，明确范围、触达文件、验证命令和禁止事项。用户已明确计划写清后无需等待确认；不要直接写 Rust / Go，不安装依赖，不创建 native binary，不修改根 README.md / AGENTS.md。
```
