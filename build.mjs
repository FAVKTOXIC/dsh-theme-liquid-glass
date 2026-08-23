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

async function buildOnce() {
  rmSync(join(root, '.build'), { recursive: true, force: true });
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
