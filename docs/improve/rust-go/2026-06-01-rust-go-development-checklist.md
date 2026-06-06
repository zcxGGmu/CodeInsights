# Rust / Go 优化重构开发跟踪清单

> 日期：2026-06-01
> 依据方案：`docs/improve/rust-go/2026-06-01-rust-go-optimization-plan.md`
> 当前分支：`rust-go-refactor`
> 适用范围：CodeInsights Electron main / preload / renderer、`packages/shared` 契约、JSON / JSONL 本地事实源、Agent / Pipeline 搜索与 records tail、workspace 文件索引、大文件预览、native runtime diagnostics、Rust sidecar、可选 Go supervisor、打包与发布验收。
> 说明：本文是后续迭代开发的执行清单，不代表 Rust / Go native 功能已经实现。每个阶段都必须先满足入口条件，再按清单开发、验证、Review 和单独提交。

## 最新开发状态

> 更新时间：2026-06-06
> 最新开发基线：`77b266e8 fix(rust-go): 收紧 Phase 5 publication invocation 发布证据`。
> 最新已确认恢复入口：`95305503 docs(rust-go): 同步 Phase 5 publication invocation 证据收紧状态`；若本轮状态同步提交后，下次启动以 `git log -5 --oneline` 中最新的 Rust / Go docs 提交为实际恢复入口。
> 当前结论：Rust / Go 优化重构 Phase 0、Phase 1、Phase 2、Phase 3 和 Phase 4 已完成；已建立 shared NativeRuntime DTO / fixtures / benchmark，在 TypeScript fallback 内收敛 Chat / Agent / Pipeline 搜索 facade，完成 Pipeline records cursor tail 与 SearchDialog Pipeline 内容搜索接入，完成 TypeScript workspace 文件索引 cache、watcher invalidation、SearchDialog Workspace 文件分组和安全路径白名单，并补齐 Native Runtime diagnostics 的 IPC / preload / Jotai / Settings UI / SearchDialog 状态可见体验。Phase 5 已完成前置依赖 decision record、sidecar protocol / fallback / packaged smoke 计划、100MB TS fallback benchmark gate、`native/search/` 最小 Rust search-only sidecar 源码切片、Electron main process sidecar manager、Chat search opt-in fallback 边界、Rust vs TS contract parity、100MB native benchmark 对比、search `limit + 1` 早停性能优化、benchmark event-loop 口径增强、native benchmark gate 机器可读汇总、Agent production facade benchmark 分析、Agent nested content native parity、基础 `smoke:native-runtime` 脚本、native-cache manifest schema helper、`protocol-mismatch` / `crash` / `timeout` / `cache-corruption` fake sidecar / isolated cache smoke、optional package manifest schema helper / `packaged-manifest` 预检、bundled package resolver fixture、`packaged-app-layout` 只读 preflight smoke 入口、`asar: false` packaged app evidence classifier、`packagedAppIdentityVerified` 真实 packaged app identity gate、optionalDependencies declaration preflight gate、optional package install-chain preflight gate、default-enable readiness 预检、packaging config allowlist 预检、optional package 发布状态预检、packaged bundled binary smoke 执行计划预检、optional package publish-target dry-run 预检、native search release-ready source version 前置、optional package source preflight、optional / packaged gate 执行顺序预检、builder allowlist dry-run plan、optionalDependencies install-chain dry-run plan、optional package publication change plan 证据拆分、packaged bundled binary smoke invocation plan、optional package publication invocation plan，以及 publication invocation 发布证据收紧；尚未实现 packaged native binary、真实 optional package 发布、optionalDependencies 实际声明与安装执行、builder allowlist 实际修改、真实 packaged app bundled binary smoke、最终 default-enable 风险决策或 Go supervisor。
> 当前策略：Phase 5 native search 仍不能默认启用。本轮已用新增 event-loop samples / baseline / work delay 字段复跑 2 轮 100MB / 20 iterations 稳定 benchmark；Rust native Chat / Agent P95 仍远超性能门槛，Chat work delay gate 达标，但 Agent native `eventLoopWorkDelayP95Ms` 两轮仍高于 TS fallback（0.065ms vs 0ms；0.164ms vs 0.047ms），未扣 baseline 的 Agent `eventLoopDelayP95Ms` 也两轮小幅回退（1.199ms vs 1.121ms；1.191ms vs 1.114ms）。这些差异绝对值很小，但方向仍不支持 default enable；`f86553ee` 已让 benchmark summary 输出 `nativeSearchGate`，机器可读记录 Chat / Agent native vs TS 的 P95、event-loop delay P95 和 work-delay P95 delta，并固定 default-enable 阻塞项。`665c5db7` 新增受限白名单 extractor `agent_message_search_text`，让生产 Agent 搜索 source 可在显式 native opt-in 时用 Rust sidecar 搜索顶层 legacy `content` 或 `message.content[]` 中 `type="text"` 的字符串 block；native 命中仍只作为 cursor anchor，legacy snippet / messageId 继续由 TypeScript 回读 JSONL 后重建。`2bf88a5a` 新增 `nativeSearchDefaultEnableReadiness` 预检；`348e003d` 把 `apps/electron/electron-builder.yml` files allowlist 纳入只读 packaging config gate；`6ae1c896` 进一步把 optional package registry publication 纳入只读 gate；`dedbfed1` 增加 `packagedBundledBinarySmokePlan`，把真实 packaged app bundled binary smoke 的前置条件和禁止动作变成机器可读计划；`9e3e3dff` 增加 `optional-package-publish-target` dry-run，检查计划发布版本、registry 目标版本冲突、planned manifest metadata 和 native source version 一致性；`dc75f380` 将 source `BINARY_VERSION` 与 Cargo version 对齐为 `0.0.3`；`05c393bb` 增加 `optional-package-source` smoke，验证 planned npm package source metadata、精确 files allowlist、`publishConfig.access=public`、`native-search-package.json` 计划，并拒绝 path-like 字段、运行时依赖和 install / publish lifecycle scripts；`ce89f490` 新增 `optionalPackageExecutionPlan`，把 publish target / package source / publication / optionalDependencies / install-chain / packaging config / packaged bundled binary smoke / default-enable risk review 的下一步顺序变成机器可读 summary。当前默认 smoke 不联网，publication summary 为 `optionalPackagePublicationChecked=false`、`optionalPackagesPublished=false`；显式 publication `--check-registry` 仍返回 no-go，4 个计划 `@codeinsights/native-search-*` 包都在 `missingPublishedOptionalPackages`，`optional_packages_not_published` blocker 生效。publish-target 显式 registry dry-run 现在表明 `0.0.3` 目标版本当前 4 个 package 名均可发布、无版本碰撞，且 source version consistency 通过，`optionalPackagePublishTargetReady=true`；optional package source preflight 输出 `optionalPackageSourceReady=true`；二者同时 ready 时 execution plan 只推进到 `nextStage="optional_package_publication"`，`readyForPublication=true`，不等于 package 已发布或 installed。当前 smoke 还明确输出 `packagingConfigVerified=false`、4 个 `missingPackagingConfigPackages` 和 `blockingPackagingConfigExcludes=["!node_modules/@codeinsights/**"]`，并输出 `packagedBundledBinarySmokePlan.status="blocked"`。即使 Agent nested parity、readiness、packaging config no-go gate、publication no-go gate、packaged smoke 执行计划预检、publish-target dry-run、source release-ready version、optional package source preflight 和 optional / packaged gate 执行顺序预检已完成，在真实 optional package 发布、optionalDependencies 实际声明与安装执行、builder allowlist 获准修改、真实 packaged app bundled binary smoke 和最终 default-enable 风险决策完成前，native 必须继续保持显式 opt-in / default off。Go supervisor 仅作为 Phase 9 有条件 spike，不进入默认主线。
> 本轮新增：`f949fc13` 新增 `optionalPackagePublicationInvocationPlan`，把真实 `npm publish` 前的 required inputs、candidate commands、per-package invocation blockers、acceptance evidence 和 forbidden actions 机器可读化；`ready_for_invocation` 只表示可进入人工审核 / 调用，不等于已发布。`77b266e8` 进一步收紧 invocation plan 的发布证据：顶层 `publishedPackages` 只从 package-level `status="published"` 汇总，完整 verified 必须要求 planned package 集合与 published package 集合唯一且严格匹配；invalid、unavailable、duplicate、collision 或矛盾 evidence 只能进入 blocker / exclusion，不能当作已发布。`edeba827` 的 `packagedBundledBinarySmokeInvocationPlan` 边界仍成立：它只输出真实 packaged smoke 调用输入，不创建 packaged app、不发布、不安装、不改 builder、不证明 `bundledBinaryVerified`。

### 当前阶段完成状态

- [x] Rust / Go 优化重构方案文档已生成：`docs/improve/rust-go/2026-06-01-rust-go-optimization-plan.md`。
- [x] Rust / Go 优化方案已按工程实践深化：目标、不变量、分层、后端、前端、数据契约、BDD、验证、风险与 MVP 已补齐。
- [x] Rust / Go 开发跟踪清单已生成：`docs/improve/rust-go/2026-06-01-rust-go-development-checklist.md`。
- [x] 阶段提交纪律已固化：`fe34b231 docs(tasks): 固化阶段完成即提交纪律`。
- [x] 已补齐 Rust / Go 下次启动提示词入口：`docs/improve/rust-go/next-session-prompt.md`。
- [x] Phase 0：基线、契约与 benchmark。
- [x] Phase 1：TypeScript fallback 与 EventSearchService 重构。
- [x] Phase 2：Pipeline records cursor / tail 与全局搜索接入。
- [x] Phase 3：Workspace 文件索引 TS cache 与 watcher invalidation。
- [x] Phase 4：前端可见体验、Jotai 状态和 diagnostics。
- [~] Phase 5：Rust search sidecar 试点（前置依赖决策、protocol / smoke 计划、100MB TS fallback benchmark gate、最小 Rust search-only sidecar 源码切片、Electron main process sidecar manager、fallback gate、contract parity、native benchmark 对比、search 早停性能优化、2 轮稳定 benchmark 复跑、benchmark event-loop 口径增强、新字段稳定 benchmark 复跑、native benchmark gate 机器可读汇总、Agent production facade benchmark 分析、Agent nested content native parity、基础 smoke script、native-cache schema helper、`protocol-mismatch` / `crash` / `timeout` / `cache-corruption` fake sidecar / isolated cache smoke、optional package manifest schema helper、`packaged-manifest` 预检、bundled package resolver fixture、`packaged-app-layout` 只读 preflight smoke 入口、packaged app evidence classifier、`packagedAppIdentityVerified` gate、optionalDependencies declaration preflight gate、optional package install-chain preflight gate、default-enable readiness 预检、packaging config allowlist 预检、optional package 发布状态预检、packaged bundled binary smoke 执行计划预检、optional package publish-target dry-run 预检、release-ready source version 前置、optional package source preflight、optional / packaged gate 执行顺序预检、builder allowlist dry-run plan、optionalDependencies install-chain dry-run plan、optional package publication change plan 证据拆分、packaged bundled binary smoke invocation plan、optional package publication invocation plan 和 publication invocation 发布证据收紧已完成；真实 optional package 发布、optionalDependencies 实际声明与安装执行、builder allowlist 实际修改、真实 packaged app bundled binary smoke、最终 default-enable 风险决策未完成，default enable 与真实 packaged smoke 尚未完成）。
- [ ] Phase 6：大文件 / 日志 chunk preview。
- [ ] Phase 7：PathSafety 与 GitOutputParser 抽象。
- [ ] Phase 8：打包、CI、版本与发布收口。
- [ ] Phase 9：Go supervisor 可选 spike。

### 当前未完成的关键能力

