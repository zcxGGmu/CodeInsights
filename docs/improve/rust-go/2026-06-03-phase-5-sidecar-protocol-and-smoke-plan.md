# Phase 5 Sidecar Protocol / Fallback / Smoke Plan

> 日期：2026-06-03
> 阶段：Phase 5 Rust search sidecar 试点前置计划
> 状态：协议与 smoke 计划完成；后续已新增 `native/search/` search-only Rust 源码切片、Electron main process sidecar manager、Chat native opt-in fallback gate、search 早停性能优化、native benchmark gate 机器可读汇总、Agent production facade 分析、Agent nested content native parity、基础 `smoke:native-runtime` 脚本、native-cache manifest schema helper、fake sidecar / isolated cache failure smoke、optional package manifest schema helper、bundled package resolver fixture、packaged app layout preflight smoke、packaged app evidence classifier、`packagedAppIdentityVerified` gate、optionalDependencies declaration preflight gate、optional package install-chain preflight gate、install-chain installed manifest metadata 加固、default-enable readiness 预检、packaging config allowlist 预检、optional package 发布状态预检、packaged bundled binary smoke 执行计划预检、optional package publish-target dry-run 预检、release-ready source version 前置、optional package source preflight、optional / packaged gate 执行顺序预检、builder allowlist dry-run plan、optionalDependencies install-chain dry-run plan、optional package publication change plan 证据拆分、packaged bundled binary smoke invocation plan、optional package publication invocation plan、publication invocation 发布证据收紧、release handoff 证据计划、release handoff fail-closed 证据收紧、builder allowlist 实际修改前置证据、release handoff current gate approval packet、release handoff 全 gate approval queue、release handoff gate execution evidence checklist、default-enable gate network side-effect 标记修正、release handoff gate 执行后状态迁移期望、release handoff gate 迁移校验器、release handoff current gate execution input packet、release handoff no-go 边界审计，以及 no-go audit summary / smoke case 外显；尚未创建 packaged native binary，最终 default-enable 风险决策仍未完成
> 最新已确认实现基线：`63e0fc2b feat(rust-go): 外显 no-go audit 并加固 install-chain manifest`。
> 最新状态同步：`c95c5cf6 docs(rust-go): 同步 5bc9ebe8 Phase 5 最新状态` 已把 `5bc9ebe8 docs(rust-go): 回填 bcc65b3d Phase 5 恢复入口` 后的最新完成 / 未完成边界、3 个核心 gate 和 no-go 验证要求同步到状态文档；`5bc9ebe8` 已把 `bcc65b3d` 后的恢复入口回填到状态文档；`bcc65b3d` 已把 `e2b620ba` 后的恢复入口回填到状态文档；`e2b620ba` 已回填 `baa0ae3d docs(rust-go): 同步 Phase 5 optional package readiness` 后的恢复入口；`baa0ae3d` 已把当前任务计划缩减为 3 个核心 gate，并记录最小 optional package gate 的发布前只读 readiness：source preflight 与 publish-target registry dry-run 已通过，但 `packaged-manifest --check-registry` 仍因 4 个 planned package 未发布而预期失败。若本轮状态回填再次提交后，下次启动以 `git log -5 --oneline` 中最新 Rust / Go docs 提交为实际恢复入口。approval packet、gate approval queue、gate execution evidence checklist、transition expectation、transition verifier、execution input packet、no-go boundary audit、summary audit 外显、installed manifest metadata 校验和 publish-target readiness 仍不代表真实 optional package 发布、install-chain、builder allowlist 实际修改或 packaged bundled binary smoke 已完成。
> 2026-06-07 范围裁剪：当前只收口 Phase 5 verified / release handoff。Phase 6、Phase 7 和 Phase 9 暂停；Phase 8 全量打包 / CI / 发布收口不进入当前任务，只把真实 packaged app bundled binary smoke 所需的最小 packaged 验证设计保留在 Phase 5 gate 中。
> 2026-06-07 后续计划缩减：后续只保留最小真实 optional package gate、最小 install-chain gate、最小 packaged smoke gate；default-enable、Go supervisor、全平台 CI / 发布矩阵和 helper-only approval / handoff / dry-run 新增工作均暂缓。
> 2026-06-07 最小 optional package gate readiness：`native/search` Cargo version 与 `BINARY_VERSION` 均为 `0.0.3`；`optional-package-source --native-search-package-version 0.0.3` 输出 `optionalPackageSourceReady=true`，显式 `optional-package-publish-target --native-search-package-version 0.0.3 --check-registry` 输出 `optionalPackagePublishTargetReady=true`、无 collision / invalid / unavailable packages；显式 `packaged-manifest --check-registry` 仍输出 `optionalPackagesPublished=false` 和 4 个 `missingPublishedOptionalPackages`，因此真实 publication 未完成，下一步必须等待用户批准真实 `npm publish`。
> 2026-06-08 状态回填：当前已完成项止于 optional package readiness、`5bc9ebe8` 恢复入口回填与 `c95c5cf6` 最新状态同步；未完成项仍是真实 `npm publish`、真实 optionalDependencies 声明与 install-chain、`bun.lock` 和 installed package manifest metadata 的真实 evidence、builder allowlist 实际修改、真实 packaged app bundled binary smoke，以及 default-enable 风险决策。native 继续 default off / 显式 opt-in，未获明确批准前不执行任何真实远端写、install、builder 修改或 packaged binary 创建。
> 关联开发提交：`e39682f1 feat(rust-go): 完成 Phase 5 最小 Rust search sidecar 源码切片`、`319f30e8 feat(rust-go): 接入 Phase 5 Rust search sidecar manager 与 fallback gate`、`0eb350ff feat(rust-go): 优化 Phase 5 Rust search sidecar 早停性能`、`28e8a504 feat(rust-go): 增强 Phase 5 benchmark event-loop 口径`、`2cc95b1b feat(rust-go): 补齐 Phase 5 fake sidecar smoke 失败路径`、`e5b92fa7 feat(rust-go): 补齐 Phase 5 optional package manifest 预检`、`ce104a59 feat(rust-go): 补齐 Phase 5 bundled package resolver fixture`、`52613780 feat(rust-go): 补齐 Phase 5 packaged app layout 预检 smoke`、`800dc885 feat(rust-go): 补齐 Phase 5 packaged app evidence smoke`、`31e37cbb fix(rust-go): 收紧 Phase 5 packaged app evidence 真实验证`、`563b804c feat(rust-go): 补齐 Phase 5 optionalDependencies 声明预检 gate`、`1114233b feat(rust-go): 补齐 Phase 5 optional package 安装链路预检`、`f86553ee feat(rust-go): 补齐 Phase 5 native benchmark gate 汇总`、`9a06908a feat(rust-go): 补齐 Phase 5 Agent facade benchmark 分析`、`665c5db7 feat(rust-go): 补齐 Phase 5 Agent nested native parity`、`2bf88a5a feat(rust-go): 补齐 Phase 5 default-enable readiness 预检`、`348e003d feat(rust-go): 补齐 Phase 5 packaging config allowlist 预检`、`6ae1c896 feat(rust-go): 补齐 Phase 5 optional package 发布状态预检`、`dedbfed1 feat(rust-go): 补齐 Phase 5 packaged smoke 执行计划预检`、`9e3e3dff feat(rust-go): 补齐 Phase 5 optional package publish target 预检`、`dc75f380 feat(rust-go): 对齐 Phase 5 native search release source version`、`05c393bb feat(rust-go): 补齐 Phase 5 optional package source 预检`、`ce89f490 feat(rust-go): 补齐 Phase 5 optional packaged 执行顺序预检`、`a3f98673 feat(rust-go): 补齐 Phase 5 builder allowlist dry-run plan`、`7726a008 feat(rust-go): 补齐 Phase 5 optionalDependencies install-chain dry-run plan`、`8097ed4c feat(rust-go): 补齐 Phase 5 optional package publication change plan`、`2188e276 fix(rust-go): 收紧 Phase 5 publication plan collision 过滤`、`d679eabb fix(rust-go): 拆分 Phase 5 publication plan 发布证据`、`edeba827 feat(rust-go): 补齐 Phase 5 packaged smoke invocation plan`、`f949fc13 feat(rust-go): 补齐 Phase 5 optional package publication invocation plan`、`77b266e8 fix(rust-go): 收紧 Phase 5 publication invocation 发布证据`、`4fec7fab feat(rust-go): 补齐 Phase 5 release handoff 证据计划`、`3f5a0783 feat(rust-go): 收紧 Phase 5 release handoff fail-closed 证据`、`ddc818ae feat(rust-go): 补齐 Phase 5 builder allowlist 修改意图`、`99d76b0c feat(rust-go): 补齐 Phase 5 release handoff 批准包`、`197569d5 feat(rust-go): 补齐 Phase 5 release handoff 批准队列`、`cb30b819 feat(rust-go): 补齐 Phase 5 release handoff 执行证据清单`、`72a00b01 fix(rust-go): 标记 default enable 证据清单网络边界`、`b874628b feat(rust-go): 补齐 Phase 5 gate 状态迁移期望`、`66da7eba feat(rust-go): 补齐 Phase 5 gate 迁移校验器`、`461295b0 feat(rust-go): 补齐 Phase 5 release handoff 执行输入证据包`、`8a0bcfd5 feat(rust-go): 补齐 Phase 5 release handoff no-go 边界审计`、`63e0fc2b feat(rust-go): 外显 no-go audit 并加固 install-chain manifest`

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
- `validateNativeSearchOptionalPackageInstallChain()` 已定义 optional package install-chain preflight helper，只读校验 optionalDependencies declaration、`bun.lock` resolved package entry 和已安装 package manifest 一致性。lockfile 检查必须命中已解析 package entry，不能只因 importer 里出现依赖声明而通过；installed package manifest 必须满足 optional package source package.json 的严格 shape，包含 exact version、`os` / `cpu`、`bin.codeinsights-native-search`、精确 `files` allowlist 和 `publishConfig.access=public`，并拒绝 lifecycle scripts 与 runtime dependency 字段；声明存在但 lockfile / installed package manifest 不完整或 metadata 不合规时 smoke case 必须 failed，不得 skipped。该 helper 不读取 binary、不输出路径、不证明真实 packaged bundled binary。
- `validateNativeSearchPackagingConfig()` 已定义 packaging config allowlist preflight helper，只读解析 `electron-builder.yml` 顶层 `files:` 列表，要求 4 个 native search 平台包都有显式 per-package include，并报告 missing packages、blocking excludes 和 too-broad includes。当前仓库 summary 为 `packagingConfigVerified=false`、`missingPackagingConfigPackages=[4 packages]`、`blockingPackagingConfigExcludes=["!node_modules/@codeinsights/**"]`。
- `buildNativeSearchPackagingConfigAllowlistChangePlan()` 已定义 builder allowlist dry-run plan helper，只读消费 packaging config validator 结果并输出人工 review 输入：4 个 required / missing per-package include、blocking excludes、too-broad includes、removal candidates、candidate verification commands 和 forbidden actions。当前 summary 为 `packagingConfigAllowlistChangePlan.status="blocked"`、`approvalRequired=true`，且必须保持不写 `electron-builder.yml`、不安装、不发布、不读取 binary、不证明 packaged app bundled binary。
- `ddc818ae` 已把 `buildNativeSearchPackagingConfigAllowlistChangePlan()` 的后续 YAML edit intent 细化为 `candidateYamlEditPlan`：目标文件固定为 `apps/electron/electron-builder.yml`，`modifiesFile=false`，操作顺序为先移除阻断 native search 的 exclude，再添加缺失的精确 native search include，最后重跑 packaging config preflight。该字段只输出 `addIncludes` / `keepIncludes` / `removeRules` / `forbiddenIncludes` / `acceptanceEvidence`，不得当作真实 builder 修改、`packagingConfigVerified` 或 packaged app bundled binary evidence。
- `buildNativeSearchOptionalDependenciesInstallChainChangePlan()` 已定义 optionalDependencies install-chain dry-run plan helper，只读消费 publication / declaration / install-chain preflight 结果并输出真实声明与安装执行前的人工 review 输入：4 个 planned exact optionalDependency spec（当前 `0.0.3`）、publication / declaration / install-chain / lockfile / installed package blockers、candidate verification commands 和 forbidden actions。当前 summary 为 `optionalDependenciesInstallChainChangePlan.status="blocked"`、`approvalRequired=true`，且必须保持不写 `apps/electron/package.json` 或 `bun.lock`、不安装、不发布、不修改 builder、不读取 binary、不证明 packaged app bundled binary。
- `validateNativeSearchOptionalPackagePublication()` 已定义 optional package 发布状态预检 helper，只接收 registry packument metadata 和可选 expected exact version map。默认 smoke 不联网；显式 `--check-registry` 时只读查询 npm registry，404 进入 `missingPublishedOptionalPackages`，非 OK / fetch error 进入 `unavailablePublishedOptionalPackages`，metadata 不匹配进入 `invalidPublishedOptionalPackages`。若当前 package manifest 已声明 exact optionalDependency 版本，则 publication helper 必须校验 `versions[expectedVersion]`，不能只看 `dist-tags.latest`。
- `buildNativeSearchOptionalPackagePublicationChangePlan()` 已定义 optional package publication change plan helper，只读消费 publish-target、package-source 和 publication preflight 结果，输出真实 `npm publish` 前的人工 review 输入：4 个 planned package / version、preflight commands、候选 publish command、forbidden actions、`publishedPackages`、`publishTargetCollisionPackages`、`existingInvalidPublishedPackages` 和 `commandExcludedPackages`。`publishedPackages` 只表示 registry 中 exact expected version 且 metadata 有效的真实 publication 证据；publish-target collision 或 exact-version invalid metadata 只能进入 exclusion / blocker 字段，不能当作已发布。当前 ready_for_review 只表示可审核发布动作，不运行 `npm publish` / `npm pack`，不安装、不写 package manifest / lockfile / builder、不读取 binary、不证明 packaged app bundled binary。
- `buildNativeSearchOptionalPackagePublicationInvocationPlan()` 已定义 optional package publication invocation plan helper，只读消费 publication change plan 和 publication evidence，输出真实 `npm publish` 前的 required inputs、candidate commands、per-package invocation status / blocker、acceptance evidence 和 forbidden actions。`status="ready_for_invocation"` 只表示 publish 调用形状可交给人工审核；`publishedPackages` 只能来自 package-level `status="published"` 的有效 exact registry evidence，并且 fully verified 必须要求 planned / published package 集合唯一且严格匹配。invalid、unavailable、duplicate、collision 或矛盾 evidence 只能进入 blocker / exclusion，不能当作已发布。
- `validateNativeSearchOptionalPackagePublishTarget()` 已定义 optional package publish-target dry-run helper，只读检查计划发布版本、registry 目标版本冲突、planned optional package manifest metadata、Cargo version 与 source `BINARY_VERSION` 一致性。默认 smoke 不联网时必须保持 `optionalPackagePublishTargetReady=false`；显式 `--check-registry` 时 registry 404 表示目标版本可发布，不表示 package 已发布。版本不一致时会触发 `native_search_binary_version_not_release_ready`；当前 `dc75f380` 后 `0.0.3` source consistency 已通过，显式 registry dry-run ready，但 publication / install-chain / packaging / packaged smoke 仍未完成。
- `validateNativeSearchOptionalPackageSources()` 已定义 optional package source preflight helper，只验证 planned in-memory npm package source blueprint：exact package name / version、`private=false`、license / description、精确 `os` / `cpu`、`bin.codeinsights-native-search`、精确 `files` allowlist、`publishConfig.access=public` 和对应 `native-search-package.json` 计划。该 helper 必须拒绝 path-like 字段、运行时 dependency 字段和 install / publish lifecycle scripts；它不运行 `npm pack`、不发布、不安装、不读取 binary、不证明真实 SHA，也不改变 publication / install-chain / packaging / packaged smoke gate。
- `buildNativeSearchOptionalPackageExecutionPlan()` 已定义 optional / packaged gate 执行顺序预检 helper，只消费既有 gate 布尔值，输出 `nextStage`、严格顺序前缀 `completedPrerequisites`、独立证据 `observedEvidenceStages`、`blockedBy`、ready flags、allowed / forbidden actions 和 candidate commands。`optionalPackagePublishTargetReady` 与 `optionalPackageSourceReady` 必须绑定对应 checked 字段；二者同时 ready 只允许进入 `optional_package_publication`，不证明 publication / optionalDependencies / install-chain / packaging / packaged binary / default enable。
- `packaged-manifest` 已作为非 packaged 预检 mode 接入 `smoke:native-runtime`，包含 manifest preflight、optional package publication preflight、optionalDependencies declaration preflight、optional package install-chain preflight、packaging config allowlist preflight、release handoff no-go boundary audit summary / smoke case 和临时 optional package resolver fixture：manifest preflight 验证 optional package manifest 形状和 TS fallback 可用；publication preflight 默认 skipped，显式 `--check-registry` 时 failed / passed；optionalDependencies preflight 读取当前 Electron package manifest 的声明矩阵；install-chain preflight 验证声明、lockfile resolved entry 和 installed package manifest 的严格 package.json metadata 一致性；packaging config preflight 验证 builder files 是否显式允许计划 native package；`release-handoff-no-go-boundary-audit` case 外显只读 no-go audit，失败时 smoke fail closed；resolver fixture 用临时 package + fake executable + PATH decoy 验证 bundled source / SHA-256 / no PATH lookup 逻辑。当前默认 summary 明确输出 `bundledBinaryVerified=false`、`fixtureBundledPackageVerified=true`、`usesTemporaryFixture=true`、`optionalPackagePublicationChecked=false`、`optionalPackagesPublished=false`、`optionalPackagePublicationChangePlan.status="blocked"`、`optionalPackagePublicationInvocationPlan.status="blocked"`、`optionalDependenciesDeclared=false`、`missingOptionalDependencies=[4 packages]`、`invalidOptionalDependencies=[]`、`optionalDependenciesInstallChainVerified=false`、`optionalDependenciesLockfileVerified=false`、`optionalDependenciesInstalledPackagesVerified=false`、`packagingConfigVerified=false`、`missingPackagingConfigPackages=[4 packages]`、`blockingPackagingConfigExcludes=["!node_modules/@codeinsights/**"]`、`nativeSearchReleaseHandoffNoGoBoundaryAudit.passed=true`、`realPackagedBinaryVerified=false`。显式 `--check-registry` 当前为 exit 1，4 个计划 package 均进入 `missingPublishedOptionalPackages`；若 publish-target / source 都 ready 且 registry exact versions 未发布，`optionalPackagePublicationChangePlan.status` 可以是 `ready_for_review`，`optionalPackagePublicationInvocationPlan.status` 可以是 `ready_for_invocation`，但 `optionalPackagesPublished` 和 `publishedPackages` 仍必须保持未发布证据。
- `4fec7fab` 已新增 `nativeSearchReleaseHandoffPlan`：smoke summary 现在把 publication invocation、optionalDependencies install-chain change plan、packaging config allowlist change plan、packaged bundled binary smoke invocation plan 和 optional / packaged execution plan 聚合成 release handoff 证据。plan 输出 `nextGate`、missing evidence、required approvals、acceptance evidence、candidate next commands、doesNotVerify 和 forbidden actions；`ready_for_release_handoff` 只表示当前顺序 gate 的下一步可交给人工审核或执行，不证明真实 publish / install / builder 修改 / packaged smoke / default enable。publication 与 packaged smoke handoff ready 字段必须绑定 `optionalPackageExecutionPlan.nextStage`，后置 packaged smoke 布尔值不能跳过上游 publish-target / source / publication gate。
- `3f5a0783` 已新增 `nativeSearchReleaseHandoffPlan.gateBinding` 和 `packagedBundledBinarySmokeInvocationPlan.executionDesign`：`gateBinding` 记录 authoritative next gate、publication allowed gate、packaged smoke allowed gate、verified requires execution plan verified 和 out-of-order evidence fail-closed；`executionDesign` 记录 preferred packaged app root、legacy app node_modules root、registry check required、real packaged app required、temporary fixture forbidden as real evidence，以及不创建 artifact、不 publish、不 install、不修改 builder 的边界。
- `99d76b0c` 已新增 `nativeSearchReleaseHandoffPlan.currentGateApprovalPacket`：approval packet 只读记录当前顺序 gate 的批准准备，blocked gate 必须保持 `approvalRequired=false` 且 `candidateCommands=[]`；publication gate ready 时只要求 `release_approval`，只允许在批准后审核候选 publish 命令，不授权 `package.json` / `bun.lock` / builder / packaged app / default enable。
- `197569d5` 已新增 `nativeSearchReleaseHandoffPlan.gateApprovalQueue`：approval queue 只读记录真实 optional / packaged / default-enable gate 的顺序批准矩阵；只有当前 ready gate 输出候选命令，未来 gate 必须保持 `blocked_until_prior_gate_verified` 且 `candidateCommands=[]`，已完成 gate 只能标为 `verified`。它不发布、不安装、不写 `package.json` / `bun.lock` / builder、不创建 packaged app、不读取 binary，也不证明 packaged binary 或 default enable。
- `cb30b819` 已新增 `nativeSearchReleaseHandoffPlan.gateExecutionEvidenceChecklist`：execution evidence checklist 只读记录每个真实 gate 批准执行后必须补齐的 evidence、post-execution verification command、file / network / remote write 副作用标记、success criteria、fail-closed criteria、doesNotVerify 和 forbiddenActions。只有当前 ready gate 暴露批准后的验证命令；future / blocked gate 必须保持 `postExecutionVerificationCommands=[]`。它不发布、不安装、不写 `package.json` / `bun.lock` / builder、不创建 packaged app、不读取 binary，也不证明 packaged binary 或 default enable。
- `72a00b01` 已修正 `gateExecutionEvidenceChecklist` 的 default-enable risk review 副作用边界：该 gate 的未来 post-execution verification 设计包含显式 `--check-registry`，因此即使 blocked 且 `postExecutionVerificationCommands=[]`，也必须标记 `networkRequired=true`，避免低报 default-enable 风险复核的联网副作用。
- `b874628b` 已新增 `gateExecutionEvidenceChecklist` 的执行后状态迁移期望：每个 gate 输出 `expectedNextGateAfterVerification`、`expectedSummaryFlagsAfterExecution`、`mustRemainUnverifiedAfterExecution` 和 `transitionFailClosedCriteria`。publication gate 验证后只应推进到 optionalDependencies declaration；declaration gate 验证后只应推进到 install-chain，且 lockfile / installed package 子证据仍必须未验证。该字段只服务后续真实 gate 执行后的 fail-closed 验收，不驱动 `nextGate`、`verified`、候选命令或 default-enable。
- `66da7eba` 已新增 `evaluateNativeSearchReleaseHandoffGateTransition()`：该纯函数把 `gateExecutionEvidenceChecklist` 的 transition expectation 转成 before / after summary 校验，要求当前 gate 已 ready，执行后只到达 expected next gate，expected summary flags 成立，must-remain-unverified flags 仍未验证，并输出 missing flags、violated flags、no-go boundary violations 和 failed criteria。它覆盖 publication、declaration、install-chain、packaging config 和 packaged smoke 的合规迁移，也拒绝跳 gate、提前证明 lockfile / installed package / packaged binary、以及 blocked packaged smoke 只靠顶层布尔值绕过。它不查询 registry、不发布、不安装、不写 manifest / lockfile / builder、不创建 packaged app、不读取 binary、不证明 packaged verified 或 default-enable。
- `461295b0` 已新增 `nativeSearchReleaseHandoffPlan.currentGateExecutionInputPacket`：该 packet 只读绑定当前 gate approval packet 与 execution evidence checklist，输出当前顺序 gate 的批准前 required inputs、批准后 allowed actions、candidate commands、post-execution verification commands、side effects、required evidence、expected next gate、must-remain-unverified、doesNotVerify 和 forbiddenActions。blocked / future gate 仍不暴露命令；publication ready 只暴露占位 publish 命令；declaration ready 不暴露 install；install-chain ready 只有批准后才暴露 `bun install --frozen-lockfile`；packaged smoke 只暴露 `<packaged-app-root>` 占位 smoke 命令；default-enable 当前仍 blocked 且不暴露默认启用命令。该 packet 不发布、不安装、不写 package manifest / lockfile / builder、不创建 packaged app、不读取 binary、不证明 packaged verified 或 default-enable。
- `8a0bcfd5` 已新增 `evaluateNativeSearchReleaseHandoffNoGoBoundary()`：该只读 audit 校验 smoke summary 的 default off / explicit opt-in、release handoff default-off 绑定、approval packet / execution input packet / approval queue / execution checklist 的 command 边界、install-chain 副作用、packaged smoke `<packaged-app-root>` 占位命令、default-enable blocked、提前 verified flag 和敏感路径 / registry 字符串泄露。blocked approval packet 不要求 ready command；只有 ready packet 才比较 expected command set。该 audit 不联网、不执行 `npm publish`、不运行 install、不写 package manifest / lockfile / builder、不创建 packaged app、不读取 binary，不证明 packaged verified 或 default-enable。
- `63e0fc2b` 已将上述 no-go audit 外显为 `nativeSearchReleaseHandoffNoGoBoundaryAudit` summary 字段和 `release-handoff-no-go-boundary-audit` smoke case；case failed 会让 smoke CLI fail closed。该提交还要求 installed optional package manifest 通过 optional package source package.json 严格 shape 校验，拒绝只有 `name/version`、lifecycle scripts 或 runtime dependencies 的 installed package evidence。它仍不发布、不安装、不新增真实 optionalDependencies、不修改 builder、不创建 packaged app / binary，也不证明 packaged verified 或 default-enable。
- `packaged-app-layout` 已作为只读 preflight mode 接入 `smoke:native-runtime`：默认无 `--packaged-app-root` 或 `--app-node-modules-root` 时 skipped；推荐显式传入 packaged app root，由 smoke 只读推导 `.app/Contents/Resources/app/node_modules`、`.app/Contents/Resources/app.asar.unpacked/node_modules`、直接 `Resources`、直接 `Resources/app` 或直接 `app.asar.unpacked` 布局；legacy `--app-node-modules-root` 仍支持且优先，但缺失路径必须进入 `app_node_modules_root_unresolved` blocker。resolver 校验当前平台 optional package manifest、`bin/{binaryName}`、可执行权限、SHA-256 和 app `node_modules` allowlist。summary 拆分 `packagedAppLayoutVerified`、`packagedAppEvidenceVerified`、`usesTemporaryFixture` 和 `realPackagedBinaryVerified`；临时 fixture 只能证明 layout，不能把 `bundledBinaryVerified` 或 `realPackagedBinaryVerified` 置为 true。
- `packaged-app-layout` evidence classifier 已覆盖两种 packaged app 证据形态：`app.asar` + `app.asar.unpacked/node_modules`，以及当前 `asar: false` 配置对应的 `Resources/app/node_modules` + `Resources/app/package.json`。`31e37cbb` 已进一步加入 `packagedAppIdentityVerified`：当前仅 `unpacked-app` 可通过 app `package.json` 的 `name="@codeinsights/electron"` 与 `main="dist/main.cjs"` 校验，`asar-unpacked` 仍只能作为 evidence / preflight。detail 只输出 `packagedAppEvidence=asar-unpacked` / `unpacked-app` / `none`、package name 和 resolver reason code，不输出 packaged root 或 binary path；临时目录、缺少 identity、`optionalDependenciesInstallChainVerified=false` 或缺少真实 optional package / binary 时，即使具备 evidence，也不能让 `realPackagedBinaryVerified=true`。
- `native-runtime:benchmark` summary 已新增 `nativeSearchGate`，输出 Chat / Agent TS vs native 的 P95、event-loop delay P95、work-delay P95 delta、benchmark blockers 和 default-enable blockers。benchmark blockers 只评价性能与 event-loop gate；default-enable blockers 固定包含 `optional_package_install_chain_not_evaluated` 与 `packaged_app_bundled_binary_not_evaluated`，避免 benchmark 通过或无 native binary 时误报可默认启用。
- `native-runtime:benchmark` summary 已更新 `agentFacadeSearch`：生产 Agent source 使用受限 `agent_message_search_text` extractor 表示 native eligible；无 native binary 时 `nativeParityEvaluated=false`，有 `native-agent-runtime-production-facade-search` case 时仅证明 Agent facade nested parity，不代表 default enable。全局 `nativeSearchGate.defaultEnableCandidate` 仍固定为 `false`。
- `2bf88a5a` 已新增 `nativeSearchDefaultEnableReadiness`：benchmark summary 从 `nativeSearchGate` / `agentFacadeSearch` 推导性能与 Agent parity 输入，smoke summary 从 optional / packaged smoke 字段推导 publication、declaration、install-chain、packaged evidence / identity 和 real binary 输入。`348e003d` 已进一步加入 `packaging_config_not_verified` blocker，`6ae1c896` 已加入 `optional_packages_not_published` blocker。任一视角缺少真实 optional / packaged / builder allowlist / risk review 输入时，summary 都必须保持 `defaultEnableCandidate=false` 与 `explicitOptInRequired=true`。
- `dedbfed1` 已新增 `packagedBundledBinarySmokePlan`：smoke summary 现在输出 `status`、`blockedBy`、`requiredInputs`、`nextAllowedActions`、`forbiddenActions` 和 `candidateCommand`。当前默认 `packaged-manifest` / `packaged-app-layout` 均为 `status="blocked"`；`ready` 只代表前置输入具备，`verified` 必须同时满足顶层 `bundledBinaryVerified=true` 且无 blocker。
- `ce89f490` 已新增 `optionalPackageExecutionPlan`：smoke summary 现在把 publish-target preflight、package-source preflight、optional package publication、optionalDependencies declaration、optional package install-chain、packaging config allowlist、packaged app bundled binary smoke 和 default-enable risk review 串成机器可读下一步。当前 `optional-package-source` 只会记录 `observedEvidenceStages=["package_source_preflight"]` 且 `nextStage="publish_target_preflight"`；显式 publish-target registry dry-run 与 source preflight 都 ready 时，`nextStage="optional_package_publication"`、`readyForPublication=true`，但真实 gates 仍保持 false。
- `a3f98673` 已新增 `packagingConfigAllowlistChangePlan`：smoke summary 现在把 builder allowlist 实际修改前的 review checklist 机器可读化。当前 plan 输出 4 个 required includes（`node_modules/@codeinsights/native-search-darwin-arm64/**/*`、`node_modules/@codeinsights/native-search-darwin-x64/**/*`、`node_modules/@codeinsights/native-search-win32-x64/**/*`、`node_modules/@codeinsights/native-search-linux-x64/**/*`）和 blocker `!node_modules/@codeinsights/**`；它只能作为实际修改前置输入，不能替代 approval、builder config 修改、packaging config verified 或 packaged app bundled binary smoke。
- `ddc818ae` 已新增 `packagingConfigAllowlistChangePlan.candidateYamlEditPlan`：当前计划仍要求添加上述 4 个精确 include，移除 `!node_modules/@codeinsights/**`，并拒绝 `node_modules/**`、`node_modules/@codeinsights/**`、`node_modules/@codeinsights/native-search-*` 和 `node_modules/@codeinsights/native-search-*/**/*` 这类宽泛 include；它不修改 builder config，也不证明 packaged binary。
- `7726a008` 已新增 `optionalDependenciesInstallChainChangePlan`：smoke summary 现在把真实 optionalDependencies 声明与安装执行前的 review checklist 机器可读化。当前 plan 输出 4 个 planned exact optionalDependency spec（`0.0.3`）、publication / declaration / install-chain / lockfile / installed package blockers、candidate verification commands 和 forbidden actions；它只能作为实际声明与安装执行前置输入，不能替代 package publication、package.json / lockfile 修改、installed package verification、packaging config verified 或 packaged app bundled binary smoke。
- `8097ed4c` / `2188e276` / `d679eabb` 已新增并收紧 `optionalPackagePublicationChangePlan`：smoke summary 现在把真实 optional package 发布前的 review checklist 机器可读化。当前显式 publish-target registry dry-run 与 source preflight 都 ready 时，plan 可进入 `ready_for_review` 并输出候选 `npm publish <native-search-package-source:...> --access public` 命令；但 `publishedPackages` 仍只保留真实 registry publication evidence，`publishTargetCollisionPackages` / `existingInvalidPublishedPackages` 只会进入 `commandExcludedPackages`，不能替代 package publication 或 packaged binary smoke。
- `edeba827` 已新增 `packagedBundledBinarySmokeInvocationPlan`：smoke summary 现在把真实 packaged app bundled binary smoke 的推荐调用输入机器可读化。候选命令优先使用 `--packaged-app-root <packaged-app-root> --check-registry`，legacy 命令保留 `--app-node-modules-root <packaged-app-node_modules> --check-registry`；plan 输出 `inputMode`、root 是否提供 / resolved、evidence code、blocked reason、required inputs、acceptance evidence、candidate command、legacy candidate command 和 forbidden actions。`ready_for_execution` 只表示调用输入与前置 gate 齐备；`verified` 仍必须绑定顶层 `bundledBinaryVerified=true` 且无 blocker。它不创建 packaged app、不发布、不安装、不改 builder、不读取 binary，也不输出 packaged app root、node_modules root 或 binary path。
- `f949fc13` / `77b266e8` 已新增并收紧 `optionalPackagePublicationInvocationPlan`：smoke summary 现在把真实 optional package publication 调用输入机器可读化。当前 package 未发布但 publish-target / source / publication preflight 可审核时，plan 可以进入 `ready_for_invocation` 并输出候选 `npm publish <native-search-package-source:...> --access public` 命令；该状态只表示调用形状 ready，不执行 publish，不等于 package published。顶层 `publishedPackages` 只能从 per-package `status="published"` 汇总，且完整 verified 必须要求 planned / published package 集合唯一且严格匹配；invalid、unavailable、duplicate、collision 或矛盾 evidence 只能阻断 / 排除，不能替代 package publication。
- `4fec7fab` 已新增 `nativeSearchReleaseHandoffPlan`：当前显式 publish-target registry dry-run 与 source preflight 都 ready 时，handoff 可以进入 `ready_for_release_handoff` 且 `nextGate="optional_package_publication"`，并输出候选 publish 命令；但 `doesNotVerify` 必须继续包含 optional packages published、optionalDependencies declared / installed、packaging config verified、packaged binary verified 和 default-enable candidate。默认 `packaged-manifest` 仍必须 `status="blocked"` 且 `nextGate="publish_target_preflight"`。该 plan 不运行远程写入、不安装、不修改 builder、不创建 packaged app、不证明 bundled binary。
- `3f5a0783` 已收紧 release handoff fail-closed 证据：`nativeSearchReleaseHandoffPlan.gateBinding` 必须让 ready / verified 受 `optionalPackageExecutionPlan` 顺序 gate 约束，`packagedBundledBinarySmokeInvocationPlan.executionDesign` 只记录真实 packaged smoke 输入设计，不得被当作真实 packaged app 或 bundled binary evidence。
- `ddc818ae` 已收紧 builder allowlist 实际修改前置证据：`candidateYamlEditPlan` 只说明可审查的 YAML edit intent，不能让 `readyForPackagingConfigChange`、`packagingConfigVerified`、`realPackagedBinaryVerified` 或 default-enable gate 误通过。
- `99d76b0c` 已收紧 release handoff 批准边界：`currentGateApprovalPacket` 只能表示当前 next gate 的批准准备，不能让 `ready_for_approval`、候选 publish command 或 release handoff ready 被误当作真实 publication、optionalDependencies install-chain、builder allowlist、packaged binary 或 default-enable evidence。
- `197569d5` 已收紧 release handoff 全 gate 批准边界：`gateApprovalQueue` 只能表示 gate 顺序和批准准备，不能让未来 gate 的 candidate command 提前出现，也不能把 queue ready 当作真实 publication、optionalDependencies declaration / install-chain、builder allowlist、packaged smoke 或 default-enable evidence。
- `cb30b819` 已收紧 release handoff 执行证据边界：`gateExecutionEvidenceChecklist` 只能表示批准后应产出的 evidence 清单和当前 gate 的 post-execution verification command，不能把 checklist、success criteria 或 future gate evidence 当作真实 publication、optionalDependencies declaration / install-chain、builder allowlist、packaged smoke 或 default-enable evidence。
- `72a00b01` 已收紧 execution evidence side-effect 口径：`networkRequired` 必须跟随批准后验证命令的真实副作用，而不是只看当前 gate 是否暴露命令；future / blocked gate 仍然不能暴露执行命令或授权联网。
- `b874628b` 已收紧 release handoff 状态迁移边界：transition expectation 只能表示每个 gate 在真实执行并验证后应到达的 next gate、应变 true 的 summary flags 和仍必须保持 false 的后续 gate / 子证据字段，不能把 expected flags 当作当前 summary evidence，也不能跳过 optionalDependencies declaration / install-chain / packaging config / packaged smoke / default-enable 的真实顺序 gate。
- `66da7eba` 已收紧 release handoff 迁移验收边界：transition verifier 只比较 before / after summary，不执行任何 gate，也不把 `ready_for_approval`、candidate command、expected flag、top-level boolean 或 blocked packaged smoke plan 当作真实执行证据。中间 gate readiness 可以进入 `ready_for_approval`，但这只表示当前 gate 可审核，不等于 declaration / install-chain / builder / packaged smoke 已完成。
- `461295b0` 已收紧 release handoff 执行输入边界：execution input packet 只能说明“当前 gate 在批准后可以执行什么、会产生什么副作用、执行后要补哪些证据”，不能把 packet 的命令、验收项或 side-effect 标记当成真实 execution evidence；default-enable packet 在当前 smoke 中仍 blocked。
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
bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode optional-package-source --native-search-package-version 0.0.3
bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode packaged-app-layout
bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode packaged-app-layout --packaged-app-root <packaged-app-root> --check-registry
bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode packaged-app-layout --app-node-modules-root <packaged-app-node_modules> --check-registry
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
| packaged optional package publish-target dry-run | 显式计划版本；默认离线，显式 `--check-registry` 只读 npm packument | 目标版本可发布 / collision / invalid / unavailable 分流；版本不一致时由 `native_search_binary_version_not_release_ready` 阻断 release-ready；target ready 不等于 published |
| packaged optional package source preflight | planned in-memory npm package source blueprint | 校验 source package metadata / files / publishConfig / manifest plan；`optionalPackageSourceReady=true` 不等于 pack / publish / install / packaged verified |
| packaged optional package publication change plan | 聚合 publish-target / source / publication preflight | 输出真实 `npm publish` 前 review checklist；`ready_for_review` 不等于 published，`publishedPackages` 只表示真实 registry publication evidence，collision / invalid metadata 只排除候选命令 |
| packaged optional package publication invocation plan | 聚合 publication change plan / package-level publication evidence | 输出真实 `npm publish` 调用输入、候选命令和验收证据；`ready_for_invocation` 不等于 published，顶层 `publishedPackages` 只能来自 package-level `status="published"` 且必须与 planned set 唯一严格匹配 |
| packaged optionalDependencies install-chain preflight | 当前 Electron package manifest + `bun.lock` + installed package manifests | 未声明时 skipped 且 `optionalDependenciesInstallChainVerified=false`；声明存在但 lockfile / installed package 不完整或 installed manifest metadata 不合规时 failed |
| packaged packaging config preflight | 当前 `apps/electron/electron-builder.yml` files 规则 | 未开始 optional package opt-in 时 skipped 但 summary 输出 `packagingConfigVerified=false`；任一计划 package 已声明后，builder allowlist 未通过必须 failed |
| packaged resolver fixture | 临时 optional package + fake executable + PATH decoy | resolver 只接受 app `node_modules` allowlist 内 fixture，SHA-256 匹配，`fixtureBundledPackageVerified=true`，`realPackagedBinaryVerified=false` |
| packaged app layout preflight | 推荐显式传入已有 packaged app root；legacy 可传 packaged app `node_modules` root | layout 可通过 resolver 校验；无 root 时 skipped；支持 `.app/Contents/Resources/app/node_modules`、`.app/Contents/Resources/app.asar.unpacked/node_modules`、直接 `Resources`、直接 `Resources/app`、直接 `app.asar.unpacked` 和 legacy node_modules root；`unpacked-app` 还需 app identity 校验；临时 fixture或缺少 identity 不能证明真实 packaged binary |
| packaged bundled binary smoke plan preflight | 聚合 optional publication / optionalDependencies / install-chain / packaging config / prebuilt app root gate | 输出 `packagedBundledBinarySmokePlan`；当前 `status="blocked"`，`ready` 不等于 verified，`verified` 必须绑定 `bundledBinaryVerified=true` 且无 blocker |
| packaged bundled binary smoke invocation plan | 聚合 packaged app root resolution / legacy node_modules root compatibility / packaged smoke preconditions | 输出 `packagedBundledBinarySmokeInvocationPlan` 与 `executionDesign`；推荐候选命令使用 `--packaged-app-root <packaged-app-root> --check-registry`，legacy 命令使用 `--app-node-modules-root <packaged-app-node_modules> --check-registry`；`ready_for_execution` 不等于 verified |
| native search release handoff plan | 聚合 publication invocation / optionalDependencies install-chain change / builder allowlist change / packaged smoke invocation / execution plan | 输出 `nativeSearchReleaseHandoffPlan` 与 `gateBinding`；`ready_for_release_handoff` 只表示当前 `nextGate` 可交接人工审核或执行，不等于 publish / install / builder / packaged / default-enable verified，乱序后置 evidence 必须 fail closed |
| native search release handoff no-go audit | 只读消费 smoke summary / handoff plan / default readiness | 输出 `nativeSearchReleaseHandoffNoGoBoundaryAudit` 和 `release-handoff-no-go-boundary-audit` case；audit failed 必须让 smoke CLI fail closed，audit passed 不等于真实 gate verified |

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
bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode optional-package-source --native-search-package-version 0.0.3
bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode packaged-app-layout
bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode packaged-app-layout --packaged-app-root <packaged-app-root> --check-registry
bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode packaged-app-layout --app-node-modules-root <packaged-app-node_modules> --check-registry
```

- `native-missing` 已作为非 packaged smoke 可执行，输出 JSON summary，不打印 binary path。
- `native-available` 仅验证显式本地 binary 的 status / search / shutdown；它不是 bundled binary smoke。
- `protocol-mismatch`、`crash`、`timeout` 已作为非 packaged fake sidecar smoke 可执行，输出 JSON summary，不打印 fake sidecar 路径。
- `cache-corruption` 已作为 isolated cache smoke 可执行，使用临时 `CODEINSIGHTS_CONFIG_DIR`，不读取真实配置目录。
- `packaged-manifest` 已作为 optional package manifest 预检、optional package publication preflight、optionalDependencies declaration preflight、optional package install-chain preflight、packaging config allowlist preflight、release handoff no-go audit 和 packaged resolver fixture 可执行，校验 4 个平台包的 manifest 契约、当前平台计划、只读 registry packument、当前 Electron package manifest 声明、`bun.lock` resolved entry、installed package manifest 严格 package.json metadata、当前 builder files allowlist、临时 optional package fixture 的 manifest / binary SHA-256 / no PATH lookup / app `node_modules` allowlist；它仍不是真实 packaged app bundled binary smoke。
- `packaged-manifest` 默认 summary 当前边界必须保持：`bundledBinaryVerified=false`、`fixtureBundledPackageVerified=true`、`usesTemporaryFixture=true`、`optionalPackagePublicationChecked=false`、`optionalPackagesPublished=false`、`optionalPackagePublicationChangePlan.status="blocked"`、`optionalPackagePublicationInvocationPlan.status="blocked"`、`optionalDependenciesDeclared=false`、`missingOptionalDependencies=[4 packages]`、`invalidOptionalDependencies=[]`、`optionalDependenciesInstallChainVerified=false`、`optionalDependenciesLockfileVerified=false`、`optionalDependenciesInstalledPackagesVerified=false`、`packagingConfigVerified=false`、`missingPackagingConfigPackages=[4 packages]`、`blockingPackagingConfigExcludes=["!node_modules/@codeinsights/**"]`、`packagingConfigAllowlistChangePlan.status="blocked"`、`packagingConfigAllowlistChangePlan.approvalRequired=true`、`optionalDependenciesInstallChainChangePlan.status="blocked"`、`optionalDependenciesInstallChainChangePlan.approvalRequired=true`、`nativeSearchReleaseHandoffPlan.status="blocked"`、`nativeSearchReleaseHandoffPlan.nextGate="publish_target_preflight"`、`nativeSearchReleaseHandoffPlan.gateBinding.authoritativeNextGate="publish_target_preflight"`、`nativeSearchReleaseHandoffNoGoBoundaryAudit.passed=true`、`packagedBundledBinarySmokeInvocationPlan.executionDesign.realPackagedAppRequired=true`、`realPackagedBinaryVerified=false`、`packagedBundledBinarySmokePlan.status="blocked"`。显式 `--check-registry` 当前必须 failed：4 个计划 package 均在 `missingPublishedOptionalPackages`，`optional_packages_not_published` blocker 生效。
- `optional-package-publish-target` 已作为只读 publish target dry-run 可执行。默认离线 summary 当前边界必须保持：`optionalPackagePublishTargetChecked=false`、`optionalPackagePublishTargetReady=false`，blockers 至少包含 `registry_check_required`；若 Cargo version 与 source `BINARY_VERSION` 不一致，还必须包含 `native_search_binary_version_not_release_ready`。显式 `--check-registry --native-search-package-version 0.0.3` 当前必须 ready：4 个计划 package 目标版本可发布、无 registry collision，且 source `BINARY_VERSION=0.0.3` 已通过 consistency gate；该 ready 仍不等于 publication / install-chain / packaging config / packaged app bundled binary verified。
- `optional-package-source` 已作为只读 source blueprint preflight 可执行。当前 summary 边界必须保持：`optionalPackageSourceChecked=true`、`optionalPackageSourceReady=true`、`optionalPackageSourceVersion="0.0.3"`、`optionalPackageSourceBlockers=[]`、4 个 `optionalPackageSourceReadyPackages`、`plannedOptionalPackageSourceManifestsVerified=true`；该 ready 仍不等于 `npm pack` / publication / optionalDependencies declaration / install-chain / packaging config / packaged app bundled binary verified，也不能改变 native default off。
- `packaged-app-layout` 已作为只读 packaged app layout preflight 可执行。无 `--packaged-app-root` 或 `--app-node-modules-root` 时 summary 为 `requiresPrebuiltPackagedApp=true`、`realPackagedBinaryVerified=false` 且 case skipped；推荐传入 packaged app root，legacy `--app-node-modules-root` 仍可用于兼容且优先，但 legacy root 不存在时必须进入 `app_node_modules_root_unresolved`。有显式 root 时只验证 resolver layout，不从 `PATH` 查找。显式 `--check-registry` 会追加 publication failed case 并让 CLI 返回非零。当前 evidence classifier 同时支持 `app.asar` + `app.asar.unpacked/node_modules` 和 `asar: false` 的 `Resources/app/node_modules` + `Resources/app/package.json`；`realPackagedBinaryVerified=true` 必须同时满足 resolver 成功、非临时 fixture、`optionalPackagesPublished=true`、`packagedAppEvidenceVerified=true`、`packagedAppIdentityVerified=true`、`optionalDependenciesDeclared=true`、`optionalDependenciesInstallChainVerified=true`、`packagingConfigVerified=true` 和真实 optional package / binary 存在。临时 fixture、`asar-unpacked` 无 identity、伪造 app identity、缺失 publication、缺失 optionalDependencies 声明或 install-chain preflight 未通过都不能设置 `realPackagedBinaryVerified=true`。
- `packagedBundledBinarySmokePlan` 当前只表达执行计划：`blockedBy` 至少包含 `optional_packages_not_published`、`optional_dependencies_not_declared`、`optional_package_install_chain_not_verified`、`packaging_config_not_verified` 和 `prebuilt_packaged_app_required`。它不读取 binary、不安装 package、不写 package manifest、不修改 builder，也不输出 packaged app root 或 binary path。
- `packagedBundledBinarySmokeInvocationPlan` 当前只表达真实 packaged smoke 调用计划：推荐命令为 `--packaged-app-root <packaged-app-root> --check-registry`，legacy 命令为 `--app-node-modules-root <packaged-app-node_modules> --check-registry`。它输出 `inputMode`、root 是否 resolved、evidence code、blocked reason、acceptance evidence、forbidden actions 和 `executionDesign`；`executionDesign` 只记录 preferred / legacy input mode、registry check required、real packaged app required、temporary fixture forbidden as real evidence，以及不创建 packaged app、不发布、不安装、不修改 builder 的边界。不输出 packaged app root、node_modules root 或 binary path，也不能把 `ready_for_execution` 当作 `bundledBinaryVerified=true`。
- `packagingConfigAllowlistChangePlan` 当前只表达 builder allowlist 实际修改前的 review 输入：必须输出 4 个精确 required include，当前缺失这些 include，并报告 `blockingExcludes=["!node_modules/@codeinsights/**"]`。`status="blocked"` 表示当前配置仍未通过；即使未来进入 `ready_for_review`，也只代表可提交人工审核，不代表 builder 已修改或 packaging config verified。
- `optionalDependenciesInstallChainChangePlan` 当前只表达真实 optionalDependencies 声明与安装执行前的 review 输入：必须输出 4 个计划 exact spec（当前 `0.0.3`），并报告 publication / declaration / install-chain / lockfile / installed package blockers。`status="blocked"` 表示当前安装链路仍未通过；即使未来进入 `ready_for_review`，也只代表可提交人工审核，不代表 package 已发布、package.json / lockfile 已修改、installed package 已验证或 packaged binary verified；installed package manifest 只有 `name/version` 或含 lifecycle scripts / runtime dependencies 时仍必须阻断。
- `optionalPackagePublicationChangePlan` 当前只表达真实 optional package 发布前的 review 输入：必须输出 4 个 planned package / version、candidate preflight commands、候选 publish commands 和 forbidden actions。`status="ready_for_review"` 只代表 publish-target / source / publication preflight 形状允许进入人工审核，不代表包已发布；`publishedPackages` 只表示真实 registry publication evidence，`publishTargetCollisionPackages` 与 `existingInvalidPublishedPackages` 只进入 `commandExcludedPackages` 并排除候选 publish command。
- `optionalPackagePublicationInvocationPlan` 当前只表达真实 optional package publication 调用前的 invocation 输入：必须输出 required inputs、candidate commands、per-package invocation blockers、acceptance evidence 和 forbidden actions。`status="ready_for_invocation"` 只代表可以人工审核并调用 publish 命令，不代表包已发布；顶层 `publishedPackages` 只能来自 package-level `status="published"` 的有效 exact registry evidence，invalid / unavailable / duplicate / collision 只能进入 blocker / exclusion。
- `nativeSearchReleaseHandoffPlan` 当前只表达真实 release 链路下一步交接：默认 `packaged-manifest` 必须 blocked 到 `publish_target_preflight`，且 `gateBinding.authoritativeNextGate` 必须同为 `publish_target_preflight`；当显式 publish-target + source ready 且 publication invocation ready 时，可以输出 `status="ready_for_release_handoff"`、`nextGate="optional_package_publication"` 和候选 publish commands。它的 `doesNotVerify` 必须覆盖 `optional_packages_published`、`optional_dependencies_declared`、`optional_dependencies_installed`、`packaging_config_verified`、`packaged_binary_verified` 和 `default_enable_candidate`；`gateBinding.verifiedRequiresExecutionPlanVerified=true`、`failClosedOnOutOfOrderEvidence=true`，`ready_for_release_handoff` 不能替代真实发布、安装、builder 修改、packaged smoke 或 default-enable 风险决策。
- Publish-target dry-run 当前只表达“目标版本是否可尝试发布”：summary 字段包含 `optionalPackagePublishTargetChecked`、`optionalPackagePublishTargetReady`、`optionalPackagePublishTargetVersion`、`optionalPackagePublishTargetBlockers`、`publishTargetAvailablePackages`、`publishedVersionCollisionPackages`、`invalidPublishTargetPackages`、`unavailablePublishTargetPackages`、`nativeSearchVersionConsistencyVerified`、`nativeSearchCargoVersion`、`nativeSearchBinaryVersion` 和 `plannedOptionalPackageManifestsVerified`。它不能设置 `optionalPackagesPublished=true`，不能替代 publication / install-chain / packaging config / packaged app evidence / real binary verification，也不能改变 native default off。
- Source preflight 当前只表达“计划发布的 source metadata 是否可进入下一步”：summary 字段包含 `optionalPackageSourceChecked`、`optionalPackageSourceReady`、`optionalPackageSourceVersion`、`optionalPackageSourceBlockers`、`optionalPackageSourceReadyPackages`、`missingOptionalPackageSourcePackages`、`invalidOptionalPackageSourcePackages` 和 `plannedOptionalPackageSourceManifestsVerified`。它不能运行 `npm pack`、发布、安装、读取 binary、证明 SHA、修改 optionalDependencies / builder，也不能设置 `optionalPackagesPublished=true` 或改变 native default off。

Smoke output rules:

- 不打印 token、Authorization、credentialed URL、完整 home path。
- 不把 `binaryPath` 推给 renderer。
- `packaged-app-layout` 失败 detail 只输出 package name 和 resolver reason code，不输出 app root、temp path、`app.asar.unpacked`、binary path 或 raw fs error。
- `native-runtime-smoke` CLI 遇到任意 case `status=failed` 时必须返回非零退出码；skipped preflight 只能表示当前阶段缺少真实 packaged input，不能掩盖 failed gate。
- 不读取用户真实 `~/.codeinsights/`；使用隔离 `CODEINSIGHTS_CONFIG_DIR` fixture。
- 不 push、不创建 PR、不触发真实模型调用。

## Optional Package Plan

后续计划已缩减为 3 个核心 gate：先做当前可验证平台的最小真实 optional package gate，拿到真实 package source / publication / registry evidence；再做最小 install-chain gate，声明对应 optionalDependency、执行真实 install 并验证 `bun.lock` 与 installed manifest metadata；最后做最小 packaged smoke gate，进行精确 builder allowlist 修改并验证一个真实 packaged app bundled binary 不走系统 `PATH`。default-enable 继续暂缓；即使最小 packaged opt-in 通过，也只记录 packaged opt-in 可用，不默认启用 native。全平台 CI / 发布矩阵、Go supervisor、Phase 6 / 7 / 9 和 helper-only approval / handoff / dry-run 新增工作均不进入当前后续计划。

当前已实现 optional package source preflight、optional package publication preflight、optional package publication change plan、optional package publication invocation plan、publication invocation 证据收紧、release handoff 证据计划、release handoff fail-closed 证据收紧、release handoff no-go audit summary / smoke case 外显、optionalDependencies declaration preflight、optional package install-chain preflight、install-chain installed manifest metadata 加固、packaging config allowlist preflight、builder allowlist dry-run plan 和 optionalDependencies install-chain dry-run plan，但仍不修改 `apps/electron/package.json` 的 `optionalDependencies`，不修改 `bun.lock`，不修改 `electron-builder.yml`；真实 optional package 发布、package.json 实际声明、lockfile 与 installed package 实物链路、builder allowlist 实际修改仍未完成。显式只读 registry 检查显示 `@codeinsights/native-search-darwin-arm64`、`@codeinsights/native-search-darwin-x64`、`@codeinsights/native-search-win32-x64`、`@codeinsights/native-search-linux-x64` 当前均进入 `missingPublishedOptionalPackages`，同时 packaging config preflight 明确报告当前 `apps/electron/electron-builder.yml` 缺少 per-package include 且 `!node_modules/@codeinsights/**` 会阻断这些包；publication change plan 只把 planned packages、preflight commands、candidate publish commands、forbidden actions、published evidence 和 command exclusions 整理为 review 输入；publication invocation plan 只把真实 publish 调用输入、候选命令、per-package blockers、acceptance evidence 和 forbidden actions 整理为 invocation 输入，`ready_for_invocation` 不等于 published；release handoff plan 只把当前顺序 `nextGate`、required approvals、missing evidence、candidate commands、doesNotVerify、forbidden actions 和 `gateBinding` 整理为交接输入，`ready_for_release_handoff` 不等于真实远程写入、安装、builder 修改、packaged verified 或 default enable，乱序后置 evidence 必须 fail closed；no-go audit summary / smoke case 只证明边界一致，不证明任何真实 gate；packaged smoke invocation plan 的 `executionDesign` 只描述真实 packaged smoke 调用设计，不创建 packaged app 或真实证据；`publishedPackages` 只能来自 package-level `status="published"` 且必须与 planned package set 唯一严格匹配；builder allowlist dry-run plan 只把 required include、blocking exclude、removal candidates、forbidden actions 和验证命令整理为 review 输入；optionalDependencies install-chain dry-run plan 只把 planned exact specs、publication / declaration / install-chain / lockfile / installed package blockers、forbidden actions 和验证命令整理为 review 输入。因此在真实包发布、安装链路获准执行且 builder allowlist 获准调整前，不能安全进入实际 optionalDependencies 声明 / 安装执行，也不能证明 packaged app bundled binary。

若未来经用户明确批准重新打开 packaged native binary 阶段，候选包名按平台拆分：

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

当前已落地的 optional package source helper 约束：

- source preflight 只验证 planned in-memory package source blueprint，不创建实际 package 目录、不运行 `npm pack`、不发布、不安装、不读取 binary。
- package source manifest 必须匹配 planned package name / version，`private` 必须为 `false`，必须有 description / license，`os` / `cpu` 必须精确匹配平台计划。
- `bin.codeinsights-native-search` 必须精确指向 `bin/{binaryName}`；`files` 只能是 `package.json`、`native-search-package.json` 和 `bin/{binaryName}`；`publishConfig.access` 必须为 `public`。
- source preflight 必须拒绝 path-like 字段、运行时 dependency 字段，以及 install / publish lifecycle scripts，例如 `preinstall`、`install`、`postinstall`、`prepublish`、`prepublishOnly`、`publish`、`postpublish`。
- `optionalPackageSourceReady=true` 不能设置 `optionalPackagesPublished=true`，也不能替代 optionalDependencies declaration / install-chain、packaging config、packaged app evidence / identity 或真实 binary verification。

当前已落地的 optionalDependencies / install-chain helper 约束：

- optionalDependencies 声明必须覆盖 4 个 native search 平台包。
- optionalDependencies preflight 额外记录 `presentPackages`；只要任一计划 native package 已出现在 `optionalDependencies`，packaging config allowlist 未通过就必须让 smoke failed，不能继续 skipped。
- version spec 只接受 exact semver 或 `npm:<同名 native search package>@exact-semver`；跨包 alias、跨平台 alias、`latest` / range、空值、非字符串、`file:`、`workspace:`、git / http URL 和 path-like spec 均为 invalid。
- install-chain preflight 必须同时满足 declaration gate、`bun.lock` resolved package entry 和 installed package manifest package name / version 一致；installed package manifest 还必须满足 optional package source package.json 严格 shape，包含 exact version、`os` / `cpu`、`bin`、精确 `files` 和 `publishConfig.access=public`。
- lockfile 预检必须命中 resolved package entry，不能因为 importer dependency 文本包含包名就通过。
- 当前仓库未声明真实 `@codeinsights/native-search-*` optionalDependencies 时，install-chain preflight 是 skipped 且 summary 为 `optionalDependenciesInstallChainVerified=false`；一旦声明存在但 lockfile / installed package manifest 不完整或 metadata 不合规，smoke case 必须 failed。
- install-chain helper 不读取 `bin/{binaryName}`，不校验 binary 可执行性，不输出 package root / binary path，不证明真实 packaged app bundled binary。
- optionalDependencies install-chain dry-run plan 只能输出 planned exact specs 和 review checklist：当前 4 个 spec 必须为 `0.0.3`，blockers 必须包含 publication、declaration、install-chain、lockfile 与 installed package 未验证项。它不写 `apps/electron/package.json`、不写 `bun.lock`、不运行 `bun install`、不读取 installed package root / binary path、不证明 packaged binary，也不能设置 `optionalDependenciesDeclared=true` 或 `optionalDependenciesInstallChainVerified=true`。

当前已落地的 optional package publication helper 约束：

- 默认 smoke 不联网；只有显式 `--check-registry` 才只读查询 npm registry packument。
- 404 只进入 `missingPublishedOptionalPackages`；非 OK 或 fetch error 进入 `unavailablePublishedOptionalPackages`；metadata schema / os / cpu / bin 不匹配进入 `invalidPublishedOptionalPackages`。
- 当 exact expected version 存在但 metadata schema / os / cpu / bin 不匹配时，必须进入 `existingInvalidPublishedPackages`；它只说明目标版本被无效 metadata 占用，不能进入 `publishedPackages`。
- 当当前 Electron package manifest 已经声明 exact optionalDependency version 时，publication helper 必须校验 registry `versions[expectedVersion]`，不能只验证 `dist-tags.latest`。
- `packaged-manifest --check-registry` 和 `packaged-app-layout --check-registry` 当前 no-go 时都必须返回非零退出码。
- publication helper 不安装 package、不修改 lockfile、不读取 installed package、不读取 binary、不输出 registry URL、home path 或 binary path。

当前已落地的 optional package publication change plan helper 约束：

- 只消费 publish-target dry-run、source preflight 和 publication preflight 结果；不查询 registry、不运行 `npm publish` / `npm pack`、不安装、不写 manifest / lockfile / builder、不读取 binary。
- `status="ready_for_review"` 只表示可提交人工审核；不能设置 `optionalPackagesPublished=true`，也不能替代 optionalDependencies declaration / install-chain、packaging config、packaged app evidence / identity 或真实 binary verification。
- `publishedPackages` 只保留 registry exact expected version 且 metadata 有效的真实发布证据；`publishTargetCollisionPackages` 与 `existingInvalidPublishedPackages` 只进入 `commandExcludedPackages`，用于排除候选 publish command，不代表已发布成功。
- `candidatePublicationCommands` 必须使用 `<native-search-package-source:{packageName}>` 占位，不输出本地 package source 路径、home path、registry URL 或 binary path。

当前已落地的 optional package publication invocation plan helper 约束：

- 只消费 optional package publication change plan 和 publication evidence；不查询 registry、不运行 `npm publish` / `npm pack`、不安装、不写 manifest / lockfile / builder、不读取 binary。
- `status="ready_for_invocation"` 只表示真实 publish 调用输入和候选命令形状已具备；不能设置 `optionalPackagesPublished=true`，也不能替代 optionalDependencies declaration / install-chain、packaging config、packaged app evidence / identity 或真实 binary verification。
- 顶层 `publishedPackages` 只能从 per-package `status="published"` 汇总；完整 publication verified 必须要求 planned package 集合与 published package 集合唯一且严格匹配。
- invalid、unavailable、duplicate、collision、missing 或 plan-level 矛盾 evidence 只能进入 blocker / exclusion；不能让 `not_required_already_published`、`optionalPackagesPublished`、`bundledBinaryVerified` 或 default-enable gate 误通过。
- `candidateCommands` 必须使用 `<native-search-package-source:{packageName}>` 占位，不输出本地 package source 路径、home path、registry URL 或 binary path。

当前已落地的 packaging config helper 约束：

- 只读解析 `electron-builder.yml` 顶层 `files:` 列表；当前未支持 inline array / FileSet object 时必须保守保持 `verified=false`。
- 只有显式 per-package include 计入通过，例如 `node_modules/@codeinsights/native-search-darwin-arm64/**/*`。
- `node_modules/**`、`node_modules/@codeinsights/**`、`node_modules/@codeinsights/native-search-*` 这类 broad include 不能作为 allowlist 通过；`!node_modules/@codeinsights/**`、`!node_modules/**`、`!node_modules/@codeinsights/native-search-*/bin/**` 这类阻断 required path 的 exclude 必须进入 blocker。
- 当前仓库 `packagingConfigVerified=false`，缺少 4 个计划 package include，且 `blockingPackagingConfigExcludes=["!node_modules/@codeinsights/**"]`。
- builder allowlist dry-run plan 当前要求的精确 include 为 `node_modules/@codeinsights/native-search-darwin-arm64/**/*`、`node_modules/@codeinsights/native-search-darwin-x64/**/*`、`node_modules/@codeinsights/native-search-win32-x64/**/*` 和 `node_modules/@codeinsights/native-search-linux-x64/**/*`；当前 `status="blocked"`，因为真实 config 仍未通过且存在阻断 exclude。
- dry-run plan 的 `candidateVerificationCommands` 只能作为后续获准修改后的验证建议；本阶段不得据此直接改 `electron-builder.yml`，也不得把计划输出当成 packaged smoke evidence。

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
