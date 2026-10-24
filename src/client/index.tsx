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
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis';
import type { ThemeTokenOverrides } from '@deepseek-ai/dsh-client-ui-theme/client';
import { defineStore } from '@deepseek-ai/dsh-client-store';
import type { ChangeEvent, CSSProperties } from 'react';
import { useCallback, useEffect, useState } from 'react';
import type { LiquidGlassSettings, WallpaperKind } from '../shared';

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
 *  element. */
const FILTER_SVG = `<svg id="${FILTER_ID}" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:fixed;pointer-events:none;visibility:hidden;top:0;left:0;overflow:hidden">
  <filter id="${EDGE_FILTER_ID}" x="-10%" y="-10%" width="120%" height="120%" filterUnits="objectBoundingBox" color-interpolation-filters="sRGB">
    <feDisplacementMap scale="80"/>
  </filter>
</svg>`;

const DEFAULTS: LiquidGlassSettings = {
  enabled: true,
  wallpaper: { kind: 'local', value: 'demo.html', proxy: false, muted: true },
  demo: { speed: 1, blobs: 6, colorCycle: 4, blur: 65, opacity: 0.85, wash: true },
  glass: { frosted: true, blur: 24, bgBlur: 5, refraction: 0.4, tint: '#ffffff', tintOpacity: 0.35, toolTextColor: '', codeBlockOpacity: 0.7, glassBrightness: 1, brightness: 1, edgeRefractionScale: 80 },
};

const WALLPAPER_KINDS: readonly WallpaperKind[] = ['none', 'url', 'html', 'image', 'video', 'local'];

/** Kinds whose value is a LOCAL file (click-to-pick opens the system file dialog). */
const LOCAL_FILE_KINDS: readonly WallpaperKind[] = ['local', 'html', 'image', 'video'];

/** <input type="file"> accept filter per local-file kind. */
const LOCAL_ACCEPT: Record<string, string> = {
  html: '.html,.htm',
  image: 'image/*',
  video: 'video/*',
  local: '.html,.htm,image/*,video/*',
};

/**
 * Upload a picked file to the host wallpaper dir and return the stored name.
 * The host names the file `lg-<timestamp>-<sanitized-original>` and serves it
 * back through /liquid-glass/wallpaper/<name>.
 */
