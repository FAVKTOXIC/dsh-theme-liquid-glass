# Changelog

所有值得记录的变更都会在此文件列出。
本文档格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

All notable changes to this project will be documented in this file. The format
is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.5.0] - 2026-10-24

### 中文

#### 新增
- **支持 DeepSeek Harness 桌面版（0.2.x 运行时）**。
- **全屏按钮**：桌面版自己没有全屏入口（无边框标题栏只有最小化 / 最大化 / 关闭；
  Windows 应用菜单只注册了 `toggleDevTools`（F12），没有 `togglefullscreen`；
  主进程全篇没有 `setFullScreen(true)`）。主题改为通过会话头部的
  `conversation.session.header.utilities` 插槽贡献一个 28px 图标按钮
  （`id: liquid-glass-fullscreen`），点击调用 Fullscreen API 请求整页全屏、再点退出，
  图标随 `fullscreenchange` 切换。因为应用对全屏有适配
  （preload 把系统全屏状态映射到 `<html data-fullscreen>`），进入全屏后布局会自动调整。
  这是用插槽注册的 React 组件（会被 fiber 自动回收），没有做 DOM 注入。

#### 修复
- **兼容性门禁拒绝加载**：5 个 `@deepseek-ai/dsh-client-*` 的 `peerDependencies`
  区间由 `^0.1.x-rc.*` 放宽为 **`^0.1.2-rc.1 || ^0.2.0-0`**。
  原因：DSH 用**单一运行时版本**校验插件清单（清单里没有 `engines.dsh` 时，
  逐个校验 `@deepseek-ai/dsh` 与 `@deepseek-ai/dsh-*` 的 peer 区间），
  而 `^0.1.x` 的上界是 `<0.2.0`，因此在 0.2.1-rc.2 上一律 unmet
  → 安装被拒（`nothing was installed`）、即便装上启动时也会被禁用/跳过。
  新写法同时满足 0.1.x 与 0.2.x 两个运行时。
- **桌面版上用户消息气泡失去玻璃效果**：harness ≥0.2 不再输出
  `data-time-hover-root`，导致 3 条气泡规则永不匹配。气泡的玻璃锚点改为双选择器
  `[data-time-hover-root] [class*="_bubble"], [data-conversation-scroll] [class*="_bubble"]`
  （前者兼容 0.1.x，后者对应 0.2.x 的滚动容器），两个版本都能命中。
  同步更新 `test/client.smoke.mjs`，对两个锚点分支分别断言。
- **顶部会话栏没有渐变透明与模糊**（显示会话名字的那条 `<header>`）：
  harness ≥0.2 的 DOM 是 `div[data-phase] > [data-slot="conversation.header"] > header`，
  而原选择器**把层级写反**（写成 `[data-slot="conversation.session.header"] > header`）、
  又把 `[data-phase]` 挂在**错误的元素**上（含滚动容器的那层用的是 `data-content-phase`），
  于是"浮在消息列表之上 + 顶部强模糊 → 底部透明"这两条规则**从未生效**；
  而且所有头部样式都以 `header:has([role="tablist"])` 作门控，而 tablist 只在
  `tabs.length > 1` 时才渲染 → 单视图会话连基础玻璃都没有。
  现在每条规则都带**双锚点**（旧 `header:has([role="tablist"])` + 新
  `[data-slot="conversation.header"] > header`），并新增
  `[data-phase="active"] > [data-slot="conversation.header"] > header` 的绝对定位规则，
  让消息真正从栏下滚过（原版 `.root` 本就是 `position: relative`，无需额外定位上下文）。
- **移除对模型选择列表的改造**（外观 + 行为）：删掉整屏毛玻璃选择器、provider 分组
  两列网格、悬停/选中样式，以及那个自动跳过「模型 / Effort」根面板、点空白关闭的
  `MutationObserver`。原因是其他主题插件也会给这个菜单上样式，双方互相打架。
  模型列表现在保持 harness 原生外观与交互；输入框里的**「访问模式」下拉**是另一个
  `[role="menu"]`，其玻璃质感**保留**。
