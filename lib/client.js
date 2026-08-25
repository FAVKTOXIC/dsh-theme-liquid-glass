window.__ModuleLoader__.load({
	id: "dsh-theme-liquid-glass",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
/**
 * Browser half of dsh-theme-liquid-glass (single self-contained file).
 *
 * Architecture follows the battle-tested pattern of the shipped
 * dsh-ui-appearance / dsh-dream-skin plugins:
 *
 * - Settings persist in localStorage, NOT the settings RPC: the harness
 *   settings gateway only exposes its hard-coded product namespaces to
 *   browser clients, so a third-party namespace stays `loading` forever on
 *   the client even when the host half registered it. (ui-appearance comment:
 *   "the harness settings gateway only exposes its hard-coded product
 *   namespaces to browser clients, so a third-party namespace cannot be
 *   written through the settings RPC".)
 * - One stylesheet + one fixed background layer element + body CSS variables;
 *   every write retracts on dispose, so disabling the plugin restores the
 *   stock UI exactly.
 * - Frost/blur is `filter: blur()` applied to the BACKGROUND LAYER, never
 *   `backdrop-filter` on #root: a non-none backdrop-filter turns #root into
 *   the containing block of every fixed-position descendant (menus, tooltips,
 *   toasts), re-anchoring them to #root instead of the viewport.
 * - Layer sits at z-index 0, #root is lifted to z-index 1, so the wallpaper
 *   shows through the translucent `--dsw-alias-*` surface tokens.
 * - Tokens are plain rgba() pairs ({light, dark}) — no color-mix, which would
 *   make a custom property referencing itself go guaranteed-invalid.
 */ "use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: Object.getOwnPropertyDescriptor(all, name).get
    });
}
_export(exports, {
    get apply () {
        return apply;
    },
    get inject () {
        return inject;
    }
});
const _jsxruntime = require("react/jsx-runtime");
const _client = require("@deepseek-ai/dsh-client-runtime/client");
// Inlined constants (the client bundle stays a single module — the shell
// module loader only resolves graph rows and shell modules, never relative
// paths, so nothing outside this file may be required at runtime).
const STORAGE_KEY = 'dsh-liquid-glass.settings';
const WALLPAPER_ROUTE = '/liquid-glass/wallpaper';
const UPLOAD_ROUTE = '/liquid-glass/upload';
const PROXY_ROUTE = '/liquid-glass/proxy';
const PLUGIN_ID = 'dsh-theme-liquid-glass';
const OVERRIDE_SOURCE = PLUGIN_ID;
const BG_LAYER_ID = 'dsh-liquid-glass-bg';
const SCRIM_ID = 'dsh-liquid-glass-scrim';
const STYLE_ID = 'dsh-liquid-glass-style';
const FILTER_ID = 'dsh-lg-filters';
const EDGE_FILTER_ID = 'dsh-lg-edge-refraction';
/** Inline SVG filter for edge refraction, applied via `backdrop-filter: url(#...)`.
 *  feDisplacementMap with no explicit in/in2 → consumes the backdrop's own alpha
 *  edge as the displacement map, creating a smooth liquid refraction at the
 *  element border. filterUnits=objectBoundingBox ties the filter region to the
 *  element. */ const FILTER_SVG = `<svg id="${FILTER_ID}" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:fixed;pointer-events:none;visibility:hidden;top:0;left:0;overflow:hidden">
  <filter id="${EDGE_FILTER_ID}" x="-10%" y="-10%" width="120%" height="120%" filterUnits="objectBoundingBox" color-interpolation-filters="sRGB">
    <feDisplacementMap scale="80"/>
  </filter>
</svg>`;
const DEFAULTS = {
    enabled: true,
    wallpaper: {
        kind: 'local',
        value: 'demo.html',
        proxy: false,
        muted: true
    },
    demo: {
        speed: 1,
        blobs: 6,
        colorCycle: 4,
        blur: 65,
        opacity: 0.85,
        wash: true
    },
    glass: {
        frosted: true,
        blur: 24,
        bgBlur: 5,
        refraction: 0.4,
        tint: '#ffffff',
        tintOpacity: 0.35,
        toolTextColor: '',
        codeBlockOpacity: 0.7,
        glassBrightness: 1,
        brightness: 1,
        edgeRefractionScale: 80
    }
};
const WALLPAPER_KINDS = [
    'none',
    'url',
    'html',
    'image',
    'video',
    'local'
];
/** Kinds whose value is a LOCAL file (click-to-pick opens the system file dialog). */ const LOCAL_FILE_KINDS = [
    'local',
    'html',
    'image',
    'video'
];
/** <input type="file"> accept filter per local-file kind. */ const LOCAL_ACCEPT = {
    html: '.html,.htm',
    image: 'image/*',
    video: 'video/*',
    local: '.html,.htm,image/*,video/*'
};
/**
 * Upload a picked file to the host wallpaper dir and return the stored name.
 * The host names the file `lg-<timestamp>-<sanitized-original>` and serves it
 * back through /liquid-glass/wallpaper/<name>.
 */ async function uploadLocalFile(file) {
    const body = await file.arrayBuffer();
    const res = await fetch(`${UPLOAD_ROUTE}?name=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        headers: {
            'content-type': 'application/octet-stream'
        },
        body
    });
    const text = await res.text();
    if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
    let data;
    try {
        data = JSON.parse(text);
    } catch  {
        throw new Error('无效的上传响应');
    }
    if (typeof data.name !== 'string' || data.name === '') throw new Error('上传响应缺少文件名');
    return data.name;
}
const clampNum = (v, min, max, fallback)=>typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
const clamp01 = (v)=>Math.max(0, Math.min(1, v));
/** Validate + clamp one parsed settings document (hand-edited or stale
 * localStorage can never produce invalid CSS this way). */ function sanitizeSettings(raw) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {
        ...DEFAULTS
    };
    const s = raw;
    const w = typeof s.wallpaper === 'object' && s.wallpaper !== null ? s.wallpaper : {};
    const d = typeof s.demo === 'object' && s.demo !== null ? s.demo : {};
    const g = typeof s.glass === 'object' && s.glass !== null ? s.glass : {};
    const kind = WALLPAPER_KINDS.includes(w.kind) ? w.kind : DEFAULTS.wallpaper.kind;
    return {
        enabled: typeof s.enabled === 'boolean' ? s.enabled : DEFAULTS.enabled,
        wallpaper: {
            kind,
            value: typeof w.value === 'string' ? w.value : DEFAULTS.wallpaper.value,
            proxy: typeof w.proxy === 'boolean' ? w.proxy : DEFAULTS.wallpaper.proxy,
            muted: typeof w.muted === 'boolean' ? w.muted : DEFAULTS.wallpaper.muted
        },
        demo: {
            speed: clampNum(d.speed, 0.1, 4, DEFAULTS.demo.speed),
            blobs: Math.round(clampNum(d.blobs, 1, 6, DEFAULTS.demo.blobs)),
            colorCycle: Math.round(clampNum(d.colorCycle, 0, 10, DEFAULTS.demo.colorCycle)),
            blur: Math.round(clampNum(d.blur, 10, 140, DEFAULTS.demo.blur)),
            opacity: clampNum(d.opacity, 0.2, 1, DEFAULTS.demo.opacity),
            wash: typeof d.wash === 'boolean' ? d.wash : DEFAULTS.demo.wash
        },
        glass: {
            frosted: typeof g.frosted === 'boolean' ? g.frosted : DEFAULTS.glass.frosted,
            blur: clampNum(g.blur, 0, 60, DEFAULTS.glass.blur),
            bgBlur: clampNum(g.bgBlur, 0, 60, DEFAULTS.glass.bgBlur),
            refraction: clampNum(g.refraction, 0, 1, DEFAULTS.glass.refraction),
            tint: typeof g.tint === 'string' && /^#[0-9a-f]{6}$/i.test(g.tint) ? g.tint.toLowerCase() : DEFAULTS.glass.tint,
            tintOpacity: clampNum(g.tintOpacity, 0, 1, DEFAULTS.glass.tintOpacity),
            toolTextColor: typeof g.toolTextColor === 'string' && (/^#[0-9a-f]{6}$/i.test(g.toolTextColor) || g.toolTextColor === '') ? g.toolTextColor.toLowerCase() : DEFAULTS.glass.toolTextColor,
            codeBlockOpacity: clampNum(g.codeBlockOpacity, 0.2, 1, DEFAULTS.glass.codeBlockOpacity),
            glassBrightness: clampNum(g.glassBrightness, 0.2, 1.6, DEFAULTS.glass.glassBrightness),
            brightness: clampNum(g.brightness, 0.2, 1.6, DEFAULTS.glass.brightness),
            edgeRefractionScale: clampNum(g.edgeRefractionScale, 0, 200, DEFAULTS.glass.edgeRefractionScale)
        }
    };
}
function readStoredSettings() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw === null) return {
            ...DEFAULTS
        };
        return sanitizeSettings(JSON.parse(raw));
    } catch  {
        return {
            ...DEFAULTS
        };
    }
}
/** Hex → rgba() string. */ function hexToRgba(hex, alpha) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return `rgba(255, 255, 255, ${alpha})`;
    const n = parseInt(m[1], 16);
    const r = n >> 16 & 0xff;
    const g = n >> 8 & 0xff;
    const b = n & 0xff;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
/** Dark-palette glass color: the tint scaled toward black (Apple's dark glass
 * material is a translucent near-black with the same hue family). */ function darkGlass(color) {
    const m = /^#?([0-9a-f]{6})$/i.exec(color.trim());
    if (!m) return '#26262b';
    const n = parseInt(m[1], 16);
    const r = Math.round((n >> 16 & 0xff) * 0.2);
    const g = Math.round((n >> 8 & 0xff) * 0.2);
    const b = Math.round((n & 0xff) * 0.2);
    return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
}
/** Scale a hex color's lightness: factor > 1 mixes toward white, < 1 toward
 * black (the glass material brightness — the card surface gets lighter /
 * darker without touching the hue). factor 1 is the identity. */ function scaleTint(hex, factor) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    let r = n >> 16 & 0xff;
    let g = n >> 8 & 0xff;
    let b = n & 0xff;
    if (factor >= 1) {
        const t = Math.min(1, (factor - 1) / 0.6); // 1.0 -> 0, 1.6 -> full white
        r = Math.round(r + (255 - r) * t);
        g = Math.round(g + (255 - g) * t);
        b = Math.round(b + (255 - b) * t);
    } else {
        const t = Math.min(1, (1 - factor) / 0.8); // 1.0 -> 0, 0.2 -> full black
        r = Math.round(r * (1 - t));
        g = Math.round(g * (1 - t));
        b = Math.round(b * (1 - t));
    }
    return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
}
/**
 * Build the glass token override layer. Plain rgba() strings only; values are
 * `{ light, dark }` pairs so the theme service can pick per color scheme.
 */ function buildTokens(s) {
    const g = s.glass;
    const a = clamp01(g.tintOpacity);
    // The glass material brightness scales the tint lightness; every glass
    // surface (card, bubbles, dock, menus) follows the same tint.
    const tint = scaleTint(g.tint, clampNum(g.glassBrightness, 0.2, 1.6, 1));
    const glass = (alpha)=>({
            light: hexToRgba(tint, clamp01(alpha)),
            dark: hexToRgba(darkGlass(tint), clamp01(alpha))
        });
    const edges = (strength, darkStrength = strength)=>({
            light: `rgba(0, 0, 0, ${clamp01(g.refraction * strength)})`,
            dark: `rgba(255, 255, 255, ${clamp01(g.refraction * darkStrength)})`
        });
    const wallpaperActive = s.wallpaper.kind !== 'none' && s.wallpaper.value.trim() !== '';
    const t = {};
    const set = (name, v)=>{
        t[name] = v;
    };
    // Base canvas: transparent when a wallpaper shows through, else translucent glass.
    set('--dsw-alias-bg-base', wallpaperActive ? {
        light: 'transparent',
        dark: 'transparent'
    } : glass(a * 0.3));
    set('--dsw-alias-bg-layer-1', glass(a * 0.55));
    set('--dsw-alias-bg-layer-2', glass(a * 0.66));
    set('--dsw-alias-bg-layer-3', glass(a * 0.78));
    set('--dsw-alias-bg-module-platform', glass(a * 0.5));
    set('--dsw-alias-bg-multi-select', glass(a * 0.6));
    set('--dsw-alias-bg-overlay', glass(a * 0.92));
    set('--dsw-specific-menu', glass(0.92));
    set('--dsw-specific-sidebar-fill', glass(a * 0.5));
    // User message bubbles: frosted tint (the frosted backdrop + lens rim come
    // from the stylesheet pseudo-element rules).
    set('--dsw-specific-bubble', glass(0.5));
    set('--dsw-specific-bubble-highlight', glass(0.38));
    // The composer card and queue dock stay translucent so the sharp wallpaper
    // shows around the input box; the box itself carries the frosted
    // backdrop-filter (see SHEET) over its own glass-tint gradient.
    set('--dsw-specific-input-major', glass(0.35));
    set('--dsw-specific-login-input', glass(0.6));
    set('--dsw-specific-tip', glass(0.45));
    set('--dsw-specific-selector', glass(a * 0.5));
    set('--dsw-alias-markdown-code-block', glass(clampNum(g.codeBlockOpacity, 0.2, 1, DEFAULTS.glass.codeBlockOpacity)));
    set('--dsw-alias-markdown-code-block-banner', glass(clampNum(g.codeBlockOpacity - 0.1, 0.2, 1, DEFAULTS.glass.codeBlockOpacity)));
    set('--dsw-alias-markdown-inline-code', glass(clampNum(g.codeBlockOpacity - 0.1, 0.2, 1, DEFAULTS.glass.codeBlockOpacity)));
    set('--dsw-alias-markdown-citation', glass(a * 0.32));
    set('--dsw-alias-button-elevated-fill', glass(a * 0.55));
    set('--dsw-alias-button-floating-fill', glass(a * 0.55));
    set('--dsw-alias-button-floating-hover', glass(a * 0.66));
    set('--dsw-alias-button-tool-bar-fill', glass(a * 0.62));
    set('--dsw-alias-button-tool-bar-hover', glass(a * 0.72));
    set('--dsw-alias-button-tool-bar-fill-invisible', glass(a * 0.4));
    set('--dsw-alias-interactive-bg-hover', glass(0.16));
    set('--dsw-alias-interactive-bg-active', glass(0.2));
    set('--dsw-alias-interactive-bg-hover-accent', glass(0.24));
    set('--dsw-alias-bg-skeleton', edges(0.1));
    // Soft glass rim: low-alpha edges so the composer/dock boundary reads as a
    // subtle luminous rim (the frost strip's feathered top supplies the glow),
    // never a stark white line.
    set('--dsw-alias-border-l1', edges(0.4));
    set('--dsw-alias-border-l2', edges(0.35));
    set('--dsw-alias-border-l2-darkmode-thin', edges(0.45));
    set('--dsw-alias-border-l3', edges(0.45));
    set('--dsw-alias-border-l4', edges(0.55));
    set('--dsw-alias-toast-bg', glass(a * 0.82));
    set('--dsw-alias-tooltip-bg', glass(a * 0.85));
    return t;
}
/**
 * Static sheet. The wallpaper layer sits above the body background but below
 * #root (lifted with a minimal stacking context), so surfaces painted with
 * translucent tokens show the wallpaper through. `inset: -48px` gives the
 * blur filter room so edges never show transparent bleed.
 *
 * Frosted glass: the composer CARD, user bubbles, and queue dock carry their
 * own `backdrop-filter: blur(...)` (card/bubble via a ::before pseudo so the
 * containing-block side effect never re-anchors their absolute descendants) —
 * exactly the mechanism the harness settings modal uses
 * (`backdrop-filter: var(--dsw-mask-blur)`). The wallpaper blur is a separate,
 * independently adjustable `--dsh-lg-bg-blur` on the background layer itself.
 * Lens-like edges come from inset highlights: a bright top rim that catches
 * light, a soft inner ring, and bottom depth shading.
 */ const SHEET = `
#${BG_LAYER_ID} {
  position: fixed;
  inset: -48px;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
  background-repeat: no-repeat;
  background-position: center;
  background-size: cover;
  filter: blur(var(--dsh-lg-bg-blur, 0px)) brightness(var(--dsh-lg-brightness, 1)) saturate(calc(1 + var(--dsh-lg-refraction, 0)));
}
#${BG_LAYER_ID} > * {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border: 0;
  display: block;
  pointer-events: none;
}
#${BG_LAYER_ID} > iframe { background: transparent; }
#${SCRIM_ID} {
  z-index: 2;
  background: linear-gradient(rgba(8, 10, 18, var(--dsh-lg-scrim, 0)) 0%, rgba(8, 10, 18, var(--dsh-lg-scrim, 0)) 100%);
}
body:not([data-ds-dark-theme]) #${SCRIM_ID} {
  background: linear-gradient(rgba(255, 255, 255, var(--dsh-lg-scrim, 0)) 0%, rgba(255, 255, 255, var(--dsh-lg-scrim, 0)) 100%);
}
#root {
  position: relative;
  z-index: 1;
}
/* Whole composer card (input area, model selector, send button, meter) is ONE
   piece of frosted glass: the input box has no separate surface of its own, so
   it blends into the card. backdrop-filter lives on the card's ::before
   pseudo-element, NOT the card itself: the containing-block side effect of
   backdrop-filter only applies to the pseudo's own descendants (none), so the
   absolutely-positioned popups inside the card (context meter panel, model
   menu) keep their anchors. The refractive edge is a WIDE luminous zone:
   a thick top rim that catches light, inner glows spreading into the surface,
   and a soft halo spilling outside the card. */
