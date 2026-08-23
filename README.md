# dsh-theme-liquid-glass

Apple Liquid Glass 主题插件 for DeepSeek Harness。

- **液态玻璃 UI**：通过 `ctx.theme.overrideTokens` 把 `--dsw-alias-*` 语义 token 覆盖为半透明玻璃质感（`{light, dark}` 两套值），
  玻璃参数由 body 上的 `--dsh-lg-*` CSS 变量驱动，改动即时生效。
- **动态壁纸**：支持 网页链接（iframe / 可选 host 代理）、本地 HTML（`<DSH_HOME>/wallpapers` 目录）、本地图片、本地视频。
- **可自定义玻璃**：磨砂开关、磨砂强度（px）、边缘折射强度、玻璃颜色、玻璃亮度。
- **毛玻璃实现**：`filter: blur()` 直接打在背景图层上（`inset: -48px` 留出模糊出血），**不用** `backdrop-filter`
  （backdrop-filter 会让 #root 成为所有 fixed 定位后代的包含块，菜单/弹层/toast 会被重新锚定到 #root）。
- **设置页**：设置 → 「液态玻璃」（与 通用设置 / 模型 / 插件 并列的独立顶层页，`settings.section` 槽位），
  分「页面背景」「输入卡片 · 磨砂玻璃」两组，实时生效；「恢复默认」一键还原。
- **完全关闭**：「启用液态玻璃」开关会同时撤掉 token 层、壁纸与**全部**毛玻璃/透镜边缘规则
  （效果规则全部挂在 `body.dsh-lg-on` 门控 class 上，关闭即整体失效，不残留高光）。
- **本地文件选择**：壁纸类型选 本地 HTML / 图片 / 视频 / 本地文件 时，点击输入框直接拉起系统文件选择器；
  选中后经 `POST /liquid-glass/upload` 上传到壁纸目录（文件名 `lg-<时间戳>-<原文件名>`），再通过
  `/liquid-glass/wallpaper/<文件名>` 生效。

## 结构

```
src/index.ts          host 半区：壁纸文件路由 + 文件上传 + 网页代理
src/client/index.ts   browser 半区：token 层 + 背景图层 + 玻璃参数 + 设置页
src/shared.ts         常量与设置类型（无运行时依赖）
build.mjs             swc 构建（lib/index.js + lib/client.js 加载器格式）
```

## 构建

```bash
npm install
npm run build        # 一次性构建
npm run watch        # watch 模式（配合 client-hmr 热替换）
npm run dev          # 构建 + 冒烟测试
```

## 安装到 web profile

```bash
dsh plugin --profile web add file:D:\deepseekharness test work space\dsh-theme-liquid-glass
```

然后在 `%DSH_HOME%\profiles\web\cordis.patch.yml` 插入：

```yaml
- insert:
    - id: liquid-glass
      name: dsh-theme-liquid-glass
```

刷新浏览器即可生效。

> **改代码后的重装**：`pnpm add` 会把构建产物**拷贝**进 profile，所以每次改代码后要
> 重新执行一次（client-hmr 检测到 bundle 变化会自动热替换，无需刷新页面）：
> ```bash
> pnpm --dir "%DSH_HOME%\profiles\web" add "file:D:\deepseekharness test work space\dsh-theme-liquid-glass" --ignore-scripts
> ```
> **新增/删除插件条目**（cordis.patch.yml）则必须重启 `dsh web`。

> **client 注入要点**：client 半区必须在 bundle 里导出 `inject`（**服务名**数组：
> `['slots','locale','theme']`，与已发布的 dsh-ui-appearance / dsh-dream-skin 一致）。
> client loader 用它构建 fiber 注入表，缺失会导致 `cannot get property X without inject` 并让
> 整个 web boot fail-loud。apply 整体有 try/catch 兜底，运行时错误只降级、不会再把 GUI 带崩。

## 持久化说明（为什么用 localStorage）

设置保存在浏览器 localStorage（键 `dsh-liquid-glass.settings`），**不走 settings RPC**：
harness 的 settings 网关只对浏览器客户端暴露**硬编码的产品命名空间**，第三方命名空间即使
在 host 半区 `settings.register` 了也不会送达客户端 scope（客户端会永远停在 `loading`）。
已发布的 dsh-ui-appearance / dsh-dream-skin 插件都遇到同一堵墙并选择了 localStorage。
代价：设置跟随浏览器，换浏览器/清站点数据会丢失。

## 预览与迭代（本机已配置好）

安装与 patch 均已完成，插件已装入 `%DSH_HOME%\profiles\web`（profile 的
`node_modules\dsh-theme-liquid-glass` 是指向本目录的 junction，改完代码直接刷新即可）。

```bash
# 改代码后的迭代流程：
node build.mjs          # 一次性构建（junction 已就位，client-hmr 自动热替换）
node build.mjs --watch  # 或：监听 src/ 自动重建
```

