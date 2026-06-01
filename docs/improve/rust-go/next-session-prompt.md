# Rust / Go 优化重构下次启动提示词

> 更新时间：2026-06-01
> 当前分支：`rust-go-refactor`
> 最新已确认开发基线：`8131b66b docs(rust-go): 新增优化方案和开发跟踪清单`
> 最新已确认恢复入口：`fe34b231 docs(tasks): 固化阶段完成即提交纪律`
> 说明：如果本文件所在提交之后还有 Rust / Go 状态同步提交，下次启动时以 `git log -5 --oneline` 中最新的 Rust / Go docs / tasks 提交为准。

## 当前真实进度

已完成：

- [x] Rust / Go 优化重构方案：`docs/improve/rust-go/2026-06-01-rust-go-optimization-plan.md`。
- [x] Rust / Go 开发跟踪清单：`docs/improve/rust-go/2026-06-01-rust-go-development-checklist.md`。
- [x] 阶段提交纪律固化：`tasks/lessons.md` 已记录每完成一个阶段并通过验证后必须单独提交；重启 Codex 会话后也要主动检查是否有已完成但未提交的阶段成果。
- [x] 下次启动提示词入口：本文。

未完成：

- [ ] Phase 0：基线、契约与 benchmark。
- [ ] Phase 1：TypeScript fallback 与 EventSearchService 重构。
- [ ] Phase 2：Pipeline records cursor / tail 与全局搜索接入。
- [ ] Phase 3：Workspace 文件索引 TS cache 与 watcher invalidation。
- [ ] Phase 4：前端可见体验、Jotai 状态和 diagnostics。
- [ ] Phase 5：Rust search sidecar 试点。
- [ ] Phase 6：大文件 / 日志 chunk preview。
- [ ] Phase 7：PathSafety 与 GitOutputParser 抽象。
- [ ] Phase 8：打包、CI、版本与发布收口。
- [ ] Phase 9：Go supervisor 可选 spike。

关键边界：

- [ ] 当前没有任何 Rust / Go 功能实现，也没有 native binary。
- [ ] 不要直接开始写 Rust / Go；必须先做 Phase 0 的 shared 契约、fixtures、benchmark 和 TS fallback 边界。
- [ ] 不修改根 `README.md` / 根 `AGENTS.md`，除非用户明确授权。
- [ ] 不安装依赖；如果后续确需 Rust crate / Go package，先做依赖搜索和 decision record。
- [ ] 不 push、不创建 PR、不执行真实远端写，除非用户明确要求。

## 可复制提示词

```text
请继续 CodeInsights Rust / Go 优化重构迭代。先读取 tasks/lessons.md、tasks/todo.md、docs/improve/rust-go/2026-06-01-rust-go-optimization-plan.md、docs/improve/rust-go/2026-06-01-rust-go-development-checklist.md 和 docs/improve/rust-go/next-session-prompt.md。

当前进度：Rust / Go 优化方案与开发跟踪清单已经完成；阶段提交纪律已固化；目前尚未实现 NativeRuntimeAdapter、TS fallback 重构、Rust sidecar、Go supervisor 或任何 native binary。最新已确认开发基线是 8131b66b docs(rust-go): 新增优化方案和开发跟踪清单；最新已确认恢复入口是 fe34b231 docs(tasks): 固化阶段完成即提交纪律。请启动后运行 git status --short --branch 和 git log -5 --oneline，若存在更新的 Rust / Go 状态同步提交，以最新提交为准。

下一步从 Phase 0“基线、契约与 benchmark”开始。请先在 tasks/todo.md 写 Phase 0 计划，明确范围、触达文件、验证命令和禁止事项；不要直接写 Rust / Go，不安装依赖，不创建 native binary，不修改根 README.md / AGENTS.md。Phase 0 目标是建立 shared DTO / IPC 草案、NativeRuntimeAdapter TS interface、contract fixtures、diagnostics 类型和 benchmark fixture，记录 JSONL 搜索、Pipeline records tail、workspace search、大文件预览的真实基线数据。

请遵守阶段纪律：每完成一个阶段并通过验证后，立即更新 development checklist、next-session-prompt.md、tasks/todo.md Review 和必要的 lessons，然后单独提交该阶段相关文件，提交信息使用详细中文。
```
