# Liquid Glass — DeepSeek Harness 主题

[README.md](README.md) · **简体中文**

把 DeepSeek Harness 的界面整体换成磨砂玻璃：你真正会去点的控件带有**真实的 SVG 边缘折射**，
壁纸可以自己选，而**顶部会话栏直接住进系统标题栏**，不再单独占掉一行。

![新会话页 + 内置动态壁纸](https://raw.githubusercontent.com/FAVKTOXIC/dsh-theme-liquid-glass/main/assets/screenshots/screenshot-1.png)

---

> ## ⚠️ 请尽量使用**深色模式**
>
> 这个主题是为深色模式设计的，也只有深色模式下观感是对的。它的核心是**半透明玻璃叠在壁纸上** ——
> 在**浅色模式**下，明亮的壁纸会让玻璃发白、上面的文字发灰难读。
>
> 主题已经把浅色模式的次级 / 三级灰阶压深来挽回一些对比度，但那是缓解、不是解决。
> **如果你用浅色模式，请预期可读性会变差**；把 DSH 切到深色模式即可彻底解决。

---

## 你会得到什么

### 桌面版专属

- **顶部会话栏就是标题栏。** DSH 自己的顶栏把「对话 / 轨迹」放在第二行，整条 76px 高。
  主题把整条栏搬进 40px 的系统标题栏 —— 和「应用菜单 / 编辑」以及窗口按钮同一行 ——
  并压成单行。**那 48px 垂直空间就还给你了**：消息区从离顶 40px 开始而不是 56px；
  标签也从过大的玻璃胶囊改成小圆角按钮。
- **全屏按钮。** DSH 桌面版**完全没有**全屏入口 —— 无边框标题栏只有最小化 / 最大化 / 关闭，
  没有注册 F11 或 `togglefullscreen`，主进程也从不调用 `setFullScreen(true)`。
  主题在顶栏补了一个 28px 按钮，点击请求整页全屏、再点退出，图标随状态切换；
  之后 DSH 自己的全屏适配会接管布局。
- **系统标题栏那条也做成了渐变磨砂**（顶部强模糊、向下渐隐），不再是平铺的半透明色带。
- **原来透明的浮层补上了底色**：选择对话框（DSH 让你做选择时弹出的那个面板）、
  「已编辑 N 个文件」卡片里鼠标悬浮时的文件预览、该卡片本身、
  以及对话流里的一问一答回执气泡 —— 各自补上模糊 + 可读浓度的玻璃底色。
- **浅色模式文字更可读**（在上方提醒的限度内）：次级 / 三级 / 说明文字的灰阶各压深一到两档。

### 玻璃本身

- **真实边缘折射，不只是模糊。** 用 `feDisplacementMap` 在表面边缘弯折背后的画面，
  和厚玻璃一样。作用在输入卡片、发送按钮、消息气泡、队列坞、对话框、菜单和侧边栏按钮上。
  **强度是一个滑块** —— 0 关掉，1 是完整透镜。
- **所有玻璃参数都归你调**：玻璃色调、色调不透明度、玻璃材质亮度、磨砂模糊半径、
  边缘折射强度、代码块不透明度。全部**实时生效**，不用刷新、不用重启。
- **玻璃透镜按钮**，以及取代原版齿轮的**水滴设置图标**。

### 壁纸

- **六种来源**：不设、网页链接（iframe，可选走宿主代理以绕过 `X-Frame-Options`）、
  本地 HTML、本地图片、本地视频，或者**开箱即用的内置动态演示壁纸**。
- **背景独立可调**：壁纸模糊与壁纸亮度**独立于**卡片的磨砂，所以背景可以柔、玻璃可以利。
- **演示壁纸可调**：速度、色块数量、颜色变化、色块模糊、不透明度，外加背景渐变铺色开关。

### 其它

- **单行顶栏**（网页版同样生效）：侧栏开关 → 会话标题 → 标签 → 「打开方式」下拉 →
  右侧栏开关，全在一行。
- **不跟别的插件抢样式。** 模型选择列表**保持 DSH 原版**（早期版本改造过它，
  结果和其他主题插件互相覆盖），悬停高亮也刻意只作用于本主题真正改过的表面。
- **独立设置页**：Settings → **Liquid Glass**（与「通用设置 / 模型 / 插件」并列），
  实时预览、一键恢复默认。
- **干净的总开关**：所有视觉都挂在一个 class 上，关闭时一次性撤掉全部 token 覆盖、
  移除壁纸、关掉所有磨砂与透镜规则，不留残留。

---

## 截图

| | |
|---|---|
| ![新会话页](https://raw.githubusercontent.com/FAVKTOXIC/dsh-theme-liquid-glass/main/assets/screenshots/screenshot-1.png) | ![输入卡片边缘折射](https://raw.githubusercontent.com/FAVKTOXIC/dsh-theme-liquid-glass/main/assets/screenshots/screenshot-input.png) |
| 新会话页 + 内置动态壁纸 | 输入卡片的边缘折射特写 |
| ![对话界面](https://raw.githubusercontent.com/FAVKTOXIC/dsh-theme-liquid-glass/main/assets/screenshots/screenshot-chat.png) | ![设置页](https://raw.githubusercontent.com/FAVKTOXIC/dsh-theme-liquid-glass/main/assets/screenshots/screenshot-settings.png) |
| 玻璃气泡的对话 + 合并后的顶部栏 | Liquid Glass 设置页 |

---

## 安装

### 桌面版

桌面版用的是自己的 profile，名字是 `desktop`，由桌面应用首次启动时创建，
所以**安装前需要完全退出桌面版**：

```powershell
dsh plugin --profile desktop add dsh-theme-liquid-glass
```

然后再启动应用。

### 网页版

```bash
dsh plugin add --profile web dsh-theme-liquid-glass
```

然后刷新浏览器。

> **兼容性** —— 需要 DeepSeek Harness **≥ `0.1.2-rc.1`**，并支持 **0.2.x** 运行时
> （桌面版用的就是它）。网页版与桌面版共用同一份客户端产物：上面所有功能两边都有，
> 仅桌面版生效的已单独标注。低于 `0.1.2-rc.1` 的版本不支持。

### 从源码安装

```bash
git clone https://github.com/FAVKTOXIC/dsh-theme-liquid-glass
cd dsh-theme-liquid-glass
npm install
npm run build
```

再把目录链进 profile。Windows 上请用 junction —— 直接用
`dsh plugin add "<绝对路径>"` 可能生成坏的相对符号链接，并把插件从 profile 的
`bundles` 列表里丢掉：

```powershell
dsh plugin remove --profile web dsh-theme-liquid-glass
New-Item -ItemType Junction -Path "$env:USERPROFILE\.dsh\profiles\web\node_modules\dsh-theme-liquid-glass" `
  -Target "<主题源码的绝对路径>" -Force
dsh plugin add --profile web dsh-theme-liquid-glass
```

---

## 设置项

**Liquid Glass** 页（Settings → Liquid Glass）分两组：*页面背景* 与 *输入卡片 · 磨砂玻璃*。

| 设置 | 作用 | 范围 |
| --- | --- | --- |
| `enabled` | 总开关 —— 关闭即撤掉所有视觉改动 | 开 / 关 |
| `wallpaper.kind` | 壁纸来源 | `none` / `url` / `html` / `image` / `video` / `local` |
| `wallpaper.value` | 链接，或相对于壁纸目录的路径 | 文本 |
| `wallpaper.proxy` | 让网页链接走宿主代理（绕过 `X-Frame-Options`） | 开 / 关 |
| `wallpaper.muted` | 视频壁纸静音（自动播放策略会拦未静音） | 开 / 关 |
| `demo.speed` | 演示壁纸动画速度 | 0.1 – 4 |
| `demo.blobs` | 演示壁纸色块数量 | 1 – 6 |
| `demo.colorCycle` | 演示壁纸颜色变化（0 = 静止） | 0 – 10 |
| `demo.blur` | 演示壁纸色块模糊 | 10 – 140px |
| `demo.opacity` | 演示壁纸色块不透明度 | 0.2 – 1 |
| `demo.wash` | 演示壁纸背景渐变铺色 | 开 / 关 |
| `glass.frosted` | 卡片 / 气泡 / 队列坞的磨砂（backdrop blur） | 开 / 关 |
| `glass.blur` | 磨砂模糊半径 | 0 – 60px |
| `glass.bgBlur` | 壁纸模糊，独立于卡片磨砂 | 0 – 60px |
| `glass.refraction` | 边缘折射强度 | 0 – 1 |
| `glass.tint` | 玻璃色调 | 十六进制色值 |
| `glass.tintOpacity` | 玻璃色调不透明度 | 0 – 1 |
| `glass.glassBrightness` | 色调的材质亮度 | 0.2 – 1.6 |
| `glass.brightness` | 壁纸亮度 | 0.2 – 1.6 |
| `glass.codeBlockOpacity` | 代码块底色不透明度，独立于色调 | 0.2 – 1 |
| `glass.toolTextColor` | 工具调用文字颜色（留空 = 默认） | 十六进制色值 |

设置存在 `localStorage` 的 `dsh-liquid-glass.settings` 下，因此是**按浏览器**的 ——
换浏览器或清掉站点数据就会回到默认值。原因见下方「为什么用 localStorage」。

---

## 兼容性与刻意的取舍

| | |
| --- | --- |
| Harness | `≥ 0.1.2-rc.1`，含 `0.2.x` 桌面版运行时 |
| 生效范围 | 网页版与桌面版（同一份客户端产物） |
| peer 依赖 | 五个 `@deepseek-ai/dsh-client-*`，声明为**可选** peer，范围 `^0.1.2-rc.1 \|\| ^0.2.0-0` |
| 模型选择列表 | **交还 DSH**。早期版本改造过它，但其他主题插件也改同一个菜单、双方互相覆盖，因此撤回 |
| 悬停样式 | 只作用于输入卡片、队列坞、对话框 / 菜单、视图标签、侧边栏 —— 不会去改别的插件的控件 |
| 浅色模式 | 可用，但玻璃会发白 —— 见页首提醒 |
| 设置存储 | `localStorage`（按浏览器） |

---

## 开发

```bash
npm install
npm run build      # 一次性构建 → lib/index.js + lib/client.js
npm run watch      # 监听模式（配合 client HMR）
npm run dev        # 构建 + smoke test
npm test           # 客户端 smoke test
npm run typecheck  # tsc --noEmit
```

```
src/index.ts           宿主半：壁纸文件路由、上传端点、网页代理
src/client/index.tsx   客户端半：token 覆盖、背景层、玻璃参数、设置面板
src/shared.ts          共享设置类型与常量（无运行时依赖）
build.mjs              SWC 构建流水线 → loader 格式产物
test/client.smoke.mjs  smoke test：DOM + CSS + 注册断言
```

### 读源码前值得知道的几件事

- **磨砂绝不用 `#root` 上的 `backdrop-filter`。** 非 `none` 的 `backdrop-filter` 会让该元素
  成为所有 `position: fixed` 后代的包含块，菜单、弹层、toast 都会被重新锚定。
  因此磨砂要么走独立的背景层，要么走 `::before` 伪元素。
- **整个样式表是一个模板字符串。** 所有规则都在 `src/client/index.tsx` 的
  `const SHEET = ...` 里，CSS 注释里混进一个反引号就会提前结束模板；`build.mjs` 里有守卫。
- **选择器锚在 harness 自己的稳定属性上** —— `data-slot`、`role`、`data-conversation-scroll`
  之类；CSS Module 的类名是构建期哈希，只用逻辑后缀匹配（`[class*="_bubble"]`），从不写全名。
- **凡是 harness 在 0.1.x 与 0.2.x 之间改过结构的地方，规则都带双锚点**
  （例如会话顶栏、消息气泡），所以一份产物同时服务两个运行时。

### 为什么用 localStorage

harness 的设置网关只对浏览器端开放硬编码的产品命名空间，第三方命名空间即使宿主半注册了
也会永远停在 `loading`。官方自带的 appearance / skin 插件撞的是同一堵墙，也都用了
`localStorage`。代价是设置不会跟着你在浏览器之间走。

---

## 许可

[MIT](LICENSE)