- [x] NativeRuntime shared DTO / IPC 草案已完成；preload API 尚未实现。
- [x] 主进程 `NativeRuntimeAdapter` TypeScript interface 与 diagnostics 空实现已完成。
- [x] Contract fixtures 和 benchmark runner 已完成；基线数字见 Phase 0 Review。
- [x] EventSearchService 已统一 Chat / Agent / Pipeline 搜索 facade，并保留旧 IPC / preload / renderer 行为兼容。
- [x] Pipeline records tail 已改为 TypeScript cursor / byte-offset tail，保留旧 afterIndex 兼容路径。
- [x] Workspace 文件索引已建立可取消、可重建的 TypeScript 缓存层，并接入 watcher invalidation。
- [x] SearchDialog 已接入 Pipeline 与 Workspace 内容搜索，并具备 Pipeline / Workspace / Chat / Agent 分组、stale result 丢弃、Pipeline record 聚焦和 Workspace 文件预览入口。
- [x] Native Runtime Diagnostics 设置页、Jotai diagnostics 状态、rebuild / clear cache IPC 和前端 fallback 状态已完成。
- [x] Phase 5 前置依赖 decision record、sidecar protocol / fallback / packaged smoke 计划已完成：`2026-06-03-phase-5-dependency-decision-record.md`、`2026-06-03-phase-5-sidecar-protocol-and-smoke-plan.md`。
- [x] Phase 5 最小 Rust search-only sidecar 源码切片已新增：`native/search/`，包含 stdin / stdout line-delimited JSON protocol、`status`、literal `search`、`shutdown` 和 explicit out-of-scope `tail_jsonl` typed error；已覆盖坏 JSON、缺失 source、empty query、limit clamp、snippet 上限、中文命中和 ASCII query + Unicode prefix offset。
- [x] Electron main process sidecar manager 已新增：只接受显式 binary path，支持 status / search / shutdown、timeout / crash / version mismatch / contract violation fallback、stdout buffer 上限、严格 schema 校验、stderr 脱敏和拒绝类错误不 fallback。
- [x] Chat search native opt-in 边界已接入：需要 `CODEINSIGHTS_NATIVE_RUNTIME=1`、`CODEINSIGHTS_NATIVE_SEARCH=1` 和 `CODEINSIGHTS_NATIVE_SEARCH_BINARY`；默认仍走 TypeScript fallback。native 命中只用于定位 cursor，legacy snippet / matchedRanges 回到 TS 生成，避免 UI 语义漂移。
- [x] Rust vs TS contract parity 与 100MB native benchmark 已完成。`319f30e8` 当时结论：Rust native Chat event loop delay 从 44.914ms 降到 1.812ms，但 P95 456.835ms 慢于 TS 413.818ms；Rust native Agent P95 808.661ms 慢于 TS 343.416ms，未达到默认启用门槛。
- [x] Rust search sidecar 早停性能优化已完成：sidecar 在找到第 `limit + 1` 个命中后返回 `hasMore=true` 并停止扫描，不再为了精确 `total_matches` 完整解析 100MB JSONL。`0eb350ff` 后 100MB benchmark：TS Chat P95 491.319ms / event loop delay 82.650ms，Rust native Chat P95 25.593ms / event loop delay 2.432ms；TS Agent P95 547.352ms / event loop delay 2.092ms，Rust native Agent P95 10.573ms / event loop delay 3.546ms。P95 gate 已改善，但 Agent event loop gate 和 packaged smoke 仍阻断默认启用。
- [x] Phase 5 稳定 benchmark gate 已复跑 2 轮。本轮先发现本地 release binary 仍报告 `0.0.1-dev`，已用 `cargo build --release --manifest-path native/search/Cargo.toml` 重建并确认 `0.0.2-dev` 后再跑 benchmark。第 1 轮：TS Chat P95 277.973ms / event loop 62.511ms，Rust native Chat P95 3.516ms / event loop 1.651ms；TS Agent P95 227.239ms / event loop 1.269ms，Rust native Agent P95 2.203ms / event loop 1.732ms。第 2 轮：TS Chat P95 267.874ms / event loop 9.793ms，Rust native Chat P95 3.429ms / event loop 1.478ms；TS Agent P95 220.111ms / event loop 1.127ms，Rust native Agent P95 2.201ms / event loop 1.416ms。结论：P95 gate 稳定达标，Chat event loop gate 达标；Agent event loop delay 绝对值很小但两轮均高于 TS，default enable 仍阻断。
- [x] Benchmark event-loop 口径增强已完成：旧 `eventLoopDelayMs` 保持为 max 兼容字段；新增 `eventLoopDelaySamplesMs`、`eventLoopDelayMaxMs`、`eventLoopDelayP95Ms`、`eventLoopBaselineMs`、`eventLoopBaselineP95Ms`、`eventLoopWorkDelayMs`、`eventLoopWorkDelayP95Ms`、`eventLoopWorkDelaySamplesMs`，并新增 `native-sidecar-status-cache-overhead` case。小规模 native smoke 已确认本地 `0.0.2-dev` release binary 输出新字段；样例中 native Agent event-loop delay 1.159ms、baseline 1.261ms、work delay 0ms。
- [x] Phase 5 新 event-loop 字段稳定 benchmark 已复跑 2 轮。本轮先用 release sidecar `status` 确认本地 ignored binary 为 `0.0.2-dev`，未重建、未创建 packaged native binary。第 1 轮：TS Chat P95 280.989ms / delay P95 3.146ms / work delay P95 2.004ms，Rust native Chat P95 3.921ms / delay P95 1.208ms / work delay P95 0.044ms；TS Agent P95 220.475ms / delay P95 1.121ms / work delay P95 0ms，Rust native Agent P95 2.240ms / delay P95 1.199ms / work delay P95 0.065ms。第 2 轮：TS Chat P95 294.904ms / delay P95 1.528ms / work delay P95 0.370ms，Rust native Chat P95 4.957ms / delay P95 1.198ms / work delay P95 0.064ms；TS Agent P95 220.871ms / delay P95 1.114ms / work delay P95 0.047ms，Rust native Agent P95 2.432ms / delay P95 1.191ms / work delay P95 0.164ms。`native-sidecar-status-cache-overhead` P95 为 0.014ms / 0.013ms，work delay P95 为 0.311ms / 0.012ms。结论：P95 gate 继续稳定达标，Chat work delay gate 达标；Agent native work delay 仍两轮小幅高于 TS fallback。后续已补齐基础 smoke script、native-cache schema helper 和 fake sidecar / cache-corruption smoke，但 packaged smoke / optional package / default-enable 风险评估仍未完成，native 继续显式 opt-in / default off。
- [x] Phase 5 native benchmark gate 汇总已完成：`f86553ee feat(rust-go): 补齐 Phase 5 native benchmark gate 汇总` 在 `native-runtime:benchmark` summary 中新增 `nativeSearchGate`，直接输出 Chat / Agent TS vs native 的 `p95DeltaMs`、`p95Ratio`、`eventLoopDelayP95DeltaMs`、`eventLoopWorkDelayP95DeltaMs`、`p95Improved`、event-loop regression 标记和 blockers。该 gate 只评估 benchmark 结果，并固定 `optional_package_install_chain_not_evaluated` 与 `packaged_app_bundled_binary_not_evaluated` 为默认启用阻塞项；`defaultEnableCandidate` 继续为 `false`，不改变 native default off。
- [x] Phase 5 Agent production facade benchmark 分析已完成：`9a06908a feat(rust-go): 补齐 Phase 5 Agent facade benchmark 分析` 新增 `agentFacadeSearch` summary 与 `agent-runtime-production-facade-search` case。该 case 使用 nested SDK message content fixture 和生产 Agent 搜索等价的文本提取逻辑，证明 direct native Agent benchmark 的 top-level fixture 不能代表生产 Agent facade；后续 `665c5db7` 已补齐受限 nested extractor parity。
- [x] Phase 5 Agent nested content native parity 已完成：`665c5db7 feat(rust-go): 补齐 Phase 5 Agent nested native parity` 新增受限白名单 extractor `agent_message_search_text`，Rust sidecar 只搜索顶层 legacy `content` 或 `message.content[]` 中 `type="text"` 的字符串 block，不搜索 raw JSON / `tool_use` / 任意 nested path；生产 Agent source 在显式 native opt-in 时可声明该 extractor，native 结果仍只用于 cursor anchor，legacy result 继续由 TypeScript 回读后按生产 `getSearchableAgentText()` 重建。该 parity 不改变 native default off，也不替代真实 optional package / packaged app bundled binary smoke。
- [x] 基础 `smoke:native-runtime` 脚本已完成：支持 `native-missing`、`native-available` 入口，未显式提供 binary 时跳过 native available，不从系统 `PATH` 查找；native missing smoke 已验证 TS fallback 可用和 `missing_binary` fallback。
- [x] native-cache manifest schema helper 已完成：cache root 固定为 `getConfigDir()/native-cache`，manifest 记录 schema / protocol / search package plan，不记录 binary path，损坏 manifest 返回 `cache_corrupted`。
- [x] Phase 5 fake sidecar / cache-corruption smoke 已完成：`2cc95b1b feat(rust-go): 补齐 Phase 5 fake sidecar smoke 失败路径` 将 `protocol-mismatch`、`crash`、`timeout`、`cache-corruption` 从 skipped 计划入口改为可执行 smoke。前三者使用 `process.execPath + 临时 JS fake sidecar` 模拟 status protocol mismatch、search crash 和 search timeout；`cache-corruption` 使用隔离 `CODEINSIGHTS_CONFIG_DIR/native-cache/manifest.json` 写入损坏 manifest。四个 mode 均验证 TypeScript fallback 搜索可用、summary 脱敏、不从系统 `PATH` 查找且不创建 packaged binary。
- [x] Phase 5 optional package manifest 预检已完成：`e5b92fa7 feat(rust-go): 补齐 Phase 5 optional package manifest 预检` 新增 `native-runtime-package-manifest.ts`，固定 darwin arm64 / darwin x64 / win32 x64 / linux x64 四个平台包计划，校验 package version、protocol / cache schema、platform / arch、binary name 和 SHA-256 fingerprint，并用 exact-key 白名单拒绝 `binaryPath`、home 和 path-like 额外字段。`smoke:native-runtime -- --mode packaged-manifest` 只验证 manifest schema / 平台矩阵和 TS fallback 可用，summary 明确 `bundledBinaryVerified=false`；它不是真实 bundled binary packaged smoke。
- [x] Phase 5 bundled package resolver fixture 已完成：`ce104a59 feat(rust-go): 补齐 Phase 5 bundled package resolver fixture` 新增 `native-runtime-package-resolver.ts`，只从 optional package `package.json` 派生包根，读取包内固定 `native-search-package.json` 和 `bin/{binaryName}`，校验 app `node_modules` realpath allowlist、manifest schema、平台矩阵、可执行权限和 SHA-256 fingerprint；service 只在 Electron packaged 环境自动尝试 resolver，非 packaged dev 仍要求显式 `CODEINSIGHTS_NATIVE_SEARCH_BINARY`。`packaged-manifest` smoke 已包含临时 optional package resolver fixture，summary 明确 `fixtureBundledPackageVerified=true`、`usesTemporaryFixture=true`、`realPackagedBinaryVerified=false`；它仍不是真实 packaged app bundled binary smoke。
- [x] Phase 5 packaged app layout preflight smoke 已完成：`smoke:native-runtime -- --mode packaged-app-layout` 新增只读入口，默认无 `--packaged-app-root` 或 `--app-node-modules-root` 时 skipped 且 TS fallback 可用；显式传入 packaged app root 时可推导 `.app/Contents/Resources/app/node_modules`、`.app/Contents/Resources/app.asar.unpacked/node_modules`、直接 `Resources`、直接 `Resources/app` 或直接 `app.asar.unpacked`，显式 legacy `node_modules` root 仍保留。resolver 校验 optional package manifest、`bin/{binaryName}`、可执行权限、SHA-256 和 app `node_modules` allowlist，不走系统 `PATH`。summary 拆分 `packagedAppLayoutVerified`、`packagedAppEvidenceVerified`、`usesTemporaryFixture`、`realPackagedBinaryVerified`；临时 fixture 只能证明 layout，不能把 `bundledBinaryVerified` 或 `realPackagedBinaryVerified` 置为 true。它仍不是真实 packaged app bundled binary smoke。
- [x] Phase 5 packaged app evidence / identity gate 已完成：`800dc885 feat(rust-go): 补齐 Phase 5 packaged app evidence smoke` 将 `packaged-app-layout` 的 packaged app evidence 从单一 `app.asar` / `app.asar.unpacked` 识别扩展为分类模型，同时支持当前 `electron-builder.yml` 的 `asar: false` 布局（`Resources/app/node_modules` + `Resources/app/package.json`）和未来 asar 布局；`31e37cbb fix(rust-go): 收紧 Phase 5 packaged app evidence 真实验证` 新增 `packagedAppIdentityVerified`，当前只对 `unpacked-app` 校验 app `package.json` 的 `name="@codeinsights/electron"` 与 `main="dist/main.cjs"`。临时 fixture 或缺少 identity 的 layout 即使具备 `packagedAppEvidence=unpacked-app` / `asar-unpacked`，也不能把 `bundledBinaryVerified` 或 `realPackagedBinaryVerified` 置为 true。
- [x] Phase 5 optionalDependencies declaration preflight gate 已完成：`563b804c feat(rust-go): 补齐 Phase 5 optionalDependencies 声明预检 gate` 新增 `validateNativeSearchOptionalDependencies()`，只校验传入 package manifest 的 `optionalDependencies` 是否覆盖 4 个 native search 平台包；后续 `1114233b` 已把版本声明收紧为 exact semver 或 `npm:<同名 native search package>@exact-semver`，拒绝空值、非字符串、`latest` / range、跨包 alias、`file:`、`workspace:`、git / http URL 和 path-like spec。该 helper 不读取真实 `node_modules`、不解析 binary、不证明 package 已安装。`packaged-manifest` smoke 新增 `packaged-optional-dependencies-preflight` case；当前 `apps/electron/package.json` 尚未声明 `@codeinsights/native-search-*`，summary 明确 `optionalDependenciesDeclared=false`、`missingOptionalDependencies=[4 packages]`、`invalidOptionalDependencies=[]`、`realPackagedBinaryVerified=false`。`packaged-app-layout` 的真实验证 gate 也已要求 `optionalDependenciesDeclared=true`，且 `native-runtime-smoke` CLI 现在遇到任意 failed case 会返回非零退出码。
- [x] Phase 5 optional package install-chain preflight gate 已完成：`1114233b feat(rust-go): 补齐 Phase 5 optional package 安装链路预检` 新增 `validateNativeSearchOptionalPackageInstallChain()`，只读校验 native search optionalDependencies 声明、`bun.lock` resolved package entry 和已安装 package manifest 一致性；optionalDependencies 版本声明收紧为 exact semver 或 `npm:<同名 native search package>@exact-semver`，拒绝跨包 alias、跨平台 alias、`latest` / range 和 path-like spec。`packaged-manifest` smoke 新增 `packaged-optional-dependencies-install-chain-preflight` case 与 install-chain summary 字段；当前仓库仍未声明真实 native search optionalDependencies，因此 summary 保持 `optionalDependenciesInstallChainVerified=false`、`optionalDependenciesLockfileVerified=false`、`optionalDependenciesInstalledPackagesVerified=false`、`realPackagedBinaryVerified=false`。若后续出现声明但 lockfile / installed package manifest 不完整，install-chain preflight 必须 failed，不能 skipped。
- [x] Phase 5 default-enable readiness 预检已完成：`2bf88a5a feat(rust-go): 补齐 Phase 5 default-enable readiness 预检` 新增 `nativeSearchDefaultEnableReadiness`，把 benchmark gate、Agent facade extractor / native parity、optionalDependencies declaration、optional package install-chain、packaged app evidence / identity、real packaged binary 和人工风险复核收敛为机器可读 readiness。`native-runtime:benchmark` 与 `smoke:native-runtime` summary 均输出 `nativeSearchDefaultEnableReadiness`；当前仍为 `defaultEnableCandidate=false`、`explicitOptInRequired=true`。`realPackagedBinaryVerified` 顶层 summary 已收紧为同时要求 optional install-chain、packaged evidence、packaged identity 和真实 binary verification，不能被临时 fixture 或单项 resolver 结果绕过。
- [x] Phase 5 packaging config allowlist 预检已完成：`348e003d feat(rust-go): 补齐 Phase 5 packaging config allowlist 预检` 新增 `validateNativeSearchPackagingConfig()`，只读解析 `electron-builder.yml` 顶层 `files:` 列表并要求 4 个计划 native search optional packages 都有显式 per-package include。当前仓库缺少这些 include，且 `apps/electron/electron-builder.yml` 仍有 `!node_modules/@codeinsights/**`，因此 `packaged-manifest` / `packaged-app-layout` summary 输出 `packagingConfigVerified=false`、4 个 `missingPackagingConfigPackages` 和 `blockingPackagingConfigExcludes=["!node_modules/@codeinsights/**"]`；readiness 新增 blocker `packaging_config_not_verified`，native 继续 default off。
- [x] Phase 5 optional package 发布状态预检已完成：`6ae1c896 feat(rust-go): 补齐 Phase 5 optional package 发布状态预检` 新增 `validateNativeSearchOptionalPackagePublication()` 和 `--check-registry` 显式只读 registry gate。默认 smoke 不联网，`packaged-manifest` / `packaged-app-layout` publication case 为 skipped 且 `optionalPackagesPublished=false`；显式 `--check-registry` 只读查询 npm packument，404 进入 `missingPublishedOptionalPackages`，非 OK / fetch error 进入 `unavailablePublishedOptionalPackages`，metadata 不匹配进入 `invalidPublishedOptionalPackages`。publication helper 可绑定当前 optionalDependency exact version 到 `versions[expectedVersion]`，不能只看 latest；`realPackagedBinaryVerified` / `bundledBinaryVerified` 必须同时要求非临时 fixture、publication、install-chain、packaging config、packaged evidence、identity 和真实 resolver verification。
- [x] Phase 5 packaged bundled binary smoke 执行计划预检已完成：`dedbfed1 feat(rust-go): 补齐 Phase 5 packaged smoke 执行计划预检` 在 `smoke:native-runtime` summary 中新增 `packagedBundledBinarySmokePlan`，输出 `status`、`blockedBy`、`requiredInputs`、`nextAllowedActions`、`forbiddenActions` 和 candidate command。当前默认 `packaged-manifest` / `packaged-app-layout` 都为 `status="blocked"`；`ready` 只表示前置输入具备，`verified` 必须同时满足顶层 `bundledBinaryVerified=true` 且无 blocker。该 plan 不读取 binary、不安装 package、不修改 manifest、不触碰 builder，不是真实 packaged app bundled binary smoke。
- [x] Phase 5 packaged smoke invocation plan 已完成：`edeba827 feat(rust-go): 补齐 Phase 5 packaged smoke invocation plan` 在 `smoke:native-runtime` summary 中新增 `packagedBundledBinarySmokeInvocationPlan`，并把候选真实 packaged smoke 命令改为优先使用 `--packaged-app-root <packaged-app-root>`，同时保留 legacy `--app-node-modules-root <packaged-app-node_modules>`。该 plan 输出 `inputMode`、`appNodeModulesRootResolved`、`resolutionEvidence`、`blockedBy`、`requiredInputs`、`acceptanceEvidence`、candidate / legacy command 和 forbidden actions。legacy root 不存在时只进入 `app_node_modules_root_unresolved`，不能被标成 resolved；ready_for_execution 只表示调用输入和前置 gate 齐备，verified 仍必须绑定 `bundledBinaryVerified=true` 且无 blocker。它不输出 packaged root / node_modules root / binary path，不创建 packaged app，不发布、不安装、不改 builder，也不证明真实 packaged binary。
- [x] Phase 5 optional package publish-target dry-run 预检已完成：`9e3e3dff feat(rust-go): 补齐 Phase 5 optional package publish target 预检` 新增 `validateNativeSearchOptionalPackagePublishTarget()` 和 `smoke:native-runtime -- --mode optional-package-publish-target --native-search-package-version <version>`。默认不联网时保持 `optionalPackagePublishTargetChecked=false` 和 `optionalPackagePublishTargetReady=false`；显式 `--check-registry` 只读检查目标版本是否已碰撞，并验证 planned manifest metadata、Cargo version 与 source `BINARY_VERSION` 一致性。`dc75f380` 已将 `native/search/src/lib.rs` 的 `BINARY_VERSION` 与 `native/search/Cargo.toml` 对齐为 `0.0.3`，因此当前 `0.0.3` 目标版本下 4 个 package 名均可发布、无 registry collision、source version consistency 通过，显式 registry dry-run 输出 `optionalPackagePublishTargetReady=true`。该 dry-run 不发布 package、不安装、不声明 optionalDependencies、不改变 `optionalPackagesPublished`、不证明真实 packaged binary。
- [x] Phase 5 release-ready source version 前置已完成：`dc75f380 feat(rust-go): 对齐 Phase 5 native search release source version` 将 Rust sidecar source `BINARY_VERSION` 从 `0.0.3-dev` 调整为 `0.0.3`，使 publish-target dry-run 能在显式 registry 404 且 planned manifest metadata 有效时证明目标版本 release-ready；但该前置不创建 release / packaged native binary，不发布 npm package，不执行 optionalDependencies 安装链路，不修改 builder allowlist，不改变 native default off。
- [x] Phase 5 optional package source preflight 已完成：`05c393bb feat(rust-go): 补齐 Phase 5 optional package source 预检` 新增 `validateNativeSearchOptionalPackageSources()` 和 `smoke:native-runtime -- --mode optional-package-source --native-search-package-version 0.0.3`。该 preflight 只消费 planned in-memory package source manifest，校验 4 个 planned package 的 exact name / version、`private=false`、license / description、精确 `os` / `cpu`、`bin.codeinsights-native-search`、精确 `files` allowlist、`publishConfig.access=public` 和闭合 `native-search-package.json` 计划，并拒绝 path-like 字段、运行时 dependency 字段与 install / publish lifecycle scripts。当前 summary 输出 `optionalPackageSourceChecked=true`、`optionalPackageSourceReady=true`、`optionalPackageSourceVersion="0.0.3"`、4 个 `optionalPackageSourceReadyPackages` 和 `plannedOptionalPackageSourceManifestsVerified=true`；它不运行 `npm pack`、不发布、不安装、不读取 binary、不证明 SHA、也不修改 optionalDependencies / builder / packaged smoke。
- [x] Phase 5 optional / packaged gate 执行顺序预检已完成：`ce89f490 feat(rust-go): 补齐 Phase 5 optional packaged 执行顺序预检` 新增 `buildNativeSearchOptionalPackageExecutionPlan()` 和 `optionalPackageExecutionPlan` smoke summary，输出 `nextStage`、严格顺序前缀 `completedPrerequisites`、独立证据 `observedEvidenceStages`、`blockedBy`、ready flags、`nextAllowedActions`、`candidateCommands` 和 `forbiddenActions`。source / publish-target ready 都必须先受 checked gate 约束；当二者同时 ready 时也只进入 `optional_package_publication`，不证明 package 已发布、optionalDependencies 已声明 / 安装、builder allowlist 已修改、真实 packaged binary 已验证或 default enable 可行。
- [x] Phase 5 builder allowlist dry-run plan 已完成：`a3f98673 feat(rust-go): 补齐 Phase 5 builder allowlist dry-run plan` 新增 `buildNativeSearchPackagingConfigAllowlistChangePlan()` 和 smoke summary 字段 `packagingConfigAllowlistChangePlan`。该 plan 只读消费 packaging config validator 结果，输出人工 review 所需的精确 per-package include、缺失 include、blocking excludes、too-broad includes、removal candidates、candidate verification commands 和 forbidden actions；当前为 `status="blocked"`，因为 `packagingConfigVerified=false`、4 个 per-package include 缺失且 `!node_modules/@codeinsights/**` 仍阻断计划包。它不写 `electron-builder.yml`、不安装 package、不发布 package、不读取 binary、不证明 packaged app bundled binary。
- [x] Phase 5 optionalDependencies install-chain dry-run plan 已完成：`7726a008 feat(rust-go): 补齐 Phase 5 optionalDependencies install-chain dry-run plan` 新增 `buildNativeSearchOptionalDependenciesInstallChainChangePlan()` 和 smoke summary 字段 `optionalDependenciesInstallChainChangePlan`。该 plan 只读输出真实 optionalDependencies 声明与安装执行前的 review 输入，固定 4 个计划 optionalDependency exact spec 为 `0.0.3`，并保守报告 publication、declaration、install-chain、lockfile 和 installed package blockers；当前为 `status="blocked"`、`approvalRequired=true`。它不写 `apps/electron/package.json` 或 `bun.lock`，不安装、不发布、不修改 builder、不读取 binary、不证明真实 packaged bundled binary，也不把 default-enable 相关 gate 置为 true。`7726a008` 还把 `packaged-manifest` / `packaged-app-layout` registry publication 检查绑定到 planned source `BINARY_VERSION=0.0.3` 对应的 exact expected version，不能只看 registry latest。
- [x] Phase 5 optional package publication change plan 证据拆分已完成：`8097ed4c feat(rust-go): 补齐 Phase 5 optional package publication change plan` 新增 `buildNativeSearchOptionalPackagePublicationChangePlan()` 和 smoke summary 字段 `optionalPackagePublicationChangePlan`；`2188e276 fix(rust-go): 收紧 Phase 5 publication plan collision 过滤` 与 `d679eabb fix(rust-go): 拆分 Phase 5 publication plan 发布证据` 已收紧发布证据语义。该 plan 只读输出真实 optional package 发布前的 review 输入，`ready_for_review` 只代表可交给人工审核；`publishedPackages` 只表示 registry 中 exact expected version 且 metadata 有效的真实 publication 证据，`publishTargetCollisionPackages` 与 `existingInvalidPublishedPackages` 只进入 `commandExcludedPackages` 并排除候选发布命令。它不运行 `npm publish` / `npm pack`，不安装、不写 `package.json` / `bun.lock` / builder，不读取 binary，不证明 packaged app bundled binary。
- [x] Phase 5 optional package publication invocation plan 已完成：`f949fc13 feat(rust-go): 补齐 Phase 5 optional package publication invocation plan` 新增 `buildNativeSearchOptionalPackagePublicationInvocationPlan()` 和 smoke summary 字段 `optionalPackagePublicationInvocationPlan`。该 plan 只读消费 `optionalPackagePublicationChangePlan` 和 publication evidence，输出真实 `npm publish` 前的 required inputs、candidate commands、per-package invocation status / blocker、acceptance evidence 和 forbidden actions；`ready_for_invocation` 只表示调用形状可交给人工审核，不运行 `npm publish` / `npm pack`，不安装、不写 package manifest / lockfile / builder，不读取 binary，不证明 packaged app bundled binary。
- [x] Phase 5 publication invocation 发布证据收紧已完成：`77b266e8 fix(rust-go): 收紧 Phase 5 publication invocation 发布证据` 将 invocation plan 的顶层 `publishedPackages` 收紧为只从 per-package `status="published"` 汇总，并要求 fully verified 时 planned package 集合与 published package 集合唯一且严格匹配。invalid、unavailable、duplicate、collision 或矛盾 registry evidence 只能进入 blocker / exclusion，不能被当成已发布；`not_required_already_published` 只能在 4 个 planned exact package 全部真实 registry verified 且无 blocker 时成立。
- [ ] 真实 Rust optional package 发布 / optionalDependencies 实际声明与安装执行、builder allowlist 实际修改、真实 packaged app bundled binary smoke 和 default-enable 判断尚未实现；当前显式 publication registry smoke 仍显示 4 个计划 `@codeinsights/native-search-*` 包均在 `missingPublishedOptionalPackages`，publish-target dry-run 仅证明目标版本当前可尝试发布，source preflight 仅证明 package source blueprint 形状 ready，execution plan 仅证明下一步顺序，builder allowlist dry-run plan 仅证明人工 review 输入已生成，optionalDependencies install-chain dry-run plan 仅证明声明 / 安装执行前 review 输入已生成，publication change plan 仅证明真实发布前 review 输入已生成，optional package publication invocation plan 仅证明真实 `npm publish` 调用形状和验收证据已机器可读化，packaged smoke invocation plan 仅证明真实 packaged app root 调用形状和验收证据已机器可读化，且当前 publication、optionalDependencies declaration / install-chain、lockfile、installed package 和 packaging config allowlist 均未真实通过，因此不能把这些 dry-run / invocation plan 外推为 published / installed / packaged verified。
- [ ] Go supervisor 未进入主线，必须等 Phase 9 触发条件成立。
- [ ] 根 `README.md` / 根 `AGENTS.md` 未同步；需要用户明确允许后才可修改。

