// Client-half smoke test: run the REAL lib/client.js factory in Node with a
// minimal DOM + mock cordis ctx, and assert the plugin's observable behavior.
import { readFileSync } from 'node:fs';

const makeEl = (tag) => ({
  tagName: String(tag).toUpperCase(),
  id: '',
  children: [],
  attrs: {},
  style: {
    props: {},
    cssText: '',
    setProperty(k, v) { this.props[k] = String(v); },
    getPropertyValue(k) { return this.props[k] ?? ''; },
    removeProperty(k) { delete this.props[k]; },
  },
  textContent: '',
  parent: null,
  src: '',
  srcdoc: '',
  classList: {
    _s: new Set(),
    add(c) { this._s.add(c); },
    remove(c) { this._s.delete(c); },
    toggle(c, force) { if (force === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); } else if (force) { this._s.add(c); } else { this._s.delete(c); } },
    contains(c) { return this._s.has(c); },
  },
  setAttribute(k, v) { this.attrs[k] = String(v); },
  getAttribute(k) { return this.attrs[k] ?? (k === 'src' ? (this.src || undefined) : undefined); },
  hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k); },
  appendChild(c) { c.parent = this; this.children.push(c); },
  prepend(c) { c.parent = this; this.children.unshift(c); },
  replaceChildren(...cs) { this.children = []; for (const c of cs) { c.parent = this; this.children.push(c); } },
  remove() {
    this.removed = true;
    if (this.parent) {
      const i = this.parent.children.indexOf(this);
      if (i >= 0) this.parent.children.splice(i, 1);
    }
  },
});

const body = makeEl('body');
const head = makeEl('head');
const findById = (el, id) => {
  if (el.id === id || el.attrs.id === id) return el;
  for (const c of el.children) {
    const f = findById(c, id);
    if (f) return f;
  }
  return null;
};
const stored = {};
globalThis.localStorage = {
  getItem: (k) => (k in stored ? stored[k] : null),
  setItem: (k, v) => { stored[k] = String(v); },
  removeItem: (k) => { delete stored[k]; },
};
globalThis.getComputedStyle = () => ({ backgroundColor: 'rgb(21, 21, 23)', getPropertyValue: () => '' });
globalThis.document = {
  body,
  head,
  getElementById: (id) => findById(body, id) || findById(head, id),
  createElement: (tag) => makeEl(tag),
  querySelector: () => null,
};
const storageListeners = [];
globalThis.window = {
  __ModuleLoader__: { load: (e) => { entry = e; } },
  addEventListener: (name, fn) => { if (name === 'storage') storageListeners.push(fn); },
  removeEventListener: () => {},
};
let entry = null;

