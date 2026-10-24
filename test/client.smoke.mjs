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

// Fake require: the bundle needs these three specifiers.
const fakeRequire = (id) => {
  if (id === 'react/jsx-runtime') return { jsx: () => null, jsxs: () => null, Fragment: () => null };
  // The header fullscreen toggle pulls in three hooks. This test never renders a
  // slot component, so plain stubs are enough — but the require itself happens at
  // module scope and must resolve.
  if (id === 'react') {
    return {
      useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
      useEffect: () => {},
      useCallback: (fn) => fn,
    };
  }
  if (id === '@deepseek-ai/dsh-client-store') {
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
const registrationLog = [];
let currentSnapshot = { active: { tokens: { '--dsw-alias-bg-base': 'rgb(21, 21, 23)' } } };
const KNOWN_SLOTS = ['settings.section', 'conversation.session.header.utilities'];
const ctx = {
  theme: {
    overrideTokens: (source, tokens) => { tokenLayers.push([source, tokens]); return () => {}; },
    getTheme: () => currentSnapshot,
  },
  on: () => () => {},
  effect: (fn) => { effectBodies.push(fn); },
  slots: {
    inject: (key, fn) => {
      if (!KNOWN_SLOTS.includes(key)) throw new Error(`unexpected slot ${key}`);
      fn();
    },
    register: (options, component) => {
      registrationLog.push({ options, component });
      registered = { options, component };
      return () => {};
    },
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
if (!styleEl.textContent.includes('body.dsh-lg-on [data-conversation-scroll] [class*="_bubble"]::before')) throw new Error('bubble frosted pseudo rule must be gated by body.dsh-lg-on');
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
// the bubble anchor is dual (harness <=0.1.x: [data-time-hover-root];
// harness >=0.2: [data-conversation-scroll]) — assert BOTH arms survived
if (!styleEl.textContent.includes('[data-time-hover-root] [class*="_bubble"]::before')) throw new Error('style missing the legacy bubble frosted pseudo rule');
if (!styleEl.textContent.includes('[data-conversation-scroll] [class*="_bubble"]::before')) throw new Error('style missing the harness>=0.2 bubble frosted pseudo rule');
// settings modal: frosted + same lens rim as the composer card, on the pseudo only
if (!styleEl.textContent.includes('[role="dialog"][aria-labelledby]::before')) throw new Error('style missing settings-dialog frosted pseudo rule');
const dialogBase = styleEl.textContent.match(/\[role="dialog"\]\[aria-labelledby\]\s*\{[^}]*\}/)?.[0] ?? '';
if (!dialogBase.includes('isolation')) throw new Error('settings dialog must isolate its stacking context for the pseudo');
const dialogRule = styleEl.textContent.match(/\[role="dialog"\]\[aria-labelledby\]::before\s*\{[^}]*\}/)?.[0] ?? '';
if (!dialogRule.includes('backdrop-filter')) throw new Error('settings dialog frost must ride the ::before pseudo');
if (!dialogRule.includes('inset 0 1px 0')) throw new Error('settings dialog needs the same lens rim as the composer card');
if (dialogRule.includes('z-index: 0')) throw new Error('settings dialog pseudo must sit behind content');
// conversation header (对话/轨迹/session log bar): gradient blur + capsule tabs.
// The bar carries a DUAL anchor: `header:has([role="tablist"])` for harness
// <=0.1.x and `[data-slot="conversation.header"] > header` for harness >=0.2
// (where the tablist is conditional, so a single-view session has no tablist
// at all and the slot-anchored arm is the only one that matches).
if (!styleEl.textContent.includes('body.dsh-lg-on header:has([role="tablist"])::before')) throw new Error('style missing conversation-header gradient blur rule (legacy anchor)');
if (!styleEl.textContent.includes('body.dsh-lg-on [data-slot="conversation.header"] > header::before')) throw new Error('style missing conversation-header gradient blur rule (harness>=0.2 anchor)');
const headerRule = styleEl.textContent.match(/(?:^|\n)body\.dsh-lg-on header:has\(\[role="tablist"\]\)::before\s*\{[^}]*\}/)?.[0] ?? '';
if (!headerRule.includes('backdrop-filter')) throw new Error('header blur must ride the ::before pseudo');
if (!headerRule.includes('mask-image')) throw new Error('header blur needs a vertical mask (strong top -> none bottom)');
const headerRuleNew = styleEl.textContent.match(/(?:^|\n)body\.dsh-lg-on \[data-slot="conversation\.header"\] > header::before[^{]*\{[^}]*\}/)?.[0] ?? '';
if (!headerRuleNew.includes('backdrop-filter')) throw new Error('harness>=0.2 header blur must ride the ::before pseudo');
if (!headerRuleNew.includes('mask-image')) throw new Error('harness>=0.2 header blur needs the vertical mask');
// the bar must float OVER the scrolling messages (text visible through the blur)
if (!styleEl.textContent.includes('div:has(> [data-conversation-scroll])[data-phase="active"]')) throw new Error('style missing conversation-root overlay scoping (legacy)');
const headerOverlay = styleEl.textContent.match(/(?:^|\n)body\.dsh-lg-on div:has\(> \[data-conversation-scroll\]\)\[data-phase="active"\] > \[data-slot="conversation\.session\.header"\] > header:has\(\[role="tablist"\]\)\s*\{[^}]*\}/)?.[0] ?? '';
if (!headerOverlay.includes('position: absolute')) throw new Error('header must be lifted out of the flex row to overlay the messages (legacy anchor)');
if (!headerOverlay.includes('z-index: 5')) throw new Error('header must float above the scrolling list');
// harness >=0.2: the real DOM is [data-phase] > [data-slot="conversation.header"] > header
// (the slot anchor is display:contents, and the stock .root is position:relative)
const headerOverlayNew = styleEl.textContent.match(/(?:^|\n)body\.dsh-lg-on \[data-phase="active"\] > \[data-slot="conversation\.header"\] > header[^{]*\{[^}]*\}/)?.[0] ?? '';
if (!headerOverlayNew.includes('position: absolute')) throw new Error('harness>=0.2 header must be taken out of flow to overlay the messages');
if (!headerOverlayNew.includes('z-index: 5')) throw new Error('harness>=0.2 header must float above the scrolling list');
if (!headerOverlayNew.includes('background: transparent')) throw new Error('harness>=0.2 header must not paint its own background');
const scrollPad = styleEl.textContent.match(/(?:^|\n)body\.dsh-lg-on div:has\(> \[data-conversation-scroll\]\)\[data-phase="active"\] > \[data-conversation-scroll\]\s*\{[^}]*\}/)?.[0] ?? '';
if (!scrollPad.includes('padding-top: 56px')) throw new Error('scroll area must reserve the one-row header height so text starts below the bar');
const scrollPadNew = styleEl.textContent.match(/(?:^|\n)body\.dsh-lg-on \[data-phase="active"\] \[data-conversation-scroll\][^{]*\{[^}]*\}/)?.[0] ?? '';
if (!scrollPadNew.includes('padding-top: 56px')) throw new Error('harness>=0.2 scroll area must reserve the one-row header height');
// The bar is ONE row: header -> flex, title row dissolved, tablist ordered just
// left of the header utilities (the "open in…" dropdown).
const headerRow = styleEl.textContent.match(/(?:^|\n)body\.dsh-lg-on \[data-slot="conversation\.header"\] > header\s*\{[^}]*display: flex[^}]*\}/)?.[0] ?? '';
if (!headerRow.includes('display: flex')) throw new Error('the header must be laid out as one flex row (no second row for the tabs)');
if (!headerRow.includes('min-height: 48px')) throw new Error('the one-row header must be 48px tall, not the stock 76px');
const titleRow = styleEl.textContent.match(/(?:^|\n)body\.dsh-lg-on \[data-slot="conversation\.header"\] > header \[class\*="_titleRow"\]\s*\{[^}]*\}/)?.[0] ?? '';
if (!titleRow.includes('display: contents')) throw new Error('the title row must be dissolved so its children join the header flex row');
const titleCluster = styleEl.textContent.match(/(?:^|\n)body\.dsh-lg-on \[data-slot="conversation\.header"\] > header \[class\*="_titleCluster"\]\s*\{[^}]*\}/)?.[0] ?? '';
if (!titleCluster.includes('flex: 1 1 auto')) throw new Error('the title cluster must take the free space');
if (!titleCluster.includes('order: 1')) throw new Error('the title cluster must stay first in the reordered row');
if (!titleCluster.includes('--dsh-frame-leading-clearance')) throw new Error('the leading-seat clearance must move onto the title cluster');
const tabsRule = styleEl.textContent.match(/(?:^|\n)body\.dsh-lg-on \[data-conversation-tabs\]\s*\{[^}]*\}/)?.[0] ?? '';
if (!tabsRule.includes('order: 2')) throw new Error('the tablist must be ordered before the header utilities');
const utilities = styleEl.textContent.match(/(?:^|\n)body\.dsh-lg-on \[data-slot="conversation\.header"\] > header \[class\*="_headerUtilities"\]\s*\{[^}]*\}/)?.[0] ?? '';
if (!utilities.includes('order: 3')) throw new Error('the header utilities (the open-in dropdown) must follow the tabs');
const corner = styleEl.textContent.match(/(?:^|\n)body\.dsh-lg-on \[data-slot="conversation\.header"\] > header \[class\*="_headerCorner"\]\s*\{[^}]*\}/)?.[0] ?? '';
if (!corner.includes('order: 4')) throw new Error('the header corner must stay last');
// Tabs are small uniform buttons now: no pill, no lens pseudo.
if (!styleEl.textContent.includes('header:has([role="tablist"]) [role="tab"]')) throw new Error('style missing tab button rules');
if (!styleEl.textContent.includes('[data-conversation-tabs] [role="tab"]')) throw new Error('style missing tab button rules for the harness>=0.2 tablist anchor');
const tabRule = styleEl.textContent.match(/(?:^|\n)body\.dsh-lg-on header:has\(\[role="tablist"\]\) \[role="tab"\]\s*\{[^}]*\}/)?.[0] ?? '';
if (!tabRule.includes('border-radius: 6px')) throw new Error('tabs must be small rounded buttons (6px radius)');
if (tabRule.includes('999px')) throw new Error('the oversized capsule/pill radius must be gone');
const tabRuleNew = styleEl.textContent.match(/(?:^|\n)body\.dsh-lg-on \[data-conversation-tabs\] \[role="tab"\][^{]*\{[^}]*\}/)?.[0] ?? '';
if (!tabRuleNew.includes('border-radius: 6px')) throw new Error('harness>=0.2 tabs must be small rounded buttons (6px radius)');
if (tabRuleNew.includes('999px')) throw new Error('the harness>=0.2 capsule/pill radius must be gone');
if (styleEl.textContent.includes('[role="tab"]::before')) throw new Error('the per-tab lens ::before pseudo must be gone with the capsule');
if (!styleEl.textContent.includes('[role="tab"]::after')) throw new Error('the old tab underline indicator must be hidden');
// Windows caption strip (desktop): the 40px drag band gets the same gradient frost.
const captionStrip = styleEl.textContent.match(/html\[data-windows-titlebar\] \[class\*="_frame"\][^{]*\{[^}]*\}/)?.[0] ?? '';
if (!styleEl.textContent.includes('html[data-windows-titlebar]')) throw new Error('style missing the Windows caption strip rule');
if (!captionStrip.includes('backdrop-filter')) throw new Error('the caption strip must ride backdrop-filter');
if (!captionStrip.includes('mask-image')) throw new Error('the caption strip needs a vertical gradient mask');
// The fullscreen toggle is contributed through the header utilities slot, so the
// desktop build (which ships no fullscreen entry point) gets one.
const fullscreenReg = registrationLog.find((r) => r.options?.id === 'liquid-glass-fullscreen');
if (!fullscreenReg) throw new Error('the fullscreen toggle must be registered into the header utilities slot');
if (fullscreenReg.options.name !== 'conversation.session.header.utilities') throw new Error('the fullscreen toggle must target the header utilities slot');
if (typeof fullscreenReg.component !== 'function') throw new Error('the fullscreen toggle must be a component');
const fullscreenCss = styleEl.textContent.match(/(?:^|\n)body\.dsh-lg-on button\.dsh-lg-fullscreen-toggle\s*\{[^}]*\}/)?.[0] ?? '';
if (!fullscreenCss.includes('28px')) throw new Error('the fullscreen toggle must be a 28px icon button');
if (!fullscreenCss.includes('order: 5')) throw new Error('the fullscreen toggle must be ordered after the header corner');
if (fullscreenCss.includes('999px')) throw new Error('the fullscreen toggle must not be a capsule');
// Desktop: the bar merges INTO the 40px caption band (window-level strip).
const captioned = styleEl.textContent.match(/html\[data-windows-titlebar\] body\.dsh-lg-on \[data-slot="conversation\.header"\] > header,\s*html\[data-windows-titlebar\] body\.dsh-lg-on header:has\(\[role="tablist"\]\)\s*\{[^}]*\}/)?.[0] ?? '';
if (!captioned) throw new Error('style missing the desktop caption-band merge rule');
if (!captioned.includes('position: fixed')) throw new Error('the desktop bar must leave the column and span the window');
if (!captioned.includes('height: var(--dsh-windows-titlebar-height, 40px)')) throw new Error('the desktop bar must be exactly the caption band height');
if (!captioned.includes('min-height: 0')) throw new Error('the desktop bar must drop the 48px one-row min-height');
// The bar's BOX must start after the chrome controls, not merely pad them away:
// a box spanning them swallows their clicks (reported bug). The clearance is
// MEASURED at runtime — --dsh-lg-caption-lead, published by the client half from
// the real menubar box — because a hard-coded lead is wrong for every locale but
// one: 134px reserved for a ~98px Chinese menu left a dead gap that read as the
// session title being shoved right, while the ~154px English menu would have put
// the title UNDER the menubar.
if (!captioned.includes('left: calc(var(--dsh-windows-menu-start, 48px) + var(--dsh-lg-caption-lead, 134px))')) throw new Error('the desktop bar box must start after the window-chrome controls, at the measured menubar clearance');
if (/(?:^|\n)\s*padding-left: calc\(var\(--dsh-windows-menu-start/.test(styleEl.textContent)) throw new Error('the clearance must be a left offset, not padding-left');
if (!captioned.includes('titlebar-area-width')) throw new Error('the desktop bar must clear the native caption buttons');
if (!captioned.includes('-webkit-app-region: drag')) throw new Error('the desktop bar must claim the window drag region it now covers');
if (!styleEl.textContent.includes("-webkit-app-region: no-drag")) throw new Error('interactive occupants of the desktop bar must opt out of the drag region');
// One frost source only: the band's pseudo, never the bar's as well.
const headerPseudoOff = styleEl.textContent.match(/html\[data-windows-titlebar\] body\.dsh-lg-on \[data-slot="conversation\.header"\] > header::before,[^{]*\{[^}]*\}/)?.[0] ?? '';
if (!headerPseudoOff.includes('display: none')) throw new Error('the desktop bar pseudo must be off so only the caption band frosts');
if (!styleEl.textContent.includes('black 30%, transparent 100%')) throw new Error('the caption band mask must match the bar gradient shape');
// The right-most control must not slide under the native caption buttons.
const cornerFix = styleEl.textContent.match(/html\[data-windows-titlebar\] body\.dsh-lg-on \[data-slot="conversation\.header"\] > header \[class\*="_headerCorner"\]\s*\{[^}]*\}/)?.[0] ?? '';
if (!cornerFix.includes('margin-right: 0')) throw new Error('the header corner negative margin must be cancelled so it clears the caption buttons');
// The desktop band CENTRES the session title: it leaves the header's row entirely
// and is centred between the band's edges (compensating the measured menubar lead,
// because the band starts that far into the window), so neither the menubar
// clearance on the left nor the tabs / dropdown / caption buttons on the right can
// squeeze it — which is exactly how "简…" got jammed against the mode chip.
const bandTitleCluster = styleEl.textContent.match(/html\[data-windows-titlebar\] body\.dsh-lg-on header:has\(\[role="tablist"\]\) \[class\*="_titleCluster"\]\s*\{[^}]*\}/)?.[0] ?? '';
if (!bandTitleCluster.includes('position: fixed !important')) throw new Error('the band title must leave the header row so no neighbouring item can squeeze it');
if (!bandTitleCluster.includes('margin-inline: auto !important')) throw new Error('the band title must be centred between the window edges');
if (!bandTitleCluster.includes('width: max-content !important')) throw new Error('the band title must size to its own text');
if (!bandTitleCluster.includes('height: var(--dsh-windows-titlebar-height')) throw new Error('the centred title must ride the caption band');
if (!bandTitleCluster.includes('padding-inline-start: 0 !important')) throw new Error('the desktop band must zero the in-flow leading clearance');
if (bandTitleCluster.includes('transform')) throw new Error('the band title must be centred without a transform (it would capture fixed-position menus)');
// The band is window-wide, so the title must be allowed to USE it: the stock crumb
// caps at 220px and ellipsizes right next to the mode chip (reported as "the title
// is cut off by the thing on its right"), and the cap must not turn into a hard
// clip when space really runs out.
const bandCrumb = styleEl.textContent.match(/html\[data-windows-titlebar\] body\.dsh-lg-on (?:\[data-slot="conversation\.header"\] > header|header:has\(\[role="tablist"\]\)) \[class\*="_crumb"\]\s*\{[^}]*\}/)?.[0] ?? '';
if (!bandCrumb.includes('min-width: 0')) throw new Error('the band crumb must be shrinkable so a tight title ellipsizes instead of being hard-clipped mid-character');
const bandCrumbCurrent = styleEl.textContent.match(/html\[data-windows-titlebar\] body\.dsh-lg-on (?:\[data-slot="conversation\.header"\] > header|header:has\(\[role="tablist"\]\)) \[class\*="_crumbCurrent"\]\s*\{[^}]*\}/)?.[0] ?? '';
if (!bandCrumbCurrent.includes('max-width: none')) throw new Error('the band must let the current session title use the free width instead of the stock 220px cap');
// The sidebar's own collapse control is window chrome: the lens rule must not
// drag it back into the sidebar (reported bug).
const toggleRestore = styleEl.textContent.match(/html\[data-windows-titlebar\] body\.dsh-lg-on \[class\*="_root"\]:has\(\[class\*="_treeBody"\]\) button\[class\*="_iconButton"\]\[class\*="_toggle"\]\s*\{[^}]*\}/)?.[0] ?? '';
if (!toggleRestore.includes('position: fixed')) throw new Error('the sidebar collapse control must stay pinned in the caption band');
const desktopScrollPad = styleEl.textContent.match(/html\[data-windows-titlebar\] body\.dsh-lg-on \[data-phase="active"\] \[data-conversation-scroll\][^{]*\{[^}]*\}/)?.[0] ?? '';
if (!desktopScrollPad.includes('padding-top: var(--dsh-windows-titlebar-height, 40px)')) throw new Error('the desktop transcript must clear only the caption band');
const desktopFullscreen = styleEl.textContent.match(/html\[data-windows-titlebar\]\[data-fullscreen\][^{]*\{[^}]*\}/)?.[0] ?? '';
if (!desktopFullscreen.includes('padding-right: 0')) throw new Error('fullscreen hides the caption buttons, so the right clearance must go');
// Surfaces the glass recipe left see-through: the choice dialog (which carries no
// role=dialog at all), the changed-files hover preview (role=dialog with
// aria-label — the case the settings-dialog rule deliberately excludes), and two
// faint token-filled surfaces. Each must pair a real fill with a backdrop blur.
const choiceCards = styleEl.textContent.match(/body\.dsh-lg-on \[data-question-key\] \[class\*="_card"\],[^{]*\{[^}]*\}/)?.[0] ?? '';
if (!choiceCards.includes('backdrop-filter')) throw new Error('the choice dialog must ride backdrop-filter');
if (!choiceCards.includes('--dsh-lg-tint')) throw new Error('the choice dialog must get a real background from the tint variable');
if (!choiceCards.includes('78%')) throw new Error('the choice dialog fill must be the agreed 78%');
// The preview's floating surface is the element DIRECTLY wrapping the harness's
// stable attribute — HoverCard's card class is a build hash and must not be used.
const previewDialog = styleEl.textContent.match(/body\.dsh-lg-on \*:has\(> \[data-changes-hover-preview\]\)\s*\{[^}]*\}/)?.[0] ?? '';
if (!previewDialog) throw new Error('style missing the changed-files hover preview rule');
if (!previewDialog.includes('backdrop-filter')) throw new Error('the hover preview must ride backdrop-filter');
if (!previewDialog.includes('84%')) throw new Error('the hover preview fill must be the agreed 84%');
if (previewDialog.includes('border:')) throw new Error('the preview surface keeps its own shadow and radius, so it needs no border');
// The inner element must NOT be painted too, or the two fills stack into an opaque panel.
if (/body\.dsh-lg-on \[data-changes-hover-preview\]\s*\{/.test(styleEl.textContent)) throw new Error('only the preview SURFACE may be filled, not the inner element');
const faintSurfaces = styleEl.textContent.match(/body\.dsh-lg-on \[data-changed-files\],[^{]*\{[^}]*\}/)?.[0] ?? '';
if (!faintSurfaces.includes('[data-question-reply]')) throw new Error('the question receipt bubble must be covered too');
if (!faintSurfaces.includes('backdrop-filter')) throw new Error('the edited-files card and receipt bubble must ride backdrop-filter');
// both surfaces must have a dark-theme counterpart, or they go opaque white in dark mode
for (const [name, snippet] of [['choice dialog', 'body[data-ds-dark-theme].dsh-lg-on [data-question-key]'], ['hover preview', 'body[data-ds-dark-theme].dsh-lg-on *:has(> [data-changes-hover-preview])']]) {
  if (!styleEl.textContent.includes(snippet)) throw new Error(`${name} needs a dark-theme fill`);
  const rule = styleEl.textContent.match(new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^{]*\\{[^}]*\\}'))?.[0] ?? '';
  if (!rule.includes('--dsh-lg-tint-dark')) throw new Error(`${name} dark fill must use the dark tint variable`);
}
// Harness tooltip bug workaround (see the stylesheet comment): the tooltip is an
// inline position:fixed bubble, so any container-type ancestor becomes its
// containing block, misplaces it and inflates the transcript's scroll area.
const tooltipFix = styleEl.textContent.match(/body\.dsh-lg-on \[data-composer-card\] \[class\*="_row"\],[^{]*\{[^}]*\}/)?.[0] ?? '';
if (!tooltipFix.includes('container-type: normal')) throw new Error('the harness tooltip containment workaround is missing');
if (!tooltipFix.includes('[data-conversation-scroll]')) throw new Error('the tooltip workaround must also cover the transcript scroll container');
if (!tooltipFix.includes('_frame')) throw new Error('the tooltip workaround must also cover the chat frame');
// The turn-rail container must be left alone: its own @container query hides the
// rail on narrow windows, which would stop working if it were neutralised.
if (/body\.dsh-lg-on [^{,]*_slot[^{,]*\{[^}]*container-type/.test(styleEl.textContent)) {
  throw new Error('the turn-navigator container must keep its container-type (its @container query hides the rail on narrow windows)');
}
// The model-selector popup is deliberately left to the harness: this theme must
// NOT restyle it (other theme plugins style the same menu, and the two fought).
// NB: the access-mode dropdown rule legitimately uses the NEGATIVE form
// (`:not(:has(.scrollable))`) to exclude the model menu, so only the positive
// full-screen selector must be gone.
if (styleEl.textContent.includes('[role="menu"]:has(.scrollable)')) throw new Error('the model-selector full-screen styling must be gone (it conflicts with other theme plugins)');
if (styleEl.textContent.includes('grid-template-columns: 1fr 1fr')) throw new Error('the model-selector two-column grid must be gone');
// the access-mode dropdown (a different [role="menu"] in the composer) keeps its glass
if (!styleEl.textContent.includes('[role="menu"]:not(:has(.scrollable))')) throw new Error('the access-mode dropdown glass must stay');
// hover styling must stay scoped to this theme's own surfaces, never blanket
if (styleEl.textContent.includes('body.dsh-lg-on button:not(:disabled):hover')) throw new Error('hover styling must not use a blanket button selector');
if (styleEl.textContent.includes('[role="menuitem"]:not(:disabled):hover')) throw new Error('hover styling must not reach every menu item (conflicts with other plugins)');
// tool call text gets text-shadow and optional custom color
if (!styleEl.textContent.includes('data-disclosure-row] [class*="title"]')) throw new Error('style missing tool call title text-shadow rule');
const toolTitleRule = styleEl.textContent.match(/(?:^|\n)body\.dsh-lg-on \[data-variant\] \[data-disclosure-row\] \[class\*="title"\]\s*\{[^}]*\}/)?.[0] ?? '';
if (!toolTitleRule.includes('text-shadow')) throw new Error('tool call titles must have text-shadow for readability');
// the header's bottom hairline must be gone. On harness >=0.2 the stock header
// paints it as a REAL border-bottom (.5px solid --dsw-alias-border-l3) — which
// this theme turns into a bright white line — so clearing the pseudo alone is
// not enough: the border itself must be cleared too.
const headerBaseNew = styleEl.textContent.match(/(?:^|\n)body\.dsh-lg-on \[data-slot="conversation\.header"\] > header[^{]*\{[^}]*\}/)?.[0] ?? '';
if (!headerBaseNew.includes('border-bottom: none')) throw new Error('harness>=0.2 header must clear the stock border-bottom white seam');
const headerBaseLegacy = styleEl.textContent.match(/(?:^|\n)body\.dsh-lg-on header:has\(\[role="tablist"\]\)\s*\{[^}]*\}/)?.[0] ?? '';
if (!headerBaseLegacy.includes('border-bottom: none')) throw new Error('the legacy header arm must clear the stock border-bottom too');
const headerLine = styleEl.textContent.match(/(?:^|\n)body\.dsh-lg-on header:has\(\[role="tablist"\]\)::after\s*\{[^}]*\}/)?.[0] ?? '';
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