### 下次启动入口

下次启动 Codex 后先执行以下动作：

1. 读取 `tasks/lessons.md`，特别是阶段提交、状态同步、路径安全、Git 防护、测试隔离、README / AGENTS 修改授权边界和 packaged smoke 纪律。
2. 读取 Rust / Go 优化方案、本文和 `docs/improve/rust-go/next-session-prompt.md`，确认当前状态为“Phase 0-4 已完成；Phase 5 已完成前置依赖决策与 protocol / smoke 计划、100MB TS fallback benchmark gate、最小 Rust search-only sidecar、Electron main process sidecar manager、Chat search fallback gate、Rust vs TS contract parity、100MB native benchmark、native benchmark gate 汇总、Agent production facade benchmark 分析、Agent nested native parity、fake sidecar / cache-corruption smoke、optional package manifest schema helper、`packaged-manifest` 预检、bundled package resolver fixture、`packaged-app-layout` 只读 preflight smoke、`asar: false` packaged app evidence classifier、`packagedAppIdentityVerified` gate、optionalDependencies declaration preflight gate、optional package install-chain preflight gate、default-enable readiness 预检、packaging config allowlist 预检、optional package 发布状态预检、packaged bundled binary smoke 执行计划预检、optional package publish-target dry-run 预检、release-ready source version 前置、optional package source preflight、optional / packaged gate 执行顺序预检、builder allowlist dry-run plan、optionalDependencies install-chain dry-run plan、optional package publication change plan 证据拆分、packaged bundled binary smoke invocation plan、optional package publication invocation plan 和 publication invocation 发布证据收紧；native 未达默认启用门槛，packaged native binary / 真实 optional package 发布 / optionalDependencies 实际声明与安装执行 / 真实 packaged app bundled binary smoke / builder allowlist 实际修改 / 最终 default-enable 风险决策尚未完成”。
3. 运行 `git status --short --branch` 和 `git log -25 --oneline`，确认最近历史包含 `95305503 docs(rust-go): 同步 Phase 5 publication invocation 证据收紧状态`、`77b266e8 fix(rust-go): 收紧 Phase 5 publication invocation 发布证据`、`f949fc13 feat(rust-go): 补齐 Phase 5 optional package publication invocation plan`、`084546cc docs(rust-go): 回填 Phase 5 packaged smoke invocation 最新恢复入口`、`076f25c6 docs(rust-go): 同步 Phase 5 packaged smoke invocation 状态`、`edeba827 feat(rust-go): 补齐 Phase 5 packaged smoke invocation plan`、`eb02f806 docs(rust-go): 回填 Phase 5 publication plan 最新恢复入口`、`c4000bc9 docs(rust-go): 同步 Phase 5 publication plan 证据拆分状态`、`d679eabb fix(rust-go): 拆分 Phase 5 publication plan 发布证据`、`2188e276 fix(rust-go): 收紧 Phase 5 publication plan collision 过滤`、`8097ed4c feat(rust-go): 补齐 Phase 5 optional package publication change plan`、`235ea492 docs(rust-go): 回填 Phase 5 optionalDependencies 最新恢复入口` 和 `7726a008 feat(rust-go): 补齐 Phase 5 optionalDependencies install-chain dry-run plan`。
4. 如果继续 Phase 5，先读取 `docs/improve/rust-go/2026-06-03-phase-5-dependency-decision-record.md`、`docs/improve/rust-go/2026-06-03-phase-5-sidecar-protocol-and-smoke-plan.md`、`native/search/` 和 `apps/electron/src/main/lib/native-runtime/native-runtime-sidecar-manager.ts`，确认 native search 当前是显式 opt-in 且默认关闭。
5. 下一步不要创建 packaged native binary 或修改打包配置；在 default off 前提下优先推进真实 optional package 发布、真实 optionalDependencies 声明与安装执行、builder allowlist 实际修改前置工作和真实 packaged app bundled binary smoke 设计，或仅在真实 optional / packaged gate 可执行通过后再做最终 default-enable 风险决策。`optionalPackagePublicationChangePlan`、`optionalDependenciesInstallChainChangePlan` 和 `packagingConfigAllowlistChangePlan` 都只表示实际修改前 review 输入；`publishedPackages` 只表示真实 registry publication 证据，collision / invalid metadata 不能当作已发布。只有 P95 / event loop gate、Agent facade parity、真实 optional install-chain、builder allowlist 和真实 packaged smoke 同时进入可执行通过阶段后，才允许默认启用 native。

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
| M2 | Phase 2 | Pipeline records cursor / tail 与 SearchDialog 接入 | [x] | 必须 |
| M3 | Phase 3 | Workspace 文件索引 TS cache 与 watcher invalidation | [x] | 必须 |
| M4 | Phase 4 | 前端索引状态、诊断、可取消搜索和大文件入口 | [x] | 必须 |
| M5 | Phase 5 | Rust search sidecar 试点 | [~] | 有条件 |
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

- [x] 阶段开始
- [x] 测试先行完成
- [x] 实现完成
- [x] 验证完成
- [x] 阶段 Review 完成
- [x] 阶段提交完成

### 目标

让 Pipeline records tail 不再依赖全量读取再 slice，并把 Pipeline 内容纳入 SearchDialog / 全局搜索。该阶段仍以 TypeScript fallback 为主，不引入 Rust。

### 入口条件

- [x] Phase 1 已完成并提交。
- [x] Pipeline records fixture 已覆盖大历史和坏行。
- [x] SearchDialog 当前行为有回归测试。
- [x] 已确认 cursor 格式只作为 service 内部或 shared DTO，不泄露本地绝对路径。

### 后端任务

- [x] 为 Pipeline JSONL records 建立 byte offset / logical cursor 读取策略。
- [x] 增加 cursor schema version，避免后续格式变化导致旧 cursor 误用。
- [x] `getPipelineRecordsTail()` 内部转调 cursor tail service。
- [x] 对 append 中的部分写入、坏行、空行做容错。
- [x] 增加 tail 方向：latest、before cursor、after cursor。
- [x] 保证新增 records 读取复杂度不随历史总量线性增长。

### 前端任务

- [x] SearchDialog 增加 Pipeline source 分组。
- [x] 搜索结果展示 session title、stage、record kind、时间和 snippet。
- [x] 支持点击 Pipeline 搜索结果打开对应 session，并尽量定位到 record。
- [x] PipelineRecords 使用 cursor 加载更多，避免一次性渲染大列表。
- [x] 快速切换 session 时丢弃旧 records 请求结果。

### 测试任务

- [x] Pipeline records cursor tail 单测覆盖 50000 records fixture。
- [x] 覆盖 cursor schema mismatch、文件截断、append 后继续 tail。
- [x] SearchDialog renderer 测试覆盖 Pipeline 结果分组和点击行为。
- [x] 覆盖 requestId / generation：旧 session 结果不能覆盖新 session。
- [x] 覆盖空结果、搜索失败、fallback 状态。

### 触达文件

- [x] `apps/electron/src/main/lib/pipeline-session-manager.ts`
- [skip] `apps/electron/src/main/lib/native-runtime/ts-event-search-service.ts`：Phase 1 facade 已可复用，本阶段无需改动。
- [x] `apps/electron/src/main/lib/native-runtime/ts-pipeline-tail-service.ts`
- [x] `apps/electron/src/main/ipc/pipeline-handlers.ts`
- [x] `apps/electron/src/preload/index.ts`
- [x] `apps/electron/src/renderer/components/app-shell/SearchDialog.tsx`
- [x] `apps/electron/src/renderer/components/pipeline/PipelineRecords.tsx`
- [x] `apps/electron/src/renderer/components/pipeline/usePipelineRecordsTail.ts`
- [skip] `packages/shared/src/types/native-runtime.ts`：本阶段新增 Pipeline tail / summary / search DTO，落点为 `packages/shared/src/types/pipeline.ts`。
- [x] `packages/shared/src/types/pipeline.ts`

### 验证命令

