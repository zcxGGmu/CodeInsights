# Lessons

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
