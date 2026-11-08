/**
 * npm run update-tree [-- --version 0_5]
 *
 * Baixa o tree.json do Path of Building (PoE2) e gera:
 *   public/tree/<versão>.json          → árvore compacta servida pro navegador
 *   data/tree/<versão>/node-index.json → índice (nome, stringId, ícone da wiki, stats) usado no build
 *   data/tree/<versão>/meta.json       → de onde veio (commit/data) — documenta a versão usada
 *
 * Fonte: github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2 (branch dev), pasta src/TreeData/<versão>.
 * Sem --version, usa a pasta mais nova que existir lá.
 */
import path from 'node:path';
import { existsSync } from 'node:fs';
import { P, args, c, fetchWithRetry, readJson, writeJson } from './lib/util.ts';
import { buildCompactTree, buildNodeIndex, type RawTree } from '../src/lib/tree-build.ts';

const REPO = 'PathOfBuildingCommunity/PathOfBuilding-PoE2';
const BRANCH = 'dev';

async function gh<T>(url: string): Promise<T> {
  const res = await fetchWithRetry(url, { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${url}`);
  return (await res.json()) as T;
}

async function latestVersion(): Promise<string> {
  const list = await gh<{ name: string; type: string }[]>(
    `https://api.github.com/repos/${REPO}/contents/src/TreeData?ref=${BRANCH}`,
  );
  const versions = list
    .filter((x) => x.type === 'dir' && /^\d+_\d+$/.test(x.name))
    .map((x) => x.name)
    .sort((a, b) => {
      const [a1, a2] = a.split('_').map(Number);
      const [b1, b2] = b.split('_').map(Number);
      return a1 - b1 || a2 - b2;
    });
  if (!versions.length) throw new Error('Nenhuma pasta de versão em src/TreeData');
  return versions[versions.length - 1];
}

async function main() {
  const a = args();
  const version = typeof a.version === 'string' ? a.version : await latestVersion();
  const treePath = `src/TreeData/${version}/tree.json`;
  console.log(c.bold(`Árvore ${version}`) + c.dim(` (${REPO}@${BRANCH})`));

  const commits = await gh<{ sha: string; commit: { author: { date: string }; message: string } }[]>(
    `https://api.github.com/repos/${REPO}/commits?path=${encodeURIComponent(treePath)}&sha=${BRANCH}&per_page=1`,
  );
  const last = commits[0];
  if (!last) throw new Error(`Sem commits para ${treePath}`);
  console.log(c.dim(`  último commit: ${last.sha.slice(0, 8)} ${last.commit.author.date} — ${last.commit.message.split('\n')[0]}`));

  const cacheFile = path.join(P.cache, 'tree', version, `tree-${last.sha.slice(0, 8)}.json`);
  let raw: RawTree;
  if (existsSync(cacheFile)) {
    raw = await readJson<RawTree>(cacheFile);
    console.log(c.dim('  usando cache local'));
  } else {
    const res = await fetchWithRetry(`https://raw.githubusercontent.com/${REPO}/${last.sha}/${treePath}`);
    if (!res.ok) throw new Error(`Download falhou: ${res.status}`);
    raw = (await res.json()) as RawTree;
    await writeJson(cacheFile, raw, false);
  }

  const source = {
    repo: REPO,
    path: treePath,
    commit: last.sha,
    commitDate: last.commit.author.date,
    fetchedAt: new Date().toISOString(),
  };
  const compact = buildCompactTree(raw, version, source);
  const index = buildNodeIndex(raw);

  await writeJson(path.join(P.treePublic, `${version}.json`), compact, false);
  await writeJson(path.join(P.treeData, version, 'node-index.json'), index, false);
  await writeJson(path.join(P.treeData, version, 'meta.json'), {
    ...source,
    nodes: compact.nodes.length,
    edges: compact.edges.length,
  });

  const asc = compact.nodes.filter((n) => n.asc).length;
  console.log(
    c.green(`✔ ${compact.nodes.length} nodes (${asc} de ascendência), ${compact.edges.length} conexões`) +
      c.dim(`\n  → public/tree/${version}.json\n  → data/tree/${version}/node-index.json`),
  );
}

main().catch((e) => {
  console.error(c.red(String(e?.stack ?? e)));
  process.exit(1);
});