```bash
bun test apps/electron/src/main/lib/pipeline-session-manager.test.ts
bun test apps/electron/src/main/lib/native-runtime
bun test apps/electron/src/renderer/components/app-shell/SearchDialog.indexed.test.tsx
bun test apps/electron/src/renderer/components/pipeline
bun test apps/electron/scripts/native-runtime-benchmark.test.ts
bun test packages/shared/src/types/native-runtime.test.ts
bun run --filter='@codeinsights/shared' typecheck
bun run --filter='@codeinsights/electron' typecheck
bun run --filter='@codeinsights/electron' build:main
bun run --filter='@codeinsights/electron' build:preload
bun run --filter='@codeinsights/electron' build:renderer
bun run --filter='@codeinsights/electron' native-runtime:benchmark --records 50000 --payload-bytes 256 --workspace-files 100000 --log-bytes 524288000 --iterations 3
bun install --frozen-lockfile --dry-run
git diff --check
git status --short --branch
```

### 完成定义

- [x] Pipeline records tail 支持 cursor，历史越大时 tail 性能不再明显线性退化。
- [x] SearchDialog 可搜索 Chat / Agent / Pipeline 三类内容。
- [x] 快速输入、切换 session、关闭弹窗均不会出现 stale result。
- [x] Review 中记录大 records fixture 的 tail 基线对比。

### 禁止事项

- [x] 不为了定位 record 读取整个 Pipeline JSONL。
- [x] 不把 cursor 设计成绝对文件路径或不可脱敏内容。
- [x] 不在 renderer 中解析 JSONL。
- [x] 不改变 Pipeline record 的持久化事实格式。

### 阶段 Review

- 阶段提交：已提交 `25e3e6d1 feat(rust-go): 完成 Phase 2 Pipeline cursor tail 与搜索接入`。
- 实现完成：新增 `ts-pipeline-tail-service.ts`，Pipeline records tail 支持 `latest` / `before` / `after` cursor，cursor 为 base64url JSON，包含 schema version、sessionId、byteOffset、recordId、createdAt，不包含绝对路径；保留旧 `afterIndex` 路径以兼容旧调用。
- 搜索接入：新增 Pipeline 全局内容搜索 IPC / preload / service 入口，SearchDialog 现在展示 Pipeline / Chat / Agent 三组内容结果；Pipeline 内容命中点击后打开对应 session 并通过 Jotai focus intent 尽量定位到 record。
- 安全与 review 修复：Pipeline manager 对 records tail / records search / summary 做运行时输入校验，未知 session 不参与路径拼接；cursor 增加 anchor 校验，截断后重写到更大文件也会标记 `cursorInvalid` 并安全回退；`loadOlderRecords()` 增加 session generation 防护；NativeRuntime `tailJsonl(backward)` 的 `nextCursor` 映射为请求方向上的下一 cursor。
- 状态 read model：新增 `PipelineRecordsSummary` IPC，PipelineView 不再用 latest 300 条截断 window 推导 `currentTask` 和最新 error，避免长历史会话重启 / 错误定位回归。
- 版本与锁文件：`@codeinsights/electron` 升到 `0.0.133`，`@codeinsights/shared` 升到 `0.1.60`，`bun.lock` 已同步；未新增依赖。
- Benchmark 对比：同为 macOS arm64 / Bun 1.3.13 / 50k records / 100k workspace paths / 500MB log / iterations 3。Phase 2 `pipeline-tail-large-records` P50 2.662ms / P95 9.663ms / P99 9.663ms / event loop delay 9.732ms / memory 491,520 bytes；Phase 0 对应为 P50 33.376ms / P95 34.611ms / P99 34.611ms / event loop delay 34.644ms / memory 147,456 bytes；Phase 1 对应为 P50 68.114ms（未优化路径）。
- Benchmark 备注：本轮完整 benchmark 中 Chat / workspace / large-log 数字受同机负载波动影响且不是 Phase 2 优化目标；本阶段性能结论只使用 `pipeline-tail-large-records`。
- 验证通过：`bun test apps/electron/src/main/lib/pipeline-session-manager.test.ts apps/electron/src/main/lib/native-runtime apps/electron/src/renderer/components/app-shell/SearchDialog.indexed.test.tsx apps/electron/src/renderer/components/pipeline/PipelineRecords.test.ts apps/electron/src/renderer/components/pipeline/pipeline-record-tail-model.test.ts apps/electron/scripts/native-runtime-benchmark.test.ts packages/shared/src/types/native-runtime.test.ts`；`bun run --filter='@codeinsights/shared' typecheck`；`bun run --filter='@codeinsights/electron' typecheck`；`bun run --filter='@codeinsights/electron' build:main`；`bun run --filter='@codeinsights/electron' build:preload`；`bun run --filter='@codeinsights/electron' build:renderer`；`bun run --filter='@codeinsights/electron' native-runtime:benchmark --records 50000 --payload-bytes 256 --workspace-files 100000 --log-bytes 524288000 --iterations 3`；`bun install --frozen-lockfile --dry-run`；`git diff --check`。`build:renderer` 仅有既有大 chunk 警告。
- 边界确认：本阶段未写 Rust / Go，未安装依赖，未创建 native binary，未新增 optionalDependencies，未修改根 `README.md` / 根 `AGENTS.md`，未改变 Pipeline JSONL 事实源格式，未在 renderer 中读取 JSONL，未 push，未创建 PR。
- 后续入口：Phase 3 应从 Workspace 文件索引 TS cache 与 watcher invalidation 开始；继续先做 TypeScript fallback，不要直接写 Rust / Go。

## Phase 3：Workspace 文件索引 TS Cache 与 Watcher Invalidation

### 阶段状态

- [x] 阶段开始
- [x] 测试先行完成
- [x] 实现完成
- [x] 验证完成
- [x] 阶段 Review 完成
- [x] 阶段提交完成

### 目标

在 TypeScript 中先建立 workspace 文件索引、ignore 规则、watcher invalidation 和可重建缓存，为后续 Rust / Go 接手扫描提供稳定契约。

### 入口条件

- [x] Phase 0 benchmark 包含大 workspace fixture。
- [x] Phase 1 facade 已支持 workspace source kind 或已有扩展点。
- [x] 已确认本阶段不引入本地数据库，不把索引作为事实源。

### 后端任务

- [x] 新增 `ts-workspace-index-service.ts`，负责文件名、相对路径、mtime、size、fingerprint。
- [x] 支持 workspace root fingerprint，root 变化后自动废弃旧索引。
- [x] 支持 ignore 规则：`.git`、`node_modules`、构建产物、隐藏条目、系统垃圾文件、二进制大文件。
- [x] 支持 watcher invalidation：workspace files 和 attached directory 变化会标记相关 cache stale。
- [skip] 手动 rebuild 的正式用户入口留到 Phase 4 diagnostics；底层 `indexWorkspace({ force: true })` 已可重建且不影响 Agent / Pipeline 会话事实源。
- [x] 对 symlink 默认保守处理：不跟随 symlink，不递归循环。
- [x] 限制索引 cache 体积，超过阈值时截断索引并标记 stale。

### 前端任务

- [skip] Agent workspace selector 或 SidePanel 索引状态留到 Phase 4 diagnostics。
- [x] SearchDialog 支持 workspace file source，展示 path 和 size；mtime 已保存在结果模型中，正式可见状态留到 Phase 4。
- [x] 搜索结果打开文件时走现有 `previewFile(path, basePaths)` 入口，不在 renderer 中递归扫描文件系统。
- [skip] Settings diagnostics 提供 rebuild workspace index 操作留到 Phase 4。

### 测试任务

- [x] 覆盖大 workspace fixture 文件名搜索，并在 benchmark 中区分 cold build / warm search。
- [x] 覆盖 ignore 规则、hidden 文件、symlink 和无权限 / 不存在目录容错。
- [x] 覆盖 watcher invalidation 后搜索结果更新。
- [x] 覆盖 root fingerprint 变化后 cache 重建。
- [skip] 本阶段为内存派生 cache，不落盘，因此无磁盘 cache 损坏隔离；后续 native-cache schema 再补。

### 触达文件

- [x] `apps/electron/src/main/lib/native-runtime/ts-workspace-index-service.ts`
- [skip] `apps/electron/src/main/lib/agent-workspace-manager.ts`：复用现有 workspace files / attached directories API，无需修改。
- [x] `apps/electron/src/main/lib/agent-workspace-search-scope.ts`
- [x] `apps/electron/src/main/lib/workspace-watcher.ts`
- [x] `apps/electron/src/main/ipc/agent-handlers.ts`
- [skip] `apps/electron/src/renderer/components/agent/WorkspaceSelector.tsx`：索引状态 UI 留到 Phase 4。
- [x] `apps/electron/src/renderer/components/app-shell/SearchDialog.tsx`
- [x] `packages/shared/src/types/native-runtime.ts`
- [x] `packages/shared/src/types/agent.ts`

### 验证命令

```bash
bun test apps/electron/src/main/lib/agent-workspace-search-scope.test.ts apps/electron/src/main/lib/native-runtime/ts-workspace-index-service.test.ts apps/electron/src/main/lib/native-runtime apps/electron/src/renderer/components/app-shell/SearchDialog.indexed.test.tsx apps/electron/scripts/native-runtime-benchmark.test.ts packages/shared/src/types/native-runtime.test.ts
bun run --filter='@codeinsights/shared' typecheck
bun run --filter='@codeinsights/electron' typecheck
bun run --filter='@codeinsights/electron' build:main
bun run --filter='@codeinsights/electron' build:preload
bun run --filter='@codeinsights/electron' build:renderer
bun run --filter='@codeinsights/electron' native-runtime:benchmark --records 50000 --payload-bytes 256 --workspace-files 100000 --log-bytes 524288000 --iterations 3
bun install --frozen-lockfile --dry-run
git diff --check
git status --short
```

### 完成定义

- [x] Workspace 文件名搜索首次索引后 P95 达到 Phase 0 设定目标或记录未达原因。
- [x] watcher invalidation 可测试、可解释；用户可见手动 rebuild 入口留到 Phase 4 diagnostics。
- [x] cache 可删除重建，不影响 workspace files 和会话数据。
- [x] 大仓库扫描通过 async opendir 与热 cache 控制主线程阻塞；warm search event loop delay 为 1.694ms。

### 禁止事项

- [x] 不索引被 ignore 的 secret 文件内容。
- [x] 不把完整文件正文默认写入 cache。
- [x] 不在 renderer 中递归扫描文件系统。
- [x] 不跟随仓库外 symlink。

### 阶段 Review

- 阶段范围：TypeScript fallback 内的 workspace 文件索引 cache、watcher invalidation、`SEARCH_WORKSPACE_FILES` IPC 接入、SearchDialog Workspace 文件结果、benchmark cold / warm 分离。
- 真实完成项：新增 `TypeScriptWorkspaceIndexService`、`agent-workspace-search-scope` 路径白名单、workspace index shared contract input、workspace-index input fixture、SearchDialog Workspace 分组、watcher invalidation、entry 上限、in-flight build 复用和 benchmark case。
- 未完成项 / [!]：Native Runtime Diagnostics UI、Jotai diagnostics 状态、用户可见 rebuild 入口和 Settings diagnostics 留到 Phase 4；Rust sidecar / Go supervisor / native binary 仍未实现。
- 触达文件：`apps/electron/src/main/lib/native-runtime/ts-workspace-index-service.ts`、`apps/electron/src/main/lib/agent-workspace-search-scope.ts`、`apps/electron/src/main/ipc/agent-handlers.ts`、`apps/electron/src/main/lib/workspace-watcher.ts`、`apps/electron/src/renderer/components/app-shell/SearchDialog.tsx`、`packages/shared/src/types/agent.ts`、`packages/shared/src/types/native-runtime.ts`、benchmark / test / package 版本文件。
- 验证命令与结果：目标 Bun 测试、shared/electron typecheck、main/preload/renderer build、指定规模 native-runtime benchmark、`bun install --frozen-lockfile --dry-run`、`git diff --check` 均通过；`build:renderer` 仅有既有大 chunk 警告。
- benchmark 数据：macOS arm64 / Bun 1.3.13 / 50k records / 100k workspace files / 500MB log / iterations 3；cold build P50 4912.619ms / P95 5884.354ms / P99 5884.354ms / event loop delay 6.583ms；warm search P50 42.658ms / P95 50.541ms / P99 50.541ms / event loop delay 1.694ms。
- 安全与隐私结论：main 端不信任 renderer 路径，只允许已登记 workspace files、session cwd、workspace attached directories 和 session attached directories；不读取 / 缓存文件正文，不跟随 symlink，不修改会话事实源。
- fallback / rollback 结论：cache 是内存派生状态，可 clear / rebuild；删除 cache 不影响 JSON / JSONL 事实源；未接入 native binary。
- 是否需要更新 README / AGENTS：未授权，不更新。
- 下一阶段入口：Phase 4 前端可见体验、Jotai 状态与 Diagnostics。
- 阶段提交：`4ec586fc feat(rust-go): 完成 Phase 3 Workspace 文件索引 TS cache`。

## Phase 4：前端可见体验、Jotai 状态与 Diagnostics

### 阶段状态

- [x] 阶段开始
- [x] 测试先行完成
- [x] 实现完成
- [x] 验证完成
- [x] 阶段 Review 完成
- [x] 阶段提交完成

### 目标

把用户能感知的搜索、索引、fallback、失败和重建体验补齐。该阶段重点是 React / Jotai / IPC listener，不改变 native 后端实现策略。

### 入口条件

- [x] Phase 1 到 Phase 3 的 TS fallback 服务已稳定。
- [x] diagnostics DTO 已包含 status、capability、fallbackReason、lastError。
- [x] SearchDialog 已具备 requestId / cancellation 基础。

### 契约与 IPC 任务

- [x] 新增 `NATIVE_RUNTIME_IPC_CHANNELS`：status、diagnostics、rebuildIndex、clearCache、operation state、cancel、progress event、status changed event。`search`、`tail`、`readFileChunk` 常量已在 Phase 0 草案中存在，本阶段未新增 handler。
- [x] preload 暴露最小 API：不暴露 binary path，不允许 renderer 传任意 native command。
- [x] 主进程增加 native runtime status event，只推送脱敏状态。
- [x] 所有 IPC input 在 main process 做运行时校验。

### Jotai 与 Hook 任务

- [x] 新增 `native-runtime-atoms.ts`：status、diagnostics、indexing map、lastError、operation map。
- [x] 新增 `useGlobalNativeRuntimeListeners`，在 `main.tsx` 顶层挂载。
- [x] 搜索请求状态按 requestId 存储，关闭弹窗后清理 pending UI state。
- [x] workspace indexing 状态按 workspaceId 隔离。
- [x] Pipeline tail loading 状态按 sessionId 隔离。

### UI 任务

- [x] SearchDialog 增加 source tabs 或分组：全部、Chat、Agent、Pipeline、Workspace。
- [x] SearchDialog 增加 indexed / fallback / rebuilding / unavailable 状态。
- [x] SearchDialog 支持分页或 “更多结果”，避免一次性渲染过多结果。
- [x] PipelineRecords 增加 cursor loading 和加载失败重试。
- [x] Settings 增加 `NativeRuntimeDiagnostics` 面板：状态、能力、缓存、重建、清理、复制脱敏诊断。
- [x] 普通用户界面只展示简短状态；详细技术信息只放 diagnostics。

### 测试任务

- [x] Renderer 测试覆盖 SearchDialog 快速输入、stale result 丢弃、source 分组。
- [x] Renderer 测试覆盖 diagnostics loading、fallback、clear cache confirmation。
- [x] Hook 测试覆盖 listener 挂载、卸载、重复事件和 session/workspace 隔离。
- [skip] Electron smoke 覆盖打开搜索、执行搜索、打开 diagnostics 面板：本阶段未启动 Electron 交互 smoke；以 IPC / renderer model / build 验证收口，真实 Electron 交互 smoke 与 packaged smoke 放入 Phase 8。
- [x] 无障碍检查：按钮可聚焦、状态文本可读、错误操作有明确恢复动作。

### 触达文件

