# dsh-theme-liquid-glass

**DeepSeek Harness Web UI 的纯正液态玻璃主题。**

<p align="center">
  <strong>
    <a href="./README.md">English</a>
  </strong>
</p>

一套完整的磨砂玻璃皮肤：SVG 边缘折射、可自定义的动态壁纸、玻璃透镜质感按钮、
重新设计的全屏模型选择器，以及专属的水滴设置图标。

> **v0.4.2** — 需要 **DeepSeek Harness ≥ `0.1.2-rc.1`**。本版本适配 harness 的客户端包拆分：
> 已被移除的 `@deepseek-ai/dsh-client-runtime` 的 store 部分迁移到了
> `@deepseek-ai/dsh-client-store`。详见 [CHANGELOG.md](CHANGELOG.md)。

---

## 功能特性

### 液态玻璃界面
- **SVG 边缘折射** · 通过 `feDisplacementMap` 在输入卡片、发送按钮、消息气泡、
  视图标签、队列坞、侧边栏按钮上实现边缘折射效果。强度可通过滑块调节。
- **磨砂玻璃质感** · 用 token 覆盖（`ctx.theme.overrideTokens`）把 `--dsw-alias-*`
  语义 token 替换为半透明玻璃质感值。玻璃参数由 `body` 上的 `--dsh-lg-*` 自定义
  属性驱动，改动即时生效。
- **玻璃透镜按钮** · 发送、视图标签、侧边栏操作、命令 `(+)` 按钮全部采用玻璃
  材质 + 边缘折射。
- **水滴设置图标** · 设置导航中的齿轮被水滴图标取代，一眼可辨。
- **悬浮高亮** · 所有可交互元素在悬停时呈现细微光晕与抬起效果。

### 壁纸与背景
- **自定义背景模糊与亮度** · 独立控制壁纸模糊（`bgBlur`）与亮度（`brightness`），
  让背景在玻璃之下呈现最佳效果。
- **内置动态演示壁纸** · 开箱即用的色块壁纸，可通过速度、色块数量、颜色变化、
  模糊、透明度调节。
- **多种壁纸来源** · 网页链接（iframe，可选 host 代理）、本地 HTML、本地图片、
  本地视频。

### 模型选择器
- **重新设计的模型选择器** · 全屏毛玻璃选择器，provider 分组网格布局 + 悬停
  高亮——跳过中间根面板，直达模型列表。

### 设置页
- 独立的顶层 **「液态玻璃」** 页面（`settings.section`，与 通用设置 / 模型 /
  插件 并列），分「页面背景」「输入卡片 · 磨砂玻璃」两组。所有改动实时生效，
  「恢复默认」一键还原。
- **一键关闭** · 主开关会同时撤掉全部 token 覆盖、移除壁纸、关闭所有磨砂/透镜
  规则——所有视觉都挂在 `body.dsh-lg-on` 门控 class 上，关闭即零残留。

### 实现要点
- 磨砂用 `filter: blur()` 打在独立背景层上（`inset: -48px` 留出出血），**绝不**
  用 `#root` 上的 `backdrop-filter`——非 none 的 backdrop-filter 会让 `#root`
  成为所有 `position: fixed` 后代的包含块（菜单、弹层、toast 会被重新锚定）。

---

## 目录结构

```
src/index.ts          host 半区：壁纸文件路由 + 文件上传 + 网页代理
src/client/index.ts   browser 半区：token 层 + 背景图层 + 玻璃参数 + 设置页
src/shared.ts         常量与设置类型（无运行时依赖）
build.mjs             swc 构建（lib/index.js + lib/client.js 加载器格式）
```

---

## 安装到 web profile

### 方式一：从 npm 安装（推荐）

```bash
dsh plugin add --profile web dsh-theme-liquid-glass
```

刷新浏览器即可生效。

> **兼容性**：需要 DeepSeek Harness **≥ `0.1.2-rc.1`**。更早的 harness 版本使用
> 已移除的 `dsh-client-runtime` 包，v0.4.0 不再支持。

### 方式二：本地开发链接

用 **Windows junction** 把源码目录链接进 profile 的 `node_modules`
（直接 `dsh plugin add "<绝对路径>"` 可能生成坏相对符号链接，并把该插件从
profile 的 `bundles` 列表里移除）：

```powershell
# 1) 移除残留条目
dsh plugin remove --profile web dsh-theme-liquid-glass

# 2) 用 junction 指向源码目录
New-Item -ItemType Junction -Path "$env:USERPROFILE\.dsh\profiles\web\node_modules\dsh-theme-liquid-glass" `
  -Target "<源码目录绝对路径>" -Force

