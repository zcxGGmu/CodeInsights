# Phase 5 Sidecar Protocol / Fallback / Smoke Plan

> 日期：2026-06-03
> 阶段：Phase 5 Rust search sidecar 试点前置计划
> 状态：协议与 smoke 计划完成；后续已新增 `native/search/` search-only Rust 源码切片、Electron main process sidecar manager、Chat native opt-in fallback gate、search 早停性能优化、native benchmark gate 机器可读汇总、Agent production facade benchmark 分析、Agent nested content native parity、基础 `smoke:native-runtime` 脚本、native-cache manifest schema helper、fake sidecar / isolated cache failure smoke、optional package manifest schema helper、bundled package resolver fixture、packaged app layout preflight smoke、packaged app evidence classifier、`packagedAppIdentityVerified` gate、optionalDependencies declaration preflight gate、optional package install-chain preflight gate、default-enable readiness 预检、packaging config allowlist 预检、optional package 发布状态预检、packaged bundled binary smoke 执行计划预检，以及 optional package publish-target dry-run 预检；尚未创建 packaged native binary，最终 default-enable 风险决策仍未完成
> 关联开发提交：`e39682f1 feat(rust-go): 完成 Phase 5 最小 Rust search sidecar 源码切片`、`319f30e8 feat(rust-go): 接入 Phase 5 Rust search sidecar manager 与 fallback gate`、`0eb350ff feat(rust-go): 优化 Phase 5 Rust search sidecar 早停性能`、`28e8a504 feat(rust-go): 增强 Phase 5 benchmark event-loop 口径`、`2cc95b1b feat(rust-go): 补齐 Phase 5 fake sidecar smoke 失败路径`、`e5b92fa7 feat(rust-go): 补齐 Phase 5 optional package manifest 预检`、`ce104a59 feat(rust-go): 补齐 Phase 5 bundled package resolver fixture`、`52613780 feat(rust-go): 补齐 Phase 5 packaged app layout 预检 smoke`、`800dc885 feat(rust-go): 补齐 Phase 5 packaged app evidence smoke`、`31e37cbb fix(rust-go): 收紧 Phase 5 packaged app evidence 真实验证`、`563b804c feat(rust-go): 补齐 Phase 5 optionalDependencies 声明预检 gate`、`1114233b feat(rust-go): 补齐 Phase 5 optional package 安装链路预检`、`f86553ee feat(rust-go): 补齐 Phase 5 native benchmark gate 汇总`、`9a06908a feat(rust-go): 补齐 Phase 5 Agent facade benchmark 分析`、`665c5db7 feat(rust-go): 补齐 Phase 5 Agent nested native parity`、`2bf88a5a feat(rust-go): 补齐 Phase 5 default-enable readiness 预检`、`348e003d feat(rust-go): 补齐 Phase 5 packaging config allowlist 预检`、`6ae1c896 feat(rust-go): 补齐 Phase 5 optional package 发布状态预检`、`dedbfed1 feat(rust-go): 补齐 Phase 5 packaged smoke 执行计划预检`、`9e3e3dff feat(rust-go): 补齐 Phase 5 optional package publish target 预检`

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
- `native-runtime:benchmark` 的 `nativeSearchGate` 机器可读汇总
- `native-runtime:benchmark` 的 `agentFacadeSearch` 生产 Agent facade 分析
- 受限白名单 `agent_message_search_text` extractor，用于 Agent SDK nested `message.content[]` text block parity
- `native-runtime:benchmark` / `smoke:native-runtime` 的 `nativeSearchDefaultEnableReadiness` 汇总，当前仍输出 `defaultEnableCandidate=false`、`explicitOptInRequired=true`

当前仍未实现：

- `tail_jsonl`（当前返回 typed `invalid_input`，等待 main process cursor / anchor contract parity）
- 真实 packaged app bundled binary smoke
- 真实 optional package 发布 / optionalDependencies 实际声明与安装执行
- `electron-builder.yml` files allowlist 实际调整与多平台 packaged app 验证
- 最终 default-enable 风险决策与 default enable

当前新增的 smoke / cache 基础：

