# Lessons

## 2026-06-04 Rust / Go Phase 5 Agent nested native parity 边界

- Agent nested native parity 应使用闭合白名单 extractor（当前为 `agent_message_search_text`），只允许搜索顶层 legacy `content` 或 `message.content[]` 中 `type="text"` 的字符串 block；不要引入通用 JSONPath、任意 nested path 或 renderer 可控路径选择。
- 生产 Agent native 命中仍只能作为 cursor anchor；legacy snippet、messageId 和 role 必须由 TypeScript 回读 JSONL 后按生产 `getSearchableAgentText()` / `getSearchableAgentMessageId()` / `getSearchableAgentRole()` 重建，避免 Rust direct snippet / id 漂移影响 UI 语义。
- Agent facade parity 完成后只消除 Agent nested content 口径差异，不等于 native 可默认启用。真实 optional package 发布 / optionalDependencies install-chain、真实 packaged app bundled binary smoke、packaged app identity 和 default-enable 风险评估仍必须全部通过，native 才能从显式 opt-in 走向默认启用。
- `agentFacadeSearch.defaultEnableBlockers` 只描述 Agent facade 自身 blocker；default-enable 结论必须看全局 `nativeSearchGate.defaultEnableCandidate` 和 packaged / optional gate，不要只看 Agent facade 子字段。

## 2026-06-04 阶段完成后的文档同步默认闭环

- 每个阶段性任务完成、验证通过并提交后，必须立即自动执行文档同步闭环：更新 Rust / Go development checklist 的完成 / 未完成清单、更新 `docs/improve/rust-go/next-session-prompt.md` 的顶部状态和可复制提示词、更新 `tasks/todo.md` Review、按需补充 `tasks/lessons.md`，并单独提交 docs 状态同步。
- 如果当前 HEAD 已经是新的 Rust / Go docs 状态同步提交，而 checklist 或 next-session prompt 仍把上一轮 docs 提交写成“最新已确认恢复入口”，必须先按一个小阶段回填真实 docs 提交 hash，再继续后续开发；不能让恢复入口停在实现提交或旧文档提交。
- 最终回复给用户的下一次启动提示词必须使用本轮提交后的实际 `git log` 状态；如果文档无法预写自身提交 hash，文档内先写“以下次 `git log -5 --oneline` 中最新 Rust / Go docs 提交为准”，提交完成后在最终回复明确实际 HEAD。

## 2026-06-04 Rust / Go Phase 5 Agent production facade benchmark 边界

- `native-runtime:benchmark` 中的 `native-agent-runtime-search` 是 synthetic direct native case：fixture 使用 top-level `{ seq, type, content }` 并显式传 `textFields: ["type", "content"]`；它不能代表生产 Agent JSONL 搜索路径。
- 生产 `agent-session-manager.ts` 支持 nested SDK message content，例如 `message.content[]` 里的 text block；在 `665c5db7` 之前 Rust search sidecar 只抽 top-level string fields，未支持 nested block extractor。后续已用白名单 `agent_message_search_text` 补齐 parity，但仍不要给生产 Agent 搜索直接加 top-level `nativeTextFields` 或任意 nested path。
- `agentFacadeSearch` / `agent-runtime-production-facade-search` 必须和 `nativeSearchGate` 分开：`9a06908a` 当时证明生产 Agent facade 仍是 TypeScript / fallback；`665c5db7` 补齐 nested extractor parity 后，也只能证明 Agent facade 自身可 opt-in native，不证明 native 可默认启用。
- 即使 direct native Chat / Agent benchmark 通过，只要 Agent production facade 没有 nested native parity、真实 optional package install-chain 和真实 packaged app bundled binary smoke 仍未完成，native 仍必须 default off / 显式 opt-in。

## 2026-06-04 Rust / Go Phase 5 native benchmark gate 与 optional package blocker

- `native-runtime:benchmark` 的 `nativeSearchGate` 必须区分 benchmark blockers 和 default-enable blockers：P95 / event-loop 指标只决定 benchmark gate，真实 optional package install-chain 与真实 packaged app bundled binary smoke 未评估时，`defaultEnableCandidate` 仍必须保持 `false`。
- 无 native binary 或只跑 TypeScript fallback 时，benchmark summary 也要继续输出 `optional_package_install_chain_not_evaluated` 与 `packaged_app_bundled_binary_not_evaluated`；不能因为 benchmark 输入不完整就把默认启用阻断项丢掉。
- 当前 4 个计划 `@codeinsights/native-search-*` 包在 npm registry 为 `E404`，且 `apps/electron/electron-builder.yml` 当前排除 `node_modules/@codeinsights/**`；在真实包发布和 builder allowlist 调整未获准前，不要把这些包写入 `apps/electron/package.json` 的 optionalDependencies，也不要执行安装链路。
- Agent native work-delay 小幅回退先按 benchmark 口径、sidecar hop 固定成本和短调用噪声解释；生产 Agent 搜索不要直接新增 top-level `nativeTextFields`。`665c5db7` 已用受限 extractor 证明嵌套 SDK message content parity，但 packaged / optional gate 未完成前仍不能默认启用。

## 2026-06-04 Rust / Go Phase 5 恢复入口回填默认动作

- 当当前 HEAD 已经是 Rust / Go docs 状态同步提交，而 checklist / next-session prompt 仍把上一轮 docs 提交写成最新恢复入口时，用户再次要求“更新最新开发状态 / 标注完成未完成 / 下次启动提示词”必须按小阶段处理：写 `tasks/todo.md` 计划、回填当前 `git log` 可确认的最新 docs 提交、更新 lessons、验证禁改边界、单独提交。
- 下次启动提示词里的历史检查要覆盖当前新增 docs 提交后可能被挤出最近 12 条的关键旧提交；需要确认 `8226c992` 这类历史节点时使用 `git log -20 --oneline`，避免提示词要求最近 12 条但实际已经排到第 13 条。

## 2026-06-04 Rust / Go Phase 5 optional package install-chain preflight 边界

- optional native package 的安装链路预检不能只检查 `apps/electron/package.json` 声明；必须同时验证声明版本、`bun.lock` resolved package entry 和已安装 package manifest，一旦存在声明但 lockfile / installed package 不完整，smoke 应失败而不是 skipped。
- optionalDependencies 版本声明只接受 exact semver 或 `npm:<同名 native search package>@exact-semver`；跨包 alias、`latest`、range、`file:`、`workspace:`、git / http URL、path-like spec 都应进入 invalid，除非后续引入可靠 lockfile parser 并重新记录 decision。
- lockfile 预检必须查找已解析 package entry，不能因为 importer dependency 文本包含包名就当作已安装；install-chain helper 仍只读 package manifest / lockfile / installed manifest，不读取 binary、不输出路径、不证明真实 packaged bundled binary。

## 2026-06-04 阶段完成后的状态同步习惯

- 每个阶段性任务完成并通过验证后，必须自动做状态同步闭环：更新 development checklist 的完成 / 未完成清单、更新 `next-session-prompt.md` 的可复制提示词、更新 `tasks/todo.md` Review、按需补 lessons，并单独提交状态文档；不要等用户再次提醒。
- 若状态同步提交已经生成，仓库内“最新已确认恢复入口”必须回填为实际 docs 提交 hash，而不是停在实现提交；如果无法提前知道本提交 hash，文档中先写“以下次 `git log -5 --oneline` 中最新 Rust / Go docs 提交为准”，提交后最终回复给出实际 HEAD。

## 2026-06-04 Rust / Go Phase 5 optionalDependencies preflight gate 边界

- 在真实 native optional package 尚未发布 / 安装、且不能修改 `electron-builder.yml` 时，不要直接把 `@codeinsights/native-search-*` 写入 `apps/electron/package.json` 的 `optionalDependencies`；应先做 package manifest 声明预检，输出 `optionalDependenciesDeclared=false` 与缺失包名列表，并保持 `realPackagedBinaryVerified=false`。
- `packaged-manifest` 新增的 optionalDependencies declaration preflight 只证明当前 package.json 声明矩阵是否准备好，不读取真实 binary、不替代 resolver / packaged app layout / status smoke。缺失声明在当前阶段可以是 skipped preflight；版本声明必须是 exact semver 或 `npm:<同名 native search package>@exact-semver`，空值、非字符串、`latest` / range、跨包 alias、`file:`、`workspace:`、git / http URL 和 path-like spec 都应视为 invalid。
- `native-runtime-smoke` CLI 遇到任意 failed case 必须返回非零退出码；skipped preflight 只表示当前阶段尚未具备真实输入，不能掩盖 schema invalid 或真实 gate failed。
- `realPackagedBinaryVerified=true` 必须同时满足 resolver 成功、非临时 fixture、packaged app evidence、`packagedAppIdentityVerified=true`、`optionalDependenciesDeclared=true`、`optionalDependenciesInstallChainVerified=true` 和真实 optional package / binary 存在。只要 optionalDependencies 声明 gate 或 install-chain gate 未通过，即使手工传入 packaged app root 且 resolver 通过，也不得标记真实 bundled binary 已验证。

