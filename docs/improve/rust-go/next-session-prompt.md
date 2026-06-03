# Rust / Go 优化重构下次启动提示词

> 更新时间：2026-06-03
> 当前分支：`rust-go-refactor`
> 最新已确认开发基线：`0eb350ff feat(rust-go): 优化 Phase 5 Rust search sidecar 早停性能`。
> 最新已确认恢复入口：`aaede459 docs(rust-go): 同步 Phase 5 search 性能优化后续状态`。

## 当前真实进度

已完成：

- [x] Rust / Go 优化重构方案：`docs/improve/rust-go/2026-06-01-rust-go-optimization-plan.md`。
- [x] Rust / Go 开发跟踪清单：`docs/improve/rust-go/2026-06-01-rust-go-development-checklist.md`。
- [x] 阶段提交纪律固化：`tasks/lessons.md` 已记录每完成一个阶段并通过验证后必须单独提交；重启 Codex 会话后也要主动检查是否有已完成但未提交的阶段成果。
- [x] Phase 0：已建立 `packages/shared` NativeRuntime DTO / IPC 草案、contract fixtures、主进程 `NativeRuntimeAdapter` TypeScript interface、diagnostics 空实现和 `native-runtime:benchmark` runner。
- [x] Phase 1：已新增 `jsonl-event-reader.ts`、`ts-event-search-service.ts` 和 `native-runtime-service.ts`，统一 Chat / Agent / Pipeline TypeScript 搜索 fallback facade，并保留旧 IPC / preload / renderer 行为兼容。
- [x] Phase 2：已新增 TypeScript Pipeline cursor tail service，支持 latest / before / after、cursor schema version、anchor 校验、截断安全回退、坏行/空行/部分写入容错，并接入 SearchDialog Pipeline 内容搜索和 record 聚焦。
- [x] Phase 3：已新增 TypeScript workspace 文件索引 cache，支持 root fingerprint、ignore 规则、entry 上限、in-flight build 复用、watcher invalidation、workspace / attached source metadata 和 main 端路径白名单。
- [x] Phase 4：已新增 Native Runtime diagnostics IPC / preload / Jotai atoms / 全局 listener / Settings 运行诊断面板，支持 status、diagnostics、rebuildIndex、clearCache、operation progress、status changed；SearchDialog 已具备 source filter、fallback / rebuilding / unavailable / error 简短状态和更多结果控制；PipelineRecords 已具备 tail loading / retry 状态。
- [x] Phase 4 验证：Native Runtime / IPC / atoms / hook / SearchDialog / Diagnostics / shared tests、Pipeline renderer tests、shared/electron typecheck、main/preload/renderer build、`bun install --frozen-lockfile --dry-run` 和 `git diff --check` 均通过；`build:renderer` 仅有既有大 chunk 警告。
- [x] Phase 5 前置计划：已在 `tasks/todo.md` 写清范围、触达文件、验证命令、性能收益门槛、依赖 decision record 和禁止事项。
- [x] Phase 5 前置依赖决策：已新增 `docs/improve/rust-go/2026-06-03-phase-5-dependency-decision-record.md`，结论是首个 Rust sidecar 只建议实现阶段评估 `serde`、`serde_json` 和可选 `memchr`；暂缓 `regex`、`walkdir`、`ignore`、`memmap2`、`tantivy`；Go / `fsnotify` 不进入 Phase 5 默认实现。
- [x] Phase 5 protocol / fallback / smoke 计划：已新增 `docs/improve/rust-go/2026-06-03-phase-5-sidecar-protocol-and-smoke-plan.md`，首版采用 stdin / stdout line-delimited JSON protocol，method 为 `status`、`search`、`tail_jsonl`、`shutdown`，并要求 native missing / available、protocol mismatch、crash、timeout、cache corruption 和“不使用系统 PATH” smoke。
- [x] Phase 5 TS fallback benchmark gate：已重新跑 100MB 级 benchmark；Chat JSONL 99,527,780 bytes，P95 279.622ms，event loop delay 10.020ms；Agent JSONL 102,397,780 bytes，P95 216.859ms，event loop delay 1.248ms，确认 search 路径仍有 Rust 试点收益空间。
- [x] Phase 5 最小 Rust search-only sidecar 源码切片：已新增 `native/search/`，包含 stdin / stdout line-delimited JSON protocol、`status`、literal `search`、`shutdown` 和 explicit out-of-scope `tail_jsonl` typed error；直接依赖固定为 `serde = 1.0.228`、`serde_json = 1.0.150`。
- [x] Phase 5 search-only Rust 单测：覆盖 status、literal search、bad JSON、missing source、empty query、limit clamp、long query、deadline、snippet cap、基础脱敏、中文命中、ASCII query + Unicode prefix offset 和 UTF-16 matchedRanges。
- [x] Phase 5 Electron main process sidecar manager 与 fallback gate：已新增 `native-runtime-sidecar-manager.ts`，覆盖 missing binary、version mismatch、timeout、crash、shutdown、bad JSON stdout、stdout buffer 上限、source boundary violation、range violation、contract violation 和拒绝类错误不 fallback；默认仍不启用 native。
- [x] Phase 5 Chat search native opt-in 边界：只有 `CODEINSIGHTS_NATIVE_RUNTIME=1`、`CODEINSIGHTS_NATIVE_SEARCH=1` 和 `CODEINSIGHTS_NATIVE_SEARCH_BINARY` 同时存在时才尝试 Rust sidecar；native 命中只用于定位 cursor，legacy snippet / matchedRanges 仍由 TypeScript 生成。
- [x] Phase 5 Rust vs TS contract parity 与 100MB native benchmark：真实 Rust sidecar parity 已通过；`319f30e8` 当时 benchmark 显示 Rust native Chat event loop delay 明显降低但 P95 未达标，Agent native 明显慢于 TS fallback，因此 native 不得默认启用。
- [x] Phase 5 Rust search 早停性能优化：`native/search` 已升级到 `0.0.2` / `0.0.2-dev`，sidecar 在第 `limit + 1` 个命中后停止扫描并返回 `hasMore=true`，不再为精确 total 完整解析 100MB JSONL；新增 Rust 单测锁住早停后不继续统计后续坏 JSON 行。100MB benchmark 已从 P95 不达标改善为：Rust native Chat P95 25.593ms、event loop delay 2.432ms；Rust native Agent P95 10.573ms、event loop delay 3.546ms。

