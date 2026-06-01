# Rust / Go 优化重构方案

> 日期：2026-06-01
> 范围：当前 CodeInsights monorepo、Electron main / preload / renderer、`packages/shared` 契约、Agent / Pipeline runtime、JSONL 本地存储、文件预览、打包分发与可新增产品能力。
> 说明：本文是优化方案，不代表功能已经实现。方案目标不是“为了 Rust / Go 而迁移”，而是找出当前 TypeScript / Electron 架构中真正适合 native 能力接手的局部边界。

## 结论摘要

当前项目不适合整体重写成 Rust / Go，也不适合把 Electron 壳替换成 Tauri 作为近期主线。CodeInsights 的核心价值在 Electron 桌面壳、React / Jotai 工作台、TypeScript shared 契约、Agent SDK / Codex / opencode 运行时适配、IPC 安全边界和本地 JSON / JSONL 事实源。大块迁移会破坏这些已经稳定的产品和工程边界。

最值得优化的是“本地原生能力层”：

- **Rust 优先**：跨会话 JSONL 搜索索引、workspace 文件索引、大文件 / 日志分片读取、路径安全校验、Git diff / porcelain 解析、代码结构索引。
- **Go 谨慎引入**：长期运行的 sidecar supervisor、文件 watcher 聚合、运行时进程树管理、未来企业版 bridge / gateway。Go 不适合做 N-API，也不应接手现有 renderer 或 IPC 合约。
- **继续 TypeScript**：React renderer、Jotai atoms、preload API、IPC 常量、Agent / Pipeline 业务编排、Provider 适配器、飞书 / 钉钉 / 微信 Bridge、渠道和 safeStorage。

推荐路线是在 `apps/electron/src/main/lib` 后面新增可替换的 `NativeRuntimeAdapter`，所有 native 能力只服务主进程，renderer 仍通过现有 `window.electronAPI` 和 Jotai 消费结构化结果。第一阶段先做 TS fallback + benchmark，再用 Rust sidecar / CLI 接手搜索与索引。只有真实性能数据证明短调用成为瓶颈时，才考虑 Rust N-API。

## 工程目标与不变量

### 优化目标

| 目标 | 具体含义 | 衡量方式 |
| --- | --- | --- |
| 主进程不卡顿 | 搜索、tail、大文件预览和 workspace scan 不应长时间占用 Electron main thread | IPC 响应 P95、event loop delay、用户输入无明显卡顿 |
| 本地事实源不变 | JSON 配置和 JSONL 仍是唯一可审计事实源 | 删除 native cache 后应用可完整恢复 |
| 运行时可替换 | TS fallback、Rust sidecar、Rust N-API、Go sidecar 可在同一接口下切换 | contract test 同 fixture 输出一致 |
| 失败可降级 | native 缺失、崩溃、版本不兼容时不阻断 Agent / Pipeline 主流程 | diagnostics 显示 fallback，核心 UI 可继续使用 |
| 安全边界不后退 | native 层不能绕开 path safety、权限、gate、脱敏和远端写确认 | security fixtures 同时覆盖 TS 和 native |
| 打包可维护 | 新 binary 不破坏现有 Claude / Codex / opencode 打包链路 | packaged smoke 验证 bundled binary 来源 |

### 强制不变量

1. `packages/shared` 继续是跨进程、跨语言契约源；Rust / Go 只能消费生成出的 schema / fixture。
2. Renderer 只能通过 preload 暴露的 API 调用主进程，不能知道 native binary 的真实路径。
3. native cache 只能写入 `~/.codeinsights/native-cache/`，不能写入会话事实源目录。
4. 任意 native 结果进入业务流程前，必须经过 main process 的二次校验和脱敏。
5. 所有远端写、Git commit、PR 创建仍由现有 Pipeline gate 和 submission service 控制。
6. 任何 native 组件新增都必须提供 `disabled / missing / incompatible / crashed / fallback` 五类诊断状态。

### 成功标准

第一轮 MVP 不以“Rust 代码存在”为成功标准，而以下列结果为准：

- 搜索与 records tail 先通过 TS fallback 完成接口收敛。
- 有可重复 benchmark 证明当前瓶颈和 native 后的收益。
- native 失败路径可验证，且不会扩大用户数据暴露面。
- packaged app 可以明确显示 native binary 来源，而不是隐式使用系统 PATH。

## 当前实现事实

### 架构基线

| 层 | 当前事实 | 对 Rust / Go 的判断 |
| --- | --- | --- |
| Monorepo | Bun workspace，`packages/shared`、`packages/core`、`packages/ui`、`apps/electron` | 保持 TS 包结构，不为 native 改 workspace 主形态。 |
| Renderer | React 18 + Jotai，`main.tsx` 顶层挂载 Agent / Pipeline 全局监听 | 不迁移。Rust / Go 不能改善 React diff、布局、可访问性和组件状态设计。 |
| Preload / IPC | `preload/index.ts` 暴露显式 `ElectronAPI`，主进程注册大量 `ipcMain.handle` | 不迁移。新增 native 能力也必须先经过 shared 类型和 preload 白名单。 |
| 主进程服务 | `main/lib` 承担 Agent、Pipeline、Bridge、文件、runtime、存储、打包辅助 | 只抽离可测的 IO / CPU / 安全 helper，不迁移业务编排。 |
| 本地存储 | JSON 配置 + JSONL 追加日志，无本地数据库 | 事实源继续是 JSON / JSONL；native 索引只能是可重建缓存。 |
| Runtime | Claude Agent SDK、Codex SDK / CLI、opencode server 都在 TS 适配层 | 保留 TS 适配和 shared 事件契约；native 可做 supervisor。 |
| 打包 | `electron-builder.yml` 已显式打入 Claude / Codex / opencode 平台 binary，`asar: false` | 可复用 optional platform package 模式，但会增加 CI / 签名 / smoke 成本。 |

### 代码热点

| 热点 | 关键路径 | 观察 |
| --- | --- | --- |
| JSONL 全量读取 | `apps/electron/src/main/lib/pipeline-session-manager.ts`、`agent-session-manager.ts`、`conversation-manager.ts` | 多处 `readFileSync + split + JSON.parse`，历史增长后会拖慢 tail、搜索和恢复。 |
| 搜索 | `jsonl-search.ts`、`SearchDialog.tsx`、Agent / Chat 搜索 IPC | 目前偏逐文件扫描，适合先做增量索引和可取消查询。 |
| Workspace 文件搜索 | `agent-handlers.ts`、`agent-host-mcp-server.ts` | `readdirSync` 递归扫描适合缓存 + watcher；大仓库可由 Rust / Go sidecar 接手。 |
| Pipeline records | `getPipelineRecordsTail()` 当前先全量读取再 slice | 需要 byte offset cursor / index，而不是每次重新解析整份 JSONL。 |
| Patch-work 安全 | `pipeline-patch-work-service.ts` | 路径、symlink、realpath 防护已经认真，但安全逻辑值得集中和 fuzz。 |
| Git / preflight | `pipeline-preflight-service.ts`、`pipeline-git-submission-service.ts` | `git status`、diff、remote URL 脱敏、提交前校验适合统一解析与 fixture 测试。 |
| 文件预览 | `file-preview-service.ts`、`document-parser.ts` | 50MB 限制、同步读、文档解析和预览窗口耦合；先做分片 / 本地资源，再考虑 native。 |
| Runtime lifecycle | `agent-runtime-runner.ts`、`codex-runtime/`、`opencode-runtime/` | Go sidecar 可选，但当前 TS 已能表达 SDK async iterator 和事件契约。 |

### 现有调用链与 native 插入点

```text
SearchDialog / PipelineRecords / FileBrowser
  -> window.electronAPI
  -> ipc handlers
  -> main/lib service
  -> current TS implementation
```

未来只能在 `main/lib service -> current TS implementation` 这一段后面插入 native adapter：

```text
main/lib service
  -> NativeRuntimeAdapter
       -> TS fallback
       -> Rust / Go implementation
```

不建议把 native 插到以下位置：

- Renderer 与 preload 之间：会破坏上下文隔离与 UI 状态边界。
- IPC handler 之前：会让安全校验前移到不可控层。
- `packages/shared` 之前：会造成类型源头分裂。
- Agent / Pipeline SDK iterator 内部：会让权限、重试、终态和审计记录难以保持一致。

### 当前可直接复用的模式

| 现有模式 | 可复用点 | native 方案中的用法 |
| --- | --- | --- |
| `opencode-server-manager.ts` | 本地 service lifecycle、health check、endpoint auth | Rust / Go sidecar manager 的直接参考。 |
| `pipeline-stream-bus.ts` | 主进程向 renderer 广播状态 | native indexing progress 可复用同类事件模型。 |
| `safe-file.ts` | 原子写、`.tmp` / `.bak` 恢复 | native diagnostics / cache manifest 可复用策略。 |
| `pipeline-preflight-service.ts` | runtime 可用性检查与 fingerprint | NativeRuntime diagnostics 可复用 fingerprint 思路。 |
| `pipeline-patch-work-service.ts` | realpath / symlink 防护 | Path safety helper 的 fixture 来源。 |
| `agent-runtime-event-log.ts` | envelope、sequence、terminal 去重 | native sidecar 事件也应具备 sequence 和 schemaVersion。 |