## 2026-06-04 Rust / Go Phase 5 packaged app evidence smoke 边界

- 本项目当前 `apps/electron/electron-builder.yml` 为 `asar: false`，真实 packaged app 的 `node_modules` evidence 不能只认 `app.asar` / `app.asar.unpacked/node_modules`；`packaged-app-layout` 这类 smoke 需要同时支持 `Resources/app/node_modules` + `Resources/app/package.json` 的 `unpacked-app` 证据形态。
- `packagedAppEvidenceVerified=true` 只说明传入 root 看起来像 packaged app 布局；真实 packaged binary 验证还必须同时满足 resolver 成功、非临时 fixture、`packagedAppIdentityVerified=true` 和真实 optional package / binary 存在。只要路径位于临时目录、缺少真实 optional package / `optionalDependencies` / builder files / 真实 binary，仍不得把 `bundledBinaryVerified` 或 `realPackagedBinaryVerified` 置为 true。
- `packaged-app-layout` detail 只能输出 evidence 分类、package name 和 resolver reason code；不能输出 packaged root、`app.asar.unpacked`、`Resources/app`、binary path、raw fs error 或任何 home path。

## 2026-06-03 Rust / Go Phase 5 packaged app layout preflight 边界

- `packaged-app-layout` 这类只读 smoke 入口只能在没有真实 packaged app root 时返回 skipped；即使用临时目录模拟 `app.asar.unpacked/node_modules` 并通过 resolver，也只能标记 `packagedAppLayoutVerified=true`，不能把 `bundledBinaryVerified` 或 `realPackagedBinaryVerified` 置为 true。
- 真实 packaged app bundled binary smoke 必须同时证明真实 packaged app 证据、非临时目录、optional package manifest、`bin/{binaryName}`、可执行权限和 SHA-256；在没有真实 optional package / `optionalDependencies` / `electron-builder.yml` files 前，native 仍必须 default off。
- packaged layout preflight 失败 detail 只能输出 package name 和 resolver reason code，不能透传 raw fs error、app root、temp path、`app.asar.unpacked`、binary path 或 `binaryPath` 字段。

## 2026-06-03 Rust / Go Phase 5 bundled resolver 状态回填习惯

- 当阶段实现提交和状态同步提交都已存在时，用户再次要求“更新最新开发状态 / 完成未完成 / 下次启动提示词”，不能让仓库提示词停在实现提交；必须把最新已存在的 docs 提交（例如 `e95cd284 docs(rust-go): 同步 Phase 5 bundled resolver 后续状态`）回填为最新已确认恢复入口。
- 仓库文档不能可靠写入自身提交 hash 时，要写清“若本轮再次产生状态同步提交，下次启动以 `git log -5 --oneline` 中最新 Rust / Go docs 提交为实际恢复入口”；最终回复再给出本轮提交后的实际 HEAD。
- 每个阶段性任务完成后自动执行同一闭环：`tasks/todo.md` 状态同步计划、development checklist、next-session prompt、lessons、Review、验证、单独提交、最终可复制提示词。不要等用户再次提醒。

## 2026-06-03 Rust / Go Phase 5 bundled package resolver fixture 边界

- bundled package resolver 不能只依赖 Node module resolution：`createRequire().resolve()` 可能解析到上级、用户或全局 `node_modules` 的同名包；packaged resolver 必须把 package manifest 和 binary 的 realpath 限制在 app `node_modules` allowlist 内，并且不能从系统 `PATH` 查找。
- bundled resolver 只能在 Electron packaged 环境自动尝试；非 packaged dev 环境即使打开 native feature flags，也必须继续要求显式 `CODEINSIGHTS_NATIVE_SEARCH_BINARY`，否则本地 fixture / 用户依赖可能被误当成 bundled binary。
- `packaged-resolver-fixture` smoke 只证明临时 optional package fixture 的 manifest / SHA-256 / no PATH lookup / allowlist 逻辑；只要 summary 仍写 `realPackagedBinaryVerified=false`，就不能把真实 optional package、`optionalDependencies`、`electron-builder.yml` files、签名、真实 packaged app bundled binary smoke 或 default enable 标成完成。

## 2026-06-03 Rust / Go Phase 5 optional package manifest 预检边界

- manifest-only 版本的 `packaged-manifest` smoke 只能证明 optional package manifest schema / 平台矩阵和 TypeScript fallback 可用；只要 summary 仍写 `bundledBinaryVerified=false`，它就不等于 bundled binary packaged smoke，不能把 optionalDependencies、`apps/electron/electron-builder.yml` files、签名或默认启用标成完成。后续新增的 resolver fixture 可以证明 helper 边界，但仍不能证明真实 packaged app bundled binary。
- optional package manifest schema 必须是闭合白名单：只允许 package name / version、protocol version、cache schema version、platform / arch、binary name 和 SHA-256 fingerprint；必须拒绝 `binaryPath`、home、path-like 字段和任意额外字段，避免把路径或用户信息夹带进 manifest。
- Phase 5 状态同步要同时检查 development checklist 顶部状态和底部“下一轮启动入口”代码块；不能只更新顶部而让底部提示词继续停在 `2cc95b1b` / `fb7e2d73`。在 manifest-only 阶段完成后，下一步应推进 bundled package resolver / 真实 packaged smoke 设计，而不是重复做 optional package manifest schema；`ce104a59` resolver fixture 完成后，下一步应转向真实 optional package / 真实 packaged app bundled binary smoke 或 Agent event-loop 回退分析。

## 2026-06-03 Rust / Go Phase 5 恢复入口再次回填习惯

- 当用户在 `fb7e2d73 docs(rust-go): 同步 Phase 5 fake sidecar smoke 后续状态` 之后再次要求“更新文档最新开发状态 / 标注完成未完成 / 给下次启动提示词”时，仓库内 `next-session-prompt.md` 和 development checklist 必须明确把 `fb7e2d73` 写成最新已确认恢复入口；不能继续让提示词停在 `2cc95b1b feat(rust-go): 补齐 Phase 5 fake sidecar smoke 失败路径` 或只写“以最新 docs 提交为准”。
- 这类恢复入口回填属于阶段收尾默认动作，即使没有业务代码变化，也要写 `tasks/todo.md` 计划与 Review、更新 lessons、验证禁止文件未触碰，然后单独提交文档状态同步。

## 2026-06-03 Rust / Go Phase 5 fake sidecar smoke 状态边界

- `protocol-mismatch` / `crash` / `timeout` / `cache-corruption` smoke 一旦通过 fake sidecar / isolated cache fixture 落地并提交（例如 `2cc95b1b feat(rust-go): 补齐 Phase 5 fake sidecar smoke 失败路径`），后续恢复入口不能再把这些 mode 写成 skipped 或“下一步优先补齐”；下一步应转向 optional package manifest、packaged smoke 设计或 Agent native work-delay 分析。
- fake sidecar smoke 只能证明 main process protocol/fallback 行为：version mismatch、crash、timeout、cache corrupted 和 TS fallback 可用；它仍不等于 bundled binary packaged smoke，不证明 optionalDependencies、electron-builder files、签名、CI 平台矩阵或默认启用安全。
- 状态同步时要同时更新 `2026-06-03-phase-5-sidecar-protocol-and-smoke-plan.md`，否则该计划文档会继续声称 `protocol-mismatch` / `crash` / `timeout` / `cache-corruption` 是 skipped，和 checklist / next-session prompt 冲突。

## 2026-06-03 Rust / Go Phase 5 native smoke/cache 状态同步习惯

