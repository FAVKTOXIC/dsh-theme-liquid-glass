/**
 * Constants and settings shape shared by the host and client halves.
 * Kept dependency-free so the client bundle never pulls in schemastery.
 */ /** Settings namespace owned by this plugin (mirrors the Host `settings.register` name). */ export const LIQUID_GLASS_NS = 'liquid-glass';
/** Host route prefix serving local wallpaper files (images / video / HTML). */ export const WALLPAPER_ROUTE = '/liquid-glass/wallpaper';
/** Host upload endpoint: POST raw file bytes -> saved under the wallpaper dir. */ export const UPLOAD_ROUTE = '/liquid-glass/upload';
/** Host proxy endpoint that fetches a web URL server-side (bypasses X-Frame-Options / CORS). */ export const PROXY_ROUTE = '/liquid-glass/proxy';
