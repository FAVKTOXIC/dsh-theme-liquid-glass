# dsh-theme-liquid-glass

Genuine Liquid Glass theme for DeepSeek Harness Web UI.

- **SVG Edge Refraction (v0.3.0)** — SVG feDisplacementMap edge refraction on the input card, send button, message bubbles, view tabs, queue dock, and sidebar buttons. The refraction intensity is adjustable via a settings slider.
- **Custom Background Blur & Brightness** — Independently control the wallpaper blur (`bgBlur`) and brightness (`brightness`) so the background looks perfect under the glass.
- **Built-in Animated Demo Wallpaper** — A customizable animated color-blob wallpaper (speed, blob count, color cycle, blur, opacity) that works out of the box.
- **Redesigned Model Selector** — A full-screen frosted-glass model/effort picker with provider-group grid layout and hover highlights.
- **Glass-styled Buttons Throughout** — The send button, view tabs, sidebar action buttons, and the command (+) button all use a glass-lens material with edge refraction.
- **Unique Water-drop Settings Icon** — A droplet icon replaces the default gear in the settings nav, making the plugin instantly recognizable.
- **Frosted Glass UI** — Uses `ctx.theme.overrideTokens` to override `--dsw-alias-*` semantic tokens with translucent glass values (`{light, dark}` pairs). Glass parameters are driven by `--dsh-lg-*` CSS variables on `body` — changes take effect immediately.
- **Hover Highlights** — All interactive elements get a subtle glow and lift on hover.
- **Dynamic Wallpaper** — Supports web URLs (iframe, optional host proxy), local HTML files, local images, and local videos.
- **Fully Customizable** — Frost toggle, blur radius (px), edge refraction strength, glass color, glass brightness, background blur, and more.
- **Implementation** — The frosted blur is applied as `filter: blur()` on a dedicated background layer (`inset: -48px` for bleed room), **not** `backdrop-filter` on `#root` (which would make `#root` the containing block for every `position: fixed` descendant — menus, popups, toasts would be re-anchored to `#root`).
- **Settings Page** — Settings → "Liquid Glass" (a top-level `settings.section` alongside General / Model / Plugins). Groups: "Page Background", "Input Card · Frosted Glass". All changes apply in real time; "Reset to defaults" restores everything.
- **One-click Disable** — The master toggle strips all token overrides, removes the wallpaper, and disables every frosted/lens-edge rule (all effects are gated on the `body.dsh-lg-on` class — disabling the switch leaves zero visual residue).
- **Local File Picker** — When the wallpaper type is set to local HTML / image / video / file, clicking the input field opens the system file picker. The chosen file is uploaded to the wallpaper directory via `POST /liquid-glass/upload` (renamed to `lg-<timestamp>-<original-name>`) and served at `/liquid-glass/wallpaper/<filename>`.

## Structure

```
src/index.ts          Host half: wallpaper file routes, file upload, web proxy
src/client/index.ts   Browser half: token overrides, background layer, glass params, settings panel
src/shared.ts         Shared constants and settings types (zero runtime dependencies)
build.mjs             SWC build pipeline (lib/index.js + lib/client.js in loader format)
```

## Build

```bash
npm install
npm run build        # one-shot build
npm run watch        # watch mode (works with client-hmr hot-reload)
npm run dev          # build + smoke test
```

## Install to a DSH Web Profile

### Via npm (recommended, stable)

```bash
dsh plugin --profile web add dsh-theme-liquid-glass
```

Refresh the browser.

### Local Development Link

```bash
dsh plugin --profile web add "<absolute-path-to-theme-source>"
```

Refresh the browser.

> **After modifying code**: rebuild and re-link:
> ```bash
> cd <theme-source-dir>
> node build.mjs
> dsh plugin --profile web add "<absolute-path-to-theme-source>"
> ```
> During development you can use `node build.mjs --watch` for automatic rebuilds.
> **Client changes** (settings UI, glass params) take effect after a build + browser refresh.
> **Host changes** (routes, upload endpoint) require a `dsh web` restart to reload the host half.

## Client Injection

The client bundle must export an `inject` array of **service names**: `['slots','locale','theme']` (matching the shipped dsh-ui-appearance / dsh-dream-skin plugins). The client loader builds the fiber injection table from this array. Missing it causes `cannot get property X without inject` and a hard web boot failure. The `apply()` function itself is wrapped in try/catch — runtime errors degrade gracefully without crashing the GUI.

## Persistence (Why localStorage)

Settings are stored in `localStorage` (key `dsh-liquid-glass.settings`), **not** through the settings RPC. The harness settings gateway only exposes hard-coded product namespaces to browser clients. A third-party namespace stays `loading` forever even when the host half registered it. The same constraint was encountered by the shipped dsh-ui-appearance and dsh-dream-skin plugins, both of which chose localStorage. The trade-off: settings are per-browser — switching browsers or clearing site data loses them.

## Settings Reference

| Field | Description |
| --- | --- |
| `enabled` | Master switch |
| `wallpaper.kind` | `none` / `url` / `html` / `image` / `video` / `local` |
| `wallpaper.value` | Web URL or relative path under the wallpapers directory |
| `wallpaper.proxy` | Route web URLs through the host proxy (bypasses X-Frame-Options) |
| `wallpaper.muted` | Mute video wallpapers (default true; unmuting may be blocked by autoplay policy) |
| `demo.speed` | Demo wallpaper animation speed multiplier 0.1–4 (step 0.1) |
| `demo.blobs` | Demo wallpaper blob count 1–6 |
| `demo.colorCycle` | Demo wallpaper color cycle 0–10 (0 = static) |
| `demo.blur` | Demo wallpaper blob blur 10–140px |
| `demo.opacity` | Demo wallpaper blob opacity 0.2–1 |
| `demo.wash` | Demo wallpaper background gradient wash toggle |
| `glass.frosted` | Frost toggle (input card / bubbles / dock backdrop blur) |
| `glass.blur` | Input card frost blur radius 0–60px |
| `glass.bgBlur` | Background wallpaper blur 0–60px (independent of card frost) |
| `glass.refraction` | Edge refraction 0–1 |
| `glass.tint` | Glass color |
| `glass.tintOpacity` | Glass color opacity 0–1 |
| `glass.toolTextColor` | Tool call text color (#RGB hex, empty = default) |
| `glass.codeBlockOpacity` | Code block background opacity 0.2–1 (independent of tint opacity) |
| `glass.glassBrightness` | Glass material brightness 0.2–1.6 (tint lightness scaling; >1 brighter, <1 darker) |
| `glass.brightness` | Background brightness 0.2–1.6 |

## First Launch

On first enable, the plugin checks whether `demo.html` exists in `<DSH_HOME>/wallpapers`. If it doesn't, the plugin writes the built-in demo wallpaper (existing files are never overwritten). The default wallpaper path is `$DSH_HOME/wallpapers/demo.html`. The wallpaper directory can be changed via the `wallpaperDir` config option.

## Screenshots

![Input card with edge refraction](assets/screenshots/screenshot-input.png)
![Chat interface with glass bubbles](assets/screenshots/screenshot-chat.png)
![Settings panel](assets/screenshots/screenshot-settings.png)