- [skip] `packages/shared/src/constants/native-runtime.ts`：现有 `NATIVE_RUNTIME_IPC_CHANNELS` 保持在 `types/native-runtime.ts` 并通过 shared root re-export 暴露；本阶段补 root export 测试，不新增子路径。
- [x] `packages/shared/src/types/native-runtime.ts`
- [x] `apps/electron/src/main/ipc/native-runtime-handlers.ts`
- [x] `apps/electron/src/main/ipc.ts`
- [x] `apps/electron/src/main/lib/native-runtime/native-runtime-diagnostics.ts`
- [x] `apps/electron/src/main/lib/native-runtime/native-runtime-service.ts`
- [x] `apps/electron/src/preload/index.ts`
- [x] `apps/electron/src/renderer/atoms/native-runtime-atoms.ts`
- [x] `apps/electron/src/renderer/hooks/useGlobalNativeRuntimeListeners.ts`
- [x] `apps/electron/src/renderer/main.tsx`
- [x] `apps/electron/src/renderer/components/app-shell/SearchDialog.tsx`
- [x] `apps/electron/src/renderer/components/pipeline/PipelineRecords.tsx`
- [x] `apps/electron/src/renderer/components/pipeline/usePipelineRecordsTail.ts`
- [x] `apps/electron/src/renderer/components/settings/NativeRuntimeDiagnostics.tsx`
- [x] `apps/electron/src/renderer/components/settings/SettingsPanel.tsx`
- [x] `apps/electron/src/renderer/atoms/settings-tab.ts`

### 验证命令

```bash
bun test apps/electron/src/main/lib/native-runtime
bun test apps/electron/src/main/ipc/native-runtime-handlers.test.ts
bun test apps/electron/src/renderer/atoms/native-runtime-atoms.test.ts
bun test apps/electron/src/renderer/hooks/useGlobalNativeRuntimeListeners.test.ts
bun test apps/electron/src/renderer/components/app-shell/SearchDialog.indexed.test.tsx
bun test apps/electron/src/renderer/components/settings/NativeRuntimeDiagnostics.test.tsx
bun test packages/shared/src/types/native-runtime.test.ts
bun test apps/electron/src/renderer/components/pipeline
bun run --filter='@codeinsights/shared' typecheck
bun run --filter='@codeinsights/electron' typecheck
bun run --filter='@codeinsights/electron' build:main
bun run --filter='@codeinsights/electron' build:preload
bun run --filter='@codeinsights/electron' build:renderer
bun install --frozen-lockfile --dry-run
git diff --check
git status --short --branch
```

### 完成定义

- [x] 用户可以看到搜索索引状态、fallback 状态和重建入口。
- [x] 快速输入和视图切换不会出现旧结果覆盖新结果。
- [x] Diagnostics 可复制脱敏信息，不暴露 token、home path、credentialed URL。
- [x] UI 组件拆分清晰，没有把 diagnostics 逻辑塞进单个大组件。

### 禁止事项

- [x] 不在普通搜索界面展示 native binary path、protocol version 等内部细节。
- [x] 不引入非 Jotai 的全局状态管理。
- [x] 不用 localStorage 持久化 native 状态。
- [x] 不用 renderer 直接清理 `~/.codeinsights/native-cache/`。

### 阶段 Review

- 阶段范围：TypeScript / React / Jotai / IPC 可见体验；未写 Rust / Go，未安装依赖，未创建 native binary，未改根 `README.md` / 根 `AGENTS.md`。
- 实现完成：新增 Native Runtime IPC handler 与 preload API，支持 status、diagnostics、rebuildIndex、clearCache、operation state、cancel operation、operation progress event 和 status changed event；主进程 facade 记录 operation state 并广播脱敏 progress / status。
- Jotai / listener：新增 `native-runtime-atoms.ts` 和 `useGlobalNativeRuntimeListeners`，全局管理 diagnostics、operation map、workspace indexing map、SearchDialog request map 和 Pipeline tail loading map；listener 在顶层挂载，detach 后不继续写状态。
- UI 完成：SearchDialog 增加 `全部 / Pipeline / Workspace / Chat / Agent` filter tabs、fallback / rebuilding / unavailable / error 简短状态和更多结果；PipelineRecords 增加 records tail loading、读取失败和 retry；Settings 增加“运行诊断”面板，支持刷新、重建当前工作区索引、二次确认清理派生缓存和复制脱敏 diagnostics。
- 安全边界：renderer rebuild 只能传 `workspaceId` / `requestId`，实际 `workspace-files/` 和 attached directories 由 main process 派生；diagnostics / status / operation 推送移除 `binaryPath` 并脱敏 Bearer、Authorization、credentialed URL、home path 和错误详情；clear cache 只清理 TypeScript workspace index 派生 cache，不触达 JSON / JSONL 事实源。
- 验证通过：目标 Native Runtime / IPC / atoms / hook / SearchDialog / Diagnostics / shared tests、Pipeline renderer tests、shared/electron typecheck、main/preload/renderer build、`bun install --frozen-lockfile --dry-run`、`git diff --check` 均通过；`build:renderer` 仅有既有大 chunk 警告。
- 未完成项 / [skip]：Electron 交互 smoke 与 packaged smoke 未在本阶段执行，留到 Phase 8；Rust sidecar、Go supervisor、native binary、native optional package、大文件 / 日志 chunk preview 均未实现。
- 阶段提交：`16cbb3e1 feat(rust-go): 完成 Phase 4 Native Runtime diagnostics 前端体验`。
- 下一阶段入口：Phase 5 Rust search sidecar 试点；必须先做依赖搜索和 decision record，明确性能收益门槛、fallback / missing binary、contract parity、packaged smoke 和安全门禁。

## Phase 5：Rust Search Sidecar 试点

### 阶段状态

- [x] 阶段开始
- [x] 依赖评估完成
- [~] 测试先行完成（Rust search-only sidecar、sidecar manager、contract parity、benchmark、native benchmark gate 汇总、Agent production facade benchmark、Agent nested native parity、smoke script、native-cache schema、optional package manifest 预检、bundled package resolver fixture、packaged app layout、packaged app evidence classifier、optionalDependencies declaration preflight gate、optional package install-chain preflight gate、default-enable readiness 预检、packaging config allowlist 预检、optional package 发布状态预检、packaged bundled binary smoke 执行计划预检、optional package publish-target dry-run 预检、release-ready source version 前置、optional package source preflight、optional / packaged gate 执行顺序预检、builder allowlist dry-run plan、optionalDependencies install-chain dry-run plan、optional package publication change plan 证据拆分、packaged smoke invocation plan、optional package publication invocation plan 和 publication invocation 发布证据收紧测试已完成；真实 packaged app bundled binary smoke 测试尚未完成）
- [~] 实现完成（Rust search-only sidecar、Electron main process sidecar manager、Chat opt-in native search、benchmark 增强、native benchmark gate 汇总、Agent production facade benchmark 分析、Agent nested native parity、基础 smoke script、native-cache schema helper、optional package manifest 预检、bundled package resolver fixture、packaged app layout preflight、packaged app evidence classifier、optionalDependencies declaration preflight gate、optional package install-chain preflight gate、default-enable readiness 预检、packaging config allowlist 预检、optional package 发布状态预检、packaged bundled binary smoke 执行计划预检、optional package publish-target dry-run 预检、release-ready source version 前置、optional package source preflight、optional / packaged gate 执行顺序预检、builder allowlist dry-run plan、optionalDependencies install-chain dry-run plan、optional package publication change plan 证据拆分、packaged smoke invocation plan、optional package publication invocation plan 和 publication invocation 发布证据收紧已完成；真实 optional package 发布 / optionalDependencies 实际声明与安装执行、builder allowlist 实际修改、packaged binary 和 default enable 尚未完成）
- [~] 验证完成（Rust / native runtime tests / typecheck / build:main / benchmark / native benchmark gate 汇总 / Agent production facade benchmark / Agent nested native parity / packaged-manifest preflight / resolver fixture smoke / packaged app layout smoke / optionalDependencies declaration preflight / optional package install-chain preflight / default-enable readiness 预检 / packaging config allowlist 预检 / optional package 发布状态预检 / packaged bundled binary smoke 执行计划预检 / optional package publish-target dry-run 预检 / release-ready source version 前置 / optional package source preflight / optional packaged execution plan / builder allowlist dry-run plan / optionalDependencies install-chain dry-run plan / optional package publication change plan 证据拆分 / packaged smoke invocation plan / optional package publication invocation plan / publication invocation 发布证据收紧已通过；真实 packaged app bundled binary smoke 尚未完成）
- [~] 阶段 Review 完成（已记录前置、search-only、sidecar manager、性能优化、benchmark gate、native benchmark gate 汇总、Agent production facade benchmark、Agent nested native parity、smoke/cache schema、fake sidecar smoke、optional package manifest 预检、bundled package resolver fixture、packaged app layout preflight、packaged app evidence classifier、optionalDependencies declaration preflight、optional package install-chain preflight、default-enable readiness 预检、packaging config allowlist 预检、optional package 发布状态预检、packaged bundled binary smoke 执行计划预检、optional package publish-target dry-run 预检、release-ready source version 前置、optional package source preflight、optional packaged execution plan、builder allowlist dry-run plan、optionalDependencies install-chain dry-run plan、optional package publication change plan 证据拆分、packaged smoke invocation plan、optional package publication invocation plan 和 publication invocation 发布证据收紧 Review；完整 Phase 5 Review 尚未完成）
- [ ] 阶段提交完成

### 目标

在 TS fallback 已稳定、benchmark 证明收益的前提下，用最小 Rust sidecar 替换 search / tail 热点。Rust sidecar 只做索引、搜索和 tail，不接手业务编排、权限、Git 写入或 UI。

### 入口条件

- [x] Phase 0 到 Phase 4 已完成并提交。
- [x] benchmark 显示 TS fallback 在目标数据规模下仍存在 native 试点收益空间：100MB 级 Chat JSONL P95 279.622ms、event loop delay 10.020ms；Agent JSONL P95 216.859ms、event loop delay 1.248ms。
- [x] Rust sidecar 的收益门槛已写入 `tasks/todo.md`：100MB JSONL 搜索 P95 至少快 3 倍，event loop delay 至少降低 70%，并包含 Agent / Pipeline / Workspace / cold start 门槛。
- [x] 已完成 Rust 依赖 decision record，比较继续 TS、Rust crate、Go package：`docs/improve/rust-go/2026-06-03-phase-5-dependency-decision-record.md`。
- [x] 已确认 packaged smoke 计划覆盖 native available / missing：`docs/improve/rust-go/2026-06-03-phase-5-sidecar-protocol-and-smoke-plan.md`。

### Rust 工程任务

- [x] 新增 native workspace：`native/search/`，当前作为 search-only Rust sidecar 源码切片；package / optional binary 策略留到 main process 集成和打包阶段确认。
- [x] 定义 sidecar protocol：首版采用 stdin / stdout line-delimited JSON protocol，详见 `2026-06-03-phase-5-sidecar-protocol-and-smoke-plan.md`。
- [~] 实现 `status`、`search`、`shutdown`；`tail_jsonl` 当前返回 typed `invalid_input`，因为 benchmark 显示 tail 不是首个 native 默认收益点。
- [x] 实现 protocol version、cache schema version、capability handshake：`status` 返回 `protocolVersion = 1`、`cacheSchemaVersion = 1`、`capabilities = ["diagnostics", "indexed-search"]`。
- [x] 所有返回 JSON 通过 Rust 单测覆盖基础 shape；TS fallback contract parity 已接入真实 Rust sidecar。
- [x] stdout 只输出 protocol JSON；当前 Rust sidecar 不写 stderr，search snippet 已限制长度并做基础 token / Authorization / credentialed URL 脱敏。
- [x] 对 timeout、bad request 返回 typed error；sidecar manager 已覆盖 crash、timeout、contract violation、version mismatch 和 missing binary fallback。

### 主进程集成任务

- [x] 新增 `native-runtime-sidecar-manager.ts`，封装 sidecar lifecycle、status、search、shutdown、timeout 和 pending cleanup。
- [x] main process 默认不启动 native；只有显式 env opt-in 且给出 binary path 时才创建 sidecar manager。
- [x] 首次 `status` / `search` 时懒启动 sidecar。
- [x] sidecar crash 后本进程禁用 native 并 fallback TS（拒绝类错误除外）。
- [x] contract violation 后本进程禁用 native，记录 diagnostics。
- [x] 所有 native 结果进入 service 前做 schema 校验和二次脱敏。

### 测试任务

- [x] `cargo test` 覆盖 protocol parser、status、search、bad line、missing source、empty query、limit clamp、long query、deadline、snippet cap、redaction 和 UTF-16 offset；tail 仍未进入 search-only 切片。
- [x] Contract parity 测试：同一 fixture 对比 TS fallback 与 Rust 输出。
- [x] Sidecar manager 测试覆盖 missing binary、version mismatch、timeout、crash、shutdown、contract violation 和拒绝类错误不 fallback。
- [x] 基础 smoke script 测试覆盖参数解析、脱敏、native available 无 binary 时跳过且不从系统 `PATH` 查找、native missing fallback。
- [x] Benchmark summary 已输出 `nativeSearchGate`，可机器读取 Chat / Agent native vs TS 的 P95、event-loop delay P95、work-delay P95 delta、benchmark blockers 和 default-enable blockers。
- [~] Packaged smoke 已覆盖 manifest preflight、临时 resolver fixture、packaged app layout preflight 和 `asar: false` evidence classifier；真实 bundled binary path / 不使用系统 `PATH` 的 packaged app smoke 尚未完成。
- [x] Benchmark 对比 Phase 0 / Phase 1 / Phase 5 的性能。

### 触达文件

- [x] `native/search/` 或最终确认的 Rust 目录。
- [x] `apps/electron/src/main/lib/native-runtime/native-runtime-sidecar-manager.ts`
- [x] `apps/electron/src/main/lib/native-runtime/native-runtime-service.ts`
- [x] `apps/electron/src/main/lib/native-runtime/native-runtime-diagnostics.ts`
- [x] `apps/electron/src/main/lib/native-runtime/native-runtime-cache-schema.ts`
- [x] `apps/electron/scripts/native-runtime-benchmark.ts`
- [x] `apps/electron/scripts/native-runtime-smoke.ts`
- [x] `apps/electron/package.json`
- [skip] `electron-builder.yml`：本轮明确不创建 packaged native binary、不改打包配置。
- [x] `bun.lock`

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

前置 Review：

- Phase 5 已完成前置计划和依赖决策，但未进入 Rust 实现。新增 `docs/improve/rust-go/2026-06-03-phase-5-dependency-decision-record.md`，记录 crates.io / docs.rs / OSV / Go 对照查询结果。
- 依赖结论：进入实现阶段时只建议评估 `serde`、`serde_json` 和可选 `memchr`；暂缓 `regex`、`walkdir`、`ignore`、`memmap2`、`tantivy`；Go / `fsnotify` 不进入 Phase 5 默认实现。
- 新增 `docs/improve/rust-go/2026-06-03-phase-5-sidecar-protocol-and-smoke-plan.md`，确定首版采用 stdin / stdout line-delimited JSON protocol，初始 method 为 `status`、`search`、`tail_jsonl`、`shutdown`。
- Fallback / smoke 结论：native missing / available、protocol mismatch、crash、timeout、cache corruption 和“不使用系统 PATH”必须进入后续 smoke；所有 native result 仍需 main process schema 校验、二次脱敏和路径白名单。
- 当时未完成：尚未重新跑大规模 benchmark，尚未创建 Rust 工程，尚未安装依赖，尚未创建 native binary，尚未新增 sidecar manager / smoke script / optional package / 打包配置。该前置 Review 已被后续 search-only 源码切片 Review 更新；当前仍未完成的是 Electron main process sidecar manager、fallback 集成、contract parity、native benchmark、optional package 和 packaged smoke。

Search-only Rust sidecar 源码切片 Review：