- Phase 5 native smoke / native-cache schema 这类小切片完成并提交后，如果用户要求更新最新开发状态和下次启动提示词，必须把真实实现提交号（例如 `c6104eee feat(rust-go): 补齐 Phase 5 native smoke 与 cache schema 基础`）回填到 development checklist 和 next-session prompt；不能继续写“本轮实现后以 git log 为准”或“最新 feat 提交”这类恢复入口占位。
- 状态同步要明确区分“基础 smoke/cache 已完成”和“packaged smoke / optional package / default enable 未完成”：`smoke:native-runtime` 的 native-missing / native-available 入口不等于 packaged bundled binary smoke，native-cache manifest schema helper 不等于完整 native cache corruption smoke。
- 用户再次强调“每个阶段性任务完成后自动去做”时，即使刚完成过实现提交，也要新建本轮 `tasks/todo.md` 同步计划和 Review，验证根 `README.md` / 根 `AGENTS.md` / `electron-builder.yml` 未触碰后单独提交状态同步，并在最终回复给可复制提示词。

## 2026-06-03 Rust / Go Phase 5 新 event-loop 字段 gate 习惯

- 用 `eventLoopDelaySamplesMs` / `eventLoopBaselineMs` / `eventLoopWorkDelayMs` 复跑稳定 benchmark 后，default-enable 判断不能只看 native P95 大幅领先；如果 Agent native `eventLoopWorkDelayP95Ms` 连续高于 TS fallback，即使绝对差异只有 0.1ms 级，也要记录为 event-loop gate 未完全通过，native 继续显式 opt-in / default off。
- `eventLoopWorkDelayP95Ms` 等于 0 时不要计算“降低百分比”来包装结论；应直接写出 TS 与 native 的原始值、样本方向和 baseline 噪声。Chat 达标不能替代 Agent gate，`native-sidecar-status-cache-overhead` 只能帮助解释 manager cache 成本，不能证明 packaged default enable。
- 只要 optional package、packaged smoke 和 default-enable 风险评估尚未完成，即使 P95 / event-loop 数字看起来通过，也不能默认启用 native；下一步应优先在 default off 前提下完成 package / packaged smoke 设计或 Agent work-delay 分析，而不是改 feature flag。

## 2026-06-03 Rust / Go Phase 5 stable benchmark gate 习惯

- 跑 Rust native benchmark 前必须先用 sidecar `status` 检查本地 release binary 的 `binaryVersion` 是否与源码 `BINARY_VERSION` 一致；如果 `native/search/target/release/codeinsights-native-search` 仍报告旧版本（例如 `0.0.1-dev` 而源码为 `0.0.2-dev`），必须先 `cargo build --release --manifest-path native/search/Cargo.toml` 重建本地 ignored 产物，再开始性能结论记录。
- `native-runtime-benchmark.ts` 的 `eventLoopDelayMs` 是所有 iterations 中最大的 `setTimeout(0)` 延迟，不是 P95；default-enable 评估要明确这个口径。即使 Agent native P95 远超 gate，如果 Agent native event loop delay 连续复跑仍高于同轮 TS fallback，也要保持 native 显式 opt-in / default off。
- 稳定 benchmark gate 通过不能替代 packaged smoke / optional package / default-enable 风险评估；在未证明 bundled binary、不使用系统 `PATH`、packaged missing / crash / timeout fallback 和 cache corruption 之前，不得默认启用 native。

## 2026-06-03 Rust / Go Phase 5 状态同步重复请求习惯

- 用户在阶段实现和上一轮状态同步都完成后再次要求“更新文档最新开发状态 / 标注完成未完成 / 给下次启动提示词”时，仍要新建本轮 `tasks/todo.md` 同步计划和 Review，把当前 `git log` 可确认的最新状态同步提交（例如 `aaede459 docs(rust-go): 同步 Phase 5 search 性能优化后续状态`）回填到 development checklist 和 next-session prompt；不能因为上一轮文档大体正确就只口头回复。
- 最终回复里的可复制提示词要包含最新开发基线和最新恢复入口两个提交号；仓库内提示词如果本轮又产生新的 docs 提交，最终回复需要补充本轮提交后的实际 HEAD，避免恢复入口再次落后一轮。

## 2026-06-03 Rust / Go Phase 5 search 性能 gate 习惯

- Rust search sidecar 做 `limit` 查询时，不要为了计算精确 `total_matches` 扫完整个 JSONL；主进程当前只需要 `matches` 和 `hasMore`，sidecar 可以在找到第 `limit + 1` 个命中后停止并返回 `hasMore=true`，避免 100MB 首屏查询被无谓完整解析拖慢。
- 性能 gate 不能只看 P95 单项达标就默认启用 native。即使早停后 Chat / Agent native P95 明显快于 TS fallback，只要 event loop gate 有回退、结果只有单轮 benchmark、或 packaged smoke / optional package 尚未完成，native 仍必须保持显式 opt-in / default off。
- 早停优化会让 limit 后的后续坏 JSON diagnostics 不再被统计；测试需要明确锁住这个取舍，并确保 limit 前的 bad JSON、UTF-16 matchedRanges、snippet 脱敏、Chat legacy snippet parity 和拒绝类错误不 fallback 仍通过。

## 2026-06-03 Rust / Go Phase 5 sidecar manager 恢复入口回填习惯

- 阶段实现提交和状态同步提交都完成后，如果用户再次要求“更新文档最新状态 / 标注完成未完成 / 给下次启动提示词”，不能只口头确认已有文档；必须把最新状态同步提交号（例如 `fdb6997b docs(rust-go): 同步 Phase 5 sidecar manager 后续开发状态`）回填到 development checklist 和 next-session prompt，避免仍写“319f30e8 或其后的 docs 提交”这类需要读者推断的占位。
- 这类复核即使没有业务代码变化，也要在 `tasks/todo.md` 新增本轮同步计划和 Review，验证根 `README.md` / 根 `AGENTS.md` / `electron-builder.yml` 未触碰后单独提交，最终回复提供可直接复制的下一次启动提示词。

## 2026-06-03 Rust / Go Phase 5 sidecar manager 安全与 benchmark 习惯

- Native sidecar fallback 只能覆盖 `missing_binary`、`version_mismatch`、`contract_violation`、`timeout`、`crashed`、`cache_corrupted`、`unsupported_platform` 这类可用性 / 合约失败；`path_denied`、`invalid_input`、`operation_cancelled`、`io_error` 等拒绝类错误必须向上传播，不能被 TypeScript fallback 重新读取文件绕过。
- sidecar stdout protocol 必须有硬上限；不能只等换行再解析，否则异常 sidecar 可用无换行超大 stdout 撑爆主进程内存。所有 native result 还要校验 source 边界、range、score、timestamp，并且不透传 sidecar 夹带的事实源路径。
- Chat legacy 搜索语义不能由 Rust snippet 直接决定；native search 在未完全复刻 TS 规则前只负责定位 cursor，最终 snippet / matchedRanges 仍要回到 TypeScript `buildSearchSnippet()` 生成，避免大小写、ellipsis 和 matchStart 漂移。
- Rust parity 测试不能在缺少 `cargo` 时静默通过；真实 parity gate 要失败或显式标记 gated，并用临时 `CARGO_TARGET_DIR` 避免污染 `native/search/target/`。benchmark binary path 应使用绝对路径，因为 `bun --filter` 会改变 cwd；benchmark CLI 失败路径也要脱敏，不能只在成功 summary 里隐藏 binary path。

## 2026-06-03 Rust / Go Phase 5 search-only sidecar 状态同步习惯

- Phase 5 search-only Rust 源码切片提交后，状态同步必须把“已完成”和“未完成”拆开写：`native/search/`、TS fallback benchmark gate、Rust 单测和 `e39682f1 feat(rust-go): 完成 Phase 5 最小 Rust search sidecar 源码切片` 已完成；Electron main process sidecar manager、fallback 集成、contract parity、native benchmark、optional package、packaged smoke 和默认启用判断未完成。
- 阶段完成后的恢复入口不能继续写“提交后以实际 git log 为准”或“本文件所在提交”这类不可执行占位；仓库文档至少要回填最近真实开发基线 `e39682f1`，并要求下次启动用 `git log -5 --oneline` 识别其后的 Rust / Go docs 状态同步提交。
- 用户再次强调“每个阶段性任务完成后自动去做”时，要把这视为长期默认工作流：阶段实现提交后立即同步 development checklist、next-session prompt、`tasks/todo.md` Review 和必要 lessons，验证后单独提交，并在最终回复给可直接复制的下一次启动提示词。
- 下次启动提示词必须直接指向当时最新的下一步可执行工作；search-only 切片刚完成时可以指向 sidecar manager contract tests，但后续 sidecar manager、parity、benchmark、smoke/cache 已完成后，提示词必须推进到 optional package / packaged smoke / Agent work-delay 分析，不能让恢复会话倒退到已完成的 sidecar manager 测试。