## 语言选择规则

| 场景 | 首选 | 原因 |
| --- | --- | --- |
| 高性能文本扫描、索引、路径安全、diff 解析 | Rust | 内存安全、适合 mmap / regex / Tantivy / tree-sitter，二进制小，适合 CLI / sidecar / N-API。 |
| 长期运行的本地服务、watcher 聚合、进程 supervisor | Go | 并发模型直接，跨平台单 binary 维护成本可控，适合 HTTP / JSON-RPC sidecar。 |
| Electron UI、Jotai 状态、IPC 合约、业务流程、SDK 适配 | TypeScript | 与现有工程、shared 类型、Electron API、第三方 Node SDK 完全贴合。 |
| 权限策略、规则判断、插件沙箱 | WASM / Rust 可选 | 适合确定性纯函数，不适合文件系统写入、Git 操作或 Agent 执行。 |
| N-API 短调用 | Rust 有条件 | 只在 benchmark 证明进程启动 / sidecar hop 成本不可接受时使用。 |
| Go N-API | 不建议 | cgo / runtime 边界重，生态和维护性不如 Rust N-API。 |
| Tauri 替换 Electron | 近期不建议 | 需要重写 IPC、preload、自动更新、safeStorage、窗口、PDF、托盘和 runtime 打包，收益不足以覆盖风险。 |

### 决策矩阵

| 问题 | 继续 TS | Rust sidecar / CLI | Rust N-API | Go sidecar |
| --- | --- | --- | --- | --- |
| 是否需要访问 Electron API | 是 | 否 | 否 | 否 |
| 是否是短时间纯计算 | 可 | 可 | 最适合 | 不优先 |
| 是否是长任务 / watcher / service | 勉强 | 可 | 不适合 | 最适合 |
| 是否需要 stream progress | 可 | 可 | 不优先 | 可 |
| 是否需要最小打包风险 | 最适合 | 中 | 高 | 中 |
| 是否必须跨平台稳定 | 可 | 可，但需 CI | 高成本 | 可 |
| 是否依赖 Node / Electron SDK | 最适合 | 不适合 | 不适合 | 不适合 |

决策规则：

- 先用 TS 抽象接口和 benchmark 证明问题。
- 如果瓶颈是读取 / 搜索 / 解析大量本地文本，优先 Rust sidecar。
- 如果瓶颈是长期运行和进程生命周期，优先 Go sidecar。
- 如果瓶颈是高频、短小、纯计算，并且 sidecar hop 成本明显，才考虑 Rust N-API。
- 如果无法提供 TS fallback，不进入实现。

## 目标架构

```text
Renderer React / Jotai
  -> preload ElectronAPI
  -> Electron IPC handlers
  -> main/lib TypeScript services
       -> NativeRuntimeAdapter
            -> TypeScript fallback
            -> Rust local CLI / sidecar service
            -> optional Rust N-API for proven hot paths
            -> optional Go sidecar for long-running supervisor
            -> optional WASM policy module
```

关键原则：

1. Renderer 不直接感知 Rust / Go；所有调用仍经过 `window.electronAPI`。
2. `packages/shared` 继续作为契约源，native 层只消费 JSON schema / fixture，不反向定义业务类型。
3. native 索引是派生缓存，必须可删除、可重建、可降级到 TS fallback。
4. native 层不能绕开权限、gate、审计记录、脱敏和远端写确认。
5. 所有 native 能力默认 feature flag，可在启动诊断中展示可用性。

### 模块分层细节

```text
packages/shared
  src/types/native-runtime.ts        # DTO / IPC contract
  src/constants/native-runtime.ts    # IPC channel constants

apps/electron/src/main/ipc
  native-runtime-handlers.ts         # diagnostics / rebuild / search / chunk read

apps/electron/src/main/lib/native-runtime
  native-runtime-types.ts            # main 内部接口
  native-runtime-service.ts          # facade，供其他 service 调用
  native-runtime-diagnostics.ts      # version / capability / fallback reason
  native-runtime-cache.ts            # cache path / manifest / cleanup
  native-runtime-sidecar-manager.ts  # spawn / health / stop
  ts-event-search-service.ts         # TS fallback
  ts-file-index-service.ts           # TS fallback

apps/electron/src/renderer/atoms
  native-runtime-atoms.ts            # UI state only

apps/electron/src/renderer/components/settings
  NativeRuntimeDiagnostics.tsx       # 状态与重建入口
```

主进程内部 facade 应保持稳定：

```ts
interface NativeRuntimeService {
  getStatus(): Promise<NativeRuntimeStatus>
  search(input: IndexedSearchInput, signal?: AbortSignal): Promise<IndexedSearchResult>
  tailJsonl(input: JsonlTailInput, signal?: AbortSignal): Promise<JsonlTailResult>
  indexWorkspace(input: WorkspaceIndexInput, signal?: AbortSignal): Promise<WorkspaceIndexResult>
  readFileChunk(input: FileChunkReadInput, signal?: AbortSignal): Promise<FileChunkReadResult>
  validatePath(input: PathSafetyInput): Promise<PathSafetyResult>
}
```

实现约束：

- service 实例由 main process 单例管理，避免重复启动 sidecar。
- 所有方法接受 `AbortSignal`，取消时要清理 pending request。
- 所有结果都带 `implementation` 字段，便于 UI 和测试确认走的是 fallback 还是 native。
- 所有错误都规范成 typed error，不把 native stderr 原样返回 renderer。

## 候选组件评估

| 优先级 | 组件 | 建议实现 | 值得程度 | 预期收益 | 主要风险 |
| --- | --- | --- | --- | --- | --- |
| P0 | JSONL event store / search index | Rust sidecar / CLI + TS fallback | 高 | 全局搜索、records tail、Agent history reload 从反复 O(n) 扫描变为增量索引。 | 索引契约漂移、缓存损坏恢复、打包 binary。 |
| P0 | Workspace 文件索引 | Rust sidecar 或 Go watcher service | 高 | 大仓库文件搜索、`@file` 补全、MCP workspace search 更稳定。 | watcher 风暴、忽略规则、symlink / 权限边界。 |
| P1 | Pipeline record byte-offset tail | TS 先抽象，Rust 可接手 offset index | 高 | running Pipeline 的记录加载不再全量解析 JSONL。 | 旧 JSONL 兼容、坏行容错、cursor 版本。 |
| P1 | 大文件 / 日志分片预览 | Rust CLI / sidecar | 中高 | 解除 50MB 预览上限，支持日志搜索、跳转、minimap。 | 编码探测、二进制文件识别、UI 虚拟滚动配套。 |
| P1 | Patch-work path safety | Rust 纯函数库或 CLI | 中 | 集中 symlink / realpath / reserved path 校验，便于 fuzz。 | 跨平台 path 语义、与现有 TS 校验双写。 |
| P1 | Git diff / porcelain parser | Rust CLI | 中 | 提交计划、preflight、changed files 解析更稳，减少 ad hoc 字符串处理。 | 仍要调用 git；业务 gate 必须留 TS。 |
| P2 | Code structure index | Rust + tree-sitter | 中 | 新增符号搜索、依赖图、贡献点分析、改动影响面。 | 多语言 grammar 维护、索引体积、首次扫描耗时。 |
| P2 | Runtime supervisor | Go sidecar | 中 | 管理 Codex / opencode / bridge 长任务、端口、进程树、健康检查。 | 生命周期复杂、日志脱敏、与现有 TS runner 重叠。 |
| P3 | Permission policy engine | WASM / Rust | 低中 | 权限规则可沙箱执行，未来支持可配置 policy。 | 当前规则量不大，先保持 TS 更简单。 |
| 不建议 | Renderer / Jotai / preload / IPC constants | 继续 TS | 不值得 | 无性能收益。 | 会显著增加维护成本。 |
| 不建议 | Provider / IM Bridge / safeStorage | 继续 TS | 不值得 | 主要是网络 I/O 和 Electron / Node SDK。 | native 会破坏 SDK 生态和凭证边界。 |
| 不建议 | Tauri 全量替换 | 暂缓独立 spike | 不值得作为主线 | 可能减小包体，但当前仍需打包多 runtime binary。 | 功能对等和跨平台验证成本极高。 |

## 后端优化方案

### 1. NativeRuntimeAdapter

新增主进程内部适配层，建议路径：

```text
apps/electron/src/main/lib/native-runtime/
  native-runtime-types.ts
  native-runtime-adapter.ts
  native-runtime-diagnostics.ts
  ts-fallback-search-index.ts
  sidecar-manager.ts
```

职责：