- 已重新跑 100MB 级 TS fallback benchmark。稳定门禁命令：`bun run --filter='@codeinsights/electron' native-runtime:benchmark --records 100000 --payload-bytes 900 --workspace-files 100000 --log-bytes 524288000 --iterations 20`；Chat JSONL 99,527,780 bytes，P95 279.622ms，event loop delay 10.020ms；Agent JSONL 102,397,780 bytes，P95 216.859ms，event loop delay 1.248ms。
- 已新增 `native/search/` Rust crate，直接依赖固定为 `serde = 1.0.228`、`serde_json = 1.0.150`，`Cargo.lock` 记录传递依赖；未运行 `cargo add`，未修改 `package.json` / `bun.lock` / `electron-builder.yml`。
- 当前 Rust sidecar 只实现 search-only 源码切片：stdin / stdout line-delimited JSON protocol、`status`、literal `search`、`shutdown`；`tail_jsonl` 明确返回 typed `invalid_input`，不伪装为已实现。
- 已按代码审查修复安全边界：不再 fallback 到整条 JSON record；query 上限为 128 chars；snippet 上限为 160 chars；matchedRanges 使用 UTF-16 code unit offset；selected text 进入 snippet 前做基础 Bearer / Authorization / credentialed URL 脱敏；`deadlineMs` 会返回 typed `timeout`；`shutdown` 返回 ack 后 CLI 会退出 stdin loop。
- 验证通过：`cargo test`（11 pass）、`cargo fmt --check`、`cargo clippy -- -D warnings`、CLI shutdown smoke、`bun test apps/electron/src/main/lib/native-runtime`（28 pass）、`bun run --filter='@codeinsights/electron' typecheck`、`bun run --filter='@codeinsights/shared' typecheck`、`bun run --filter='@codeinsights/electron' build:main`、`git diff --check`。`build:main` 仅有既有 bundle size 警告。
- Search-only 源码切片提交：`e39682f1 feat(rust-go): 完成 Phase 5 最小 Rust search sidecar 源码切片`。完整 Phase 5 尚未完成，因此阶段状态仍保持 `[~]`。
- 本切片未完成 / 未进入：未接入 `native-runtime-sidecar-manager.ts`，未让 Electron main process 调用 Rust sidecar，未做 Rust vs TS native benchmark 对比，未创建 packaged native binary，未新增 optional package，未修改打包配置，未修改根 `README.md` / 根 `AGENTS.md`，未 push，未创建 PR。

Native benchmark gate 汇总 Review：

- 实现提交：`f86553ee feat(rust-go): 补齐 Phase 5 native benchmark gate 汇总`。
- 已在 `apps/electron/scripts/native-runtime-benchmark.ts` 的 summary 中新增 `nativeSearchGate`，对 `chat-search-large-history` / `native-chat-search-large-history` 和 `agent-runtime-search` / `native-agent-runtime-search` 生成机器可读对比：`p95DeltaMs`、`p95Ratio`、`eventLoopDelayP95DeltaMs`、`eventLoopWorkDelayP95DeltaMs`、`p95Improved`、`eventLoopDelayP95NotRegressed`、`eventLoopWorkDelayP95NotRegressed`。
- gate 只表达 benchmark 状态，不改变产品默认行为。没有显式 native binary 时 `evaluated=false` 且 blocker 为 `native_binary_not_provided`；有 native 对比时仍固定输出 `optional_package_install_chain_not_evaluated` 和 `packaged_app_bundled_binary_not_evaluated`，`defaultEnableCandidate=false`，避免把 P95 优势误判为可默认启用。
- 子代理复核结论：Agent native work-delay 小幅回退更可能来自 benchmark 口径、sidecar hop 固定成本和短调用噪声；生产 Agent 搜索不能直接加 top-level `nativeTextFields`，因为 Agent message 可包含嵌套 SDK content。后续 `665c5db7` 已用白名单 extractor 对齐嵌套 text block parity，但 default enable 仍受 packaged / optional gate 阻断。
- optional package 子代理复核结论：当前 4 个计划 `@codeinsights/native-search-*` 包未发布，`bun.lock` 没有 resolved package entry，`apps/electron/node_modules` 没有 installed package manifest；同时 `apps/electron/electron-builder.yml` 排除 `node_modules/@codeinsights/**`，因此本轮不能安全添加真实 native search optionalDependencies 或声明真实 packaged bundled binary 已验证。
- 已递增 `@codeinsights/electron` patch 版本到 `0.0.147` 并同步 `bun.lock`；没有新增 `@codeinsights/native-search-*` optionalDependencies。
- 验证通过：`bun test apps/electron/scripts/native-runtime-benchmark.test.ts apps/electron/src/main/lib/native-runtime/ts-event-search-service.test.ts`；`bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode packaged-manifest`；`bun run --filter='@codeinsights/electron' smoke:native-runtime -- --mode packaged-app-layout`；`bun run --filter='@codeinsights/electron' typecheck`；`bun run --filter='@codeinsights/electron' build:main`；`git diff --check`。
- 边界保持：native search 继续显式 opt-in / default off；未创建或更新 native binary；未修改 `apps/electron/electron-builder.yml`、根 `README.md`、根 `AGENTS.md`；未新增真实 native search optionalDependencies；未 push，未创建 PR。

Agent production facade benchmark 分析 Review：

- 实现提交：`9a06908a feat(rust-go): 补齐 Phase 5 Agent facade benchmark 分析`。
- 已在 `native-runtime:benchmark` summary 中新增 `agentFacadeSearch`，并新增 `agent-runtime-production-facade-search` case。该 case 使用 SDK-like nested `message.content[]` fixture 和生产 Agent 搜索等价的文本提取逻辑；在 `9a06908a` 阶段尚未声明 native extractor，因此即使 native sidecar 可用也保持 `implementation="typescript"`。
- 已明确 direct native Agent benchmark 与生产 Agent facade 的边界：`native-agent-runtime-search` 仍是 synthetic direct native case，传入 top-level `textFields: ["type", "content"]`；生产 Agent JSONL 包含嵌套 SDK content，而 Rust sidecar 当前只抽 top-level string fields，不能把 synthetic benchmark 当成默认启用证据。
- `nativeSearchGate` 仍只比较 direct native Chat / Agent benchmark；`agentFacadeSearch` 不参与 gate 对比，只作为 default-enable 风险说明。`9a06908a` 阶段无 native binary 时 summary 输出 `agent_facade_native_text_fields_not_declared`；后续 `665c5db7` 已改为受限 extractor / parity 口径，但仍不改变全局 default off。
- 已补 `ts-event-search-service` 回归测试：Agent SDK nested text 未声明 `nativeTextFields` 时不调用 sidecar，仍可通过 TypeScript facade 命中 nested text。

Agent nested native parity Review：

- 实现提交：`665c5db7 feat(rust-go): 补齐 Phase 5 Agent nested native parity`。
- 已新增受限白名单 extractor `agent_message_search_text`：TypeScript source / sidecar request 只允许该字面量；Rust sidecar 用 enum 解析，未知值会进入 typed `invalid_input`，没有开放 JSONPath 或任意 nested path。
- 在 `665c5db7` 阶段 Rust sidecar `0.0.3` / `0.0.3-dev` 已支持搜索顶层 legacy `content` 或 `message.content[]` 中 `type="text"` 的字符串 block；后续 `dc75f380` 已将 source `BINARY_VERSION` 对齐为 `0.0.3`。不会搜索 raw JSON、`tool_use.input`、`tool_use.name` 或非 text block。直接 sidecar snippet 仍做 Bearer / credentialed URL 脱敏。
- 生产 Agent 搜索 source 已声明 `nativeTextExtractor: "agent_message_search_text"`，但 native 仍只在 `CODEINSIGHTS_NATIVE_RUNTIME=1`、`CODEINSIGHTS_NATIVE_SEARCH=1` 且 sidecar binary 可用时 opt-in；默认没有 native sidecar 时继续 TypeScript fallback。
- `TypeScriptEventSearchService` 仍把 native 命中仅作为 cursor anchor：回读 JSONL 后用生产 `getSearchableAgentText()` / `getSearchableAgentMessageId()` 重建 legacy result 和 snippet，避免 UI 语义受 Rust snippet 或 direct native id 影响。
- `native-runtime:benchmark` 的 `agentFacadeSearch` 已改为 extractor/native parity 口径：无 native binary 时 `nativeParityEvaluated=false`，有 native parity case 时只能说明 Agent facade 自身 parity 能力具备；全局 `nativeSearchGate.defaultEnableCandidate` 仍保持 `false`，真实 optional package / packaged app gate 未完成前不能默认启用。
- 版本同步：`@codeinsights/electron` 已从 `0.0.148` 递增到 `0.0.149`，`bun.lock` 已同步；`native/search` crate 已从 `0.0.2` 递增到 `0.0.3`，`Cargo.lock` 已同步。未创建 release / packaged native binary。
- 验证通过：新增测试先红灯；实现后 `bun test apps/electron/src/main/lib/native-runtime/ts-event-search-service.test.ts apps/electron/src/main/lib/native-runtime/native-runtime-contract-parity.test.ts apps/electron/scripts/native-runtime-benchmark.test.ts`（20 pass）；`cargo test --manifest-path native/search/Cargo.toml`（13 pass）；小规模 `native-runtime:benchmark`；`smoke:native-runtime -- --mode packaged-manifest`；`smoke:native-runtime -- --mode packaged-app-layout`；`bun test apps/electron/src/main/lib/agent-session-manager.test.ts`；`bun run --filter='@codeinsights/electron' typecheck`；`bun run --filter='@codeinsights/electron' build:main`；`bun install --frozen-lockfile --dry-run`；`git diff --check`。
- 边界保持：native 继续显式 opt-in / default off；未创建 packaged native binary；未修改根 `README.md` / 根 `AGENTS.md` / `apps/electron/electron-builder.yml`；未新增真实 `@codeinsights/native-search-*` optionalDependencies；未 push，未创建 PR。
- 已递增 `@codeinsights/electron` patch 版本到 `0.0.148` 并同步 `bun.lock`；没有新增 `@codeinsights/native-search-*` optionalDependencies。
- 验证通过：新增 benchmark 测试先红灯；实现后 `bun test apps/electron/scripts/native-runtime-benchmark.test.ts apps/electron/src/main/lib/native-runtime/ts-event-search-service.test.ts`（16 pass）；小规模 TS benchmark；本地 ignored `0.0.2-dev` sidecar 小规模 native benchmark；`bun run --filter='@codeinsights/electron' typecheck`；`bun run --filter='@codeinsights/electron' build:main`；`bun test apps/electron/src/main/lib/agent-session-manager.test.ts`；`bun install --frozen-lockfile --dry-run`；`git diff --check`。
- 边界保持：4 个计划 `@codeinsights/native-search-*` 包仍为 npm registry `E404`，`apps/electron/electron-builder.yml` 仍排除 `node_modules/@codeinsights/**`；未执行真实 optionalDependencies 声明 / 安装链路，未创建 packaged native binary，未修改根 `README.md` / 根 `AGENTS.md` / `apps/electron/electron-builder.yml`，未 push，未创建 PR。

Default-enable readiness 预检 Review：

- 实现提交：`2bf88a5a feat(rust-go): 补齐 Phase 5 default-enable readiness 预检`。
- 已新增 `apps/electron/src/main/lib/native-runtime/native-runtime-default-enable-readiness.ts`，把 benchmark gate、Agent facade native extractor / parity、optionalDependencies declaration、optional package install-chain、packaged app evidence / identity、real packaged binary 和人工风险复核收敛为 `nativeSearchDefaultEnableReadiness`。
- `native-runtime:benchmark` summary 已接入 readiness：benchmark gate 与 Agent facade parity 可从 `nativeSearchGate` / `agentFacadeSearch` 推导，但 optional / packaged / risk review 在 benchmark 输入中仍为 false。
- `smoke:native-runtime` summary 已接入 readiness：optional / packaged smoke 字段可提供 declaration、install-chain、packaged evidence / identity 和 real binary 信号，但 benchmark / Agent parity / risk review 在 smoke 输入中仍为 false。
- 当前 `nativeSearchDefaultEnableReadiness.defaultEnableCandidate=false`、`explicitOptInRequired=true`；该预检完成不等于最终 default-enable 风险决策完成。
- 已按 review 修正顶层真实 binary gate：`realPackagedBinaryVerified` 同时要求 `optionalDependenciesInstallChainVerified`、`packagedAppEvidenceVerified`、`packagedAppIdentityVerified` 和真实 binary verification；`bundledBinaryVerified` 只能跟随修正后的真实 gate，不能被临时 fixture 或单项 resolver 结果绕过。
- 版本同步：`@codeinsights/electron` 已递增到 `0.0.150` 并同步 `bun.lock`；没有新增 `@codeinsights/native-search-*` optionalDependencies。
- 验证通过：新增测试先红灯；实现后 `bun test apps/electron/src/main/lib/native-runtime/native-runtime-default-enable-readiness.test.ts apps/electron/scripts/native-runtime-smoke.test.ts apps/electron/scripts/native-runtime-benchmark.test.ts`（32 pass）；`smoke:native-runtime -- --mode packaged-manifest`；`smoke:native-runtime -- --mode packaged-app-layout`；小规模 `native-runtime:benchmark`；`bun run --filter='@codeinsights/electron' typecheck`；`bun run --filter='@codeinsights/electron' build:main`；`bun install --frozen-lockfile --dry-run`；`git diff --check`。
- 边界保持：native 继续显式 opt-in / default off；未创建 packaged native binary；未修改根 `README.md` / 根 `AGENTS.md` / `apps/electron/electron-builder.yml`；未新增真实 `@codeinsights/native-search-*` optionalDependencies；未 push，未创建 PR。

Packaging config allowlist 预检 Review：

- 实现提交：`348e003d feat(rust-go): 补齐 Phase 5 packaging config allowlist 预检`。
- 已新增 `validateNativeSearchPackagingConfig()`，只读解析 `electron-builder.yml` 顶层 `files:` 列表，要求 4 个计划 `@codeinsights/native-search-*` optional packages 都有显式 per-package include；通配 include、workspace broad include 和 broad exclude 都不能让 gate 通过。
- 当前仓库输出 no-go：`packagingConfigVerified=false`，`missingPackagingConfigPackages` 包含 darwin arm64 / darwin x64 / win32 x64 / linux x64 四个计划包，`blockingPackagingConfigExcludes=["!node_modules/@codeinsights/**"]`。这只是预检读数，不修改 `apps/electron/electron-builder.yml`。
- `smoke:native-runtime -- --mode packaged-manifest` 与 `--mode packaged-app-layout` summary 已接入 packaging config gate；`nativeSearchDefaultEnableReadiness` 新增 blocker `packaging_config_not_verified`，当前继续输出 `defaultEnableCandidate=false`、`explicitOptInRequired=true`。
- `realPackagedBinaryVerified` / `bundledBinaryVerified` 已进一步绑定 packaging config gate；只有 optional install-chain、packaging config、packaged app evidence、packaged app identity 和真实 binary verification 同时通过，才可能证明真实 packaged bundled binary。
- 子代理审查指出 partial optional package opt-in 时 packaging config preflight 不应继续 skipped；已新增 `presentPackages` 记录任一计划包是否出现在 optionalDependencies，半声明状态下 packaging config 不通过会 failed。
- 已新增 unsupported YAML 保守回归：inline array / FileSet object 这类当前未支持的 `files` 写法不会被误判 verified。若后续需要支持更多 electron-builder YAML 形态，应先补解析器和测试。
- 版本同步：`@codeinsights/electron` 已递增到 `0.0.151` 并同步 `bun.lock`；未新增真实 `@codeinsights/native-search-*` optionalDependencies。
- 验证通过：`bun test apps/electron/src/main/lib/native-runtime/native-runtime-package-manifest.test.ts apps/electron/src/main/lib/native-runtime/native-runtime-default-enable-readiness.test.ts apps/electron/scripts/native-runtime-smoke.test.ts apps/electron/scripts/native-runtime-benchmark.test.ts`（44 pass）；`smoke:native-runtime -- --mode packaged-manifest`；`smoke:native-runtime -- --mode packaged-app-layout`；`bun run --filter='@codeinsights/electron' typecheck`；`bun run --filter='@codeinsights/electron' build:main`；`bun install --frozen-lockfile --dry-run`；`git diff --check`。
- 边界保持：native 继续显式 opt-in / default off；未创建 packaged native binary；未修改根 `README.md` / 根 `AGENTS.md` / `apps/electron/electron-builder.yml`；未新增真实 `@codeinsights/native-search-*` optionalDependencies；未 push，未创建 PR。

Packaged bundled binary smoke 执行计划预检 Review：