## 2026-06-03 Rust / Go Phase 5 前置状态同步习惯

- 用户要求“更新最新开发状态 / 标注完成未完成 / 给下次启动提示词”并再次强调阶段完成后自动执行时，即使刚写过前置文档，也要新建 `tasks/todo.md` 状态同步计划，更新 development checklist、next-session prompt、`tasks/todo.md` Review 和本文件，验证后单独提交状态同步。
- Phase 5 这类“前置决策完成但 Rust 实现未开始”的状态必须用 `[~]` 或明确文字表达，不能把 Phase 5 标成已完成；已完成项只能写依赖 decision record、protocol / fallback / packaged smoke 计划和性能门槛，未完成项必须列出 benchmark、Rust 工程、sidecar manager、smoke script、optional package、packaged smoke。
- 本条前置阶段规则仅适用于 `e39682f1` 之前、Rust search-only 源码切片尚未开始时；`e39682f1` 到 sidecar manager 完成前的恢复入口可从 sidecar manager contract tests 和 main process fallback 集成继续。后续阶段完成后必须以最新 checklist / next-session prompt 的未完成项为准，不能重复要求重新跑已完成的 TS fallback gate、sidecar manager tests 或重新创建 Rust crate。

## 2026-06-02 Rust / Go Native Runtime diagnostics 前端边界

- Native Runtime diagnostics 即使当前只是 TypeScript fallback，也要按未来 native 失败路径处理：IPC / event 推送前统一移除 `binaryPath`，并脱敏 Bearer、Authorization、credentialed URL、home path 和 stderr-like 文本；普通搜索 UI 只展示简短状态，protocol / cache schema / binary path 这类技术细节只允许出现在已脱敏 diagnostics 面板。
- 手动 rebuild workspace index 的 renderer API 只能传 `workspaceId` / `requestId`；main process 必须从已登记 Agent workspace 派生 `workspace-files/` 和 attached directories。不要为了“方便重建”让 renderer 传 `rootPath`、cache path 或任意 native command。
- Native Runtime 的全局事件监听要沿用 Agent / Pipeline listener 模式，在 renderer 顶层挂载并用 Jotai store 写入 atoms；测试必须覆盖 detach 后不再写状态，避免重复挂载、设置页卸载或弹窗关闭污染全局 operation / status。

## 2026-06-01 Rust / Go Workspace index 路径白名单与容量上限

- `SEARCH_WORKSPACE_FILES` 这类历史上接收 renderer 路径的 IPC，接入 cache / index 后不能只复用旧签名；main 端必须从已登记 workspace / session / attached directories 派生白名单并用 realpath 对齐，renderer 传入路径只能作为待匹配 intent，不能作为扫描事实源。
- Workspace index 的容量上限要用跨 root 的全局 entry 计数，而不是等单个 root 扫描完成后再检查；否则一个大 root 可以突破上限并造成内存 / 时间放大。
- 对大 workspace 的首次索引要复用同一 cache key / fingerprint 的 in-flight build；只靠 SearchDialog debounce 不足以防止并发递归扫描。

## 2026-06-01 Rust / Go Pipeline cursor tail 安全边界

- Pipeline / JSONL cursor 不能只校验 byte offset 和 schema version；只要 cursor 携带 recordId / createdAt，就必须用它校验 anchor record。文件截断后重新写入到超过旧 offset 时，旧 cursor 也要判为 `cursorInvalid` 并回退到安全窗口。
- PipelineRecords 首屏只加载 latest window 后，不能继续从当前 records 数组推导 `currentTask`、latest error、重启按钮和错误定位这类 durable 状态；这些状态必须来自独立 read model、session meta 或专门的小查询。
- 任意新增 IPC 即使有 shared TypeScript 类型，也要在 main / manager 边界做运行时校验；未知 sessionId 不能参与 `getPipelineSessionRecordsPath()` 这类路径拼接，`limit` / `cursor` / `direction` / `query` 也要校验类型和长度。

## 2026-06-01 Rust / Go 阶段收尾状态同步

- Rust / Go 优化重构从 Phase 1 起，阶段计划写入 `tasks/todo.md` 后不再等待用户确认；只要范围、禁止事项和验证命令已写清，就直接按 TDD 开始实现。只有遇到计划外架构变更、需要安装依赖、需要写 Rust / Go、需要 native binary、需要修改根 `README.md` / `AGENTS.md` 或用户明确要求暂停时，才停下来重新规划或请示。
- Rust / Go 优化重构每完成一个 Phase 并通过验证、完成阶段提交后，必须立即执行独立状态同步：更新 `docs/improve/rust-go/2026-06-01-rust-go-development-checklist.md`、`docs/improve/rust-go/next-session-prompt.md`、`tasks/todo.md` Review 和必要 lessons，明确最新开发基线、完成项、未完成项、下一阶段入口、验证结果和禁止事项。
- Rust / Go 状态同步也要单独提交，提交信息使用详细中文；不能把 Phase 实现提交、状态文档同步和下一阶段计划混在一个大提交里。
- 最终回复必须给一份可直接复制给下一次 Codex 的启动提示词；提示词要包含真实开发基线提交号、要求启动后运行 `git status --short --branch` / `git log -5 --oneline`、下一阶段入口和当前禁止事项。
- 仓库内 `next-session-prompt.md` 不能可靠写入自身提交 hash 时，至少写清最近真实 Phase 开发基线，并要求下次启动用 `git log` 确认其后的 Rust / Go docs / tasks / feat 提交；最终回复再补上本轮状态同步后的实际 HEAD。

## 2026-05-30 客户端完整验证与 Bun 测试隔离

- 仓库级 `bun test` 在默认非隔离模式下会受到跨文件 mock / module state 污染影响；完整客户端验证应使用根脚本 `bun run test`，并保持其映射到 `bun test --isolate`，避免把测试顺序污染误判为产品回归。
- 即使失败集中表现为跨文件污染，也要先分离真实契约问题；本轮 `run_completed` fixture 缺失 `usage` 字段属于真实类型契约偏差，必须补测试数据而不是用隔离模式掩盖。
- packaged smoke 结论必须按脚本边界描述：`smoke:pipeline-fixture` 是 deterministic fixture runner，不是真实模型验收；`smoke:agent-history-reload-ui` 是本地 seeded history reload，不是模型调用；opencode `binary/server/config/permission/abort/resume/mcp` 是非模型 smoke，不能替代 `readonly/channel/native/packaged`。
- 客户端完整验证报告里必须明确区分“当前平台 unpacked app 通过”和“DMG / installer、多平台 packaged、真实 GitHub remote、真实模型”仍未验证；未授权时不读取 token、不 push、不创建真实 PR。

## 2026-05-30 Pipeline Report Export HTML / PDF 安全边界

- 报告脱敏不能给 Bearer token 设置长度门槛；`Bearer secret` 这类短 token 同样必须在 Markdown、HTML、顶层 title 和所有导出文件名中被替换，脱敏规则应按空白、引号、反引号和尖括号截断。
- 报告导出、HTML 生成和 PDF 保存必须保持严格只读；读取 patch-work manifest 时要显式使用 `create:false` 路径，缺失 `patch-work/` 或 manifest 只能返回可解释状态，不能为了展示报告创建目录或写入工作区。
- 使用 Electron `BrowserWindow.printToPDF()` 渲染报告时，窗口必须关闭 nodeIntegration、webview 和 JavaScript，并阻断导航与 http / https / file / ftp / ws / wss 子资源；Renderer 只能传 `sessionId`，main 端重新生成报告，不接受任意 HTML 或文件路径。

## 2026-05-30 Pipeline Report Export 只读与脱敏边界

- Pipeline 报告导出不能复用会触发 live Git 检查的 submission plan；导出类 IPC 必须只从已持久化的 records、stage artifacts、ContributionTask events 和 patch-work manifest 组装事实，避免 `git status` / `git diff` 刷新 index 或把当前工作树误当成已验收结果。
- 报告脱敏不能只覆盖 Markdown 正文；IPC 返回的顶层 `title`、`fileName`、preview 入口和错误信息也必须复用同一套 secret / credentialed URL / Authorization / Bearer 脱敏策略。
- 为“只读导出”写测试时，要用 fake `git` marker 或持久化 artifact 与当前工作树不一致的场景锁住边界，防止以后无意中重新调用 Git read model。

## 2026-05-29 Pipeline v1 状态同步默认动作