[data-composer-card] {
  isolation: isolate;
}
body.dsh-lg-on [data-composer-card]::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  z-index: 0;
  pointer-events: none;
  -webkit-backdrop-filter: blur(var(--dsh-lg-blur, 24px)) saturate(160%) url(#dsh-lg-edge-refraction);
  backdrop-filter: blur(var(--dsh-lg-blur, 24px)) saturate(160%) url(#dsh-lg-edge-refraction);
  background: color-mix(in srgb, var(--dsh-lg-tint, #ffffff) 10%, transparent);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.45),
    inset 0 0 0 1px rgba(255, 255, 255, 0.22),
    inset 0 0 18px rgba(255, 255, 255, 0.10),
    inset 0 0 36px rgba(255, 255, 255, 0.05),
    inset 2px 2px 6px 2px rgba(255, 255, 255, 0.20),
    inset -2px -2px 4px -1px rgba(255, 255, 255, 0.20),
    0 0 24px rgba(255, 255, 255, 0.12);
}
body[data-ds-dark-theme].dsh-lg-on [data-composer-card]::before {
  background: color-mix(in srgb, var(--dsh-lg-tint-dark, #333333) 14%, transparent);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.28),
    inset 0 0 0 1px rgba(255, 255, 255, 0.10),
    inset 0 0 18px rgba(255, 255, 255, 0.08),
    inset 0 0 40px rgba(255, 255, 255, 0.04),
    inset 2px 2px 6px 2px rgba(255, 255, 255, 0.12),
    inset -2px -2px 4px -1px rgba(255, 255, 255, 0.12),
    0 0 28px rgba(255, 255, 255, 0.10);
}
/* Edge refraction lives on the SAME backdrop-filter chain as the frosted blur
   (no separate ::after ring with a binary mask). feDisplacementMap is driven by
   the backdrop's alpha edges — strongest at the element border where the
   backdrop transitions, weakest at the center — so refraction naturally
   concentrates at the edge without a hard mask boundary. */
/* Harness settings modal: the SAME frosted glass + lens edge as the composer
   card. [aria-labelledby] pins this to the settings dialog only — the generic
   Modal primitive and the image lightbox use aria-label, not aria-labelledby.
   backdrop-filter rides the ::before pseudo (isolation + z-index:-1), never
   the dialog itself, so its descendants keep their anchors. */
body.dsh-lg-on [role="dialog"][aria-labelledby] {
  isolation: isolate;
}
body.dsh-lg-on [role="dialog"][aria-labelledby]::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  z-index: -1;
  -webkit-backdrop-filter: blur(var(--dsh-lg-blur, 24px)) saturate(160%);
  backdrop-filter: blur(var(--dsh-lg-blur, 24px)) saturate(160%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.45),
    inset 0 0 0 1px rgba(255, 255, 255, 0.22),
    inset 0 0 18px rgba(255, 255, 255, 0.10),
    inset 0 0 36px rgba(255, 255, 255, 0.05),
    0 0 24px rgba(255, 255, 255, 0.12);
}
body[data-ds-dark-theme].dsh-lg-on [role="dialog"][aria-labelledby]::before {
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.28),
    inset 0 0 0 1px rgba(255, 255, 255, 0.10),
    inset 0 0 18px rgba(255, 255, 255, 0.08),
    inset 0 0 40px rgba(255, 255, 255, 0.04),
    0 0 28px rgba(255, 255, 255, 0.10);
}
/* User message bubbles: the same frosted glass + lens edge as the composer
   card, so sent messages read as one material family. backdrop-filter rides
   the ::before pseudo (isolation + z-index:-1), never the bubble itself. */
[data-time-hover-root] [class*="_bubble"] {
  position: relative;
  isolation: isolate;
}
body.dsh-lg-on [data-time-hover-root] [class*="_bubble"]::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  z-index: -1;
  -webkit-backdrop-filter: blur(var(--dsh-lg-blur, 24px)) saturate(150%) url(#dsh-lg-edge-refraction);
  backdrop-filter: blur(var(--dsh-lg-blur, 24px)) saturate(150%) url(#dsh-lg-edge-refraction);
  background: color-mix(in srgb, var(--dsh-lg-tint, #ffffff) 8%, transparent);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.40),
    inset 0 0 0 1px rgba(255, 255, 255, 0.14),
    inset 0 0 12px rgba(255, 255, 255, 0.07),
    inset 2px 2px 6px 2px rgba(255, 255, 255, 0.12),
    inset -2px -2px 4px -1px rgba(255, 255, 255, 0.12);
}
body[data-ds-dark-theme].dsh-lg-on [data-time-hover-root] [class*="_bubble"]::before {
  background: color-mix(in srgb, var(--dsh-lg-tint-dark, #333333) 12%, transparent);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.25),
    inset 0 0 0 1px rgba(255, 255, 255, 0.08),
    inset 0 0 12px rgba(255, 255, 255, 0.05),
    inset 2px 2px 6px 2px rgba(255, 255, 255, 0.08),
    inset -2px -2px 4px -1px rgba(255, 255, 255, 0.08);
}
/* Conversation page header (对话 / 轨迹 / session log bar): gradient frosted
   glass — strong backdrop blur at the TOP fading to no blur at the BOTTOM,
   via a vertical mask on the ::before pseudo (z-index:-1, isolation so the
   blur layer never re-anchors anything). */
body.dsh-lg-on header:has([role="tablist"]) {
  isolation: isolate;
}
body.dsh-lg-on header:has([role="tablist"])::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  -webkit-backdrop-filter: blur(calc(var(--dsh-lg-blur, 24px) * 1.2)) saturate(160%);
  backdrop-filter: blur(calc(var(--dsh-lg-blur, 24px) * 1.2)) saturate(160%);
  -webkit-mask-image: linear-gradient(to bottom, black 0%, black 30%, transparent 100%);
  mask-image: linear-gradient(to bottom, black 0%, black 30%, transparent 100%);
}
/* Drop the header's bottom hairline — with the gradient frost the boundary
   should be seamless (the stock ::after line paints --dsw-alias-border-l2,
   which the glass theme turns into a bright white line). */
body.dsh-lg-on header:has([role="tablist"])::after {
  display: none;
}
/* The bar FLOATS OVER the scrolling message list (the stock layout puts the
   header in a separate flex row, so nothing ever passed beneath it). The
   conversation text now glides under the bar and is frosted by the gradient
   above: strong blur at the bar's top, fully transparent at its bottom.
   Note: every slot render is wrapped in a <div data-slot=... display:contents>
   (web-react SlotOutlet), so the header is one level below the root. */
body.dsh-lg-on div:has(> [data-conversation-scroll])[data-phase="active"] {
  position: relative;
  isolation: isolate;
}
body.dsh-lg-on div:has(> [data-conversation-scroll])[data-phase="active"] > [data-slot="conversation.session.header"] > header:has([role="tablist"]) {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 5;
  background: transparent;
}
/* Reserve the header's height so the first message starts below the bar; the
   padding scrolls away, letting text pass beneath the gradient blur. */
body.dsh-lg-on div:has(> [data-conversation-scroll])[data-phase="active"] > [data-conversation-scroll] {
  box-sizing: border-box;
  padding-top: 88px;
}
/* View tabs: floating glass capsules with a highlight edge (the old underline
   indicator is replaced by the capsule surface). backdrop-filter rides the
   ::before pseudo, never the button itself. */
body.dsh-lg-on header:has([role="tablist"]) [role="tab"] {
  position: relative;
  isolation: isolate;
  border-radius: 999px;
  padding: 7px 18px;
  margin-bottom: 10px;
  color: var(--dsw-alias-label-secondary);
}
body.dsh-lg-on header:has([role="tablist"]) [role="tab"]::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  z-index: -1;
  -webkit-backdrop-filter: blur(12px) saturate(150%) url(#dsh-lg-edge-refraction);
  backdrop-filter: blur(12px) saturate(150%) url(#dsh-lg-edge-refraction);
  background: color-mix(in srgb, var(--dsh-lg-tint, #ffffff) 8%, transparent);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.40),
    inset 0 0 0 1px rgba(255, 255, 255, 0.18),
    inset 0 0 10px rgba(255, 255, 255, 0.08),
    inset 2px 2px 6px 2px rgba(255, 255, 255, 0.14),
    inset -2px -2px 4px -1px rgba(255, 255, 255, 0.14),
    0 2px 10px rgba(0, 0, 0, 0.12);
}
body.dsh-lg-on header:has([role="tablist"]) [role="tab"][aria-selected="true"] {
  color: var(--dsw-alias-state-business-primary);
}
body.dsh-lg-on header:has([role="tablist"]) [role="tab"][aria-selected="true"]::before {
  background: color-mix(in srgb, var(--dsh-lg-tint, #ffffff) 14%, transparent);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.55),
    inset 0 0 0 1px rgba(255, 255, 255, 0.30),
    inset 0 0 14px rgba(255, 255, 255, 0.14),
    inset 2px 2px 6px 2px rgba(255, 255, 255, 0.20),
    inset -2px -2px 4px -1px rgba(255, 255, 255, 0.20),
    0 2px 12px rgba(0, 0, 0, 0.16);
}
body[data-ds-dark-theme].dsh-lg-on header:has([role="tablist"]) [role="tab"]::before {
  background: color-mix(in srgb, var(--dsh-lg-tint-dark, #333333) 12%, transparent);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.25),
    inset 0 0 0 1px rgba(255, 255, 255, 0.10),
    inset 0 0 10px rgba(255, 255, 255, 0.05),
    inset 2px 2px 6px 2px rgba(255, 255, 255, 0.08),
    inset -2px -2px 4px -1px rgba(255, 255, 255, 0.08),
    0 2px 10px rgba(0, 0, 0, 0.30);
}
body[data-ds-dark-theme].dsh-lg-on header:has([role="tablist"]) [role="tab"][aria-selected="true"]::before {
  background: color-mix(in srgb, var(--dsh-lg-tint-dark, #333333) 16%, transparent);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.35),
    inset 0 0 0 1px rgba(255, 255, 255, 0.16),
    inset 0 0 14px rgba(255, 255, 255, 0.08),
    inset 2px 2px 6px 2px rgba(255, 255, 255, 0.12),
    inset -2px -2px 4px -1px rgba(255, 255, 255, 0.12),
    0 2px 12px rgba(0, 0, 0, 0.35);
}
body.dsh-lg-on header:has([role="tablist"]) [role="tab"]::after {
  display: none;
}
/* General hover effect for interactive elements: highlight edge, floating
   shadow, subtle lift, and brightness increase. */
body.dsh-lg-on button:not(:disabled):hover,
body.dsh-lg-on a:not(:disabled):hover,
body.dsh-lg-on [role="button"]:not(:disabled):hover,
body.dsh-lg-on [role="tab"]:not(:disabled):hover,
body.dsh-lg-on [role="menuitem"]:not(:disabled):hover,
body.dsh-lg-on [role="link"]:not(:disabled):hover {
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.12), 0 4px 12px rgba(0, 0, 0, 0.10);
  transform: translateY(-1px);
  filter: brightness(1.15);
}
body[data-ds-dark-theme].dsh-lg-on button:not(:disabled):hover,
body[data-ds-dark-theme].dsh-lg-on a:not(:disabled):hover,
body[data-ds-dark-theme].dsh-lg-on [role="button"]:not(:disabled):hover,
body[data-ds-dark-theme].dsh-lg-on [role="tab"]:not(:disabled):hover,
body[data-ds-dark-theme].dsh-lg-on [role="menuitem"]:not(:disabled):hover,
body[data-ds-dark-theme].dsh-lg-on [role="link"]:not(:disabled):hover {
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.10), 0 4px 12px rgba(0, 0, 0, 0.18);
  filter: brightness(1.20);
}
/* Tool call titles (Read, Think, Edit, Bash, etc.): text-shadow for
   readability on glass backgrounds, plus optional custom color. */
body.dsh-lg-on [data-variant] [data-disclosure-row] [class*="title"] {
  color: var(--dsh-lg-tool-text-color, var(--dsw-alias-label-primary));
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}
/* Tool call summary text: same readability fix as the title. */
body.dsh-lg-on [data-variant] [data-disclosure-row] [class*="summary"] {
  color: var(--dsh-lg-tool-text-color, var(--dsw-alias-label-secondary));
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}
/* Composer card toolbar buttons (commands +, attachments, etc.): ensure their
   icon color is visible against the frosted glass surface. These buttons sit
   in the input row and have no background of their own; their color defaults
   to --dsw-alias-icon-secondary which may wash out on the glass. */
body.dsh-lg-on [data-composer-card] button:not([class*="_primary"]):not([role="menuitem"]):not([role="menuitemradio"]) {
  color: var(--dsw-alias-label-secondary) !important;
}
body.dsh-lg-on [data-composer-card] button:not([class*="_primary"]):not([role="menuitem"]):not([role="menuitemradio"]):hover {
  color: var(--dsw-alias-label-primary) !important;
}
/* Send/stop button: a transparent lens instead of the solid brand fill. */
body.dsh-lg-on [data-composer-card] button[class*="_primary"] {
  background: linear-gradient(180deg,
    color-mix(in srgb, var(--dsh-lg-tint, #ffffff) 20%, transparent),
    color-mix(in srgb, var(--dsh-lg-tint, #ffffff) 6%, transparent));
  color: var(--dsw-alias-brand-primary);
  -webkit-backdrop-filter: blur(12px) url(#dsh-lg-edge-refraction);
  backdrop-filter: blur(12px) url(#dsh-lg-edge-refraction);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.40),
    inset 0 0 0 1px rgba(255, 255, 255, 0.14),
    inset 0 -2px 6px rgba(0, 0, 0, 0.20),
    inset 2px 2px 6px 2px rgba(255, 255, 255, 0.14),
    inset -2px -2px 4px -1px rgba(255, 255, 255, 0.14);
}
body.dsh-lg-on [data-composer-card] button[class*="_primary"]:hover:not(:disabled) {
  background: linear-gradient(180deg,
    color-mix(in srgb, var(--dsh-lg-tint, #ffffff) 30%, transparent),
    color-mix(in srgb, var(--dsh-lg-tint, #ffffff) 12%, transparent));
}
body[data-ds-dark-theme].dsh-lg-on [data-composer-card] button[class*="_primary"] {
  background: linear-gradient(180deg,
    color-mix(in srgb, var(--dsh-lg-tint-dark, #333333) 34%, transparent),
    color-mix(in srgb, var(--dsh-lg-tint-dark, #333333) 14%, transparent));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.30),
    inset 0 0 0 1px rgba(255, 255, 255, 0.10),
    inset 0 -2px 8px rgba(0, 0, 0, 0.35),
    inset 2px 2px 6px 2px rgba(255, 255, 255, 0.08),
    inset -2px -2px 4px -1px rgba(255, 255, 255, 0.08);
}
body[data-ds-dark-theme].dsh-lg-on [data-composer-card] button[class*="_primary"]:hover:not(:disabled) {
  background: linear-gradient(180deg,
    color-mix(in srgb, var(--dsh-lg-tint-dark, #333333) 48%, transparent),
    color-mix(in srgb, var(--dsh-lg-tint-dark, #333333) 22%, transparent));
}
/* Queue dock: same frosted glass + a wider lens rim. */
body.dsh-lg-on [data-queue-dock] > div {
  -webkit-backdrop-filter: blur(var(--dsh-lg-blur, 24px)) saturate(150%) url(#dsh-lg-edge-refraction);
  backdrop-filter: blur(var(--dsh-lg-blur, 24px)) saturate(150%) url(#dsh-lg-edge-refraction);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.22),
    inset 0 0 0 1px rgba(255, 255, 255, 0.08),
    inset 0 0 12px rgba(255, 255, 255, 0.06);
}
/* Sidebar action buttons (new session, collapse, etc.): the same frosted glass
   + edge refraction as the view tabs, applied via ::before so the button's
   icon stays above the glass layer. The sidebar shell has a translucent
   background already, so these buttons blend into the sidebar surface. */
body.dsh-lg-on [class*="_root"]:has([class*="_treeBody"]) button:not([aria-label*="访问模式" i]):not([aria-label*="Access mode" i]) {
  position: relative;
  isolation: isolate;
}
body.dsh-lg-on [class*="_root"]:has([class*="_treeBody"]) button:not([aria-label*="访问模式" i]):not([aria-label*="Access mode" i])::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  z-index: -1;
  pointer-events: none;
  -webkit-backdrop-filter: blur(12px) url(#dsh-lg-edge-refraction);
  backdrop-filter: blur(12px) url(#dsh-lg-edge-refraction);
  background: color-mix(in srgb, var(--dsh-lg-tint, #ffffff) 8%, transparent);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.30),
    inset 0 0 0 1px rgba(255, 255, 255, 0.12),
    inset 0 0 8px rgba(255, 255, 255, 0.06),
    inset 2px 2px 6px 2px rgba(255, 255, 255, 0.10),
    inset -2px -2px 4px -1px rgba(255, 255, 255, 0.10);
}
body[data-ds-dark-theme].dsh-lg-on [class*="_root"]:has([class*="_treeBody"]) button:not([aria-label*="访问模式" i]):not([aria-label*="Access mode" i])::before {
  background: color-mix(in srgb, var(--dsh-lg-tint-dark, #333333) 12%, transparent);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.18),
    inset 0 0 0 1px rgba(255, 255, 255, 0.06),
    inset 0 0 8px rgba(255, 255, 255, 0.04),
    inset 2px 2px 6px 2px rgba(255, 255, 255, 0.06),
    inset -2px -2px 4px -1px rgba(255, 255, 255, 0.06);
}
/* Sandbox mode trigger button: explicitly strip any glass effect so its
   dropdown menu (position:fixed) is not affected by backdrop-filter creating
   a new containing block. */
body.dsh-lg-on [class*="_root"]:has([class*="_treeBody"]) button[aria-label*="访问模式" i],
body.dsh-lg-on [class*="_root"]:has([class*="_treeBody"]) button[aria-label*="Access mode" i] {
  position: static !important;
  isolation: auto !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}
body.dsh-lg-on [class*="_root"]:has([class*="_treeBody"]) button[aria-label*="访问模式" i]::before,
body.dsh-lg-on [class*="_root"]:has([class*="_treeBody"]) button[aria-label*="Access mode" i]::before {
  display: none !important;
}
/* Sidebar logo / branding: exclude from the liquid glass effect — the square
   shape looks odd when refracted. The logo is a wordmark SVG aria-hidden inside
   a button. Reset glass on the SVG itself and suppress the ::before glass layer
   on buttons containing the wordmark. */
body.dsh-lg-on [class*="_root"]:has([class*="_treeBody"]) svg[aria-hidden="true"] {
  filter: none !important;
  -webkit-backdrop-filter: none !important;
  backdrop-filter: none !important;
  background: transparent !important;
  box-shadow: none !important;
}
body.dsh-lg-on [class*="_root"]:has([class*="_treeBody"]) button:has(svg[aria-hidden="true"])::before {
  display: none !important;
}
/* Model selector popup: FULL-SCREEN.
   Gated on :has(.scrollable) so this FULL-SCREEN treatment only applies to the
   model/effort selector menu (which renders a .scrollable pane). The access-mode
   dropdown in the composer modes row is also [role="menu"] but has no
   .scrollable; leaving it a normal small dropdown instead of a fullscreen
   overlay. */
body.dsh-lg-on [data-composer-card] [role="menu"]:has(.scrollable) {
  position: fixed !important;
  inset: 0 !important;
  z-index: 1000 !important;
  width: 100vw !important;
  height: 100vh !important;
  max-width: none !important;
  max-height: none !important;
  margin: 0 !important;
  border: none !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 0 !important;
}
body.dsh-lg-on [data-composer-card] [role="menu"]:has(.scrollable)::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -1;
  background: rgba(0, 0, 0, 0.30);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
}
body[data-ds-dark-theme].dsh-lg-on [data-composer-card] [role="menu"]:has(.scrollable)::before {
  background: rgba(0, 0, 0, 0.55);
}
/* The inner scrollable groups container: centered frosted-glass panel. */
body.dsh-lg-on [data-composer-card] [role="menu"] .scrollable {
  max-width: 600px !important;
  max-height: min(80vh, 680px) !important;
  width: 92vw !important;
  margin: 0 auto !important;
  border-radius: 16px !important;
  -webkit-backdrop-filter: blur(28px) saturate(160%);
  backdrop-filter: blur(28px) saturate(160%);
  background: color-mix(in srgb, var(--dsh-lg-tint, #ffffff) 78%, transparent) !important;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.45),
    inset 0 0 0 1px rgba(255, 255, 255, 0.18),
    0 24px 60px rgba(0, 0, 0, 0.35);
  overflow-y: auto !important;
}
body[data-ds-dark-theme].dsh-lg-on [data-composer-card] [role="menu"] .scrollable {
  background: color-mix(in srgb, var(--dsh-lg-tint-dark, #2a2a2a) 84%, transparent) !important;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.25),
    inset 0 0 0 1px rgba(255, 255, 255, 0.10),
    0 24px 60px rgba(0, 0, 0, 0.55);
}
/* The root pane (Model / Effort cells): centered frosted glass card. */
body.dsh-lg-on [data-composer-card] [role="menu"] > :first-child:not(.scrollable) {
  background: color-mix(in srgb, var(--dsh-lg-tint, #ffffff) 82%, transparent) !important;
  -webkit-backdrop-filter: blur(28px) saturate(160%);
  backdrop-filter: blur(28px) saturate(160%);
  border-radius: 16px !important;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.45),
    inset 0 0 0 1px rgba(255, 255, 255, 0.18),
    0 24px 60px rgba(0, 0, 0, 0.35);
  width: 280px !important;
  overflow: hidden !important;
}
body[data-ds-dark-theme].dsh-lg-on [data-composer-card] [role="menu"] > :first-child:not(.scrollable) {
  background: color-mix(in srgb, var(--dsh-lg-tint-dark, #2a2a2a) 86%, transparent) !important;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.25),
    inset 0 0 0 1px rgba(255, 255, 255, 0.10),
    0 24px 60px rgba(0, 0, 0, 0.55);
}
/* Root pane cells (Model / Effort buttons): glass-styled menu rows. */
body.dsh-lg-on [data-composer-card] [role="menu"] button[role="menuitem"] {
  background: transparent !important;
  border-radius: 8px !important;
  margin: 2px 6px !important;
  padding: 10px 12px !important;
  color: var(--dsw-alias-label-primary) !important;
  transition: background 0.15s !important;
}
body.dsh-lg-on [data-composer-card] [role="menu"] button[role="menuitem"]:hover {
  background: color-mix(in srgb, var(--dsh-lg-tint, #ffffff) 20%, transparent) !important;
}
body[data-ds-dark-theme].dsh-lg-on [data-composer-card] [role="menu"] button[role="menuitem"]:hover {
  background: color-mix(in srgb, var(--dsh-lg-tint-dark, #2a2a2a) 30%, transparent) !important;
}
/* Provider group headings inside the full-screen picker. The actual DOM uses
   a plain div with class _7KE1Ra_groupTitle (no role="presentation"), so we
   target the first child div inside each [role="group"] section. */
body.dsh-lg-on [data-composer-card] [role="menu"] [role="group"] > div:first-child {
  padding: 14px 18px 6px !important;
  font-weight: 600 !important;
  letter-spacing: 0.02em !important;
  color: var(--dsw-alias-brand-primary) !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
  font-size: 13px !important;
}
/* Model option items (role="menuitemradio"): glass styling with hover state. */
body.dsh-lg-on [data-composer-card] [role="menu"] button[role="menuitemradio"] {
  border-radius: 8px !important;
  margin: 1px 6px !important;
  padding: 8px 12px !important;
  transition: background 0.15s !important;
  background: transparent !important;
}
body.dsh-lg-on [data-composer-card] [role="menu"] button[role="menuitemradio"]:hover {
  background: color-mix(in srgb, var(--dsh-lg-tint, #ffffff) 18%, transparent) !important;
}
body[data-ds-dark-theme].dsh-lg-on [data-composer-card] [role="menu"] button[role="menuitemradio"]:hover {
  background: color-mix(in srgb, var(--dsh-lg-tint-dark, #2a2a2a) 26%, transparent) !important;
}
/* Selected model option: accent highlight. */
body.dsh-lg-on [data-composer-card] [role="menu"] button[role="menuitemradio"][aria-checked="true"] {
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 16%, transparent) !important;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--dsw-alias-brand-primary) 30%, transparent) !important;
}
body[data-ds-dark-theme].dsh-lg-on [data-composer-card] [role="menu"] button[role="menuitemradio"][aria-checked="true"] {
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 22%, transparent) !important;
}
/* Two-column grid for model items in the full-screen model list. Each provider
   group ([role="group"]) becomes a grid; the title div spans both columns. */
body.dsh-lg-on [data-composer-card] [role="menu"] .scrollable [role="group"] {
  display: grid !important;
  grid-template-columns: 1fr 1fr !important;
  gap: 2px !important;
  padding: 0 10px 6px !important;
}
body.dsh-lg-on [data-composer-card] [role="menu"] .scrollable [role="group"] > div:first-child {
  grid-column: 1 / -1 !important;
  padding: 14px 8px 4px !important;
}
/* Click-to-dismiss: cursor pointer on the backdrop, default cursor on the panel. */
body.dsh-lg-on [data-composer-card] [role="menu"] {
  cursor: pointer;
}
body.dsh-lg-on [data-composer-card] [role="menu"] .scrollable {
  cursor: default;
}
/* Access-mode dropdown glass (see EDGE note below). */
body.dsh-lg-on [data-composer-card] [role="menu"]:not(:has(.scrollable)) {
  background: color-mix(in srgb, var(--dsh-lg-tint, #ffffff) 74%, transparent) !important;
  -webkit-backdrop-filter: blur(var(--dsh-lg-blur, 24px)) saturate(160%) url(#dsh-lg-edge-refraction);
  backdrop-filter: blur(var(--dsh-lg-blur, 24px)) saturate(160%) url(#dsh-lg-edge-refraction);
  border: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.45),
    inset 0 0 0 1px rgba(255, 255, 255, 0.18),
    inset 0 0 18px rgba(255, 255, 255, 0.08),
    inset 2px 2px 6px 2px rgba(255, 255, 255, 0.14),
    inset -2px -2px 4px -1px rgba(255, 255, 255, 0.14),
    0 8px 32px rgba(0, 0, 0, 0.30);
}
body[data-ds-dark-theme].dsh-lg-on [data-composer-card] [role="menu"]:not(:has(.scrollable)) {
  background: color-mix(in srgb, var(--dsh-lg-tint-dark, #2a2a2a) 78%, transparent) !important;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.25),
    inset 0 0 0 1px rgba(255, 255, 255, 0.10),
    inset 0 0 18px rgba(255, 255, 255, 0.06),
    inset 2px 2px 6px 2px rgba(255, 255, 255, 0.08),
    inset -2px -2px 4px -1px rgba(255, 255, 255, 0.08),
    0 8px 32px rgba(0, 0, 0, 0.50);
}
/* Access-mode dropdown: harness inner layers (viewport / itemWrap / item) carry
   their own opaque surface + backdrop-filter. Strip all of them so only the
   frosted :menu glass shows (no box-in-box). [class*="_item"] also covers the
   menu buttons, and a hover highlight keeps the rows usable on the glass. */
body.dsh-lg-on [data-composer-card] [role="menu"]:not(:has(.scrollable)) [role="presentation"],
body.dsh-lg-on [data-composer-card] [role="menu"]:not(:has(.scrollable)) [class*="_viewport"],
body.dsh-lg-on [data-composer-card] [role="menu"]:not(:has(.scrollable)) [class*="_itemWrap"],
body.dsh-lg-on [data-composer-card] [role="menu"]:not(:has(.scrollable)) [class*="_item"],
body.dsh-lg-on [data-composer-card] [role="menu"]:not(:has(.scrollable)) button[role="menuitem"] {
  background: transparent !important;
  -webkit-backdrop-filter: none !important;
  backdrop-filter: none !important;
  box-shadow: none !important;
}
body.dsh-lg-on [data-composer-card] [role="menu"]:not(:has(.scrollable)) button[role="menuitem"]:hover,
body.dsh-lg-on [data-composer-card] [role="menu"]:not(:has(.scrollable)) button[role="menuitemradio"]:hover {
  background: color-mix(in srgb, var(--dsh-lg-tint, #ffffff) 20%, transparent) !important;
}

`;
/** Body CSS variables the sheet consumes (retracted on dispose). */ const BODY_VARS = [
    '--dsh-lg-blur',
    '--dsh-lg-bg-blur',
    '--dsh-lg-brightness',
    '--dsh-lg-refraction',
    '--dsh-lg-scrim',
    '--dsh-lg-tint',
    '--dsh-lg-tint-dark',
    '--dsh-lg-tool-text-color'
];
const IMAGE_EXTS = [
    'png',
    'jpg',
    'jpeg',
    'gif',
    'webp',
    'avif',
    'svg',
    'bmp',
    'ico'
];
const VIDEO_EXTS = [
    'mp4',
    'webm',
    'mov',
    'm4v',
    'ogg',
    'ogv'
];
const isHttp = (value)=>/^https?:\/\//i.test(value);
const localUrl = (value)=>`${WALLPAPER_ROUTE}/${value.replace(/^\/+/, '')}`;
const proxied = (value, useProxy)=>useProxy && isHttp(value) ? `${PROXY_ROUTE}?u=${encodeURIComponent(value)}` : value;
/** Serialize the demo.html tunables into the iframe query string; demo.html
 * reads these back and drives its animations from them. */ const demoQuery = (d)=>{
    const p = new URLSearchParams();
    p.set('sp', String(d.speed));
    p.set('bl', String(d.blobs));
    p.set('cc', String(d.colorCycle));
    p.set('bf', String(d.blur));
    p.set('op', String(d.opacity));
    p.set('w', d.wash ? '1' : '0');
    return p.toString();
};
/** Readability veil over the wallpaper; follows the base palette. */ function scrimValue(s) {
    if (!s.enabled || s.wallpaper.kind === 'none' || s.wallpaper.value.trim() === '') return '0';
    return document.body.hasAttribute('data-ds-dark-theme') ? '0.26' : '0.1';
}
/**
 * DOM applier: owns one stylesheet and one fixed background layer element.
 * The composer input box and queue dock carry their own backdrop-filter
 * (see SHEET) so the wallpaper stays sharp and the frosting is visible at the
 * box bounds. Forwards the token overrides into ctx.theme and exposes live
 * CSS variables the stylesheet consumes. Everything retracts on dispose.
 */ class LiquidGlassApplier {
    constructor(theme){
        this.theme = theme;
        this.filterEl = null;
        this.mediaKey = '';
        this.style = document.createElement('style');
        this.style.id = STYLE_ID;
        this.style.textContent = SHEET;
        document.head.appendChild(this.style);
        this.layer = document.createElement('div');
        this.layer.id = BG_LAYER_ID;
        document.body.prepend(this.layer);
        this.injectFilter();
    }
    injectFilter() {
        if (document.getElementById(FILTER_ID)) return;
        const temp = document.createElement('div');
        temp.innerHTML = FILTER_SVG;
        const svg = temp.firstElementChild;
        if (!svg) return;
        document.body.appendChild(svg);
        this.filterEl = svg;
    }
    apply(settings) {
        this.removeOverrides?.();
        this.removeOverrides = undefined;
        // The `dsh-lg-on` class gates every stylesheet effect rule (frost, lens
        // edges, send-button lens, dialog glass): with the switch OFF nothing
        // visual remains, even though the stylesheet itself stays mounted.
        document.body.classList.toggle('dsh-lg-on', settings.enabled);
        const tokens = buildTokens(settings);
        if (settings.enabled && Object.keys(tokens).length > 0) {
            this.removeOverrides = this.theme.overrideTokens(OVERRIDE_SOURCE, tokens);
        }
        const g = settings.glass;
        const body = document.body;
        body.style.setProperty('--dsh-lg-blur', `${g.frosted ? clampNum(g.blur, 0, 60, DEFAULTS.glass.blur) : 0}px`);
        body.style.setProperty('--dsh-lg-bg-blur', `${clampNum(g.bgBlur, 0, 60, DEFAULTS.glass.bgBlur)}px`);
        body.style.setProperty('--dsh-lg-brightness', String(clampNum(g.brightness, 0.2, 1.6, DEFAULTS.glass.brightness)));
        body.style.setProperty('--dsh-lg-refraction', String(clampNum(g.refraction, 0, 1, DEFAULTS.glass.refraction)));
        body.style.setProperty('--dsh-lg-scrim', scrimValue(settings));
        const tint = scaleTint(g.tint, clampNum(g.glassBrightness, 0.2, 1.6, DEFAULTS.glass.glassBrightness));
        body.style.setProperty('--dsh-lg-tint', tint);
        body.style.setProperty('--dsh-lg-tint-dark', darkGlass(tint));
        body.style.setProperty('--dsh-lg-tool-text-color', g.toolTextColor || '');
        // Update the SVG filter's displacement scale from the live setting.
        if (this.filterEl) {
            const disp = this.filterEl.querySelector('feDisplacementMap');
            if (disp) disp.setAttribute('scale', String(clampNum(g.edgeRefractionScale, 0, 200, DEFAULTS.glass.edgeRefractionScale)));
        }
        this.syncMedia(settings);
    }
    /** Palette flips only refresh the veil; tokens re-stack via the theme service. */ refreshScrim() {
        document.body.style.setProperty('--dsh-lg-scrim', scrimValue(readStoredSettings()));
    }
    /** Build one wallpaper media element (img / video / iframe) for a kind+value. */ buildMedia(kind, value, proxy, muted, demo) {
        const isLocalImage = kind === 'local' && IMAGE_EXTS.includes(value.split('.').pop()?.toLowerCase() ?? '');
        const isLocalVideo = kind === 'local' && VIDEO_EXTS.includes(value.split('.').pop()?.toLowerCase() ?? '');
        if (kind === 'image' || isLocalImage) {
            const img = document.createElement('img');
            img.src = isHttp(value) ? proxied(value, proxy) : localUrl(value);
            img.alt = '';
            return img;
        }
        if (kind === 'video' || isLocalVideo) {
            const video = document.createElement('video');
            video.autoplay = true;
            video.muted = muted;
            video.loop = true;
            video.playsInline = true;
            video.src = isHttp(value) ? proxied(value, proxy) : localUrl(value);
            return video;
        }
        const iframe = document.createElement('iframe');
        // `allow-same-origin` is intentionally omitted for `kind: 'url'` (web
        // links): a third-party page must not access the harness origin (cookies,
        // localStorage, API). Local files (demo.html, uploaded HTML/images/video)
        // need same-origin to load through the wallpaper route, so those fall
        // through to the general sandbox below.
        if (kind === 'url') {
            iframe.setAttribute('sandbox', 'allow-scripts');
        } else {
            iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
        }
        if (kind === 'html' && value.includes('<')) {
            iframe.srcdoc = value;
        } else {
            let src = isHttp(value) ? proxied(value, proxy) : localUrl(value);
            // The built-in demo.html reads its tunables from the query string.
            if (value.trim() === 'demo.html') src += `?${demoQuery(demo)}`;
            iframe.src = src;
        }
        return iframe;
    }
    syncMedia(settings) {
        const w = settings.wallpaper;
        const active = settings.enabled && w.kind !== 'none' && w.value.trim() !== '';
        if (!active) {
            this.mediaKey = '';
            this.layer.replaceChildren();
            return;
        }
        const value = w.value.trim();
        const media = this.buildMedia(w.kind, value, w.proxy, w.muted, settings.demo);
        const src = media.src ?? '';
        const key = `${media.tagName}:${src}:${media.srcdoc ?? ''}`;
        // Rebuild children only when the wallpaper actually changed, so slider
        // tweaks never reload an iframe/video.
        if (key === this.mediaKey && this.layer.children.length > 0) {
            // A mute toggle updates the existing video in place (no reload).
            const existing = this.layer.children[0];
            const next = media;
            if (existing.tagName === 'VIDEO' && typeof next.muted === 'boolean' && existing.muted !== next.muted) {
                existing.muted = next.muted;
            }
            return;
        }
        this.mediaKey = key;
        this.layer.replaceChildren();
        this.layer.appendChild(media);
        const scrim = document.createElement('div');
        scrim.id = SCRIM_ID;
        this.layer.appendChild(scrim);
    }
    dispose() {
        this.removeOverrides?.();
        this.removeOverrides = undefined;
        this.mediaKey = '';
        this.style.remove();
        this.layer.remove();
        this.filterEl?.remove();
        this.filterEl = null;
        document.body.classList.remove('dsh-lg-on');
        const body = document.body;
        for (const name of BODY_VARS)body.style.removeProperty(name);
        // Drop the error banner if one was created during this fiber's lifetime —
        // the div is only ever appended by showBanner() on failure, so removing it
        // here guarantees a disabled/unloaded plugin leaves zero DOM behind.
        document.getElementById('dsh-liquid-glass-error')?.remove();
    }
}
function createPanelStore() {
    return (0, _client.defineStore)({
        init: ()=>({
                settings: {
                    ...DEFAULTS
                },
                revision: -1
            }),
        actions: {
            sync (d, settings, revision) {
                if (revision <= d.revision) return;
                d.settings = {
                    ...settings
                };
                d.revision = revision;
            }
        }
    });
}
// ── settings panel component ────────────────────────────────────────────────
const KIND_LABELS = {
    none: '关闭',
    url: '网页链接',
    html: '本地 HTML / 网页',
    image: '图片',
    video: '视频',
    local: '本地文件'
};
function LiquidGlassPanel({ useStore, update, reset }) {
    const s = useStore((st)=>st.settings);
    const g = s.glass;
    const d = s.demo;
    const w = s.wallpaper;
    const section = {
        padding: '16px 0',
        borderBottom: '1px solid var(--dsw-alias-border-l2)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10
    };
    const row = {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        fontSize: 13,
        color: 'var(--dsw-alias-label-secondary)'
    };
    const input = {
        background: 'var(--dsw-specific-input-major)',
        color: 'var(--dsw-alias-label-primary)',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: 8,
        padding: '6px 10px',
        fontSize: 13,
        minWidth: 0
    };
    const group = {
        padding: '14px 16px',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: 12,
        background: 'var(--dsw-alias-bg-layer-1)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12
    };
    const groupTitle = {
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--dsw-alias-label-primary)'
    };
    const fieldLabel = {
        fontSize: 12,
        color: 'var(--dsw-alias-label-tertiary)'
    };
    const patch = (path, partial)=>update(path, {
            ...s[path],
            ...partial
        });
    /** Upload a picked file to the host wallpaper dir and use it as the value. */ const pickLocalFile = async (e)=>{
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        try {
            const name = await uploadLocalFile(file);
            patch('wallpaper', {
                value: name
            });
        } catch (error) {
            showBanner(`壁纸文件上传失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    };
    const isLocalKind = LOCAL_FILE_KINDS.includes(w.kind);
    const isVideoKind = w.kind === 'video' || w.kind === 'local' && VIDEO_EXTS.includes(w.value.split('.').pop()?.toLowerCase() ?? '');
    return /*#__PURE__*/ (0, _jsxruntime.jsxs)("div", {
        style: {
            width: '100%',
            maxWidth: 560,
            padding: '4px 0 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 22
        },
        children: [
            /*#__PURE__*/ (0, _jsxruntime.jsxs)("div", {
                style: section,
                children: [
                    /*#__PURE__*/ (0, _jsxruntime.jsx)("div", {
                        style: {
                            fontSize: 18,
                            fontWeight: 600,
                            color: 'var(--dsw-alias-label-primary)'
                        },
                        children: "液态玻璃"
                    }),
                    /*#__PURE__*/ (0, _jsxruntime.jsx)("div", {
                        style: {
                            fontSize: 12,
                            color: 'var(--dsw-alias-label-tertiary)'
                        },
                        children: "动态壁纸 + 磨砂玻璃质感。设置保存在浏览器本地。"
                    }),
                    /*#__PURE__*/ (0, _jsxruntime.jsxs)("label", {
                        style: row,
                        children: [
                            /*#__PURE__*/ (0, _jsxruntime.jsx)("span", {
                                children: "启用液态玻璃"
                            }),
                            /*#__PURE__*/ (0, _jsxruntime.jsx)("input", {
                                type: "checkbox",
                                checked: s.enabled,
                                onChange: ()=>update('enabled', !s.enabled)
                            })
                        ]
                    })
                ]
            }),
            /*#__PURE__*/ (0, _jsxruntime.jsxs)("div", {
                style: group,
                children: [
                    /*#__PURE__*/ (0, _jsxruntime.jsx)("div", {
                        style: groupTitle,
                        children: "页面背景"
                    }),
                    /*#__PURE__*/ (0, _jsxruntime.jsxs)("div", {
                        style: {
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6
                        },
                        children: [
                            /*#__PURE__*/ (0, _jsxruntime.jsx)("span", {
                                style: fieldLabel,
                                children: "壁纸类型"
                            }),
                            /*#__PURE__*/ (0, _jsxruntime.jsx)("select", {
                                style: input,
                                value: w.kind,
                                onChange: (e)=>patch('wallpaper', {
                                        kind: e.target.value
                                    }),
                                children: Object.entries(KIND_LABELS).map(([value, label])=>/*#__PURE__*/ (0, _jsxruntime.jsx)("option", {
                                        value: value,
                                        children: label
                                    }, value))
                            }),
                            /*#__PURE__*/ (0, _jsxruntime.jsx)("button", {
                                type: "button",
                                style: {
                                    ...input,
                                    cursor: 'pointer',
                                    alignSelf: 'flex-start'
                                },
                                onClick: ()=>patch('wallpaper', {
                                        kind: 'local',
                                        value: 'demo.html'
                                    }),
                                children: "使用内置演示壁纸 demo.html"
                            }),
                            w.kind !== 'none' && /*#__PURE__*/ (0, _jsxruntime.jsxs)(_jsxruntime.Fragment, {
                                children: [
                                    isLocalKind ? // Local-file kinds: the whole box is a label for a hidden file
                                    // input, so clicking it opens the system file picker; the
                                    // upload writes the file into the host wallpaper dir.
                                    /*#__PURE__*/ (0, _jsxruntime.jsxs)("label", {
                                        style: {
                                            ...input,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            cursor: 'pointer',
                                            padding: 0
                                        },
                                        title: "点击选择本地文件",
                                        children: [
                                            /*#__PURE__*/ (0, _jsxruntime.jsx)("input", {
                                                type: "file",
                                                accept: LOCAL_ACCEPT[w.kind] ?? '',
                                                style: {
                                                    display: 'none'
                                                },
                                                onChange: (e)=>{
                                                    void pickLocalFile(e);
                                                }
                                            }),
                                            /*#__PURE__*/ (0, _jsxruntime.jsx)("span", {
                                                style: {
                                                    flex: 1,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                    padding: '6px 10px'
                                                },
                                                children: w.value.trim() !== '' ? w.value : '点击选择本地文件…'
                                            }),
                                            /*#__PURE__*/ (0, _jsxruntime.jsx)("span", {
                                                style: {
                                                    flex: 'none',
                                                    fontSize: 12,
                                                    color: 'var(--dsw-alias-brand-primary)',
                                                    paddingRight: 10
                                                },
                                                children: "选择文件"
                                            })
                                        ]
                                    }) : /*#__PURE__*/ (0, _jsxruntime.jsx)("input", {
                                        style: input,
                                        placeholder: "网页链接",
                                        value: w.value,
                                        onChange: (e)=>patch('wallpaper', {
                                                value: e.target.value
                                            })
                                    }),
                                    w.kind === 'url' && /*#__PURE__*/ (0, _jsxruntime.jsxs)("label", {
                                        style: row,
                                        children: [
                                            /*#__PURE__*/ (0, _jsxruntime.jsx)("span", {
                                                children: "网页链接走代理（绕过 X-Frame-Options）"
                                            }),
                                            /*#__PURE__*/ (0, _jsxruntime.jsx)("input", {
                                                type: "checkbox",
                                                checked: w.proxy,
                                                onChange: (e)=>patch('wallpaper', {
                                                        proxy: e.target.checked
                                                    })
                                            })
                                        ]
                                    }),
                                    isVideoKind && /*#__PURE__*/ (0, _jsxruntime.jsxs)("label", {
                                        style: row,
                                        children: [
                                            /*#__PURE__*/ (0, _jsxruntime.jsx)("span", {
                                                children: "静音播放（取消后视频带声音，可能被浏览器阻止自动播放）"
                                            }),
                                            /*#__PURE__*/ (0, _jsxruntime.jsx)("input", {
                                                type: "checkbox",
                                                checked: w.muted,
                                                onChange: (e)=>patch('wallpaper', {
                                                        muted: e.target.checked
                                                    })
                                            })
                                        ]
                                    })
                                ]
                            }),
                            /*#__PURE__*/ (0, _jsxruntime.jsxs)("label", {
                                style: row,
                                children: [
                                    /*#__PURE__*/ (0, _jsxruntime.jsxs)("span", {
                                        children: [
                                            "背景模糊（",
                                            g.bgBlur,
                                            "px）"
                                        ]
                                    }),
                                    /*#__PURE__*/ (0, _jsxruntime.jsx)("input", {
                                        type: "range",
                                        min: 0,
                                        max: 60,
                                        step: 1,
                                        value: g.bgBlur,
                                        onChange: (e)=>patch('glass', {
                                                bgBlur: Number(e.target.value)
                                            })
                                    })
                                ]
                            }),
                            /*#__PURE__*/ (0, _jsxruntime.jsxs)("label", {
                                style: row,
                                children: [
                                    /*#__PURE__*/ (0, _jsxruntime.jsxs)("span", {
                                        children: [
                                            "背景亮度（",
                                            g.brightness.toFixed(2),
                                            "）"
                                        ]
                                    }),
                                    /*#__PURE__*/ (0, _jsxruntime.jsx)("input", {
                                        type: "range",
                                        min: 0.2,
                                        max: 1.6,
                                        step: 0.05,
                                        value: g.brightness,
                                        onChange: (e)=>patch('glass', {
                                                brightness: Number(e.target.value)
                                            })
                                    })
                                ]
                            })
                        ]
                    })
                ]
            }),
            w.value.trim() === 'demo.html' && w.kind !== 'none' && /*#__PURE__*/ (0, _jsxruntime.jsxs)("div", {
                style: group,
                children: [
                    /*#__PURE__*/ (0, _jsxruntime.jsx)("div", {
                        style: groupTitle,
                        children: "demo.html 演示壁纸设置"
                    }),
                    /*#__PURE__*/ (0, _jsxruntime.jsxs)("div", {
                        style: {
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6
                        },
                        children: [
                            /*#__PURE__*/ (0, _jsxruntime.jsxs)("label", {
                                style: row,
                                children: [
                                    /*#__PURE__*/ (0, _jsxruntime.jsxs)("span", {
                                        children: [
                                            "动画速度（×",
                                            d.speed.toFixed(1),
                                            "）"
                                        ]
                                    }),
                                    /*#__PURE__*/ (0, _jsxruntime.jsx)("input", {
                                        type: "range",
                                        min: 0.1,
                                        max: 4,
                                        step: 0.1,
                                        value: d.speed,
                                        onChange: (e)=>patch('demo', {
                                                speed: Number(e.target.value)
                                            })
                                    })
                                ]
                            }),
                            /*#__PURE__*/ (0, _jsxruntime.jsxs)("label", {
                                style: row,
                                children: [
                                    /*#__PURE__*/ (0, _jsxruntime.jsxs)("span", {
                                        children: [
                                            "色块数量（",
                                            d.blobs,
                                            " 个）"
                                        ]
                                    }),
                                    /*#__PURE__*/ (0, _jsxruntime.jsx)("input", {
                                        type: "range",
                                        min: 1,
                                        max: 6,
                                        step: 1,
                                        value: d.blobs,
                                        onChange: (e)=>patch('demo', {
                                                blobs: Number(e.target.value)
                                            })
                                    })
                                ]
                            }),
                            /*#__PURE__*/ (0, _jsxruntime.jsxs)("label", {
                                style: row,
                                children: [
                                    /*#__PURE__*/ (0, _jsxruntime.jsxs)("span", {
                                        children: [
                                            "颜色变化（",
                                            d.colorCycle,
                                            "/10，0=静态）"
                                        ]
                                    }),
                                    /*#__PURE__*/ (0, _jsxruntime.jsx)("input", {
                                        type: "range",
                                        min: 0,
                                        max: 10,
                                        step: 1,
                                        value: d.colorCycle,
                                        onChange: (e)=>patch('demo', {
                                                colorCycle: Number(e.target.value)
                                            })
                                    })
                                ]
                            }),
                            /*#__PURE__*/ (0, _jsxruntime.jsxs)("label", {
                                style: row,
                                children: [
                                    /*#__PURE__*/ (0, _jsxruntime.jsxs)("span", {
                                        children: [
                                            "色块模糊（",
                                            d.blur,
                                            "px）"
                                        ]
                                    }),
                                    /*#__PURE__*/ (0, _jsxruntime.jsx)("input", {
                                        type: "range",
                                        min: 10,
                                        max: 140,
                                        step: 5,
                                        value: d.blur,
                                        onChange: (e)=>patch('demo', {
                                                blur: Number(e.target.value)
                                            })
                                    })
                                ]
                            }),
                            /*#__PURE__*/ (0, _jsxruntime.jsxs)("label", {
                                style: row,
                                children: [
                                    /*#__PURE__*/ (0, _jsxruntime.jsxs)("span", {
                                        children: [
                                            "色块不透明度（",
                                            d.opacity.toFixed(2),
                                            "）"
                                        ]
                                    }),
                                    /*#__PURE__*/ (0, _jsxruntime.jsx)("input", {
                                        type: "range",
                                        min: 0.2,
                                        max: 1,
                                        step: 0.05,
                                        value: d.opacity,
                                        onChange: (e)=>patch('demo', {
                                                opacity: Number(e.target.value)
                                            })
                                    })
                                ]
                            }),
                            /*#__PURE__*/ (0, _jsxruntime.jsxs)("label", {
                                style: row,
                                children: [
                                    /*#__PURE__*/ (0, _jsxruntime.jsx)("span", {
                                        children: "背景渐变流动"
                                    }),
                                    /*#__PURE__*/ (0, _jsxruntime.jsx)("input", {
                                        type: "checkbox",
                                        checked: d.wash,
                                        onChange: (e)=>patch('demo', {
                                                wash: e.target.checked
                                            })
                                    })
                                ]
                            })
                        ]
                    })
                ]
            }),
            /*#__PURE__*/ (0, _jsxruntime.jsxs)("div", {
                style: group,
                children: [
                    /*#__PURE__*/ (0, _jsxruntime.jsx)("div", {
                        style: groupTitle,
                        children: "输入卡片 · 磨砂玻璃"
                    }),
                    /*#__PURE__*/ (0, _jsxruntime.jsxs)("div", {
                        style: {
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6
                        },
                        children: [
                            /*#__PURE__*/ (0, _jsxruntime.jsxs)("label", {
                                style: row,
                                children: [
                                    /*#__PURE__*/ (0, _jsxruntime.jsx)("span", {
                                        children: "磨砂效果"
                                    }),
                                    /*#__PURE__*/ (0, _jsxruntime.jsx)("input", {
                                        type: "checkbox",
                                        checked: g.frosted,
                                        onChange: (e)=>patch('glass', {
                                                frosted: e.target.checked
                                            })
                                    })
                                ]
                            }),
                            /*#__PURE__*/ (0, _jsxruntime.jsxs)("label", {
                                style: row,
                                children: [
                                    /*#__PURE__*/ (0, _jsxruntime.jsxs)("span", {
                                        children: [
                                            "磨砂强度（",
                                            g.blur,
                                            "px）"
                                        ]
                                    }),
                                    /*#__PURE__*/ (0, _jsxruntime.jsx)("input", {
                                        type: "range",
                                        min: 0,
                                        max: 60,
                                        step: 1,
                                        value: g.blur,
                                        onChange: (e)=>patch('glass', {
                                                blur: Number(e.target.value)
                                            })
                                    })
                                ]
                            }),
                            /*#__PURE__*/ (0, _jsxruntime.jsxs)("label", {
                                style: row,
                                children: [
                                    /*#__PURE__*/ (0, _jsxruntime.jsxs)("span", {
                                        children: [
                                            "边缘折射（",
                                            g.refraction.toFixed(2),
                                            "）"
                                        ]
                                    }),
                                    /*#__PURE__*/ (0, _jsxruntime.jsx)("input", {
                                        type: "range",
                                        min: 0,
                                        max: 1,
                                        step: 0.05,
                                        value: g.refraction,
                                        onChange: (e)=>patch('glass', {
                                                refraction: Number(e.target.value)
                                            })
                                    })
                                ]
                            }),
                            /*#__PURE__*/ (0, _jsxruntime.jsxs)("label", {
                                style: row,
                                children: [
                                    /*#__PURE__*/ (0, _jsxruntime.jsx)("span", {
                                        children: "玻璃颜色"
                                    }),
                                    /*#__PURE__*/ (0, _jsxruntime.jsxs)("span", {
                                        style: {
                                            display: 'flex',
                                            gap: 8,
                                            alignItems: 'center'
                                        },
                                        children: [
                                            /*#__PURE__*/ (0, _jsxruntime.jsx)("input", {
                                                type: "color",
                                                value: /^#[0-9a-f]{6}$/i.test(g.tint) ? g.tint : '#ffffff',
                                                onChange: (e)=>patch('glass', {
                                                        tint: e.target.value
                                                    })
                                            }),
                                            /*#__PURE__*/ (0, _jsxruntime.jsx)("input", {
                                                style: {
                                                    ...input,
                                                    width: 90
                                                },
                                                value: g.tint,
                                                onChange: (e)=>patch('glass', {
                                                        tint: e.target.value
                                                    })
                                            })
                                        ]
                                    })
                                ]
                            }),
                            /*#__PURE__*/ (0, _jsxruntime.jsxs)("label", {
                                style: row,
                                children: [
                                    /*#__PURE__*/ (0, _jsxruntime.jsxs)("span", {
                                        children: [
                                            "玻璃不透明度（",
                                            g.tintOpacity.toFixed(2),
                                            "）"
                                        ]
                                    }),
                                    /*#__PURE__*/ (0, _jsxruntime.jsx)("input", {
                                        type: "range",
                                        min: 0,
                                        max: 1,
                                        step: 0.05,
                                        value: g.tintOpacity,
                                        onChange: (e)=>patch('glass', {
                                                tintOpacity: Number(e.target.value)
                                            })
                                    })
                                ]
                            }),
                            /*#__PURE__*/ (0, _jsxruntime.jsxs)("label", {
                                style: row,
                                children: [
                                    /*#__PURE__*/ (0, _jsxruntime.jsxs)("span", {
                                        children: [
                                            "玻璃亮度（",
                                            g.glassBrightness.toFixed(2),
                                            "）"
                                        ]
                                    }),
                                    /*#__PURE__*/ (0, _jsxruntime.jsx)("input", {
                                        type: "range",
                                        min: 0.2,
                                        max: 1.6,
                                        step: 0.05,
                                        value: g.glassBrightness,
                                        onChange: (e)=>patch('glass', {
                                                glassBrightness: Number(e.target.value)
                                            })
                                    })
                                ]
                            }),
                            /*#__PURE__*/ (0, _jsxruntime.jsxs)("label", {
                                style: row,
                                children: [
                                    /*#__PURE__*/ (0, _jsxruntime.jsxs)("span", {
                                        children: [
                                            "边缘折射（",
                                            g.edgeRefractionScale,
                                            "）"
                                        ]
                                    }),
                                    /*#__PURE__*/ (0, _jsxruntime.jsx)("input", {
                                        type: "range",
                                        min: 0,
                                        max: 200,
                                        step: 5,
                                        value: g.edgeRefractionScale,
                                        onChange: (e)=>patch('glass', {
                                                edgeRefractionScale: Number(e.target.value)
                                            })
                                    })
                                ]
                            })
                        ]
                    })
                ]
            }),
            /*#__PURE__*/ (0, _jsxruntime.jsxs)("div", {
                style: group,
                children: [
                    /*#__PURE__*/ (0, _jsxruntime.jsx)("div", {
                        style: groupTitle,
                        children: "代码与文字"
                    }),
                    /*#__PURE__*/ (0, _jsxruntime.jsxs)("div", {
                        style: {
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6
                        },
                        children: [
                            /*#__PURE__*/ (0, _jsxruntime.jsxs)("label", {
                                style: row,
                                children: [
                                    /*#__PURE__*/ (0, _jsxruntime.jsxs)("span", {
                                        children: [
                                            "代码块背景（",
                                            g.codeBlockOpacity.toFixed(2),
                                            "）"
                                        ]
                                    }),
                                    /*#__PURE__*/ (0, _jsxruntime.jsx)("input", {
                                        type: "range",
                                        min: 0.2,
                                        max: 1,
                                        step: 0.05,
                                        value: g.codeBlockOpacity,
                                        onChange: (e)=>patch('glass', {
                                                codeBlockOpacity: Number(e.target.value)
                                            })
                                    })
                                ]
                            }),
                            /*#__PURE__*/ (0, _jsxruntime.jsxs)("label", {
                                style: row,
                                children: [
                                    /*#__PURE__*/ (0, _jsxruntime.jsx)("span", {
                                        children: "操作文字颜色"
                                    }),
                                    /*#__PURE__*/ (0, _jsxruntime.jsxs)("span", {
                                        style: {
                                            display: 'flex',
                                            gap: 8,
                                            alignItems: 'center'
                                        },
                                        children: [
                                            /*#__PURE__*/ (0, _jsxruntime.jsx)("input", {
                                                type: "color",
                                                value: /^#[0-9a-f]{6}$/i.test(g.toolTextColor) ? g.toolTextColor : '#ffffff',
                                                onChange: (e)=>patch('glass', {
                                                        toolTextColor: e.target.value
                                                    })
                                            }),
                                            /*#__PURE__*/ (0, _jsxruntime.jsx)("input", {
                                                style: {
                                                    ...input,
                                                    width: 90
                                                },
                                                value: g.toolTextColor || '(默认)',
                                                onChange: (e)=>patch('glass', {
                                                        toolTextColor: e.target.value
                                                    })
                                            })
                                        ]
                                    })
                                ]
                            })
                        ]
                    })
                ]
            }),
            /*#__PURE__*/ (0, _jsxruntime.jsx)("button", {
                type: "button",
                style: {
                    ...input,
                    alignSelf: 'flex-start',
                    cursor: 'pointer'
                },
                onClick: reset,
                children: "恢复默认"
            })
        ]
    });
}
const inject = [
    'slots',
    'locale',
    'theme'
];
/** Show a visible in-page banner so apply outcome is observable without devtools. */ function showBanner(message, color = '#b91c1c') {
    try {
        let el = document.getElementById('dsh-liquid-glass-error');
        if (!el) {
            el = document.createElement('div');
            el.id = 'dsh-liquid-glass-error';
            el.style.cssText = `position:fixed;top:8px;right:8px;z-index:99999;max-width:70vw;background:${color};color:#fff;` + 'font:12px/1.5 system-ui,sans-serif;padding:8px 12px;border-radius:8px;' + 'box-shadow:0 4px 16px rgba(0,0,0,.35);white-space:pre-wrap;pointer-events:none;';
            document.body.appendChild(el);
        }
        el.textContent = `[liquid-glass] ${message}`;
    } catch  {
    /* banner must never throw */ }
}
/** Run a step and swallow+report failures so the theme can never fail the web boot. */ function safe(step, fn) {
    try {
        fn();
    } catch (error) {
        const message = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error);
        console.error(`[liquid-glass] ${step} failed:`, error);
        showBanner(`${step} failed: ${message}`);
    }
}
function apply(ctx) {
    try {
        applyCore(ctx);
    } catch (error) {
        const message = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error);
        console.error('[liquid-glass] apply failed:', error);
        showBanner(`apply failed: ${message}`);
    }
}
function applyCore(ctx) {
    const client = ctx;
    let current = readStoredSettings();
    let revision = 0;
    let applier;
    const store = createPanelStore();
    let boundActions;
    const publish = ()=>{
        revision += 1;
        boundActions?.sync(current, revision);
        applier?.apply(current);
    };
    // DOM applier: created with the fiber, retracts everything on dispose.
    client.effect(()=>{
        applier = new LiquidGlassApplier(client.theme);
        applier.apply(current);
        return ()=>{
            applier?.dispose();
            applier = undefined;
        };
    }, 'liquid-glass: DOM applier');
    // Palette flips only refresh the readability veil (token layers re-stack
    // through the theme service itself).
    const offThemeChange = client.on?.('theme/change', ()=>safe('theme-change scrim', ()=>applier?.refreshScrim()));
    client.effect(()=>offThemeChange, 'liquid-glass: theme-change scrim');
    // Model menu behaviour: clicking the composer model selector opens a two-pane
    // menu (a "root" pane all-in-one list, then a model list). Users asked to skip
    // the intermediate root pane and jump straight to the model list, render it in
    // two columns (see SHEET), and dismiss it by clicking empty space.
    // Implementation: a MutationObserver watches for the full-screen model menu
    // to appear; while the root pane (first child, not .scrollable) is visible we
    // programmatically click its "模型/Model" menuitem to advance to the model
    // list. A capture-phase click listener dismisses the menu when the backdrop
    // (the menu container itself) is clicked. Everything is gated on the theme
    // being enabled and retracted on dispose.
    client.effect(()=>{
        let observer;
        const navigate = ()=>{
            if (!document.body.classList.contains('dsh-lg-on')) return;
            const menu = document.querySelector('[data-composer-card] [role="menu"]');
            if (!menu) return;
            // ONLY drive the FULL-SCREEN model/effort selector: it renders .scrollable
            // and was styled position:fixed. Other [role="menu"] popovers inside the
            // composer card — e.g. the access-mode dropdown (no .scrollable, default
            // positioning) — must keep their own normal interaction and not be
            // auto-navigated or auto-clicked here.
            if (getComputedStyle(menu).position !== 'fixed') return;
            // Already looking at the model list? Do nothing.
            const scrollable = menu.querySelector('.scrollable');
            if (scrollable && getComputedStyle(scrollable).display !== 'none') return;
            // Root pane visible (first child that isn't .scrollable), and actually
            // being shown → find and click the "Model" cell. Guard against duplicate
            // dispatches with a transient flag so React state settles.
            const rootPane = Array.from(menu.children).find((n)=>!(n instanceof HTMLElement) || !n.classList.contains('scrollable'));
            if (!rootPane) return;
            const style = getComputedStyle(rootPane);
            if (style.display === 'none' || style.visibility === 'hidden') return;
            if (rootPane.dataset.lgSkipHandled === '1') return;
            rootPane.dataset.lgSkipHandled = '1';
            const cells = Array.from(rootPane.querySelectorAll('button[role="menuitem"]'));
            const modelCell = cells.find((b)=>/模型|model/i.test(b.textContent ?? '')) ?? cells[0];
            if (!modelCell) {
                // Nothing clickable yet — clear the flag so a later pass can retry.
                delete rootPane.dataset.lgSkipHandled;
                return;
            }
            // Defer so the menu has settled into the DOM before we click it.
            requestAnimationFrame(()=>{
                try {
                    modelCell.click();
                } catch  {
                /* the cell may have been removed already */ } finally{
                    delete rootPane.dataset.lgSkipHandled;
                }
            });
        };
        // Catch the menu being added/removed, and re-run once after React settles.
        observer = new MutationObserver(()=>{
            navigate();
            requestAnimationFrame(()=>navigate());
        });
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        // Click empty area → dismiss. The full-screen menu is display:flex centering
        // its panels; a click whose target is the menu container itself (the backdrop
        // area outside the panels) closes it with an Escape key event.
        const dismiss = (e)=>{
            if (!document.body.classList.contains('dsh-lg-on')) return;
            const menu = document.querySelector('[data-composer-card] [role="menu"]');
            if (!menu || !menu.isConnected) return;
            // Only the full-screen model selector dismisses on backdrop click; a
            // normal small dropdown (access mode) must not be force-closed.
            if (getComputedStyle(menu).position !== 'fixed') return;
            const target = e.target;
            if (target !== menu) return;
            menu.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Escape',
                bubbles: true,
                cancelable: true
            }));
        };
        document.addEventListener('click', dismiss, true);
        return ()=>{
            observer?.disconnect();
            document.removeEventListener('click', dismiss, true);
        };
    }, 'liquid-glass: model menu behaviour');
    // Water-drop settings icon. The settings shell picks a nav glyph per section
    // id via a HARD-CODED map (see `navIcon` in dsh-client-ui-settings-general):
    // ids it doesn't know — including ours, `liquid-glass` — all fall back to the
    // settings GEAR (IconSettingsOutline16). We can't add our id to that compiled
    // map without forking the shell, so this effect swaps the gear in OUR section's
    // nav row for a water-drop (Lucide "droplet", ISC license) at render time. A
    // MutationObserver re-applies it whenever the settings dialog re-renders (the
    // shell re-mounts the row on selection/locale changes, dropping our svg back
    // to the gear); the `.lg-watermark` class is the guard that stops a replace
    // loop (we only write when our marker is absent). Disposed with the fiber.
    client.effect(()=>{
        const applyIcon = ()=>{
            if (!document.body.classList.contains('dsh-lg-on')) return;
            // The Liquid Glass section nav label we registered — the match key for
            // our row. (The button's textContent is exactly this, since the icon svg
            // contributes no text.)
            const OUR_LABEL = '液态玻璃';
            const dialog = document.querySelector('[role="dialog"]');
            if (!dialog) return;
            const cell = Array.from(dialog.querySelectorAll('button')).find((b)=>b.textContent?.trim() === OUR_LABEL);
            if (!cell) return;
            const iconSlot = cell.firstElementChild;
            if (!iconSlot) return;
            if (cell.querySelector('.lg-watermark')) return; // already ours
            iconSlot.innerHTML = '<svg class="lg-watermark" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>';
        };
        applyIcon();
        const observer = new MutationObserver(()=>{
            applyIcon();
            requestAnimationFrame(()=>applyIcon());
        });
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        return ()=>{
            observer.disconnect();
        };
    }, 'liquid-glass: settings water icon');
    // Cross-tab sync: another tab persisted a settings change.
    client.effect(()=>{
        const onStorage = (event)=>{
            if (event.key !== null && event.key !== STORAGE_KEY) return;
            current = readStoredSettings();
            publish();
        };
        window.addEventListener('storage', onStorage);
        return ()=>{
            window.removeEventListener('storage', onStorage);
        };
    }, 'liquid-glass: storage sync');
    const commit = ()=>{
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
        } catch  {
        // Quota exceeded: keep the in-memory state so this session still works.
        }
        publish();
    };
    const update = (path, value)=>{
        const patch = {
            ...current
        };
        patch[path] = value;
        current = sanitizeSettings(patch);
        commit();
    };
    const reset = ()=>{
        current = {
            ...DEFAULTS
        };
        commit();
    };
    const injected = (actions)=>{
        boundActions = actions;
        publish();
        return {
            update,
            reset
        };
    };
    // Settings page: registered as a top-level `settings.section`, so it gets
    // its own nav row beside 通用设置 / 模型 / 插件 (guarded: the section slot
    // may not exist in every surface).
    if (client.slots) {
        safe('settings panel registration', ()=>{
            client.slots.inject('settings.section', ()=>client.slots.register({
                    name: 'settings.section',
                    id: 'liquid-glass',
                    order: 100,
                    label: '液态玻璃',
                    store,
                    inject: injected
                }, LiquidGlassPanel));
        });
    }
}

		return module.exports;
	}
});