- `apps/electron/scripts/native-runtime-smoke.ts` 已接入 `smoke:native-runtime`，支持 `native-missing` 与 `native-available` 基础入口。
- `native-available` 只有显式传 `--native-search-binary` 或 `CODEINSIGHTS_NATIVE_SEARCH_BINARY` 时才尝试 native；未提供时标记 skipped，不从系统 `PATH` 查找。
- `native-missing` 使用隔离 `CODEINSIGHTS_CONFIG_DIR` fixture，验证 TypeScript fallback 搜索可用，并验证缺失 binary 返回 `missing_binary`。
- `apps/electron/src/main/lib/native-runtime/native-runtime-cache-schema.ts` 已定义 `getConfigDir()/native-cache/manifest.json` manifest 约定，记录 schema / protocol / package plan，不记录 binary path；损坏 manifest 返回 `cache_corrupted`。
- `protocol-mismatch`、`crash`、`timeout` 已接入 `process.execPath + 临时 JS fake sidecar` fixture，分别验证 `version_mismatch`、`crashed`、`timeout` fallback，且每个 mode 都同时验证 TypeScript fallback 搜索仍可用。
- `cache-corruption` 已接入隔离 `CODEINSIGHTS_CONFIG_DIR/native-cache/manifest.json` fixture，写入损坏 manifest 后验证 `readNativeRuntimeCacheManifest()` 返回 `cache_corrupted`，不读取真实 `~/.codeinsights/`。
- `apps/electron/src/main/lib/native-runtime/native-runtime-package-manifest.ts` 已定义 optional package manifest schema helper，固定 4 个候选平台包、校验 package version / protocol / cache schema / platform / arch / binary name / SHA-256 fingerprint，并使用 exact-key 白名单拒绝 `binaryPath` / home / path-like 额外字段。
- `apps/electron/src/main/lib/native-runtime/native-runtime-package-resolver.ts` 已定义 bundled package resolver helper，只从 optional package `package.json` 派生包根，读取包内固定 `native-search-package.json` 和 `bin/{binaryName}`，校验 app `node_modules` realpath allowlist、manifest schema、平台矩阵、可执行权限和 SHA-256 fingerprint；不从系统 `PATH` 查找，也不接受 manifest path 字段。
- `validateNativeSearchOptionalDependencies()` 已定义 optionalDependencies declaration preflight helper，只校验传入 package manifest 的 `optionalDependencies` 是否覆盖 4 个 native search 平台包；`1114233b` 已将版本声明收紧为 exact semver 或 `npm:<同名 native search package>@exact-semver`，拒绝空值、非字符串、`latest` / range、跨包 alias、跨平台 alias、`file:`、`workspace:`、git / http URL 和 path-like spec。不读取真实 `node_modules`，不解析 binary，不证明 package 已安装。
- `validateNativeSearchOptionalPackageInstallChain()` 已定义 optional package install-chain preflight helper，只读校验 optionalDependencies declaration、`bun.lock` resolved package entry 和已安装 package manifest 一致性。lockfile 检查必须命中已解析 package entry，不能只因 importer 里出现依赖声明而通过；声明存在但 lockfile / installed package manifest 不完整时 smoke case 必须 failed，不得 skipped。该 helper 不读取 binary、不输出路径、不证明真实 packaged bundled binary。
- `validateNativeSearchPackagingConfig()` 已定义 packaging config allowlist preflight helper，只读解析 `electron-builder.yml` 顶层 `files:` 列表，要求 4 个 native search 平台包都有显式 per-package include，并报告 missing packages、blocking excludes 和 too-broad includes。当前仓库 summary 为 `packagingConfigVerified=false`、`missingPackagingConfigPackages=[4 packages]`、`blockingPackagingConfigExcludes=["!node_modules/@codeinsights/**"]`。
- `validateNativeSearchOptionalPackagePublication()` 已定义 optional package 发布状态预检 helper，只接收 registry packument metadata 和可选 expected exact version map。默认 smoke 不联网；显式 `--check-registry` 时只读查询 npm registry，404 进入 `missingPublishedOptionalPackages`，非 OK / fetch error 进入 `unavailablePublishedOptionalPackages`，metadata 不匹配进入 `invalidPublishedOptionalPackages`。若当前 package manifest 已声明 exact optionalDependency 版本，则 publication helper 必须校验 `versions[expectedVersion]`，不能只看 `dist-tags.latest`。
- `validateNativeSearchOptionalPackagePublishTarget()` 已定义 optional package publish-target dry-run helper，只读检查计划发布版本、registry 目标版本冲突、planned optional package manifest metadata、Cargo version 与 source `BINARY_VERSION` 一致性。默认 smoke 不联网时必须保持 `optionalPackagePublishTargetReady=false`；显式 `--check-registry` 时 registry 404 表示目标版本可发布，不表示 package 已发布。当前 `0.0.3` target 下 4 个 planned packages 均可发布、无 registry collision，但 source `BINARY_VERSION=0.0.3-dev` 触发 `native_search_binary_version_not_release_ready`。
- `packaged-manifest` 已作为非 packaged 预检 mode 接入 `smoke:native-runtime`，包含 manifest preflight、optional package publication preflight、optionalDependencies declaration preflight、optional package install-chain preflight、packaging config allowlist preflight 和临时 optional package resolver fixture：manifest preflight 验证 optional package manifest 形状和 TS fallback 可用；publication preflight 默认 skipped，显式 `--check-registry` 时 failed / passed；optionalDependencies preflight 读取当前 Electron package manifest 的声明矩阵；install-chain preflight 验证声明、lockfile resolved entry 和 installed package manifest 的只读一致性；packaging config preflight 验证 builder files 是否显式允许计划 native package；resolver fixture 用临时 package + fake executable + PATH decoy 验证 bundled source / SHA-256 / no PATH lookup 逻辑。当前默认 summary 明确输出 `bundledBinaryVerified=false`、`fixtureBundledPackageVerified=true`、`usesTemporaryFixture=true`、`optionalPackagePublicationChecked=false`、`optionalPackagesPublished=false`、`optionalDependenciesDeclared=false`、`missingOptionalDependencies=[4 packages]`、`invalidOptionalDependencies=[]`、`optionalDependenciesInstallChainVerified=false`、`optionalDependenciesLockfileVerified=false`、`optionalDependenciesInstalledPackagesVerified=false`、`packagingConfigVerified=false`、`missingPackagingConfigPackages=[4 packages]`、`blockingPackagingConfigExcludes=["!node_modules/@codeinsights/**"]`、`realPackagedBinaryVerified=false`。显式 `--check-registry` 当前为 exit 1，4 个计划 package 均进入 `missingPublishedOptionalPackages`。
- `packaged-app-layout` 已作为只读 preflight mode 接入 `smoke:native-runtime`：默认无 `--app-node-modules-root` 时 skipped；显式传入 packaged app `node_modules` root 时复用 bundled resolver 校验当前平台 optional package manifest、`bin/{binaryName}`、可执行权限、SHA-256 和 app `node_modules` allowlist。summary 拆分 `packagedAppLayoutVerified`、`packagedAppEvidenceVerified`、`usesTemporaryFixture` 和 `realPackagedBinaryVerified`；临时 fixture 只能证明 layout，不能把 `bundledBinaryVerified` 或 `realPackagedBinaryVerified` 置为 true。
- `packaged-app-layout` evidence classifier 已覆盖两种 packaged app 证据形态：`app.asar` + `app.asar.unpacked/node_modules`，以及当前 `asar: false` 配置对应的 `Resources/app/node_modules` + `Resources/app/package.json`。`31e37cbb` 已进一步加入 `packagedAppIdentityVerified`：当前仅 `unpacked-app` 可通过 app `package.json` 的 `name="@codeinsights/electron"` 与 `main="dist/main.cjs"` 校验，`asar-unpacked` 仍只能作为 evidence / preflight。detail 只输出 `packagedAppEvidence=asar-unpacked` / `unpacked-app` / `none`、package name 和 resolver reason code，不输出 packaged root 或 binary path；临时目录、缺少 identity、`optionalDependenciesInstallChainVerified=false` 或缺少真实 optional package / binary 时，即使具备 evidence，也不能让 `realPackagedBinaryVerified=true`。
- `native-runtime:benchmark` summary 已新增 `nativeSearchGate`，输出 Chat / Agent TS vs native 的 P95、event-loop delay P95、work-delay P95 delta、benchmark blockers 和 default-enable blockers。benchmark blockers 只评价性能与 event-loop gate；default-enable blockers 固定包含 `optional_package_install_chain_not_evaluated` 与 `packaged_app_bundled_binary_not_evaluated`，避免 benchmark 通过或无 native binary 时误报可默认启用。
- `native-runtime:benchmark` summary 已更新 `agentFacadeSearch`：生产 Agent source 使用受限 `agent_message_search_text` extractor 表示 native eligible；无 native binary 时 `nativeParityEvaluated=false`，有 `native-agent-runtime-production-facade-search` case 时仅证明 Agent facade nested parity，不代表 default enable。全局 `nativeSearchGate.defaultEnableCandidate` 仍固定为 `false`。
- `2bf88a5a` 已新增 `nativeSearchDefaultEnableReadiness`：benchmark summary 从 `nativeSearchGate` / `agentFacadeSearch` 推导性能与 Agent parity 输入，smoke summary 从 optional / packaged smoke 字段推导 publication、declaration、install-chain、packaged evidence / identity 和 real binary 输入。`348e003d` 已进一步加入 `packaging_config_not_verified` blocker，`6ae1c896` 已加入 `optional_packages_not_published` blocker。任一视角缺少真实 optional / packaged / builder allowlist / risk review 输入时，summary 都必须保持 `defaultEnableCandidate=false` 与 `explicitOptInRequired=true`。
- `dedbfed1` 已新增 `packagedBundledBinarySmokePlan`：smoke summary 现在输出 `status`、`blockedBy`、`requiredInputs`、`nextAllowedActions`、`forbiddenActions` 和 `candidateCommand`。当前默认 `packaged-manifest` / `packaged-app-layout` 均为 `status="blocked"`；`ready` 只代表前置输入具备，`verified` 必须同时满足顶层 `bundledBinaryVerified=true` 且无 blocker。
- 顶层 `realPackagedBinaryVerified` / `bundledBinaryVerified` 不能只透传 resolver 或 smoke 输入；必须同时满足非临时 fixture、optional package publication、optional install-chain、packaging config、packaged app evidence、packaged app identity 和真实 binary verification。临时 fixture、缺少 identity、缺少 publication、缺少 install-chain、builder allowlist 未验证或缺少真实 binary 时都不能证明真实 bundled binary。
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
bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode packaged-manifest --check-registry
bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode optional-package-publish-target --native-search-package-version 0.0.3
bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode optional-package-publish-target --native-search-package-version 0.0.3 --check-registry
bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode packaged-app-layout
bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode packaged-app-layout --check-registry
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
| packaged optional package publication preflight | 默认离线；显式 `--check-registry` 只读 npm packument | 未检查时 skipped；未发布 / invalid / unavailable 时 failed，`optionalPackagesPublished=false` |
| packaged optional package publish-target dry-run | 显式计划版本；默认离线，显式 `--check-registry` 只读 npm packument | 目标版本可发布 / collision / invalid / unavailable 分流；`native_search_binary_version_not_release_ready` 阻断 release-ready；不等于 published |
| packaged optionalDependencies install-chain preflight | 当前 Electron package manifest + `bun.lock` + installed package manifests | 未声明时 skipped 且 `optionalDependenciesInstallChainVerified=false`；声明存在但 lockfile / installed package 不完整时 failed |
| packaged packaging config preflight | 当前 `apps/electron/electron-builder.yml` files 规则 | 未开始 optional package opt-in 时 skipped 但 summary 输出 `packagingConfigVerified=false`；任一计划 package 已声明后，builder allowlist 未通过必须 failed |
| packaged resolver fixture | 临时 optional package + fake executable + PATH decoy | resolver 只接受 app `node_modules` allowlist 内 fixture，SHA-256 匹配，`fixtureBundledPackageVerified=true`，`realPackagedBinaryVerified=false` |
| packaged app layout preflight | 显式传入已有 packaged app `node_modules` root | layout 可通过 resolver 校验；无 root 时 skipped；支持 `asar-unpacked` / `unpacked-app` evidence 分类；`unpacked-app` 还需 app identity 校验；临时 fixture 或缺少 identity 不能证明真实 packaged binary |
| packaged bundled binary smoke plan preflight | 聚合 optional publication / optionalDependencies / install-chain / packaging config / prebuilt app root gate | 输出 `packagedBundledBinarySmokePlan`；当前 `status="blocked"`，`ready` 不等于 verified，`verified` 必须绑定 `bundledBinaryVerified=true` 且无 blocker |