async function uploadLocalFile(file: File): Promise<string> {
  const body = await file.arrayBuffer();
  const res = await fetch(`${UPLOAD_ROUTE}?name=${encodeURIComponent(file.name)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/octet-stream' },
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
  let data: { name?: unknown };
  try {
    data = JSON.parse(text) as { name?: unknown };
  } catch {
    throw new Error('无效的上传响应');
  }
  if (typeof data.name !== 'string' || data.name === '') throw new Error('上传响应缺少文件名');
  return data.name;
}

const clampNum = (v: unknown, min: number, max: number, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Validate + clamp one parsed settings document (hand-edited or stale
 * localStorage can never produce invalid CSS this way). */
function sanitizeSettings(raw: unknown): LiquidGlassSettings {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ...DEFAULTS };
  const s = raw as Record<string, unknown>;
  const w = (typeof s.wallpaper === 'object' && s.wallpaper !== null ? s.wallpaper : {}) as Record<string, unknown>;
  const d = (typeof s.demo === 'object' && s.demo !== null ? s.demo : {}) as Record<string, unknown>;
  const g = (typeof s.glass === 'object' && s.glass !== null ? s.glass : {}) as Record<string, unknown>;
  const kind: WallpaperKind = WALLPAPER_KINDS.includes(w.kind as WallpaperKind)
    ? (w.kind as WallpaperKind)
    : DEFAULTS.wallpaper.kind;
  return {
    enabled: typeof s.enabled === 'boolean' ? s.enabled : DEFAULTS.enabled,
    wallpaper: {
      kind,
      value: typeof w.value === 'string' ? w.value : DEFAULTS.wallpaper.value,
      proxy: typeof w.proxy === 'boolean' ? w.proxy : DEFAULTS.wallpaper.proxy,
      muted: typeof w.muted === 'boolean' ? w.muted : DEFAULTS.wallpaper.muted,
    },
    demo: {
      speed: clampNum(d.speed, 0.1, 4, DEFAULTS.demo.speed),
      blobs: Math.round(clampNum(d.blobs, 1, 6, DEFAULTS.demo.blobs)),
      colorCycle: Math.round(clampNum(d.colorCycle, 0, 10, DEFAULTS.demo.colorCycle)),
      blur: Math.round(clampNum(d.blur, 10, 140, DEFAULTS.demo.blur)),
      opacity: clampNum(d.opacity, 0.2, 1, DEFAULTS.demo.opacity),
      wash: typeof d.wash === 'boolean' ? d.wash : DEFAULTS.demo.wash,
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
      edgeRefractionScale: clampNum(g.edgeRefractionScale, 0, 200, DEFAULTS.glass.edgeRefractionScale),
    },
  };
}

function readStoredSettings(): LiquidGlassSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return { ...DEFAULTS };
    return sanitizeSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULTS };
  }
}

/** Hex → rgba() string. */
function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return `rgba(255, 255, 255, ${alpha})`;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Dark-palette glass color: the tint scaled toward black (Apple's dark glass
 * material is a translucent near-black with the same hue family). */
function darkGlass(color: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return '#26262b';
  const n = parseInt(m[1], 16);
  const r = Math.round(((n >> 16) & 0xff) * 0.2);
  const g = Math.round(((n >> 8) & 0xff) * 0.2);
  const b = Math.round((n & 0xff) * 0.2);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** Scale a hex color's lightness: factor > 1 mixes toward white, < 1 toward
 * black (the glass material brightness — the card surface gets lighter /
 * darker without touching the hue). factor 1 is the identity. */
function scaleTint(hex: string, factor: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  let r = (n >> 16) & 0xff;
  let g = (n >> 8) & 0xff;
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
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/**
 * Build the glass token override layer. Plain rgba() strings only; values are
 * `{ light, dark }` pairs so the theme service can pick per color scheme.
 */
function buildTokens(s: LiquidGlassSettings): ThemeTokenOverrides {
  const g = s.glass;
  const a = clamp01(g.tintOpacity);
  // The glass material brightness scales the tint lightness; every glass
  // surface (card, bubbles, dock, menus) follows the same tint.
  const tint = scaleTint(g.tint, clampNum(g.glassBrightness, 0.2, 1.6, 1));
  const glass = (alpha: number) => ({
    light: hexToRgba(tint, clamp01(alpha)),
    dark: hexToRgba(darkGlass(tint), clamp01(alpha)),
  });
  const edges = (strength: number, darkStrength = strength) => ({
    light: `rgba(0, 0, 0, ${clamp01(g.refraction * strength)})`,
    dark: `rgba(255, 255, 255, ${clamp01(g.refraction * darkStrength)})`,
  });
  const wallpaperActive = s.wallpaper.kind !== 'none' && s.wallpaper.value.trim() !== '';
  const t: ThemeTokenOverrides = {};
  const set = (name: string, v: { light: string; dark: string }) => {
    t[name] = v;
  };
  // Base canvas: transparent when a wallpaper shows through, else translucent glass.
  set('--dsw-alias-bg-base', wallpaperActive ? { light: 'transparent', dark: 'transparent' } : glass(a * 0.3));
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
  // Text contrast in LIGHT mode. The harness greys are tuned for an OPAQUE white
  // canvas (label-secondary #61666b, label-tertiary #81858c, label-caption
  // #adb2b8 = about 2.1:1), but this theme paints translucent surfaces over a
  // wallpaper, which eats the remaining contrast. Push the light-mode steps one
  // to two shades darker (bluish-850 / 750 / 700) so secondary text, subtitles
  // and captions stay readable. Dark mode already sits on dark surfaces, so it
  // keeps the harness values via the static tokens.
  const darkLabel = (step: number) => `var(--dsw-static-neutral-bluish-${step})`;
  set('--dsw-alias-label-secondary', { light: '#2c2c2e', dark: darkLabel(300) });
  set('--dsw-alias-label-tertiary', { light: '#43454a', dark: darkLabel(400) });
  set('--dsw-alias-label-caption', { light: '#61666b', dark: darkLabel(600) });
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
 */
const SHEET = `
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
/* ── Workaround for a harness bug: tooltips inside the composer ───────────────
   DSH renders its tooltips as an inline span[role=tooltip] (the primitives'
   Tooltip defaults to portal: false) whose class is position: fixed, while the
   coordinates it writes are VIEWPORT coordinates from getBoundingClientRect().
   A fixed element is only positioned against the viewport while no ancestor
   creates a containing block for it — and three harness elements on this path
   declare container-type: inline-size, which implies layout containment and
   therefore a containing block for fixed descendants:

     .RlGAzG_row     the composer's bottom row (the send button sits inside it)
     .xz4KEq_scroll  the transcript's own scroll container (overflow-y: auto), in
                     which the composer is sticky
     .xz4KEq_frame   the chat frame wrapping both

   So on hover the bubble is placed at, say, top: 900px INSIDE a ~40px row: far
   off screen, and — because it lands inside a scroll container — it inflates
   that container's scrollable area, which makes the transcript jump to the top
   and leaves the page wheel-scrollable. It reproduces with or without any theme;
   this block only suppresses it while this theme is on.

   Turning the containment off restores the viewport as the containing block, so
   the bubbles land where the code always intended. Cost: the four narrow-window
   @container tweaks that resolved against these boxes stop matching (the composer
   keeps 12px gaps instead of 8px below 560px, and a few trigger labels no longer
   collapse below 540 / 480 / 460px). Two other queries are unaffected: the
   turn-rail hide resolves against .xpvNua_slot's own container, and the
   deliverables card declares its own. Drop this block once DSH portals tooltips. */
body.dsh-lg-on [data-composer-card] [class*="_row"],
body.dsh-lg-on [data-conversation-scroll],
body.dsh-lg-on [class*="_frame"]:has([data-conversation-scroll]) {
  container-type: normal;
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
/* ── Surfaces the glass recipe left see-through ───────────────────────────────
   Four places where "translucent surface" went too far. Each gets a real fill
   plus the same backdrop blur, at an opacity that stays legible (78%, and 84%
   for the file preview, which has to read like a panel).
   All four are anchored on the harness's own stable data-/role attributes: the
   CSS-module class names are build-time hashes and must never be selectors. */
/* 1 + 2. The choice dialog. user-questions renders it as a card above the
   composer ([data-question-key]) and the plan-review panel exactly the same way
   ([data-plan-review-key]); NEITHER carries role="dialog", so the settings-dialog
   rule above never reached them — that is why they had no blur and no fill. Their
   fill comes from --dsw-specific-input-major, which this theme sets to
   glass(0.35); that token is shared with the composer input box, so the fix is
   scoped to these two cards rather than the token. */
body.dsh-lg-on [data-question-key] [class*="_card"],
body.dsh-lg-on [data-plan-review-key] [class*="_card"] {
  background: color-mix(in srgb, var(--dsh-lg-tint, #ffffff) 78%, transparent);
  -webkit-backdrop-filter: blur(var(--dsh-lg-blur, 24px)) saturate(160%);
  backdrop-filter: blur(var(--dsh-lg-blur, 24px)) saturate(160%);
  border: 1px solid rgba(255, 255, 255, 0.16);
}
/* 3. The changed-files hover preview. The floating surface is HoverCard's card
   (className Gn.card + Gn.preview), whose own fill is
   background: var(--dsw-alias-bg-layer-1) — a token this theme sets to
   glass(0.55), so the panel reads as see-through. Its class is a build-time hash
   and its positioning style is inline, so the surface is matched as the element
   that DIRECTLY wraps the harness's stable [data-changes-hover-preview]
   attribute (verified in the primitives bundle: the card renders the preview
   content as its child). Specificity must beat the module rule, hence the
   body.dsh-lg-on prefix. The surface keeps its own radius, shadow and zero
   padding, so painting it is enough — the inner element stays untouched. */
body.dsh-lg-on *:has(> [data-changes-hover-preview]) {
  background: color-mix(in srgb, var(--dsh-lg-tint, #ffffff) 84%, transparent);
  -webkit-backdrop-filter: blur(var(--dsh-lg-blur, 24px)) saturate(160%);
  backdrop-filter: blur(var(--dsh-lg-blur, 24px)) saturate(160%);
}
/* 4 + 5. Two surfaces that DO paint a background, but from tokens this theme makes
   faint: the edited-files card at the end of a turn (--dsw-alias-bg-layer-1 is
   glass(0.55)) and the question/answer receipt bubble in the transcript
   (--dsw-specific-bubble is glass(0.5)). Both keep their stock border/shape, so
   only the fill and the blur are added. */
body.dsh-lg-on [data-changed-files],
body.dsh-lg-on [data-question-reply] [class*="_bubble"] {
  background: color-mix(in srgb, var(--dsh-lg-tint, #ffffff) 78%, transparent);
  -webkit-backdrop-filter: blur(var(--dsh-lg-blur, 24px)) saturate(160%);
  backdrop-filter: blur(var(--dsh-lg-blur, 24px)) saturate(160%);
}
body[data-ds-dark-theme].dsh-lg-on [data-question-key] [class*="_card"],
body[data-ds-dark-theme].dsh-lg-on [data-plan-review-key] [class*="_card"] {
  background: color-mix(in srgb, var(--dsh-lg-tint-dark, #333333) 78%, transparent);
  border-color: rgba(255, 255, 255, 0.08);
}
body[data-ds-dark-theme].dsh-lg-on *:has(> [data-changes-hover-preview]) {
  background: color-mix(in srgb, var(--dsh-lg-tint-dark, #333333) 84%, transparent);
}
body[data-ds-dark-theme].dsh-lg-on [data-changed-files],
body[data-ds-dark-theme].dsh-lg-on [data-question-reply] [class*="_bubble"] {
  background: color-mix(in srgb, var(--dsh-lg-tint-dark, #333333) 78%, transparent);
}
/* User message bubbles: the same frosted glass + lens edge as the composer
   card, so sent messages read as one material family. backdrop-filter rides
   the ::before pseudo (isolation + z-index:-1), never the bubble itself.
   The anchor is a dual selector on purpose: harness <=0.1.x wrapped the
   transcript in [data-time-hover-root], while harness >=0.2 dropped that
   attribute and the scroll container is [data-conversation-scroll]. Listing
   both keeps one stylesheet working on either runtime. */
[data-time-hover-root] [class*="_bubble"],
[data-conversation-scroll] [class*="_bubble"] {
  position: relative;
  isolation: isolate;
}
body.dsh-lg-on [data-time-hover-root] [class*="_bubble"]::before,
body.dsh-lg-on [data-conversation-scroll] [class*="_bubble"]::before {
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
body[data-ds-dark-theme].dsh-lg-on [data-time-hover-root] [class*="_bubble"]::before,
body[data-ds-dark-theme].dsh-lg-on [data-conversation-scroll] [class*="_bubble"]::before {
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
   blur layer never re-anchors anything).
   EVERY rule for this bar carries a DUAL header anchor:
     - header:has([role="tablist"]) — harness <=0.1.x, where the view tabs
       live inside the header (so the bar is only matched once tabs render);
     - [data-slot="conversation.header"] > header — harness >=0.2, where the
       mark-up is div[data-phase] > [data-slot="conversation.header"]
       (display:contents) > header, and the tablist is conditional, so this
       arm is what keeps the frost on a single-view session (no 轨迹 tab).
   Keep both arms: dropping either regresses one runtime. */
body.dsh-lg-on [data-slot="conversation.header"] > header,
body.dsh-lg-on header:has([role="tablist"]) {
  isolation: isolate;
  /* The stock header paints its hairline as a real
     border-bottom (.5px solid, --dsw-alias-border-l3), which this theme turns
     into a bright white line — and with the bar now floating over the
     transcript it reads as a white seam between the bar and the chat. The
     boundary must be seamless, so drop the border itself (not just a pseudo). */
  border-bottom: none;
}
body.dsh-lg-on [data-slot="conversation.header"] > header::before,
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
/* Drop the header's bottom hairline pseudo as well: harness <=0.1.x painted the
   separator with an ::after element (harness >=0.2 has no such pseudo — there the
   hairline is the real border-bottom removed by the rule above), so keep this
   arm for the older runtime. */
body.dsh-lg-on [data-slot="conversation.header"] > header::after,
body.dsh-lg-on header:has([role="tablist"])::after {
  display: none;
}
/* The bar FLOATS OVER the scrolling message list. On harness >=0.2 the layout is
   div[data-phase].root (display:flex column, position:relative) >
   [data-slot="conversation.header"] (display:contents) > header, followed by
   the content seat, so taking the header out of flow lets the message list fill
   the full height and glide UNDER the bar, frosted by the gradient above:
   strong blur at the bar's top, fully transparent at its bottom. The stock
   .root is already position:relative, so the absolute header — and the
   ::before pseudo that anchors to it — resolve against the conversation.
   Keeping the header in flow is what made this bar look like an opaque strip. */
body.dsh-lg-on [data-phase="active"] > [data-slot="conversation.header"] > header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 5;
  background: transparent;
}
/* Legacy (≤0.1.x) equivalent of the rule above. */
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
   padding scrolls away, letting text pass beneath the gradient blur.
   56px = the one-row header (48px) plus an 8px breathing gap. */
body.dsh-lg-on [data-phase="active"] [data-conversation-scroll],
body.dsh-lg-on div:has(> [data-conversation-scroll])[data-phase="active"] > [data-conversation-scroll] {
  box-sizing: border-box;
  padding-top: 56px;
}
/* Header layout: the stock header is a TWO-ROW grid (leading seat + title on the
   first row, then the 对话/轨迹 tabs on their own full-width second row), which
   costs 76px of vertical space for no reason. Lay it out as ONE flex row: the
   leading seat, the title (flexible), then the tabs at the right end of that
   same row. The tablist is a direct flex item because the session-header slot
   anchor is display:contents. */
body.dsh-lg-on [data-slot="conversation.header"] > header {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 48px;
  /* Keep the stock horizontal padding: the title row clears the floating
     leading seat with calc(--dsh-frame-leading-clearance - 20px), so the 20px
     start padding is part of that geometry. Only the two-row vertical padding
     goes away. */
  padding: 0 28px 0 20px;
}
body.dsh-lg-on [data-slot="conversation.header"] > header [class*="_titleRow"] {
  /* The title row holds the crumbs, the header actions, the "open in…" dropdown
     (conversation.session.header.utilities) and the sidebar-right toggle
     (…header.corner), while the 对话/轨迹 tablist is its SIBLING. To seat the
     tabs immediately LEFT of that dropdown — instead of after the whole title
     row — the row is dissolved with display:contents so its children become flex
     items of this header and can be reordered below. Nothing inside depends on
     the row's box: no @container query in the harness targets these classes. */
  display: contents;
}
body.dsh-lg-on [data-slot="conversation.header"] > header [class*="_titleCluster"] {
  /* First box of the row, so it carries the leading-seat clearance that used to
     live on the title row, and takes the free space so everything after it is
     pushed to the right end. */
  order: 1;
  flex: 1 1 auto;
  min-width: 0;
  padding-inline-start: max(0px, calc(var(--dsh-frame-leading-clearance, 0px) - 20px));
}
body.dsh-lg-on [data-conversation-tabs] {
  order: 2;
}
body.dsh-lg-on [data-slot="conversation.header"] > header [class*="_headerUtilities"] {
  order: 3;
  /* Distance from the tabs comes from the header's own gap; the stock 20px was
     there to separate the utilities from the title, which the tabs now do. */
  margin-left: 0;
}
body.dsh-lg-on [data-slot="conversation.header"] > header [class*="_headerCorner"] {
  order: 4;
}
/* Fullscreen toggle injected through the header utilities slot (see the client
   half): a plain 28px icon button matching the other header controls. */
body.dsh-lg-on button.dsh-lg-fullscreen-toggle {
  order: 5;
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
}
body.dsh-lg-on button.dsh-lg-fullscreen-toggle:hover {
  background: color-mix(in srgb, var(--dsh-lg-tint, #ffffff) 12%, transparent);
  color: var(--dsw-alias-label-primary);
}
body[data-ds-dark-theme].dsh-lg-on button.dsh-lg-fullscreen-toggle:hover {
  background: color-mix(in srgb, var(--dsh-lg-tint-dark, #333333) 16%, transparent);
}
/* ── Desktop (Windows caption): merge the bar INTO the 40px caption band ───────
   On the desktop build the topmost strip is the frameless window's caption band,
   shared by three parties: the layout frame paints the drag region there, the
   native minimize/maximize/close buttons are drawn ABOVE the page on the right,
   and the preload injects the app menubar ("应用菜单 / 编辑") into a shadow root on
   the left. The harness itself already seats its own chrome controls inside that
   band with position:fixed — the sidebar toggle at left:12px, new-session at
   left:48px — and moves the menubar right by setting --dsh-windows-menu-start to
   84px once the sidebar collapses. So this is the harness's own pattern, not a
   new invention: the bar leaves the column, becomes a window-level strip exactly
   as tall as the band, and clears the occupants on both sides. */
html[data-windows-titlebar] body.dsh-lg-on [data-slot="conversation.header"] > header,
html[data-windows-titlebar] body.dsh-lg-on header:has([role="tablist"]) {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: var(--dsh-windows-titlebar-height, 40px);
  min-height: 0;
  /* The box itself must START after the window-chrome occupants — padding is not
     enough: a bar whose box spans them swallows their clicks (the harness pins the
     sidebar toggle at left:12px and, while collapsed, new-session at left:48px,
     and the preload's menubar overlay sits at --dsh-windows-menu-start). So the bar
     has to clear the menubar's RIGHT edge — and that edge is not a constant: the
     overlay holds "应用 编辑" (~98px) in Chinese but "Application Edit" (~154px) in
     English. The old hard-coded 134px lead was sized for neither: it left a ~45px
     dead gap before the conversation title (what the title looked "pushed right"
     by), and it would have parked the title UNDER the menubar — which paints at
     z-index 1100 — on an English locale.
     --dsh-lg-caption-lead is that clearance, MEASURED at runtime off the menubar
     host (div[data-windows-menu]): its width plus an 8px breathing gap. See the
     "caption band clearance" effect in the client half. Reading
     --dsh-windows-menu-start on top keeps the geometry right when the harness
     shifts the menubar to 84px on a collapsed sidebar.
     The 134px fallback only covers the frame or two before the measurement lands,
     and is the WIDE (English-safe) value, so the first paint can never overlap the
     menu. */
  left: calc(var(--dsh-windows-menu-start, 48px) + var(--dsh-lg-caption-lead, 134px));
  padding-left: 0;
  /* Right: the native caption buttons cannot be styled or moved, so the content
     simply has to stop before them. Electron publishes the remaining title bar
     area through the Window Controls Overlay environment variables; the plain
     148px declaration (3 x 46px plus a small gap) is the fallback in case those do
     not resolve. */
  padding-right: 148px;
  padding-right: max(148px, calc(100vw - env(titlebar-area-width, 100vw)));
  /* That band IS the window drag region, and the harness only marks
     [data-window-drag] as draggable on macOS. Since this bar covers the band from
     its new left edge, it claims the region there — and hands it back for anything
     clickable. */
  -webkit-app-region: drag;
}
/* The band's own gradient frost is the SINGLE frost source for the caption area:
   the frame pseudo below already spans the full width, so the bar's own pseudo is
   switched off here. Two stacked backdrop-filters would blur twice — and the bar
   no longer covers the band's left stretch anyway, which would leave a visible
   seam where the doubling starts. */
html[data-windows-titlebar] body.dsh-lg-on [data-slot="conversation.header"] > header::before,
html[data-windows-titlebar] body.dsh-lg-on header:has([role="tablist"])::before {
  display: none;
}
/* The right-most header control (the right-sidebar toggle) must not slide under
   the native caption buttons: the stock rule pulls it 16px to the right with a
   negative margin, which ate into the clearance above. */
html[data-windows-titlebar] body.dsh-lg-on [data-slot="conversation.header"] > header [class*="_headerCorner"] {
  margin-right: 0;
}
/* ── The session title is CENTRED in the caption band ────────────────────────
   Requested behaviour: the conversation title sits on the middle of the top bar —
   neither left nor right. It is taken OUT OF FLOW and centred instead of being
   ordered inside the header's row:

     - position: fixed centres it on the WINDOW (viewport coordinates), so it does
       not depend on the band's measured left offset, on the header being the
       positioned ancestor, or on whether the header resolved to the theme's
       one-row flex layout or fell back to the stock two-row grid. left/right
       pinned with margin-inline:auto and width:max-content does the centring
       WITHOUT a transform — a transform here would become the containing block of
       any fixed-position menu a header action might open;
     - height = the caption band, so it rides the strip with the menubar;
     - max-width keeps a long title inside the band, where the crumb rules below
       turn the overflow into an ellipsis instead of a hard cut;
     - the selectors include a plain DESCENDANT arm, because the runtime this was
       reported on does not match the direct-child form
       ([data-slot="conversation.header"] > header); that mismatch silently drops
       the whole one-row layout, which is how "简…" ended up jammed against the
       mode chip. Scoped to the conversation-header slot, so it can never reach a
       tablist inside a dialog.

   An earlier attempt forced order:-1 inside the row instead: that only re-ordered
   the auto-placement of the fallback grid (the title landed in its auto-width
   column and the tabs were pushed to a row below the band). */
html[data-windows-titlebar] body.dsh-lg-on [data-slot="conversation.header"] header [class*="_titleCluster"],
html[data-windows-titlebar] body.dsh-lg-on [data-slot="conversation.header"] > header [class*="_titleCluster"],
html[data-windows-titlebar] body.dsh-lg-on header:has([role="tablist"]) [class*="_titleCluster"] {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  height: var(--dsh-windows-titlebar-height, 40px) !important;
  margin-inline: auto !important;
  width: max-content !important;
  max-width: 56vw !important;
  min-width: 0 !important;
  padding-inline-start: 0 !important;
  flex: none !important;
}
html[data-windows-titlebar] body.dsh-lg-on [data-slot="conversation.header"] header [class*="_titleRow"],
html[data-windows-titlebar] body.dsh-lg-on [data-slot="conversation.header"] > header [class*="_titleRow"],
html[data-windows-titlebar] body.dsh-lg-on header:has([role="tablist"]) [class*="_titleRow"] {
  /* Nothing to add on the row itself — it only has to stop reserving a seat
     (and the leading-seat padding) for a title that no longer lives in it. */
  padding-inline-start: 0 !important;
}
html[data-windows-titlebar] body.dsh-lg-on [data-slot="conversation.header"] header [class*="_headerLeading"],
html[data-windows-titlebar] body.dsh-lg-on [data-slot="conversation.header"] > header [class*="_headerLeading"],
html[data-windows-titlebar] body.dsh-lg-on header:has([role="tablist"]) [class*="_headerLeading"] {
  /* The title no longer grows to push the rest of the chrome over, so the leading
     seat takes that job: everything after it (tabs, open-in dropdown, corner,
     fullscreen) rides the right end and the centred title sits alone in the middle. */
  margin-right: auto !important;
}
/* And the title has to be allowed to USE the band. The caption strip is
   window-wide, so the room next to the session title is measured in hundreds of
   pixels — yet the stock crumb caps itself at 220px and ellipsizes there, which is
   what reads as "the thing on its right is cutting the title in half": the mode
   chip sits immediately after a title that was truncated for no reason.
   Relax the cap for the CURRENT session crumb so it takes the free space, and make
   the crumb a shrinkable flex item (min-width:0) so that when the room really does
   run out the text ellipsizes INSIDE the button. Without that, the button keeps
   min-width:auto, cannot shrink below its own text, and the cut lands on the
   crumbs container's overflow:hidden edge instead — mid-character, no ellipsis,
   exactly the "only half of it shows" symptom. */
html[data-windows-titlebar] body.dsh-lg-on [data-slot="conversation.header"] > header [class*="_crumb"],
html[data-windows-titlebar] body.dsh-lg-on header:has([role="tablist"]) [class*="_crumb"] {
  min-width: 0;
}
html[data-windows-titlebar] body.dsh-lg-on [data-slot="conversation.header"] > header [class*="_crumbCurrent"],
html[data-windows-titlebar] body.dsh-lg-on header:has([role="tablist"]) [class*="_crumbCurrent"] {
  max-width: none;
}
/* The sidebar's own collapse/expand control is a WINDOW-CHROME control on the
   desktop: the harness pins it into the caption band with position:fixed
   (left:12px, z-index:30, no-drag). The lens rule for sidebar buttons sets
   position:relative on every button in the sidebar root, which outranks the stock
   rule and drops this control back into the sidebar next to the logo. It carries
   no lens anyway (the rule that hides ::before for icon buttons applies), so
   restoring the harness positioning is all that is needed. */
html[data-windows-titlebar] body.dsh-lg-on [class*="_root"]:has([class*="_treeBody"]) button[class*="_iconButton"][class*="_toggle"] {
  position: fixed;
}
/* Interactive occupants opt out of the drag region, or they stop receiving
   clicks. Empty stretches of the bar stay draggable. */
html[data-windows-titlebar] body.dsh-lg-on [data-slot="conversation.header"] > header button,
html[data-windows-titlebar] body.dsh-lg-on [data-slot="conversation.header"] > header a,
html[data-windows-titlebar] body.dsh-lg-on [data-slot="conversation.header"] > header input,
html[data-windows-titlebar] body.dsh-lg-on [data-slot="conversation.header"] > header select,
html[data-windows-titlebar] body.dsh-lg-on [data-slot="conversation.header"] > header textarea,
html[data-windows-titlebar] body.dsh-lg-on [data-slot="conversation.header"] > header [role="button"],
html[data-windows-titlebar] body.dsh-lg-on [data-slot="conversation.header"] > header [role="tab"],
html[data-windows-titlebar] body.dsh-lg-on [data-slot="conversation.header"] > header [role="menuitem"],
html[data-windows-titlebar] body.dsh-lg-on [data-slot="conversation.header"] > header [class*="_titleCluster"],
html[data-windows-titlebar] body.dsh-lg-on [data-slot="conversation.header"] > header [class*="_headerUtilities"],
html[data-windows-titlebar] body.dsh-lg-on [data-slot="conversation.header"] > header [class*="_headerCorner"],
html[data-windows-titlebar] body.dsh-lg-on header:has([role="tablist"]) button,
html[data-windows-titlebar] body.dsh-lg-on header:has([role="tablist"]) a,
html[data-windows-titlebar] body.dsh-lg-on header:has([role="tablist"]) [role="button"],
html[data-windows-titlebar] body.dsh-lg-on header:has([role="tablist"]) [role="tab"] {
  -webkit-app-region: no-drag;
}
/* The transcript only has to clear the band now: the bar no longer occupies a
   row of its own. */
html[data-windows-titlebar] body.dsh-lg-on [data-phase="active"] [data-conversation-scroll],
html[data-windows-titlebar] body.dsh-lg-on div:has(> [data-conversation-scroll])[data-phase="active"] > [data-conversation-scroll] {
  padding-top: var(--dsh-windows-titlebar-height, 40px);
}
/* Fullscreen: the caption buttons are gone, so the right clearance goes with
   them (the harness zeroes --dsh-frame-chrome-top in the same state). The menubar
   is a separately mounted always-on overlay, so the left clearance stays. */
html[data-windows-titlebar][data-fullscreen] body.dsh-lg-on [data-slot="conversation.header"] > header,
html[data-windows-titlebar][data-fullscreen] body.dsh-lg-on header:has([role="tablist"]) {
  padding-right: 0;
}
body.dsh-lg-on [data-conversation-tabs] {
  margin: 0;
  padding-left: 0;
  gap: 4px;
}
/* View tabs: small uniform buttons instead of the oversized glass capsules the
   theme used to draw (pill radius + a lens ::before each 7px/18px of padding).
   The selected and hover states use the same subtle tint as the rest of the
   chrome, and the stock underline stays hidden, so the tint IS the state.
   Dual anchor, as everywhere else on this bar. */
body.dsh-lg-on [data-conversation-tabs] [role="tab"],
body.dsh-lg-on header:has([role="tablist"]) [role="tab"] {
  border-radius: 6px;
  padding: 4px 10px;
  margin-bottom: 0;
  font-size: 13px;
  line-height: 18px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
}
body.dsh-lg-on [data-conversation-tabs] [role="tab"][aria-selected="true"],
body.dsh-lg-on header:has([role="tablist"]) [role="tab"][aria-selected="true"] {
  color: var(--dsw-alias-label-primary);
  background: color-mix(in srgb, var(--dsh-lg-tint, #ffffff) 14%, transparent);
}
body.dsh-lg-on [data-conversation-tabs] [role="tab"]:not(:disabled):hover,
body.dsh-lg-on header:has([role="tablist"]) [role="tab"]:not(:disabled):hover {
  background: color-mix(in srgb, var(--dsh-lg-tint, #ffffff) 9%, transparent);
}
body[data-ds-dark-theme].dsh-lg-on [data-conversation-tabs] [role="tab"][aria-selected="true"],
body[data-ds-dark-theme].dsh-lg-on header:has([role="tablist"]) [role="tab"][aria-selected="true"] {
  background: color-mix(in srgb, var(--dsh-lg-tint-dark, #333333) 18%, transparent);
}
body[data-ds-dark-theme].dsh-lg-on [data-conversation-tabs] [role="tab"]:not(:disabled):hover,
body[data-ds-dark-theme].dsh-lg-on header:has([role="tablist"]) [role="tab"]:not(:disabled):hover {
  background: color-mix(in srgb, var(--dsh-lg-tint-dark, #333333) 12%, transparent);
}
body.dsh-lg-on [data-conversation-tabs] [role="tab"]::after,
body.dsh-lg-on header:has([role="tablist"]) [role="tab"]::after {
  display: none;
}
/* Windows caption strip (desktop only). The layout frame paints a full-width
   40px ::before as the WINDOW DRAG BAND, filled with --dsw-specific-sidebar-fill
   (a flat translucent colour). Give that band the same gradient frost as the
   conversation header: strong blur at the very top, fading out at its bottom
   edge, so the wallpaper reads through it instead of a flat strip.
   The frame is matched by its column child rather than by the hashed class alone.
   Caveat: Electron ALSO draws a NATIVE caption overlay above the page using the
   same token (the preload samples it and forwards it to setTitleBarOverlay), and
   no CSS can blur a native overlay — a faint flat tint remains there. */
html[data-windows-titlebar] [class*="_frame"]:has([class*="_sidebarCol"])::before {
  background: transparent;
  -webkit-backdrop-filter: blur(calc(var(--dsh-lg-blur, 24px) * 1.2)) saturate(160%);
  backdrop-filter: blur(calc(var(--dsh-lg-blur, 24px) * 1.2)) saturate(160%);
  -webkit-mask-image: linear-gradient(to bottom, black 0%, black 30%, transparent 100%);
  mask-image: linear-gradient(to bottom, black 0%, black 30%, transparent 100%);
}
/* General hover effect for interactive elements: highlight edge, floating
   shadow, subtle lift, and brightness increase.
   Deliberately NARROW: it only covers the surfaces this theme restyles (the
   composer card, the queue dock, dialogs/menus, the conversation view tabs and
   the sidebar). A blanket button / a / [role=button] / [role=menuitem] /
   [role=link] selector reached into every other plugin's controls too, so it
   fought other themes over transforms and shadows; keep the list scoped. */
body.dsh-lg-on [data-composer-card] button:not(:disabled):hover,
body.dsh-lg-on [data-queue-dock] button:not(:disabled):hover,
body.dsh-lg-on [role="dialog"] button:not(:disabled):hover,
body.dsh-lg-on [role="dialog"] a:not(:disabled):hover,
body.dsh-lg-on [data-conversation-tabs] [role="tab"]:not(:disabled):hover,
body.dsh-lg-on [class*="_root"]:has([class*="_treeBody"]) button:not(:disabled):hover {
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.12), 0 4px 12px rgba(0, 0, 0, 0.10);
  transform: translateY(-1px);
  filter: brightness(1.15);
}
body[data-ds-dark-theme].dsh-lg-on [data-composer-card] button:not(:disabled):hover,
body[data-ds-dark-theme].dsh-lg-on [data-queue-dock] button:not(:disabled):hover,
body[data-ds-dark-theme].dsh-lg-on [role="dialog"] button:not(:disabled):hover,
body[data-ds-dark-theme].dsh-lg-on [role="dialog"] a:not(:disabled):hover,
body[data-ds-dark-theme].dsh-lg-on [data-conversation-tabs] [role="tab"]:not(:disabled):hover,
body[data-ds-dark-theme].dsh-lg-on [class*="_root"]:has([class*="_treeBody"]) button:not(:disabled):hover {
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
/* Composer card command button (+): a glass lens with edge refraction, same
   material as the input card. The ::before pseudo carries the backdrop-filter
   + box-shadow highlight; the button itself is transparent so the icon sits
   above the glass. aria-label="命令" / "Commands". */
body.dsh-lg-on [data-composer-card] button[aria-label="命令"],
body.dsh-lg-on [data-composer-card] button[aria-label*="Command" i] {
  position: relative;
  isolation: isolate;
  z-index: 1;
  color: var(--dsw-alias-label-primary) !important;
  background: transparent !important;
}
body.dsh-lg-on [data-composer-card] button[aria-label="命令"]::before,
body.dsh-lg-on [data-composer-card] button[aria-label*="Command" i]::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  z-index: -1;
  pointer-events: none;
  -webkit-backdrop-filter: blur(12px) url(#dsh-lg-edge-refraction);
  backdrop-filter: blur(12px) url(#dsh-lg-edge-refraction);
  background: color-mix(in srgb, var(--dsh-lg-tint, #ffffff) 15%, transparent);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.40),
    inset 0 0 0 1px rgba(255, 255, 255, 0.18),
    inset 0 0 8px rgba(255, 255, 255, 0.08),
    inset 2px 2px 6px 2px rgba(255, 255, 255, 0.14),
    inset -2px -2px 4px -1px rgba(255, 255, 255, 0.14);
}
body.dsh-lg-on [data-composer-card] button[aria-label="命令"]:hover::before,
body.dsh-lg-on [data-composer-card] button[aria-label*="Command" i]:hover::before {
  background: color-mix(in srgb, var(--dsh-lg-tint, #ffffff) 28%, transparent);
}
body[data-ds-dark-theme].dsh-lg-on [data-composer-card] button[aria-label="命令"]::before,
body[data-ds-dark-theme].dsh-lg-on [data-composer-card] button[aria-label*="Command" i]::before {
  background: color-mix(in srgb, var(--dsh-lg-tint-dark, #333333) 28%, transparent);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.25),
    inset 0 0 0 1px rgba(255, 255, 255, 0.10),
    inset 0 0 8px rgba(255, 255, 255, 0.06),
    inset 2px 2px 6px 2px rgba(255, 255, 255, 0.08),
    inset -2px -2px 4px -1px rgba(255, 255, 255, 0.08);
}
body[data-ds-dark-theme].dsh-lg-on [data-composer-card] button[aria-label="命令"]:hover::before,
body[data-ds-dark-theme].dsh-lg-on [data-composer-card] button[aria-label*="Command" i]:hover::before {
  background: color-mix(in srgb, var(--dsh-lg-tint-dark, #333333) 42%, transparent);
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

/** Body CSS variables the sheet consumes (retracted on dispose). */
const BODY_VARS = ['--dsh-lg-blur', '--dsh-lg-bg-blur', '--dsh-lg-brightness', '--dsh-lg-refraction', '--dsh-lg-scrim', '--dsh-lg-tint', '--dsh-lg-tint-dark', '--dsh-lg-tool-text-color'] as const;

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'bmp', 'ico'];
const VIDEO_EXTS = ['mp4', 'webm', 'mov', 'm4v', 'ogg', 'ogv'];

const isHttp = (value: string) => /^https?:\/\//i.test(value);
const localUrl = (value: string) => `${WALLPAPER_ROUTE}/${value.replace(/^\/+/, '')}`;
const proxied = (value: string, useProxy: boolean) =>
  useProxy && isHttp(value) ? `${PROXY_ROUTE}?u=${encodeURIComponent(value)}` : value;

/** Serialize the demo.html tunables into the iframe query string; demo.html
 * reads these back and drives its animations from them. */
const demoQuery = (d: LiquidGlassSettings['demo']): string => {
  const p = new URLSearchParams();
  p.set('sp', String(d.speed));
  p.set('bl', String(d.blobs));
  p.set('cc', String(d.colorCycle));
  p.set('bf', String(d.blur));
  p.set('op', String(d.opacity));
  p.set('w', d.wash ? '1' : '0');
  return p.toString();
};

/** Readability veil over the wallpaper; follows the base palette. */
function scrimValue(s: LiquidGlassSettings): string {
  if (!s.enabled || s.wallpaper.kind === 'none' || s.wallpaper.value.trim() === '') return '0';
  return document.body.hasAttribute('data-ds-dark-theme') ? '0.26' : '0.1';
}

/**
 * DOM applier: owns one stylesheet and one fixed background layer element.
 * The composer input box and queue dock carry their own backdrop-filter
 * (see SHEET) so the wallpaper stays sharp and the frosting is visible at the
 * box bounds. Forwards the token overrides into ctx.theme and exposes live
 * CSS variables the stylesheet consumes. Everything retracts on dispose.
 */
class LiquidGlassApplier {
  private readonly style: HTMLStyleElement;
  private readonly layer: HTMLDivElement;
  private filterEl: SVGSVGElement | null = null;
  private mediaKey = '';
  private removeOverrides: (() => void) | undefined;

  constructor(private readonly theme: ClientServices['theme']) {
    this.style = document.createElement('style');
    this.style.id = STYLE_ID;
    this.style.textContent = SHEET;
    document.head.appendChild(this.style);
    this.layer = document.createElement('div');
    this.layer.id = BG_LAYER_ID;
    document.body.prepend(this.layer);
    this.injectFilter();
  }

  private injectFilter(): void {
    if (document.getElementById(FILTER_ID)) return;
    const temp = document.createElement('div');
    temp.innerHTML = FILTER_SVG;
    const svg = temp.firstElementChild;
    if (!svg) return;
    document.body.appendChild(svg);
    this.filterEl = svg as SVGSVGElement;
  }

  apply(settings: LiquidGlassSettings): void {
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

  /** Palette flips only refresh the veil; tokens re-stack via the theme service. */
  refreshScrim(): void {
    document.body.style.setProperty('--dsh-lg-scrim', scrimValue(readStoredSettings()));
  }

  /** Build one wallpaper media element (img / video / iframe) for a kind+value. */
  private buildMedia(
    kind: WallpaperKind,
    value: string,
    proxy: boolean,
    muted: boolean,
    demo: LiquidGlassSettings['demo'],
  ): HTMLElement {
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

  private syncMedia(settings: LiquidGlassSettings): void {
    const w = settings.wallpaper;
    const active = settings.enabled && w.kind !== 'none' && w.value.trim() !== '';
    if (!active) {
      this.mediaKey = '';
      this.layer.replaceChildren();
      return;
    }
    const value = w.value.trim();
    const media = this.buildMedia(w.kind, value, w.proxy, w.muted, settings.demo);
    const src = (media as { src?: string }).src ?? '';
    const key = `${media.tagName}:${src}:${(media as { srcdoc?: string }).srcdoc ?? ''}`;
    // Rebuild children only when the wallpaper actually changed, so slider
    // tweaks never reload an iframe/video.
    if (key === this.mediaKey && this.layer.children.length > 0) {
      // A mute toggle updates the existing video in place (no reload).
      const existing = this.layer.children[0];
      const next = media as { muted?: boolean };
      if (existing.tagName === 'VIDEO' && typeof next.muted === 'boolean' && (existing as HTMLVideoElement).muted !== next.muted) {
        (existing as HTMLVideoElement).muted = next.muted;
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

  dispose(): void {
    this.removeOverrides?.();
    this.removeOverrides = undefined;
    this.mediaKey = '';
    this.style.remove();
    this.layer.remove();
    this.filterEl?.remove();
    this.filterEl = null;
    document.body.classList.remove('dsh-lg-on');
    const body = document.body;
    for (const name of BODY_VARS) body.style.removeProperty(name);
    // Drop the error banner if one was created during this fiber's lifetime —
    // the div is only ever appended by showBanner() on failure, so removing it
    // here guarantees a disabled/unloaded plugin leaves zero DOM behind.
    document.getElementById('dsh-liquid-glass-error')?.remove();
  }
}

// ── settings panel store ─────────────────────────────────────────────────────

interface PanelState {
  settings: LiquidGlassSettings;
  revision: number;
}

type PanelActions = {
  sync: (d: PanelState, settings: LiquidGlassSettings, revision: number) => void;
};

type PanelBakedActions = {
  sync: (settings: LiquidGlassSettings, revision: number) => void;
};

type PanelStoreHandle = import('@deepseek-ai/dsh-client-store').EngineStoreHandle<PanelState, PanelActions>;

function createPanelStore(): PanelStoreHandle {
  return defineStore<PanelState, PanelActions>({
    init: (): PanelState => ({ settings: { ...DEFAULTS }, revision: -1 }),
    actions: {
      sync(d, settings, revision) {
        if (revision <= d.revision) return;
        d.settings = { ...settings };
        d.revision = revision;
      },
    },
  });
}

// ── settings panel component ────────────────────────────────────────────────

const KIND_LABELS: Record<WallpaperKind, string> = {
  none: '关闭',
  url: '网页链接',
  html: '本地 HTML / 网页',
  image: '图片',
  video: '视频',
  local: '本地文件',
};

interface PanelProps {
  useStore: <S>(sel: (s: PanelState) => S) => S;
  update: (
    path: 'enabled' | 'wallpaper' | 'glass' | 'demo',
    value: boolean | LiquidGlassSettings['wallpaper'] | LiquidGlassSettings['glass'] | LiquidGlassSettings['demo'],
  ) => void;
  reset: () => void;
}

function LiquidGlassPanel({ useStore, update, reset }: PanelProps) {
  const s = useStore((st) => st.settings);
  const g = s.glass;
  const d = s.demo;
  const w = s.wallpaper;

  const section: CSSProperties = {
    padding: '16px 0',
    borderBottom: '1px solid var(--dsw-alias-border-l2)',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  };
  const row: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    fontSize: 13,
    color: 'var(--dsw-alias-label-secondary)',
  };
  const input: CSSProperties = {
    background: 'var(--dsw-specific-input-major)',
    color: 'var(--dsw-alias-label-primary)',
    border: '1px solid var(--dsw-alias-border-l2)',
    borderRadius: 8,
    padding: '6px 10px',
    fontSize: 13,
    minWidth: 0,
  };
  const group: CSSProperties = {
    padding: '14px 16px',
    border: '1px solid var(--dsw-alias-border-l2)',
    borderRadius: 12,
    background: 'var(--dsw-alias-bg-layer-1)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  };
  const groupTitle: CSSProperties = { fontSize: 13, fontWeight: 600, color: 'var(--dsw-alias-label-primary)' };
  const fieldLabel: CSSProperties = { fontSize: 12, color: 'var(--dsw-alias-label-tertiary)' };

  const patch = (
    path: 'glass' | 'wallpaper' | 'demo',
    partial: Partial<LiquidGlassSettings['glass'] | LiquidGlassSettings['wallpaper'] | LiquidGlassSettings['demo']>,
  ) => update(path, { ...s[path], ...partial });

  /** Upload a picked file to the host wallpaper dir and use it as the value. */
  const pickLocalFile = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const name = await uploadLocalFile(file);
      patch('wallpaper', { value: name });
    } catch (error) {
      showBanner(`壁纸文件上传失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const isLocalKind = (LOCAL_FILE_KINDS as readonly string[]).includes(w.kind);
  const isVideoKind = w.kind === 'video' || (w.kind === 'local' && VIDEO_EXTS.includes(w.value.split('.').pop()?.toLowerCase() ?? ''));

  return (
    <div style={{ width: '100%', maxWidth: 560, padding: '4px 0 24px', display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={section}>
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--dsw-alias-label-primary)' }}>液态玻璃</div>
        <div style={{ fontSize: 12, color: 'var(--dsw-alias-label-tertiary)' }}>
          动态壁纸 + 磨砂玻璃质感。设置保存在浏览器本地。
        </div>
        <label style={row}>
          <span>启用液态玻璃</span>
          <input type="checkbox" checked={s.enabled} onChange={() => update('enabled', !s.enabled)} />
        </label>
      </div>

      {/* ── 页面背景 ─────────────────────────────────────────────────────── */}
      <div style={group}>
        <div style={groupTitle}>页面背景</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={fieldLabel}>壁纸类型</span>
          <select
            style={input}
            value={w.kind}
            onChange={(e) => patch('wallpaper', { kind: e.target.value as WallpaperKind })}
          >
            {Object.entries(KIND_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          {/* demo.html is a fixed built-in option, always selectable. */}
          <button
            type="button"
            style={{ ...input, cursor: 'pointer', alignSelf: 'flex-start' }}
            onClick={() => patch('wallpaper', { kind: 'local', value: 'demo.html' })}
          >
            使用内置演示壁纸 demo.html
          </button>
          {w.kind !== 'none' && (
            <>
              {isLocalKind ? (
                // Local-file kinds: the whole box is a label for a hidden file
                // input, so clicking it opens the system file picker; the
                // upload writes the file into the host wallpaper dir.
                <label
                  style={{
                    ...input,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                  title="点击选择本地文件"
                >
                  <input
                    type="file"
                    accept={LOCAL_ACCEPT[w.kind] ?? ''}
                    style={{ display: 'none' }}
                    onChange={(e) => { void pickLocalFile(e); }}
                  />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '6px 10px' }}>
                    {w.value.trim() !== '' ? w.value : '点击选择本地文件…'}
                  </span>
                  <span style={{ flex: 'none', fontSize: 12, color: 'var(--dsw-alias-brand-primary)', paddingRight: 10 }}>
                    选择文件
                  </span>
                </label>
              ) : (
                <input
                  style={input}
                  placeholder="网页链接"
                  value={w.value}
                  onChange={(e) => patch('wallpaper', { value: e.target.value })}
                />
              )}
              {w.kind === 'url' && (
                <label style={row}>
                  <span>网页链接走代理（绕过 X-Frame-Options）</span>
                  <input type="checkbox" checked={w.proxy} onChange={(e) => patch('wallpaper', { proxy: e.target.checked })} />
                </label>
              )}
              {isVideoKind && (
                <label style={row}>
                  <span>静音播放（取消后视频带声音，可能被浏览器阻止自动播放）</span>
                  <input type="checkbox" checked={w.muted} onChange={(e) => patch('wallpaper', { muted: e.target.checked })} />
                </label>
              )}
            </>
          )}
          <label style={row}>
            <span>背景模糊（{g.bgBlur}px）</span>
            <input type="range" min={0} max={60} step={1} value={g.bgBlur} onChange={(e) => patch('glass', { bgBlur: Number(e.target.value) })} />
          </label>
          <label style={row}>
            <span>背景亮度（{g.brightness.toFixed(2)}）</span>
            <input type="range" min={0.2} max={1.6} step={0.05} value={g.brightness} onChange={(e) => patch('glass', { brightness: Number(e.target.value) })} />
          </label>
        </div>
      </div>

      {/* ── demo.html 壁纸设置（仅当壁纸是 demo.html 时生效） ───────────── */}
      {w.value.trim() === 'demo.html' && w.kind !== 'none' && (
        <div style={group}>
          <div style={groupTitle}>demo.html 演示壁纸设置</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={row}>
              <span>动画速度（×{d.speed.toFixed(1)}）</span>
              <input type="range" min={0.1} max={4} step={0.1} value={d.speed} onChange={(e) => patch('demo', { speed: Number(e.target.value) })} />
            </label>
            <label style={row}>
              <span>色块数量（{d.blobs} 个）</span>
              <input type="range" min={1} max={6} step={1} value={d.blobs} onChange={(e) => patch('demo', { blobs: Number(e.target.value) })} />
            </label>
            <label style={row}>
              <span>颜色变化（{d.colorCycle}/10，0=静态）</span>
              <input type="range" min={0} max={10} step={1} value={d.colorCycle} onChange={(e) => patch('demo', { colorCycle: Number(e.target.value) })} />
            </label>
            <label style={row}>
              <span>色块模糊（{d.blur}px）</span>
              <input type="range" min={10} max={140} step={5} value={d.blur} onChange={(e) => patch('demo', { blur: Number(e.target.value) })} />
            </label>
            <label style={row}>
              <span>色块不透明度（{d.opacity.toFixed(2)}）</span>
              <input type="range" min={0.2} max={1} step={0.05} value={d.opacity} onChange={(e) => patch('demo', { opacity: Number(e.target.value) })} />
            </label>
            <label style={row}>
              <span>背景渐变流动</span>
              <input type="checkbox" checked={d.wash} onChange={(e) => patch('demo', { wash: e.target.checked })} />
            </label>
          </div>
        </div>
      )}

      {/* ── 输入卡片 · 磨砂玻璃 ─────────────────────────────────────────── */}
      <div style={group}>
        <div style={groupTitle}>输入卡片 · 磨砂玻璃</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={row}>
            <span>磨砂效果</span>
            <input type="checkbox" checked={g.frosted} onChange={(e) => patch('glass', { frosted: e.target.checked })} />
          </label>
          <label style={row}>
            <span>磨砂强度（{g.blur}px）</span>
            <input type="range" min={0} max={60} step={1} value={g.blur} onChange={(e) => patch('glass', { blur: Number(e.target.value) })} />
          </label>
          <label style={row}>
            <span>边缘折射（{g.refraction.toFixed(2)}）</span>
            <input type="range" min={0} max={1} step={0.05} value={g.refraction} onChange={(e) => patch('glass', { refraction: Number(e.target.value) })} />
          </label>
          <label style={row}>
            <span>玻璃颜色</span>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="color" value={/^#[0-9a-f]{6}$/i.test(g.tint) ? g.tint : '#ffffff'} onChange={(e) => patch('glass', { tint: e.target.value })} />
              <input style={{ ...input, width: 90 }} value={g.tint} onChange={(e) => patch('glass', { tint: e.target.value })} />
            </span>
          </label>
          <label style={row}>
            <span>玻璃不透明度（{g.tintOpacity.toFixed(2)}）</span>
            <input type="range" min={0} max={1} step={0.05} value={g.tintOpacity} onChange={(e) => patch('glass', { tintOpacity: Number(e.target.value) })} />
          </label>
          <label style={row}>
            <span>玻璃亮度（{g.glassBrightness.toFixed(2)}）</span>
            <input type="range" min={0.2} max={1.6} step={0.05} value={g.glassBrightness} onChange={(e) => patch('glass', { glassBrightness: Number(e.target.value) })} />
          </label>
          <label style={row}>
            <span>边缘折射（{g.edgeRefractionScale}）</span>
            <input type="range" min={0} max={200} step={5} value={g.edgeRefractionScale} onChange={(e) => patch('glass', { edgeRefractionScale: Number(e.target.value) })} />
          </label>
        </div>
      </div>

      {/* ── 代码与文字 ───────────────────────────────────────────────────── */}
      <div style={group}>
        <div style={groupTitle}>代码与文字</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={row}>
            <span>代码块背景（{g.codeBlockOpacity.toFixed(2)}）</span>
            <input type="range" min={0.2} max={1} step={0.05} value={g.codeBlockOpacity} onChange={(e) => patch('glass', { codeBlockOpacity: Number(e.target.value) })} />
          </label>
          <label style={row}>
            <span>操作文字颜色</span>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="color" value={/^#[0-9a-f]{6}$/i.test(g.toolTextColor) ? g.toolTextColor : '#ffffff'} onChange={(e) => patch('glass', { toolTextColor: e.target.value })} />
              <input style={{ ...input, width: 90 }} value={g.toolTextColor || '(默认)'} onChange={(e) => patch('glass', { toolTextColor: e.target.value })} />
            </span>
          </label>
        </div>
      </div>

      <button
        type="button"
        style={{ ...input, alignSelf: 'flex-start', cursor: 'pointer' }}
        onClick={reset}
      >
        恢复默认
      </button>
    </div>
  );
}

// ── plugin body ─────────────────────────────────────────────────────────────

interface ClientServices {
  theme: {
    overrideTokens(source: string, tokens: ThemeTokenOverrides): () => void;
  };
  on?(event: string, listener: (...args: unknown[]) => void): () => void;
  effect(disposer: () => unknown, label?: string): void;
  slots?: {
    inject(key: string, fn: () => unknown): unknown;
    register(options: Record<string, unknown>, component: unknown): () => void;
  };
}

/**
 * Cordis service dependencies (SERVICE names, not package ids — the client
 * loader builds the fiber inject map from this exported array). Mirrors the
 * shipped dsh-ui-appearance / dsh-dream-skin plugins: slots + locale + theme.
 */
export const inject = ['slots', 'locale', 'theme'];

/** Show a visible in-page banner so apply outcome is observable without devtools. */
function showBanner(message: string, color = '#b91c1c'): void {
  try {
    let el = document.getElementById('dsh-liquid-glass-error');
    if (!el) {
      el = document.createElement('div');
      el.id = 'dsh-liquid-glass-error';
      el.style.cssText =
        `position:fixed;top:8px;right:8px;z-index:99999;max-width:70vw;background:${color};color:#fff;` +
        'font:12px/1.5 system-ui,sans-serif;padding:8px 12px;border-radius:8px;' +
        'box-shadow:0 4px 16px rgba(0,0,0,.35);white-space:pre-wrap;pointer-events:none;';
      document.body.appendChild(el);
    }
    el.textContent = `[liquid-glass] ${message}`;
  } catch {
    /* banner must never throw */
  }
}

/** Run a step and swallow+report failures so the theme can never fail the web boot. */
function safe(step: string, fn: () => void): void {
  try {
    fn();
  } catch (error) {
    const message = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error);
    console.error(`[liquid-glass] ${step} failed:`, error);
    showBanner(`${step} failed: ${message}`);
  }
}

/**
 * Client plugin body. Everything runs behind a top-level guard: a theme
 * plugin must never take the whole web boot down with it (the shell's
 * fail-loud sweep rejects the app when ANY entry fails to activate).
 * @param ctx - client cordis context (slots + locale + theme provided).
 */
export function apply(ctx: ClientContext): void {
  try {
    applyCore(ctx);
  } catch (error) {
    const message = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error);
    console.error('[liquid-glass] apply failed:', error);
    showBanner(`apply failed: ${message}`);
  }
}

/** Slot the desktop conversation header exposes for extra utility controls. */
const HEADER_UTILITIES_SLOT = 'conversation.session.header.utilities';

/**
 * Fullscreen toggle contributed to the conversation header.
 *
 * The desktop build ships no fullscreen entry point of its own: the frameless
 * caption only offers minimize/maximize/close, the Windows application menu
 * carries just `toggleDevTools` (F12) with no `togglefullscreen` role, and the
 * main process never calls `setFullScreen(true)`. Its window is still
 * fullscreenable and the preload mirrors the OS state onto
 * `<html data-fullscreen>`, so the app's own fullscreen-aware layout kicks in as
 * soon as the DOCUMENT goes fullscreen — which is exactly what this button asks
 * for through the Fullscreen API.
 */
function FullscreenToggle(): JSX.Element {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const sync = (): void => setActive(document.fullscreenElement !== null);
    sync();
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  const toggle = useCallback(() => {
    const request = document.fullscreenElement === null
      ? document.documentElement.requestFullscreen()
      : document.exitFullscreen();
    // A rejected request (no user gesture, unsupported surface) must not bubble
    // out of the click handler as an unhandled rejection.
    void request?.catch?.(() => undefined);
  }, []);
  const label = active ? '退出全屏' : '全屏';
  return (
    <button
      type="button"
      className="dsh-lg-fullscreen-toggle"
      onClick={toggle}
      aria-pressed={active}
      title={label}
      aria-label={label}
    >
      {active ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 4v5H4M15 20v-5h5M4 15h5v5M20 9h-5V4" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 9V4h5M20 15v5h-5M15 4h5v5M9 20H4v-5" />
        </svg>
      )}
    </button>
  );
}

function applyCore(ctx: ClientContext): void {
  const client = ctx as unknown as ClientServices;

  let current = readStoredSettings();
  let revision = 0;
  let applier: LiquidGlassApplier | undefined;
  const store = createPanelStore();
  let boundActions: PanelBakedActions | undefined;

  const publish = (): void => {
    revision += 1;
    boundActions?.sync(current, revision);
    applier?.apply(current);
  };

  // DOM applier: created with the fiber, retracts everything on dispose.
  client.effect(() => {
    applier = new LiquidGlassApplier(client.theme);
    applier.apply(current);
    return () => {
      applier?.dispose();
      applier = undefined;
    };
  }, 'liquid-glass: DOM applier');

  // Palette flips only refresh the readability veil (token layers re-stack
  // through the theme service itself).
  const offThemeChange = client.on?.('theme/change', () => safe('theme-change scrim', () => applier?.refreshScrim()));
  client.effect(() => offThemeChange, 'liquid-glass: theme-change scrim');

  // Windows caption band clearance. The desktop title bar merges the conversation
  // header into the 40px window strip, so that strip must START to the right of
  // the preload's menubar overlay — `div[data-windows-menu]`, pinned at
  // --dsh-windows-menu-start, sized to its own content, painting at z-index 1100
  // above the page. Its width is locale-dependent ("应用 编辑" ≈ 98px,
  // "Application Edit" ≈ 154px), which is why the stylesheet cannot hard-code the
  // clearance: too small and the session title (the first thing in the strip) sits
  // UNDER the menu, too large and the title is shoved right behind a dead gap —
  // exactly the bug this effect fixes, since the old constant reserved 134px for a
  // ~98px menu.
  //
  // Publish --dsh-lg-caption-lead = measured width + an 8px gap; the stylesheet
  // does `--dsh-windows-menu-start + lead`, so a collapsed sidebar (menubar moves
  // to 84px) stays correct for free. With no menubar at all the lead is 0, which
  // is right: --dsh-windows-menu-start already clears the sidebar toggle and the
  // collapsed-sidebar new-session button.
  //
  // The overlay comes from the preload, not from this client runtime, so on a cold
  // start it can be missing for a few frames: retry on rAF, then watch the element
  // itself for the label swap a locale change performs. Disposed with the fiber.
  client.effect(() => {
    const MENU_SELECTOR = '[data-windows-menu]';
    const GAP = 8;
    const MAX = 260; // a pathological menu must not eat the whole strip
    const MAX_FRAMES = 240; // ~4s of retries, then leave the stylesheet fallback
    let lead = -1;
    let frames = 0;
    let observer: MutationObserver | undefined;
    let raf = 0;

    const publish = (value: number): void => {
      if (value === lead) return;
      lead = value;
      document.documentElement.style.setProperty('--dsh-lg-caption-lead', `${value}px`);
    };

    const measure = (menu: HTMLElement): void => {
      const width = menu.getBoundingClientRect().width;
      // A hidden or not-yet-styled host measures 0; keep the last real value.
      if (width <= 0) return;
      publish(Math.min(MAX, Math.ceil(width) + GAP));
    };

    const sync = (): void => {
      const menu = document.querySelector<HTMLElement>(MENU_SELECTOR);
      if (!menu) {
        publish(0);
        return;
      }
      measure(menu);
      if (observer) return;
      observer = new MutationObserver(() => measure(menu));
      observer.observe(menu, { childList: true, subtree: true, characterData: true });
    };

    const retry = (): void => {
      sync();
      if (observer || frames >= MAX_FRAMES) return;
      frames += 1;
      raf = requestAnimationFrame(retry);
    };

    retry();
    window.addEventListener('resize', sync);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', sync);
      observer?.disconnect();
      document.documentElement.style.removeProperty('--dsh-lg-caption-lead');
    };
  }, 'liquid-glass: caption band clearance');

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
  client.effect(() => {
    const applyIcon = (): void => {
      if (!document.body.classList.contains('dsh-lg-on')) return;
      // The Liquid Glass section nav label we registered — the match key for
      // our row. (The button's textContent is exactly this, since the icon svg
      // contributes no text.)
      const OUR_LABEL = '液态玻璃';
      const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
      if (!dialog) return;
      const cell = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button')).find(
        (b) => b.textContent?.trim() === OUR_LABEL,
      );
      if (!cell) return;
      const iconSlot = cell.firstElementChild;
      if (!iconSlot) return;
      if (cell.querySelector('.lg-watermark')) return; // already ours
      iconSlot.innerHTML =
        '<svg class="lg-watermark" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>';
    };
    applyIcon();
    const observer = new MutationObserver(() => {
      applyIcon();
      requestAnimationFrame(() => applyIcon());
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
    };
  }, 'liquid-glass: settings water icon');

  // Cross-tab sync: another tab persisted a settings change.
  client.effect(() => {
    const onStorage = (event: StorageEvent): void => {
      if (event.key !== null && event.key !== STORAGE_KEY) return;
      current = readStoredSettings();
      publish();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
    };
  }, 'liquid-glass: storage sync');

  const commit = (): void => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch {
      // Quota exceeded: keep the in-memory state so this session still works.
    }
    publish();
  };

  const update = (
    path: 'enabled' | 'wallpaper' | 'glass' | 'demo',
    value: boolean | LiquidGlassSettings['wallpaper'] | LiquidGlassSettings['glass'] | LiquidGlassSettings['demo'],
  ): void => {
    const patch = { ...current } as unknown as Record<string, unknown>;
    patch[path] = value;
    current = sanitizeSettings(patch);
    commit();
  };

  const reset = (): void => {
    current = { ...DEFAULTS };
    commit();
  };

  const injected = (actions: PanelBakedActions): { update: typeof update; reset: () => void } => {
    boundActions = actions;
    publish();
    return { update, reset };
  };

  // Settings page: registered as a top-level `settings.section`, so it gets
  // its own nav row beside 通用设置 / 模型 / 插件 (guarded: the section slot
  // may not exist in every surface).
  if (client.slots) {
    safe('settings panel registration', () => {
      client.slots!.inject('settings.section', () =>
        client.slots!.register(
          {
            name: 'settings.section',
            id: 'liquid-glass',
            order: 100,
            label: '液态玻璃',
            store,
            inject: injected,
          },
          LiquidGlassPanel,
        ),
      );
    });

    // Fullscreen toggle in the conversation header. Contributed through the
    // header's own utilities slot (the same seat as the "open in…" dropdown), so
    // it is React-managed and disappears with the fiber — no DOM surgery. The
    // slot only exists on surfaces that render that header, and `inject` simply
    // never fires elsewhere.
    safe('fullscreen toggle registration', () => {
      client.slots!.inject(HEADER_UTILITIES_SLOT, () =>
        client.slots!.register(
          { name: HEADER_UTILITIES_SLOT, id: 'liquid-glass-fullscreen', order: 90 },
          FullscreenToggle as never,
        ),
      );
    });
  }
}