- Pipeline v1 每个 Phase 完成并提交后，必须立即同步 `docs/improve/pipeline/v1/2026-05-28-pipeline-mode-development-checklist.md`、`docs/improve/pipeline/v1/next-session-prompt.md` 和 `tasks/todo.md` Review，写清真实开发基线提交、已完成项、未完成项、下一阶段入口和验证结果。
- 阶段实现提交完成后，持久文档里不能继续留下“本次提交”“本轮提交”“feat(...)”这类占位；必须用 `git log` / `git rev-parse --short HEAD` 回填真实提交号，例如 `1ff8416a feat(pipeline): 完成 Pipeline v1 Phase 4 Contribution Dashboard`。
- 用户要求“更新文档最新开发状态 / 标清完成未完成 / 给下次启动提示词”时，直接执行上述同步并提交文档状态更新；最终回复必须给一份可直接复制的下一次启动提示词。
- 每个阶段性任务完成后，不需要用户再次提醒，默认执行“development checklist + next-session prompt + `tasks/todo.md` Review + 最终可复制提示词”的状态同步；如用户再次强调“记住这个习惯”，要在本文件更新更具体的执行规则。
- 用户再次强调“我希望你能记住这个习惯，在每个阶段性任务完成后自动去做”时，立即复核当前文档是否包含最新状态同步提交、完成/未完成清单和下一阶段启动提示词；若缺少最新恢复入口，即使代码阶段已提交，也要补一次文档状态同步提交，并在最终回复给可直接复制的提示词。
- 当用户再次要求“更新文档最新开发状态、标清完成/未完成、给下次启动提示词”并强调要记住习惯时，必须把这视为阶段收尾的默认动作：先写 `tasks/todo.md` 状态同步计划，再更新 checklist、next-session prompt、`tasks/todo.md` Review 和本文件，验证后单独提交，并在最终回复直接给可复制提示词。
- 仓库内 next-session prompt 无法写入自身提交 hash 时，至少写清最近真实 Phase 开发基线，例如 `ff515a01`，并要求下次启动确认该提交或其后的状态同步提交在历史中。
- 同步文档时必须明确区分开发基线和状态同步提交：Phase 实现提交（如 `ff515a01`）代表功能完成，后续 `docs(pipeline): 同步 Phase N 后续开发状态` 代表恢复入口更新。
- 收到子代理或人工 review 提醒“文档提前标记提交完成”时，若提交已真实完成，要立刻回填真实提交号；若尚未提交，不能把阶段提交 checkbox 标记为完成。
- 阶段完成后的状态同步提交落地后，下一次用户要求更新最新状态或再次强调“记住这个习惯”时，必须把上一轮真实状态同步提交号回填到 development checklist 和 next-session prompt；若本轮又产生新的同步提交，最终回复给出新 HEAD，避免在文档中留下“本轮提交”这类不可恢复占位。
- 当 `git log` 已能确认具体状态同步提交号时，例如 `1cbe1de7 docs(pipeline): 同步 Phase 7 后续开发状态`，不能继续在 checklist 或 next-session prompt 中写“开发提交或其后的 docs 提交”；必须把真实恢复入口写入文档，下一次启动才不会误从功能提交恢复。
- 用户再次要求“请更新文档的最新开发状态、标注完成/未完成、给下次启动提示词”并强调“每个阶段性任务完成后自动去做”时，即使刚完成过恢复入口校正，也要新建 `tasks/todo.md` 状态同步计划，回填当前 `git log` 可确认的最新恢复入口，更新 next-session prompt 和 lessons，验证后单独提交；最终回复里的提示词再补上本轮提交后的实际 HEAD。
- 启动检查若发现当前 HEAD 已是新的状态同步提交，但 checklist / next-session prompt 仍把上一提交写成最新恢复入口，应先按一个小阶段写 `tasks/todo.md` 计划并校正文档，再进入后续 gated smoke、根文档同步或产品功能开发。
- 启动提示或用户上下文明确给出最新状态同步提交（例如 `f687166c`），而仓库文档仍停留在上一恢复入口（例如 `c75e132f`）时，要以 `git log` 确认后的 HEAD 为准，先校正 checklist、next-session prompt 和 `tasks/todo.md` Review；不要继续沿用旧提示词导致恢复入口倒退。
- 只要用户明确要求“更新文档最新开发状态 / 标注完成未完成 / 给下次启动提示词”，即使没有业务代码变化，也要执行完整状态同步闭环：`tasks/todo.md` 计划、development checklist、next-session prompt、`tasks/lessons.md`、Review、验证、单独提交和最终可复制提示词。
- 用户再次重复要求“更新文档最新状态、完成/未完成、下次启动提示词”并强调“记住这个习惯”时，不要认为上一轮已做完即可口头回复；仍要新建本轮 `tasks/todo.md` 计划，回填当前 `git log` 可确认的最新恢复入口，更新 checklist / next-session prompt / lessons，写 Review，验证后单独提交。
- Pipeline v1 状态同步或启动入口校正不能顺手修改根 `README.md` / 根 `AGENTS.md`；只有用户明确允许“公开文档同步”后才能触达根文档，否则只更新 `docs/improve/pipeline/v1/`、`tasks/todo.md` 和 `tasks/lessons.md`。

## 2026-05-28 README 架构图视觉验收

- README 架构图不能只通过 SVG XML、碰撞脚本和缩略 contact sheet 就算验收；必须打开最终 PNG 的实际显示尺寸，逐张检查节点文字是否被边框压住、箭头标签是否遮挡节点、长虚线/总线是否割裂画面、图例是否挤占内容。
- 技术图放在 README 中应优先选择展示型信息架构：节点内写清职责，连线少而明确；避免把所有调用关系都画出来，否则在 README 缩放后会变成调试拓扑而不是可读架构图。
- `fireworks-tech-graph` 生成图后如果出现节点副标题靠近底边、箭头浮动标签贴近组件、路由总线跨越多层等问题，要重绘版式，而不是只靠自动校验脚本通过。

## 2026-05-28 Agent Runtime 设置页默认可选

- 当用户反馈 Agent Runtime 设置页缺少某个已完成 runtime 时，要同时检查 renderer 选项过滤、settings 初始化回退、main process runtime 注册和 orchestrator preflight gate；只改设置页展示会导致用户选了也跑不起来。
- Codex / opencode 都完成基础验收后，设置页应默认展示 `Claude Code / Codex / opencode` 三选；旧的 `CODEINSIGHTS_AGENT_CODEX_RUNTIME` / `CODEINSIGHTS_AGENT_OPENCODE_RUNTIME` 只能作为历史 rollout 记录，不能继续作为用户选择前置条件。
- 做 opencode 可见性修正时必须顺手检查 Codex 可见性，避免只开放一个 runtime 造成用户继续看不到另一个选项。

## 2026-05-28 opencode 状态同步默认动作

- 用户要求更新 opencode 最新开发状态、完成/未完成清单或下次启动提示词时，直接同步 `docs/opencode-support/README.md`、development checklist、`next-session-prompt.md`、`tasks/todo.md` Review 和 `tasks/lessons.md`，并在最终回复给一份可直接复制的提示词，不再等待用户重复提醒。
- 这个动作是默认收尾习惯：阶段完成后或用户要求“最新开发状态 / 哪些完成未完成 / 下次启动提示词”时，必须主动做文档同步和可复制提示词，不需要用户再次说“记住这个习惯”。
- 完成状态同步提交后，最终回复里的提示词要补上实际最新 HEAD；仓库内提示词若无法写入自身提交 hash，必须至少写明最近一个真实状态同步提交，并允许“或其后的文档同步提交”作为恢复入口。
- 这类同步必须明确区分“开发基线”和“状态同步提交”：Phase 实现提交作为开发基线，文档同步提交作为恢复入口；下次启动提示词要要求检查二者都在历史里。
- 如果当前最新 HEAD 已经是状态同步提交，仍要复核文档里是否缺少该提交号或仍有旧占位表达，发现后直接更新并验证。

## 2026-05-27 阶段提交与重启恢复纪律