当前已实现的 smoke 子集：

```bash
bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode native-missing --native-search-binary /tmp/codeinsights-missing-native-search
bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode native-available --native-search-binary /abs/path/to/local/codeinsights-native-search
bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode protocol-mismatch
bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode crash
bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode timeout
bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode cache-corruption
bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode packaged-manifest
bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode packaged-manifest --check-registry
bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode optional-package-publish-target --native-search-package-version 0.0.3
bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode optional-package-publish-target --native-search-package-version 0.0.3 --check-registry
bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode packaged-app-layout
bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode packaged-app-layout --check-registry
```

- `native-missing` 已作为非 packaged smoke 可执行，输出 JSON summary，不打印 binary path。
- `native-available` 仅验证显式本地 binary 的 status / search / shutdown；它不是 bundled binary smoke。
- `protocol-mismatch`、`crash`、`timeout` 已作为非 packaged fake sidecar smoke 可执行，输出 JSON summary，不打印 fake sidecar 路径。
- `cache-corruption` 已作为 isolated cache smoke 可执行，使用临时 `CODEINSIGHTS_CONFIG_DIR`，不读取真实配置目录。
- `packaged-manifest` 已作为 optional package manifest 预检、optional package publication preflight、optionalDependencies declaration preflight、optional package install-chain preflight、packaging config allowlist preflight 和 packaged resolver fixture 可执行，校验 4 个平台包的 manifest 契约、当前平台计划、只读 registry packument、当前 Electron package manifest 声明、`bun.lock` resolved entry、installed package manifest、当前 builder files allowlist、临时 optional package fixture 的 manifest / binary SHA-256 / no PATH lookup / app `node_modules` allowlist；它仍不是真实 packaged app bundled binary smoke。
- `packaged-manifest` 默认 summary 当前边界必须保持：`bundledBinaryVerified=false`、`fixtureBundledPackageVerified=true`、`usesTemporaryFixture=true`、`optionalPackagePublicationChecked=false`、`optionalPackagesPublished=false`、`optionalDependenciesDeclared=false`、`missingOptionalDependencies=[4 packages]`、`invalidOptionalDependencies=[]`、`optionalDependenciesInstallChainVerified=false`、`optionalDependenciesLockfileVerified=false`、`optionalDependenciesInstalledPackagesVerified=false`、`packagingConfigVerified=false`、`missingPackagingConfigPackages=[4 packages]`、`blockingPackagingConfigExcludes=["!node_modules/@codeinsights/**"]`、`realPackagedBinaryVerified=false`、`packagedBundledBinarySmokePlan.status="blocked"`。显式 `--check-registry` 当前必须 failed：4 个计划 package 均在 `missingPublishedOptionalPackages`，`optional_packages_not_published` blocker 生效。
- `optional-package-publish-target` 已作为只读 publish target dry-run 可执行。默认离线 summary 当前边界必须保持：`optionalPackagePublishTargetChecked=false`、`optionalPackagePublishTargetReady=false`，blockers 包含 `registry_check_required` 与 `native_search_binary_version_not_release_ready`；显式 `--check-registry --native-search-package-version 0.0.3` 当前必须 failed：4 个计划 package 目标版本可发布、无 registry collision，但 source `BINARY_VERSION=0.0.3-dev` 阻断 release-ready。
- `packaged-app-layout` 已作为只读 packaged app layout preflight 可执行。无 `--app-node-modules-root` 时 summary 为 `requiresPrebuiltPackagedApp=true`、`realPackagedBinaryVerified=false` 且 case skipped；有显式 root 时只验证 resolver layout，不从 `PATH` 查找。显式 `--check-registry` 会追加 publication failed case 并让 CLI 返回非零。当前 evidence classifier 同时支持 `app.asar` + `app.asar.unpacked/node_modules` 和 `asar: false` 的 `Resources/app/node_modules` + `Resources/app/package.json`；`realPackagedBinaryVerified=true` 必须同时满足 resolver 成功、非临时 fixture、`optionalPackagesPublished=true`、`packagedAppEvidenceVerified=true`、`packagedAppIdentityVerified=true`、`optionalDependenciesDeclared=true`、`optionalDependenciesInstallChainVerified=true`、`packagingConfigVerified=true` 和真实 optional package / binary 存在。临时 fixture、`asar-unpacked` 无 identity、伪造 app identity、缺失 publication、缺失 optionalDependencies 声明或 install-chain preflight 未通过都不能设置 `realPackagedBinaryVerified=true`。
- `packagedBundledBinarySmokePlan` 当前只表达执行计划：`blockedBy` 至少包含 `optional_packages_not_published`、`optional_dependencies_not_declared`、`optional_package_install_chain_not_verified`、`packaging_config_not_verified` 和 `prebuilt_packaged_app_required`。它不读取 binary、不安装 package、不写 package manifest、不修改 builder，也不输出 packaged app root 或 binary path。
- Publish-target dry-run 当前只表达“目标版本是否可尝试发布”：summary 字段包含 `optionalPackagePublishTargetChecked`、`optionalPackagePublishTargetReady`、`optionalPackagePublishTargetVersion`、`optionalPackagePublishTargetBlockers`、`publishTargetAvailablePackages`、`publishedVersionCollisionPackages`、`invalidPublishTargetPackages`、`unavailablePublishTargetPackages`、`nativeSearchVersionConsistencyVerified`、`nativeSearchCargoVersion`、`nativeSearchBinaryVersion` 和 `plannedOptionalPackageManifestsVerified`。它不能设置 `optionalPackagesPublished=true`，不能替代 publication / install-chain / packaging config / packaged app evidence / real binary verification，也不能改变 native default off。