// Evaluate the loader-wrapped bundle.
eval(readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'));
if (!entry) throw new Error('bundle did not call __ModuleLoader__.load');
if (entry.id !== 'dsh-theme-liquid-glass') throw new Error(`unexpected bundle id ${entry.id}`);

// Fake require: the bundle only needs these two specifiers.
const fakeRequire = (id) => {
  if (id === 'react/jsx-runtime') return { jsx: () => null, jsxs: () => null, Fragment: () => null };
  if (id === '@deepseek-ai/dsh-client-runtime/client') {
    return {
      defineStore: (decl) => ({
        spec: decl,
        create() {
          const state = decl.init();
          const actions = {};
          for (const key of Object.keys(decl.actions)) {
            actions[key] = (...params) => { decl.actions[key](state, ...params); };
          }
          return { actions, getSnapshot: () => state, subscribe: () => () => {}, clearPersisted() {} };
        },
      }),
    };
  }
  throw new Error(`unexpected require: ${id}`);
};

const mod = entry.factory(fakeRequire);
if (typeof mod.apply !== 'function') throw new Error('bundle does not export apply');
// Service-name inject export — the client loader builds fiber.inject from it.
if (!Array.isArray(mod.inject)) throw new Error('bundle does not export inject');
for (const s of ['slots', 'locale', 'theme']) {
  if (!mod.inject.includes(s)) throw new Error(`inject missing service ${s}`);
}

// ── mocks ────────────────────────────────────────────────────────────────────
const tokenLayers = [];
const effectBodies = [];
let registered = null;
let currentSnapshot = { active: { tokens: { '--dsw-alias-bg-base': 'rgb(21, 21, 23)' } } };
const ctx = {
  theme: {
    overrideTokens: (source, tokens) => { tokenLayers.push([source, tokens]); return () => {}; },
    getTheme: () => currentSnapshot,
  },
  on: () => () => {},
  effect: (fn) => { effectBodies.push(fn); },
  slots: {
    inject: (key, fn) => { if (key !== 'settings.section') throw new Error(`unexpected slot ${key}`); fn(); },
    register: (options, component) => { registered = { options, component }; return () => {}; },
  },
};

// ── run ──────────────────────────────────────────────────────────────────────
mod.apply(ctx);

// The applier is created by the first effect body; run it and keep its disposer.
if (effectBodies.length < 1) throw new Error('no effects registered');
const applierDisposer = effectBodies[0]();

// 1. stylesheet + background layer mounted; frosted rules are SCOPED to the
//    input box / queue dock (never on #root — that would re-anchor popups).
const styleEl = head.children.find((c) => c.tagName === 'STYLE');
if (!styleEl) throw new Error('no style element injected');
if (!styleEl.textContent.includes('#dsh-liquid-glass-bg')) throw new Error('style missing layer rules');
if (!styleEl.textContent.includes('#root')) throw new Error('style missing #root lift rule');
// every effect rule (frost + lens) must be gated behind body.dsh-lg-on so the
// 启用 switch retracts ALL visuals, not just the token layer
if (!styleEl.textContent.includes('body.dsh-lg-on [data-composer-card]::before')) throw new Error('card frosted pseudo rule must be gated by body.dsh-lg-on');
if (!styleEl.textContent.includes('body.dsh-lg-on [data-composer-card] button[class*="_primary"]')) throw new Error('send-button lens rule must be gated by body.dsh-lg-on');
if (!styleEl.textContent.includes('body.dsh-lg-on [data-queue-dock] > div')) throw new Error('queue-dock frosted rule must be gated by body.dsh-lg-on');
if (!styleEl.textContent.includes('body.dsh-lg-on [data-time-hover-root] [class*="_bubble"]::before')) throw new Error('bubble frosted pseudo rule must be gated by body.dsh-lg-on');
if (!styleEl.textContent.includes('[data-composer-card]::before')) throw new Error('style missing composer-card frosted pseudo rule');
if (!styleEl.textContent.includes('button[class*="_primary"]')) throw new Error('style missing send-button lens rule');
if (!styleEl.textContent.includes('[data-queue-dock] > div')) throw new Error('style missing queue-dock frosted rule');
if (styleEl.textContent.includes('[data-input-scroll] > div')) throw new Error('input box must NOT keep a separate glass surface (merge into the card)');
const rootRule = styleEl.textContent.match(/#root\s*\{[^}]*\}/)?.[0] ?? '';
if (rootRule.includes('backdrop-filter')) throw new Error('backdrop-filter must NOT be on #root (containing-block bug)');
const cardRule = styleEl.textContent.match(/\[data-composer-card\]\s*\{[^}]*\}/)?.[0] ?? '';
if (!cardRule.includes('isolation')) throw new Error('composer card must isolate its stacking context for the pseudo');
const pseudoRule = styleEl.textContent.match(/\[data-composer-card\]::before\s*\{[^}]*\}/)?.[0] ?? '';
if (!pseudoRule.includes('backdrop-filter')) throw new Error('card frost must ride the ::before pseudo, never the card itself');
if (!pseudoRule.includes('inset 0 1px 0')) throw new Error('card top rim must be a thin 1px line, not a wide band');
if (!styleEl.textContent.includes('[data-time-hover-root] [class*="_bubble"]::before')) throw new Error('style missing bubble frosted pseudo rule');
// settings modal: frosted + same lens rim as the composer card, on the pseudo only
if (!styleEl.textContent.includes('[role="dialog"][aria-labelledby]::before')) throw new Error('style missing settings-dialog frosted pseudo rule');
const dialogBase = styleEl.textContent.match(/\[role="dialog"\]\[aria-labelledby\]\s*\{[^}]*\}/)?.[0] ?? '';
if (!dialogBase.includes('isolation')) throw new Error('settings dialog must isolate its stacking context for the pseudo');
const dialogRule = styleEl.textContent.match(/\[role="dialog"\]\[aria-labelledby\]::before\s*\{[^}]*\}/)?.[0] ?? '';
if (!dialogRule.includes('backdrop-filter')) throw new Error('settings dialog frost must ride the ::before pseudo');
if (!dialogRule.includes('inset 0 1px 0')) throw new Error('settings dialog needs the same lens rim as the composer card');
if (dialogRule.includes('z-index: 0')) throw new Error('settings dialog pseudo must sit behind content');
// conversation header (对话/轨迹/session log bar): gradient blur + capsule tabs
if (!styleEl.textContent.includes('body.dsh-lg-on header:has([role="tablist"])::before')) throw new Error('style missing conversation-header gradient blur rule');
const headerRule = styleEl.textContent.match(/body\.dsh-lg-on header:has\(\[role="tablist"\]\)::before\s*\{[^}]*\}/)?.[0] ?? '';
if (!headerRule.includes('backdrop-filter')) throw new Error('header blur must ride the ::before pseudo');
if (!headerRule.includes('mask-image')) throw new Error('header blur needs a vertical mask (strong top -> none bottom)');
// the bar must float OVER the scrolling messages (text visible through the blur)
if (!styleEl.textContent.includes('div:has(> [data-conversation-scroll])[data-phase="active"]')) throw new Error('style missing conversation-root overlay scoping');
const headerOverlay = styleEl.textContent.match(/body\.dsh-lg-on div:has\(> \[data-conversation-scroll\]\)\[data-phase="active"\] > \[data-slot="conversation\.session\.header"\] > header:has\(\[role="tablist"\]\)\s*\{[^}]*\}/)?.[0] ?? '';
if (!headerOverlay.includes('position: absolute')) throw new Error('header must be lifted out of the flex row to overlay the messages (through the slot wrapper)');
if (!headerOverlay.includes('z-index: 5')) throw new Error('header must float above the scrolling list');
const scrollPad = styleEl.textContent.match(/body\.dsh-lg-on div:has\(> \[data-conversation-scroll\]\)\[data-phase="active"\] > \[data-conversation-scroll\]\s*\{[^}]*\}/)?.[0] ?? '';
if (!scrollPad.includes('padding-top: 88px')) throw new Error('scroll area must reserve the header height so text starts below the bar');
if (!styleEl.textContent.includes('header:has([role="tablist"]) [role="tab"]')) throw new Error('style missing capsule tab rules');
const tabRule = styleEl.textContent.match(/body\.dsh-lg-on header:has\(\[role="tablist"\]\) \[role="tab"\]\s*\{[^}]*\}/)?.[0] ?? '';
if (!tabRule.includes('999px')) throw new Error('tabs must be capsule-shaped (999px radius)');
const tabPseudo = styleEl.textContent.match(/body\.dsh-lg-on header:has\(\[role="tablist"\]\) \[role="tab"\]::before\s*\{[^}]*\}/)?.[0] ?? '';
if (!tabPseudo.includes('backdrop-filter')) throw new Error('tab glass must ride the ::before pseudo');
if (!styleEl.textContent.includes('[role="tab"]::after')) throw new Error('the old tab underline indicator must be hidden');
// tool call text gets text-shadow and optional custom color
if (!styleEl.textContent.includes('data-disclosure-row] [class*="title"]')) throw new Error('style missing tool call title text-shadow rule');
const toolTitleRule = styleEl.textContent.match(/body\.dsh-lg-on \[data-variant\] \[data-disclosure-row\] \[class\*="title"\]\s*\{[^}]*\}/)?.[0] ?? '';
if (!toolTitleRule.includes('text-shadow')) throw new Error('tool call titles must have text-shadow for readability');
// the header's bottom hairline must be gone (no white line between bar and messages)
const headerLine = styleEl.textContent.match(/body\.dsh-lg-on header:has\(\[role="tablist"\]\)::after\s*\{[^}]*\}/)?.[0] ?? '';
if (!headerLine.includes('display: none')) throw new Error('the header bottom hairline must be hidden');
const layer = findById(body, 'dsh-liquid-glass-bg');
if (!layer) throw new Error('no background layer');
if (!body.classList.contains('dsh-lg-on')) throw new Error('enabled defaults must set the dsh-lg-on gate class');