- 每完成一个清单阶段并通过该阶段验证后，必须立即单独提交；提交信息使用详细中文，说明本阶段完成内容、验证结果、未包含内容或暂缓项。
- 重新启动 Codex 会话或上下文恢复后，先检查 `git status --short` 和最近提交，主动判断是否存在已完成但未提交的阶段成果；如果有，先提交再继续开发，不等待用户再次提醒。
- 用户要求“提交当前代码变更”时，如果工作树已经干净，要明确告知最近提交；如果该要求包含新的长期协作习惯，必须写入 `tasks/lessons.md` 并单独提交这条纪律更新。
- 用户再次强调“每完成一阶段任务，就提交一次 / 重启 Codex 会话也无需提醒”时，要把它视为长期默认规则：新会话启动后先复查 `tasks/lessons.md`、`tasks/todo.md`、当前 checklist、`git status --short --branch` 和 `git log -3 --oneline`；若发现阶段已完成但未提交，先提交阶段成果，再继续任何新实现。
- 阶段提交必须发生在该阶段完成定义和验证命令通过之后；不能把多个已完成阶段拖到最后合并成一个大提交，除非用户明确要求合并提交。
- 如果当前没有未提交业务代码，但用户要求记住阶段提交习惯，也要用一次独立文档提交固化该纪律，并在最终回复给出实际提交号和当前工作树状态。

## 2026-05-27 状态同步与下次启动提示词

- 阶段完成或用户要求“下次继续开发”时，必须同步三类信息：最新提交基线、已完成/未完成清单、下次启动提示词；不要只更新其中一处。
- 下次启动提示词里的预期最新提交必须指向真实 HEAD 或明确“其后的状态同步提交”，避免恢复会话时误以为旧提交仍是最新状态。
- 用户要求“记住这个习惯”时，要写入 `tasks/lessons.md`，并在后续收尾时主动检查 support README、development checklist 和 next-session prompt 是否一致。
- 每个阶段性任务完成后，除了提交代码/文档本身，还要自动同步对应 support README、development checklist 和 next-session prompt；如果某个目录还没有这些入口，先补齐入口再交付。
- 用户要求“给下次启动提示词”时，不能只在最终回复里给文本；必须同时更新仓库内的 `next-session-prompt.md`、support README、development checklist 和 `tasks/todo.md` Review，并在验证后单独提交状态同步改动。
- 对按 Phase 推进的 Agent runtime 接入任务，阶段提交完成后要立即把真实提交号写回最新状态和下次启动提示词；不要留下“以当前提示词所在提交为准”这类恢复时不够具体的表述。
- 用户再次要求更新最新开发状态或下次启动提示词时，即使文档已经大体同步，也要检查是否仍有“以 git log 为准 / 后续状态同步提交”这类占位表达；必须写入真实最新提交号，并把这条习惯作为收尾检查项。
- 用户要求“更新文档最新开发状态并给下次启动提示词”时，必须同步仓库内 support README、development checklist、next-session prompt 和 `tasks/todo.md` Review，并在最终回复中给一份可直接复制的提示词；这不是临时要求，后续默认执行。
- 这个状态同步习惯是默认工作流：阶段完成后或用户询问最新进度/下次提示词时，主动同步仓库文档、任务记录和最终回复，不需要用户再次提醒“记住这个习惯”。
- 仓库内文档无法可靠写入“自身提交 hash”时，要明确区分“最新开发基线”和“本轮文档同步提交”；support 文档记录真实开发基线，最终回复里的可复制提示词再补上本轮提交后的实际 HEAD。
- 对 opencode / Codex runtime 这类分 Phase 开发，阶段实现提交后若用户要求“更新最新开发状态并给下次启动提示词”，必须立刻做状态同步提交：写清已完成 Phase、未完成 Phase、下一阶段入口、真实开发基线提交号和本轮验证结果；后续无需用户再次提醒。
- 用户再次要求“更新文档最新开发状态、标清完成/未完成、给下次启动提示词”时，要把它当成默认收尾动作：同步 support README、development checklist、next-session prompt、`tasks/todo.md` Review 和 `tasks/lessons.md`，并提交这次状态同步，不再等待用户提醒“记住这个习惯”。
- 对 Rust / Go 优化这类新建 `docs/improve/<topic>/` 的阶段化工作，如果目录还没有 `next-session-prompt.md`，第一次状态同步时必须补齐；后续每个阶段完成后默认同步 development checklist、next-session prompt、`tasks/todo.md` Review 和必要的 lessons，并单独提交状态同步。

## 2026-05-26 Codex native auth 中转配置

- Codex native auth 隔离 smoke 不能只复制 `auth.json`；如果主机 `~/.codex/config.toml` 里配置了 `model_provider` / `model_providers.*.base_url` 等中转 API 信息，隔离 `CODEX_HOME` 缺少该文件会错误回落到默认 OpenAI 路径，导致 smoke 误判为凭证或网络问题。
- 复制 native auth 到临时 `CODEX_HOME` 时，要把同一来源目录下的 `config.toml` 一并复制并设为 `0600`，清理时同时删除；日志和 summary 不能输出配置内容或 secret。
- 记录 Codex native smoke 失败时，先检查隔离环境是否保留了主机 Codex 配置语义，再判断外部网络/凭证是否真的阻塞。

## 2026-05-25 Agent Runtime Routing 绑定与 generation

- Orchestrator 的 active run generation 不能用 `Date.now()` 这类墙钟时间；同一毫秒 stop 后重跑可能让旧 run 的 finally 误删新 run，必须使用单调计数或唯一 token。
- Coding runtime 首次绑定原生 session 时，不能只保存 external session id；还要固化当时的 channel/model 等 resume 必要上下文，避免 settings 后续变化后用错误账号或模型恢复旧 thread。
- 对不支持运行中权限切换的 runtime，要先确认 runtime 接受该切换再更新本地权限状态；unsupported 不能污染 `sessionPermissionModes`。

## 2026-05-24 项目主页架构图留白

- 给主页架构图、截图等 `<img>` 写 HTML `width` / `height` 属性时，CSS 基础规则必须同时包含 `width/max-width` 与 `height: auto`；否则窄列响应式布局会保留固定高度，SVG 默认居中适配后出现巨大上下白边。
- 用户截图圈出页面大块空白时，要先测量真实 DOM 盒子和图片 natural size，不要只看 SVG viewBox；容器高度、HTML 尺寸属性和懒加载状态都可能造成“看起来是图片空白”的问题。

## 2026-05-23 README 语言切换与标题图标

- README 顶部语言切换必须指向真实存在的 README 文件；不要把 `English` 链接到产品主页或 GitHub Pages 首页来替代英文 README。
- 用户要求删除标题旁项目图标时，应删除 H1 内嵌图标，只保留纯文本项目名；素材目录里保留品牌图标源不等于首屏继续展示图标。
- 补英文 README 时要同步验证中英文入口互链、首屏标题、视频位置和本地链接目标，避免链接看似存在但跳转到错误内容。
- README 首屏重新放回项目图标时，不能使用带白色外圈的旧 RGB 素材；应使用透明外缘的主图标素材，只展示中间主体标识。

## 2026-05-23 README 参考页对齐

- 用户给出外部 README 作为参考时，优先对齐它的首屏组织方式而不只是替换文案：标题区、语言切换、简短定位、徽章、视频播放器和锚点导航要整体重排。
- 参考页里如果把视频作为主展示，README 应该用原生 `<video>` 做首个媒体块，而不是继续用静态截图链接视频。
- 用户明确要求 README 放视频时，不能因为 GitHub 相对 MP4 可能渲染不稳定就把 `<video>` 替换成抽帧图；可以补 fallback 链接，但必须保留视频播放器。
- GitHub README 中要让访问者直接点击播放视频时，`<video>` 的 `src` 应优先使用 GitHub 可访问的绝对视频 URL；相对 mp4 路径容易退化成文件跳转或不稳定渲染。
- 线上 GitHub README 会把相对 MP4、raw.githubusercontent、GitHub raw、release asset 和 GitHub Pages MP4 的 `<video>` 过滤成空段落；必须用 `github.com/user-attachments/assets/...` 并用 GitHub Markdown API 或页面 HTML 复核 `<video>` 存在。
- 用户截图红框标出 README 首屏辅助链接时，应按可见区域精确删除对应链接；不要把被删链接挪到同一首屏的其他位置，也不要顺手移除视频播放器本身。
- 参考页里的“短优势块 + 大段正文”结构适合开源桌面工具的 README；先给第一眼信号，再展开详细架构和命令。

## 2026-05-23 README 公开命名与视频首屏

- 用户要求 README 不再出现历史项目名时，不能用说明段或 FAQ 去解释历史残留；公开 README 应直接清理文字、可见截图、视频预览和被引用素材中的历史命名。
- 用户要求视频替换图标位置时，README 首屏应把视频预览和播放链接放在标题后第一视觉位，品牌图标只能作为素材清单中的源文件保留。
- 验证 README 命名清理不能只跑 Markdown 文本搜索，还要检查首屏视频预览、架构图、本地存储图和视频源素材是否仍可见历史命名。