Smoke output rules:

- 不打印 token、Authorization、credentialed URL、完整 home path。
- 不把 `binaryPath` 推给 renderer。
- `packaged-app-layout` 失败 detail 只输出 package name 和 resolver reason code，不输出 app root、temp path、`app.asar.unpacked`、binary path 或 raw fs error。
- `native-runtime-smoke` CLI 遇到任意 case `status=failed` 时必须返回非零退出码；skipped preflight 只能表示当前阶段缺少真实 packaged input，不能掩盖 failed gate。
- 不读取用户真实 `~/.codeinsights/`；使用隔离 `CODEINSIGHTS_CONFIG_DIR` fixture。
- 不 push、不创建 PR、不触发真实模型调用。

## Optional Package Plan

当前已实现 optional package publication preflight、optionalDependencies declaration preflight、optional package install-chain preflight 和 packaging config allowlist preflight，但仍不修改 `apps/electron/package.json` 的 `optionalDependencies`，不修改 `electron-builder.yml`；真实 optional package 发布、package.json 实际声明、lockfile 与 installed package 实物链路、builder allowlist 实际修改仍未完成。显式只读 registry 检查显示 `@codeinsights/native-search-darwin-arm64`、`@codeinsights/native-search-darwin-x64`、`@codeinsights/native-search-win32-x64`、`@codeinsights/native-search-linux-x64` 当前均进入 `missingPublishedOptionalPackages`，同时 packaging config preflight 明确报告当前 `apps/electron/electron-builder.yml` 缺少 per-package include 且 `!node_modules/@codeinsights/**` 会阻断这些包；因此在真实包发布且 builder allowlist 获准调整前，不能安全进入实际 optionalDependencies 声明 / 安装执行，也不能证明 packaged app bundled binary。

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