- **悬停高亮收窄作用范围**：原来一条
  `button / a / [role="button"] / [role="tab"] / [role="menuitem"] / [role="link"]`
  的全局 hover 规则（带 `transform: translateY(-1px)` 与高亮）会伸进其他插件的控件里抢样式。
  现在只作用于本主题确实改过的表面：输入卡片、队列坞、对话框 / 菜单、视图标签、侧边栏。
- **顶部会话栏与聊天区之间的白线**：原版把分隔线画成 header 自身的**真实
  `border-bottom`**（`.5px solid var(--dsw-alias-border-l3)`，主题把它覆盖成偏白色），
  而主题只隐藏了 `::after` 伪元素（那是 0.1.x 的写法，0.2.x 没有该伪元素）→ 栏浮起后
  这条边框就横在聊天区上方。现在在两个锚点共用的规则里显式 `border-bottom: none`。
- **顶栏并入系统标题栏后的三个连带问题（桌面版）**：
  - **侧边栏的收起/展开按钮跑到侧边栏里**（在 logo 右边、新建对话按钮右上角）。根因是主题给
    侧边栏按钮加透镜用的 `position: relative`（优先级 (0,5,2)）顶掉了原版给这个窗口控件的
    `position: fixed; left: 12px; z-index: 30`（(0,2,0)），按钮于是退回侧边栏内部。
    现在桌面版用 `button[class*="_iconButton"][class*="_toggle"]`（两个类同时命中，避免误伤
    树里的其它 toggle）把它的 `position` 还原；该按钮本来就没有透镜（另一条规则会隐藏含 svg
    按钮的 `::before`），所以还原不付代价。
  - **非全屏下菜单栏的「打开侧边栏」「新建对话」点不动**。根因是并入标题栏的顶栏**盒子横跨
    全宽**、只是用 `padding-left` 让开内容，于是盒子仍盖住左侧的窗口控件（12–40px / 48–76px），
    而顶栏是拖拽区，把这些点击吞掉了。现在不再用内边距让位，而是把盒子**起点**移到
    `left: calc(var(--dsh-windows-menu-start, 48px) + 134px)` 之后（约 182px），控件完全不在盒子内。
  - **右侧展开按钮与最小化按钮轻微重叠**。根因是原版给顶栏右端控件留了
    `margin-right: -16px` 负边距，把它又往右推进了原生按钮区，吃掉了主题留的间距。
    现在桌面版把该负边距归零，并把右侧让位从 140px 提到 148px（= 3×46px 原生按钮 + 余量）。
  顺带把标题栏的磨砂**合并成一层**：桌面版关闭顶栏自己的 `::before`，磨砂单独由框架那条
  40px 带子提供，并把它的渐变形状对齐成同一套（0 → 30% → 100%）—— 消除双层模糊与接缝。
- **浅色模式下副标题/灰色文字可读性差**：harness 的灰阶是为**不透明白底**调的
  （`--dsw-alias-label-secondary` = `#61666b`、`-tertiary` = `#81858c`、
  `-caption` = `#adb2b8`，后者在白底上仅约 2.1:1），而主题把面板做成半透明并叠在壁纸上，
  对比度进一步被吃掉。现在主题覆盖这三个 token 的**浅色值**，各压深一到两档
  （`#2c2c2e` / `#43454a` / `#61666b`）；暗色模式仍引用 harness 的
  `--dsw-static-neutral-bluish-*` 静态取值，不做改动。`--dsw-alias-label-dimmed` 只用于
  禁用态输入框，刻意保持淡色，未改。
