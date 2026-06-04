# Phase 5 Sidecar Protocol / Fallback / Smoke Plan

> 日期：2026-06-03
> 阶段：Phase 5 Rust search sidecar 试点前置计划
> 状态：协议与 smoke 计划完成；后续已新增 `native/search/` search-only Rust 源码切片、Electron main process sidecar manager、Chat native opt-in fallback gate、search 早停性能优化、基础 `smoke:native-runtime` 脚本、native-cache manifest schema helper、fake sidecar / isolated cache failure smoke、optional package manifest schema helper、bundled package resolver fixture、packaged app layout preflight smoke、packaged app evidence classifier、`packagedAppIdentityVerified` gate，以及 optionalDependencies declaration preflight gate；尚未创建 packaged native binary
> 关联开发提交：`e39682f1 feat(rust-go): 完成 Phase 5 最小 Rust search sidecar 源码切片`、`319f30e8 feat(rust-go): 接入 Phase 5 Rust search sidecar manager 与 fallback gate`、`0eb350ff feat(rust-go): 优化 Phase 5 Rust search sidecar 早停性能`、`28e8a504 feat(rust-go): 增强 Phase 5 benchmark event-loop 口径`、`2cc95b1b feat(rust-go): 补齐 Phase 5 fake sidecar smoke 失败路径`、`e5b92fa7 feat(rust-go): 补齐 Phase 5 optional package manifest 预检`、`ce104a59 feat(rust-go): 补齐 Phase 5 bundled package resolver fixture`、`52613780 feat(rust-go): 补齐 Phase 5 packaged app layout 预检 smoke`、`800dc885 feat(rust-go): 补齐 Phase 5 packaged app evidence smoke`、`31e37cbb fix(rust-go): 收紧 Phase 5 packaged app evidence 真实验证`、`563b804c feat(rust-go): 补齐 Phase 5 optionalDependencies 声明预检 gate`

## 目标

Phase 5 的 Rust sidecar 只做可替换的本地搜索 / tail helper。所有业务编排、权限、路径白名单、脱敏、diagnostics UI、IPC 和 renderer 状态仍留在 TypeScript / Electron 主进程。

首版完整 sidecar 只允许覆盖：

- `status`
- `search`
- `tail_jsonl`
- `shutdown`

暂不覆盖：

- workspace directory walk
- 大文件 chunk preview
- Git 输出解析
- path safety 权威判定
- 全文索引 / Tantivy cache
- Go supervisor / watcher

当前 search-only 源码切片已覆盖：

- `status`
- literal `search`
- `shutdown`
- Electron main process sidecar manager 显式 binary path opt-in
- Chat search fallback gate
- `limit + 1` 早停性能优化

当前仍未实现：

- `tail_jsonl`（当前返回 typed `invalid_input`，等待 main process cursor / anchor contract parity）
- 真实 packaged app bundled binary smoke
- 真实 optional package 发布 / optionalDependencies 实际声明与安装链路
- default enable

当前新增的 smoke / cache 基础：