当前已落地的 optionalDependencies / install-chain helper 约束：

- optionalDependencies 声明必须覆盖 4 个 native search 平台包。
- optionalDependencies preflight 额外记录 `presentPackages`；只要任一计划 native package 已出现在 `optionalDependencies`，packaging config allowlist 未通过就必须让 smoke failed，不能继续 skipped。
- version spec 只接受 exact semver 或 `npm:<同名 native search package>@exact-semver`；跨包 alias、跨平台 alias、`latest` / range、空值、非字符串、`file:`、`workspace:`、git / http URL 和 path-like spec 均为 invalid。
- install-chain preflight 必须同时满足 declaration gate、`bun.lock` resolved package entry 和 installed package manifest package name / version 一致。
- lockfile 预检必须命中 resolved package entry，不能因为 importer dependency 文本包含包名就通过。
- 当前仓库未声明真实 `@codeinsights/native-search-*` optionalDependencies 时，install-chain preflight 是 skipped 且 summary 为 `optionalDependenciesInstallChainVerified=false`；一旦声明存在但 lockfile / installed package manifest 不完整，smoke case 必须 failed。
- install-chain helper 不读取 `bin/{binaryName}`，不校验 binary 可执行性，不输出 package root / binary path，不证明真实 packaged app bundled binary。