未完成：

- [~] Phase 5：Rust search sidecar 试点已进入实现；sidecar manager、fallback gate、contract parity、native benchmark 对比和 search 早停性能优化已完成，但 default enable、optional package、packaged smoke 和稳定 gate 决策尚未完成。
- [ ] Phase 6：大文件 / 日志 chunk preview。
- [ ] Phase 7：PathSafety 与 GitOutputParser 抽象。
- [ ] Phase 8：打包、CI、版本与发布收口。
- [ ] Phase 9：Go supervisor 可选 spike。

关键边界：

- [ ] 当前没有 packaged native binary；Electron main process 已具备显式 opt-in native search 调用链，但默认关闭，尚未完成 default-enable gate 决策。
- [ ] Phase 5 下一步不要创建 packaged native binary 或修改打包配置；先复跑稳定 benchmark gate、评估 Agent event loop 回退和 default-enable 风险，只有 P95 / event loop gate 同时达标且 packaged smoke 计划进入可执行阶段后才进入 optional package / packaged smoke。
- [ ] Phase 5 实现必须遵守已写好的依赖 decision record、sidecar protocol、contract parity、native missing / crash / timeout fallback、packaged smoke 和安全门禁。
- [ ] 不修改根 `README.md` / 根 `AGENTS.md`，除非用户明确授权。
- [ ] 不 push、不创建 PR、不执行真实远端写，除非用户明确要求。