# 3) 确保主题出现在 profile bundles
dsh plugin add --profile web dsh-theme-liquid-glass
```

刷新浏览器即可生效。

> **改代码后**：重新构建，然后刷新。
> ```bash
> cd <源码目录>
> node build.mjs
> ```
> **client 改动**（设置页 UI、玻璃参数）构建后刷新即可生效；
> **host 改动**（路由、上传端点）需要重启 `dsh web` 重新加载 host 半区。

---

## 构建

```bash
npm install
npm run build        # 一次性构建（lib/index.js + lib/client.js）
npm run watch        # watch 模式（配合 client-hmr 热替换）
npm run dev          # 构建 + 冒烟测试
npm test             # 运行客户端冒烟测试
npm run typecheck    # tsc --noEmit
```

---

## 客户端注入说明

client 半区必须导出 `inject` 数组（**服务名**）：`['slots','locale','theme']`
（与已发布的 dsh-ui-appearance / dsh-dream-skin 插件一致）。client loader 用
它构建 fiber 注入表，缺失会导致 `cannot get property X without inject` 并让
整个 web boot fail-loud。`apply()` 整体有 try/catch 兜底——运行时错误只降级，
不会把 GUI 带崩。

---

## 持久化说明（为什么用 localStorage）

设置保存在浏览器 `localStorage`（键 `dsh-liquid-glass.settings`），**不走**
settings RPC：harness 的 settings 网关只对浏览器客户端暴露**硬编码的产品
命名空间**，第三方命名空间即使 host 半区注册了也不会送达客户端 scope
（客户端会一直停在 `loading`）。已发布的 dsh-ui-appearance / dsh-dream-skin
插件都遇到同一堵墙，并都选择了 localStorage。

**代价**：设置跟随浏览器——换浏览器或清站点数据会丢失。

---

## 设置项参考

| 字段 | 说明 |
| --- | --- |
| `enabled` | 总开关 |
| `wallpaper.kind` | `none` / `url` / `html` / `image` / `video` / `local` |
| `wallpaper.value` | 网页链接或 wallpapers 目录下的相对路径 |
| `wallpaper.proxy` | 网页链接走 host 代理（绕过 X-Frame-Options） |
| `wallpaper.muted` | 视频壁纸静音（默认 true；取消静音可能被自动播放策略阻止） |
| `demo.speed` | demo.html 动画速度倍率 0.1–4（步进 0.1） |
| `demo.blobs` | demo.html 色块数量 1–6 |
| `demo.colorCycle` | demo.html 颜色变化 0–10（0=静态） |
| `demo.blur` | demo.html 色块模糊 10–140px |
| `demo.opacity` | demo.html 色块不透明度 0.2–1 |
| `demo.wash` | demo.html 背景渐变流动开关 |
| `glass.frosted` | 磨砂开关（输入卡片/气泡/队列坞 backdrop 模糊） |
| `glass.blur` | 输入卡片磨砂强度 0–60px |
| `glass.bgBlur` | 背景壁纸独立模糊 0–60px（与卡片磨砂解耦） |
| `glass.refraction` | 边缘折射 0–1 |
| `glass.tint` | 玻璃颜色 |
| `glass.tintOpacity` | 玻璃颜色不透明度 0–1 |
| `glass.toolTextColor` | 操作文字颜色（十六进制，空=默认） |
| `glass.codeBlockOpacity` | 代码块背景不透明度 0.2–1（独立于玻璃颜色不透明度） |
| `glass.glassBrightness` | 玻璃材质亮度 0.2–1.6（tint 明度缩放，>1 变亮 <1 变暗） |
| `glass.brightness` | 背景亮度 0.2–1.6 |

---

## 首次启动

插件首次启用时，会检查 `<DSH_HOME>/wallpapers` 下是否存在 `demo.html`。
若不存在，会自动写入内置默认演示壁纸（已有文件不会被覆盖）。默认路径为
`$DSH_HOME/wallpapers/demo.html`；壁纸目录可通过 `wallpaperDir` 配置项修改。

---

## 预览

![输入卡片边缘折射](assets/screenshots/screenshot-input.png)
![液态玻璃气泡聊天界面](assets/screenshots/screenshot-chat.png)
![设置面板](assets/screenshots/screenshot-settings.png)

---

## 许可证

[MIT](LICENSE)