- **几处浮层看起来是透明的**（补齐高斯模糊 + 玻璃底色）：
  - **选择对话框**（`dsh-client-ui-user-questions` 的问题面板 / 计划评审面板）：底色来自
    `--dsw-specific-input-major`，主题把它设成 `glass(0.35)` → 几乎全透；而且这套 UI
    **没有 `role="dialog"`**（包里只有 `group` / `start` / `status`），所以主题原有的
    `[role="dialog"][aria-labelledby]` 规则从未匹配到它，连模糊都没有。该 token 与输入框
    共用，因此修复**只限定在这两处卡片**上（`[data-question-key]` / `[data-plan-review-key]` 内的卡片）。
  - **「已编辑 N 个文件」卡片里的悬浮预览**：浮层是 primitives 的 HoverCard 卡片
    （`Gn.card` + `Gn.preview`），其自身底色是 `background: var(--dsw-alias-bg-layer-1)`
    —— 主题把这个 token 设成 `glass(0.55)`，所以是**半透**而不是全无背景。
    它的类名是构建期哈希、定位走内联 style，因此改用**「直接包住稳定锚点
    `[data-changes-hover-preview]` 的那一层」**作为选择器（已在 primitives 包里核实：
    预览内容是该卡片的直接子元素），并靠 `body.dsh-lg-on` 前缀压过模块规则的优先级；
    该层原本就有圆角、阴影与零内边距，所以只补底色 + 模糊，内层元素不动
    （两层都上底色会叠成不透明面板）。
  - **顺带两处**：该卡片本体（`--dsw-alias-bg-layer-1` = 0.55）与对话流里的问答回执气泡
    （`--dsw-specific-bubble` = 0.5）也补了底色 + 模糊。
  面板用 78%、悬浮预览用 84%，都走 `--dsh-lg-tint` / `--dsh-lg-blur`，跟随设置里的滑块；
  暗色模式用 `--dsh-lg-tint-dark` 各有一条对应规则。两个面板另加了 1px 细边以明确边界。

#### 变更
- **顶部栏压成一行**：原版把「对话 / 轨迹」两个标签放在标题下方的**第二行**
  （顶栏共 76px）。现在顶栏改为单行 flex：侧栏开关 → 会话标题（占满剩余宽度）→
  标签按钮 → **右上角的「打开方式」下拉** → 右侧栏开关；顶栏高度 48px，
  滚动区预留从 88px 调整为 56px。为把标签排到下拉**左边**，标题行用
  `display: contents` 拆开（其子元素升级为顶栏的 flex item），再用 `order` 重排
  （标题簇 1 / 标签 2 / utilities 3 / corner 4 / 全屏按钮 5）；标题行原有的
  `padding-inline-start`（避让浮动侧栏开关）**已迁移到标题簇**上保持原行为。
  已确认 harness 没有任何 `@container` 查询依赖标题行这个盒子。
- **视图标签去掉大胶囊**：删掉 `border-radius: 999px` 的胶囊与每个标签上的
  `::before` 玻璃透镜（含边缘折射），改成 6px 圆角小按钮，
  悬停 / 选中改用与其它玻璃一致的淡色底；原版下划线指示线继续隐藏。
- **Windows 标题栏也做渐变磨砂**：桌面版最顶部 40px 的标题栏是布局框架上的一个
  `::before`（无边框窗口的拖拽区，底色取自 `--dsw-specific-sidebar-fill`），
  现在给它加上顶部强模糊 + 向下渐隐的 mask，不再是平铺的半透明色带。
- **顶栏并入系统标题栏（桌面版）**：原来顶栏在中间栏里占自己的一行（48px），
  现在它脱离中间栏、变成**窗口级横条**，正好落在最顶部 40px 的系统标题栏带子里，
  与「应用菜单 / 编辑」和原生窗口按钮同一行 —— 因此省下那 48px，消息区预留从 56px 降到 40px。
  做法与 harness 自己的窗口控件一致（侧栏开关就是 `position: fixed; top:6px; left:12px` 放在这条带子里的）：
  - 左边让位读 `--dsh-windows-menu-start`（harness 在侧栏收起时会把它从 48px 改到 84px，跟着它走就不会撞上菜单）；
  - 右边让位用 Window Controls Overlay 的 `env(titlebar-area-width)`（读不到则退回 140px = Win11 三个按钮的宽度）；
  - 顶栏自己声明 `-webkit-app-region: drag` 接管拖拽区（Windows 上 harness 的
    `[data-window-drag]{-webkit-app-region:drag}` 只对 macOS 生效），并给里面所有可交互元素补 `no-drag`；
  - 全屏时（`[data-fullscreen]`）原生按钮消失，右侧让位归零；harness 自己在同一状态下也把
    `--dsh-frame-chrome-top` 归零。