- 探测 bundled native binary 是否可用。
- 暴露统一接口：`search()`、`tailJsonl()`、`indexWorkspace()`、`readFileChunk()`、`validatePath()`。
- 失败时自动回退 TS 实现，并记录诊断事件。
- 不直接写业务 JSON / JSONL；只写可重建 cache。

建议缓存目录：

```text
~/.codeinsights/
  native-cache/
    search-index/
    workspace-index/
    file-preview/
    diagnostics.json
```

这些目录是派生缓存，不是本地数据库；删除后必须能从 JSON / JSONL 和工作区文件重建。

#### 适配器选择流程

```text
load config
  -> check feature flag
  -> resolve bundled binary
  -> check protocol version
  -> health check
  -> warm cache if needed
  -> expose implementation = native
  -> otherwise expose implementation = typescript fallback
```

fallback 原因应使用枚举，而不是自由文本：

```ts
type NativeFallbackReason =
  | 'disabled'
  | 'binary_missing'
  | 'binary_not_executable'
  | 'protocol_mismatch'
  | 'health_timeout'
  | 'startup_failed'
  | 'runtime_crashed'
  | 'contract_error'
```

#### sidecar transport

第一版建议使用 `stdio JSON-RPC`，原因是：

- 不暴露端口，减少本地攻击面。
- 打包和权限模型比 HTTP service 简单。
- 请求 / 响应 / progress event 都可以按 line-delimited JSON 表达。

只有当需要多 renderer / 多进程共享同一索引服务、长时间 watcher 或浏览器式 dashboard 时，再考虑 `127.0.0.1 + random auth`。

JSON-RPC envelope 建议：

```json
{"jsonrpc":"2.0","id":"req-1","method":"search","params":{"query":"gate","limit":20}}
{"jsonrpc":"2.0","id":"req-1","result":{"matches":[],"hasMore":false}}
{"jsonrpc":"2.0","method":"progress","params":{"operationId":"index-1","phase":"scanning","completed":100,"total":1000}}
```

错误 envelope：

```json
{
  "jsonrpc": "2.0",
  "id": "req-1",
  "error": {
    "code": "INDEX_CORRUPTED",
    "message": "索引损坏，已请求重建",
    "retryable": true
  }
}
```

stderr 只用于诊断日志，不能作为协议数据；写入日志前必须脱敏。

#### sidecar 生命周期

| 状态 | 进入条件 | 退出条件 | UI 展示 |
| --- | --- | --- | --- |
| `disabled` | 用户关闭 native 或环境变量关闭 | 用户重新启用 | 不提示，仅显示 fallback。 |
| `starting` | 首次调用需要 native 能力 | health 通过或超时 | 设置页显示启动中。 |
| `ready` | protocol / health / version 均通过 | crash / idle timeout / app quit | 可显示 native active。 |
| `degraded` | native 不可用但 fallback 可用 | 重试成功或用户清理 cache | 主界面轻提示，设置页详细说明。 |
| `failed` | native 和 fallback 都不可用 | 用户修复或重启 | 相关功能显示错误态。 |
| `stopping` | app quit / idle timeout / manual restart | process exit | 设置页显示正在停止。 |

#### cache manifest

每个 cache 子目录都要有 manifest：

```json
{
  "schemaVersion": 1,
  "implementation": "rust-sidecar",
  "protocolVersion": 1,
  "source": {
    "kind": "jsonl",
    "root": "/Users/.../.codeinsights/agent-sessions",
    "fingerprint": "sha256..."
  },
  "createdAt": 1760000000000,
  "updatedAt": 1760000000000
}
```

manifest 损坏时直接隔离到 `native-cache/corrupted/`，不要尝试局部修复索引文件。

### 2. JSONL 搜索与 tail

当前问题：

- Chat / Agent / Pipeline 都使用 JSONL，但读取模式不一致。
- 搜索和 tail 常常重新解析整份文件。
- 全局搜索没有统一 cancellation / generation，快速输入可能造成旧查询晚返回。

建议：

- 抽象 `EventStore`：
  - `append(sessionId, event)`
  - `tail(sessionId, cursor, limit)`
  - `search(query, scope, limit, cursor)`
  - `rebuildIndex(scope)`
- cursor 使用 `{ fileId, byteOffset, lineNumber, schemaVersion }`。
- index 每条记录保留最小字段：session id、record id、createdAt、kind、stage、title、snippet source offset。
- 坏行跳过但写 diagnostics，保持现有 JSONL 容错。
- 第一版使用 TS fallback 建立同一接口，Rust 只替换实现。

Rust 适合的实现：

- 流式读取 JSONL。
- byte offset index。
- lowercase / token index。
- 可选 Tantivy 全文索引。
- mmap 大文件扫描。

#### EventStore 数据模型

```ts
interface EventStoreSource {
  sourceId: string
  kind: 'chat' | 'agent' | 'agent-runtime' | 'pipeline' | 'patch-work'
  sessionId?: string
  workspaceId?: string
  filePath: string
  schemaVersion: number
  updatedAt: number
}

interface EventStoreIndexedRecord {
  sourceId: string
  recordId: string
  offset: number
  lineNumber: number
  createdAt?: number
  title: string
  stage?: string
  tab?: 'logs' | 'artifacts' | 'messages' | 'files'
  textHash: string
}
```

索引不保存完整消息正文，正文 snippet 从源 JSONL 或 patch-work 文件按 offset 读取生成，减少缓存中的敏感内容驻留。

#### cursor 设计

cursor 建议使用 base64url JSON：

```json
{
  "schemaVersion": 1,
  "sourceId": "pipeline:session-id",
  "byteOffset": 123456,
  "lineNumber": 420,
  "recordId": "record-id",
  "createdAt": 1760000000000
}
```

规则：

- cursor 不可信，main process 必须校验 source 和 session 权限。
- 文件变短或 hash 改变时 cursor 失效，返回 `cursor_invalid` 并回退到最近安全位置。
- tail 读取必须限制最大 records 和最大 bytes，防止一次 IPC 传输过大。

#### append 与索引一致性

保持 JSONL append 路径在现有 TS service 中：

1. TS service 先 append JSONL。
2. append 成功后通知 `EventSearchService.onAppend(source, offset?)`。
3. native index 异步更新；失败只标记 index stale，不回滚 JSONL。
4. 搜索时若 index stale，可先返回旧索引结果并附带 `indexState: 'stale'`，再触发后台重建。

#### 兼容旧数据

- 对坏行：跳过、计数、写 diagnostics，不中断整个索引。
- 对旧 AgentMessage / SDKMessage 混合格式：沿用 `agent-session-manager.ts` 当前兼容转换规则。
- 对 Pipeline v1 / v2：索引 stage 必须根据 record 自身字段判断，不假设固定节点数。
- 对 archived / pinned：索引可记录状态快照，但列表排序仍以主 JSON index 为准。

#### 性能基线 fixture

建议新增可生成 fixture 的脚本：

```text
apps/electron/scripts/fixtures/generate-jsonl-fixture.ts
```

规模：

- Chat：1000 会话，每会话 200 条消息。
- Agent：200 会话，每会话 500 条 SDKMessage + runtime envelopes。
- Pipeline：50 会话，每会话 5000 条 records，包含 stage artifacts。
- Patch-work：每会话 20 个 revision 文档。

benchmark 输出：

```json
{
  "case": "pipeline-tail-5000-records",
  "implementation": "typescript",
  "p50Ms": 12,
  "p95Ms": 45,
  "p99Ms": 80,
  "maxRssMb": 180
}
```

### 3. Workspace 文件索引

当前问题：

- 文件搜索和 host MCP workspace search 以同步递归为主。
- 大仓库、node_modules、构建产物、附加目录容易导致 UI 等待。

建议：

- 统一 ignore 规则：`.git`、`node_modules`、构建产物、二进制文件、超大文件。
- watcher 只产生 invalidation，不直接触发全量扫描。
- indexing 状态通过 IPC 推给设置页 / Agent side panel。
- 支持查询模式：
  - 文件名模糊搜索。
  - 内容片段搜索。
  - 最近修改文件。
  - symbol 搜索（后续 tree-sitter）。

Rust / Go 分工：

- Rust：高性能 walk / regex / text extraction / symbol index。
- Go：长期 watcher 聚合、批处理队列、进程 supervisor。

#### ignore 规则

第一版不需要完整复刻 ripgrep，但必须覆盖：

```text
.git/
node_modules/
dist/
build/
out/
coverage/
.next/
.turbo/
.cache/
target/
vendor/
*.png / *.jpg / *.mp4 / *.zip / *.dmg / *.exe
```

增强版再考虑读取 `.gitignore`、`.ignore`、`.codeinsightsignore`。如果引入 `.codeinsightsignore`，它只影响索引，不影响 Agent 真实工具权限。

#### WorkspaceIndex 数据模型

```ts
interface WorkspaceIndexedFile {
  workspaceId: string
  rootId: string
  relativePath: string
  realPathHash: string
  sizeBytes: number
  mtimeMs: number
  language?: string
  binary: boolean
  indexedContent: boolean
  symbols?: WorkspaceSymbolRef[]
}

interface WorkspaceSymbolRef {
  name: string
  kind: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'export'
  line: number
  column?: number
}
```