- 实现提交：`dedbfed1 feat(rust-go): 补齐 Phase 5 packaged smoke 执行计划预检`。
- 已在 `smoke:native-runtime` summary 中新增 `packagedBundledBinarySmokePlan`，输出 `blocked` / `ready` / `verified` 三态、`blockedBy`、`requiredInputs`、`nextAllowedActions`、`forbiddenActions` 和真实 packaged app layout 候选命令。
- 当前仓库默认 `packaged-manifest` 与 `packaged-app-layout` 均为 `packagedBundledBinarySmokePlan.status="blocked"`；阻塞项包含 `optional_packages_not_published`、`optional_dependencies_not_declared`、`optional_package_install_chain_not_verified`、`packaging_config_not_verified` 和 `prebuilt_packaged_app_required`。
- `ready` 只表示真实 optional / install-chain / packaging config / packaged app root 等前置输入具备；`verified` 必须同时满足顶层 `bundledBinaryVerified=true` 且没有其他 blocker。`realPackagedBinaryVerified=true`、临时 fixture、publication-only、packaging-only 或 install-chain-only 都不能单独证明真实 bundled binary。
- 版本同步：`@codeinsights/electron` 已递增到 `0.0.153` 并同步 `bun.lock`；未新增真实 `@codeinsights/native-search-*` optionalDependencies。
- 验证通过：`bun test apps/electron/scripts/native-runtime-smoke.test.ts apps/electron/src/main/lib/native-runtime/native-runtime-package-manifest.test.ts apps/electron/src/main/lib/native-runtime/native-runtime-default-enable-readiness.test.ts`（46 pass）；`smoke:native-runtime -- --mode packaged-manifest`；`smoke:native-runtime -- --mode packaged-manifest --check-registry` 预期 exit 1；`smoke:native-runtime -- --mode packaged-app-layout`；`smoke:native-runtime -- --mode packaged-app-layout --check-registry` 预期 exit 1；`bun run --filter='@codeinsights/electron' typecheck`；`bun run --filter='@codeinsights/electron' build:main`；`bun install --frozen-lockfile --dry-run`；`git diff --check`。
- 边界保持：native 继续显式 opt-in / default off；未创建 packaged native binary；未修改根 `README.md` / 根 `AGENTS.md` / `apps/electron/electron-builder.yml`；未新增真实 native search optionalDependencies；未 push，未创建 PR。

Optional package publish-target dry-run 预检 Review：

- 实现提交：`9e3e3dff feat(rust-go): 补齐 Phase 5 optional package publish target 预检`。
- 已新增 `validateNativeSearchOptionalPackagePublishTarget()` 和 `smoke:native-runtime -- --mode optional-package-publish-target --native-search-package-version 0.0.3`。该 dry-run 只读检查计划发布版本、registry 目标版本冲突、planned optional package manifest metadata、Cargo version 与 source `BINARY_VERSION` 一致性。
- 新增 summary 字段：`optionalPackagePublishTargetChecked`、`optionalPackagePublishTargetReady`、`optionalPackagePublishTargetVersion`、`optionalPackagePublishTargetBlockers`、`publishTargetAvailablePackages`、`publishedVersionCollisionPackages`、`invalidPublishTargetPackages`、`unavailablePublishTargetPackages`、`nativeSearchVersionConsistencyVerified`、`nativeSearchCargoVersion`、`nativeSearchBinaryVersion`、`plannedOptionalPackageManifestsVerified`。
- 在 `9e3e3dff` 阶段默认离线 dry-run 输出 `optionalPackagePublishTargetChecked=false`、`optionalPackagePublishTargetReady=false`，blockers 包含 `registry_check_required` 和 `native_search_binary_version_not_release_ready`，exit 0；显式 `--check-registry` 只读查询 npm 后，4 个 planned packages 目标版本当时可发布、无 registry collision，但仍因 `native/search/src/lib.rs` 为 `0.0.3-dev` 输出 `native_search_binary_version_not_release_ready`，exit 1。后续 `dc75f380` 已解除 source version consistency blocker。
- 该 dry-run target-ready 不是 publication gate：registry 404 在 publish-target 语义中表示目标版本可用，不表示 package 已发布；它不能设置 `optionalPackagesPublished=true`，也不能改变 `realPackagedBinaryVerified` / `bundledBinaryVerified` / `packagedBundledBinarySmokePlan.status`。
- 版本同步：`@codeinsights/electron` 已递增到 `0.0.154` 并同步 `bun.lock`；未新增真实 `@codeinsights/native-search-*` optionalDependencies。
- 验证通过：`bun test apps/electron/src/main/lib/native-runtime/native-runtime-package-manifest.test.ts apps/electron/scripts/native-runtime-smoke.test.ts apps/electron/src/main/lib/native-runtime/native-runtime-default-enable-readiness.test.ts`（55 pass）；默认 optional publish-target smoke；显式 registry dry-run 预期 exit 1 no-go；`smoke:native-runtime -- --mode packaged-manifest`；`smoke:native-runtime -- --mode packaged-app-layout`；`bun run --filter='@codeinsights/electron' typecheck`；`bun run --filter='@codeinsights/electron' build:main`；`bun install --frozen-lockfile --dry-run`；`git diff --check`。
- 边界保持：native 继续显式 opt-in / default off；未创建 packaged native binary；未修改根 `README.md` / 根 `AGENTS.md` / `apps/electron/electron-builder.yml`；未新增真实 native search optionalDependencies；未 push，未创建 PR。

Release-ready source version 前置 Review：

- 实现提交：`dc75f380 feat(rust-go): 对齐 Phase 5 native search release source version`。
- 已将 `native/search/src/lib.rs` 的 `BINARY_VERSION` 从 `0.0.3-dev` 调整为 `0.0.3`，与 `native/search/Cargo.toml` 的 package version 对齐；未修改 Cargo package version，未创建 release / packaged native binary。
- 已更新 publish-target dry-run 测试边界：默认离线仍因 `registry_check_required` 保持 `optionalPackagePublishTargetReady=false`；显式 `--check-registry --native-search-package-version 0.0.3` 在 registry 404、planned manifest metadata 有效且 source / Cargo version 一致时输出 `optionalPackagePublishTargetReady=true`。
- 该 ready 只表示 4 个 planned optional package 的 `0.0.3` 目标版本当前可尝试发布、无 registry collision；仍不能设置 `optionalPackagesPublished=true`，也不能替代 optionalDependencies declaration / install-chain、packaging config allowlist、packaged app evidence / identity、真实 bundled binary verification 或最终 default-enable 风险决策。
- 版本同步：`@codeinsights/electron` 已递增到 `0.0.155` 并同步 `bun.lock`；未新增真实 `@codeinsights/native-search-*` optionalDependencies。
- 验证通过：`bun test apps/electron/src/main/lib/native-runtime/native-runtime-package-manifest.test.ts apps/electron/scripts/native-runtime-smoke.test.ts apps/electron/src/main/lib/native-runtime/native-runtime-default-enable-readiness.test.ts`（55 pass）；`cargo test --manifest-path native/search/Cargo.toml`（13 pass）；默认 optional publish-target smoke；显式 registry publish-target dry-run；`smoke:native-runtime -- --mode packaged-manifest`；`smoke:native-runtime -- --mode packaged-app-layout`；`bun run --filter='@codeinsights/electron' typecheck`；`bun run --filter='@codeinsights/electron' build:main`；`bun install --frozen-lockfile --dry-run`；`git diff --check`。
- 边界保持：native 继续显式 opt-in / default off；未发布 npm package；未执行真实 optionalDependencies 安装链路；未创建 packaged native binary；未修改根 `README.md` / 根 `AGENTS.md` / `apps/electron/electron-builder.yml`；未新增真实 native search optionalDependencies；未 push，未创建 PR。

Optional package source preflight Review：

- 实现提交：`05c393bb feat(rust-go): 补齐 Phase 5 optional package source 预检`。
- 已新增 `validateNativeSearchOptionalPackageSources()`，只读验证 planned package source manifest blueprint：exact package name / version、`private=false`、license / description、精确 `os` / `cpu`、`bin.codeinsights-native-search`、精确 `files` allowlist、`publishConfig.access=public` 和闭合 `native-search-package.json` 计划。
- 已新增 `smoke:native-runtime -- --mode optional-package-source --native-search-package-version 0.0.3`。当前 summary 输出 `optionalPackageSourceChecked=true`、`optionalPackageSourceReady=true`、`optionalPackageSourceVersion="0.0.3"`、4 个 `optionalPackageSourceReadyPackages`、`optionalPackageSourceBlockers=[]` 和 `plannedOptionalPackageSourceManifestsVerified=true`。
- 已补测试锁住失败边界：缺少 package source version 时 blocker 为 `package_source_version_required`；缺少任一 planned package source manifest 时 blocker 为 `package_source_manifest_missing`；validator 拒绝 lifecycle scripts、运行时 dependency 字段、宽泛 files 和 path-like 字段。
- 该 preflight 不运行 `npm pack`，不发布 npm package，不安装 optionalDependencies，不读取 binary，不证明 SHA，不修改 builder allowlist，不创建 packaged app，也不改变 `optionalPackagesPublished`、`optionalDependenciesDeclared`、`optionalDependenciesInstallChainVerified`、`packagingConfigVerified`、`realPackagedBinaryVerified`、`bundledBinaryVerified`、`packagedBundledBinarySmokePlan.status` 或 default-enable 结论。
- 版本同步：`@codeinsights/electron` 已递增到 `0.0.156` 并同步 `bun.lock`；未新增真实 `@codeinsights/native-search-*` optionalDependencies。
- 验证通过：`bun test apps/electron/src/main/lib/native-runtime/native-runtime-package-manifest.test.ts apps/electron/scripts/native-runtime-smoke.test.ts apps/electron/src/main/lib/native-runtime/native-runtime-default-enable-readiness.test.ts`（63 pass）；`smoke:native-runtime -- --mode optional-package-source --native-search-package-version 0.0.3`；默认 optional publish-target smoke；显式 registry publish-target dry-run；`smoke:native-runtime -- --mode packaged-manifest`；`smoke:native-runtime -- --mode packaged-app-layout`；`bun run --filter='@codeinsights/electron' typecheck`；`bun run --filter='@codeinsights/electron' build:main`；`bun install --frozen-lockfile --dry-run`；`git diff --check`。
- 边界保持：native 继续显式 opt-in / default off；未发布 npm package；未执行真实 optionalDependencies 安装链路；未创建 packaged native binary；未修改根 `README.md` / 根 `AGENTS.md` / `apps/electron/electron-builder.yml`；未新增真实 native search optionalDependencies；未 push，未创建 PR。

Optional / packaged gate 执行顺序预检 Review：

- 实现提交：`ce89f490 feat(rust-go): 补齐 Phase 5 optional packaged 执行顺序预检`。
- 已新增 `buildNativeSearchOptionalPackageExecutionPlan()` 和 `optionalPackageExecutionPlan` smoke summary，把 publish target / package source / publication / optionalDependencies / install-chain / packaging config / packaged bundled binary smoke / default-enable risk review 的严格顺序机器可读化。
- `completedPrerequisites` 是 `nextStage` 之前的严格顺序前缀；publish-target 与 source 这类独立证据只能进入 `observedEvidenceStages`，不能绕过 publication / install-chain / packaging config / packaged smoke gate。
- 当前 source preflight 与 publish-target dry-run 同时 ready 时，execution plan 只推进到 `nextStage="optional_package_publication"`、`readyForPublication=true`；这仍不等于 package 已发布、optionalDependencies 已声明 / 安装、builder allowlist 已修改或真实 packaged binary 已验证。
- 版本同步：`@codeinsights/electron` 已递增到 `0.0.157` 并同步 `bun.lock`；未新增真实 `@codeinsights/native-search-*` optionalDependencies。
- 验证通过：`bun test apps/electron/src/main/lib/native-runtime/native-runtime-package-manifest.test.ts apps/electron/scripts/native-runtime-smoke.test.ts apps/electron/src/main/lib/native-runtime/native-runtime-default-enable-readiness.test.ts`；`smoke:native-runtime -- --mode optional-package-source --native-search-package-version 0.0.3`；默认 / 显式 registry optional publish-target smoke；`smoke:native-runtime -- --mode packaged-manifest`；`smoke:native-runtime -- --mode packaged-app-layout`；`bun run --filter='@codeinsights/electron' typecheck`；`bun run --filter='@codeinsights/electron' build:main`；`bun install --frozen-lockfile --dry-run`；`git diff --check`。
- 边界保持：native 继续显式 opt-in / default off；未发布 npm package；未声明 / 安装真实 optionalDependencies；未创建 packaged native binary；未修改 builder、根 `README.md` 或根 `AGENTS.md`；未 push，未创建 PR。

Builder allowlist dry-run plan Review：

- 实现提交：`a3f98673 feat(rust-go): 补齐 Phase 5 builder allowlist dry-run plan`。
- 已新增 `buildNativeSearchPackagingConfigAllowlistChangePlan()` 和 `packagingConfigAllowlistChangePlan` smoke summary，只读输出 builder allowlist 实际修改前的人工 review 输入：4 个精确 required / missing include、当前 `blockingExcludes=["!node_modules/@codeinsights/**"]`、too-broad include 禁止项、removal candidates、候选验证命令和 forbidden actions。
- 当前 plan 为 `status="blocked"`、`approvalRequired=true`；它不修改 `apps/electron/electron-builder.yml`，不声明 / 安装 optionalDependencies，不发布 package，不读取 binary，也不证明 `packagingConfigVerified` 或 packaged app bundled binary。
- 版本同步：`@codeinsights/electron` 已递增到 `0.0.158` 并同步 `bun.lock`；未新增真实 `@codeinsights/native-search-*` optionalDependencies。
- 验证通过：`bun test apps/electron/src/main/lib/native-runtime/native-runtime-package-manifest.test.ts apps/electron/scripts/native-runtime-smoke.test.ts apps/electron/src/main/lib/native-runtime/native-runtime-default-enable-readiness.test.ts`（74 pass）；`smoke:native-runtime -- --mode packaged-manifest`；`smoke:native-runtime -- --mode optional-package-source --native-search-package-version 0.0.3`；默认 / 显式 registry optional publish-target smoke；`bun run --filter='@codeinsights/electron' typecheck`；`bun run --filter='@codeinsights/electron' build:main`；`bun install --frozen-lockfile --dry-run`；`git diff --check`。
- 边界保持：native 继续显式 opt-in / default off；未创建 packaged native binary；未修改根 `README.md` / 根 `AGENTS.md` / `apps/electron/electron-builder.yml`；未新增真实 native search optionalDependencies；未 push，未创建 PR。

OptionalDependencies install-chain dry-run plan Review：

- 实现提交：`7726a008 feat(rust-go): 补齐 Phase 5 optionalDependencies install-chain dry-run plan`。
- 已新增 `buildNativeSearchOptionalDependenciesInstallChainChangePlan()` 和 `optionalDependenciesInstallChainChangePlan` smoke summary，只读输出真实 optionalDependencies 声明与安装执行前的人工 review 输入：4 个 planned optionalDependency exact spec（当前 `0.0.3`）、publication / declaration / install-chain / lockfile / installed package blockers、候选验证命令和 forbidden actions。
- 当前 plan 为 `status="blocked"`、`approvalRequired=true`，blockers 包含 `optional_packages_not_published`、`optional_dependencies_not_declared`、`optional_dependency_install_chain_not_verified`、`optional_dependency_lockfile_not_verified` 和 `optional_dependency_installed_packages_not_verified`；它不写 `apps/electron/package.json` 或 `bun.lock`，不安装、不发布、不修改 builder、不读取 binary。
- 已把 `packaged-manifest` 与 `packaged-app-layout` 的 publication registry 检查绑定到 planned source `BINARY_VERSION=0.0.3` 对应的 exact expected package version，避免 registry `latest` 漂移导致 publication 与 install-chain 证明不同版本。
- 版本同步：`@codeinsights/electron` 已递增到 `0.0.159` 并同步 `bun.lock`；未新增真实 `@codeinsights/native-search-*` optionalDependencies。
- 验证通过：`bun test apps/electron/src/main/lib/native-runtime/native-runtime-package-manifest.test.ts apps/electron/scripts/native-runtime-smoke.test.ts apps/electron/src/main/lib/native-runtime/native-runtime-default-enable-readiness.test.ts`（80 pass）；默认 / 显式 registry optional publish-target smoke；`smoke:native-runtime -- --mode optional-package-source --native-search-package-version 0.0.3`；`smoke:native-runtime -- --mode packaged-manifest`；`smoke:native-runtime -- --mode packaged-app-layout`；`bun run --filter='@codeinsights/electron' typecheck`；`bun run --filter='@codeinsights/electron' build:main`；`bun install --frozen-lockfile --dry-run`；`git diff --check`。
- 预期 no-go 验证：`smoke:native-runtime -- --mode packaged-manifest --check-registry` 仍返回 exit 1，因为 4 个计划 optional package 尚未发布；这证明 publication blocker 生效，不是测试失败。
- 边界保持：native 继续显式 opt-in / default off；未发布 npm package；未声明 / 安装真实 optionalDependencies；未创建 packaged native binary；未修改根 `README.md` / 根 `AGENTS.md` / `apps/electron/electron-builder.yml`；未新增真实 native search optionalDependencies；未 push，未创建 PR。

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