> **client 改动**（设置页 UI、玻璃参数）构建后刷新即可生效；**host 改动**（路由/上传端点）
> 需要重启 `dsh web` 才会重新加载 host 半区（HMR 只热替换 client bundle，host 模块不在 watch 范围）。
> 重启前文件选择上传会 405（端点未注册），其余功能不受影响。

默认演示壁纸：`C:\Users\JANXT\.dsh\wallpapers\demo.html`（本地 HTML 动态壁纸）。
壁纸目录：`<DSH_HOME>/wallpapers`（可用插件配置 `wallpaperDir` 修改）。
**新用户首次启动**：若 demo.html 不存在，插件会自动写入内置默认演示壁纸（已有文件不会被覆盖）。

## 打包与上架

本插件已按官方 bundle 形态（`dsh.bundle.patch` + `cordis.patch.yml`）整理好，
`dsh plugin add` 会自动把 loader 条目写入 profile，用户**无需手动编辑补丁**。

### 1. 发布到 npm（用户最直接的安装渠道）

```bash
npm version patch          # 或 minor / major，先升版本号
npm run prepack            # = build + 类型声明 + 冒烟测试，全绿再发
npm publish                # 需要 npm 账号：npm adduser
```

用户安装（无需改任何 patch 文件）：

```bash
dsh plugin --profile web add dsh-theme-liquid-glass
# 重启 dsh web 生效（dsh web ≥ 0.1.0-rc.7，settings.section 需要 rc.7 的设置壳）
```

> 发版前把 `package.json` 里 `repository` / `homepage` / `bugs` 的
> `<your-name>` 占位换成你的 GitHub 仓库地址。

### 2. 上架插件市场（dshmarket，设置 → 插件市场）

市场列表来自精选目录 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)（
站点 https://awesome-dsh-plugin.com 每日由 CI 刷新 `plugins.json`）：

1. 先把包发布到 npm（市场按 npm 名安装，tarball 秒装）
2. 去 awesome-dsh-plugin 仓库提 PR，在列表加一条：插件名、npm 包名、仓库链接、描述
3. 收录后通常一天内出现在市场里，用户一键安装

> 要求 `dsh.bundle.patch` 声明 + 仓库链接与 npm 包一致（防冒名校验）；README 会被市场
> 自动抽取做详情页，截图可放 GitHub 图床。

### 3. 其它分发方式

```bash
# GitHub 直装（pnpm ≥10 需要按提示在 pnpm-workspace.yaml 放行构建脚本）
dsh plugin --profile web add git+https://github.com/<your-name>/dsh-theme-liquid-glass
# 或本地目录
dsh plugin --profile web add D:\path\to\dsh-theme-liquid-glass
```

### 发布清单

- [ ] `cordis.patch.yml` 存在且 `package.json` 声明 `dsh.bundle.patch`
- [ ] `files` 包含 `lib` / `cordis.patch.yml` / `README.md` / `LICENSE`
- [ ] `npm run prepack` 全绿（build + 类型声明 + 冒烟测试）
- [ ] `repository` / `homepage` 已填真实地址
- [ ] 版本号已升（发过的版本不可覆盖）
- [ ] host 路由（上传/代理）改动已随包发布——用户重启后生效

## 设置页（localStorage 持久化）

| 字段 | 说明 |
| --- | --- |
| `enabled` | 总开关 |
| `wallpaper.kind` | `none` / `url` / `html` / `image` / `video` / `local` |
| `wallpaper.value` | 网页链接或 `wallpapers` 目录下的相对路径 |
| `wallpaper.proxy` | 网页链接走 host 代理（绕过 X-Frame-Options） |
| `wallpaper.muted` | 视频壁纸静音（默认 true；取消后带声音，可能被浏览器阻止自动播放） |
| `demo.speed` | demo.html 动画速度倍率 0.1–4（步进 0.1） |
| `demo.blobs` | demo.html 色块数量 1–6 |
| `demo.colorCycle` | demo.html 颜色变化 0–10（0=静态） |
| `demo.blur` | demo.html 色块模糊 10–140px |
| `demo.opacity` | demo.html 色块不透明度 0.2–1 |
| `demo.wash` | demo.html 背景渐变流动开关 |
| `glass.frosted` | 磨砂开关（输入卡片/气泡/任务栏的 backdrop 模糊） |
| `glass.blur` | 输入卡片磨砂强度 0–60px |
| `glass.bgBlur` | 背景壁纸独立模糊 0–60px（与卡片磨砂解耦） |
| `glass.refraction` | 边缘折射 0–1 |
| `glass.tint` | 玻璃颜色 |
| `glass.tintOpacity` | 玻璃颜色不透明度 0–1 |
| `glass.toolTextColor` | 操作文字颜色（#RGB 十六进制，空=默认） |
| `glass.codeBlockOpacity` | 代码块背景不透明度 0.2–1（独立于玻璃颜色不透明度） |
| `glass.glassBrightness` | 玻璃材质亮度 0.2–1.6（tint 明度缩放，>1 变亮 <1 变暗） |
| `glass.brightness` | 背景亮度 0.2–1.6 |
