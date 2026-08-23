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
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
/**
 * Cordis service dependencies (SERVICE names, not package ids — the client
 * loader builds the fiber inject map from this exported array). Mirrors the
 * shipped dsh-ui-appearance / dsh-dream-skin plugins: slots + locale + theme.
 */
export declare const inject: string[];
/**
 * Client plugin body. Everything runs behind a top-level guard: a theme
 * plugin must never take the whole web boot down with it (the shell's
 * fail-loud sweep rejects the app when ANY entry fails to activate).
 * @param ctx - client cordis context (slots + locale + theme provided).
 */
export declare function apply(ctx: ClientContext): void;
