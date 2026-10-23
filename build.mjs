// Build the dual-half plugin with @swc/core (in-process native transform — no
// child-process spawns, so it runs under the workspace sandbox):
//   lib/index.js   — host half (ESM, imports resolved from the profile at runtime)
//   lib/shared.js  — shared constants used by the host half
//   lib/client.js  — client half wrapped in window.__ModuleLoader__.load({ id, factory })
//                    (the exact bundle format dsh-client-modules serves at /plugins/<id>/client.js)
import { transform } from '@swc/core';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const clientId = 'dsh-theme-liquid-glass';
const RAW_CLIENT = join(root, '.build', 'client.raw.js');

async function transpile(rel, outRel, moduleType, extraJsc = {}) {
  const src = readFileSync(join(root, 'src', rel), 'utf8');
  const result = await transform(src, {
    filename: rel,
    jsc: {
      parser: { syntax: 'typescript', tsx: true },
      target: 'es2022',
      loose: true,
      ...extraJsc,
    },
    module: { type: moduleType },
    sourceMaps: false,
  });
  let code = result.code;
  if (moduleType === 'es6') {
    // Node ESM requires explicit relative specifiers; swc preserves the
    // extensionless TS style.
    code = code.replace(/(from\s+['"])(\.\.?\/[^'"]+?)(['"])/g, (_m, p1, p2, p3) => {
      if (/\.(js|mjs|cjs)$/.test(p2)) return p1 + p2 + p3;
      return `${p1}${p2}.js${p3}`;
    });
  }
  const out = join(root, 'lib', outRel);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, code);
}

function wrapClient() {
  const raw = readFileSync(RAW_CLIENT, 'utf8');
  const wrapped = `window.__ModuleLoader__.load({
\tid: ${JSON.stringify(clientId)},
\tfactory: (require) => {
\t\tvar module = { exports: {} };
\t\tvar exports = module.exports;
\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
${raw}
\t\treturn module.exports;
\t}
});
`;
  const out = join(root, 'lib', 'client.js');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, wrapped);
}

/**
 * The stylesheet lives in ONE template literal (const SHEET = ... ;), so a stray
 * backtick inside it — easy to introduce when a CSS comment quotes a property —
 * terminates the template early and swc then reports a bewildering syntax error
 * dozens of lines away. Catch it here with a precise message.
 * (See dev-troubleshooting.md, fault 16.)
 */
function assertNoBacktickInSheet() {
  const lines = readFileSync(join(root, 'src', 'client', 'index.tsx'), 'utf8').split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith('const SHEET = `'));
  if (start < 0) throw new Error('build: could not find the SHEET template literal in src/client/index.tsx');
  let end = -1;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '`;') {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error('build: could not find the END of the SHEET template literal (expected a line with just `; )');
  const offenders = [];
  for (let i = start + 1; i < end; i += 1) if (lines[i].includes('`')) offenders.push(i + 1);
  if (offenders.length > 0) {
    throw new Error(
      `build: stray backtick inside the SHEET template literal at line(s) ${offenders.join(', ')} of src/client/index.tsx — ` +
        'it ends the template early. Use plain text in stylesheet comments, never backticks.',
    );
  }
}

async function buildOnce() {
  rmSync(join(root, '.build'), { recursive: true, force: true });
  assertNoBacktickInSheet();
  await transpile('shared.ts', 'shared.js', 'es6');
  await transpile('index.ts', 'index.js', 'es6');
  await transpile('client/index.tsx', join('..', '.build', 'client.raw.js'), 'commonjs', {
    transform: { react: { runtime: 'automatic' } },
  });
  wrapClient();
  console.log('build: lib/index.js, lib/shared.js, lib/client.js written');
}

const isWatch = process.argv.includes('--watch');
if (isWatch) {
  const { watch } = await import('node:fs');
  let building = false;
  let pending = false;
  const rebuild = async () => {
    if (building) {
      pending = true;
      return;
    }
    building = true;
    try {
      await buildOnce();
    } finally {
      building = false;
      if (pending) {
        pending = false;
        await rebuild();
      }
    }
  };
  watch(join(root, 'src'), { recursive: true }, () => {
    console.log('change detected, rebuilding…');
    rebuild();
  });
  console.log('watch: rebuilding lib/ on src changes (Ctrl+C to stop)');
} else {
  await buildOnce();
}