// 2. token layer applied (defaults: enabled + local demo.html)
if (tokenLayers.length < 1) throw new Error('no token layer applied');
const [source, tokens] = tokenLayers[tokenLayers.length - 1];
if (source !== 'dsh-theme-liquid-glass') throw new Error(`bad source ${source}`);
const bg = tokens['--dsw-alias-bg-base'];
if (!bg || typeof bg.light !== 'string' || typeof bg.dark !== 'string') throw new Error('bg-base override malformed');
if (bg.light !== 'transparent') throw new Error(`wallpaper active should make bg-base transparent, got ${bg.light}`);
if (Object.keys(tokens).length < 20) throw new Error(`too few overrides: ${Object.keys(tokens).length}`);

// 3. wallpaper layer: demo.html -> iframe -> /liquid-glass/wallpaper/demo.html?<demo tunables>
const media = layer.children[0];
if (!media || media.tagName !== 'IFRAME') throw new Error('demo.html should render an iframe');
if (!media.src.startsWith('/liquid-glass/wallpaper/demo.html?')) throw new Error(`bad iframe src ${media.src}`);
for (const p of ['sp=1', 'bl=6', 'cc=4', 'bf=65', 'op=0.85', 'w=1']) {
  if (!media.src.includes(p)) throw new Error(`iframe src missing demo param ${p}: ${media.src}`);
}
if (findById(layer, 'dsh-liquid-glass-scrim') === null) throw new Error('scrim veil missing');

