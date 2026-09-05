# Changelog

所有值得记录的变更都会在此文件列出。
本文档格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

All notable changes to this project will be documented in this file. The format
is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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