## 可复制提示词

```text
请继续 CodeInsights Rust / Go 优化重构迭代。先读取 tasks/lessons.md、tasks/todo.md、docs/improve/rust-go/2026-06-01-rust-go-optimization-plan.md、docs/improve/rust-go/2026-06-01-rust-go-development-checklist.md、docs/improve/rust-go/2026-06-03-phase-5-dependency-decision-record.md、docs/improve/rust-go/2026-06-03-phase-5-sidecar-protocol-and-smoke-plan.md、docs/improve/rust-go/next-session-prompt.md 和 native/search/。

当前进度：Rust / Go 优化方案、开发跟踪清单、阶段提交纪律、Phase 0“基线、契约与 benchmark”、Phase 1“TypeScript fallback 与 EventSearchService 重构”、Phase 2“Pipeline records cursor / tail 与全局搜索接入”、Phase 3“Workspace 文件索引 TS cache 与 watcher invalidation”和 Phase 4“前端可见体验、Jotai 状态和 diagnostics”已经完成。Phase 5 已完成前置计划、依赖 decision record、sidecar protocol / fallback / packaged smoke 计划、100MB 级 TS fallback benchmark gate、`native/search/` 最小 Rust search-only sidecar 源码切片、Electron main process sidecar manager、Chat search fallback gate、Rust vs TS contract parity、100MB native benchmark 对比和 Rust search 早停性能优化。最新开发基线是 `0eb350ff feat(rust-go): 优化 Phase 5 Rust search sidecar 早停性能`；最新恢复入口是 `aaede459 docs(rust-go): 同步 Phase 5 search 性能优化后续状态`。

已完成的 Phase 5 sidecar manager 切片：Rust crate 直接依赖固定为 `serde = 1.0.228`、`serde_json = 1.0.150`；实现 stdin / stdout line-delimited JSON protocol、`status`、literal `search`、`shutdown` 和 explicit out-of-scope `tail_jsonl` typed error；Electron main process 通过 `native-runtime-sidecar-manager.ts` 显式 binary path opt-in，不从系统 PATH 查找；覆盖 missing binary、version mismatch、timeout、crash、shutdown、bad JSON stdout、stdout buffer 上限、contract violation、source boundary violation、range violation、拒绝类错误不 fallback、Chat legacy snippet parity、真实 Rust vs TS parity。`0eb350ff` 已把 Rust search 升级到 `0.0.2` / `0.0.2-dev`，在第 `limit + 1` 个命中后早停并返回 `hasMore=true`。最新 100MB benchmark：TS Chat P95 491.319ms / event loop 82.650ms，Rust native Chat P95 25.593ms / event loop 2.432ms；TS Agent P95 547.352ms / event loop 2.092ms，Rust native Agent P95 10.573ms / event loop 3.546ms。结论：native P95 已显著改善，但 Agent event loop gate 和 packaged smoke / optional package / default-enable 风险评估仍未完成，native 仍不能默认启用。尚未完成：default enable、optional package、packaged smoke、稳定 gate 决策、Phase 6-9。

启动后先运行 `git status --short --branch` 和 `git log -5 --oneline`，确认最近历史包含 `aaede459`、`0eb350ff`、`319f30e8`。下一步继续 Phase 5“Rust search sidecar 试点”：复跑稳定 benchmark gate，评估 Agent event loop 回退和 default-enable 风险；未达到 P95 / event loop gate 前不得默认启用 native。不要创建 packaged native binary，不修改 `electron-builder.yml`，不修改根 `README.md` / 根 `AGENTS.md`，不 push，不创建 PR。

请遵守阶段纪律：每完成一个阶段并通过验证后，立即更新 development checklist、next-session-prompt.md、tasks/todo.md Review 和必要的 lessons，然后单独提交该阶段相关文件，提交信息使用详细中文。
```
