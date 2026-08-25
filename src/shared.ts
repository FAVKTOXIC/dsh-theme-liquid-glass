/**
 * Constants and settings shape shared by the host and client halves.
 * Kept dependency-free so the client bundle never pulls in schemastery.
 */

/** Settings namespace owned by this plugin (mirrors the Host `settings.register` name). */
export const LIQUID_GLASS_NS = 'liquid-glass';

/** Host route prefix serving local wallpaper files (images / video / HTML). */
export const WALLPAPER_ROUTE = '/liquid-glass/wallpaper';

/** Host upload endpoint: POST raw file bytes -> saved under the wallpaper dir. */
export const UPLOAD_ROUTE = '/liquid-glass/upload';

/** Host proxy endpoint that fetches a web URL server-side (bypasses X-Frame-Options / CORS). */
export const PROXY_ROUTE = '/liquid-glass/proxy';

export type WallpaperKind = 'none' | 'url' | 'html' | 'image' | 'video' | 'local';

/** Tunables for the built-in demo.html wallpaper (applied via iframe URL
 * query params; only meaningful while the wallpaper value is demo.html). */
export interface DemoWallpaperSettings {
  /** Animation speed multiplier 0.5..4 (1 = default). */
  speed: number;
  /** Number of color blobs 1..6. */
  blobs: number;
  /** Color-cycle (hue-rotate) intensity 0..10; 0 = static colors. */
  colorCycle: number;
  /** Blob blur radius in px 10..140. */
  blur: number;
  /** Blob opacity 0.2..1. */
  opacity: number;
  /** Animated background wash on/off. */
  wash: boolean;
}

export interface LiquidGlassSettings {
  /** Master switch for the whole glass + wallpaper treatment. */
  enabled: boolean;
  wallpaper: {
    kind: WallpaperKind;
    /** For url/html/image/video: a web URL; for local: a relative path under the wallpaper dir. */
    value: string;
    /** Route web URLs through the host proxy (needed when a site blocks framing). */
    proxy: boolean;
    /** Mute video wallpapers (autoplay with sound may be blocked by the browser). */
    muted: boolean;
  };
  demo: DemoWallpaperSettings;
  glass: {
    /** Frosted effect master switch (backdrop blur over the wallpaper). */
    frosted: boolean;
    /** Frost blur radius in px (input card / dock / bubbles). */
    blur: number;
    /** Background wallpaper blur radius in px (independent of the card frost). */
    bgBlur: number;
    /** Edge refraction strength 0..1 (border luminosity + saturation). */
    refraction: number;
    /** Glass tint color (any CSS color). */
    tint: string;
    /** Glass tint opacity 0..1. */
    tintOpacity: number;
    /** Tool call text color (empty = use default label color). */
    toolTextColor: string;
    /** Code block background opacity 0.2..1 (independent of tintOpacity). */
    codeBlockOpacity: number;
    /** Glass material brightness 0.2..1.6 (tint lightness scaling; the card
     * surface gets lighter above 1 and darker below 1). */
    glassBrightness: number;
    /** Glass brightness 0.2..1.6 (wallpaper filter). */
    brightness: number;
    /** feDisplacementMap scale 0..200 (edge refraction intensity). */
    edgeRefractionScale: number;
  };
}