## 2026-05-23 图标外缘透明处理

- 用户说“去掉外面白色的一圈 / 只保留中间的图标”时，优先理解为保留当前主体标识，移除画布边缘连通的浅色背景，不要重新设计 CI 主体。
- App icon 的主 PNG 也要保留 alpha；不能只给 `*-transparent.png` 做透明裁切，否则 Dock / installer / renderer / web 资源仍会带白色外缘。
- 图标生成后必须抽样检查四角 alpha、边缘浅色连通区域和派生资源尺寸，避免 RGB 扁平化把白底再次写回。

## 2026-05-22 项目图标简约度

- 用户反馈图标“不美观简约”时，根因通常不是元素还不够多，而是把产品功能说明画进了图标；项目图标应优先像品牌标识，少量几何形就能成立。
- CodeInsights 图标候选要避免密集节点、复杂轨道、多色渐变和说明性线条；小尺寸下应保留一个强主轮廓、一个识别性负形和最多一处品牌强调色。
- 汇报图标设计时应区分“功能概念图”和“正式 App icon 候选”；默认优先提交更简约、可缩小、可长期使用的候选组。

## 2026-05-19 Codex Pipeline runner auth 隔离

- Codex 原生登录不等于必须保留整个 `HOME`；运行时应优先解析 `CODEX_HOME/auth.json`，否则回退 `HOME/.codex/auth.json`，再在子进程里只传明确的 `CODEX_HOME`，保持 `HOME` / `USERPROFILE` / `XDG_CONFIG_HOME` 隔离。
- 显式 API key 模式必须覆盖或隔离宿主继承的 `CODEX_HOME`，避免测试或运行时意外加载用户全局 Codex 状态。
- Codex runner 单测不能依赖开发机已有登录；不关心 auth 的 mock executor / fake SDK 测试要显式注入假 `CODEX_API_KEY`，只有 fail-fast 用例保留无凭证环境。

## 2026-05-18 Agent 真实交互补跑字段契约

- 通过 preload / IPC 回调补跑权限、AskUser、ExitPlanMode 时，响应字段必须严格按共享类型传递；`respondPermission` 需要 `behavior`，`respondAskUser` 需要 `answers`，`respondExitPlanMode` 需要 `action`，不要用近似字段名猜测协议。
- 真实 stop 场景不能只测 abort 抛错路径；SDK iterator 可能在 stop 后正常结束，主循环必须在“正常完成”前再次检查 active session，补写 `run_stopped` 并清理 pending。

## 2026-05-19 Agent Runtime sdk_session 去重位置

- Runner v2 的 `sdk_session` 重复不是只靠 Orchestrator 过滤就够；`queryOptions.onSessionId` 仍可能被 SDK 多次触发。正确做法是在 event log writer 层按同一 run 的 `sdkSessionId` 去重，同时保留第一条 `sdk_session` 作为可回放证据。
- 用 CDP / Playwright 连接 Electron 时不要调用 `browser.close()` 作为“清理连接”，它会把 Electron 窗口一起关掉；验证脚本只应断开脚本侧连接，避免误伤真实桌面壳。

## 2026-05-19 Pipeline planner fallback

- Pipeline v2 的 `planner` 不能只依赖严格 JSON；真实模型会先吐自然语言再给出计划摘要，节点必须保留自然语言 fallback，把 plan.md / test-plan.md 继续落到 patch-work，而不是直接把 run 判失败。

## 2026-05-18 Agent Runtime 新旧 Session 分支

- 判断 runtime 是否已物化时不能把 `hasMaterializedAgentRuntime()` 当作“是否应该物化”的条件；正确流程是：已有 manifest 读取并复用，新 session 无 manifest 时物化，旧 session 有 `sdkSessionId` 且无 manifest 时继续旧 cwd。
- Plugin / command 的运行期行为必须以 runtime snapshot 为准；物化后再读取源目录会绕开 manifest/hash，导致源目录变化或被替换后实际执行内容不可审计。
- “禁止 fallback 到用户全局 plugin”意味着 snapshot 失败应阻断 run，而不是静默回退到 legacy/global plugin 路径；文档和测试要把这个策略写清楚。

## 2026-05-17 Agent Header 内容优先级

- Agent 主界面里消息流和输入区是核心，Mission Header 只能承担定位和状态摘要；科技感不能通过增加顶部面板高度、右侧装饰卡或多行状态 chip 来实现。
- 用户截图用红框指出“内容太多、挤压下方”时，应优先删除/合并次要 HUD 信息，而不是继续微调颜色或把元素缩小后全部保留。
- Header 元信息 chip 必须有稳定单行策略；中文短 label 在窄胶囊里很容易逐字换行，常规宽度应隐藏 label、保留图标和值，超宽屏再展示完整 label。

## 2026-05-17 顶部模式切换器保护

- 用户明确指出 `Agent | Pipeline` 必须保留后，后续任何侧栏视觉优化都要先检查它仍在展开态首屏顶部可见，不能被标题区、统计区或装饰容器替代。
- 对用户截图中的“看起来怪”进行视觉升级时，优先压缩比例、增强当前态和统一图标文字基线；不要用更大的容器或更多装饰解决已有的占位问题。

## 2026-05-17 Agent Cockpit 可见变化强度

- 用户要求“充满创意 / 发挥想象力”的 UI 重塑时，不能只做轻微材质、阴影、边框和 token 微调；第一轮就要给出截图级可见的结构、光效、层级和状态表达变化。
- 汇报 Agent UI 优化时必须明确说明具体影响的界面区域：AppShell 背景、左右面板、Agent Header、消息卡、权限横幅、输入区等；如果视觉变化主要在 Agent 模式，不能让用户误以为全应用都已大幅重绘。
- 如果用户反馈“看不出来”，应承认强度不足并立即加重视觉差异，而不是只解释代码层面已经改过。

## 2026-05-16 Pipeline Header 信息密度

- Pipeline Header 不应重复展示会话标题作为超大 H1；会话标题已经在标签页和侧边栏出现，主面板顶部保留 CodeInsights Pipeline、当前节点、状态摘要即可。
- 用户截图标红要求删除的 UI 元素，应优先按“移除该视觉块”处理，而不是通过缩小字号或换位置保留。

## 2026-05-13 Pipeline patch-work 路径安全

- 对 repo 内工作目录做路径安全时，词法 `resolve/relative` 不够；所有已存在路径段都要用 `lstat` 拒绝 symlink，并用 `realpath` 验证仍在真实 repo root 内。
- 对 `manifest.json` 这类控制文件不能直接复用带 backup 的通用 JSON 原子写入，除非先确认目标不是 symlink；否则 backup 可能跟随 symlink 复制仓库外内容。
- 服务入口不能只依赖 TypeScript 类型，来自 IPC / Agent / fixture 的枚举和 JSONL 内容都要做运行时 schema 校验。

## 2026-05-14 Pipeline 分阶段提交纪律

- Pipeline v2 六 Agent 工作流必须按 checklist 阶段推进；每完成一个阶段并通过该阶段完成定义后，立即单独提交一次。
- 阶段提交只包含该阶段相关文件，不默认纳入 `patch-work/**`，也不做 push / PR，除非用户明确要求。
- 重新启动 Codex 会话或上下文恢复后，也要主动延续“阶段完成即单独提交”的纪律，无需等待用户再次提醒。

## 2026-05-14 Pipeline v2 前端可见性

- 不能只把 v2 看板挂到 gate 条件里就算“前端已接入”；如果默认新建会话仍然是 v1，用户会看不到 task selection / document review 按钮。
- 新增前端功能时必须检查“入口是否能走到该状态”，而不仅是“组件是否存在”。

## 2026-05-14 Pipeline 结构化输出兜底

- Agent 节点要求 JSON 结构化输出时，不能假设模型一定会只返回 JSON；真实运行中可能先输出自然语言分析或工具前言，导致 runner 解析失败。
- 对 explorer / planner 这类用户可恢复节点，要同时加固 prompt 契约和解析兜底：能从 fenced JSON / 尾部 JSON 提取时提取，完全没有 JSON 时给出可恢复的结构化 fallback，而不是直接让 Pipeline 卡死在“非法 JSON 对象”。

## 2026-05-14 Pipeline 停止反馈

- 停止运行这类用户中断操作不能只发送 IPC 后等待后台事件；按钮本身要显示“正在停止”，成功后当前面板要有“已停止”反馈。
- stop IPC 最好返回结构化状态快照，renderer 即使错过 stream 广播，也能主动回填 `terminated` 状态并清理 pending gate / live output。