#### 说明
- 桌面版的 profile 名为 `desktop`（不是 `web`），由桌面应用首次启动初始化；
  安装前需完全退出桌面版，再执行 `dsh plugin --profile desktop add …`
  （该路径会先做兼容性预检，并把本插件自动并入 `dsh.profile.bundles`）。
- 未改动 `engines.dsh`：该字段一旦声明即**独占**判定，写窄会误伤 0.1.x 宿主。

#### 文档
- **README 全面重写（中英）**，从"开发笔记"改成"面向使用者"：
  - 页首就是**深色模式提醒**（浅色模式下玻璃发白、文字发灰，属设计前提，不是 bug）；
  - 截图提到最前，并按「桌面版专属 / 玻璃本身 / 壁纸 / 其它」重新分组，先说**能拿到什么**
    （顶栏与菜单栏合二为一省下垂直空间、全屏按钮、边缘折射、六种壁纸来源、各项可调参数），
    再说实现细节；
  - 删掉两处**已失实**的描述（"重新设计的模型选择器"、"视图标签边缘折射"）——这两项在
    0.5.0 里已经移除或改掉，商店评审会逐条核对代码，失实会被打回；
  - 图片改用 `raw.githubusercontent.com` **绝对链接**，这样 npm 包页也能正常显示（相对
    路径在 npm 上会 404），同时仍符合商店对截图"必须是 GitHub 托管 https 链接"的要求；
  - 新增「兼容性与刻意的取舍」表（模型列表交还 harness、悬停作用域、设置存 localStorage 等）。
- `package.json` 的 `description` 同步重写（去掉失实与营销措辞），`keywords` 补
  `deepseek-harness-desktop` / `dsh-theme` / `frosted-glass` / `desktop`；
  `screenshots.json` 补入 `screenshot-input.png`（商店详情页画廊用，1–8 张）。

### English

#### Added
- **Support for the DeepSeek Harness desktop build (0.2.x runtime).**
- **Fullscreen button**: the desktop build has no fullscreen entry point of its own (the
  frameless caption offers only minimize/maximize/close; the Windows application menu registers
  just `toggleDevTools` (F12) with no `togglefullscreen`; and the main process never calls
  `setFullScreen(true)`). The theme therefore contributes a 28px icon button through the
  header's `conversation.session.header.utilities` slot
  (`id: liquid-glass-fullscreen`): click to request document fullscreen, click again to leave,
  with the icon following `fullscreenchange`. Because the app is fullscreen-aware (the preload
  mirrors the OS state onto `<html data-fullscreen>`), its layout adapts on entry. Implemented
  as a slot-registered React component (reclaimed by the fiber) — no DOM injection.

#### Fixed
- **Compatibility gate refused to load the plugin**: the five `@deepseek-ai/dsh-client-*`
  `peerDependencies` ranges are widened from `^0.1.x-rc.*` to
  **`^0.1.2-rc.1 || ^0.2.0-0`**. DSH validates a plugin manifest against a
  **single runtime version** (with no `engines.dsh`, every `@deepseek-ai/dsh` and
  `@deepseek-ai/dsh-*` peer range must match), and `^0.1.x` tops out below `0.2.0`,
  so all five were unmet on 0.2.1-rc.2: the install was rejected
  (`nothing was installed`) and a force-installed copy was disabled/skipped at startup.
  The new ranges satisfy both the 0.1.x and 0.2.x runtimes.
- **User message bubbles lost their glass on the desktop build**: harness ≥0.2 no longer
  emits `data-time-hover-root`, so three bubble rules could never match. The bubble
  anchor is now the dual selector
  `[data-time-hover-root] [class*="_bubble"], [data-conversation-scroll] [class*="_bubble"]`
  (the first arm serves 0.1.x, the second the 0.2.x scroll container).
  `test/client.smoke.mjs` now asserts both arms separately.
