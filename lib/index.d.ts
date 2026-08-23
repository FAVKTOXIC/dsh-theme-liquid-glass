/**
 * Host half of dsh-theme-liquid-glass.
 *
 * - Registers /liquid-glass/wallpaper/* to serve local wallpaper files
 *   (images / video / HTML) from a configurable directory.
 * - Registers /liquid-glass/proxy to fetch web URLs server-side so wallpaper
 *   pages work even when the upstream sends X-Frame-Options / CORS blockers.
 *
 * NOTE on settings: the browser half persists its settings in localStorage.
 * The harness settings gateway only exposes its hard-coded product
 * namespaces to browser clients, so a third-party namespace registered here
 * would never reach the client scope (it stays `loading` forever) — the
 * shipped dsh-ui-appearance / dsh-dream-skin plugins hit the same wall and
 * both chose localStorage.
 */
import z from '@deepseek-ai/schemastery';
/** Loader-facing config for the host row (see the profile patch file). */
export declare const Config: z<Schemastery.ObjectS<{
    /** Root directory for local wallpaper files; empty = <DSH_HOME>/wallpapers. */
    wallpaperDir: z<string, string>;
}>, Schemastery.ObjectT<{
    /** Root directory for local wallpaper files; empty = <DSH_HOME>/wallpapers. */
    wallpaperDir: z<string, string>;
}>>;
/**
 * Host plugin body: wallpaper file routes + web proxy.
 * @param ctx - host cordis context (offers the optional `webServer` service).
 * @param config - validated plugin config (see {@link Config}).
 */
export declare function apply(ctx: unknown, config: unknown): void;