## 2026-05-14 Pipeline 节点静默运行反馈

- Pipeline 节点进入 Claude / Codex 工具调用或等待模型首包时，可能长时间没有 `text_delta`；UI 不能把空 buffer 展示成“正在等待节点输出...”后就没有更多解释。
- 实时输出面板需要区分“节点已启动但模型暂未吐文本”和“真正失败/停止”，给出可见进度说明，避免用户误以为应用卡死。

## 2026-05-14 Pipeline 节点中止后的副作用

- Agent / Codex runner 在异步模型调用返回后、写 patch-work 或发送 `node_complete` 前都要重新检查 AbortSignal；停止请求可能发生在模型返回与本地 enrichment 之间。
- 只在调用入口检查 abort 不够，所有本地副作用边界都要有二次检查，尤其是 `dev.md` / `review.md` 这类会改变贡献任务状态的产物写入。

## 2026-05-15 Pipeline Tester Git 写入防护

- Codex workspace-write 节点不能只靠 prompt 和事后 HEAD 检查防止真实提交；如果 `git commit` 已经发生，事后抛错也已经污染仓库历史。
- Phase 5 tester / developer / committer 这类允许写工作区的节点必须在运行环境前置命令级防护，阻断 `git commit/push/tag/reset/rebase/fetch/pull` 和 `gh` / `hub` PR 命令，并保留事后 HEAD / remote refs 校验作为二次防线。
- Tester 证据要保守：缺少 `testEvidence` 或 evidence 为空不能自动补成 passed；正常 `document_review` approve 必须服务端复验所有 evidence 均为 `passed`，`test_blocked` 只能作为显式风险接受继续。

## 2026-05-15 Pipeline Git 防护不能只靠 PATH

- 只把临时 `git` shim 放到 PATH 前面，拦不住 `/usr/bin/git` / `/opt/homebrew/bin/git` 这类绝对路径调用；workspace-write 节点还要让默认 `GIT_DIR` 失效，并清理宿主 `GIT_DIR` / `GIT_WORK_TREE` / `GIT_INDEX_FILE`。
- 事后校验不能只看 HEAD；至少要覆盖全部 refs、Git index、local config，并检测已有源码补丁被 `reset --hard` 一类命令整体丢弃。
- Tester 的 human-facing `result.md` 必须和结构化 `testEvidence` 使用同一套保守判定；不能让 `passed: true` 覆盖 failed / skipped evidence。

## 2026-05-16 阶段完成即提交纪律

- 任何按阶段推进的非琐碎开发或文档任务，都要在阶段完成并通过该阶段验证后立即单独提交，不等用户再次提醒。
- 重新启动 Codex 会话或上下文恢复后，也要主动检查当前任务是否已有完成阶段未提交；若有，应先提交阶段成果，再继续下一阶段。
- 阶段提交只包含该阶段相关文件；不默认 stage 无关文件、截图大产物、`patch-work/**`、远端 push 或 PR。
- 用户再次强调“每完成一阶段任务，就提交一次”时，要把它视为长期工作习惯，而不是本轮临时要求；新 Codex 会话恢复后也要先检查是否存在已完成但未提交的阶段成果。
- 提交信息必须用详细中文说明本阶段完成内容、验证结果和未包含的无关改动；提交前先用 `git status --short` 确认不会纳入 `.DS_Store` 等无关文件。
- 对 Agent Codex Runtime 这类按 Phase/PR 推进的任务，每完成文档阶段、契约阶段、runtime core 阶段、UI 阶段或真实验证阶段，都要先运行该阶段清单里的验证命令，再立即提交该阶段相关文件；重新启动会话后也要主动延续这个节奏。
- 对已在开发清单中确认过门禁和范围的阶段，用户明确要求“不需要询问我，直接开发即可”后，后续启动计划写入 `tasks/todo.md` 即可继续执行，不要再停下来等待确认；仍需保持范围边界、验证和阶段提交纪律。

## 2026-05-29 阶段提交习惯再确认

- 用户再次要求“每完成一阶段任务，就提交一次”时，要视为长期工作契约；即使重新启动 Codex 会话，也要在读取 lessons / checklist 后主动检查是否存在已完成但未提交的阶段成果。
- 如果用户要求“提交当前代码变更”而工作树已经干净，应明确报告最近阶段提交和 ahead 状态；如果同时有习惯同步或 lessons 更新，则只提交该同步改动，不制造无关业务修改。
- 每次阶段提交前都要用 `git status --short` 和 `git diff --cached --stat` 核对范围；提交信息必须用详细中文写清主要变更、验证命令、未做事项和未纳入的无关范围。
- 每个阶段完成后，除了提交代码，还要同步对应开发清单的最新状态、更新 next-session prompt，并在 `tasks/todo.md` Review 中写明完成项、未完成项、验证结果和下一阶段入口。

## 2026-05-16 UI 阶段可见性表达

- UI token / primitive 收敛属于基础设施阶段，不能向用户暗示主界面已经有明显视觉变化；重启客户端后若 AppShell / Pipeline / Agent 页面尚未进入阶段改造，用户看到旧界面是预期结果。
- 汇报 UI 阶段进度时必须区分“底层组件已改”和“真实客户端主界面已改”；若用户问能否看到变化，要明确说明当前阶段能看到的范围和看不到的页面。
- 用户截图指出主界面无变化时，应把这类误导性表达记录到 checklist / todo 的状态说明里，防止下次启动继续误判。

## 2026-05-16 UI-2 可见改动不足

- AppShell / Sidebar / Tab 的 token、边框、状态线和 focus 收敛即使代码完成，也可能在真实客户端截图中显得变化很小；不能把这类阶段汇报成用户能明显感知的 UI 优化。
- 当用户期待“全客户端 UI 优化”时，必须优先说明 UI-2 不会改变 Pipeline 主面板卡片、StageRail、Composer 和 Records 的整体观感；这些属于 UI-3。
- 阶段完成后给用户看客户端前，应主动指出“你现在最明显不会变的是主内容区”，避免用户把未进入阶段范围的页面误判为未修改。

## 2026-05-23 GitHub README 视频渲染

- GitHub 仓库 README 会过滤 `<video src="https://github.com/<owner>/<repo>/raw/...mp4">`，页面里只留下空段落；不能把 raw 仓库视频地址当成可播放播放器验证通过。
- README 需要像参考项目一样直接展示可点击播放视频时，应使用 GitHub 上传附件生成的 `https://github.com/user-attachments/assets/...` 地址，并在推送后抓取 GitHub 渲染 HTML 验证存在 `gh:secured-asset-reference` 和 `<video>`。
- 仅调用 `upload/policies/assets` 得到的附件 URL 可能在匿名访问下仍是 404；需要让 GitHub 编辑器完成上传并把附件引用持久化到公开内容后，再用匿名请求校验 mp4 文件头。
- 用户指出线上仍无视频时，要先承认 raw mp4 方案错误，再补齐真正的 GitHub 渲染验证，不要只停留在本地 Markdown 或 HEAD 请求。

## 2026-05-26 Codex MCP secret 注入

- `@openai/codex-sdk` 的 `config` 会展平成 Codex CLI `--config key=value` 参数；MCP env、HTTP header、token 等 secret 不能放进 `CodexOptions.config`，否则会通过进程 argv 泄露。
- Codex workspace MCP 注入应让 config 只保存结构和环境变量名：stdio 使用 `env_vars`，HTTP 使用 `env_http_headers` / `bearer_token_env_var`；真实 secret 只放进 Codex 子进程 env 或隔离的 0600 临时 config。
- 将 MCP env 合并进 Codex 子进程 env 时要防止污染 Codex 自身运行环境；`CODEX_API_KEY`、`CODEX_HOME`、`PATH`、代理变量、Git askpass/config 等保留名称不能从 workspace MCP env 直接透传。
- 即使 helper 已做保留名校验，runtime 合并 extra env 时也必须二次防护：禁止覆盖任何 Git guard/base env，禁止 `GIT_*` / proxy / Codex auth/home 等保留前缀，否则外部调用可绕过 helper。
- 使用 SDK `config` 传 HTTP header 映射时，header name 也会变成 dotted config path 的 key；不能安全表示的 header key 先跳过或改用隔离 TOML，不能生成会被 CLI 解析成嵌套 map 的 override。
- smoke 不能手写一份看起来等价的 Codex `--config` 参数；必须从真实 helper 输出派生验证输入，否则 helper 映射坏了 smoke 仍可能误报通过。