- `apps/electron/scripts/native-runtime-smoke.ts` 已接入 `smoke:native-runtime`，支持 `native-missing` 与 `native-available` 基础入口。
- `native-available` 只有显式传 `--native-search-binary` 或 `CODEINSIGHTS_NATIVE_SEARCH_BINARY` 时才尝试 native；未提供时标记 skipped，不从系统 `PATH` 查找。
- `native-missing` 使用隔离 `CODEINSIGHTS_CONFIG_DIR` fixture，验证 TypeScript fallback 搜索可用，并验证缺失 binary 返回 `missing_binary`。
- `apps/electron/src/main/lib/native-runtime/native-runtime-cache-schema.ts` 已定义 `getConfigDir()/native-cache/manifest.json` manifest 约定，记录 schema / protocol / package plan，不记录 binary path；损坏 manifest 返回 `cache_corrupted`。
- `protocol-mismatch`、`crash`、`timeout` 已接入 `process.execPath + 临时 JS fake sidecar` fixture，分别验证 `version_mismatch`、`crashed`、`timeout` fallback，且每个 mode 都同时验证 TypeScript fallback 搜索仍可用。
- `cache-corruption` 已接入隔离 `CODEINSIGHTS_CONFIG_DIR/native-cache/manifest.json` fixture，写入损坏 manifest 后验证 `readNativeRuntimeCacheManifest()` 返回 `cache_corrupted`，不读取真实 `~/.codeinsights/`。
- `apps/electron/src/main/lib/native-runtime/native-runtime-package-manifest.ts` 已定义 optional package manifest schema helper，固定 4 个候选平台包、校验 package version / protocol / cache schema / platform / arch / binary name / SHA-256 fingerprint，并使用 exact-key 白名单拒绝 `binaryPath` / home / path-like 额外字段。
- `apps/electron/src/main/lib/native-runtime/native-runtime-package-resolver.ts` 已定义 bundled package resolver helper，只从 optional package `package.json` 派生包根，读取包内固定 `native-search-package.json` 和 `bin/{binaryName}`，校验 app `node_modules` realpath allowlist、manifest schema、平台矩阵、可执行权限和 SHA-256 fingerprint；不从系统 `PATH` 查找，也不接受 manifest path 字段。
- `validateNativeSearchOptionalDependencies()` 已定义 optionalDependencies declaration preflight helper，只校验传入 package manifest 的 `optionalDependencies` 是否覆盖 4 个 native search 平台包，且版本声明必须是 registry-like 字符串；拒绝空值、非字符串、`file:`、`workspace:`、git / http URL 和 path-like spec。不读取真实 `node_modules`，不解析 binary，不证明 package 已安装。
- `packaged-manifest` 已作为非 packaged 预检 mode 接入 `smoke:native-runtime`，包含 manifest preflight、optionalDependencies declaration preflight 和临时 optional package resolver fixture 三层：manifest preflight 验证 optional package manifest 形状和 TS fallback 可用；optionalDependencies preflight 读取当前 Electron package manifest 的声明矩阵；resolver fixture 用临时 package + fake executable + PATH decoy 验证 bundled source / SHA-256 / no PATH lookup 逻辑。当前 summary 明确输出 `bundledBinaryVerified=false`、`fixtureBundledPackageVerified=true`、`usesTemporaryFixture=true`、`optionalDependenciesDeclared=false`、`missingOptionalDependencies=[4 packages]`、`invalidOptionalDependencies=[]`、`realPackagedBinaryVerified=false`。
- `packaged-app-layout` 已作为只读 preflight mode 接入 `smoke:native-runtime`：默认无 `--app-node-modules-root` 时 skipped；显式传入 packaged app `node_modules` root 时复用 bundled resolver 校验当前平台 optional package manifest、`bin/{binaryName}`、可执行权限、SHA-256 和 app `node_modules` allowlist。summary 拆分 `packagedAppLayoutVerified`、`packagedAppEvidenceVerified`、`usesTemporaryFixture` 和 `realPackagedBinaryVerified`；临时 fixture 只能证明 layout，不能把 `bundledBinaryVerified` 或 `realPackagedBinaryVerified` 置为 true。
- `packaged-app-layout` evidence classifier 已覆盖两种 packaged app 证据形态：`app.asar` + `app.asar.unpacked/node_modules`，以及当前 `asar: false` 配置对应的 `Resources/app/node_modules` + `Resources/app/package.json`。`31e37cbb` 已进一步加入 `packagedAppIdentityVerified`：当前仅 `unpacked-app` 可通过 app `package.json` 的 `name="@codeinsights/electron"` 与 `main="dist/main.cjs"` 校验，`asar-unpacked` 仍只能作为 evidence / preflight。detail 只输出 `packagedAppEvidence=asar-unpacked` / `unpacked-app` / `none`、package name 和 resolver reason code，不输出 packaged root 或 binary path；临时目录、缺少 identity、`optionalDependenciesDeclared=false` 或缺少真实 optional package / binary 时，即使具备 evidence，也不能让 `realPackagedBinaryVerified=true`。
- 这些能力仍不等于 packaged smoke：没有生成、复制、签名或打包 native binary，也没有修改 `electron-builder.yml`。