// Light-mode text contrast. The harness greys assume an opaque canvas
// (secondary #61666b, tertiary #81858c, caption #adb2b8); over this theme's
// translucent surfaces they wash out, so the light steps must be visibly darker
// while dark mode keeps the harness static tokens.
const luminance = (hex) => {
  const v = String(hex).replace('#', '');
  const chan = [0, 2, 4]
    .map((i) => parseInt(v.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * chan[0] + 0.7152 * chan[1] + 0.0722 * chan[2];
};
for (const [name, stockHex, maxLum] of [
  ['--dsw-alias-label-secondary', '#61666b', 0.05],
  ['--dsw-alias-label-tertiary', '#81858c', 0.09],
  ['--dsw-alias-label-caption', '#adb2b8', 0.15],
]) {
  const token = tokens[name];
  if (!token) throw new Error(`${name} must be overridden for light-mode readability`);
  if (!/^#[0-9a-f]{6}$/i.test(token.light)) throw new Error(`${name} light value must be a plain hex, got ${token.light}`);
  if (luminance(token.light) >= luminance(stockHex)) throw new Error(`${name} must be darker than the harness value ${stockHex}`);
  if (luminance(token.light) > maxLum) throw new Error(`${name} is still too light for a translucent canvas: ${token.light}`);
  if (!String(token.dark).includes('--dsw-static-neutral-bluish-')) throw new Error(`${name} must reference the harness dark token, got ${token.dark}`);
}

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
const panelRegistration = registrationLog.find((r) => r.options?.id === 'liquid-glass');
if (!panelRegistration) throw new Error('panel not registered');
if (panelRegistration.options.name !== 'settings.section') throw new Error(`panel must be a settings.section page, got ${panelRegistration.options.name}`);
if (panelRegistration.options.order !== 100) throw new Error(`section order must place it after shipped pages, got ${panelRegistration.options.order}`);
if (panelRegistration.options.label !== '液态玻璃') throw new Error(`section nav label missing, got ${String(panelRegistration.options.label)}`);
const instance = panelRegistration.options.store.create();
const face = panelRegistration.options.inject(instance.actions);
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
