# Rust / Go 优化重构下次启动提示词

> 更新时间：2026-06-02
> 当前分支：`rust-go-refactor`
> 最新已确认开发基线：`16cbb3e1 feat(rust-go): 完成 Phase 4 Native Runtime diagnostics 前端体验`。
> 最新已确认恢复入口：本文件所在的 Phase 4 状态同步提交；如果本文件所在提交之后还有 Rust / Go 状态同步提交，下次启动时以 `git log -5 --oneline` 中最新的 Rust / Go docs / tasks / feat 提交为准。

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

未完成：

- [ ] Phase 5：Rust search sidecar 试点。
- [ ] Phase 6：大文件 / 日志 chunk preview。
- [ ] Phase 7：PathSafety 与 GitOutputParser 抽象。
- [ ] Phase 8：打包、CI、版本与发布收口。
- [ ] Phase 9：Go supervisor 可选 spike。

关键边界：

- [ ] 当前没有任何 Rust / Go 功能实现，也没有 native binary；Phase 0 到 Phase 4 只建立 TypeScript 契约、diagnostics、benchmark 基线、搜索 fallback facade、Pipeline cursor tail、workspace index cache 和前端可见 diagnostics。
- [ ] Phase 5 不要直接开写 Rust 或安装依赖；必须先做 Rust 依赖搜索 / decision record，写清继续 TS、Rust crate / sidecar、Go package 的取舍。
- [ ] Phase 5 必须先写性能收益门槛、sidecar protocol、contract parity、native missing / crash / timeout fallback、packaged smoke 和安全门禁。
- [ ] 不修改根 `README.md` / 根 `AGENTS.md`，除非用户明确授权。
- [ ] 不 push、不创建 PR、不执行真实远端写，除非用户明确要求。

## 可复制提示词

```text
请继续 CodeInsights Rust / Go 优化重构迭代。先读取 tasks/lessons.md、tasks/todo.md、docs/improve/rust-go/2026-06-01-rust-go-optimization-plan.md、docs/improve/rust-go/2026-06-01-rust-go-development-checklist.md 和 docs/improve/rust-go/next-session-prompt.md。

当前进度：Rust / Go 优化方案、开发跟踪清单、阶段提交纪律、Phase 0“基线、契约与 benchmark”、Phase 1“TypeScript fallback 与 EventSearchService 重构”、Phase 2“Pipeline records cursor / tail 与全局搜索接入”、Phase 3“Workspace 文件索引 TS cache 与 watcher invalidation”和 Phase 4“前端可见体验、Jotai 状态和 diagnostics”已经完成。Phase 4 已新增 Native Runtime diagnostics IPC / preload / Jotai atoms / 全局 listener / Settings 运行诊断面板，支持 status、diagnostics、rebuildIndex、clearCache、operation progress、status changed；SearchDialog 已具备 source filter、fallback / rebuilding / unavailable / error 简短状态和更多结果控制；PipelineRecords 已具备 tail loading / retry 状态。目前尚未实现 Rust sidecar、Go supervisor、native binary、native optional package 或大文件 / 日志 chunk preview。最新已确认开发基线是 16cbb3e1 feat(rust-go): 完成 Phase 4 Native Runtime diagnostics 前端体验；请启动后运行 git status --short --branch 和 git log -5 --oneline，若存在更新的 Rust / Go 状态同步提交，以最新提交为准。

下一步从 Phase 5“Rust search sidecar 试点”开始。请先在 tasks/todo.md 写 Phase 5 计划，明确范围、触达文件、验证命令、性能收益门槛、依赖 decision record 和禁止事项；用户已明确计划写清后无需等待确认。不要直接写 Rust / Go 代码，不安装依赖，不创建 native binary，不修改根 README.md / AGENTS.md。Phase 5 必须先做 Rust 依赖搜索 / decision record、sidecar protocol / fallback / packaged smoke 计划，再进入最小 Rust search sidecar 实现。

请遵守阶段纪律：每完成一个阶段并通过验证后，立即更新 development checklist、next-session-prompt.md、tasks/todo.md Review 和必要的 lessons，然后单独提交该阶段相关文件，提交信息使用详细中文。
```