索引里避免保存绝对路径明文，UI 展示时由 main process 重新映射到当前 workspace root。

#### 索引流程

```text
discover roots
  -> apply ignore rules
  -> stat and classify files
  -> index filenames
  -> index text snippets under size limit
  -> optional symbol extraction
  -> write manifest and ready state
```

大文件策略：

- `<= 1MB`：可索引全文。
- `1MB - 20MB`：只索引前后若干窗口和文件名。
- `> 20MB`：默认只索引文件名和 metadata，预览时走 chunk reader。
- 二进制：只索引文件名和 metadata。

#### watcher 策略

- watcher 事件只写入 debounce queue。
- 500ms 内合并同一路径多次变化。
- 删除事件标记 tombstone，而不是立即重建全库。
- 大量事件超过阈值时触发 full rescan，并在 UI 显示 `reindexing`。
- 附加目录必须单独 rootId，避免跨 workspace 混淆。

### 4. Patch-work 与 Git 安全 helper

当前 patch-work 服务已经有较完整的 symlink 和 realpath 防护，建议不是重写，而是集中安全边界：

- 把路径规范化、reserved path、realpath containment、manifest safety 作为纯函数接口。
- 用 fixture 覆盖 macOS / Windows path、UNC、drive letter、大小写、symlink、hardlink、坏 manifest。
- Git 输出解析从业务服务中剥离：
  - `git status --porcelain`
  - `git diff --numstat`
  - remote URL 脱敏
  - branch / upstream / detached HEAD

Rust helper 的价值是正确性和 fuzz，而不是单纯速度。真实 `git commit`、`git push`、PR 创建仍必须留在 TS `pipeline-git-submission-service.ts`，因为那里承载人工 gate、operation id、审计记录和脱敏。

#### PathSafety 规格

```ts
interface PathSafetyInput {
  root: string
  relativePath: string
  mode: 'read' | 'write' | 'manifest' | 'preview'
  allowCreateParent?: boolean
  reservedPaths: string[]
}

interface PathSafetyResult {
  ok: boolean
  normalizedRelativePath?: string
  realRoot?: string
  realTarget?: string
  reason?: 'absolute_path' | 'parent_escape' | 'symlink_escape' | 'reserved_path' | 'not_found' | 'not_file'
}
```

校验顺序：

1. 词法规范化，拒绝绝对路径、空路径、`..`。
2. 校验 reserved paths。
3. 逐级 `lstat`，拒绝 symlink 和非目录父级。
4. 对存在路径执行 `realpath` containment。
5. write 模式创建父目录前再次校验父级真实路径。

#### GitOutputParser 规格

```ts
interface GitStatusEntry {
  path: string
  originalPath?: string
  indexStatus: string
  worktreeStatus: string
  conflicted: boolean
}

interface GitDiffStatEntry {
  path: string
  additions: number
  deletions: number
  binary: boolean
}
```

解析器只解析输出，不执行 git。执行 git 的职责仍在 TS service 中，便于继续注入 timeout、env 和脱敏。

必须覆盖的 Git case：

- rename / copy。
- binary diff。
- 文件名含空格、tab、中文、引号。
- conflict status：`UU`、`AA`、`DD`、`AU`、`UA`。
- detached HEAD。
- remote URL 包含 username、token、query secret、hash secret。

### 5. Runtime supervisor

近期不建议把 Agent / Pipeline runner 整体迁移。可选 Go sidecar 只处理更底层的生命周期：

- spawn / stop / kill process tree。
- health check 和端口占用。
- stdout / stderr 日志脱敏。
- idle timeout。
- 崩溃重启策略。

保留在 TS 的内容：

- Claude / Codex / opencode SDK 事件适配。
- permission / AskUser / ExitPlanMode。
- Agent runtime envelope。
- Pipeline gate / checkpoint / contribution task。

#### Go sidecar 触发门槛

只有满足任意两项时才进入 Go supervisor：

- opencode / Codex / bridge 进程泄漏在真实用户环境中反复出现。
- Windows 进程树中止策略需要长期维护和实机验证。
- 需要同时管理多个长期本地 service，并做统一 health / idle / restart。
- 未来企业版需要远程触发队列、bridge gateway 或多租户桌面代理。

#### Supervisor 协议

```ts
interface SupervisorRunInput {
  operationId: string
  command: string
  args: string[]
  cwd: string
  env: Record<string, string>
  timeoutMs?: number
  killTree: boolean
  redactPatterns: string[]
}

interface SupervisorEvent {
  operationId: string
  sequence: number
  type: 'started' | 'stdout' | 'stderr' | 'heartbeat' | 'exited' | 'killed' | 'failed'
  data?: string
  exitCode?: number
}
```

Supervisor 不理解 Agent / Pipeline 业务语义，只提供进程生命周期事件。

### 6. Observability 与诊断

新增 native 组件后，必须能回答四个问题：

1. 当前走的是 TS fallback 还是 native？
2. native binary 来自哪里，版本是什么？
3. 最近一次 fallback / crash / protocol mismatch 原因是什么？
4. cache 是否健康，能否重建？

建议 diagnostics 文件：

```text
~/.codeinsights/native-cache/diagnostics.json
```

字段：

```ts
interface NativeRuntimeDiagnostics {
  schemaVersion: 1
  implementation: NativeRuntimeStatus['implementation']
  protocolVersion: number
  binaryPath?: string
  binaryVersion?: string
  cacheRoot: string
  lastHealthCheckAt?: number
  lastError?: {
    code: string
    message: string
    occurredAt: number
    retryable: boolean
  }
  counters: {
    fallbackCount: number
    crashCount: number
    indexRebuildCount: number
  }
}
```

日志规则：

- 默认只写摘要，不写 prompt、完整文件内容、API key、token、remote credential URL。
- 路径可在本机 diagnostics 中展示，但复制给用户的诊断信息应支持一键脱敏。
- crash dump 不默认上传；这是开源本地优先项目，不做隐式遥测。

## 前端优化方案

### 保持前端技术边界

Renderer、Jotai、组件和 UI 状态不迁移到 Rust / Go。前端改造重点是让 native 能力的结果可见、可取消、可诊断：

- 统一搜索状态：idle / indexing / searching / stale / error。
- 统一后台任务 indicator：索引中、索引失败、fallback 中。
- 对流式事件做 microtask 或 `requestAnimationFrame` 批处理，减少 Jotai 高频写入导致的渲染压力。
- 对 Records / Message list / File preview 做虚拟列表和分片加载。

### 需要新增的前端入口

| 入口 | 位置建议 | 功能 |
| --- | --- | --- |
| Native Runtime Diagnostics | Settings / About 或 Agent Settings | 展示 native sidecar 可用性、版本、路径、fallback 原因。 |
| Search Center v2 | `SearchDialog` 升级 | 支持 Chat / Agent / Pipeline / workspace / patch-work 同一个查询。 |
| Indexing Status | 左侧 sidebar / 设置页 | 展示 workspace 索引进度、最近失败和重建按钮。 |
| Big File Viewer | 文件预览窗口 | 分片读取、跳转行号、局部搜索、只读模式。 |
| Code Intelligence Panel | Agent 右侧 SidePanel | symbol 搜索、相关文件、依赖图、最近改动。 |
| Pipeline Evidence Search | Pipeline Records | 按 stage、artifact、test evidence、commit plan 搜索。 |

### Jotai 状态建议

新增 atoms 只保存 UI 状态，不保存 native 内部索引：

```ts
nativeRuntimeStatusAtom
workspaceIndexStateAtom
globalSearchStateAtom
filePreviewChunkStateAtom
pipelineRecordCursorAtom
```

所有事实数据仍由 main process 返回，不在 renderer 复制索引。

### IPC 与 UI 状态流

```text
Native sidecar progress
  -> main native-runtime-service
  -> IPC native-runtime:progress
  -> useGlobalNativeRuntimeListeners
  -> nativeRuntimeStatusAtom / workspaceIndexStateAtom
  -> SearchDialog / Settings / SidePanel
```

建议新增全局 listener，而不是让每个组件自己订阅：

```text
apps/electron/src/renderer/hooks/useGlobalNativeRuntimeListeners.ts
```

它只负责写入 atoms：

- `nativeRuntimeStatusAtom`
- `nativeRuntimeOperationMapAtom`
- `workspaceIndexStateMapAtom`
- `nativeRuntimeErrorsAtom`

### 搜索 UI 状态机