当前已落地的 optional package publication helper 约束：

- 默认 smoke 不联网；只有显式 `--check-registry` 才只读查询 npm registry packument。
- 404 只进入 `missingPublishedOptionalPackages`；非 OK 或 fetch error 进入 `unavailablePublishedOptionalPackages`；metadata schema / os / cpu / bin 不匹配进入 `invalidPublishedOptionalPackages`。
- 当当前 Electron package manifest 已经声明 exact optionalDependency version 时，publication helper 必须校验 registry `versions[expectedVersion]`，不能只验证 `dist-tags.latest`。
- `packaged-manifest --check-registry` 和 `packaged-app-layout --check-registry` 当前 no-go 时都必须返回非零退出码。
- publication helper 不安装 package、不修改 lockfile、不读取 installed package、不读取 binary、不输出 registry URL、home path 或 binary path。

当前已落地的 packaging config helper 约束：

- 只读解析 `electron-builder.yml` 顶层 `files:` 列表；当前未支持 inline array / FileSet object 时必须保守保持 `verified=false`。
- 只有显式 per-package include 计入通过，例如 `node_modules/@codeinsights/native-search-darwin-arm64/**/*`。
- `node_modules/**`、`node_modules/@codeinsights/**`、`node_modules/@codeinsights/native-search-*` 这类 broad include 不能作为 allowlist 通过；`!node_modules/@codeinsights/**`、`!node_modules/**`、`!node_modules/@codeinsights/native-search-*/bin/**` 这类阻断 required path 的 exclude 必须进入 blocker。
- 当前仓库 `packagingConfigVerified=false`，缺少 4 个计划 package include，且 `blockingPackagingConfigExcludes=["!node_modules/@codeinsights/**"]`。