- [x] Phase 4 diagnostics 和 request cancellation 已完成。
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
请继续 CodeInsights Rust / Go 优化重构迭代。先读取 tasks/lessons.md、tasks/todo.md、docs/improve/rust-go/2026-06-01-rust-go-optimization-plan.md、docs/improve/rust-go/2026-06-01-rust-go-development-checklist.md、docs/improve/rust-go/2026-06-03-phase-5-dependency-decision-record.md、docs/improve/rust-go/2026-06-03-phase-5-sidecar-protocol-and-smoke-plan.md、docs/improve/rust-go/next-session-prompt.md 和 native/search/。

当前进度：Rust / Go 优化方案、开发跟踪清单、阶段提交纪律、Phase 0“基线、契约与 benchmark”、Phase 1“TypeScript fallback 与 EventSearchService 重构”、Phase 2“Pipeline records cursor / tail 与全局搜索接入”、Phase 3“Workspace 文件索引 TS cache 与 watcher invalidation”和 Phase 4“前端可见体验、Jotai 状态和 diagnostics”已经完成。

Phase 5 已完成前置计划、依赖 decision record、sidecar protocol / fallback / packaged smoke 计划、100MB 级 TS fallback benchmark gate、`native/search/` 最小 Rust search-only sidecar 源码切片、Electron main process sidecar manager、Chat search fallback gate、Rust vs TS contract parity、100MB native benchmark 对比、Rust search 早停性能优化、2 轮稳定 benchmark 复跑、benchmark event-loop 口径增强、新字段稳定 benchmark 复跑、native benchmark gate 汇总、Agent production facade benchmark 分析、Agent nested native parity、基础 `smoke:native-runtime` 脚本、native-cache manifest schema helper、`protocol-mismatch` / `crash` / `timeout` / `cache-corruption` fake sidecar / isolated cache smoke、optional package manifest schema helper / `packaged-manifest` 预检、bundled package resolver fixture、packaged app layout preflight smoke、packaged app evidence classifier、`packagedAppIdentityVerified` gate、`563b804c feat(rust-go): 补齐 Phase 5 optionalDependencies 声明预检 gate`、`1114233b feat(rust-go): 补齐 Phase 5 optional package 安装链路预检`、`f86553ee feat(rust-go): 补齐 Phase 5 native benchmark gate 汇总`、`9a06908a feat(rust-go): 补齐 Phase 5 Agent facade benchmark 分析`、`665c5db7 feat(rust-go): 补齐 Phase 5 Agent nested native parity`、`2bf88a5a feat(rust-go): 补齐 Phase 5 default-enable readiness 预检`、`348e003d feat(rust-go): 补齐 Phase 5 packaging config allowlist 预检`、`6ae1c896 feat(rust-go): 补齐 Phase 5 optional package 发布状态预检`、`dedbfed1 feat(rust-go): 补齐 Phase 5 packaged smoke 执行计划预检`、`9e3e3dff feat(rust-go): 补齐 Phase 5 optional package publish target 预检`、`dc75f380 feat(rust-go): 对齐 Phase 5 native search release source version`、`05c393bb feat(rust-go): 补齐 Phase 5 optional package source 预检`、`ce89f490 feat(rust-go): 补齐 Phase 5 optional packaged 执行顺序预检`、`a3f98673 feat(rust-go): 补齐 Phase 5 builder allowlist dry-run plan`、`7726a008 feat(rust-go): 补齐 Phase 5 optionalDependencies install-chain dry-run plan`、`8097ed4c feat(rust-go): 补齐 Phase 5 optional package publication change plan`、`2188e276 fix(rust-go): 收紧 Phase 5 publication plan collision 过滤`、`d679eabb fix(rust-go): 拆分 Phase 5 publication plan 发布证据`、`edeba827 feat(rust-go): 补齐 Phase 5 packaged smoke invocation plan`、`f949fc13 feat(rust-go): 补齐 Phase 5 optional package publication invocation plan`，以及 `77b266e8 fix(rust-go): 收紧 Phase 5 publication invocation 发布证据`。最新开发基线是 `77b266e8`，最新已确认恢复入口是 `95305503 docs(rust-go): 同步 Phase 5 publication invocation 证据收紧状态`；若本轮再次产生状态同步提交，下次启动以 `git log -5 --oneline` 中最新的 Rust / Go docs 提交为实际恢复入口。

已完成的 Phase 5 sidecar manager 切片：Rust crate 直接依赖固定为 `serde = 1.0.228`、`serde_json = 1.0.150`；实现 stdin / stdout line-delimited JSON protocol、`status`、literal `search`、`shutdown` 和 explicit out-of-scope `tail_jsonl` typed error；Electron main process 通过 `native-runtime-sidecar-manager.ts` 显式 binary path opt-in，不从系统 PATH 查找；覆盖 missing binary、version mismatch、timeout、crash、shutdown、bad JSON stdout、stdout buffer 上限、contract violation、source boundary violation、range violation、拒绝类错误不 fallback、Chat legacy snippet parity、真实 Rust vs TS parity。`0eb350ff` 已把 Rust search 升级到 `0.0.2` / `0.0.2-dev` 并完成 `limit + 1` 早停；`665c5db7` 已把 Rust search 升级到 `0.0.3` / `0.0.3-dev` 并新增受限白名单 extractor `agent_message_search_text`；`dc75f380` 已将 source `BINARY_VERSION` 对齐为 `0.0.3`。

基础 smoke/cache 切片：`smoke:native-runtime` 支持 native-missing / native-available / protocol-mismatch / crash / timeout / cache-corruption / packaged-manifest / packaged-app-layout / optional-package-publish-target / optional-package-source 入口；native available 无显式 binary 时 skipped，不从 PATH 查找；native-cache manifest root 固定为 `getConfigDir()/native-cache`，记录 schema / protocol / package plan，不记录 binary path，损坏 manifest 返回 `cache_corrupted`。`e5b92fa7` 已补齐 optional package manifest schema helper；`ce104a59` 已补齐 bundled package resolver fixture；`800dc885` / `31e37cbb` 已补齐 packaged app evidence / identity gate。`563b804c` 新增 optionalDependencies declaration preflight，`1114233b` 新增 optional package install-chain preflight。`2bf88a5a` 已新增 `nativeSearchDefaultEnableReadiness`；`348e003d` 新增 packaging config allowlist 预检，当前 smoke 输出 `packagingConfigVerified=false`、4 个 `missingPackagingConfigPackages` 和 `blockingPackagingConfigExcludes=[\"!node_modules/@codeinsights/**\"]`。`6ae1c896` 新增 optional package 发布状态预检：默认 smoke 不联网，`optionalPackagePublicationChecked=false`、`optionalPackagesPublished=false`；显式 publication `--check-registry` 只读查询 npm packument，当前 4 个计划包全部进入 `missingPublishedOptionalPackages`，`packaged-manifest --check-registry` 和 `packaged-app-layout --check-registry` 都会 exit 1，`optional_packages_not_published` blocker 生效。`dedbfed1` 新增 `packagedBundledBinarySmokePlan`：默认 `packaged-manifest` / `packaged-app-layout` 都输出 `status=\"blocked\"`，blockers 包含 `optional_packages_not_published`、`optional_dependencies_not_declared`、`optional_package_install_chain_not_verified`、`packaging_config_not_verified` 和 `prebuilt_packaged_app_required`；`ready` 只表示前置输入具备，`verified` 必须同时满足顶层 `bundledBinaryVerified=true` 且无 blocker。`05c393bb` 新增 `optional-package-source`：当前 `optionalPackageSourceReady=true`、4 个 planned package source blueprint 形状通过，但不运行 `npm pack`、不发布、不安装、不读取 binary、不证明 SHA。`ce89f490` 新增 `optionalPackageExecutionPlan`：当前 source / publish-target 同时 ready 时只进入 `optional_package_publication`，不会把 ready 误判为 published / installed / packaged verified。`a3f98673` 新增 `packagingConfigAllowlistChangePlan`：当前 `status=\"blocked\"`、`approvalRequired=true`，输出 4 个 required / missing includes、`blockingExcludes=[\"!node_modules/@codeinsights/**\"]`、too-broad include 禁止项和候选验证命令；它只做 dry-run review，不修改 builder、不证明 packaging config verified。`7726a008` 新增 `optionalDependenciesInstallChainChangePlan`：当前 `status=\"blocked\"`、`approvalRequired=true`，输出 4 个 `0.0.3` exact optionalDependency spec、publication / declaration / install-chain / lockfile / installed package blockers 和候选验证命令；它只做声明与安装执行前 review 输入，不写 `package.json` / `bun.lock`，不安装、不发布、不读取 binary、不证明 packaged verified。`8097ed4c` / `2188e276` / `d679eabb` 新增并收紧 `optionalPackagePublicationChangePlan`：显式 registry publish-target dry-run 与 source preflight 都 ready 时可进入 `ready_for_review`，但 `publishedPackages` 仍为空；target collision 或 exact-version invalid registry metadata 只进入 `publishTargetCollisionPackages` / `existingInvalidPublishedPackages` / `commandExcludedPackages`，不能当作已发布证据。`edeba827` 新增 `packagedBundledBinarySmokeInvocationPlan`：推荐命令使用 `--packaged-app-root <packaged-app-root> --check-registry`，legacy 命令使用 `--app-node-modules-root <packaged-app-node_modules> --check-registry`；`ready_for_execution` 只表示调用输入和前置 gate 齐备，不等于真实 packaged binary verified。`f949fc13` 新增 `optionalPackagePublicationInvocationPlan`：当前 package 未发布时可进入 `ready_for_invocation`，但它只输出 publish 调用输入和验收证据。`77b266e8` 已收紧 invocation evidence，invalid / unavailable / duplicate / collision 不能进入顶层已发布证据。

`9e3e3dff` 新增 optional package publish-target dry-run；`dc75f380` 后显式 `--check-registry --native-search-package-version 0.0.3` 当前 4 个 planned package 目标版本可发布、无 registry collision，且 source version consistency 已通过，`optionalPackagePublishTargetReady=true`。`05c393bb` 后 `optional-package-source --native-search-package-version 0.0.3` 输出 `optionalPackageSourceReady=true`，只说明 planned source metadata 形状 ready。`ce89f490` 后 `optionalPackageExecutionPlan.completedPrerequisites` 是严格顺序前缀，`observedEvidenceStages` 只表示独立 evidence；summary 顶层 `optionalPackagePublishTargetReady` / `optionalPackageSourceReady` 也必须绑定 checked，避免未检查状态被误判为 ready。`a3f98673` 后 builder allowlist dry-run plan 只输出实际修改前 review 输入，不会把 `packagingConfigVerified` 或 `readyForPackagingConfigChange` 误判为真实通过。`7726a008` 后 optionalDependencies install-chain dry-run plan 只输出声明 / 安装执行前 review 输入，不能把 `optionalDependenciesDeclared`、`optionalDependenciesInstallChainVerified`、`optionalDependenciesLockfileVerified`、`optionalDependenciesInstalledPackagesVerified` 或 packaged binary gate 误判为真实通过；`d679eabb` 后 optional package publication change plan 只输出真实发布前 review 输入，`publishedPackages` 只保留真实 registry publication evidence，`publishTargetCollisionPackages` 与 `existingInvalidPublishedPackages` 只用于阻断 / 排除命令；`edeba827` 后 packaged smoke invocation plan 只输出调用输入和验收证据，不会把 `appNodeModulesRootResolved`、`ready_for_execution` 或 candidate command 误判为真实 bundled binary；`f949fc13` 后 optional package publication invocation plan 只输出真实 `npm publish` 调用输入和候选命令，不会把 `ready_for_invocation` 或 candidate command 当作已发布；`77b266e8` 后 `publishedPackages` 只能来自 package-level `status="published"` 且必须和 planned package set 唯一严格匹配。`packaged-manifest` 与 `packaged-app-layout` 的 publication helper会绑定 planned source `BINARY_VERSION=0.0.3` 对应 exact expected version 到 registry `versions[expectedVersion]`，不能只看 latest。顶层 `realPackagedBinaryVerified` / `bundledBinaryVerified` 必须同时受非临时 fixture、optional package publication、optional install-chain、packaging config、packaged evidence、packaged identity 和真实 binary verification 约束，不能由临时 fixture、单项 resolver、publication-only、packaging-only、install-chain-only、publish-target dry-run、source preflight、execution plan、builder allowlist dry-run plan、optionalDependencies install-chain dry-run plan、optional package publication change plan、optional package publication invocation plan、packaged smoke invocation plan 或宽泛 builder include 置 true。publication gate 的 `missingPublishedOptionalPackages` 表示真实 package 尚未发布；publish-target dry-run 的 registry 404 只表示目标版本可用；source ready 不表示已 pack / publish / install；execution plan ready 只表示下一步顺序；builder dry-run ready / blocked 只表示 review 输入；install-chain dry-run ready / blocked 也只表示 review 输入；publication change plan ready 只表示发布前 review 输入；publication invocation ready 只表示真实 publish 调用形状 ready；packaged smoke invocation ready 只表示真实 packaged smoke 的调用形状 ready。真实 optional package 发布、optionalDependencies 实际声明与安装执行、builder allowlist 实际修改、真实 packaged app bundled binary smoke 和最终 default-enable 风险决策仍未完成，native 仍不能默认启用。尚未完成：default enable、真实 optional package 发布、optionalDependencies 实际声明与安装执行、builder allowlist 实际修改、真实 packaged app bundled binary smoke、最终 default-enable 风险决策、Phase 6-9。

启动后先运行 `git status --short --branch` 和 `git log -25 --oneline`，确认最近历史包含 `95305503 docs(rust-go): 同步 Phase 5 publication invocation 证据收紧状态`、`77b266e8 fix(rust-go): 收紧 Phase 5 publication invocation 发布证据`、`f949fc13 feat(rust-go): 补齐 Phase 5 optional package publication invocation plan`、`084546cc docs(rust-go): 回填 Phase 5 packaged smoke invocation 最新恢复入口`、`076f25c6 docs(rust-go): 同步 Phase 5 packaged smoke invocation 状态`、`edeba827 feat(rust-go): 补齐 Phase 5 packaged smoke invocation plan`、`eb02f806 docs(rust-go): 回填 Phase 5 publication plan 最新恢复入口`、`c4000bc9 docs(rust-go): 同步 Phase 5 publication plan 证据拆分状态`、`d679eabb fix(rust-go): 拆分 Phase 5 publication plan 发布证据`、`2188e276 fix(rust-go): 收紧 Phase 5 publication plan collision 过滤`、`8097ed4c feat(rust-go): 补齐 Phase 5 optional package publication change plan`、`235ea492 docs(rust-go): 回填 Phase 5 optionalDependencies 最新恢复入口` 和 `7726a008 feat(rust-go): 补齐 Phase 5 optionalDependencies install-chain dry-run plan`。下一步继续 Phase 5“Rust search sidecar 试点”：在 default off 前提下优先推进真实 optional package 发布、真实 `optionalDependencies` 声明与安装执行、builder allowlist 实际修改前置工作、真实 packaged app bundled binary smoke 设计；仅在真实 optional / packaged gate 可执行通过后再做最终 default-enable 风险决策。真实 packaged smoke、install-chain、publication、builder allowlist 和 packaged binary gate 未完成前不得默认启用 native。不要创建 packaged native binary，不修改 `apps/electron/electron-builder.yml`，不修改根 `README.md` / 根 `AGENTS.md`，不新增真实 `@codeinsights/native-search-*` optionalDependencies，不 push，不创建 PR。

请遵守阶段纪律：每完成一个阶段并通过验证后，立即更新 development checklist、next-session-prompt.md、tasks/todo.md Review 和必要的 lessons，然后单独提交该阶段相关文件，提交信息使用详细中文。
```
