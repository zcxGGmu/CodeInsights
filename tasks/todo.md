# CodeInsights Agent 重构任务

## 2026-06-01 Rust/Go Phase 1 TypeScript Fallback 与 EventSearchService 重构计划

范围确认：本轮从 Phase 1“TypeScript fallback 与 EventSearchService 重构”开始。用户已明确后续不需要实现前确认，因此计划写清后直接按 TDD 实现；只有遇到计划外架构变更、依赖安装、Rust / Go、native binary、根 `README.md` / 根 `AGENTS.md` 修改或用户明确要求暂停时才停下。Phase 1 的目标是在 TypeScript 内收敛 Chat / Agent / Pipeline 搜索 facade，复用 Phase 0 的 NativeRuntime DTO、contract fixtures 和 benchmark 基线，保留旧 IPC 行为回归测试，并记录相对 Phase 0 的性能变化。本阶段不写 Rust / Go，不安装依赖，不创建 native binary，不修改根 `README.md` / 根 `AGENTS.md`。实现提交：`58cc241d feat(rust-go): 完成 Phase 1 TypeScript 搜索 fallback 重构`。

启动基线：

- [x] 已读取 `tasks/lessons.md`、`tasks/todo.md`、Rust / Go 优化方案、开发跟踪清单和下次启动提示词。
- [x] 已运行 `git status --short --branch`：当前分支为 `rust-go-refactor`，启动时工作树干净。
- [x] 已运行 `git log -5 --oneline`：最新提交为 `abb87ef5 docs(rust-go): 同步 Phase 0 后续开发状态与下次启动入口`，因此本轮以 `abb87ef5` 作为最新已确认恢复入口，以 `987d600e feat(rust-go): 完成 Phase 0 基线契约与 benchmark` 作为最新已确认开发基线。
- [x] 已确认 Phase 0 已完成 shared NativeRuntime DTO / IPC 草案、contract fixtures、主进程 `NativeRuntimeAdapter` TypeScript interface、diagnostics 空实现和 `native-runtime:benchmark` runner。
- [x] 已确认当前尚未实现 EventSearchService、Pipeline cursor tail、workspace index、SearchDialog 接入、Rust sidecar、Go supervisor 或任何 native binary。
- [x] 用户已明确后续不需要实现前确认；本规则已写入 `tasks/lessons.md`。

Phase 1 范围：

- [x] 新增主进程 `NativeRuntimeService` facade，默认暴露 TypeScript diagnostics 和 `TypeScriptEventSearchService`，不注册新的 renderer 主流程入口。
- [x] 新增 `EventSearchService` / `ts-event-search-service`，统一 Chat / Agent / Pipeline JSONL 搜索逻辑和结果归一化。
- [x] 新增 JSONL event reader helper，集中处理 JSONL 逐行读取、坏行跳过、缺失文件、read error diagnostics、snippet 截断所需 source metadata 和 AbortSignal。
- [x] 保留 `jsonl-search.ts` 旧入口，并让旧 Chat / Agent 搜索调用内部转调新 service，降低破坏面。
- [x] 保留旧 IPC 通道和返回形状，给 Chat / Agent / Pipeline 现有搜索行为写回归测试，不要求 renderer 一次性迁移。
- [x] 复用 `packages/shared/src/types/native-runtime.ts` 中的 search DTO 和 `packages/shared/fixtures/native-runtime/` fixture，并最小扩展 source kind 到 `chat_message` / `agent_message` / `pipeline_record` / `workspace_file` / `patch_work_file`。
- [x] 在 benchmark runner 中补充 Phase 1 搜索路径，Review 中记录相对 Phase 0 的 P50 / P95 / P99、event loop delay 和内存变化。
- [x] 已递增 `apps/electron/package.json` 到 `0.0.132`、`packages/shared/package.json` 到 `0.1.59` 并同步 `bun.lock`。

明确不在 Phase 1 做：

- [x] 不实现 Pipeline records cursor / byte offset tail；该能力保留到 Phase 2。
- [x] 不接入 SearchDialog 的 Pipeline 内容搜索、分页、分组或 stale result UI；该能力保留到 Phase 2 / Phase 4。
- [x] 不建立 workspace 文件索引、watcher invalidation 或 workspace search；该能力保留到 Phase 3。
- [x] 不实现 Native Runtime Diagnostics 设置页；该能力保留到 Phase 4。
- [x] 不写 Rust sidecar、Go supervisor、native optional package、native-cache schema 或 packaged smoke。

拟触达文件：

- [x] `apps/electron/src/main/lib/native-runtime/native-runtime-service.ts`
- [x] `apps/electron/src/main/lib/native-runtime/ts-event-search-service.ts`
- [x] `apps/electron/src/main/lib/native-runtime/jsonl-event-reader.ts`
- [skip] `apps/electron/src/main/lib/native-runtime/native-runtime-types.ts`（Phase 0 interface 已足够，本阶段无需改动）
- [skip] `apps/electron/src/main/lib/native-runtime/native-runtime-diagnostics.ts`（继续保持 native disabled diagnostics，不宣称未注册能力）
- [x] `apps/electron/src/main/lib/jsonl-search.ts`
- [x] `apps/electron/src/main/lib/jsonl-search.test.ts`
- [x] `apps/electron/src/main/lib/conversation-manager.ts`
- [x] `apps/electron/src/main/lib/conversation-manager.test.ts`
- [x] `apps/electron/src/main/lib/agent-session-manager.ts`
- [x] `apps/electron/src/main/lib/agent-session-manager.test.ts`
- [x] `apps/electron/src/main/lib/pipeline-session-manager.ts`
- [x] `apps/electron/src/main/lib/pipeline-session-manager.test.ts`
- [skip] `apps/electron/src/main/ipc.ts`（旧 IPC handler 继续调用 manager，签名和通道未变）
- [skip] `apps/electron/src/main/ipc/agent-handlers.ts`（旧 IPC handler 继续调用 manager，签名和通道未变）
- [skip] `apps/electron/src/main/ipc/pipeline-handlers.ts`（旧 service facade 继续转调 manager，签名和通道未变）
- [x] `packages/shared/src/types/native-runtime.ts`
- [x] `packages/shared/fixtures/native-runtime/`
- [x] `apps/electron/scripts/native-runtime-benchmark.ts`
- [x] `apps/electron/scripts/native-runtime-benchmark.test.ts`
- [x] `apps/electron/package.json`
- [x] `packages/shared/package.json`
- [x] `bun.lock`
- [x] `docs/improve/rust-go/2026-06-01-rust-go-development-checklist.md`（阶段完成后同步）
- [x] `docs/improve/rust-go/next-session-prompt.md`（阶段完成后同步）
- [x] `tasks/todo.md`
- [x] `tasks/lessons.md`（记录用户纠正：计划写清后不再等待实现前确认）

测试先行计划：

- [x] 先补 `jsonl-event-reader` 单测：坏 JSONL 行、空文件、缺失文件、read error diagnostics、中文匹配和取消。
- [x] 先补 `ts-event-search-service` contract 测试：Chat / Agent / Pipeline source kind、稳定顺序、limit、cursor 占位、implementation 标记和 diagnostics。
- [x] 先补旧入口兼容测试：`searchConversationMessages()`、`searchAgentSessionMessages()`、`searchPipelineRecordsPage()` 返回字段与旧行为一致。
- [x] 覆盖 AbortSignal：取消后抛出可识别错误，不返回旧结果。
- [x] 覆盖多 source 聚合顺序：同 query 下 Chat / Agent 结果保持旧 source 顺序，Pipeline 保持旧分页顺序。

验证命令：

```bash
bun test apps/electron/src/main/lib/jsonl-search.test.ts
bun test apps/electron/src/main/lib/native-runtime
bun test apps/electron/src/main/lib/agent-session-manager.test.ts
bun test apps/electron/src/main/lib/pipeline-session-manager.test.ts
bun run --filter='@codeinsights/electron' typecheck
bun run --filter='@codeinsights/electron' build:main
bun run --filter='@codeinsights/electron' native-runtime:benchmark --records 50000 --payload-bytes 256 --workspace-files 100000 --log-bytes 524288000 --iterations 3
git diff --check
git status --short --branch
```

验证备注：

- `native-runtime:benchmark` 必须记录 Phase 1 搜索路径与 Phase 0 基线的相对变化；如果 full benchmark 运行时间过长，先运行 quick benchmark，但 Review 必须写明 full 是否运行及原因。
- Phase 1 不运行 `cargo test` / `go test`，因为不会创建 Rust / Go 工程。
- 如果触达 shared DTO，则额外运行 `bun test packages/shared/src/types/native-runtime.test.ts` 和 `bun run --filter='@codeinsights/shared' typecheck`。
- 如果触达 preload / renderer，则额外运行相关 renderer 测试和 `bun run --filter='@codeinsights/electron' build:renderer`；默认 Phase 1 不触达 renderer。

禁止事项：

- [x] 不直接写 Rust / Go。
- [x] 不安装依赖。
- [x] 不创建 native binary、Rust crate、Go module、optionalDependencies 或打包配置。
- [x] 不修改根 `README.md` / 根 `AGENTS.md`。
- [x] 不删除旧 IPC 通道或强迫 renderer 一次性迁移。
- [x] 不改变 JSON / JSONL 事实源格式。
- [x] 不把搜索 cache 当作唯一数据源；本阶段未引入搜索 cache。
- [x] 不复制用户真实 `~/.codeinsights/` 数据进 fixture 或 benchmark。
- [x] 不让 renderer 知道 native binary path 或直接调用 native runtime。
- [x] 不 push、不创建 PR、不执行真实远端写。

### 实现前 Check-in

- [x] 已将 Phase 1 计划写入本节；用户已明确无需确认，直接进入测试与实现。

### Review

- 阶段提交：已提交 `58cc241d feat(rust-go): 完成 Phase 1 TypeScript 搜索 fallback 重构`。
- 实现完成：新增 `jsonl-event-reader.ts`、`ts-event-search-service.ts` 和 `native-runtime-service.ts`；`jsonl-search.ts` 保留旧入口并转调新 reader；Chat / Agent / Pipeline 旧搜索入口内部改为统一 TypeScript fallback service，旧 IPC 通道、preload 方法和 renderer 行为未改。
- 契约完成：`NativeRuntimeSearchSourceKind` 最小扩展到 `chat_message` / `agent_message` / `pipeline_record` / `workspace_file` / `patch_work_file`；shared search result fixture 已改为 `pipeline_record`；`@codeinsights/shared` 版本升到 `0.1.59`。
- 兼容边界：Chat / Agent 保持 query 长度小于 2 返回空、每会话第一条命中、最多 30 条、坏行跳过、读取失败不阻断；Agent 继续兼容旧 `AgentMessage` 与新 `SDKMessage` text block，未知 role 回退 assistant；Pipeline 保持 stage filter、分页、tab 归属和摘要长度行为。
- 版本与锁文件：`@codeinsights/electron` 升到 `0.0.132`，`bun.lock` 已同步；未新增依赖。
- Benchmark 对比 Phase 0：同为 macOS arm64 / Bun 1.3.13 / 50k records / 100k workspace paths / 500MB log / iterations 3。Phase 1 `chat-search-large-history` P50 113.440ms / P95 141.404ms / P99 141.404ms / event loop delay 9.716ms / memory 42,663,936 bytes；Phase 0 对应为 P50 55.331ms / P95 93.134ms / P99 93.134ms / event loop delay 107.361ms / memory 52,150,272 bytes。Phase 1 `agent-runtime-search` P50 109.687ms / P95 117.410ms / P99 117.410ms / event loop delay 1.822ms / memory 5,734,400 bytes；Phase 0 对应为 P50 39.888ms / P95 52.886ms / P99 52.886ms / event loop delay 52.938ms / memory 360,448 bytes。
- Benchmark 结论：Phase 1 将 Chat / Agent 搜索 benchmark 切到真实 EventSearchService 流式 reader；wall-clock 明显变慢，但 main-thread event loop delay 明显下降。Pipeline tail、workspace search 和 large-log preview 仍未优化，数据分别为 P50 68.114ms / 20.163ms / 530.734ms，保留到后续阶段处理。
- 验证通过：`bun test apps/electron/src/main/lib/jsonl-search.test.ts apps/electron/src/main/lib/native-runtime apps/electron/src/main/lib/conversation-manager.test.ts apps/electron/src/main/lib/agent-session-manager.test.ts apps/electron/src/main/lib/pipeline-session-manager.test.ts packages/shared/src/types/native-runtime.test.ts apps/electron/scripts/native-runtime-benchmark.test.ts`；`bun run --filter='@codeinsights/shared' typecheck`；`bun run --filter='@codeinsights/electron' typecheck`；`bun run --filter='@codeinsights/electron' build:main`；`bun run --filter='@codeinsights/electron' native-runtime:benchmark --records 50000 --payload-bytes 256 --workspace-files 100000 --log-bytes 524288000 --iterations 3`；`bun install --frozen-lockfile --dry-run`；`git diff --check`。
- 边界确认：本阶段未写 Rust / Go，未安装依赖，未创建 native binary，未新增 optionalDependencies，未修改根 `README.md` / 根 `AGENTS.md`，未改 preload / renderer，未接入 SearchDialog Pipeline 内容搜索，未实现 Pipeline cursor tail、workspace index、Diagnostics UI、Rust sidecar 或 Go supervisor，未 push，未创建 PR。
- 状态同步：已将 Rust / Go development checklist 和 next-session prompt 推进到 Phase 1 完成、Phase 2 待启动；`tasks/lessons.md` 已记录“计划写清后无需等待确认”。本轮状态同步由后续 docs 提交承载，最终回复给出实际 HEAD。
- 后续入口：Phase 2 应从 Pipeline records cursor / tail 与 SearchDialog Pipeline 内容接入开始；继续复用 Phase 1 EventSearchService，不要直接写 Rust / Go。

## 2026-06-01 Rust/Go Phase 0 后续状态同步计划

范围确认：本轮响应“更新文档最新开发状态、标注完成/未完成、给下次启动提示词，并记住阶段完成后自动执行”的要求。当前 Phase 0 已在 `987d600e feat(rust-go): 完成 Phase 0 基线契约与 benchmark` 完成；本轮只同步 Rust / Go development checklist、next-session prompt、`tasks/todo.md` Review 和必要 lessons，不改业务代码，不安装依赖，不修改根 `README.md` / 根 `AGENTS.md`，不 push，不创建 PR。

执行计划：

- [x] 检查当前分支、工作树和最近提交，确认当前真实开发基线。
- [x] 更新 Rust / Go 开发跟踪清单，回填 Phase 0 真实提交、完成项、未完成项和下一阶段入口。
- [x] 更新 `docs/improve/rust-go/next-session-prompt.md`，给下一次 Codex 会话提供可复制恢复提示词。
- [x] 更新 `tasks/lessons.md`，把 Rust / Go 阶段完成后的自动状态同步习惯写成长期规则。
- [x] 更新本节 Review，记录同步结果、验证命令、未完成项和提交边界。
- [x] 运行文档校验：关键状态搜索、占位词扫描、行尾空白、Markdown code fence 和 `git diff --check`。
- [x] 单独提交本轮状态同步，提交信息使用详细中文。

边界：

- [x] 不修改业务代码。
- [x] 不安装依赖。
- [x] 不新增 Rust / Go、native binary、optionalDependencies 或打包配置。
- [x] 不修改根 `README.md` / 根 `AGENTS.md`。
- [x] 不 push、不创建 PR。
- [x] 不把未实现的 Rust / Go 功能标记为完成。

### Review

- 启动检查：`git status --short --branch` 显示当前分支为 `rust-go-refactor` 且启动时工作树干净；`git log -5 --oneline` 确认最新开发提交为 `987d600e feat(rust-go): 完成 Phase 0 基线契约与 benchmark`。
- Rust / Go checklist 已更新：最新开发基线回填为 `987d600e`；完成项明确包含方案、深化方案、开发跟踪清单、阶段提交纪律、下次启动提示词和 Phase 0；未完成项明确保留 Phase 1-9、EventSearchService、Pipeline cursor tail、workspace index、SearchDialog、Diagnostics UI、Rust sidecar、Go supervisor 和 native binary。
- `next-session-prompt.md` 已更新：可复制提示词改为从 Phase 1“TypeScript fallback 与 EventSearchService 重构”开始，并要求启动后运行 `git status --short --branch` / `git log -5 --oneline`，若存在更新的 Rust / Go 状态同步提交则以最新提交为准。
- `tasks/lessons.md` 已更新：Rust / Go 每个 Phase 完成并提交后，必须默认同步 development checklist、next-session prompt、`tasks/todo.md` Review 和必要 lessons，并单独提交状态同步；最终回复必须给可直接复制的下次启动提示词。
- 验证通过：关键状态 `rg` 搜索；旧基线和占位表达扫描；行尾空白 `awk` 检查；Markdown code fence 成对检查；`git diff --check -- docs/improve/rust-go/2026-06-01-rust-go-development-checklist.md docs/improve/rust-go/next-session-prompt.md tasks/todo.md tasks/lessons.md`。
- 边界确认：本轮未修改业务代码，未安装依赖，未新增 Rust / Go、native binary、optionalDependencies 或打包配置，未修改根 `README.md` / 根 `AGENTS.md`，未 push，未创建 PR，未把任何未实现 Rust / Go 功能标记为完成。
- 阶段提交：本节由本轮状态同步提交承载；仓库内不写自身提交 hash，最终回复给出实际 HEAD。

## 2026-06-01 Rust/Go Phase 0 基线、契约与 Benchmark 计划

范围确认：本轮从 Phase 0“基线、契约与 benchmark”开始，但当前先只写计划并在实现前 check-in。Phase 0 的目标是建立 shared DTO / IPC 草案、`NativeRuntimeAdapter` TypeScript interface、contract fixtures、diagnostics 类型和 benchmark fixture，并记录 JSONL 搜索、Pipeline records tail、workspace search、大文件预览的真实基线数据。Phase 0 不追求性能提升，不改变用户可见行为，不进入 Rust / Go 实现。

启动基线：

- [x] 已读取 `tasks/lessons.md`、`tasks/todo.md`、Rust / Go 优化方案、开发跟踪清单和下次启动提示词。
- [x] 已运行 `git status --short --branch`：当前分支为 `rust-go-refactor`，启动时工作树干净。
- [x] 已运行 `git log -5 --oneline`：最新提交为 `72bec6bf docs(rust-go): 同步最新开发状态和下次启动提示词`，因此本轮以 `72bec6bf` 作为最新已确认恢复入口。
- [x] 已确认当前尚未实现 `NativeRuntimeAdapter`、TS fallback 重构、Rust sidecar、Go supervisor 或任何 native binary。
- [x] 已确认用户边界：不直接写 Rust / Go，不安装依赖，不创建 native binary，不修改根 `README.md` / 根 `AGENTS.md`。

执行计划：

- [x] 实现前确认：提交本 Phase 0 计划给用户确认，确认后再开始触达代码与 fixture。
- [x] 建立 shared 契约草案：定义 native runtime status、capability、implementation、error code、fallback reason、operation model、search、JSONL tail、workspace index、file chunk、diagnostics DTO 与 `NATIVE_RUNTIME_IPC_CHANNELS` 草案。
- [x] 建立 contract fixtures：为 search input / result、tail input / result、diagnostics、operation progress、workspace index、file chunk 准备脱敏 JSON fixture；不使用真实用户 `~/.codeinsights/` 数据。
- [x] 建立主进程内部接口：新增 `NativeRuntimeAdapter` TypeScript interface，只作为 `apps/electron/src/main/lib` 内部替换边界；默认实现仍是 TypeScript / disabled diagnostics。
- [x] 建立 diagnostics 空实现：返回 `implementation: "typescript"`、native 默认关闭、capabilities 和 fallback reason；不接入 UI 主流程。
- [x] 建立 benchmark fixture 与 runner：用合成数据覆盖 `chat-search-large-history`、`agent-runtime-search`、`pipeline-tail-large-records`、`workspace-file-name-search`、`large-log-preview`，runner 输出 JSON summary。
- [x] 记录真实基线数据：记录数据规模、机器环境、冷 / 热缓存、P50 / P95 / P99、最大内存、event loop delay；benchmark 只写临时目录，不写真实 `~/.codeinsights/`。
- [x] 更新版本与锁文件：如 Phase 0 修改 `@codeinsights/shared` 或 `@codeinsights/electron` 包代码，递增对应 package patch 版本并同步 `bun.lock`。
- [x] 阶段收尾：更新 Rust / Go development checklist、`docs/improve/rust-go/next-session-prompt.md`、本节 Review 和必要 lessons。
- [x] 验证通过后单独提交 Phase 0，提交信息使用详细中文，提交范围仅包含 Phase 0 相关文件。

拟触达文件：

- [x] `packages/shared/src/types/native-runtime.ts`
- [x] `packages/shared/src/types/native-runtime.test.ts`
- [x] `packages/shared/src/types/index.ts`
- [skip] `packages/shared/src/index.ts`（现有 re-export 已覆盖）
- [x] `packages/shared/fixtures/native-runtime/`
- [x] `apps/electron/src/main/lib/native-runtime/native-runtime-types.ts`
- [x] `apps/electron/src/main/lib/native-runtime/native-runtime-diagnostics.ts`
- [x] `apps/electron/src/main/lib/native-runtime/native-runtime-diagnostics.test.ts`
- [skip] `apps/electron/src/main/lib/native-runtime/__fixtures__/`（benchmark fixture 运行时生成）
- [x] `apps/electron/scripts/native-runtime-benchmark.ts`
- [x] `apps/electron/scripts/native-runtime-benchmark.test.ts`
- [x] `docs/improve/rust-go/2026-06-01-rust-go-development-checklist.md`
- [x] `docs/improve/rust-go/next-session-prompt.md`
- [x] `tasks/todo.md`
- [skip] `tasks/lessons.md`（本阶段无新的纠正规则）
- [x] `packages/shared/package.json`、`apps/electron/package.json`、`bun.lock`（对应包代码变更已递增版本）

验证命令：

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

验证备注：

- `native-runtime:benchmark` 脚本若 Phase 0 新增，需要同步 `apps/electron/package.json`；若决定先用 `bun apps/electron/scripts/native-runtime-benchmark.ts` 直跑，则在 Review 记录实际命令。
- Phase 0 不运行 `cargo test` / `go test`，因为不会创建 Rust / Go 工程。
- 如 benchmark 运行时间过长，保留 quick / full 两档；提交前至少运行 quick，并在 Review 写明 full 是否运行及原因。

禁止事项：

- [x] 不直接重写现有搜索服务或 Pipeline records 读取路径。
- [x] 不新增 Rust crate、Go module、native binary、optionalDependencies 或打包配置。
- [x] 不安装依赖；如后续确需依赖，先做搜索与 decision record。
- [x] 不修改根 `README.md` / 根 `AGENTS.md`。
- [x] 不把 benchmark 合成大文件提交进仓库。
- [x] 不复制用户真实 `~/.codeinsights/` 数据进 fixture。
- [x] 不让 renderer 直接知道 native binary path 或调用 native runtime。
- [x] 不接入真实 UI 主流程，不改变 Agent / Pipeline / Search / File Preview 用户可见行为。
- [x] 不 push、不创建 PR、不执行真实远端写。

### 实现前 Check-in

已完成实现前确认；用户确认后进入 Phase 0 代码、fixture、benchmark 与 diagnostics 空实现。

### Review

- 启动基线：已读取 lessons / todo / Rust-Go 方案 / checklist / next-session prompt；`git status --short --branch` 启动时在 `rust-go-refactor` 且工作树干净；`git log -5 --oneline` 确认最新恢复入口为 `72bec6bf docs(rust-go): 同步最新开发状态和下次启动提示词`。
- Shared 契约：已新增 `packages/shared/src/types/native-runtime.ts` 与 `packages/shared/src/types/native-runtime.test.ts`，覆盖 NativeRuntime status、capability、implementation、fallback reason、error code、operation model、search、JSONL tail、workspace index、file chunk、diagnostics 和 `NATIVE_RUNTIME_IPC_CHANNELS`；已通过 `packages/shared/src/types/index.ts` re-export；`@codeinsights/shared` 版本从 `0.1.57` 提升到 `0.1.58`。
- Contract fixtures：已新增 `packages/shared/fixtures/native-runtime/`，覆盖 search input / result、tail input / result、diagnostics、operation progress、workspace index 和 file chunk；fixture 为脱敏合成样本，没有真实用户路径、token 或 `~/.codeinsights/` 数据。
- 主进程边界：已新增 `apps/electron/src/main/lib/native-runtime/native-runtime-types.ts` 的 `NativeRuntimeAdapter` interface，以及 `native-runtime-diagnostics.ts` 的 TypeScript fallback diagnostics 空实现；未注册 IPC，未改 preload，未接入 UI 主流程。
- Benchmark runner：已新增 `apps/electron/scripts/native-runtime-benchmark.ts` 和 helper 测试，新增 `native-runtime:benchmark` app 脚本；benchmark 运行时在临时目录生成数据并默认清理，不写真实配置目录；`@codeinsights/electron` 版本从 `0.0.130` 提升到 `0.0.131`，`bun.lock` 已同步。
- 大规模 benchmark 基线：macOS arm64、Bun 1.3.13、records 50000、payload 256 bytes、workspace files 100000、log 500MB、iterations 3。`chat-search-large-history` P50 55.331ms / P95 93.134ms / P99 93.134ms / event loop delay 107.361ms / memory delta 52,150,272 bytes；`agent-runtime-search` P50 39.888ms / P95 52.886ms / P99 52.886ms / event loop delay 52.938ms / memory delta 360,448 bytes；`pipeline-tail-large-records` P50 33.376ms / P95 34.611ms / P99 34.611ms / event loop delay 34.644ms / memory delta 147,456 bytes；`workspace-file-name-search` P50 11.366ms / P95 13.074ms / P99 13.074ms / event loop delay 13.105ms / memory delta 5,881,856 bytes；`large-log-preview` P50 343.660ms / P95 394.817ms / P99 394.817ms / event loop delay 395.802ms / memory delta 251,740,160 bytes。
- Benchmark 清理边界：默认会清理临时合成数据；只有显式传 `--keep-artifacts` 时才会保留系统临时目录中的合成文件，调试后需要手动删除输出中的 artifact 目录。
- 验证通过：`bun test packages/shared/src/types/native-runtime.test.ts`；`bun test apps/electron/src/main/lib/native-runtime`；`bun test apps/electron/scripts/native-runtime-benchmark.test.ts`；`bun run --filter='@codeinsights/shared' typecheck`；`bun run --filter='@codeinsights/electron' typecheck`；`bun run --filter='@codeinsights/electron' build:main`；`bun run --filter='@codeinsights/electron' build:preload`；`bun run --filter='@codeinsights/electron' build:renderer`；`bun run --filter='@codeinsights/electron' native-runtime:benchmark --records 50000 --payload-bytes 256 --workspace-files 100000 --log-bytes 524288000 --iterations 3`；`bun install --frozen-lockfile --dry-run`；`git diff --check`。`build:renderer` 仅有既有大 chunk 警告。
- 边界确认：本阶段未写 Rust / Go，未安装新依赖，未创建 native binary，未新增 optionalDependencies，未修改根 `README.md` / 根 `AGENTS.md`，未重写现有搜索服务或 Pipeline records 读取路径，未 push，未创建 PR。
- 进入 Phase 1 条件：已具备。下一阶段应从 TypeScript fallback 与 EventSearchService 重构开始，复用本阶段 DTO / fixtures / benchmark 基线，继续禁止直接写 Rust / Go。
- 阶段提交：已提交 `987d600e feat(rust-go): 完成 Phase 0 基线契约与 benchmark`。

## 2026-06-01 Rust/Go 最新状态同步计划

范围确认：本轮响应“更新文档最新开发状态、标清完成/未完成、给下次启动提示词，并记住阶段完成后自动同步”的要求。只同步 Rust / Go 文档、下次启动提示词、任务记录和 lessons；不改业务代码，不安装依赖，不修改根 `README.md` / 根 `AGENTS.md`，不 push，不创建 PR。

执行计划：

- [x] 检查当前分支、工作树和最近提交，确认当前真实恢复基线。
- [x] 更新 Rust / Go 开发跟踪清单的最新状态、完成项、未完成项和下次启动入口。
- [x] 新增 `docs/improve/rust-go/next-session-prompt.md`，给下一次 Codex 会话提供可恢复提示词。
- [x] 更新 `tasks/lessons.md`，再次固化“阶段完成后自动同步状态文档和提示词”的习惯。
- [x] 修正上一轮纪律同步任务记录中已完成但未勾选的提交项。
- [x] 运行文档校验：关键状态搜索、行尾空白、code fence、占位词、`git diff --check`。
- [x] 在本节追加 Review，记录同步结果、验证结果、未完成项和实际提交边界。
- [x] 单独提交本轮状态同步。

边界：

- [x] 不修改业务代码。
- [x] 不安装依赖。
- [x] 不修改根 `README.md` / 根 `AGENTS.md`。
- [x] 不 push、不创建 PR。
- [x] 不把未实现的 Rust / Go 功能标记为完成。

### Review

- 启动检查：`git status --short --branch` 显示当前分支 `rust-go-refactor` 且工作树干净；`git log -8 --oneline` 确认最近提交为 `fe34b231 docs(tasks): 固化阶段完成即提交纪律` 和 `8131b66b docs(rust-go): 新增优化方案和开发跟踪清单`。
- Rust / Go checklist 已更新：最新开发基线写为 `8131b66b`，最新已确认恢复入口写为 `fe34b231`；已完成项明确为方案、深化方案、开发跟踪清单、阶段提交纪律和下次启动提示词；未完成项明确为 Phase 0-9 及 NativeRuntime / EventSearchService / Pipeline cursor tail / workspace index / SearchDialog / diagnostics / Rust sidecar / Go supervisor。
- 已新增 `docs/improve/rust-go/next-session-prompt.md`，包含当前真实进度、已完成 / 未完成清单、关键边界和可直接复制给下一次 Codex 的提示词。
- 已更新 `tasks/lessons.md`，补充 Rust / Go 这类新建 `docs/improve/<topic>/` 的阶段化工作首次状态同步时必须补齐 `next-session-prompt.md`，后续每阶段完成后默认同步 checklist、next-session prompt、`tasks/todo.md` Review 和必要 lessons。
- 已修正上一轮“阶段提交习惯固化计划”的未勾选提交项，回填实际提交 `fe34b231 docs(tasks): 固化阶段完成即提交纪律`。
- 验证通过：关键状态 `rg` 搜索；Rust / Go 文档占位词扫描无命中；行尾空白 `awk` 检查；Markdown code fence 成对检查；`git diff --check -- docs/improve/rust-go tasks/todo.md tasks/lessons.md`。
- 边界确认：本轮未修改业务代码，未安装依赖，未修改根 `README.md` / 根 `AGENTS.md`，未 push，未创建 PR，未把任何未实现 Rust / Go 功能标记为完成。
- 阶段提交：已提交 `72bec6bf docs(rust-go): 同步最新开发状态和下次启动提示词`。

## 2026-06-01 阶段提交习惯固化计划

范围确认：本轮响应“提交当前代码变更，并记住每完成一阶段任务就提交一次”的要求。当前工作树启动检查为干净，最近提交为 `8131b66b docs(rust-go): 新增优化方案和开发跟踪清单`；本轮只同步长期协作纪律到 `tasks/lessons.md` 和本任务记录，不改业务代码，不修改根 `README.md` / 根 `AGENTS.md`。

执行计划：

- [x] 检查当前分支、工作树和最近提交，确认是否存在未提交代码变更。
- [x] 更新 `tasks/lessons.md`，把“阶段完成即提交，重启 Codex 会话后也主动检查并延续”的规则写得更明确。
- [x] 运行文档格式校验和 `git diff --check`。
- [x] 单独提交本轮纪律同步，提交信息使用详细中文。
- [x] 在本节追加 Review，记录实际提交、验证结果和当前工作树状态。

边界：

- [x] 不修改业务代码。
- [x] 不安装依赖。
- [x] 不修改根 `README.md` / 根 `AGENTS.md`。
- [x] 不 push、不创建 PR。

### Review

- 启动检查：`git status --short --branch` 显示当前分支 `rust-go-refactor` 且无未提交业务代码；最近提交为 `8131b66b docs(rust-go): 新增优化方案和开发跟踪清单`。
- 本轮同步：已在 `tasks/lessons.md` 中补充“每完成一阶段任务就单独提交、重启 Codex 会话后也主动检查并延续、不把多个完成阶段拖到最后合并提交”的长期规则。
- 边界确认：本轮未修改业务代码，未安装依赖，未修改根 `README.md` / 根 `AGENTS.md`，未 push，未创建 PR。
- 验证通过：`awk` 行尾空白检查；`git diff --check -- tasks/todo.md tasks/lessons.md`。
- 阶段提交：已提交 `fe34b231 docs(tasks): 固化阶段完成即提交纪律`。

## 2026-06-01 Rust/Go 开发跟踪清单生成计划

范围确认：本轮根据已深化的 Rust / Go 优化方案，新增一个可长期跟踪迭代开发进度的清单文档；只修改 `docs/improve/rust-go/` 下的新清单文档和本任务记录，不改业务代码，不安装依赖，不创建 Rust / Go 工程，不修改根 `README.md` / 根 `AGENTS.md`。

执行计划：

- [x] 复查 Rust / Go 优化方案、Pipeline 既有开发清单格式和项目任务管理规则。
- [x] 生成 `docs/improve/rust-go/2026-06-01-rust-go-development-checklist.md`，覆盖状态、使用规则、全局不变量、里程碑、分阶段任务、横向工作流、积压池和下次启动入口。
- [x] 将每个阶段拆成入口条件、契约 / 后端 / 前端 / 测试 / 验证 / 完成定义 / 禁止事项，保证后续可以直接按清单迭代。
- [x] 明确 Rust / Go 引入门槛、TS fallback、feature flag、packaged smoke、安全隐私、版本递增和回滚要求。
- [x] 运行 Markdown 结构、行尾空白、code fence、占位词和 `git diff --check` 校验。
- [x] 在本节追加 Review，记录文档路径、覆盖内容、验证结果和未触达边界。

边界：

- [x] 不修改业务代码。
- [x] 不安装新依赖。
- [x] 不创建 Rust / Go 工程或 native binary。
- [x] 不修改根 `README.md` / 根 `AGENTS.md`。
- [x] 不把清单中的阶段任务描述为已实现功能。

### Review

- 已新增 Rust / Go 优化重构开发跟踪清单：`docs/improve/rust-go/2026-06-01-rust-go-development-checklist.md`，共约 1130 行。
- 清单已覆盖：最新开发状态、当前完成 / 未完成、下次启动入口、使用规则、状态标记、全局不变量、质量门禁、里程碑总览、Phase 0-9、横向工作流、后续积压池、阶段 Review 模板和下一轮启动提示词。
- 阶段拆分已按后续可执行迭代设计：Phase 0 基线 / 契约 / benchmark，Phase 1 TS fallback 与 EventSearchService，Phase 2 Pipeline records cursor / 全局搜索，Phase 3 workspace index，Phase 4 前端状态与 diagnostics，Phase 5 Rust search sidecar，Phase 6 大文件 chunk preview，Phase 7 PathSafety / GitOutputParser，Phase 8 打包 CI 发布，Phase 9 Go supervisor 可选 spike。
- 已明确关键工程门禁：Rust / Go 不能直接进入主线；必须先有 TS fallback、shared DTO / fixtures、benchmark、feature flag、fallback reason、operation model、contract parity、packaged smoke、安全脱敏、cache 可重建和 rollback 策略。
- 已把 Go supervisor 明确为可选 spike，只有 runtime 进程树 / watcher / lifecycle 问题成为高频痛点或用户明确要求时才推进。
- 验证通过：关键章节 `rg` 覆盖检查；`awk` 行尾空白检查；Markdown code fence 成对检查；`TODO|TBD|待补|xxx|FIXME` 扫描无命中；`git diff --check -- tasks/todo.md`；未跟踪清单文档和优化方案文档分别通过 `git diff --check --no-index /dev/null ...`；提交前 `git status --short --branch` 显示仅有 `tasks/todo.md` 修改和 `docs/improve/rust-go/` 未跟踪变更。
- 本轮未修改业务代码，未安装依赖，未创建 Rust / Go 工程或 native binary，未修改根 `README.md` / 根 `AGENTS.md`。清单中的阶段任务均为后续计划，不代表已实现功能。

## 2026-06-01 Rust/Go 优化方案深化计划

范围确认：本轮继续完善 `docs/improve/rust-go/2026-06-01-rust-go-optimization-plan.md`，把现有方向扩展为更细的工程实施规格；只修改该方案文档和本任务记录，不改业务代码，不安装依赖，不修改根 `README.md` / 根 `AGENTS.md`。

执行计划：

- [x] 复查当前 Rust / Go 优化方案、相关工程实践技能和本轮边界。
- [x] 补充工程目标、约束、不变量、决策矩阵和系统分层细节。
- [x] 细化后端 native adapter、sidecar 协议、缓存、JSONL、workspace index、path safety、Git parser、runtime supervisor、错误模型和 observability。
- [x] 细化前端状态、IPC、搜索体验、大文件预览、设置页诊断、BDD 与新增功能验收。
- [x] 补充打包、CI、版本兼容、benchmark、security、rollback、迁移阶段和首个 MVP 切片。
- [x] 运行文档验证：关键章节覆盖、行尾空白、`git diff --check` 和 `git status --short`。
- [x] 在本节追加 Review，记录本轮深化内容、验证结果和未触达边界。

边界：

- [x] 不修改业务代码。
- [x] 不安装新依赖。
- [x] 不创建 Rust / Go 工程。
- [x] 不修改根 `README.md` / 根 `AGENTS.md`。
- [x] 不把方案文档描述为已实现功能。

### Review

- 已复查 Rust / Go 优化方案和相关工程实践技能；本轮继续保持“native 只作为主进程背后的可替换能力层，不迁移 renderer / preload / IPC / Jotai / 业务编排”的核心判断。
- 已将方案文档从 593 行深化到约 1672 行，重点补充：工程目标与强制不变量、成功标准、现有调用链与 native 插入点、决策矩阵、模块分层、`NativeRuntimeService` facade、sidecar transport、sidecar 状态机、cache manifest、EventStore / cursor / append 一致性、workspace index 数据模型、watcher 策略、PathSafety / GitOutputParser 规格、Go supervisor 触发门槛、observability / diagnostics。
- 已补充前端细节：全局 native runtime listener、搜索 UI 状态机、SearchDialog requestId 防旧结果覆盖、大文件预览 chunk viewer、设置页诊断入口、native runtime atoms、索引状态和用户可见 fallback 行为。
- 已补充新增功能与验收：全局本地搜索中心、Pipeline Evidence Index、Workspace Code Intelligence、大文件 / 日志预览器、Native Runtime 诊断与自愈、本地贡献分析器、本地隐私扫描；每类功能都补了 MVP / 增强项 / 边界或 BDD。
- 已补充实施治理：建议 IPC 通道、renderer API、operation model、schema / fixture 策略、错误模型、Phase 0-6 入口条件与完成定义、阶段优先级、回滚策略、扩展 BDD、推荐测试文件布局、benchmark 矩阵、CI 分层、代码审查检查清单、安全与隐私、兼容与版本策略、依赖选择策略、MVP 文件落点和下一轮实施建议。
- 验证通过：关键章节 `rg` 覆盖检查；行尾空白 `awk` 检查；`git diff --check -- tasks/todo.md`；未跟踪方案文档 `git diff --check --no-index /dev/null docs/improve/rust-go/2026-06-01-rust-go-optimization-plan.md`；Markdown code fence 成对检查；`TODO|TBD|待补|xxx|FIXME` 扫描无命中；`git status --short` 确认仅有本任务记录和 `docs/improve/rust-go/` 变更。
- 验证备注：第一次执行 untracked 文档的 `git diff --check --no-index` 时误用了 zsh 只读变量名 `status`，命令失败；已改用 `rc` 重跑并通过。
- 本轮未修改业务代码，未安装依赖，未创建 Rust / Go 工程，未修改根 `README.md` / 根 `AGENTS.md`。当前仍是方案深化文档，不代表 native 功能已经实现。

## 2026-06-01 Rust/Go 优化重构方案文档计划

范围确认：本轮只做当前项目深入探索和 Rust / Go 优化重构方案文档，不改业务代码，不安装依赖，不修改根 `README.md` / 根 `AGENTS.md`。目标是在 `docs/improve/rust-go/` 下生成一篇可执行的优化方案，覆盖前端、后端/主进程、跨语言集成、打包验证和可新增功能。

执行计划：

- [x] 复习 `tasks/lessons.md` 和现有 `docs/improve/` 方案结构，确认文档风格和本轮边界。
- [x] 扫描 monorepo 结构、Electron main/preload/renderer、shared/core/ui 包和现有 runtime 模块，识别性能、可靠性、可维护性热点。
- [x] 并行探索主进程/存储、前端/IPC、跨语言集成路线和既有方案文档结构，汇总子任务结论。
- [x] 评估 Rust / Go / 继续 TypeScript 的适用边界，按收益、风险、迁移成本和开源维护成本排序候选组件。
- [x] 在 `docs/improve/rust-go/` 生成 Rust / Go 优化重构方案文档，包含前后端、新增功能、阶段路线、验证策略和不建议迁移项。
- [x] 运行文档验证：路径存在性、关键章节覆盖、`git diff --check` 和 `git status --short`。
- [x] 在本节追加 Review，记录探索结论、生成文档路径、验证结果和未触达边界。

边界：

- [x] 不修改业务代码。
- [x] 不安装新依赖。
- [x] 不修改根 `README.md` / 根 `AGENTS.md`，如未来需要公开文档同步再单独征求授权。
- [x] 不把方案文档描述为已实现功能。

### Review

- 已复习 `tasks/lessons.md` 和 `docs/improve/` 既有方案结构；本轮沿用“结论摘要 / 当前事实 / 风险 / 分阶段路线 / BDD / 验证计划”的文档风格。
- 已扫描当前仓库结构、Electron main / preload / renderer、`packages/shared`、Agent / Pipeline runtime、JSONL 存储、文件预览、workspace watcher、打包配置和已有 runtime binary 打包策略。
- 并行探索结论已汇总：Rust / Go 不适合整体重写 Electron、renderer、preload、IPC 合约、Jotai 状态和 Agent / Pipeline 业务编排；值得优先评估的是 JSONL / workspace 搜索索引、Pipeline records tail、大文件分片预览、patch-work 路径安全、Git 输出解析和可选 runtime supervisor。
- 已生成方案文档：`docs/improve/rust-go/2026-06-01-rust-go-optimization-plan.md`。文档覆盖后端/主进程、前端体验、新增功能、NativeRuntimeAdapter 目标架构、数据契约、分阶段路线、BDD 验收、验证计划、风险和不建议迁移项。
- 验证通过：`rg -n '结论摘要|当前实现事实|目标架构|后端优化方案|前端优化方案|可新增功能实现|数据契约与 IPC|分阶段路线|BDD 验收场景|验证计划|不建议做的事|最小可交付切片|官方参考' docs/improve/rust-go/2026-06-01-rust-go-optimization-plan.md`；`git diff --check -- tasks/todo.md`；`awk '/[ \t]$/ ...' docs/improve/rust-go/2026-06-01-rust-go-optimization-plan.md tasks/todo.md`；`find docs/improve/rust-go -maxdepth 1 -type f -print`。
- 本轮未修改业务代码，未安装依赖，未修改根 `README.md` / 根 `AGENTS.md`，未创建 Rust / Go 工程或 native binary；当前产物只是优化方案文档。

## 2026-05-30 Pipeline v1 完整客户端验证计划

范围确认：本轮只对已完成的客户端与 Pipeline v1 相关能力做完整本机验证，不改业务代码，不重新实现 Markdown / HTML / PDF 报告导出，不运行真实 GitHub remote smoke，不读取或输出 token，不 push，不创建真实 PR，不修改根 `README.md` / 根 `AGENTS.md`。目标是用仓库现有测试、类型检查、构建、打包和 smoke 脚本确认客户端主功能可运行，并把真实通过 / 失败 / gated 项写入 Review。

验证计划：

- [x] 启动前检查当前分支和工作树，确认没有待提交业务改动。
- [x] 读取根 `package.json`、`apps/electron/package.json` 和 Pipeline v1 checklist，确认可用验证脚本。
- [x] 运行全量 `bun test`，覆盖 shared/core/ui/electron 的单元、主进程、renderer 和 smoke 类测试。
- [x] 运行 `bun run typecheck`，覆盖所有 workspace package TypeScript 类型检查。
- [x] 运行 `bun install --frozen-lockfile --dry-run`，确认锁文件与依赖声明一致。
- [x] 运行 `bun run electron:build`，确认 Electron main / preload / renderer / resources 构建通过。
- [x] 运行 `bun run --filter='@codeinsights/electron' pack`，生成当前平台 unpacked app。
- [x] 运行 `bun run --filter='@codeinsights/electron' smoke:pipeline-fixture`，验证当前平台 unpacked app 的 Pipeline draft-only / local commit 主路径。
- [x] 评估 Agent Codex / opencode / history reload UI smoke 是否可在不读取 token、不触发真实模型或远端副作用的前提下运行；若脚本需要真实凭证或会读取 ambient auth，则记录为 gated，不伪装为已验证。
- [x] 运行 `git diff --check` 和 `git status --short --branch`。
- [x] 在本节追加 Review，记录每条命令结果、失败项、未授权项和客户端可运行结论。
- [x] 同步 Pipeline v1 development checklist、next-session prompt 和 `tasks/lessons.md`，单独提交本轮验证记录。

边界：

- [x] 不 push。
- [x] 不创建真实 PR。
- [x] 不运行真实 GitHub remote smoke。
- [x] 不检查、读取或输出 token。
- [x] 不把 fake runner smoke 说成真实模型验收。
- [x] 不把 unpacked app smoke 说成 DMG / installer 或多平台验收。
- [x] 不修改根 `README.md` / 根 `AGENTS.md`。

### Review

- 启动检查：已读取 `tasks/lessons.md`、Pipeline v1 optimization plan、development checklist 和 `next-session-prompt.md`；`git status --short --branch` 确认当前分支为 `pipeline-improve`，本轮开始时仅有验证阶段改动；`git log -12 --oneline` 已确认包含 `81c72e30`、`ab34910c`、`da6961de`、`f687166c`、`c75e132f`、`b1163b1f` 和 `fb864d6a`。
- 发现并修复：裸 `bun test` 暴露跨文件 mock / module state 污染，同时发现 `packages/shared/src/agent/runtime-events.test.ts` 中 `run_completed` fixture 缺少 `usage` 字段。已将根 `test` 脚本改为 `bun test --isolate`，补齐 fixture，并按规则递增根版本到 `0.1.2`、`@codeinsights/shared` 到 `0.1.57`，同步 `bun.lock`。
- 全量自动化验证通过：`bun run test`，768 pass / 0 fail；`bun run typecheck`，shared / core / ui / electron 全部通过；`bun install --frozen-lockfile --dry-run` 通过；`bun run electron:build` 通过，Vite 仅输出既有大 chunk 警告。
- 当前平台 packaged 验证通过：`bun run --filter='@codeinsights/electron' pack` 生成 macOS arm64 unpacked app；`bun run --filter='@codeinsights/electron' smoke:pipeline-fixture` 通过 draft-only 和 local-commit；`bun run --filter='@codeinsights/electron' smoke:agent-history-reload-ui` 通过 first-open 和 reopen。
- 安全 Agent smoke 通过：`bun run --filter='@codeinsights/electron' smoke:agent-opencode -- --only=binary,server,config,permission,abort,resume,mcp` 通过；未运行 `readonly`、`channel`、`native`、`packaged`，因为这些路径需要真实模型、API key、native auth 或额外 packaged 条件。
- 未运行 / [!]：真实 GitHub remote PR smoke 未授权未验证；未读取或输出 token；未 push；未创建真实 PR；未执行 DMG / installer、macOS x64、Windows x64、Linux packaged smoke；未修改根 `README.md` / 根 `AGENTS.md`。
- 客户端结论：在本机 macOS arm64、当前仓库自动化覆盖范围内，已完成的客户端功能通过测试、类型检查、构建、当前平台 unpacked 打包、Pipeline fixture packaged smoke、Agent 历史恢复 UI smoke 和 opencode 非模型 smoke。该结论不等同于真实 GitHub remote、真实模型、DMG / installer 或多平台验收。
- 验证收尾：已同步 development checklist、next-session prompt、`tasks/lessons.md` 和本节 Review；`git diff --check`、`git status --short --branch` 在提交前复核通过后单独提交。

## 2026-05-30 Pipeline v1 ab34910c 恢复入口校正计划

范围确认：本轮只处理启动检查发现的状态文档偏差，不改业务代码，不重新实现 Markdown / HTML / PDF 报告导出，不运行真实 GitHub remote smoke，不读取或输出 token，不 push，不创建真实 PR，不修改根 `README.md` / 根 `AGENTS.md`。目标是把当前 `git log` 已确认的最新状态同步提交 `ab34910c docs(pipeline): 同步 da6961de 最新开发状态` 写入 Pipeline v1 checklist 和 next-session prompt，并保留 `fb864d6a` 作为 Phase 8 功能开发基线。

执行计划：

- [x] 完成启动检查：读取 `tasks/lessons.md`、Pipeline v1 optimization plan、development checklist 和 `next-session-prompt.md`。
- [x] 运行 `git status --short --branch` 和 `git log -12 --oneline`，确认当前分支 `pipeline-improve`、工作树干净、历史包含 `ab34910c`、`da6961de`、`f687166c`、`c75e132f`、`b1163b1f` 和 `fb864d6a`。
- [x] 更新 `docs/improve/pipeline/v1/2026-05-28-pipeline-mode-development-checklist.md`，把最新已确认恢复入口从 `da6961de` 提升为 `ab34910c`。
- [x] 更新 `docs/improve/pipeline/v1/next-session-prompt.md`，让下一次启动检查包含 `ab34910c`，并继续禁止未授权远端写和根文档修改。
- [x] 更新 `tasks/lessons.md`，补充根 `README.md` / 根 `AGENTS.md` 只有明确授权公开文档同步后才能修改的执行规则。
- [x] 在本节追加 Review，记录本轮校正、验证结果、未完成 gated 项和实际提交边界。
- [x] 运行文档一致性搜索、`git diff --check`、`git status --short`。
- [x] 单独提交本轮状态文档校正。

边界：

- [x] 不 push。
- [x] 不创建真实 PR。
- [x] 不运行真实 GitHub remote smoke。
- [x] 不检查、读取或输出 token。
- [x] 不把 fake runner smoke 说成真实模型验收。
- [x] 不把 unpacked app smoke 说成 DMG / installer 或多平台验收。
- [x] 不修改根 `README.md` / 根 `AGENTS.md`。

### Review

- 启动检查：已读取 `tasks/lessons.md`、Pipeline v1 optimization plan、development checklist 和 `next-session-prompt.md`；`git status --short --branch` 显示当前分支为 `pipeline-improve`，本轮开始时工作树干净且 ahead 32；`git log -12 --oneline` 已确认包含 `ab34910c`、`da6961de`、`f687166c`、`c75e132f`、`b1163b1f` 和 `fb864d6a`。
- 文档校正：已将 development checklist 和 next-session prompt 的最新已确认恢复入口从 `da6961de docs(pipeline): 校正 f687166c 恢复入口状态` 提升为 `ab34910c docs(pipeline): 同步 da6961de 最新开发状态`，同时保留 `fb864d6a` 为 Phase 8 功能开发基线。
- 边界确认：本轮未改业务代码，未重新实现 Markdown / HTML / PDF 报告导出，未运行真实 GitHub remote smoke，未读取或输出 token，未 push，未创建真实 PR，未修改根 `README.md` / 根 `AGENTS.md`。
- 未完成项 / [!]：真实 GitHub remote PR smoke 未授权未验证；DMG / installer、macOS x64、Windows x64、Linux packaged smoke 未在本机验证；根 `README.md` / 根 `AGENTS.md` 仍需用户明确允许后再同步。
- 验证通过：`rg -n 'ab34910c|da6961de|最新已确认恢复入口|当前真实进度|真实 GitHub remote PR smoke|根 \`README.md\`|DMG / installer' docs/improve/pipeline/v1/2026-05-28-pipeline-mode-development-checklist.md docs/improve/pipeline/v1/next-session-prompt.md tasks/todo.md tasks/lessons.md`；`git diff --check -- docs/improve/pipeline/v1 tasks/todo.md tasks/lessons.md`；`git status --short --branch`。
- 阶段提交：本节由本轮状态文档校正提交承载；实际最新 HEAD 在最终回复中给出。

## 2026-05-30 Pipeline v1 da6961de 最新状态同步计划

范围确认：本轮响应用户要求，更新 Pipeline v1 最新开发状态、完成 / 未完成清单和下次启动提示词，并把“每个阶段性任务完成后自动同步状态文档、任务 Review、lessons 和可复制提示词”的习惯再次固化。不改业务代码，不重新实现 Markdown / HTML / PDF 报告导出，不运行真实 GitHub remote smoke，不读取或输出 token，不 push，不创建真实 PR，不修改根 `README.md` / 根 `AGENTS.md`。目标是把当前 `git log` 已确认的最新恢复入口 `da6961de docs(pipeline): 校正 f687166c 恢复入口状态` 写入 Pipeline v1 文档，并给下一次 Codex 启动提供可恢复上下文。

执行计划：

- [x] 运行 `git status --short --branch` 和 `git log -8 --oneline`，确认当前分支、工作树和最新提交。
- [x] 读取 development checklist、next-session prompt、`tasks/todo.md` 和 `tasks/lessons.md` 当前状态同步规则。
- [x] 更新 `docs/improve/pipeline/v1/2026-05-28-pipeline-mode-development-checklist.md`，回填 `da6961de`，标清 Phase 0-8 已完成和 gated 未完成项。
- [x] 更新 `docs/improve/pipeline/v1/next-session-prompt.md`，让下次启动明确检查 `da6961de`，并继续禁止未授权远端写、token 读取、push / PR 和根文档修改。
- [x] 更新 `tasks/lessons.md`，强化用户再次要求“更新文档最新状态 / 标注完成未完成 / 给下次启动提示词”时仍要执行完整闭环。
- [x] 在本节追加 Review，记录本轮同步、验证结果、未完成项和实际提交边界。
- [x] 运行文档一致性搜索、`git diff --check`、`git status --short`。
- [x] 单独提交本轮状态文档同步。

边界：

- [x] 不 push。
- [x] 不创建真实 PR。
- [x] 不运行真实 GitHub remote smoke。
- [x] 不检查、读取或输出 token。
- [x] 不把 fake runner smoke 说成真实模型验收。
- [x] 不把 unpacked app smoke 说成 DMG / installer 或多平台验收。
- [x] 不修改根 `README.md` / 根 `AGENTS.md`。

### Review

- 最新状态：Phase 0-8 已完成；最新开发基线仍为 `fb864d6a feat(pipeline): 完成 Pipeline v1 Phase 8 报告 HTML 与 PDF 导出`；本轮已把最新已确认恢复入口回填为 `da6961de docs(pipeline): 校正 f687166c 恢复入口状态`。
- 已完成项：Pipeline v1 优化方案、开发跟踪清单、Phase 0 清理与对齐、Phase 1 Preflight 主路径、Phase 2 PipelineView 拆分、Phase 3 Patch-work Document Workbench、Phase 4 Contribution Dashboard 与 Submission Plan、Phase 5 远端写确认与 GitHub 增强、Phase 6 本地 E2E / packaged fixture smoke、Phase 7 Markdown 报告导出、Phase 8 HTML / PDF 报告导出均已完成并有阶段提交。
- 未完成项 / [!]：真实 GitHub remote PR smoke 未授权未验证；DMG / installer、macOS x64、Windows x64、Linux packaged smoke 未在本机验证；根 `README.md` / 根 `AGENTS.md` 仍需用户明确允许后再同步。
- 本轮同步：已更新 development checklist、next-session prompt、`tasks/lessons.md` 和本节任务记录；未改业务代码，未重新实现报告导出，未进入真实远端写或凭证路径。
- 习惯加固：已在 `tasks/lessons.md` 补充“用户再次提出同一状态同步要求时，也必须新建计划、同步文档、写 Review、验证并提交”的执行规则。
- 验证通过：`rg -n 'da6961de|f687166c|最新已确认恢复入口|当前真实进度|真实 GitHub remote PR smoke|根 \`README.md\`|DMG / installer' docs/improve/pipeline/v1/2026-05-28-pipeline-mode-development-checklist.md docs/improve/pipeline/v1/next-session-prompt.md tasks/todo.md tasks/lessons.md`；`git diff --check -- docs/improve/pipeline/v1 tasks/todo.md tasks/lessons.md`；`git status --short --branch`。
- 阶段提交：本节由本轮状态文档同步提交承载；实际最新 HEAD 在最终回复中给出。

## 2026-05-30 Pipeline v1 f687166c 恢复入口校正计划

范围确认：本轮只处理启动检查发现的状态文档偏差，不改业务代码，不重新实现 Markdown / HTML / PDF 报告导出，不运行真实 GitHub remote smoke，不读取或输出 token，不 push，不创建真实 PR，不修改根 `README.md` / 根 `AGENTS.md`。目标是把当前 `git log` 已确认的最新状态同步提交 `f687166c docs(pipeline): 同步 c75e132f 最新开发状态` 写入 Pipeline v1 checklist 和 next-session prompt，并保留 `fb864d6a` 作为 Phase 8 功能开发基线。

执行计划：

- [x] 完成启动检查：读取 `tasks/lessons.md`、Pipeline v1 optimization plan、development checklist 和 `next-session-prompt.md`。
- [x] 运行 `git status --short --branch` 和 `git log -12 --oneline`，确认当前分支 `pipeline-improve`、工作树干净、历史包含 `f687166c`、`c75e132f`、`b1163b1f` 和 `fb864d6a`。
- [x] 更新 `docs/improve/pipeline/v1/2026-05-28-pipeline-mode-development-checklist.md`，把最新已确认恢复入口从 `c75e132f` 提升为 `f687166c`。
- [x] 更新 `docs/improve/pipeline/v1/next-session-prompt.md`，让下一次启动检查包含 `f687166c`，并继续禁止未授权远端写和根文档修改。
- [x] 更新 `tasks/lessons.md`，记录启动检查发现“用户给出的最新状态同步提交已经在 HEAD，但文档仍指向上一恢复入口”时的校正规则。
- [x] 在本节追加 Review，记录本轮校正、验证结果、未完成 gated 项和实际提交边界。
- [x] 运行文档一致性搜索、`git diff --check`、`git status --short`。
- [x] 单独提交本轮状态文档校正。

边界：

- [x] 不 push。
- [x] 不创建真实 PR。
- [x] 不运行真实 GitHub remote smoke。
- [x] 不检查、读取或输出 token。
- [x] 不把 fake runner smoke 说成真实模型验收。
- [x] 不把 unpacked app smoke 说成 DMG / installer 或多平台验收。
- [x] 不修改根 `README.md` / 根 `AGENTS.md`。

### Review

- 启动检查：已读取 `tasks/lessons.md`、Pipeline v1 optimization plan、development checklist 和 `next-session-prompt.md`；`git status --short --branch` 显示当前分支为 `pipeline-improve`，本轮开始时工作树干净且 ahead 30；`git log -12 --oneline` 已确认包含 `f687166c`、`c75e132f`、`b1163b1f` 和 `fb864d6a`。
- 文档校正：已将 development checklist 和 next-session prompt 的最新已确认恢复入口从 `c75e132f docs(pipeline): 校正 b1163b1f 恢复入口状态` 提升为 `f687166c docs(pipeline): 同步 c75e132f 最新开发状态`，同时保留 `fb864d6a` 为 Phase 8 功能开发基线。
- 边界确认：本轮未改业务代码，未重新实现 Markdown / HTML / PDF 报告导出，未运行真实 GitHub remote smoke，未读取或输出 token，未 push，未创建真实 PR，未修改根 `README.md` / 根 `AGENTS.md`。
- 未完成项 / [!]：真实 GitHub remote PR smoke 未授权未验证；DMG / installer、macOS x64、Windows x64、Linux packaged smoke 未在本机验证；根 `README.md` / 根 `AGENTS.md` 仍需用户明确允许后再同步。
- 验证通过：`rg -n 'f687166c|最新已确认恢复入口|当前真实进度|真实 GitHub remote PR smoke|根 \`README.md\`|DMG / installer' docs/improve/pipeline/v1/2026-05-28-pipeline-mode-development-checklist.md docs/improve/pipeline/v1/next-session-prompt.md tasks/todo.md tasks/lessons.md`；`git diff --check -- docs/improve/pipeline/v1 tasks/todo.md tasks/lessons.md`；`git status --short --branch`。
- 阶段提交：本节由本轮状态文档校正提交承载；实际最新 HEAD 在最终回复中给出。

## 2026-05-30 Pipeline v1 c75e132f 最新状态同步计划

范围确认：本轮响应用户要求，更新 Pipeline v1 最新开发状态、完成 / 未完成清单和下次启动提示词，并把“阶段完成后自动同步状态文档和提示词”的习惯再次固化。不改业务代码，不重新实现 Markdown / HTML / PDF 报告导出，不运行真实 GitHub remote smoke，不读取或输出 token，不 push，不创建真实 PR，不修改根 `README.md` / 根 `AGENTS.md`。目标是把当前 `git log` 已确认的最新恢复入口 `c75e132f docs(pipeline): 校正 b1163b1f 恢复入口状态` 写入 Pipeline v1 文档，并给下一次 Codex 启动提供可恢复上下文。

执行计划：

- [x] 运行 `git status --short --branch` 和 `git log -8 --oneline`，确认当前分支、工作树和最新提交。
- [x] 读取 development checklist、next-session prompt 和 `tasks/lessons.md` 当前状态同步规则。
- [x] 更新 `docs/improve/pipeline/v1/2026-05-28-pipeline-mode-development-checklist.md`，回填 `c75e132f`，标清 Phase 0-8 已完成和 gated 未完成项。
- [x] 更新 `docs/improve/pipeline/v1/next-session-prompt.md`，让下次启动明确检查 `c75e132f`，并继续禁止未授权远端写、token 读取、push / PR 和根文档修改。
- [x] 更新 `tasks/lessons.md`，强化每个阶段性任务完成后自动同步状态文档、任务 Review 和可复制提示词的默认动作。
- [x] 在本节追加 Review，记录本轮同步、验证结果、未完成项和实际提交边界。
- [x] 运行文档一致性搜索、`git diff --check`、`git status --short`。
- [x] 单独提交本轮状态文档同步。

边界：

- [x] 不 push。
- [x] 不创建真实 PR。
- [x] 不运行真实 GitHub remote smoke。
- [x] 不检查、读取或输出 token。
- [x] 不把 fake runner smoke 说成真实模型验收。
- [x] 不把 unpacked app smoke 说成 DMG / installer 或多平台验收。
- [x] 不修改根 `README.md` / 根 `AGENTS.md`。

### Review

- 最新状态：Phase 0-8 已完成；最新开发基线仍为 `fb864d6a feat(pipeline): 完成 Pipeline v1 Phase 8 报告 HTML 与 PDF 导出`；本轮已把最新已确认恢复入口回填为 `c75e132f docs(pipeline): 校正 b1163b1f 恢复入口状态`。
- 已完成项：Pipeline v1 优化方案、开发跟踪清单、Phase 0 清理与对齐、Phase 1 Preflight 主路径、Phase 2 PipelineView 拆分、Phase 3 Patch-work Document Workbench、Phase 4 Contribution Dashboard 与 Submission Plan、Phase 5 远端写确认与 GitHub 增强、Phase 6 本地 E2E / packaged fixture smoke、Phase 7 Markdown 报告导出、Phase 8 HTML / PDF 报告导出均已完成并有阶段提交。
- 未完成项 / [!]：真实 GitHub remote PR smoke 未授权未验证；DMG / installer、macOS x64、Windows x64、Linux packaged smoke 未在本机验证；根 `README.md` / 根 `AGENTS.md` 仍需用户明确允许后再同步。
- 本轮同步：已更新 development checklist、next-session prompt、`tasks/lessons.md` 和本节任务记录；未改业务代码，未重新实现报告导出，未进入真实远端写或凭证路径。
- 习惯加固：已在 `tasks/lessons.md` 补充用户要求“更新文档最新状态 / 标注完成未完成 / 给下次启动提示词”时必须执行完整状态同步闭环。
- 验证通过：`rg -n 'c75e132f|b1163b1f|最新已确认恢复入口|当前未完成的关键能力|当前真实进度|真实 GitHub remote PR smoke|根 \`README.md\`|DMG / installer' docs/improve/pipeline/v1/2026-05-28-pipeline-mode-development-checklist.md docs/improve/pipeline/v1/next-session-prompt.md tasks/todo.md tasks/lessons.md`；`git diff --check -- docs/improve/pipeline/v1 tasks/todo.md tasks/lessons.md`；`git status --short --branch`。
- 阶段提交：本节由本轮状态文档同步提交承载；实际最新 HEAD 在最终回复中给出。

## 2026-05-30 Pipeline v1 b1163b1f 恢复入口校正计划

范围确认：本轮只处理启动检查发现的状态文档偏差，不改业务代码，不重新实现 Markdown / HTML / PDF 报告导出，不运行真实 GitHub remote smoke，不读取或输出 token，不 push，不创建真实 PR，不修改根 `README.md` / 根 `AGENTS.md`。目标是把当前 `git log` 已确认的最新状态同步提交 `b1163b1f docs(pipeline): 同步最新开发状态和下次启动提示词` 写入 Pipeline v1 checklist 和 next-session prompt，并保留 `fb864d6a` 作为 Phase 8 功能开发基线。

执行计划：

- [x] 完成启动检查：读取 `tasks/lessons.md`、Pipeline v1 optimization plan、development checklist 和 `next-session-prompt.md`。
- [x] 运行 `git status --short --branch` 和 `git log -12 --oneline`，确认当前分支 `pipeline-improve`、工作树干净、历史包含 `b1163b1f` / `e77139fd` / `7d309cc0` / `c79f6b48` / `fb864d6a`。
- [x] 更新 `docs/improve/pipeline/v1/2026-05-28-pipeline-mode-development-checklist.md`，把最新已确认恢复入口从 `e77139fd` 提升为 `b1163b1f`。
- [x] 更新 `docs/improve/pipeline/v1/next-session-prompt.md`，让下一次启动检查包含 `b1163b1f`，并继续禁止未授权远端写和根文档修改。
- [x] 更新 `tasks/lessons.md`，记录启动检查发现“HEAD 已是新状态同步提交但文档仍指向上一恢复入口”时的校正规则。
- [x] 在本节追加 Review，记录本轮校正、验证结果、未完成 gated 项和实际提交边界。
- [x] 运行文档一致性搜索、`git diff --check`、`git status --short`。
- [x] 单独提交本轮状态文档校正。

边界：

- [x] 不 push。
- [x] 不创建真实 PR。
- [x] 不运行真实 GitHub remote smoke。
- [x] 不检查、读取或输出 token。
- [x] 不把 fake runner smoke 说成真实模型验收。
- [x] 不把 unpacked app smoke 说成 DMG / installer 或多平台验收。
- [x] 不修改根 `README.md` / 根 `AGENTS.md`。

### Review

- 启动检查：已读取 `tasks/lessons.md`、Pipeline v1 optimization plan、development checklist 和 `next-session-prompt.md`；`git status --short --branch` 显示当前分支为 `pipeline-improve`，工作树干净且 ahead 28；`git log -12 --oneline` 已确认包含 `b1163b1f`、`e77139fd`、`7d309cc0`、`c79f6b48` 和 `fb864d6a`。
- 文档校正：已将 development checklist 和 next-session prompt 的最新已确认恢复入口从 `e77139fd docs(pipeline): 校正 Phase 8 最新恢复入口` 提升为 `b1163b1f docs(pipeline): 同步最新开发状态和下次启动提示词`，同时保留 `fb864d6a` 为 Phase 8 功能开发基线。
- 边界确认：本轮未改业务代码，未重新实现 Markdown / HTML / PDF 报告导出，未运行真实 GitHub remote smoke，未读取或输出 token，未 push，未创建真实 PR，未修改根 `README.md` / 根 `AGENTS.md`。
- 未完成项 / [!]：真实 GitHub remote PR smoke 未授权未验证；DMG / installer、macOS x64、Windows x64、Linux packaged smoke 未在本机验证；根 `README.md` / 根 `AGENTS.md` 仍需用户明确允许后再同步。
- 验证通过：`rg -n 'b1163b1f|e77139fd|7d309cc0|最新已确认恢复入口|最新状态同步提交|当前真实进度' docs/improve/pipeline/v1/2026-05-28-pipeline-mode-development-checklist.md docs/improve/pipeline/v1/next-session-prompt.md tasks/todo.md tasks/lessons.md`；`git diff --check -- docs/improve/pipeline/v1 tasks/todo.md tasks/lessons.md`；`git status --short --branch`。
- 阶段提交：本节由本轮状态文档校正提交承载；实际最新 HEAD 在最终回复中给出。

## 2026-05-30 Pipeline v1 最新开发状态同步计划

范围确认：本轮只做用户要求的状态文档同步和长期习惯加固，不改业务代码，不重新实现 Markdown / HTML / PDF 报告导出，不运行真实 GitHub remote smoke，不读取或输出 token，不 push，不创建真实 PR，不修改根 `README.md` / 根 `AGENTS.md`。目标是把 `e77139fd docs(pipeline): 校正 Phase 8 最新恢复入口` 写入 Pipeline v1 文档，标清 Phase 0-8 已完成、gated 未完成项和下次启动入口，并给用户一份可直接复制的下次启动提示词。

执行计划：

- [x] 读取当前 development checklist、next-session prompt、`tasks/todo.md` 和 `tasks/lessons.md` 的状态同步规则。
- [x] 运行 `git status --short --branch` 和 `git log -8 --oneline`，确认最新 HEAD 和工作树状态。
- [x] 更新 `docs/improve/pipeline/v1/2026-05-28-pipeline-mode-development-checklist.md`，回填 `e77139fd`，明确已完成 / 未完成 / gated 项。
- [x] 更新 `docs/improve/pipeline/v1/next-session-prompt.md`，让下次启动从 `e77139fd` 或本轮后续状态同步提交恢复。
- [x] 更新 `tasks/lessons.md`，强化“每个阶段性任务完成后自动同步状态文档和提示词”的默认习惯。
- [x] 在本节追加 Review，记录本轮同步、验证结果和未完成项。
- [x] 运行文档一致性搜索、`git diff --check` 和 `git status --short`。
- [x] 单独提交本轮状态文档同步。

边界：

- [x] 不 push。
- [x] 不创建真实 PR。
- [x] 不运行真实 GitHub remote smoke。
- [x] 不检查、读取或输出 token。
- [x] 不把 fake runner smoke 说成真实模型验收。
- [x] 不把 unpacked app smoke 说成 DMG / installer 或多平台验收。
- [x] 不修改根 `README.md` / 根 `AGENTS.md`。

### Review

- 最新状态：Phase 0-8 已完成；最新开发基线仍为 `fb864d6a feat(pipeline): 完成 Pipeline v1 Phase 8 报告 HTML 与 PDF 导出`；本轮已把最新已确认恢复入口回填为 `e77139fd docs(pipeline): 校正 Phase 8 最新恢复入口`。
- 已完成项：Pipeline v1 优化方案、开发跟踪清单、Phase 0 清理与对齐、Phase 1 Preflight 主路径、Phase 2 PipelineView 拆分、Phase 3 Patch-work Document Workbench、Phase 4 Contribution Dashboard 与 Submission Plan、Phase 5 远端写确认与 GitHub 增强、Phase 6 本地 E2E / packaged fixture smoke、Phase 7 Markdown 报告导出、Phase 8 HTML / PDF 报告导出均已完成并有阶段提交。
- 未完成项 / [!]：真实 GitHub remote PR smoke 未授权未验证；DMG / installer、macOS x64、Windows x64、Linux packaged smoke 未在本机验证；根 `README.md` / 根 `AGENTS.md` 仍需用户明确允许后再同步。
- 本轮同步：已更新 development checklist、next-session prompt、`tasks/lessons.md` 和本节任务记录；未改业务代码，未重新实现报告导出，未进入真实远端写或凭证路径。
- 习惯加固：已在 `tasks/lessons.md` 补充用户再次要求“更新文档最新状态 / 标注完成未完成 / 给下次启动提示词”时的默认收尾规则，后续阶段完成后自动执行。
- 验证通过：精确搜索未发现“最新已确认恢复入口 = 7d309cc0”的残留；`rg -n 'e77139fd|7d309cc0|最新已确认恢复入口|当前未完成的关键能力|当前真实进度' docs/improve/pipeline/v1/2026-05-28-pipeline-mode-development-checklist.md docs/improve/pipeline/v1/next-session-prompt.md tasks/todo.md tasks/lessons.md` 确认新旧恢复入口语义正确；`git diff --check -- docs/improve/pipeline/v1 tasks/todo.md tasks/lessons.md` 通过。
- 阶段提交：本节由本轮状态文档同步提交承载；实际最新 HEAD 在最终回复中给出。

## 2026-05-30 Pipeline v1 Phase 8 最新恢复入口校正计划

范围确认：本轮只做启动检查后的状态文档校正，不改业务代码，不重新实现 Markdown / HTML / PDF 报告导出，不运行真实 GitHub remote smoke，不读取或输出 token，不 push，不创建真实 PR，不修改根 `README.md` / 根 `AGENTS.md`。目标是把 `7d309cc0 docs(pipeline): 回填 Phase 8 最新恢复状态` 明确写入 Pipeline v1 checklist 和 next-session prompt，避免下次启动仍把 `c79f6b48` 当作最新恢复入口。

执行计划：

- [x] 读取 `tasks/lessons.md`、Pipeline v1 optimization plan、development checklist 和 `next-session-prompt.md`。
- [x] 运行 `git status --short --branch` 和 `git log -12 --oneline`，确认当前分支、工作树和最近历史。
- [x] 更新 `docs/improve/pipeline/v1/2026-05-28-pipeline-mode-development-checklist.md`，回填 `7d309cc0`，标明 Phase 0-8 已完成和 gated 未完成项。
- [x] 更新 `docs/improve/pipeline/v1/next-session-prompt.md`，让下次启动明确检查 `7d309cc0`，并继续禁止未授权远端写和根文档修改。
- [x] 在本节追加 Review，记录启动检查结果、文档校正、验证命令和未完成项。
- [x] 运行文档一致性搜索、`git diff --check`、`git status --short`。
- [x] 单独提交本轮状态文档校正。

边界：

- [x] 不 push。
- [x] 不创建真实 PR。
- [x] 不运行真实 GitHub remote smoke。
- [x] 不检查、读取或输出 token。
- [x] 不把 fake runner smoke 说成真实模型验收。
- [x] 不把 unpacked app smoke 说成 DMG / installer 或多平台验收。
- [x] 不修改根 `README.md` / 根 `AGENTS.md`。

### Review

- 启动检查：已读取 `tasks/lessons.md`、Pipeline v1 optimization plan、development checklist 和 `next-session-prompt.md`；`git status --short --branch` 显示当前分支为 `pipeline-improve`，本轮开始时工作树干净且 ahead 26；`git log -12 --oneline` 已确认包含 `7d309cc0`、`c79f6b48`、`fb864d6a` 和 `b4ed7b1e`。
- 文档校正：已将 development checklist 和 next-session prompt 的最新已确认恢复入口从 `c79f6b48` 校正为 `7d309cc0 docs(pipeline): 回填 Phase 8 最新恢复状态`，同时保留 `c79f6b48` 作为 Phase 8 后续状态同步提交记录。
- 边界确认：本轮未改业务代码，未重新实现 Markdown / HTML / PDF 报告导出，未运行真实 GitHub remote smoke，未读取或输出 token，未 push，未创建真实 PR，未修改根 `README.md` / 根 `AGENTS.md`。
- 验证通过：精确陈旧入口搜索无命中；`rg -n '7d309cc0|c79f6b48' docs/improve/pipeline/v1/2026-05-28-pipeline-mode-development-checklist.md docs/improve/pipeline/v1/next-session-prompt.md tasks/todo.md` 显示 `7d309cc0` 已进入启动检查和最新恢复入口；`git diff --check -- docs/improve/pipeline/v1 tasks/todo.md` 通过。
- 未完成项 / [!]：真实 GitHub remote PR smoke 未授权未验证；DMG / installer、macOS x64、Windows x64、Linux packaged smoke 未在本机验证；根 `README.md` / 根 `AGENTS.md` 仍需用户明确允许后再同步。
- 阶段提交：本节由本轮状态文档校正提交承载；实际最新 HEAD 在最终回复中给出。

## 2026-05-30 Pipeline v1 Phase 8 Report Export HTML / PDF 增强计划

范围确认：本轮从后续积压池单独开启 Phase 8。目标是在 Phase 7 Markdown MVP 之上，新增 Pipeline 贡献报告的 HTML 产物和 PDF 保存路径。实现必须继续复用只读 ContributionTask、events、Pipeline records、stage artifacts 和 patch-work manifest，不触发 graph、不执行 Git precondition、不读取 token、不执行真实远端写、不 push、不创建真实 PR，不修改根 `README.md` / 根 `AGENTS.md`。

启动检查：

- [x] 读取 `tasks/lessons.md`，重点复核阶段完成即提交、状态同步、Report Export 只读脱敏、真实远端写 gated 和根文档授权规则。
- [x] 读取 Pipeline v1 optimization plan、development checklist 和 `next-session-prompt.md`。
- [x] 运行 `git status --short --branch` 和 `git log -12 --oneline`，确认当前分支为 `pipeline-improve`，最近历史包含 `b4ed7b1e`、`1cbe1de7`、`70b30ea3`、`d007eb84`、`d71e13af`、`07243a01` 和 `a6c558b1`。
- [x] 确认真实 GitHub remote smoke、根公开文档同步均未获得明确授权，本轮不进入这些路径。

BDD 验收场景：

- [x] Given 一个已完成 Pipeline 会话，When 用户生成报告，Then 返回 Markdown 和同源 HTML，HTML 包含任务、仓库、阶段摘要、Patch-set、提交 / PR、patch-work 和审计信息。
- [x] Given 报告正文、会话标题、URL 或错误中出现 token、Authorization header、Bearer 或 credentialed URL，When 生成 Markdown / HTML / 文件名，Then 所有格式都脱敏且 HTML 不执行未转义内容。
- [x] Given 用户点击保存 HTML，When 报告已生成，Then UI 下载 `.html` 文件，文件名稳定且按钮状态可见。
- [x] Given 用户点击保存 PDF，When 报告已生成，Then Renderer 通过受控 preload IPC 请求 main 端用同一 session 重新生成报告并保存 PDF；Renderer 不传任意本地路径或任意 HTML。
- [x] Given 用户取消 PDF 保存对话框或 PDF 生成失败，When 操作结束，Then UI 显示已取消 / 保存失败，不影响已生成 Markdown / HTML 预览。
- [x] Given 当前工作树有未持久化变更或 fake `git` marker，When 生成 HTML / PDF，Then 不调用 Git read model，不把当前工作树误写进报告。

TDD 执行计划：

- [x] 先更新 shared 类型测试覆盖路径：`PipelineReportExport` 增加 HTML / format 文件名字段，新增 PDF 保存输入 / 结果契约。
- [x] 先补 main read model 测试：`pipeline-read-model-service.test.ts` 覆盖 HTML 产物结构、脱敏、HTML escaping、fake `git` 不被调用。
- [x] 先补 service / IPC 边界测试：`pipeline-service.test.ts` 覆盖 export 返回 HTML，PDF 保存只接受 `sessionId` / format，不接受 renderer 任意路径或任意 HTML。
- [x] 先补 Renderer view model 测试：`PipelineReportExportPanel.test.tsx` 覆盖 Markdown / HTML / PDF 按钮 label、disabled、saving / canceled / failed 状态。
- [x] 确认新增测试失败点来自缺少 Phase 8 能力后再实现。
- [x] 实现 shared 契约：新增报告格式、HTML 文件名和 PDF 保存 input/result，不破坏旧 Markdown 字段。
- [x] 实现 read model：从现有 Markdown 只读事实源生成安全、可打印 HTML，统一脱敏；不引入远端、Git 或 token 读取。
- [x] 实现 main 保存路径：Markdown / HTML 继续可本地下载；PDF 由 main 端按 `sessionId` 重新生成 HTML 后使用 Electron `printToPDF` 输出，取消保存返回结构化结果。
- [x] 实现 preload API 和 Renderer UI：新增保存 HTML、保存 PDF 操作，按钮用图标并保持 compact 布局。
- [x] 递增受影响 package patch version，并同步 `bun.lock`。
- [x] 运行聚焦测试、Electron typecheck、`bun install --frozen-lockfile --dry-run`、`git diff --check`。
- [x] Phase 8 完成后同步 development checklist、next-session prompt、本节 Review 和 lessons，并单独提交状态更新。

触达边界：

- [x] 允许触达：`packages/shared/src/types/pipeline.ts`、`packages/shared/package.json`、`apps/electron/package.json`、`bun.lock`、`apps/electron/src/main/lib/pipeline-read-model-service.ts`、`apps/electron/src/main/lib/pipeline-service.ts`、`apps/electron/src/main/ipc/pipeline-handlers.ts`、`apps/electron/src/preload/index.ts`、`PipelineReportExportPanel.tsx` 和对应测试、`docs/improve/pipeline/v1`、`tasks/todo.md`、`tasks/lessons.md`。
- [x] 谨慎触达：`PipelineView.tsx` 只在入口布局确有必要时调整；本轮未触达。
- [x] 不触达：根 `README.md`、根 `AGENTS.md`、Claude / Codex runner、Graph 流程、真实 Git submission 写逻辑、真实远端仓库、`patch-work/**`。

验证命令计划：

```bash
bun test apps/electron/src/main/lib/pipeline-read-model-service.test.ts apps/electron/src/main/lib/pipeline-service.test.ts
```

```bash
bun test apps/electron/src/renderer/components/pipeline/PipelineReportExportPanel.test.tsx apps/electron/src/renderer/components/pipeline/ContributionTaskDashboard.test.tsx
```

```bash
bun run --filter='@codeinsights/electron' typecheck
bun install --frozen-lockfile --dry-run
git diff --check -- packages/shared apps/electron bun.lock tasks/todo.md docs/improve/pipeline/v1
```

阶段边界：

- [x] 不把 fake runner smoke 说成真实模型验收。
- [x] 不把 unpacked app smoke 说成 DMG / installer 或多平台验收。
- [x] 不读取 token，不输出 token，不检查 GitHub 凭证。
- [x] 不 push，不创建真实 PR。
- [x] 根 `README.md` / 根 `AGENTS.md` 仍需用户明确允许后才修改。

## 2026-05-30 Pipeline v1 Phase 8 Report Export HTML / PDF 增强 Review

- 阶段范围：本轮只完成 Report Export HTML / PDF 增强；未重新实现 Markdown MVP，未执行真实 GitHub remote smoke，未 push，未创建真实 PR，未读取或输出 token，未修改根 `README.md` / 根 `AGENTS.md`。
- 主要变更：`PipelineReportExport` 新增 `html`、`htmlFileName`、`pdfFileName`；新增 `PipelineReportPdfSaveInput` / `PipelineReportPdfSaveResult` 和 `SAVE_REPORT_PDF` IPC；Renderer 新增保存 `.html` 和保存 PDF 操作。
- Read model 边界：HTML 从同一份只读 Markdown 报告派生，报告事实源仍限于 ContributionTask、events、records、stage artifacts 和 patch-work manifest；不触发 graph、Git precondition、远端写或凭证读取。
- PDF 边界：Renderer 只传 `sessionId`；main 端重新生成报告后通过 Electron `printToPDF` 保存，保存对话框取消返回结构化结果，不信任 Renderer 传入任意 HTML 或本地路径。
- 安全确认：HTML 输出转义用户 / 模型内容并中和 `on*=` 片段；PDF 渲染窗口关闭 nodeIntegration / webview / JavaScript，阻断导航和 http / https / file / ftp / ws / wss 子资源；报告脱敏覆盖 Markdown、HTML、title、`.md` / `.html` / `.pdf` 文件名、Authorization、短 Bearer token、JWT-like token 和 credentialed URL。
- Code review 阻断修复：已修复短 Bearer token 因长度门槛泄露的问题；已修复 `appendPatchWorkSummary()` 读取缺失 patch-work 时可能创建目录的问题，`readPatchWorkManifest()` 增加只读 `create:false` 路径，并补回归测试。
- 验证通过：`bun test apps/electron/src/main/lib/pipeline-read-model-service.test.ts apps/electron/src/main/lib/pipeline-service.test.ts`，64 pass；`bun test apps/electron/src/main/lib/pipeline-patch-work-service.test.ts`，25 pass；`bun test apps/electron/src/renderer/components/pipeline/PipelineReportExportPanel.test.tsx apps/electron/src/renderer/components/pipeline/ContributionTaskDashboard.test.tsx`，6 pass。
- 验证通过：`bun run --filter='@codeinsights/electron' typecheck`；`bun install --frozen-lockfile --dry-run`；`bun run --filter='@codeinsights/electron' build:main`；`bun run --filter='@codeinsights/electron' build:preload`；`bun run --filter='@codeinsights/electron' build:renderer`；`git diff --check -- packages/shared apps/electron bun.lock tasks/todo.md docs/improve/pipeline/v1`。
- 版本同步：`@codeinsights/shared` 提升到 `0.1.56`，`@codeinsights/electron` 提升到 `0.0.130`，`bun.lock` 已同步。
- 未完成项 / [!]：真实 GitHub remote PR smoke 未授权未验证；DMG / installer、macOS x64、Windows x64、Linux packaged smoke 未在本机验证；根 `README.md` / 根 `AGENTS.md` 仍需用户明确允许后再同步。
- 阶段提交：`fb864d6a feat(pipeline): 完成 Pipeline v1 Phase 8 报告 HTML 与 PDF 导出`。
- 状态同步提交：`c79f6b48 docs(pipeline): 同步 Phase 8 后续开发状态`；恢复入口回填提交：`7d309cc0 docs(pipeline): 回填 Phase 8 最新恢复状态`。

## 2026-05-30 Pipeline v1 Phase 7 最新恢复入口回填计划

范围确认：本轮只做文档状态回填和长期习惯加固，不改业务代码。目标是把 `1cbe1de7 docs(pipeline): 同步 Phase 7 后续开发状态` 固化为最新已确认恢复入口，标清 Phase 0-7 已完成、未完成项和下一轮入口，并给用户一份可直接复制的下次启动提示词。

执行计划：

- [x] 读取 `tasks/lessons.md`、Pipeline v1 optimization plan、development checklist 和 `next-session-prompt.md`。
- [x] 运行 `git status --short --branch` 和 `git log -12 --oneline`，确认当前分支、最新提交和未提交状态。
- [x] 更新 `docs/improve/pipeline/v1/2026-05-28-pipeline-mode-development-checklist.md`，回填 `1cbe1de7`，标明完成 / 未完成 / 下一轮入口。
- [x] 更新 `docs/improve/pipeline/v1/next-session-prompt.md`，让下次启动明确从 `1cbe1de7` 或其后的状态同步提交恢复。
- [x] 更新 `tasks/lessons.md`，补充“状态同步提交落地后仍要回填真实同步提交号”的默认收尾习惯。
- [x] 在本节追加 Review，并运行陈旧入口搜索与 `git diff --check`。
- [x] 单独提交本轮状态同步文档。

边界：

- [x] 不 push。
- [x] 不创建真实 PR。
- [x] 不运行真实 GitHub remote smoke。
- [x] 不检查、读取或输出 token。
- [x] 不修改根 `README.md` / 根 `AGENTS.md`。

### Review

- 完成状态：Phase 0-7 已完成；最新开发基线为 `70b30ea3 feat(pipeline): 完成 Pipeline v1 Phase 7 报告导出 MVP`；最新已确认恢复入口已回填为 `1cbe1de7 docs(pipeline): 同步 Phase 7 后续开发状态`。
- 未完成项 / [!]：真实 GitHub remote PR smoke 未授权未验证；DMG / installer、macOS x64、Windows x64、Linux packaged smoke 未在本机验证；Report Export HTML / PDF 仍为后续增强；根 `README.md` / 根 `AGENTS.md` 仍需用户明确允许后再同步。
- 本轮同步：已更新 development checklist、next-session prompt、`tasks/lessons.md` 和本节任务记录；未改业务代码。
- 验证：陈旧入口搜索通过；`git diff --check -- docs/improve/pipeline/v1 tasks/todo.md tasks/lessons.md` 通过。
- 阶段提交：本节由当前状态同步提交承载；实际最新 HEAD 在最终回复中给出。

## 2026-05-30 Pipeline v1 Phase 7 Report Export MVP 计划

范围确认：本轮只做 Phase 7。目标是新增 Pipeline 贡献报告 Markdown 导出 MVP，把已有 ContributionTask、stage artifacts、patch-work 文档摘要和 records / events 审计信息汇总成可复制 / 可保存的本地报告。不运行真实模型验收，不执行真实远端写，不读取 token，不 push，不创建真实 PR，不修改根 `README.md` / 根 `AGENTS.md`。

启动检查：

- [x] 已读取 `tasks/lessons.md`，重点复核阶段提交、状态同步、patch-work 路径安全、Git 防护、stop 后副作用和 secret 注入规则。
- [x] 已读取 Pipeline v1 optimization plan、development checklist 和 `next-session-prompt.md`。
- [x] 已运行 `git status --short --branch` 和 `git log -12 --oneline`，确认当前分支 `pipeline-improve` 工作树干净，最近历史包含 `d007eb84`、`d71e13af`、`07243a01`、`a6c558b1`。
- [x] 用户已确认按建议进入 Report Export MVP。

BDD 验收场景：

- [x] Given 一个已完成 draft-only Pipeline 会话，When 用户导出报告，Then 报告包含任务、仓库、分支、贡献模式、patch-set 摘要、测试证据和 draft-only 边界说明，且不声称产生 commit 或 PR。
- [x] Given 一个已完成 local commit Pipeline 会话，When 用户导出报告，Then 报告包含 local commit hash、候选文件、excluded `patch-work/**` 和测试证据。
- [x] Given 一个 mock remote confirmation 会话，When 用户导出报告，Then 报告包含远端写确认审计、remote / base / head / operation id、PR 状态，并明确这是记录中的远端结果，不读取 token。
- [x] Given records 或 error 中出现 token、Authorization header、credentialed URL，When 报告生成，Then 报告内容脱敏，不输出 secret。
- [x] Given 会话缺少 ContributionTask 或 patch-work 文档，When 用户导出报告，Then 报告生成可解释的缺失状态，不抛出不可恢复错误。
- [x] Given Renderer 点击导出报告，When main 端生成 Markdown，Then UI 提供复制 / 保存入口，且 Renderer 只传 `sessionId`。

TDD 执行计划：

- [x] 先补 shared 类型和服务测试：新增 `PipelineReportExport` / `PipelineReportExportInput` 契约测试或类型编译路径，`pipeline-read-model-service.test.ts` 覆盖 draft-only、local commit、mock remote、缺失 task 和脱敏。
- [x] 先补 IPC / service 测试：`pipeline-service.test.ts` 覆盖 `exportPipelineReport({ sessionId })` 只读生成，不创建 patch-work、不执行 Git 写、不读取远端凭证。
- [x] 先补 Renderer 测试：新增 `PipelineReportExportPanel.test.tsx` 或接入现有 Dashboard 测试，覆盖 loading、error、复制、保存按钮 disabled 和报告预览。
- [x] 运行新增测试，确认失败点来自缺少 Phase 7 报告导出能力。
- [x] 实现 shared 契约：新增 `EXPORT_REPORT` IPC 常量、报告 input/result 类型，保持旧记录兼容。
- [x] 实现 main read model：从 ContributionTask summary、events、stage artifacts、patch-work manifest 和 records 生成 Markdown；只读、脱敏、不中断缺失项，且不复用 live Git submission plan。
- [x] 实现 `PipelineService.exportPipelineReport(input)`、main handler 和 preload API；main 端只接受 `sessionId` 并重新解析事实源。
- [x] 实现 Renderer 入口：新增报告导出面板或按钮，优先放在 Contribution Dashboard / PipelineView 右侧区域；支持复制 Markdown 和可选保存 `.md` 文件。
- [x] 递增受影响 package patch version，并同步 `bun.lock`。
- [x] 运行聚焦测试、Electron typecheck、`bun install --frozen-lockfile --dry-run`、`git diff --check`。
- [x] Phase 7 完成后同步 development checklist、next-session prompt、本节 Review 和 lessons，并单独提交状态更新。

触达边界：

- [x] 允许触达：`packages/shared/src/types/pipeline.ts`、`packages/shared/package.json`、`apps/electron/package.json`、`bun.lock`、`apps/electron/src/main/lib/pipeline-read-model-service.ts`、`apps/electron/src/main/lib/pipeline-service.ts`、`apps/electron/src/main/ipc/pipeline-handlers.ts`、`apps/electron/src/preload/index.ts`、Pipeline renderer 报告导出组件 / hooks / tests、`docs/improve/pipeline/v1`、`tasks/todo.md`、`tasks/lessons.md`。
- [x] 谨慎触达：`PipelineView.tsx`、`ContributionTaskDashboard.tsx`、`PipelineRecords.tsx`，只接入口，不做大 UI 重构。
- [x] 不触达：根 `README.md`、根 `AGENTS.md`、Claude / Codex runner、Graph 流程、Git submission 真实写逻辑、真实远端仓库、`patch-work/**`。

验证命令计划：

```bash
bun test apps/electron/src/main/lib/pipeline-read-model-service.test.ts apps/electron/src/main/lib/pipeline-service.test.ts
```

```bash
bun test apps/electron/src/renderer/components/pipeline/PipelineReportExportPanel.test.tsx apps/electron/src/renderer/components/pipeline/ContributionTaskDashboard.test.tsx
```

```bash
bun run --filter='@codeinsights/electron' typecheck
bun install --frozen-lockfile --dry-run
git diff --check -- packages/shared apps/electron bun.lock tasks/todo.md docs/improve/pipeline/v1
```

阶段边界：

- [x] 不把 fake runner smoke 说成真实模型验收。
- [x] 不把 unpacked smoke 说成 DMG / installer 或多平台验收。
- [x] 不读取 token，不输出 token，不检查 GitHub 凭证。
- [x] 不 push，不创建真实 PR。
- [x] 根 `README.md` / 根 `AGENTS.md` 仍需用户明确允许后才修改。

## 2026-05-30 Pipeline v1 Phase 7 Report Export MVP Review

- 阶段范围：本轮只完成 Report Export Markdown MVP；未执行真实模型验收、真实 GitHub remote smoke、DMG / installer 或多平台 packaged smoke，未 push，未创建真实 PR，未读取或输出 token，未修改根 `README.md` / 根 `AGENTS.md`。
- 主要变更：新增 `PipelineReportExport` / `PipelineReportExportInput` shared 契约、`EXPORT_REPORT` IPC、preload API、`PipelineService.exportPipelineReport()` 和 `PipelineReportExportPanel`；Renderer 可在 Pipeline v2 Dashboard 区域生成报告、复制 Markdown、保存 `.md`。
- Read model 边界：报告导出只读取 ContributionTask、ContributionTask events、Pipeline records、stage artifacts 和 patch-work manifest；已修复 code review 指出的风险，不再复用会执行 `validateCommitPreconditions()` 的 live submission plan，不触发 Git precondition、graph、远端写或凭证读取。
- 安全确认：Markdown、顶层 `title` 和 `fileName` 均做脱敏；已补测试覆盖 credentialed URL、token、Authorization / Bearer 片段、fake `git` 不被调用、当前工作树未持久化文件不进入报告。
- 触达文件：`packages/shared/src/types/pipeline.ts`、`packages/shared/package.json`、`apps/electron/package.json`、`bun.lock`、`apps/electron/src/main/lib/pipeline-read-model-service.ts`、`apps/electron/src/main/lib/pipeline-service.ts`、`apps/electron/src/main/ipc/pipeline-handlers.ts`、`apps/electron/src/preload/index.ts`、`apps/electron/src/renderer/components/pipeline/PipelineView.tsx`、`PipelineReportExportPanel.tsx` 和对应测试。
- 验证通过：`bun test apps/electron/src/main/lib/pipeline-read-model-service.test.ts apps/electron/src/main/lib/pipeline-service.test.ts`，61 pass；`bun test apps/electron/src/renderer/components/pipeline/PipelineReportExportPanel.test.tsx apps/electron/src/renderer/components/pipeline/ContributionTaskDashboard.test.tsx`，6 pass；`bun run --filter='@codeinsights/electron' typecheck`；`bun install --frozen-lockfile --dry-run`；`git diff --check -- packages/shared apps/electron bun.lock tasks/todo.md docs/improve/pipeline/v1`；`bun run --filter='@codeinsights/electron' build:renderer`。
- 版本同步：`@codeinsights/shared` 提升到 `0.1.55`，`@codeinsights/electron` 提升到 `0.0.129`，`bun.lock` 已同步。
- 未完成项 / [!]：Report Export HTML / PDF 仍为后续增强；真实 GitHub remote PR smoke 未授权未验证；DMG / installer、macOS x64、Windows x64、Linux packaged smoke 未在本机验证。
- 阶段提交：`70b30ea3 feat(pipeline): 完成 Pipeline v1 Phase 7 报告导出 MVP`。

## 2026-05-30 Pipeline v1 Phase 6 状态回填与下次启动提示词计划

范围确认：本轮只做状态文档同步和长期习惯加固，不改业务代码。目标是把 `d71e13af docs(pipeline): 同步 Phase 6 后续开发状态` 回填为最新已确认恢复入口，标清 Phase 0-6 已完成、未完成项和下一轮入口，并给用户一份可直接复制的下次启动提示词。

执行计划：

- [x] 读取 `tasks/lessons.md`、Pipeline v1 development checklist 和 `next-session-prompt.md`。
- [x] 运行 `git status --short --branch` 和 `git log --oneline -8`，确认当前分支、最新提交和未提交状态。
- [x] 更新 `tasks/lessons.md`，把“阶段完成后自动同步状态文档和最终提示词”作为更明确的默认收尾动作记录下来。
- [x] 更新 `docs/improve/pipeline/v1/2026-05-28-pipeline-mode-development-checklist.md`，回填 `d71e13af`，标明完成 / 未完成 / 下一轮入口。
- [x] 更新 `docs/improve/pipeline/v1/next-session-prompt.md`，让下次启动能从当前 Phase 0-6 已完成状态继续。
- [x] 在本节追加 Review，并运行陈旧入口搜索与 `git diff --check`。
- [x] 单独提交本轮状态同步文档。

边界：

- [x] 不 push。
- [x] 不创建真实 PR。
- [x] 不运行真实 GitHub remote smoke。
- [x] 不检查、读取或输出 token。
- [x] 不修改根 `README.md` / 根 `AGENTS.md`。

### Review

- 完成状态：Phase 0-6 已完成；最新开发基线为 `07243a01 feat(pipeline): 完成 Pipeline v1 Phase 6 本地验收准备`；最新已确认恢复入口为 `d71e13af docs(pipeline): 同步 Phase 6 后续开发状态`。
- 未完成项 / [!]：真实 GitHub remote PR smoke 未授权未验证；DMG / installer、macOS x64、Windows x64、Linux packaged smoke 未在本机验证；根 `README.md` / 根 `AGENTS.md` 仍需用户明确允许后再同步。
- 本轮同步：已更新 lessons、development checklist、next-session prompt 和本节任务记录；未改业务代码。
- 验证：陈旧入口搜索通过；`git diff --check -- docs/improve/pipeline/v1 tasks/todo.md tasks/lessons.md` 通过。
- 阶段提交：本节由当前状态同步提交承载；实际最新 HEAD 在最终回复中给出。

## 2026-05-29 Pipeline v1 Phase 6 真实端到端验收与交付准备计划

范围确认：本轮从 Phase 6 开始。目标是在不伪装未验证能力的前提下，补齐可重复的 fixture / fake-runner smoke、packaged smoke 和交付准备记录。默认不 push、不创建真实 PR、不执行真实远端写；真实 remote smoke 必须先获得用户明确授权和凭证条件。根 `README.md` / 根 `AGENTS.md` 只准备同步草案，不直接修改，除非用户明确允许。

启动检查：

- [x] 已读取 `tasks/lessons.md`，重点复核阶段完成即提交、状态文档同步、patch-work 路径安全、stop 后副作用、Tester Git 防护和真实远端写 gated 规则。
- [x] 已读取 Pipeline v1 optimization plan、development checklist 和 `docs/improve/pipeline/v1/next-session-prompt.md`。
- [x] 已确认当前分支为 `pipeline-improve`。
- [x] 已确认最近历史包含 `a6c558b1 feat(pipeline): 完成 Pipeline v1 Phase 5 远端写确认与 GitHub 增强`。
- [x] 启动时已确认 Phase 0-5 已完成，本轮从 Phase 6 开始；当前 Phase 6 已完成本地验收准备。
- [x] 用户已确认本计划，已进入实现 / 验证。

BDD 验收场景：

- [x] Given clean fixture repo 和 fake runner，When Pipeline 走 draft-only 路径，Then 完成六阶段可回放记录，生成 patch-work / submission plan，但不产生 Git commit。
- [x] Given clean fixture repo 和 fake runner，When 用户确认 local commit，Then `PipelineService` 只提交候选文件，`patch-work/**` 不进入 commit，ContributionTask 记录 local commit 结果。
- [x] Given dirty fixture repo，When 用户运行 preflight，Then Renderer / Service 显示 warning，需要 fingerprint 匹配的 acknowledgement 后才允许继续。
- [x] Given conflict fixture repo，When 用户尝试启动 Pipeline，Then preflight blocker 阻断 Graph，不进入 runner。
- [x] Given local bare remote fixture，When 构造 remote write mocked path，Then 远端写必须经过独立 `remote_write_confirmation`，并可审计 operation id、commit hash、remote/base/head 和 `remote_write_confirmed` event。
- [x] Given token、credentialed remote URL 或 Authorization header 出现在底层错误 / diagnostics 中，When records、events、read model 或 UI 展示，Then 敏感内容全部脱敏。
- [x] Given packaged app smoke，When 运行 draft-only 和 local commit 主路径，Then preload IPC、patch-work read model、local commit 受控路径可用；未覆盖平台用 `[!]` 标清。
- [x] Given 真实 GitHub token / `gh` / API token 未获得授权，When 进入 Phase 6，Then 不运行真实 remote PR smoke，不 push，不创建真实 PR。

TDD 执行计划：

- [x] 先补 fixture 工具测试：新增 `pipeline-fixture-runner.ts` 和 `pipeline-smoke.test.ts`，fixture 显式设置 Git author、default branch、本地 bare remote URL，不依赖开发机全局 Git 配置。
- [x] 先补 preflight smoke 测试：复用并补跑 `pipeline-preflight-service.test.ts` / `pipeline-service.test.ts`，覆盖 clean、dirty warning acknowledgement、conflict blocker，验证 service guard 不调用 Graph。
- [x] 先补 draft-only fake runner smoke：覆盖六阶段 gate / patch-work / records / ContributionTask read model，并断言不产生 commit。
- [x] 先补 local commit fake runner smoke：覆盖 submission plan、candidate / excluded files、`patch-work/**` 排除、本地 commit 结果和恢复状态。
- [x] 先补 remote mocked path smoke：覆盖 `remote_write_confirmation` 审计、operation id / commit hash / remote/base/head 和 `remote_write_confirmed` event；existing PR / `skipPush` ref 复验与脱敏继续由 Phase 5 service / git submission tests 覆盖。
- [x] 先补 renderer 关键交互测试：`CommitterPanel` / `RemoteWriteConfirmationPanel` / preflight panel 的确认态、恢复态、disabled reason 和错误态已补跑。
- [x] 先补 packaged smoke 脚本或文档化命令：新增 `smoke:pipeline-fixture`，验证 unpacked app 的 draft-only / local commit 主路径；明确它不是 DMG / installer 多平台验收。
- [x] 运行新增测试并确认失败点来自缺少 Phase 6 smoke / fixture 能力，再实现最小代码。
- [x] 如实现触达 shared 契约或 Electron 业务代码，递增受影响 package patch version 并同步 `bun.lock`；本轮仅递增 `@codeinsights/electron` 到 `0.0.128`。
- [x] Phase 6 完成后更新 development checklist、next-session prompt 和本节 Review；运行验证后单独提交阶段成果。

触达边界：

- [x] 允许触达：Pipeline smoke / fixture helper、main service / preflight / git submission / read model 相关测试、renderer Pipeline 面板测试、必要的 smoke 脚本或测试入口、`packages/shared` / `apps/electron` 版本文件、`bun.lock`、`docs/improve/pipeline/v1`、`tasks/todo.md`。
- [x] 谨慎触达：`pipeline-service.ts`、`pipeline-git-submission-service.ts`、`pipeline-preflight-service.ts`、`PipelineView` / `CommitterPanel` / `RemoteWriteConfirmationPanel`。本轮仅在测试证明需要 Phase 6 smoke / fixture 补强时触达。
- [x] 不触达：根 `README.md`、根 `AGENTS.md`、`patch-work/**`、无关 UI 重构、真实远端仓库、真实 GitHub PR。
- [x] 不做事项：不 push、不创建真实 PR、不运行未授权 remote smoke、不把 fake runner smoke 说成真实模型验收、不把 app bundle smoke 说成 DMG / installer smoke。

验证命令计划：

```bash
bun test apps/electron/src/main/lib/pipeline-graph.test.ts apps/electron/src/main/lib/pipeline-preflight-service.test.ts apps/electron/src/main/lib/pipeline-service.test.ts apps/electron/src/main/lib/codex-pipeline-node-runner.test.ts apps/electron/src/main/lib/pipeline-git-submission-service.test.ts apps/electron/src/main/lib/pipeline-patch-work-service.test.ts apps/electron/src/main/lib/contribution-task-service.test.ts
```

```bash
bun test apps/electron/src/renderer/components/pipeline/PipelineRecords.test.ts apps/electron/src/renderer/components/pipeline/CommitterPanel.test.tsx apps/electron/src/renderer/components/pipeline/RemoteWriteConfirmationPanel.test.tsx apps/electron/src/renderer/components/pipeline/TesterResultBoard.test.tsx apps/electron/src/renderer/components/pipeline/ReviewDocumentBoard.test.tsx apps/electron/src/renderer/components/pipeline/PipelinePreflightPanel.test.tsx
```

```bash
bun run --filter='@codeinsights/electron' typecheck
bun install --frozen-lockfile --dry-run
git diff --check -- packages/shared apps/electron bun.lock tasks/todo.md docs/improve/pipeline/v1
```

真实 remote smoke 门禁：

- [x] 只有用户明确授权后，才检查 GitHub token / `gh` / remote 条件。
- [x] 授权前不读取或输出 token，不执行 `git push`，不调用 `gh pr create`，不创建真实 PR。
- [x] 如果本阶段未执行真实 remote smoke，Review 中必须用 `[!]` 标明“真实 remote PR 未验证”。

## 2026-05-29 Pipeline v1 Phase 6 真实端到端验收与交付准备 Review

- 阶段范围：完成 Phase 6 本地 deterministic E2E / packaged fixture smoke 和交付准备记录；未修改根 `README.md` / 根 `AGENTS.md`，未 push，未创建真实 PR，未执行真实 GitHub remote smoke。
- 主要变更：新增 `PipelineFixtureNodeRunner` 与 `CODEINSIGHTS_PIPELINE_FIXTURE_RUNNER=1` 显式门禁；fixture 模式复用真实 `PipelineService`、LangGraph checkpoint、ContributionTask、patch-work 和 Git submission 服务，但跳过 Claude / Codex CLI preflight 要求。
- 本地 fixture：`setupPipelineFixtureRepository()` 创建临时 Git repo、本地 Git author、`main` 分支、本地 bare `origin` 和源码变更；新增 deterministic smoke 覆盖 draft-only、local commit、mock remote confirmation 三条路径。
- 提交安全：draft-only 不产生 Git commit；local commit 只提交 `src/index.ts`；`patch-work/**` 保持未提交 / excluded；mock remote path 先创建受控本地 commit，再进入独立 `remote_write_confirmation`，并审计 `remote_write_confirmed` / `remote_submission_created` events。
- Packaged smoke：新增 `apps/electron/scripts/pipeline-fixture-smoke.ts` 和 `smoke:pipeline-fixture`，通过 CDP + preload IPC 驱动当前平台 unpacked app，已验证 macOS arm64 unpacked app 的 draft-only 与 local-commit 主路径。
- [!] 未验证项：真实 GitHub remote PR smoke 未执行，因为未获得用户明确授权；DMG / installer 和 macOS x64、Windows x64、Linux packaged smoke 未在本机验证。
- 文档准备：根 `README.md` / 根 `AGENTS.md` 建议后续获授权后再同步“Pipeline 已有 deterministic fixture smoke、真实 remote smoke gated、unpacked app smoke 不等于 installer 多平台验收”等边界；本轮不直接修改根文档。
- 版本同步：`@codeinsights/electron` 提升到 `0.0.128`，`bun.lock` 已同步；`packages/shared` 未改动，shared 版本不变。
- 验证通过：`bun test apps/electron/src/main/lib/pipeline-graph.test.ts apps/electron/src/main/lib/pipeline-preflight-service.test.ts apps/electron/src/main/lib/pipeline-service.test.ts apps/electron/src/main/lib/codex-pipeline-node-runner.test.ts apps/electron/src/main/lib/pipeline-git-submission-service.test.ts apps/electron/src/main/lib/pipeline-patch-work-service.test.ts apps/electron/src/main/lib/contribution-task-service.test.ts apps/electron/src/main/lib/pipeline-smoke.test.ts`，162 pass；`bun test apps/electron/src/renderer/components/pipeline/PipelineRecords.test.ts apps/electron/src/renderer/components/pipeline/CommitterPanel.test.tsx apps/electron/src/renderer/components/pipeline/RemoteWriteConfirmationPanel.test.tsx apps/electron/src/renderer/components/pipeline/TesterResultBoard.test.tsx apps/electron/src/renderer/components/pipeline/ReviewDocumentBoard.test.tsx apps/electron/src/renderer/components/pipeline/PipelinePreflightPanel.test.tsx`，32 pass；`bun run --filter='@codeinsights/electron' typecheck`；`bun install --frozen-lockfile --dry-run`；`bun run --filter='@codeinsights/electron' build`；`bun run --filter='@codeinsights/electron' pack`；`bun run --filter='@codeinsights/electron' smoke:pipeline-fixture`。
- 阶段提交：`07243a01 feat(pipeline): 完成 Pipeline v1 Phase 6 本地验收准备`。

## 2026-05-29 Pipeline v1 Phase 5 远端写确认与 GitHub 增强计划

范围确认：本轮只做 Phase 5。目标是把 remote PR 从 `submission_review` 内的 checkbox / response.kind 提升为独立、可审计、可恢复的远端写确认状态，并补充 GitHub API / existing PR / push 成功但 PR 创建失败的恢复能力。不修改根 `README.md` / 根 `AGENTS.md`，不执行真实远端写，不 push、不创建真实 PR，不纳入 `patch-work/**` 或无关文件。

启动检查：

- [x] 已读取 `tasks/lessons.md`，重点复核阶段完成即提交、状态文档同步、patch-work 路径安全、stop 后副作用、Tester Git 防护和 Codex secret 注入。
- [x] 已读取 Pipeline v1 优化方案和 development checklist，确认 Phase 0-4 已完成，Phase 5-6 尚未完成。
- [x] 已运行 `git status --short --branch` 和 `git log -12 --oneline`，当前工作树干净，最近历史包含 `9b4c8837`、`1ff8416a`、`420da2b2`、`009ba970`、`4cdcc128`、`dbd980c2`、`ff515a01`。
- [x] 未发现已完成但未提交的阶段成果。

BDD 验收场景：

- [x] Given committer 已完成本地 commit，When 用户点击 Draft PR 动作，Then 系统只创建独立 `remote_write_confirmation` gate / pending operation，不执行 `git push` 或 PR 创建。
- [x] Given 远端确认 payload 与当前本地 commit / remote / base / head 不匹配，When 用户尝试确认远端写，Then Service 拒绝执行并返回脱敏中文错误。
- [x] Given 待推送 tree 或提交范围包含 `patch-work/**`，When 用户确认远端写，Then Service 阻断 push / PR，并记录可审计失败原因。
- [x] Given push 成功但 PR 创建失败，When 用户回到提交面板，Then UI 展示脱敏恢复状态，并允许 `skipPush` 只重试 PR 创建。
- [x] Given GitHub 上已存在同 head owner / head branch / base branch / repo 的 PR，When 用户执行远端 PR 路径，Then 系统不会静默覆盖，UI 提供打开 PR 或显式更新入口。
- [x] Given GitHub token、credentialed remote URL 或 Authorization header 出现在底层错误中，When records / events / diagnostics / UI read model 展示结果，Then 所有敏感内容都被脱敏。

TDD 执行计划：

- [x] 先补 shared/state/graph 测试：`pipeline-state.test.ts` 和 `pipeline-graph.test.ts` 覆盖 `submission_review -> remote_write_confirmation -> completed` 顺序、取消/失败恢复，以及旧会话兼容。
- [x] 先补 service 测试：`pipeline-service.test.ts` 覆盖未二次确认不执行远端写、operation id / commit hash / base / head 不匹配拒绝、远端确认记录可回放。
- [x] 先补 git submission 测试：`pipeline-git-submission-service.test.ts` 覆盖 push success / PR failure、`skipPush` 重试、existing PR 检测、`patch-work/**` tree / range 防护和脱敏。
- [x] 先补 UI 测试：新增 `RemoteWriteConfirmationPanel.test.tsx`，更新 `CommitterPanel.test.tsx`，覆盖 Draft PR 进入确认态、风险勾选、按钮禁用、恢复路径和 existing PR 选择。
- [x] 运行新增测试并确认失败点来自未实现 Phase 5 行为。
- [x] 实现 shared 契约：补齐远端确认 payload / operation / existing PR / retry 字段，保持旧 JSONL replay 兼容。
- [x] 实现 graph/state：把 remote PR 路径提升为独立确认状态或等价持久 pending operation，并写入独立 records。
- [x] 实现 service 复验：operation id、commit hash、remote base、head branch safety、`patch-work/**` tree/range、warning acknowledgement 和幂等重试。
- [x] 实现 GitHub API / existing PR 最小路径：token 只从显式配置或环境读取，不持久化；existing PR 按 repo + head owner/head branch + base branch 检测；update 必须有 preview，不静默覆盖。
- [x] 实现 UI：新增 `RemoteWriteConfirmationPanel`，让 `CommitterPanel` 的 Draft PR 按钮只进入确认 / 恢复状态，不直接远端写。
- [x] 递增受影响 package patch version，并同步 `bun.lock`。
- [x] 更新 development checklist、next-session prompt 和本节 Review。
- [x] 运行 Phase 5 聚焦测试、Electron typecheck、`bun install --frozen-lockfile --dry-run`、`git diff --check`，核对 staged 范围后单独提交 Phase 5 成果。

触达边界：

- [x] 允许触达：`packages/shared/src/types/pipeline.ts`、`packages/shared/src/utils/pipeline-state.ts`、`packages/shared/package.json`、`apps/electron/package.json`、`bun.lock`、Pipeline graph/service/git submission/read model/IPC/preload、Pipeline renderer `CommitterPanel` / 新远端确认面板 / hooks / tests、Phase 5 文档状态、`tasks/todo.md`。
- [x] 不触达：根 `README.md`、根 `AGENTS.md`、Claude / Codex runner 业务逻辑（除非测试证明 Phase 5 必需）、Phase 6 smoke 文档、`patch-work/**`、真实远端仓库。

验证命令：

```bash
bun test packages/shared/src/utils/pipeline-state.test.ts apps/electron/src/main/lib/pipeline-graph.test.ts apps/electron/src/main/lib/pipeline-service.test.ts apps/electron/src/main/lib/pipeline-git-submission-service.test.ts
```

```bash
bun test apps/electron/src/renderer/components/pipeline/CommitterPanel.test.tsx apps/electron/src/renderer/components/pipeline/RemoteWriteConfirmationPanel.test.tsx
```

```bash
bun run --filter='@codeinsights/electron' typecheck
bun install --frozen-lockfile --dry-run
git diff --check -- packages/shared apps/electron bun.lock tasks/todo.md docs/improve/pipeline/v1
```

## 2026-05-29 Pipeline v1 Phase 5 远端写确认与 GitHub 增强 Review

- 阶段范围：只完成 Phase 5；未修改根 `README.md` / 根 `AGENTS.md`，未纳入 `patch-work/**`，未执行真实远端写，未 push，未创建真实 PR。
- 主要变更：把 remote PR 从 `submission_review` 内联 checkbox 提升为独立 `remote_write_confirmation` gate；`submission_review(remote_pr)` 只请求确认态，确认 payload 单独携带 operation id、remote/base/head、commit hash、PR title/body、sanitized URL 和 warnings。
- Service 与状态：`pipeline-graph` / `pipeline-state` 支持 `submission_review -> remote_write_confirmation -> completed` replay；`respondGate()` 按 pending gate kind 记录决策并拒绝 response kind 污染；恢复路径会补齐 `remoteWritePlan`；远端结果复用前会复验 commit、remote、base/head 和 pushedRef 证据；`draft_only` 远端 PR 路径会先执行受控本地 commit，再进入独立远端确认。
- GitHub 与安全：production remote runner 已切到 GitHub API 优先路径；token 只从 `CODEINSIGHTS_GITHUB_TOKEN` / `GH_TOKEN` / `GITHUB_TOKEN` 环境变量读取且不持久化；existing PR 在 push 前检测并按 repo、head owner/head branch、base branch 校验；CLI fallback 使用 `gh pr list --repo ... --head ... --base ...`，避免无效 `gh pr view --head`；命中 existing PR 时不静默覆盖、不执行 push。
- 恢复能力：push 成功但 PR 创建失败会持久化 `pushed` 状态并脱敏错误；同一 operation id 重试时在上下文匹配后传 `skipPush` 只重试 PR 创建，并通过 `git ls-remote --heads` 复验远端 head ref SHA 等于本地 commit；不匹配时重新执行正常安全路径。
- UI 接入：新增 `RemoteWriteConfirmationPanel`；`PipelineGateSidePanel` 对远端确认使用独立 payload；`CommitterPanel` Draft PR 动作只进入确认态，并展示 pushed / existing PR 恢复状态。
- 版本同步：`@codeinsights/shared` 提升到 `0.1.54`，`@codeinsights/electron` 提升到 `0.0.127`，`bun.lock` 已同步。
- 验证命令：`bun test packages/shared/src/utils/pipeline-state.test.ts apps/electron/src/main/lib/pipeline-graph.test.ts apps/electron/src/main/lib/pipeline-service.test.ts apps/electron/src/main/lib/pipeline-git-submission-service.test.ts`；`bun test apps/electron/src/renderer/components/pipeline/pipeline-gate-panel-model.test.ts apps/electron/src/renderer/components/pipeline/CommitterPanel.test.tsx apps/electron/src/renderer/components/pipeline/RemoteWriteConfirmationPanel.test.tsx`；`bun run --filter='@codeinsights/electron' typecheck`；`bun install --frozen-lockfile --dry-run`；`git diff --check -- packages/shared apps/electron bun.lock tasks/todo.md docs/improve/pipeline/v1`。
- 审计与边界：远端副作用前会写入 `remote_write_confirmed` ContributionTask event；如果远端 PR 已创建但 graph resume 失败，Service 会保留已完成的 `remote_pr_created` 状态，不丢失成功副作用。
- Review 修复：修复了 `draft_only` 无法进入 remote PR、existing PR 必须在 push 前检测、UI gate kind 不应污染响应、恢复路径补齐 remoteWritePlan、GitHub API runner 接入 production service、remote URL / token / Authorization 脱敏、CLI existing PR base/head 校验、`skipPush` 远端 ref SHA 复验、GitHub API push 成功但 PR 创建和 existing PR lookup 都失败时仍保留 `pushed` 状态、远端成功后 graph resume 失败状态保留等问题。
- 未完成项：Phase 6 真实端到端验收、packaged smoke 和公开文档准备尚未开始。
- 阶段提交：`a6c558b1 feat(pipeline): 完成 Pipeline v1 Phase 5 远端写确认与 GitHub 增强`。

## 2026-05-29 Pipeline v1 Phase 4 后状态同步计划

范围确认：本轮只做 Phase 4 完成后的状态文档同步和习惯固化；不修改业务代码，不修改根 `README.md` / 根 `AGENTS.md`，不安装依赖，不进入 Phase 5 实现，不 push、不创建 PR、不执行真实远端写。

- [x] 复核当前分支、工作树和最近提交，确认 Phase 4 实现提交为 `1ff8416a feat(pipeline): 完成 Pipeline v1 Phase 4 Contribution Dashboard`。
- [x] 更新 Pipeline v1 development checklist：回填真实 Phase 4 提交号，明确 Phase 0-4 已完成，Phase 5-6 尚未完成，下一步从 Phase 5 继续。
- [x] 更新 Pipeline v1 `next-session-prompt.md`：启动检查最近历史补齐 `1ff8416a`，当前真实进度写清 Phase 4 已完成、Phase 5-6 未完成。
- [x] 更新 `tasks/lessons.md`：把阶段完成后自动同步状态文档、回填真实提交号、给可复制启动提示词固化为默认动作。
- [x] 在本节追加 Review，运行文档 diff check，单独提交本轮状态同步改动。

## 2026-05-29 Pipeline v1 Phase 4 后状态同步 Review

- 已确认当前分支 `pipeline-improve` 工作基线：`1ff8416a feat(pipeline): 完成 Pipeline v1 Phase 4 Contribution Dashboard`。
- 已更新 Pipeline v1 development checklist：最新开发基线回填为 `1ff8416a`，已完成项明确为 Phase 0 / Phase 1 / Phase 2 / Phase 3 / Phase 4，未完成项明确为 Phase 5-6，下一步从 Phase 5 远端写确认与 GitHub 增强继续。
- 已更新 `docs/improve/pipeline/v1/next-session-prompt.md`：启动检查最近历史补齐 `1ff8416a`，当前真实进度写清 Phase 4 已完成、Phase 5-6 尚未完成。
- 已更新 `tasks/lessons.md`：阶段完成后必须自动同步 development checklist、next-session prompt、`tasks/todo.md` Review，并回填真实阶段提交号；最终回复继续给可直接复制的下次启动提示词。
- 本轮只修改状态文档、任务记录和 lessons；未修改业务代码、根 `README.md`、根 `AGENTS.md`，未安装依赖，未 push / PR / 远端写。
- 验证：`git diff --check -- docs/improve/pipeline/v1 tasks/todo.md tasks/lessons.md`。

## 2026-05-29 Pipeline v1 Phase 4 Contribution Dashboard 与 Submission Plan 计划

范围确认：本轮只做 Phase 4。目标是把 ContributionTask 暴露为一等只读 Dashboard，并新增 `PipelineSubmissionPlan` read model，让 `CommitterPanel` 从服务端 read model 展示提交计划，而不是在 UI 中零散拼 tester / committer output。保持本地 commit / remote PR 现有执行服务不变；不修改 Graph、runner、Git submission 真实写逻辑，不新增真实 Git 写路径，不执行真实远端写，不修改根 `README.md` / 根 `AGENTS.md`。

BDD 验收场景：

- [x] Given 当前会话已有 ContributionTask 和 selected report，When 用户打开 Pipeline 工作台，Then Dashboard 展示 task、repository、branch、mode、patch-work、commit、PR 和最近事件。
- [x] Given 当前会话尚未创建 ContributionTask 或 read model 读取失败，When Dashboard 加载，Then UI 展示中文空态 / 错误态，不影响 Records 和其它 gate 面板。
- [x] Given committer 已生成 `commit.md` / `pr.md` 和 patch-set，When 用户进入提交面板，Then `CommitterPanel` 通过 `PipelineSubmissionPlan` 展示 commit message、PR title/body、candidate files、excluded files、blockers、warnings。
- [x] Given submission plan 中存在 `patch-work/**`，When 用户查看本地 commit / Draft PR 分区，Then `patch-work/**` 明确出现在 excluded files，且 UI 不把它作为候选提交文件。
- [x] Given 尚未完成 local commit，When 用户尝试 Draft PR，Then UI 禁用远端提交入口并展示需要先完成本地 commit 的原因。
- [x] Given push 成功但 PR 创建失败的历史结果存在，When 用户查看远端分区，Then UI 展示脱敏后的恢复提示，但不新增真实远端写路径。

TDD 执行计划：

- [x] 先补 `pipeline-read-model-service.test.ts`：覆盖 summary 缺 task、summary 从 events 汇总 commit / PR、submission plan 排除 `patch-work/**`、缺 committer output 时返回 blocker / warning。
- [x] 先补 shared / IPC / preload 类型编译路径：新增 `ContributionTaskSummary`、`PipelineSubmissionPlan`、`GET_CONTRIBUTION_TASK_SUMMARY`、`GET_SUBMISSION_PLAN`，确保 Renderer 只能传 `sessionId`。
- [x] 先补 `ContributionTaskDashboard.test.tsx`：覆盖正常态、空态、错误态、最近事件、patch-work / commit / PR 状态展示。
- [x] 先补 `CommitterPanel.test.tsx`：覆盖三段式分区、button disabled 条件、没有 local commit 时禁用 Draft PR、candidate / excluded files 展示。
- [x] 运行新增测试并确认失败点来自未实现 Phase 4 行为。
- [x] 实现 `pipeline-read-model-service.ts`：只读汇总 ContributionTask、patch-work manifest、committer output、submission result，不改变 manifest、不执行 Git 写操作。
- [x] 补充 read model 只读回归：summary 读取缺失 `patch-work/` 时不创建目录，且 repository URL 已脱敏。
- [x] 实现 `PipelineService.getContributionTaskSummary(sessionId)` 和 `PipelineService.getSubmissionPlan(sessionId)`，找不到 task 时返回可解释空态或中文错误。
- [x] 实现 shared IPC / main handler / preload：新增 summary / submission plan read API，main 端只接受 `sessionId` 并重新解析本地事实源。
- [x] 新增 `useContributionTaskSummary(sessionId)`、`usePipelineSubmissionPlan(sessionId)`，不使用 localStorage，不从 records 文本反推事实源。
- [x] 新增 `ContributionTaskDashboard.tsx` 并接入 `PipelineView` 布局；保持 Records / gate 面板可独立工作。
- [x] 改造 `CommitterPanel` 为三段：保存材料、本地 commit、Draft PR；提交动作继续走现有 `onSubmit` / `PipelineService` 逻辑。
- [x] 递增受影响 package patch version，并同步 `bun.lock`。
- [x] 更新 development checklist、next-session prompt 和本节 Review。
- [x] 运行 Phase 4 聚焦测试、Electron typecheck、`bun install --frozen-lockfile --dry-run`、`git diff --check`，核对 staged 范围后单独提交 Phase 4 成果。

触达边界：

- [x] 允许触达：`packages/shared/src/types/pipeline.ts`、`packages/shared/package.json`、`apps/electron/package.json`、`bun.lock`、`apps/electron/src/main/lib/pipeline-read-model-service.ts`、`apps/electron/src/main/lib/pipeline-service.ts`、`apps/electron/src/main/ipc/pipeline-handlers.ts`、`apps/electron/src/preload/index.ts`、Pipeline renderer hooks / Dashboard / CommitterPanel / PipelineView / tests、Phase 4 文档状态、`tasks/todo.md`。
- [x] 不触达：`pipeline-graph.ts`、Claude / Codex runner、Git submission 真实写逻辑、远端写确认模型、GitHub API / existing PR、根 `README.md`、根 `AGENTS.md`、`patch-work/**`、远端 push / PR 行为。

验证命令：

```bash
bun test apps/electron/src/main/lib/pipeline-read-model-service.test.ts apps/electron/src/main/lib/pipeline-service.test.ts
```

```bash
bun test apps/electron/src/renderer/components/pipeline/ContributionTaskDashboard.test.tsx apps/electron/src/renderer/components/pipeline/CommitterPanel.test.tsx
```

```bash
bun run --filter='@codeinsights/electron' typecheck
bun install --frozen-lockfile --dry-run
git diff --check -- packages/shared apps/electron bun.lock tasks/todo.md docs/improve/pipeline/v1
```

## 2026-05-29 Pipeline v1 Phase 4 Contribution Dashboard 与 Submission Plan Review

- 阶段范围：只完成 Phase 4 Contribution Dashboard 与 Submission Plan；未修改 Graph、runner、Git submission 真实写逻辑、远端写确认模型、GitHub API / existing PR、根 `README.md` 或根 `AGENTS.md`，未执行真实远端写。
- 主要变更：新增 `ContributionTaskSummary`、`PipelineSubmissionPlan`、summary / submission plan IPC 与 preload API；新增 `pipeline-read-model-service.ts`，从 ContributionTask、events、stage outputs、patch-work manifest 和本地 Git 只读状态重建 dashboard / submission plan。
- UI 接入：新增 `ContributionTaskDashboard`、`useContributionTaskSummary`、`usePipelineSubmissionPlan`；`PipelineView` 在 v2 会话展示贡献任务 dashboard；`CommitterPanel` 改为“保存提交材料 / 本地 commit / Draft PR”三段式，并优先使用服务端 `PipelineSubmissionPlan`。
- 安全与只读确认：Renderer 只传 `sessionId`；read model 不调用远端 preflight，不执行 `git commit` / `git push` / `gh`；summary 读取缺失 `patch-work/` 时不会创建目录；`patch-work/**` 永远进入 excluded files；repository URL、PR URL、error、blocker、warning 已脱敏。
- 版本同步：`@codeinsights/shared` 提升到 `0.1.53`，`@codeinsights/electron` 提升到 `0.0.126`，`bun.lock` 已同步。
- 验证命令：`bun test apps/electron/src/main/lib/pipeline-read-model-service.test.ts apps/electron/src/main/lib/pipeline-service.test.ts`；`bun test apps/electron/src/renderer/components/pipeline/ContributionTaskDashboard.test.tsx apps/electron/src/renderer/components/pipeline/CommitterPanel.test.tsx`；`bun run --filter='@codeinsights/electron' typecheck`；`bun run --filter='@codeinsights/electron' build:renderer`；`bun install --frozen-lockfile --dry-run`；`git diff --check -- packages/shared apps/electron bun.lock tasks/todo.md docs/improve/pipeline/v1`。
- Code review 处理：已修复 reviewer 指出的 read model 非严格只读问题，并新增“缺失 patch-work 不创建目录”回归测试；已收紧新 read model 返回面的 URL / error 脱敏。
- 未完成项：Phase 5 远端写确认与 GitHub 增强、Phase 6 真实端到端验收与交付准备仍未开始。
- 阶段提交：`1ff8416a feat(pipeline): 完成 Pipeline v1 Phase 4 Contribution Dashboard`。

## 2026-05-29 Pipeline v1 Phase 3 状态同步再确认计划

范围确认：本轮只响应用户要求，同步 Pipeline v1 最新开发状态、完成/未完成清单、下次启动提示词和阶段收尾习惯；不修改业务代码，不修改根 `README.md` / 根 `AGENTS.md`，不安装依赖，不 push、不创建 PR、不执行真实远端写。

- [x] 复核当前分支、工作树和最近提交，确认 Phase 3 功能提交为 `4cdcc128 feat(pipeline): 完成 Pipeline v1 Phase 3 Patch-work Workbench`，Phase 3 状态同步提交为 `009ba970 docs(pipeline): 同步 Phase 3 后续开发状态`。
- [x] 更新 Pipeline v1 development checklist：回填真实最新恢复入口 `009ba970`，明确 Phase 0-3 已完成，Phase 4-6 未完成，下一步从 Phase 4 Contribution Dashboard 与 Submission Plan 继续。
- [x] 更新 Pipeline v1 `next-session-prompt.md`：启动检查最近历史补齐 `009ba970`，当前真实进度写清 Phase 3 状态已同步。
- [x] 更新 `tasks/lessons.md`：把用户再次强调的“每个阶段性任务完成后自动更新状态文档并给启动提示词”固化为更具体的默认动作。
- [x] 在本节追加 Review，运行文档 diff check，单独提交本轮状态同步改动。

## 2026-05-29 Pipeline v1 Phase 3 状态同步再确认 Review

- 已确认当前分支 `pipeline-improve` 工作基线：`4cdcc128 feat(pipeline): 完成 Pipeline v1 Phase 3 Patch-work Workbench`，状态同步基线：`009ba970 docs(pipeline): 同步 Phase 3 后续开发状态`。
- 已更新 Pipeline v1 development checklist：最新恢复入口回填为 `009ba970`，已完成项明确为 Phase 0 / Phase 1 / Phase 2 / Phase 3，未完成项明确为 Phase 4-6，下一步从 Phase 4 Contribution Dashboard 与 Submission Plan 继续。
- 已更新 `docs/improve/pipeline/v1/next-session-prompt.md`：启动检查最近历史补齐 `009ba970`，当前真实进度写清 Phase 3 后续开发状态已同步。
- 已更新 `tasks/lessons.md`：每个阶段完成后必须自动同步 development checklist、next-session prompt、`tasks/todo.md` Review，并在最终回复给可复制提示词；后续再次请求状态同步时要回填上一轮真实状态同步提交号。
- 本轮只修改状态文档、任务记录和 lessons；未修改业务代码、根 `README.md`、根 `AGENTS.md`，未安装依赖，未 push / PR / 远端写。
- 验证：`git diff --check -- docs/improve/pipeline/v1 tasks/todo.md tasks/lessons.md`。

## 2026-05-29 Pipeline v1 Phase 3 Patch-work Document Workbench 计划

范围确认：本轮只做 Phase 3。目标是实现只读 Patch-work Document Workbench MVP，统一展示 `plan.md`、`dev.md`、`review.md`、`result.md`、`patch-set/*`、`commit.md`、`pr.md` 等 patch-work 产物，支持 markdown、patch/diff、json/text 渲染、revision selector、current / accepted badge、checksum mismatch / read error，并接入 `ReviewDocumentBoard`、`TesterResultBoard`、`CommitterPanel`。不修改 Graph、runner、Git submission，不新增真实 Git 写操作，不执行真实远端写，不修改根 `README.md` / 根 `AGENTS.md`。

BDD 验收场景：

- [x] Given patch-work 中 `dev.md` 已生成第 1 版并被接受，第 2 版为当前版本，When 用户打开 Workbench，Then revision selector 显示两个版本，并可对比 current 与 accepted。
- [x] Given `patch-set/changes.patch` 存在，When Workbench 打开该文件，Then 以 diff 视图展示文件头、hunk、增加行和删除行。
- [x] Given JSON 产物内容合法或非法，When Workbench 打开 `.json` 文件，Then 合法 JSON 格式化展示，非法 JSON 显示原文和解析错误。
- [x] Given 当前磁盘文件 checksum 与 manifest 不一致，When Workbench 读取当前文档，Then 显示 checksum mismatch，并保持审核 approve 阻止状态。
- [x] Given revision 读取失败或 relativePath 不安全，When Renderer 通过 IPC 请求读取，Then main 端拒绝并返回中文错误，Renderer 不直接读取本地路径。

TDD 执行计划：

- [x] 先补 `pipeline-patch-work-service.test.ts`：覆盖 list revisions、read revision checksum、current checksum mismatch、unsafe relativePath 拒绝。
- [x] 先补 shared / service / IPC 相关类型编译路径：新增 `PatchWorkDocumentRevision`、revision read input，并在 main service 测试中覆盖只通过 `sessionId + relativePath + revision` 读取。
- [x] 先补 `PatchWorkDocumentWorkbench.test.tsx`：覆盖 markdown / patch / json / text view model、revision selector、current / accepted badge、checksum mismatch / read error。
- [x] 先更新 `ReviewDocumentBoard.test.tsx`、`TesterResultBoard.test.tsx`、`CommitterPanel.test.tsx`：确认三个面板都输出统一 Workbench 所需文档列表，缺 checksum / read error 仍阻止 approve。
- [x] 运行新增测试并确认失败点来自未实现 Phase 3 行为。
- [x] 实现 `pipeline-patch-work-service.ts` list/read revision：复用现有 realpath / lstat / symlink 路径安全，不改变 manifest 结构，读取 current 时校验 manifest checksum 并返回 `checksumMatches`。
- [x] 实现 shared IPC / preload / main handler：新增 `LIST_PATCH_WORK_REVISIONS`、`READ_PATCH_WORK_REVISION`，必要时新增受控 `OPEN_PATCH_WORK_FILE`；Renderer 只传 `sessionId`、`relativePath`、`revision`。
- [x] 新增 `PatchWorkDocumentWorkbench.tsx` 和轻量 view model：文件分组、渲染语言推断、badge、revision selector、current vs accepted compare。
- [x] 将 `ReviewDocumentBoard`、`TesterResultBoard`、`CommitterPanel` 内联 `<pre>` 替换为统一 Workbench，保留既有审核按钮、警告和提交动作语义。
- [x] 递增受影响 package patch version，并同步 `bun.lock`。
- [x] 更新 development checklist、next-session prompt 和本节 Review。
- [x] 运行 Phase 3 聚焦测试、Electron typecheck、`bun install --frozen-lockfile --dry-run`、`git diff --check`，核对 staged 范围后单独提交 Phase 3 成果。

触达边界：

- [x] 允许触达：`packages/shared/src/types/pipeline.ts`、`packages/shared/package.json`、`apps/electron/package.json`、`bun.lock`、Pipeline patch-work service / IPC / preload、Pipeline Workbench / gate 面板 / hook / tests、Phase 3 文档状态、`tasks/todo.md`。
- [x] 不触达：`pipeline-graph.ts`、Claude / Codex runner、Git submission 真实写逻辑、Contribution Dashboard / SubmissionPlan、远端写确认增强、根 `README.md`、根 `AGENTS.md`、`patch-work/**`、远端 push / PR 行为。

验证命令：

```bash
bun test apps/electron/src/main/lib/pipeline-patch-work-service.test.ts apps/electron/src/main/lib/pipeline-service.test.ts
```

```bash
bun test apps/electron/src/renderer/components/pipeline/PatchWorkDocumentWorkbench.test.tsx apps/electron/src/renderer/components/pipeline/ReviewDocumentBoard.test.tsx apps/electron/src/renderer/components/pipeline/TesterResultBoard.test.tsx apps/electron/src/renderer/components/pipeline/CommitterPanel.test.tsx
```

```bash
bun run --filter='@codeinsights/electron' typecheck
bun install --frozen-lockfile --dry-run
git diff --check -- packages/shared apps/electron bun.lock tasks/todo.md docs/improve/pipeline/v1
```

## 2026-05-29 Pipeline v1 Phase 3 Patch-work Document Workbench Review

- 阶段范围：只完成 Phase 3 只读 Patch-work Document Workbench MVP；未修改 Graph、Claude / Codex runner、Git submission 真实写逻辑、远端写确认语义、根 `README.md` 或根 `AGENTS.md`，未执行真实远端写。
- 主要变更：新增 `PatchWorkDocumentRevision`、`LIST_PATCH_WORK_REVISIONS`、`READ_PATCH_WORK_REVISION` 和受控 `OPEN_PATCH_WORK_FILE`；main 端通过 `sessionId + relativePath + revision` 读取 patch-work revision，复用 realpath / lstat / symlink 路径安全，current 读取会返回 checksum 匹配状态。
- Workbench 与面板：新增 `PatchWorkDocumentWorkbench`，支持 markdown、patch/diff、json/text、revision selector、current / accepted / checksum mismatch / read error badge、current vs accepted 对比；`ReviewDocumentBoard`、`TesterResultBoard`、`CommitterPanel` 已接入统一 Workbench。
- 版本同步：`@codeinsights/shared` 提升到 `0.1.52`，`@codeinsights/electron` 提升到 `0.0.125`，`bun.lock` 已同步。
- 验证命令：`bun test apps/electron/src/main/lib/pipeline-patch-work-service.test.ts apps/electron/src/main/lib/pipeline-service.test.ts`；`bun test apps/electron/src/renderer/components/pipeline/PatchWorkDocumentWorkbench.test.tsx apps/electron/src/renderer/components/pipeline/ReviewDocumentBoard.test.tsx apps/electron/src/renderer/components/pipeline/TesterResultBoard.test.tsx apps/electron/src/renderer/components/pipeline/CommitterPanel.test.tsx`；`bun run --filter='@codeinsights/electron' typecheck`；`bun run --filter='@codeinsights/electron' build:renderer`；`bun install --frozen-lockfile --dry-run`；`git diff --check -- packages/shared apps/electron bun.lock tasks/todo.md docs/improve/pipeline/v1`。
- 未完成项：Phase 4 Contribution Dashboard / SubmissionPlan、Phase 5 远端写确认增强、Phase 6 真实端到端验收仍未开始。
- 阶段提交：`4cdcc128 feat(pipeline): 完成 Pipeline v1 Phase 3 Patch-work Workbench`。

## 2026-05-29 Pipeline v1 Phase 2 后状态再同步计划

范围确认：本轮只响应用户要求，同步 Pipeline v1 Phase 2 完成后的最新开发状态、完成/未完成清单、下次启动提示词和长期习惯；不修改业务代码，不修改根 `README.md` / 根 `AGENTS.md`，不安装依赖，不 push、不创建 PR、不执行真实远端写。

- [x] 复核当前分支、工作树和最近提交，确认 Phase 2 实现提交为 `dbd980c2 feat(pipeline): 完成 Pipeline v1 Phase 2 PipelineView 拆分`，Phase 2 后状态同步提交为 `6c54f71b docs(pipeline): 同步 Phase 2 后续开发状态`。
- [x] 更新 Pipeline v1 development checklist：明确最新恢复入口为 `6c54f71b`，Phase 0-2 已完成，Phase 3-6 未完成，下一步从 Phase 3 Patch-work Document Workbench 继续。
- [x] 更新 Pipeline v1 `next-session-prompt.md`：把启动检查里的最近历史补齐到 `6c54f71b`，并保持 Phase 3 启动入口。
- [x] 更新 `tasks/lessons.md`：把用户再次强调的“每个阶段性任务完成后自动同步文档和给提示词”固化为更具体的默认动作。
- [x] 在本节追加 Review，运行文档 diff check，单独提交本轮状态同步改动。

## 2026-05-29 Pipeline v1 Phase 2 后状态再同步 Review

- 已确认当前分支 `pipeline-improve` 工作基线：`dbd980c2 feat(pipeline): 完成 Pipeline v1 Phase 2 PipelineView 拆分`，状态同步基线：`6c54f71b docs(pipeline): 同步 Phase 2 后续开发状态`。
- 已更新 Pipeline v1 development checklist：新增最新恢复入口 `6c54f71b`，已完成项明确为 Phase 0 / Phase 1 / Phase 2，未完成项明确为 Phase 3-6，下一步从 Phase 3 Patch-work Document Workbench 继续。
- 已更新 `docs/improve/pipeline/v1/next-session-prompt.md`：启动检查最近历史补齐 `6c54f71b`，当前真实进度写清 Phase 2 后续开发状态已同步。
- 已更新 `tasks/lessons.md`：用户再次强调“每个阶段性任务完成后自动做文档状态同步和给提示词”时，默认复核并补齐最新恢复入口、完成/未完成清单和下一阶段启动提示词。
- 本轮只修改状态文档、任务记录和 lessons；未修改业务代码、根 `README.md`、根 `AGENTS.md`，未安装依赖，未 push / PR / 远端写。
- 验证：`git diff --check -- docs/improve/pipeline/v1 tasks/todo.md tasks/lessons.md`。

## 2026-05-29 Pipeline v1 Phase 2 PipelineView 拆分计划

范围确认：本轮只做 Phase 2。目标是在保持行为不变的前提下，把 `PipelineView` 中的记录加载、状态回填、patch-work 文档读取、gate 面板选择、preflight 启动状态迁出为 hooks / view models；同时收敛 Phase 1 遗留的 preflight result 超过 60 秒或 workspace 变化后的“需要刷新”显式标记。不修改 Graph、runner、Git submission 真实写逻辑，不新增真实 Git 写操作，不执行远端写，不修改根 `README.md` / 根 `AGENTS.md`。

BDD 验收场景：

- [x] Given 用户切换 Pipeline session，When `PipelineView` 挂载新 session，Then records cursor 会重置并只应用当前 session 的 tail load。
- [x] Given records refresh version 增加，When tail records 加载完成，Then 合并逻辑保持去重和顺序，过期 load 不覆盖新结果。
- [x] Given pending gate 需要读取 patch-work 文档，When 文档 refs 变化，Then 只读取缺失文档，保留成功内容，并为失败路径展示对应中文错误。
- [x] Given preflight result 已超过 60 秒或当前 workspace 与结果 workspace 不一致，When 用户准备启动 Pipeline，Then UI 明确标记“需要刷新”，并阻止直接复用旧 acknowledgement。
- [x] Given 当前 gate 是 explorer / planner / developer / reviewer / tester / committer，When 构建主面板，Then `PipelineView` 渲染与拆分前一致的专用面板和 fallback gate card。

TDD 执行计划：

- [x] 先补 view model / hook 聚焦测试：新增 `pipeline-gate-panel-model.test.ts` 覆盖 gate 面板选择、review document refs、operation id 和 fallback gate 行为。
- [x] 先补 preflight freshness 测试：在 `pipeline-preflight.test.ts` 覆盖超过 60 秒、workspaceId 变化、fresh result 三类“需要刷新”判断。
- [x] 先补 records hook 可测试模型：扩展 `pipeline-record-tail-model.test.ts` 或新增轻量 helper 测试，覆盖 session 切换后旧 tail load 不应用。
- [x] 运行新增测试并确认失败点来自未实现 Phase 2 行为。
- [x] 新增 `pipeline-gate-panel-model.ts`：集中计算当前 gate 面板、阶段输出、review document refs、reviewer content 和提交 operation id。
- [x] 新增 `usePipelineRecordsTail.ts`：封装 records state、cursor、load seq、refresh version 拉取与合并。
- [x] 新增 `usePipelineSessionSnapshot.ts`：封装 `getPipelineSessionState()` 回填 session / state / pending gate 的副作用。
- [x] 新增 `usePipelinePatchWorkDocuments.ts`：封装 patch-work 文档内容、loading、error map 和 refs 变化读取。
- [x] 收敛 `pipeline-preflight.ts` 或新增小 helper：判断 preflight stale / workspace mismatch，并让 `PipelineView` 和 `PipelinePreflightPanel` 使用显式“需要刷新”状态。
- [x] 精简 `PipelineView.tsx` 为布局编排层，保持现有 props、按钮文案、面板渲染和错误处理行为不变。
- [x] 如修改功能代码，递增受影响 package patch version，并同步 `bun.lock`。
- [x] 更新 development checklist、next-session prompt 和本节 Review。
- [x] 运行 Phase 2 聚焦测试、Electron typecheck、`bun install --frozen-lockfile --dry-run`、`git diff --check`，核对 staged 范围后单独提交 Phase 2 成果。

触达边界：

- [x] 允许触达：`apps/electron/src/renderer/components/pipeline/PipelineView.tsx`、Pipeline renderer hooks / view model / tests、`apps/electron/package.json`、`bun.lock`、Phase 2 文档状态、`tasks/todo.md`。
- [x] 如 preflight helper 类型需要补充，允许触达 `apps/electron/src/renderer/components/pipeline/pipeline-preflight.ts` 和 `PipelinePreflightPanel.tsx`。
- [x] 不触达：`pipeline-graph.ts`、Claude / Codex runner、Git submission 真实写逻辑、main process service / IPC / preload（除非测试证明 Phase 2 必需）、根 `README.md`、根 `AGENTS.md`、`patch-work/**`、远端 push / PR 行为。

验证命令：

```bash
bun test apps/electron/src/renderer/components/pipeline/pipeline-gate-panel-model.test.ts apps/electron/src/renderer/components/pipeline/pipeline-preflight.test.ts apps/electron/src/renderer/components/pipeline/pipeline-record-tail-model.test.ts
```

```bash
bun test apps/electron/src/renderer/components/pipeline/PipelineComposer.test.ts apps/electron/src/renderer/components/pipeline/PipelinePreflightPanel.test.tsx apps/electron/src/renderer/components/pipeline/ReviewDocumentBoard.test.tsx apps/electron/src/renderer/components/pipeline/ReviewerIssueBoard.test.tsx apps/electron/src/renderer/components/pipeline/TesterResultBoard.test.tsx apps/electron/src/renderer/components/pipeline/CommitterPanel.test.tsx
```

```bash
bun run --filter='@codeinsights/electron' typecheck
bun install --frozen-lockfile --dry-run
git diff --check -- apps/electron bun.lock tasks/todo.md docs/improve/pipeline/v1
```

## 2026-05-29 Pipeline v1 Phase 2 PipelineView 拆分 Review

- 阶段范围：只完成 Phase 2；未修改 Graph、Claude / Codex runner、Git submission 真实写逻辑、main IPC / preload、根 `README.md` 或根 `AGENTS.md`，未执行真实远端写。
- 主要变更：新增 `pipeline-gate-panel-model.ts` 和 `PipelineGateSidePanel.tsx`，把 gate 面板选择、review document refs、reviewer 正文和 committer operation id 从 `PipelineView` 中抽离；新增 `usePipelineRecordsTail`、`usePipelineSessionSnapshot`、`usePipelinePatchWorkDocuments`、`usePipelineExplorerReports`、`usePipelineGateActions`，迁出 records tail、session snapshot、patch-work 文档读取、explorer reports 和 gate action 副作用。
- Preflight 收敛：新增 60 秒 TTL / workspace mismatch freshness helper；`PipelinePreflightPanel` 在 result 过期或 workspace 变化时明确显示“启动前检查需要刷新”，隐藏风险确认入口，并让 Composer 禁止复用旧 acknowledgement 直接启动。
- 行为确认：records session 切换会重置 cursor 并让旧 tail load 失效；patch-work 文档读取按 relativePath/checksum/revision 签名缓存，refs 变化时只读取缺失或变化文档；右侧 explorer / planner / developer / reviewer / tester / committer / fallback gate 面板保持原交互。
- 版本同步：`@codeinsights/electron` 提升到 `0.0.124`，`bun.lock` 已同步。
- 验证命令：`bun test apps/electron/src/renderer/components/pipeline/pipeline-gate-panel-model.test.ts apps/electron/src/renderer/components/pipeline/pipeline-preflight.test.ts apps/electron/src/renderer/components/pipeline/pipeline-record-tail-model.test.ts apps/electron/src/renderer/components/pipeline/PipelineComposer.test.ts apps/electron/src/renderer/components/pipeline/PipelinePreflightPanel.test.tsx apps/electron/src/renderer/components/pipeline/ReviewDocumentBoard.test.tsx apps/electron/src/renderer/components/pipeline/ReviewerIssueBoard.test.tsx apps/electron/src/renderer/components/pipeline/TesterResultBoard.test.tsx apps/electron/src/renderer/components/pipeline/CommitterPanel.test.tsx`；`bun run --filter='@codeinsights/electron' typecheck`；`bun install --frozen-lockfile --dry-run`；`git diff --check -- apps/electron bun.lock tasks/todo.md docs/improve/pipeline/v1`。
- 未完成项：Phase 3 Patch-work Document Workbench、Phase 4 Contribution Dashboard / SubmissionPlan、Phase 5 远端写确认增强、Phase 6 真实端到端验收仍未开始。
- 阶段提交：`dbd980c2 feat(pipeline): 完成 Pipeline v1 Phase 2 PipelineView 拆分`。

## 2026-05-29 Pipeline v1 Phase 1 后状态同步计划

范围确认：本轮只同步 Pipeline v1 Phase 1 完成后的最新开发状态、下次启动提示词、任务记录和长期习惯；不修改业务代码，不修改根 `README.md` / 根 `AGENTS.md`，不安装依赖，不 push、不创建 PR、不执行真实远端写。

- [x] 复核当前分支、工作树和最近提交，确认 Phase 1 已提交为 `ff515a01 feat(pipeline): 完成 Pipeline v1 Phase 1 Preflight 主路径`。
- [x] 更新 Pipeline v1 development checklist：写清 Phase 0 / Phase 1 已完成并提交、Phase 2-6 未完成、下一步从 Phase 2 PipelineView 拆分继续。
- [x] 更新 Pipeline v1 `next-session-prompt.md`：写入真实开发基线 `ff515a01`，并明确下次启动要确认其或其后的状态同步提交在历史中。
- [x] 更新 `tasks/lessons.md`：把“每个阶段完成后自动同步开发状态文档、next-session prompt、todo Review 和最终可复制提示词”固化为 Pipeline v1 默认收尾习惯。
- [x] 在本节追加 Review，运行文档 diff check，单独提交本轮状态同步改动。

## 2026-05-29 Pipeline v1 Phase 1 后状态同步 Review

- 已确认当前最新开发基线为 `ff515a01 feat(pipeline): 完成 Pipeline v1 Phase 1 Preflight 主路径`，历史包含 `30399335 docs(pipeline): 同步 Phase 0 后续开发状态` 和 `ca1bcf77 feat(pipeline): 完成 Pipeline v1 Phase 0 清理与对齐`。
- 已更新 Pipeline v1 development checklist：明确 Phase 0 / Phase 1 已完成，Phase 2-6 未完成，下一步从 Phase 2 PipelineView 拆分继续；同时记录 preflight result 超过 60 秒或 workspace 变化后的“需要刷新”显式标记仍留给 Phase 2 收敛。
- 已更新 `docs/improve/pipeline/v1/next-session-prompt.md`：下次启动提示词要求确认 `ff515a01` 或其后的状态同步提交，并直接从 Phase 2 继续。
- 已更新 `tasks/lessons.md`：阶段完成后自动同步 development checklist、next-session prompt、`tasks/todo.md` Review 和最终可复制提示词，不需要用户再次提醒。
- 本轮只修改状态文档和任务记录；未修改业务代码、根 `README.md`、根 `AGENTS.md`，未安装依赖，未 push / PR / 远端写。
- 验证：`git diff --check -- docs/improve/pipeline/v1 tasks/todo.md tasks/lessons.md`。

## 2026-05-29 Pipeline v1 Phase 1 Preflight 主路径计划

范围确认：本轮只做 Phase 1。把已有 repository preflight 接入 IPC / preload / Renderer 启动前主路径，并在 `PipelineService.start()` 服务端复验 blocker；warning 需要用户明确接受并留下审计记录。不改 runner / Graph，不新增真实 Git 写操作，不执行真实远端写，不修改根 `README.md` / 根 `AGENTS.md`，不安装依赖。

BDD 验收场景：

- [x] Given 目标 workspace 不存在 Git root / 存在 Git 冲突 / 缺失必需 runtime，When 用户准备启动 Pipeline，Then Renderer 展示 blocker 且启动按钮不可用。
- [x] Given Renderer 被绕过或传入过期确认，When `PipelineService.start()` 服务端 preflight 发现 blocker，Then 不调用 Graph invoke，并写入可解释失败记录。
- [x] Given preflight 只有 dirty worktree 等 warning，When 用户未确认风险，Then Renderer 禁止启动；When 用户明确“记录风险继续”，Then start payload 携带 warning acknowledgement。
- [x] Given warning acknowledgement 与服务端最新 preflight fingerprint 不匹配，When start 被调用，Then 服务端要求重新确认，不进入 Graph。
- [x] Given warning acknowledgement 匹配，When start 成功进入 Pipeline，Then warning 接受行为至少写入 Pipeline records 或 ContributionTask event。

TDD 执行计划：

- [x] 先补 main 测试：`pipeline-preflight-service.test.ts` 覆盖 Git root 缺失 / 非 Git root / conflict blocker / dirty warning / runtime 缺失和 preflight fingerprint。
- [x] 先补 service 测试：`pipeline-service.test.ts` 覆盖 blocker 不调用 Graph、warning 未确认阻断、过期 / 重复 / 未知 warning acknowledgement 阻断、确认后可启动并留下审计记录。
- [x] 先补 renderer 测试：`pipeline-preflight.test.ts` 保持渠道 / 工作区错误原行为；`PipelinePreflightPanel.test.tsx` 覆盖 blocker / warning / runtime status 展示与重新检查入口；`PipelineComposer.test.ts` 覆盖 preflight 早退不清空输入。
- [x] 运行新增测试并确认失败点来自未实现 Phase 1 行为。
- [x] 实现 shared IPC / preload / main handler：新增 repository preflight API，Renderer 只传 session/workspace 相关白名单字段，服务端忽略 renderer 传入的路径 / require override。
- [x] 实现 `PipelineService.start()` 服务端 preflight：blocker 阻断 Graph invoke；warning ack 必须匹配最新 fingerprint / warning code；服务端重写 acknowledgement 审计时间；审计记录不写入 secret。
- [x] 实现 Renderer 启动前 preflight：展示 repository / runtime / package manager / blockers / warnings；blocker 禁止启动但可重新检查；warning 需显式接受。
- [x] 递增受影响 package patch version，并同步 `bun.lock`。
- [x] 更新 development checklist、next-session prompt 和本节 Review。
- [x] 运行 Phase 1 聚焦测试、Electron typecheck、`git diff --check`，核对 staged 范围后单独提交 Phase 1 成果。

触达边界：

- [x] 允许触达：`packages/shared/src/types/pipeline.ts`、`packages/shared/package.json`、`apps/electron/package.json`、`bun.lock`、Pipeline preflight/service/IPC/preload、Pipeline renderer preflight panel / atoms / tests、Phase 1 文档状态、`tasks/todo.md`。
- [x] 不触达：`pipeline-graph.ts`、Claude / Codex runner、Git submission 真实写逻辑、根 `README.md`、根 `AGENTS.md`、`patch-work/**`、远端 push / PR 行为。

验证命令：

```bash
bun test apps/electron/src/main/lib/pipeline-preflight-service.test.ts apps/electron/src/main/lib/pipeline-service.test.ts
```

```bash
bun test apps/electron/src/renderer/components/pipeline/pipeline-preflight.test.ts apps/electron/src/renderer/components/pipeline/PipelinePreflightPanel.test.tsx apps/electron/src/renderer/components/pipeline/PipelineComposer.test.ts
```

```bash
bun run --filter='@codeinsights/electron' typecheck
git diff --check -- packages/shared apps/electron bun.lock tasks/todo.md docs/improve/pipeline/v1
```

## 2026-05-29 Pipeline v1 Phase 1 Preflight 主路径 Review

- 阶段范围：只完成 Phase 1；未修改 Graph、Claude / Codex runner、Git submission 真实写逻辑、远端 push / PR 行为、根 `README.md` 或根 `AGENTS.md`。
- 主要变更：新增 `PipelineRunPreflightInput`、`PipelinePreflightAcknowledgement`、preflight fingerprint / checkedAt 和 `RUN_PREFLIGHT` IPC；preload 暴露 `runPipelinePreflight()`；main 端 `PipelineService.runPreflight()` 复用已有 repository preflight；`PipelineService.start()` 对 v2 会话服务端复验，blocker / 未确认 warning / 过期 warning acknowledgement 均阻断 Graph invoke。
- Renderer 变更：新增 `PipelinePreflightPanel` 和 preflight acknowledgement helper；`PipelineView` 在启动前调用 repository preflight，blocker 禁止启动但提供“重新检查”，warning 需点击“记录风险继续”后才会把 acknowledgement 带给 start；preflight 早退不会清空用户任务输入；渠道 / 工作区配置错误仍保留原设置跳转。
- 审计与安全：warning acknowledgement 匹配最新 fingerprint 和 warning code 后，会由服务端重写 `acknowledgedAt` 并写入 `preflight_completed` ContributionTask event；fingerprint 纳入 HEAD / dirty status digest；RUN_PREFLIGHT IPC 不接受 renderer 路径 / require override；remote URL query/hash、Authorization、token、api key 形态诊断已脱敏。
- 版本同步：`@codeinsights/shared` 提升到 `0.1.51`，`@codeinsights/electron` 提升到 `0.0.123`，`bun.lock` 已同步。
- 验证命令：`bun test apps/electron/src/main/lib/pipeline-preflight-service.test.ts apps/electron/src/main/lib/pipeline-service.test.ts apps/electron/src/renderer/components/pipeline/pipeline-preflight.test.ts apps/electron/src/renderer/components/pipeline/PipelinePreflightPanel.test.tsx apps/electron/src/renderer/components/pipeline/PipelineComposer.test.ts`；`bun run --filter='@codeinsights/electron' typecheck`；`bun install --frozen-lockfile --dry-run`；`git diff --check -- packages/shared apps/electron bun.lock tasks/todo.md docs/improve/pipeline/v1`。
- 未完成项：Phase 2 PipelineView 拆分、Phase 3 Patch-work Document Workbench、Phase 4 Contribution Dashboard / SubmissionPlan、Phase 5 远端写确认增强、Phase 6 真实端到端验收仍未开始。
- 阶段提交：`ff515a01 feat(pipeline): 完成 Pipeline v1 Phase 1 Preflight 主路径`。

## 2026-05-29 Pipeline v1 Phase 0 后状态同步计划

范围确认：本轮只同步 Pipeline v1 Phase 0 完成后的最新开发状态、下次启动提示词、任务记录和长期习惯；不修改业务代码，不修改根 `README.md` / 根 `AGENTS.md`，不安装依赖，不 push、不创建 PR、不执行真实远端写。

- [x] 复核当前分支、工作树和最近提交，确认 Phase 0 已提交为 `ca1bcf77 feat(pipeline): 完成 Pipeline v1 Phase 0 清理与对齐`。
- [x] 更新 Pipeline v1 development checklist：写清 Phase 0 已完成并提交、Phase 1-6 未完成、下一步从 Phase 1 Preflight 主路径继续。
- [x] 更新 Pipeline v1 `next-session-prompt.md`：写入真实开发基线 `ca1bcf77`，并明确下次启动要确认其或其后的状态同步提交在历史中。
- [x] 更新 `tasks/lessons.md`：把“阶段完成后自动同步开发状态文档和下次启动提示词”固化为 Pipeline v1 默认收尾习惯。
- [x] 在本节追加 Review，运行文档 diff check，单独提交本轮状态同步改动。

## 2026-05-29 Pipeline v1 Phase 0 后状态同步 Review

- 已更新 Pipeline v1 development checklist：最新开发基线明确为 `ca1bcf77 feat(pipeline): 完成 Pipeline v1 Phase 0 清理与对齐`，已完成项包含方案文档、开发清单、阶段提交习惯和 Phase 0；未完成项明确为 Phase 1-6。
- 已更新 `docs/improve/pipeline/v1/next-session-prompt.md`：下次启动直接从 Phase 1 Preflight 主路径继续，启动检查要求确认 `ca1bcf77` 或其后的状态同步提交在历史中。
- 已更新 `tasks/lessons.md`：Pipeline v1 阶段完成后自动同步 development checklist、next-session prompt、`tasks/todo.md` Review，并在最终回复给可复制提示词。
- 本轮只改状态文档和任务记录；未修改业务代码、根 `README.md`、根 `AGENTS.md`，未安装依赖，未 push / PR / 远端写。
- 验证：`git diff --check -- docs/improve/pipeline/v1 tasks/todo.md tasks/lessons.md`。

## 2026-05-29 Pipeline v1 Phase 0 清理与对齐计划

范围确认：本轮只做 Phase 0。修复 v2 Records 中 `committer` 的可见性与排序，新增打开仓库内 `patch-work/` 的受控 IPC / preload / UI 入口，清理 shared Pipeline 类型中的明显过期注释；不改 Graph、不改 runner、不改 Git submission、不接入完整 Preflight Center，不修改根 `README.md` / 根 `AGENTS.md`，不安装依赖，不 push、不创建 PR、不执行真实远端写。

BDD 验收场景：

- [x] Given 当前会话 version 为 2，When 打开 Records 阶段过滤，Then 过滤项包含 `committer` / “提交”。
- [x] Given 当前会话 version 为 1 或历史旧会话缺少 version，When 打开 Records 阶段过滤，Then 不显示 `committer` / “提交”。
- [x] Given v2 records 中存在 `tester` 和 `committer` artifact，When 构建 artifact group，Then `committer` 稳定排在 `tester` 后。
- [x] Given v2 Tester / Committer 面板展示 patch-work 产物，When 用户点击打开目录，Then main process 只基于 `sessionId` 打开该会话仓库内 `patch-work/`，Renderer 不能传任意路径。

TDD 执行计划：

- [x] 先补 renderer / view model 测试：`PipelineRecords.test.ts` 覆盖 v2 committer filter 与 v1 兼容；`pipeline-record-view-model.test.ts` 覆盖 v2 group 排序。
- [x] 先补 main IPC / service 聚焦测试：覆盖 `openPipelinePatchWorkDir(sessionId)` 只从服务端解析 repo 内 patch-work 路径。
- [x] 运行新增测试并确认失败点来自未实现行为。
- [x] 实现 `PipelineRecords` version-aware filter，`PipelineView` 传入 session/state version，record group 排序改用 `getPipelineNodeOrder(version)`。
- [x] 实现 `OPEN_PATCH_WORK_DIR` shared IPC 常量、main handler、preload API、`PipelineService` 受控目录解析 / 打开入口。
- [x] 在 `TesterResultBoard.tsx` 和 `CommitterPanel.tsx` 增加打开 `patch-work/` 的 UI 入口，保持按钮状态与现有面板风格一致。
- [x] 检查 `packages/shared/src/types/pipeline.ts` 的 Pipeline 注释，只清理明显过期说明，不改行为。
- [x] 递增受影响 package patch version，并同步 `bun.lock`。
- [x] 更新开发清单 Phase 0 状态和 `docs/improve/pipeline/v1/next-session-prompt.md`。
- [x] 运行 Phase 0 聚焦测试、Electron typecheck、`git diff --check`，追加本节 Review。
- [x] 核对 `git status --short` / staged diff 范围后，单独提交 Phase 0 成果，提交信息使用详细中文。

触达边界：

- [x] 允许触达：`packages/shared/src/types/pipeline.ts`、`packages/shared/package.json`、`apps/electron/package.json`、`bun.lock`、Pipeline IPC / preload / service、Records / Tester / Committer 相关组件与测试、Phase 0 文档状态、`tasks/todo.md`。
- [x] 不触达：`pipeline-graph.ts`、Claude / Codex runner、Git submission 行为、完整 Preflight Center、根 `README.md`、根 `AGENTS.md`。

验证命令：

```bash
bun test apps/electron/src/renderer/components/pipeline/PipelineRecords.test.ts apps/electron/src/renderer/components/pipeline/pipeline-record-view-model.test.ts apps/electron/src/renderer/components/pipeline/pipeline-record-experience-model.test.ts
```

```bash
bun test apps/electron/src/main/lib/pipeline-service.test.ts apps/electron/src/renderer/components/pipeline/TesterResultBoard.test.tsx apps/electron/src/renderer/components/pipeline/CommitterPanel.test.tsx
```

```bash
bun run --filter='@codeinsights/electron' typecheck
git diff --check -- packages/shared apps/electron bun.lock tasks/todo.md docs/improve/pipeline/v1
```

## 2026-05-29 Pipeline v1 Phase 0 清理与对齐 Review

- 阶段范围：只完成 Phase 0；未接入 Preflight Center，未修改 Graph、runner、Git submission、远端 PR 行为、根 `README.md` 或根 `AGENTS.md`。
- 主要变更：Records 阶段过滤按 `PipelineVersion` 生成，v2 显示 `committer` / “提交”，v1 和缺失 version 的旧会话保持五阶段；artifact group / stage focus / Markdown report 使用 version-aware 分组；新增 `openPipelinePatchWorkDir(sessionId)` shared IPC / preload / main handler / service / Tester / Committer UI 入口；shared 节点类型注释已对齐 v1/v2 事实。
- 触达文件：`packages/shared/src/types/pipeline.ts`、`packages/shared/package.json`、`apps/electron/package.json`、`bun.lock`、`apps/electron/src/main/ipc/pipeline-handlers.ts`、`apps/electron/src/preload/index.ts`、`apps/electron/src/main/lib/pipeline-service.ts`、`apps/electron/src/main/lib/pipeline-patch-work-service.ts`、Pipeline Records / Tester / Committer 组件与测试、v1 checklist、next-session prompt。
- 验证命令：`bun test apps/electron/src/renderer/components/pipeline/PipelineRecords.test.ts apps/electron/src/renderer/components/pipeline/pipeline-record-view-model.test.ts apps/electron/src/renderer/components/pipeline/pipeline-record-experience-model.test.ts apps/electron/src/main/lib/pipeline-service.test.ts apps/electron/src/renderer/components/pipeline/TesterResultBoard.test.tsx apps/electron/src/renderer/components/pipeline/CommitterPanel.test.tsx`；`bun run --filter='@codeinsights/electron' typecheck`。
- 兼容性确认：旧 v1 会话 filter 不显示 `committer`；已有 committer record 不被隐藏；新建 v2 路径可从 Records 与 Tester / Committer 面板看到提交阶段相关入口。
- 安全确认：Renderer 不传本地路径，只传 `sessionId`；main 端通过 ContributionTask 的 `repositoryRoot` 重新解析固定 `repoRoot/patch-work`，并复用 realpath / lstat / symlink 检查，额外拒绝非目录路径。
- 未完成项：Phase 1 Preflight 主路径、PipelineView 拆分、Patch-work Workbench、Contribution Dashboard / SubmissionPlan、远端写确认增强、真实端到端验收均未开始。
- 阶段提交：`ca1bcf77 feat(pipeline): 完成 Pipeline v1 Phase 0 清理与对齐`。

## 2026-05-28 Agent Runtime 设置页补齐 Codex 可选计划

范围确认：本轮只处理用户反馈的 Agent Runtime 设置页缺少 Codex 选项问题，让 Codex 和 opencode 一样在设置页默认可见并可由用户切换；不修改根 `README.md` / `AGENTS.md`，不执行真实 Codex / opencode 模型 smoke，不改变 `OPENCODE_CONFIG_DIR` 默认关闭策略。

- [x] 复核当前 git 状态、最近提交和 Codex feature gate 位置，确认工作树干净且问题来自 renderer 选项过滤和 main preflight gate。
- [x] 移除 renderer 对 Codex Runtime 的构建时隐藏 / 禁用逻辑，设置页 Runtime 三选默认展示 `Claude Code / Codex / opencode`。
- [x] 移除 main process 对 Codex Runtime 的环境变量可用性判断，让用户选择 Codex 后可进入已注册 runtime；保留后续凭证 / 模型 / runtime 自身诊断。
- [x] 更新相关单测，覆盖 Codex 默认可选、settings 选择 Codex 不再依赖 `CODEINSIGHTS_AGENT_CODEX_RUNTIME=1`。
- [x] 按受影响包规则提升 `@codeinsights/electron` patch 版本并同步 lockfile。
- [x] 运行聚焦单测、Electron typecheck、renderer build（显式 `CODEINSIGHTS_AGENT_CODEX_RUNTIME=0`）、main build、lockfile dry-run 和 diff check。
- [x] 在本节追加 Review，并按阶段纪律提交本轮变更。

## 2026-05-28 Agent Runtime 设置页补齐 Codex 可选 Review

- 已修正 renderer：Settings -> Agent Runtime 默认展示 `Claude Code / Codex / opencode` 三选；Codex 切换不再受 `CODEINSIGHTS_AGENT_CODEX_RUNTIME=1` 构建常量过滤，也不再在初始化时被回退到 Claude Code。
- 已修正 main process：Codex runtime capability 诊断默认可用，orchestrator 不再因缺少 `CODEINSIGHTS_AGENT_CODEX_RUNTIME=1` 返回 `codex_runtime_disabled` preflight error；用户选择 Codex 后会进入已注册 runtime，后续凭证 / 模型 / runtime 依赖仍由真实诊断和错误路径处理。
- 已同步 Codex / opencode support 文档和 `tasks/lessons.md`：Codex / opencode 都是设置页默认可选 runtime；旧 feature flag 只作为历史 rollout 记录，不再作为用户选择前置条件。
- 保持边界：未修改根 `README.md` / `AGENTS.md`；未执行真实 Codex / opencode 模型 smoke；`OPENCODE_CONFIG_DIR` 继续默认关闭；真实模型、channel auth、permission 三态、workspace-write、MCP tool-call gated 项没有伪造通过。
- 已按版本规则将 `@codeinsights/electron` 从 `0.0.120` 提升到 `0.0.121`，并同步 `bun.lock` workspace 版本。
- 验证通过：`bun test apps/electron/src/renderer/lib/agent-runtime-ui.test.ts apps/electron/src/main/lib/agent-runtimes/coding-agent-runtime-registry.test.ts apps/electron/src/main/lib/agent-orchestrator.test.ts`；`bun run --filter='@codeinsights/electron' typecheck`；`CODEINSIGHTS_AGENT_CODEX_RUNTIME=0 bun run --filter='@codeinsights/electron' build:renderer`；`bun run --filter='@codeinsights/electron' build:main`；`bun install --frozen-lockfile --dry-run`；`git diff --check -- apps/electron bun.lock docs/codex-support docs/opencode-support tasks/todo.md tasks/lessons.md`。

## 2026-05-28 Agent opencode Runtime 设置页默认可选计划

范围确认：本轮只处理用户无法在设置页选择 opencode Runtime 的问题，让 opencode 作为已完成 Phase 8 后的可选 Runtime 默认开放；不修改根 `README.md` / `AGENTS.md`，不改变 `OPENCODE_CONFIG_DIR` 默认关闭策略，不执行真实模型 gated smoke。

- [x] 复核项目指令、`tasks/lessons.md`、git 状态和 opencode support 文档入口，确认当前 HEAD 在 Phase 8 状态同步之后且历史包含关键提交。
- [x] 移除 renderer 对 opencode Runtime 的构建时隐藏 / 禁用逻辑，设置页 Runtime 三选默认展示并允许切换 opencode。
- [x] 移除 main process 对 opencode Runtime 的环境变量注册 / 路由阻断逻辑，确保用户选择后能实际进入 opencode runtime。
- [x] 更新相关单测，覆盖 opencode 默认开放、settings 选择 opencode 不再依赖 feature flag、无 env flag 仍可运行已注册 opencode runtime。
- [x] 同步 opencode support 文档和本节 Review，说明 `CODEINSIGHTS_AGENT_OPENCODE_RUNTIME` 不再是设置页选择前置条件。
- [x] 按受影响包规则提升 `@codeinsights/electron` patch 版本并同步 lockfile。
- [x] 运行聚焦单测、Electron typecheck、renderer build（显式 `CODEINSIGHTS_AGENT_OPENCODE_RUNTIME=0`）、diff check。
- [x] 提交本轮变更，提交信息用中文说明设置页默认可选、验证结果和未包含 gated smoke。

## 2026-05-28 Agent opencode Runtime 设置页默认可选 Review

- 已确认根因：Phase 6 留下的 `CODEINSIGHTS_AGENT_OPENCODE_RUNTIME=1` 同时控制 renderer 展示、settings 初始化回退、main process runtime 注册和 orchestrator preflight，因此用户在默认启动时看不到 / 不能选 opencode。
- 已修正 renderer：Settings -> Agent Runtime 默认展示 `Claude Code / Codex / opencode` 三选；opencode 切换不再弹 feature flag 未启用提示；选择 opencode 后会展示 native/channel auth、model、agent、snapshot、server status 和 MCP 摘要配置。
- 已修正 main process：`OpencodeAgentRuntime` 默认注册；runtime selection 默认允许 `opencode`；缺少 `CODEINSIGHTS_AGENT_OPENCODE_RUNTIME=1` 不再阻断新会话或 settings 选择。
- 保持边界：该轮提交时 Codex Runtime 仍受 `CODEINSIGHTS_AGENT_CODEX_RUNTIME=1` 保护；后续 Codex 设置页修正已将 Codex 也默认开放给用户自行切换。已绑定 opencode session 缺少 manifest 时仍阻断 resume；`OPENCODE_CONFIG_DIR` 继续默认关闭；真实模型 / channel auth / permission 三态 / workspace-write / MCP tool-call gated 项没有伪造通过。
- 已同步 opencode support README、development checklist、integration plan 和 next-session prompt；未修改根 `README.md` / `AGENTS.md`。
- 已按版本规则将 `@codeinsights/electron` 从 `0.0.119` 提升到 `0.0.120`，并同步 `bun.lock` workspace 版本。
- 验证通过：`bun test apps/electron/src/renderer/lib/agent-runtime-ui.test.ts apps/electron/src/main/lib/agent-runtimes/coding-agent-runtime-registry.test.ts apps/electron/src/main/lib/agent-orchestrator.test.ts`；`bun run --filter='@codeinsights/electron' typecheck`；`CODEINSIGHTS_AGENT_OPENCODE_RUNTIME=0 bun run --filter='@codeinsights/electron' build:renderer`；`bun run --filter='@codeinsights/electron' build:main`；`bun install --frozen-lockfile --dry-run`；`git diff --check -- apps/electron bun.lock docs/opencode-support tasks/todo.md`。

## 2026-05-28 Agent opencode Runtime Phase 8 后状态同步计划

范围确认：本轮只把 Phase 8 实际提交号 `60bf4764 docs(agent): 完成 opencode Runtime Phase 8 验收文档` 写回 opencode support README、development checklist、next-session prompt 和任务记录；不修改业务代码，不修改根 `README.md` / `AGENTS.md`，不提交打包产物。

- [x] 更新 opencode support README：记录 Phase 8 提交 `60bf4764`，并将下次启动入口改为 `60bf4764` 或其后的状态同步提交。
- [x] 更新 opencode development checklist：记录 Phase 8 完成提交和当前恢复入口。
- [x] 更新 `docs/opencode-support/next-session-prompt.md`：下次启动提示词要求确认 `60bf4764`、`992b560b`、`bcec66d6` 和关键历史提交。
- [x] 运行 `git diff --check -- docs/opencode-support tasks/todo.md`。
- [x] 按状态同步纪律单独提交。

## 2026-05-28 Agent opencode Runtime Phase 8 后状态同步 Review

- 已将 Phase 8 文档提交固定为 `60bf4764 docs(agent): 完成 opencode Runtime Phase 8 验收文档`。
- 已更新 `docs/opencode-support/README.md`、development checklist 和 `next-session-prompt.md`：恢复入口现在要求确认 `60bf4764` 或其后的状态同步提交，同时保留 Phase 7 开发基线 `3ec2ebec` 和关键历史提交。
- 保持边界：未修改根 `README.md` / `AGENTS.md`，未修改业务代码，未提交 `apps/electron/out/` 打包产物。

## 2026-05-28 Agent opencode Runtime Phase 8 真实验收与发布准备计划

范围确认：本轮进入 Phase 8，优先做真实使用验收、故障排查材料、release notes 草稿和公开文档同步准备。继续保持所有 diagnostics、smoke summary、event log 和文档示例 secretless；真实模型 / 凭证相关 smoke 只使用显式 native opencode auth 或 `OPENCODE_SMOKE_API_KEY`，不读取 ambient API key，不伪造通过；不修改根 `README.md` / `AGENTS.md`，除非用户明确允许。

- [x] 读取项目指令、`tasks/lessons.md`，确认阶段提交、状态同步、secretless config、runtime binding、Git guard 和根文档修改边界。
- [x] 运行 `git status --short` 和 `git log -5 --oneline`，确认当前工作树干净，最新提交为 `992b560b docs(agent): 固化 opencode Phase 7 最新启动状态`，历史包含 `bcec66d6`、`3ec2ebec`、`0c84b37a`、`077fbc49`、`bb361a34`、`b3e99265`、`647d3046`。
- [x] 读取 `docs/opencode-support/README.md`、development checklist、integration plan 和 `next-session-prompt.md`，确认 Phase 7 残余与 Phase 8 入口。
- [x] 盘点现有 opencode smoke 脚本、环境变量和 summary 规则，明确哪些 Phase 8 场景已有自动化入口、哪些需要补脚本或只记录 gated / manual。
- [x] 运行无凭证可验证项：binary/server/config/Basic Auth/SSE、MCP config-only/tool discovery、packaged history reload 或对应最小 smoke，确认 summary 不含 secret。
- [x] 运行或记录真实模型 gated 验收：native auth readonly、channel auth readonly、permission reject/once/session allow、workspace-write/file edit、resume、stop、MCP tool-call；缺少凭证或模型时标记 skipped 并写明 reason。
- [x] 复核 Git guard 与 file edit 验收边界：本轮不执行真实 workspace-write file edit，不让 opencode 修改用户仓库；该项按 gated 保留，后续需要临时目录自动化脚本和 refs/index 后验。
- [x] 整理故障排查材料：binary missing、server auth failed、provider auth missing、model not found、MCP auth failed、permission stuck、SSE interrupted。
- [x] 整理发布准备材料：多平台 packaged smoke 状态、DMG `hdiutil create` 残余判断、release notes 草稿、公开文档同步准备；根 `README.md` / `AGENTS.md` 仅列为待用户允许项。
- [x] 更新 opencode development checklist、support README、next-session prompt 和本节 Review，记录所有 passed / skipped / failed 证据。
- [x] 运行 Phase 8 验证命令：`CODEINSIGHTS_AGENT_OPENCODE_RUNTIME=1 bun run --filter='@codeinsights/electron' typecheck`、必要聚焦测试 / smoke、`git diff --check -- docs/opencode-support tasks/todo.md`。
- [x] 按阶段纪律单独提交 Phase 8 成果，提交信息用中文说明完成内容、验证结果、未包含或暂缓项；实际提交号以本轮提交结果和最终回复为准。

## 2026-05-28 Agent opencode Runtime Phase 8 真实验收与发布准备 Review

- 启动基线已确认：当前分支为 `agent-mode-opencode`，本轮开始时最新提交为 `992b560b docs(agent): 固化 opencode Phase 7 最新启动状态`，历史包含 `bcec66d6`、`3ec2ebec`、`0c84b37a`、`077fbc49`、`bb361a34`、`b3e99265`、`647d3046`。
- 已完成 smoke 入口盘点：`apps/electron/scripts/agent-opencode-smoke.ts` 支持 binary/server/config/permission/abort/resume/MCP/packaged/readonly/channel/native；`agent-history-reload-ui-smoke.ts` 支持 packaged reload；permission 三态、workspace-write file edit、MCP tool-call 仍需要后续真实模型或诱导脚本。
- 默认 opencode smoke 通过：binary、server/Basic Auth、config、permission config、abort、resume、MCP config-only/tool discovery 均 passed；readonly/channel/native 在未设置显式 env 时按 reason skipped，summary 未包含 secret。
- native auth readonly 真实 prompt 通过：`OPENCODE_SMOKE_ENABLE_NATIVE=1 OPENCODE_SMOKE_ENABLE_MODEL=1` 时 readonly prompt accepted，native smoke 只记录 `source: native`，不读取 auth 文件内容。
- packaged 验证通过：macOS arm64 packaged app 使用 bundled `opencode-darwin-arm64/bin/opencode`，PATH fallback disabled，server health passed；packaged history reload first-open / reopen 均 passed。
- DMG 残余已复核：本轮 `dist:fast` 成功生成 `out/CodeInsights-0.0.119-arm64.dmg` 和 `.blockmap`；此前 `hdiutil create` 失败不再作为当前阻塞。
- SDK / CLI 复核完成：`@opencode-ai/sdk` 和 `opencode-ai` 的 npm `latest` 仍为 `1.15.11`，当前锁定版本未漂移。
- gated 项保持诚实记录：channel auth readonly 缺少 `OPENCODE_SMOKE_API_KEY`；permission reject / once / session allow 缺少真实 permission request id 或诱导脚本；workspace-write file edit 和 MCP tool-call 未执行；macOS x64 / Windows x64 / Linux packaged smoke 留 CI / 对应平台验证。
- 已更新 `docs/opencode-support/2026-05-27-agent-opencode-runtime-development-checklist.md`、integration plan、support README 和 next-session prompt：记录 smoke 结果、故障排查、release notes 草稿、DMG 最新判断和后续 gated 项。
- 保持边界：未修改根 `README.md` / `AGENTS.md`，未提交 `apps/electron/out/` 打包产物，未读取 ambient API key，未让 opencode 修改用户仓库。
- 验证通过：`CODEINSIGHTS_AGENT_OPENCODE_RUNTIME=1 bun run --filter='@codeinsights/electron' typecheck`；opencode runtime 聚焦单测 34 pass；`git diff --check -- docs/opencode-support tasks/todo.md`；opencode support Markdown code fence 校验。

## 2026-05-28 Agent opencode Runtime Phase 7 最新开发状态同步计划

范围确认：本轮只同步 opencode support 文档、下次启动提示词、任务记录和 lessons，明确 Phase 0-7 已完成、Phase 8 未开始、Phase 7 残余验证项仍未完成；不修改业务代码，不修改根 `README.md` / `AGENTS.md`，不进入真实模型验收、故障排查实战或 release notes。

- [x] 运行 `git status --short` 和 `git log -5 --oneline`，确认当前工作树干净，最新提交为 `bcec66d6 docs(agent): 同步 opencode Phase 7 开发状态`，历史包含 `3ec2ebec`、`0c84b37a`、`077fbc49`、`bb361a34`。
- [x] 复查 `docs/opencode-support/README.md`、development checklist、integration plan、`next-session-prompt.md` 和 `tasks/lessons.md`，定位仍写着“等待本轮状态同步提交”的占位状态。
- [x] 更新 opencode support README：写入最新状态同步提交 `bcec66d6`，明确 Phase 7 已完成、Phase 8 未开始、Phase 7 残余验证项保留。
- [x] 更新 opencode development checklist：把最新状态快照、仓库状态要求和下一步入口对齐到 `bcec66d6`。
- [x] 更新 `docs/opencode-support/next-session-prompt.md`：下次启动提示词要求确认 `bcec66d6` 或其后的文档同步提交，并从 Phase 8 继续。
- [x] 更新 `tasks/lessons.md`：固化“最新状态文档 + 下次启动提示词”是默认收尾习惯，不需要用户每次提醒。
- [x] 运行 `git diff --check -- docs/opencode-support tasks/todo.md tasks/lessons.md`。
- [x] 在本节追加 Review，并按状态同步纪律单独提交本轮文档更新。

## 2026-05-28 Agent opencode Runtime Phase 7 最新开发状态同步 Review

- 已确认当前最新提交为 `bcec66d6 docs(agent): 同步 opencode Phase 7 开发状态`，Phase 7 开发基线为 `3ec2ebec feat(agent): 完成 opencode Runtime Phase 7 MCP 与打包验证`，历史包含 `0c84b37a`、`077fbc49`、`bb361a34`、`786b6485`、`b3e99265`、`647d3046`。
- 已更新 `docs/opencode-support/README.md`、development checklist 和 `next-session-prompt.md`：明确 Phase 0-7 已完成，Phase 8 未开始；Phase 7 残余仍包括 macOS x64 / Windows x64 / Linux packaged smoke 未本机验证、DMG `hdiutil create` 失败、MCP tool-call 真实模型 smoke 未执行。
- 已更新 `tasks/lessons.md`：将“最新状态文档 + 下次启动提示词”固化为默认收尾习惯；以后阶段完成或用户询问进度时主动同步，不需要再次提醒。
- 保持边界：本次只修改 opencode support 文档、任务记录和 lessons；不修改业务代码，不修改根 `README.md` / `AGENTS.md`，不进入真实模型验收、故障排查实战或 release notes。
- 验证通过：`git diff --check -- docs/opencode-support tasks/todo.md tasks/lessons.md`。

## 2026-05-28 Agent opencode Runtime Phase 6 最新状态同步计划

范围确认：本轮只同步 opencode support 文档、下次启动提示词、任务记录和 lessons，明确 Phase 0-6 已完成、Phase 7-8 未完成，并将下次继续开发入口固定到 Phase 7；不修改业务代码、不修改根 `README.md` / `AGENTS.md`，不安装依赖。

- [x] 运行 `git status --short` 和 `git log -5 --oneline`，确认当前最新状态同步提交为 `077fbc49 docs(agent): 同步 opencode Phase 6 后续开发状态`，历史包含 `bb361a34`、`786b6485`、`3b8a1286`、`b3e99265`、`647d3046`。
- [x] 复查 `docs/opencode-support/README.md`、开发清单、`next-session-prompt.md`、`tasks/todo.md` 和 `tasks/lessons.md`，确认 Phase 6 完成状态、Phase 7 入口和默认状态同步纪律。
- [x] 更新 opencode support README：写入 2026-05-28 最新状态，明确当前开发基线仍为 `bb361a34`，上一状态同步提交为 `077fbc49`，下一步从 Phase 7 开始。
- [x] 更新 opencode 开发清单：把最新状态快照、仓库状态要求和完成/未完成总览对齐到 Phase 6 后状态同步。
- [x] 更新 `docs/opencode-support/next-session-prompt.md`：下次启动提示词包含 `077fbc49`、`bb361a34` 和 Phase 7 入口。
- [x] 更新 `tasks/lessons.md`：再次固化“更新最新开发状态和下次启动提示词是默认收尾动作，不需要用户重复提醒”的习惯。
- [x] 运行 `git diff --check -- docs/opencode-support tasks/todo.md tasks/lessons.md`。

## 2026-05-28 Agent opencode Runtime Phase 6 最新状态同步 Review

- 已确认当前业务开发基线仍为 `bb361a34 feat(agent): 完成 opencode Runtime Phase 6 Renderer 接入`，当前最新已知状态同步提交为 `077fbc49 docs(agent): 同步 opencode Phase 6 后续开发状态`。
- 已更新 `docs/opencode-support/README.md`、开发清单和 `next-session-prompt.md`：明确 Phase 0-6 已完成，Phase 7-8 未完成，下一步从 Phase 7 MCP / packaged / release readiness 开始。
- 已更新 `tasks/lessons.md`：以后用户要求更新最新开发状态、完成/未完成清单或下次启动提示词时，默认同步 support README、development checklist、next-session prompt、`tasks/todo.md` Review 和 lessons，并在最终回复给可复制提示词。
- 保持边界：本次状态同步不修改业务代码，不修改根 `README.md` / `AGENTS.md`，不安装依赖，不进入 Phase 7 实现。

## 2026-05-27 Agent opencode Runtime Phase 6 Renderer 接入计划

范围确认：本轮进入 Phase 6，只接入 renderer 设置、权限交互、runtime capabilities 展示和历史回放验证；不进入 MCP、packaged release、真实模型验收或根 `README.md` / `AGENTS.md` 修改。UI 不做 opencode 专用 message list，继续复用现有 runtime transcript 和 `PermissionBanner`。

- [x] 复习项目指令、`tasks/lessons.md`、opencode support README、开发清单和主方案，确认 Phase 6 范围、feature flag、权限交互、历史回放和阶段提交纪律。
- [x] 运行 `git status --short`、`git log -5 --oneline` 和分支检查，确认当前分支为 `agent-mode-opencode`，最新提交为 `786b6485 docs(agent): 固化 opencode Phase 5 最新启动状态`，历史包含 `3b8a1286`、`b3e99265`、`647d3046`。
- [x] 梳理现有 Agent Settings、Jotai atoms、preload 类型和 main IPC，确定 opencode settings / diagnostics / capabilities 的最小接入点。
- [x] 在 Agent 设置中接入 runtime 三选，feature flag 关闭时展示 opencode 实验功能关闭态；feature flag 开启时支持保存 opencode auth source、channel、model、agent、snapshot/autoupdate 设置。
- [x] 接入 opencode runtime capabilities / server status / model refresh / MCP summary 的状态展示；对 queue message、运行中 permission 切换等不支持能力禁用或提示“下次发送生效”。
- [x] 在 Agent Header 显示 runtime/model/agent/permission badge，保持 Claude Code / Codex 现有行为不回退。
- [x] 复用现有 `PermissionBanner` 接入 opencode permission preview、cwd、risk label、reject / once / session allow；缺少 preview 时隐藏 session allow。
- [x] 确认 Agent 历史回放只依赖 CodeInsights runtime event log 和 session messages，不因 opencode server 未运行而报错；reload 后 transcript 可显示。
- [x] 补充 renderer / shared UI 相关测试，覆盖 feature flag on/off、opencode settings 保存加载、capability disable 文案、permission action 映射和 history replay。
- [x] 运行 Phase 6 验证：`bun test apps/electron/src/renderer`、`bun test apps/electron/src/main/lib/agent-orchestrator.test.ts`、`bun run --filter='@codeinsights/electron' typecheck`、`CODEINSIGHTS_AGENT_OPENCODE_RUNTIME=1 bun run --filter='@codeinsights/electron' build:renderer`、`CODEINSIGHTS_AGENT_OPENCODE_RUNTIME=0 bun run --filter='@codeinsights/electron' build:renderer`、`git diff --check -- apps/electron/src/renderer apps/electron/src/preload apps/electron/src/main tasks/todo.md docs/opencode-support`。
- [x] 更新 opencode development checklist、support README、next-session prompt，并在本节追加 Review。
- [x] 按阶段纪律只提交 Phase 6 相关文件，提交信息用详细中文说明完成内容、验证结果和未包含内容。

## 2026-05-27 Agent opencode Runtime Phase 6 Renderer 接入 Review

- 启动基线已确认：当前分支为 `agent-mode-opencode`，本轮开始时最新提交为 `786b6485 docs(agent): 固化 opencode Phase 5 最新启动状态`，历史包含 `3b8a1286`、`b3e99265`、`647d3046`。
- 已完成 Agent 设置接入：Runtime 三选支持 `opencode`；feature flag 关闭时只展示实验功能关闭态；feature flag 开启时可保存 native/channel auth source、model、agent、snapshot/autoupdate 配置。
- 已完成 capabilities / diagnostics 展示：设置页展示 runtime capabilities、opencode server 按需启动状态、模型刷新禁用原因和 MCP Phase 7 占位；Phase 6 不读取 `/provider`、`/config/providers` 或 resolved config 原文，避免泄漏 secret。
- 已完成 Agent 主界面接入：opencode 复用 runtime transcript，不新增专用 message list；Header 和 composer 显示 runtime/model/agent/permission；运行中追加消息与 `/compact` 按 runtime capability 禁用或提示。
- 已完成权限交互：opencode `permission_requested` runtime event 转为现有 `PermissionBanner` 请求，展示 tool preview、cwd、risk label；支持拒绝、本次允许、本会话允许，且缺少 preview 时隐藏本会话允许。
- 已完成 opencode permission response 路由：renderer 响应携带 `sessionId`；主进程优先走 legacy permission service，找不到时路由到活跃 runtime；opencode runtime 将 allow / session allow / deny 映射为 `once` / `always` / `reject`。
- 已完成历史回放保护：live runtime envelope 直接推送到 renderer 并去重；兼容 SDKMessage 增加 `_runtimeEnvelope` 标记避免重复渲染；`RuntimeTranscript` 对 Codex / opencode 统一使用 CodeInsights runtime event log 回放，不依赖 opencode server 存活。
- 已根据代码审查修复 Phase 6 收尾问题：runtime replay 去重从单独 `sequence` 改为 `runId + sequence`，避免多轮 opencode run 都从 sequence 0 开始时丢事件；feature flag 关闭时 opencode 不再作为可点击 runtime 选项；opencode server status 读取 runtime manager 最新状态，不再只返回静态 `not_started`。
- 已按受影响包 patch 版本规则将 `@codeinsights/shared` 从 `0.1.47` 提升到 `0.1.48`，将 `@codeinsights/electron` 从 `0.0.117` 提升到 `0.0.118`。
- 保持边界：未进入 MCP、packaged release、真实模型验收，未修改根 `README.md` / `AGENTS.md`；packaged Electron history reload smoke 留到 Phase 7 / Phase 8，Phase 6 用 renderer 单测覆盖 history replay。
- 验证通过：`bun test packages/shared/src/agent/runtime-events.test.ts apps/electron/src/main/lib/agent-runtimes/opencode-runtime.test.ts apps/electron/src/renderer/lib/agent-runtime-ui.test.ts`；`bun test apps/electron/src/renderer`；`bun test apps/electron/src/main/lib/agent-orchestrator.test.ts`；`bun test apps/electron/src/main/lib/agent-runtimes/opencode-event-adapter.test.ts apps/electron/src/main/lib/agent-runtimes/opencode-runtime.test.ts apps/electron/src/main/lib/agent-runtime-event-log.test.ts apps/electron/src/main/lib/agent-session-manager.test.ts`；`bun run --filter='@codeinsights/electron' typecheck`；`CODEINSIGHTS_AGENT_OPENCODE_RUNTIME=1 bun run --filter='@codeinsights/electron' build:renderer`；`CODEINSIGHTS_AGENT_OPENCODE_RUNTIME=0 bun run --filter='@codeinsights/electron' build:renderer`；`git diff --check -- apps/electron/src/renderer apps/electron/src/preload apps/electron/src/main packages/shared bun.lock apps/electron/package.json packages/shared/package.json tasks/todo.md docs/opencode-support`。
- Phase 6 已单独提交：`bb361a34 feat(agent): 完成 opencode Runtime Phase 6 Renderer 接入`。

## 2026-05-27 Agent opencode Runtime Phase 6 后状态同步计划

范围确认：本轮只同步 opencode support 文档、下次启动提示词和任务记录，明确 Phase 0-6 已完成、Phase 7-8 未完成，并将下次继续开发入口固定到 Phase 7；不修改业务代码、不修改根 `README.md` / `AGENTS.md`，不安装依赖。

- [x] 运行 `git status --short` 和 `git log -5 --oneline`，确认 Phase 6 开发提交为 `bb361a34 feat(agent): 完成 opencode Runtime Phase 6 Renderer 接入`。
- [x] 更新 opencode support README：写入 Phase 6 开发基线 `bb361a34`、完成/未完成清单和下一步 Phase 7 入口。
- [x] 更新 opencode 开发清单：把最新状态快照、仓库状态要求、Phase 6 验证记录和阶段提交记录对齐到 `bb361a34`。
- [x] 更新 `docs/opencode-support/next-session-prompt.md`：生成可直接复制给下次 Codex 的 Phase 7 延续提示词。
- [x] 运行 `git diff --check -- docs/opencode-support tasks/todo.md`。

## 2026-05-27 Agent opencode Runtime Phase 6 后状态同步 Review

- 已将 Phase 6 开发基线固定为 `bb361a34 feat(agent): 完成 opencode Runtime Phase 6 Renderer 接入`。
- 已更新 `docs/opencode-support/README.md`、开发清单和 `next-session-prompt.md`：明确 Phase 0-6 已完成，Phase 7-8 未完成，下一步入口为 Phase 7 MCP / packaged / release readiness。
- 保持边界：本次状态同步不修改业务代码，不修改根 `README.md` / `AGENTS.md`。

## 2026-05-27 Agent opencode Runtime Phase 5 后最新状态同步计划

范围确认：本轮只同步 opencode support 文档、下次启动提示词、任务记录和 lessons，明确 Phase 0-5 已完成、Phase 6-8 未完成，并将下次继续开发入口固定到 Phase 6；不修改业务代码、不修改根 `README.md` / `AGENTS.md`，不安装依赖。

- [x] 运行 `git status --short` 和 `git log -5 --oneline`，确认当前工作树干净，最新提交为 `3b8a1286 docs(agent): 同步 opencode Phase 5 后续开发状态`，历史包含 `b3e99265` 和 `647d3046`。
- [x] 更新 opencode support README：写入最新状态同步提交 `3b8a1286`、Phase 0-5 已完成、Phase 6-8 未完成和下一步 Phase 6 入口。
- [x] 更新 opencode 开发清单：把最新状态快照、仓库状态要求和下一步入口对齐到 Phase 5 后状态。
- [x] 更新 `docs/opencode-support/next-session-prompt.md`：生成可直接复制给下次 Codex 的 Phase 6 延续提示词，并明确检查 `3b8a1286` / `b3e99265`。
- [x] 将“更新文档最新开发状态并给下次启动提示词是默认收尾动作”的习惯再次写入 `tasks/lessons.md`。
- [x] 运行 `git diff --check -- docs/opencode-support tasks/todo.md tasks/lessons.md` 和状态占位检查。
- [x] 在本节追加 Review，并按状态同步纪律单独提交本轮文档更新。

## 2026-05-27 Agent opencode Runtime Phase 5 后最新状态同步 Review

- 本轮开始时工作树干净，最新提交为 `3b8a1286 docs(agent): 同步 opencode Phase 5 后续开发状态`。
- 已更新 `docs/opencode-support/README.md`：补充最新状态同步提交 `3b8a1286`，已完成范围明确为 Phase 0-5，未完成范围明确为 Phase 6-8，下一步入口保持 Phase 6 renderer 设置、权限交互和历史回放。
- 已更新 opencode 开发清单：最新状态快照和仓库状态要求明确 Phase 5 开发基线 `b3e99265` 与状态同步提交 `3b8a1286`。
- 已更新 `docs/opencode-support/next-session-prompt.md`：下次启动提示词要求确认 `3b8a1286`、`b3e99265`、`647d3046`、`bdef679f`、`d2b718ad`、`7c31b72d`，并从 Phase 6 继续。
- 已更新 `tasks/lessons.md`：后续阶段完成或用户要求最新状态/下次提示词时，默认同步 support README、development checklist、next-session prompt、`tasks/todo.md` Review 和 lessons。
- 保持边界：未修改业务代码，未修改根 `README.md` / `AGENTS.md`，未安装依赖。
- 验证通过：`git diff --check -- docs/opencode-support tasks/todo.md tasks/lessons.md`；opencode support 状态占位检查。

## 2026-05-27 Agent opencode Runtime Phase 5 真实 Server 集成计划

范围确认：本轮进入 Phase 5，只接入真实 `opencode serve`、SDK client wrapper、Basic Auth fetch wrapper 和无凭证可运行的 smoke summary；不进入 renderer UI、发布打包验收或根 `README.md` / `AGENTS.md` 修改。长期 config、diagnostics、event log 和 smoke summary 必须 secretless，不记录 resolved `/config`、`/provider`、`/config/providers` 原文。

- [x] 复习项目指令、`tasks/lessons.md`、opencode support README、开发清单、主方案和 next-session prompt，确认阶段提交、状态同步、runtime binding、Git guard 与 secretless 纪律。
- [x] 运行 `git status --short` 和 `git log -12 --oneline`，确认工作树干净，最新提交为 `fa335f45 docs(agent): 同步 opencode Phase 4 后续开发状态`，历史包含 `647d3046`、`bdef679f`、`d2b718ad`、`7c31b72d`。
- [x] 安装前查询 npm 元数据：`@opencode-ai/sdk@1.15.11`、`opencode-ai@1.15.11`；`opencode-ai` bin 为 `bin/opencode.exe`，optional platform packages 与 Phase 0 记录一致。
- [x] 读取现有 `apps/electron/src/main/lib/opencode-runtime/**`、`agent-runtimes/opencode-runtime.ts`、相关测试与 `apps/electron/package.json`，确定真实 server 接入点和最小改动范围。
- [x] 添加 `@opencode-ai/sdk`、`opencode-ai` 与必要 platform optionalDependencies，按受影响包规则提升 `@codeinsights/electron` patch 版本。
- [x] 把 `OpencodeServerManager` 从 fakeable 基础设施推进到真实 spawn：自行分配空闲端口，固定 `127.0.0.1`，启用随机 Basic Auth，传入 secretless config/env，health timeout 后清理进程。
- [x] 把 `opencode-sdk-client` 接到真实 `createOpencodeClient()`：统一 `.data` / `.stream` 返回、Basic Auth fetch wrapper、错误分类和请求日志脱敏。
- [x] 增加或扩展 smoke CLI：binary、server health、Basic Auth、event subscribe、session create、config、permission config、permission response endpoint probe、abort、resume；真实模型、channel auth 和 native auth smoke 缺凭证时记录 skipped reason。
- [x] 保证 smoke summary JSON 只输出 `passed` / `failed` / `skipped`、版本、脱敏路径和 skipped reason，不输出 API key、Basic Auth password、MCP token、auth 文件内容或 resolved config/provider 原文。
- [x] 补齐 BDD 单测覆盖真实 wrapper 边界：Basic Auth header、SDK fetch header、server authMode、config-dir env gating、secret redaction、server cleanup。
- [x] 运行 Phase 5 验证：`smoke:agent-opencode -- --only binary/server/config/permission/abort/resume/readonly/channel/native`、`bun run --filter='@codeinsights/electron' typecheck`、相关单测、`build:main`、`git diff --check -- apps/electron bun.lock tasks/todo.md docs/opencode-support`。
- [x] 更新 opencode development checklist、support README、next-session prompt，并在本节追加 Review。
- [x] 按阶段纪律只提交 Phase 5 相关文件，提交信息用详细中文说明完成内容、验证结果和未包含内容。

## 2026-05-27 Agent opencode Runtime Phase 5 真实 Server 集成 Review

- 启动基线已确认：本轮开始时最新提交为 `fa335f45 docs(agent): 同步 opencode Phase 4 后续开发状态`，历史包含 `647d3046`、`bdef679f`、`d2b718ad`、`7c31b72d`。
- 已复核 npm 元数据并安装 `@opencode-ai/sdk@1.15.11`、`opencode-ai@1.15.11` 和全部必要 `opencode-*` platform optionalDependencies；`@codeinsights/electron` patch 版本提升到 `0.0.117`。
- 已把 `OpencodeServerManager` 推进到真实 spawn：自行分配端口，固定 `127.0.0.1`，默认随机 Basic Auth，health retry，stdout/stderr 脱敏 drain，stop/cleanup 支持 SIGTERM 后 SIGKILL。
- 已把 `opencode-sdk-client` 接入真实 `createOpencodeClient()`：支持 health、SSE subscribe、session create、prompt async、abort、messages、permission response、config summary；Basic Auth fetch wrapper 覆盖 SDK 调用与 direct JSON 请求。
- 已把默认 `OpencodeAgentRuntime` 从 mock client/server 切到真实 server manager 与真实 SDK client；测试仍通过依赖注入保持 fake 路径。
- 已新增 `apps/electron/scripts/agent-opencode-smoke.ts`：binary、server、config、permission、abort、resume 无凭证可运行；readonly、channel、native 真实模型/凭证 smoke 缺环境变量时记录 skipped reason。
- 已记录 Phase 5 真实差异：`writeOpencodeRuntimeConfig()` 继续生成私有 `config-dir`，但默认不注入 `OPENCODE_CONFIG_DIR`；`opencode-ai@1.15.11` 下空 assets 目录会卡住 session mutating API，后续 Phase 7 通过显式开关再验收。
- 保持安全边界：smoke summary 和 config summary 不输出 API key、Basic Auth password、MCP token、auth 文件内容，也不记录 resolved `/config`、`/provider`、`/config/providers` 原文。
- 保持阶段边界：未进入 renderer UI、MCP、packaged binary、发布验收或根 `README.md` / `AGENTS.md` 修改。
- 验证通过：`CODEINSIGHTS_AGENT_OPENCODE_RUNTIME=1 bun run --filter='@codeinsights/electron' smoke:agent-opencode -- --only binary,server,config,permission,abort,resume,readonly,channel,native`；`bun test apps/electron/src/main/lib/opencode-runtime apps/electron/src/main/lib/agent-runtimes/opencode-runtime.test.ts apps/electron/src/main/lib/agent-runtimes/opencode-event-adapter.test.ts`；`bun run --filter='@codeinsights/electron' typecheck`；`bun run --filter='@codeinsights/electron' build:main`；`git diff --check -- apps/electron bun.lock tasks/todo.md docs/opencode-support`。

## 2026-05-27 Agent opencode Runtime Phase 4 后状态同步计划

范围确认：本轮只同步 opencode support 文档、下次启动提示词、任务记录和 lessons，明确 Phase 0-4 已完成、Phase 5-8 未完成，并将下次继续开发入口固定到 Phase 5；不修改业务代码、不修改根 `README.md` / `AGENTS.md`，不安装依赖。

- [x] 运行 `git status --short` 和 `git log -5 --oneline`，确认当前工作树干净，最新开发提交为 `647d3046 feat(agent): 完成 opencode Runtime Phase 4 Mock 路由`。
- [x] 更新 opencode support README：写入 Phase 4 真实开发基线 `647d3046`、完成/未完成清单和下一步 Phase 5 入口。
- [x] 更新 opencode 开发清单：把最新状态快照、仓库状态要求、Phase 4 验证记录和阶段提交记录对齐到 `647d3046`。
- [x] 更新 `docs/opencode-support/next-session-prompt.md`：生成可直接复制给下次 Codex 的 Phase 5 延续提示词。
- [x] 将“每次阶段完成或用户要求更新状态时默认同步 support 文档和提示词”的习惯再次写入 `tasks/lessons.md`。
- [x] 运行 `git diff --check -- docs/opencode-support tasks/todo.md tasks/lessons.md` 和状态占位检查。
- [x] 在本节追加 Review，并按状态同步纪律单独提交本轮文档更新。

## 2026-05-27 Agent opencode Runtime Phase 4 后状态同步 Review

- 本轮开始时工作树干净，最新开发提交为 `647d3046 feat(agent): 完成 opencode Runtime Phase 4 Mock 路由`。
- 已更新 `docs/opencode-support/README.md`：最新开发基线固定到 `647d3046`，已完成范围明确为 Phase 0-4，未完成范围明确为 Phase 5-8，下一步入口改为 Phase 5 真实 `opencode serve` 集成。
- 已更新 opencode 开发清单：顶部状态、最新状态快照、当前完成/未完成总览和下一步入口均同步到 Phase 4 后状态。
- 已更新 `docs/opencode-support/next-session-prompt.md`：下次启动提示词要求确认历史中包含 `647d3046`，并从 Phase 5 继续。
- 已更新 `tasks/lessons.md`：再次固化“阶段完成或用户要求更新状态时，默认同步 support 文档、任务记录和下次启动提示词”的习惯。
- 保持边界：未修改业务代码，未修改根 `README.md` / `AGENTS.md`，未安装依赖。
- 验证通过：`git diff --check -- docs/opencode-support tasks/todo.md tasks/lessons.md`；opencode support 状态占位检查。

## 2026-05-27 Agent opencode Runtime Phase 4 Mock 路由计划

范围确认：本轮只实现 opencode mock/fake runtime 与主进程路由闭环，不启动真实 `opencode serve`，不安装 `@opencode-ai/sdk` / `opencode-ai`，不进入 renderer UI、真实模型验收或真实 server 集成，不修改根 `README.md` / `AGENTS.md`。实现必须复用 Phase 3 `OpencodeEventAdapter`，保持长期配置和诊断 secretless。

- [x] 复习项目指令、`tasks/lessons.md`、opencode support README、开发清单和主方案，确认阶段提交、状态同步、runtime binding、stop race 与 secretless 纪律。
- [x] 运行 `git status --short` 和 `git log -3 --oneline`，确认当前 HEAD 为 `ea94ac52 docs(agent): 补写 opencode Phase 3 最新基线`，历史包含 `bdef679f`、`d2b718ad`、`7c31b72d`，工作树干净。
- [x] 梳理现有 Codex runtime / registry / orchestrator / event log / session manager 契约，确认 Phase 4 最小接入点。
- [x] 先补 BDD 单测：`OpencodeAgentRuntime` mock client/server、feature flag on/off、新 session 绑定、已有 opencode session resume、missing manifest、stop race、unsupported queue/setPermissionMode、event log/history replay。
- [x] 实现 `OpencodeAgentRuntime implements CodingAgentRuntime`，通过 fake opencode client/server manager 消费 mock raw events 并复用 `OpencodeEventAdapter` 输出 runtime envelopes。
- [x] 接入 registry 与 orchestrator：feature flag 下启用 opencode，新 session 写入 runtimeSession snapshot，已绑定 session 使用 snapshot resume，不被当前 settings 污染。
- [x] 补齐 missing manifest 阻断或兼容路径，确保错误可解释且不静默回退到其他 runtime。
- [x] 确保 stop 调用 runtime abort，迟到 success 不写入 event log；unsupported queue/setPermissionMode 不污染本地权限状态。
- [x] 运行 Phase 4 验证：`bun test apps/electron/src/main/lib/agent-runtimes/opencode-runtime.test.ts`、`bun test apps/electron/src/main/lib/agent-orchestrator.test.ts`、`bun test apps/electron/src/main/lib/agent-runtime-event-log.test.ts`、`bun test apps/electron/src/main/lib/agent-session-manager.test.ts`、`bun run --filter='@codeinsights/electron' typecheck`、`git diff --check -- apps/electron/src/main/lib packages/shared tasks/todo.md docs/opencode-support`。
- [x] 更新 opencode development checklist、support README、next-session prompt，并在本节追加 Review。
- [x] 按阶段纪律只提交 Phase 4 相关文件，提交信息用详细中文说明完成内容、验证结果和未包含内容。

## 2026-05-27 Agent opencode Runtime Phase 4 Mock 路由 Review

- 启动基线已确认：本轮开始时工作树干净，最新提交为 `ea94ac52 docs(agent): 补写 opencode Phase 3 最新基线`，历史包含 `bdef679f`、`d2b718ad`、`7c31b72d`。
- 已新增 `apps/electron/src/main/lib/agent-runtimes/opencode-runtime.ts` 与 `opencode-runtime.test.ts`：`OpencodeAgentRuntime` 使用 fake opencode client / fake server manager，不启动真实 server；复用 Phase 3 `OpencodeEventAdapter` 输出 runtime envelopes；支持 mock start/resume/abort/stream failure，queueMessage 与 setPermissionMode 返回 unsupported。
- 已接入主进程路由：`agent-service` 在 feature flag 下注册 opencode runtime；`agent-orchestrator` 传入 opencode enabled runtime kinds，新增 opencode disabled preflight、`runWithOpencodeRuntime`、runtime-neutral SDKMessage 反写和 `runtimeSession` snapshot 持久化。
- 已补齐 session binding 保护：新 session 首次绑定 opencode external session id；已绑定 opencode session resume 使用 snapshot 中的 model / agent / authSource，不受当前 settings 污染；workspace manifest 缺失时阻断并写可解释错误。
- 已根据代码审查补强 opencode resume 安全：`runtimeSession.workingDirectory` 会随 runtime selection 传递；已绑定 opencode session 只有存在物化 manifest 才允许 resume，workspace 丢失或 manifest 缺失时不会退回 `homedir()`。
- 已收紧 Phase 4 mock diagnostics：只声明 stream events / resume / abort 已可用，per-tool permission、server status、model refresh 留到后续真实 server 阶段。
- 已补齐 event log / history replay：opencode runtime envelopes 可写入 JSONL，并可通过 shared replay 还原 assistant transcript 与 terminal。
- 已按受影响包 patch 版本规则将 `@codeinsights/shared` 从 `0.1.46` 提升到 `0.1.47`，将 `@codeinsights/electron` 从 `0.0.115` 提升到 `0.0.116`。
- 保持边界：未安装 `@opencode-ai/sdk` / `opencode-ai`，未启动真实 `opencode serve`，未进入 renderer UI、真实模型验收或发布打包，未修改根 `README.md` / `AGENTS.md`。
- 验证通过：`bun test apps/electron/src/main/lib/agent-runtimes/opencode-runtime.test.ts`；`bun test apps/electron/src/main/lib/agent-orchestrator.test.ts`；`bun test apps/electron/src/main/lib/agent-runtime-event-log.test.ts`；`bun test apps/electron/src/main/lib/agent-session-manager.test.ts`；`bun test apps/electron/src/main/lib/agent-runtimes/coding-agent-runtime-registry.test.ts`；`bun run --filter='@codeinsights/electron' typecheck`；`git diff --check -- apps/electron/src/main/lib packages/shared tasks/todo.md docs/opencode-support`；补充组合测试覆盖 `coding-agent-runtime-registry.test.ts`。

## 2026-05-27 Agent opencode Runtime Phase 3 最新基线补写计划

范围确认：本轮只补写 opencode support 文档、下次启动提示词、任务记录和 lessons，消除不够精确的恢复基线表述；不修改业务代码、不修改根 `README.md` / `AGENTS.md`，不安装依赖。

- [x] 运行 `git status --short` 和 `git log -3 --oneline`，确认当前工作树干净，最新开发基线为 `bdef679f docs(agent): 固化 opencode Phase 3 最新启动基线`。
- [x] 更新 opencode support README：明确当前开发基线为 `bdef679f`，Phase 0-3 已完成，Phase 4-8 未完成，下一步仍从 Phase 4 开始。
- [x] 更新 opencode 开发清单：把最新状态快照和仓库状态要求改为真实开发基线 `bdef679f`。
- [x] 更新 `docs/opencode-support/next-session-prompt.md`：下次启动提示词改为检查历史中包含 `bdef679f`、`d2b718ad` 和 `7c31b72d`。
- [x] 加固 `tasks/lessons.md`：以后默认区分仓库文档里的最新开发基线和最终回复里的实际 HEAD 提示词，不再等待用户提醒。
- [x] 运行 `git diff --check -- docs/opencode-support tasks/todo.md tasks/lessons.md` 和占位检查。
- [x] 在本节追加 Review，并按状态同步纪律单独提交本轮文档更新。

## 2026-05-27 Agent opencode Runtime Phase 3 最新基线补写 Review

- 本轮开始时工作树干净，最新提交为 `bdef679f docs(agent): 固化 opencode Phase 3 最新启动基线`。
- 已更新 `docs/opencode-support/README.md`：当前开发基线明确为 `bdef679f`，已完成范围保持 Phase 0-3，未完成范围保持 Phase 4-8。
- 已更新 opencode 开发清单：最新开发状态快照和仓库状态要求改为真实开发基线 `bdef679f`。
- 已更新 `docs/opencode-support/next-session-prompt.md`：下次启动提示词要求确认历史中包含 `bdef679f`、`d2b718ad` 和 `7c31b72d`，并从 Phase 4 继续。
- 已更新 `tasks/lessons.md`：后续状态同步默认区分文档内真实开发基线和最终回复里的实际 HEAD，不需要用户再次提醒。
- 保持边界：未修改业务代码，未修改根 `README.md` / `AGENTS.md`，未安装依赖。
- 验证通过：`git diff --check -- docs/opencode-support tasks/todo.md tasks/lessons.md`；opencode support 当前占位基线检查。

## 2026-05-27 Agent opencode Runtime Phase 3 最新状态同步计划

范围确认：本轮只同步 opencode support 文档、下次启动提示词、任务记录和 lessons，明确 Phase 0-3 已完成、Phase 4-8 未完成，并将下次继续开发入口固定到 Phase 4；不修改业务代码、不修改根 `README.md` / `AGENTS.md`，不安装依赖。

- [x] 运行 `git status --short` 和 `git log -5 --oneline`，确认当前工作树干净，最新提交为 `d2b718ad docs(agent): 同步 opencode Phase 3 后续开发状态`。
- [x] 更新 opencode support README：补齐 Phase 3 后状态同步提交，清楚标注 Phase 0-3 已完成、Phase 4-8 未完成。
- [x] 更新 opencode 开发清单：把最新状态快照和仓库状态要求对齐到 Phase 3 后状态同步提交，下一步入口保持 Phase 4。
- [x] 更新 `docs/opencode-support/next-session-prompt.md`：生成可直接复制给下次 Codex 的 Phase 4 延续提示词。
- [x] 将“用户要求更新状态/提示词或阶段完成后，默认主动同步仓库文档和最终回复，不需要每次提醒”的习惯加固到 `tasks/lessons.md`。
- [x] 运行 Markdown code fence、相对链接、`git diff --check` 和状态占位检查。
- [x] 在本节追加 Review，并按阶段纪律单独提交本轮状态同步成果。

## 2026-05-27 Agent opencode Runtime Phase 3 最新状态同步 Review

- 本轮开始时工作树干净，最新提交为 `d2b718ad docs(agent): 同步 opencode Phase 3 后续开发状态`。
- 已更新 `docs/opencode-support/README.md`：已完成列表加入 Phase 3 后状态同步；提交列表加入 `d2b718ad`；未完成列表保持 Phase 4-8。
- 已更新 opencode 开发清单：最新开发状态快照和仓库状态要求固定到真实基线 `d2b718ad`，下一步入口保持 Phase 4 runtime mock / orchestrator routing。
- 已更新 `docs/opencode-support/next-session-prompt.md`：下次启动提示词要求确认本提示词所在的 `docs(agent): 固化 opencode Phase 3 最新启动基线` 提交，并从 Phase 4 继续。
- 已更新 `tasks/lessons.md`：以后阶段完成或用户询问最新状态/下次提示词时，默认主动同步仓库文档、任务记录和最终回复，不再等待用户提醒。
- 保持边界：未修改业务代码，未修改根 `README.md` / `AGENTS.md`，未安装依赖。
- 验证通过：`git diff --check -- docs/opencode-support tasks/todo.md tasks/lessons.md`；触达 Markdown code fence 检查；opencode support 相对链接检查；opencode support 旧状态占位检查。

## 2026-05-27 Agent opencode Runtime Phase 3 Event Adapter 计划

范围确认：本轮只实现 opencode SSE event / message part 到 CodeInsights runtime event 的纯状态机适配层与 fixtures；不进入 renderer UI、真实模型验收、真实 `opencode serve` 集成、runtime registry / orchestrator routing；不安装 `@opencode-ai/sdk` / `opencode-ai`；不修改根 `README.md` / `AGENTS.md`；长期配置继续保持 secretless。

- [x] 复习项目指令、`tasks/lessons.md`、opencode support README、开发清单和主方案，确认阶段完成即提交、重启恢复、状态同步、secretless config、Git guard 与 runtime binding 纪律。
- [x] 运行 `git status --short` 和 `git log -3 --oneline`，确认启动基线为 `daa0795a docs(agent): 固化 opencode Phase 2 最新开发状态` 且工作树干净。
- [x] 梳理现有 shared runtime event 契约与 Codex adapter 模式，确认 Phase 3 只新增 opencode adapter、fixtures 和必要 shared validator 补强。
- [x] 先写 opencode-event-adapter BDD fixtures / tests，覆盖 `server.connected`、session lifecycle、text delta/snapshot、reasoning、tool pending/running/completed/error、patch、agent/subtask、todo、permission ask/reply、abort/stop、recovered event 和错误分类。
- [x] 实现 `OpencodeEventAdapter` 纯状态机：raw event 类型、part-level 文本累积、去重 key、terminal single-write guard、stop 后迟到 success 屏蔽、recovered metadata、错误分类 mapping。
- [x] 补强 `packages/shared/src/agent/runtime-events.test.ts`，确保 opencode metadata / recovered 事件可验证且不会破坏现有回放。
- [x] 运行 Phase 3 验证：`bun test apps/electron/src/main/lib/agent-runtimes/opencode-event-adapter.test.ts`、`bun test packages/shared/src/agent/runtime-events.test.ts`、`bun run --filter='@codeinsights/electron' typecheck`、`git diff --check -- apps/electron/src/main/lib/agent-runtimes packages/shared tasks/todo.md docs/opencode-support`。
- [x] 更新 opencode 开发清单、support README、next-session prompt，并在本节追加 Review。
- [x] 按阶段纪律只提交 Phase 3 相关文件，提交信息用详细中文说明完成内容、验证结果和未包含内容。

## 2026-05-27 Agent opencode Runtime Phase 3 Event Adapter Review

- 启动基线已确认：本轮开始时工作树干净，最新提交为 `daa0795a docs(agent): 固化 opencode Phase 2 最新开发状态`。
- 已新增 `apps/electron/src/main/lib/agent-runtimes/opencode-event-adapter.ts`：定义 opencode raw event / part 类型，不引入真实 `@opencode-ai/sdk` 依赖；实现 server SSE / message part 到 `AgentRuntimeEvent` 的纯状态机转换。
- 已新增 `apps/electron/src/main/lib/agent-runtimes/__fixtures__/opencode-events/` 与 `opencode-event-adapter.test.ts`：覆盖 server.connected、session lifecycle、user message 忽略、text delta/snapshot、tool pending/running/completed/error、patch、agent/subtask、todo、permission ask/reply、abort/stop、recovered 补读和错误分类。
- 已实现关键状态规则：event key 去重、part-level 文本累积、completed snapshot 单次写入、tool/task start/completion 去重、terminal single-write guard、stop 后迟到 idle 不覆盖 `run_stopped`、recovered metadata。
- 已补强 `packages/shared/src/agent/runtime-events.ts` 与测试：`AgentRuntimeEventMetadata` 支持 `recovered?: boolean`，validator 会拒绝非法类型。
- 已按受影响包 patch 版本规则将 `@codeinsights/shared` 从 `0.1.45` 提升到 `0.1.46`，将 `@codeinsights/electron` 从 `0.0.114` 提升到 `0.0.115`。
- 保持边界：未安装 `@opencode-ai/sdk` / `opencode-ai` 依赖，未进入 renderer UI、真实 `opencode serve` 集成、runtime registry / orchestrator routing 或真实模型验收，未修改根 `README.md` / `AGENTS.md`。
- 验证通过：`bun test apps/electron/src/main/lib/agent-runtimes/opencode-event-adapter.test.ts`；`bun test packages/shared/src/agent/runtime-events.test.ts`；`bun run --filter='@codeinsights/electron' typecheck`；`git diff --check -- apps/electron/src/main/lib/agent-runtimes packages/shared tasks/todo.md docs/opencode-support`。

## 2026-05-27 Agent opencode Runtime Phase 3 后状态同步 Review

- Phase 3 实现已单独提交：`7c31b72d feat(agent): 完成 opencode Runtime Phase 3 Event Adapter`。
- 已将真实提交号、Phase 3 完成状态、Phase 4 下次启动入口同步到 opencode 开发清单、support README、next-session prompt 和本任务记录。
- 已更新开发清单风险跟踪：SSE 丢事件/重复事件与 stop 后迟到 success 的 Phase 3 部分已用 adapter 单测覆盖，Phase 5 / Phase 4 的真实 smoke 与 orchestrator race 仍待后续阶段完成。
- 本次状态同步只修改 `docs/opencode-support/**` 与 `tasks/todo.md`，不修改业务代码、不修改根 `README.md` / `AGENTS.md`。

## 2026-05-27 Agent opencode Runtime Phase 2 最新状态同步计划

范围确认：本轮只同步 opencode support 文档、下次启动提示词、任务记录和 lessons，明确 Phase 0-2 已完成、Phase 3-8 未完成，并将下次继续开发入口固定到 Phase 3；不修改业务代码、不修改根 `README.md` / `AGENTS.md`，不安装依赖。

- [x] 运行 `git status --short` 和 `git log -5 --oneline`，确认当前工作树干净，最新提交为 `d6768e0e docs(agent): 同步 opencode Phase 2 后续开发状态`。
- [x] 更新 opencode support README：补齐最新状态同步提交，移除“未完成”里的 Phase 2 表述，清楚标注 Phase 0-2 已完成、Phase 3-8 未完成。
- [x] 更新 opencode 开发清单：把启动基线固定为真实提交 `d6768e0e`，下次入口保持 Phase 3。
- [x] 更新 `docs/opencode-support/next-session-prompt.md`：生成可直接复制给下次 Codex 的 Phase 3 延续提示词。
- [x] 将“用户要求更新文档并给提示词时，必须同时更新仓库文档与最终回复提示词”的习惯写入 `tasks/lessons.md`。
- [x] 运行 Markdown code fence、相对链接、`git diff --check` 和占位基线检查。
- [ ] 在本节追加 Review，并按阶段纪律单独提交本轮状态同步成果。

## 2026-05-27 Agent opencode Runtime Phase 2 最新状态同步 Review

- 本轮开始时工作树干净，最新提交为 `d6768e0e docs(agent): 同步 opencode Phase 2 后续开发状态`。
- 已更新 `docs/opencode-support/README.md`：已完成列表加入 Phase 2 后状态同步；提交列表加入 `d6768e0e`；未完成列表从 Phase 3 开始，不再把 Phase 2 放入未完成。
- 已更新 opencode 开发清单：最新开发状态快照和仓库状态要求固定到真实基线 `d6768e0e`，下一步入口保持 Phase 3 event adapter。
- 已更新 `docs/opencode-support/next-session-prompt.md`：下次启动提示词要求先确认 `d6768e0e`，并从 Phase 3 event adapter 与 fixtures 继续。
- 已更新 `tasks/lessons.md`：以后用户要求更新最新开发状态并给下次启动提示词时，必须同步仓库内文档和最终回复提示词，不再等待用户提醒。
- 保持边界：未修改业务代码，未修改根 `README.md` / `AGENTS.md`，未安装依赖。
- 验证通过：`git diff --check -- docs/opencode-support tasks/todo.md tasks/lessons.md`；opencode support Markdown code fence 检查；相对链接目标检查；opencode support 占位基线检查。

## 2026-05-27 Agent opencode Runtime Phase 2 Core 计划

范围确认：本轮进入 Phase 2，只实现不依赖真实模型的 opencode runtime core 基础设施：binary/env/auth/config/MCP/server manager/client wrapper。长期落盘配置保持 secretless；不进入 renderer UI、真实模型验收、event adapter 完整映射或 orchestrator routing；不把 opencode 当普通模型 Provider；不修改根 `README.md` / `AGENTS.md`。

- [x] 复习项目指令、`tasks/lessons.md`、opencode support README、开发清单和主方案，确认阶段完成即提交、重启恢复、状态同步、secretless config、Git guard 与 runtime binding 纪律。
- [x] 运行 `git status --short` 和 `git log -3 --oneline`，确认启动基线为 `5c110ae1 docs(agent): 固化 opencode Phase 1 最新启动基线` 且工作树干净。
- [x] 读取 Phase 2 文档和现有 Codex runtime core 参考实现，确认本阶段只新增 `apps/electron/src/main/lib/opencode-runtime/**` 与相关测试/文档任务记录。
- [x] 先写 opencode-runtime BDD 单测：binary path、env allowlist/保留变量、auth hash/secret scoped env、secretless config、MCP config、server manager fake lifecycle、client wrapper Basic Auth/redaction。
- [x] 实现 `opencode-auth.ts`、`opencode-binary.ts`、`opencode-env.ts`、`opencode-config.ts`、`opencode-mcp-config.ts`、`opencode-sdk-client.ts`、`opencode-server-manager.ts` 和 `index.ts`。
- [x] 确保所有 redacted summary / config / diagnostics 不包含 API key、Bearer token、Basic Auth password、MCP token 或 resolved config/provider 原文。
- [x] 运行 Phase 2 验证：`bun test apps/electron/src/main/lib/opencode-runtime`、`bun run --filter='@codeinsights/electron' typecheck`、`git diff --check -- apps/electron/src/main/lib/opencode-runtime apps/electron/package.json electron-builder.yml tasks/todo.md docs/opencode-support`。
- [x] 更新 opencode 开发清单、support README、next-session prompt，并在本节追加 Review。
- [x] 按阶段纪律只提交 Phase 2 相关文件，提交信息用详细中文说明完成内容、验证结果和未包含内容。

## 2026-05-27 Agent opencode Runtime Phase 2 Core Review

- 启动基线已确认：本轮开始时工作树干净，最新提交为 `5c110ae1 docs(agent): 固化 opencode Phase 1 最新启动基线`。
- 已新增 `apps/electron/src/main/lib/opencode-runtime/` core 基础设施：binary path/source/version 解析、env allowlist 与 scoped secret env、native/channel/smoke auth fingerprint、secretless config/inline policy/permission policy、MCP local/remote placeholder 映射、Basic Auth client wrapper、fakeable server manager。
- Phase 2 已单独提交：`25bfec59 feat(agent): 完成 opencode Runtime Phase 2 Core 基础设施`。
- 已实现安全边界：长期 config 与 redacted summary 不写入 API key、Bearer token、Basic Auth password、MCP secret；MCP secret 只通过 `{env:VAR}` placeholder 间接引用；server password 只存在内存和子进程 env；resolved `/config` / `/provider` 原文未读取或持久化。
- 已补齐 server manager fake lifecycle：并发 `ensure()` 复用同一启动 promise，health failure/timeout 清理进程，`stopAll()` 执行 cleanup，并提供 `release()` idle close 钩子。
- 已按受影响包 patch 版本规则将 `@codeinsights/electron` 从 `0.0.113` 提升到 `0.0.114`。
- 保持边界：未安装 `@opencode-ai/sdk` / `opencode-ai` 依赖，未修改根 `README.md` / `AGENTS.md`，未进入 renderer UI、event adapter 完整映射、orchestrator routing 或真实模型验收，未修改 `electron-builder.yml`。
- 验证通过：`bun test apps/electron/src/main/lib/opencode-runtime`；`bun run --filter='@codeinsights/electron' typecheck`；`git diff --check -- apps/electron/src/main/lib/opencode-runtime apps/electron/package.json electron-builder.yml tasks/todo.md docs/opencode-support`；opencode support Markdown code fence 与相对链接检查。

## 2026-05-27 Agent opencode Runtime Phase 1 最新基线固化计划

范围确认：本轮只固化 opencode support 文档里的最新开发状态、完成/未完成清单和下次启动提示词；不修改业务代码、不修改根 `README.md` / `AGENTS.md`，不安装依赖，不读取或输出凭证。用户再次要求“记住这个习惯”，因此同步强化 `tasks/lessons.md`。

- [x] 确认当前工作树、最近提交和 Phase 1 后状态同步提交。
- [x] 将 opencode support README、开发清单和 next-session prompt 中的 Phase 1 后基线固定为真实提交 `a793172c docs(agent): 同步 opencode Phase 1 后续开发状态`。
- [x] 将“不要留下 git log / 后续状态同步占位表达”的习惯写入 `tasks/lessons.md`。
- [x] 运行 Markdown code fence、相对链接、`git diff --check` 和行尾空白验证。
- [x] 在本节追加 Review，并按阶段纪律单独提交本轮状态同步成果。

## 2026-05-27 Agent opencode Runtime Phase 1 最新基线固化 Review

- 本轮开始时工作树干净，最新提交为 `a793172c docs(agent): 同步 opencode Phase 1 后续开发状态`。
- 已将 opencode support README、开发清单和 next-session prompt 的 Phase 1 后最新基线固定到 `a793172c`，不再留下“以 git log 为准”或“后续状态同步提交”这类恢复时需要猜测的占位表达。
- 已明确当前完成项：opencode 主方案、方案深化、开发清单、阶段提交纪律、Phase 0 依赖 spike、Phase 0 后状态同步、Phase 1 契约冻结、Phase 1 后状态同步。
- 已明确当前未完成项：Phase 2 runtime core、Phase 3 event adapter、Phase 4 runtime mock / orchestrator routing、Phase 5 真实 server 集成、Phase 6 renderer / UX、Phase 7 MCP / packaged / release readiness、Phase 8 真实验收与长期文档。
- 已强化 `tasks/lessons.md`：以后用户要求更新最新开发状态或下次启动提示词时，要检查并移除占位基线，写入真实最新提交号。
- 保持边界：未修改业务代码，未修改根 `README.md` / `AGENTS.md`，未安装依赖，未读取或输出凭证。
- 验证通过：`git diff --check -- docs/opencode-support tasks/todo.md tasks/lessons.md`；Markdown code fence 检查；docs 相对链接检查；opencode support 占位基线检查；行尾空白检查。

## 2026-05-27 Agent opencode Runtime Phase 1 契约计划

范围确认：本轮进入 Phase 1，只扩展 shared 类型、settings normalization、必要 IPC / preload / renderer settings 类型和 runtime selection 契约测试；不进入 opencode runtime core/server/event adapter/UI 实现，不安装 opencode 依赖，不修改根 `README.md` / `AGENTS.md`，长期落盘配置保持 secretless。

- [x] 复习项目指令、`tasks/lessons.md`、opencode support README、开发清单和主方案，确认阶段提交、重启恢复、secretless config、Git guard 与 runtime binding 纪律。
- [x] 确认工作树与最近提交，记录 Phase 1 启动基线为 `668b8268 docs(agent): 同步 opencode Phase 0 后续开发状态`。
- [x] 扩展 shared Agent runtime 契约：`CodingAgentRuntimeKind`、runtime event source、runtime event metadata、`AgentRuntimeSessionRef` opencode snapshot 字段。
- [x] 扩展 settings 契约与 normalization：新增 opencode settings 字段，区分 `null` 与 `undefined` 的 auth source 语义，feature flag 未开启时不触发 runtime 切换。
- [x] 扩展 runtime capability / selection 的中立契约，不把 opencode 建成普通模型 Provider，也不复制 Codex 专用 helper。
- [x] 补充 shared、settings-service、agent-runtimes 相关 BDD 单测，覆盖 feature flag on/off、新 session、旧 session runtime binding 和 settings migration。
- [x] 运行 Phase 1 验证命令，修复发现的问题。
- [x] 更新 opencode 开发清单、support README、next-session prompt，并在本节追加 Review。
- [x] 按阶段纪律只提交 Phase 1 相关文件，提交信息用详细中文说明完成内容、验证结果和未包含内容。

## 2026-05-27 Agent opencode Runtime Phase 1 契约 Review

- 启动基线已确认：工作树干净，最新提交为 `668b8268 docs(agent): 同步 opencode Phase 0 后续开发状态`。
- 已扩展 shared 契约：`CodingAgentRuntimeKind` 支持 `opencode`；runtime event source 支持 `opencode_server` / `opencode_cli`；`AgentStreamEnvelope` 增加 runtime metadata；`AgentRuntimeSessionRef` 增加 agent、auth source、workingDirectory、runtimeConfigHash、authSourceHash、permissionPolicyHash 等 secretless snapshot 字段；诊断 IPC 类型已冻结。
- 已扩展 settings / preload / renderer settings 契约：新增 `agentOpencodeChannelId`、`agentOpencodeModelId`、`agentOpencodeAgentName`、`agentOpencodeUseNativeAuth`、`agentOpencodeAutoupdate`、`agentOpencodeSnapshotEnabled`，并保留 `null` 表示显式 native auth、`undefined` 表示未配置。
- 已扩展 runtime selection：未启用 opencode runtime kind 时，settings 中的 `opencode` 不触发运行时切换；已绑定 opencode session 继续按 session binding 返回，不被 feature flag 或后续 settings 改绑。
- 已修复 session normalization 风险：`agent-session-manager` 不再丢弃非 Claude / Codex 的 `runtimeSession`，opencode snapshot 可被读取和写回。
- 已新增 Phase 1 诊断 IPC stub：runtime capabilities、opencode server status、opencode model refresh 均只返回 secretless 摘要，不启动 server、不读取 resolved provider/config 响应。
- 保持边界：未安装 opencode 依赖，未实现 opencode runtime core/server/event adapter/UI，未修改根 `README.md` / `AGENTS.md`，未读取或输出任何 secret。
- 验证通过：`bun test packages/shared`；`bun test apps/electron/src/main/lib/settings-service.test.ts`；`bun test apps/electron/src/main/lib/agent-runtimes`；`bun test apps/electron/src/main/lib/agent-session-manager.test.ts`；`bun test apps/electron/src/renderer/lib/agent-runtime-ui.test.ts`；`bun run --filter='@codeinsights/electron' typecheck`；`git diff --check -- packages/shared apps/electron/src/main apps/electron/src/preload apps/electron/src/renderer tasks/todo.md docs/opencode-support`。

## 2026-05-27 Agent opencode Runtime Phase 1 后状态同步 Review

- Phase 1 已单独提交：`f4ac7325 feat(agent): 完成 opencode Runtime Phase 1 契约冻结`。
- 已将真实提交号、Phase 1 完成状态和 Phase 2 下次启动入口同步到 opencode 开发清单、support README、next-session prompt 和本任务记录。
- 本次状态同步只修改 `docs/opencode-support/**` 与 `tasks/todo.md`，不修改业务代码、不修改根 `README.md` / `AGENTS.md`。

## 2026-05-27 Agent opencode Runtime 最新状态与下次启动提示词同步计划

范围确认：本轮只同步 opencode support 文档的最新开发状态、完成/未完成清单和下次启动提示词；不修改业务代码、不修改根 `README.md` / `AGENTS.md`，不安装依赖，不读取或输出凭证。用户再次强调该习惯需长期保持，因此同步 `tasks/lessons.md`。

- [x] 确认当前工作树干净、最新提交和 opencode support 文档结构。
- [x] 更新 opencode 开发清单的最新状态快照、完成/未完成总览和下次启动入口。
- [x] 新增 `docs/opencode-support/README.md`，作为下次启动时的状态索引。
- [x] 新增 `docs/opencode-support/next-session-prompt.md`，提供可直接复制给下次 Codex 的继续开发提示词。
- [x] 将“每个阶段完成后同步状态文档和下次启动提示词”的习惯写入 `tasks/lessons.md`。
- [x] 运行 Markdown code fence、相对链接目标、`git diff --check` 和行尾空白验证。
- [x] 在本节追加 Review，并按阶段纪律单独提交本轮状态同步成果。

## 2026-05-27 Agent opencode Runtime 最新状态与下次启动提示词同步 Review

- 本轮开始时工作树干净，最新提交为 `19b5a71d docs(workflow): 强化阶段提交纪律`；opencode support 目录已有主方案和开发清单，但缺少 README 状态索引与 next-session prompt。
- 已更新 `docs/opencode-support/2026-05-27-agent-opencode-runtime-development-checklist.md`：最新状态改为状态入口同步阶段，明确已完成主方案、方案深化、开发清单、阶段提交纪律、support README 和 next-session prompt；Phase 0-8 仍未开始。
- 已新增 `docs/opencode-support/README.md`：汇总当前主文档、已完成项、未完成项、暂缓/待决策项和下次启动入口。
- 已新增 `docs/opencode-support/next-session-prompt.md`：提供可直接复制给下次 Codex 的继续开发提示词，入口固定为 Phase 0 依赖 spike 与基线冻结。
- 已强化 `tasks/lessons.md`：每个阶段性任务完成后自动同步 support README、development checklist 和 next-session prompt；如果目录缺入口，先补齐入口。
- 保持边界：未修改业务代码，未修改根 `README.md` / `AGENTS.md`，未安装依赖，未读取或输出凭证。
- 验证通过：Markdown code fence 检查；docs 相对链接目标存在检查；`git diff --check -- docs/opencode-support tasks/todo.md tasks/lessons.md`；相关 Markdown 文件行尾空白检查。

## 2026-05-27 阶段提交纪律强化计划

范围确认：当前工作树已干净，最新提交为 `4544b64a docs(agent): 建立 opencode Runtime 开发进度清单`。本轮只把用户强调的“每完成一阶段就提交、重启 Codex 会话后自动延续、提交信息使用详细中文”写入 `tasks/lessons.md` 并单独提交；不修改业务代码、不修改根 `README.md` / `AGENTS.md`。

- [x] 检查当前工作树和最近提交，确认上一阶段 opencode 开发清单已提交。
- [x] 将阶段完成即提交、重启恢复自动延续、详细中文 commit message 的纪律写入 `tasks/lessons.md`。
- [x] 运行文档 code fence、`git diff --check` 和行尾空白验证。
- [x] 单独提交本轮纪律更新。

## 2026-05-27 阶段提交纪律强化 Review

- 当前工作树在本轮开始时为干净状态，最新提交是 `4544b64a docs(agent): 建立 opencode Runtime 开发进度清单`，没有未提交的业务代码变更。
- 已在 `tasks/lessons.md` 新增长期规则：阶段完成并验证后立即单独提交；重启 Codex 会话或上下文恢复后主动检查是否有已完成未提交成果；提交信息必须使用详细中文说明完成内容、验证结果和未包含事项。
- 保持边界：未修改业务代码，未修改根 `README.md` / `AGENTS.md`。
- 验证通过：Markdown code fence 检查；`git diff --check -- tasks/todo.md tasks/lessons.md`；任务文件行尾空白检查。

## 2026-05-27 Agent opencode Runtime 开发进度清单计划

范围确认：本轮根据已完成的 opencode runtime 接入方案，新增 `docs/opencode-support/` 下的开发进度跟踪清单，用于后续逐阶段迭代开发；不修改业务代码、不修改根 `README.md` / `AGENTS.md`，不安装依赖，不读取或输出凭证。

- [x] 复核当前 HEAD、工作树、`tasks/lessons.md`、opencode 主方案和 Codex checklist 结构，确认本轮只产出文档清单。
- [x] 设计 opencode checklist 的状态约定、产品门禁、阶段拆分、验证命令、提交纪律、风险清单和进度记录模板。
- [x] 新增 `docs/opencode-support/2026-05-27-agent-opencode-runtime-development-checklist.md`。
- [x] 运行 Markdown code fence、相对链接、必备章节、`git diff --check` 和行尾空白验证。
- [x] 在本节追加 Review，并按阶段纪律提交清单文档成果。

## 2026-05-27 Agent opencode Runtime 开发进度清单 Review

- 已以 `06c62406 docs(agent): 深化 opencode Runtime 接入方案` 为基线，确认本轮只产出 opencode 开发进度清单与任务记录，不改业务代码、不改根 `README.md` / `AGENTS.md`，不安装依赖，不读取或输出凭证。
- 已新增 `docs/opencode-support/2026-05-27-agent-opencode-runtime-development-checklist.md`：覆盖使用方式、最新状态快照、阶段提交纪律、产品与安全门禁、Phase 0-8 任务拆分、Smoke 测试矩阵、风险跟踪、阶段记录模板、后续维护项和参考入口。
- 已将后续迭代入口固定为 Phase 0：先做依赖 spike、API 真实形态确认、配置/权限/MCP 行为确认和基线冻结，再进入 shared/settings/IPC 契约阶段。
- 已明确主路径继续遵循方案结论：managed `opencode serve` + `@opencode-ai/sdk` client；`opencode run --format json` 仅作为 smoke / fallback；`CODEINSIGHTS_AGENT_OPENCODE_RUNTIME=1` 作为首期 feature flag。
- 验证通过：Markdown code fence 检查；文档相对链接目标存在检查；必备章节检查；`git diff --check -- docs/opencode-support tasks/todo.md`；新增文档与任务文件行尾空白检查。

## 2026-05-27 Agent opencode Runtime 方案深化计划

范围确认：本轮继续完善 `docs/opencode-support/2026-05-27-agent-opencode-runtime-integration-plan.md`，目标是把原方案从总体设计推进到更可执行的工程规格；不修改业务代码、不修改根 `README.md` / `AGENTS.md`，不安装新依赖，不读取或输出凭证。

- [x] 复核当前 HEAD、工作树、`tasks/lessons.md` 和既有 opencode 方案，确认只做文档增量优化。
- [x] 重新核对 opencode 官方 Server / SDK / Config / Permissions / MCP / Providers / CLI 文档和 npm 包信息，补齐可能变化或未写细的契约。
- [x] 深化方案文档：补充设计原则、运行时绑定不变量、server 生命周期、配置/secret 策略、Provider/MCP/Permission 映射、事件去重、错误处理、测试矩阵和 Phase 完成定义。
- [x] 运行 Markdown code fence、相对链接、`git diff --check`、旧域名和行尾空白验证。
- [x] 在本节追加 Review，并按阶段纪律提交文档优化成果。

## 2026-05-27 Agent opencode Runtime 方案深化 Review

- 已确认本轮基线为 `094d911d docs(agent): 完成 opencode Runtime 接入方案`，工作范围只包含 opencode support 方案文档与 `tasks/todo.md`。
- 已重新核对 opencode 官方 Server / SDK / Config / Permissions / MCP / Providers / CLI 文档：补齐 server permission body `{ response, remember? }`、SDK client 自定义 fetch / event stream、Config `{env:VAR}` 变量替换、OpenAI-compatible provider `options.apiKey` env placeholder、MCP local/remote/OAuth 细节和 permission defaults。
- 已深化主方案：新增工程原则、runtime 绑定不变量、未来多 runtime 中立表、runtime 内部边界、manifest、settings normalization、诊断 IPC、server lifecycle 状态机、server key 重启策略、原子写入/hash、私有 config dir、auth source hash、provider allowlist、permission policy JSON、MCP 安全规则、event adapter 状态模型、去重/补读/错误分类、run/resume/stop/concurrency 算法、binary 解析顺序、打包与升级策略、UI 细节、Phase 完成定义、真实验收阶段、smoke summary、最终验收清单和后续演进方向。
- 保持边界：未修改业务代码，未修改根 `README.md` / `AGENTS.md`，未安装依赖，未读取或输出凭证。
- 验证通过：Markdown code fence 检查；文档相对链接检查；`git diff --check -- docs/opencode-support tasks/todo.md`；opencode 旧域名与行尾空白检查。

## 2026-05-27 Agent opencode Runtime 开发方案文档计划

范围确认：本轮只进行调研和方案文档编写，在 `docs/opencode-support/` 下新增 opencode runtime 接入开发方案；不修改业务代码、不修改根 `README.md` / `AGENTS.md`，不安装新依赖，不读取或输出任何凭证。

- [x] 确认仓库状态、最新提交和本轮文档边界，避免纳入无关改动。
- [x] 复习 `tasks/lessons.md` 与现有 `docs/codex-support`、`docs/agent-refactor` 资料，抽取可复用的 runtime registry / event contract / smoke 验证模式。
- [x] 阅读当前 Agent runtime 关键代码：runtime 类型、registry、Claude Code runtime、Codex runtime、orchestrator 路由、runtime event log、renderer 设置与 transcript 回放。
- [x] 调研 opencode 官方资料：CLI / TUI / headless、config、MCP、permission、server/API、认证和分发包形态，并记录可验证来源。
- [x] 编写 `docs/opencode-support` 下的详细开发方案，覆盖目标、非目标、架构、接口契约、配置存储、权限安全、事件映射、UI、测试、分阶段实施和风险。
- [x] 运行 Markdown code fence、文档相对链接和 `git diff --check` 验证。
- [x] 在本节追加 Review，记录实际调研结论、生成文件和验证结果。

## 2026-05-27 Agent opencode Runtime 开发方案文档 Review

- 已确认本轮开始时仓库最新提交为 `4cf6282b docs(tasks): 记录 GitHub feature issues 创建`，范围只包含 `tasks/todo.md` 与新增 `docs/opencode-support/2026-05-27-agent-opencode-runtime-integration-plan.md`。
- 已复习现有 Codex support 和 Agent refactor 文档，并读取 runtime 类型、registry、Codex runtime、Codex event adapter、permission policy、MCP config、runtime event log、Agent Orchestrator routing 和 renderer runtime settings。
- 已调研 opencode 官方 CLI / Server / SDK / Config / Permissions / MCP / Agents / Tools / Providers 文档，并通过 npm registry 确认 2026-05-27 最新稳定包为 `@opencode-ai/sdk@1.15.11` 与 `opencode-ai@1.15.11`；`opencode`、`@opencode-ai/cli` 包名不可用。
- 已生成开发方案：结论明确采用 managed `opencode serve` + `@opencode-ai/sdk` client 作为主路径，`opencode run --format json` 仅作为 smoke/fallback；文档覆盖目标、非目标、当前项目差距、opencode 调研、架构、类型设置、server 管理、配置、auth/provider、permission、MCP、event adapter、run 算法、打包、UI、分阶段实施、smoke、风险与参考来源。
- 已补充复核：官方文档 canonical 域名为 `opencode.ai/docs/*`；`opencode-ai@1.15.11` 的 npm `bin` 为 `opencode -> bin/opencode.exe`，optionalDependencies 包含 darwin/linux/windows 与 baseline/musl 变体，后续实现仍需安装后实测 binary / `.asar.unpacked` 路径。
- 保持边界：未修改业务代码，未修改根 `README.md` / `AGENTS.md`，未安装依赖，未读取或输出凭证。
- 验证通过：Markdown code fence 检查；文档相对链接检查；`git diff --check -- docs/opencode-support tasks/todo.md`；新增文档与任务文件 trailing whitespace 检查；opencode 旧域名残留检查。

## 2026-05-27 Agent Codex Runtime 最新状态与下次启动提示词同步计划

范围确认：本轮只同步 Codex support 文档、下次启动提示词、任务记录和 lessons，明确已完成/未完成事项与最新提交基线；不修改根 `README.md` / `AGENTS.md`，不补跑 `CODEX_SMOKE_API_KEY`，不读取 ambient `OPENAI_API_KEY`，不 stage / commit `apps/electron/out/`。

- [x] 运行 `git status --short` 和 `git log -5 --oneline`，确认最新提交为 `d04ffb95 docs(agent): 完成 Codex Runtime Phase 8 文档`，当前仅有未跟踪 `apps/electron/out/`。
- [x] 更新开发清单最新状态快照、当前完成/未完成总览和阶段提交记录，固定最新基线为 `d04ffb95`。
- [x] 更新 `docs/codex-support/README.md` 和 `docs/codex-support/next-session-prompt.md`，确保下次启动能直接从当前进度继续。
- [x] 将“收尾时同步最新开发状态和下次启动提示词”的习惯记录到 `tasks/lessons.md`。
- [x] 运行 Markdown code fence、docs 相对链接和 `git diff --check -- docs/codex-support tasks/todo.md tasks/lessons.md` 验证。
- [x] 在本节追加 Review，并按阶段纪律提交本轮状态同步。

## 2026-05-27 Agent Codex Runtime 最新状态与下次启动提示词同步 Review

- 已将 Codex support 开发清单、README 和 next-session prompt 的最新基线同步到 `d04ffb95 docs(agent): 完成 Codex Runtime Phase 8 文档`。
- 已明确当前完成项：Phase 0-8 主体实现、真实 smoke、文档发布、故障排查、发布说明和长期维护记录均已完成并提交。
- 已明确当前未完成 / 暂缓项：`CODEX_SMOKE_API_KEY` channel API key smoke 暂缓；真实模型 MCP tool-call smoke、多平台 packaged binary 验证、`danger-full-access` UI、根 README / AGENTS 公开同步仍待后续按需处理。
- 已将“收尾时同步最新开发状态和下次启动提示词”的习惯写入 `tasks/lessons.md`。
- 保持边界：未修改根 `README.md` / `AGENTS.md`，未补跑 API key smoke，未读取 ambient `OPENAI_API_KEY`，未 stage 或提交 `apps/electron/out/`。
- 验证通过：Markdown code fence 检查；docs 相对链接检查；`git diff --check -- docs/codex-support tasks/todo.md tasks/lessons.md`。

## 2026-05-27 Agent Codex Runtime Phase 8 文档发布与长期维护计划

范围确认：本轮直接进入 Phase 8 文档、故障排查、发布说明和长期维护记录；`CODEX_SMOKE_API_KEY` channel API key smoke 继续暂缓，不主动补跑，不读取 ambient `OPENAI_API_KEY`。不修改根 `README.md` / `AGENTS.md`，不 stage / commit `apps/electron/out/` 打包产物；用户已要求不再等待确认，计划写入后直接执行。

- [x] 复习 `AGENTS.md`、`tasks/lessons.md` 和开发清单中的阶段完成即提交、Codex auth 隔离、native `config.toml` 中转配置、Agent stop、runtime events、Git guard、runtime binding 和“不再等待确认”相关教训。
- [x] 运行 `git status --short` 和 `git log -3 --oneline`，确认最新提交为 `2cd195b1 docs(agent): 暂缓 Codex API key smoke`，当前仅有未跟踪 `apps/electron/out/`。
- [x] 读取开发清单“最新开发状态快照”、第 9 节 Phase 7、第 10 节 Phase 8 和第 13 节当前未解决问题。
- [x] 回填主方案中与 Phase 7 实际实现不一致的地方，补充真实 runtime、packaged smoke、MCP 注入和 API key smoke 暂缓边界。
- [x] 更新开发清单 Phase 8：同步阶段状态、真实 smoke test 记录、SDK / CLI 升级兼容记录、已知限制、故障排查和发布说明草稿。
- [x] 更新 `docs/codex-support/README.md` 和 `docs/codex-support/next-session-prompt.md`，让下次启动入口进入 Phase 8 后续维护而不是 API key smoke。
- [x] 运行 Markdown code fence、docs 相对链接和 `git diff --check -- docs/codex-support tasks/todo.md` 验证。
- [x] 在本节追加 Review，并按阶段纪律提交 Phase 8 文档成果。

## 2026-05-27 Agent Codex Runtime Phase 8 文档发布与长期维护 Review

- 已更新主方案：状态从设计方案同步为 Phase 8 实现状态，回填 runtime registry、CodexAgentRuntime、runtime events 历史、feature flag、workspace MCP 注入、真实 smoke 和 channel API key smoke 暂缓边界。
- 已更新开发清单：Phase 8 标记完成，补充真实 smoke test 记录、SDK / CLI 升级兼容记录、已知限制、故障排查和发布说明草稿。
- 已更新 support README 和 next-session prompt：最新基线同步到 `2cd195b1 docs(agent): 暂缓 Codex API key smoke` 后状态，下次启动入口改为 Phase 8 后续维护，不再优先补跑 API key smoke。
- 保持边界：未修改根 `README.md` / `AGENTS.md`，未读取 ambient `OPENAI_API_KEY`，未补跑 `CODEX_SMOKE_API_KEY`，未 stage 或提交 `apps/electron/out/`。
- 验证通过：Markdown code fence 检查；docs 相对链接检查；`git diff --check -- docs/codex-support tasks/todo.md`。

## 2026-05-27 Agent Codex Runtime 暂缓 API Key Smoke 提示词更新计划

范围确认：用户明确要求暂时不做 `CODEX_SMOKE_API_KEY` channel API key smoke 的“有凭证则补跑 / 无凭证则记录阻塞”两项。本轮只更新 Codex support 文档和下次启动提示词，把该 smoke 标为暂缓项，不再作为下次启动优先级或 Phase 8 启动阻塞；不修改根 `README.md` / `AGENTS.md`，不提交 `apps/electron/out/` 打包产物。

- [x] 运行 `git status --short` 和 `git log -3 --oneline`，确认当前最新提交为 `d989ae4f docs(agent): 同步 Codex Runtime 最新状态`，工作树仅有未跟踪 `apps/electron/out/`。
- [x] 复习 `tasks/lessons.md` 中阶段完成即提交、Codex auth 隔离、native `config.toml` 中转配置、runtime binding 和“不再等待确认”相关教训。
- [x] 更新开发清单：将 channel API key smoke 从“下一步先补齐”改为“暂缓/已知未完成，不阻塞 Phase 8”。
- [x] 更新 support README：同步当前未完成项和下一步入口，明确 Phase 8 可继续启动。
- [x] 更新 next-session prompt：移除“若提供凭证则补跑 / 若未提供则记录阻塞”的启动优先级，改为除非用户重新要求否则不要跑该 smoke。
- [x] 运行 Markdown code fence、docs 相对链接和 `git diff --check -- docs/codex-support tasks/todo.md` 验证。
- [x] 在本节追加 Review，并按阶段纪律提交本轮文档更新。

## 2026-05-27 Agent Codex Runtime 暂缓 API Key Smoke 提示词更新 Review

- 已更新开发清单：Phase 7 channel API key smoke 从“下次先补跑”改为“暂缓的已知未完成验证”，除非用户重新明确要求，否则不再作为下次启动优先级或 Phase 8 阻塞项。
- 已更新 support README：下一步改为直接进入 Phase 8 文档、故障排查、发布说明和长期维护记录。
- 已更新 next-session prompt：移除“若提供 `CODEX_SMOKE_API_KEY` 则补跑 / 若未提供则记录阻塞”的优先级，明确不要主动补跑，也不要读取 ambient `OPENAI_API_KEY`。
- 保持边界：未修改根 `README.md` / `AGENTS.md`，未 stage 或提交 `apps/electron/out/`。
- 验证通过：Markdown code fence 检查；Markdown 相对链接检查；`git diff --check -- docs/codex-support tasks/todo.md`。

## 2026-05-26 Agent Codex Runtime 最新状态与启动提示词同步计划

范围确认：本轮只更新 Codex support 文档的最新开发状态和下次启动提示词，明确完成项、未完成项和继续开发入口；不修改根 `README.md` / `AGENTS.md`，不 stage / commit `apps/electron/out/` 打包产物。

- [x] 复习 `tasks/lessons.md` 中阶段完成即提交、Codex auth 隔离、native `config.toml` 中转配置、runtime binding 和“不再等待确认”相关教训。
- [x] 运行 `git status --short` 和 `git log -5 --oneline`，确认当前最新提交为 `b2d8bc5f docs(agent): 记录 Codex API key 最终残余复核`，工作树仅有未跟踪 `apps/electron/out/`。
- [x] 更新 `docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md`：把最新状态推进到 `b2d8bc5f`，明确 Phase 0-7 主体完成、Phase 7 channel API key smoke 和 Phase 8 未完成。
- [x] 更新 `docs/codex-support/README.md`：同步最新提交列表、完成/未完成状态和下次启动入口。
- [x] 更新 `docs/codex-support/next-session-prompt.md`：生成可直接复制给下次 Codex 的最新延续提示词。
- [x] 运行 Markdown code fence、docs 相对链接和 `git diff --check -- docs/codex-support tasks/todo.md` 验证。
- [x] 在本节追加 Review，并按阶段纪律提交本轮文档状态同步。

## 2026-05-26 Agent Codex Runtime 最新状态与启动提示词同步 Review

- 已将开发清单顶部状态和最新开发状态快照同步到 `b2d8bc5f docs(agent): 记录 Codex API key 最终残余复核` 后：Phase 0-7 主体实现与真实 smoke 已完成；Phase 7 唯一残余仍是缺少 `CODEX_SMOKE_API_KEY` 的 channel API key smoke；Phase 8 文档、故障排查、发布说明和长期维护记录未开始。
- 已更新 support README：提交列表加入 `b2d8bc5f`，最新复核保留 API key smoke skipped 事实，不把 skipped 写成通过。
- 已更新 next-session prompt：下次启动先确认 `b2d8bc5f` 或其后的状态同步提交，若只看到 `apps/electron/out/` 未跟踪则继续忽略；下一步先处理 `CODEX_SMOKE_API_KEY`，残余关闭后再进入 Phase 8。
- 保持边界：未修改根 `README.md` / `AGENTS.md`，未 stage 或提交 `apps/electron/out/`。
- 验证通过：Markdown code fence 检查；Markdown 相对链接检查；`git diff --check -- docs/codex-support tasks/todo.md`。

## 2026-05-26 Agent Codex Runtime Phase 7 API Key 最终残余复核计划

范围确认：本轮只复核 Phase 7 唯一残余 `CODEX_SMOKE_API_KEY` channel API key smoke，并把真实结果同步到 Codex support 文档；当前环境未提供 `CODEX_SMOKE_API_KEY` 时保持 `[!]` 阻塞，不默认读取 ambient `OPENAI_API_KEY`，不进入 Phase 8 正文发布维护。不修改根 `README.md` / `AGENTS.md`，不 stage / commit `apps/electron/out/` 打包产物；用户已要求不再等待确认，计划写入后直接执行。

- [x] 复习 `AGENTS.md`、`tasks/lessons.md` 和开发清单中的阶段完成即提交、Codex auth 隔离、native `config.toml` 中转配置、Agent stop、runtime events、Git guard、runtime binding 和“不再等待确认”相关教训。
- [x] 运行 `git status --short` 和 `git log -3 --oneline`，确认当前工作树只有未跟踪 `apps/electron/out/`，最新提交为 `7467ab24 docs(agent): 同步 Codex Runtime 最新进度`。
- [x] 读取开发清单“最新开发状态快照”、第 9 节 Phase 7、第 10 节 Phase 8 和第 13 节当前未解决问题。
- [x] 检查当前环境是否显式提供 `CODEX_SMOKE_API_KEY`，只记录是否存在，不输出 secret；不使用 `OPENAI_API_KEY`，除非有显式 opt-in。
- [x] 补跑 `bun run --filter='@codeinsights/electron' smoke:agent-codex -- --only api-key`；若凭证不存在，确认 `channel-api-key.readonly` skipped 并保持 Phase 7 `[!]`。
- [x] 根据真实结果更新开发清单、support README、next-session prompt 和本 Review；只有 API key smoke 通过后才启动 Phase 8。
- [x] 运行文档 code fence、docs 相对链接和 `git diff --check -- docs/codex-support tasks/todo.md` 验证。
- [x] 按阶段纪律提交本轮记录；提交只包含相关文档/任务文件，不纳入 `apps/electron/out/`。

## 2026-05-26 Agent Codex Runtime Phase 7 API Key 最终残余复核 Review

- 当前环境检查：`CODEX_SMOKE_API_KEY`、`OPENAI_API_KEY`、`CODEX_HOME`、`HTTP_PROXY`、`HTTPS_PROXY`、`ALL_PROXY` 均未设置；本轮没有显式 opt-in 使用 `OPENAI_API_KEY`。
- API key smoke：`bun run --filter='@codeinsights/electron' smoke:agent-codex -- --only api-key` 退出码 0；脚本确认 `@openai/codex-sdk@0.130.0`、`@openai/codex@0.130.0`、binary `codex-cli 0.130.0`，`channel-api-key.readonly` 结果为 skipped，原因是未设置 `CODEX_SMOKE_API_KEY` 且未显式传 `--use-openai-api-key`。
- 结果判断：Phase 7 唯一残余项继续保持 `[!]` 阻塞；本轮不进入 Phase 8 文档发布维护，不伪造 channel API key 成功。
- 已更新 `docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md`、`docs/codex-support/README.md` 和 `docs/codex-support/next-session-prompt.md`，记录本轮真实环境与 skipped 结果。
- 保持边界：未修改根 `README.md` / `AGENTS.md`，未 stage 或提交 `apps/electron/out/`。
- 验证通过：Markdown code fence 检查；Markdown 相对链接检查；`git diff --check -- docs/codex-support tasks/todo.md`。

## 2026-05-26 Agent Codex Runtime 最新开发状态同步计划

范围确认：本轮只更新 Codex support 文档与下次启动提示词，清楚标注已完成、未完成和下一步入口；不修改根 `README.md` / `AGENTS.md`，不处理未跟踪 `apps/electron/out/` 打包产物。

- [x] 复习项目指令和 `tasks/lessons.md` 中阶段完成即提交、Codex auth 隔离、native `config.toml` 中转配置、Agent stop、runtime events、Git guard、runtime binding 和“不再等待确认”相关教训。
- [x] 运行 `git status --short` 和 `git log -5 --oneline`，确认当前仅 `apps/electron/out/` 未跟踪，最新提交为 `217ed1f0 docs(agent): 记录 Codex API key smoke 残余复核`。
- [x] 更新 `docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md`：最新状态快照、当前完成/未完成总览、仓库状态要求和下一步入口同步到 `217ed1f0` 后状态。
- [x] 更新 `docs/codex-support/README.md`：明确已完成范围、阻塞项、Phase 8 未开始和下次启动入口。
- [x] 更新 `docs/codex-support/next-session-prompt.md`：生成下次启动可直接复制的继续开发提示词。
- [x] 运行 Markdown code fence、docs 相对链接和 `git diff --check -- docs/codex-support tasks/todo.md` 验证。
- [x] 在本节追加 Review，并按阶段纪律提交本轮文档状态同步；提交不包含 `apps/electron/out/`。

## 2026-05-26 Agent Codex Runtime 最新开发状态同步 Review

- 已更新开发清单：顶部状态、最新开发状态快照、仓库状态要求和完成/未完成总览均同步到 `217ed1f0 docs(agent): 记录 Codex API key smoke 残余复核` 后状态。
- 已更新 support README：明确已完成 Phase 0-7 主要实现与验证，Phase 7 仅剩 `CODEX_SMOKE_API_KEY` channel API key smoke，Phase 8 文档发布、故障排查、发布说明和长期维护记录未开始。
- 已更新 next-session prompt：下次启动应先确认 `217ed1f0` 或其后的状态同步提交，若仍只有 `apps/electron/out/` 未跟踪则不纳入提交；下一步先处理 API key smoke，关闭残余后再进入 Phase 8。
- 保持边界：未修改根 `README.md` / `AGENTS.md`，未处理 `apps/electron/out/`。
- 验证通过：Markdown code fence 检查；Markdown 相对链接检查；`git diff --check -- docs/codex-support tasks/todo.md`。

## 2026-05-26 Agent Codex Runtime Phase 7 API Key 残余复核计划

范围确认：本轮先复核 Phase 7 唯一残余 `CODEX_SMOKE_API_KEY` channel API key smoke；不默认读取 ambient `OPENAI_API_KEY`，不修改根 `README.md` / `AGENTS.md`，不 stage / commit `apps/electron/out/` 打包产物。若凭证仍未提供，则保持 Phase 7 残余阻塞，只记录真实环境与验证结果，不进入 Phase 8 正文发布维护。

- [x] 复习 `AGENTS.md`、`tasks/lessons.md` 和开发清单中的阶段完成即提交、Codex auth 隔离、native `config.toml` 中转配置、Agent stop、runtime events、Git guard、runtime binding 和“不再等待确认”相关教训。
- [x] 运行 `git status --short` 和 `git log -3 --oneline`，确认当前工作树只有未跟踪 `apps/electron/out/`，最新提交为 `525327cd docs(agent): 同步 Codex Runtime 最新开发状态`。
- [x] 读取开发清单“最新开发状态快照”、第 9 节 Phase 7、第 10 节 Phase 8 和第 13 节当前未解决问题。
- [x] 检查当前环境是否显式提供 `CODEX_SMOKE_API_KEY`，只记录是否存在，不输出 secret；不使用 `OPENAI_API_KEY`，除非有显式 opt-in。
- [x] 若 `CODEX_SMOKE_API_KEY` 存在，补跑 `bun run --filter='@codeinsights/electron' smoke:agent-codex -- --only api-key` 并按真实结果更新 Phase 7 状态；若不存在，运行同一 smoke 确认 skipped，并保持 `[!]`。
- [x] 根据真实结果更新开发清单、support README、next-session prompt 和本 Review；只有 API key smoke 通过后才启动 Phase 8 文档发布与长期维护。
- [x] 运行文档 code fence、docs 相对链接和 `git diff --check -- docs/codex-support tasks/todo.md` 验证。
- [x] 按阶段纪律提交本轮记录；提交只包含相关文档/任务文件，不纳入 `apps/electron/out/`。

## 2026-05-26 Agent Codex Runtime Phase 7 API Key 残余复核 Review

- 当前环境检查：`CODEX_SMOKE_API_KEY`、`OPENAI_API_KEY`、`CODEX_HOME`、`HTTP_PROXY`、`HTTPS_PROXY`、`ALL_PROXY` 均未设置；本轮没有显式 opt-in 使用 `OPENAI_API_KEY`。
- API key smoke：`bun run --filter='@codeinsights/electron' smoke:agent-codex -- --only api-key` 退出码 0，`channel-api-key.readonly` 结果为 skipped，原因是未设置 `CODEX_SMOKE_API_KEY` 且未显式传 `--use-openai-api-key`。
- 结果判断：Phase 7 唯一残余项仍保持 `[!]` 阻塞；本轮不进入 Phase 8 文档发布维护，不伪造 channel API key 成功。
- 已更新 `docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md`、`docs/codex-support/README.md` 和 `docs/codex-support/next-session-prompt.md`，记录本轮真实环境与 skipped 结果。
- 保持边界：未修改根 `README.md` / `AGENTS.md`，未 stage 或提交 `apps/electron/out/`。
- 验证通过：Markdown code fence 检查；Markdown 相对链接检查；`git diff --check -- docs/codex-support tasks/todo.md`。

## 2026-05-26 Agent Codex Runtime history reload 后文档状态同步计划

范围确认：本轮只把最新 HEAD `79c7fc92 test(agent): 补齐 Codex history reload UI smoke`、Phase 7 已完成/未完成项和下次启动提示词同步到 Codex support 文档；不修改根 `README.md` / `AGENTS.md`，不处理未跟踪 `apps/electron/out/` 打包产物。

- [x] 确认当前工作树状态：仅 `apps/electron/out/` 未跟踪，最新提交为 `79c7fc92 test(agent): 补齐 Codex history reload UI smoke`。
- [x] 更新 `docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md`：将 `79c7fc92` 写入最新状态快照、仓库状态要求、Phase 7 记录和阶段提交表，明确 history reload 已完成，API key smoke / MCP / Phase 8 仍未完成。
- [x] 更新 `docs/codex-support/README.md`：同步提交列表、已完成/未完成范围和下次启动检查。
- [x] 更新 `docs/codex-support/next-session-prompt.md`：生成可直接复制给下次 Codex 的最新延续提示词。
- [x] 运行文档 code fence、docs 相对链接和 `git diff --check -- docs/codex-support tasks/todo.md` 验证。
- [x] 在本节末尾追加 Review，并按阶段纪律提交本轮文档状态同步。

## 2026-05-26 Agent Codex Runtime history reload 后文档状态同步 Review

- 当前 HEAD：`79c7fc92 test(agent): 补齐 Codex history reload UI smoke`；工作树除本轮文档改动外，仅有未跟踪 `apps/electron/out/` 打包产物。
- 已更新开发清单：最新状态快照、仓库状态要求、Phase 7 执行记录、第 12 节阶段提交表和第 13 节未解决问题均写入 `79c7fc92`；明确 history reload fixture-based packaged UI reload smoke 已完成，channel API key smoke、MCP 注入和 Phase 8 仍未完成。
- 已更新 docs index：提交列表加入 `79c7fc92`，下次启动检查改为确认该提交或其后的状态同步提交。
- 已更新 next-session prompt：下次 Codex 可直接从 Phase 7 残余项继续，优先处理 `CODEX_SMOKE_API_KEY` channel smoke 和 MCP 注入，残余项关闭后再进入 Phase 8。
- 保持边界：未修改根 `README.md` / `AGENTS.md`，未 stage 或提交 `apps/electron/out/`。
- 验证通过：Markdown code fence 检查；Markdown 相对链接检查；`git diff --check -- docs/codex-support tasks/todo.md`。

## 2026-05-26 Agent Codex Runtime Phase 7 残余验证与 Phase 8 启动计划

范围确认：本轮先关闭 Phase 7 残余验证项，再按条件进入 Phase 8 文档、发布与长期维护。继续遵守“不再等待确认”：计划写入后直接执行；不修改根 `README.md` / `AGENTS.md`，不默认 stage / commit `apps/electron/out/` 打包产物，不默认读取 ambient `OPENAI_API_KEY`。

- [x] 复习 `AGENTS.md` 和 `tasks/lessons.md` 中阶段完成即提交、Codex auth 隔离、native `config.toml` 中转配置、Agent stop、runtime events、Git guard、runtime binding 和“不再等待确认”相关教训。
- [x] 运行 `git status --short` 和 `git log -3 --oneline`，确认当前工作树只有未跟踪 `apps/electron/out/`，最新提交为 `d0783599 docs(agent): 固化 Codex Runtime native 修正后状态`。
- [x] 读取开发清单“最新开发状态快照”、第 9 节 Phase 7、第 10 节 Phase 8 和第 13 节当前未解决问题。
- [x] 梳理 `agent-codex-smoke.ts`、packaged app / Electron smoke 脚本和 history reload UI 入口，确认最小独立验证路径。
- [x] 若当前环境提供 `CODEX_SMOKE_API_KEY`，补跑 `channel-api-key.readonly` smoke；若未提供，只记录 skipped，不读取 `OPENAI_API_KEY`。
- [x] 为 history reload 增加或执行 Electron/packaged app 重开 UI 独立成功验证，不只用 runtime 单测替代。
- [x] 根据真实结果更新开发清单、support README、next-session prompt 和本 Review；成功才关闭对应 `[!]`。
- [x] 判断是否进入 Phase 8：Phase 7 残余项尚未全部关闭，本轮不启动 Phase 8 正文发布维护。
- [x] 运行必要验证：针对新增脚本/测试的 Bun 测试、文档 code fence / 相对链接检查、`git diff --check`；非文档改动按影响范围补充 typecheck。
- [x] 按阶段纪律提交本轮成果；提交只包含相关代码/文档，不纳入无关打包产物。

## 2026-05-26 Agent Codex Runtime Phase 7 残余验证与 Phase 8 启动 Review

- 当前环境未设置 `CODEX_SMOKE_API_KEY`，`OPENAI_API_KEY` 也未设置；已执行 `bun run --filter='@codeinsights/electron' smoke:agent-codex -- --only api-key`，`channel-api-key.readonly` 按预期 skipped，未传 `--use-openai-api-key`。
- 已新增 `CODEINSIGHTS_USER_DATA_DIR` 自动化隔离入口，并收紧为必须同时满足 `CODEINSIGHTS_AUTOMATION=1` 和 `CODEINSIGHTS_CONFIG_DIR`，避免普通 packaged/dev 进程误用独立 Electron profile 但共享真实配置目录。
- 已新增 `apps/electron/scripts/agent-history-reload-ui-smoke.ts` 和 `smoke:agent-history-reload-ui`：脚本预置隔离 Codex agent session、SDKMessage、runtime events 和 `settings.tabState`，启动 packaged app 两次，通过 CDP 断言真实 UI 文本包含历史标题、用户消息和 Codex assistant 消息。该脚本是 fixture-based packaged UI reload smoke，覆盖重开读取与渲染链路，不声称覆盖真实 Codex 写入链路；脚本子进程环境已改为 allowlist，并对失败日志做 secret 脱敏。
- 已按版本规则将 `@codeinsights/electron` 从 `0.0.111` 升至 `0.0.112`。
- 打包验证通过：`CODEINSIGHTS_AGENT_CODEX_RUNTIME=1 CSC_IDENTITY_AUTO_DISCOVERY=false bun run --filter='@codeinsights/electron' dist:fast`，生成 `out/CodeInsights-0.0.112-arm64.dmg`。
- History reload fixture-based packaged UI reload smoke 通过：修正审查问题后复验会话 `history-reload-smoke-4f4c4be2`；两轮 `history-reload.first-open` / `history-reload.reopen` 均 passed，目标 URL 为 packaged `file://.../dist/renderer/index.html`。
- 已更新开发清单、support README 和 next-session prompt：history reload 从 `[!]` 关闭为通过；Phase 7 残余项剩余 `CODEX_SMOKE_API_KEY` channel API key smoke 和 MCP 注入 Codex 原生配置。
- Phase 8 未启动：残余项尚未全部关闭，尤其 MCP 注入仍待实现验证。
- 代码审查整改：修复 High secret 透传/日志泄露风险；修复 `CODEINSIGHTS_USER_DATA_DIR` 缺少自动化门禁风险；收紧 CDP target 判定为 packaged renderer；文档已明确 history reload 为 fixture-based UI reload smoke。
- 最终代码复审：无 Critical / High / Medium；确认 secret 脱敏、env allowlist、packaged target 限制和 fixture-based 文档措辞均已关闭。
- 验证通过：`bun run --filter='@codeinsights/electron' smoke:agent-codex -- --only api-key`（skipped，未读取 `OPENAI_API_KEY`）；`bun run --filter='@codeinsights/electron' typecheck`；`CODEINSIGHTS_AGENT_CODEX_RUNTIME=1 CSC_IDENTITY_AUTO_DISCOVERY=false bun run --filter='@codeinsights/electron' dist:fast`；`bun run --filter='@codeinsights/electron' smoke:agent-history-reload-ui`；Markdown code fence 检查；Markdown 相对链接检查；`git diff --check`。

## 2026-05-26 Agent Codex Runtime 最新状态固化计划

范围确认：本轮只把最新提交 `a439d541`、Phase 7 已完成/未完成项和下次启动提示词固化到 Codex support 文档；不修改根 `README.md` / `AGENTS.md`，不处理 `apps/electron/out/`。

- [x] 确认当前工作树状态：仅 `apps/electron/out/` 未跟踪，最新提交为 `a439d541 test(agent): 修正 Codex native smoke 中转配置`。
- [x] 更新 `docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md`：将 `a439d541` 写入最新状态快照、仓库状态要求、Phase 7 记录和阶段提交表。
- [x] 更新 `docs/codex-support/README.md`：同步最新提交列表、已完成/未完成范围和下次启动检查。
- [x] 更新 `docs/codex-support/next-session-prompt.md`：生成可直接复制给下次 Codex 的最新延续提示词。
- [x] 运行文档 code fence、docs 相对链接和 `git diff --check -- docs/codex-support tasks/todo.md` 验证。
- [x] 在本节末尾追加 Review，并按阶段纪律提交本轮文档状态固化。

## 2026-05-26 Agent Codex Runtime 最新状态固化 Review

- 已确认当前 HEAD：`a439d541 test(agent): 修正 Codex native smoke 中转配置`；工作树仅有 `apps/electron/out/` 未跟踪。
- 已更新开发清单：最新状态快照明确 Phase 7 native / read-only / workspace-write / resume / web-search 已通过，channel API key、history reload、MCP 和 Phase 8 仍未完成；下次启动预期最新提交改为 `a439d541` 或后续状态同步提交。
- 已更新 docs index：提交列表加入 `4e210364`、`1ebde36e`、`a439d541`，下一步改为先补齐 `CODEX_SMOKE_API_KEY` channel API key smoke 与 history reload 独立验证。
- 已更新 next-session prompt：可直接复制给下次 Codex，从当前进度继续开发。
- 验证通过：Markdown code fence 检查；Markdown 相对链接检查；`git diff --check -- docs/codex-support tasks/todo.md`。

## 2026-05-26 Agent Codex Runtime native config 修正计划

范围确认：用户指出当前主机 Codex native auth 使用 `config.toml` 配置中转 API。本轮修正 Phase 7 smoke 隔离逻辑，让 native auth 补跑复制同源 `config.toml`，避免隔离环境丢失 `model_provider` / `base_url` 后误判。不修改根 `README.md` / `AGENTS.md`，不默认提交 `apps/electron/out/`。

- [x] 将本次纠正写入 `tasks/lessons.md`，记录 native auth 隔离必须保留 `config.toml` 中转配置。
- [x] 梳理 Codex runtime / smoke 中 `CODEX_HOME`、`auth.json`、`config.toml` 的处理边界，确认真实 app 路径与 smoke 路径差异。
- [x] 修改 `apps/electron/scripts/agent-codex-smoke.ts`：native smoke 从同一 Codex home 复制 `auth.json` 和可选 `config.toml` 到隔离 `CODEX_HOME`，设置 `0600` 并清理，不输出配置内容。
- [x] 为 native config 复制逻辑补充可执行测试或等价脚本级验证。
- [x] 重跑相关验证：smoke 脚本测试/检查、`bun run --filter='@codeinsights/electron' smoke:agent-codex -- --only native`，以及必要的 `git diff --check`。
- [x] 根据重跑结果更新开发清单、support README、next-session prompt 和本 Review；如果 native 成功，再继续补跑 readonly/workspace-write/resume/web-search/history reload。
- [x] 按阶段纪律提交本轮修复与记录，不纳入 `apps/electron/out/`。

## 2026-05-26 Agent Codex Runtime native config 修正 Review

- 根因确认：主机 `~/.codex/config.toml` 使用 `model_provider = "cch"` 和 `[model_providers.cch] base_url = "https://claude.hanbbq.top/v1"` 中转 API；此前 smoke 只复制 `auth.json` 到隔离 `CODEX_HOME`，导致 native smoke 丢失 provider / base_url 配置。
- 进一步定位：带 `--ignore-user-config` 的 CLI 探针会显式忽略 `config.toml`，因此仍请求默认 `api.openai.com`；去掉该参数并复制 `config.toml` 后，隔离 CLI 探针成功返回 `codeinsights-cli-config-probe-ok`。
- SDK 失败点：`@openai/codex-sdk` 路径在读取中转配置后请求已打到 `https://claude.hanbbq.top/v1/responses`，但原 smoke 硬编码 `modelReasoningEffort: 'minimal'`，中转返回 `level "minimal" not supported`；已改为默认尊重 `config.toml`，仅在显式设置 `CODEX_SMOKE_REASONING_EFFORT` 时覆盖。
- 已修改 `apps/electron/scripts/agent-codex-smoke.ts`：直接执行时才运行 smoke；导出可测试的 native source 解析/复制函数；复制 `auth.json` 和同源可选 `config.toml` 到隔离 `CODEX_HOME`，均设置为 `0600`，清理时删除，不输出配置内容。
- 已新增 `apps/electron/scripts/agent-codex-smoke.test.ts`，覆盖复制 `config.toml` 和缺少 `config.toml` 时只复制 `auth.json` 两种路径。
- 已按项目规则将 `@codeinsights/electron` 版本从 `0.0.110` 升至 `0.0.111`。
- 修正后真实 smoke：`native-auth.readonly` passed，thread `019e63a4-3186-7f40-a97b-a0cd2a6a0932`，终态 `run_completed`，assistant 返回 `codeinsights-codex-native-ok`。
- 补跑成功路径：`readonly-plan.no-write` passed，thread `019e63a5-0a1d-7571-a7f9-2ea212be46b5`；`workspace-write.file-edit` passed，thread `019e63a5-7da1-7fb3-ace8-deec5f2dc74d`；`resume.context` passed，thread `019e63a6-5806-7013-a8af-651efad3ffe5`；`web-search.current-support` passed，thread `019e63a7-0b84-7993-bf33-028d39b15593`；`stop.long-run` passed，终态 `run_stopped`。
- 仍未关闭：`channel-api-key.readonly` 因未设置 `CODEX_SMOKE_API_KEY` 仍 skipped；history reload 仍缺少 Electron/packaged app 重开 UI 的独立成功验证；MCP 仍未注入 Codex 原生配置。
- 验证通过：`bun test apps/electron/scripts/agent-codex-smoke.test.ts`；`bun test apps/electron/src/main/lib/codex-runtime/codex-auth.test.ts apps/electron/src/main/lib/codex-runtime/codex-env.test.ts apps/electron/src/main/lib/codex-runtime/codex-command-guard.test.ts`；`bun test apps/electron/src/main/lib/agent-runtimes/codex-runtime.test.ts`；`bun run --filter='@codeinsights/electron' typecheck`。

## 2026-05-26 Agent Codex Runtime Phase 7 成功路径再次补跑计划

范围确认：本轮先补跑 Phase 7 凭证/网络阻塞的真实 Codex 成功路径 smoke；只有 native / API key 成功路径验证通过后，才进入 Phase 8 文档、发布与长期维护。若凭证或网络仍不可用，保持 `[!]` 阻塞并记录真实错误，不把未验证成功路径写成已通过。不修改根 `README.md` / `AGENTS.md`，不默认提交 `apps/electron/out/` 打包产物。

- [x] 复习 `AGENTS.md` 和 `tasks/lessons.md` 中阶段完成即提交、Codex auth 隔离、Agent stop、runtime events、Git guard、runtime binding 和“不再等待确认”相关教训。
- [x] 运行 `git status --short`、`git log -3 --oneline` 和 `git branch --show-current`，确认当前分支为 `codex/agent-codex-runtime-phase-0`，工作树仅有未跟踪 `apps/electron/out/`，最新提交为 `4e210364 docs(agent): 固化 Codex Runtime 最新开发状态`。
- [x] 读取开发清单“最新开发状态快照”、第 9 节 Phase 7 执行记录、第 10 节 Phase 8 和第 13 节当前未解决问题。
- [x] 复核 `agent-codex-smoke.ts` 的参数、凭证隔离策略、pass/fail/skipped 判定和产物记录方式。
- [x] 检查当前环境中的 Codex native auth、`CODEX_SMOKE_API_KEY`、代理变量和 OpenAI / ChatGPT / Codex plugin GitHub 网络连通性。
- [x] 使用隔离 `CODEINSIGHTS_CONFIG_DIR` / `CODEX_HOME` 补跑 binary、native、api-key，并用隔离 CLI 探针复核；由于 native/API key 均未形成可用成功路径，read-only、workspace-write、resume、web-search 继续按同一外部条件保持阻塞，不伪造通过。
- [x] 若 smoke 能生成成功会话，补跑 history reload 相关验证；否则明确保留 history reload 阻塞。
- [x] 根据真实 smoke 结果更新开发清单、support README、next-session prompt 和本 Review：成功才关闭对应 `[!]`，失败则记录命令、线程/终态、错误和环境边界。
- [x] 判断是否进入 Phase 8：只有 Phase 7 成功路径关闭后才启动；否则不进入 Phase 8。
- [x] 运行文档 code fence、docs 相对链接和 `git diff --check -- docs/codex-support tasks/todo.md` 验证。
- [x] 在本节末尾追加 Review，并按阶段纪律只提交本轮相关文档/记录文件。

## 2026-05-26 Agent Codex Runtime Phase 7 成功路径再次补跑 Review

- 已复核 `apps/electron/scripts/agent-codex-smoke.ts`：`native` / `api-key` 成功标准分别要求 assistant 包含约定 token 且终态 `run_completed`；`workspace-write`、`readonly`、`resume`、`web-search` 均依赖有效 native auth 或 `CODEX_SMOKE_API_KEY` 成功路径；`OPENAI_API_KEY` 只有显式 `--use-openai-api-key` 才会被读取。
- 当前环境：`~/.codex/auth.json` 存在；`CODEX_SMOKE_API_KEY`、`OPENAI_API_KEY`、`CODEX_HOME`、`HTTP_PROXY`、`HTTPS_PROXY`、`ALL_PROXY` 均未设置；smoke 脚本会把 native auth 复制到隔离 `CODEX_HOME` 并设置为 `0600`。
- Binary smoke：`bun run --filter='@codeinsights/electron' smoke:agent-codex -- --only binary` 通过，`@openai/codex-sdk@0.130.0`、`@openai/codex@0.130.0`，binary 输出 `codex-cli 0.130.0`。
- 网络探针：`curl -I --max-time 20 https://api.openai.com/v1/models`、`https://chatgpt.com/backend-api/plugins/featured?platform=codex`、`https://github.com/openai/plugins.git` 均超时；`git ls-remote https://github.com/openai/plugins.git` 30 秒超时。
- API key smoke：`bun run --filter='@codeinsights/electron' smoke:agent-codex -- --only api-key` 因未设置 `CODEX_SMOKE_API_KEY` 且未显式 opt-in `OPENAI_API_KEY`，按预期 skipped。
- Native smoke：`bun run --filter='@codeinsights/electron' smoke:agent-codex -- --only native` 创建 thread `019e6365-c0e0-7911-a2e0-7b6ef311c091` 后 120 秒内未完成 token 响应，终态 `run_stopped`，命令退出码 1。
- CLI 探针：隔离 `CODEX_HOME` / `HOME` 运行 `codex exec --skip-git-repo-check --ignore-user-config --ignore-rules -s read-only --json` 创建 thread `019e6368-829b-75f3-9384-a8c22d5f61b7`，随后持续 `Reconnecting...`、`stream disconnected`，并出现 plugin sync warning 与 GitHub clone `early EOF`，100 秒外层超时；临时 auth 目录已清理。
- 结果判断：当前没有可验证的 Codex 成功请求路径，Phase 7 native / workspace-write / read-only / resume / web-search / history reload 继续保持 `[!]` 阻塞；history reload 没有成功会话可回放，因此未进入该验证；Phase 8 不启动。
- 已更新 `docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md`、`docs/codex-support/README.md`、`docs/codex-support/next-session-prompt.md`，未修改根 `README.md` / `AGENTS.md`，未处理 `apps/electron/out/`。
- 验证通过：Markdown code fence 检查；Markdown 相对链接检查；`git diff --check -- docs/codex-support tasks/todo.md`。

## 2026-05-26 Agent Codex Runtime 最新状态文档同步计划

范围确认：本轮只把最新提交 `a02cbbf5` 和当前完成/未完成状态写回 Codex support 文档与下次启动提示词；不修改根 `README.md` / `AGENTS.md`，不处理 `apps/electron/out/`。

- [x] 确认当前工作树状态：仅 `apps/electron/out/` 未跟踪，最新提交为 `a02cbbf5 docs(agent): 同步 Codex Runtime Phase 7 smoke 补跑状态`。
- [x] 更新 `docs/codex-support/README.md`：将 `a02cbbf5` 固定为最新状态同步提交，并明确下次启动先确认该提交。
- [x] 更新 `docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md`：在最新开发状态快照中标注 Phase 7 smoke 补跑状态已提交，保留 Phase 7 成功路径 `[!]` 阻塞和 Phase 8 未开始。
- [x] 更新 `docs/codex-support/next-session-prompt.md`：把 `a02cbbf5` 写入当前状态和启动检查步骤。
- [x] 运行文档 code fence、相对链接和 `git diff --check -- docs/codex-support tasks/todo.md` 验证。
- [x] 提交本轮文档状态同步，并在最终回复中给用户可直接复制的下次启动提示词。

## 2026-05-26 Agent Codex Runtime 最新状态文档同步 Review

- 已明确当前完成项：Phase 0-7 真实实现、打包验证、安全加固、binary / stop / packaged startup smoke 已完成；Phase 7 smoke 补跑状态已提交 `a02cbbf5`。
- 已将最新状态同步提交固化为标题 `docs(agent): 固化 Codex Runtime 最新开发状态`，下次启动提示词要求以 `git log -1 --oneline` 确认实际最新 HEAD。
- 已明确当前未完成项：Phase 7 native / readonly / workspace-write / resume / web-search / history reload 成功路径仍受外部网络/凭证阻塞；Phase 8 文档发布与长期维护尚未开始。
- 已保持边界：根 `README.md` / `AGENTS.md` 未修改，`apps/electron/out/` 未提交。
- 验证通过：Markdown code fence 检查；Markdown 相对链接检查；`git diff --check -- docs/codex-support tasks/todo.md`。

## 2026-05-26 Agent Codex Runtime Phase 7 成功路径补跑与 Phase 8 启动计划

范围确认：本轮先补跑 Phase 7 凭证阻塞的真实 Codex 成功路径 smoke；只有 native / API key 成功路径关闭后，才进入 Phase 8 文档、发布和长期维护。若凭证仍不可用，保持 `[!]` 阻塞并记录真实错误，不伪造通过。不修改根 `README.md` / `AGENTS.md`，不默认提交 `apps/electron/out/` 打包产物。

- [x] 复习 `AGENTS.md` 和 `tasks/lessons.md` 中阶段完成即提交、Codex auth 隔离、Agent stop、runtime events、Git guard、runtime binding 和“不再等待确认”相关教训。
- [x] 运行 `git status --short` 和 `git log -3 --oneline`，确认工作树仅有未跟踪 `apps/electron/out/`，当前最新提交为 `7d864d16 docs(agent): 同步 Codex Runtime Phase 7 后续状态`。
- [x] 读取开发清单“最新开发状态快照”、第 9 节 Phase 7 执行记录、第 10 节 Phase 8 和第 13 节当前未解决问题。
- [x] 复核 `agent-codex-smoke.ts` 参数、凭证隔离策略和产物记录方式，确认不默认读取 ambient `OPENAI_API_KEY`。
- [x] 使用隔离 `CODEINSIGHTS_CONFIG_DIR` 补跑 native smoke：创建 thread 后 120 秒超时，终态 `run_stopped`；随后隔离 CLI 探针创建 thread 后持续 reconnect / stream disconnected 并 90 秒超时。readonly / workspace-write / resume / web-search / history reload 因没有可用 native/API key 成功路径且网络探针超时，保持 `[!]` 阻塞，不伪造通过。
- [x] 若存在 `CODEX_SMOKE_API_KEY`，补跑 channel API key 模式 smoke；若不存在，只记录 skipped，不读取 ambient `OPENAI_API_KEY`。
- [x] 根据真实 smoke 结果更新开发清单和本 Review：成功则关闭对应 `[!]`，失败则记录具体错误、命令范围和环境边界。
- [x] 判断是否进入 Phase 8：本轮 Phase 7 成功路径未关闭，因此不进入 Phase 8 正文发布维护。
- [x] 运行对应阶段验证：文档 code fence 检查、docs 相对链接检查、`git diff --check -- docs/codex-support tasks/todo.md`；必要时补充 smoke 脚本验证。
- [x] 在本节末尾追加 Review，并按阶段纪律只提交本阶段相关文件。

## 2026-05-26 Agent Codex Runtime Phase 7 成功路径补跑 Review

- 已复核 `apps/electron/scripts/agent-codex-smoke.ts`：支持 `--only binary|native|api-key|workspace-write|readonly|stop|resume|web-search|mcp`；API key smoke 默认只读取 `CODEX_SMOKE_API_KEY`，`OPENAI_API_KEY` 只有显式 `--use-openai-api-key` 才会使用；默认清理隔离 auth 副本和临时产物。
- 当前环境检查：`~/.codex/auth.json` 存在；`CODEX_SMOKE_API_KEY`、`OPENAI_API_KEY`、`CODEX_HOME` 均未设置；`HTTP_PROXY` / `HTTPS_PROXY` / `ALL_PROXY` 均未设置。
- Native smoke 补跑：`bun run --filter='@codeinsights/electron' smoke:agent-codex -- --only native` 使用隔离 `CODEINSIGHTS_CONFIG_DIR` / `CODEX_HOME`，创建 thread `019e6329-a3bc-73c1-9b30-095a8223360e` 后 120 秒内未完成成功回答，终态 `run_stopped`，命令退出码 1。
- API key smoke 补跑：`bun run --filter='@codeinsights/electron' smoke:agent-codex -- --only api-key` 因未设置 `CODEX_SMOKE_API_KEY` 且未显式 opt-in `OPENAI_API_KEY`，按预期 skipped，命令退出码 0。
- CLI 探针：隔离 `codex exec --skip-git-repo-check --ignore-user-config --ignore-rules -s read-only --json` 创建 thread `019e632e-5007-7b33-9789-bf5f8a0294b3`，随后出现 `Reconnecting...`、`stream disconnected` 和 Codex plugin sync timeout，90 秒超时。
- 网络探针：`curl -I --max-time 20 https://api.openai.com/v1/models`、`https://chatgpt.com/backend-api/plugins/featured?platform=codex`、`https://github.com/openai/plugins.git` 均超时；本轮没有可验证的成功 Codex 请求路径。
- 结果判断：Phase 7 native / readonly / workspace-write / resume / web-search / history reload 成功路径继续保持 `[!]` 阻塞；history reload 仍没有独立 smoke 脚本，需要成功生成可回放会话后通过 Electron / packaged app 手动验证；Phase 8 不启动。
- 已更新 `docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md`、`docs/codex-support/README.md`、`docs/codex-support/next-session-prompt.md`，记录本轮真实错误和网络环境；未修改根 `README.md` / `AGENTS.md`，未处理 `apps/electron/out/`。
- 验证通过：Markdown code fence 检查；Markdown 相对链接检查；`git diff --check -- docs/codex-support tasks/todo.md`。

## 2026-05-26 Agent Codex Runtime Phase 7 后状态文档同步计划

范围确认：本轮只同步 Phase 7 提交后的最新开发状态、未完成项和下次启动提示词；不进入 Phase 8 正文发布维护、不修改根 `README.md` / `AGENTS.md`、不处理打包产物 `apps/electron/out/`。

- [x] 复习 `tasks/lessons.md` 中阶段完成即提交、Codex auth 隔离、Agent stop、runtime events、Git guard、runtime binding 和“不再等待确认”相关教训。
- [x] 运行 `git status --short` 和 `git log -3 --oneline`，确认最新实现提交为 `1b94f9ad test(agent): 完成 Codex Runtime Phase 7 真实集成验证`，工作树仅有未跟踪打包产物 `apps/electron/out/`。
- [x] 更新 `docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md`：标注 Phase 7 已提交、Phase 7 成功路径凭证补跑仍阻塞、Phase 8 未开始。
- [x] 更新 `docs/codex-support/README.md`：同步最新状态、提交列表、未完成范围和下一步入口。
- [x] 更新 `docs/codex-support/next-session-prompt.md`：生成可直接复制给下次 Codex 的延续提示词。
- [x] 运行文档级旧状态扫描、Markdown code fence 检查、相对链接检查和 diff 空白检查。
- [x] 在本节末尾追加 Review，并单独提交本轮状态同步文档。

## 2026-05-26 Agent Codex Runtime Phase 7 后状态文档同步 Review

- 已更新 `docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md`：顶部状态、最新开发状态快照、当前完成/未完成总览、第 9 节 Phase 7 和阶段提交记录均写入 Phase 7 提交 `1b94f9ad`。
- 已将 Phase 7 状态拆清：真实 Codex runtime 接入、打包验证、安全加固和可离线 smoke 已完成；native / workspace-write / read-only / resume / web-search / history reload 成功路径仍因外部凭证阻塞标为 `[!]`。
- 已更新 `docs/codex-support/README.md`：最新状态加入 Phase 7，未完成范围改为 Phase 7 凭证成功路径补跑与 Phase 8，下一步入口改为先补跑残余 smoke。
- 已更新 `docs/codex-support/next-session-prompt.md`：下次启动提示词改为 Phase 7 残余 smoke 补跑优先，补跑通过后再进入 Phase 8；明确 `apps/electron/out/` 是本地打包产物，不应默认提交。
- 验证通过：旧状态关键字扫描无过期命中；Markdown code fence 检查通过；Markdown 相对链接检查通过；`git diff --check -- docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md docs/codex-support/README.md docs/codex-support/next-session-prompt.md tasks/todo.md` 通过。
- 阶段边界：未修改根 `README.md` / `AGENTS.md`，未进入 Phase 8 正文发布维护，未提交 `apps/electron/out/` 打包产物。

## 2026-05-26 Agent Codex Runtime Phase 7 计划

范围确认：本轮只做 Phase 7 真实 Codex SDK / CLI 集成与指定验证；不混入 Phase 8 文档发布、发布说明、README.md / AGENTS.md 修改或长期维护。产品决策门禁沿用清单推荐值，不再等待确认。

- [x] 复习 `AGENTS.md` 和 `tasks/lessons.md` 中阶段完成即提交、Codex auth 隔离、Agent stop、runtime events、Git guard、runtime binding 和“不再等待确认”相关教训。
- [x] 运行 `git status --short`、`git log -1 --oneline` 和 `git branch --show-current`，确认当前分支与工作树状态，不回滚任何用户改动。
- [x] 读取开发清单“最新开发状态快照”、第 8 节 Phase 6 执行记录和第 9 节 Phase 7 范围。
- [x] 确认 `@openai/codex-sdk` / `@openai/codex` 当前本地版本、官方 SDK 接口和可用平台 binary 包策略。
- [x] 审计并修正 `apps/electron/package.json` 的 esbuild external，确保 Codex SDK / CLI 不被主进程打包吞掉。
- [x] 审计 `apps/electron/electron-builder.yml` 的 files，确认 SDK、CLI 和平台 binary 包进入 packaged app。
- [x] 确认 macOS arm64 binary 可解析，并记录 macOS x64 与 Windows x64 binary 策略。
- [x] 使用隔离 `CODEINSIGHTS_CONFIG_DIR` 设计/执行真实 Agent Codex smoke：native auth、channel API key、workspace-write、read-only plan、stop、resume、history reload。
- [x] 按当前真实支持情况记录 web search / MCP smoke 结果。
- [x] 执行 Phase 7 推荐验证：`bun run typecheck`、`bun test --isolate`、`bun run electron:build`、`CSC_IDENTITY_AUTO_DISCOVERY=false bun run dist:fast`。
- [x] 打包后运行 Agent Codex smoke，记录 packaged app 结果。
- [x] 在本节末尾追加 Review，更新开发清单 Phase 7 状态与验证证据，并按阶段纪律单独提交 Phase 7 成果。

## 2026-05-26 Agent Codex Runtime Phase 7 Review

- 已将 Agent 服务里的 Codex runtime 从 Phase 5/6 mock 切到真实 `CodexAgentRuntime`，保留 `CODEINSIGHTS_AGENT_CODEX_RUNTIME` feature flag。
- 已确认本地依赖：`@openai/codex-sdk@0.130.0`、`@openai/codex@0.130.0`；npm 最新为 `0.133.0`，本阶段未升级依赖，只验证当前锁定版本。
- 已确认官方 TypeScript SDK 契约仍是 `@openai/codex-sdk`、`Codex().startThread()` / `resumeThread()` / streaming API；本地实现继续动态 import SDK。
- 已确认 esbuild `build:main` / `watch:main` external 包含 `@openai/codex-sdk` 与 `@openai/codex`。
- 已确认 `electron-builder.yml` files 包含 `@openai/codex-sdk`、`@openai/codex` 和 Codex 平台包；本机 Bun 仅安装并打包 `@openai/codex-darwin-arm64`，macOS x64 / Windows x64 依赖对应平台 runner 安装 optionalDependencies。
- macOS arm64 binary 验证通过：本地与 packaged app 内 `codex` / `codex.js` 均输出 `codex-cli 0.130.0`。
- 已新增 `apps/electron/scripts/agent-codex-smoke.ts` 和 `smoke:agent-codex` 脚本，默认使用隔离 `CODEINSIGHTS_CONFIG_DIR`、隔离 `CODEX_HOME` 和临时 workspace；支持 binary、native、api-key、workspace-write、readonly、stop、resume、web-search、MCP 记录；默认清理临时 auth 副本，保留产物需要显式 `--keep-artifacts`。
- 已修复代码审查指出的 Codex resume 模型漂移风险：已绑定 Codex thread 只使用 session 绑定模型，不再回退当前全局设置；首次 `run_started` 会回填实际可持久化模型，`Codex default` 不伪造为模型 ID。
- 已修复 Runner v2 stop 竞态下 abort 分支未 flush 已累计 assistant 消息的问题，并补充 runtime event 等待测试。
- 已修复安全审查指出的 Agent Codex Git guard 绕过风险：真实运行前对 `repositoryRoot`、`workingDirectory` 和 `additionalDirectories` 内的 Git repo 建立快照，终态前校验并回滚真实 commit / refs / index / config 污染。
- 已收紧 smoke 凭证处理：复制的 native `auth.json` 使用 `0600` 权限，正常和异常路径都会清理；`OPENAI_API_KEY` 只有显式 `--use-openai-api-key` 才会作为 API key smoke 输入。
- 真实 smoke 结果：`binary.darwin-arm64` 通过；`stop.long-run` 通过，最终终态 `run_stopped`；`channel-api-key.readonly` 因未设置 `CODEX_SMOKE_API_KEY` 且未显式传 `--use-openai-api-key` 跳过。
- 真实 native auth / readonly / workspace-write / resume / web-search 均实际创建 Codex thread，但本机 native auth 中的 OpenAI key 被后端返回 `401 invalid_api_key`，因此成功回答、写文件、resume 上下文和 web search 成功路径未能完成；readonly 文件在失败时保持未写入。
- MCP 当前记录为 skipped：Phase 7 尚未把 CodeInsights workspace MCP 注入 Codex 原生配置。
- 打包验证通过：`CSC_IDENTITY_AUTO_DISCOVERY=false bun run dist:fast` 生成 `CodeInsights-0.0.110-arm64.dmg`；packaged app 启动 8 秒未退出，隔离配置目录初始化成功；存在非本阶段阻断的 icon 路径 warning。
- 验证通过：`bun run typecheck`；`bun test --isolate`，600 pass / 0 fail；`bun run electron:build`；`CSC_IDENTITY_AUTO_DISCOVERY=false bun run dist:fast`；packaged app startup smoke；`git diff --check`（提交前重跑）。
- 阶段边界：未修改根 `README.md` / `AGENTS.md`，未进入 Phase 8 发布文档或长期维护；真实成功路径残留阻塞是本机 Codex 凭证无效，需要有效 native auth 或 `CODEX_SMOKE_API_KEY` 后重跑 smoke。

### Phase 7 安全审查整改

- [x] 为 Agent Codex runtime 增加 Git 快照校验，覆盖绝对路径 `git` 绕过 PATH/env guard 后创建 commit、修改 refs、index 或 config 的场景。
- [x] 收紧 `agent-codex-smoke.ts` 凭证处理：默认清理临时 auth 副本，保留产物需要显式 opt-in；复制 auth 后限制权限。
- [x] 取消 smoke 默认读取 ambient `OPENAI_API_KEY`，改为 `CODEX_SMOKE_API_KEY` 优先，`OPENAI_API_KEY` 需要显式 opt-in。
- [x] 针对整改重跑 Codex guard/runtime/smoke 相关测试、`bun run typecheck`、`bun test --isolate` 和 `git diff --check`。

安全整改验证：

- `bun test apps/electron/src/main/lib/codex-runtime/codex-command-guard.test.ts apps/electron/src/main/lib/agent-runtimes/codex-runtime.test.ts` 通过，19 pass / 0 fail。
- `bun run --filter='@codeinsights/electron' smoke:agent-codex -- --only binary` 通过，且 summary 不再输出 auth 目录路径。
- `bun run --filter='@codeinsights/electron' smoke:agent-codex -- --only api-key` 在未设置 `CODEX_SMOKE_API_KEY` 且未 opt-in `OPENAI_API_KEY` 时按预期 skipped。
- 安全复审确认原 High / Medium / Critical 已关闭，无新的 Critical / High / Medium。

## 2026-05-25 Agent Codex Runtime Phase 5 后状态文档同步计划

- [x] 检查当前工作树和最新提交，确认 Phase 5 已提交且文档同步从干净状态开始。
- [x] 更新 `docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md`：标注 Phase 0-5 已完成，Phase 6-8 未完成，下一步入口改为 Phase 6。
- [x] 更新 `docs/codex-support/README.md`：同步最新状态、提交列表、未完成范围和下一步。
- [x] 更新 `docs/codex-support/next-session-prompt.md`：生成可直接复制给下次 Codex 的 Phase 6 启动提示词。
- [x] 运行文档级旧状态扫描、Markdown code fence 检查、相对链接检查和 diff 空白检查。
- [x] 在本节末尾追加 Review，确认未修改根 `README.md` / `AGENTS.md`，不进入 Phase 6 实现。

## 2026-05-25 Agent Codex Runtime Phase 5 后状态文档同步 Review

- 已确认本轮开始前工作树干净，最新实现提交为 `40441fe8 feat(agent): 完成 Codex Runtime Phase 5 编排路由`。
- 已更新 `docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md`：顶部状态、最新开发状态快照、当前完成/未完成总览、第 7 节 Phase 5 执行记录和第 12 节阶段提交记录均同步到 Phase 5 完成后状态。
- 已更新 `docs/codex-support/README.md`：最新状态加入 Phase 5，未完成范围改为 Phase 6-8，下一步入口改为第 8 节 Phase 6。
- 已更新 `docs/codex-support/next-session-prompt.md`：下次启动提示词改为 Phase 6 Renderer 设置、历史与 UX，明确不混入 Phase 7 真实 Codex SDK / CLI 或打包发布验证。
- 验证通过：旧状态关键字扫描无过期命中；Markdown code fence 与相对链接检查通过；`git diff --check -- docs/codex-support/README.md docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md docs/codex-support/next-session-prompt.md tasks/todo.md` 通过。
- 阶段边界：未修改根 `README.md` / `AGENTS.md`，未进入 Phase 6 实现。

## 2026-05-25 Agent Codex Runtime Phase 5 计划

范围确认：本轮只做 Phase 5 Orchestrator runtime routing；不混入 Phase 6 Renderer UI、Phase 7 真实 Codex SDK / CLI 集成、打包发布验证、README.md 或 AGENTS.md 修改。Codex 路径继续使用 Phase 4 mock runtime，不依赖本机登录或真实 API key。

- [x] 复习 `AGENTS.md` 和 `tasks/lessons.md` 中阶段完成即提交、Codex auth 隔离、Agent stop、runtime events、Git guard 和“不再等待确认”相关教训。
- [x] 运行 `git status --short`、`git branch --show-current` 和 `git log -1 --oneline`，确认当前分支为 `codex/agent-codex-runtime-phase-0`，工作树干净，最新提交为 `dab64231 docs: 同步 Agent Codex Runtime Phase 4 后续状态`。
- [x] 读取开发清单“最新开发状态快照”、第 6 节 Phase 4 执行记录和第 7 节 Phase 5 范围。
- [x] 梳理现有 Claude Orchestrator、Phase 4 `CodexAgentRuntime`、runtime event log、session/settings 契约和测试风格，确定最小 routing 改动。
- [x] 先补 Phase 5 测试：默认 Claude、legacy `sdkSessionId`、settings 选择 Codex、新旧绑定不随 settings 切换、stop 不落 `run_completed`、Codex `thread.started` 持久化和 runtime 抛错清理 active run。
- [x] 新增 `CodingAgentRuntimeRegistry`，实现 runtime 注册、默认 runtime、运行中切换保护和 session/settings/default 优先级解析。
- [x] 必要时新增 `ClaudeCodeRuntime` 薄包装或等价 registry adapter，保持 Claude 默认路径行为不变。
- [x] 更新 Orchestrator / service / event log / session manager / IPC handler 的最小 runtime routing 代码，让 Codex run 写 runtime event log，stop 同时触发 active abort controller 和 runtime abort。
- [x] complete 前执行 active session / abort state 二次检查，runtime unsupported capability 透传为 UI 可处理的错误或状态。
- [x] 运行 Phase 5 推荐验证：`bun test apps/electron/src/main/lib/agent-orchestrator.test.ts`、`bun test apps/electron/src/main/lib/agent-runtime-runner.test.ts`、`bun run --filter='@codeinsights/electron' typecheck`、`git diff --check -- apps/electron/src/main/lib apps/electron/src/main/ipc tasks/todo.md`。
- [x] 在本节末尾追加 Review，确认阶段边界、验证结果和提交范围，并只提交 Phase 5 相关文件。

## 2026-05-25 Agent Codex Runtime Phase 5 Review

- 已新增 `apps/electron/src/main/lib/agent-runtimes/coding-agent-runtime-registry.ts`：统一注册/获取/释放 Coding Agent runtime，并提供 `resolveAgentRuntimeSelection()`，按 session runtimeSession > legacy sdkSessionId > settings > default 解析路由。
- 已新增 `apps/electron/src/main/lib/agent-runtimes/claude-code-runtime.ts`：Claude Code 的 registry wrapper，保留现有 adapter 行为，queue / permission capability 仍返回结构化 unsupported。
- 已在 `apps/electron/src/main/lib/agent-service.ts` 注入 runtime registry：默认注册 ClaudeCodeRuntime + Phase 5 mock Codex runtime；Codex 不调用真实 SDK / CLI / auth，只产出 mock envelopes。
- 已更新 `apps/electron/src/main/lib/agent-orchestrator.ts`：先做 runtime 选择，再按 runtime 分支执行；Codex 分支消费 `AgentStreamEnvelope`、写 runtime event log、回填 `runtimeSession`，stop 同时 abort active controller 与 runtime，complete 前补做 active/abort 二次检查。
- 已更新 `apps/electron/src/main/lib/agent-runtime-event-log.ts`：支持直接追加 runtime envelope；`startAgentRuntimeEventLogRun()` 可记录 `runtimeKind`。
- 已更新 `apps/electron/src/main/lib/agent-runtime-runner.ts`：legacy Claude runner 继续写 `runtimeKind: 'claude-code'`。
- 已扩展 `packages/shared/src/types/agent.ts` 的 `AgentRuntimeSessionRef`，Codex 绑定时固化 `channelId` / `model`；`@codeinsights/shared` patch 版本升至 `0.1.44`。
- 已将 Orchestrator active run generation 从 `Date.now()` 改为单调计数，避免同一毫秒 stop + 重跑时旧 run 清理新 run。
- 已调整运行中权限切换：Codex 等不支持 `setPermissionMode` 的 runtime 先返回 unsupported，再决定是否更新本地状态，避免本地状态被错误污染。
- 已更新 `apps/electron/package.json` 版本到 `0.0.108`。
- 已新增测试：`agent-orchestrator.test.ts`、`coding-agent-runtime-registry.test.ts`，并补充 `agent-runtime-event-log.test.ts`；覆盖默认 Claude、legacy sdkSessionId、settings Codex、新旧绑定不切换、Codex 运行时 event log、stop 后 late terminal 去重。
- 代码审查：首轮审查指出 active generation 使用 `Date.now()`、Codex runtimeSession 未固化 channel/model、unsupported permission 切换先污染本地状态；均已修复，复审无 Critical / High / Medium findings。
- 验证通过：`bun test apps/electron/src/main/lib/agent-orchestrator.test.ts`；`bun test apps/electron/src/main/lib/agent-runtime-runner.test.ts`；`bun test apps/electron/src/main/lib/agent-runtime-event-log.test.ts`；`bun test apps/electron/src/main/lib/agent-runtimes/codex-runtime.test.ts`；`bun test apps/electron/src/main/lib/agent-runtimes/coding-agent-runtime-registry.test.ts`；`bun test apps/electron/src/main/lib/agent-session-manager.test.ts`；`bun test packages/shared`；`bun run --filter='@codeinsights/electron' typecheck`；`git diff --check -- apps/electron/src/main/lib apps/electron/src/main/ipc packages/shared tasks/todo.md tasks/lessons.md`。
- 阶段边界：未接入 Phase 6 Renderer UI、未做真实 Codex SDK / CLI 集成、未修改 README.md 或 AGENTS.md。

## 2026-05-25 Agent Codex Runtime Phase 4 后状态文档同步计划

- [x] 更新 `docs/codex-support/README.md`：把最新状态从 Phase 3 切到 Phase 4，明确 Phase 5-8 未完成，下一步为 Phase 5。
- [x] 更新 `docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md`：写入 Phase 4 实际提交 `2c7ebb94`、验证记录和当前完成/未完成总览。
- [x] 更新 `docs/codex-support/next-session-prompt.md`：生成可直接复制给下次 Codex 的 Phase 5 启动提示词。
- [x] 运行文档级验证、旧状态扫描和 diff 检查，在本节末尾追加 Review 并单独提交状态同步。

## 2026-05-25 Agent Codex Runtime Phase 4 后状态文档同步 Review

- 已更新 `docs/codex-support/README.md`：最新状态改为 Phase 4 提交后，已完成项加入 Phase 4 CodexAgentRuntime Mock 接入，未完成项从 Phase 5 开始，下一步入口改为第 7 节 Phase 5。
- 已更新 `docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md`：最新开发状态快照、当前总览、Phase 4 阶段记录和阶段提交记录均写入 `2c7ebb94 feat(agent): 完成 Codex Runtime Phase 4 mock runner`。
- 已更新 `docs/codex-support/next-session-prompt.md`：下次启动提示词改为 Phase 5 Orchestrator Runtime Routing，明确不混入 Renderer UI 或真实 Codex SDK / CLI 集成。
- 验证通过：旧状态关键字扫描无命中；Markdown code fence 检查通过；Markdown 相对链接检查通过；`git diff --check -- docs/codex-support/README.md docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md docs/codex-support/next-session-prompt.md tasks/todo.md` 通过。

## 2026-05-25 Agent Codex Runtime Phase 4 计划

范围确认：本轮只做 Phase 4 `CodexAgentRuntime` mock 接入、Codex SDK client factory 和 permission policy；不混入 Phase 5 Orchestrator routing、Phase 6 Renderer UI、Phase 7 真实 Codex 集成，不调用真实 Codex SDK / CLI，不依赖本机登录或真实 API key。

- [x] 复习 `AGENTS.md` 和 `tasks/lessons.md` 中阶段完成即提交、Codex auth 隔离、Agent stop、runtime events、Git guard 相关教训。
- [x] 运行 `git status --short` 和 `git log -1 --oneline`，确认当前工作树干净，最新提交为 `37570294 docs: 同步 Agent Codex Runtime Phase 3 后续状态`。
- [x] 读取开发清单“最新开发状态快照”、Phase 3 执行记录和第 6 节 Phase 4 范围。
- [x] 梳理 Phase 2 `codex-runtime` core、Phase 3 `codex-event-adapter` 和现有 Agent runtime 事件契约，确认 Phase 4 复用点。
- [x] 先写 `codex-runtime.test.ts` 和 `codex-permission-policy.test.ts`，覆盖 start/resume/abort/failure、unsupported capability 和 permission policy 行为。
- [x] 新增或更新 `coding-agent-runtime-types.ts`，定义主进程 `CodingAgentRuntime`、capabilities、run input/result 和 structured unsupported 结果。
- [x] 新增 `codex-sdk-client.ts`，提供可注入的 mock-friendly Codex SDK client factory，不触发真实 Codex 调用。
- [x] 新增 `codex-permission-policy.ts`，把 Agent permission mode 映射到 Codex sandbox / approval / bypass 策略。
- [x] 新增 `codex-runtime.ts`，复用 Phase 2 auth/env/guard core 与 Phase 3 event adapter，实现 `run()` 对 start/resume/abort/failure 的 mock runner 流程。
- [x] 运行 Phase 4 验证：`bun test apps/electron/src/main/lib/agent-runtimes/codex-runtime.test.ts`、`bun test apps/electron/src/main/lib/agent-runtimes/codex-permission-policy.test.ts`、`bun run --filter='@codeinsights/electron' typecheck`、`git diff --check -- apps/electron/src/main/lib/agent-runtimes apps/electron/src/main/lib/codex-runtime apps/electron/package.json tasks/todo.md tasks/lessons.md docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md docs/codex-support/next-session-prompt.md`。
- [x] 在本节末尾追加 Review，确认阶段边界、验证结果和提交范围，并只提交 Phase 4 相关文件。

## 2026-05-25 Agent Codex Runtime Phase 4 Review

- 已新增 `apps/electron/src/main/lib/agent-runtimes/coding-agent-runtime-types.ts`：定义主进程 runtime 接口、capabilities、Codex run input、structured unsupported capability 结果和 permission policy 结果类型。
- 已新增 `apps/electron/src/main/lib/codex-runtime/codex-sdk-client.ts`：提供 mock 可注入的 Codex SDK client factory，默认 factory 仅在真实使用时动态 import `@openai/codex-sdk`。
- 已新增 `apps/electron/src/main/lib/agent-runtimes/codex-permission-policy.ts`：`plan` 映射 read-only / never / network false / web search disabled；`auto` 映射 workspace-write / never / network false；`bypassPermissions` 默认仍是 workspace-write，仅显式高级开关允许 danger-full-access。
- 已新增 `apps/electron/src/main/lib/agent-runtimes/codex-runtime.ts`：复用 Phase 2 `codex-runtime` auth/env/guard core 和 Phase 3 `CodexEventAdapter`，实现 start / resume / runStreamed / abort / failure 的 mock runner 流程。
- 已更新 `docs/codex-support/next-session-prompt.md`：下次启动入口改为 Phase 5 Orchestrator Runtime Routing；未修改任何 README.md 或 AGENTS.md。
- Abort 已加固：controller 在 `run_started` 前注册；`run_started` 后立即 stop 不创建 Codex client；等待下一条 SDK event 时可由 `runtime.abort()` 解除；同一 SDK 事件内 abort 不会让 `usage_updated` 后继续输出 `run_completed`；abort 后不会再启动下一次 SDK iterator 读取。
- Auth / env 已加固：显式 channel API key 模式不向 Codex client env 透传 ambient `CODEX_API_KEY`；单测全部使用 mock client，不调用真实 Codex SDK / CLI，不依赖本机登录或真实 API key。
- `queueMessage()` 和 `setPermissionMode()` 返回 `runtime_capability_unsupported` 结构化结果，不伪造 Codex per-tool permission 或 queue 能力。
- Electron 包版本已从 `0.0.106` 升至 `0.0.107`。
- 代码审查：首轮审查指出 abort 注册、同事件终态、ambient key、测试证明力和实际 model 展示问题，均已修复；复审无 Critical / High，指出 lazy iterator 风险后已改为 lazy `raceWithAbort` 并补测。
- 验证通过：`bun test apps/electron/src/main/lib/agent-runtimes/codex-runtime.test.ts`，13 pass / 0 fail；`bun test apps/electron/src/main/lib/agent-runtimes/codex-permission-policy.test.ts`，4 pass / 0 fail；`bun run --filter='@codeinsights/electron' typecheck`；`git diff --check -- apps/electron/src/main/lib/agent-runtimes apps/electron/src/main/lib/codex-runtime apps/electron/package.json tasks/todo.md tasks/lessons.md docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md docs/codex-support/next-session-prompt.md`。
- 阶段边界：未修改 README.md / AGENTS.md，未接入 Phase 5 Orchestrator routing、Phase 6 Renderer UI 或 Phase 7 真实 Codex 集成。

## 2026-05-25 Agent Codex Runtime Phase 3 后状态文档同步计划

- [x] 更新 `docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md`：把 Phase 3 提交号 `98914a42` 写入最新状态、阶段记录和下一步入口，明确 Phase 4-8 未完成。
- [x] 更新 `docs/codex-support/README.md`：同步已完成/未完成项、最新提交列表和下一步 Phase 4。
- [x] 更新 `docs/codex-support/next-session-prompt.md`：生成可直接复制给下次 Codex 的 Phase 4 启动提示词。
- [x] 运行文档级验证、diff 检查，在本节末尾追加 Review 并单独提交状态同步。

## 2026-05-25 Agent Codex Runtime Phase 3 后状态文档同步 Review

- 已更新开发清单：顶部状态、最新开发状态快照、Phase 总览和阶段提交记录均指向 Phase 3 提交 `98914a42`，下一步入口改为第 6 节 Phase 4“CodexAgentRuntime Mock 接入”。
- 已更新 `docs/codex-support/README.md`：已完成项加入 Phase 3，未完成项从 Phase 4 开始，提交列表加入 `ac2e06d6` 与 `98914a42`。
- 已重写 `docs/codex-support/next-session-prompt.md`：下次启动提示词改为 Phase 4，明确只做 CodexAgentRuntime mock 接入和 permission policy，不混入 Orchestrator routing、Renderer UI 或真实 Codex 集成。
- 验证通过：Codex support 三份文档旧状态关键字扫描无命中；Markdown code fence 检查通过；Markdown 相对链接检查通过；`git diff --check -- docs/codex-support/README.md docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md docs/codex-support/next-session-prompt.md tasks/todo.md` 通过。

## 2026-05-25 Agent Codex Runtime Phase 3 计划

范围确认：本轮只做 Phase 3 Codex Event Adapter 和 fixtures；不混入 Phase 4 `CodexAgentRuntime` mock、Phase 5 Orchestrator routing、Renderer UI、真实 Codex client 创建、真实 `runStreamed()` 调用、README.md 或 AGENTS.md 修改。

- [x] 基于本地 `@openai/codex-sdk@0.130.0` 类型确认 `ThreadEvent` / `ThreadItem` 公开事件形状，并只使用 fixtures 驱动映射。
- [x] 新增 `apps/electron/src/main/lib/agent-runtimes/__fixtures__/codex-events/*.jsonl`，覆盖 agent message、command、file change、MCP、web search、todo list、turn failed 和 terminal race。
- [x] 先写 `apps/electron/src/main/lib/agent-runtimes/codex-event-adapter.test.ts`，锁定 ThreadEvent 到 `AgentStreamEnvelope` / `AgentRuntimeEvent` 的行为。
- [x] 新增 `apps/electron/src/main/lib/agent-runtimes/codex-event-adapter.ts`，实现状态化 adapter：thread id、started/completed items、累计输出差分、terminal flag 与 terminal 去重。
- [x] 确认 `packages/shared/src/agent/runtime-events.ts` 现有 runtime-neutral 契约足够承载 Phase 3，无需扩展，Claude 现有路径不变。
- [x] 验证 `item.updated` 只输出新增 delta；非 append-only 更新退化为完整 `assistant_message` 覆盖；`turn.completed` 才发 `usage_updated` / `run_completed`；`turn.failed` 和顶层 `error` 映射 `run_failed`。
- [x] 运行 Phase 3 验证命令：`bun test apps/electron/src/main/lib/agent-runtimes/codex-event-adapter.test.ts`、`bun test packages/shared/src/agent/runtime-events.test.ts`、`bun run --filter='@codeinsights/electron' typecheck`、`git diff --check -- apps/electron/src/main/lib/agent-runtimes packages/shared tasks/todo.md`。
- [x] 在本节末尾追加 Review，确认阶段边界与验证结果，并只提交 Phase 3 相关文件。

## 2026-05-25 Agent Codex Runtime Phase 3 Review

- 已新增纯 Codex Event Adapter：`apps/electron/src/main/lib/agent-runtimes/codex-event-adapter.ts`，只消费 `@openai/codex-sdk@0.130.0` 的 `ThreadEvent` 类型并输出 `AgentStreamEnvelope` / `AgentRuntimeEvent`，不创建真实 Codex client，不调用真实 `runStreamed()`。
- 已新增 10 个 JSONL fixtures：agent message、command success/failed、file change、MCP success/failed、web search、todo list + reasoning、turn failed、completed 后 abort/failure race。
- Adapter 映射覆盖 Codex SDK 当前公开 `ThreadItem` 类型：`agent_message`、`reasoning`、`command_execution`、`file_change`、`mcp_tool_call`、`web_search`、`todo_list`、`error`；未伪造 Claude `SDKMessage`。
- 已实现 append-only delta 差分：`item.updated` 只输出新增文本/命令输出；非 append-only 文本更新退化为完整 `assistant_message` 覆盖；`item.completed` 负责最终完整消息。
- 已实现终态规则：`turn.completed` 产出 `usage_updated` + `run_completed`；`turn.failed` 和顶层 `error` 产出 `run_failed`；completed 后到达的 abort/failure 不覆盖首个终态。
- `packages/shared/src/agent/runtime-events.ts` 未改动，现有 runtime-neutral 契约足够承载 Phase 3；Claude 现有路径保持不变。
- Electron 包版本已从 `0.0.105` 升至 `0.0.106`。
- 代码审查：无 Critical / High findings；已按审查建议删除未使用变量，并在提交前让新文件进入 diff 检查范围后重跑 `git diff --check`。
- 验证通过：`bun test apps/electron/src/main/lib/agent-runtimes/codex-event-adapter.test.ts`，13 pass / 0 fail；`bun test packages/shared/src/agent/runtime-events.test.ts`，14 pass / 0 fail；`bun run --filter='@codeinsights/electron' typecheck`；`git diff --check -- apps/electron/src/main/lib/agent-runtimes packages/shared tasks/todo.md`。
- 阶段边界：未修改 README.md / AGENTS.md，未接入 Phase 4 `CodexAgentRuntime` mock、Phase 5 Orchestrator routing、Renderer UI 或真实 Codex 集成。


## 2026-05-25 Agent Codex Runtime Phase 2 后状态文档同步计划

- [x] 更新 `docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md`：标明 Phase 2 已完成并提交，Phase 3-8 未完成，下一步从 Phase 3 开始。
- [x] 更新 `docs/codex-support/README.md`：同步最新提交、已完成/未完成项和下次入口。
- [x] 更新 `docs/codex-support/next-session-prompt.md`：生成可直接复制给下次 Codex 的 Phase 3 启动提示词。
- [x] 运行文档级验证和 diff 检查，在本节末尾追加 Review 并单独提交状态同步。

## 2026-05-25 Agent Codex Runtime Phase 2 后状态文档同步 Review

- 已同步 Codex support 开发清单：顶部状态更新为 Phase 2 已提交、Phase 3 待启动；0.1 快照、0.2 总览、Phase 2 checkbox、Phase 2 执行记录和阶段提交记录均已指向 `f04d893c`。
- 已同步 `docs/codex-support/README.md`：已完成项加入 Phase 2，未完成项从 Phase 3 开始，下一步改为第 5 节 Phase 3“Codex Event Adapter”。
- 已更新 `docs/codex-support/next-session-prompt.md`：下次启动提示词改为 Phase 3，明确只做 event adapter / fixtures，不混入 CodexAgentRuntime、Orchestrator routing、Renderer UI 或真实 Codex 集成。
- 验证通过：旧状态关键字扫描无命中；Markdown code fence 检查通过；Markdown 相对链接检查通过；`git diff --check -- docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md docs/codex-support/README.md docs/codex-support/next-session-prompt.md tasks/todo.md` 通过。

## 2026-05-25 Agent Codex Runtime Phase 2 计划

- [x] 复核现有 `codex-pipeline-node-runner.ts` 中 Codex binary、channel、auth、env、command guard 与 Git guard 的职责边界，确认哪些可以抽到公共 runtime core。
- [x] 新增 `apps/electron/src/main/lib/codex-runtime/`，抽出 `codex-binary`、`codex-channel`、`codex-auth`、`codex-env`、`codex-command-guard` 与 barrel export。
- [x] 加固 Codex auth / env：API key 模式隔离 `CODEX_HOME`，native auth 模式只传明确 `CODEX_HOME`，并清理 `ANTHROPIC_*`、GitHub token、Git 相关环境变量。
- [x] 加固 command guard：按 Pipeline / Agent purpose 输出不同提示，阻断远端写和交互凭证，不能只依赖 PATH。
- [x] 将 Pipeline Codex runner 改为引用公共 runtime core，保持 Pipeline prompt、JSON Schema、节点结果解析和外部行为不变。
- [x] 补充 `codex-runtime/*.test.ts` 并确保既有 `codex-pipeline-node-runner.test.ts` 继续通过；默认测试不触发真实 Codex 调用。
- [x] 运行 Phase 2 验证：`bun test apps/electron/src/main/lib/codex-runtime`、`bun test apps/electron/src/main/lib/codex-pipeline-node-runner.test.ts`、`bun run --filter='@codeinsights/electron' typecheck`、`git diff --check -- apps/electron/src/main/lib/codex-runtime apps/electron/src/main/lib/codex-pipeline-node-runner.ts tasks/todo.md`。
- [x] 在本节末尾追加 Review，确认阶段边界与验证结果，并只提交 Phase 2 相关文件。

范围确认：本轮只做 Phase 2 Codex Runtime Core 抽取；不混入 Phase 3 event adapter、Phase 5 Orchestrator routing、Renderer UI、README/AGENTS 文档更新或真实 Codex 集成。

## 2026-05-25 Agent Codex Runtime Phase 2 Review

- 已新增 `apps/electron/src/main/lib/codex-runtime/` 公共 core：`codex-binary`、`codex-channel`、`codex-auth`、`codex-env`、`codex-command-guard` 和 `index.ts`。
- 已将 Pipeline Codex runner 改为复用公共 core；Pipeline prompt、JSON Schema、节点结果解析、patch-work enrichment、stream event 和 v2 业务 Git guard snapshot / 事后校验仍保留在 runner 内，外部行为不变。
- Auth / env 隔离已覆盖：API key 模式使用隔离 `CODEX_HOME`；native auth 模式只传明确 `CODEX_HOME` 并清理 `CODEX_API_KEY`；环境构建改为基础 allowlist，过滤 `CODEX_THREAD_ID`、`ANTHROPIC_*`、`OPENAI_API_KEY`、AWS / NPM 等宿主 secrets、GitHub token 和危险 Git env。
- Command guard 已支持 `pipeline` / `agent` purpose 文案，继续通过 `git`/`gh`/`hub` shim、`GIT_DIR=/__codeinsights_git_disabled__`、remote `pushurl` 改写、`GIT_TERMINAL_PROMPT=0` 和 askpass/GCM 禁用来阻断 Git 远端写和交互凭证。
- 已新增 runtime core 单测覆盖 binary 平台映射与 `.asar.unpacked`、channel resolution、auth 探测、env 清理、command guard 文案和隔离策略；默认测试均使用 fake / 纯函数，不调用真实 Codex。
- Electron 包版本已从 `0.0.104` 升至 `0.0.105`。
- 代码审查：首轮审查指出 env secret 透传风险，已改为 allowlist 并复审通过，无 Critical / High / Medium findings；Git guard 保持 Phase 2 边界（前置 command/env guard + Pipeline v2 snapshot 事后检测/回滚），不改 Pipeline cwd / patch-work 行为。
- 验证通过：`bun test apps/electron/src/main/lib/codex-runtime`，18 pass / 0 fail；`bun test apps/electron/src/main/lib/codex-pipeline-node-runner.test.ts`，30 pass / 0 fail；`bun run --filter='@codeinsights/electron' typecheck`；`git diff --check -- apps/electron/src/main/lib/codex-runtime apps/electron/src/main/lib/codex-pipeline-node-runner.ts apps/electron/src/main/lib/codex-pipeline-node-runner.test.ts apps/electron/package.json tasks/todo.md`。
- 补充验证：`bun test --isolate` 跑到 540 个用例时仅 `pipeline-git-submission-service` 一个 before/after hook 超时；该文件单独重跑 `bun test apps/electron/src/main/lib/pipeline-git-submission-service.test.ts` 21 pass / 0 fail，未指向本轮 Phase 2 改动。
- 阶段边界：未修改 README.md / AGENTS.md，未接入 Phase 3 event adapter、Phase 5 Orchestrator routing、Renderer UI 或真实 Codex 集成。

## 2026-05-24 README 功能演示视频内嵌播放器计划

- [x] 复核当前中英文 README 功能演示区和四段功能视频文件，确认需要从海报链接改为 GitHub README 可直接播放的 `<video>`。
- [x] 使用当前 GitHub Web 登录态上传四段功能演示 MP4，获取 `https://github.com/user-attachments/assets/...` URL；匿名访问需等公开 README 引用推送后复核。
- [x] 将 `README.md`、`README_en.md` 和 `docs/assets/readme/real-runs/README.md` 中的功能演示区替换为内嵌视频播放器，删除“相对 MP4 不能内嵌”的临时说明。
- [x] 使用 GitHub 编辑器 Preview 验证新视频 URL 会渲染为 `<video>` / `gh:secured-asset-reference`，并检查资源路径、敏感信息和 Markdown 空白。
- [x] 提交并推送到远程，最后在本节末尾追加 Review，记录附件 URL、验证结果和残留限制。

## 2026-05-24 README 功能演示视频内嵌播放器 Review

- 已将中英文 README 功能演示区从“poster 图 + 仓库 MP4 链接”改为 GitHub README 可直接渲染的 `<video>` 播放器。
- 四段功能演示附件 URL：
  - Pipeline 工作流：`https://github.com/user-attachments/assets/dadf47f5-d339-4df1-90d4-a07e8d91eb42`
  - Agent 工作区：`https://github.com/user-attachments/assets/482f3f5c-4022-4500-b5dd-f1f7c5244cb3`
  - 模型与 Provider 配置：`https://github.com/user-attachments/assets/aec44d0a-2cee-4d39-831f-41423b9765ff`
  - Agent MCP / Skills 配置：`https://github.com/user-attachments/assets/91380be8-b868-4dd8-9b2a-3962729d55b8`
- 已创建并关闭公开附件登记 issue：`https://github.com/zcxGGmu/CodeInsights/issues/4`，用于让 GitHub 将四段 user-attachments 绑定到公开内容；关闭后匿名 range GET 均返回 MP4 `ftypisom` 文件头。
- 线上 README 已复核：`https://github.com/zcxGGmu/CodeInsights` 渲染 HTML 中存在 5 个 `<video>` 播放器，其中 4 个为本轮新增功能演示，且包含对应 `gh:secured-asset-reference`。
- 验证通过：`jq` 校验 `feature-videos-manifest.json`；`git diff --check`；敏感 token 扫描无命中；GitHub 编辑器 Preview 返回 4 个视频元素；线上 HTML 和匿名 MP4 头部检查通过。
- 已推送提交：`6df6bc35 docs: 内嵌 README 功能演示视频`。

## 2026-05-24 README 多功能演示视频补充计划

- [x] 复习既有 README 真实运行素材、录屏经验和 GitHub README 视频渲染限制，确认新增视频采用仓库内 MP4 文件链接还是后续上传 user-attachments 播放器。
- [x] 使用隔离 `CODEINSIGHTS_CONFIG_DIR` 启动 Electron dev 应用，避免读取本机真实渠道、API Key、会话和 IM 凭证。
- [x] 通过真实 Electron 主窗口录制多段短视频，至少覆盖 Pipeline 工作台、Agent 工作区、设置/Provider 配置、Agent 工作区/MCP/Skills 配置；需要真实外部凭证的功能只录制可本地验证的 UI 流程并记录限制。
- [x] 将新增视频、抽帧预览和采集元数据整理到 `docs/assets/readme/real-runs/`，命名清晰并更新该目录说明。
- [x] 完善根 `README.md` 的真实界面预览或新增功能演示区块，按功能挂载视频链接、说明验证环境和无法无凭证完整演示的边界。
- [x] 运行可行验证：启动/采集脚本、视频文件检查、README 资源路径检查、敏感信息扫描、`git diff --check`；必要时补充 README 渲染规则说明。
- [x] 在本节末尾追加 Review，记录最终素材、验证结果、残留限制和是否需要 GitHub user-attachments 上传步骤。

## 2026-05-24 README 多功能演示视频补充 Review

- 已使用隔离配置目录 `/tmp/codeinsights-readme-feature-config` 启动真实 Electron dev 应用，并通过 CDP 捕捉业务主窗口；未读取本机真实渠道、历史会话或 IM 凭证。
- 已新增四段 README 功能演示视频及预览图：
  - `feature-01-pipeline-workflow.mp4` / `feature-01-pipeline-workflow-poster.jpg`：Pipeline 工作台、六阶段 Mission Route、记录过滤和阶段产物 / 运行日志切换。
  - `feature-02-agent-workspace.mp4` / `feature-02-agent-workspace-poster.jpg`：Agent 模式、工作区矩阵、新会话、资源面板和能力入口。
  - `feature-03-provider-settings.mp4` / `feature-03-provider-settings-poster.jpg`：模型配置、DeepSeek 预设、Pipeline Codex 认证来源和新增 Provider 配置表单。
  - `feature-04-agent-mcp-skills.mp4` / `feature-04-agent-mcp-skills-poster.jpg`：Agent 高级设置、内置工具、MCP Server、Skills 和工作区隔离能力。
- 已新增 `feature-demos-contact-sheet.jpg`、`feature-videos-manifest.json` 和 `capture-feature-demos.mjs`，便于后续审计与重新采集。
- 已更新 `README.md` 和 `README_en.md`：新增功能演示视频区，使用 poster 图片链接仓库内 MP4，并明确 GitHub README 相对 MP4 不适合直接内嵌播放；若要内嵌播放器，需要后续上传为 GitHub `user-attachments` URL。
- 已更新 `docs/assets/readme/real-runs/README.md` 的素材清单、引用片段和重新采集命令。
- 验证通过：`node --check docs/assets/readme/real-runs/capture-feature-demos.mjs`；四段 MP4 均为 H.264、1600px 宽、30fps；README 相对资源路径检查通过；功能视频和文档敏感信息扫描无命中；`git diff --check -- README.md README_en.md docs/assets/readme/real-runs tasks/todo.md` 通过。
- 残留限制：本轮未调用真实模型、未连接飞书 / 钉钉 / 微信 Bridge；这些需要真实凭证和外部服务，README 中已按本地可验证 UI 演示边界说明。

## 2026-05-24 项目主页架构图留白修复计划

- [x] 复现并解释用户截图中的大块空白：确认不是 SVG 画布内容过空，而是响应式图片高度被 HTML `height` 属性固定。
- [x] 修正全局媒体基础样式，让图片在宽度缩放时保持原始比例。
- [x] 增加主页结构测试，锁定响应式媒体必须保留 `height: auto`。
- [x] 运行主页结构测试、JS 检查、diff 空白检查，并用本地浏览器量测 Pipeline 图高度。

## 2026-05-24 项目主页架构图留白修复 Review

- 已确认根因：`web/index.html` 的架构图保留 HTML `width` / `height` 属性用于预留尺寸，但 `web/styles.css` 基础媒体规则只设置了 `max-width: 100%`，没有 `height: auto`；当左列宽度变为约 `620px` 时，图片高度仍按 `1720px` 计算，SVG 内容被居中缩放后产生巨大上下白边。
- 已在 `img, video` 基础规则补充 `height: auto`，后续截图和架构图都会在响应式宽度下保持原始宽高比；`media-stage video` 仍由后续更具体规则覆盖为 `height: 100%`，不影响首屏视频舞台。
- 已补充主页结构测试 `test_responsive_media_preserves_aspect_ratio`，防止删除该基础规则后回归。
- 验证通过：`python3 -m unittest web.tests.test_homepage_structure`；`node --check web/app.js`；`git diff --check -- web/styles.css web/tests/test_homepage_structure.py tasks/todo.md tasks/lessons.md`。
- 本地浏览器量测：修复前 Pipeline 图像盒子约 `620.7 x 1720px`；修复后约 `620.7 x 444.8px`，与 SVG `1200 x 860` 比例一致。

## 2026-05-24 项目主页第三轮打磨计划

- [x] 把价值卡片从普通三列说明升级为更可扫读的“问题 / 机制 / 证据”信息路径。
- [x] 重排能力区，把 Provider / Gate / Bridge / Documents / Runtime / Security 从等权卡片改为更清楚的能力矩阵。
- [x] 优化 Quick Start：突出命令块，弱化长说明，补充更清楚的准备 / 配置 / 运行步骤。
- [x] 复查移动端中下屏，确保标题、卡片、代码块和 footer 没有横向溢出。
- [x] 更新测试、任务 Review，并重新跑结构测试、JS 检查、截图和代码审查。

## 2026-05-24 项目主页第三轮打磨 Review

- 已将 proof 区块改成“Shift / Problem / Control / Evidence”结构：先说明从模型答案转向可批准过程，再落到复杂修改失控、风险检查点和可回放证据。
- 已在 proof 区块末尾新增产物条：`plan.md`、`review.md`、`test evidence`、`JSONL events`、`checkpoint`，让“可验证”更具体。
- 已新增移动端 `mobile-jump-nav`，在隐藏顶部导航后提供 Product / Workflow / Architecture / Start 快捷锚点；经 320 / 375 / 390px 英文视口检查无溢出。
- 已将能力区升级为带层级标签的能力矩阵：Model / Review / Bridge / Context / Runtime / Safety Layer，降低纯功能列表感。
- 已优化 Quick Start：新增 Before launch 检查清单，保留三步运行路径，并在命令块内补充本地开发入口提示。
- 已按代码审查修复：移动快捷导航从四列改两列，所有移动触控目标恢复到 44px；修复 proof / capability label 被通用段落样式覆盖；移除结构测试对未引用旧 `logo.webp` 的强绑定。
- 验证通过：`python3 -m unittest web.tests.test_homepage_structure`；`node --check web/app.js`；HTML 本地引用检查无缺失；`git diff --check -- web/index.html web/styles.css web/app.js web/tests/test_homepage_structure.py tasks/todo.md`。
- 视觉核验：proof 桌面 `/tmp/codeinsights-homepage-round3-proof-desktop.png`；proof 移动 `/tmp/codeinsights-homepage-round3-mobile.png`；capabilities 桌面 `/tmp/codeinsights-homepage-round3-capabilities-desktop.png`；Quick Start 移动 `/tmp/codeinsights-homepage-round3-code-mobile.png`。桌面、390px 移动、320px/375px 英文锚点检查均无页面横向溢出。

## 2026-05-24 项目主页二次优化计划

- [x] 收敛首屏：降低固定导航重量、减轻截图遮罩、改写首屏价值表达、保留一个主 CTA 和一个次 CTA。
- [x] 优化移动首屏：减少首屏文案和按钮堆叠，确保 390px 宽度下标题、正文、按钮不裁切且不横向滚动。
- [x] 重排真实运行展示：让录屏/截图成为更强的产品展示舞台，减少说明文字压迫感。
- [x] 调整流程与架构区块节奏：用更轻的“如何工作”路径承接硬核图表，降低卡片网格均质感。
- [x] 更新主页结构测试与静态资源引用，补充小尺寸 logo 资源。
- [x] 运行结构测试、静态资源检查、diff 空白检查，并用本地静态服务截图核验桌面与移动端。
- [x] 使用代码审查子代理复查本轮前端改动，并在本节末尾追加 Review。

## 2026-05-24 项目主页二次优化 Review

- 已优化 `web/index.html` 首屏：顶部 logo 改用 128px 小图、主文案改为更直接的开源贡献工作流定位，CTA 收敛为 GitHub 和查看真实运行，原 `6 / Gate / JSONL` 指标改为 Plan / Run / Prove 三步路径。
- 已重写 `web/styles.css` 首屏视觉：导航降低背景实度与阴影，首屏高度和截图遮罩重新平衡，桌面端保留更清晰的真实产品背景，移动端隐藏次级说明与流程卡片，按钮保持单列可点击。
- 已强化真实运行展示：`media-feature` 改为 `media-stage`，录屏成为更大的展示舞台，Pipeline 主截图横跨整行，后续截图保持两列节奏。
- 已压缩 Pipeline 说明密度：6 个阶段卡片合并成发现与计划、实现与审查、验证与提交材料 3 个流程块，降低卡片网格均质感。
- 已改进 reveal 渐进增强：内容默认可见，JS 可用时只做轻微位移动画，不再用透明度隐藏内容，避免锚点跳转或脚本慢加载时出现空白区块。
- 已新增 `web/assets/brand/logo-128.png`，顶部导航不再加载 476KB 原始 logo；主页结构测试已同步小图标断言。
- 验证通过：`python3 -m unittest web.tests.test_homepage_structure`；`node --check web/app.js`；HTML 本地引用检查无缺失；`git diff --check -- web/index.html web/styles.css web/app.js web/tests/test_homepage_structure.py tasks/todo.md`。
- 视觉核验：本地服务 `http://127.0.0.1:8765/`；桌面首屏 `/tmp/codeinsights-homepage-optimized-desktop.png`；移动首屏 `/tmp/codeinsights-homepage-optimized-mobile.png`；展示区 `/tmp/codeinsights-homepage-showcase-desktop.png`；桌面与 390px 移动端 `scrollWidth == clientWidth`，无横向溢出。
- 代码审查：`code-reviewer` 复查无发现；残留风险是未做真实 GitHub Pages 部署后截图核验。

## 2026-05-24 项目主页二次视觉诊断计划

- [x] 复习 `tasks/lessons.md` 和既有 homepage 任务记录，确认本轮只做视觉诊断，不改主页实现。
- [x] 审阅 `web/index.html`、`web/styles.css`、`web/app.js`、主页测试和当前素材体积。
- [x] 使用本地静态服务核验当前桌面与移动首屏截图。
- [x] 按影响优先级整理主页 UI/UX 优化点。

## 2026-05-24 项目主页二次视觉诊断 Review

- 本轮基于当前 `web/` 静态主页、本地截图和结构测试做诊断；未修改主页实现代码。
- 验证通过：`python3 -m unittest web.tests.test_homepage_structure`。
- 本地核验：`http://127.0.0.1:8765/`；桌面截图 `/tmp/codeinsights-homepage-current-desktop.png`；移动截图 `/tmp/codeinsights-homepage-current-mobile.png`。
- 核心问题：首屏真实产品截图被深色遮罩压得过暗，产品可辨认度不足；固定导航视觉重量偏高；首屏 CTA 与指标块仍偏多；移动端首屏信息压缩后可读性一般；后续区块卡片、图表和长技术文案密度接近，页面节奏不够有主次。
- 建议优先级：先重做首屏构图和移动首屏，再收敛导航/CTA，然后重排 showcase 与架构内容，最后统一细节动效和资源策略。

## 2026-05-24 项目主页逐步改进计划

- [x] 基于上一轮诊断和 `ui-ux-pro-max` 规则确认改造边界：只改 `web/` 静态项目主页与对应测试/说明，不触碰 Electron 运行时代码。
- [x] 重构首页首屏：降低导航重量、增强真实产品截图可见度、压缩 CTA 数量、补充更明确的开源贡献工作台定位。
- [x] 重构移动端导航与首屏：避免固定导航吞掉首屏，确保 390px 宽度下按钮、标题和正文不裁切。
- [x] 收敛内容叙事：把重复的 Pipeline / Local-first / Runtime 价值点改成更明确的“为什么用 / 如何工作 / 如何开始”路径。
- [x] 统一视觉系统：减少米色网格和统一重阴影，建立更克制的科技产品色板、卡片层级和媒体展示节奏。
- [x] 更新 `web/tests/test_homepage_structure.py` 中与新版结构相关的断言。
- [x] 运行结构测试、静态资源检查、diff 空白检查，并用本地静态服务截图核验桌面与移动端观感。
- [x] 在本节末尾追加 Review，记录改动范围、验证结果和残留风险。

## 2026-05-24 项目主页逐步改进 Review

- 已重构 `web/index.html` 首屏信息层级：导航从 5 项收敛为 Product / Workflow / Architecture / Start，主 CTA 保留 GitHub，次 CTA 改为查看真实运行，Quick Start 降级为文本链接。
- 已将首屏定位从功能堆叠改为“开源贡献工作台”：Pipeline 负责阶段和证据，Agent 负责执行，本地 JSONL 负责回放；价值卡片改为 Plan / Execute / Prove 三段路径。
- 已重写 `web/styles.css` 视觉系统：从米色重网格改为中性浅灰背景、teal / blue / coral 多色语义强调，降低全局重阴影，保留 8px 卡片半径，首屏截图遮罩更轻且产品界面更可见。
- 已优化移动端：小屏隐藏顶部导航列表，只保留品牌和语言切换；按钮改为单列，标题字号和断行更稳，补充横向溢出防护。
- 已同步 `web/tests/test_homepage_structure.py` 的新版 CTA 与文案断言。
- 验证通过：`python3 -m unittest web.tests.test_homepage_structure`；本地 HTML 资源引用检查无缺失；`git diff --check -- web/index.html web/styles.css web/tests/test_homepage_structure.py tasks/todo.md`。
- 视觉核验：本地静态服务 `http://127.0.0.1:8765/`；桌面截图 `/tmp/codeinsights-homepage-final-desktop.png`；真实 390x844 移动视口截图 `/tmp/codeinsights-homepage-final-mobile.png`，移动端 `scrollWidth=clientWidth=390`，顶部语言按钮在视口内。

## 2026-05-24 项目主页视觉诊断计划

- [x] 复习 `tasks/lessons.md`，确认历史首页、README 和主界面视觉反馈中的约束与经验。
- [x] 核对 `web/` 静态项目主页的信息架构、视觉层级、素材使用、响应式和可访问性实现。
- [x] 对照 README 首屏与 Electron 客户端首屏，区分公开项目主页问题和产品内主页问题。
- [x] 给出不直接改代码的优化点清单，并按影响优先级整理。
- [x] 在本节末尾追加 Review，记录本轮诊断范围、证据和建议下一步。

## 2026-05-24 项目主页视觉诊断 Review

- 本轮诊断聚焦 `web/index.html`、`web/styles.css`、`web/app.js`、根 `README.md` 首屏和 Electron AppShell / App 入口；未修改主页实现代码。
- 已用本地静态服务 `http://127.0.0.1:8765/` 核验桌面 1440x1000、桌面 1280x720 和移动 390x844 首屏截图；本地结构测试 `python3 -m unittest web.tests.test_homepage_structure` 通过。
- 主要问题：固定导航视觉重量过高，移动端导航占用首屏过多；首屏真实截图被深色遮罩压暗，产品本体信号不足；米色网格、统一阴影和卡片堆叠让页面显得模板化；内容重复强调 Pipeline / Local-first / Runtime，缺少面向访问者的清晰转化路径；架构图和截图展示偏重信息堆叠，缺少主次。
- 线上 Pages 核验受阻：`curl https://zcxggmu.github.io/CodeInsights/` 两次返回 connection reset，本轮结论以本地 `web/` 当前实现和截图为准。
- 建议下一步先做首屏与移动导航重构，再处理视觉系统和内容叙事；不要先从局部颜色微调入手。


## 2026-05-24 README 顶部项目图标比例调整计划

- [x] 复习 `tasks/lessons.md` 中 README 标题图标相关经验，确认本轮仅调整首屏图标展示比例。
- [x] 将 `README.md` 顶部项目图标从偏小尺寸调大，使其更匹配下方 `CodeInsights` 标题的视觉比例。
- [x] 验证 Markdown 图片引用、diff 空白和最终改动范围，并在本节末尾追加 Review。

## 2026-05-24 README 顶部项目图标比例调整 Review

- 已将 `README.md` 顶部项目图标展示宽度从 `96` 调整为 `144`，让图标和下方 `CodeInsights` 标题的视觉比例更接近。
- 本轮未修改视频、徽章、语言切换、章节导航和英文 README。
- 验证通过：`assets/icon/CodeInsights.png` 路径存在；`rg` 确认 README 顶部图标宽度为 `144`；`git diff --check -- README.md tasks/todo.md` 通过。

## 2026-05-23 项目主页重构计划

- [x] 复习 `tasks/lessons.md`、`README.md`、`assets/` 和 `web/` 当前实现，确认首页要从旧 RISC-V / Python / 双 SDK 叙述切换到当前 Electron 桌面工作台。
- [x] 根据 `ui-ux-pro-max` 规则确定首页信息结构：首屏真实产品信号、三大价值、真实界面、Pipeline v2、Agent Runtime、本地存储、快速开始。
- [x] 整理 `web/assets/` 可部署素材，复用 README 与 `assets/` 下的品牌、真实截图、架构图和介绍视频，避免 GitHub Pages 缺资源。
- [x] 重构 `web/index.html` 与 `web/styles.css`，保留静态无框架和双语切换，提升响应式、可访问性、真实素材展示和现代产品页观感。
- [x] 更新 `web/README.md` 与 `web/tests/test_homepage_structure.py`，同步新的页面范围和断言，避免测试继续绑定旧信息。
- [x] 运行结构测试、静态资源检查、HTML/CSS 基础验证、diff 空白检查，并用本地静态服务器做页面截图核验。
- [x] 在本节末尾追加 Review，记录改动、验证结果、视觉核验和残留风险。

## 2026-05-23 项目主页重构 Review

- 已将 `web/` 静态主页从旧 RISC-V / Python / OpenAI Agents SDK 叙述重构为当前 README 对齐的 CodeInsights 首页：本地优先 AI Agent 桌面工作台、Pipeline v2、Agent Runtime、MCP / Skills、本地 JSON / JSONL 存储与 Codex SDK / CLI 边界。
- 已更新首屏为真实 Pipeline 桌面截图背景，首屏保留下一段露出；新增真实运行录屏、四张真实 Electron 截图、Pipeline / Agent / System / IPC / Local Storage 当前架构图展示。
- 已整理 `web/assets/`：保留实际引用的品牌 logo、真实截图、两段 MP4、视频 poster 和当前 SVG 架构图；删除旧 `web/assets/diagrams/` 与 `web/assets/previews/` 中过期 RISC-V / Python / OpenAI Agents SDK 素材，并删除未使用 PNG / contact sheet 降低 Pages 体积。
- 已改进可访问性与响应式：加入 skip link、可见 focus、reduced-motion 处理、锚点滚动偏移、复杂架构图可读摘要、移动端无横向溢出。
- 已更新 `web/README.md`、`web/tests/test_homepage_structure.py` 和 `.github/workflows/deploy-pages.yml`；测试现在解析 `index.html` 的本地 `href/src/poster` 引用，Pages 上传前会运行主页结构测试。
- 验证通过：`python3 -m unittest web.tests.test_homepage_structure`；`git diff --check -- web tasks/todo.md .github/workflows/deploy-pages.yml`；旧定位关键词扫描 `web/index.html web/README.md web/assets` 无命中；Playwright 桌面 1440x1000 与移动 390x844 均无横向溢出、首屏露出下一段、图片无加载失败、语言切换正常、导航锚点不被固定 header 遮挡。
- 视觉核验截图已生成到 `/tmp/codeinsights-homepage-desktop-top.png` 与 `/tmp/codeinsights-homepage-mobile-top.png`；本地预览服务使用 `python3 -m http.server 8765 -d web`。

## 2026-05-23 最新开发状态同步计划

- [x] 核对当前 Git 状态与最新提交，确认主分支公开文档基线为 `842dc597 merge: 删除 README 首屏辅助视频链接`。
- [x] 更新 Agent 重构总览、开发进度清单和下次启动提示词，明确阶段 0-15、README / 素材 / 图标 / 公开文档任务完成状态。
- [x] 明确当前未完成项：飞书真实入口和群聊 MCP、旧路径清理、旧 session 兼容清理、插件真实 UI 补跑、License 决策。
- [x] 校准下次启动提示词中的实际项目路径、包版本、最新提交和下一步开发规则。
- [x] 运行文档级验证，追加 Review。

## 2026-05-23 最新开发状态同步 Review

- 已同步 `docs/agent-refactor/README.md`：当前状态更新到 2026-05-23，明确 `842dc597` 只是 README 首屏辅助链接清理的主分支 merge 提交，不是 Agent runtime 新阶段；阶段 0-15 已完成，README / 公开素材 / 图标收尾已完成。
- 已同步 `docs/agent-refactor/development-checklist.md`：当前版本校准为根包 `0.1.1`、shared `0.1.42`、core `0.2.12`、ui `0.1.4`、electron `0.0.103`，并列明仍未完成的飞书真实验证、旧路径清理、插件真实 UI 补跑和 License 决策。
- 已更新 `docs/agent-refactor/next-session-prompt.md`：项目路径校准为 `/Users/zq/Desktop/ai-projs/posp/RV-Insights`，加入最新提交、完成项、未完成项、工作树噪音和下一步规则。
- 验证通过：`rg` 检查旧版本号和错误项目路径已清理；`git diff --check -- docs/agent-refactor/README.md docs/agent-refactor/development-checklist.md docs/agent-refactor/next-session-prompt.md tasks/todo.md` 通过。

## 2026-05-23 README 首屏辅助链接删除计划

- [x] 按截图确认删除范围：视频下方第一行红框内的三个链接 `真实运行录屏文件`、`20 秒概念介绍`、`视频设计说明`。
- [x] 保留首屏视频播放器和 `项目主页 / Homepage` 链接，不移动或删除其他导航项。
- [x] 同步更新中英文 README 顶部链接行。
- [x] 更新 `tasks/lessons.md`，记录截图红框类需求要按可见区域精确删除，不要替换成别的展示方式。
- [x] 验证红框三项已从首屏删除、视频仍存在、Markdown 空白无误，然后提交并推送。

## 2026-05-23 README 首屏辅助链接删除 Review

- 已删除中英文 README 首屏视频下方红框对应的三个辅助链接：`真实运行录屏文件 / 20 秒概念介绍 / 视频设计说明` 与英文对应项。
- 已保留 `项目主页 / Homepage` 链接、首屏 GitHub 附件视频播放器和第二行章节导航。
- 已更新 `tasks/lessons.md`，记录截图红框类需求要按可见区域精确删除，不要改动视频播放器本身。
- 验证通过：`rg` 确认红框三项不再出现在 `README.md` / `README_en.md`；中英文 README 仍保留 `<video>`；GitHub Markdown API 对当前 `<video>` 返回可渲染视频；`git diff --check -- README.md README_en.md tasks/lessons.md tasks/todo.md` 通过。

## 2026-05-23 README 线上视频渲染修复计划

- [x] 按用户反馈复查线上 GitHub README，确认 raw README 里有相对路径 `<video>`，但渲染 HTML 把它过滤成空段落，页面上确实没有视频。
- [x] 用 GitHub Markdown API 验证视频源规则：相对 MP4、raw.githubusercontent、GitHub raw、release asset 和 GitHub Pages MP4 都会被过滤；`github.com/user-attachments/assets/...` 会生成 `gh:secured-asset-reference` 和 `<video>`。
- [x] 更新 `tasks/lessons.md`，记录 README 视频必须用 user-attachments URL 并在线验证。
- [x] 将中英文 README 首屏视频源改为可渲染的 GitHub 附件 URL，同时保留真实运行录屏文件链接。
- [x] 更新真实素材说明，明确仓库内真实运行 MP4 是文件链接，线上播放器必须使用 GitHub 附件 URL。
- [x] 验证 Markdown API、线上 GitHub HTML、敏感信息扫描和 `git diff --check`，提交并推送当前分支与主分支。

## 2026-05-23 README 线上视频渲染修复 Review

- 已确认根因：线上 GitHub README 渲染 HTML 中，原相对路径 `<video src="./docs/assets/readme/real-runs/codeinsights-real-run-overview.mp4">` 被过滤成空段落，所以页面不会显示视频。
- 已用 GitHub Markdown API 验证：相对 MP4、raw.githubusercontent、GitHub raw、release asset 和 GitHub Pages MP4 都不会保留 `<video>`；`https://github.com/user-attachments/assets/64ca3efd-b424-4e09-b0ca-9c4840cf9588` 会生成 `gh:secured-asset-reference` 和 `<video>`。
- 已将 `README.md` 与 `README_en.md` 首屏视频源改为可渲染的 GitHub 附件 URL；仓库内真实运行录屏 `docs/assets/readme/real-runs/codeinsights-real-run-overview.mp4` 保留为“真实运行录屏文件”链接和素材目录条目。
- 已同步更新 `docs/assets/readme/real-runs/README.md` 与 `tasks/lessons.md`，后续替换视频必须先上传为 user-attachments 并用 GitHub Markdown API 或线上 HTML 复核。
- 验证通过：GitHub Markdown API 返回 `<video>` 与 `gh:secured-asset-reference`；附件 URL 匿名 range GET 返回 MP4 `ftypisom` 文件头；敏感 token 扫描无命中；`git diff --check -- README.md README_en.md docs/assets/readme/real-runs/README.md tasks/lessons.md tasks/todo.md` 通过。

## 2026-05-23 README 恢复视频播放器计划

- [x] 按用户纠正确认问题：上一轮把 README 首屏 `<video>` 替换成抽帧图链接，虽然保留了 MP4 链接，但删除了视频播放器展示。
- [x] 更新 `tasks/lessons.md`，记录 README 明确要求视频时必须保留 `<video>`，只能补 fallback，不能用静态图替代。
- [x] 恢复 `README.md` 与 `README_en.md` 首屏真实运行录屏 `<video>` 播放器。
- [x] 同步更新 `docs/assets/readme/real-runs/README.md` 的引用片段和说明，避免后续继续复制静态图方案。
- [x] 验证视频路径、录屏元数据、敏感信息扫描、`git diff --check`，然后提交并推送当前分支和主分支。

## 2026-05-23 README 恢复视频播放器 Review

- 已按用户纠正恢复 `README.md` 与 `README_en.md` 首屏真实运行录屏 `<video>` 播放器，不再用抽帧图替代视频展示。
- 已保留 MP4 文本链接、20 秒概念视频入口和真实界面截图区；`docs/assets/readme/real-runs/README.md` 的引用片段也同步改回 `<video>`。
- 已更新 `tasks/lessons.md`，记录 README 明确要求视频时必须保留播放器，只能补 fallback，不能用静态图替代。
- 验证通过：`rg "<video"` 确认中英文 README 均有视频播放器；`ffprobe` 确认真实录屏为 H.264、1600x966、30fps、6 秒、180 帧；敏感 token 扫描无命中；`git diff --check -- README.md README_en.md docs/assets/readme/real-runs/README.md tasks/lessons.md tasks/todo.md` 通过。

## 2026-05-23 README 真实素材接入优化计划

- [x] 启动前复习 `tasks/lessons.md`，确认 README 首屏视频应优先使用真实运行素材；GitHub 直播放需要公开 user-attachments URL，当前本地真实录屏先作为仓库素材接入并保留 fallback 链接。
- [x] 复查中英文 README、已有真实截图/录屏和素材目录，确认本轮只做文档展示优化，不修改运行时代码。
- [x] 将 README 首屏媒体从旧概念视频切换为真实 Electron 运行录屏，并保留 20 秒概念视频作为辅助入口。
- [x] 新增中英文“真实界面预览”区块，展示 Pipeline、Agent、模型配置、Agent 设置/MCP/Skills 四类截图。
- [x] 更新中英文素材目录，补充 `docs/assets/readme/real-runs/` 下的真实截图、录屏、抽帧和素材说明。
- [x] 验证 README 引用路径、视频/图片文件、敏感信息扫描和 Markdown diff 空白，在本节末尾追加 Review。

## 2026-05-23 README 真实素材接入优化 Review

- 已更新 `README.md` 与 `README_en.md` 首屏展示：移除旧 user-attachments 概念视频播放器，改为真实 Electron 运行录屏抽帧图，点击可打开 `docs/assets/readme/real-runs/codeinsights-real-run-overview.mp4`；20 秒概念视频保留为辅助入口。
- 已新增中英文真实界面预览区块，覆盖 Pipeline 工作台、Agent 工作区、模型配置、Agent 设置 / MCP / Skills 四类真实截图；截图使用 `width="100%"`，避免在 README 表格里撑开布局。
- 已更新中英文素材目录，补充真实录屏、抽帧图、四张截图和 `docs/assets/readme/real-runs/README.md` 说明文件。
- 验证通过：所有 README 新增相对资源路径存在；`ffprobe` 确认真实录屏为 H.264、1600x966、30fps、6 秒、180 帧；敏感 token 扫描无命中；`rg` 确认旧 `user-attachments` 视频和 `<video>` 标签已从中英文 README 清理；`git diff --check -- README.md README_en.md tasks/todo.md docs/assets/readme/real-runs` 通过。
- 说明：当前没有新的公开 GitHub user-attachments URL，故 README 首屏采用真实录屏抽帧链接 MP4 的方式，避免相对 MP4 在 GitHub README 中被过滤后出现空白。

## 2026-05-23 README 真实截图与录屏素材计划

- [x] 启动前复习 `tasks/lessons.md`，确认 README 素材要使用真实可运行界面，避免 mock，并避开 API Key、渠道密钥、飞书凭证等敏感信息。
- [x] 确认本轮不直接修改 README，只新增真实截图/录屏素材和给出可引用片段；如需写入 README，等待用户再次明确允许。
- [x] 使用隔离配置目录启动 Electron 应用，避免读取本机已有 `~/.codeinsights-dev` 敏感会话与渠道。
- [x] 通过真实应用采集关键功能素材：Pipeline 主界面、Agent 会话界面、工作区/资源面板、渠道与设置、权限/人工交互相关可见状态。
- [x] 录制 README 可用短视频：优先覆盖 `Pipeline | Agent` 模式切换和主要工作台操作；若某些功能需要真实凭证，则只录制可本地展示部分并记录限制。
- [x] 将素材整理到 `docs/assets/readme/real-runs/`，保留命名清晰的 PNG / MP4 和素材清单。
- [x] 验证图片/视频文件可打开、尺寸合适、无敏感信息，并在本节末尾追加 Review。

## 2026-05-23 README 真实截图与录屏素材 Review

- 已用真实 Electron dev 主窗口采集素材，CDP 目标为 `http://localhost:5173/`，不是浏览器 mock 页面；本轮启动时使用 `CODEINSIGHTS_CONFIG_DIR=/tmp/codeinsights-readme-capture-config` 隔离配置，避免读取本机真实渠道、会话和 IM 凭证。
- 已生成 README 可用素材目录：`docs/assets/readme/real-runs/`。
- 截图产物：
  - `01-pipeline-dashboard.png`：Pipeline 发射台、六阶段 Mission Route、产物与运行日志。
  - `02-agent-workbench.png`：Agent Mission、Command Deck、右侧资源面板、会话/工作区文件。
  - `03-settings-overview.png`：模型配置、DeepSeek 预设、Pipeline Codex 认证来源、Agent 供应商。
  - `04-channels-and-agent-settings.png`：Agent 高级设置、内置工具、MCP 服务器、Skills。
- 录屏产物：`codeinsights-real-run-overview.mp4`，6 秒，1600x966，H.264，30fps；另生成 `codeinsights-real-run-overview-contact-sheet.jpg` 作为抽帧核验图。
- 已新增 `docs/assets/readme/real-runs/README.md`，包含素材说明和 README Markdown 引用片段；未直接修改根 `README.md`，符合“README 修改需先获得允许”的项目规则。
- 验证通过：人工查看四张截图和录屏抽帧；`ffprobe` 确认视频可读；`node --check docs/assets/readme/real-runs/capture-cdp.mjs`；敏感 token 文本扫描 `rg` 无命中；`git diff --check -- tasks/todo.md docs/assets/readme/real-runs`。
- 限制说明：本轮使用空密钥演示配置，因此没有真实跑需要模型 API Key 的 Pipeline 节点执行、Agent 工具调用和权限审批弹窗；这些素材需要提供可用脱敏渠道后再补录。

## 2026-05-23 README 首屏图标与英文链接修复计划

- [x] 启动前复习 `tasks/lessons.md`，确认 README 首屏应优先展示视频，品牌图标不应继续占据标题左侧。
- [x] 检查当前 README：H1 中仍嵌入 `assets/icon/CodeInsights.png`；`English` 链接指向 GitHub Pages 项目主页而不是英文 README。
- [x] 将中文 README 标题改为纯文本 `CodeInsights`，删除左侧项目图标。
- [x] 新增真实英文 README 文件，并将中文 README 的 `English` 链接指向该文件。
- [x] 验证 README 语言链接、首屏图标残留和 Markdown 空白，在本节末尾追加 Review。

## 2026-05-23 README 首屏图标与英文链接修复 Review

- 已将中文 `README.md` 顶部标题从内嵌图标改为纯文本 `<h1>CodeInsights</h1>`，首屏不再展示左侧项目图标。
- 已新增 `README_en.md`，并将中文 README 顶部 `English` 切换链接改为 `./README_en.md`；英文 README 顶部可切回 `./README.md`。
- 英文 README 复用当前视频、徽章、架构图、快速开始、Pipeline、Agent Runtime、本地数据、Provider、Bridge、开发、打包、安全、素材和 FAQ 结构，语言切换不再跳到产品主页。
- 已按用户纠正更新 `tasks/lessons.md`，记录 README 语言切换必须指向真实 README 文件、标题图标删除需清理 H1 内嵌图标。
- 验证通过：`rg "<h1|English|中文|CodeInsights.png|zcxggmu.github.io/CodeInsights" README.md README_en.md`；本地 README 链接目标检查；`git diff --check`。

## 2026-05-23 模型配置页移除 CodeInsights 官方供应商卡片计划

- [x] 启动前复习 `tasks/lessons.md`，确认用户截图红框类需求应按“移除该视觉块”处理，而不是缩小或换位置保留。
- [x] 定位红框来源：`ChannelSettings.tsx` 在“模型配置”和“Agent 供应商”区块分别渲染 `CodeInsightsProviderCard`。
- [x] 删除两处 `CodeInsightsProviderCard` 渲染，保留用户已有渠道列表、Pipeline Codex 设置和 Agent 供应商开关。
- [x] 删除推广卡片组件本身和相关无用导入，避免保留不可见死代码。
- [x] 运行聚焦验证与 `git diff --check`，在本节末尾追加 Review。

## 2026-05-23 模型配置页移除 CodeInsights 官方供应商卡片 Review

- 已移除“模型配置”和“Agent 供应商”两个区块中的 `CodeInsightsProviderCard`，截图红框里的 CodeInsights 官方供应商卡片和“下载后启动”按钮不再渲染。
- 已删除推广卡片组件本身、`ExternalLink` 图标导入和 `CodeInsightsLogo` 导入，未保留不可见死代码。
- 真实渠道列表、Pipeline Codex 认证来源选择、Agent 供应商开关逻辑保持不变。
- 验证通过：`bun run --filter='@codeinsights/electron' typecheck`；`bun run --filter='@codeinsights/electron' build:renderer`；`rg \"CodeInsightsProviderCard|下载后启动|CodeInsights 官方供应|codeinsights.cool/download\" apps/electron/src/renderer` 无命中；`git diff --check`。
- 代码审查通过：`code-reviewer` 复查无发现。

## 2026-05-23 README 参考页样式对齐计划

- [x] 对照 ScienceClaw 的 README_zh 结构，确认需要重排的首屏元素：标题、语言切换、简介、徽章、视频播放器和锚点导航。
- [x] 重写 README 顶部展示区，改为居中品牌标题 + 语言切换 + 一句话定位 + 彩色徽章 + 原生视频播放器。
- [x] 补一块简洁的“产品优势”卡片区，参考外部 README 的三栏式信息密度。
- [x] 清理或收敛原来的目录/展示重复块，让 README 更像展示型项目首页。
- [x] 运行 Markdown、链接和 diff 验证，在本节末尾追加 Review。
- [x] 按用户澄清，将 README 的视频播放器改为 GitHub 绝对视频地址，确保访问者在 README 内直接点击播放。

## 2026-05-23 README 首屏视频与旧名清理计划

- [x] 复查 README 首屏、项目展示、FAQ、本地配置说明、素材目录和当前视频/图片素材引用，确认仍有旧名说明与顶部图标位置问题。
- [x] 将 README 标题下的图标替换为 20 秒视频预览，并移除重复的项目展示区块。
- [x] 清理 README 中所有历史项目名、旧目录实名说明和“为什么写旧名”的 FAQ。
- [x] 重新渲染视频和关键帧快照，确保 README 首屏预览使用更新后的 CodeInsights 素材。
- [x] 验证 README 链接、旧名扫描、图片/视频预览和 git diff；在本节末尾追加 Review。

## 2026-05-23 CodeInsights 项目图标外缘修正计划

- [x] 明确反馈范围：保留当前中间深色圆角方形 CI 图标主体，去掉外侧浅色背景圈/留白，不重新设计主体图形。
- [x] 调整 `apps/electron/resources/generate-icons.sh`：在生成主图标前清理与画布边缘连通的浅色背景，并保留透明 alpha。
- [x] 重新生成 Electron、renderer、web、video 和 tray 相关图标资源，确保所有派生图标来自同一透明主图标。
- [x] 验证主图标和派生图标尺寸、透明外缘、SVG XML、typecheck/build 和 `git diff --check`。
- [x] 在本节末尾追加 Review，记录修正结果和残留风险。

## 2026-05-23 CodeInsights 项目图标外缘修正 Review

- 已按反馈保留当前 CI 主体，去掉主图标外侧浅色背景圈/留白；`apps/electron/resources/icon.png` 现在为 RGBA，四角和画布边缘 alpha 均为 0。
- 已修改 `apps/electron/resources/generate-icons.sh`：先清理画布边缘连通的浅色背景，再用透明主图标生成 `.png`、`.ico`、`.icns`、renderer、web 和 video 资源；相同 PNG 改为保存一次后复制字节，生成耗时从接近 3 分钟降到约 23 秒。
- 已按审查反馈补强生成脚本：使用 `CODEINSIGHTS_ICON_SOURCE` 刷新主图标时，如果缺少 `iconutil` 会直接失败，避免 `icon.png` 已更新但 macOS `.icns` 仍是旧图标。
- 已重新生成 Electron resources、renderer `codeinsights-logos`、renderer model icon、`web/assets/brand/logo.webp` 和 video cutout 图标；tray template 仍保持单色 CI 模板图标。
- 透明度验证通过：`apps/electron/resources/icon.png`、`codeinsights-transparent.png`、renderer model、web logo、video cutout、build 后 `dist/resources/icon.png` 均为 1024x1024 且边缘透明；`icon.ico` 顶层 256x256 四角 alpha 为 0。
- 构建验证通过：`xmllint --noout apps/electron/resources/icon.svg apps/electron/resources/codeinsights-logos/icon.svg`；`bun run --filter='@codeinsights/electron' typecheck`；`bun run --filter='@codeinsights/electron' build`；`git diff --check`。
- 代码审查通过：复查确认脚本不会把透明主图标重新扁平化成白底；`CODEINSIGHTS_ICON_SOURCE` + 缺少 `iconutil` 的保护会在写文件前失败；`.ico` / `.icns` / PNG / WebP 均保留透明角。
- 残留说明：工作树中已有 `.DS_Store`、`docs/.DS_Store`、`assets/`、`improve/` 等无关噪音，本轮未处理。

## 2026-05-22 Agent 右侧资源边栏布局优化计划

- [x] 启动前复习 `tasks/lessons.md`，确认本轮应优先做结构减法，避免给右侧边栏继续堆叠装饰和重复信息。
- [x] 定位 Agent 右侧边栏实现：`SidePanel.tsx` 负责 Resource Bay、会话文件、工作区文件；`FileDropZone.tsx` 负责拖拽上传空态；`globals.css` 负责 cockpit / vault 视觉。
- [x] 调整布局：保留会话文件和工作区文件能力，但减少重复空态、压缩标题栏和投放区，让两个资源区更像统一的简洁面板。
- [x] 调整样式：降低边框、扫描线、虚线框和内阴影权重，保留深色科技主题但提升留白和层级清晰度。
- [x] 验证：运行类型检查/聚焦构建，必要时启动本地界面核验右侧边栏首屏观感和无明显溢出。
- [x] Review：在本节末尾记录改动范围、验证结果和残留风险。

## 2026-05-22 Agent 右侧资源边栏布局优化 Review

- 已将右侧 `Resource Bay` 改为更薄的中文资源面板工具栏，刷新和关闭动作收拢到顶部，减少原先顶部英文 HUD 与分区标题重复。
- 已将会话文件、工作区文件改为统一的 `agent-resource-card` 结构：轻量标题、路径摘要、单个打开目录动作；移除两个区块之间的厚分隔线和多层嵌套边框。
- 已为 `FileDropZone` 增加 `compact` 模式，右侧边栏内上传区改为单行轻量投放入口，保留选择文件和附加文件夹能力；完整模式保持原有外部调用兼容。
- 已按审查反馈恢复空目录提示的条件显示：无附加目录时仍显示“此文件夹为空”，有附加目录时隐藏重复空态；同时补充纯图标按钮 `aria-label` / `title`，会话和工作区路径摘要兼容 Windows 分隔符。
- 验证通过：`cd apps/electron && bun run typecheck`；`cd apps/electron && bun run build:renderer`；仓库根目录 `bun run typecheck`；`git diff --check`。
- 已尝试用本地浏览器打开 `http://localhost:5173/` 做视觉核验，但浏览器环境缺少 Electron preload 的 `window.electronAPI`，初始化组件报错，不能作为桌面壳视觉证据；当前 Electron dev 进程未开放远程调试端口，因此本轮未产出真实桌面截图。
- 工作树中已有 `.DS_Store`、`assets/`、`improve/` 以及更早的图标任务记录未跟随本轮改动处理；本轮代码改动仅限 Agent 右侧资源边栏相关文件。

## 2026-05-22 CodeInsights 项目图标第四组计划

- [x] 复盘前三组候选：继续减少内部信息量，把方向收敛到更像正式 App icon 的强品牌符号。
- [x] 新增第四组 `codeinsights-refined-*` SVG：更粗主形、更少节点、更少渐变，优先保证 64px / 128px 识别。
- [x] 导出每个候选的 1024x1024 PNG，并生成第四组总览图。
- [x] 更新 `assets/icon/README.md`，说明 refined 组的定位与推荐候选。
- [x] 验证 SVG XML、PNG 尺寸、总览图渲染与 `git diff --check`，在本节末尾追加 Review。

## 2026-05-22 CodeInsights 项目图标第四组 Review

- 已新增第四组 6 套 refined 候选：`codeinsights-refined-core`、`codeinsights-refined-scope`、`codeinsights-refined-bracket`、`codeinsights-refined-signal`、`codeinsights-refined-slab`、`codeinsights-refined-terminal`。
- 每套候选都包含 SVG 源文件和 1024x1024 PNG 预览；第四组总览图为 `assets/icon/codeinsights-refined-candidates.png`。
- 本轮优化重点：相比第三组进一步减少内部细节，强化粗主形和小尺寸识别，避免复杂功能说明图；语义只保留 C/I、洞察镜头、代码括号、Agent 信号、终端入口等少量核心符号。
- 推荐优先继续打磨：`refined-core` 作为正式默认 App icon 方向，`refined-bracket` 作为开发者工具属性方向，`refined-terminal` 作为 Agent 执行入口方向。
- 本轮未替换 Electron 当前生效的 `apps/electron/resources/icon.*`，只新增候选资产。
- 验证通过：`xmllint --noout assets/icon/codeinsights-refined-*.svg`；`sips` 尺寸检查确认 6 个候选 PNG 均为 1024x1024、总览 PNG 为 1800x1200；已人工查看总览图和临时 128px / 64px 缩略图，主轮廓可识别；`git diff --check` 无空白错误。

## 2026-05-22 CodeInsights 项目图标第三组计划

- [x] 启动前复习 `tasks/lessons.md` 与现有 `assets/icon`，确认本轮只新增候选资产，不覆盖旧图标，不替换 Electron 当前生效图标。
- [x] 设计第三组更偏正式品牌标识的 SVG 候选：少元素、强轮廓、科技感、可在 Dock / tray 小尺寸下识别。
- [x] 将每个 SVG 导出为 1024x1024 PNG，并生成第三组总览图。
- [x] 更新 `assets/icon/README.md`，说明新增候选的设计方向和推荐用途。
- [x] 验证 SVG XML、PNG 尺寸、文件清单和工作树差异，在本节末尾追加 Review。

## 2026-05-22 CodeInsights 项目图标第三组 Review

- 已新增第三组 6 套几何品牌候选：`codeinsights-geometric-lens`、`codeinsights-geometric-bracket`、`codeinsights-geometric-beacon`、`codeinsights-geometric-crystal`、`codeinsights-geometric-thread`、`codeinsights-geometric-monogram`。
- 每套候选都包含 SVG 源文件和 1024x1024 PNG 预览；第三组总览图为 `assets/icon/codeinsights-geometric-candidates.png`。
- 本轮设计重点：更接近正式 App icon 的品牌标识，不做复杂功能说明图；元素控制在 C/I、代码括号、洞察光束、Agent 信号、Pipeline 单线节点等抽象符号内。
- 推荐优先继续打磨：`geometric-lens` 作为默认主图标方向，`geometric-monogram` 作为长期品牌字标方向，`geometric-bracket` 作为开发者工具属性更明确的方向。
- 本轮未替换 Electron 当前生效的 `apps/electron/resources/icon.*`，只新增候选资产。
- 验证通过：`xmllint --noout assets/icon/codeinsights-geometric-*.svg`；`sips` 尺寸检查确认 6 个候选 PNG 均为 1024x1024、总览 PNG 为 1800x1200；已人工查看总览图，确认没有占位图或空白渲染；`git diff --check` 无空白错误。

## 2026-05-22 CodeInsights 简约图标第二组计划

- [x] 记录用户反馈到 `tasks/lessons.md`：上一组元素过多，不够美观简约，后续图标应优先作为品牌标识而非功能说明图。
- [x] 重新定义设计约束：强主轮廓、低元素数、少渐变、最多一处强调色，小尺寸仍可识别。
- [x] 新增第二组简约候选 SVG：以 CodeInsights 的 C/I、代码洞察、Pipeline 方向、Agent 核心为抽象几何符号，不堆叠功能节点。
- [x] 使用 `sips` 导出 1024x1024 PNG，并生成第二组总览图。
- [x] 验证 SVG / PNG 资产，更新 `assets/icon/README.md` 与本节 Review。

## 2026-05-22 CodeInsights 简约图标第二组 Review

- 已新增第二组 6 套简约候选：`codeinsights-minimal-c-mark`、`codeinsights-minimal-aperture`、`codeinsights-minimal-stack`、`codeinsights-minimal-terminal`、`codeinsights-minimal-flow`、`codeinsights-minimal-cut`。
- 每套都包含 SVG 源文件和 1024x1024 PNG 预览；第二组总览图为 `assets/icon/codeinsights-minimal-candidates.png`。
- 本轮优化重点：减少功能说明性元素，去掉密集节点和复杂轨道，控制为强主轮廓 + 少量几何负形 + 单一强调色。
- 小尺寸临时检查覆盖 64px / 128px，`C Mark`、`Aperture`、`Terminal` 最适合作为正式 App icon 候选继续打磨；`Stack` 更接近旧识别点但更简洁。
- 本轮仍未替换 Electron 当前生效的 `apps/electron/resources/icon.*`，只生成候选资产。

## 2026-05-22 CodeInsights 项目图标候选设计计划

- [x] 启动前复习 `tasks/lessons.md`，确认本轮只新增图标资产，不触碰已有运行时代码和无关 `.DS_Store` 噪音。
- [x] 检查现有图标资源：`assets/icon` 当前为空；Electron 当前生效图标在 `apps/electron/resources/icon.*`，本轮不直接替换。
- [x] 确认导出工具：本机 `sips` 可将 SVG 导出为 1024 PNG；未安装 `rsvg-convert` / ImageMagick，因此本轮使用 SVG 源文件 + `sips` PNG 预览。
- [x] 设计多套符合 CodeInsights 定位的候选图标：保留代码纵深识别点，同时体现 Pipeline、Agent、本地优先、开源贡献与高对比桌面图标方向。
- [x] 将候选 SVG 与 PNG 放入 `assets/icon`，并生成一张候选总览图方便对比。
- [x] 验证 SVG 结构、PNG 尺寸和文件清单，在本节末尾追加 Review。

## 2026-05-22 CodeInsights 项目图标候选设计 Review

- 已新增 5 套候选图标：`codeinsights-pipeline-prism`、`codeinsights-agent-orbit`、`codeinsights-local-core`、`codeinsights-open-merge`、`codeinsights-dock-mark`。
- 每套候选都包含 SVG 源文件和 1024x1024 PNG 预览，统一放在 `assets/icon`；另有 `codeinsights-icon-candidates.png` 作为 1800x720 总览图。
- 设计方向分别覆盖：Pipeline 五阶段工作流、Agent 工具轨道、本地优先与权限审计、开源贡献/merge 流程、小尺寸高对比 Dock 标记。
- 已补充 `assets/icon/README.md` 说明候选用途；本轮未替换 Electron 当前生效的 `apps/electron/resources/icon.*`。
- 验证通过：`xmllint --noout assets/icon/codeinsights-*.svg`；`sips` 尺寸检查确认候选 PNG 均为 1024x1024，总览 PNG 为 1800x720；`git diff --check` 无空白错误。

## 2026-05-22 CodeInsights 项目重命名计划

- [x] 启动前复习 `tasks/lessons.md`，确认本轮需要保护已有 `.DS_Store`、`tasks/todo.md`、`assets/`、`improve/` 等未提交改动。
- [x] 盘点旧项目名命中范围：运行时代码、包名 scope、配置目录、环境变量、Electron 打包元数据、资源路径、README/AGENTS/历史文档和视频素材。
- [x] 定义替换规则：展示名统一为 `CodeInsights`；包 scope 使用 `@codeinsights/*`；本地配置目录使用 `~/.codeinsights` / `~/.codeinsights-dev`；环境变量前缀使用 `CODEINSIGHTS_`；内部事件和文件路径去除旧项目名。
- [x] 批量更新代码和文档，必要时同步重命名资源目录/文件名，并保持 TypeScript import 可解析。
- [x] 运行 `bun install` 同步 lockfile，执行 `bun run typecheck` 和必要聚焦测试，复查 `rg` 中旧名残留。
- [x] 在本节末尾追加 Review，说明变更、验证结果和仍保留的历史上下文风险。

## 2026-05-22 CodeInsights 项目重命名 Review

- 已将项目展示名、包 scope、Electron appId/productName、配置目录、环境变量前缀、资源目录/文件名、文档站和历史文档中的 `RV-Insights` 系列命名统一切换为 `CodeInsights` / `@codeinsights/*` / `codeinsights-*`。
- 已将主配置目录切换为 `~/.codeinsights` / `~/.codeinsights-dev`，并保留旧 `~/.rv-insights` / `~/.rv-insights-dev` 的首次复制迁移；`RV_INSIGHTS_CONFIG_DIR` 仍作为旧环境变量兼容入口，新的覆盖变量为 `CODEINSIGHTS_CONFIG_DIR`。
- 已将运行时事件写入切换为 `codeinsights_event`，并保留旧 JSONL 中 `rv_insights_event` 的读取兼容；renderer 启动脚本会把旧 `rv-insights-*` localStorage key 迁移到新的 `codeinsights-*` key。
- 已补强旧数据迁移：主进程启动早期会在新 Electron `userData` profile 不存在时复制旧 `RV-Insights` / `rv-insights` / `@rv-insights/electron-dev` profile，并跳过 Chromium Singleton 文件；旧 runtime envelope 的 `source: "rv_insights"` 也继续可校验读取。
- 已顺手收敛更早遗留的 Proma 命名：用户可见下载/菜单链接、shell marker、生图附件标记、调试环境变量主入口均切到 CodeInsights；`PROMA_DEV`、`PROMA_DEBUG_REQUEST`、`PROMA_DEBUG_SSE` 仅作为旧环境变量兼容保留。
- 已处理审查发现：`backend/.env` 中的默认 LLM API key 已清空；GitHub clone/help/issue/release 目标统一为 `zcxGGmu/CodeInsights`；README 增加 Pages 地址并同步 package 版本；web 结构测试兼容当前没有 `README_zh.md` 的仓库状态。
- 版本已递增并同步 lockfile：根包 `0.1.1`，`@codeinsights/shared@0.1.42`，`@codeinsights/core@0.2.12`，`@codeinsights/ui@0.1.4`，`@codeinsights/electron@0.0.100`。
- 验证通过：`bun install`；`bun run typecheck`；聚焦测试 49 pass；`python3 -m unittest web/tests/test_homepage_structure.py` 11 pass；`bun test --isolate` 508 pass；`bun run electron:build`；`git diff --check`；明文 `sk-*` / `DEFAULT_LLM_API_KEY` 扫描无命中。
- 最终旧名扫描只剩明确兼容点：旧事件 kind/source、旧配置目录/env、旧 Electron userData profile 迁移、旧 localStorage key 迁移，以及 `PROMA_*` 旧调试/env 兼容。RISC-V / RV64 / RVV 等领域术语未作为项目名替换。

## 2026-05-22 CodeInsights 20s 介绍视频计划

- [x] 启动前复习 `tasks/lessons.md` 与当前任务记录，确认本轮不修改运行时代码、不处理历史 `.DS_Store` 噪音。
- [x] 深入分析项目定位与公开主入口：本地优先、Pipeline 五阶段、Agent 自主执行、Skills / MCP / Bridge 扩展。
- [x] 定义 HyperFrames 视觉规范：深色技术底、项目品牌紫/青/翡翠点缀、JetBrains Mono + 系统中文 fallback 字体体系。
- [x] 在 `assets/video/` 下生成 20 秒介绍视频工程，复用现有架构图和 CodeInsights logo 素材。
- [x] 渲染最终 MP4，并运行 `hyperframes lint`、`hyperframes validate`、`hyperframes inspect` 与关键帧快照验证。
- [x] 在本节末尾补充 Review，记录产物路径、验证结果和残留风险。

## 2026-05-22 CodeInsights 20s 介绍视频 Review

- 已生成 HyperFrames 工程：`assets/video/index.html`、`DESIGN.md`、`hyperframes.json`、`package.json`、`meta.json`、`assets/` 素材目录。
- 最终视频：`assets/video/codeinsights-intro-20s.mp4`，1920x1080，30fps，H.264 + AAC，`ffprobe` 显示时长 `20.021s`，大小约 `4.9 MB`。
- 视频叙事覆盖：本地优先开源 Agent 桌面应用、Pipeline 五阶段与人工 gate、Agent Runtime 事件流、JSON/JSONL 本地状态、Skills/MCP/Bridge/Channels 扩展能力、最终 `Pipeline | Agent` 定位。
- 验证通过：`npx hyperframes lint assets/video --verbose` 0 errors / 0 warnings；`HYPERFRAMES_BROWSER_PATH="/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" PRODUCER_FORCE_SCREENSHOT=1 npx hyperframes validate assets/video --timeout 7000` 无 console errors，88 个文字元素通过 WCAG AA；`inspect --samples 12 --timeout 30000` 0 layout issues。
- 已生成关键帧快照：`assets/video/snapshots/`；并从成片抽取 `assets/video/render-contact-sheet.jpg` 做最终 MP4 画面核验。
- 已运行 animation-map：输出 `assets/video/.hyperframes/anim-map/animation-map.json`，timeline 已收敛为 20s；剩余 dead zones 为每幕留白阅读时间，collision/offscreen flag 主要来自有意的转场 wipe、glow 和场景 clip 切换。
- 验证环境说明：HyperFrames 自带 Chrome cache 曾出现半截 zip / 下载超时，最终使用本机 Microsoft Edge 作为 `HYPERFRAMES_BROWSER_PATH` 完成浏览器验证与渲染。

## 2026-05-22 Agent 重构最新开发状态（下次接续优先读）

- [x] 阶段 0-12 均已完成并提交。
- [x] 阶段 13 Runner v2 代码侧等价证据已完成并提交：自动重试、typed error 持久化、catch error SDKMessage 持久化、UI `sdk_message` 推送、重复 `run_started` / `sdk_session` 去重、Plan Mode 退出事件持久化、Watchdog / Teams auto-resume。
- [x] 阶段 13 真实 Electron Runner v2 交互证据已完成：发送、停止、权限 approve / deny、AskUser、Plan Mode、旧 session resume、同会话并发、附件、additional directory、fork、rewind。
- [x] 阶段 13 Pipeline 深水位真实 UI run 已补齐：sessionId `342a6f0f-bea1-40eb-9396-378685bfaadc` 已到 developer / reviewer / tester / committer draft，写入完整 `patch-work` 与 `patch-set`，并复验 Git guard、HEAD / refs / index / config 和 tester evidence。
- [x] 阶段 13 Codex Pipeline runner 收尾补强已完成并提交：`10356a3a fix(agent): 收尾阶段13 Pipeline 与 Codex guard 证据`，覆盖 Codex auth 隔离、strict schema 递归校验、reviewer 空字符串保守拒绝、Git guard 环境隔离和 clean-env 测试稳定性。
- [x] 阶段 13 文档交接曾同步提交：`353c5c53 docs(agent): 同步阶段13最新状态并更新继续开发提示词`；本节为 2026-05-22 文档状态再同步。
- [x] 当前版本：`@codeinsights/shared@0.1.41`，`@codeinsights/electron@0.0.99`。
- [x] 已定位 `bunx electron . --remote-debugging-port=9334` 立即退出原因：已有 9333 Electron 实例持有 `requestSingleInstanceLock()`，新进程被单实例锁退出；结束旧实例后 9334 CDP 可连接。
- [!] 飞书入口与飞书群聊 MCP 仍阻塞：本机缺少 `~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json`，不能伪造通过。
- [x] 阶段 14A 已实施并提交：`88c03213 feat(agent): 完成阶段14A Agent Runner v2 默认化`。默认 Agent 对话走 Runner v2，`CODEINSIGHTS_AGENT_RUNTIME_RUNNER_V2=0` 可回到旧主循环。
- [x] 阶段 14B 已实施并提交：`be82e53d feat(agent): 完成阶段14B Pipeline Runner v2 默认化`。默认 Pipeline Claude 节点走 Pipeline Runner v2，`CODEINSIGHTS_AGENT_RUNTIME_PIPELINE_RUNNER_V2=0` 可回到 Pipeline legacy adapter。
- [x] 已建立并完成阶段 14 分批默认化：14A Agent Runner v2、14B Pipeline Runner v2、14C Channels v2 均已默认开启并保留显式 env 回滚。
- [!] 若后续需要声明飞书真实可用，再真实补跑 `agentRuntimeChannelsV2` 飞书入口与飞书群聊 MCP；无配置时继续明确记录真实飞书阻塞。
- [x] 阶段 14A 默认化前后已跑完整聚焦验证与真实 Electron 交互复核，并继续保留旧 Agent 主循环、Pipeline legacy adapter、旧 Feishu bridge、旧 session JSONL 兼容。
- [x] 阶段 14C 已按用户指示排除飞书真实入口阻塞后完成代码侧默认化：默认 Channels v2 开启，`CODEINSIGHTS_AGENT_RUNTIME_CHANNELS_V2=0` 可回到旧 Feishu bridge 路径。
- [x] 阶段 15 已完成 Agent Runner 链路手动切换：Agent 输入区可选择 `Runner v2` / `Legacy`，选择持久化到 settings，env 显式关闭仍硬回滚旧主循环。
- [!] 2026-05-22 本轮复查：`~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json` 仍不存在；未进入阶段 14C，未修改 `agentRuntimeChannelsV2` 默认策略。
- [x] 2026-05-22 用户明确指示暂不考虑飞书问题；阶段 14C 改为评估无飞书真实入口验收下的 `agentRuntimeChannelsV2` 默认开启和显式关闭回滚，不声称飞书入口或群聊 MCP 已通过。

## 2026-05-22 Agent 重构阶段 15：Agent Runner 链路手动切换计划

- [x] 范围确认：本阶段只为桌面 Agent 输入区增加 Runner 链路选择；不删除旧 Agent 主循环，不改变 Pipeline Runner、Channels v2 或飞书路径。
- [x] UI 位置：在 Agent 输入区底部工具栏靠左、权限模式与思考按钮之间增加紧凑链路切换控件，支持 `Runner v2` 与 `Legacy` 两条链路。
- [x] 契约设计：扩展 `AgentSendInput`，允许渲染进程把本次选择的 runner mode 传给主进程；主进程根据本次选择决定进入 `InProcessAgentRuntimeRunner` 或旧内联主循环。
- [x] 回滚约束：保留 `CODEINSIGHTS_AGENT_RUNTIME_RUNNER_V2=0` 环境变量硬回滚；显式关闭 env 时即使 UI 选择 Runner v2 也必须走旧主循环。
- [x] 持久化：把用户选择保存到 settings，重启后恢复；默认值保持当前默认链路 `Runner v2`。
- [x] 可审计性：运行日志和 runtime event log 记录本次实际链路，便于证明某次会话走的是 Runner v2 还是旧主循环。
- [x] TDD：先补纯函数/契约测试，覆盖默认 Runner v2、UI 选择 Legacy、env 关闭硬回滚和 run_started 中的 runner mode。
- [x] 实现 UI、settings 类型、preload/IPC 类型、主进程分支选择与必要文案；同步递增受影响包 patch 版本。
- [x] 验证：运行 `bun run typecheck`、Agent runtime/orchestrator/event log/renderer 聚焦测试、`git diff --check`；本阶段未删除旧路径，也未触碰 Pipeline / Channels 执行路径。
- [x] 阶段 15 完成后更新 Review 和 Agent 重构 checklist，单独提交，不纳入 `.DS_Store`、`improve/`、`patch-work/` 或无关文件。

## 2026-05-22 Agent 重构阶段 15：Review

- 已在 Agent 输入区底部工具栏的权限模式与思考按钮之间增加链路切换按钮，当前显示 `Runner v2` 或 `Legacy`；运行中按钮禁用，切换只影响后续发送。
- 已扩展 `AgentSendInput.runtimeRunnerMode` 与 `AppSettings.agentRuntimeRunnerMode`，渲染进程发送消息时透传本次选择，并把用户选择持久化到 settings。
- 主进程新增 per-run 链路解析：默认走 `Runner v2`；未显式设置 env 时 UI 选择 `Legacy` 可走旧 Agent 主循环；`CODEINSIGHTS_AGENT_RUNTIME_RUNNER_V2=0` / `false` / `off` / `no` / `disabled` 仍硬回滚旧主循环，显式开启值仍强制 Runner v2。
- Runtime event log 的 `run_started` 新增可选 `runnerMode` 字段，运行日志也输出 `Runtime Runner 链路: ...`，可审计每次会话实际链路。
- 版本已递增：`@codeinsights/shared@0.1.41`，`@codeinsights/electron@0.0.99`。
- 验证通过：`bun run typecheck`；`bun test apps/electron/src/main/lib/agent-runtime-runner.test.ts apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts apps/electron/src/main/lib/agent-runtime-event-log.test.ts apps/electron/src/renderer/components/agent/agent-ui-model.test.ts apps/electron/src/renderer/atoms/agent-atoms.test.ts packages/shared/src/agent/runtime-events.test.ts`，58 pass。

## 2026-05-22 Agent 重构阶段 14C：Channels v2 非飞书默认化计划

- [x] 重新确认范围：按用户指示，本阶段不以飞书真实配置、飞书入口或飞书群聊 MCP 为默认化阻塞条件。
- [x] 保留边界说明：本阶段只能证明无飞书配置环境下默认开启 `agentRuntimeChannelsV2` 不影响桌面 Agent / Pipeline；不能声称飞书真实入口已通过。
- [x] 修改 `agentRuntimeChannelsV2` 默认策略：未设置 `CODEINSIGHTS_AGENT_RUNTIME_CHANNELS_V2` 时默认开启；显式 `0` / `false` / `off` / `no` / `disabled` 回到旧 Feishu bridge 路径；显式开启值继续强制 Channels v2。
- [x] 补充聚焦测试：覆盖默认开启、显式关闭、显式开启和模块导入时 env 决定 flag；保留 Feishu adapter 的权限排队、delta、final markdown 测试。
- [x] 验证无飞书配置环境：复查两份 feishu 配置仍缺失；按用户指示不以飞书真实入口为阻塞，不声明飞书真实通过。
- [x] 运行验证：`bun run typecheck`；Agent / Runtime / Event Log / Renderer / Feishu 聚焦测试；Pipeline 聚焦测试。
- [x] 更新 `docs/agent-refactor/development-checklist.md`、新增阶段 14C baseline、更新 `docs/agent-refactor/next-session-prompt.md` 和本文件 Review；递增 `@codeinsights/electron` patch 版本并同步 lockfile。
- [x] 阶段 14C 完成后单独提交，不纳入 `.DS_Store`、`improve/`、`patch-work/` 或无关文件。

## 2026-05-22 Agent 重构阶段 14C：Review

- 阶段 14C 已完成代码侧默认化：`agentRuntimeChannelsV2` 默认策略改为未设置 env 时启用 Channels v2，`CODEINSIGHTS_AGENT_RUNTIME_CHANNELS_V2=0` / `false` / `off` / `no` / `disabled` 可显式回滚旧 Feishu bridge 路径，`1` / `true` / `on` / `yes` / `enabled` 继续强制 Channels v2。
- 本阶段按用户指示暂不考虑飞书问题；未补跑真实飞书入口或飞书群聊 MCP，也不声明飞书真实通过。
- 本阶段只触碰 Channels v2 默认策略、聚焦测试、`@codeinsights/electron` 版本和 Agent 重构交接文档；未删除旧 Agent 主循环、Pipeline legacy adapter、旧 Feishu bridge 或旧 session JSONL 兼容。
- 验证通过：`bun run typecheck`；Feishu / channel 聚焦测试 9 pass；Agent / Runtime / Event Log / Renderer / Feishu 聚焦测试 56 pass；Pipeline 聚焦测试 91 pass。
- 飞书配置复查仍缺失：`~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json` 均不存在；如后续需要声明飞书真实可用，仍需单独补真实入口和群聊 MCP 验证。
- 下一阶段如要删除旧路径，必须另起独立计划并保留回滚点。

## 2026-05-22 Agent 重构 14C 飞书配置复查阻塞计划（历史记录）

- [x] 启动前复习 `tasks/lessons.md`、`tasks/todo.md`、Agent 重构 README、development checklist、event contract、runtime manifest、阶段 12/13/14A/14B baseline 和 next-session prompt。
- [x] 运行 `git status --short`，确认当前只存在 `.DS_Store`、`docs/.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 无关噪音，不纳入提交。
- [x] 检查 `~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json`；两者仍不存在。
- [x] 因缺少飞书配置，本轮只记录阻塞；不补跑飞书入口或飞书群聊 MCP，不伪造通过。
- [x] 当时保持 `agentRuntimeChannelsV2` 默认关闭；不删除旧 Agent 主循环、Pipeline legacy adapter、旧 Feishu bridge 或旧 session JSONL 兼容。
- [x] 运行 `git diff --check`，确认本轮只包含阻塞记录文档变更。

## 2026-05-22 Agent 重构 14C 飞书配置复查 Review（历史记录）

- 本轮未进入阶段 14C 默认化：`~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json` 均不存在，无法真实补跑飞书入口和飞书群聊 MCP。
- 当时 `agentRuntimeChannelsV2` 继续默认关闭；该阻塞判断已被用户后续“暂不考虑飞书问题”的指示覆盖。
- 本轮只更新 `tasks/todo.md` 的阻塞记录，不修改运行时代码，不修改 package 版本，不触碰旧 Agent 主循环、Pipeline legacy adapter、旧 Feishu bridge 或旧 session JSONL 兼容。

## 2026-05-22 Agent 重构 14B 后状态文档同步计划

- [x] 更新 `tasks/todo.md` 最新状态：明确 14B commit `be82e53d` 已完成，下一阶段只剩 14C Channels v2 受飞书配置阻塞。
- [x] 更新 `docs/agent-refactor/README.md`、`development-checklist.md`、`baseline-runs/2026-05-22-stage-14B.md`、`next-session-prompt.md`：补齐 14B 提交号和下次启动入口。
- [x] 运行 `git diff --check`，确认只包含文档状态同步，不纳入 `.DS_Store`、`improve/`、`patch-work/` 或无关文件。
- [x] 本轮文档状态同步后单独提交，便于下次启动直接恢复。

## 2026-05-22 Agent 重构 14B 后状态文档同步 Review

- 已同步 14B 最新完成状态：commit `be82e53d` 已作为 Pipeline Runner v2 默认化完成点写入任务记录、Agent 重构 README、development checklist、阶段 14B baseline 和 next-session prompt。
- 当前已完成：Agent Runner v2 默认开启；Pipeline Runner v2 默认开启；两者均保留显式 env 关闭回滚。
- 当时未完成：飞书入口与飞书群聊 MCP 仍缺 `~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json`；`agentRuntimeChannelsV2` 当时仍默认关闭；旧 Agent 主循环、Pipeline legacy adapter、旧 Feishu bridge 和旧 session JSONL 兼容仍保留。
- 本轮只更新文档状态和下次启动提示词，不修改运行时代码，不修改 package 版本。

## 2026-05-22 Agent 重构阶段 14B：Pipeline Runner v2 默认化执行计划

- [x] 启动前复习 `tasks/lessons.md`、`tasks/todo.md`、Agent 重构 README、development checklist、event contract、runtime manifest、阶段 12/13/14A baseline 和 next-session prompt。
- [x] 运行 `git status --short`，确认当前只存在 `.DS_Store`、`docs/.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 无关噪音，不纳入阶段提交。
- [x] 复查飞书配置：`~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json` 仍不存在，飞书入口与飞书群聊 MCP 继续阻塞，不伪造通过。
- [x] 范围确认：本阶段只评估 `agentRuntimePipelineRunnerV2` 默认化；不触碰 `agentRuntimeChannelsV2` 默认值，不删除 Pipeline legacy adapter、旧 Agent 主循环、旧 Feishu bridge 或旧 session JSONL 兼容。
- [x] 默认化前验证矩阵：`bun run typecheck`；Agent / Runtime / Event Log / Renderer atoms 聚焦测试；Pipeline 聚焦测试；clean-env Codex runner 单测；真实 Electron Pipeline 深水位 UI run；`git diff --check`。
- [x] 默认化前记录当前行为：未设置 `CODEINSIGHTS_AGENT_RUNTIME_PIPELINE_RUNNER_V2` 时 Pipeline 仍走 legacy adapter；显式 `CODEINSIGHTS_AGENT_RUNTIME_PIPELINE_RUNNER_V2=1` 时走 Pipeline Runner v2。
- [x] 实现默认策略：未设置 env 时走 Pipeline Runner v2；显式关闭 env 时回到 Pipeline legacy adapter；显式开启 env 时继续强制 Pipeline Runner v2。
- [x] 补聚焦测试：覆盖默认开启、显式关闭回滚、显式开启强制 Runner v2；确认 `agentRuntimeChannelsV2` 默认值不变。
- [x] 默认化后复跑同一验证矩阵，并记录默认 Pipeline 走 Runner v2、显式关闭走 legacy adapter 的真实 Electron 证据。
- [x] 更新 `docs/agent-refactor/development-checklist.md`、新增阶段 14B baseline、`docs/agent-refactor/next-session-prompt.md` 和本文件 Review；递增受影响包 patch 版本并同步 lockfile。
- [x] 阶段 14B 完成后单独提交，不纳入 `.DS_Store`、`improve/`、`patch-work/` 或无关文件；提交信息用中文说明完成项、验证项和未完成项。

## 2026-05-22 Agent 重构阶段 14B：Review

- 阶段 14B 已完成：`agentRuntimePipelineRunnerV2` 默认策略改为未设置 env 时启用 Pipeline Runner v2，`CODEINSIGHTS_AGENT_RUNTIME_PIPELINE_RUNNER_V2=0` / `false` / `off` / `no` / `disabled` 可显式回滚 Pipeline legacy adapter，`1` / `true` / `on` / `yes` / `enabled` 继续强制 Pipeline Runner v2。
- 本阶段只触碰 Pipeline Runner v2 默认策略、聚焦测试、`@codeinsights/electron` 版本和 Agent 重构交接文档；未默认开启 `agentRuntimeChannelsV2`，未删除旧 Agent 主循环、Pipeline legacy adapter、旧 Feishu bridge 或旧 session JSONL 兼容。
- 默认化前验证通过：`bun run typecheck`；Agent / Runtime / Event Log / Renderer / Feishu 聚焦测试 51 pass；Pipeline 聚焦测试 88 pass；clean-env Codex runner 单测 30 pass；`git diff --check`。
- 默认化前真实 Electron 基线：`0.0.96` + `CODEINSIGHTS_AGENT_RUNTIME_PIPELINE_RUNNER_V2=1` session `de721097-fdb8-4cc3-9847-e5707eecb771` 走 Pipeline Runner v2 并到 committer/completed；unseeded session `35bfc6af-233b-4318-8564-a66691d44bbb` 因无 Git repository 被 Git guard fail closed。
- 默认化后验证通过：`bun run typecheck`；Agent / Runtime / Event Log / Renderer / Feishu 聚焦测试 51 pass；Pipeline 聚焦测试 91 pass；clean-env Codex runner 单测 30 pass。
- 默认化后真实 Electron 默认路径：`0.0.97` 无 `CODEINSIGHTS_AGENT_RUNTIME_PIPELINE_RUNNER_V2` session `a70c02d0-ff2f-4283-b121-cd963771fd9f` 日志确认 explorer / planner 使用 `InProcessAgentRuntimeRunner`，最终到 committer/completed。
- 默认路径 Git guard 复验通过：HEAD `f908d9fc45795b5a3e65fcaec649db2e18b0a0ed` 未变，refs 仅 `refs/heads/main`，staged diff 为空，index SHA256 `5c3fac2a3d81eb4ad1e58c8b84c77882ba4c7e7b1cfa6a1d59d2062b89261d48` 未变，config SHA256 `6260efbdf5ce8288e0724fe95d167459922c83ad7e32070da3b7e1362d1518f8` 未变。
- 默认路径 patch-work 完整写入：`explorer/report-001.md`、`selected-task.md`、`plan.md`、`test-plan.md`、`dev.md`、`review.md`、`result.md`、`commit.md`、`pr.md` 和 `patch-set/*`；`test-evidence.json` 中 `bun test` / `bun test --coverage` 均为 passed，commit / PR 仅为 draft。
- 显式关闭回滚路径：`0.0.97` + `CODEINSIGHTS_AGENT_RUNTIME_PIPELINE_RUNNER_V2=0` session `1112d7fc-ab4b-4e4b-bedf-193533a7daec` 日志确认 explorer 使用 `legacy adapter`，随后手动 stop 到 `terminated`。
- 聚焦测试补强：新增模块导入隔离测试，验证 env 在导入时决定模块级 flag；Git/PR guard 长用例因全量运行时偶发 5s 假阴性，单独重跑通过后将该用例超时调整为 10s。
- 飞书配置复查仍阻塞：`~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json` 均不存在，不能伪造飞书入口或飞书群聊 MCP 通过。
- 当时下一阶段计划是补齐飞书配置后进入 14C；该判断已被后续用户指示“暂不考虑飞书问题”覆盖。

## 2026-05-22 Agent 重构阶段 14：Runner v2 默认化评估计划

- [x] 启动前复习 `tasks/lessons.md`、`tasks/todo.md`、Agent 重构 README、development checklist、event contract、runtime manifest、阶段 12/13 baseline 和 next-session prompt。
- [x] 运行 `git status --short`，确认当前只存在 `.DS_Store`、`docs/.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 无关噪音，不纳入阶段提交。
- [x] 检查 `~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json`；两者仍不存在，飞书入口与飞书群聊 MCP 继续阻塞，不伪造通过。
- [x] 定位三个默认化开关现状：`agentRuntimeRunnerV2` 在 `apps/electron/src/main/lib/agent-runtime-types.ts`，`agentRuntimePipelineRunnerV2` 在 `apps/electron/src/main/lib/pipeline-node-runner.ts`，`agentRuntimeChannelsV2` 在 `apps/electron/src/main/lib/agent-channel.ts`；当前均为 env 显式 `1` 才启用。
- [x] 默认化策略定为分批推进：阶段 14A 只评估 Agent Runner v2 默认开启；Pipeline Runner v2 不在同一提交默认开启；Channels v2 在飞书配置缺失前保持默认关闭。
- [x] 回滚策略：默认化实现必须保留显式 env 关闭能力，并继续保留旧 Agent 主循环、Pipeline legacy adapter、旧 Feishu bridge 和旧 session JSONL 兼容。
- [x] 阶段 14A 实现前先确认计划，不直接修改 feature flag 默认值；实现时只触碰 Agent Runner v2 默认开关和必要测试/文档。
- [x] 阶段 14A 默认化前复跑：`bun run typecheck`、Agent / Runtime / Event Log / Renderer atoms 聚焦测试、Pipeline 聚焦测试、clean-env Codex runner 单测、真实 Electron Agent 交互复核和 `git diff --check`。
- [x] 阶段 14A 默认化后复跑同一验证矩阵，确认默认 Agent 对话走 Runner v2，显式关闭开关能回到旧主循环。
- [x] 阶段 14B 只有在 14A 通过并单独提交后，才评估 Pipeline Runner v2 默认开启；已单独完成并提交 `be82e53d`，已重跑 Pipeline 深水位真实 UI run，复验 human gate、patch-work、Git guard 和 tester evidence。
- [x] 阶段 14C Channels v2 默认化已按用户指示排除飞书真实入口阻塞后完成；仍不得标记飞书入口或群聊 MCP 通过。

## 2026-05-22 Agent 重构阶段 14A：Agent Runner v2 默认化执行计划

- [x] 启动前复习必要文档，并确认工作树只存在 `.DS_Store`、`docs/.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 噪音。
- [x] 复查飞书配置：`~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json` 仍不存在，飞书入口与飞书群聊 MCP 继续阻塞，不伪造通过。
- [x] 范围确认：本阶段只修改 `agentRuntimeRunnerV2` 默认策略、相关聚焦测试、必要版本与阶段文档；不默认开启 `agentRuntimePipelineRunnerV2` 或 `agentRuntimeChannelsV2`。
- [x] 默认化前验证矩阵：`bun run typecheck`；Agent / Runtime / Event Log / Renderer atoms 聚焦测试；Pipeline 聚焦测试；clean-env Codex runner 单测；真实 Electron Agent 交互复核；`git diff --check`。
- [x] 实现默认策略：未设置 env 时走 Runner v2；显式关闭 env 时回到旧 Agent 主循环；显式开启 env 时继续强制 Runner v2。
- [x] 补聚焦测试：覆盖默认开启、显式关闭回滚、显式开启强制 Runner v2；确认 Pipeline / Channels 默认值不变。
- [x] 默认化后复跑同一验证矩阵，并记录默认 Agent 对话走 Runner v2、显式关闭走旧主循环的真实 Electron 证据。
- [x] 更新 `docs/agent-refactor/development-checklist.md`、必要交接文档和本文件 Review；递增受影响包 patch 版本并同步 lockfile。
- [x] 阶段 14A 完成后单独提交，不纳入 `.DS_Store`、`improve/`、`patch-work/` 或无关文件。

## 2026-05-22 Agent 重构阶段 14A：Review

- 阶段 14A 已完成：`agentRuntimeRunnerV2` 默认策略改为未设置 env 时启用 Runner v2，`CODEINSIGHTS_AGENT_RUNTIME_RUNNER_V2=0` / `false` / `off` / `no` / `disabled` 可显式回滚旧主循环，`1` / `true` / `on` / `yes` / `enabled` 继续强制 Runner v2。
- 阶段 14A 已单独提交：`88c03213 feat(agent): 完成阶段14A Agent Runner v2 默认化`。
- 本阶段只触碰 Agent Runner v2 默认策略、聚焦测试、`@codeinsights/electron` 版本和 Agent 重构交接文档；未默认开启 `agentRuntimePipelineRunnerV2` 或 `agentRuntimeChannelsV2`，未删除旧 Agent 主循环、Pipeline legacy adapter、旧 Feishu bridge 或旧 session JSONL 兼容。
- 默认化前验证通过：`bun run typecheck`；Agent / Runtime / Event Log / Renderer atoms 聚焦测试 44 pass；Pipeline 聚焦测试 87 pass；clean-env Codex runner 单测 30 pass；`git diff --check`。
- 默认化前真实 Electron 基线：`0.0.95` 无 env session `53a0c58e-0ca9-4a26-8354-45910b99a904` 走旧主循环，输出 `stage14 pre default legacy ok`。
- 默认化后验证通过：`bun run typecheck`；Agent / Runtime / Event Log / Renderer / Feishu 聚焦测试 51 pass；Pipeline 聚焦测试 88 pass；clean-env Codex runner 单测 30 pass；`git diff --check`。
- 默认化后真实 Electron 默认路径：`0.0.96` 无 env session `073783b3-27ae-49ec-b516-92de146e6572` 日志确认切到 `InProcessAgentRuntimeRunner`，events JSONL 写入 `run_completed`，输出 `stage14 default runner v2 ok`。
- 显式关闭回滚路径：`0.0.96` + `CODEINSIGHTS_AGENT_RUNTIME_RUNNER_V2=0` session `70bf7de8-043a-49c2-81c4-28e49f15ff96` 日志确认无 Runner v2 切换，走旧 Adapter 主循环并输出 `stage14 explicit off legacy ok`。
- 飞书配置复查仍阻塞：`~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json` 均不存在，不能伪造飞书入口或飞书群聊 MCP 通过。
- 下一阶段只能在本阶段单独提交后进入 14B：评估 Pipeline Runner v2 默认化，并重新补 Pipeline 深水位真实 UI run。

## 2026-05-22 Agent 重构 14A 后状态文档同步计划

- [x] 更新 `tasks/todo.md` 最新状态：明确 14A commit `88c03213` 已完成，下一阶段是 14B。
- [x] 更新 `docs/agent-refactor/README.md`、`development-checklist.md`、`next-session-prompt.md`：补入 14A 提交号与 14B 接续入口。
- [x] 运行 `git diff --check`，确认只包含文档状态同步，不纳入 `.DS_Store`、`improve/` 或无关文件。
- [x] 本轮文档状态同步后单独提交，便于下次启动直接恢复。

## 2026-05-22 Agent 重构 14A 后状态文档同步 Review

- 已同步 14A 最新完成状态：commit `88c03213` 已作为 Agent Runner v2 默认化完成点写入任务记录、Agent 重构 README、development checklist 和 next-session prompt。
- 下次启动入口已明确为阶段 14B：只评估 Pipeline Runner v2 默认化，进入前先更新计划并重跑 Pipeline 深水位真实 UI run；Channels v2 不得同批默认开启。
- 当前未完成项仍为：飞书入口与飞书群聊 MCP 缺配置阻塞；`agentRuntimePipelineRunnerV2` 与 `agentRuntimeChannelsV2` 默认值尚未修改；旧 Agent 主循环、Pipeline legacy adapter、旧 Feishu bridge 和旧 session JSONL 兼容仍保留。

## 2026-05-22 Agent 重构阶段 14：计划 Review

- 本轮只建立 Runner v2 默认化评估计划，不修改运行时代码，不改变 `agentRuntimeRunnerV2` / `agentRuntimePipelineRunnerV2` / `agentRuntimeChannelsV2` 当前默认关闭行为。
- 分批决策：Agent Runner v2 可作为第一批默认化候选；Pipeline Runner v2 虽已有深水位证据，但因副作用面更大，必须后置到单独阶段；Channels v2 因飞书配置缺失继续阻塞。
- 默认化实现必须提供显式回滚开关，不能删除旧 Agent 主循环、Pipeline legacy adapter、旧 Feishu bridge 或旧 session JSONL 兼容。
- 飞书配置复查仍缺失：`~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json` 均不存在。

## 2026-05-22 Agent 重构文档状态同步计划

- [x] 更新 `docs/agent-refactor/README.md` 当前进度：补入阶段 14 计划提交 `02199299`，明确下一步进入 14A。
- [x] 更新 `docs/agent-refactor/next-session-prompt.md`：给出下次启动可直接发送的提示词，入口改为阶段 14A。
- [x] 保持 `docs/agent-refactor/development-checklist.md` 的阶段 14 分批默认化计划为当前主控状态。
- [x] 本轮不修改运行时代码，不修改 package 版本，不改 README 项目根文档或 AGENTS。
- [x] 运行文档 diff 检查和 `git diff --check`。

## 2026-05-22 Agent 重构文档状态同步 Review

- 已把最新开发状态同步到 Agent 重构 README、development checklist、next-session prompt 和本任务记录。
- 当前已完成：阶段 0-13 全部实现/证据项完成；阶段 14 默认化评估计划完成并已提交；阶段 14A Agent Runner v2 默认化已完成。
- 当前未完成：飞书入口与飞书群聊 MCP 仍缺配置阻塞；Pipeline Runner v2 与 Channels v2 默认开关尚未修改；14B Pipeline 默认化评估尚未开始。
- 下次启动应从阶段 14B 继续：先做 Pipeline 默认化前验证，再只评估 Pipeline Runner v2 默认策略，Channels v2 不得同批默认开启。

## 2026-05-22 文档状态同步 Review

- 本次任务只更新交接文档和下次启动提示词，不修改运行时代码。
- 历史阶段条目中的旧 `[ ]` / `[~]` 可能是当时记录，判断当前进度时以本节、`docs/agent-refactor/development-checklist.md` 的“当前开发状态”和 `docs/agent-refactor/next-session-prompt.md` 为准。
- 当前工作树已知无关噪音：`.DS_Store`、`docs/.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store`；后续提交不得纳入这些文件。

## 2026-05-19 Agent 重构阶段 13：Pipeline 深水位续跑计划

- [x] 启动前复习 `tasks/lessons.md`、`tasks/todo.md`、Agent 重构 README、development checklist、event contract、runtime manifest、阶段 12/13 baseline 和 next-session prompt。
- [x] 检查 `git status --short`，确认当前只有 `.DS_Store`、`docs/.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 噪音，不纳入阶段提交。
- [x] 确认可用渠道/模型：本机开发配置仍只有 DeepSeek 渠道；本轮采用已完成的 deepwater session 证据，不再重新赌余额。
- [x] 启动 Electron / CDP，并在 `CODEINSIGHTS_AGENT_RUNTIME_PIPELINE_RUNNER_V2=1`、`CODEINSIGHTS_AGENT_RUNTIME_RUNNER_V2=1` 下补跑最小 Pipeline v2 真实 UI run。
- [x] 让 Pipeline 至少进入 developer / reviewer / tester，记录 sessionId、gateId、选择的 report、records、patch-work 文件和最终状态。
- [x] 复验 Git 写入防护：确认 developer / tester 阶段没有污染 HEAD、refs、index、local config，并保留校验命令/结果。
- [x] 复验 tester 证据保守判定：真实 session 的 evidence 全部为 `passed`，缺失或 failed/skipped evidence 仍由聚焦测试保守阻断。
- [x] 检查 `~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json`；两者仍不存在，继续记录阻塞，不伪造通过。
- [x] 更新 `docs/agent-refactor/development-checklist.md`、`docs/agent-refactor/baseline-runs/2026-05-18-stage-13.md`、`docs/agent-refactor/next-session-prompt.md` 和本文件 Review。
- [x] 运行 `bun run typecheck`、Agent / Runtime / Event Log / Renderer atoms 聚焦测试、Pipeline 聚焦测试、clean-env Codex runner 测试、Electron 真实交互证据复核和 `git diff --check`。
- [x] 阶段 13 本轮补证完成后单独提交，只包含阶段 13 相关文件，不纳入 `.DS_Store`、`improve/` 或无关改动。

## 2026-05-19 Agent 重构阶段 13：Pipeline 深水位与 Codex auth Review

- Pipeline deepwater session `342a6f0f-bea1-40eb-9396-378685bfaadc` 已形成真实 UI 证据：`patch-work/dev.md`、`patch-work/review.md`、`patch-work/result.md`、`patch-work/commit.md`、`patch-work/pr.md` 和 `patch-work/patch-set/*` 均存在。
- Reviewer 只读通过：`patch-work/review.md` 结论 `approved=true`，未发现 blocking issue。
- Tester workspace-write 通过：`patch-work/result.md` 记录 `bun test` 与 `bun test --coverage` 成功；`test-evidence.json` 三条 evidence 均为 `passed`。
- Committer 仅生成草稿：`commit.md` / `pr.md` 均为 draft only，明确未执行 `git add`、`git commit`、`git push` 或创建 PR。
- Git guard 复验通过：HEAD 为 `9e701190e6ea8ca80f4417aa6300d70b40f89e50`，refs 仅 `refs/heads/main`，staged diff 为空，index SHA256 为 `676c9ec5d1621f8e7007ec8d6fdc415332a3703d641a0c323ba7f3367472ea74`，config SHA256 为 `507d44b93b030d2b2c78262ca9920be5a0d43ca914dce94943f5007673f91a37`。
- Codex Pipeline runner 已补强 auth 隔离：支持 `CODEX_HOME/auth.json`，API key 模式隔离继承的 `CODEX_HOME`，测试默认用假 `CODEX_API_KEY`，只有 fail-fast 用例保留无凭证路径。
- Strict schema 已补递归测试，所有 object schema 的 `required` 必须完整覆盖 `properties`，Codex mock finalResponse 已更新为符合 schema 的响应；reviewer `structuredIssues` 的 id / file / suggestedFix 空字符串会被保守拒绝。
- Git guard 已补宿主 `GIT_*` 环境隔离：内部 Git snapshot 使用清理后的环境，v2 写入节点存在 contribution task 但无法读取 HEAD 时 fail closed，避免因宿主 `GIT_DIR` / `GIT_CONFIG_COUNT` 导致 guard 不安装。
- 飞书配置复查仍阻塞：`~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json` 均不存在，不能伪造通过。
- clean-env Codex runner 单测在 3 秒等待窗口下曾复现 `grandchild.pid` 假阴性超时；已把进程树 fixture 等待窗口调宽到 10 秒，避免干净环境 Bun 子进程冷启动导致误报。
- 已通过 clean-env Codex runner 单测：空 `HOME` / 空 `CODEX_HOME` / 无 `CODEX_API_KEY` / 无 `OPENAI_API_KEY` 下 `codex-pipeline-node-runner.test.ts` 30 pass。
- 已通过本轮收尾验证：`bun run typecheck`；Agent / Runtime / Event Log / Renderer atoms 聚焦测试 44 pass；Pipeline 聚焦测试 87 pass；clean-env Codex runner 单测 30 pass；`git diff --check`。

## 2026-05-19 Agent 重构阶段 13：Pipeline planner fallback 与深水位补跑 Review

- 已定位 Electron 9334 立即退出根因：旧 Electron 仍在 9333 运行，单实例锁导致新进程退出；结束旧实例并重启后 `curl http://127.0.0.1:9334/json/version` 返回 `@codeinsights/electron/0.0.93`，CDP 恢复。
- 真实 Pipeline run `2432c724-3b6f-463e-89c6-bdb135ac0a65` 已进入 `explorer/task_selection` gate，写入 `patch-work/explorer/report-001.md`；选择 `report-001` 后 planner 返回自然语言摘要，旧逻辑因“输出不是合法 JSON 对象”失败。
- 已修复 planner 自然语言 fallback：非 JSON planner 输出会生成保守 `PipelinePlannerStageOutput`，v2 enrichment 会继续写入 `patch-work/plan.md` 与 `patch-work/test-plan.md`，不放宽 reviewer / tester 严格结构化校验。
- 修复后新真实 Pipeline run `e81216eb-9902-475e-98fc-a51661426694` 启动成功，explorer 阶段尝试写文件被只读工具防护拦截，随后 DeepSeek 渠道返回 `Insufficient Balance`，当时未标记深水位通过；后续 session `342a6f0f-bea1-40eb-9396-378685bfaadc` 已补齐深水位证据。
- Pipeline planner fallback 修复已提交：`6171f164 fix(agent): 补强阶段13 Pipeline planner fallback 证据`。
- 飞书配置复查仍阻塞：`~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json` 均不存在。
- 验证通过：`bun run typecheck`；Agent / Runtime / Event Log / Renderer atoms 聚焦测试 44 pass；Pipeline 聚焦测试 83 pass；`git diff --check`。

## 2026-05-18 Agent 重构最新状态交接

- [x] 阶段 0 冻结基线已完成并提交：`47f8ad8d docs: 冻结 Agent 重构阶段 0 行为基线`。
- [x] 阶段 1 Shared Event Contract 已完成并提交：`d9801cf9 feat(shared): 完成 Agent 重构阶段 1 事件契约`。
- [x] 阶段 2 Event Log 双写已完成并提交：`04f23aa6 feat(agent): 完成 Agent 重构阶段 2 事件日志双写`。
- [x] 阶段 3 In-process AgentRuntimeRunner 已完成并提交：`ee1157b9 feat(agent): 完成 Agent 重构阶段 3 进程内 Runner`。
- [x] 阶段 4 Runtime Manifest 只读解析已完成并提交：`18a65cd1 feat(agent): 完成 Agent 重构阶段 4 Runtime Manifest 只读解析`。
- [x] 阶段 5 交接提示词已更新并提交：`410d8945 docs(agent): 更新阶段 5 交接提示词`。
- [x] 阶段 5 Runtime Materializer for New Sessions 已完成并提交：`10fd5808 feat(agent): 完成 Agent 重构阶段 5 Runtime Materializer`。
- [x] 阶段 6 插件系统原生化已完成并提交：`05f3c9e9 feat(agent): 完成 Agent 重构阶段 6 插件系统原生化`。
- [x] 阶段 7 内置 MCP Bridge 已完成并提交：`eb9b9f34 feat(agent): 完成 Agent 重构阶段 7 内置 MCP Bridge`。
- [x] 阶段 8 Renderer 切新 Reducer 已完成并提交：`6ff5a6cb feat(agent): 完成 Agent 重构阶段 8 Renderer 切新 Reducer`。
- [x] 阶段 9 External Channel Adapter 已完成并提交：`09e558a7 feat(agent): 完成 Agent 重构阶段 9 External Channel Adapter`。
- [x] 阶段 10 Pipeline 复用 Runner 已完成实现与聚焦验证。
- [x] 阶段 11 清理旧路径已完成并提交：`2760a3e8 feat(agent): 完成阶段11旧路径清理`。
- [x] 阶段 12 真实交互补跑与 Runner v2 默认化准备已完成并提交：`0e37e500 feat(agent): 完成阶段12真实交互补跑与Runner v2 stop加固`。
- [x] 阶段 13 Runner v2 默认化证据补齐已完成到可审计状态：代码侧补强 `328b3c96`、`sdk_session` 去重 `46e62a75`、Plan Mode 退出 `acc769f1`、Watchdog / Teams auto-resume `b3d0517e`、Pipeline planner fallback `6171f164`、Pipeline 与 Codex guard 收尾 `10356a3a` 均已提交；Pipeline UI 深水位证据已由后续 session `342a6f0f-bea1-40eb-9396-378685bfaadc` 补齐。

## 2026-05-18 Agent 重构阶段 13：Runner v2 默认化证据补齐计划

- [x] 复习 `tasks/lessons.md`、阶段 12 证据、Agent 重构 README、development checklist、event contract 和 runtime manifest。
- [x] 检查当前工作树，确认 `.DS_Store` 与 `improve/` 为无关噪音，不纳入阶段提交。
- [x] 梳理旧 Agent 主循环仍独有能力：自动重试、Watchdog、Teams auto-resume、typed error 持久化、UI `sdk_message` 推送、旧 session resume / transcript 兼容。
- [x] 在 `agentRuntimeRunnerV2` feature flag 下补齐自动重试等价测试或明确记录仍不等价原因。
- [x] 在 `agentRuntimeRunnerV2` feature flag 下补齐 typed error 持久化和 completion signal 行为测试。
- [~] 补跑真实 Electron Runner v2 交互：发送、停止、权限 approve / deny、AskUser、Plan Mode。
- [!] 补跑旧 session resume、同会话并发、附件、additional directory、fork、rewind；当前真实脚本多次超时，需改为更小粒度脚本或单场景补跑。
- [!] 补跑最小 Pipeline 真实 UI run，复验 human gate、patch-work 写入防护、HEAD/refs/index/config 校验和 tester 证据保守判定；本轮未进入。
- [ ] 若有飞书配置，补跑 `agentRuntimeChannelsV2` 飞书入口与群聊 MCP；若仍无配置，继续明确阻塞，不伪造通过。
- [~] 判断是否具备默认开启 `agentRuntimeRunnerV2` 条件；目前仅部分证据补齐，仍不能默认开启。
- [x] 更新 `docs/agent-refactor/baseline-runs/` 新证据、`docs/agent-refactor/development-checklist.md` 和本文件 Review。
- [~] 运行 `bun run typecheck`、Agent / Runtime / Renderer / Pipeline 聚焦测试、Electron 真实交互补跑和 `git diff --check`。
- [x] 阶段 13 代码侧补强已单独提交，不纳入 `.DS_Store`、`improve/` 或无关改动：`328b3c96 feat(agent): 补齐阶段13 Runner v2 等价证据`。
- [x] 阶段 13 追加修复已单独提交，不纳入 `.DS_Store`、`improve/` 或无关改动：`46e62a75 fix(agent): 补强阶段13 sdk_session 去重证据`。
- [x] 阶段 13 Plan Mode 退出证据补强已单独提交，不纳入 `.DS_Store`、`improve/` 或无关改动：`acc769f1 fix(agent): 补强阶段13 Plan Mode 退出证据`。

## 2026-05-18 Agent 重构阶段 13：当前 Review

- Runner v2 已补齐的代码侧证据：自动重试、typed error 持久化、`sdk_message` UI 推送、stop 终态加固与重复 `run_started/sdk_session` 去重。
- 已完成验证：`bun run typecheck`；`bun test apps/electron/src/main/lib/agent-runtime-runner.test.ts apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts apps/electron/src/main/lib/agent-runtime-event-log.test.ts apps/electron/src/renderer/atoms/agent-atoms.test.ts packages/shared/src/agent/runtime-events.test.ts`；`bun test apps/electron/src/main/lib/pipeline-node-runner.test.ts apps/electron/src/main/lib/pipeline-human-gate-service.test.ts apps/electron/src/main/lib/pipeline-patch-work-service.test.ts apps/electron/src/main/lib/codex-pipeline-node-runner.test.ts`；`git diff --check`。
- 真实 Electron 交互已补到发送与停止；权限 approve / deny、AskUser、Plan Mode 在本轮脚本中卡在会话/响应编排上，未形成可提交证据。
- 旧 session resume、同会话并发、附件、additional directory、fork、rewind、最小 Pipeline 真实 UI run 仍未完成。
- 当前仍不能默认开启 `agentRuntimeRunnerV2`；缺口主要在真实交互覆盖，不在 typecheck 或聚焦单测。
- 已将 `@codeinsights/electron` 升到 `0.0.90`，并同步 `bun.lock` workspace 版本元数据。
- 新增阶段 13 状态证据文档：`docs/agent-refactor/baseline-runs/2026-05-18-stage-13.md`。

## 2026-05-18 Agent 重构阶段 13：下次启动继续开发入口

- [x] 先复习本文件、`tasks/lessons.md`、`docs/agent-refactor/development-checklist.md`、`docs/agent-refactor/baseline-runs/2026-05-18-stage-12.md` 和 `docs/agent-refactor/baseline-runs/2026-05-18-stage-13.md`。
- [x] 不默认开启 `agentRuntimeRunnerV2`，不删除旧 Agent 主循环，不做 UI 改版。
- [~] 用更小粒度 CDP / preload 脚本补跑 Runner v2 权限 approve、权限 deny、AskUser、Plan Mode；权限 approve / deny 已补跑通过，其他 pending 仍待补。
- [ ] 补跑旧 session resume、同会话并发、附件、additional directory、fork、rewind；每项记录 sessionId、输入、终态、events JSONL 证据和阻塞原因。
- [ ] 补跑最小 Pipeline 真实 UI run，复验 human gate、patch-work 写入防护、HEAD/refs/index/config 校验和 tester 证据保守判定。
- [ ] 检查 `~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json`；若仍不存在，继续记录飞书阻塞，不能伪造通过。
- [ ] 完成真实证据后再评估 `agentRuntimeRunnerV2` 是否具备默认开启条件。
- [ ] 收尾时运行 `bun run typecheck`、Agent / Runtime / Event Log / Renderer atoms 聚焦测试、Pipeline 聚焦测试、Electron 真实交互补跑和 `git diff --check`。

## 2026-05-19 Agent 重构阶段 13：真实证据补跑计划

- [x] 复习阶段 13 交接文档、事件契约、runtime manifest、阶段 12/13 baseline 和 lessons。
- [x] 梳理 preload / CDP / Electron 启动入口，确认 Agent pending 响应字段严格使用 `behavior`、`answers`、`action`。
- [x] 单场景补跑 Runner v2 权限 approve，记录 sessionId、requestId、events JSONL 终态和 SDKMessage 证据。
- [x] 单场景补跑 Runner v2 权限 deny，记录 sessionId、requestId、permission_denials / run 终态。
- [ ] 单场景补跑 Runner v2 AskUser，记录 requestId、回答 payload、resolved event 和后续终态或明确阻塞。
- [ ] 单场景补跑 Runner v2 Plan Mode，记录 `plan_mode_entered`、`plan_mode_exited` 或阻塞原因，并恢复 workspace permission mode。
- [ ] 分项补跑旧 session resume、同会话并发、附件、additional directory、fork、rewind；失败时必须 stop 当前 session 并记录阻塞。
- [ ] 补跑最小 Pipeline 真实 UI run，并复验 human gate、patch-work Git 写入防护、HEAD/refs/index/config 校验和 tester 证据保守判定。
- [x] 检查飞书配置文件；`~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json` 仍缺失，继续记录阻塞。
- [~] 更新 `docs/agent-refactor/development-checklist.md`、`docs/agent-refactor/baseline-runs/2026-05-18-stage-13.md` 和本文件 Review。
- [x] 运行 `bun run typecheck`、Agent / Runtime / Event Log / Renderer atoms 聚焦测试、Pipeline 聚焦测试、Electron 真实交互补跑和 `git diff --check`。

## 2026-05-19 Agent 重构阶段 13：当前 Review

- Runner v2 权限 approve 已用 Electron 0.0.90 + `CODEINSIGHTS_AGENT_RUNTIME_RUNNER_V2=1` 真实补跑通过：sessionId `d2fd3559-3515-40ed-b0dd-304c6c218200`，requestId `f7bf1269-3e92-45b0-b99a-f5f451eefde5`，`Write` 工具批准后写入 `stage13-runner-v2-approve-dedupe.txt`，events JSONL 终态 `run_completed`。
- Runner v2 权限 deny 已用同一 Electron 实例真实补跑通过：sessionId `c31ec718-0d80-465f-bebd-5233e2ca7884`，requestId `b31cdc76-fe22-428a-a11c-32fba08899b4`，`permission_resolved(decision=denied)` 后 `tool_completed(status=error, outputSummary=用户拒绝了此操作)`，目标文件未生成。
- 补跑中发现阶段 13 原“重复 sdk_session 去重”仍不完整：`queryOptions.onSessionId` 会多次写入相同 `sdk_session`。已改为 event log writer 对同一 run 内相同 `sdkSessionId` 去重，并新增聚焦测试。
- 修复后复验：`d2fd3559-3515-40ed-b0dd-304c6c218200.events.jsonl` 中 `sdk_session_count=1`，事件序列保持连续，文件写入成功。
- 追加修复已提交：`46e62a75 fix(agent): 补强阶段13 sdk_session 去重证据`。
- Plan Mode 退出证据补强已提交：`acc769f1 fix(agent): 补强阶段13 Plan Mode 退出证据`。
- 已将 `@codeinsights/electron` 升到 `0.0.91`，并同步 `bun.lock` workspace 版本元数据。
- 已通过聚焦测试：`bun test apps/electron/src/main/lib/agent-runtime-event-log.test.ts apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts apps/electron/src/main/lib/agent-runtime-runner.test.ts`。
- 已通过收尾验证：`bun run typecheck`；`bun test apps/electron/src/main/lib/agent-runtime-runner.test.ts apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts apps/electron/src/main/lib/agent-runtime-event-log.test.ts apps/electron/src/renderer/atoms/agent-atoms.test.ts packages/shared/src/agent/runtime-events.test.ts`（41 pass）；`bun test apps/electron/src/main/lib/pipeline-node-runner.test.ts apps/electron/src/main/lib/pipeline-human-gate-service.test.ts apps/electron/src/main/lib/pipeline-patch-work-service.test.ts apps/electron/src/main/lib/codex-pipeline-node-runner.test.ts`（81 pass）；`git diff --check`。
- 飞书配置仍阻塞：`~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json` 均不存在。
- 仍不能默认开启 Runner v2；AskUser、Plan Mode、旧 session resume、同会话并发、附件、additional directory、fork、rewind 已在后续补跑通过，剩余缺口是 Watchdog、Teams auto-resume、能进入 gate/patch-work/tester 的 Pipeline 真实 UI run 和飞书入口。

## 2026-05-19 Agent 重构阶段 13：下次启动继续开发入口

- [x] 当前代码侧补强、`sdk_session` 去重修复和 Plan Mode 退出证据补强已提交，提交号分别为 `328b3c96`、`46e62a75` 与 `acc769f1`。
- [x] 历史记录：当时默认 Agent 对话仍走旧 Orchestrator 主循环；`agentRuntimeRunnerV2`、`agentRuntimePipelineRunnerV2`、`agentRuntimeChannelsV2` 当时均不能默认开启。
- [x] 已完成真实 Electron Runner v2：发送、停止、权限 approve、权限 deny。
- [ ] 下一步先补 Runner v2 AskUser 单场景脚本，记录 requestId、`respondAskUser({ requestId, answers })` payload、resolved event、终态和 events JSONL。
- [ ] 再补 Runner v2 Plan Mode 单场景脚本，记录 `plan_mode_entered`、`respondExitPlanMode({ requestId, action })`、`plan_mode_exited` 或阻塞原因，并恢复 workspace permission mode。
- [ ] 再分项补旧 session resume、同会话并发、附件、additional directory、fork、rewind；每项只跑一个脚本，失败必须 stop 当前 session 并记录阻塞。
- [ ] 再补最小 Pipeline 真实 UI run，复验 human gate、patch-work Git 写入防护、HEAD/refs/index/config 校验和 tester 证据保守判定。
- [ ] 再检查飞书配置；若 `~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json` 仍不存在，继续记录阻塞，不伪造通过。
- [ ] 收尾前更新 `tasks/todo.md`、`docs/agent-refactor/development-checklist.md`、`docs/agent-refactor/baseline-runs/2026-05-18-stage-13.md` 和 `docs/agent-refactor/next-session-prompt.md`。
- [ ] 收尾验证至少包括 `bun run typecheck`、Agent / Runtime / Event Log / Renderer atoms 聚焦测试、Pipeline 聚焦测试、Electron 真实交互补跑和 `git diff --check`。

## 2026-05-19 Agent 重构阶段 13：继续真实证据补跑计划

- [x] 启动前复习 `tasks/lessons.md`、`tasks/todo.md`、Agent 重构 README、development checklist、event contract、runtime manifest、阶段 12/13 baseline 和 next-session prompt。
- [x] 检查 `git status --short`，确认只忽略 `.DS_Store`、`improve/` 与既有阶段 13 文档改动，不纳入无关噪音。
- [x] 单独补跑 Runner v2 AskUser：记录 sessionId、requestId、`respondAskUser({ requestId, answers })` payload、`ask_user_resolved` 和终态；超时必须 stop 并记录阻塞。
- [x] 单独补跑 Runner v2 Plan Mode：记录 `plan_mode_entered`、`respondExitPlanMode({ requestId, action })`、`plan_mode_exited` 或阻塞原因，并恢复 workspace permission mode。
- [x] 分项补跑旧 session resume、同会话并发、附件、additional directory、fork、rewind；每项记录 sessionId、输入、终态、events JSONL 证据和阻塞原因。
- [!] 补跑最小 Pipeline 真实 UI run，复验 human gate、patch-work Git 写入防护、HEAD/refs/index/config 校验和 tester 证据保守判定；已启动并 stop，但 150 秒内未到 gate / patch-work / tester，不能标记通过。
- [x] 检查 `~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json`；两者仍不存在，继续记录飞书阻塞，不伪造通过。
- [x] 更新阶段 13 baseline、development checklist、next-session prompt 和本文件 Review。
- [x] 运行 `bun run typecheck`、Agent / Runtime / Event Log / Renderer atoms 聚焦测试、Pipeline 聚焦测试、Electron 真实交互补跑和 `git diff --check`。

## 2026-05-19 Agent 重构阶段 13：继续真实证据补跑 Review

- Runner v2 AskUser 已真实补跑通过：sessionId `436a4963-edc9-4e7f-b5ec-50058ec9ce3b`，requestId `d5e9574f-9811-4bdb-b0f5-0fb61e55c9c3`，`respondAskUser({ requestId, answers })` 后写入 `ask_user_resolved` 与 `run_completed`，最终输出 `stage13 runner v2 askuser ok`。
- Runner v2 Plan Mode 已真实补跑通过：sessionId `8f5ac714-6397-4d0e-94a7-38aa0f9f8696`，requestId `4ebe4e01-d822-4b25-8938-5162a118a259`，`approve_edit` 后写入 `plan_mode_entered -> plan_mode_exited -> run_completed`，workspace permission mode 已恢复 `auto`。
- 真实补跑发现并修复 `plan_mode_exited` 持久化缺口；修复后只在 `approve_auto` / `approve_edit` 写退出事件，`deny` / `feedback` 不写，避免 replay 错误关闭 plan mode。
- 旧 session resume 已补跑：旧会话 `0ec2d089-e052-4d20-9ed6-57746cf4ac29` 无 runtime manifest，Runner v2 复用旧 cwd 与 `sdkSessionId=d4de1bc5-93d6-46bd-bb6f-6450ad95e8e2`，终态 `run_completed`。
- 同会话并发、附件保存、additional directory、fork、rewind 均已形成最小真实证据；详见 stage-13 baseline。
- 最小 Pipeline v2 真实 run 已尝试：sessionId `e4012949-23ff-417f-ae73-1febd99800b1`，150 秒停留 `explorer/running`，stop 后 stream/records 写入 `terminated`；未到 human gate / patch-work / tester，不能标记通过。
- 飞书配置仍阻塞：`~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json` 均不存在。
- 已将 `@codeinsights/electron` 升到 `0.0.92` 并同步 `bun.lock`。
- 收尾验证已通过：`bun run typecheck`；`bun test apps/electron/src/main/lib/agent-runtime-runner.test.ts apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts apps/electron/src/main/lib/agent-runtime-event-log.test.ts apps/electron/src/renderer/atoms/agent-atoms.test.ts packages/shared/src/agent/runtime-events.test.ts`（42 pass）；`bun test apps/electron/src/main/lib/pipeline-node-runner.test.ts apps/electron/src/main/lib/pipeline-human-gate-service.test.ts apps/electron/src/main/lib/pipeline-patch-work-service.test.ts apps/electron/src/main/lib/codex-pipeline-node-runner.test.ts`（81 pass）；`git diff --check`。
- 当前仍不能默认开启 Runner v2；Watchdog、Teams auto-resume 和 Pipeline 深水位真实 run 后续均已补齐，剩余阻塞是飞书入口缺配置，以及默认化本身仍需单独计划和回归验证。

## 2026-05-19 Agent 重构阶段 13：Watchdog / Pipeline 深水位补证计划

- [x] 启动前复习 `tasks/lessons.md`、`tasks/todo.md`、Agent 重构 README、development checklist、event contract、runtime manifest、阶段 12/13 baseline 和 next-session prompt。
- [x] 检查 `git status --short`，确认当前只有 `.DS_Store`、`docs/.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 噪音，不纳入阶段提交。
- [x] 定位旧 Agent 主循环 Watchdog、Teams auto-resume 逻辑，明确 Runner v2 已覆盖、未覆盖或需补测试的边界。
- [x] 在不默认开启 `agentRuntimeRunnerV2` 的前提下补齐 Watchdog 与 Teams auto-resume 等价证据；Runner v2 复用 `TeamsCoordinator` 并补聚焦测试。
- [!] 补跑可进入 human gate / patch-work / tester 的最小 Pipeline 真实 UI run；本轮 Electron 启动后立即退出，未建立 CDP，不能标记通过。
- [x] 检查 `~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json`；两者仍不存在，继续记录飞书阻塞，不伪造通过。
- [x] 更新 `docs/agent-refactor/development-checklist.md`、`docs/agent-refactor/baseline-runs/2026-05-18-stage-13.md`、`docs/agent-refactor/next-session-prompt.md` 和本文件 Review。
- [x] 运行 `bun run typecheck`、Agent / Runtime / Event Log / Renderer atoms 聚焦测试、Pipeline 聚焦测试、Electron 真实交互补跑和 `git diff --check`。
- [x] 阶段 13 本轮补证完成后单独提交，只包含阶段 13 相关文件，不纳入 `.DS_Store`、`improve/` 或无关改动：`b3d0517e fix(agent): 补强阶段13 Watchdog 与 Teams auto-resume 证据`。

## 2026-05-19 Agent 重构阶段 13：Watchdog / Pipeline 深水位补证 Review

- Runner v2 已补上 Watchdog / Teams auto-resume 等价回路：`InProcessAgentRuntimeRunner` 复用 `TeamsCoordinator`，捕获 `sdkSessionId` 后同步给 coordinator，Teams 活跃时延迟 result，resume 后再推送，并通过 legacy lifecycle 回调保持 `waiting_resume` / `resume_start` UI 副作用。
- 新增聚焦证据：Teams auto-resume 使用 summary fallback 在同一 SDK session 继续 query；Watchdog 检测 worker idle 后退出挂起 query 并收尾。
- 已通过 `bun run typecheck`。
- 已通过 Agent / Runtime / Event Log / Renderer atoms 聚焦测试：`bun test apps/electron/src/main/lib/agent-runtime-runner.test.ts apps/electron/src/main/lib/agent-orchestrator/teams-coordinator.test.ts apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts apps/electron/src/main/lib/agent-runtime-event-log.test.ts apps/electron/src/renderer/atoms/agent-atoms.test.ts packages/shared/src/agent/runtime-events.test.ts`（50 pass）。
- 已通过 Pipeline 聚焦测试：`bun test apps/electron/src/main/lib/pipeline-node-runner.test.ts apps/electron/src/main/lib/pipeline-human-gate-service.test.ts apps/electron/src/main/lib/pipeline-patch-work-service.test.ts apps/electron/src/main/lib/codex-pipeline-node-runner.test.ts`（81 pass）。
- 飞书配置仍阻塞：`~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json` 均不存在。
- Pipeline 真实 UI 深水位仍阻塞：`bunx electron . --remote-debugging-port=9334` 启动后立即退出，仅输出配置目录日志，`127.0.0.1:9334/json/version` 无法连接；未能进入 human gate / patch-work / tester，不能伪造通过。
- 已将 `@codeinsights/electron` 升到 `0.0.93` 并同步 `bun.lock`。

## 2026-05-18 Agent 重构阶段 12：真实交互补跑与 Runner v2 默认化准备计划

- [x] 复习 `tasks/lessons.md`、Agent 重构 README、development checklist、event contract、runtime manifest、阶段 0 baseline 和阶段 11 Review。
- [x] 检查当前工作树，确认 `.DS_Store` 与 `improve/` 为无关噪音，不纳入阶段提交。
- [x] 启动 Electron 桌面壳，确认可用 Agent 兼容渠道/API Key；若无法启动或缺少渠道，明确记录阻塞。
- [~] 补跑 Agent 发送、停止、同会话并发、旧 session resume；已补跑发送和 pending-stop，同会话并发/旧 session resume 未完整重跑。
- [x] 补跑权限 approve / deny、AskUser、Plan Mode 进入与退出。
- [!] 补跑附件、additional directory、fork、rewind；本轮未完整跑模型闭环，继续记录为后续缺口。
- [x] 补跑 materialized runtime 下 `rv_host` 只读 MCP 工具真实可见性。
- [!] 补跑 Skill / Plugin snapshot 在真实 Agent 对话中的可见性；本轮未单独证明 Skill / Plugin snapshot 被模型实际使用。
- [!] 补跑飞书入口和飞书群聊 MCP；本机缺少 `~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json`，明确阻塞，不伪造通过。
- [!] 补跑最小 Pipeline 真实运行，确认 Pipeline UI、human gate、patch-work 防护仍正常；本轮未启动新 Pipeline 真实任务，继续依赖聚焦测试。
- [x] 开启 feature flag 做对照评估：`agentRuntimeRunnerV2`、`agentRuntimePipelineRunnerV2`、`agentRuntimeChannelsV2` 是否具备默认开启条件。
- [x] 若发现 Runner v2 缺口，优先记录并补测试，不直接删除旧 Agent 主循环。
- [x] 更新 `docs/agent-refactor/baseline-runs/` 新一轮证据、`docs/agent-refactor/development-checklist.md` 和本文件 Review。
- [x] 运行 `bun run typecheck`、Agent / Runtime / Renderer / Pipeline 聚焦测试、`git diff --check`。
- [x] 阶段 12 验证通过后单独提交，不纳入 `.DS_Store`、`improve/` 或无关改动。

## 2026-05-18 Agent 重构阶段 12：真实交互补跑与 Runner v2 默认化准备 Review

- 已新增真实交互证据：`docs/agent-refactor/baseline-runs/2026-05-18-stage-12.md`。
- Electron 桌面壳通过 Vite + `bunx electron . --remote-debugging-port=9333` 启动成功，主进程 runtime init / IPC / workspace watcher 正常；通过 CDP 调用 preload API 补跑真实交互。
- 默认旧 Agent 主循环发送成功：`c098927b-114c-4f74-8c75-ee7f258b9a27` 写入 SDK JSONL 和 events JSONL，终态 `completed`。
- 权限 approve / deny 已补跑：`d16ec854-899d-4993-bca4-d78585d368bb` 批准写入成功，`6a317c0b-132e-4ed4-8686-9b9e2fd4fab0` 显式拒绝后 result `permission_denials` 非空。
- AskUser 已补跑：`14ace8a5-b218-435f-9be5-fcec8fe673f9` 触发 `AskUserQuestion`，pending askUsers 可恢复，回答后写入 resolved；后续触发 MCP 权限后已 stop 清理 pending。
- Plan Mode 已补跑：`674ab67a-c2ab-40c8-9e7a-8315e21e9489` 触发 `ExitPlanMode` pending 和 `plan_mode_entered`，已用 deny 清理并恢复 workspace permission mode 为 `auto`。
- materialized runtime 的 `rv_host` MCP 真实可见：权限队列中出现 `mcp__rv_host__codeinsights_list_workspace_files`，events JSONL 写入 `tool_started` / `permission_requested`。
- 发现并修复 pending-stop 缺口：旧主循环在 SDK iterator 因 stop 正常结束时未写 `run_stopped`；已在正常完成前检查 stopped session 并补写终态，同时避免 inactive session stop 留下 stale `stoppedBySessions`。
- 代码审查后追加修复 Runner v2 同类缺口：`runWithRuntimeRunnerV2()` 在 runner 正常结束后也会复验 active session，被 stop 时补写 `run_stopped` 并发送 `stoppedByUser` completion。
- 修复后真实复验：`2b0bc1d5-e914-4194-86ed-d4f473fc28d1` pending 权限 stop 后 events JSONL sequence 7 写入 `run_stopped(reason=user_abort, stoppedBy=user)`，pending 清空。
- Runner v2 真实最小发送通过：`03281fb6-648b-438b-8616-370a3a2140a8` 在 `CODEINSIGHTS_AGENT_RUNTIME_RUNNER_V2=1` 下完成，日志确认切到 `InProcessAgentRuntimeRunner`。
- 不默认开启 feature flag：`agentRuntimeRunnerV2` 缺少自动重试、Watchdog、Teams auto-resume、typed error 持久化等完整等价证据；Pipeline Runner v2 缺真实 Pipeline UI run；Channels v2 缺飞书配置。
- 飞书真实入口阻塞：`~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json` 均不存在，未伪造通过。
- 未完整补跑：附件、additional directory、fork、rewind、最小 Pipeline 真实 UI run、Skill / Plugin snapshot 实际模型使用；均已记录为后续缺口。
- 已将 `@codeinsights/electron` 升到 `0.0.89`；本轮 `bun.lock` 无 diff。
- 验证通过：`bun run typecheck`；`bun test apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts apps/electron/src/main/lib/agent-runtime-runner.test.ts apps/electron/src/main/lib/agent-runtime-event-log.test.ts apps/electron/src/renderer/atoms/agent-atoms.test.ts packages/shared/src/agent/runtime-events.test.ts`（37 pass）；`bun test apps/electron/src/main/lib/pipeline-node-runner.test.ts apps/electron/src/main/lib/pipeline-human-gate-service.test.ts apps/electron/src/main/lib/pipeline-patch-work-service.test.ts apps/electron/src/main/lib/codex-pipeline-node-runner.test.ts`（81 pass）；`git diff --check`。

## 2026-05-18 Agent 重构阶段 11：清理旧路径计划

- [x] 复习 `tasks/lessons.md`、Agent 重构 README、development checklist、event contract、runtime manifest 和阶段 0 基线。
- [x] 检查阶段 0 真实交互缺口，确认阶段 11 不能清理尚未人工补跑的发送、停止、权限、AskUser、Plan Mode、附件、additional directory、fork、rewind、MCP、飞书关键路径。
- [x] 梳理 Orchestrator / Pipeline / Renderer / shared runtime event 中 legacy reducer、重复 SDK env、重复 SDK query 包装的当前落点。
- [x] 清理已验证的重复 SDK env 导出与测试入口，确保 Orchestrator 与 Pipeline 统一使用 `agent-sdk-env.ts`。
- [x] 瘦身 Renderer legacy reducer/shadow compare 的重复转换逻辑，但保留旧 session、transcript/debug、副作用、pending permission、AskUser、Plan Mode 和回滚兼容路径。
- [x] 复核 shared runtime event adapter，确认本阶段不删除公共导出的旧 `AgentEvent` adapter，避免改变 `AgentStreamEnvelope` / `AgentRuntimeEvent` 公共契约与测试对照。
- [x] 保留 `agentRuntimeRunnerV2`、`agentRuntimePipelineRunnerV2`、`agentRuntimeChannelsV2` 默认关闭回滚点，不改变 Agent / Pipeline / 飞书 / Renderer UI 可见行为。
- [x] 补充或调整 Agent Runtime Runner / Event Log / Pipeline Node Runner / Renderer atoms 聚焦测试。
- [x] 更新 `docs/agent-refactor/development-checklist.md` 与本文件 Review。
- [x] 运行 `bun run typecheck`、Agent / Pipeline / Renderer 相关聚焦测试、`git diff --check`。
- [!] 尽量补跑阶段 0 核心真实交互；本轮未启动 Electron 桌面壳，缺少真实渠道/API 交互上下文，无法补跑发送、停止、权限 approve/deny、AskUser、Plan Mode、MCP、飞书和 Pipeline UI。
- [x] 阶段 11 验证通过后单独提交，不纳入 `.DS_Store`、`improve/` 或无关改动。

## 2026-05-18 Agent 重构阶段 11：清理旧路径 Review

- 已删除 `useGlobalAgentListeners.ts` 中硬编码 runtime envelope reducer 后不再可达的旧 reducer fallback；Renderer 流式 view model 继续由 `AgentStreamEnvelope` reducer 驱动。
- 已删除 Renderer 端 shadow compare 投影和 `console.debug` 差异输出，保留主进程 event log shadow compare 作为迁移诊断安全网。
- `payloadToLegacyEvents()` 仍保留为副作用适配层，用于文件自动定位、后台任务、权限/AskUser/ExitPlanMode 队列、Plan Mode、提示建议和通知；未清理尚未人工补跑的关键交互路径。
- `agent-orchestrator/sdk-environment.test.ts` 改为从统一 `agent-sdk-env.ts` 入口导入 `buildSdkEnv()` / `resolveSDKCliPath()`；Orchestrator 与 Pipeline 仍共用同一个 SDK env/CLI 解析实现。
- 未删除 Agent 主循环旧 `adapter.query()` 路径：该路径仍承载自动重试、Watchdog、Teams auto-resume、typed error 持久化和现有 UI `sdk_message` 推送。
- 未删除 Pipeline legacy adapter、shared `adaptAgentEventToRuntimeEvent()` 或旧 session transcript 兼容；这些仍是默认关闭 feature flag、测试对照或旧数据读取的回滚点。
- 已将 `@codeinsights/electron` 升到 `0.0.88`，并同步 `bun.lock`。
- 验证通过：`bun run typecheck`；`bun test apps/electron/src/renderer/atoms/agent-atoms.test.ts apps/electron/src/main/lib/agent-orchestrator/sdk-environment.test.ts packages/shared/src/agent/runtime-events.test.ts`；`bun test apps/electron/src/main/lib/agent-runtime-event-log.test.ts`。
- `bun test apps/electron/src/main/lib/agent-runtime-runner.test.ts apps/electron/src/main/lib/agent-runtime-event-log.test.ts apps/electron/src/main/lib/pipeline-node-runner.test.ts` 组合运行时复现既有 Bun/Electron named export 问题；同一批中 Pipeline Node Runner 与 Runtime Runner 测试先通过，event log 已单独通过。
- 人工验证缺口：本轮未启动 Electron 桌面壳补跑真实交互，因此阶段 0 的实时交互缺口继续保留。

## 2026-05-18 Agent 重构阶段 10：Pipeline 复用 Runner 计划

- [x] 复习 `tasks/lessons.md`、Agent 重构 README、development checklist、event contract、runtime manifest 和阶段 0 基线。
- [x] 检查当前工作树，确认 `.DS_Store`、`improve/` 与已有文档改动为无关噪音，不纳入阶段提交。
- [x] 梳理 `pipeline-node-runner.ts` 与 `agent-runtime-runner.ts` 的 SDK env / SDK query / event contract 重复边界。
- [x] 为 `AgentRuntimeRunInput` 增加 pipeline metadata，能区分 pipeline `nodeId`、pipeline session 和 run context，不破坏 Agent 路径。
- [x] 增加 `agentRuntimePipelineRunnerV2` feature flag，默认关闭，保留旧 `pipeline-node-runner.ts` 路径可快速回滚。
- [x] 迁移 Pipeline 节点的 SDK env / SDK query 重复逻辑到 Runner 复用路径。
- [x] 保留 Pipeline 独立状态管理、LangGraph checkpoint、human gate、结构化输出 schema、patch-work 写入防护和现有 UI 行为。
- [x] 不把 Pipeline 结构化输出强塞进通用 Agent UI；Pipeline 只消费自身节点结果。
- [x] 补充 Pipeline / Runner 聚焦测试，覆盖 metadata 透传、结构化输出解析、runtime 失败映射和 delta/message 去重。
- [!] 尽量人工跑一个最小 Pipeline；本轮未启动 Electron 桌面壳，缺少真实渠道/API 交互上下文，无法证明真实最小 Pipeline。
- [x] 更新 `docs/agent-refactor/development-checklist.md` 与本文件 Review，运行 `bun run typecheck`、聚焦测试、`git diff --check`，并单独提交阶段 10。

## 2026-05-18 Agent 重构阶段 10：Pipeline 复用 Runner Review

- 已为 `AgentRuntimeRunInput` 增加可选判别联合 metadata；Pipeline 传入 `origin: "pipeline"`、pipeline session、nodeId、nodeRunId、version 和 reviewIteration，Agent 路径不传 metadata。
- `ClaudePipelineNodeRunner` 新增 `agentRuntimePipelineRunnerV2` feature flag，默认关闭；开启后 Claude Pipeline 节点通过 `InProcessAgentRuntimeRunner` 执行 SDK query，关闭时仍走旧 adapter query 路径。
- `pipeline-node-runner.ts` 复用 `agent-sdk-env` 的 `buildSdkEnv()` / `resolveSDKCliPath()`，移除本地重复 SDK env / CLI path 实现。
- Pipeline 的 checkpoint、human gate、PipelineStreamEvent、结构化 schema、patch-work 文档写入、tester 证据保守判定和 v2 read-only 工具策略保持独立，未进入通用 Agent UI。
- 修复代码审查指出的 runtime delta 与完整 assistant message 重复合并风险；默认 Runner 延迟动态加载，只在 feature flag 开启路径创建。
- 已将 `@codeinsights/electron` 升到 `0.0.87`，并同步 `bun.lock`。
- 验证通过：`bun run typecheck`；`bun test apps/electron/src/main/lib/pipeline-node-runner.test.ts apps/electron/src/main/lib/agent-runtime-runner.test.ts`；`git diff --check`。
- 人工验证缺口：本轮未启动 Electron 桌面壳补跑真实最小 Pipeline；真实渠道/API 与 Pipeline UI 交互仍保留为后续可用环境验证项。

## 2026-05-18 Agent 重构阶段 9：External Channel Adapter 计划

- [x] 复习 `tasks/lessons.md`、Agent 重构 README、development checklist、event contract、runtime manifest 和阶段 0 基线。
- [x] 检查当前工作树，确认 `.DS_Store` 与 `improve/` 为无关噪音，不纳入阶段提交。
- [x] 梳理现有 `agent-service` / `agent-orchestrator` / `feishu-bridge` 入口，确认阶段 9 只新增 External Channel Adapter，不做 Pipeline 复用、不清理旧路径。
- [x] 新增 `AgentChannel` / channel adapter 抽象，入口统一消费 `AgentStreamEnvelope`，不直接解析 SDKMessage 内部结构。
- [x] 新增 Electron channel adapter，保持桌面 UI 当前 `AgentStreamEnvelope` 消费路径和可见行为不变。
- [x] 新增 Feishu channel adapter 或最小接入层，复用同一 runtime runner / event contract；飞书输出采用 assistant delta 节流、run completed 最终 Markdown 拼接、权限请求默认 queue_to_desktop。
- [x] 定义 channel session binding store，使用本地 JSON / JSONL，不引入数据库。
- [x] 支持 channel-scoped MCP overlay 作为 run overlay，不写入 workspace manifest。
- [x] 用 `agentRuntimeChannelsV2` feature flag 保留旧 Feishu bridge 回滚路径，客户端 UI 零可见变化。
- [x] 补充 channel adapter / binding store / Feishu adapter fixture 聚焦测试。
- [!] 尽量人工补跑 Electron Agent 发送与飞书入口；当前未启动 Electron 桌面壳，且本机不存在 `~/.codeinsights/feishu.json`，无法补跑真实飞书入口。
- [x] 更新 `docs/agent-refactor/development-checklist.md` 与本文件 Review，运行 `bun run typecheck`、聚焦测试、`git diff --check`，并单独提交阶段 9。

## 2026-05-18 Agent 重构阶段 9：External Channel Adapter Review

- 已新增 `agent-channel.ts`，定义 `AgentChannel`、`AgentChannelRunContext`、`agentRuntimeChannelsV2` feature flag 和 `ElectronAgentChannel`；桌面端仍发送原有 IPC payload，Renderer 消费路径、UI 布局、样式、文案和交互不变。
- 已新增 `agent-channel-binding-store.ts`，使用 `~/.codeinsights/agent-channel-bindings.json` 与 `agent-channel-bindings.events.jsonl` 保存 channel session binding 和审计事件，不引入数据库。
- 已新增 `feishu-channel-adapter.ts`，只消费 `AgentStreamEnvelope`：assistant delta 节流输出，`run_completed` 拼接最终 Markdown，`permission_requested` 默认 `queue_to_desktop`，不自动 approve、不默认 bypass。
- `feishu-bridge.ts` 保留旧 bridge 路径；只有 `CODEINSIGHTS_AGENT_RUNTIME_CHANNELS_V2=1` 时才切到 Feishu channel adapter。群聊 `feishu_chat` MCP 仍作为 `customMcpServers` run overlay 传入，不写 workspace manifest。
- 飞书绑定创建、切换、设置页更新、加载与移除会同步写入 channel binding store；旧 `feishu-bindings-{botId}.json` 仍保留给现有 UI 和回滚路径。
- 已将 `@codeinsights/electron` 升到 `0.0.86`，并同步 `bun.lock`。
- 验证通过：`bun run typecheck`；`bun test apps/electron/src/main/lib/agent-channel-binding-store.test.ts apps/electron/src/main/lib/feishu-channel-adapter.test.ts apps/electron/src/main/lib/agent-runtime-runner.test.ts`；`git diff --check`。
- 人工验证缺口：本轮未启动 Electron 桌面壳补跑真实 Agent 发送；本机不存在 `~/.codeinsights/feishu.json`，无法补跑真实飞书入口和权限 pending。未伪造通过，继续记录为后续可用环境验证项。

## 2026-05-18 Agent 重构阶段 8：Renderer 切新 Reducer 计划

- [x] 复习 `tasks/lessons.md`、Agent 重构 README、development checklist、event contract、runtime manifest 和阶段 0 基线。
- [x] 检查当前工作树，确认 `.DS_Store` 与 `improve/` 为无关噪音，`development-checklist.md` / `next-session-prompt.md` / `tasks/todo.md` 已有阶段 7 状态同步改动。
- [x] 梳理 `useGlobalAgentListeners` 与 `agent-atoms.ts` 的旧 `AgentEvent` 应用路径，确认阶段 8 只切 Renderer reducer/event source，不改 UI 组件、布局、样式、文案或交互。
- [x] 新增或补强 `AgentStreamEnvelope` 到 Renderer view model 的 reducer/helper，保持 `SDKMessageRenderer` transcript/debug 兼容路径。
- [x] 在 `useGlobalAgentListeners` 中接入受 feature flag 控制的新 envelope 应用路径，旧 payload / 旧 session / 旧 SDKMessage JSONL 继续兼容。
- [x] 恢复 pending permission、AskUser 与 plan mode 状态时优先使用 event log/envelope，可用旧数据源兜底。
- [x] 保留短期 shadow compare，新旧 view model 差异只写开发日志，不在 UI 展示。
- [x] 补充 event replay / Renderer view model 对比聚焦测试，覆盖 assistant text、tool timeline、pending permission、AskUser、plan mode、usage、running/terminal status。
- [ ] 尽量补跑阶段 0 关键真实交互：发送、停止、权限 approve/deny、AskUser、Plan Mode、旧 session resume；无法补跑时记录原因。
- [x] 更新 `docs/agent-refactor/development-checklist.md` 与本文件 Review，运行 `bun run typecheck`、聚焦测试、`git diff --check`，并单独提交阶段 8。

## 2026-05-18 Agent 重构阶段 8：Renderer 切新 Reducer Review

- 已在 `agent-atoms.ts` 新增 runtime envelope reducer helper，继续输出原有 `AgentStreamState`，因此 Agent UI 组件、布局、样式、文案和按钮行为不变。
- `useGlobalAgentListeners` 现在优先把 stream payload 适配为 `AgentStreamEnvelope` 并应用新 reducer；旧 `payloadToLegacyEvents()` 保留给副作用、transcript/debug 兼容和回滚。
- `AgentRuntimeReplayState` 现在保留原始 permission / AskUser / ExitPlanMode request，可从 event log/envelope 恢复 pending 横幅状态；Plan Mode active 状态也进入 replay。
- 短期 shadow compare 仅写 `console.debug`，不在 UI 展示。
- 已将 `@codeinsights/shared` 升到 `0.1.40`，`@codeinsights/electron` 升到 `0.0.85`，并同步 `bun.lock`。
- 验证通过：`bun run typecheck`；`bun test packages/shared/src/agent/runtime-events.test.ts apps/electron/src/renderer/atoms/agent-atoms.test.ts`；`git diff --check`。
- 本轮未启动 Electron 桌面壳补跑真实交互，因此发送、停止、权限 approve/deny、AskUser、Plan Mode、旧 session resume 仍按阶段 0 缺口继续保留。

下一次开发应从阶段 9 开始：External Channel Adapter。阶段 8 已让 Renderer 主路径优先消费 runtime envelope，旧 transcript/debug 兼容路径继续保留。继续保持客户端 UI 零可见变化，默认不切换 Agent 对话可见行为。

## 2026-05-18 Agent 重构阶段 7：内置 MCP Bridge 计划

- [x] 复习 `tasks/lessons.md`、Agent 重构 README、development checklist、event contract、runtime manifest 和阶段 0 基线。
- [x] 检查现有 runtime manifest registry / materializer / orchestrator 接入点，确认阶段 7 只新增 host bridge 能力，不切 Renderer、不默认启用 Runner v2。
- [x] 新增 `agent-host-mcp-server.ts`，定义内置 host bridge tool manifest 与保守 tool handler 边界。
- [x] 实现 `codeinsights_workspace_search`、`codeinsights_list_workspace_files`、`codeinsights_open_file`，限定 workspace/session/additional directory 可读范围，避免越权路径访问。
- [x] 实现 `codeinsights_memory_search`、`codeinsights_memory_append`，复用现有 memory service 或本地 JSON 存储能力，写入行为保持可审计。
- [x] 实现 `codeinsights_send_channel_message`、`codeinsights_schedule_task` 的保守默认策略，缺少真实外部渠道/调度器时返回明确不可用结果，不默认绕过权限或伪造发送。
- [x] 将 host bridge 能力写入 runtime manifest / materializer，并暴露为 materialized workspace runtime 的 MCP server 配置。
- [x] 补充 host MCP bridge / tool handlers 聚焦测试，覆盖路径安全、只读搜索、memory append、不可用 channel/task 行为和 manifest/materializer 输出。
- [x] 更新 `docs/agent-refactor/development-checklist.md` 与本文件 Review，运行 `bun run typecheck`、聚焦测试、`git diff --check`，并单独提交阶段 7。

## 2026-05-18 Agent 重构阶段 7：内置 MCP Bridge Review

- 已新增 `apps/electron/src/main/lib/agent-host-mcp-server.ts`，实现 `rv_host` in-process MCP server，以及 `codeinsights_workspace_search`、`codeinsights_list_workspace_files`、`codeinsights_memory_search`、`codeinsights_open_file`、`codeinsights_memory_append`、`codeinsights_send_channel_message`、`codeinsights_schedule_task` handlers；默认 hostBridge 只注册只读工具。
- 文件类工具只读取 manifest 允许的 session cwd、workspace-files 和 additional directory，拒绝范围外路径、符号链接逃逸、非文本文件和过大文件。
- 记忆工具复用 `getMemoryConfig()`、`searchMemory()`、`addMemory()`、`formatSearchResult()`；未启用记忆或缺少 API Key 时返回明确错误。
- channel 发送与任务调度工具默认保守返回不可用，只有未来显式注入 adapter 后才执行 side effect，且不在默认 hostBridge 工具清单中注册；没有默认 bypass 权限。
- `agent-runtime-manifest-registry.ts` 现在用只读默认工具列表生成 manifest，记录 `version` / `configHash`，并把 `hostBridge` 纳入 source/runtime hash；`agent-runtime-materializer.ts` 写入 `runtime/.claude/codeinsights-host-bridge.json` 作为运行时审计元数据，恢复已物化 session 时会校验该产物未被篡改。
- `agent-orchestrator.ts` 仅对 materialized session 注入 `rv_host` MCP server；event log / Runner v2 会记录同一个 manifest `runtimeHash`，并拒绝外部 `customMcpServers` 覆盖内置 `rv_host`。旧 session、Renderer、布局、文案、交互路径和 `agentRuntimeRunnerV2` 默认关闭状态均未改变。
- 已将 `@codeinsights/electron` 升到 `0.0.84`、`@codeinsights/shared` 升到 `0.1.39`，并同步 `bun.lock`。
- 验证通过：`bun run typecheck`；`bun test apps/electron/src/main/lib/agent-host-mcp-server.test.ts apps/electron/src/main/lib/agent-runtime-manifest-registry.test.ts apps/electron/src/main/lib/agent-runtime-materializer.test.ts`；`git diff --check`。
- 本轮未启动 Electron 桌面壳或真实 Claude Code MCP 会话，因此真实 MCP 可见性、只读工具/side effect 工具的人工调用和权限 UI 仍记录为后续补跑缺口。

## 2026-05-18 Agent 重构阶段 6：插件系统原生化计划

- [x] 复习 `tasks/lessons.md`、Agent 重构文档、事件契约、runtime manifest 设计和阶段 0 基线。
- [x] 检查当前工作树，确认 `.DS_Store` 与 `improve/` 为无关噪音，不纳入阶段提交。
- [x] 梳理阶段 4/5 manifest registry 与 materializer 中现有 plugin 读取、snapshot、hash 边界，确认阶段 6 不改变 Renderer、不默认启用 Runner v2。
- [x] 新增 plugin catalog 类型与 enabled plugin refs 配置，支持 workspace 本地 Claude Code plugin 引用。
- [x] 实现 plugin snapshot materializer，记录 plugin source path、snapshot path、hash，snapshot 失败时阻断而不是 fallback 到用户全局 plugin。
- [x] 建立 plugin command 索引，区分 DMI slash command 与非 DMI plugin command。
- [x] 实现 DMI slash command 应用层展开能力；非 DMI command 保留给 SDK 原生处理。
- [x] 补充 plugin catalog / materializer / snapshot / command index 聚焦测试，并记录人工启用/禁用本地 plugin 或未补跑原因。
- [x] 更新 `docs/agent-refactor/development-checklist.md` 与本文件 Review，运行验证并单独提交阶段 6。

## 2026-05-18 Agent 重构阶段 6：插件系统原生化 Review

- 已新增 `packages/shared/src/agent/runtime-manifest.ts` 的插件扩展字段：`AgentPluginCatalogEntry`、`AgentPluginEnabledRef`、`AgentPluginCommandIndexEntry`，以及增强后的 `AgentRuntimeManifestPlugin`。
- 已新增 `apps/electron/src/main/lib/agent-plugin-catalog.ts` 与聚焦测试，支持从 `config.json` 读取 plugin catalog / enabled refs，导入本地 Claude Code plugin，生成 runtime snapshot，记录 source path / snapshot path / hash，并建立 command index。
- DMI slash command 现在在应用层展开，非 DMI command 保留给 SDK；插件 snapshot 失败会直接阻断，不会 fallback 到用户全局 plugin 目录。
- `agent-runtime-manifest-registry.ts` 现在把 plugin snapshot 作为 manifest 的一部分输出，`agent-runtime-materializer.ts` 负责落盘 runtime plugin snapshot 与 `enabledPlugins` settings。
- `agent-orchestrator.ts` 在已有 runtime manifest 的 session 下复用 materialized runtime；新 session 无 manifest 时先物化，再将 `queryOptions.plugins` 指向 RV snapshot，旧 session 继续走原 workspace plugin 路径，Renderer 和默认 Runner 路径没有变化。
- 代码审查后修复了两个关键风险：新 session runtime 分支判定反向、DMI slash command 展开读取 source 而不是 snapshot；并补充 snapshot 优先读取与 `config.json` symlink 防护测试。
- `@codeinsights/shared` 已升到 `0.1.38`，`@codeinsights/electron` 已升到 `0.0.83`，并同步 `bun.lock`。
- 验证通过：`bun run typecheck`；`bun test apps/electron/src/main/lib/agent-plugin-catalog.test.ts apps/electron/src/main/lib/agent-runtime-manifest-registry.test.ts apps/electron/src/main/lib/agent-runtime-materializer.test.ts apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts`；`git diff --check`。
- 人工启用/禁用本地 plugin 已通过聚焦测试覆盖；当前环境未单独跑 Electron 桌面壳，故真实桌面交互未补跑，已记录为后续缺口。

## 2026-05-18 Agent 重构阶段 5：Runtime Materializer for New Sessions 计划

- [x] 复习 `tasks/lessons.md`、Agent 重构文档、事件契约、runtime manifest 设计和阶段 0 基线。
- [x] 检查当前工作树，确认 `.DS_Store` 与 `improve/` 为无关噪音，不纳入阶段提交。
- [x] 新增 Runtime Materializer，基于阶段 4 manifest 只对新建 session 物化 `runtime/` 与 `sessions/{session-id}/cwd`。
- [x] 写入 `runtime/.claude/settings.json`、`runtime/mcp.json`、`runtime/CLAUDE.md`、Skill snapshot、plugin snapshot 和 session `runtime-manifest.json`。
- [x] 实现 settings 白名单合并：只管理允许 key，白名单 key 冲突时写 `.codeinsights-conflicts.json` 并阻断 run。
- [x] 在 session 创建与 Orchestrator cwd 选择处接入：存在 session runtime manifest 的新 session 使用 `sessions/{id}/cwd`，旧 session 保持旧 cwd / resume 行为。
- [x] 补充 materializer / manifest write / settings conflict / path safety / 旧 session cwd 兼容聚焦测试。
- [x] 更新 `docs/agent-refactor/development-checklist.md` 与本文件 Review，运行验证并单独提交阶段 5。

## 2026-05-18 Agent 重构阶段 5：Runtime Materializer for New Sessions Review

- 已新增 `agent-runtime-materializer.ts`，负责新 session runtime 物化：`runtime/.claude/settings.json`、`runtime/mcp.json`、`runtime/CLAUDE.md`、`runtime/.claude/skills/*`、`runtime/.claude/plugins/*`、`sessions/{session-id}/cwd/.context` 和 `sessions/{session-id}/runtime-manifest.json`。
- `createAgentSession()` 现在会在写入 session index 前 materialize runtime；如果 settings 冲突或路径不安全，创建会话会失败，不留下 session metadata。
- Orchestrator 运行时只在发现 `sessions/{session-id}/runtime-manifest.json` 时切到 `sessions/{session-id}/cwd`；旧 session 没有 manifest，继续使用旧 `agent-workspaces/{slug}/{sessionId}` cwd 和原 resume 逻辑。
- settings 合并只管理白名单字段；冲突会写入 `runtime/.claude/.codeinsights-conflicts.json` 并通过 preflight error 阻断 run。
- materialized runtime 判定会校验 manifest 普通文件、sessionId、workspaceSlug、sessionCwd 和 manifest path，避免旧 session 被残留文件误切到新 cwd。
- materializer 同时写入 runtime settings 与实际 SDK project settings；Orchestrator 对 materialized session 跳过旧 settings 写入 block，避免绕过冲突检查。
- 路径安全覆盖 runtime 写入目标 symlink 拒绝，Skill / plugin snapshot 均保持在 workspace root 内；fork 复制源 cwd 时会递归跳过任意层级 symlink；additional directories 仍只记录引用，不复制。
- 本阶段没有改 Renderer、UI 样式、文案、入口或交互路径；没有默认启用 Runner v2。
- 已将 `@codeinsights/shared` 升到 `0.1.37`，`@codeinsights/electron` 升到 `0.0.82`，并同步 `bun.lock`。
- 代码审查发现并已修复：manifest 存在性误判、session cwd project settings 覆盖风险、fork 源 cwd symlink 递归复制风险，并补充对应回归测试。
- 验证通过：`bun test apps/electron/src/main/lib/agent-runtime-materializer.test.ts apps/electron/src/main/lib/agent-runtime-manifest-registry.test.ts apps/electron/src/main/lib/agent-session-manager-copy.test.ts`；`bun run typecheck`；`git diff --check`。
- 本轮未启动 Electron 桌面壳补跑真实新/旧 session；旧 session cwd / resume 兼容以路径 fixture 覆盖，并在开发清单中记录为真实交互缺口。

## 2026-05-18 Agent 重构阶段 4：Runtime Manifest 只读解析计划

- [x] 复习 `tasks/lessons.md`、Agent 重构阶段文档、事件契约、runtime manifest 设计和阶段 0 基线。
- [x] 梳理现有 workspace 路径、MCP、skills、plugin manifest、attached directories 读取边界，确认只读解析不改变 cwd / UI / 运行路径。
- [x] 新增 Runtime Manifest 类型与只读 feature flag，默认关闭运行时切换。
- [x] 新增 Workspace Runtime Registry，只从旧 workspace 配置生成 manifest 快照、source hash、runtimeHash 和能力列表，不物化 runtime 目录。
- [x] 加固路径安全：已存在路径段拒绝 symlink，manifest 内部路径必须保持在 workspace root 内，additional directories 只保存引用。
- [x] 补充单元测试，覆盖旧 mcp.json、skills、plugin manifest、attached directories、缺失配置、hash 稳定性和 symlink traversal 拒绝。
- [x] 更新 `docs/agent-refactor/development-checklist.md` 与本文件 Review，运行验证并单独提交阶段 4。

## 2026-05-18 Agent 重构阶段 4：Runtime Manifest 只读解析 Review

- 已新增 `packages/shared/src/agent/runtime-manifest.ts`，定义 `AgentRuntimeManifest`、MCP / Skill / Plugin / additional directory manifest 类型，以及默认关闭的 `agentRuntimeManifestV1` feature flag。
- 已新增 `apps/electron/src/main/lib/agent-runtime-manifest-registry.ts`，只读解析旧 workspace 的 `mcp.json`、`skills/`、`skills-inactive/`、`.claude-plugin/plugin.json` 和 `config.json.attachedDirectories`，生成 source hash / runtime hash / 能力快照。
- `skills-inactive/` 只参与 source hash，不进入 `enabledSkills`；additional directories 只保存引用，不复制、不物化。
- 路径安全已覆盖 workspace 内路径边界、workspace slug traversal、plugin name traversal、已存在路径段 symlink 拒绝、realpath 复验、入口文件 symlink、nested Skill symlink 和 `skills-inactive` symlink fixture。
- 本阶段未创建 runtime 目录、未写 manifest 文件、未改变 cwd / Runner / Orchestrator / Renderer；客户端 UI 零可见变化。
- 已将 `@codeinsights/shared` 升到 `0.1.36`，`@codeinsights/electron` 升到 `0.0.81`，并同步 `bun.lock`。
- 代码审查发现并已修复 shared barrel 顶层 `process`、workspace slug traversal 和 plugin snapshot path 风险。
- 验证通过：`bun run typecheck`；`bun test apps/electron/src/main/lib/agent-runtime-manifest-registry.test.ts`（9 pass）；`git diff --check`。
- 当前未启动 Electron 桌面壳人工打开旧 workspace / old session；阶段 4 只读 registry 未接入运行路径，该真实交互仍作为后续补跑缺口记录。

## 2026-05-18 Agent 重构阶段 3：In-process AgentRuntimeRunner 下一步计划

- [x] 先复习 `tasks/lessons.md`、`docs/agent-refactor/development-checklist.md`、`event-contract.md` 和阶段 0 基线。
- [x] 新增 `agent-runtime-types.ts`，定义 Runner 输入、输出、store interface、权限/AskUser callback。
- [x] 新增 `agent-runtime-runner.ts`，把 SDK query 封装为进程内 Runner，输出 `AsyncIterable<AgentStreamEnvelope>`。
- [x] 新增 `agent-sdk-env.ts` 与 `agent-sdk-message-converter.ts`，迁移 env 构建和 SDKMessage 转换边界。
- [x] 用 `agentRuntimeRunnerV2` feature flag 接入 Orchestrator，保留旧 SDK query 路径作为回滚。
- [x] 补充 Runner mock SDK stream 测试，覆盖发送、停止、resume、权限、AskUser、错误终态。
- [x] 保持 Renderer 旧路径和客户端 UI 零可见变化。
- [x] 完成后更新 `docs/agent-refactor/development-checklist.md` 和本文件 Review，并单独提交阶段 3。

## 2026-05-18 Agent 重构阶段 3：In-process AgentRuntimeRunner Review

- 已新增 `apps/electron/src/main/lib/agent-runtime-types.ts`，定义 `AgentRuntimeRunInput`、`AgentRuntimeRunner`、SDKMessage store interface、权限/AskUser callback，以及默认关闭的 `agentRuntimeRunnerV2` feature flag。
- 已新增 `agent-runtime-runner.ts`，进程内 Runner 负责调用注入的 SDK query、遍历 stream、输出 `AsyncIterable<AgentStreamEnvelope>`、通过 store interface 持久化 SDKMessage，不直接写 IPC 或 Renderer。
- 已新增 `agent-sdk-message-converter.ts`，集中把 SDKMessage 转换为 runtime envelope；已新增 `agent-sdk-env.ts`，把 SDK env / binary 解析边界从 Orchestrator 调整到稳定入口，同时保留旧子模块实现。
- Orchestrator 已在 `queryOptions` 构造后接入 Runner v2 分支；`agentRuntimeRunnerV2` 默认关闭，旧 SDK query / retry / Watchdog / Teams / Renderer 流式路径继续作为默认运行路径和回滚路径。
- Runner mock SDK stream 测试覆盖发送、停止、resume、权限、AskUser 和错误终态。
- 本阶段未修改 Renderer、UI 样式、文案、入口或交互路径；客户端 UI 零可见变化。
- `@codeinsights/electron` patch 版本从 `0.0.79` 提升到 `0.0.80`，并同步 `bun.lock`。
- 验证通过：`bun run typecheck`；`bun test apps/electron/src/main/lib/agent-runtime-runner.test.ts`；`bun test packages/shared/src/agent/runtime-events.test.ts apps/electron/src/main/lib/agent-runtime-runner.test.ts apps/electron/src/main/lib/agent-runtime-event-log.test.ts apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts`。
- 当前未启动 Electron 桌面壳补跑真实 UI 交互；阶段 3 行为由 Runner mock 和 Orchestrator 既有 completion-signal 测试覆盖，阶段 0 的真实交互缺口仍保留。

## 2026-05-18 Agent 重构阶段 2：Event Log 双写计划

- [x] 复习阶段 0/1 文档与现有 Agent Orchestrator、会话持久化、权限和 AskUser 路径，确认 UI 零可见变化边界。
- [x] 在会话持久化层新增 `{session-id}.events.jsonl` 旁路读写能力，原 SDKMessage JSONL 保持不变。
- [x] 新增 Agent runtime event log writer，负责 runId、per-run sequence、终态去重、schema 校验和开发日志。
- [x] 在旧 Agent 运行路径中双写 `AgentStreamEnvelope`：`run_started`、`sdk_session`、assistant/tool、usage、终态事件。
- [x] 在权限与 AskUser 生命周期中记录 requested/resolved，不改变现有 pending queue 与 UI 行为。
- [x] 新增新旧 reducer shadow compare 的开发日志打桩，保证差异只进主进程日志、不显示到 Renderer。
- [x] 补充 event log / replay 聚焦测试，覆盖终态去重、sequence、权限和 AskUser。
- [x] 更新 `docs/agent-refactor/development-checklist.md` 与本文件 Review，运行验证并单独提交阶段 2。

## 2026-05-18 Agent 重构阶段 2：Event Log 双写 Review

- 已新增 `apps/electron/src/main/lib/agent-runtime-event-log.ts`，在旧 Orchestrator 旁边写入 `{session-id}.events.jsonl`，原 SDKMessage `{session-id}.jsonl` 继续保留。
- 每次 run 生成独立 `runId`，同一 run 内 `sequence` 单调递增，并对 `run_completed` / `run_failed` / `run_stopped` 做终态去重。
- 已双写 `run_started`、`sdk_session`、assistant/tool、`usage_updated`、终态事件；权限和 AskUser 的 requested/resolved 已进入 events JSONL。
- shadow compare 当前只写主进程开发日志，检测 sequence 缺口和 replay 终态差异，不向 Renderer 暴露任何调试状态。
- 本阶段未修改 Renderer、UI 样式、文案、入口或交互路径；`STREAM_EVENT` 旧 payload 继续按原路径送到 UI。
- 已将 `@codeinsights/shared` 升到 `0.1.35`，`@codeinsights/electron` 升到 `0.0.79`，并同步 `bun.lock`。
- 验证通过：`bun run typecheck`；`bun test packages/shared/src/agent/runtime-events.test.ts apps/electron/src/main/lib/agent-runtime-event-log.test.ts apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts`；`git diff --check`。
- 全量 `bun test` 仍在 412 pass 后复现既有 Electron named export 问题：`Export named 'BrowserWindow' not found in module .../electron/index.js`；本阶段相关聚焦测试单独运行通过。
- 本轮未启动 Electron 桌面壳做阶段 0 真实交互补跑；发送/停止通过 Orchestrator 测试覆盖，权限/AskUser 通过 event log 单测覆盖，真实 UI 交互仍作为后续缺口记录。

## 2026-05-18 Agent 重构阶段 1：Shared Event Contract 计划

- [x] 复习阶段 0 基线、事件契约和开发清单，确认本阶段只新增 shared event contract，不改变 Agent 运行行为。
- [x] 在 `packages/shared/src/agent/` 新增 `AgentStreamEnvelope`、`AgentRuntimeEvent`、`AgentRuntimeErrorPayload`、`AgentEventSource` 类型。
- [x] 新增事件 schema guard / validator，覆盖 envelope 基础字段、事件 union 和终态互斥所需的单事件校验。
- [x] 新增旧 `AgentEvent` / `AgentStreamPayload` 到新 envelope 的 adapter，保留旧类型和旧 IPC 默认行为。
- [x] 新增 SDKMessage fixture 与 AgentStreamEnvelope fixture，覆盖 text、tool、permission、AskUser、usage、complete、error。
- [x] 新增 event replay reducer 测试骨架，先验证 sequence 幂等、文本累计、工具状态、pending interaction、usage 和 terminal status 的基础行为。
- [x] 引入 `agentRuntimeEventsV2` feature flag，默认 off，仅作为后续阶段回滚开关。
- [x] 更新 `docs/agent-refactor/development-checklist.md` 阶段 1 状态与验证记录。
- [x] 运行 `bun run typecheck`、`bun test` shared event fixture、`git diff --check`。
- [x] 追加 Review，并单独提交阶段 1 成果。

## 2026-05-18 Agent 重构阶段 1：Shared Event Contract Review

- 已在 `packages/shared/src/agent/runtime-events.ts` 新增 `AgentStreamEnvelope`、`AgentRuntimeEvent`、`AgentRuntimeErrorPayload`、`AgentEventSource`、默认关闭的 `agentRuntimeEventsV2` feature flag。
- 已新增 envelope 创建、schema guard / validator、终态识别、旧 `AgentEvent` / `AgentStreamPayload` / `SDKMessage` 到 runtime event 的 adapter，以及只用于测试和后续 reducer 对齐的 replay reducer 骨架。
- 已新增 `packages/shared/src/agent/runtime-events.test.ts`，fixture 覆盖 text、tool、permission、AskUser、usage、complete、error，并验证 sequence 幂等回放。
- 已通过 `packages/shared/src/agent/index.ts` 和 package root 导出新契约，同时保留旧 `AgentEvent`、旧 `AgentStreamPayload`、旧 renderer reducer 和 IPC 默认行为。
- 已将 `@codeinsights/shared` patch 版本从 `0.1.33` 提升到 `0.1.34`，同步更新 `bun.lock`。
- 本阶段没有修改 `apps/electron` 运行路径、Renderer UI、布局、样式、文案、入口、按钮行为或交互路径。
- 验证通过：`bun run typecheck`；`bun test packages/shared/src/agent/runtime-events.test.ts`；`bun test packages/shared/src/agent/runtime-events.test.ts packages/shared/src/utils/pipeline-state.test.ts packages/shared/src/utils/capabilities-diff.test.ts`；`bun test apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts`；`git diff --check`。
- 全量 `bun test` 曾在 412 pass 后出现一次 test runner / Electron named export 问题：`Export named 'BrowserWindow' not found in module .../electron/index.js`；单独重跑该失败文件通过，本阶段 shared contract 改动未触碰该路径。

## 2026-05-17 Agent 重构阶段 0：冻结基线计划

- [x] 复习 `tasks/lessons.md`，确认阶段推进、UI 零可见变化和阶段完成即提交纪律。
- [x] 阅读 `docs/agent-refactor/README.md`、`development-checklist.md`、`next-session-prompt.md` 和 `baseline-checklist.md`。
- [x] 检查本机 Agent 开发配置目录与现有 session / workspace / channel 基线，不读取或记录敏感密钥。
- [x] 创建 `docs/agent-refactor/baseline-runs/` 文本证据目录。
- [x] 按行为基线清单生成首轮基线记录，逐项写明输入、预期 UI、预期存储、预期终态和本轮实跑状态。
- [x] 固化当前 SDKMessage JSONL、权限、AskUser / Plan Mode、MCP / Skill、旧 session resume / fork / rewind、飞书入口和 Pipeline 旁路的文本证据。
- [x] 更新 `docs/agent-refactor/development-checklist.md` 的阶段 0 状态。
- [x] 运行 `bun run typecheck` 和 `git diff --check -- docs/agent-refactor tasks/todo.md`。
- [x] 追加 Review，并用详细中文 commit message 单独提交阶段 0 文档成果。

## 2026-05-17 Agent 重构阶段 0：冻结基线 Review

- 已新增 `docs/agent-refactor/baseline-runs/` 文本证据目录，并写入目录说明和首轮基线记录 `2026-05-17-round-1.md`。
- 首轮基线记录覆盖 `baseline-checklist.md` 中 17 个场景，每项都写明输入、预期 UI、预期存储、预期终态和本轮实跑状态。
- 已确认本机开发配置目录为 `~/.codeinsights-dev/`，当前有 1 个 DeepSeek Agent 渠道、1 个默认 workspace、4 条 Agent session metadata、3 个 SDKMessage JSONL transcript。
- 已用存量 JSONL 固化首条消息、错误恢复样例、WebSearch tool activity、result 终态和旧 session 多轮 resume 行为；未记录 API Key、加密密文或完整大段模型输出。
- 当前环境缺少实时 Electron 桌面交互、workspace MCP server、飞书配置和若干权限/AskUser 样例；这些场景没有伪造通过，已作为后续触碰相关边界前必须补跑的缺口记录。
- 已更新 `docs/agent-refactor/development-checklist.md`，标记阶段 0 首轮文本证据完成，并把下一步推进到阶段 1 Shared Event Contract。
- 本轮没有修改 `apps/`、`packages/`、README 或 AGENTS；客户端 UI 零可见变化。
- 验证通过：`bun run typecheck`；`git diff --check -- docs/agent-refactor tasks/todo.md`。

## 2026-05-17 Agent 模式 happyclaw 参考重构方案

- [x] 复习项目 `tasks/lessons.md`，确认本次只生成重构方案文档，不直接改业务代码。
- [x] 梳理 CodeInsights 当前 Agent 主链路：IPC、AgentOrchestrator、会话 JSONL、Jotai 全局监听和 UI 展示。
- [x] 梳理 happyclaw 核心理念：复用 Claude Code CLI 运行时、多渠道路由、容器/宿主机运行时、工作区配置、MCP/Skill/插件。
- [x] 在 `docs/agent-refactor/` 下生成重构方案 Markdown，覆盖目标架构、模块边界、迁移阶段、数据模型、验证策略和风险。
- [x] 追加 Review，记录文档范围、依据与残余问题。

## 2026-05-17 Agent 模式 happyclaw 参考重构方案 Review

- 已新增 `docs/agent-refactor/README.md`、`current-state-and-gap.md`、`target-architecture.md`、`migration-plan.md`，形成总览、现状差距、目标架构和阶段迁移路线。
- 方案明确吸收 happyclaw 的核心原则：Claude Code 原生优先、Runner 边界、shared event contract、runtime materialization、内置 MCP bridge；同时明确不照搬 SaaS 认证/RBAC/计费、IM-first 路由、Docker 默认隔离、SQLite 后台。
- 文档依据包括 CodeInsights 的 `AgentView`、preload、agent IPC、`agent-service`、`agent-orchestrator`、`ClaudeAgentAdapter`、`agent-session-manager`、`useGlobalAgentListeners`、`agent-atoms`，以及 happyclaw 的 README、`container-runner`、`container/agent-runner`、`im-channel`、`plugin-utils`、`mcp-tools` 等。
- 本轮未修改业务代码、README 或 AGENTS；仅新增方案文档并更新任务记录。
- 验证通过：`git diff --check -- docs/agent-refactor tasks/todo.md`。
- 残余问题：方案尚未进入实现拆分，后续正式编码前需要按阶段确认是否先做 shared event contract，避免一次性大改 AgentOrchestrator 和 Renderer。

## 2026-05-17 Agent 模式重构方案深化计划

- [x] 复核 `tasks/lessons.md` 与现有 `docs/agent-refactor/` 文档，确认本轮继续只做方案文档优化。
- [x] 补充总览文档，明确 happyclaw 理念到 CodeInsights 的取舍、最终交付物和阅读路径。
- [x] 细化现状差距，按模块标注当前职责、问题症状、重构去向和保留边界。
- [x] 细化目标架构，补齐事件契约、Runner 输入输出、runtime 目录、权限、MCP bridge、外部渠道和 Pipeline 复用细节。
- [x] 细化迁移路线，补齐每阶段文件范围、测试策略、回滚点、完成定义和风险缓解。
- [x] 运行 Markdown 差异检查，在本节追加 Review。

## 2026-05-17 Agent 模式重构方案深化 Review

- 已将 `docs/agent-refactor/` 从方向性方案补成可执行规格：总览补了阅读路径、最终交付物和取舍规则；现状差距补了职责拆分、待迁移模块和当前行为基线；目标架构补了 `AgentRuntimeService`、`AgentRuntimeRunner`、`AgentRuntimeManifest`、事件契约、权限生命周期、MCP bridge 和 Pipeline 复用边界；迁移路线补了 feature flag、文件范围、fixture 类型、兼容规则、回滚点和双写总规则。
- 本轮重点吸收了 happyclaw 的原则，但把 CodeInsights 必须保留的本地优先、文件存储、保守权限和 Electron UI 体验边界明确写死，避免后续实现时误把 SaaS / IM-first / Docker-first 模型搬进来。
- 另外把几个最容易在实现期卡住的地方提前定死：`sequence` / `runId` 语义、终态单一来源、旧 session 兼容策略、settings 合并白名单、技能物化模式、外部渠道权限默认策略和新旧 reducer 的对比口径。
- 本轮仍未改业务代码、README 或 AGENTS；只更新了方案文档和任务记录。
- 验证通过：`git diff --check -- docs/agent-refactor tasks/todo.md`。
- 后续若进入实现，建议先落 shared event contract，再做进程内 Runner 和 runtime manifest，避免一次性触碰 Orchestrator、Renderer 和工作区目录三条主线。

## 2026-05-17 Agent 模式重构方案二次优化计划

- [x] 复核上轮建议，确认本轮只继续优化方案文档，不改业务代码。
- [x] 新增 baseline checklist、event contract、runtime manifest、implementation PR 指南四份补充文档。
- [x] 在迁移路线中补充这些新文档的链接与更清晰的格式。
- [x] 根据用户要求补充“客户端 UI 零可见变化”硬约束，确保后续实现只改运行时和数据流。
- [x] 运行 Markdown/diff 检查，并追加 Review。

## 2026-05-17 Agent 模式重构方案二次优化 Review

- 已新增 `baseline-checklist.md`、`event-contract.md`、`runtime-manifest.md`、`implementation-prs.md`，把方案从架构路线进一步补成可验证的实现说明。
- 已在 `README.md`、`migration-plan.md`、`implementation-prs.md` 写入客户端 UI 零可见变化约束：后续实现不得改布局、样式、文案、入口、按钮行为或交互路径；Renderer 迁移只能替换内部数据来源，最终 view model 必须与旧路径一致。
- 已修正 `migration-plan.md` 中阶段 2 的字段列表缩进，并补充到新文档的链接。
- 本轮仍未修改业务代码、README 或 AGENTS；只更新 `docs/agent-refactor/` 和任务记录。
- 验证通过：`git diff --check -- docs/agent-refactor tasks/todo.md`。

## 2026-05-17 Agent 重构开发进度清单计划

- [x] 复核现有 `docs/agent-refactor/` 方案，确认本轮生成长期开发跟踪清单，不改业务代码。
- [x] 新增详细迭代开发 checklist，覆盖阶段、任务、验收、验证命令、回滚点和 UI 零变化约束。
- [x] 将 checklist 接入 `docs/agent-refactor/README.md` 索引，便于后续按文档推进。
- [x] 运行 diff 检查，并追加 Review。

## 2026-05-17 Agent 重构开发进度清单 Review

- 已新增 `docs/agent-refactor/development-checklist.md`，作为后续 Agent 重构迭代的主控进度清单。
- 清单按 12 个阶段组织：冻结基线、Shared Event Contract、Event Log 双写、In-process Runner、Runtime Manifest 只读解析、Runtime Materializer、新插件系统、内置 MCP Bridge、Renderer 新 reducer、External Channel Adapter、Pipeline 复用 Runner、旧路径清理。
- 每个阶段都包含任务、验收、验证命令和回滚方式，并反复约束客户端 UI 零可见变化、旧 session 兼容、feature flag / 回滚路径和 `git diff --check`。
- 已将该清单加入 `docs/agent-refactor/README.md` 索引，后续开发应按该文档逐项更新状态与阶段完成模板。
- 本轮未修改业务代码、README 或 AGENTS；仅新增/更新方案文档和任务记录。
- 验证通过：`git diff --check -- docs/agent-refactor tasks/todo.md`。

## 2026-05-17 Agent 重构进度状态交接计划

- [x] 更新 `development-checklist.md` 当前开发状态，明确方案与跟踪体系已完成、代码实现尚未开始。
- [x] 标注阶段 0-11 均未开始，并明确下一步应从阶段 0 冻结基线开始。
- [x] 新增下次启动 Codex 的交接提示词文档。
- [x] 将提示词文档加入 `docs/agent-refactor/README.md` 索引。
- [x] 运行 diff 检查并提交本阶段文档状态更新。

## 2026-05-17 Agent 重构进度状态交接 Review

- 已更新 `docs/agent-refactor/development-checklist.md` 的当前开发状态：方案与跟踪体系已完成，代码实现尚未开始，阶段 0-11 均未开始。
- 已明确下一步从“阶段 0：冻结基线”开始，先创建 `baseline-runs/` 并记录当前行为，不改业务代码。
- 已新增 `docs/agent-refactor/next-session-prompt.md`，提供下次启动 Codex 可直接发送的中文提示词。
- 已将提示词文档加入 `docs/agent-refactor/README.md` 索引。
- 验证通过：`git diff --check -- docs/agent-refactor tasks/todo.md`。

## 2026-05-17 Agent Mission Header 压缩计划

- [x] 复盘用户截图反馈：红框 Mission Header 信息密度过高，压缩了更重要的消息流与 Command Deck。
- [x] 使用 `ui-ux-pro-max` 的内容优先级与信息层级原则，保留状态可见但降低顶部占位。
- [x] 将 AgentHeader 从大 HUD 面板收敛为紧凑任务状态条，移除右侧 Signal 大卡片。
- [x] 同步收缩 Header 相关角标、扫描线、状态光效与 orb 尺寸，避免视觉壳继续按大面板占位。
- [x] 运行 Electron typecheck、聚焦 Agent UI 测试与 `git diff --check`。
- [x] 在本节追加 Review，记录实现范围、验证结果和残余风险。

## 2026-05-17 Agent Mission Header 压缩 Review

- 已将 AgentHeader 的首屏占位从大 HUD 面板压缩为紧凑任务状态条：`min-h` 从约 124/136px 降到 76/82px，并移除右侧 `Signal` telemetry 大卡片。
- 标题、编辑入口、状态、工作区、模型、权限和文件面板入口仍保留；次要 HUD 信息合并为更小的 lane / telemetry 胶囊，避免挤压消息流。
- 同步收缩 `agent-mission-strip--compact` 的角标、扫描线、orb ring 和阴影强度，让科技感保留在边线与状态反馈上，而不是靠垂直高度堆叠。
- 根据截图二次修正：元信息 chip 强制单行，中文 label 只在 2xl 宽屏显示，常规宽度下保留图标和值，避免“工作区 / 模型 / 权限”逐字换行。
- 本轮未改 IPC、Jotai 状态、Agent 执行逻辑、持久化结构、README 或 AGENTS。
- 验证通过：`bun run --filter='@codeinsights/electron' typecheck`；`bun test apps/electron/src/renderer/components/agent/agent-ui-model.test.ts apps/electron/src/renderer/components/ui6-view-model.test.ts`；`git diff --check`。
- 残余风险：当前没有重新启动 Electron 桌面壳做截图复核，最终视觉比例仍建议在实际窗口确认一眼。

## 2026-05-17 Agent Cockpit 科技感重塑落地计划

- [x] 保护当前工作区未提交的 `.DS_Store` 与 UI spec swap 文件，不纳入本次改动。
- [x] 强化 Agent 全局背景、三栏面板、Mission Header、消息日志、Command Deck 与 Resource Bay 的截图级可见变化。
- [x] 保留 `Agent | Pipeline` 顶部切换器、Jotai 状态、IPC 行为、文件面板和输入区原有交互。
- [x] 集中新增 scoped `agent-*` 视觉样式，使用多色科技 palette，并确保 reduced-motion 降级。
- [x] 运行 typecheck、聚焦测试、renderer 构建和 diff 检查。
- [x] 在本节追加 Review，记录改动范围、验证结果和残余风险。

## 2026-05-17 Agent Cockpit 科技感重塑落地 Review

- 已按计划做截图级可见增强：Agent 背景新增多色雷达 / vignette 层，Mission Header 新增扫描线、HUD 角标、旋转状态环和 telemetry 模块，消息区新增日志时间线，Command Deck 新增能量 beam，左右面板新增 neon cockpit 壳和资源舱扫描效果。
- `Agent | Pipeline` 顶部切换器仍保留在展开态左侧栏顶部；本次没有改 IPC、Jotai atom、Agent 执行逻辑、文件读写逻辑、README 或 AGENTS。
- 新增样式集中在 scoped `agent-*` class，使用 cyan / emerald / amber / violet 多色科技 palette；新加循环动效已纳入 `prefers-reduced-motion` 降级。
- 验证通过：`bun run --filter='@codeinsights/electron' typecheck`；`bun test apps/electron/src/renderer/components/pipeline/PipelineComposer.test.ts apps/electron/src/renderer/components/pipeline/PipelineRecords.test.ts apps/electron/src/renderer/components/agent/agent-ui-model.test.ts apps/electron/src/renderer/components/ui6-view-model.test.ts`，16 pass；`bun run --filter='@codeinsights/electron' build:renderer`；`git diff --check`。
- `build:renderer` 仍有既有的大 chunk warning，本次构建成功；当前环境未打开 Electron 桌面壳做人工截图，残余风险主要是实际窗口里的主观观感与极窄宽度下的视觉密度。

## 2026-05-17 Agent|Pipeline 玻璃感优化计划

- [x] 复核用户截图中顶部模式切换器的视觉问题：比例偏厚、边框和背景发闷、当前态层级不够明确。
- [x] 将 `ModeSwitcher` 重构为紧凑玻璃感分段控件，保留 `Agent | Pipeline` 文案和原切换逻辑。
- [x] 运行聚焦验证并追加 Review。

## 2026-05-17 Agent|Pipeline 玻璃感优化 Review

- `Agent | Pipeline` 仍保留在展开态左侧栏最上方，切换逻辑未改。
- `ModeSwitcher` 已改成紧凑玻璃感分段控件：半透明外壳、柔和光晕、滑块当前态、图标圆形承托和更小的字号/高度。
- 新增样式集中在 `.mode-switcher-glass` 和其内部 `.mode-slider` / `.mode-btn`，没有扩散到业务组件。
- `@codeinsights/electron` 版本已从 `0.0.77` 提升到 `0.0.78`。
- 验证通过：`bun run --filter='@codeinsights/electron' typecheck`、`bun run --filter='@codeinsights/electron' build:renderer`、`git diff --check`。

## 2026-05-17 顶部 Agent|Pipeline 恢复计划

- [x] 复核用户指出的顶部模式切换器缺失问题，确认 `ModeSwitcher` 仅是未渲染而非组件丢失。
- [x] 将 `Agent | Pipeline` 放回展开态左侧栏最上方，并让 `Command Desk` 下移一层。
- [x] 运行聚焦验证并追加 Review。

## 2026-05-17 顶部 Agent|Pipeline 恢复 Review

- 已恢复展开态左侧栏最上方的 `Agent | Pipeline` 模式切换器，保持原 `ModeSwitcher` 逻辑和视觉样式。
- `Command Desk` 现在位于模式切换器下方，不再替代或遮挡顶部模式入口。
- 验证通过：`bun run --filter='@codeinsights/electron' typecheck`、`bun run --filter='@codeinsights/electron' build:renderer`、`git diff --check`。
- `@codeinsights/electron` 版本已从 `0.0.76` 提升到 `0.0.77`。

## 2026-05-17 左侧栏红框修正计划

- [x] 删除顶部红框中的 `MCP / Skills` 统计卡，避免无意义占位。
- [x] 压缩底部能力行，避免窄侧栏中图标与文字重叠。
- [x] 运行聚焦验证并追加 Review。

## 2026-05-17 左侧栏红框修正 Review

- 顶部红框中的 `MCP / Skills` 统计卡已直接移除，顶部区域回到原本的命令舱主视觉，不再占据额外高度。
- 底部 `Capabilities` 行已改成更短的中文单行表达，并把内容容器、图标和尾部箭头收紧，避免窄侧栏里文字与图标互相挤压。
- 这次没有改归档、能力配置和用户设置的功能流，只调整侧栏的呈现与响应式占位。
- 验证通过：`bun run --filter='@codeinsights/electron' typecheck`、`bun run --filter='@codeinsights/electron' build:renderer`、`git diff --check`。
- `@codeinsights/electron` 版本已从 `0.0.75` 提升到 `0.0.76`。

## 2026-05-17 左侧栏底部 Dock 紧凑化计划

- [x] 根据用户反馈复核底部 dock 空间占用，确认主要高度来自标题说明、两行副文本、较大 icon 和按钮 padding。
- [x] 去除非必要副说明，将归档与能力条压成单行信息表达，缩小图标、计数胶囊、按钮 padding 和底部外边距。
- [x] 保留归档切换、能力配置、用户设置三类入口，不改变数据流和点击目标。
- [x] 运行聚焦验证并追加 Review。

## 2026-05-17 左侧栏底部 Dock 紧凑化 Review

- 已将底部 dock 从三段较高的信息卡压缩为更轻的紧凑面板：标题说明被移除，归档与能力入口改为单行排列，按钮高度、图标尺寸、计数胶囊和底部外边距都同步收紧。
- 现在这块区域的视觉重心更集中，仍保留归档切换、MCP / Skills 配置和用户设置入口，但占据的纵向空间明显更少。
- 变更只影响 `LeftSidebar` 底部结构和配套 scoped CSS，没有碰数据流、IPC 或设置逻辑。
- 验证通过：`bun run --filter='@codeinsights/electron' typecheck`、`bun run --filter='@codeinsights/electron' build:renderer`、`git diff --check`。
- `@codeinsights/electron` 版本已从 `0.0.74` 提升到 `0.0.75`。

## 2026-05-17 左侧栏底部 Dock 红框优化计划

- [x] 复核截图红框对应范围：`LeftSidebar` 底部归档入口、Agent 能力摘要和用户设置入口。
- [x] 使用 `ui-ux-pro-max` 的层级、触达面积、状态表达原则，将底部散列按钮重构为统一 Dock Bay。
- [x] 保持现有归档切换、MCP / Skills 配置入口、用户设置入口不变，只增强视觉结构。
- [x] 运行 Electron renderer 类型检查、构建和 diff 检查。
- [x] 在本节追加 Review，记录改动与残余风险。

## 2026-05-17 左侧栏底部 Dock 红框优化 Review

- 已将红框区域收束为统一的 `Dock Bay` 面板：上方是归档 / 历史入口，中间是 Agent 工作区能力摘要，底部是用户账户条，不再像几段普通文字与按钮的简单堆叠。
- 归档入口保留原有切换行为；Agent 模式下的 MCP / Skills 配置入口仍然直达设置页；用户设置入口仍然直达全局设置，交互逻辑未改。
- 新增的 `agent-bottom-dock`、`agent-dock-link`、`agent-dock-icon`、`agent-dock-count` 等样式只作用于侧栏底部区域，没有扩散到其他面板。
- 验证通过：`bun run --filter='@codeinsights/electron' typecheck`、`bun run --filter='@codeinsights/electron' build:renderer`、`git diff --check`。
- `@codeinsights/electron` 版本已从 `0.0.73` 提升到 `0.0.74`。
- 残余风险主要是 Electron 桌面壳中的最终观感和窄宽窗口下的换行表现，当前静态构建没有发现结构性问题。

## 2026-05-17 侧栏视觉重构计划

- [x] 审查并重构 `LeftSidebar`、`RightSidePanel`、`NavigatorPanel`、`ModeSwitcher`、`Panel`、`PanelHeader` 的视觉层次，保持现有功能不变。
- [x] 仅补充必要的 scoped 样式，强化侧栏与面板的层级、密度、状态感和现代感。
- [x] 运行侧栏相关构建与差异检查，确认没有引入布局或交互回退。
- [x] 在本节追加 Review，记录改动范围、验证结果和残余风险。

## 2026-05-17 侧栏视觉重构 Review

- 已完成侧栏视觉重构：左侧栏从普通列表容器升级为带 `Command Desk` 顶栏、状态统计、Workspace Matrix、分层列表和底部用户 dock 的控制台式结构；折叠态也同步保留更强的入口识别。
- `ModeSwitcher`、`Panel`、`PanelHeader`、`NavigatorPanel` 的默认层次已抬高，整体更接近现代面板壳，信息密度更高但没有新增状态管理。
- 右侧面板没有改业务逻辑，只保留容器和视觉壳的统一；相关 scoped 样式集中在 `globals.css`，继续沿用现有 shadcn / radix / lucide 体系。
- 验证结果：`git diff --check` 通过；`bun run --filter='@codeinsights/electron' build:renderer` 成功完成，仍只有既有的大 chunk warning。全量 `typecheck` 在当前工作区被仓库里一个非侧栏的 `ChatMessages.tsx` 缺失导入问题干扰，当前不在这次侧栏重构范围内。
- 当前仍需保护 `.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 和 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp`，不要纳入提交。

## 2026-05-17 主内容工作台视觉重构

- [ ] 盘点并限定主内容相关文件范围：`agent/*`、`chat/*`、`pipeline/*`、`tabs/*` 与必要共用 `ui/*`。
- [ ] 重构主内容区容器、标题区、消息卡、空状态、输入区与对话框的视觉层级，形成更高质感的工作台叙事。
- [ ] 保持交互与数据流不变，只做视觉与局部布局增强，避免触碰侧边栏主逻辑。
- [ ] 运行类型检查与必要的聚焦验证，确认改造不破坏功能。
- [ ] 在本节追加 Review，记录改动文件、视觉要点与残余风险。

## 2026-05-17 主内容工作台视觉重构 Review

- 已将主内容统一成更明确的工作台叙事：`MainArea` / `TabContent` / `ChatView` / `AgentView` / `PipelineView` 都增加了更强的背景层、顶边高光和内容容器层次。
- 已强化头部、消息区、输入区与记录区的视觉重量：`ChatHeader`、`AgentHeader`、`ChatMessages`、`AgentMessages`、`ChatInput`、`PipelineHeader`、`PipelineComposer`、`PipelineRecords` 的卡片边界、阴影、留白和信息密度都做了统一收紧。
- 共用对话框与命令面板保持现有交互，只保留或延续更高质感的模态外观；本次没有改 IPC、Jotai 数据流、消息语义或主进程逻辑。
- 版本号已从 `0.0.72` 提升到 `0.0.73`。
- 验证通过：`bun run --filter='@codeinsights/electron' typecheck`；`bun run --filter='@codeinsights/electron' build:renderer`；`git diff --check`。
- 残余风险主要是主观观感和 Electron 桌面壳里的最终层级表现，建议在实际窗口里再看一次 Chat / Agent / Pipeline 三个主面板的首屏。

## 2026-05-17 Agent Cockpit 可见度补强

- [x] 复盘用户反馈：上一轮 cockpit 优化偏保守，肉眼变化不够明显。
- [x] 使用 `ui-ux-pro-max` 的可见层级、色彩、动效与可读性原则重新校准样式强度。
- [x] 加重 Agent 背景、Mission Header、消息卡、工具横幅、输入区和左右资源面板的光效、材质、状态边线。
- [x] 更新 `tasks/lessons.md`，记录“创意 UI 重塑必须有截图级可见变化”的纠正。
- [x] 运行类型检查、renderer 构建与 diff 检查，确认补强不影响逻辑。
- [x] 在本节追加 Review。

## 2026-05-17 Agent Cockpit 可见度补强 Review

- 已把 Agent 主工作台继续往“任务舱 / mission console”方向推进：补强了 AppShell 的 Agent 背景层次、左侧 Workspace Matrix、AgentHeader 顶部舱、消息堆叠、Command Deck 与右侧 Resource Bay 的视觉分区。
- 这次改动仍然只碰渲染层视觉与少量版本元数据，没有新增 IPC、atom、存储格式或业务逻辑；`@codeinsights/electron` 版本已从 `0.0.71` 提升到 `0.0.72`。
- 验证通过：`bun run --filter='@codeinsights/electron' typecheck`、`bun run --filter='@codeinsights/electron' build:renderer`、`git diff --check`、聚焦的 sidebar / agent UI model 测试。
- `build:renderer` 仍有既有的大 chunk warning，但构建成功，没有引入新的阻断性错误。
- 由于当前环境没有直接进入 Electron 桌面壳做截图复核，这次结论基于静态构建与代码审查；残余风险主要是纯视觉观感，需要桌面壳里再看一轮最终版式。

## 2026-05-17 Agent Cockpit UI 科幻舱内重塑

- [x] 保护当前工作区未提交的 `.DS_Store` 与 UI spec swap 文件，不纳入本次改动。
- [x] 为 Agent 相关布局补齐更强的 cockpit / mission console 视觉层级，统一全局背景、面板材质和状态光效。
- [x] 重构 AgentHeader、AgentMessages、AgentView 的展示 class，让头部、消息卡、输入区形成一致叙事。
- [x] 让权限横幅与 AskUser 横幅也进入同一视觉系统，避免在新风格里突兀。
- [x] 运行 `bun run --filter='@codeinsights/electron' typecheck` 与 `git diff --check`，必要时做浏览器截图验证。
- [x] 在本节追加 Review，记录实现范围、验证结果和残余风险。

## 2026-05-17 Agent Cockpit UI 科幻舱内重塑 Review

- 已将 Agent 相关视觉统一到 cockpit / mission console 语言：头部信息条更像任务舱控制面板，消息卡增加角色色带和更强层次，输入区和权限 / 问答横幅也进入同一材质系统。
- 已新增 `agent-shell-bg`、强化 `agent-cockpit-shell`、`agent-message-card`、`agent-command-deck`、`agent-tool-rail` 等 scoped 样式，保留 reduced-motion 兼容，没有引入新依赖，也没有改 IPC、Jotai atoms 或持久化格式。
- `@codeinsights/electron` 版本已从 `0.0.70` 提升到 `0.0.71`。
- 验证通过：`bun run --filter='@codeinsights/electron' typecheck`；`bun run --filter='@codeinsights/electron' build:renderer`；`git diff --check`。
- 浏览器侧真实 Electron 预览未做成自动截图，因为当前环境缺少 Playwright 依赖且该界面依赖 Electron preload；静态构建已通过，后续仍建议在桌面壳里看一次最终观感。

# Agent Cockpit UI 优化任务

## 2026-05-17 三栏横向宽度拖拽计划

- [x] 保护现有未提交临时文件和用户改动，先确认 `git status --short`。
- [x] 定位 AppShell 三栏宽度来源，确认 Agent / Pipeline 左栏与 Agent 右侧文件面板的显示条件。
- [x] 新增 Jotai 持久化宽度状态，覆盖左侧栏与右侧面板，设置合理 min / max，避免拖拽压垮主内容区。
- [x] 在两个分隔处新增横向 resize handle，支持鼠标拖拽、双击复位、键盘左右调整和基础 aria 信息。
- [x] 调整 AppShell 布局样式，确保折叠态、右侧面板关闭态、标题栏拖拽区域和现有滚动不冲突。
- [x] 运行 focused typecheck / tests / `git diff --check`，必要时启动客户端或构建 renderer 做布局验证。
- [x] 在本节追加 Review，记录实现范围、验证结果和残余风险。

## 2026-05-17 三栏横向宽度拖拽 Review

- 已在 AppShell 两处分隔处新增横向 resize handle：左侧导航栏 / 中间内容之间常驻，右侧文件面板打开时在中间内容 / 文件面板之间显示。
- 左侧栏宽度持久化为 `codeinsights-app-shell-left-sidebar-width`，Agent / Pipeline 共用；右侧文件面板宽度持久化为 `codeinsights-app-shell-right-panel-width`。
- 宽度约束：左栏 220-420px，右栏 280-520px，并按视口预留主内容最小宽度，避免拖拽把主工作区压到不可用。
- 交互支持鼠标拖拽、双击复位、Enter / Home 复位、方向键调整；handle 使用 `role="separator"` 和中文 `aria-label`。
- 同步让 `PipelineSidebar`、`RightSidePanel`、`SidePanel` 接收外部宽度，避免外层可变但内部仍固定 320px 的空白问题。
- `@codeinsights/electron` 版本 `0.0.68 -> 0.0.69`，`bun.lock` workspace metadata 已同步。
- 验证通过：`bun run --filter='@codeinsights/electron' typecheck`；`bun run --filter='@codeinsights/electron' build:renderer`；`bun test apps/electron/src/renderer/components/app-shell/sidebar-section-model.test.ts apps/electron/src/renderer/components/pipeline/pipeline-session-sidebar-model.test.ts` 14 pass；`git diff --check`。
- `build:renderer` 仍有既有 chunk size warning，本次构建成功，未作为三栏拖拽改造阻塞项。
- 当前仍需保护 `.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 和 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp`，不要纳入提交。
- 用户截图反馈左栏拖窄后顶部模式切换区会挤压 / 溢出；已追加修复：左栏最小宽度提升到 260px，`ModeSwitcher` 降低水平 padding、允许 label truncate，并同步 Agent / Pipeline 左栏 minWidth。

## 2026-05-17 Agent Cockpit UI 创意升级计划

- [x] 保护当前工作区未提交的 `.DS_Store` 与 UI spec swap 文件，不纳入本次改动。
- [x] 将 Agent 模式左右侧边栏与中间工作台统一升级为更有层次的 “Agent Cockpit” 视觉语言。
- [x] 优化左侧栏的信息分区、会话列表状态、折叠态入口与底部账户区。
- [x] 优化 Agent Header、消息区、输入区与工具活动展示，让中间区域更像任务控制台。
- [x] 优化右侧文件面板与 File Browser 的资源舱样式、文件树行、空态、拖拽区与危险操作确认。
- [x] 集中收敛 Agent 专用 CSS token / utility，保持主题兼容且不引入新依赖。
- [x] 运行 typecheck、聚焦测试或必要的手动验证，确认视觉改动不影响交互与布局。
- [x] 在本节追加 Review，记录改动、验证和残余风险。

## 2026-05-17 Agent Cockpit UI 创意升级 Review

- 已完成 Agent 模式三栏可见改造：左侧栏增加 Workspace Matrix、控制台式模式区、新建 / 搜索高亮入口、会话行 active / hover 能量边；中间 Mission Strip、消息卡、工具轨、Composer Deck 增加光感、网格、状态色和更清晰层级；右侧文件面板与 File Browser 改为资源舱 / vault 风格。
- 新增样式集中在 `agent-*` scoped CSS class，继续使用现有主题 token、Lucide 图标、Radix/shadcn 基础组件；未新增依赖，未修改 IPC、Jotai atom、Agent 执行逻辑、文件读写逻辑、README 或 AGENTS。
- 文件树行现在有更明显的 selected / hover / recently modified 表达，空态和拖拽区使用同一资源舱视觉；主要交互仍保留原 aria-label、tooltip、键盘路径和删除确认。
- `@codeinsights/electron` 版本 `0.0.67 -> 0.0.68`，`bun.lock` workspace metadata 已同步。
- 验证通过：`bun run --filter='@codeinsights/electron' typecheck`；`bun test apps/electron/src/renderer/components/ui6-view-model.test.ts apps/electron/src/renderer/components/app-shell/sidebar-section-model.test.ts apps/electron/src/renderer/components/agent/agent-ui-model.test.ts` 14 pass；`bun run --filter='@codeinsights/electron' build:renderer`；`git diff --check`。
- `build:renderer` 仍有既有 chunk size warning，本次构建成功，未作为 Agent Cockpit 视觉改造阻塞项。
- 当前仍需保护 `.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 和 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp`，不要纳入提交。

# Pipeline 完善分析任务

## 2026-05-16 Pipeline Sidebar Command Deck UI 计划

- [x] 保护当前工作区未提交的 `.DS_Store` 与 UI spec swap 文件，不纳入本次改动。
- [x] 只改造 `PipelineSidebar` 的视觉层级，保留现有 IPC、状态、排序、归档、工作区与会话操作逻辑。
- [x] 将展开态侧边栏升级为深色玻璃指挥舱：顶部模式区、工作区控制台、新建 / 搜索操作区、会话任务卡片、底部能力区与账户 dock。
- [x] 将折叠态侧边栏同步升级，保持展开 / 新建 / 用户入口风格一致。
- [x] 增强会话分组标题、状态徽标、选中态、hover 操作和空状态，确保状态不只靠颜色表达。
- [x] 运行 Pipeline 侧边栏模型测试、Electron typecheck 与 `git diff --check`。
- [x] 在本节追加 Review，说明改动、验证和残余风险。

## 2026-05-16 Pipeline Sidebar Command Deck UI Review

- 已完成 Pipeline 专属侧边栏改造：展开态现在是深色玻璃指挥舱面板，顶部模式区、工作区控制台、新建 / 搜索入口、会话任务卡片、分组标题、能力区和账户 dock 都有明显可见变化。
- 会话列表项保留原选择、重命名、置顶、归档行为；视觉上新增状态 orb、节点 / 轮次 chip、状态徽标、左侧状态轨、当前会话能量边和微型刻度，状态不只靠颜色表达。
- 折叠态同步改造为同一视觉语言，展开、新建和用户设置入口保持原功能与 tooltip / aria-label。
- 未修改 IPC、atoms、会话排序、归档逻辑、工作区逻辑、持久化结构、README 或 AGENTS；未新增依赖。
- 验证通过：`bun test apps/electron/src/renderer/components/pipeline/pipeline-session-sidebar-model.test.ts` 11 pass；`bun run --filter='@codeinsights/electron' typecheck`；`bun run --filter='@codeinsights/electron' build:renderer`；`git diff --check`。
- `build:renderer` 仍有既有 chunk size warning，本次构建成功，未作为本次侧边栏 UI 改造阻塞项。
- 当前仍需保护 `.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 和 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp`，不要纳入提交。

## 2026-05-16 Pipeline Stage Rail Creative UI Refresh 计划

- [x] 保护当前工作区未提交的 `.DS_Store` 与 UI spec swap 文件，不纳入本次改动。
- [x] 将 `PipelineStageRail` 从朴素卡片网格改为“贡献航线 / Mission Route”视觉，保留现有状态模型和阶段定位行为。
- [x] 为每个阶段增加序号、节点图标、状态徽章、微型进度刻度、hover / focus 反馈，并强化当前运行阶段的 glow / scan / pulse。
- [x] 增加 scoped `pipeline-stage-route-*` CSS utilities，并确保 reduced-motion 下循环动画降级。
- [x] 递增 `@codeinsights/electron` patch 版本并同步 `bun.lock` workspace metadata。
- [x] 运行 Pipeline 聚焦测试、typecheck 和 `git diff --check`。
- [x] 在本节追加 Review，说明改动、验证和残余风险。

## 2026-05-16 Pipeline Stage Rail Creative UI Refresh Review

- 已完成红框区域改造：`PipelineStageRail` 现在使用 Mission Route / 贡献航线布局，阶段卡片包含节点图标、两位序号、状态 icon、状态徽章和微型进度刻度；当前阶段具备 glow、扫描高光和脉冲节点。
- 状态来源保持不变：继续使用 `buildPipelineStageViewModels` 的 `done / active / waiting / failed / stopped / todo`，点击阶段定位记录的行为未改变。
- 新增 CSS 均为 scoped `pipeline-stage-route-*` utility，动画使用 opacity / transform / background-position，并已加入 `prefers-reduced-motion: reduce` 降级。
- `@codeinsights/electron` 版本 `0.0.65 -> 0.0.66`，`bun.lock` workspace metadata 已同步。
- 验证通过：`bun test apps/electron/src/renderer/components/pipeline apps/electron/src/renderer/atoms/pipeline-atoms.test.ts` 84 pass；`bun run --filter='@codeinsights/electron' typecheck`；`bun run --filter='@codeinsights/electron' build:renderer`；`git diff --check`。
- 未修改 README / AGENTS，不新增依赖，不新增 public API / IPC / shared type，不改 Pipeline 状态机、主进程服务或持久化格式。
- 当前仍需保护 `.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 和 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp`，不要纳入提交。

## 2026-05-16 Pipeline Header 大标题移除计划

- [x] 移除 PipelineHeader 中展示会话标题的大号 H1，保留顶部 CodeInsights Pipeline 与当前节点、状态摘要。
- [x] 同步收紧 Header 内部间距，避免删除标题后出现明显空洞。
- [x] 更新 `tasks/lessons.md` 记录用户对 Pipeline Header 信息密度的纠正。
- [x] 运行聚焦测试或类型检查，并重新截图确认红框区域不再保留。
- [x] 在本节追加 Review。

## 2026-05-16 Pipeline Header 大标题移除 Review

- 已移除 `PipelineHeader` 中的大号会话标题 H1；Header 现在只保留 `CodeInsights Pipeline`、当前节点、状态摘要、轮次和右侧状态卡，用户标红区域不再占位。
- 已更新 `tasks/lessons.md`，记录 Pipeline Header 不再重复以超大标题展示会话名的偏好。
- 验证通过：`bun test apps/electron/src/renderer/components/pipeline apps/electron/src/renderer/atoms/pipeline-atoms.test.ts` 84 pass；`bun run --filter='@codeinsights/electron' typecheck`。
- 已重新采集截图：`/tmp/codeinsights-shots/pipeline-header-stage.png`，确认红框内容已删除。

## 2026-05-16 Pipeline Neon Control Deck UI 优化计划

- [x] 保护当前工作区未提交的 `.DS_Store` 与 UI spec swap 文件，不纳入本次改动。
- [x] 改造 Pipeline 主内容背景、Header、StageRail、Records、Composer，让运行状态和阶段进度有明显科技感与动态反馈。
- [x] 适度增强 PipelineSidebar 的新建入口、当前会话选中态和运行中状态点。
- [x] 增加 scoped Pipeline CSS utilities / keyframes，并确保 reduced-motion 下动画降级。
- [x] 递增 `@codeinsights/electron` patch 版本并同步锁文件。
- [x] 运行 Pipeline 聚焦测试、pipeline atoms 测试、typecheck 与 `git diff --check`。
- [x] 启动客户端做 Pipeline 模式视觉验证，检查桌面与窄宽布局、长文本、搜索、运行/等待/失败/停止状态。
- [x] 在本节追加 Review，说明改动、验证和残余风险。

## 2026-05-16 Pipeline Neon Control Deck UI 优化 Review

- 已完成 Pipeline 可见层改造：主工作区增加网格 / 微光背景；Header 改为任务指挥舱；StageRail 增加能量线、当前阶段 glow 和状态 icon；Records 增加控制台式搜索 / filter、实时输出扫描光、记录左侧状态轨和 hover lift；Composer 改为任务发射台；PipelineSidebar 增强新建入口、选中态和运行状态点。
- CSS 新增均使用 `pipeline-*` scoped class；动画使用 transform / opacity / background-position，并在 `prefers-reduced-motion: reduce` 下禁用循环扫描、能量线、状态脉冲和高亮呼吸。
- Code review 后已修复：不再对已含 alpha 的 `status-*-bg` / `status-*-border` token 叠加 Tailwind opacity modifier；Pipeline 背景伪元素加 `z-index: 0`，内容容器加 `z-10`；新增装饰性 Lucide 图标补 `aria-hidden`。
- `@codeinsights/electron` 版本 `0.0.64 -> 0.0.65`，`bun.lock` workspace metadata 已同步。
- 验证通过：`bun test apps/electron/src/renderer/components/pipeline apps/electron/src/renderer/atoms/pipeline-atoms.test.ts` 84 pass；`bun run --filter='@codeinsights/electron' typecheck`；`bun run --filter='@codeinsights/electron' build:renderer`；`git diff --check`。
- Vite 渲染端已在 `http://127.0.0.1:5174/` 启动并返回 200；直接浏览器打开会因缺少 Electron preload 的 `window.electronAPI` 报错，这是现有 Electron 架构限制，不是本次 UI 改动引入。真实 Pipeline 视觉仍需通过 Electron 桌面壳查看。
- 未修改 README / AGENTS，不新增依赖，不新增 public API / IPC / shared type，不改 Pipeline 状态机、主进程服务或持久化格式。
- 当前仍需保护 `.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 和 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp`，不要纳入提交。

## 2026-05-16 UI 全阶段完成后状态同步计划

- [x] 检查 `git status --short`，确认当前仅有 `.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 和 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp` 需要继续保护。
- [x] 更新 `improve/ui/2026-05-16-client-ui-implementation-checklist.md` 当前开发状态，明确 UI-0 到 UI-7 全部完成，UI-7 commit 为 `33b8ccec`。
- [x] 更新 checklist 的当前启动提示和下次启动提示词，避免下次误从 UI-7 重复开始。
- [x] 在本地任务记录中追加下次启动提示词，说明后续应从新的 UI 专项或用户新需求开始。
- [x] 保持 README / AGENTS 不变，只更新 UI 进度跟踪文档和本地任务记录。

## 2026-05-16 UI 全阶段完成后状态同步 Review

- 当前 UI 阶段状态：UI-0、UI-1、UI-2、UI-3、UI-4、UI-5、UI-6、UI-7 全部完成；未完成阶段：无。
- 最新 UI 阶段提交：`33b8ccec`，`test(ui): 完成客户端 UI 视觉验收收口`。
- UI-7 已完成并验证：4 个聚焦测试文件 11 pass、`bun run --filter='@codeinsights/electron' typecheck`、`git diff --check`。
- 后续继续开发时不要重复 UI-0 到 UI-7；应先定义新的 UI 专项或接收新的用户需求，再写入 `tasks/todo.md` 计划并 check-in。
- 可选后续专项：真实 Electron 截图复核、File Browser 完整 roving tabindex / typeahead、低频集成设置页 token 化、窄窗口矩阵、新产品功能 UI。
- 当前仍需保护 `.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 与 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp`，不要纳入提交。

## 下次启动提示词（UI 全阶段完成后）

```text
你正在 CodeInsights 仓库继续开发。请先阅读并遵守：
- AGENTS.md
- tasks/lessons.md
- tasks/todo.md
- improve/ui/2026-05-16-client-ui-visual-spec.md
- improve/ui/2026-05-16-client-ui-implementation-checklist.md

当前 UI 优化进度：
1. UI 文档基线已完成并提交：7bef500c，docs(ui): 新增客户端 UI 视觉规范与迭代清单。
2. UI-0「基线审计与截图准备」已完成并提交：61c263c8，docs(ui): 完成 UI-0 基线审计与截图。
3. UI-1「Token 与 primitive 收敛」已完成并提交：20a90d36，feat(ui): 完成 UI-1 token 与 primitive 收敛。
4. UI-2「AppShell / Sidebar / Tab」已完成并提交：c3636336，style(ui): 统一 AppShell 导航与标签状态。
5. UI-3「Pipeline 工作台」已完成并提交：3881eb10，style(pipeline): 优化 Pipeline 工作台状态层级。
6. UI-4「Agent 阅读与交互」已完成并提交：b28ac9df，style(agent): 优化 Agent 消息工具与交互状态。
7. UI 截图索引已补充并提交：1d78bf66，docs(ui): 补充 UI 截图索引说明。
8. UI-5「Settings 管理界面」已完成并提交：8362e8b4，style(settings): 统一设置界面表单与危险操作。
9. UI-5 后续开发状态已同步并提交：3ccb2886，docs(ui): 同步 UI-5 后续开发状态。
10. UI-6「Welcome / Chat 回退 / File Browser」已完成并提交：ed3d48d3，style(ui): 对齐 Welcome Chat 与 File Browser 体验。
11. UI-6 后续开发状态已同步并提交：f523ad71，docs(ui): 同步 UI-6 后续开发状态。
12. UI-7「全局验收与收尾」已完成并提交：33b8ccec，test(ui): 完成客户端 UI 视觉验收收口。
13. 已完成：UI-0、UI-1、UI-2、UI-3、UI-4、UI-5、UI-6、UI-7。未完成：无。
14. UI-7 验收内容：阶段 Review、P0/P1 关闭矩阵、主题矩阵、icon-only 可访问性、状态色辅助表达、键盘路径、长文本 / 长路径溢出和截图矩阵已收口。
15. UI-7 验证通过：bun test apps/electron/src/renderer/components/ui6-view-model.test.ts apps/electron/src/renderer/components/app-shell/sidebar-section-model.test.ts apps/electron/src/renderer/atoms/tab-atoms.test.ts apps/electron/src/renderer/components/tabs/tab-close-confirm-model.test.ts；bun run --filter='@codeinsights/electron' typecheck；git diff --check。
16. 当前工作区可能存在未提交临时文件 improve/ui/.2026-05-16-client-ui-visual-spec.md.swp，以及 .DS_Store 修改；它们不是 UI 阶段成果，不要纳入提交，先确认来源并保护用户变更。

请从当前完成状态继续：
1. 先执行 git status --short，保护已有用户变更。
2. 阅读 implementation checklist 的当前状态快照、UI-7 最终 Review、P0/P1 关闭矩阵，以及 tasks/todo.md 的 UI 全阶段完成后状态同步 Review。
3. 不要回头重复 UI-0 到 UI-7 的阶段实现；这些阶段已经完成并提交。
4. 如果用户要求继续 UI 优化，先在 tasks/todo.md 写新的专项计划并 check-in，再开始实现。可选后续专项包括：真实 Electron 截图复核、File Browser 完整 roving tabindex / typeahead、低频集成设置页 token 化、窄窗口矩阵、或新的产品功能 UI。
5. 继续遵守 Jotai、Radix/shadcn 风格组件、Lucide 图标、现有主题 token、本地 JSON/JSONL 存储的约束。
6. 不新增 public API / IPC / shared type，除非单独评审；不修改 README / AGENTS，除非用户明确允许。
7. 新专项完成后运行 bun run --filter='@codeinsights/electron' typecheck、相关 focused tests 或手动路径验证、git diff --check；按需要补充截图或在 Review 中说明覆盖依据。
8. 新专项完成后更新 checklist 或新增对应 improve/ui 跟踪文档，并在 tasks/todo.md 追加 Review；单独提交，不执行 push / PR，除非用户明确要求。
```

## 2026-05-16 UI-7 全局验收与收尾计划

- [x] 执行 `git status --short`，确认当前仅有 `.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 和 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp` 需要保护，不纳入 UI-7 提交。
- [x] 复习 `AGENTS.md`、`tasks/lessons.md`、`tasks/todo.md`、UI visual spec 与 implementation checklist 的 UI-7 范围。
- [x] 检查 UI-0 到 UI-6 的阶段 Review 是否完整，确认 P0 / P1 问题已关闭或有明确暂缓原因。
- [x] 做全局静态审计：主题 token fallback、裸 hex、状态色辅助表达、reduced motion、Dialog title / cancel / focus、icon-only `aria-label` / tooltip。
- [x] 做跨页面键盘与溢出审计：File Browser、Sidebar、TabBar、Settings nav；长文件名、长模型名、长 session title、长错误文本和长路径。
- [x] 对照截图矩阵确认 light / dark / 至少一个特殊主题覆盖 AppShell、Pipeline、Agent、Settings、Welcome、Chat 回退、File Browser；必要时补采或记录已有截图覆盖。
- [x] 如发现回归，只做最小修复，不重复 UI-2 到 UI-6 的阶段实现，不新增 public API / IPC / shared type，不修改 README / AGENTS。
- [x] 运行最终验证：`bun run --filter='@codeinsights/electron' typecheck`、相关 focused tests 或手动路径验证、`git diff --check`。
- [x] 更新 `improve/ui/2026-05-16-client-ui-implementation-checklist.md` 的总览、UI-7 任务、截图矩阵与最终 Review。
- [x] 在本节追加 UI-7 Review，单独提交 UI-7，提交时继续排除 `.DS_Store` 与 swap 文件。

## 2026-05-16 UI-7 全局验收与收尾 Review

- UI-7 已完成全局验收：UI-0 到 UI-6 阶段 Review 已补齐，P0 / P1 关闭矩阵已写入 implementation checklist。
- 最小修复范围：ChatHeader 编辑确认 / 取消、置顶、并排模式补 `aria-label`；WelcomeEmptyState 移除组件内 `forest-light` 裸 hex 分支，回到 token；TabBar 补 `tablist` / `tab` / `aria-selected` 与 ArrowLeft / ArrowRight / Home / End 切换；LeftSidebar 隐藏行内操作退出 Tab 顺序，运行 / 等待 / 成功 / 失败状态补 sr-only 文案；File Browser 补 ArrowUp / ArrowDown 在 treeitem 间移动。
- `@codeinsights/electron` 版本 `0.0.63 -> 0.0.64`，`bun.lock` workspace metadata 已同步。
- 截图矩阵已收口：Pipeline、Agent、AppShell、Settings、Welcome、Chat 回退、File Browser 已有 light / dark / 特殊主题组合覆盖；Chat 回退 light/dark 与 File Browser light/dark 以 token 复用、既有特殊主题截图、focused tests 和手动路径审计接受。
- 验证通过：`bun test apps/electron/src/renderer/components/ui6-view-model.test.ts apps/electron/src/renderer/components/app-shell/sidebar-section-model.test.ts apps/electron/src/renderer/atoms/tab-atoms.test.ts apps/electron/src/renderer/components/tabs/tab-close-confirm-model.test.ts` 11 pass；`bun run --filter='@codeinsights/electron' typecheck`；`git diff --check`。
- 未修改 README / AGENTS，不新增 public API / IPC / shared type，不改变业务状态、存储结构或 Agent / Pipeline 执行语义。
- 已知风险：File Browser 仍不是完整 roving tabindex / typeahead 树模型，但 UI-7 已补上下方向键聚焦移动；低频集成设置页仍有历史状态色 class，因均带文本状态或图标辅助，本轮不作为阻塞项。
- 提交时继续排除 `.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 和 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp`。

## 2026-05-16 UI-6 后进度文档同步计划

- [x] 检查 `git status --short`，确认当前只剩 `.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 和 UI visual spec swap 文件需要保护。
- [x] 更新 UI implementation checklist 的最新状态快照，明确 UI-6 commit `ed3d48d3` 已完成并提交。
- [x] 更新阶段进度表、截图矩阵和当前启动提示，明确 UI-0 到 UI-6 已完成，UI-7 未完成。
- [x] 将下次启动提示词改为 UI-7「全局验收与收尾」，避免下次重复 UI-6。
- [x] 保持 README / AGENTS 不变，只更新 UI 进度跟踪文档和本地任务记录。

## 2026-05-16 UI-6 后进度文档同步 Review

- 已同步 `improve/ui/2026-05-16-client-ui-implementation-checklist.md`：UI-6 commit 为 `ed3d48d3`，提交标题为 `style(ui): 对齐 Welcome Chat 与 File Browser 体验`。
- 当前完成阶段：UI-0、UI-1、UI-2、UI-3、UI-4、UI-5、UI-6；未完成阶段：UI-7。
- UI-6 已完成 Welcome / Onboarding 空态、Chat 回退 message list / composer / tool activity、File Browser selected / hover / rename / delete confirm / empty folder 的视觉层级、focus、路径溢出和危险确认收敛。
- UI-6 验证记录：UI-6 聚焦测试 4 pass、`bun run --filter='@codeinsights/electron' typecheck`、`bun install --frozen-lockfile --dry-run`、`git diff --check`。
- UI-6 截图记录：`welcome-light-first-run-desktop.png`、`welcome-dark-config-missing-desktop.png`、`chat-slate-message-list-desktop.png`、`chat-slate-tool-activity-desktop.png`、`file-browser-forest-selected-desktop.png`、`file-browser-forest-delete-confirm-desktop.png`。
- 下次启动应从 UI-7「全局验收与收尾」开始，先做全局验收计划，再检查主题矩阵、键盘路径、icon-only 可访问性、状态色辅助表达、长文本 / 长路径溢出、截图矩阵和最终 Review。
- 当前仍需保护 `.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 与 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp`，不要纳入阶段提交。

## 下次启动提示词（UI-7）

```text
你正在 CodeInsights 仓库继续推进全客户端 UI 优化。

请先阅读并遵守：
- AGENTS.md
- tasks/lessons.md
- tasks/todo.md
- improve/ui/2026-05-16-client-ui-visual-spec.md
- improve/ui/2026-05-16-client-ui-implementation-checklist.md

当前进度：
1. UI 文档基线已完成并提交：7bef500c，docs(ui): 新增客户端 UI 视觉规范与迭代清单。
2. UI-0 已完成并提交：61c263c8，docs(ui): 完成 UI-0 基线审计与截图。
3. UI-1 已完成并提交：20a90d36，feat(ui): 完成 UI-1 token 与 primitive 收敛。
4. UI-2 已完成并提交：c3636336，style(ui): 统一 AppShell 导航与标签状态。
5. UI-3 已完成并提交：3881eb10，style(pipeline): 优化 Pipeline 工作台状态层级。
6. UI-4 已完成并提交：b28ac9df，style(agent): 优化 Agent 消息工具与交互状态。
7. UI 截图索引已提交：1d78bf66，docs(ui): 补充 UI 截图索引说明。
8. UI-5 已完成并提交：8362e8b4，style(settings): 统一设置界面表单与危险操作。
9. UI-5 后续开发状态已同步并提交：3ccb2886，docs(ui): 同步 UI-5 后续开发状态。
10. UI-6 已完成并提交：ed3d48d3，style(ui): 对齐 Welcome Chat 与 File Browser 体验。
11. 已完成：UI-0、UI-1、UI-2、UI-3、UI-4、UI-5、UI-6。未完成：UI-7。
12. 当前工作区可能存在 .DS_Store 修改和 improve/ui/.2026-05-16-client-ui-visual-spec.md.swp，不要纳入提交。

请从 UI-7「全局验收与收尾」开始：
1. 先执行 git status --short，保护已有用户变更。
2. 阅读 checklist 的 UI-7 阶段和视觉规范中主题、可访问性、页面级 Wireframe、截图矩阵相关部分。
3. 先在 tasks/todo.md 写 UI-7 计划并 check-in，再做全局验收审计。
4. 不要回头重复 UI-2 / UI-3 / UI-4 / UI-5 / UI-6 的阶段实现；除非验收发现具体回归，只做最小修复。
5. 不新增 public API / IPC / shared type；不修改 README / AGENTS，除非用户明确允许。
6. UI-7 完成定义：所有阶段 Review 已填写；light / dark / 至少一个特殊主题下 AppShell、Pipeline、Agent、Settings、Welcome、Chat 回退、File Browser 层级清楚；icon-only 按钮有 aria-label / tooltip；状态色有文本或图标辅助；File Browser、Sidebar、TabBar、Settings nav 键盘路径可用；长标题、长模型名、长路径、长错误文本无明显溢出。
7. 完成 UI-7 后运行 typecheck、相关 focused tests 或手动路径验证、git diff --check，按需要补充截图，更新 checklist 和 tasks/todo.md Review，并单独提交。
```

## 2026-05-16 UI-6 Welcome / Chat 回退 / File Browser 计划

- [x] 检查 `git status --short`，确认只保护 `.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 和 UI visual spec swap 文件。
- [x] 复习 `AGENTS.md`、`tasks/lessons.md`、UI checklist 的 UI-6 阶段、视觉规范 `5.5` / `5.6` / `5.7` / `5.8`。
- [x] 做 UI-6 before 审计，记录 Welcome / Onboarding、Chat 回退、File Browser 当前结构、状态表达、focus 和溢出风险。
- [x] 优化 Welcome / Onboarding：首次启动与空态聚焦环境 / 模型配置后进入 Pipeline / Agent，动作不超过三个，环境问题优先。
- [x] 优化 Chat 回退：ChatInput 对齐 Agent Composer 密度和语义，ChatMessage / tool activity 状态色与折叠语言收敛，隐藏回退定位不视觉割裂。
- [x] 优化 File Browser：文件树 row hover / selected / focus、treeitem 语义、路径 chip、rename / delete confirm、empty folder、recently modified indicator。
- [x] 补 UI-6 聚焦测试或可验证模型，覆盖 Welcome 动作、Chat tool activity tone、File Browser tree / danger copy / path display。
- [x] 递增受影响 package patch 版本并同步锁文件。
- [x] 运行 `bun run --filter='@codeinsights/electron' typecheck`、相关聚焦测试或手动路径验证、`git diff --check`。
- [x] 采集 light / dark / 特殊主题截图，更新 UI checklist 与本地 Review，单独提交 UI-6。

## 2026-05-16 UI-6 Before 审计

- Welcome / Onboarding：`WelcomeView` 当前没有真正空态，只在无 tab 时自动复用或创建 draft，并短暂显示 spinner；`WelcomeEmptyState` 仍是问候 + tip + Agent/Pipeline segmented control，缺“新建 Pipeline / 新建 Agent / 打开设置”直接动作，也没有隐藏 Chat 回退定位说明。`OnboardingView` 是全屏渐变 hero + 教程卡片，Windows 环境检查在第二步才出现，环境问题不够早；按钮可聚焦但教程卡和主动作层级偏营销化。
- Chat 回退 message list：已使用 `ai-elements/message` primitive，但空态复用旧 Welcome 问候，未说明 Chat 是隐藏回退；user / assistant 消息 action hover 依赖较重，错误块和 stopped 文案仍使用局部 raw tone，长 tool result / 错误文本有 break-all 但整体 tool block 层级与 Agent ToolActivity 不一致。
- Chat 回退 composer：`ChatInput` 仍保留 Cherry Studio 风格 `rounded-[17px]`、`border-[0.5px]`、raw green drag over 和 36px 圆形按钮，和 UI-4 Agent Composer 的 token / focus / disabled 语言不完全一致；附件、思考、停止、发送有 tooltip 但 icon button 缺明确 `aria-label`，左侧工具在窄宽可能挤压。
- Chat tool activity：`ChatToolActivityIndicator` 仅把 start/result 合并后交给 `ChatToolBlock`，状态色与 Agent `getToolActivityTone` 未共享；运行 / 成功 / 错误主要由 block 内部决定，折叠和 summary 密度与 Agent 工具活动不一致。
- File Browser selected / hover：文件行是 `div` + click，行高由 `py-1` 自然撑开，hover `accent/50`、selected `accent`，缺左侧 accent bar；row 本身不可 tab focus，键盘只能进入行内按钮 / 菜单，tree / treeitem 语义缺失。
- File Browser rename：原位 input 有 Enter / Escape / blur 保存，错误就近显示；但重命名前没有展示完整路径或确认，长路径只在浏览器 title / truncate 中出现，focus ring 只靠 border，保存失败会撑高行。
- File Browser delete confirm：已用 AlertDialog，但说明只展示名称或数量，没有完整路径列表，删除失败只 `console.error` 且弹窗关闭；危险按钮缺 loading / 防重复点击，批量删除误操作风险较高。
- File Browser empty folder / overflow：根目录空态是居中文案“目录为空”，子目录为空是行内“空文件夹”，文案和规范不一致；长文件名 truncate 但无 tooltip，root path breadcrumb 是尾部两段，缺 monospace path chip 和完整路径 hover。recently modified indicator 有 `aria-label` 但不是 tooltip，且只用小点表达。

## 2026-05-16 UI-6 Welcome / Chat 回退 / File Browser Review

- UI-6 已完成：WelcomeEmptyState 改为 3 个直接动作（进入 Pipeline / 进入 Agent / 打开设置），补充 Chat 隐藏回退定位；Onboarding 去除大面积渐变 hero，前置 Windows 环境问题说明，教程入口降为次级动作。
- Chat 回退已收敛：ChatInput 容器改用 `rounded-card`、`border-border-subtle`、`bg-surface-card`、focus ring 和横向工具栏溢出策略；发送 / 停止 / 附件 / thinking icon button 补 `aria-label`；ChatToolBlock 使用 UI-6 tone 映射对齐 Agent 工具状态色。
- File Browser 已收敛：根路径 chip 使用 monospace 和中间省略；文件树加入 `tree` / `treeitem` / `group` 语义，row 可 focus，支持 Enter / Space 选择或展开、ArrowRight / ArrowLeft 展开折叠；selected 增加 primary soft 背景和左侧 accent；最近修改标记补 tooltip。
- File Browser 危险操作已优化：删除确认展示完整路径或多选路径列表，删除失败留在弹窗内 inline 展示，删除中禁用关闭路径；rename 父路径计算兼容 POSIX / Windows separator，rename error 不再在 blur 时立即消失。
- 代码审查后已修复：ARIA tree 容器不再包含 alert/status/empty 普通节点，展开子项包在 `role="group"`；Welcome “新建”文案改为“进入”，避免和实际 setMode 行为不一致；添加到聊天按钮从 `invisible` 改为 opacity 控制，键盘 focus 可达。
- `@codeinsights/electron` 版本 `0.0.62 -> 0.0.63`，`bun.lock` workspace metadata 已同步。
- 验证通过：UI-6 聚焦测试 4 pass、`bun run --filter='@codeinsights/electron' typecheck`、`bun install --frozen-lockfile --dry-run`、`git diff --check`。
- 截图已采集：`welcome-light-first-run-desktop.png`、`welcome-dark-config-missing-desktop.png`、`chat-slate-message-list-desktop.png`、`chat-slate-tool-activity-desktop.png`、`file-browser-forest-selected-desktop.png`、`file-browser-forest-delete-confirm-desktop.png`。
- 本阶段不修改 README / AGENTS，不新增 public API / IPC / shared type，不改变文件读写安全边界；`.DS_Store` 和 UI spec swap 文件继续保护不纳入提交。

## 2026-05-16 UI-5 后进度文档同步计划

- [x] 检查 `git status --short`，确认当前只剩 `.DS_Store` 和 UI visual spec swap 文件需要保护。
- [x] 更新 UI implementation checklist 的最新状态快照，明确 UI-5 commit `8362e8b4` 已完成并提交。
- [x] 更新阶段进度表、截图矩阵和当前启动提示，明确 UI-0 到 UI-5 已完成，UI-6 到 UI-7 未完成。
- [x] 将下次启动提示词改为 UI-6「Welcome / Chat 回退 / File Browser」，避免下次重复 UI-5。
- [x] 保持 README / AGENTS 不变，只更新 UI 进度跟踪文档和本地任务记录。

## 2026-05-16 UI-5 后进度文档同步 Review

- 已同步 `improve/ui/2026-05-16-client-ui-implementation-checklist.md`：UI-5 commit 为 `8362e8b4`，提交标题为 `style(settings): 统一设置界面表单与危险操作`。
- 当前完成阶段：UI-0、UI-1、UI-2、UI-3、UI-4、UI-5；未完成阶段：UI-6、UI-7。
- UI-5 已完成 SettingsDialog / SettingsPanel 导航、Settings primitives、ChannelSettings / ChannelForm、AgentSettings、McpServerForm、About / Update、危险操作和错误反馈层级收敛。
- UI-5 验证记录：Settings 聚焦测试 7 pass、`bun run --filter='@codeinsights/electron' typecheck`、`git diff --check`、`bun install --frozen-lockfile --dry-run`。
- UI-5 截图记录：`settings-light-channel-form-desktop.png`、`settings-dark-validation-error-desktop.png`、`settings-slate-danger-dialog-desktop.png`、`settings-slate-update-desktop.png`。
- 下次启动应从 UI-6「Welcome / Chat 回退 / File Browser」开始，先做长尾页面 before 审计，再优化 Welcome / Onboarding 空态、旧 Chat 回退视觉、File Browser 文件树 / rename / delete confirm / empty folder。
- 当前仍需保护 `.DS_Store` 与 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp`，不要纳入阶段提交。

## 下次启动提示词（UI-6）

```text
你正在 CodeInsights 仓库继续推进全客户端 UI 优化。

请先阅读并遵守：
- AGENTS.md
- tasks/lessons.md
- tasks/todo.md
- improve/ui/2026-05-16-client-ui-visual-spec.md
- improve/ui/2026-05-16-client-ui-implementation-checklist.md

当前进度：
1. UI 文档基线已完成并提交：7bef500c，docs(ui): 新增客户端 UI 视觉规范与迭代清单。
2. UI-0 已完成并提交：61c263c8，docs(ui): 完成 UI-0 基线审计与截图。
3. UI-1 已完成并提交：20a90d36，feat(ui): 完成 UI-1 token 与 primitive 收敛。
4. UI-2 已完成并提交：c3636336，style(ui): 统一 AppShell 导航与标签状态。
5. UI-3 已完成并提交：3881eb10，style(pipeline): 优化 Pipeline 工作台状态层级。
6. UI-4 已完成并提交：b28ac9df，style(agent): 优化 Agent 消息工具与交互状态。
7. UI 截图索引已提交：1d78bf66，docs(ui): 补充 UI 截图索引说明。
8. UI-5 已完成并提交：8362e8b4，style(settings): 统一设置界面表单与危险操作。
9. 已完成：UI-0、UI-1、UI-2、UI-3、UI-4、UI-5。未完成：UI-6、UI-7。
10. 当前工作区可能存在 .DS_Store 修改和 improve/ui/.2026-05-16-client-ui-visual-spec.md.swp，不要纳入提交。

请从 UI-6「Welcome / Chat 回退 / File Browser」开始：
1. 先执行 git status --short，保护已有用户变更。
2. 阅读 checklist 的 UI-6 阶段和视觉规范中 Welcome / Onboarding、Chat 回退、File Browser 相关部分，以及 5.8 页面级 Wireframe 对应说明。
3. 先做 UI-6 before 审计，记录 Welcome / Onboarding 空态、Chat 回退 message list / composer / tool activity、File Browser selected / hover / rename / delete confirm / empty folder 的当前结构、状态表达、focus 和溢出风险。
4. 不要回头重复 UI-2 / UI-3 / UI-4 / UI-5；AppShell、Sidebar、Tab、Pipeline 主面板、Agent 工作区和 Settings 管理界面已完成。
5. 不新增 public API / IPC / shared type；不修改 README / AGENTS，除非用户明确允许。
6. UI-6 完成定义：Welcome / Onboarding 空态、Chat 回退、File Browser 文件树与危险确认在 light / dark / 至少一个特殊主题下层级清楚、focus 可见、无明显文本或路径溢出。
7. 完成 UI-6 后运行 typecheck、相关聚焦测试或手动路径验证、git diff --check，采集 light / dark / 特殊主题截图，更新 checklist 和 tasks/todo.md Review，并单独提交。
```

## 2026-05-16 UI-5 Settings 管理界面计划

- [x] 复习 `AGENTS.md`、`tasks/lessons.md`、`tasks/todo.md`、UI checklist 与视觉规范 `5.4 Settings` / `5.8 Settings Wireframe`。
- [x] 执行 `git status --short`，确认需保护 `.DS_Store` 与 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp`。
- [x] 做 UI-5 before 审计，记录 Settings primitives、ChannelSettings、ChannelForm、AgentSettings、McpServerForm、About / Update 与危险操作问题。
- [x] 优化 SettingsDialog / SettingsPanel 导航、当前 tab、状态点、scroll 容器和关闭 / 未保存拦截文案。
- [x] 收敛 Settings primitives：SettingsSection / Card / Row 支持窄宽换行、control 宽度、helper / error / feedback 语义。
- [x] 优化 Channels：渠道列表操作可见性、删除确认、API Key / Base URL / 连接测试错误就近反馈。
- [x] 优化 Agent：工作区、MCP、Skills、本地路径、删除 / 导入 / 同步反馈和危险操作确认。
- [x] 优化 About / Update：版本、环境检测、更新状态与下载入口层级。
- [x] 补 Settings 聚焦测试，覆盖导航状态、primitive 布局、危险操作和表单反馈模型。
- [x] 运行 typecheck、Settings 聚焦测试、`git diff --check`，采集 light / dark / 特殊主题截图。
- [x] 更新 UI checklist 与本地 Review，单独提交 UI-5。

## 2026-05-16 UI-5 Before 审计

- SettingsDialog / SettingsPanel：Dialog 宽高接近规范但固定 `85vh`，窄宽时左侧导航 160px + 右侧内容可能压缩表单；关闭按钮缺 `aria-label`；about tab 的红点没有 tooltip 或可读说明；导航按钮缺 `aria-current`，状态点只靠颜色表达。
- Settings primitives：`SettingsRow` 固定横向 `label/control`，右侧控件 `flex-shrink-0`，长 Base URL、MCP command、Skills 路径和多按钮操作在窄窗口下有挤压风险；`SettingsCard` 会自动分隔所有子节点，容易把非 row 提示也切成装饰层；字段 helper / error / feedback 语义分散在调用点。
- ChannelSettings：渠道行编辑 / 删除按钮只在 hover 显示，键盘用户不易发现；删除确认已用 AlertDialog，但文案未说明影响范围，确认按钮非 destructive loading 状态；删除失败只写日志，缺 inline feedback。
- ChannelForm：API Key 有持久 label 和隐藏默认值，但显示按钮无可访问名称且 `tabIndex=-1`；创建必填错误主要靠 disabled / toast，字段附近缺错误；测试连接结果靠局部 raw 颜色；模型列表长 ID、手动添加双输入在窄宽下易挤压。
- AgentSettings：工作区 / MCP / Skills 结构存在但本地路径和来源信息层级偏弱；MCP 与 Skill 删除使用原生 `confirm()`，不符合危险操作规范；行内操作多为 hover 才显现且缺 `aria-label`；长 command/url/description 主要 truncate，缺 tooltip 或 path chip。
- McpServerForm：command、env、headers 有 label/helper，但必填错误靠 disabled / return，未就近说明；测试成功/失败使用 raw green/red；textarea 可能显示 token 明文，截图风险需避免默认明文；返回 icon 按钮缺 `aria-label`。
- About / Update：更新和环境检测功能完整，但按钮使用裸 `button` class，状态与 Settings Button / feedback 语义不统一；release notes 长内容在卡片内展开后可能造成局部滚动压力；检查失败只显示短文案，错误详情依赖 title。
- 危险操作：渠道删除有 AlertDialog；未保存离开有 AlertDialog；MCP / Skill 删除仍是 `confirm()`；cancel 默认焦点大体安全，但 destructive action 未统一 `destructive` variant，也未防重复点击。

## 2026-05-16 UI-5 Settings 管理界面 Review

- UI-5 已完成：SettingsDialog 改为稳定 `min(88vh, 752px)` / `min(92vw, 1000px)` 尺寸，Settings nav 增加 tab 描述、`aria-current`、about 状态图标说明，关闭按钮补 `aria-label`。
- Settings primitives 已收敛：SettingsRow 支持窄宽上下排列和 control 换行；SettingsInput / Select / Toggle 补 label、helper、error 语义；新增 SettingsTextarea 统一 MCP env / headers 多行输入。
- Channels 已优化：渠道编辑 / 删除 / toggle 补键盘 focus 和 `aria-label`；渠道删除 AlertDialog 说明影响范围、loading 防重复点击、失败留在弹窗内 inline 展示；ChannelForm API Key、创建必填、模型列表和测试反馈更靠近字段。
- Agent / MCP / Skills 已优化：MCP / Skill 删除从原生 `confirm()` 改为 AlertDialog；删除失败 inline 展示；MCP command / env / headers 有 helper；行内 icon 操作补可访问名称和 focus 可见性。
- 代码审查后已修复：Radix `AlertDialogAction` 异步删除提前关闭问题；可用模型行嵌套交互控件问题；about 状态 icon 增加 `role="img"`。
- `@codeinsights/electron` 版本 `0.0.61 -> 0.0.62`，`bun.lock` workspace metadata 已同步。
- 验证通过：Settings 聚焦测试 7 pass、`bun run --filter='@codeinsights/electron' typecheck`、`git diff --check`。
- 截图已采集：`settings-light-channel-form-desktop.png`、`settings-dark-validation-error-desktop.png`、`settings-slate-danger-dialog-desktop.png`、`settings-slate-update-desktop.png`。
- 本阶段不修改 README / AGENTS，不新增 public API / IPC / shared type，不改变配置存储结构；`.DS_Store` 和 UI spec swap 文件继续保护不纳入提交。

## 2026-05-16 UI-4 后进度文档同步计划

- [x] 检查 `git status --short`，确认当前仅有 `.DS_Store` 和 visual spec swap 文件需要保护。
- [x] 更新 UI implementation checklist 的最新状态快照，写明 UI-4 commit `b28ac9df` 与截图索引 commit `1d78bf66`。
- [x] 更新阶段进度表和下次启动提示词，明确 UI-0 到 UI-4 已完成，UI-5 到 UI-7 未完成。
- [x] 保持下次启动范围从 UI-5 Settings 管理界面开始，不回头重复 UI-2 / UI-3 / UI-4。

## 2026-05-16 UI-4 后进度文档同步 Review

- 已同步 `improve/ui/2026-05-16-client-ui-implementation-checklist.md`：UI-4 commit 为 `b28ac9df`，截图索引 commit 为 `1d78bf66`。
- 当前完成阶段：UI-0、UI-1、UI-2、UI-3、UI-4；未完成阶段：UI-5、UI-6、UI-7。
- 下次启动应从 UI-5「Settings 管理界面」开始，先做 Settings before 审计，再优化 Settings primitives、渠道表单、Agent 配置、MCP / Skills、危险操作和错误反馈。
- 当前仍需保护 `.DS_Store` 与 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp`，不要纳入阶段提交。

## 2026-05-16 UI-4 Agent 阅读与交互计划

- [x] 复习 `AGENTS.md`、`tasks/lessons.md`、`tasks/todo.md`、UI checklist 与视觉规范 `5.3 Agent` / `5.8 页面级 Wireframe`。
- [x] 执行 `git status --short`，确认需保护 `.DS_Store`、UI checklist 既有改动和 spec swap 文件。
- [x] 做 UI-4 before 审计，记录 AgentHeader、AgentMessages、ToolActivityItem、PermissionBanner、AskUserBanner、AgentComposer 当前问题。
- [x] 补 Agent UI 聚焦测试，覆盖 header meta、banner tone、tool activity 状态、composer 锁定说明。
- [x] 实现 UI-4：Agent banner zone 上移、header meta、message 阅读宽度、ToolActivity 状态、Permission / AskUser / ExitPlan / PlanMode banner 与 Composer 稳定性。
- [x] 递增 `@codeinsights/electron` patch 版本并同步锁文件。
- [x] 运行 typecheck、Agent 聚焦测试、`git diff --check`，采集 light / dark / 特殊主题截图。
- [x] 更新 UI checklist 和本地 Review，单独提交 UI-4。

## 2026-05-16 UI-4 Before 审计

- AgentHeader：当前只展示可编辑标题和文件面板按钮，没有 workspace / channel / model / permission mode 的轻量 meta；编辑确认 / 取消按钮缺少可见 tooltip，文件面板按钮缺少明确 `aria-label`。
- AgentMessages：消息流与 banner 顺序不符合 wireframe，Permission / AskUser / PlanMode 当前位于消息流下方；长回复阅读宽度依赖外层 72rem，代码块与表格会被 `MessageContent overflow-hidden` 截断风险放大。
- ToolActivityItem：running / completed / background / error 使用分散 raw color class，状态行点击按钮缺少 `aria-label`，失败只显示 `Error` badge，摘要和完整输出层级不够稳定。
- PermissionBanner：视觉是浮起卡片而非 banner zone；缺 `aria-live`，关闭按钮只靠 `title`，工具名 / 命令摘要在长路径下容易挤压操作按钮。
- AskUserBanner：视觉语言与 Permission / ExitPlan 相似但未抽象统一；横幅内 tab / option class 使用模板字符串和强 primary 块，长问题或选项说明有横向挤压风险；缺 `aria-live`。
- AgentComposer：AskUser / ExitPlan 出现时整个输入区被隐藏，造成底部高度跳动；发送 / 停止 / 附件等 icon button 部分缺 `aria-label`；拖拽态使用裸色值；disabled 原因只在顶部提示，不统一为稳定 notice。

## 2026-05-16 UI-4 Agent 阅读与交互 Review

- UI-4 已完成：AgentHeader 增加 workspace / model / permission / running meta；Permission、AskUser、PlanMode、ExitPlanMode 统一移动到 header 下方 banner zone；Composer 不再因交互 banner 消失，改为稳定展示并显示锁定原因。
- ToolActivity 状态色收敛到 running / success / waiting / danger semantic token；工具详情、展开按钮、复制按钮补 focus / aria；消息内容改为 `overflow-visible`，表格支持横向滚动。
- 新增 `agent-ui-model.ts` 和聚焦测试，覆盖 header meta、banner tone、tool tone 和 composer disabled / interrupt send 状态。
- 代码审查后已修复：交互锁进入 `handleSend` 守卫，Permission pending 也会锁住 Composer，附件按钮 / 粘贴 / 拖拽跟随锁定状态；Permission / AskUser / ExitPlan 多横幅同屏时只有最高优先级横幅响应全局快捷键；AskUser 多问题提交要求全部问题已回答。
- `@codeinsights/electron` 版本 `0.0.60 -> 0.0.61`，`bun.lock` workspace metadata 已同步。
- 验证通过：Agent 聚焦测试 11 pass、`bun run --filter='@codeinsights/electron' typecheck`、`bun install --frozen-lockfile --dry-run`、`git diff --check`。
- 截图已采集：`agent-ui4-light-empty-desktop.png`、`agent-ui4-dark-permission-desktop.png`、`agent-ui4-ocean-planmode-desktop.png`。
- 临时 renderer harness 已删除；本阶段不修改 README / AGENTS，不新增 public API / IPC / shared type，不改 Agent SDK 编排或持久化语义。

## 2026-05-16 UI-3 后进度文档同步计划

- [x] 检查 `git status --short`，确认只存在 `.DS_Store` 和 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp` 本地噪声需要保护。
- [x] 更新 UI implementation checklist 顶部状态快照，明确 UI-0、UI-1、UI-2、UI-3 已完成并提交。
- [x] 补齐 UI-3 阶段 Review，写明 commit、涉及文件、验证命令、截图路径、未覆盖范围和残留风险。
- [x] 更新 checklist 的下次启动提示词，明确下一阶段从 UI-4 Agent 阅读与交互开始。
- [x] 执行文档校验和 `git diff --check`，确认没有格式问题。

## 2026-05-16 UI-3 后进度文档同步 Review

- 已更新 `improve/ui/2026-05-16-client-ui-implementation-checklist.md`：最新状态改为 UI-3 完成并提交，UI-3 commit 为 `3881eb10`。
- 已标注已完成阶段：UI-0、UI-1、UI-2、UI-3；未完成阶段：UI-4、UI-5、UI-6、UI-7。
- 已补齐 UI-3 Review：Pipeline 主面板与 v2 右侧操作面板已收敛，验证为 Pipeline 聚焦测试 25 pass、Electron typecheck、`git diff --check` / `git diff --cached --check`。
- 下次启动应直接从 UI-4「Agent 阅读与交互」开始，先做 Agent before 审计，再改 Agent Message、ToolActivity、Composer、Permission / AskUser / PlanMode 和后台权限路径。
- 本次只更新进度跟踪文档，不修改 README / AGENTS，不新增 public API / IPC / shared type。

## 计划

- [x] 复习项目 lessons 状态：当前未发现 `tasks/lessons.md`，本次没有用户纠正需要记录。
- [x] 梳理当前 Pipeline 后端编排、节点 runner、artifact、gate、checkpoint 实现。
- [x] 梳理当前 Pipeline UI、Jotai 状态、IPC/preload 与人工审核体验。
- [x] 对照目标六 Agent 开源贡献工作流，列出缺口、优先级与改造路径。
- [x] 在 `improve/pipeline/` 下生成 markdown 分析文档。
- [x] 校验文档存在性和关键内容，并在本文末尾追加 review。

## Review

- 已生成 `improve/pipeline/2026-05-13-six-agent-contribution-pipeline-analysis.md`。
- 已覆盖后端五节点现状、Codex/Claude 路由差距、`patch-work` 产物契约、UI/IPC 缺口、六 Agent 路线图、BDD 验收场景和关键风险。
- 已执行文件存在性、行数和关键词校验；本次是分析文档任务，未运行应用测试。

## 2026-05-13 方案深化计划

- [x] 复核现有六 Agent Pipeline 分析文档结构。
- [x] 补充 Pipeline v2 产品边界、术语和阶段状态定义。
- [x] 补充 Contribution / patch-work / artifact / gate / event 的详细数据契约。
- [x] 补充 LangGraph 状态机、runner 路由、prompt、CLI 权限和失败循环细节。
- [x] 补充 UI 工作台、IPC、持久化、测试矩阵和实施拆分。
- [x] 校验文档关键词和结构，并追加本轮 review。

## 2026-05-13 方案深化 Review

- 已将 `improve/pipeline/2026-05-13-six-agent-contribution-pipeline-analysis.md` 扩展为 Pipeline v2 详细规格。
- 新增内容覆盖产品边界、启动输入、ContributionTask、PatchWorkManifest、Explorer/Planner/Developer/Reviewer/Tester/Committer 细分契约、gate kind、stream event、IPC、UI 工作台、持久化、Git service、安全策略、prompt、错误恢复、测试矩阵、分阶段实施、迁移和配置项。
- 已执行结构与关键词校验；本次仍为方案文档完善，未运行应用测试。

## 2026-05-13 二次优化计划

- [x] 复核现有 Pipeline v2 方案是否遗漏实现阶段风险。
- [x] 补充工作区隔离、Git 污染控制和 `patch-work` 提交边界。
- [x] 补充 LangGraph 状态幂等、恢复、路由和人工 gate 细化建议。
- [x] 补充 CLI 预检、运行预算、观测性、提示词注入防护和质量门禁。
- [x] 补充更清晰的 MVP 切片、里程碑验收和实现顺序。
- [x] 校验文档新增章节并追加本轮 review。

## 2026-05-13 二次优化 Review

- 已在 `improve/pipeline/2026-05-13-six-agent-contribution-pipeline-analysis.md` 追加“二次评估与优化方案”。
- 新增内容覆盖 preflight、工作区隔离、`patch-work` 不进入默认补丁、revision/原子写入、LangGraph raw state、节点幂等、gate 消息线程、CLI 进程监督、预算、提示词注入防护、committer 职责拆分、tester/reviewer 修复边界、观测性、三类数据源边界、UI 启动表单、MVP-A/B/C 和新版 Phase 顺序。
- 已执行 `git diff --check` 和关键词检索校验；本次仍是方案文档优化，未运行应用测试。

## 2026-05-13 阶段开发清单计划

- [x] 基于 Pipeline v2 方案生成独立阶段开发跟踪清单。
- [x] 在清单中明确阶段入口条件、开发任务、验收标准、测试命令和禁止跨越规则。
- [x] 覆盖 Phase 0 到 Phase 8，并标注 MVP-A/B/C 边界。
- [x] 校验清单文档存在、关键章节完整，并追加本轮 review。

## 2026-05-13 阶段开发清单 Review

- 已生成 `improve/pipeline/2026-05-13-six-agent-pipeline-development-checklist.md`。
- 清单覆盖强制开发规则、MVP-A/B/C 边界、全局完成定义、Phase 0-8 阶段任务、每阶段入口条件、建议文件、测试命令、完成定义和禁止事项。
- 已执行 `git diff --check`、章节关键词检索和文件行数校验；本次为文档清单任务，未运行应用测试。

## 2026-05-13 Phase 0 规格冻结计划

- [x] 复习 `AGENTS.md`、本任务清单和 Pipeline v2 分析文档。
- [x] 检查 `git status`，确认没有未提交的用户改动需要保护。
- [x] 验证分析文档是否覆盖状态机 Mermaid、节点契约、BDD 场景、fixture repo 和 v1/v2 共存。
- [x] 在分析文档补充 Phase 0 冻结确认，不修改运行时代码。
- [x] 更新阶段开发清单中的 Phase 0 状态。
- [x] 执行 `git diff --check` 和关键词检索。

## 2026-05-13 Phase 0 Review

- Phase 0 已冻结：现有分析文档已覆盖状态机、节点 runtime / 输入 / 输出 / gate / 失败循环 / 产物文件，并补充 fixture repo 与 v1/v2 共存结论。
- 已将 `improve/pipeline/2026-05-13-six-agent-pipeline-development-checklist.md` 标记为 Phase 0 完成、Phase 1 开始。
- 本阶段只改 `improve/pipeline/` 文档，不涉及 package version 变更，不改 README / AGENTS，不改运行时代码。

## 2026-05-13 Phase 1 计划

- [x] 先补测试：`ContributionTask` 持久化、`patch-work` manifest/revision/路径安全、preflight blocker。
- [x] 新增 `ContributionTask` / `PatchWorkManifest` / preflight 相关共享类型。
- [x] 新增 `contribution-task-service.ts`，使用 JSON 索引和 JSONL event。
- [x] 新增 `pipeline-patch-work-service.ts`，支持固定文件、manifest、checksum、revision、原子写入和路径安全。
- [x] 新增 `pipeline-preflight-service.ts`，检查 Git root、branch、remote、未提交变更、冲突、Claude CLI、Codex CLI、Git、包管理器。
- [x] 递增受影响 package patch version。
- [x] 运行 Phase 1 指定测试、`bun run typecheck` 和 `git diff --check`，通过后追加 Review。

## 2026-05-13 Phase 1 Review

- 已完成 Phase 1，不修改六节点 graph、不改 UI、不实现远端 GitHub 行为、不改 `.gitignore`。
- 新增 `ContributionTask`、`PatchWorkManifest`、`PipelinePreflightResult` 等共享类型；`@codeinsights/shared` 版本 `0.1.25 -> 0.1.26`。
- 新增 `contribution-task-service.ts`，支持 `contribution-tasks.json` 索引、`contribution-tasks/{taskId}.jsonl` 事件、运行时 enum/schema 校验和坏行容错。
- 新增 `pipeline-patch-work-service.ts`，支持 manifest、固定文件、checksum、revision 归档和原子写入；路径安全覆盖绝对路径、`..`、文件/目录 symlink、manifest/tmp/bak symlink、dangling symlink、保留路径。
- 新增 `pipeline-preflight-service.ts`，覆盖 Git root/branch/remote/dirty/conflict、Claude CLI、Codex CLI、Git 和包管理器识别；resolver 异常会转换为稳定 blocker。
- `@codeinsights/electron` 版本 `0.0.46 -> 0.0.47`，`bun.lock` workspace 版本元数据已同步。
- 已新增 `tasks/lessons.md`，记录本轮路径安全和运行时校验教训。
- 验证通过：Phase 1 + v1 graph 兼容测试 35 pass、`bun run typecheck`、`git diff --check`、`bun install --frozen-lockfile --dry-run`、代码复审无阻塞问题。
- 全量 `bun test` 已运行，结果 264 pass / 1 fail；失败为既有 `apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts` Electron named export 测试环境问题，未指向本次 Phase 1 改动。

## 2026-05-14 进度文档更新计划

- [x] 检查 `git status`，确认 Phase 1 已提交后没有待保护的 tracked 改动。
- [x] 更新 Pipeline v2 checklist，明确 Phase 0/1 已完成、Phase 2-8 未完成、下一步只能进入 Phase 2。
- [x] 在分析规格文档中补充当前实现状态指针，避免下次启动误读为已进入源码开发后续阶段。
- [x] 在 checklist 中追加下次启动提示词，便于新会话按当前进度继续。
- [x] 执行文档校验并追加 Review。

## 2026-05-14 进度文档更新 Review

- 已更新 `improve/pipeline/2026-05-13-six-agent-pipeline-development-checklist.md` 的最新状态快照和下次启动提示词。
- 已更新 `improve/pipeline/2026-05-13-six-agent-contribution-pipeline-analysis.md`，声明当前实现进度以 checklist 为准：Phase 0/1 已完成，Phase 2 尚未开始。
- 本轮只修改跟踪文档和本地任务记录，不进入 Phase 2，不修改 README / AGENTS，不改运行时代码。

## 2026-05-14 Phase 2 计划

- [x] 复习 `AGENTS.md`、`tasks/lessons.md`、`tasks/todo.md`、Pipeline v2 checklist 和分析文档 Phase 2 内容。
- [x] 检查 `git status`，确认当前待保护改动只涉及 Pipeline 进度文档。
- [x] 将 checklist 中 Phase 2 “阶段开始”和入口条件标记为已开始 / 已满足。
- [x] 先补 Phase 2 测试：shared state replay、v1/v2 graph、runner router strategy、StageRail display model。
- [x] 实现 shared v2 类型：`version?: 1 | 2`、`committer` 节点、v2 stage output、v2 gate kind。
- [x] 实现 state replay 的 v1/v2 分支，保持 v1 records replay 不变。
- [x] 实现 v2 fake graph 或 builder，让 tester approve 后进入 committer，不替换 v1 graph。
- [x] 实现 runner strategy 表驱动映射：explorer/planner 使用 Claude，developer/reviewer/tester/committer 使用 Codex。
- [x] 更新六节点 display model，不做 UI 大改。
- [x] 递增受影响 package patch version。
- [x] 运行 Phase 2 指定测试、`bun run typecheck` 和 `git diff --check`，通过后追加 Review。

## 2026-05-14 Phase 2 Review

- Phase 2 已完成并已提交，commit `53119675ee4f975f463f7214d2b00a2ae9e0c4a5`（`feat(pipeline): 接入 Phase 2 六 Agent v2 骨架`）；未进入 Phase 3。
- 新增 Pipeline v2 共享契约：`PipelineVersion`、`PipelineSessionMeta.version`、`PipelineStateSnapshot.version`、`committer` 节点、v2 gate kind、explorer/planner/developer/reviewer/tester/committer 扩展 stage output。
- `pipeline-state` 支持 v1/v2 replay 分支：v1 tester approve 仍 completed；v2 tester approve 进入 committer，committer approve 后 completed。
- 新增 `createPipelineGraphV2`，保留 `createPipelineGraph` v1；v2 fake runner happy path 覆盖 explorer -> planner -> developer -> reviewer -> tester -> committer。
- 新增 `pipeline-node-router.test.ts`，runner strategy 表驱动：v1 保护 tester=Claude，v2 explorer/planner=Claude、developer/reviewer/tester/committer=Codex。
- StageRail display model 支持 v2 六节点展示，`PipelineStageRail` / `PipelineGateCard` 接收 version；没有做 Phase 3 UI 大改。
- 代码审查后已修复两个契约风险：v2 explorer gate kind 改为 `task_selection`，gate decision record 持久化 `kind`、`selectedReportId`、`submissionMode`。
- `@codeinsights/shared` 版本 `0.1.26 -> 0.1.27`，`@codeinsights/electron` 版本 `0.0.47 -> 0.0.48`，`bun.lock` workspace metadata 已同步。
- 验证通过：Phase 2 指定测试 + service/runner 补充测试 72 pass、`bun run typecheck`、`git diff --check`、`bun install --frozen-lockfile --dry-run`。
- 代码审查复核通过：两个 MEDIUM finding 已解决，无阻塞 finding。
- 全量 `bun test` 已运行，结果 274 pass / 1 fail / 1 error；失败仍为既有 `apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts` Electron named export 测试环境问题，未指向 Phase 2 改动。

## 2026-05-14 Phase 2 提交后进度文档更新计划

- [x] 检查 `git status`，确认 Phase 2 已提交后没有待保护的 tracked 改动。
- [x] 更新 Pipeline v2 checklist，明确 Phase 2 已提交、Phase 3 尚未开始、下一步只能进入 Phase 3。
- [x] 更新分析规格文档“当前实现进度”，避免下次启动误读为 Phase 2 未提交。
- [x] 更新本地 todo，记录 Phase 2 commit 和后续开发边界。
- [x] 执行文档校验并追加 Review。

## 2026-05-14 Phase 2 提交后进度文档更新 Review

- 已同步 `improve/pipeline/2026-05-13-six-agent-pipeline-development-checklist.md`：最近阶段提交更新为 `53119675ee4f975f463f7214d2b00a2ae9e0c4a5`，Phase 2 标记为已完成并提交，Phase 3 仍未开始。
- 已同步 `improve/pipeline/2026-05-13-six-agent-contribution-pipeline-analysis.md`：当前实现进度改为 Phase 2 已完成并提交。
- 后续启动只能从 Phase 3 开始：先写 Phase 3 计划并标记 checklist，再先补测试 / BDD 场景，随后实现 Explorer 任务选择、Planner 文档审核和 patch-work IPC / preload / UI board。
- 阶段完成纪律已明确：每完成一个阶段并满足完成定义后，自动单独提交；不默认 push 或创建 PR。

## 2026-05-14 Phase 3 计划

- [x] 复习 `AGENTS.md`、`tasks/lessons.md`、`tasks/todo.md`、Pipeline v2 checklist 和分析文档 Phase 3 相关内容。
- [x] 检查 `git status`，确认当前待保护改动只涉及 Pipeline 进度文档。
- [x] 将 checklist 中 Phase 3 “阶段开始”和入口条件标记为已开始 / 已满足。
- [x] 先补 Phase 3 测试 / BDD 场景：explorer task selection、planner document gate、patch-work IPC、`ExplorerTaskBoard`、`ReviewDocumentBoard`。
- [x] 扩展 shared / main 契约：explorer report refs、task selection gate、planner document refs / checksum / revision 反馈。
- [x] 扩展 `pipeline-patch-work-service`：读取 manifest、读取安全文件、列 explorer reports、选择 report 并生成 / 更新 `selected-task.md`。
- [x] 接入 IPC 与 preload：读取 patch-work manifest / 文件 / explorer reports / select-task，保持主 UI 使用结构化 IPC，不从 records 反推业务状态。
- [x] 扩展 v2 graph / runner 测试桩：explorer 输出多份 `patch-work/explorer/report-*.md`，用户选择 report 后才能进入 planner，planner 读取 `selected-task.md` 并写 `plan.md` / `test-plan.md`。
- [x] 新增 `ExplorerTaskBoard` 和 `ReviewDocumentBoard` 初版 UI，使用 Pipeline Jotai 状态和结构化 IPC 调用。
- [x] 递增受影响 package patch version。
- [x] 运行 Phase 3 指定测试、`bun run typecheck`、`git diff --check` 和必要的锁文件校验，通过后追加 Review 并单独提交 Phase 3。

## 2026-05-14 Phase 3 Review

- Phase 3 已完成实现和最终复核，等待本轮单独提交。
- 新增 patch-work 结构化读取与选择能力：manifest / 文件读取、explorer reports 列表、select task 写 `selected-task.md`、planner 文档 accepted revision / checksum 记录。
- v2 explorer 会把结构化候选写到 `patch-work/explorer/report-*.md`；v2 planner 会读取 `selected-task.md` 并写 `plan.md` / `test-plan.md`。
- `task_selection` gate 现在要求 `selectedReportId`，选择后更新 `ContributionTask` 和 `PatchWorkManifest`；planner `document_review` 接受后记录 `plan.md` / `test-plan.md` 的 accepted checksum。
- 新增 `pipeline-v2:get-patch-work-manifest`、`pipeline-v2:read-patch-work-file`、`pipeline-v2:list-explorer-reports`、`pipeline-v2:select-task` IPC / preload 契约。
- UI 新增 `ExplorerTaskBoard` 和 `ReviewDocumentBoard`，`PipelineView` 在 v2 task selection / planner document gate 时通过结构化 IPC 读取 patch-work，不从 records 反推业务状态。
- `@codeinsights/shared` 版本 `0.1.27 -> 0.1.28`，`@codeinsights/electron` 版本 `0.0.48 -> 0.0.49`，`bun.lock` 已同步。
- 复核后已加固：explorer 重跑清理旧 reports；explorer / planner 运行时只读工具约束；manifest 登记文件、任务选择和 planner 文档接受均校验 checksum；篡改 manifest 指向保留路径会被拒绝。
- 验证通过：Phase 3 聚焦测试 65 pass、`bun run typecheck`、`git diff --check`、`bun install --frozen-lockfile --dry-run`。
- 全量 `bun test` 已运行，结果 297 pass / 1 fail / 1 error；失败仍为既有 `apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts` Electron named export 测试环境问题，未指向 Phase 3 改动。

## 2026-05-14 Phase 3 前端可见性修复计划

- [x] 记录教训：组件接入 gate 不等于用户可见，必须确认新建入口能走到 v2 gate。
- [x] 让新建 Pipeline 前端入口显式创建 v2 贡献会话，并在按钮文案中标注贡献 Pipeline v2。
- [x] 扩展 createPipelineSession 主进程 / preload 契约，保留旧调用缺省 v1 兼容语义。
- [x] v2 会话启动前自动创建 ContributionTask 和 patch-work manifest，保证 ExplorerTaskBoard 有结构化数据来源。
- [x] 补测试：v2 session version 持久化、非法 version 拒绝、v2 start 自动创建 ContributionTask / manifest。
- [x] 运行聚焦测试、`bun run typecheck`、`git diff --check` 和锁文件 dry-run 后追加 Review。

## 2026-05-14 Phase 3 前端可见性修复 Review

- 已修复用户指出的前端入口不可见问题：默认新建入口现在显式创建 v2 贡献 Pipeline，并在侧边栏按钮显示“新建贡献 Pipeline”和 `v2` 标识。
- 已保留 v1 兼容语义：`createPipelineSession` 缺省仍是 v1，显式 version 只用于 v2 贡献入口。
- v2 会话启动前会自动创建 `ContributionTask` 和 `patch-work/manifest.json`，确保 Explorer task selection / Planner document review 看板能从正常 UI 路径读取结构化数据。
- `@codeinsights/electron` 版本 `0.0.49 -> 0.0.50`，`bun.lock` workspace metadata 已同步。
- 验证通过：可见性修复聚焦测试 47 pass，Phase 3 扩展测试 76 pass，`bun run typecheck`、`git diff --check`、`bun install --frozen-lockfile --dry-run` 均通过。
- 全量 `bun test` 已运行，结果 300 pass / 1 fail / 1 error；失败仍为既有 `apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts` Electron named export 测试环境问题，未指向本次可见性修复。

## 2026-05-14 Phase 3 Explorer JSON 解析错误修复计划

- [x] 检查 `git status`，确认当前没有未提交 tracked 改动。
- [x] 记录教训：Agent 结构化输出不能假设模型只返回 JSON，必须有解析或恢复兜底。
- [x] 定位 explorer 结构化输出解析逻辑和 v2 prompt 契约。
- [x] 先补测试覆盖 explorer 返回自然语言而非 JSON 的场景。
- [x] 实现修复：优先提取 JSON；完全无 JSON 时为 explorer 生成可恢复 task selection fallback，避免 UI 卡在解析失败。
- [x] 递增受影响 package patch 版本。
- [x] 运行聚焦测试、`bun run typecheck`、`git diff --check` 和锁文件 dry-run，追加 Review 并单独提交。

## 2026-05-14 Phase 3 Explorer JSON 解析错误修复 Review

- 已修复截图中的 `Pipeline explorer 结构化输出解析失败: 输出不是合法 JSON 对象`。
- explorer 现在仍会优先解析 JSON / fenced JSON / 文本中的平衡 JSON object；如果完全没有 JSON，会将自然语言输出转换为受控 fallback stage output。
- v2 explorer fallback 会写入 `patch-work/explorer/report-001.md` 并回填 reports，让 UI 进入 task selection，而不是停在节点失败。
- 已强化所有 Pipeline 节点 system prompt：最终回复必须只包含一个 JSON object；v2 explorer 额外要求把探索过程压缩进 schema 字段。
- `@codeinsights/electron` 版本 `0.0.50 -> 0.0.51`，`bun.lock` workspace metadata 已同步。
- 验证通过：新增复现用例通过；`pipeline-node-runner.test.ts` 13 pass；runner / graph / service 受影响测试 40 pass；`bun run typecheck`、`git diff --check`、`bun install --frozen-lockfile --dry-run` 均通过。
- 全量 `bun test` 已运行，结果 301 pass / 1 fail / 1 error；失败仍为既有 `apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts` Electron named export 测试环境问题，未指向本次 bugfix。

## 2026-05-14 Pipeline 停止按钮反馈修复计划

- [x] 检查 `git status`，确认 Phase 3 后续提交后当前没有待保护的 tracked 改动。
- [x] 复习 `tasks/lessons.md` 与 Pipeline stop 前后端链路，确认本次只修复 Phase 3 后续回归，不进入 Phase 4。
- [x] 记录教训：停止按钮不能只发 IPC，必须有立即可见的 UI 反馈和状态回填。
- [x] 先补测试：Pipeline stop service 返回 terminated 快照，Pipeline composer 停止中 / 已停止文案模型可验证。
- [x] 实现修复：stop IPC 返回结构化 state，前端点击后显示停止中，成功后同步 terminated 状态并展示已停止提示。
- [x] 递增受影响 package patch 版本。
- [x] 运行聚焦测试、`bun run typecheck`、`git diff --check` 和锁文件 dry-run，追加 Review 并提交 bugfix。

## 2026-05-14 Pipeline 停止按钮反馈修复 Review

- 已修复点击“停止运行”后没有可见反馈的问题：按钮请求期间显示“正在停止...”，当前面板会通过 `aria-live` 展示“正在停止当前 Pipeline...”。
- stop IPC 现在返回 `PipelineStateSnapshot`；renderer 不再只依赖 stream 广播，点击后会先乐观回填 `terminated`，成功返回后再用主进程快照校准状态。
- 停止完成后输入区会保留“Pipeline 已停止运行，可以调整任务后重新启动。”提示；如果 stop IPC 失败，会回滚原状态并展示失败原因。
- `@codeinsights/electron` 版本 `0.0.51 -> 0.0.52`，`bun.lock` workspace metadata 已同步。
- 验证通过：`PipelineComposer.test.ts`、`pipeline-atoms.test.ts`、`pipeline-service.test.ts` 共 30 pass；`bun run typecheck`；`git diff --check`；`bun install --frozen-lockfile --dry-run`。
- 全量 `bun test` 已运行，结果 303 pass / 1 fail / 1 error；失败仍为既有 `apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts` Electron named export 测试环境问题，未指向本次 stop 反馈修复。

## 2026-05-14 Pipeline 节点静默运行反馈修复计划

- [x] 检查 `git status`，确认当前没有 tracked 待保护改动。
- [x] 记录教训：节点已启动但模型或工具调用暂未产生 `text_delta` 时，UI 不能只显示空等待。
- [x] 定位实时输出面板和 live output Jotai 状态模型。
- [x] 先补测试：节点启动后没有文本 delta 时，实时输出看板应展示“正在准备/等待模型首个输出”的明确说明。
- [x] 实现修复：让 `PipelineRecords` 的空输出状态给出节点已启动、模型/工具调用可能静默的进度说明。
- [x] 递增受影响 package patch 版本。
- [x] 运行聚焦测试、`bun run typecheck`、`git diff --check` 和锁文件 dry-run，通过后追加 Review 并提交 bugfix。

## 2026-05-14 Pipeline 节点静默运行反馈修复 Review

- 已定位截图“探索节点正在输出 / 正在等待节点输出...”的原因：`node_start` 只创建空 live buffer，真实 explorer 在模型首包或工具调用期间可能没有 `text_delta`，导致 UI 看起来卡住。
- 已补测试覆盖：节点启动后应立即写入可见进度；实时输出面板在无模型文本或只有进度文本时展示“节点正在运行”，而不是空等待。
- 已实现修复：`applyPipelineLiveOutput` 在 `node_start` 写入中文启动进度；`PipelineRecords` 新增 live output view model，区分运行进度与真实模型输出，并为面板增加 `aria-live`。
- `@codeinsights/electron` 版本 `0.0.52 -> 0.0.53`，`bun.lock` workspace metadata 已同步。
- 验证通过：聚焦测试 11 pass、`bun run typecheck`、`git diff --check`、`bun install --frozen-lockfile --dry-run`。
- 全量 `bun test` 已运行，结果 306 pass / 1 fail / 1 error；失败仍为既有 `apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts` Electron named export 测试环境问题，未指向本次 live output 修复。

## 2026-05-14 最新开发状态文档同步计划

- [x] 检查 `git status` 和最新 commit，确认当前代码提交为 `ffd1f309`，tracked worktree 干净。

## 2026-05-16 UI-3 Pipeline 工作台计划

- [x] 执行 `git status --short`，确认仅有需保护的 `.DS_Store` 和 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp`。
- [x] 复习 `tasks/lessons.md`、UI checklist 的 UI-3 阶段、视觉规范 `5.2 Pipeline` 与 `5.8 页面级 Wireframe`。
- [x] 完成 UI-3 before 审计：PipelineHeader、PipelineStageRail、PipelineRecords、PipelineGateCard、PipelineComposer。
- [x] 改造 Pipeline 主面板结构和视觉层级，不回头重复 UI-2。
- [x] 补充或调整 Pipeline renderer / display model 聚焦测试。
- [x] 运行 `bun run --filter='@codeinsights/electron' typecheck`、Pipeline 聚焦测试、`git diff --check`。
- [x] 采集 UI-3 light / dark / 特殊主题截图。
- [x] 更新 UI checklist 和本 Review，并单独提交 UI-3。

### UI-3 before 审计

- PipelineHeader：已有标题、状态 badge 和当前节点，但整体仍是普通圆角卡片；状态、进度、等待人工和下一步操作没有形成工作台首屏的主视觉锚点。
- PipelineStageRail：阶段标签已中文化，但副文案仍显示 raw node enum；连接线较弱，waiting / failed / stopped 与用户可读状态文案不足；窄窗口依赖 `min-w`，存在横向溢出风险。
- PipelineRecords：已有产物 / 日志 tabs、搜索、阶段筛选和 live output 兜底；问题是控制区视觉权重过大，记录卡 anatomy 不够统一，badge / 时间 / 阶段 / 类型层级不明显，空态仍偏日志页。
- PipelineGateCard：有 feedback label 和按钮校验，但 gate 仍像普通 amber 卡片；高优先级操作、风险摘要、阶段信息和 Approve / Request changes 的视觉权重还不够清楚。
- PipelineComposer：停止中 / 已停止反馈已修复，但运行中 Composer 仍像普通任务卡；空闲输入区缺少“控制台操作区”层级，运行中任务摘要和停止按钮需要更稳定的布局。

## 2026-05-16 UI-3 Pipeline 工作台 Review

- 已完成 Pipeline 主工作台改造：Header、StageRail、Records / Live output、Gate / Review 操作区、Composer、Failure 卡片统一使用 surface / status token 和 8px card radius。
- StageRail 新增 stopped 视觉状态、中文状态标签和 `aria-label`，不再在阶段卡片中展示 raw node enum；阶段按钮保留 focus ring 并可继续定位 Records。
- Records 强化记录 anatomy：阶段 / 类型 badge、tabular time、产物路径 monospace、live output running 说明和阶段聚合标题。
- Gate / Review 右侧操作区覆盖通用 Gate、ExplorerTaskBoard、ReviewDocumentBoard、ReviewerIssueBoard、TesterResultBoard、CommitterPanel；Approve / Reject / Rerun 视觉权重更清楚，高风险 gate 使用 danger token。
- 验证通过：Pipeline 聚焦测试 25 pass；`bun run --filter='@codeinsights/electron' typecheck`；`git diff --check`。
- 截图已采集：`improve/ui/screenshots/pipeline-ui3-light-desktop.png`、`pipeline-ui3-dark-desktop.png`、`pipeline-ui3-slate-light-desktop.png`。截图通过 localhost 临时预览采集，原因是浏览器安全策略拒绝直接打开 `data:` / `file:` URL。

- [x] 更新 Pipeline checklist 的最新状态快照、Phase 3 后续 bugfix、版本号、验证状态和下次启动提示词。
- [x] 更新 Pipeline 分析文档“当前实现进度”，明确 Phase 0-3 完成、Phase 3 后续修复已提交、Phase 4-8 未开始。
- [x] 不修改 README / AGENTS，不进入 Phase 4，不执行 push / PR。
- [x] 执行文档校验并追加 Review。

## 2026-05-14 最新开发状态文档同步 Review

- 已同步 `improve/pipeline/2026-05-13-six-agent-pipeline-development-checklist.md`：最近提交更新为 `ffd1f309905c08fdd1bf471ef560361d3585d236`，分支状态为 ahead 8 commits，Phase 4 仍未开始。
- 已同步 `improve/pipeline/2026-05-13-six-agent-contribution-pipeline-analysis.md`：补充 Phase 3 提交 `881c7ad1` 和后续 bugfix `e65f8ac2` / `71bcb1df` / `364cf964` / `ffd1f309`。
- 当前版本状态已记录：`@codeinsights/shared` 为 `0.1.28`，`@codeinsights/electron` 为 `0.0.53`。
- 当前验证状态已记录：Phase 3 及后续 bugfix 聚焦测试、`bun run typecheck`、`git diff --check`、`bun install --frozen-lockfile --dry-run` 通过；全量 `bun test` 最新为 306 pass / 1 fail / 1 error，失败仍为既有 `completion-signal.test.ts` Electron named export 测试环境问题。
- 下次启动只允许从 Phase 4 开始：先检查 `git status`，写 Phase 4 计划并标记 checklist，再先补测试，不开启真实 commit / push / PR。

## 2026-05-14 Phase 4 计划

- [x] 复习 `AGENTS.md`、`tasks/lessons.md`、`tasks/todo.md`、Pipeline v2 checklist 和分析文档 Phase 4 相关内容。
- [x] 检查 `git status`，确认开始 Phase 4 前 tracked 工作区干净。
- [x] 将 checklist 中 Phase 4 “阶段开始”和入口条件标记为已开始 / 已满足。
- [x] 先补 Phase 4 测试 / BDD 场景：developer document gate、reviewer issue loop、`patch-work/dev.md` / `review.md`、Developer/Reviewer UI 状态。
- [x] 扩展 shared 契约：developer `devDocRef` / changed files / tests / risks，reviewer structured issues / `reviewDocRef` / iteration metadata。
- [x] 扩展 patch-work 服务：安全写入和读取 `dev.md` / `review.md`，登记 manifest revision 和 checksum。
- [x] 扩展 v2 graph / runner：developer 读取 accepted `plan.md` / `test-plan.md` 并写 `dev.md`，developer 文档审核通过后才进入 reviewer；用户要求修改时回 developer 并产生新 revision。
- [x] 实现 reviewer issue loop：reviewer read-only 读取 `dev.md`、Git diff 和测试方案，输出结构化 issues / `review.md`；不通过且未达上限自动回 developer，达到上限进入人工 gate。
- [x] 接入 UI：复用 `ReviewDocumentBoard` 审核 developer 文档，新增或扩展 `ReviewerIssueBoard` 展示 severity / status，并继续通过结构化 IPC 读取 patch-work 文档。
- [x] 递增受影响 package patch version，预计至少包含 `@codeinsights/shared` 和 `@codeinsights/electron`。
- [x] 运行 Phase 4 指定测试、`bun run typecheck`、`git diff --check` 和必要的锁文件校验；满足完成定义后追加 Review 并单独提交 Phase 4。

## 2026-05-14 Phase 4 Review

- Phase 4 已实现 Developer 文档审核与 Reviewer Issue Loop，并已单独提交。
- developer 现在必须读取已接受的 `plan.md` / `test-plan.md`，输出 `dev.md` 并进入 developer document gate；接受后才进入 reviewer。
- reviewer 读取已接受的 `dev.md`、方案和测试方案，保持 read-only，输出结构化 issues 与 `review.md`；不通过且未达 3 轮上限时自动回 developer，达到上限进入人工 gate。
- UI 新增 `ReviewerIssueBoard`，`ReviewDocumentBoard` 支持 developer 阶段，仍通过结构化 IPC 读取 patch-work 文档，不从 records 反推业务状态。
- 代码审查发现的 SDK abort 竞态已修复：Codex SDK runner 在准备阶段、`thread.run()` 后和 patch-work enrichment 后都会检查中止状态，避免 stopped 会话继续写 `dev.md` / `review.md` 或发送 `node_complete`。
- `@codeinsights/shared` 版本 `0.1.28 -> 0.1.29`，`@codeinsights/electron` 版本 `0.0.53 -> 0.0.54`，`bun.lock` workspace metadata 已同步。
- 验证通过：Phase 4 聚焦测试 108 pass、`bun run typecheck`、`git diff --check`、`bun install --frozen-lockfile --dry-run`。
- 全量 `bun test` 已运行，结果 324 pass / 1 fail / 1 error；失败仍为既有 `apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts` Electron named export 测试环境问题，未指向 Phase 4 改动。
- 已创建 Phase 4 单独提交：`d10387ca`（`feat(pipeline): 完成 Phase 4 开发审核与审查循环`）。

## 2026-05-15 Phase 4 后进度文档同步计划

- [x] 检查 `git status`，确认当前 tracked 工作区干净，分支 `base/pipeline-v0` ahead 10 commits，未执行 push / PR。
- [x] 更新 Pipeline checklist 最新状态快照：Phase 0-4 已完成，Phase 5-8 未完成，下一步只能进入 Phase 5。
- [x] 更新 Pipeline 分析文档“当前实现进度”：写入 Phase 4 具体 commit、版本状态、验证状态和剩余闭环缺口。
- [x] 在本地 todo 记录本次文档同步结果和下次启动提示词。
- [x] 不修改 README / AGENTS，不进入 Phase 5，不执行 push / PR。

## 2026-05-15 Phase 4 后进度文档同步 Review

- 已将 Phase 4 提交固定记录为 `d10387cae3557ca57e3679f55c5ab48cd7e75766`（`feat(pipeline): 完成 Phase 4 开发审核与审查循环`）。
- 已确认已完成范围：Phase 0 规格冻结、Phase 1 preflight / ContributionTask / patch-work 基础、Phase 2 六节点 v2 骨架、Phase 3 explorer task selection / planner document gate、Phase 4 developer document gate / reviewer issue loop。
- 已确认未完成范围：Phase 5 tester result / patch-set、Phase 6 committer draft-only、Phase 7 本地 commit gate、Phase 8 远端 PR 集成。
- 下次启动只能从 Phase 5 开始：先检查 `git status`，在本文件写 Phase 5 计划，把 checklist 中 Phase 5 “阶段开始”标为已开始，然后先补测试 / BDD 场景再实现。
- 当前版本状态：`@codeinsights/shared` 为 `0.1.29`，`@codeinsights/electron` 为 `0.0.54`。
- 当前验证状态：Phase 4 聚焦测试 108 pass、`bun run typecheck`、`git diff --check`、`bun install --frozen-lockfile --dry-run` 已通过；全量 `bun test` 最新结果为 324 pass / 1 fail / 1 error，失败仍是既有 `completion-signal.test.ts` Electron named export 测试环境问题。

## 2026-05-15 Phase 5 计划

- [x] 复习 `AGENTS.md`、`tasks/lessons.md`、`tasks/todo.md`、Pipeline v2 checklist 和分析文档 Phase 5 / Tester 相关内容。
- [x] 检查 `git status`，确认开始 Phase 5 前只有 Pipeline 进度文档存在未提交 tracked 改动，需要继续保护，不得覆盖。
- [x] 将 checklist 中 Phase 5 “阶段开始”标记为已开始，并同步当前状态为 Phase 5 计划中。
- [x] 先补 Phase 5 测试 / BDD 场景：tester result、patch-set manifest、patch-set 排除 `patch-work/**`、测试失败 / 环境阻塞路径、`TesterResultBoard` UI 状态。
- [x] 扩展 shared 契约：tester result、patch-set 文件引用、测试证据、blocked gate payload 和必要的 stage output 字段。
- [x] 扩展 `pipeline-patch-work-service`：安全写入 / 读取 `result.md`、`patch-set/changes.patch`、`patch-set/changed-files.json`、`patch-set/diff-summary.md`、`patch-set/test-evidence.json`，并登记 manifest revision / checksum。
- [x] 新增或扩展 patch-set 生成服务，基于 Git diff 生成草稿 patch-set，默认排除 `patch-work/**`，且不执行 commit / push / PR。
- [x] 扩展 Codex tester runner：读取 accepted `dev.md` / `review.md` / `test-plan.md` 和 Git diff，执行或记录测试计划，必要时触发 developer 修复或 `test_blocked` gate。
- [x] 接入 IPC / preload / Jotai / UI：复用结构化 patch-work 文档读取能力，`TesterResultBoard` 不从 records 反推主业务状态。
- [x] 递增受影响 package patch version：`@codeinsights/shared` `0.1.29 -> 0.1.30`，`@codeinsights/electron` `0.0.54 -> 0.0.55`。
- [x] 运行 Phase 5 指定测试、`bun run typecheck`、`git diff --check` 和必要的锁文件校验；满足完成定义后追加 Review 并单独提交 Phase 5。

## 2026-05-15 Phase 5 Review

- Phase 5 已实现 Codex Tester、测试报告与 patch-set 草稿，并已单独提交 `aa08baf257fab43db6c9c30a106466f3b1629da1`（`feat(pipeline): 完成 Phase 5 Tester 结果与 patch-set 草稿闭环`）；未进入 Phase 6。
- Tester v2 读取 accepted `test-plan.md` / `dev.md` 和最新 `review.md`，以 workspace-write Codex 运行；prompt 明确禁止真实 git / commit / push / PR，runner 前置命令 wrapper 与禁用 `GIT_DIR` 阻断常规和绝对路径 Git 调用，并在运行前后额外校验 Git HEAD、refs、index、local config 与已有补丁未被整体丢弃。
- 新增 `pipeline-git-submission-service.ts`，基于 `git diff HEAD` + untracked 文件生成 patch-set 草稿，默认排除 `patch-work/**`；已覆盖 staged 变更和正文出现 `patch-work/**` 的边界。
- Tester 输出并登记 `patch-work/result.md`、`patch-set/changes.patch`、`patch-set/changed-files.json`、`patch-set/diff-summary.md`、`patch-set/test-evidence.json`，manifest 记录 revision / checksum。
- 测试失败、测试未运行、缺少 `passed`、缺失 evidence、存在 failed / skipped evidence 或 unsafe patch-set 会进入 `test_blocked` gate；用户接受风险后进入 committer draft-only，选择修订会带反馈回 developer。
- UI 新增 `TesterResultBoard`，通过现有结构化 patch-work 文档读取 result / patch-set / evidence，不从 records 反推主业务状态。
- Backend approve 会服务端复验 patch-set 未包含 `patch-work/**`，且正常 `document_review` approve 必须确认 `test-evidence.json` 非空并全部 passed；`test_blocked` approve 仅作为显式风险接受。
- 代码审查后已补 hardening：绝对路径 Git 绕过会被默认 `GIT_DIR` 禁用和 refs / index / config / 补丁丢弃检测兜底；tester fallback `result.md` 的结论改为基于 failed / skipped evidence 的保守判断。
- 验证通过：Phase 5 聚焦测试 124 pass，`bun run typecheck`，`git diff --check`，`bun install --frozen-lockfile --dry-run`。
- 全量 `bun test` 已运行，结果 348 pass / 1 fail / 1 error；失败仍为既有 `apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts` Electron named export 测试环境问题，未指向 Phase 5 改动。

## 2026-05-15 Phase 5 后续启动提示词（历史归档）

此处原为 Phase 5 完成后进入 Phase 6 的启动提示。Phase 6 / Phase 7 现已完成，最新可用提示词见本文末尾“下次启动提示词（Phase 8）”。

## 2026-05-15 Phase 5 提交后开发状态文档同步计划

- [x] 检查 `git status` 和最新提交，确认 Phase 5 提交已改写为详细中文 commit 信息。
- [x] 更新 Pipeline checklist 最新状态快照：固定 Phase 5 最终 commit hash、分支 ahead 状态、已完成 / 未完成阶段和下次启动提示词。
- [x] 更新 Pipeline 分析文档“当前实现进度”：固定 Phase 5 最终 commit hash，明确 Phase 6-8 尚未开始。
- [x] 更新本地 todo，记录本次文档同步结果和下次启动提示词。
- [x] 不修改 README / AGENTS，不进入 Phase 6，不执行 push / PR。

## 2026-05-15 Phase 5 提交后开发状态文档同步 Review

- 已将 Phase 5 最终提交固定记录为 `aa08baf257fab43db6c9c30a106466f3b1629da1`（`feat(pipeline): 完成 Phase 5 Tester 结果与 patch-set 草稿闭环`）。
- 已确认已完成范围：Phase 0 规格冻结、Phase 1 preflight / ContributionTask / patch-work 基础、Phase 2 六节点 v2 骨架、Phase 3 explorer task selection / planner document gate、Phase 3 后续可用性修复、Phase 4 developer document gate / reviewer issue loop、Phase 5 tester result / patch-set。
- 已确认未完成范围：Phase 6 committer draft-only、Phase 7 本地 commit gate、Phase 8 远端 PR 集成。
- 下次启动只能从 Phase 6 开始：先检查 `git status`，在本文件写 Phase 6 计划，把 checklist 中 Phase 6 “阶段开始”标为已开始，然后先补测试 / BDD 场景再实现。
- 当前版本状态：`@codeinsights/shared` 为 `0.1.30`，`@codeinsights/electron` 为 `0.0.55`。
- 当前验证状态：Phase 5 聚焦测试 124 pass、`bun run typecheck`、`git diff --check`、`bun install --frozen-lockfile --dry-run` 已通过；全量 `bun test` 最新结果为 348 pass / 1 fail / 1 error，失败仍是既有 `completion-signal.test.ts` Electron named export 测试环境问题。

## 2026-05-15 Phase 6 计划

- [x] 复习 `AGENTS.md`、`tasks/lessons.md`、`tasks/todo.md`、Pipeline v2 checklist 和分析文档 Phase 6 / Committer 相关内容。
- [x] 检查 `git status`，确认开始 Phase 6 前已有未提交 tracked 改动只涉及 Pipeline 进度文档，需要继续保护，不得覆盖。
- [x] 将 checklist 中 Phase 6 “阶段开始”和入口条件标记为已开始 / 已满足。
- [x] 先补 Phase 6 测试 / BDD 场景：committer draft-only schema、`commit.md` / `pr.md` manifest 登记、Git 写操作禁用、提交材料 UI 状态。
- [x] 扩展 shared 契约：committer stage output 明确 `commitDocRef`、`prDocRef`、commit message、PR title/body、blockers、risks、draft-only submission 状态。
- [x] 扩展 `pipeline-git-submission-service` 的只读能力：读取 Git status / diff 摘要、候选变更列表和 CONTRIBUTING / 贡献指南，不执行 `git add`、`git commit`、`git push` 或 GitHub 写 API。
- [x] 扩展 `pipeline-patch-work-service`：安全写入 / 读取 `commit.md`、`pr.md`，登记 manifest revision / checksum，并确保不会把 `patch-work/**` 默认纳入 patch-set 或提交候选。
- [x] 扩展 Codex committer runner：读取 `result.md`、`patch-set/*`、CONTRIBUTING 和 Git 状态，只生成提交 / PR 草稿，输出 draft-only blockers / risks。
- [x] 接入 graph / gate：tester approve 或 `test_blocked` 风险接受后进入 committer，committer 完成后进入 `submission_review` gate，默认动作仅保存提交材料，不进入 Phase 7 的真实 commit。
- [x] 接入 IPC / preload / Jotai / UI：新增 `CommitterPanel`，继续通过结构化 patch-work IPC 读取 `commit.md` / `pr.md` / 测试证据，不从 records 反推主业务状态。
- [x] 递增受影响 package patch version：`@codeinsights/shared` `0.1.30 -> 0.1.31`，`@codeinsights/electron` `0.0.55 -> 0.0.56`，并同步 `bun.lock` workspace metadata。
- [x] 运行 Phase 6 指定测试、`bun run typecheck`、`git diff --check` 和 `bun install --frozen-lockfile --dry-run`；满足完成定义后追加 Review 并单独提交 Phase 6。

## 2026-05-15 Phase 6 Review

- Phase 6 已完成 Committer Draft-Only 闭环，随本轮阶段提交落地；未进入 Phase 7。
- Committer v2 读取 accepted `result.md`、`patch-set/changes.patch`、`patch-set/changed-files.json`、`patch-set/diff-summary.md`、`patch-set/test-evidence.json`、CONTRIBUTING 和 Git 状态，只生成提交 / PR 草稿。
- 新增只读提交上下文读取能力：Git status、diff 摘要、变更文件、HEAD、分支和 CONTRIBUTING；读取 CONTRIBUTING 时拒绝 symlink 越界；不执行 `git add`、`git commit`、`git push` 或 GitHub 写 API，提交候选继续排除 `patch-work/**`。
- Committer enrichment 写入并登记 `patch-work/commit.md` 和 `patch-work/pr.md`，stage output 回填 `commitDocRef` / `prDocRef`，`localCommit` 和 `remoteSubmission` 保持 `not_requested`。
- `submission_review` gate 在 Phase 6 只接受 `submissionMode: local_patch`，会接受 `commit_doc` / `pr_doc` 并完成 ContributionTask；`local_commit` / `remote_pr` 会被拒绝，committer schema/parser 和 UI 也会阻止非 `draft_only` 提交状态。
- UI 新增 `CommitterPanel`，在 `submission_review` gate 通过结构化 patch-work IPC 读取 `commit.md` / `pr.md`，同时展示 patch-set 摘要、测试证据、blocker 和风险，不从 records 反推主业务状态。
- `@codeinsights/shared` 版本 `0.1.30 -> 0.1.31`，`@codeinsights/electron` 版本 `0.0.55 -> 0.0.56`，`bun.lock` workspace metadata 已同步。
- 验证通过：Phase 6 聚焦测试 150 pass、runner 复核测试 54 pass、`bun run typecheck`、`git diff --check`、`bun install --frozen-lockfile --dry-run`。
- 全量 `bun test` 已运行，结果 362 pass / 1 fail / 1 error；失败仍为既有 `apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts` Electron named export 测试环境问题，未指向 Phase 6 改动。
- Phase 6 禁止事项已保持：未开启真实 commit、push 或 PR，未默认将 `patch-work/**` 加入 patch-set 或 commit 候选。

## 2026-05-15 Phase 6 后续启动提示

- Phase 6 已按阶段纪律单独提交，commit `fab7f906f546e619157286ffb6fe40c869f1d3e2`（`feat(pipeline): 完成 Phase 6 提交材料草稿闭环`），提交范围不包含 `patch-work/**`，不执行 push / PR。
- 下一步只能在用户明确允许本地 commit 能力后进入 Phase 7：受控本地 Commit Gate。
- Phase 7 开始前仍需先检查 `git status`，在本文件写 Phase 7 计划，并把 checklist 中 Phase 7 “阶段开始”标为已开始。
- Phase 7 必须先补本地 commit gate、重复 resume 幂等、commit result 回填和 UI 状态测试，再实现功能。
- Phase 7 禁止开启 push / PR，不得把 `patch-work/**` 默认加入 patch-set 或 commit。

## 2026-05-15 Phase 6 提交后开发状态文档同步计划

- [x] 检查 `git status` 和最新提交，确认 Phase 6 已改写为详细中文 commit 信息。
- [x] 更新 Pipeline checklist 最新状态快照：固定 Phase 6 最终 commit hash、已完成 / 未完成阶段、版本状态和下次启动提示词。
- [x] 更新 Pipeline 分析文档“当前实现进度”：固定 Phase 6 最终 commit hash，明确 Phase 7-8 尚未开始。
- [x] 更新本地 todo，记录本次文档同步结果和下次启动提示词。
- [x] 不修改 README / AGENTS，不进入 Phase 7，不执行 push / PR。

## 2026-05-15 Phase 6 提交后开发状态文档同步 Review

- 已将 Phase 6 最终提交固定记录为 `fab7f906f546e619157286ffb6fe40c869f1d3e2`（`feat(pipeline): 完成 Phase 6 提交材料草稿闭环`），提交信息已包含详细中文说明。
- 已确认已完成范围：Phase 0 规格冻结、Phase 1 preflight / ContributionTask / patch-work 基础、Phase 2 六节点 v2 骨架、Phase 3 explorer task selection / planner document gate、Phase 3 后续可用性修复、Phase 4 developer document gate / reviewer issue loop、Phase 5 tester result / patch-set、Phase 6 committer draft-only。
- 已确认未完成范围：Phase 7 受控本地 Commit Gate、Phase 8 远端 PR 集成。
- 下次启动只能在用户明确允许本地 commit 能力后从 Phase 7 开始：先检查 `git status`，在本文件写 Phase 7 计划，把 checklist 中 Phase 7 “阶段开始”标为已开始，然后先补测试 / BDD 场景再实现。
- 当前版本状态：`@codeinsights/shared` 为 `0.1.31`，`@codeinsights/electron` 为 `0.0.56`。
- 当前验证状态：Phase 6 聚焦测试 150 pass、runner 复核测试 54 pass、`bun run typecheck`、`git diff --check`、`bun install --frozen-lockfile --dry-run` 已通过；全量 `bun test` 最新结果为 362 pass / 1 fail / 1 error，失败仍是既有 `completion-signal.test.ts` Electron named export 测试环境问题。

## 2026-05-15 Phase 7 计划

- [x] 复习 `AGENTS.md`、`tasks/lessons.md`、`tasks/todo.md`、Pipeline v2 checklist 和分析文档 Phase 7 相关内容。
- [x] 检查 `git status`，确认开始 Phase 7 前 tracked 工作区没有未提交文件；当前分支 `base/pipeline-v0` 相对远端 ahead 13 commits。
- [x] 将 checklist 中 Phase 7 “阶段开始”和“用户明确允许实现本地 commit 能力”标记为已满足；本阶段只实现 gated local commit，不执行 push / PR。
- [x] 先补 Phase 7 测试 / BDD 场景：local commit gate 未确认不提交、确认后 fixture repo 可提交、staging 默认排除 `patch-work/**`、重复 resume / operation id 不重复提交、commit result 回填 Contribution events、`CommitterPanel` local commit 状态。
- [x] 扩展 shared 契约：submission review `local_commit` 决策、commit operation id、staging candidate / excluded files、local commit result / error / attemptedAt / commitHash。
- [x] 扩展 `pipeline-git-submission-service`：`validateCommitPreconditions`、受控 staging policy、默认排除 `patch-work/**`、只允许候选文件 staged、执行 `git add` / `git commit` 前后校验、失败时保留提交材料和错误。
- [x] 接入主进程 graph / gate / service：只有用户明确选择 `submissionMode: local_commit` 且 operation id 未完成时才执行本地 commit；重复 resume 返回已记录结果，不重复 commit。
- [x] 接入 IPC / preload / Jotai / UI：`CommitterPanel` 继续通过结构化 patch-work IPC 展示提交材料，并展示 base branch、working branch、候选文件、排除文件、commit message、测试结论和提交结果。
- [x] 递增受影响 package patch version：`@codeinsights/shared` `0.1.31 -> 0.1.32`、`@codeinsights/electron` `0.0.56 -> 0.0.57`，并同步 `bun.lock` workspace metadata。
- [x] 运行 Phase 7 聚焦测试、`bun run typecheck`、`git diff --check`、`bun install --frozen-lockfile --dry-run`；满足完成定义后追加 Review 并单独提交 Phase 7，不执行 push / PR。

## 2026-05-15 Phase 7 Review

- Phase 7 已完成受控本地 Commit Gate，并已单独提交 `d6da8380dc69e179c24d542d4a73cd1be90216cc`（`feat(pipeline): 完成 Phase 7 受控本地提交闭环`）。
- Git service 新增 `validateCommitPreconditions` 和 `createLocalPipelineCommit`：本地 commit 必须显式 `confirmed: true`，无 operation id、无 commit message、detached HEAD、无候选变更、冲突或 staged `patch-work/**` 都会阻止提交。
- 受控 staging 只 stage Git status 候选源码文件，默认排除 `patch-work/**`；使用 literal pathspec 防止特殊文件名扩大 stage 范围，若 `patch-work/**` 已经进入 index，commit 前会二次阻断。
- `submission_review` gate 现在支持 `local_patch` 保存草稿和 `local_commit` 本地提交；`remote_pr` 仍被拒绝，push / PR 未开启。
- local commit 前会先只读校验 `commit.md` / `pr.md` checksum，commit result 会写入 `local_commit_created` / `local_commit_failed` Contribution events，并回填 committer stage output；重复 resume 使用 operation id 识别已创建结果，不重复执行 commit。
- `CommitterPanel` 新增本地 commit 候选、排除项、分支、测试证据和提交结果展示；仍通过结构化 patch-work IPC 读取 `commit.md` / `pr.md`，不从 records 反推主业务状态。
- `@codeinsights/shared` 版本 `0.1.31 -> 0.1.32`，`@codeinsights/electron` 版本 `0.0.56 -> 0.0.57`，`bun.lock` workspace metadata 已同步。
- 验证通过：Phase 7 聚焦测试 80 pass，shared / ContributionTask 兼容测试 18 pass，`bun run typecheck`，`git diff --check`，`bun install --frozen-lockfile --dry-run`。
- 全量 `bun test` 已运行，结果 370 pass / 1 fail / 1 error；失败仍为既有 `apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts` Electron named export 测试环境问题，未指向 Phase 7 改动。
- Phase 7 禁止事项已保持：未开启 push / PR，未默认将 `patch-work/**` 加入 patch-set 或 commit 候选。

## 2026-05-15 Phase 7 提交后开发状态文档同步计划

- [x] 检查 `git status` 和最新提交，确认 Phase 7 已单独提交且当前 tracked 工作区只包含本轮文档同步。
- [x] 更新 Pipeline checklist 最新状态快照：固定 Phase 7 commit hash、分支 ahead 状态、已完成 / 未完成阶段和下次启动提示词。
- [x] 更新 Pipeline 分析文档“当前实现进度”：固定 Phase 7 commit hash，明确 Phase 8 尚未开始。
- [x] 更新本地 todo：修正 Phase 7 Review 的提交状态，记录本次文档同步结果和下次启动提示词。
- [x] 不修改 README / AGENTS，不进入 Phase 8，不执行 push / PR。

## 2026-05-15 Phase 7 提交后开发状态文档同步 Review

- 已将 Phase 7 最终提交固定记录为 `d6da8380dc69e179c24d542d4a73cd1be90216cc`（`feat(pipeline): 完成 Phase 7 受控本地提交闭环`）。
- 已确认已完成范围：Phase 0 规格冻结、Phase 1 preflight / ContributionTask / patch-work 基础、Phase 2 六节点 v2 骨架、Phase 3 explorer task selection / planner document gate、Phase 3 后续可用性修复、Phase 4 developer document gate / reviewer issue loop、Phase 5 tester result / patch-set、Phase 6 committer draft-only、Phase 7 受控本地 Commit Gate。
- 已确认未完成范围：Phase 8 远端 PR 集成尚未开始，需要单独安全评审和用户明确允许远端写能力。
- 下次启动只能在用户明确允许远端写能力后从 Phase 8 开始：先检查 `git status`，在本文件写 Phase 8 计划，把 checklist 中 Phase 8 “阶段开始”标为已开始，然后先补测试 / BDD 场景再实现。
- 当前版本状态：`@codeinsights/shared` 为 `0.1.32`，`@codeinsights/electron` 为 `0.0.57`。
- 当前分支状态：`base/pipeline-v0` 相对 `origin/base/pipeline-v0` ahead 14 commits；未执行 push / PR。
- 当前验证状态：Phase 7 聚焦测试 80 pass、shared / ContributionTask 兼容测试 18 pass、`bun run typecheck`、`git diff --check`、`bun install --frozen-lockfile --dry-run` 已通过；全量 `bun test` 最新结果为 370 pass / 1 fail / 1 error，失败仍是既有 `completion-signal.test.ts` Electron named export 测试环境问题。

## 下次启动提示词（Phase 8）

```text
你正在 CodeInsights 仓库继续开发 Pipeline v2 六 Agent 开源贡献工作流。

请先阅读并遵守：
- AGENTS.md
- tasks/lessons.md
- tasks/todo.md
- improve/pipeline/2026-05-13-six-agent-pipeline-development-checklist.md
- improve/pipeline/2026-05-13-six-agent-contribution-pipeline-analysis.md 中“当前实现进度”和 Phase 8 相关内容

当前进度：
1. Phase 0-6 已完成并分别提交，Phase 6 commit 为 fab7f906f546e619157286ffb6fe40c869f1d3e2。
2. Phase 7 已完成并提交，commit 为 d6da8380dc69e179c24d542d4a73cd1be90216cc；已实现受控本地 Commit Gate，支持 local_commit 人工确认、受控 staging、默认排除 patch-work/**、operation id 幂等、commit hash 回填和 CommitterPanel 状态展示。
3. 当前 @codeinsights/shared 版本为 0.1.32，@codeinsights/electron 版本为 0.0.57。
4. 当前分支 base/pipeline-v0 相对 origin/base/pipeline-v0 ahead 14 commits；未 push，未创建 PR。
5. Phase 8 尚未开始；后续只能在单独安全评审和用户明确允许远端写能力后进入 Phase 8，不得提前接 push 或 PR。
6. 当前已知验证状态：Phase 7 聚焦测试 80 pass、shared / ContributionTask 兼容测试 18 pass、bun run typecheck、git diff --check、bun install --frozen-lockfile --dry-run 已通过；全量 bun test 最新结果为 370 pass / 1 fail / 1 error，失败仍为既有 completion-signal.test.ts Electron named export 测试环境问题。

开发纪律：
- 开始 Phase 8 前，先检查 git status，保护已有用户变更。
- 开始 Phase 8 前，在 tasks/todo.md 写 Phase 8 计划，并把 checklist 中 Phase 8 的“阶段开始”标为已开始。
- 每个阶段必须先补测试或 BDD 场景，再实现功能。
- 每完成一个阶段并通过完成定义后，单独提交一次；重新启动 Codex 会话后也要主动延续这个纪律。
- 不得默认执行 git push 或创建 PR，除非用户明确允许远端写能力并完成 Phase 8 gate。
- 不得把 patch-work/** 默认加入 patch-set、commit、push 或 PR。
- 使用 Bun：bun test、bun run typecheck。
- 状态管理继续使用 Jotai。
- 本地存储继续使用 JSON / JSONL / manifest，不引入本地数据库。
- README 和 AGENTS.md 只有在我明确允许后再修改。
- 完成功能代码变更时，递增受影响 package 的 patch 版本。

Phase 8 目标：
- 先补远端写二次确认、push/PR 幂等、远端结果回填和 UI 状态测试。
- 远端 push / PR 必须使用独立 high-risk gate，不得复用 Phase 7 local_commit 确认。
- UI 继续通过结构化 IPC 读取 patch-work 文档，不用 records 反推主业务状态。

Phase 8 禁止事项：
- 未经用户明确确认，不执行 push 或创建 PR。
- 不得把 patch-work/** 默认加入 push 或 PR。
```

## 2026-05-15 Phase 8 计划

- [x] 复习 `AGENTS.md`、`tasks/lessons.md`、`tasks/todo.md`、Pipeline v2 checklist 和分析文档 Phase 8 相关内容。
- [x] 检查 `git status`，确认开始前已有未提交 tracked 改动只涉及 Phase 7 提交后进度文档同步，需要继续保护并在其上追加 Phase 8 计划。
- [x] 将 checklist 中 Phase 8 “阶段开始”标记为已开始；用户已确认允许实现远端写能力代码，GitHub auth 首版使用本机 `gh` / git credential，不新增 token 存储。
- [x] 完成 Phase 8 独立安全评审：明确 push / PR 只能由主进程受控服务执行，必须使用独立 high-risk gate，不能复用 Phase 7 `local_commit` gate。
- [x] 先补 Phase 8 测试 / BDD 场景：远端写未二次确认不会执行、push/PR operation id 幂等、远端结果回填 Contribution events、失败保留本地 commit 与 PR 草稿、`CommitterPanel` 远端状态展示。
- [x] 扩展 shared 契约：`remote_write_confirmation` gate、远端 operation id、push result、PR result、remote URL / branch / commit hash / PR title/body / draft 状态和错误信息。
- [x] 扩展主进程服务：新增远端写 preflight，校验 remote URL、upstream/base/head branch、local commit hash、auth 可用性和权限；日志与 events 必须脱敏 token / Authorization / remote credentials。
- [x] 实现受控 remote submit 服务：真实 `git push` / `gh pr create --draft` 必须在用户明确授权、独立 gate 确认且 operation id 未完成时才执行；预填充 PR 页面和 GitHub API 创建路径不纳入首版，留作后续可选增强。
- [x] 接入 graph / gate / IPC / preload / Jotai / UI：`CommitterPanel` 继续通过结构化 patch-work IPC 读取 `commit.md` / `pr.md` / 测试证据，并展示远端确认、执行中、成功、失败和可恢复状态。
- [x] 确保 `patch-work/**` 不进入默认 push / PR 范围；远端提交基于 Phase 7 本地 commit hash，不把 patch-work 文档当成提交内容。
- [x] 递增受影响 package patch version：`@codeinsights/shared` `0.1.32 -> 0.1.33`、`@codeinsights/electron` `0.0.57 -> 0.0.58`，并同步 `bun.lock` workspace metadata。
- [x] 运行 Phase 8 聚焦测试、`bun run typecheck`、`git diff --check`、`bun install --frozen-lockfile --dry-run`；全量 `bun test` 仍需标注既有 `completion-signal.test.ts` Electron named export 问题。
- [x] 通过完成定义后追加 Phase 8 Review 并单独提交 Phase 8；不执行 push / PR，除非用户之后明确要求并通过 Phase 8 gate。

### Phase 8 独立安全评审

- 远端写能力必须作为独立 high-risk gate 实现：新增 `remote_write_confirmation` / 独立 remote operation id，不复用 Phase 7 的 `localCommitOperationId`、`local_commit` 决策或按钮状态。
- Agent / Codex runner 仍然不能直接执行 `git push`、`gh pr create` 或 GitHub API 写操作；远端写只能由主进程受控服务在人工确认后执行，并继续保留现有 Git / GitHub CLI 防护。
- 远端执行前必须验证已有 Phase 7 本地 commit hash、HEAD 未漂移、目标 remote / base / head branch、auth / 权限状态、PR title/body 和 draft 状态；所有 preview 信息要在 UI 中显示给用户确认。
- 幂等以 remote operation id 为准：重复 IPC / resume 只能复用已记录的 push / PR 结果；push 成功但 PR 失败时，后续重试不得重复创建远端分支副作用；PR 已存在时回填既有 URL。
- 审计记录写入 Contribution events，并回填 committer stage output；失败必须保留本地 commit、`commit.md`、`pr.md`、错误信息和可重试状态。
- 日志、events、artifact 不得泄露 token、Authorization header、带凭据 remote URL 或其它 secret；remote URL 展示前需要脱敏。
- `patch-work/**` 不进入默认 push / PR 范围；远端提交基于已创建的本地 commit hash，patch-work 文档只作为本地审核材料。
- 用户已确认允许实现远端写能力代码，GitHub auth 首版使用本机 `gh` / git credential，不新增 token 存储；本会话仍不执行真实 push / PR，验证使用 mock。

### Phase 8 安全评审修复计划

- [x] 先补测试覆盖阻塞项：push URL 优先于 fetch URL、`patch-work/**` 已在提交树或 push range 时阻断、远端命令错误脱敏、remote gate kind 服务端强制、push 成功但 PR 失败后可恢复。
- [x] 使用 `git remote get-url --push` 作为实际远端写目标，展示脱敏 push URL，并从 GitHub push URL 解析 `owner/repo` 后传给 `gh pr create --repo`。
- [x] 在远端写 preflight 中校验 `git ls-tree -r <commitHash> -- patch-work` 和本地 `refs/remotes/<remote>/<base>..<commitHash>` 变更路径，确保 `patch-work/**` 不会随远端提交历史进入 push/PR。
- [x] 用 `git check-ref-format --branch` 校验 head/base branch，并通过 `git ls-remote --heads` 确认目标 remote base branch 存在。
- [x] 将远端提交状态扩展为可恢复状态：持久化 `pushed`，遇到 PR 已存在时按 operation id 恢复为成功，避免重复不可控副作用。
- [x] 所有远端命令错误进入 Contribution events、stage artifact 和 UI 前统一脱敏，覆盖 credentialed URL、Authorization、`ghp_`、`github_pat_`、`GH_TOKEN` / `GITHUB_TOKEN`。
- [x] 修复后重新运行 Phase 8 聚焦测试、`bun run typecheck`、`git diff --check`、`bun install --frozen-lockfile --dry-run` 和全量 `bun test`，再更新 Phase 8 Review。

## 2026-05-15 Phase 8 Review

- Phase 8 已完成受控远端 PR 集成，并已作为本轮单独提交；本会话未执行真实 `git push`，未创建真实 PR。
- 远端写必须走独立 `remote_write_confirmation` high-risk gate，不能复用 Phase 7 `local_commit` 确认；renderer 会发送独立 remote operation id 和二次确认，backend 会服务端强制校验 gate kind。
- 新增远端提交契约和状态：`remoteSubmissionOperationId`、`remoteWriteConfirmed`、`PipelineRemoteSubmissionSummary`、`pushed` 可恢复状态、`remote_submission_created` / `remote_submission_failed` Contribution events；`@codeinsights/shared` 版本 `0.1.32 -> 0.1.33`。
- `pipeline-git-submission-service` 新增远端 preflight / submit：读取实际 push URL（`git remote get-url --push`）并脱敏展示，从 GitHub push URL 解析 `owner/repo`，`gh pr create` 显式传 `--repo`，并使用本机 `gh` / git credential，不新增 token 存储。
- 远端写前会校验 `allowRemoteWrites`、confirmed、operation id、HEAD == local commit hash、remote/base/head branch、`gh auth status`、目标 remote base branch 存在，并拒绝 `headBranch === baseBranch`、`main`、`master` 等 base/default 分支直推风险。
- `patch-work/**` 远端防护已加固：不仅检查 Git index，还检查待推送 commit tree 和本地 remote/base 到 commit hash 的 push range 历史，发现 `patch-work/**` 曾进入历史即阻断远端写。
- 幂等和恢复：完整成功按 operation id 复用已创建 PR；push 成功但 PR 创建失败会持久化 `pushed` 状态，后续同 operation id 重试会跳过 push，只恢复 PR 创建；PR 已存在时通过 `gh pr view` 回填既有 URL。
- 错误脱敏：远端命令错误进入 stage artifact、Contribution events 和 UI 前统一清洗 credentialed remote URL、Authorization bearer、`ghp_`、`github_pat_`、`GH_TOKEN` / `GITHUB_TOKEN`。
- `CommitterPanel` 新增远端目标、独立确认、红色高风险提交按钮、远端成功 / 失败 / pushed 可恢复状态展示；本地 commit 后远端目标会从 `localCommit` fallback，不依赖 records 反推主业务状态。
- `@codeinsights/electron` 版本 `0.0.57 -> 0.0.58`，`bun.lock` workspace metadata 已同步。
- 验证通过：Phase 8 核心聚焦测试 65 pass；Phase 8 周边兼容测试 147 pass；`bun run typecheck`；`git diff --check`；`bun install --frozen-lockfile --dry-run`。
- 全量 `bun test` 已运行，结果 387 pass / 1 fail / 1 error；失败仍为既有 `apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts` Electron named export 测试环境问题，未指向 Phase 8 改动。
- Phase 8 禁止事项已保持：未执行真实 push / PR；未默认把 `patch-work/**` 加入 patch-set、commit、push 或 PR；README 和 AGENTS.md 未修改。

## 2026-05-16 Phase 8 后开发状态文档同步计划

- [x] 检查 `git status`，确认当前工作树没有未提交代码变更，后续只做进度文档更新。
- [x] 更新 Pipeline checklist 最新状态快照：固定 Phase 8 commit `906834a0`、当前分支 ahead 状态、已完成 / 未完成范围和可选增强方向。
- [x] 更新 Pipeline 分析文档“当前实现进度”：固定 Phase 8 commit，明确真实 push / PR 尚未执行，列出后续可选增强。
- [x] 在本文件追加本次文档同步 Review，确保下次启动能从 `tasks/todo.md` 直接恢复上下文。
- [x] 不修改 README / AGENTS，不执行 push / PR，不改运行时代码。

## 2026-05-16 Phase 8 后开发状态文档同步 Review

- 已确认 Phase 8 最终提交为 `906834a0`（`feat(pipeline): 完成 Phase 8 远端 PR 受控集成`），当前工作树在文档更新前是干净的。
- 已同步 `improve/pipeline/2026-05-13-six-agent-pipeline-development-checklist.md`：Phase 0-8 均已完成，Phase 8 commit hash、版本号、验证状态、分支 ahead 16 commits、未执行真实 push / PR 均已明确记录。
- 已同步 `improve/pipeline/2026-05-13-six-agent-contribution-pipeline-analysis.md`：当前实现进度固定到 Phase 8，列出未完成 / 可选增强：真实远端写验证、低风险预填 PR 页面、GitHub API 创建路径、远端 preflight UI、已有 PR 同步 / 更新流程。
- 已知风险仍是既有全量测试问题：`apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts` Electron named export 测试环境问题；Phase 8 聚焦与兼容测试、`bun run typecheck`、`git diff --check`、锁文件 dry-run 均已在 Phase 8 Review 中记录通过。
- 后续启动建议优先修复既有全量测试失败；如要执行真实 push / PR，必须由用户明确授权，并通过 Phase 8 独立 high-risk gate。README / AGENTS.md 仍只能在用户明确允许后修改。

## 2026-05-16 全客户端 UI 视觉规范文档计划

- [x] 复习 `tasks/lessons.md`，确认本次 UI 文档不触碰运行时代码和 README / AGENTS。
- [x] 基于当前 renderer 结构和 `ui-ux-pro-max` 审计维度，整理全客户端 UI 基线。
- [x] 在 `improve/ui/2026-05-16-client-ui-visual-spec.md` 写入中文视觉规范稿。
- [x] 覆盖 Pipeline、Agent、AppShell / Sidebar / Tab、Settings、Onboarding / Welcome、Chat 回退与 File Browser。
- [x] 执行静态校验：文件存在、章节完整、关键词覆盖和 `git diff --check`。
- [x] 在本文末尾追加 Review。

## 2026-05-16 全客户端 UI 视觉规范文档 Review

- 已新增 `improve/ui/2026-05-16-client-ui-visual-spec.md`，全文 576 行。
- 文档按计划覆盖背景与目标、当前 UI 基线、设计原则、全局视觉系统、核心页面规范、组件规范、交互与动效规范、可访问性检查和后续落地建议。
- 页面规范已覆盖 Pipeline、Agent、AppShell / Sidebar / Tab、Settings、Onboarding / Welcome、Chat 回退和 File Browser。
- 本次只新增 UI 规范文档与本地任务记录；未修改运行时代码、README 或 AGENTS，未新增 public API / IPC / shared type。
- 已完成静态校验：文件存在、章节与关键词检索通过，`git diff --check` 通过；本次为文档任务，未运行应用测试。

## 2026-05-16 全客户端 UI 视觉规范增强计划

- [x] 复核现有 `improve/ui/2026-05-16-client-ui-visual-spec.md`，确认不偏离“纯方案文档、不改实现代码、不改 README / AGENTS”的范围。
- [x] 在背景、基线、原则、全局视觉系统中补充更明确的适用对象、设计不变量、token 使用规则、主题验证和状态配方。
- [x] 在核心页面规范中补充 Pipeline、Agent、AppShell、Settings、Onboarding、Chat 回退、File Browser 的结构、状态、交互和验收细节。
- [x] 在组件、动效、可访问性和后续落地建议中补充组件 anatomy、状态矩阵、截图验收矩阵和 BDD 验证建议。
- [x] 执行静态检查：章节关键词覆盖、Markdown 可读性和 `git diff --check`。
- [x] 在本文末尾追加本次增强 Review。

## 2026-05-16 全客户端 UI 视觉规范增强 Review

- 已继续完善 `improve/ui/2026-05-16-client-ui-visual-spec.md`，全文从 576 行扩展到 1303 行。
- 背景与目标新增使用对象、成功标准和决策边界；当前 UI 基线新增审计口径、问题优先级、审计维度映射和应保留的风格资产。
- 设计原则新增设计不变量、信息降噪和 UI 文案规则；全局视觉系统新增 layout grid、z-index、状态配方、focus ring、loading / empty / error / success、主题一致性和数据 / 代码显示规范。
- 核心页面规范为 Pipeline、Agent、AppShell、Settings、Onboarding / Welcome、Chat 回退、File Browser 补充了 anatomy、状态、交互、空态、危险操作和验收口径。
- 组件规范新增 Tabs / Segmented Control、Notice / Banner / Toast、Empty / Skeleton / Error Block、Command / Menu / Dropdown、Path / File / Model Chip、Progress / Stepper、Form Validation 和 Icon Button 细则。
- 交互动效新增 async 操作状态矩阵、motion token、拖放文件交互和多会话后台反馈；可访问性新增页面级检查、键盘路径、对比度 / 色盲安全和 screen reader 文案建议。
- 后续落地建议新增拆分任务、BDD 验收场景、截图验收矩阵、风险约束和完成定义。
- 本次仍为纯文档增强；未修改运行时代码、README 或 AGENTS，未新增 public API / IPC / shared type。
- 已完成静态校验：关键词覆盖检查通过，`git diff --check` 通过；本次为文档任务，未运行 Electron 应用测试或 typecheck。

## 2026-05-16 全客户端 UI 视觉规范落地化优化计划

- [x] 复核现有规范，确认本轮只补实现蓝图和验收模板，不修改运行时代码、README 或 AGENTS。
- [x] 增加代码落地映射表，把规范项对应到 renderer 目录、组件和建议改造顺序。
- [x] 增加 Design Token 契约和量化默认值，减少实现时的范围漂移。
- [x] 增加页面级 wireframe，覆盖 AppShell、Pipeline、Agent、Settings 和 File Browser。
- [x] 增加 before / after 审计模板、验收脚本建议、截图基线路径和 MVP 优先级。
- [x] 执行静态检查并在本文末尾追加 Review。

## 2026-05-16 全客户端 UI 视觉规范落地化优化 Review

- 已继续优化 `improve/ui/2026-05-16-client-ui-visual-spec.md`，全文从 1303 行扩展到 1623 行。
- 新增 `2.6 代码落地映射表`：将 Theme tokens、UI primitives、Settings、AppShell、Tabs、Pipeline、Agent、AI content、File Browser、Chat 回退和 Welcome 映射到具体 renderer 目录与建议改造顺序。
- 新增 `4.15 Design Token 契约` 和 `4.16 量化默认值`：定义 surface、text、border、focus、status、radius、shadow、motion token alias，以及按钮、卡片、面板、字号、间距、动效的默认值。
- 新增 `5.8 页面级 Wireframe`：用结构图覆盖 AppShell、Pipeline、Agent、Settings 和 File Browser，明确核心区域、状态区和操作区位置。
- 新增 `6.15 组件默认值总表`：补充 Button、IconButton、Input、Composer、Card、Badge、Menu、Tooltip、Dialog、SettingsRow、FileTreeRow、TabItem 的默认尺寸和状态要求。
- 新增 `9.10` 到 `9.14`：before / after 审计模板、验收脚本与工具建议、截图基线命名、MVP 优先级和实现拆单建议。
- 本轮仍是纯文档优化；未修改运行时代码、README 或 AGENTS，未新增 public API / IPC / shared type。
- 已完成静态校验：新增章节关键词检索通过，`git diff --check` 通过；本次为文档任务，未运行 Electron 应用测试或 typecheck。

## 2026-05-16 全客户端 UI 迭代开发清单计划

- [x] 基于 `improve/ui/2026-05-16-client-ui-visual-spec.md` 生成独立开发 checklist，用于后续跟踪迭代进度。
- [x] 清单按最佳工程实践组织：阶段目标、依赖、范围、任务项、验收标准、验证命令、截图要求、提交边界和风险。
- [x] 覆盖 UI-0 到 UI-6：基线审计、token / primitive、AppShell、Pipeline、Agent、Settings、长尾页面与总体验收。
- [x] 明确每阶段不得改动 public API / IPC / shared type，除非单独评审；README / AGENTS 仍需用户允许后再改。
- [x] 执行静态检查：文件存在、章节关键词覆盖、`git diff --check`。
- [x] 在本文末尾追加 Review。

## 2026-05-16 全客户端 UI 迭代开发清单 Review

- 已新增 `improve/ui/2026-05-16-client-ui-implementation-checklist.md`，全文 789 行。
- 清单作为后续 UI 迭代开发进度看板，引用视觉规范 `2026-05-16-client-ui-visual-spec.md`，并明确总原则、迭代纪律、状态标记、验证分层和进度总览。
- 阶段覆盖 UI-0 到 UI-7：基线审计、token / primitive、AppShell / Sidebar / Tab、Pipeline 工作台、Agent 阅读与交互、Settings、Welcome / Chat 回退 / File Browser、全局验收与收尾。
- 每个阶段均包含目标、主要文件、不包含范围、任务清单、验收标准、验证命令、截图建议和阶段 Review 模板。
- 清单补充了 before / after 审计记录模板、阶段提交建议、风险登记和后续启动提示，便于后续按阶段单独提交与验证。
- 本轮仍是纯文档产物；未修改运行时代码、README 或 AGENTS，未新增 public API / IPC / shared type。
- 已完成静态校验：文件存在、章节与关键词覆盖检查通过，`git diff --check` 通过；本次为文档任务，未运行 Electron 应用测试或 typecheck。

## 2026-05-16 全客户端 UI 进度文档同步计划

- [x] 更新 `improve/ui/2026-05-16-client-ui-implementation-checklist.md` 当前开发状态，固定已提交文档基线 commit `7bef500c`。
- [x] 标注已完成：视觉规范文档、落地化优化、迭代开发清单和文档提交；标注未完成：UI-0 到 UI-7 真实 UI 实现阶段均未开始。
- [x] 更新下次启动提示，明确下次应先处理 untracked `.swp` 临时文件，再从 UI-0 基线审计与截图开始。
- [x] 执行静态检查并提交本阶段文档同步。
- [x] 在本文末尾追加 Review，并给用户一段下次启动 Codex 的提示词。

## 2026-05-16 全客户端 UI 进度文档同步 Review

- 已更新 `improve/ui/2026-05-16-client-ui-implementation-checklist.md`，新增“当前开发状态快照”和“下次启动提示词”。
- 已固定当前 UI 文档基线 commit：`7bef500c984803525e9c7fac67d2c959271d2a1c`（`docs(ui): 新增客户端 UI 视觉规范与迭代清单`）。
- 已明确已完成范围：视觉规范文档、Design Token 契约、量化默认值、页面 wireframe、组件默认值、before / after 审计模板、截图基线命名、MVP 优先级、实现拆单建议，以及 UI-0 到 UI-7 的开发跟踪清单。
- 已明确未完成范围：真实 UI 实现尚未开始，UI-0 到 UI-7 均未完成；下一步必须从 UI-0 基线审计与截图开始。
- 已记录当前注意事项：工作区存在未提交临时文件 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp`，不要纳入提交，后续启动前先确认是否为编辑器残留。
- 已完成静态校验：`git diff --check` 通过；本次为文档状态同步，未运行 Electron 应用测试或 typecheck。

## 2026-05-16 UI-0 基线审计与截图准备计划

- [x] 先执行 `git status --short`，确认开始前已有改动来源，并保护未跟踪 `.swp` 临时文件。
- [x] 复习 `AGENTS.md`、`tasks/lessons.md`、`tasks/todo.md`、UI 视觉规范和 implementation checklist 的 UI-0 阶段。
- [x] 梳理当前客户端可截图路径与主题 / 状态覆盖方式，不进入 UI-1 运行时代码修改。
- [x] 创建 `improve/ui/screenshots/` 和 UI-0 before 审计记录，使用视觉规范 `9.10 Before / After 审计模板`。
- [x] 记录 Pipeline、Agent、AppShell、Settings、Welcome / Onboarding、File Browser、Chat 回退的当前问题，按 P0 / P1 / P2 标注影响。
- [x] 采集或记录 Pipeline、Agent、Settings 至少 light / dark before 截图证据。
- [x] 明确 UI-1 到 UI-6 的优先级是否需要调整。
- [x] 运行 `git diff --check`，更新 UI checklist 和本文件 Review 后单独提交 UI-0。

## 2026-05-16 UI-0 基线审计与截图准备 Review

- UI-0 已完成 before 审计记录：`improve/ui/2026-05-16-client-ui-before-audit.md`。
- 已建立截图目录 `improve/ui/screenshots/`，保存 6 张 renderer baseline：Pipeline light / dark、Agent light / dark、Settings light / dark。
- 本轮确认 `.swp` 文件对应仍在运行的 vim 进程，不删除、不提交。
- 直接 Electron 窗口截图受系统截图权限限制失败；本轮使用临时 Vite renderer harness 采集截图，harness 已删除，未纳入提交。审计文档已明确该方法不能替代真实 Electron 端到端状态截图。
- 主要发现：P0 3 个、P1 6 个。优先风险集中在 Agent blocked 态、Pipeline gate / review 状态配方、icon-only 可访问名称、Settings 主次层级和 TutorialBanner 遮挡。
- UI-1 仍应先做 token / primitive；UI-2 需提前纳入 icon-only a11y 与 Tab / Sidebar indicator；UI-3 / UI-4 阶段开始时必须补真实状态截图 fixture。
- 本轮未改运行时代码、README、AGENTS、public API、IPC 或 shared type。
- 验证通过：`git diff --check`。

## 2026-05-16 UI-1 Token 与 Primitive 收敛计划

- [x] 执行 `git status --short`，确认本阶段开始时仅存在已知 `.swp` 临时文件。
- [x] 复习 UI checklist 的 UI-1 阶段、视觉规范 `4.15 Design Token 契约` 与 UI-0 before 审计结论。
- [x] 盘点 `globals.css`、Tailwind config、`components/ui` 与 settings primitives 的现有 token / primitive 缺口。
- [x] 增加最小语义 token alias：surface、text、border、focus、status、radius、shadow、motion，并覆盖 light / dark / ocean / forest / slate fallback。
- [x] 更新 Tailwind token 映射与 reduced-motion 基础样式，避免页面组件继续直接写一次性视觉值。
- [x] 收敛基础 primitive：Button、Badge、Dialog / AlertDialog、Popover / Tooltip、Input / Textarea、Settings primitives 的 radius、focus、motion 与 surface 语言。
- [x] 清理本阶段触达文件中的第一批裸 hex / 一次性颜色；无法 token 化的在 Review 中说明。
- [x] 递增 `@codeinsights/electron` patch 版本并同步锁文件。
- [x] 运行 UI-1 验证：`bun run --filter='@codeinsights/electron' typecheck`、`git diff --check`，并补充 light / dark / ocean primitive 截图证据。
- [x] 更新 UI checklist 与本文件 Review，单独提交 UI-1 阶段成果。

## 2026-05-16 UI-1 Token 与 Primitive 收敛 Review

- UI-1 已完成，范围限定在 renderer token / primitive / settings primitives、截图和 `@codeinsights/electron` 版本更新；未修改 README / AGENTS，未新增 public API / IPC / shared type。
- 新增 semantic token alias：surface、text、border、focus、running / waiting / success / danger / neutral status 三件套、radius、shadow、motion，并暴露到 Tailwind。
- 新增 `Card` 与 `Chip` primitive；Button 支持 loading，新增 `IconButton` 封装 tooltip + `aria-label`；Badge / Alert 支持状态 variant。
- 收敛 Dialog / AlertDialog / Popover / Tooltip / Dropdown / ContextMenu / Command / Tabs / Sheet / Input / Textarea / Select / Switch / Slider / Sonner / Settings primitives 的基础 radius、surface、shadow、focus 和 motion。
- Settings 密钥显隐按钮已从不可聚焦的裸 button 改为有 `aria-label` 和 tooltip 的 `IconButton`。
- `@codeinsights/electron` 版本 `0.0.58 -> 0.0.59`，`bun.lock` workspace metadata 已同步。
- 截图证据：`improve/ui/screenshots/primitives-light-default-desktop.png`、`improve/ui/screenshots/primitives-dark-default-desktop.png`、`improve/ui/screenshots/primitives-ocean-status-desktop.png`。
- 验证通过：`bun run --filter='@codeinsights/electron' typecheck`、`bun run --filter='@codeinsights/electron' build:renderer`、`bun install --frozen-lockfile --dry-run`、`git diff --check`。renderer build 仅保留既有 chunk size warning。
- 残留风险：页面级 AppShell / Pipeline / Agent 仍有局部状态色和布局 class，需按 UI-2 到 UI-4 分阶段迁移；`globals.css` 中既有特殊主题裸色覆盖仍作为后续主题治理范围保留。

## 2026-05-16 UI-1 后开发状态文档同步计划

- [x] 检查 `git status --short`，确认当前没有未提交代码变更需要纳入 UI 状态文档同步。
- [x] 更新 `tasks/lessons.md`，记录“token / primitive 完成不等于主界面可见变化”的表达教训。
- [x] 更新 `improve/ui/2026-05-16-client-ui-implementation-checklist.md` 当前状态：UI-0 / UI-1 已完成，UI-2 到 UI-7 未完成。
- [x] 在 checklist 中明确 UI-1 只是基础层，Pipeline 主界面、左侧栏、阶段栏、任务输入区和阶段产物区仍未进入页面级视觉改造。
- [x] 更新下次启动提示词，要求下次从 UI-2 AppShell / Sidebar / Tab 开始，不跳到 UI-3。
- [x] 执行文档静态校验并追加 Review。

## 2026-05-16 UI-1 后开发状态文档同步 Review

- 已同步 UI 最新开发状态：UI-0 commit `61c263c8` 已完成 before 审计与截图，UI-1 commit `20a90d36` 已完成 token 与 primitive 收敛。
- 已明确未完成范围：UI-2 AppShell / Sidebar / Tab、UI-3 Pipeline 工作台、UI-4 Agent、UI-5 Settings、UI-6 Welcome / Chat 回退 / File Browser、UI-7 全局验收均未开始。
- 已补充重要澄清：UI-1 不等于真实客户端主界面 redesign，用户重启后在 Pipeline 主屏看到旧界面是符合当前阶段边界的；主界面可见变化从 UI-2 / UI-3 开始。
- 已将下次启动提示词更新为 UI-2 版本，明确先读文档、先 `git status --short`、保护 `.swp` / `.DS_Store`、不改 README / AGENTS、不新增 IPC / public API / shared type。
- 已知工作区噪音：`.DS_Store` tracked 修改和 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp` 未跟踪文件，均不属于 UI 阶段成果，不能纳入提交。
- 本轮文档静态校验：`git diff --check` 通过；未运行 Electron 应用测试或 typecheck，因为本轮只同步文档状态。

## 下次启动提示词（UI-2）

```text
你正在 CodeInsights 仓库继续推进全客户端 UI 优化。

请先阅读并遵守：
- AGENTS.md
- tasks/lessons.md
- tasks/todo.md
- improve/ui/2026-05-16-client-ui-visual-spec.md
- improve/ui/2026-05-16-client-ui-implementation-checklist.md

当前进度：
1. UI 文档基线已完成并提交，commit 为 7bef500c984803525e9c7fac67d2c959271d2a1c，提交标题为 docs(ui): 新增客户端 UI 视觉规范与迭代清单。
2. UI-0「基线审计与截图准备」已完成并提交，commit 为 61c263c80bf98169b64b40c6bddc79bc7873b8fd，提交标题为 docs(ui): 完成 UI-0 基线审计与截图。
3. UI-1「Token 与 primitive 收敛」已完成并提交，commit 为 20a90d3679147dd27c035d9c957546823924ac4b，提交标题为 feat(ui): 完成 UI-1 token 与 primitive 收敛。
4. 已完成：UI-0、UI-1。未完成：UI-2、UI-3、UI-4、UI-5、UI-6、UI-7。
5. 重要澄清：UI-1 只完成 token、Tailwind 映射和基础 primitive 收敛，不是用户可见主界面 redesign；重启客户端后 Pipeline 主界面、左侧栏、阶段栏、任务输入区和阶段产物区基本不会明显变化。
6. 当前工作区可能存在未提交临时文件 improve/ui/.2026-05-16-client-ui-visual-spec.md.swp，以及 .DS_Store 修改；它们不是 UI 阶段成果，不要纳入提交，先确认来源并保护用户变更。

请从 UI-2「AppShell / Sidebar / Tab」开始：
1. 先执行 git status --short，保护已有用户变更。
2. 阅读 implementation checklist 的 UI-2 阶段和视觉规范 `5.1 AppShell / Sidebar / Tab`、`5.8 页面级 Wireframe`。
3. 先做 UI-2 before 审计，再实现 AppShell、LeftSidebar、PipelineSidebar、TabBar / TabBarItem、MainArea、RightSidePanel 的视觉和状态收敛。
4. 不要跳过 UI-2 直接进入 UI-3；用户截图红框内 Pipeline 主面板属于 UI-3，需在 UI-2 完成后再改。
5. 本轮仍遵守 Jotai、Radix/shadcn 风格组件、Lucide 图标、现有主题 token、本地 JSON/JSONL 存储的约束。
6. 不新增 public API / IPC / shared type，除非单独评审；不修改 README / AGENTS，除非用户明确允许。
7. UI-2 完成定义：当前模式、当前 session、当前 tab、后台 running / blocked / failed 状态可见；Sidebar / Tab keyboard focus 清楚；light / dark / 至少一个特殊主题下无明显溢出。
8. 验证：至少运行 bun run --filter='@codeinsights/electron' typecheck、git diff --check，并采集 UI-2 light / dark / 特殊主题截图。
9. 每完成一个阶段并通过该阶段验证后，立即更新 checklist 和 tasks/todo.md 的 Review，并单独提交该阶段成果；不执行 push / PR，除非用户明确要求。
```

## 2026-05-16 UI-2 AppShell / Sidebar / Tab 计划

- [x] 执行 `git status --short`，确认当前只有 `.DS_Store` 修改和 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp` 未跟踪文件，二者均不纳入 UI-2 提交。
- [x] 复习 `AGENTS.md`、`tasks/lessons.md`、UI checklist 的 UI-2 阶段，以及视觉规范 `5.1 AppShell / Sidebar / Tab`、`5.8 页面级 Wireframe`。
- [x] 做 UI-2 before 审计，记录 AppShell / LeftSidebar / PipelineSidebar / TabBar / MainArea / RightSidePanel 当前结构、状态 indicator、focus 和溢出风险。
- [x] 实现 UI-2 视觉收敛：统一 AppShell 三栏 surface、LeftSidebar icon button、PipelineSidebar session item、TabBar / TabBarItem 状态 indicator、MainArea 与 RightSidePanel 层级。
- [x] 保持阶段边界：不进入 Pipeline 主面板 UI-3，不修改 Agent message / composer，不新增 public API / IPC / shared type，不修改 README / AGENTS。
- [x] 递增 `@codeinsights/electron` patch 版本并同步 `bun.lock`。
- [x] 运行 `bun run --filter='@codeinsights/electron' typecheck`、`git diff --check`，并采集 UI-2 light / dark / 特殊主题截图。
- [x] 更新 UI checklist 和本文件 Review，单独提交 UI-2 阶段成果。

## 2026-05-16 UI-2 AppShell / Sidebar / Tab Review

- UI-2 已完成，范围限定在 AppShell、Sidebar、TabBar / TabBarItem、MainArea、Agent RightSidePanel、状态派生 atom、截图和 `@codeinsights/electron` 版本更新；未修改 README / AGENTS，未新增 public API / IPC / shared type。
- 新增 before 审计记录：`improve/ui/2026-05-16-client-ui2-before-audit.md`。
- Shell 三栏统一到 `surface-app / surface-panel / rounded-panel / shadow-panel / border-subtle`；ModeSwitcher 使用 primary token；TabBar active tab 与 MainArea panel 连贯，非 active tab 降权。
- Sidebar / Tab 状态统一：Pipeline waiting -> blocked，node / recovery failed -> failed；Agent stream error / retry failed -> failed；running / blocked / failed / completed 使用 token 化细线和 tooltip，不整块染色。
- 可访问性修复：Tab close button 改为真实独立 button，避免 button 嵌套；Conversation / Agent / Pipeline 侧栏行补 Enter / Space 激活，并限制为仅在行容器自身聚焦时触发，避免子按钮键盘事件冒泡误选中会话；icon-only 操作补 `aria-label` 与 focus-visible ring。
- `@codeinsights/electron` 版本 `0.0.59 -> 0.0.60`，`bun.lock` workspace metadata 已同步。
- 截图证据：`improve/ui/screenshots/appshell-light-multi-tab-desktop.png`、`improve/ui/screenshots/appshell-dark-background-running-desktop.png`、`improve/ui/screenshots/appshell-forest-blocked-desktop.png`。
- 验证通过：`bun run --filter='@codeinsights/electron' typecheck`、聚焦测试 21 pass、`bun install --frozen-lockfile --dry-run`、`git diff --check`。
- 代码审查结果：已修复 Tab button 嵌套、侧栏 `role=button` 缺键盘激活，以及行级 Enter / Space handler 接收子按钮冒泡导致误选中会话的问题。ModeSwitcher tab/radio 语义建议留到后续 a11y 精修。
- 残留风险：Pipeline 主面板 StageRail / Records / Gate / Composer 仍属 UI-3 范围，本阶段没有进入页面内部重排；截图为 desktop 1280x720，窄屏矩阵留到 UI-7 总体验收。

## 2026-05-16 UI 进度文档同步计划

- [x] 检查 `git status --short`，确认当前只剩 `.DS_Store` 和视觉规范 swap 文件需要保护。
- [x] 更新 UI checklist 顶部状态：UI-0、UI-1、UI-2 已完成，UI-3 到 UI-7 未完成。
- [x] 更新当前启动提示和下次启动提示词：下一阶段从 UI-3 Pipeline 工作台开始，不再重复 UI-2。
- [x] 明确 UI-2 可见变化有限，用户截图中的 Pipeline 主面板属于 UI-3。
- [x] 追加本地 todo Review，便于下次恢复跟踪。

## 2026-05-16 UI 进度文档同步 Review

- 已同步 `improve/ui/2026-05-16-client-ui-implementation-checklist.md`：新增 UI-2 commit `c3636336`，阶段表维持 UI-0 / UI-1 / UI-2 已完成，UI-3 / UI-4 / UI-5 / UI-6 / UI-7 未完成。
- 已将 checklist 的“当前启动提示”和“下次启动提示词”改为 UI-3 版本：下次应先做 UI-3 before 审计，再改 PipelineHeader、PipelineStageRail、PipelineRecords、PipelineGateCard、PipelineComposer。
- 已明确下次开发边界：AppShell / Sidebar / Tab 已完成；不要回头重复 UI-2；Pipeline 主面板才是下一步直观可见的 UI 改造重点。
- 当前仍需保护 `.DS_Store` 与 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp`，不要纳入 UI 阶段提交。

## 2026-05-16 Pipeline 记录区创意 UI 优化计划

- [x] 复习 `tasks/lessons.md`，确认本轮必须让 Pipeline 主内容区产生真实可见变化。
- [x] 执行 `git status --short`，确认并保护现有 `.DS_Store` 与 `improve/` 临时文件。
- [x] 重构 `PipelineComposer` 运行态为任务指令条，保留停止运行操作，长任务可换行不溢出。
- [x] 重构 `PipelineRecords` 控制区为任务档案 / 运行轨迹工作台，优化统计胶囊、搜索台、工具栏与阶段筛选。
- [x] 优化阶段产物 / 运行日志 tabs 与空状态视觉，保持 Radix/shadcn 交互语义。
- [x] 在 `globals.css` 增加少量 Pipeline 专用视觉 class，并加入 reduced motion 降级。
- [x] 运行 typecheck、相关 Pipeline 组件测试、`git diff --check`，按结果修正。
- [x] 启动本地应用并尝试 Browser / Electron 截图检查；Electron 正常启动，裸 Vite 浏览器因缺少 preload 只能显示空白，系统 `screencapture` 当前无法创建截图。
- [x] 追加本轮 Review，说明验证结果与残留风险。

## 2026-05-16 Pipeline 记录区创意 UI 优化 Review

- 已完成红框区域可见 UI 改造：`当前任务` 从普通卡片改为运行指令条，增加状态徽章、任务正文容器、扫描光带和停止运行危险操作。
- 已完成 `产物与运行日志` 控制区改造：标题升级为“任务档案 / 运行轨迹”，记录数、显示数、搜索命中改为信息胶囊，搜索台和工具栏整合在同一操作 deck。
- 已完成阶段筛选和 tabs 改造：阶段筛选改为带编号的 segmented rail；`阶段产物 / 运行日志` 变为带 Lucide 图标的嵌入式二级导航；空状态升级为带档案图标、说明文案和网格纹理的状态面板。
- 已新增 Pipeline 专用 CSS class，并为扫描线 / beacon 动画加入 `prefers-reduced-motion` 降级；未新增依赖，未改 IPC / shared type / Jotai / 持久化逻辑。
- 验证通过：`bun run typecheck`、`bun test apps/electron/src/renderer/components/pipeline/PipelineComposer.test.ts apps/electron/src/renderer/components/pipeline/PipelineRecords.test.ts`、`git diff --check`。
- 运行验证：`bun run dev` 可启动 Vite 与 Electron，Electron 主进程日志显示 IPC、runtime、tray、watcher 正常启动；Browser 打开 `http://localhost:5173/` 时因没有 Electron preload/API 只能看到空白 renderer，不能作为真实 UI 判断。
- 截图限制：尝试激活 Electron 后使用 macOS `screencapture` 失败，错误为 `could not create image from display`，因此本轮没有留下宽屏 / 窄屏截图证据。
- 已停止本轮启动的开发进程；仍需保护既有无关变更：`.DS_Store`、`improve/.DS_Store`、`improve/ui/.2026-05-16-client-ui-visual-spec.md.swp`、`improve/ui/.DS_Store`。

## 2026-05-16 Agent / Pipeline Cockpit 创意 UI 刷新计划

- [x] 使用 `ui-ux-pro-max` 复核可访问性、状态清晰、语义 token、克制动效规则。
- [x] 执行 `git status --short`，确认并保护既有 `.DS_Store` 与 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp`。
- [x] 增加 cockpit 风格语义 CSS：mission strip、message card、reasoning chamber、tool rail、composer deck、resource well，并包含 reduced-motion 降级。
- [x] 优化 AgentHeader 为紧凑 mission strip，显示标题、工作区、模型、权限、运行 / 计划状态和文件面板入口。
- [x] 优化 AgentMessages：用户消息、助手输出、运行指示、重试提示和旧格式 fallback 使用更清晰的阅读骨架。
- [x] 优化 ToolActivityItem：工具活动行、分组、详情面板采用状态轨和可扫描元信息。
- [x] 优化 AgentView Composer：输入区变为 command deck，状态 notice、建议、附件和工具栏稳定不跳动。
- [x] 优化 SidePanel 文件资源区：会话 / 工作区文件区、drop zone 外层、附加目录和文件行更像资源面板。
- [x] 运行 `bun run --filter='@codeinsights/electron' typecheck`、相关聚焦测试和 `git diff --check`。
- [x] 启动 Electron 做 light / dark / 特殊主题抽样检查；若截图受限，在 Review 中说明。
- [x] 追加本轮 Review，记录验证结果与残留风险。

## 2026-05-16 Agent / Pipeline Cockpit 创意 UI 刷新 Review

- 已完成 Agent 三栏工作台的 cockpit 视觉刷新：主画布增加克制网格微光，Header 升级为 mission strip，消息区、Reasoning Chamber、工具活动、Composer command deck、右侧资源面板和左侧 Agent 入口统一到同一层级语言。
- 改动保持视觉层范围：未改 IPC、Agent SDK / Pipeline 逻辑、Jotai state shape、持久化结构、shared package API、README 或 AGENTS；未新增依赖。
- 新增 CSS 均为 Agent scoped utility，使用现有 semantic token / CSS variable；状态表达同时包含图标、文案或结构轨道，不只依赖颜色，并包含 `prefers-reduced-motion` 降级。
- `@codeinsights/electron` 版本 `0.0.66 -> 0.0.67`，`bun.lock` workspace metadata 已同步。
- 验证通过：`bun install --frozen-lockfile --dry-run`、`bun run --filter='@codeinsights/electron' typecheck`、`bun test apps/electron/src/renderer/components/agent/agent-ui-model.test.ts` 7 pass / 21 expect、`git diff --check`。
- 运行验证：`bun run dev` 可启动 Vite、main/preload 构建、Electron、IPC、runtime、tray 和 watcher；日志未出现 renderer 编译失败。macOS `screencapture` 当前失败，错误为 `could not create image from display`，因此本轮无法留下 light / dark / 特殊主题截图证据。
- 已停止本轮启动的 Vite / Electron 开发进程；仍需保护既有无关文件：`.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 和 `improve/ui/.2026-05-16-client-ui-visual-spec.md.swp`，不要纳入提交。

## 2026-05-22 CodeInsights 架构图谱生成计划

- [x] 复习 `tasks/lessons.md`，确认本轮需要保护既有无关 `.DS_Store`，并在完成前做可渲染验证。
- [x] 读取 `fireworks-tech-graph` skill 与 style 7 OpenAI Official 规范，确定采用纯白、极简、绿色主箭头、SVG+PNG 双格式输出。
- [x] 梳理仓库分层：Bun workspace、Electron 主进程、preload、renderer、shared/core/ui 包、配置与本地文件存储。
- [x] 梳理关键运行链路：IPC 桥接、Agent SDK 事件流、Pipeline LangGraph 节点流、Provider 适配器、设置/工作区/持久化。
- [x] 设计一组架构、流程、框架图，覆盖总体架构、IPC/状态、Agent、Pipeline、数据存储/配置等主题。
- [ ] 在 `assets/imgs/` 生成 style 7 SVG，并导出对应 PNG。
- [ ] 运行 SVG XML 校验、PNG 导出校验、抽样视觉检查，修复箭头、文字、边距问题。
- [ ] 在本文件追加 Review，记录生成文件、验证结果与残留风险。

## 2026-05-23 CodeInsights 新项目图标替换计划

- [x] 启动前复习 `tasks/lessons.md`，确认本轮不再新增候选图标，直接把用户提供的新项目图标替换为当前生效资源。
- [x] 检查工作树，保护既有 `.DS_Store`、`assets/`、`improve/` 和本文件已有未提交记录，不回滚无关改动。
- [x] 盘点旧项目图标入口：Electron 打包图标 `apps/electron/resources/icon.*`、运行时资源副本、托盘 template、渲染层 `models/codeinsights.png`、品牌 Logo 下载资源。
- [x] 以 `assets/icon/CodeInsights.png` 为源生成 1024 PNG、macOS `.icns`、Windows `.ico`、托盘尺寸 PNG，并同步替换 renderer / resources 中的 CodeInsights 旧图标。
- [x] 复查源码引用和资源清单，确认第三方模型/平台图标不被误替换。
- [x] 运行资源尺寸校验、必要构建验证和 `git diff --check`，在本节追加 Review。

## 2026-05-23 CodeInsights 新项目图标替换 Review

- 已使用 `assets/icon/CodeInsights.png` 生成当前项目图标，并把已跟踪的 `apps/electron/resources/icon.png` 作为后续默认源；Electron 生效图标已导出为 `icon.png`、`icon.icns`、`icon.ico`。
- 已移除旧 SVG 图标形状：`apps/electron/resources/icon.svg` 改为引用已跟踪的 `resources/icon.png`，`apps/electron/resources/codeinsights-logos/icon.svg` 改为单色 CI tray 标记，避免继续从旧斜条矢量图生成。
- 已重写 `apps/electron/resources/generate-icons.sh`：默认从已跟踪的 `resources/icon.png` 生成 Electron、renderer、web、video 和品牌素材；需要刷新源图时可通过 `CODEINSIGHTS_ICON_SOURCE` 指向新 PNG；tray template 由脚本绘制单色 CI 标记。不再使用 `icon.svg -> icon.png` 自引用，也不依赖本机未安装的 `rsvg-convert` / ImageMagick。
- 已同步渲染层 CodeInsights 图标：`apps/electron/src/renderer/assets/models/codeinsights.png`，以及 `apps/electron/src/renderer/assets/bots/codeinsights-logos/*.png`。
- 已同步打包资源品牌图标：`apps/electron/resources/codeinsights-logos/*.png`；其中 `codeinsights-transparent.png` 使用透明背景 cutout，其余变体统一为新正式图标，避免旧图标残留。
- 已同步非 Electron 明确品牌入口：`web/assets/brand/logo.webp` 与 `assets/video/assets/codeinsights-logo-cutout*.png`；第三方模型、飞书、微信、钉钉等平台图标未替换。
- 已生成托盘 template 资源：`iconTemplate.png`、`iconTemplate@2x.png`、`iconTemplate@3x.png`，尺寸分别为 22 / 44 / 66 px；视觉抽样确认为单色 CI 标记，不再是旧斜条图标。
- 审查发现并已修复：第一轮生成后 `icon.ico` 和三份 tray template 与 HEAD hash 一致，说明仍是旧资源；修复后四个文件当前 hash 均不同于 HEAD，并已抽样打开 `.ico` 确认为新 App icon。
- 验证通过：执行 `CODEINSIGHTS_ICON_SOURCE="$PWD/assets/icon/CodeInsights.png" apps/electron/resources/generate-icons.sh`；SVG `xmllint --noout`；PIL 尺寸检查覆盖源图、Electron PNG/ICO、renderer PNG、WebP、视频 cutout、托盘 template；当前 vs HEAD hash 对比覆盖 `icon.ico` 和三份 tray template；源码扫描确认没有 tracked 文件继续引用未跟踪 `assets/icon/CodeInsights.png`；`bun run --filter='@codeinsights/electron' typecheck`；清理后执行 `bun run --filter='@codeinsights/electron' build`；`git diff --check`。
- 已清理后重建 `apps/electron/dist/resources`，确认 ignored dist 中不再保留旧 `proma-logos`；构建仍有既有 Vite chunk size warning。本轮未引入运行时代码变更；当前工作树中 `.DS_Store`、`docs/.DS_Store` 和未跟踪 `assets/` / `improve/` 为既有状态或资产目录，不应误纳入无关提交。

## 2026-05-23 中文 README 完善计划

- [x] 复习 `tasks/lessons.md`，确认本轮需要保护既有无关 `.DS_Store` / 资产目录状态，且文档内容必须以当前代码和素材为准。
- [x] 盘点当前 `README.md`、workspace 包版本、Electron 脚本、主进程服务、renderer 模块、IPC 契约、Pipeline / Agent 运行链路与本地存储结构。
- [x] 盘点 `assets/` 下图标、架构图、流程图、存储图和介绍视频素材，选择适合 README 首屏和架构章节的引用方式。
- [x] 重写或整理中文 README：突出项目定位、核心能力、快速开始、架构图、模块说明、开发/打包/验证命令、配置与安全边界、贡献提示。
- [x] 验证 README 中的本地资源路径、标题锚点、命令和 package 版本，运行 Markdown / 链接 / diff 静态检查。
- [x] 在本文件追加 Review，记录最终改动、验证结果、未覆盖风险和后续建议。

## 2026-05-23 中文 README 完善 Review

- 已将 `README.md` 重写为当前项目状态的中文 README，覆盖项目定位、核心能力、快速开始、技术栈、Monorepo 结构、整体架构、Pipeline v2、Agent Runtime、IPC / Jotai 状态、本地存储、Provider、Bridge、开发指南、打包发布、安全边界、素材目录和常见问题。
- 已结合 `assets/` 素材：顶部引用 `assets/icon/CodeInsights.png`，项目展示引用 `assets/video/snapshots/contact-sheet.jpg` 并链接 20 秒介绍视频，架构章节引用系统架构图、Pipeline LangGraph 流程图、Agent Runtime 流程图、IPC 状态流图和本地存储结构图。
- 已纠正旧 README 的过期事实：默认新建 Pipeline 是 v2 六节点，包含 `committer`；v2 中 `tester` 和 `committer` 走 Codex；`@codeinsights/electron` 当前为 `0.0.102`；开发模式默认 `.codeinsights-dev`，正式版本默认 `.codeinsights`；运行中的 Pipeline 跨重启不会继续跑，只可靠恢复 `waiting_human` gate。
- 已保留谨慎边界：Chat 为隐藏回退而非公开主入口；素材图中 `RV-Insights` 是历史项目名；根目录当前未检测到独立 LICENSE 文件，许可证说明需以最终 LICENSE / NOTICE 为准。
- 验证通过：`git diff --check`；自定义 Node 脚本检查 `README.md` 的 24 个链接 / 图片和 47 个标题锚点均可解析；旧版本号和过期五阶段表述扫描未发现需要修正的残留。
- 本轮只修改文档，未运行 TypeScript typecheck 或应用构建；当前工作树仍有既有无关 `.DS_Store` 修改、未跟踪 `assets/` 和 `improve/` 目录状态，不应误纳入无关提交。

## 2026-05-23 README 首屏视频与旧名清理 Review

- 已把 README 首屏的图标位替换为 20 秒视频预览，视频链接和设计说明放在标题后第一视觉位，不再单独展示重复的“项目展示”区块。
- 已从 README 中清理所有历史项目名相关提示，包括旧名说明段、FAQ 和旧配置目录的直白命名，只保留不暴露旧项目名的迁移表述。
- 已重新渲染 `assets/video/codeinsights-intro-20s.mp4`、`assets/video/snapshots/contact-sheet.jpg`、`assets/video/render-contact-sheet.jpg` 和关键帧快照；新视频首帧与 README 预览均为 CodeInsights 品牌内容。
- 已同步修正 `assets/imgs/codeinsights-system-architecture.png`、`assets/imgs/codeinsights-local-storage-framework.png` 和 `assets/video/assets/system-architecture.png`，避免视频和架构素材继续暴露历史名称。
- 验证通过：`bun run lint`；`bun run validate`（带 `HYPERFRAMES_BROWSER_PATH=/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge` 和 `PRODUCER_FORCE_SCREENSHOT=1`）；`bun run inspect -- --samples 12 --timeout 30000`；`rg -n "RV-Insights|rv-insights|rv_insights|@rv-insights|\\.rv-" README.md assets/video/index.html assets/video/DESIGN.md assets/imgs/*.svg assets/video/meta.json assets/video/package.json assets/video/hyperframes.json`；`git diff --check`。
- 残留风险仅在仓库里既有的无关 `.DS_Store` 噪音和未跟踪资产目录，不属于本次 README 修复范围。

## 2026-05-23 README 参考页样式对齐 Review

- 已把 README 顶部改成更接近参考页的展示结构：居中品牌标题、语言切换、简短定位、彩色徽章、原生视频播放器和锚点导航。
- 已新增三栏式“产品优势”卡片，把项目最重要的三件事先讲清楚：可审计流水线、本地优先工作台、复用成熟运行时。
- 已保持正文深层内容不变，只收敛顶部入口与信息层级，让 README 先像一个项目首页，再展开详细架构、命令和边界。
- 已按用户澄清把 `<video>` 的 `src` 改为 GitHub 绝对视频地址，避免 README 上的视频播放器退化成静态预览或相对文件跳转；仓库内 mp4 链接保留为备用入口。
- 验证通过：`git diff --check`；README 本地链接/媒体/锚点 Node 检查；`curl -L --head --fail` 远程视频地址检查；`rg` 旧名扫描；`ffprobe` 视频文件检查。
- 残留风险仅在工作树既有的 `.DS_Store` 和未跟踪资产目录，不属于本轮 README 结构调整范围。

## 2026-05-23 README GitHub 附件视频修复计划

- [x] 复核远端 GitHub README 渲染结果，确认 raw 仓库 mp4 的 `<video>` 被过滤成空段落。
- [x] 获取 GitHub `user-attachments/assets` 视频地址，按 ScienceClaw 参考写法替换 README 首屏播放器。
- [x] 验证附件 URL 可访问、GitHub Markdown 渲染保留播放器、README 不含旧项目名。
- [x] 提交并推送修复，避免纳入无关 `.DS_Store` 改动。

## 2026-05-23 README GitHub 附件视频修复 Review

- 已确认上一版 raw 仓库 mp4 会被 GitHub README 渲染器过滤成空段落，导致页面上没有可播放视频。
- 已通过 GitHub 编辑器上传并持久化视频附件，最终 README 使用可匿名访问的 `https://github.com/user-attachments/assets/64ca3efd-b424-4e09-b0ca-9c4840cf9588`。
- 已验证新附件匿名请求能返回 mp4 文件头，GitHub Markdown API 会保留 `gh:secured-asset-reference` 与 `<video>`，README 旧名扫描无结果。

## 2026-05-23 当前分支合并到主分支计划

- [x] 启动前复习 `tasks/lessons.md`，确认大规模合并前必须先规划、保护无关工作树改动，并在实现前 check-in。
- [x] 更新 `origin/main` 引用并检查分支状态：当前分支为 `base/agent-core-refactor`，主分支为 `origin/main`。
- [x] 识别关键风险：`git merge-base HEAD origin/main` 无共同祖先，当前不是普通分支合并，而是两套不同 Git 历史的树级接入。
- [x] 量化差异：当前树相对 `origin/main` 为 1110 个文件变化，约 244470 行新增、4990 行删除；当前分支树 1106 个文件，`origin/main` 树 28 个文件。
- [x] 用户确认目标：让主分支采用当前桌面应用/monorepo 作为新主线；不直接在主分支上尝试 `merge --allow-unrelated-histories`。
- [x] 采用策略 A：从 `origin/main` 创建保留双亲历史的整树替换式 merge commit，commit tree 以当前分支为准，排除 `.DS_Store` 等无关文件。
- [ ] 备选策略 B：若主分支仍要保留现有 28 文件网站形态，则不要整树合并；改为按功能分批 cherry-pick/移植，并为每批跑验证后单独提交。
- [x] 执行前清理或隔离当前工作树无关噪音：`.DS_Store`、`docs/.DS_Store`、`assets/.DS_Store`、`assets/icon/.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 不纳入合并。
- [x] 验证清单：`git status --short`、树差异审查、`bun run typecheck`、`bun test --isolate`、`bun run electron:build`、`git diff --check`；本轮未额外启动真实 Electron 桌面壳。
- [x] Review：执行后记录最终策略、验证结果、未处理风险和是否需要推送/PR。

## 2026-05-23 当前分支合并到主分支 Review

- 合并策略采用“整树替换式双父 merge commit”：第一父为 `origin/main`，第二父为当前 `base/agent-core-refactor`，最终文件树以当前桌面应用/monorepo 为准。
- 本地已有 `main` 与 `origin/main` 也没有共同 merge-base；执行前保留本地 `main` 的备份分支，避免丢失本地旧引用。
- 合并提交通过临时 index 生成，只包含当前分支文件树和本次 `tasks/todo.md` 记录；未纳入当前工作树中的未提交 `.DS_Store` 噪音。
- 复查发现当前分支历史里已有被跟踪的 `.DS_Store`，且整树接入相对 `origin/main` 暴露出既有尾随空白；已在 `main` 上追加一个纯机械清理提交，删除 6 个被跟踪 `.DS_Store`、补 `.gitignore` 规则并清理尾随空白。
- 最终验证在临时 `main` worktree 执行通过：`git diff --check origin/main --`；`bun install`；`bun run typecheck`；`bun test --isolate`（508 pass / 0 fail）；`bun run electron:build`。
- 本轮仅完成本地 `main` 与 `codex/integrate-agent-core-refactor` 分支整合；未执行 `git push` 或创建 PR。

## 2026-05-23 README 标题图标白圈修正计划

- [x] 按用户纠正更新 `tasks/lessons.md`：README 首屏图标不能使用带白色外圈的旧 RGB 素材。
- [x] 确认 README 当前引用的 `assets/icon/CodeInsights.png` 带白圈且无 alpha；仓库内 `apps/electron/resources/icon.png` 已是透明外缘主图标。
- [x] 用透明外缘主图标替换 README 引用的 `assets/icon/CodeInsights.png`，保持 README 结构不变。
- [x] 验证图标 alpha、尺寸、README diff 和空白检查，提交并推送到远程 `main`。
- [x] Review：记录最终使用的素材、验证结果和仍有工作树噪音未处理。

## 2026-05-23 README 标题图标白圈修正 Review

- 已将 `assets/icon/CodeInsights.png` 从无 alpha 的 1254x1254 RGB 图替换为透明外缘的 1024x1024 RGBA 主图标，README 首屏仍引用同一路径。
- 验证四角 alpha 均为 0，去除了 README 图标周围可见白圈，只保留中间 CI 主体。
- 验证通过：PIL 尺寸/alpha 抽样；`sips -g pixelWidth -g pixelHeight -g hasAlpha assets/icon/CodeInsights.png`；`git diff --check -- README.md assets/icon/CodeInsights.png tasks/lessons.md tasks/todo.md`。
- 当前原工作树仍保留既有 `.DS_Store` 和任务记录未提交状态，本轮远程 `main` 提交未纳入这些噪音。

## 2026-05-25 Agent 模式 Codex Runtime 接入方案计划

- [x] 复习 `tasks/lessons.md`，确认本轮需要优先保护 Agent Runtime 新旧 session、Codex auth 隔离、真实 stop、权限/AskUser 字段契约等既有教训。
- [x] 明确需求边界：不是新增普通模型 Provider，而是在 Agent 模式下新增可插拔 Coding Agent Runtime 后端，直接复用完整 Codex runtime。
- [x] 调研当前 Agent 模式 Claude Code 运行链路，梳理 UI / IPC / Orchestrator / Adapter / Runtime Runner 的耦合点。
- [x] 调研当前 Pipeline Codex runner，区分可复用基础能力和 Pipeline 专用逻辑。
- [x] 核对本地 `@openai/codex-sdk` / `@openai/codex` 接口与官方文档，记录 thread、stream、env、auth、MCP、sandbox 等事实边界。
- [x] 在 `docs/codex-support/` 下撰写详细开发方案，覆盖架构目标、抽象设计、数据契约、迁移步骤、测试验证、风险与阶段计划。
- [x] 自检方案是否足够优雅且最小影响，运行 Markdown 静态检查和 diff 检查。
- [x] 在本节追加 Review，记录文档产物、关键结论、验证结果和未覆盖风险。

## 2026-05-25 Agent 模式 Codex Runtime 接入方案 Review

- 已新增 `docs/codex-support/2026-05-25-agent-codex-runtime-integration-plan.md`，作为 Agent 模式 Codex Runtime 接入的主开发方案文档。
- 方案明确需求边界：这不是新增普通 OpenAI Provider，而是新增可插拔 Coding Agent Runtime 后端；CodeInsights 只做代理层和体验层，Codex 能力由完整 Codex runtime 提供。
- 已结合现有代码事实：Agent 当前链路仍由 `ClaudeAgentAdapter` / `ClaudeAgentQueryOptions` 强耦合；Runner v2 和 runtime envelope 已存在但尚未完全中立；Pipeline Codex runner 可复用 binary/env/auth/packaging 经验，但不能直接复用节点式 JSON Schema 执行逻辑。
- 已核对本地 `@openai/codex-sdk@0.130.0` / `@openai/codex@0.130.0` README、类型定义、CLI help，以及 OpenAI Codex 官方仓库的 SDK / AGENTS / config / skills 文档入口；文档中记录了 `runStreamed()`、`resumeThread()`、env 替换、sandbox、approval、Codex event item 类型和当前 SDK 未暴露 per-tool permission callback 的限制。
- 方案建议三阶段策略：先抽中立 `CodingAgentRuntime` 边界并保持 Claude 行为不变；再用 Codex SDK `runStreamed()` 接入 `CodexAgentRuntime`；最后按真实 SDK 能力补齐 MCP、permission、fork、rewind 等差异能力。
- 已明确首版风险和非等价能力：Codex 首版不应伪造成 Claude SDKMessage，不承诺 per-tool permission parity，不支持或需禁用 rewind / soft interrupt / 运行中队列注入；Codex 会话历史应优先从 runtime events 回放。
- 验证通过：Markdown code fence 平衡检查；标题层级检查；`git diff --check -- docs/codex-support/2026-05-25-agent-codex-runtime-integration-plan.md tasks/todo.md`。
- 本轮只新增设计文档和任务记录，未修改运行时代码，未运行 TypeScript typecheck 或 Electron 构建。

## 2026-05-25 Agent 模式 Codex Runtime 接入方案二次细化计划

- [x] 复习 `tasks/lessons.md` 中 Codex auth 隔离、Agent stop、runtime event 去重、新旧 session、Git 防护等相关教训。
- [x] 复查现有方案结构，找出仍偏抽象的章节和缺少落地路径的风险点。
- [x] 在既有方案文档内补充更细的接口、文件级改动、事件适配、auth/env、设置迁移、UI 历史回放、测试夹具、回滚和阶段 DoD。
- [x] 新增或完善 `docs/codex-support/` 目录入口，方便后续按主题继续追加调研文档。
- [x] 运行 Markdown 静态检查和 diff 空白检查，确认文档可维护。
- [x] 在本节追加 Review，记录补充内容、验证结果和仍需用户决策的问题。

## 2026-05-25 Agent 模式 Codex Runtime 接入方案二次细化 Review

- 已在 `docs/codex-support/2026-05-25-agent-codex-runtime-integration-plan.md` 追加二次细化章节，覆盖 runtime 边界落地、registry 选择规则、运行中状态机、Codex core 抽取、auth/env/command guard、event adapter、Codex runtime 执行流程、数据迁移、Renderer UX、权限 sandbox、测试矩阵、feature flag、回滚和各阶段 Definition of Done。
- 已新增 `docs/codex-support/README.md`，作为 Codex support 文档索引，明确当前主文档和后续建议拆分的调研主题。
- 本轮明确了实现拆分策略：先公共契约，再抽 Codex core，再做 event adapter，再接 mock runtime，最后接 UI 和真实 Codex；避免一次性混改抽象、SDK、UI 和打包。
- 已补充需要用户确认的产品决策：Codex 首版是否接受无逐工具权限 UI、是否隐藏 rewind/fork/soft interrupt/queue message、Agent Codex 是否默认 native auth、`danger-full-access` 是否单独开关、历史是否以 runtime events 为主数据。
- 验证通过：Markdown code fence 行级检查；标题层级检查；关键术语覆盖检查；`docs/codex-support/README.md` 相对链接检查；`git diff --check -- docs/codex-support tasks/todo.md`。
- 本轮仍是文档方案细化，未修改运行时代码，未运行 `bun run typecheck` 或 Electron 构建。

## 2026-05-25 Agent Codex Runtime 开发进度清单计划

- [x] 基于现有 Codex Runtime 接入方案提炼可执行的阶段任务、PR 拆分、验收门禁和验证命令。
- [x] 在 `docs/codex-support/` 下新增开发进度跟踪清单，使用可勾选条目支持后续迭代维护。
- [x] 更新 `docs/codex-support/README.md`，把开发进度清单加入索引。
- [x] 运行 Markdown 结构检查、相对链接检查和 diff 空白检查。
- [x] 在本节追加 Review，记录文档产物和验证结果。

## 2026-05-25 Agent Codex Runtime 开发进度清单 Review

- 已新增 `docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md`，作为后续 Agent Codex Runtime 迭代开发的主进度跟踪清单。
- 清单按 Phase 0-8 拆分：基线冻结、共享契约、Codex core 抽取、event adapter、Codex runtime mock、Orchestrator routing、Renderer 设置与历史、真实集成打包、文档发布维护。
- 每个阶段都包含目标、依赖、推荐 PR、涉及文件、任务 checkbox、测试、验证命令、退出标准和回滚点；同时补充产品决策门禁、横向质量门禁、阶段提交记录和当前未解决问题。
- 已更新 `docs/codex-support/README.md`，将开发进度清单加入 Codex support 文档索引。
- 验证通过：Markdown code fence 检查；标题层级检查；相对链接检查；清单必备章节检查；`git diff --check -- docs/codex-support tasks/todo.md`。
- 本轮仅新增/更新文档和任务记录，未修改运行时代码，未运行 `bun run typecheck` 或 Electron 构建。

## 2026-05-25 Agent Codex Runtime 最新状态同步计划

- [x] 更新 `docs/codex-support/` 中的最新开发状态，明确已完成文档准备、尚未开始代码阶段和下一步入口。
- [x] 新增下次启动提示词文档，方便重新启动 Codex 会话后直接继续 Phase 0。
- [x] 更新 Codex support 索引，加入最新状态和提示词入口。
- [x] 运行 Markdown 结构、相对链接和 diff 空白检查。
- [x] 提交本阶段文档状态同步改动，并在本节追加 Review。

## 2026-05-25 Agent Codex Runtime 最新状态同步 Review

- 已更新 `docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md`：状态改为“文档准备完成，代码开发待启动”，新增最新开发状态快照、当前完成/未完成总览和文档准备阶段提交记录。
- 已新增 `docs/codex-support/next-session-prompt.md`，包含下次启动可直接复制给 Codex 的提示词，明确从 Phase 0 基线冻结开始，不直接进入 Phase 1 代码实现。
- 已更新 `docs/codex-support/README.md`，加入最新状态、已提交 commit、未完成阶段和下次启动提示词入口。
- 当前明确状态：已完成需求调研、主方案、二次细化、开发进度清单、文档索引和下次启动提示词；产品决策门禁和 Phase 0-8 均未完成。
- 验证通过：Markdown code fence 检查；标题层级检查；相对链接检查；`git diff --check -- docs/codex-support tasks/todo.md`。
- 本轮仍为文档状态同步，未修改运行时代码，未运行 `bun run typecheck`、`bun test --isolate` 或 Electron 构建。

## 2026-05-25 Agent Codex Runtime Phase 0 基线冻结计划

- [x] 复习 `AGENTS.md`、`tasks/lessons.md` 和 Codex support 清单，确认阶段完成即提交、Codex auth 隔离、Agent stop、runtime events、Git guard 等约束。
- [x] 运行 `git status --short` 和 `git log -1 --oneline`，记录当前工作树与最新提交；不回滚用户改动。
- [x] 复查产品决策门禁：未收到明确确认时，只按清单推荐值作为 Phase 0 验证假设，不标记为已确认，也不进入 Phase 1。
- [x] 建立 Phase 0 阶段分支，使用 `codex/agent-codex-runtime-phase-0`。
- [x] 确认当前 Claude Agent、Pipeline Codex、runtime events 相关基线文件和打包配置，不做功能代码改动。
- [x] 记录当前 `@openai/codex-sdk`、`@openai/codex`、`@anthropic-ai/claude-agent-sdk` 版本。
- [x] 记录 `apps/electron/electron-builder.yml` 中 Codex / Claude binary 打包规则。
- [x] 运行并记录 `bun run typecheck`、`bun test --isolate`、`bun run electron:build`、`git diff --check`。
- [x] 更新 `docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md` 与本节 Review，记录 Phase 0 验证结果、残余风险和后续阶段提交边界。
- [x] 提交 Phase 0 相关文件，提交信息使用详细中文，且只 stage 本阶段相关文件。

## 2026-05-25 Agent Codex Runtime Phase 0 基线冻结 Review

- 已建立阶段分支：`codex/agent-codex-runtime-phase-0`；启动时 `git status --short` 为空，最新提交为 `c546bc4e docs: 同步 Agent Codex Runtime 开发状态`。
- 产品决策门禁仍未由用户明确确认；本轮仅按清单推荐值作为 Phase 0 验证假设，未标记门禁为已确认，也未开始 Phase 1 代码改动。
- 已记录依赖版本：`@openai/codex-sdk@0.130.0`、`@openai/codex@0.130.0`、`@anthropic-ai/claude-agent-sdk@0.2.123`。
- 已记录打包规则：main build external 化 Claude / Codex SDK 与 CLI 包；`electron-builder.yml` 使用 `asar: false`，files 包含 Claude SDK 主包及 darwin-arm64 / darwin-x64 / win32-x64 子包，包含 Codex SDK/CLI 主包及 darwin / linux / win32 的 arm64 与 x64 子包。
- 已确认基线：Agent 模式仍走 `ClaudeAgentAdapter` + Claude SDK `query()`；Pipeline Codex 仍走 `CodexSdkPipelineNodeRunner` 的 `startThread()` + `thread.run()`；runtime events 已有 JSONL writer、validator、SDKMessage adapter、`sdk_session` 去重和终态去重。
- 已复习相关 lessons：Codex auth 要隔离宿主 `HOME` / `CODEX_HOME`，Agent stop 要覆盖 iterator 正常结束路径，runtime events 的 `sdk_session` 去重应在 writer 层，Git guard 不能只靠 PATH，阶段完成后要单独提交。
- 验证通过：`bun run typecheck`；`bun test --isolate`（508 pass / 0 fail）；`bun run electron:build`（通过，保留 Vite 大 chunk 警告）；`git diff --check`。
- 本轮只修改 `docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md` 与 `tasks/todo.md`，未修改 README.md / AGENTS.md，未修改运行时代码。

## 2026-05-25 Agent Codex Runtime 最新状态二次同步计划

- [x] 复查当前分支、最新提交和工作树状态，确认 Phase 0 已提交且当前无未提交改动。
- [x] 更新开发进度清单的最新状态快照，明确 Phase 0 已完成、产品门禁未确认、Phase 1-8 未开始。
- [x] 更新 `docs/codex-support/README.md` 的最新状态，避免仍显示 Phase 0-8 全部未完成。
- [x] 更新 `docs/codex-support/next-session-prompt.md`，让下次启动直接从产品门禁和 Phase 1 入口继续。
- [x] 运行 Markdown / diff 检查，提交本轮状态同步文档。

## 2026-05-25 Agent Codex Runtime 最新状态二次同步 Review

- 已更新 `docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md`：最新状态明确为 Phase 0 已完成并提交 `29e48a93`，产品决策门禁未确认，Phase 1-8 未开始。
- 已更新 `docs/codex-support/README.md`：最新状态不再显示 Phase 0-8 全部未完成，下一步改为先确认产品门禁，再从 Phase 1 共享类型与设置契约开始。
- 已更新 `docs/codex-support/next-session-prompt.md`：下次启动提示词改为 Phase 0 后续开发入口，要求先读清单第 1 节和 Phase 1，用户确认产品门禁前不开始代码改动。
- 验证通过：Codex support Markdown code fence 平衡检查；Codex support Markdown 相对链接检查；`git diff --check`。
- 本轮仍未修改运行时代码，未修改根 `README.md` 或 `AGENTS.md`。

## 2026-05-25 Agent Codex Runtime Phase 1 启动前门禁计划

- [x] 复习 `AGENTS.md` 和 `tasks/lessons.md`，重点确认阶段完成即提交、Codex auth 隔离、Agent stop、runtime events、Git guard 相关纪律。
- [x] 运行 `git status --short` 和 `git log -1 --oneline`，确认当前工作树干净且最新提交为 `ecb84a81 docs: 同步 Agent Codex Runtime Phase 0 后续状态`。
- [x] 读取开发清单的最新开发状态快照、第 1 节产品决策门禁和第 3 节 Phase 1 范围。
- [x] 确认当前分支为 `codex/agent-codex-runtime-phase-0`，本轮不回滚任何用户改动。
- [x] 向用户确认是否采用产品决策推荐值；确认前不开始 Phase 1 代码改动。
- [x] 用户已确认采用推荐值，并说明后续无需再就同一组推荐值询问。
- [x] 将产品决策结果写回开发清单，并在本节记录。
- [x] 启动并完成 Phase 1：仅实现 shared/settings/session 契约，不混入 Codex runtime core、event adapter、UI 或真实 Codex 集成。
- [x] 运行 Phase 1 验证：`bun test packages/shared`、`bun test apps/electron/src/main/lib/settings-service.test.ts`、`bun test apps/electron/src/main/lib/agent-session-manager.test.ts`、`bun test --isolate`、`bun run typecheck`、`git diff --check`。
- [x] Phase 1 验证通过后，按阶段提交纪律只 stage 本阶段相关文件并提交详细中文提交信息。

## 2026-05-25 Agent Codex Runtime Phase 1 共享契约 Review

- 已确认产品决策门禁：采用推荐值，后续无需再就同一组推荐值询问；结果已写回 `docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md`。
- 已在 `@codeinsights/shared` 新增 runtime-neutral 契约：`CodingAgentRuntimeKind`、`AgentRuntimeSessionRef`、`AgentSessionMeta.runtimeKind` / `runtimeSession`，并保留 `sdkSessionId` 作为 Claude legacy 字段。
- 已扩展 runtime events：支持 `codex_sdk` / `codex_cli` source、`run_started.runtimeKind`，并为 usage 预留 `reasoningOutputTokens`；Codex SDK 具体 usage 映射留到 Phase 3 event adapter。
- 已扩展 Electron settings 契约：`agentRuntimeKind`、`agentCodexChannelId`、`agentCodexModelId`、`agentCodexReasoningEffort`、`agentCodexNetworkAccessEnabled`、`agentCodexWebSearchMode`；默认 runtime 仍为 `claude-code`，不复用或迁移 `pipelineCodexChannelId`，损坏枚举读取时回落到安全默认值。
- 已实现 Agent session meta lazy normalization：旧 Claude session 读取期视为 `claude-code`，写回时补 `runtimeSession`；清理 Claude `sdkSessionId` 会同步清理 `runtimeSession`；Codex session 仅写 `runtimeSession`，不写 `sdkSessionId`，并清理 Claude legacy 字段。
- 已新增/更新测试：`runtime-events.test.ts`、`settings-service.test.ts`、`agent-session-manager.test.ts`。
- 已按版本纪律递增 `@codeinsights/shared` 到 `0.1.43`，递增 `@codeinsights/electron` 到 `0.0.104`。
- 验证通过：`bun test packages/shared`；`bun test apps/electron/src/main/lib/settings-service.test.ts`；`bun test apps/electron/src/main/lib/agent-session-manager.test.ts`；`bun test --isolate`（522 pass / 0 fail）；`bun run typecheck`；`git diff --check`。
- 阶段边界保持：未修改 README.md / AGENTS.md，未进入 Codex runtime core、event adapter、Renderer UI 或真实 Codex 集成。

## 2026-05-25 Agent Codex Runtime Phase 1 后状态同步计划

- [x] 复查当前工作树和最新提交，确认 Phase 1 已提交为 `6127b46c feat(agent): 完成 Codex Runtime Phase 1 共享契约`，且启动时工作树干净。
- [x] 更新 `docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md` 的最新开发状态、完成/未完成总览、Phase 1 执行记录和阶段提交记录。
- [x] 更新 `docs/codex-support/README.md`，明确产品决策与 Phase 1 已完成，Phase 2-8 尚未开始。
- [x] 更新 `docs/codex-support/next-session-prompt.md`，让下次启动直接从 Phase 2 Codex Runtime Core 抽取继续。
- [x] 运行文档结构、相对链接和 diff 空白检查。
- [x] 提交本轮文档状态同步，并在本节追加 Review。

## 2026-05-25 Agent Codex Runtime Phase 1 后状态同步 Review

- 已确认启动时工作树干净，最新实现提交为 `6127b46c feat(agent): 完成 Codex Runtime Phase 1 共享契约`。
- 已更新 `docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md`：最新快照、完成/未完成总览、Phase 1 执行记录和阶段提交表均明确 Phase 1 已完成并提交，Phase 2-8 尚未开始，下一步为 Phase 2 Codex Runtime Core 抽取。
- 已更新 `docs/codex-support/README.md`：索引页最新状态现在列明产品决策门禁与 Phase 1 已完成，未完成项从 Phase 2 到 Phase 8 逐项列出。
- 已更新 `docs/codex-support/next-session-prompt.md`：下次启动提示词改为 Phase 1 后继续开发入口，要求先读清单第 4 节 Phase 2，并明确不要混入 event adapter、routing、UI 或真实 Codex 集成。
- 验证通过：Codex support Markdown code fence 检查；Codex support Markdown 相对链接检查；旧状态短语扫描无命中；`git diff --check -- docs/codex-support tasks/todo.md`。
- 本轮只修改文档和任务记录，未修改 README.md / AGENTS.md，未进入 Phase 2 代码实现。

## 2026-05-25 Agent Codex Runtime Phase 6 Renderer 设置、历史与 UX 计划

- [x] 复习 `AGENTS.md`、`tasks/lessons.md`、当前 Git 状态和开发清单 Phase 5/Phase 6，确认本轮边界。
- [x] 新增 `getAgentSessionRuntimeEvents` IPC / preload API，复用主进程已有 runtime events 读取能力。
- [x] Renderer 加载 Codex session 时读取 runtime events，并实现 runtime transcript selector。
- [x] 新增 `RuntimeTranscript` 组件，让 Codex 会话历史基于 runtime events 回放，缺失/损坏时给出降级提示。
- [x] Agent settings 增加 Runtime 选择、Codex auth 来源、enabled openai/custom channel 下拉、独立模型、reasoning effort、network 和 web search 设置。
- [x] settings initializer 自动清理 deleted/disabled/unsupported 的 `agentCodexChannelId`。
- [x] Agent header 显示当前 session runtime，Codex session 下禁用或隐藏 rewind/fork/soft interrupt/queue message，并不展示 Claude per-tool `PermissionBanner`。
- [x] Feature flag 关闭时隐藏 Codex runtime 入口，保留已写 runtime events。
- [x] 补充 renderer 相关测试，覆盖 transcript selector、settings 清理、header badge/禁用态和 feature flag 行为。
- [x] 运行验证：`bun test apps/electron/src/renderer`、`bun run --filter='@codeinsights/electron' typecheck`、feature flag 开关 UI smoke、`git diff --check -- apps/electron/src/preload apps/electron/src/main/ipc apps/electron/src/renderer tasks/todo.md`。
- [x] 更新本节 Review，阶段验证通过后只 stage Phase 6 相关文件并提交详细中文提交信息。

范围边界：

- 本轮只做 Renderer 设置、history replay 与 UX 禁用态。
- 不接入真实 Codex SDK / CLI，不做打包发布验证。
- 不修改根 `README.md` 或 `AGENTS.md`。
- Codex 继续使用 Phase 4 mock runtime 路径，不依赖本机登录或真实 API key。

## 2026-05-25 Agent Codex Runtime Phase 6 Renderer 设置、历史与 UX Review

- 已新增 `getAgentSessionRuntimeEvents` IPC / preload API，Renderer 加载 Agent session 时会同步读取 runtime events 并写入 per-session atom。
- 已新增 `runtime-transcript-model.ts` 与 `RuntimeTranscript.tsx`：Codex 会话使用 runtime events 回放用户消息、assistant 文本、工具调用和终态，缺失 runtime events 时给出明确降级提示。
- 已在 Agent 设置中加入 feature-flag 保护的 Runtime 设置：Claude Code / Codex、Codex native auth / enabled OpenAI 或 Custom channel、独立 Codex 模型、reasoning effort、network 和 web search。
- 已在 settings initializer 中清理 deleted / disabled / unsupported 的 `agentCodexChannelId`；feature flag 关闭时设置入口隐藏并把默认 runtime 恢复为 Claude Code。
- 已在 Agent Header 显示 session runtime；Codex session 使用 RuntimeTranscript，不展示 Claude per-tool PermissionBanner，并隐藏 Claude 模型选择、权限模式、runner 切换、thinking 与 AgentMessages 的 fork / rewind 控制。
- 已禁用 Codex 运行中追加消息和 CodeInsights 触发 `/compact`；feature flag 关闭时既有 Codex session 仅可查看历史，Renderer 与主进程都会阻止继续发送。
- 代码审查指出新建未运行 session 会因默认 `runtimeKind: 'claude-code'` 被 Renderer 误判为 Claude；已改为仅 `runtimeSession`、明确 `runtimeKind: 'codex'` 或 legacy `sdkSessionId` 绑定 session，未运行会话跟随当前默认 runtime。
- 复审指出主进程仍可绕过 Renderer 继续执行既有 Codex session；已在 Orchestrator 选择 runtime 后、持久化用户消息和 active session 抢占前增加 `CODEINSIGHTS_AGENT_CODEX_RUNTIME` gate，并补充 `codex_runtime_disabled` typed error。
- 已将 runtime transcript selector 改为保留持久化顺序，并补充多轮同时间戳回放测试，避免按 runId / createdAt 重排导致用户消息错配。
- 验证通过：`bun test apps/electron/src/renderer`，127 pass / 0 fail；`bun test apps/electron/src/main/lib/agent-orchestrator.test.ts`，7 pass / 0 fail；`bun test packages/shared`，36 pass / 0 fail；`bun run --filter='@codeinsights/electron' typecheck`；`git diff --check -- apps/electron/src/preload apps/electron/src/main/ipc apps/electron/src/main/lib apps/electron/src/renderer packages/shared tasks/todo.md docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md`。
- 补充验证：`CODEINSIGHTS_AGENT_CODEX_RUNTIME=1 bun run --filter='@codeinsights/electron' build:renderer` 通过；`CODEINSIGHTS_AGENT_CODEX_RUNTIME=0 bun run --filter='@codeinsights/electron' build:renderer` 通过；现有 5173 dev server 未携带 feature flag 时，Agent 配置页未出现 `Agent Runtime`。
- 阶段边界：未接入真实 Codex SDK / CLI，未做打包发布验证，未修改根 `README.md` 或 `AGENTS.md`；Codex 仍走 Phase 4 mock runtime。

## 2026-05-26 Agent Codex Runtime Phase 6 后状态文档同步计划

- [x] 复查当前工作树和最新提交，确认 Phase 6 已提交为 `58164e35 feat(agent): 完成 Codex Runtime Phase 6 渲染端接入`，且不回滚任何用户改动。
- [x] 更新 `docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md`，明确 Phase 0-6 已完成、Phase 7-8 未完成，下一步从 Phase 7 真实 Codex 集成与打包验证开始。
- [x] 更新 `docs/codex-support/README.md`，同步最新提交列表、未完成项和下一步入口。
- [x] 更新 `docs/codex-support/next-session-prompt.md`，让下次启动提示词直接从 Phase 7 继续。
- [x] 运行文档状态扫描和 `git diff --check -- docs/codex-support tasks/todo.md`。
- [x] 提交本轮文档状态同步改动，并在本节追加 Review。

## 2026-05-26 Agent Codex Runtime Phase 6 后状态文档同步 Review

- 已确认启动时工作树干净，最新实现提交为 `58164e35 feat(agent): 完成 Codex Runtime Phase 6 渲染端接入`。
- 已更新 `docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md`：最新快照、完成/未完成总览、Phase 6 执行记录和阶段提交表均明确 Phase 0-6 已完成，Phase 7-8 尚未完成，下一步为 Phase 7 真实 Codex 集成与打包验证。
- 已更新 `docs/codex-support/README.md`：最新状态加入 Phase 6 提交，未完成项改为 Phase 7-8。
- 已更新 `docs/codex-support/next-session-prompt.md`：下次启动提示词改为 Phase 7 入口，要求先读清单第 8 节 Phase 6 和第 9 节 Phase 7，并明确不混入 Phase 8。
- 验证通过：Codex support Markdown code fence 检查；旧 Phase 6 待启动状态短语扫描；`git diff --check -- docs/codex-support tasks/todo.md`。
- 本轮只修改文档和任务记录，未修改根 `README.md` 或 `AGENTS.md`，未进入 Phase 7 真实 Codex SDK / CLI 集成。

## 2026-05-26 Agent Codex Runtime Phase 7 MCP 注入收尾计划

- [x] 复习 `AGENTS.md`、`tasks/lessons.md` 和 Codex Runtime 开发清单，重点确认阶段完成即提交、Codex auth 隔离、native `config.toml` 中转配置、Agent stop、runtime events、Git guard、runtime binding 和“不再等待确认”相关教训。
- [x] 运行 `git status --short` 与 `git log -3 --oneline`，确认当前仅有 `apps/electron/out/` 未跟踪，不默认 stage / commit。
- [x] 读取开发清单最新状态快照、第 9 节 Phase 7、第 10 节 Phase 8 和第 13 节当前未解决问题，确认本轮优先级。
- [x] 检查 `CODEX_SMOKE_API_KEY` 是否显式提供；当前环境缺失，因此不补跑 channel API key smoke，也不默认读取 ambient `OPENAI_API_KEY`。
- [x] 梳理现有 Agent workspace MCP 配置、Codex runtime native config 生成和 smoke 脚本结构，选择最小改动路径。
- [x] 实现 CodeInsights workspace MCP 配置到 Codex 原生 `mcp_servers` config 的注入能力，保留 native auth 同源 `config.toml` 的 model/provider/base_url 语义，不写用户真实 `~/.codex/config.toml`。
- [x] 补充单测 / fixture，覆盖 MCP server 注入、Codex SDK config 传递、Orchestrator workspace MCP 接线和 native config 复制。
- [x] 运行针对性测试、typecheck / diff 检查，并补跑 `--only mcp` smoke。
- [x] 更新开发清单 Phase 7 / 当前未解决问题和本节 Review；阶段完成后只提交本阶段相关文件。

## 2026-05-26 Agent Codex Runtime Phase 7 MCP 注入收尾 Review

- 已新增 `apps/electron/src/main/lib/codex-runtime/codex-mcp-config.ts`，将 CodeInsights workspace `mcp.json` 中 enabled stdio/http MCP 映射到 Codex SDK `config.mcp_servers`；stdio 支持 `command`、`args`、`env_vars`、`startup_timeout_sec`，http 支持 `url` 和 `env_http_headers`。
- 安全复审后已修正：MCP env/header 的真实 secret 不再进入 `CodexOptions.config`，避免被 `@openai/codex-sdk` 展平成 CLI `--config key=value` argv；真实值通过 `codexConfigEnv` 合并进 Codex 子进程环境，config 只保留 env/header 名称引用。
- 复审 Block 后继续加固：workspace MCP env 现在拒绝 `GIT_*`、Git config、proxy、Codex auth/home、基础 shell env 等保留名称；runtime 合并 `codexConfigEnv` 时禁止覆盖任何 Git guard/base env；HTTP header name 暂限制为 Codex SDK dotted config 可安全表达的 bare key，无法安全表达时跳过该 server。
- Agent Codex runtime 现在会通过 `CodexOptions.config` 传入工作区 MCP 原生配置，并通过 `codexConfigEnv` 传入 MCP secret；不修改用户真实 `~/.codex/config.toml`，因此 native auth 中的 `model_provider` / `model_providers.*.base_url` 中转配置仍由原 Codex config 负责。
- Orchestrator Codex 分支会读取当前 workspace MCP，注入到 Codex runtime；无效 server name、缺少 command/url、legacy `sse`、保留 env 名称、无效 header 名称和 env 名称冲突会跳过，只记录服务器名和原因，不输出 env/header secret。
- `apps/electron/scripts/agent-codex-smoke.ts` 的 `--only mcp` 不再 skipped，会生成本地 stdio/http MCP 形态并从 helper 输出派生 CLI override，用真实 Codex CLI `mcp list --json` 验证原生配置可识别。
- `CODEX_SMOKE_API_KEY` 当前仍未提供，channel API key smoke 未补跑，也未默认读取 ambient `OPENAI_API_KEY`。
- 已递增 `@codeinsights/electron` 版本到 `0.0.113`，同步更新 `bun.lock` workspace 版本。
- 验证通过：`bun test apps/electron/src/main/lib/codex-runtime apps/electron/src/main/lib/agent-runtimes/codex-runtime.test.ts apps/electron/src/main/lib/agent-orchestrator.test.ts apps/electron/scripts/agent-codex-smoke.test.ts`，54 pass / 0 fail。
- 验证通过：`bun run --filter='@codeinsights/electron' typecheck`。
- 验证通过：`bun run --filter='@codeinsights/electron' smoke:agent-codex -- --only mcp`，`mcp.config-injection` passed，Codex CLI 可识别 helper 生成的 stdio/http 配置。
- 验证通过：`git diff --check -- apps/electron/package.json apps/electron/scripts/agent-codex-smoke.ts apps/electron/src/main/lib/agent-orchestrator.ts apps/electron/src/main/lib/agent-orchestrator.test.ts apps/electron/src/main/lib/agent-runtimes apps/electron/src/main/lib/codex-runtime bun.lock tasks/todo.md`。
- 代码复审通过：`code-reviewer` 确认上一轮 `codexConfigEnv` 覆盖 Git guard / 运行环境的 Block 已关闭，本轮无 Critical / High / Medium findings。
- 阶段边界：未修改根 `README.md` / `AGENTS.md`，未默认 stage `apps/electron/out/`，未进入 Phase 8 文档发布维护。

## 2026-05-26 Agent Codex Runtime 最新开发状态文档同步计划

范围确认：本轮只把最新提交 `dae13cd7 feat(agent): 完成 Codex workspace MCP 注入`、Phase 7 已完成/未完成项和下次启动提示词同步到 Codex support 文档；不修改根 `README.md` / `AGENTS.md`，不处理未跟踪 `apps/electron/out/` 打包产物。

- [x] 运行 `git status --short` 和 `git log -5 --oneline`，确认当前仅 `apps/electron/out/` 未跟踪，最新提交为 `dae13cd7 feat(agent): 完成 Codex workspace MCP 注入`。
- [x] 更新 `docs/codex-support/README.md`：最新提交列表加入 `dae13cd7`，下次启动检查改为确认该提交或其后的状态同步提交。
- [x] 更新 `docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md`：状态栏、最新快照、仓库状态要求、完成/未完成总览和阶段提交表均落到 `dae13cd7`。
- [x] 更新 `docs/codex-support/next-session-prompt.md`：提示词明确 Phase 7 workspace MCP 注入已提交 `dae13cd7`，下一步先处理 `CODEX_SMOKE_API_KEY` channel smoke，之后进入 Phase 8。
- [x] 运行 Markdown fence/link 检查和 `git diff --check`。
- [x] 提交本轮文档状态同步改动，并在本节追加 Review。

## 2026-05-26 Agent Codex Runtime 最新开发状态文档同步 Review

- 已同步最新实现提交：`dae13cd7 feat(agent): 完成 Codex workspace MCP 注入`。
- 已明确当前完成状态：Phase 0-6 完成；Phase 7 真实 Codex runtime、打包验证、native/read-only/workspace-write/resume/web-search/stop、history reload UI smoke 和 workspace MCP 注入均完成；channel API key smoke 仍因缺少 `CODEX_SMOKE_API_KEY` 阻塞；Phase 8 未开始。
- 已更新下次启动提示词：新会话应先检查 `git status --short` / `git log -3 --oneline`，确认 `apps/electron/out/` 不纳入提交；若提供 `CODEX_SMOKE_API_KEY` 才补跑 channel API key smoke，否则保持阻塞并进入 Phase 8 前不要伪造通过。
- 验证通过：Codex support Markdown code fence / relative link check；`git diff --check -- docs/codex-support tasks/todo.md`。

## 2026-05-27 GitHub Feature Issues 创建计划

范围确认：本轮目标是在当前项目远程 GitHub 仓库为 5 个后续功能创建 issue；不修改产品代码，不修改根 `README.md` / `AGENTS.md`，不提交本地任务记录。当前 remote 为 `git@github.com:zcxGGmu/RV-Insights.git`，GitHub API 解析到实际仓库 `zcxGGmu/CodeInsights`，issues 已启用。

- [x] 复习 `tasks/lessons.md`，确认本轮不涉及代码阶段提交和 Codex runtime 残余 smoke。
- [x] 确认当前仓库 remote 与工作树状态。
- [x] 检查本机 GitHub issue 创建能力：`gh` / `hub` 不存在，环境变量中无 `GITHUB_*` / `GH_*` token，macOS git credential 中无 github.com HTTPS token。
- [x] 通过 GitHub API 匿名读取仓库元数据，确认 `zcxGGmu/RV-Insights` 已重命名/重定向到 `zcxGGmu/CodeInsights`，且 `has_issues: true`。
- [x] 获取可用于 GitHub Issues API 的认证方式后创建 5 个 issue。
- [x] 创建完成后记录 issue URL 并追加 Review。

### Issue 草案 1：集成 Codex App 文件预览（右侧面板打开）

```markdown
## 背景

当前 CodeInsights 已有右侧面板与文件浏览能力，但缺少类似 Codex App 的快速文件预览体验。用户在 Agent / Pipeline 输出、工具调用、文件浏览器或附件引用中看到文件路径时，应能在右侧面板直接打开预览，减少上下文切换。

## 目标

- 在右侧面板集成文件预览入口，支持从 Agent/Pipeline 记录、工具调用结果、文件浏览器和可点击路径打开。
- 支持常见文本源码、Markdown、图片、PDF 以及已解析文档的只读预览。
- 预览状态跟随当前工作区/会话隔离，不污染全局 Chat 回退路径。
- 对大文件、二进制文件、缺失文件和权限不足场景提供清晰降级提示。

## 验收标准

- 点击文件路径后右侧面板打开预览，并高亮当前文件名、路径和所属工作区。
- 文本文件支持语法高亮、行号和基础搜索；Markdown 可切换源码/渲染视图。
- 图片/PDF 能在面板内预览，无法预览的文件提供“在系统中打开/复制路径”等安全操作。
- Agent/Pipeline 切换会话后预览不会串会话；刷新历史后仍能恢复最近一次预览状态。
- 补充 BDD 测试覆盖：路径点击、预览成功、不可预览降级、会话隔离。

## 技术备注

- 状态管理继续使用 Jotai。
- 优先复用现有 `file-browser`、`ai-elements`、附件解析和右侧面板结构。
- 新增 IPC 时同步 shared 契约、main handler、preload bridge 和 renderer 调用。
```

### Issue 草案 2：集成 Codex App Skill 工坊

```markdown
## 背景

CodeInsights 已有 Agent workspace skills 目录能力，但缺少面向用户的 Skill 工坊。需要提供类似 Codex App 的技能浏览、安装、启用、编辑和验证体验，让用户能以工作区为边界管理 Agent 能力。

## 目标

- 新增 Skill 工坊入口，用于浏览本地 skills、项目内 skills 和可安装的推荐/远程 skills。
- 支持安装、启用/禁用、更新、复制、删除、查看 README/SKILL.md 和基础校验。
- Skill 配置按 Agent workspace 隔离，遵循本地文件优先和可移植配置原则。
- 提供冲突检测：同名 skill、无效 `SKILL.md`、缺失引用文件、危险脚本提示。

## 验收标准

- 用户可以在设置或 Agent 工作区界面打开 Skill 工坊。
- 能列出当前工作区已启用 skills，并能查看每个 skill 的说明、来源、路径和状态。
- 能从本地目录或远程 GitHub repo/path 安装 skill，并写入工作区对应 skills 目录/配置。
- 启用/禁用后，Agent 新会话能读取最新 workspace capabilities。
- 补充 BDD 测试覆盖：列表加载、安装成功、校验失败、启用禁用、工作区隔离。

## 技术备注

- 安装远程依赖前需要先搜索/确认版本与来源，不默认引入新依赖。
- UI 采用现代设置页风格，优先复用 Radix/Shadcn 风格组件。
- 所有错误日志和用户提示优先中文，保留必要英文术语。
```

### Issue 草案 3：集成 Codex App 自动化任务

```markdown
## 背景

CodeInsights 已具备 Agent / Pipeline 执行能力，但缺少类似 Codex App 的自动化任务系统。用户需要定时运行、监控、提醒、继续线程或在指定工作区执行重复任务。

## 目标

- 新增自动化任务模块，支持创建、查看、暂停、恢复、删除和运行历史。
- 支持两类任务：定时工作区任务和当前线程 follow-up/heartbeat。
- 每个任务绑定工作区、运行模型/渠道、提示词、计划规则、状态和最近执行结果。
- 自动化执行必须有并发守卫、日志追踪、失败重试/退避和用户可见的错误状态。

## 验收标准

- 用户可创建每日/每周/间隔运行的自动化任务，并能看到下一次运行时间。
- 任务运行时复用现有 Agent/Pipeline 运行能力，并按工作区隔离产物与日志。
- 支持暂停/恢复/立即运行；删除任务不会删除历史会话，除非用户明确选择。
- 应用重启后任务配置和运行状态可恢复。
- 补充 BDD 测试覆盖：创建任务、调度触发、暂停恢复、失败记录、重启恢复。

## 技术备注

- 本地存储优先，使用 `~/.codeinsights/` 下 JSON 配置 + JSONL 运行日志，不引入本地数据库。
- 计划表达不要直接暴露复杂底层规则给普通用户，UI 使用自然语言和明确时间展示。
- 注意远程执行权限、API Key、工作区文件写入权限与现有 permission mode 的关系。
```

### Issue 草案 4：接入 Discord/Telegram 远程机器人

```markdown
## 背景

用户希望通过 Discord / Telegram 远程触发 CodeInsights 的 Agent 或 Pipeline，并接收进度、权限请求、完成结果和失败通知。该能力可用于移动端远程协作和长任务通知。

## 目标

- 新增远程机器人集成，首期支持 Discord Bot 与 Telegram Bot。
- 支持绑定本地 CodeInsights 实例、授权用户/群组白名单、工作区选择和命令路由。
- 支持远程提交任务、查看运行状态、审批权限请求/人工 gate、停止任务和获取结果摘要。
- 所有敏感配置本地加密存储，默认关闭，必须显式启用。

## 验收标准

- 用户可在设置页配置 Discord/Telegram token、允许的 user/chat/channel、默认工作区和通知策略。
- 远程发送命令后，本地应用能创建对应 Agent/Pipeline 会话并返回会话状态。
- 权限请求和 Pipeline gate 可通过机器人消息进行批准/拒绝，并写入审计记录。
- 未授权用户、未知命令、应用离线、会话不存在等场景有明确反馈。
- 补充 BDD 测试覆盖：授权校验、命令解析、任务创建、审批回传、错误路径。

## 技术备注

- 优先设计 provider 抽象，Discord/Telegram 作为不同 adapter，避免业务逻辑分叉。
- 不在日志中输出 bot token、API key、用户敏感消息全文。
- 需要评估长轮询、Webhook、本地桌面网络限制和代理设置复用方案。
```

### Issue 草案 5：支持全局流式语音输入（参考豆包）

```markdown
## 背景

当前输入主要依赖键盘。需要支持类似豆包的全局流式语音输入：用户在任意输入场景按快捷键即可开始说话，语音实时转文本并插入当前 Composer，提高长提示词和移动办公效率。

## 目标

- 新增全局语音输入能力，支持快捷键唤起、悬浮状态提示、实时转写和一键提交/取消。
- 支持 Agent、Pipeline、旧 Chat 回退输入框等主要输入场景。
- 支持用户选择语音识别 Provider、语言、自动标点、热词/术语和是否保留音频。
- 语音流式转写过程要低延迟、可中断，并在失败时保留已识别文本。

## 验收标准

- 全局快捷键可在应用前台任意页面唤起语音输入，并将转写文本写入当前可用 Composer。
- 录音时有清晰状态：正在听、识别中、网络异常、已暂停、已取消。
- 支持实时增量转写，用户可继续编辑最终文本后再提交。
- 无麦克风权限、Provider 未配置、网络失败、无焦点输入目标等场景有明确降级。
- 补充 BDD/E2E 测试覆盖：快捷键唤起、权限失败、流式增量、取消、跨页面输入目标。

## 技术备注

- 需要评估 Electron 麦克风权限、系统快捷键、音频流采集和可选本地/云端 ASR Provider。
- 状态管理继续使用 Jotai；语音输入状态应全局唯一，避免多个会话并发录音。
- 默认不持久化原始音频；如需保存必须有明确用户开关和隐私说明。
```

## 2026-05-27 GitHub Feature Issues 创建 Review

- 初始环境无法直接创建远程 issue：本机缺少 `gh` / `hub`，环境变量无 GitHub token，macOS git credential 中也没有 github.com HTTPS token。
- 已确认远程仓库实际 GitHub full name 为 `zcxGGmu/CodeInsights`，旧 `zcxGGmu/RV-Insights` remote 可被 GitHub API 重定向，issues 已启用。
- 用户提供 GitHub token 后，已通过 GitHub Issues API 创建 5 个远程 issue：
  - `#5`：`feat: 集成 Codex App 文件预览（右侧面板打开）` - https://github.com/zcxGGmu/CodeInsights/issues/5
  - `#6`：`feat: 集成 Codex App Skill 工坊` - https://github.com/zcxGGmu/CodeInsights/issues/6
  - `#7`：`feat: 集成 Codex App 自动化任务` - https://github.com/zcxGGmu/CodeInsights/issues/7
  - `#8`：`feat: 接入 Discord/Telegram 远程机器人` - https://github.com/zcxGGmu/CodeInsights/issues/8
  - `#9`：`feat: 支持全局流式语音输入（参考豆包）` - https://github.com/zcxGGmu/CodeInsights/issues/9
- 已通过 GitHub Issues API 只读查询确认 `#5` 到 `#9` 均存在且为 open issue。
- 本轮未修改产品代码，未修改根 `README.md` / `AGENTS.md`，未将 token 写入仓库文件。

## 2026-05-27 Agent opencode Runtime Phase 0 计划

范围确认：本轮只执行 Phase 0 依赖 spike 与基线冻结，用真实命令确认 opencode npm 包、CLI、server、SDK、config、permission、MCP placeholder、provider config 与 binary 路径；不进入 shared/settings/IPC 或业务实现，不修改根 `README.md` / `AGENTS.md`。

- [x] 读取项目指令、`tasks/lessons.md`、opencode support README、开发清单和主方案，确认阶段完成即提交、状态同步、secretless config、Git guard、runtime binding 与下次启动提示词纪律。
- [x] 运行 `git status --short` 和 `git log -3 --oneline`，确认当前工作树干净，最新提交为 `bbe8a80c docs(agent): 同步 opencode Runtime 最新状态`。
- [x] 查询 npm 元数据：`@opencode-ai/sdk`、`opencode-ai`、`opencode`、`@opencode-ai/cli`。
- [x] 在临时目录安装 `@opencode-ai/sdk` 与 `opencode-ai`，不污染仓库依赖和业务实现提交。
- [x] 实测 CLI：binary 路径、可执行权限、`opencode --version`、`opencode serve --hostname 127.0.0.1 --port <free-port>`。
- [x] 实测 server/API：Basic Auth、`/global/health`、`/event` 首包、`/session`、`/prompt_async`、permission response body。
- [x] 实测 SDK：`createOpencodeClient()` 返回结构、`.data` / `.stream` 访问方式、`event.subscribe()` async iterator / stream 形态。
- [x] 实测配置优先级和安全边界：`OPENCODE_CONFIG`、`OPENCODE_CONFIG_DIR`、`OPENCODE_CONFIG_CONTENT`、provider `{env:VAR}`、OpenAI-compatible provider、MCP local environment / remote headers placeholder、`enabled_providers`、resolved config 冲突检测。
- [x] 根据真实结果更新 opencode 主方案、开发清单、support README 和 next-session prompt；如 SDK / Server API 与方案差异明显，停止进入 Phase 1。
- [x] 运行 Phase 0 验证：`bun run typecheck`、`bun test --isolate`、`git diff --check`。
- [x] 在本节追加 Phase 0 Review，确认只提交 Phase 0 文档 / 任务记录，并单独提交。

## 2026-05-27 Agent opencode Runtime Phase 0 Review

- 已完成 npm 元数据验证：`@opencode-ai/sdk@1.15.11` 依赖 `cross-spawn@7.0.6`；`opencode-ai@1.15.11` 暴露 `opencode -> ./bin/opencode.exe`，并声明无 scope 的多平台 optional packages；`opencode` 与 `@opencode-ai/cli` 仍为 npm `E404`。
- 已在 `/tmp/codeinsights-opencode-phase0-main` 临时目录安装 `@opencode-ai/sdk` 与 `opencode-ai`，未修改仓库依赖文件。
- 已确认 darwin-arm64 binary：`opencode-ai/bin/opencode.exe` 是 0755 Mach-O arm64，可执行输出 `1.15.11`，并与 `opencode-darwin-arm64/bin/opencode` 同内容/同 inode hard link。
- 已确认 server 行为：`opencode serve --hostname 127.0.0.1 --port <free-port> --pure` 可启动；Basic Auth 走 `OPENCODE_SERVER_USERNAME` / `OPENCODE_SERVER_PASSWORD`；`/global/health` 返回 `{ healthy: true, version: "1.15.11" }`；`/event` 首包为 `server.connected`。
- 已修正重要假设：`--port 0` 实测不会随机分配端口，而是使用默认 `4096`；CodeInsights 后续必须自行分配空闲端口再显式传给 server。
- 已确认 SDK 形态：v1 默认 fields 风格返回 `{ data, request, response }` 或 `{ error, request, response }`；`responseStyle: "data"` 直接返回 data；`event.subscribe()` 返回 `{ stream }`；Basic Auth header 必须通过 SDK config 或调用 options 传入。
- 已确认 session/prompt API：`POST /session` 可无模型创建 session，id 前缀 `ses_`；`POST /session/{id}/prompt_async` body 使用 `parts`，no-reply smoke 返回 204。
- 已确认 permission 差异：SDK v1 根方法 `postSessionIdPermissionsPermissionId()` body 是 `{ response: "once" | "always" | "reject" }`，没有 `remember`；SDK v2 新增 `permission.list()` / `permission.reply()`，Phase 1-2 需优先评估 v2 主路径。
- 已确认 config/provider/MCP：`OPENCODE_CONFIG`、`OPENCODE_CONFIG_DIR`、`OPENCODE_CONFIG_CONTENT` 会合并；`{env:VAR}` 可用于 provider `options.apiKey`、local MCP `environment` 和 remote MCP `headers`。
- 已记录安全边界：resolved `/config`、`/provider`、`/config/providers` 会包含 env 替换后的 secret，后续 diagnostics/event log 不能原样持久化这些响应；`enabled_providers` 过滤 provider endpoints 但不清理 `/config.provider` 原始 map；`provider.connected` 不能证明凭证有效。
- 已同步 `docs/opencode-support/README.md`、开发清单、主方案和 next-session prompt；下次启动应从 Phase 1 shared/settings/IPC 契约开始。
- 验证通过：`npm view @opencode-ai/sdk version dependencies dist-tags --json`、`npm view opencode-ai version optionalDependencies bin dist-tags --json`、`npm view opencode version --json`、`npm view @opencode-ai/cli version --json`。
- 验证通过：`bun run typecheck`。
- 验证通过：`bun test --isolate`，613 pass / 0 fail。
- 验证通过：`git diff --check`。
- 阶段边界：本轮未修改业务实现、根 `README.md` 或 `AGENTS.md`，未提交临时目录、打包产物或真实凭证。

## 2026-05-27 Agent opencode Runtime Phase 0 后状态同步计划

范围确认：本轮只同步 Phase 0 完成后的最新开发状态、下次启动提示词和长期协作习惯；不进入 Phase 1 业务实现，不修改根 `README.md` / `AGENTS.md`。

- [x] 确认当前工作树干净，最新提交为 `63aab807 docs(agent): 完成 opencode Runtime Phase 0 依赖 spike`。
- [x] 更新 `tasks/lessons.md`，明确以后阶段完成或用户要求下次继续时，要主动同步 support README、development checklist、next-session prompt 和 `tasks/todo.md` Review。
- [x] 更新 `docs/opencode-support/README.md`，标注 Phase 0 已完成并提交、Phase 1-8 未完成、下次入口为 Phase 1。
- [x] 更新 `docs/opencode-support/2026-05-27-agent-opencode-runtime-development-checklist.md`，把最新开发状态快照、仓库状态要求和下一步入口同步到 `63aab807` 后。
- [x] 更新 `docs/opencode-support/next-session-prompt.md`，生成可直接复制给下次 Codex 的 Phase 1 启动提示词。
- [x] 在本节追加 Review，运行 `git diff --check` 并单独提交状态同步改动。

## 2026-05-27 Agent opencode Runtime Phase 0 后状态同步 Review

- 已把用户要求“下次启动提示词和状态文档要主动同步，不需要每次提醒”的习惯写入 `tasks/lessons.md`。
- 已更新 `docs/opencode-support/README.md`：最新状态明确 Phase 0 已完成并提交 `63aab807`，Phase 1-8 未完成，下一步从 Phase 1 shared/settings/IPC 契约开始。
- 已更新开发清单：最新状态快照、仓库状态要求、Phase 0 退出标准和验证记录均指向真实 Phase 0 提交 `63aab807`，并保留本轮状态同步提交作为下次启动基线。
- 已更新 `docs/opencode-support/next-session-prompt.md`：下次 Codex 启动提示词要求先核对 `63aab807` 及其后的状态同步提交，再写入 Phase 1 计划并开始契约实现。
- 本轮仅修改状态文档、lessons 和任务记录，未进入 Phase 1 业务实现，未修改根 `README.md` / `AGENTS.md`。
- 验证：`git diff --check`。

## 2026-05-28 Agent opencode Runtime Phase 7 计划

范围确认：本轮继续 `agent-mode-opencode` 分支的 Phase 7。只接入 opencode MCP config/status、packaged binary inclusion、`OPENCODE_CONFIG_DIR` 显式开关验证、packaged app reload/history replay smoke，以及 secretless diagnostics / smoke summary / event log 约束；不进入真实模型验收、故障排查实战、release notes、根 `README.md` 或根 `AGENTS.md` 修改。

- [x] 读取 `AGENTS.md`、`tasks/lessons.md`、opencode support README、开发清单和主方案，确认 Phase 7 范围、secretless、阶段提交和状态同步纪律。
- [x] 运行 `git status --short` 和 `git log -5 --oneline`，确认工作树干净，最新提交为 `0c84b37a docs(agent): 同步 opencode Phase 6 最新开发状态`。
- [x] 用更深的 `git log` 确认历史包含 `077fbc49`、`bb361a34`、`786b6485`、`b3e99265`、`647d3046`。
- [x] 盘点现有 opencode runtime / smoke / packaging 代码，复用 Phase 2-6 已有 helper，不引入无关抽象。
- [x] 接入 workspace MCP -> opencode config/status：local / remote / OAuth native 复用、name sanitize、env placeholder、status summary 脱敏。
- [x] 保持 `OPENCODE_CONFIG_DIR` 默认暂缓，只在 assets / MCP 需要时通过 `CODEINSIGHTS_AGENT_OPENCODE_ENABLE_CONFIG_DIR=1` 或 `OPENCODE_SMOKE_ENABLE_CONFIG_DIR=1` 显式验证后启用。
- [x] 补充 MCP config-only / status smoke，不依赖真实模型；tool-call 真实模型 smoke 保持 gated。
- [x] 验证 Electron packaged 场景包含 `opencode-ai` 和目标平台 `opencode-*` optional package，并补 packaged binary smoke 证明不走系统 PATH。
- [x] 补充 packaged app server smoke 与 reload / history replay smoke；生成产物不纳入提交。
- [x] 补齐 secretless 检查：MCP config、runtime diagnostics、smoke summary 和 event log 不输出 API key、Basic Auth password、MCP token、resolved headers 或 auth 文件内容。
- [x] 更新 opencode support README、development checklist、next-session prompt 和本节 Review；明确多平台未验证项用 `[!]`，不伪装通过。
- [x] 运行 Phase 7 验证：聚焦单测、`bun run --filter='@codeinsights/electron' typecheck`、相关 smoke、`git diff --check`。
- [x] 代码改动后执行代码审查；通过后只提交 Phase 7 相关文件，提交信息使用详细中文。

## 2026-05-28 Agent opencode Runtime Phase 7 Review

- 启动基线已确认：本轮开始时最新提交为 `0c84b37a docs(agent): 同步 opencode Phase 6 最新开发状态`，历史包含 `077fbc49`、`bb361a34`、`786b6485`、`b3e99265`、`647d3046`。
- 已完成 workspace MCP 注入：opencode runtime 会读取工作区 MCP 配置并生成 secretless `mcp` config；stdio/local env 和 remote headers 均使用 `{env:VAR}` placeholder，真实 secret 只进入子进程 env，不写入长期 config、diagnostics、smoke summary 或 event log。
- 已完成 MCP 状态摘要：新增 `/mcp` status summary 归一化，只保留 server name、连接状态和 skip reason；设置页 MCP 摘要从 Phase 7 占位改为显示 configured / connected / skipped 计数。
- 已保持 `OPENCODE_CONFIG_DIR` 默认关闭：默认 MCP smoke 通过且 `configDirEnabled=false`；显式 `OPENCODE_SMOKE_ENABLE_CONFIG_DIR=1` 的 MCP smoke 仍失败，错误为 `The operation was aborted.`，因此不启用 config-dir。
- 已完成 packaged binary 验证：`electron-builder.yml` 纳入 `@opencode-ai/sdk`、`opencode-ai` 和全部目标 `opencode-*` optional package；packaged smoke 证明 macOS arm64 app 使用 `opencode-darwin-arm64/bin/opencode`，source 为 `bundled`，PATH fallback disabled，并可启动 server health。
- 已补充 packaged history reload smoke：`smoke:agent-history-reload-ui -- --runtime opencode` 会种子化 opencode runtime session/events，并验证 packaged app 首次打开和重开后均能回放用户/助手历史。
- 已修复 packaged binary resolver 边界：packaged app 中若 `opencode-ai/package.json` 存在但 `opencode-ai/bin/opencode.exe` 不可执行或不存在，会继续回退到平台 optional package，而不是返回缺失路径。
- 已根据代码审查修复 Phase 7 收尾问题：MCP args / URL 出现 secret-like 表达时直接跳过并记录 `unsafe_args` / `unsafe_url`；opencode MCP timeout 写入 config 时从秒转毫秒；platform optional package binary 缺失或不可执行时不再返回坏路径。
- 已按受影响包 patch 版本规则将 `@codeinsights/shared` 从 `0.1.48` 提升到 `0.1.49`，将 `@codeinsights/electron` 从 `0.0.118` 提升到 `0.0.119`，并同步 `bun.lock` workspace 版本。
- Phase 7 已单独提交：`3ec2ebec feat(agent): 完成 opencode Runtime Phase 7 MCP 与打包验证`。
- 已更新 `docs/opencode-support/README.md`、development checklist 和 `next-session-prompt.md`：Phase 0-7 标记为已完成，Phase 8 未开始，下一步入口改为真实使用验收、故障排查材料和公开文档同步准备。
- 保持阶段边界：未进入真实模型验收、故障排查实战、release notes、根 `README.md` 或根 `AGENTS.md` 修改；MCP tool-call 真实模型 smoke 留到 Phase 8 或显式凭证验收。
- 多平台验证状态：macOS arm64 packaged app smoke 已通过；macOS x64、Windows x64、Linux packaged smoke 本机未验证，后续文档标记 `[!]`，不伪装通过。
- `dist:fast` 结果：main/preload/renderer 构建和 `out/mac-arm64/CodeInsights.app` 生成成功；DMG 生成阶段仍因 `hdiutil create` Exit code 1 失败，因此本轮只证明 app bundle 可用，不声明 DMG artifact 通过。
- 验证通过：`bun test apps/electron/src/main/lib/opencode-runtime/opencode-mcp-config.test.ts apps/electron/src/main/lib/opencode-runtime/opencode-sdk-client.test.ts apps/electron/src/main/lib/opencode-runtime/opencode-binary.test.ts`；`bun test apps/electron/src/main/lib/agent-runtimes/opencode-runtime.test.ts apps/electron/src/main/lib/agent-orchestrator.test.ts`；`CODEINSIGHTS_AGENT_OPENCODE_RUNTIME=1 bun run --filter='@codeinsights/electron' smoke:agent-opencode -- --only mcp`；`CODEINSIGHTS_AGENT_OPENCODE_RUNTIME=1 bun run --filter='@codeinsights/electron' smoke:agent-opencode -- --only packaged`；`CODEINSIGHTS_AGENT_OPENCODE_RUNTIME=1 bun run --filter='@codeinsights/electron' smoke:agent-history-reload-ui -- --runtime opencode`；`bun run --filter='@codeinsights/electron' typecheck`；`bun install --frozen-lockfile --dry-run`；`git diff --check -- apps/electron packages/shared bun.lock tasks/todo.md`。

## 2026-05-28 README 架构图 style 6 刷新计划

范围确认：本轮只深入分析当前项目架构，并使用 `fireworks-tech-graph` 生成 style 6（Claude Official）风格的 README 架构/流程/框架图，替换 `assets/imgs/` 下 README 正在引用的 5 张图及对应 SVG 源；不调整 README 正文结构，不修改 `README_en.md`，不进入业务代码实现。

- [x] 复习 `tasks/lessons.md`、README 架构章节和现有 `assets/imgs/` 图片，确认需要替换的目标与响应式图片风险。
- [x] 并行梳理当前项目实际架构：Electron 三进程、Bun workspace、Agent Runtime、Pipeline v2、IPC/Jotai、本地配置存储。
- [x] 基于 style 6 参考设计 5 张图的版式与节点，确保与 README 当前章节一一对应。
- [x] 生成并导出 `codeinsights-system-architecture`、`codeinsights-pipeline-langgraph-flow`、`codeinsights-agent-runtime-flow`、`codeinsights-ipc-state-flow`、`codeinsights-local-storage-framework` 的 SVG 和 PNG。
- [x] 验证 SVG XML、PNG 尺寸/可读性、README 图片引用路径、敏感信息扫描和 `git diff --check`，并在本节追加 Review。

## 2026-05-28 README 架构图 style 6 刷新 Review

- 已使用 `fireworks-tech-graph` style 6（Claude Official）重新生成 README 当前引用的 5 组图：系统架构、Pipeline v2 LangGraph、Agent Runtime、IPC/Renderer 状态流、本地存储框架。
- 已根据当前项目实现更新图中事实：Pipeline v2 标明 `explorer/planner` 走 Claude、`developer/reviewer/tester/committer` 走 Codex；Agent Runtime 标明 session-first runtime 选择、Claude Code / Codex / opencode 三 runtime、runtime envelope 与 JSONL 双线；IPC 图标明 shared/local types、main handlers、preload 白名单、stream bus 与 Jotai atoms；存储图标明 config root、JSON 配置、JSONL 记录、runtime manifest、Pipeline artifacts 与 repo `./patch-work`。
- 已用同名文件替换 `assets/imgs/` 下 5 个 PNG 与 5 个 SVG 源，README 继续使用原路径；同时更新 README 图片 alt 文案，避免继续写旧的“Claude SDK 与 JSONL 存储”。
- 已做视觉复核并移除高干扰箭头浮动标签，保留节点技术说明和图例；PNG 尺寸为系统架构 `2400x1520`、Pipeline `2400x1720`、Agent/IPC/Local Storage `2400x1640`。
- 验证通过：`bash /Users/zq/.codex/skills/fireworks-tech-graph/scripts/validate-svg.sh assets/imgs/codeinsights-*.svg`；Python `xml.etree.ElementTree` 解析 5 个 SVG；Playwright + Microsoft Edge 导出 5 个 PNG；PIL 检查 PNG 非空；README `assets/imgs` 图片引用路径存在；旧命名/旧架构残留扫描无命中；`git diff --check -- README.md assets/imgs tasks/todo.md`。

## 2026-05-28 README 架构图视觉返工计划

范围确认：修复上一版 style 6 图在 README 实际显示中的可读性问题；仍只修改 README 引用的 5 组 `assets/imgs/` SVG/PNG、README alt 文案（如需要）、`tasks/todo.md` 与 `tasks/lessons.md`。

- [x] 记录用户纠正到 `tasks/lessons.md`，明确最终 PNG 视觉验收不能只看自动校验。
- [x] 重新绘制 5 张展示型架构图：减少节点和连线，去掉箭头浮动标签，确保节点副标题与边框留足空间。
- [x] 用最终 PNG 实际打开检查系统架构、Pipeline、Agent、IPC、本地存储 5 张图，确认没有文字压线、遮挡、穿线和图例挤压。
- [x] 重新验证 SVG XML、PNG 尺寸/非空、README 图片引用、旧命名/旧架构残留、`git diff --check`。
- [x] 在本节追加 Review，单独提交并推送修复提交。

## 2026-05-28 README 架构图视觉返工 Review

- 已承认并修复上一版图的核心问题：节点副标题贴边 / 重叠、箭头和虚线穿过节点正文、图例挤占内容区、局部 section label 与底层节点过近。
- 已重新绘制 README 当前引用的 5 组同名 SVG/PNG：系统架构、Pipeline v2 LangGraph、Agent Runtime、IPC/Renderer 状态流、本地存储框架；新版本采用展示型信息架构，统一节点高度与文本基线，连线收敛为 style 6 暖灰实线 / 虚线，不再使用箭头浮动标签。
- 已逐张打开最终 PNG 实际检查，并生成 contact sheet `/tmp/codeinsights-diagram-contact-sheet.png` 复核 README 缩放后的整体密度；未发现阻塞级文字压线、箭头穿正文或图例遮挡内容。
- 验证通过：`bash /Users/zq/.codex/skills/fireworks-tech-graph/scripts/validate-svg.sh assets/imgs/codeinsights-*.svg`；Playwright + Microsoft Edge 导出 5 个 PNG；PIL 检查 PNG 尺寸与非空均值；README `assets/imgs` 引用存在；旧命名 / 旧架构残留扫描无命中；`git diff --check -- README.md assets/imgs tasks/todo.md tasks/lessons.md`。

## 2026-05-28 Pipeline v1 优化方案文档计划

范围确认：本轮只深入探索当前 Pipeline 模式并新增 `docs/improve/pipeline/v1/` 下的 Markdown 优化方案文档；同步 `tasks/todo.md` 任务记录。不修改业务代码、不修改根 `README.md` / `AGENTS.md`，不安装依赖，不做真实模型 smoke。

- [x] 复习 `tasks/lessons.md` 和现有 Pipeline 文档，确认历史约束、v0 方案和当前 README 所述 v2 事实。
- [x] 梳理 Pipeline 后端实现：shared 类型、IPC handler、LangGraph、节点路由、Claude / Codex runner、service 生命周期、gate、checkpoint、artifact、patch-work、preflight 和 Git submission。
- [x] 梳理 Pipeline 前端实现：Jotai atoms、全局监听、PipelineView、Header、StageRail、Records、GateCard、Explorer / Reviewer / Tester / Committer 面板和设置项。
- [x] 形成优化方案：当前状态、主要问题、目标架构、前后端改造、新增功能、数据契约、迁移策略、验证计划和分阶段路线。
- [x] 新增 `docs/improve/pipeline/v1/2026-05-28-pipeline-mode-optimization-plan.md` 并验证 Markdown、路径与引用。
- [x] 在本节追加 Review，说明产出、未修改范围和验证结果。

## 2026-05-28 Pipeline v1 优化方案文档 Review

- 已新增 `docs/improve/pipeline/v1/2026-05-28-pipeline-mode-optimization-plan.md`，明确本文 v1 是优化方案版本，不是旧 `PipelineVersion = 1` 协议。
- 已基于当前真实代码梳理 Pipeline 后端：shared 契约、v1/v2 状态回放、LangGraph、节点路由、Claude / Codex runner、PipelineService 生命周期、gate side effects、checkpoint、patch-work、preflight、ContributionTask 和 Git submission。
- 已基于当前真实代码梳理 Pipeline 前端：默认 v2 入口、Jotai atoms、全局 stream listener、PipelineView、StageRail、Records、Explorer / Review / Reviewer / Tester / Committer 面板和 renderer preflight。
- 方案中记录了优先优化点：接入 repository preflight IPC / UI / start guard，修复 Records v2 committer 过滤与分组，拆分 PipelineView，建设 Patch-work Document Workbench，收敛远端写二次确认语义，补 ContributionTask Dashboard、SubmissionPlan、PR Preview / GitHub API / existing PR update。
- 本轮仅新增方案文档并更新 `tasks/todo.md`，未修改业务代码、根 `README.md`、根 `AGENTS.md`，未安装依赖，未执行真实模型 smoke。
- 验证通过：`test -f docs/improve/pipeline/v1/2026-05-28-pipeline-mode-optimization-plan.md`；`rg -n "TODO|TBD|待补|xxx|FIXME" docs/improve/pipeline/v1/2026-05-28-pipeline-mode-optimization-plan.md` 无命中；`git diff --check -- tasks/todo.md`；`git diff --check --no-index /dev/null docs/improve/pipeline/v1/2026-05-28-pipeline-mode-optimization-plan.md` 无空白错误。

## 2026-05-28 Pipeline v1 优化方案二次完善计划

范围确认：继续完善 `docs/improve/pipeline/v1/2026-05-28-pipeline-mode-optimization-plan.md`，尽可能补充每部分的实现细节、文件落点、数据契约、UI 行为、验收标准和风险控制；仍不修改业务代码、根 `README.md` / `AGENTS.md`，不安装依赖，不做真实模型 smoke。

- [x] 复习 `tasks/lessons.md` 和现有 v1 方案，确认本轮扩写要覆盖 preflight 主路径、v2 前端可见性、Git 防护、abort 副作用和阶段验证。
- [x] 补充方案文档的实现级细节：后端文件落点、IPC / preload / shared 契约、service 拆分、read model、gate 幂等和错误处理。
- [x] 补充前端细节：Jotai atom、hook 拆分、组件职责、交互状态、空态/错误态、可访问性和测试点。
- [x] 补充新增功能细节：Preflight Center、Patch-work Workbench、Submission Plan、Contribution Dashboard、Workflow Profile、Report Export 的分期 MVP 和验收。
- [x] 补充迁移兼容、验证矩阵、风险清单和下一轮最小实现 PR 范围。
- [x] 验证文档和任务记录，并追加 Review。

## 2026-05-28 Pipeline v1 优化方案二次完善 Review

- 已在 `docs/improve/pipeline/v1/2026-05-28-pipeline-mode-optimization-plan.md` 中扩写方案细节，文档从初版分析扩展为可拆 PR 的实现蓝图。
- 已补充当前文件级依赖图、可复用能力清单、风险优先级、运行主流程、Gate 状态目标态、IPC 增量清单、运行时校验规则和错误码建议。
- 已补充后端实现细节：preflight 主路径文件落点、`PipelineService` 拆分边界、gate side effect 幂等、独立远端写确认、abort-before-side-effects、GitHub API / existing PR 增强和 read model / export report。
- 已补充前端实现细节：`PipelineView` hook 拆分顺序、Preflight Center 分组展示、Records v2 committer 修复、Patch-work Document Workbench、三段式 CommitterPanel、Contribution Dashboard 和 Workflow Profile 设置策略。
- 已补充新增功能的 MVP / 增强范围 / 验收标准，并补充 Phase 完成定义、BDD 场景、测试矩阵、fixture repo、smoke 分层、不回归检查、迁移兼容和下一轮最小切片文件清单。
- 本轮仍只修改方案文档和 `tasks/todo.md`，未修改业务代码、根 `README.md`、根 `AGENTS.md`，未安装依赖，未执行真实模型 smoke。
- 验证通过：`test -f docs/improve/pipeline/v1/2026-05-28-pipeline-mode-optimization-plan.md`；`rg -n "TODO|TBD|待补|xxx|FIXME" docs/improve/pipeline/v1/2026-05-28-pipeline-mode-optimization-plan.md` 无命中；Markdown 代码块 fence 成对；`git diff --check -- tasks/todo.md`；`git diff --check --no-index /dev/null docs/improve/pipeline/v1/2026-05-28-pipeline-mode-optimization-plan.md` 无空白错误。

## 2026-05-28 Pipeline v1 开发跟踪清单计划

范围确认：基于 `docs/improve/pipeline/v1/2026-05-28-pipeline-mode-optimization-plan.md` 新增一份可长期勾选的开发跟踪清单，作为后续 Pipeline 优化迭代的执行入口；不修改业务代码、不修改根 `README.md` / `AGENTS.md`，不安装依赖，不做真实模型 smoke。

- [x] 复习 `tasks/lessons.md`、v1 优化方案和历史 v0 checklist，确认阶段提交、preflight、v2 可见性、Git 防护和验证纪律。
- [x] 新增 `docs/improve/pipeline/v1/2026-05-28-pipeline-mode-development-checklist.md`，包含强制规则、状态标记、里程碑、阶段任务、文件落点、验证命令、完成定义、风险门禁和阶段 Review 模板。
- [x] 确保清单能直接作为后续迭代入口：Phase 0-6 任务可勾选，P0/P1/P2 优先级清晰，旧会话兼容和文档同步边界明确。
- [x] 验证文档路径、Markdown 空白、占位符和任务记录，并追加 Review。
- [x] 按阶段纪律提交本轮文档成果。

## 2026-05-28 Pipeline v1 开发跟踪清单 Review

- 已新增 `docs/improve/pipeline/v1/2026-05-28-pipeline-mode-development-checklist.md`，作为后续 Pipeline v1 优化迭代的长期执行入口。
- 清单已按 Phase 0-6 拆分：清理与对齐、Preflight 主路径、PipelineView 拆分、Patch-work Workbench、Contribution Dashboard / Submission Plan、远端写确认 / GitHub 增强、真实端到端验收。
- 每个 Phase 都包含阶段状态、目标、入口条件、测试任务、实现任务、触达文件、验证命令、完成定义、禁止事项和 Review 模板，便于后续按阶段勾选和独立提交。
- 已补充横向工程纪律：安全审查、可用性检查、测试纪律、版本与提交清单、后续积压池和下一轮启动入口。
- 本轮仅新增开发清单并更新 `tasks/todo.md`，未修改业务代码、根 `README.md`、根 `AGENTS.md`，未安装依赖，未执行真实模型 smoke。
- 验证通过：`test -f docs/improve/pipeline/v1/2026-05-28-pipeline-mode-development-checklist.md`；`rg -n "TODO|TBD|待补|xxx|FIXME" docs/improve/pipeline/v1/2026-05-28-pipeline-mode-development-checklist.md` 无命中；Markdown 代码块 fence 成对；`git diff --check -- tasks/todo.md`；`git diff --check --no-index /dev/null docs/improve/pipeline/v1/2026-05-28-pipeline-mode-development-checklist.md` 无空白错误。

## 2026-05-29 阶段提交习惯同步计划

范围确认：响应用户要求“提交当前代码变更，并在后续 Codex 会话中自动保持阶段完成即提交的习惯”。本轮先确认当前工作树状态，再同步 `tasks/lessons.md` 长期规则和本任务记录；不修改业务代码、不修改根 `README.md` / `AGENTS.md`，不安装依赖，不 push。

- [x] 核对当前工作树和最近提交，确认 Pipeline v1 方案与开发清单已经完成阶段提交。
- [x] 更新 `tasks/lessons.md`，强化“新会话启动也要主动检查已完成未提交阶段”的长期习惯。
- [x] 验证任务记录和 lessons 空白检查。
- [x] 提交本轮习惯同步改动，提交信息使用详细中文。

## 2026-05-29 阶段提交习惯同步 Review

- 当前工作树在本轮开始时没有未提交业务代码变更；分支已有两个文档阶段提交：`ae5c85ba docs(pipeline): 完善 Pipeline v1 优化方案` 和 `3c754ac6 docs(pipeline): 新增 Pipeline v1 开发跟踪清单`。
- 已在 `tasks/lessons.md` 新增“2026-05-29 阶段提交习惯再确认”，明确重新启动 Codex 会话后也要主动检查已完成但未提交阶段成果。
- 已记录：如果用户要求提交但工作树干净，应报告最近提交和 ahead 状态；如有 lessons / 习惯同步，只提交同步改动，不制造无关业务修改。
- 本轮仅修改 `tasks/lessons.md` 和 `tasks/todo.md`，未修改业务代码、根 `README.md`、根 `AGENTS.md`，未安装依赖，未 push。
- 验证通过：`git diff --check -- tasks/todo.md tasks/lessons.md`。

## 2026-05-29 Pipeline v1 最新状态同步计划

范围确认：更新 `docs/improve/pipeline/v1/2026-05-28-pipeline-mode-development-checklist.md` 的最新开发状态，新增下次启动可直接复制的 prompt，并把“每完成阶段后同步状态文档和 next-session prompt”的习惯写回 `tasks/lessons.md`；不修改业务代码、不修改根 `README.md` / `AGENTS.md`，不安装依赖，不 push。

- [x] 记录本轮状态同步范围和文件边界。
- [x] 更新 Pipeline v1 开发清单的最新开发状态，明确已完成和未完成项。
- [x] 新增 next-session prompt 文档，供下次直接复制给 Codex。
- [x] 同步 lessons 中的阶段后状态文档习惯。
- [x] 验证文档空白、占位符和任务记录，并追加 Review。
- [x] 提交本轮状态同步改动，使用详细中文 commit 信息。

## 2026-05-29 Pipeline v1 最新状态同步 Review

- 已更新 `docs/improve/pipeline/v1/2026-05-28-pipeline-mode-development-checklist.md` 的“最新开发状态”，明确当前是“方案与开发清单已完成，业务实现尚未开始”，下次应从 Phase 0 开始。
- 已清楚标注已完成项：优化方案文档、开发跟踪清单、阶段提交习惯同步，以及对应阶段提交 `ae5c85ba`、`3c754ac6`、`3ce1402e`。
- 已清楚标注未完成项：Phase 0-6 全部未开始，Records v2 `committer`、`openPipelinePatchWorkDir`、Preflight 主路径、PipelineView 拆分、Patch-work Workbench、Contribution Dashboard / SubmissionPlan、远端写确认 / GitHub 增强、真实 smoke 均未实现。
- 已新增 `docs/improve/pipeline/v1/next-session-prompt.md`，包含下次启动检查、当前真实进度、Phase 0 范围、推荐触达文件、验证命令和阶段完成纪律。
- 已在 `tasks/lessons.md` 补充每个阶段完成后要同步开发清单、更新 next-session prompt，并在 `tasks/todo.md` Review 中写明完成项、未完成项、验证结果和下一阶段入口。
- 本轮仅修改 v1 文档、`tasks/lessons.md` 和 `tasks/todo.md`，未修改业务代码、根 `README.md`、根 `AGENTS.md`，未安装依赖，未 push。
- 验证通过：`test -f docs/improve/pipeline/v1/next-session-prompt.md`；`rg -n "TODO|TBD|待补|xxx|FIXME" docs/improve/pipeline/v1/next-session-prompt.md docs/improve/pipeline/v1/2026-05-28-pipeline-mode-development-checklist.md` 无命中；Markdown 代码块 fence 成对；`git diff --check -- docs/improve/pipeline/v1 tasks/todo.md tasks/lessons.md`。