当前已落地的 bundled package resolver helper 约束：

- 只通过 optional package `package.json` 的 module resolution 得到包根，不扫描 `node_modules`。
- package manifest 固定为包内 `native-search-package.json`，binary 固定为 `bin/{manifest.binaryName}`。
- package `package.json` 和 binary realpath 必须位于 app `node_modules` allowlist 内，防止解析到用户 / 上级 / 全局同名 package。
- binary 必须存在、可执行，并且 SHA-256 fingerprint 必须等于 manifest。
- Electron service 只有在 `app.isPackaged` 为 true 且 native feature flags 打开、没有显式 `CODEINSIGHTS_NATIVE_SEARCH_BINARY` 时才自动尝试 bundled resolver；非 packaged dev 环境继续要求显式 binary。

主进程仍必须通过 bundled package resolver 显式解析 bundled package path，不允许从系统 `PATH` 隐式查找同名 binary。`packaged-app-layout` 只能作为已有 packaged app 布局的只读 preflight；当前已能识别 `asar-unpacked` 和本项目 `asar: false` 的 `unpacked-app` evidence 形态，但真实 optional package 发布、`optionalDependencies` 实际声明、lockfile / installed package 实物链路、`electron-builder.yml` files 实际 allowlist 修改和真实 packaged app bundled binary smoke 仍未完成。

## Performance Gate

Rust sidecar 默认启用候选必须同时满足：

- 100MB JSONL 搜索 P95 至少比当前 TS fallback 快 3 倍。
- event loop delay 至少降低 70%。
- native missing / crash / timeout fallback 后功能可用。
- native 冷启动不让应用可交互时间增加超过 500ms。
- packaged smoke 证明只使用 bundled binary。

`f86553ee` 已将上述性能判断沉淀为 benchmark summary 的 `nativeSearchGate`，其中 `benchmarkGatePassed` 只代表 Chat / Agent direct native P95 与 event-loop gate 是否满足；`defaultEnableCandidate` 还必须同时没有 default-enable blockers。当前 summary 仍固定记录 optional / packaged blockers，因此 native 继续 default off。`9a06908a` 已新增 `agentFacadeSearch` 与 `agent-runtime-production-facade-search`；`665c5db7` 进一步新增受限白名单 extractor `agent_message_search_text` 和 `native-agent-runtime-production-facade-search` parity case，证明生产 Agent nested SDK message content 可在显式 native opt-in 时由 sidecar 定位候选行。`2bf88a5a` 已把这些信号与 optional / packaged / risk review 输入聚合为 `nativeSearchDefaultEnableReadiness`；`348e003d` 加入 packaging config allowlist gate，当前 blocker 包含 `packaging_config_not_verified`；`6ae1c896` 加入 optional package publication gate，当前 blocker 包含 `optional_packages_not_published`。direct native Agent benchmark 与 Agent facade parity 都不能替代真实 optional package / packaged bundled binary / builder allowlist gate；未完成真实 packaged smoke 与最终 default-enable 风险决策前，native 继续 default off。

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