// 4. body vars wired (card blur / independent background blur / brightness / refraction / scrim)
if (body.style.getPropertyValue('--dsh-lg-blur') !== '24px') throw new Error('blur var missing');
if (body.style.getPropertyValue('--dsh-lg-bg-blur') !== '5px') throw new Error('independent background blur var missing');
if (body.style.getPropertyValue('--dsh-lg-brightness') !== '1') throw new Error('brightness var missing');
const bgRule = styleEl.textContent.match(/#dsh-liquid-glass-bg\s*\{[^}]*\}/)?.[0] ?? '';
if (!bgRule.includes('blur(var(--dsh-lg-bg-blur')) throw new Error('background layer must use the independent --dsh-lg-bg-blur');
if (bgRule.includes('--dsh-lg-blur')) throw new Error('background blur must NOT be coupled to the card frost blur');

// 5. settings page registered as a top-level settings.section (nav row beside
//    通用设置 / 模型 / 插件), not a row inside the General tab
if (!registered || registered.options.id !== 'liquid-glass') throw new Error('panel not registered');
if (registered.options.name !== 'settings.section') throw new Error(`panel must be a settings.section page, got ${registered.options.name}`);
if (registered.options.order !== 100) throw new Error(`section order must place it after shipped pages, got ${registered.options.order}`);
if (registered.options.label !== '液态玻璃') throw new Error(`section nav label missing, got ${String(registered.options.label)}`);
const instance = registered.options.store.create();
const face = registered.options.inject(instance.actions);
const panelState = instance.getSnapshot();
if (panelState.settings.enabled !== true || panelState.settings.wallpaper.kind !== 'local') throw new Error('panel state not synced');
if (panelState.settings.wallpaper.muted !== true) throw new Error('video wallpaper must default to muted');
if (panelState.settings.demo.blobs !== 6 || panelState.settings.demo.speed !== 1) throw new Error(`demo tunables not synced ${JSON.stringify(panelState.settings.demo)}`);
if (panelState.settings.glass.codeBlockOpacity !== 0.7) throw new Error(`code block opacity default wrong: ${panelState.settings.glass.codeBlockOpacity}`);
if (panelState.settings.glass.toolTextColor !== '') throw new Error(`tool text color default wrong: ${panelState.settings.glass.toolTextColor}`);

// 6. update -> localStorage persisted + applier re-applied
face.update('glass', { frosted: false, blur: 0, refraction: 0.2, tint: '#abcdef', tintOpacity: 0.5, brightness: 1.1 });
if (!stored['dsh-liquid-glass.settings']) throw new Error('settings not persisted to localStorage');
const persisted = JSON.parse(stored['dsh-liquid-glass.settings']);
if (persisted.glass.tint !== '#abcdef' || persisted.glass.blur !== 0) throw new Error(`bad persisted settings ${JSON.stringify(persisted)}`);
if (body.style.getPropertyValue('--dsh-lg-blur') !== '0px') throw new Error('applier did not re-apply blur');
if (body.style.getPropertyValue('--dsh-lg-brightness') !== '1.1') throw new Error('applier did not re-apply brightness');
// frosted=false + blur 0 -> card frost is 0 BUT the independent background
// blur stays at its own value (5px) — the two are decoupled
if (body.style.getPropertyValue('--dsh-lg-bg-blur') !== '5px') throw new Error('background blur must be independent of card frost');
// glass material brightness: factor 0.2 scales the tint toward black, 1.6
// toward white (identity at 1 -> '#abcdef')
if (body.style.getPropertyValue('--dsh-lg-tint') !== '#abcdef') throw new Error(`glass brightness 1 should keep the tint, got ${body.style.getPropertyValue('--dsh-lg-tint')}`);
face.update('glass', { frosted: false, blur: 0, refraction: 0.2, tint: '#abcdef', tintOpacity: 0.5, glassBrightness: 0.2, brightness: 1.1 });
if (body.style.getPropertyValue('--dsh-lg-tint') !== '#000000') throw new Error(`glass brightness 0.2 should blacken the tint, got ${body.style.getPropertyValue('--dsh-lg-tint')}`);
face.update('glass', { frosted: false, blur: 0, refraction: 0.2, tint: '#abcdef', tintOpacity: 0.5, glassBrightness: 1.6, brightness: 1.1 });
if (body.style.getPropertyValue('--dsh-lg-tint') !== '#ffffff') throw new Error(`glass brightness 1.6 should whiten the tint, got ${body.style.getPropertyValue('--dsh-lg-tint')}`);
face.update('glass', { frosted: false, blur: 0, refraction: 0.2, tint: '#abcdef', tintOpacity: 0.5, glassBrightness: 1, brightness: 1.1 });
// wallpaper unchanged -> iframe NOT reloaded
if (layer.children[0] !== media) throw new Error('wallpaper reloaded on a glass-only change');

// 6b. video wallpaper honors the mute option (default muted); toggling the
//     mute updates the SAME video element in place (no reload/restart)
face.update('wallpaper', { kind: 'video', value: 'clip.mp4', proxy: false, muted: false });
let vid = layer.children[0];
if (!vid || vid.tagName !== 'VIDEO') throw new Error('video wallpaper should render a video element');
if (vid.muted !== false) throw new Error(`video must be unmuted when muted=false, got ${vid.muted}`);
if (vid.src !== '/liquid-glass/wallpaper/clip.mp4') throw new Error(`bad video src ${vid.src}`);
face.update('wallpaper', { kind: 'video', value: 'clip.mp4', proxy: false, muted: true });
if (layer.children[0] !== vid) throw new Error('mute toggle must NOT reload the video element');
if (vid.muted !== true) throw new Error(`mute toggle must set muted in place, got ${vid.muted}`);
face.update('wallpaper', { kind: 'local', value: 'demo.html', proxy: false, muted: true });
if (layer.children[0].tagName !== 'IFRAME') throw new Error('restoring the html wallpaper should rebuild the iframe');

// 6c. demo.html tunables ride the iframe query string; changing them rebuilds
//     the iframe with the new params
const demoIframe = layer.children[0];
face.update('demo', { speed: 2, blobs: 3, colorCycle: 8, blur: 40, opacity: 0.5, wash: false });
const demoNext = layer.children[0];
if (demoNext === demoIframe) throw new Error('demo tunable change must rebuild the iframe');
for (const p of ['sp=2', 'bl=3', 'cc=8', 'bf=40', 'op=0.5', 'w=0']) {
  if (!demoNext.src.includes(p)) throw new Error(`demo params not reflected in iframe src (${p}): ${demoNext.src}`);
}
face.update('demo', { speed: 1, blobs: 6, colorCycle: 4, blur: 65, opacity: 0.85, wash: true });

// 7. disable -> tokens retracted, wallpaper removed, gate class dropped
const layersBefore = tokenLayers.length;
face.update('enabled', false);
if (tokenLayers.length !== layersBefore) throw new Error('disabled state must not re-stack tokens');
if (layer.children.length !== 0) throw new Error('wallpaper media not removed when disabled');
if (body.classList.contains('dsh-lg-on')) throw new Error('disabling must drop the dsh-lg-on gate so no glass/lens rule matches');

// 8. re-enable -> tokens + wallpaper back
face.update('enabled', true);
if (tokenLayers.length <= layersBefore) throw new Error('re-enable did not re-stack tokens');
if (layer.children.length === 0) throw new Error('wallpaper not restored after re-enable');
if (!body.classList.contains('dsh-lg-on')) throw new Error('re-enable must restore the dsh-lg-on gate class');

// 9. cleanup disposer retracts everything
applierDisposer();
if (!styleEl.removed) throw new Error('cleanup did not remove stylesheet');
if (!layer.removed) throw new Error('cleanup did not remove layer');
if (body.classList.contains('dsh-lg-on')) throw new Error('cleanup must drop the dsh-lg-on gate class');
if (body.style.getPropertyValue('--dsh-lg-blur') !== '') throw new Error('cleanup did not clear body vars');
if (body.style.getPropertyValue('--dsh-lg-bg-blur') !== '') throw new Error('cleanup did not clear background blur var');
if (body.style.getPropertyValue('--dsh-lg-tint') !== '') throw new Error('cleanup did not clear tint vars');

console.log('CLIENT SMOKE TEST PASSED');
console.log(`  - inject: [${mod.inject.join(', ')}]`);
console.log(`  - token overrides: ${Object.keys(tokens).length} tokens, bg-base=${bg.light}`);
console.log(`  - layer: iframe -> ${media.src}, scrim mounted, scoped backdrop-filter rules present`);
console.log(`  - persistence: localStorage '${Object.keys(stored).join(', ')}'`);
console.log(`  - panel: registered, synced, update->persist+reapply works`);
console.log(`  - disable/re-enable/cleanup: tokens+wallpaper+style torn down and restored`);
