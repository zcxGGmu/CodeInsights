# Phase 5 Dependency Decision Record

> 日期：2026-06-03
> 阶段：Phase 5 Rust search sidecar 试点前置决策
> 状态：前置决策完成；后续已按本决策新增 `native/search/` search-only Rust 源码切片和 `Cargo.lock`，尚未创建 packaged native binary
> 关联开发提交：`e39682f1 feat(rust-go): 完成 Phase 5 最小 Rust search sidecar 源码切片`

## 决策摘要

Phase 5 可以进入“最小 Rust search sidecar”设计，但不能直接引入完整搜索引擎或 watcher 体系。首个 sidecar 的依赖策略是：

- 保留 TypeScript fallback 作为唯一稳定基线和回滚路径。
- Rust sidecar 只接手 line-delimited JSON protocol、JSONL line parse、简单 substring / token search 和 Pipeline tail 对照。
- Rust 首批候选依赖仅建议 `serde`、`serde_json` 和可选 `memchr`；当前 search-only 源码切片已在 `native/search/Cargo.toml` 固定直接依赖 `serde` / `serde_json`，未直接引入 `memchr`。
- 暂缓 `regex`、`walkdir`、`ignore`、`memmap2`、`tantivy`，直到 benchmark 证明它们解决了明确瓶颈。
- Go / `fsnotify` 不进入 Phase 5 默认实现，只保留 Phase 9 supervisor / watcher spike。

本文件记录依赖搜索和取舍；进入 search-only 源码切片后，只新增 `native/search/Cargo.toml` 与 `native/search/Cargo.lock`，未修改 `go.mod`、`package.json`、`bun.lock` 或打包配置。

## 数据来源

- Rust crate 元数据：crates.io API，查询时间 2026-06-03。
- Rust API / 文档：docs.rs 对应 crate latest 页面。
- 安全记录：OSV API，查询时间 2026-06-03。
- Go 对照：`pkg.go.dev/github.com/fsnotify/fsnotify` 与 `github.com/fsnotify/fsnotify`；本地 `go list` 访问 `proxy.golang.org` 超时，因此 Go 只作为非主线参考。

参考链接：