## Transport 决策

首版使用 stdin / stdout line-delimited JSON protocol。

选择原因：

- 不暴露 loopback port，减少 CORS、auth token、端口冲突和本机代理干扰。
- main process 可以通过 child process stdio 直接管理 lifecycle、timeout 和 crash。
- packaged smoke 更容易证明未使用系统 `PATH`：只需要校验 spawn 的 bundled binary 来源。

暂缓 loopback + random auth。只有后续需要多客户端、长期驻留或高吞吐 stream 时，再单独评估。

## Envelope

每行一个 UTF-8 JSON object。stdout 只输出 protocol JSON；stderr 只输出脱敏 diagnostics。

Request:

```json
{
  "jsonrpc": "2.0",
  "id": "req-123",
  "method": "status",
  "params": {},
  "deadlineMs": 1500
}
```

Response:

```json
{
  "jsonrpc": "2.0",
  "id": "req-123",
  "ok": true,
  "result": {}
}
```

Error response:

```json
{
  "jsonrpc": "2.0",
  "id": "req-123",
  "ok": false,
  "error": {
    "code": "invalid_input",
    "message": "请求参数无效",
    "recoverable": true
  }
}
```

Rules:

- `id` 必须等于 main process 的 requestId 或 operationId。
- sidecar 不生成 renderer 可见 id。
- `deadlineMs` 由 main process 控制；sidecar 必须在 deadline 前返回或让 main process timeout。
- unknown method 返回 `invalid_input`，不能 panic。
- bad JSON line 返回 typed error；连续 bad JSON 或 protocol violation 后 main process 禁用 native。
- response result 必须再经过 main process schema 校验，不能直接返回 renderer。

## Methods

### `status`

返回：

```json
{
  "implementation": "rust-sidecar",
  "binaryVersion": "0.0.0-dev",
  "protocolVersion": 1,
  "cacheSchemaVersion": 1,
  "capabilities": ["diagnostics", "indexed-search", "jsonl-tail"]
}
```

Main process rules:

- `protocolVersion` 不等于 `NATIVE_RUNTIME_PROTOCOL_VERSION`：禁用 native，fallback reason = `version_mismatch`。
- `cacheSchemaVersion` 不兼容：隔离 / 清理 native cache 后重建；若无法处理，fallback reason = `cache_corrupted`。
- `binaryVersion` 缺失：允许 fallback，diagnostics 标红，不默认启用。

### `search`

输入由 main process 派生，不接受 renderer 直传路径：

```json
{
  "requestId": "search-1",
  "query": "keyword",
  "limit": 20,
  "sources": [
    {
      "sourceKind": "pipeline_record",
      "sessionId": "session-1",
      "filePath": "/abs/path/from-main-only.jsonl"
    }
  ]
}
```

输出对齐 `NativeRuntimeSearchResult`：

- `implementation` 必须是 `rust-sidecar`。
- `matches[].matchedRanges` 使用 UTF-16 code unit offset 还是 byte offset必须在实现前锁定。首版建议在 sidecar 内只返回 byte offset，再由 main process 用原文 snippet 转换 / 校验；若不能可靠转换，则 contract 不通过。
- `snippet` 必须有长度上限，不允许返回整条 prompt 或完整 JSONL 行。
- `filePath` 返回前由 main process 再次校验和脱敏；renderer 不显示 binary path 或 cache path。

首版 search 只做 literal search，不接受 regex pattern。

### `tail_jsonl`

输入：

```json
{
  "requestId": "tail-1",
  "fileKind": "pipeline-records",
  "sessionId": "session-1",
  "filePath": "/abs/path/from-main-only.jsonl",
  "cursor": "opaque",
  "limit": 100,
  "direction": "backward"
}
```

输出对齐 `NativeRuntimeTailResult`。

Rules:

- cursor 仍由 main process 视为 opaque；sidecar 不决定 durable state。
- Phase 2 的 cursor anchor 规则必须保持：recordId / createdAt anchor 不匹配时返回 cursor invalid typed error 或 fallback。
- bad line、partial line、truncated file 不能 panic。

### `shutdown`

用于 app quit、idle shutdown 或 test cleanup。

Rules:

- shutdown 超时后 main process 可 kill child process。
- sidecar 不写业务事实源；退出前只允许 flush native-cache。

## Main Process Fallback Matrix

| 状态 | 触发 | main process 行为 | Renderer 可见状态 |
| --- | --- | --- | --- |
| `disabled` | feature flag 关闭 | 不启动 sidecar，走 TS fallback | 简短 fallback 状态 |
| `missing_binary` | bundled binary 不存在 | 走 TS fallback，diagnostics 记录缺失 | 不显示 binary path |
| `unsupported_platform` | 当前平台无 binary | 走 TS fallback | 简短不可用状态 |
| `version_mismatch` | protocolVersion 不匹配 | 本进程禁用 native | settings diagnostics 展示版本不兼容 |
| `contract_violation` | schema 校验失败 / bad offset / unexpected enum | 本进程禁用 native，写 typed diagnostics | renderer 只看到 fallback |
| `timeout` | request 超过 deadline | 当前请求 fallback；连续 timeout 后禁用 native | 搜索仍返回 fallback 结果 |
| `crashed` | child exit / panic | 本进程禁用 native，清理 pending request | 不阻断 Agent / Pipeline |
| `cache_corrupted` | cache manifest / index 损坏 | 隔离 / 清理 cache 后 fallback 或 rebuild | settings 可重建 / 清理 |

不可自动放行：

- `path_denied`
- schema 校验失败后仍试图使用 native 结果
- native 返回未脱敏 stderr / credentialed URL / token

## Contract Parity Plan

首版 parity 不要求完全复刻 TS 内部排序，但必须满足：

- 同一 query、scope、limit、fixture source，命中集合与 TS fallback 一致或是 TS fallback 的可解释子集。
- `NativeRuntimeSearchResult` / `NativeRuntimeTailResult` 通过 shared fixture shape 校验。
- `implementation` 字段能准确区分 `typescript` 与 `rust-sidecar`。
- bad JSON line、missing file、partial line、empty query、limit clamp、中文内容、credential-like 内容均有 fixture。
- 所有 native result 在 main process 二次校验后才能进入旧 IPC / renderer。

首批测试文件计划：

```text
apps/electron/src/main/lib/native-runtime/native-runtime-sidecar-manager.test.ts
apps/electron/src/main/lib/native-runtime/native-runtime-service.test.ts
apps/electron/src/main/lib/native-runtime/native-runtime-contract-parity.test.ts
apps/electron/scripts/native-runtime-smoke.ts
```

## Packaged Smoke Plan

Smoke script 目标路径：

```text
apps/electron/scripts/native-runtime-smoke.ts
```

未来脚本模式：

```bash
bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode native-missing
bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode native-available
bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode protocol-mismatch
bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode crash
bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode timeout
bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode cache-corruption
bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode packaged-manifest
bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode packaged-app-layout
```

Smoke cases:

| Case | Setup | Expected |
| --- | --- | --- |
| native missing | 显式 `--native-search-binary` 指向不存在的本地 sidecar | Diagnostics `missing_binary`，Search TS fallback 可用 |
| native available | 显式 `--native-search-binary` 指向本地 sidecar | `status.implementation = rust-sidecar`；这不是 bundled binary smoke |
| no PATH lookup | 系统 `PATH` 放置同名假 binary | app 不使用该 binary |
| protocol mismatch | fake sidecar 返回不兼容 version | fallback reason = `version_mismatch` |
| crash | fake sidecar 收到请求后退出 | fallback reason = `crashed`，后续请求走 TS |
| timeout | fake sidecar 不响应 | 当前请求 fallback，pending request 被清理 |
| cache corruption | 损坏 native-cache | cache 被隔离 / 清理，JSON / JSONL 事实源不变 |
| packaged manifest preflight | 临时 fixture 校验 optional package manifest schema | manifest schema / platform matrix 通过，`bundledBinaryVerified=false` |
| packaged resolver fixture | 临时 optional package + fake executable + PATH decoy | resolver 只接受 app `node_modules` allowlist 内 fixture，SHA-256 匹配，`fixtureBundledPackageVerified=true`，`realPackagedBinaryVerified=false` |
| packaged app layout preflight | 显式传入已有 packaged app `node_modules` root | layout 可通过 resolver 校验；无 root 时 skipped；支持 `asar-unpacked` / `unpacked-app` evidence 分类；`unpacked-app` 还需 app identity 校验；临时 fixture 或缺少 identity 不能证明真实 packaged binary |

当前已实现的 smoke 子集：

```bash
bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode native-missing --native-search-binary /tmp/codeinsights-missing-native-search
bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode native-available --native-search-binary /abs/path/to/local/codeinsights-native-search
bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode protocol-mismatch
bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode crash
bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode timeout
bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode cache-corruption
bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode packaged-manifest
bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode packaged-app-layout
```

- `native-missing` 已作为非 packaged smoke 可执行，输出 JSON summary，不打印 binary path。
- `native-available` 仅验证显式本地 binary 的 status / search / shutdown；它不是 bundled binary smoke。
- `protocol-mismatch`、`crash`、`timeout` 已作为非 packaged fake sidecar smoke 可执行，输出 JSON summary，不打印 fake sidecar 路径。
- `cache-corruption` 已作为 isolated cache smoke 可执行，使用临时 `CODEINSIGHTS_CONFIG_DIR`，不读取真实配置目录。
- `packaged-manifest` 已作为 optional package manifest 预检和 packaged resolver fixture 可执行，校验 4 个平台包的 manifest 契约、当前平台计划、临时 optional package fixture 的 manifest / binary SHA-256 / no PATH lookup / app `node_modules` allowlist；它仍不是真实 packaged app bundled binary smoke。
- `packaged-manifest` summary 当前边界必须保持：`bundledBinaryVerified=false`、`fixtureBundledPackageVerified=true`、`usesTemporaryFixture=true`、`optionalDependenciesDeclared=false`、`missingOptionalDependencies=[4 packages]`、`invalidOptionalDependencies=[]`、`realPackagedBinaryVerified=false`。
- `packaged-app-layout` 已作为只读 packaged app layout preflight 可执行。无 `--app-node-modules-root` 时 summary 为 `requiresPrebuiltPackagedApp=true`、`realPackagedBinaryVerified=false` 且 case skipped；有显式 root 时只验证 resolver layout，不从 `PATH` 查找。当前 evidence classifier 同时支持 `app.asar` + `app.asar.unpacked/node_modules` 和 `asar: false` 的 `Resources/app/node_modules` + `Resources/app/package.json`；`realPackagedBinaryVerified=true` 必须同时满足 resolver 成功、非临时 fixture、`packagedAppEvidenceVerified=true`、`packagedAppIdentityVerified=true`、`optionalDependenciesDeclared=true` 和真实 optional package / binary 存在。临时 fixture、`asar-unpacked` 无 identity、伪造 app identity 或缺失 optionalDependencies 声明都不能设置 `realPackagedBinaryVerified=true`。

Smoke output rules:

- 不打印 token、Authorization、credentialed URL、完整 home path。
- 不把 `binaryPath` 推给 renderer。
- `packaged-app-layout` 失败 detail 只输出 package name 和 resolver reason code，不输出 app root、temp path、`app.asar.unpacked`、binary path 或 raw fs error。
- `native-runtime-smoke` CLI 遇到任意 case `status=failed` 时必须返回非零退出码；skipped preflight 只能表示当前阶段缺少真实 packaged input，不能掩盖 failed gate。
- 不读取用户真实 `~/.codeinsights/`；使用隔离 `CODEINSIGHTS_CONFIG_DIR` fixture。
- 不 push、不创建 PR、不触发真实模型调用。