| 状态 | 条件 | 展示 |
| --- | --- | --- |
| `idle` | query 为空 | 展示最近会话 / 最近文件，可选。 |
| `typing` | IME composition 或 debounce 未提交 | 不触发搜索，保留旧结果淡化。 |
| `searching` | 当前 query 有 pending request | 结果列表保留 skeleton 或 spinner。 |
| `partial` | 标题 / cache 结果已返回，全文仍在搜索 | 显示分组结果和“仍在检索”。 |
| `stale` | index stale 但有旧结果 | 显示旧结果，提供后台重建状态。 |
| `fallback` | native 不可用 | 正常展示结果，设置页显示 fallback 原因。 |
| `error` | native 和 fallback 都失败 | 显示可恢复错误和重试入口。 |

关键实现：

- 每次 search 生成 `requestId`，旧 request 返回时丢弃。
- title search 仍可在 renderer 内即时完成。
- content / workspace / patch-work search 必须走 main process。
- 结果行高度稳定，长路径截断，避免输入时列表跳动。

### 大文件预览 UI

大文件预览不要复用当前“整文件读入”模型。建议拆分：

```text
FilePreviewWindow
  -> FileChunkProvider
  -> VirtualTextViewer
  -> ChunkSearchBar
  -> EncodingStatus
```

主进程接口：

- `getFilePreviewMetadata(filePath)`：大小、编码、是否二进制、line count 估计。
- `readFileChunk({ offset, length })`：读取 byte range。
- `searchFileChunked({ query, limit, cursor })`：大文件搜索。

UI 行为：

- 超大文件默认只读。
- 行号按 chunk 估算，搜索命中后再精确定位。
- 保存功能只对小文本文件开放；大文件不支持直接编辑，避免内存和截断风险。

### 设置页诊断设计

`NativeRuntimeDiagnostics` 不应成为普通用户的高频入口，建议放在：

- `Settings -> About` 的“运行诊断”区域；或
- `Settings -> Agent` 的“本地加速能力”折叠区。

展示项：

- 当前实现：TypeScript fallback / Rust sidecar / Rust N-API / Go sidecar。
- binary path：本机显示完整路径，复制诊断时脱敏 home 目录。
- protocol version：当前 / 期望。
- cache 状态：ready / building / stale / corrupted。
- 操作按钮：重启 native service、重建索引、清理 native cache、复制诊断。

按钮约束：

- “清理 native cache”只删除 `native-cache/`，不能触碰 JSONL、settings、channels、workspace 文件。
- “重建索引”应显示后台任务进度，不能阻塞设置页。
- 所有危险操作需要二次确认，但不需要用户输入路径。

## 可新增功能实现

### 1. 全局本地搜索中心

目标：让用户从一个入口搜索会话标题、Chat 消息、Agent runtime events、Pipeline records、patch-work 文档和当前 workspace 文件。

能力：

- 搜索结果按 `Pipeline / Agent / Chat / Files / Patch-work` 分组。
- 结果带来源、时间、stage、workspace、snippet、可跳转目标。
- 支持索引未就绪时 fallback 到当前 TS 扫描。
- 支持取消旧查询，避免输入过程中旧结果覆盖新结果。

MVP 范围：

- 标题搜索仍在 renderer 内完成。
- Chat / Agent / Pipeline 内容搜索走统一 main service。
- Workspace 文件名搜索接入同一结果列表。
- patch-work 文档搜索先只搜当前 Pipeline 会话。

增强项：

- 全文索引增量更新。
- symbol 搜索。
- 结果收藏 / 最近搜索。
- 搜索结果跳转到具体 record / message / file line。

BDD：

```gherkin
Given 用户已有大量 Agent 会话、Pipeline records 和 workspace 文件
When 用户在全局搜索输入关键词
Then 搜索结果应在 300ms 内先返回标题和已索引结果
And 后续增量结果不应阻塞输入
And 用户打开结果时应跳到对应会话、记录或文件
```

### 2. Pipeline Evidence Index

目标：让 Pipeline 的每个阶段产物、测试证据、提交计划和 PR 草稿都可搜索、可定位、可导出。

能力：

- `stage_artifact`、`node_output`、`gate_decision` 建立独立索引字段。
- `patch-work/` 文档按 revision 建索引。
- 报告导出只读读取索引和 JSONL，不触发 Git live check。

索引字段：

- `sessionId`
- `pipelineVersion`
- `node`
- `recordType`
- `artifactKind`
- `revision`
- `accepted`
- `createdAt`
- `documentRef`
- `snippet`

验收重点：

- v1 / v2 旧会话都能搜索。
- `committer` 阶段不能遗漏。
- 报告导出仍以 JSONL / patch-work 事实源为准，索引只辅助定位。

BDD：

```gherkin
Given Pipeline 已生成 dev.md、review.md、test-evidence.json 和 commit.md
When 用户搜索某个测试命令或文件名
Then Records 应展示命中的阶段、artifact 类型和 snippet
And 点击结果应打开对应记录或 patch-work 文档
```

### 3. Workspace Code Intelligence

目标：为 Agent 和 Pipeline 提供本地代码结构上下文，减少盲扫文件。

能力：

- symbol 搜索：函数、类、接口、类型、导出项。
- 相关文件推荐：基于 import / path / 最近改动。
- 贡献点探索：Explorer 节点可读取索引摘要，而不是递归扫描整仓库。

实现建议：

- 第一版只做文件名和内容索引。
- 第二版引入 Rust + tree-sitter，按语言增量开启。
- 索引结果只作为提示上下文，不替代真实文件读取。

可落地能力：

- Agent composer 的 `@file` 补全从递归扫描切到索引。
- Explorer 阶段可以读取 “top relevant files” 摘要。
- SidePanel 可展示当前任务相关文件、最近修改、symbol 命中。
- Pipeline preflight 可提示仓库规模和索引状态，但不能因为索引缺失阻断运行。

约束：

- tree-sitter grammar 必须按语言懒加载。
- 索引不能把 `.env`、密钥文件、二进制和 ignored 文件正文写入 cache。
- 结果必须标注“索引建议”，Agent 真正读文件仍走原工具权限。

### 4. 大文件 / 日志预览器

目标：预览超过 50MB 的日志、patch、JSONL、输出文件，不阻塞主进程。

能力：

- 按 byte range / line range 分片读取。
- 局部搜索和跳转行号。
- 二进制文件自动拒绝或提示外部打开。
- 可从 Pipeline test evidence 和 Agent output file 直接打开。

MVP：

- 只读文本预览。
- 读取首个 chunk 和文件尾部 chunk。
- 支持 query 搜索前 N 个命中。
- 大文件中禁用保存按钮。

后续：

- JSONL pretty view。
- diff / patch 专用 viewer。
- test output 折叠。
- Agent tool output 直接定位到文件片段。

### 5. Native Runtime 诊断与自愈

目标：让用户知道 native sidecar 是否可用、为什么降级、如何重建索引。

能力：

- 显示 native binary 来源：bundled / missing / incompatible / fallback。
- 显示 sidecar 版本、协议版本、启动耗时、最近错误。
- 提供“重建索引”“清理 native cache”“复制诊断信息”。
- packaged smoke 确认不会误用系统 PATH 中的同名工具。

自愈策略：

- protocol mismatch：禁用 native，提示需要更新应用。
- cache corrupted：隔离 cache，后台重建。
- health timeout：kill sidecar，回退 TS，本次会话不再频繁重试。
- repeated crash：记录 crashCount，达到阈值后暂停 native。
- user reset：清理 cache 和 diagnostics counter，但不清理业务数据。

### 6. 本地贡献分析器

目标：利用 workspace index 和 Pipeline records，为开源贡献流程提供更具体的“影响面分析”。

能力：

- 根据用户任务匹配相关目录和关键文件。
- 根据 imports / symbols 找到可能受影响的测试文件。
- 在 Planner 阶段生成更可靠的验证建议。
- 在 Reviewer 阶段辅助发现未覆盖文件。

边界：

- 这只是辅助上下文，不替代模型推理和真实测试。
- 不自动修改代码。
- 不读取被 ignore 或被权限规则禁止的文件正文。

BDD：

```gherkin
Given workspace index 已完成
When 用户发起 Pipeline 任务 “修复 provider stream 解析”
Then Explorer 应能得到 provider 相关文件、测试文件和最近修改摘要
And Planner 的验证建议应包含相关测试入口
```

### 7. 本地隐私扫描

目标：在导出报告、复制诊断、展示 native logs 前做本地敏感信息扫描。

能力：

- 扫描 Authorization、Bearer、API key、credentialed URL、`.env` 片段。
- 对诊断包和报告导出复用同一套 redaction。
- 为 native stderr / stdout 提供统一 sanitize。

实现建议：

- 第一版 TS 实现，复用已有脱敏规则。
- Rust 只在处理超大日志时接手扫描。
- redaction 规则必须有 fixture，避免短 token 漏掉。

## 数据契约与 IPC 建议

新增 shared 类型时应放在 `packages/shared/src/types/`，并通过 IPC 常量暴露。建议只增加主进程内部所需的最小 DTO：