- **The session bar at the top had no gradient transparency or blur** (the `<header>`
  carrying the conversation name): on harness ≥0.2 the mark-up is
  `div[data-phase] > [data-slot="conversation.header"] > header`, but the old selectors had
  the nesting **inverted** (`[data-slot="conversation.session.header"] > header`) and
  `[data-phase]` on the **wrong element** (the div holding the scroll container carries
  `data-content-phase`), so the two rules behind "float over the message list, strong blur at
  the top fading to transparent" **never applied**. Every header rule was also gated on
  `header:has([role="tablist"])`, which only renders when `tabs.length > 1`, so a single-view
  session got no glass at all. Every rule now carries a **dual anchor** (legacy
  `header:has([role="tablist"])` plus `[data-slot="conversation.header"] > header`), and a new
  absolute-positioning rule for `[data-phase="active"] > [data-slot="conversation.header"] > header`
  makes the transcript really scroll under the bar (the stock `.root` is already
  `position: relative`, so no extra containing block is needed).
- **Removed the model-selection list restyle** (look and behaviour): the full-screen frosted
  picker, the provider-group two-column grid, the hover/selected styling, and the
  `MutationObserver` that auto-skipped the "Model / Effort" root pane and closed on backdrop
  click are all gone — other theme plugins style the same menu and the two fought each other.
  The list now keeps the harness's stock appearance and interaction; the composer's
  **access-mode dropdown** is a different `[role="menu"]` and keeps its glass.
- **Scoped the hover highlight**: one blanket
  `button / a / [role="button"] / [role="tab"] / [role="menuitem"] / [role="link"]` hover rule
  (with `transform: translateY(-1px)`) reached into other plugins' controls. It now covers only
  the surfaces this theme restyles: the composer card, the queue dock, dialogs/menus, the view
  tabs and the sidebar.
- **White seam between the session bar and the chat**: the stock header paints its hairline as a
  **real `border-bottom`** (`.5px solid var(--dsw-alias-border-l3)`, which this theme turns
  near-white) while the theme only hid an `::after` pseudo — a 0.1.x detail that does not exist
  on 0.2.x — so the floating bar left that border lying across the transcript. Both anchor arms
  now set `border-bottom: none` explicitly.
- **Three knock-on defects from merging the bar into the caption band (desktop)**:
  - **The sidebar's collapse/expand control escaped into the sidebar** (next to the logo, top
    right of the new-session button). The lens rule that gives sidebar buttons a glass pseudo
    needs `position: relative` (specificity (0,5,2)), which outranked the harness rule pinning
    this WINDOW control at `position: fixed; left: 12px; z-index: 30` ((0,2,0)), dropping it back
    into the sidebar's flow. The desktop block now restores its `position` through
    `button[class*="_iconButton"][class*="_toggle"]` (both classes required, so tree toggles are
    untouched). The control carries no lens anyway — another rule hides the `::before` of
    icon-only buttons — so restoring the positioning costs nothing.
  - **In non-fullscreen, the caption band's "open sidebar" and "new session" buttons stopped
    responding.** The merged bar's BOX spanned the full width and only padded its content away,
    so it still covered the left-hand window controls (12–40px / 48–76px) — and being a drag
    region, it swallowed their clicks. The clearance is now a left OFFSET
    (`left: calc(var(--dsh-windows-menu-start, 48px) + 134px)`, about 182px) instead of padding,
    so the controls are no longer inside the bar's box at all.
  - **The right-side expand control overlapped the native minimize button** by a few pixels. The
    stock rule pulls the right-most header control 16px to the right with a negative margin,
    which ate the clearance this theme reserves. The desktop block zeroes that margin and raises
    the right clearance from 140px to 148px (3 x 46px of native buttons plus a small gap).
  Along the way the caption frost was **collapsed into a single layer**: the desktop block turns
  the bar's own `::before` off and leaves the frost to the frame's 40px band, whose mask is
  aligned to the same shape (0 -> 30% -> 100%), removing the double blur and the seam.
- **Poor readability of subtitles and grey text in light mode**: the harness greys are tuned for
  an **opaque white canvas** (`--dsw-alias-label-secondary` = `#61666b`, `-tertiary` =
  `#81858c`, `-caption` = `#adb2b8` — the last only about 2.1:1 on white), and this theme paints
  translucent panels over a wallpaper, which eats further into that contrast. The theme now
  overrides the **light values** of those three tokens, one to two shades darker
  (`#2c2c2e` / `#43454a` / `#61666b`); dark mode still resolves the harness
  `--dsw-static-neutral-bluish-*` statics and is left unchanged. `--dsw-alias-label-dimmed`
  only styles disabled inputs, where faint is intentional, so it stays as is.