## Optional Package Plan

当前已实现 optionalDependencies declaration preflight，但仍不修改 `apps/electron/package.json` 的 `optionalDependencies`，不修改 `electron-builder.yml`；真实声明 / 安装链路仍未完成。

后续若进入 packaged native binary 阶段，候选包名按平台拆分：

| Platform | Package | Binary |
| --- | --- | --- |
| darwin arm64 | `@codeinsights/native-search-darwin-arm64` | `codeinsights-native-search` |
| darwin x64 | `@codeinsights/native-search-darwin-x64` | `codeinsights-native-search` |
| win32 x64 | `@codeinsights/native-search-win32-x64` | `codeinsights-native-search.exe` |
| linux x64 | `@codeinsights/native-search-linux-x64` | `codeinsights-native-search` |

包内 manifest 应至少包含：

- package name / version
- app protocol version
- native cache schema version
- binary name
- platform / arch
- SHA-256 fingerprint

当前已落地的 TypeScript manifest helper 约束：

- schema version 固定为 `1`。
- package plan 固定为 `@codeinsights/native-search-darwin-arm64`、`@codeinsights/native-search-darwin-x64`、`@codeinsights/native-search-win32-x64`、`@codeinsights/native-search-linux-x64`。
- `packageVersion` 必须是简单 semver 形态。
- `binarySha256` 必须是 64 位 hex SHA-256 字符串，写入时统一小写。
- manifest 使用 exact-key 白名单；不允许 `binaryPath`、`path`、`*Path`、`home`、`homeDir`、`homePath` 或任意额外字段。
- manifest helper 只描述包元数据，不解析真实 `node_modules`，不证明 binary 存在，也不替代后续 packaged smoke。

当前已落地的 bundled package resolver helper 约束：

- 只通过 optional package `package.json` 的 module resolution 得到包根，不扫描 `node_modules`。
- package manifest 固定为包内 `native-search-package.json`，binary 固定为 `bin/{manifest.binaryName}`。
- package `package.json` 和 binary realpath 必须位于 app `node_modules` allowlist 内，防止解析到用户 / 上级 / 全局同名 package。
- binary 必须存在、可执行，并且 SHA-256 fingerprint 必须等于 manifest。
- Electron service 只有在 `app.isPackaged` 为 true 且 native feature flags 打开、没有显式 `CODEINSIGHTS_NATIVE_SEARCH_BINARY` 时才自动尝试 bundled resolver；非 packaged dev 环境继续要求显式 binary。

主进程仍必须通过 bundled package resolver 显式解析 bundled package path，不允许从系统 `PATH` 隐式查找同名 binary。`packaged-app-layout` 只能作为已有 packaged app 布局的只读 preflight；当前已能识别 `asar-unpacked` 和本项目 `asar: false` 的 `unpacked-app` evidence 形态，但真实 optional package、`optionalDependencies`、`electron-builder.yml` files 和真实 packaged app bundled binary smoke 仍未完成。

## Performance Gate

Rust sidecar 默认启用候选必须同时满足：

- 100MB JSONL 搜索 P95 至少比当前 TS fallback 快 3 倍。
- event loop delay 至少降低 70%。
- native missing / crash / timeout fallback 后功能可用。
- native 冷启动不让应用可交互时间增加超过 500ms。
- packaged smoke 证明只使用 bundled binary。

未达到门槛时：

- 保留 TypeScript fallback。
- Rust sidecar 可作为实验能力保留，但不得默认启用。
- Review 必须写清继续优化、缩小范围或回滚 native 的判断。

## 实现前禁止事项

- 不创建 Rust / Go 代码。
- 不安装依赖。
- 不修改 `package.json` / `bun.lock` / `Cargo.toml` / `go.mod`。
- 不创建 native binary。
- 不修改 `electron-builder.yml`。
- 不修改根 `README.md` / 根 `AGENTS.md`。