- [serde](https://crates.io/crates/serde)、[serde_json](https://crates.io/crates/serde_json)
- [memchr](https://crates.io/crates/memchr)、[regex](https://crates.io/crates/regex)
- [walkdir](https://crates.io/crates/walkdir)、[ignore](https://crates.io/crates/ignore)
- [memmap2](https://crates.io/crates/memmap2)、[tantivy](https://crates.io/crates/tantivy)
- [OSV API](https://osv.dev/docs/)、[RustSec regex advisory](https://rustsec.org/advisories/RUSTSEC-2022-0013.html)
- [fsnotify on pkg.go.dev](https://pkg.go.dev/github.com/fsnotify/fsnotify)、[fsnotify GitHub](https://github.com/fsnotify/fsnotify)

## 候选依赖表

| 方案 | 当前版本 / 状态 | License | 普通依赖数 | Phase 5 决策 |
| --- | --- | --- | --- | --- |
| TypeScript fallback | 已实现 | 项目现状 | 已在仓库内 | 保留，作为对照和 fallback。 |
| Rust std only | 无外部依赖 | Rust 标准库 | 0 | 不适合作为 JSON protocol 实现，避免手写 JSON parser。 |
| `serde` | 1.0.228，2025-09-27 更新 | MIT OR Apache-2.0 | 2 | 建议进入首批候选，用于 typed protocol / DTO。 |
| `serde_json` | 1.0.150，2026-05-21 更新 | MIT OR Apache-2.0 | 6 | 建议进入首批候选，用于 JSONL / JSON-RPC line decode。 |
| `memchr` | 2.8.1，2026-05-27 更新 | Unlicense OR MIT | 2 | 可选，用于大文本换行 / byte search；若标准库性能足够则暂缓。 |
| `regex` | 1.12.3，2026-02-03 更新 | MIT OR Apache-2.0 | 4 | 暂缓。首版用 literal search，避免 pattern 语义和 ReDoS 复杂度。 |
| `walkdir` | 2.5.0，2024-03-01 更新 | Unlicense/MIT | 2 | 暂缓。Phase 5 不接手 workspace directory walk。 |
| `ignore` | 0.4.25，2025-10-30 更新 | Unlicense OR MIT | 8 | 暂缓。等 Rust workspace index 阶段再评估。 |
| `memmap2` | 0.9.10，2026-02-15 更新 | MIT OR Apache-2.0 | 2 | 暂缓。先用 streaming read，mmap 需单独安全和平台评估。 |
| `tantivy` | 0.26.1，2026-04-21 更新 | MIT | 50 | 不进入首版。完整全文索引收益高但依赖和 cache schema 成本大。 |
| Go stdlib | 当前 Go 工具链 | Go license | 0 | 不进入 Phase 5；sidecar protocol / search 不需要 Go。 |
| Go `fsnotify` | Go proxy 查询超时，参考 pkg.go.dev / GitHub | BSD-style | 需后续确认 | 只保留 Phase 9 watcher / supervisor spike。 |

## 安全查询结果

OSV 查询结果：

- `serde`、`serde_json`、`memchr`、`walkdir`、`ignore`、`memmap2`、`tantivy`：本轮查询未返回记录。
- `regex`：OSV 返回 2 条历史记录，修复版本均为 `1.5.5`；当前候选 `1.12.3` 不在已知受影响版本范围内。因为首版不需要 regex pattern 能力，仍暂缓引入。

安全结论：

- 首批候选 `serde` / `serde_json` 是必要的 protocol / JSONL 基础依赖，license 与维护状态可接受。
- `memchr` 可作为性能优化而不是功能依赖；只有 benchmark 显示标准库查找是瓶颈时才加入。
- `regex`、`tantivy` 这类能力型依赖必须在独立 benchmark / cache schema / contract parity 之后再评估。

## 路线对比

### 继续 TypeScript

收益：

- 零新增供应链和打包成本。
- 已具备 diagnostics、Jotai UI、workspace index cache、Pipeline cursor tail。
- 与 Electron main process 和现有 JSON / JSONL 事实源贴合。

不足：

- Phase 0 benchmark 已显示大日志预览和大规模搜索存在 event loop delay 与内存放大。
- 长历史搜索仍可能和主进程 I/O 竞争，影响 UI 响应。

结论：保留为 fallback 和 parity oracle，不作为 Phase 5 性能试点终点。

### Rust search sidecar

收益：

- 隔离进程可降低 Electron main thread 阻塞。
- 适合 streaming JSONL、tail、literal search、后续 mmap / index cache。
- 二进制体积和跨平台维护成本通常低于完整 Go supervisor + watcher。

成本：

- 需要 protocol、schema、binary 探测、packaged smoke、crash / timeout fallback。
- 需要平台 binary 和 optional package 策略，进入实现阶段后要递增相关 package 版本。

结论：Phase 5 主线采用 Rust sidecar，但首版只做 search / tail 最小能力，不做全文索引和 workspace walk。

### Go package / supervisor

收益：

- 长期运行的 watcher / supervisor / process tree 管理更自然。
- 标准库可以覆盖 loopback service、process lifecycle、JSON protocol。

不足：

- Phase 5 的 search / tail 不需要 Go 的并发和 supervisor 优势。
- 引入 Go 会提前扩大 CI / binary / smoke 矩阵。

结论：不进入 Phase 5。等 Phase 9 条件成立再评估。

## Phase 5 首批依赖建议

实现阶段如果开始写 Rust sidecar，首批只允许评估并加入：

```text
serde
serde_json
memchr（可选，benchmark 触发）
```

明确暂缓：

```text
regex
walkdir
ignore
memmap2
tantivy
fsnotify
```

## 进入实现前门槛

- dependency decision record 已提交并被 Phase 5 Review 引用。
- protocol / fallback / packaged smoke 计划已提交。
- benchmark 重新跑出当前 TS fallback 数字，并确认目标数据规模仍值得 native 试点。
- 实现提交不得与依赖决策文档混在一起。
- 若新增依赖，必须记录版本、license、OSV 查询、transitive dependency 影响和打包影响。