- **Several floating surfaces read as transparent** (backdrop blur + a glass fill added):
  - **The choice dialog** (the question / plan-review panels from
    `dsh-client-ui-user-questions`): its fill comes from `--dsw-specific-input-major`, which this
    theme sets to `glass(0.35)`, and the UI carries **no `role="dialog"`** (only `group` /
    `start` / `status`), so the theme's `[role="dialog"][aria-labelledby]` rule never matched it —
    no blur either. That token is shared with the composer input, so the fix is scoped to these
    two cards (`[data-question-key]` / `[data-plan-review-key]`).
  - **The hover preview in the edited-files card**: the surface is the primitives HoverCard card
    (`Gn.card` + `Gn.preview`), whose own fill is
    `background: var(--dsw-alias-bg-layer-1)` — a token this theme sets to `glass(0.55)`, so it
    is half-transparent rather than unfilled. Its class is a build-time hash and its positioning
    is inline, so the rule targets **the element that directly wraps the stable
    `[data-changes-hover-preview]` attribute** (verified in the primitives bundle: the preview
    content is that card's direct child) and relies on the `body.dsh-lg-on` prefix to outrank the
    module rule. That surface already has its own radius, shadow and zero padding, so only the
    fill and blur are added — the inner element is left alone, since filling both would stack
    into an opaque panel.
  - **Two more alongside**: the edited-files card itself (`--dsw-alias-bg-layer-1` = 0.55) and
    the question/answer receipt bubble in the transcript (`--dsw-specific-bubble` = 0.5).
  Panels use 78% and the hover preview 84%, all driven by `--dsh-lg-tint` / `--dsh-lg-blur` so the
  settings sliders apply, with a `--dsh-lg-tint-dark` counterpart for dark mode. The two panels
  also get a 1px hairline so their edge reads.

#### Changed
- **Header collapsed to one row**: the stock header stacks the 对话/轨迹 tabs on a **second row**
  under the title (76px in total). It is now a single flex row — sidebar toggle, conversation
  title (taking the free space), then the tab buttons, the **"open in…" dropdown at the top
  right**, and the right-sidebar toggle — 48px tall, and the scroll area reserves 56px instead
  of 88px. To seat the tabs LEFT of that dropdown the title row is dissolved with
  `display: contents` (its children become flex items of the header) and reordered with `order`
  (title cluster 1 / tabs 2 / utilities 3 / corner 4 / fullscreen 5); the row's stock
  `padding-inline-start` (the floating leading-seat clearance) **moved onto the title cluster**
  so its behaviour is preserved. Verified that no harness `@container` query depends on the
  title row's box.
- **View tabs lost the oversized capsule**: the `border-radius: 999px` pill and the per-tab
  `::before` glass lens (with edge refraction) are gone, replaced by 6px-rounded small buttons
  whose hover/selected states use the same subtle tint as the rest of the chrome; the stock
  underline indicator stays hidden.
- **The Windows caption gets the same gradient frost**: on the desktop build the topmost 40px
  caption is a `::before` on the layout frame (the frameless window's drag band, filled from
  `--dsw-specific-sidebar-fill`); it now carries a top-down blur + mask instead of a flat
  translucent band.
- **The session bar now merges into the system title bar (desktop)**: it used to occupy a row of
  its own inside the centre column (48px). It now leaves the column and becomes a **window-level
  strip** seated in the topmost 40px caption band, on the same line as the app menubar
  ("应用菜单 / 编辑") and the native window buttons — which is where the 48px saving comes from;
  the transcript reserves 40px instead of 56px. The approach mirrors the harness's own window
  chrome (its sidebar toggle is `position: fixed; top: 6px; left: 12px` inside that very band):
  - the left clearance follows `--dsh-windows-menu-start`, which the harness itself moves from
    48px to 84px when the sidebar collapses;
  - the right clearance uses the Window Controls Overlay `env(titlebar-area-width)`, falling back
    to 140px (the three Windows 11 buttons) when it does not resolve;
  - the bar declares `-webkit-app-region: drag` to claim the drag region it now covers (on Windows
    the harness's `[data-window-drag]{-webkit-app-region:drag}` is macOS-only), and hands it back
    with `no-drag` for everything interactive;
  - in fullscreen (`[data-fullscreen]`) the native buttons are gone, so the right clearance
    collapses to zero — the same state in which the harness zeroes `--dsh-frame-chrome-top`.

#### Notes
- The desktop build's profile is named `desktop` (not `web`) and is initialized by the
  desktop app on first launch; quit the app completely and then run
  `dsh plugin --profile desktop add …`, which pre-checks compatibility and reconciles the
  plugin into `dsh.profile.bundles` automatically.
- `engines.dsh` is intentionally left unset: declaring it would decide **alone** and a narrow
  range would wrongly exclude 0.1.x hosts.

#### Docs
- **Full README rewrite (both languages)**, from developer notes to a reader-facing document:
  - the **dark-mode recommendation** now opens the page (light mode leaves the glass washed out
    and the text grey — a design premise, not a bug);
  - screenshots moved to the top, and the feature list regrouped into *desktop-only / the glass
    itself / the wallpaper / everything else*, leading with what you actually get (the caption
    bar merged with the session header, the fullscreen button, edge refraction, six wallpaper
    sources, every tunable) before any implementation detail;
  - two **now-false** claims removed ("redesigned model selector", "view-tab edge refraction") —
    both were changed or dropped in 0.5.0, and the storefront review checks every claim against
    the code, so a stale one gets the submission sent back;
  - images switched to **absolute `raw.githubusercontent.com` URLs** so they also render on the
    npm package page (relative paths 404 there) while still satisfying the storefront rule that
    screenshots must be GitHub-hosted https links;
  - added a *Compatibility and deliberate choices* table (model list left to the harness, hover
    scope, settings in localStorage, and so on).
- `package.json` `description` rewritten to match (no stale or marketing wording) and `keywords`
  extended with `deepseek-harness-desktop` / `dsh-theme` / `frosted-glass` / `desktop`;
  `screenshots.json` gained `screenshot-input.png` (the storefront detail gallery takes 1–8).

---

## [0.4.2] - 2026-09-05

### 中文

#### 文档
- 在 `README.md` 与 `README.zh.md` 顶部加入**中英文互跳链接**
  （英文版顶部「简体中文」→ `README.zh.md`，中文版顶部「English」→ `README.md`），
  便于在 GitHub 渲染的仓库页之间切换语言。

### English

#### Docs
- Added **cross-language switch links** at the top of `README.md` and
  `README.zh.md` (「简体中文」→ `README.zh.md` in the English file, and
  `English` → `README.md` in the Chinese file) so readers can switch languages
  on GitHub-rendered pages.

---

## [0.4.1] - 2026-09-05

### 中文

#### 文档
- 重写 `README.md` / `README.zh.md`：按「功能特性 / 目录结构 / 安装 / 构建 /
  客户端注入 / 持久化 / 设置项参考 / 首次启动 / 预览」结构化组织，中英双语对称；
  补充兼容性说明（需要 harness ≥ `0.1.2-rc.1`）、并把本地开发链接一节改写成
  Windows junction 的正确姿势（直接 `dsh plugin add "<绝对路径>"` 会生成坏相对
  符号链接并把该插件从 profile bundles 列表移除）。

### English

#### Docs
- Rewrote `README.md` / `README.zh.md` with a structured layout (Features /
  Structure / Install / Build / Client Injection / Persistence / Settings
  Reference / First Launch / Screenshots), kept the bilingual content symmetric,
  added the compatibility note (requires harness ≥ `0.1.2-rc.1`), and rewrote the
  local-development section to use a Windows junction (a plain
  `dsh plugin add "<absolute-path>"` creates a broken relative symlink and drops
  the plugin from the profile `bundles` list).

---

## [0.4.0] - 2026-09-05

### 中文

#### 修复
- **适配 DeepSeek Harness `0.1.2-rc.1` 的客户端包拆分**，解决插件在升级后无法加载、
  启动时抛 `client-modules: require("@deepseek-ai/dsh-client-runtime/client") missed the module table` 的故障。
  harness 0.1.2-rc.1 把旧 `@deepseek-ai/dsh-client-runtime` 的 store 部分拆分为独立包
  **`@deepseek-ai/dsh-client-store`**（并成为新的浏览器端 seed 词），旧包不再存在于平台。
  本版本将 store 相关导入全部迁移至新包，并把 `dsh.client.inject` 声明同步更新，
  插件重新可被 harness 0.1.2-rc.1（及同一条发布线）在启动时正常解析与加载。
- **`@deepseek-ai/schemastery` 从 `3.18.1` 升级到 `^3.18.2`**，消除与 harness 拉取的
  `3.18.2` 产生的双副本，修复声明文件生成（`tsc -p tsconfig.types.json`）报 TS2742 的问题。

#### 变更
- 浏览器端 `apply` 的上下文类型来源从 `@deepseek-ai/dsh-client-runtime/client` 迁移到
  `@deepseek-ai/cordis` 的 `Context`（与 harness 0.1.2-rc.1 各内置客户端插件的约定一致）。

### English

#### Fixed
- **Adapted to the client package split in DeepSeek Harness `0.1.2-rc.1`**, resolving the
  plugin failing to load after the upgrade with
  `client-modules: require("@deepseek-ai/dsh-client-runtime/client") missed the module table`
  at startup. Harness 0.1.2-rc.1 split the store part of the old
  `@deepseek-ai/dsh-client-runtime` into the standalone package
  **`@deepseek-ai/dsh-client-store`** (now a platform seed word); the old package no longer
  exists on the platform. This release migrates all store-related imports to the new package
  and updates the `dsh.client.inject` declaration so the plugin resolves and loads correctly
  again at startup under harness 0.1.2-rc.1 (and releases on the same line).
- **Upgraded `@deepseek-ai/schemastery` from `3.18.1` to `^3.18.2`**, removing the duplicate
  copy created alongside the harness-pulled `3.18.2` and fixing a TS2742 during declaration
  emission (`tsc -p tsconfig.types.json`).

#### Changed
- The browser half's `apply` context type now comes from `Context` in
  `@deepseek-ai/cordis` instead of `@deepseek-ai/dsh-client-runtime/client`, matching the
  convention used by the built-in client plugins in harness 0.1.2-rc.1.

---

## [0.3.1] - 2026-08-xx

### 中文
- 更新包描述，突出 SVG 边缘折射、动态壁纸、背景模糊/亮度、模型选择器、玻璃按钮与水滴图标。

### English
- Updated the package description to highlight SVG edge refraction, dynamic wallpaper,
  background blur/brightness, the model selector, glass buttons, and the water-drop icon.

---

## [0.3.0] - 2026-08-xx

### 中文
- 引入 SVG feDisplacementMap 边缘折射效果（输入卡片、发送按钮、消息气泡、视图标签、队列坞、侧边栏按钮）。
- 新增独立背景模糊与亮度控制。
- 新增内置可自定义动画色块壁纸（demo.html，参数驱动）。
- 重新设计全屏毛玻璃模型选择器。
- 全界面玻璃透镜质感按钮。
- 新增专属水滴设置图标。

### English
- Introduced SVG feDisplacementMap edge refraction on the input card, send button, message
  bubbles, view tabs, queue dock, and sidebar buttons.
- Added independent background blur and brightness controls.
- Added a built-in customizable animated color-blob wallpaper (demo.html, parameter-driven).
- Redesigned the full-screen frosted-glass model selector.
- Glass-lens material across action buttons in the UI.
- Added a dedicated water-drop settings icon.

---

[0.4.2]: https://github.com/FAVKTOXIC/dsh-theme-liquid-glass/releases/tag/v0.4.2
[0.4.1]: https://github.com/FAVKTOXIC/dsh-theme-liquid-glass/releases/tag/v0.4.1
[0.4.0]: https://github.com/FAVKTOXIC/dsh-theme-liquid-glass/releases/tag/v0.4.0
[0.3.1]: https://github.com/FAVKTOXIC/dsh-theme-liquid-glass/releases/tag/v0.3.1
[0.3.0]: https://github.com/FAVKTOXIC/dsh-theme-liquid-glass/releases/tag/v0.3.0