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
 */ import z from '@deepseek-ai/schemastery';
import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { basename, extname, join, normalize, resolve, sep } from 'node:path';
import { WALLPAPER_ROUTE, PROXY_ROUTE, UPLOAD_ROUTE } from './shared.js';
/** Loader-facing config for the host row (see the profile patch file). */ export const Config = z.object({
    /** Root directory for local wallpaper files; empty = <DSH_HOME>/wallpapers. */ wallpaperDir: z.string().default('')
});
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.htm': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.m4v': 'video/mp4',
    '.ogg': 'video/ogg',
    '.ogv': 'video/ogg',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.woff2': 'font/woff2'
};
/**
 * Default demo wallpaper written on first boot when demo.html is missing, so
 * the client's out-of-the-box default (wallpaper.value = 'demo.html') always
 * resolves on a fresh install. Param-driven: reads ?sp/&bl/&cc/&bf/&op/&w.
 */ const DEMO_HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;height:100%;overflow:hidden}
body{background:linear-gradient(135deg,#0f2027,#203a43,#2c5364,#35265a);display:flex;align-items:center;justify-content:center;font-family:system-ui;color:#fff;text-align:center}
body::before{content:"";position:fixed;inset:-10%;z-index:0;background:linear-gradient(115deg,#ff5f6d,#ffc371 25%,#36d1dc 50%,#5b86e5 75%,#a18cd1 100%);background-size:300% 300%;animation:wash var(--wash-dur,7s) ease-in-out infinite;filter:blur(70px) saturate(150%);opacity:.30;pointer-events:none}
body.no-wash::before{animation:none}
.blob{position:absolute;width:55vmin;height:55vmin;border-radius:50%;filter:blur(var(--blob-blur,65px)) saturate(140%);opacity:var(--blob-op,.85);animation:float var(--float-dur,5s) ease-in-out infinite,hue var(--hue-dur,4.5s) linear infinite}
.b1{background:#7f7fd5;top:-12%;left:-6%}
.b2{background:#86a8e7;bottom:-16%;right:-6%;animation-delay:-1.25s}
.b3{background:#91eae4;top:38%;left:52%;animation-delay:-2.5s}
.b4{background:#ff5f6d;top:8%;right:10%;animation-delay:-3.75s}
.b5{background:#ffc371;bottom:6%;left:16%;animation-delay:-1.9s}
.b6{background:#a18cd1;top:45%;left:-12%;animation-delay:-3.1s}
@keyframes float{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(7vmin,-7vmin) scale(1.22)}}
@keyframes hue{0%{filter:blur(var(--blob-blur,65px)) saturate(140%) hue-rotate(0deg)}100%{filter:blur(var(--blob-blur,65px)) saturate(140%) hue-rotate(360deg)}}
@keyframes wash{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
h1{position:relative;z-index:1;font-weight:300;letter-spacing:.2em;font-size:3vmin}
</style></head><body><div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div><div class="blob b4"></div><div class="blob b5"></div><div class="blob b6"></div><h1>LIQUID GLASS WALLPAPER</h1>
<script>
(function(){
  function num(v,d,min,max){v=parseFloat(v);return isFinite(v)?Math.min(max,Math.max(min,v)):d}
  var q=new URLSearchParams(location.search);
  var sp=num(q.get('sp'),1,0.1,8);
  var bl=Math.round(num(q.get('bl'),6,1,6));
  var cc=Math.round(num(q.get('cc'),4,0,10));
  var bf=Math.round(num(q.get('bf'),65,10,140));
  var op=num(q.get('op'),0.85,0.2,1);
  var wash=q.get('w')!=='0';
  var root=document.documentElement;
  root.style.setProperty('--float-dur',(5/sp).toFixed(2)+'s');
  root.style.setProperty('--wash-dur',(7/sp).toFixed(2)+'s');
  root.style.setProperty('--hue-dur',cc===0?'999999s':(18/cc).toFixed(2)+'s');
  root.style.setProperty('--blob-blur',bf+'px');
  root.style.setProperty('--blob-op',String(op));
  if(!wash)document.body.classList.add('no-wash');
  var blobs=document.querySelectorAll('.blob');
  for(var i=0;i<blobs.length;i++){if(i>=bl)blobs[i].style.display='none'}
})();
</script>
</body></html>`;
/**
 * Ensure the wallpaper dir has a demo.html: writes the built-in default only
 * when the file is missing (a user's own demo.html always wins). Failures are
 * swallowed — a missing demo wallpaper must never take the plugin down.
 */ async function ensureDemoWallpaper(root) {
    try {
        await mkdir(root, {
            recursive: true
        });
        const target = join(root, 'demo.html');
        try {
            await stat(target);
            return;
        } catch  {
        // missing — fall through and write the default
        }
        await writeFile(target, DEMO_HTML, 'utf8');
    } catch  {
    /* wallpaper dir unwritable — the default demo simply won't exist */ }
}
function wallpaperRoot(ctx, config) {
    const configured = (config?.wallpaperDir ?? '').trim();
    if (configured) return resolve(configured);
    const c = ctx;
    if (typeof c.dshHomePath === 'function') return c.dshHomePath('wallpapers');
    const home = process.env.DSH_HOME || process.env.USERPROFILE || process.env.HOME;
    return home ? join(home, '.dsh', 'wallpapers') : undefined;
}
async function serveFile(root, rel, res) {
    const target = normalize(join(root, rel));
    if (target !== root && !target.startsWith(root + sep)) {
        res.writeHead(403, {
            'content-type': 'text/plain; charset=utf-8'
        });
        res.end('forbidden');
        return;
    }
    try {
        const info = await stat(target);
        if (!info.isFile()) {
            res.writeHead(404, {
                'content-type': 'text/plain; charset=utf-8'
            });
            res.end('not found');
            return;
        }
        const type = MIME[extname(target).toLowerCase()] ?? 'application/octet-stream';
        res.writeHead(200, {
            'content-type': type,
            'cache-control': 'no-cache',
            'x-content-type-options': 'nosniff'
        });
        createReadStream(target).pipe(res);
    } catch  {
        res.writeHead(404, {
            'content-type': 'text/plain; charset=utf-8'
        });
        res.end('not found');
    }
}
/** Wallpaper file extensions accepted by the upload endpoint. */ const UPLOAD_EXTS = new Set([
    '.html',
    '.htm',
    '.svg',
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.webp',
    '.avif',
    '.bmp',
    '.ico',
    '.mp4',
    '.webm',
    '.mov',
    '.m4v',
    '.ogg',
    '.ogv'
]);
/** Upload size cap (bytes) — wallpaper videos are short loops, 200MB is plenty. */ const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;
/**
 * POST /liquid-glass/upload?name=<original-filename>: stores the raw body bytes
 * under the wallpaper dir with a timestamped, sanitized name and returns
 * `{ "name": "<stored-name>" }` so the client can set `wallpaper.value`.
 */ async function uploadFile(req, res, root) {
    if (req.method !== 'POST') {
        res.writeHead(405);
        res.end();
        return;
    }
    const original = new URL(req.url ?? '/', 'http://x').searchParams.get('name') ?? '';
    const ext = extname(original).toLowerCase();
    if (!UPLOAD_EXTS.has(ext)) {
        res.writeHead(400, {
            'content-type': 'text/plain; charset=utf-8'
        });
        res.end('unsupported file type');
        return;
    }
    // Sanitize the basename (keep unicode letters, strip path separators and
    // leading dots, cap length) so the stored name can never escape the root.
    const safeBase = basename(original).replace(/[^\w.\-]+/g, '_').replace(/^\.+/, '').slice(0, 120);
    if (!safeBase || !extname(safeBase)) {
        res.writeHead(400, {
            'content-type': 'text/plain; charset=utf-8'
        });
        res.end('bad filename');
        return;
    }
    const chunks = [];
    let size = 0;
    try {
        for await (const chunk of req){
            const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            size += buf.length;
            if (size > MAX_UPLOAD_BYTES) {
                res.writeHead(413, {
                    'content-type': 'text/plain; charset=utf-8'
                });
                res.end('file too large');
                return;
            }
            chunks.push(buf);
        }
    } catch  {
        res.writeHead(400);
        res.end();
        return;
    }
    if (size === 0) {
        res.writeHead(400, {
            'content-type': 'text/plain; charset=utf-8'
        });
        res.end('empty file');
        return;
    }
    const stored = `lg-${Date.now()}-${safeBase}`;
    try {
        await mkdir(root, {
            recursive: true
        });
        await writeFile(join(root, stored), Buffer.concat(chunks));
    } catch  {
        res.writeHead(500, {
            'content-type': 'text/plain; charset=utf-8'
        });
        res.end('write failed');
        return;
    }
    res.writeHead(200, {
        'content-type': 'application/json; charset=utf-8'
    });
    res.end(JSON.stringify({
        name: stored
    }));
}
async function proxyUrl(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405);
        res.end();
        return;
    }
    const url = new URL(req.url ?? '/', 'http://x').searchParams.get('u') ?? '';
    if (!/^https?:\/\//i.test(url)) {
        res.writeHead(400, {
            'content-type': 'text/plain; charset=utf-8'
        });
        res.end('bad url');
        return;
    }
    try {
        const upstream = await fetch(url, {
            redirect: 'follow',
            headers: {
                // Some wallpaper sites serve different markup to non-browser agents.
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
                accept: '*/*'
            }
        });
        const headers = {
            'content-type': upstream.headers.get('content-type') ?? 'application/octet-stream',
            'cache-control': 'no-cache',
            'x-content-type-options': 'nosniff',
            // Strip framing blockers so the page can render as wallpaper.
            'x-frame-options': 'ALLOWALL'
        };
        res.writeHead(upstream.status, headers);
        if (req.method === 'HEAD' || upstream.body === null) {
            res.end();
            return;
        }
        const body = upstream.body;
        for await (const chunk of body)res.write(chunk);
        res.end();
    } catch  {
        res.writeHead(502, {
            'content-type': 'text/plain; charset=utf-8'
        });
        res.end('upstream fetch failed');
    }
}
/**
 * Host plugin body: wallpaper file routes + web proxy.
 * @param ctx - host cordis context (offers the optional `webServer` service).
 * @param config - validated plugin config (see {@link Config}).
 */ export function apply(ctx, config) {
    const c = ctx;
    // Fresh installs get a working default demo wallpaper (only written when
    // demo.html is missing). Fire-and-forget; failures are swallowed inside.
    c.effect(()=>{
        const root = wallpaperRoot(ctx, config);
        if (root) void ensureDemoWallpaper(root);
    }, 'liquid-glass: ensure default demo wallpaper');
    c.inject([
        'webServer'
    ], (httpCtx)=>{
        const webServer = httpCtx.webServer;
        c.effect(()=>webServer.register({
                kind: 'prefix',
                path: WALLPAPER_ROUTE,
                handler: async (req, res)=>{
                    if (req.method !== 'GET' && req.method !== 'HEAD') {
                        res.writeHead(405);
                        res.end();
                        return;
                    }
                    const root = wallpaperRoot(ctx, config);
                    if (!root) {
                        res.writeHead(404);
                        res.end();
                        return;
                    }
                    const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
                    const rel = pathname.slice(WALLPAPER_ROUTE.length).replace(/^\/+/, '');
                    if (!rel) {
                        res.writeHead(400);
                        res.end();
                        return;
                    }
                    await serveFile(root, rel, res);
                }
            }), 'liquid-glass: wallpaper file route');
        c.effect(()=>webServer.register({
                kind: 'exact',
                path: UPLOAD_ROUTE,
                handler: (req, res)=>{
                    const root = wallpaperRoot(ctx, config);
                    if (!root) {
                        res.writeHead(404);
                        res.end();
                        return;
                    }
                    return uploadFile(req, res, root);
                }
            }), 'liquid-glass: wallpaper upload route');
        c.effect(()=>webServer.register({
                kind: 'exact',
                path: PROXY_ROUTE,
                handler: proxyUrl
            }), 'liquid-glass: wallpaper proxy route');
    });
}