```ts
interface NativeRuntimeStatus {
  available: boolean
  implementation: 'typescript' | 'rust-sidecar' | 'rust-napi' | 'go-sidecar'
  version?: string
  protocolVersion: number
  binaryPath?: string
  fallbackReason?: string
}

interface IndexedSearchInput {
  query: string
  scope: Array<'chat' | 'agent' | 'pipeline' | 'workspace' | 'patch-work'>
  workspaceId?: string
  sessionId?: string
  limit: number
  cursor?: string
}

interface IndexedSearchResult {
  matches: IndexedSearchMatch[]
  cursor?: string
  hasMore: boolean
  indexState: 'ready' | 'building' | 'stale' | 'fallback'
}

interface FileChunkReadInput {
  filePath: string
  offset: number
  length: number
  encoding?: 'utf-8'
}
```

### 建议 IPC 通道

```ts
export const NATIVE_RUNTIME_IPC_CHANNELS = {
  GET_STATUS: 'native-runtime:get-status',
  RESTART: 'native-runtime:restart',
  CLEAR_CACHE: 'native-runtime:clear-cache',
  REBUILD_INDEX: 'native-runtime:rebuild-index',
  SEARCH: 'native-runtime:search',
  GET_OPERATION_STATE: 'native-runtime:get-operation-state',
  READ_FILE_CHUNK: 'native-runtime:read-file-chunk',
  GET_FILE_PREVIEW_METADATA: 'native-runtime:get-file-preview-metadata',
  ON_PROGRESS: 'native-runtime:on-progress',
  ON_STATUS_CHANGED: 'native-runtime:on-status-changed',
} as const
```

Renderer 暴露 API：

```ts
interface ElectronAPI {
  getNativeRuntimeStatus(): Promise<NativeRuntimeStatus>
  restartNativeRuntime(): Promise<NativeRuntimeStatus>
  clearNativeRuntimeCache(): Promise<NativeRuntimeStatus>
  rebuildNativeRuntimeIndex(input: NativeIndexRebuildInput): Promise<NativeOperationRef>
  searchIndexedContent(input: IndexedSearchInput): Promise<IndexedSearchResult>
  getFilePreviewMetadata(input: FilePreviewMetadataInput): Promise<FilePreviewMetadata>
  readFileChunk(input: FileChunkReadInput): Promise<FileChunkReadResult>
  onNativeRuntimeProgress(callback: (payload: NativeRuntimeProgressPayload) => void): () => void
  onNativeRuntimeStatusChanged(callback: (payload: NativeRuntimeStatus) => void): () => void
}
```

命名原则：

- `native-runtime:*` 只暴露诊断、索引和 chunk read，不暴露“执行任意 binary”。
- 搜索类能力可以从旧 `searchConversationMessages` / `searchAgentSessionMessages` 逐步迁移，不强制一次性删除旧 IPC。
- `READ_FILE_CHUNK` 只能读取 main process 已确认可预览的文件路径；renderer 传入路径仍必须经过工作区 / 附件 / patch-work 白名单解析。

### operation model

长任务统一返回 operation ref：

```ts
interface NativeOperationRef {
  operationId: string
  kind: 'index_rebuild' | 'workspace_scan' | 'file_search' | 'cache_cleanup'
  startedAt: number
}

interface NativeRuntimeProgressPayload {
  operationId: string
  kind: NativeOperationRef['kind']
  phase: 'queued' | 'scanning' | 'indexing' | 'writing' | 'completed' | 'failed' | 'cancelled'
  completed?: number
  total?: number
  message?: string
}
```

progress message 必须是面向用户的中文短句；详细错误留在 diagnostics。

### schema 生成策略

跨语言契约建议从 TypeScript 源生成 JSON Schema：

```text
packages/shared/src/types/native-runtime.ts
  -> generated/native-runtime.schema.json
  -> Rust / Go contract tests consume schema + fixtures
```

不建议手写两套类型。若短期没有 schema 生成工具，也至少建立固定 fixtures：

```text
packages/shared/fixtures/native-runtime/
  search-input.json
  search-result.json
  tail-input.json
  tail-result.json
  diagnostics.json
  path-safety-cases.json
```

native 实现必须通过 fixtures round-trip。

IPC 原则：

- Renderer 只能传 session id、workspace id、query、cursor 等白名单参数。
- 绝不从 renderer 接受任意 native binary path。
- main process 负责 path resolve、权限检查、workspace containment 和日志脱敏。
- native sidecar 协议必须带 `protocolVersion`，不兼容时回退 TS。

### 错误模型

```ts
interface NativeRuntimeError {
  code:
    | 'native_disabled'
    | 'native_unavailable'
    | 'protocol_mismatch'
    | 'index_stale'
    | 'index_corrupted'
    | 'cursor_invalid'
    | 'path_denied'
    | 'operation_cancelled'
    | 'operation_timeout'
    | 'contract_violation'
  message: string
  retryable: boolean
  fallbackUsed: boolean
}
```

规则：

- `path_denied` 永远不可自动 fallback 放行。
- `contract_violation` 立即禁用 native，本次进程只走 TS fallback。
- `index_corrupted` 可自动隔离 cache 并重建。
- `cursor_invalid` 应让调用方重新从安全 offset 加载。
- 所有错误返回 renderer 前必须脱敏。

## 分阶段路线

### Phase 0：基线与契约

目标：先证明瓶颈，不直接写 Rust / Go。

入口条件：

- 当前业务测试基线可运行。
- 不存在正在进行的 Pipeline / Agent runtime 大改。
- 已确认本轮只做抽象和 benchmark，不引入 native binary。

任务：

- 为 JSONL tail、全局搜索、workspace search、文件预览建立 benchmark fixture。
- 记录 P50 / P95 / P99、main process blocking time、内存峰值。
- 抽象 `NativeRuntimeAdapter` 接口和 TS fallback。
- 增加 diagnostics 类型，但不改 UI 主流程。
- 明确 shared DTO 和 IPC channel 草案。
- 写出 TS fallback 的 contract fixtures。

完成定义：

- `bun run test` 通过。
- benchmark 可以复现大历史会话、大 Pipeline records、大 workspace。
- 没有 native binary 时功能完全不变。
- 文档中记录 baseline 性能数字，避免后续凭感觉判断收益。

### Phase 1：JSONL / workspace 搜索 TS fallback 重构

目标：先在 TypeScript 内收敛接口，避免 native 方案一开始就改变产品行为。

入口条件：

- Phase 0 benchmark 和 fixtures 已提交。
- `NativeRuntimeAdapter` 接口已经稳定。
- 旧搜索 IPC 的行为有回归测试。

任务：

- Chat / Agent / Pipeline 搜索统一走 `EventSearchService`。
- Pipeline tail 支持 cursor / offset。
- 搜索请求支持 cancellation / generation。
- SearchDialog 接入 Pipeline 内容搜索，而不只搜 Chat / Agent。
- workspace 文件名搜索先接入 TS 缓存和 watcher invalidation。
- 旧 IPC handler 继续保留，内部转调新 service，降低破坏面。

完成定义：

- 旧搜索结果字段兼容。
- 大 JSONL fixture 下不再每次全量解析。
- 输入快速变化时旧查询不会覆盖新查询。
- SearchDialog 覆盖 Chat / Agent / Pipeline 三类内容结果。

### Phase 2：Rust search sidecar 试点

目标：用最小 native 能力替换搜索实现。

入口条件：

- Phase 1 的 TS fallback 已经可替换。
- benchmark 显示搜索 / tail 仍有明显瓶颈。
- 已确定 Rust sidecar 只做 search / tail，不做业务编排。

任务：

- 新增 Rust sidecar：stdin/stdout JSON-RPC 或 127.0.0.1 loopback + random auth。
- 支持 `index_jsonl`、`tail_jsonl`、`search`、`status`、`shutdown`。
- main process 复用 opencode server manager 的 lifecycle 模式。
- 打包为平台 optional package：`@codeinsights/native-search-{platform}-{arch}`。
- 增加 protocol version check 和 `contract_violation` 自动 fallback。
- 增加 crash / timeout / corrupted cache smoke。

完成定义：

- TS fallback 和 Rust sidecar contract fixtures 输出一致。
- sidecar 崩溃后自动 fallback。
- packaged app 只使用 bundled sidecar，不使用系统 PATH。
- 性能报告证明收益超过门槛，否则不默认启用 native。

### Phase 3：前端可见体验

目标：让 native 能力真正改善用户体验。

入口条件：

- Phase 1 或 Phase 2 已提供稳定状态 DTO。
- SearchDialog 的搜索请求已支持 request id / cancellation。

任务：

- SearchDialog 增加分组、索引状态、更多结果分页。
- PipelineRecords 增加 indexed search 和 record cursor。
- Agent SidePanel 增加 workspace indexing 状态。
- Settings 增加 Native Runtime Diagnostics。
- 新增 `useGlobalNativeRuntimeListeners`。
- 增加大文件预览只读 chunk viewer 的入口模型。

完成定义：

- 索引中、fallback、失败、重建都有可见状态。
- 快速输入、切换会话、关闭搜索弹窗不触发 stale UI。
- Playwright / Electron smoke 覆盖搜索和诊断入口。
- UI 不展示技术堆栈细节给普通用户，详细信息仅在诊断区。

### Phase 4：路径安全与 Git 解析 helper

目标：把高风险字符串解析和路径校验集中测试。

入口条件：

- patch-work 和 Git submission 当前测试全部通过。
- 安全 fixtures 已覆盖现有 TS 行为。

任务：

- 先用 TS 抽象 `PathSafetyService` / `GitOutputParser`。
- Rust helper 与 TS fallback 共享 fixtures。
- 对 symlink、reserved path、Windows path、remote URL token 做 fuzz / fixture。
- 将 native helper 只接入 read-only 解析路径，确认稳定后再接入写路径校验。
- 所有 native 返回结果进入 Pipeline service 前再由 TS 做 assert。

完成定义：

- Patch-work 和 Pipeline Git submission 行为不变。
- 安全测试覆盖 native 和 fallback。
- 任何 native 异常都不能放宽现有安全策略。
- security review 无 P0 / P1 阻塞问题。

### Phase 5：Go supervisor 可选评估

触发条件：

- Codex / opencode / bridge 进程树问题成为高频 bug。
- 或需要长期后台服务聚合多 runtime、watcher、远程触发入口。

任务：

- 复用 opencode server manager 模式做 spike。
- 只负责 lifecycle，不负责业务事件解释。
- 与 TS runner 通过 JSON-RPC 交换状态。
- 先接入非模型、无凭证的 mock command。
- 验证 Windows `taskkill`、POSIX process group、app quit cleanup。

完成定义：

- stop / abort / crash / idle timeout 跨 macOS / Windows / Linux 可验证。
- 日志不输出 token、prompt 敏感内容或本地路径外泄。
- 若收益不足，保留 spike 文档，不合入默认路径。

### Phase 6：打包与发布收口

入口条件：

- native 功能已有 TS fallback。
- packaged smoke 能覆盖 native missing / native available 两条路径。
- macOS 和 Windows binary 均能本机或 CI 验证。

任务：

- 更新 `apps/electron/package.json` optionalDependencies。
- 更新 `electron-builder.yml` files。
- 增加 native packaged smoke。
- 增加 macOS arm64 / x64、Windows x64、Linux x64 CI 矩阵说明。
- 文档同步 README / AGENTS 需要用户另行授权。
- 检查 code signing / notarization / NSIS 安装后路径。
- 增加 release notes 中 native fallback 的故障排查说明。

完成定义：

- unpacked packaged smoke 通过。
- DMG / NSIS / Linux 包能找到 bundled binary。
- native 缺失时不会阻断核心 Agent / Pipeline。

### 阶段优先级建议

| 先后 | 阶段 | 是否必须 | 理由 |
| --- | --- | --- | --- |
| 1 | Phase 0 | 必须 | 没有 baseline 就无法判断 native 是否值得。 |
| 2 | Phase 1 | 必须 | 先建立可替换 TS 接口，降低跨语言风险。 |
| 3 | Phase 3 部分 | 必须 | 搜索状态和 cancellation 是体验问题，不依赖 Rust。 |
| 4 | Phase 2 | 有条件 | 只有 benchmark 证明搜索仍慢才上 Rust sidecar。 |
| 5 | Phase 4 | 有条件 | path / Git 安全收益明确，但应等 fixtures 充足。 |
| 6 | Phase 5 | 可选 | Go supervisor 只有在 lifecycle 问题高频时才值得。 |
| 7 | Phase 6 | 必须 | 任何 native 默认启用前都必须完成打包收口。 |

### 回滚策略

- 每个阶段都要能通过 feature flag 回退到上一阶段。
- Phase 2 之后，启动时发现 native 异常应自动设置本次进程 `nativeEnabled=false`。
- 版本升级后如果 protocol mismatch，不能尝试兼容执行旧 binary。
- 清理 native cache 不应改变任何会话、渠道、workspace 或 Pipeline 数据。
- 发布后若 native crash 率高，下一版本可以只改默认配置禁用 native，不需要回滚业务代码。

## BDD 验收场景

```gherkin
Scenario: native 搜索缺失时回退 TypeScript
  Given packaged app 中缺少 native search binary
  When 用户打开全局搜索并搜索历史消息
  Then 应返回 TypeScript fallback 结果
  And Native Runtime Diagnostics 应显示 fallback reason
  And 主流程不应崩溃

Scenario: 搜索索引损坏后自动重建
  Given native-cache/search-index 中存在损坏索引
  When 应用启动并执行搜索
  Then main process 应检测索引不可用
  And 删除或隔离损坏索引
  And 从 JSONL 事实源重建索引

Scenario: workspace 大仓库搜索不阻塞输入
  Given workspace 包含超过 100000 个文件
  When 用户在 SearchDialog 输入连续关键词
  Then renderer 输入不应卡顿
  And 旧查询结果不应覆盖最新关键词结果

Scenario: patch-work 路径安全不因 native helper 放宽
  Given patch-work 目录中存在指向仓库外的 symlink
  When Pipeline 读取或写入 patch-work 文件
  Then native helper 和 TS fallback 都必须拒绝该路径
  And 拒绝原因应写入可审计记录

Scenario: packaged app 使用 bundled native binary
  Given 系统 PATH 中存在另一个同名 native-search binary
  When packaged app 启动 native search
  Then 应使用 app/node_modules 或 resources 中的 bundled binary
  And diagnostics 应显示真实 binary path

Scenario: 大文件预览不阻塞主进程
  Given 用户打开一个 500MB 日志文件
  When 文件预览窗口加载首屏
  Then 主窗口仍可操作
  And 预览窗口只请求首个 chunk
  And 保存按钮应禁用

Scenario: 快速输入搜索词时旧结果被丢弃
  Given 用户打开 SearchDialog
  When 用户快速输入 abc 后继续输入 abcd
  Then abc 的异步结果不应覆盖 abcd 的结果
  And 当前列表应标注 abcd 对应的 requestId

Scenario: native contract violation 后本进程禁用 native
  Given Rust sidecar 返回不符合 schema 的 search result
  When main process 校验结果
  Then 应记录 contract_violation
  And 本次进程后续搜索应走 TypeScript fallback
  And renderer 只看到脱敏后的 fallback 状态

Scenario: 清理 native cache 不影响业务数据
  Given 用户已有 channels、Agent 会话、Pipeline records 和 workspace files
  When 用户在设置页点击清理 native cache 并确认
  Then 只应删除 native-cache 目录
  And 会话列表、渠道配置和 JSONL records 应保持不变
```

## 验证计划

| 层级 | 验证 |
| --- | --- |
| TS contract | `bun run test`、`bun run typecheck`、shared fixtures。 |
| Native unit | `cargo test` / `go test`，覆盖 parser、path safety、index corruption。 |
| Contract parity | 同一批 JSON fixtures 对比 TS fallback、Rust sidecar、Go sidecar 输出。 |
| 性能 | 大 JSONL、大 workspace、大 patch、大日志 fixture 的 P95 / P99 对比。 |
| 安全 | symlink、path traversal、token redaction、loopback auth、CORS disabled、command injection。 |
| lifecycle | start、health timeout、abort、crash、restart、idle shutdown、app quit cleanup。 |
| UI | SearchDialog、PipelineRecords、FilePreview、Diagnostics 的 Playwright / Electron smoke。 |
| packaged | unpacked、DMG / NSIS / Linux 包内 binary 可执行性；不误用系统 PATH。 |

最低性能门槛建议：

- 搜索 100MB JSONL：P95 至少比当前 TS 全量扫描快 3 倍，且 main process blocking 明显降低。
- Pipeline tail：新增记录读取不应随历史总量线性增长。
- Workspace 文件名搜索：大仓库首次索引后 P95 小于 150ms。
- native 冷启动：不应让应用启动可交互时间增加超过 500ms；可后台懒启动。

### 推荐测试文件布局

```text
packages/shared/src/types/native-runtime.test.ts
apps/electron/src/main/lib/native-runtime/native-runtime-service.test.ts
apps/electron/src/main/lib/native-runtime/ts-event-search-service.test.ts
apps/electron/src/main/lib/native-runtime/native-runtime-sidecar-manager.test.ts
apps/electron/src/main/lib/native-runtime/path-safety-contract.test.ts
apps/electron/src/renderer/components/settings/NativeRuntimeDiagnostics.test.tsx
apps/electron/src/renderer/components/app-shell/SearchDialog.indexed.test.tsx
apps/electron/scripts/native-runtime-smoke.ts
```

### Benchmark 矩阵

| Case | 数据规模 | 现状风险 | 目标 |
| --- | --- | --- | --- |
| `chat-search-large-history` | 1000 会话 x 200 消息 | 每次搜索逐 JSONL 扫描 | TS fallback 有缓存，native 更快。 |
| `agent-runtime-search` | 200 会话 x 500 events | runtime envelopes 增长快 | 搜索不阻塞 Agent UI。 |
| `pipeline-tail-large-records` | 单会话 50000 records | tail 先全量读取 | cursor tail 与总量弱相关。 |
| `workspace-file-name-search` | 100000 文件 | `readdirSync` 递归卡顿 | 首次索引后 P95 < 150ms。 |
| `large-log-preview` | 500MB 文本 | 当前整文件模型不可用 | 首屏 chunk < 300ms。 |
| `path-safety-fixtures` | 100+ path cases | 跨平台语义复杂 | TS / Rust 输出一致。 |

### CI 分层

| CI 层 | 触发 | 内容 |
| --- | --- | --- |
| PR fast | 每次 PR | TS contract、fallback unit、renderer tests、typecheck。 |
| Native unit | native 目录变更 | `cargo test` / `go test`、fixture round-trip。 |
| Native integration | main/lib/native-runtime 变更 | sidecar manager、crash / timeout / fallback。 |
| Packaged smoke | release 或 nightly | bundled binary path、unpacked app、native available / missing。 |
| Cross-platform | release | macOS arm64 / x64、Windows x64、Linux x64。 |

### 代码审查检查清单

- 是否保持 TS fallback。
- 是否新增或更新 shared fixtures。
- 是否有 native missing / crash / protocol mismatch 测试。
- 是否证明没有业务 JSON / JSONL 被 native cache 替代。
- 是否经过 path / secret redaction 安全测试。
- 是否更新 `electron-builder.yml` 和 optionalDependencies。
- 是否运行 packaged smoke 或明确记录未验证原因。

## 风险与缓解

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| 打包矩阵膨胀 | macOS / Windows / Linux binary 维护成本上升 | optional platform package + packaged smoke + fallback。 |
| 契约双写 | TS 和 native 类型漂移 | shared fixtures / JSON schema 作为唯一跨语言契约。 |
| native 崩溃 | 搜索或预览不可用 | sidecar 隔离进程，崩溃后 fallback，不影响主流程。 |
| 索引损坏 | 搜索结果错误或丢失 | 索引只做缓存，可删除重建；结果带 index version。 |
| 安全边界回退 | path traversal、secret 泄漏 | native 和 TS fallback 都跑同一安全测试；任何异常默认拒绝。 |
| UI 复杂度上升 | 用户看到过多技术细节 | Diagnostics 放设置页；主界面只显示简短状态和重试动作。 |
| 过早引入 Go service | 架构复杂度高于收益 | 只有 supervisor / gateway 明确成为瓶颈时才进入 Phase 5。 |

### 安全与隐私细化

| 边界 | 要求 |
| --- | --- |
| 本地端口 | 默认避免 HTTP sidecar；如必须启用，只绑定 `127.0.0.1`，随机 auth，不允许 CORS。 |
| 文件路径 | renderer 传入路径不可信，main process 必须重新 resolve 和 containment。 |
| 诊断信息 | 复制给用户前脱敏 home、token、credentialed URL、Authorization、Bearer。 |
| cache 内容 | 默认不保存完整正文；如保存 snippet，必须可清理且不包含被 ignore 的 secret 文件。 |
| native stderr | 只进入本地 diagnostics，先脱敏再展示。 |
| Git / remote | native 只能解析和诊断，不能直接 push / create PR。 |
| 权限 | native 不能绕开 Agent permission service 或 Pipeline gate。 |

### 兼容与版本策略

```text
app version
  -> expected native protocol version
  -> bundled native binary version
  -> cache schema version
```

规则：

- protocol 不兼容：禁用 native，提示升级或重启，不尝试兼容执行。
- cache schema 不兼容：删除旧 cache 并重建。
- binary version 缺失：允许 fallback，但 diagnostics 标红。
- shared DTO 变更：必须更新 fixtures 和 contract tests。
- patch 版本升级：如果影响 `@codeinsights/electron` 或 native package，受影响 package patch 版本递增。

### 依赖选择策略

Rust / Go 依赖不能默认添加。需要先做 dependency decision record：

| 维度 | 要求 |
| --- | --- |
| 维护状态 | 最近 release、issue 活跃度、license、维护者数量。 |
| 跨平台 | macOS arm64/x64、Windows x64、Linux x64 可构建。 |
| 体积 | binary 体积和 transitive deps 可接受。 |
| 安全 | 无明显 CVE，支持最小权限运行。 |
| 替代方案 | 至少比较继续 TS、Rust crate、Go package 三类路线。 |

候选库只作为未来评估方向，不能在方案阶段锁死：

- Rust 搜索：`ignore`、`walkdir`、`regex`、`memmap2`、`tantivy`。
- Rust 结构索引：`tree-sitter`。
- Rust N-API：`napi-rs`。
- Go watcher / supervisor：标准库优先，再评估 `fsnotify`。

## 不建议做的事

- 不把 renderer、Jotai atoms、preload、IPC 常量迁移到 Rust / Go。
- 不把 Agent / Pipeline 业务编排整体迁移到 native。
- 不引入本地业务数据库。native 索引只能是可重建缓存。
- 不让 renderer 直接调用 native binary 或传入 binary path。
- 不为了减少包体立刻替换 Tauri。
- 不把 Git commit、push、PR 创建移出当前人工 gate 和审计链路。
- 不在没有 benchmark 的情况下引入 N-API。

## 最小可交付切片

建议第一轮只做下面这条闭环：

1. 新增 `NativeRuntimeAdapter` TS interface 和 TS fallback。
2. 把 Chat / Agent / Pipeline 内容搜索统一到 `EventSearchService`。
3. 给 Pipeline records tail 增加 cursor / byte offset。
4. SearchDialog 接入 Pipeline 内容结果。
5. 增加大 JSONL fixture benchmark。
6. 文档记录 Rust sidecar 的目标 contract，但暂不写 Rust。

这个切片可以在不增加打包风险的前提下先把边界整理清楚，并给后续 Rust 实现提供可回归的行为基线。

### MVP 具体文件落点

| 文件 | 动作 |
| --- | --- |
| `packages/shared/src/types/native-runtime.ts` | 新增 DTO：status、search、tail、operation、error。 |
| `packages/shared/src/index.ts` | re-export 新类型。 |
| `apps/electron/src/main/lib/native-runtime/native-runtime-service.ts` | 新增 facade，默认只调用 TS fallback。 |
| `apps/electron/src/main/lib/native-runtime/ts-event-search-service.ts` | 汇总 Chat / Agent / Pipeline 搜索。 |
| `apps/electron/src/main/lib/pipeline-session-manager.ts` | 增加 cursor tail 或转调新 service。 |
| `apps/electron/src/main/ipc/native-runtime-handlers.ts` | 新增 diagnostics / search IPC。 |
| `apps/electron/src/preload/index.ts` | 暴露最小 native runtime API。 |
| `apps/electron/src/renderer/components/app-shell/SearchDialog.tsx` | 接入 indexed content results 和 requestId 丢弃。 |
| `apps/electron/src/renderer/atoms/native-runtime-atoms.ts` | 保存 UI 状态。 |
| `apps/electron/scripts/native-runtime-benchmark.ts` | 生成和运行 benchmark。 |

### MVP 验收命令

```bash
bun test packages/shared/src/types/native-runtime.test.ts
bun test apps/electron/src/main/lib/native-runtime
bun test apps/electron/src/renderer/components/app-shell/SearchDialog.indexed.test.tsx
bun run --filter='@codeinsights/electron' typecheck
bun run --filter='@codeinsights/electron' build:main
bun run --filter='@codeinsights/electron' build:preload
bun run --filter='@codeinsights/electron' build:renderer
git diff --check
```

如果 MVP 不包含 Rust / Go，不运行 `cargo test` / `go test`，并在 Review 明确说明 native binary 尚未实现。

### 下一轮实施建议

下一轮不要直接写 Rust。建议先做 Phase 0 + Phase 1 的 TypeScript 抽象和 benchmark：

1. 建立 `NativeRuntimeStatus` 和 `EventSearchService` shared 契约。
2. 给现有 Chat / Agent / Pipeline 搜索加统一接口和回归测试。
3. 为 Pipeline records tail 设计 cursor。
4. 让 SearchDialog 可以显示 Pipeline 内容结果。
5. 生成大 JSONL fixture 并记录当前基线。

完成后再决定 Rust sidecar 是否有足够收益。

## 官方参考

- [Node.js Node-API](https://nodejs.org/api/n-api.html)：用于评估 Rust N-API 的 ABI 与 native addon 边界。
- [Electron native Node modules](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules)：用于评估 Electron native module 的 rebuild / prebuild / ABI 风险。
- [electron-builder files 配置](https://www.electron.build/contents)：用于规划平台 binary 如何进入 packaged app。
- [Tauri sidecar](https://v2.tauri.app/develop/sidecar/)：用于对比 sidecar 生命周期模型，不作为近期桌面壳替换依据。
- [Node.js WASI](https://nodejs.org/api/wasi.html)：用于评估 WASM / WASI 只适合沙箱化纯函数的边界。
