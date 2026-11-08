/**
 * Resolve a árvore de cada fase de uma build (roda no build do Astro e nos scripts).
 *
 * - Lê a fonte da fase: código PoB (spec pelo título), arquivo do Build Planner ou lista de nodes.
 * - Ascendência: os nodes de ascendância NÃO vêm da fonte — são recalculados a partir do plano
 *   do YAML (`ascendancy.take` / `refund`, acumulado fase a fase) com o menor caminho a partir do
 *   node inicial. Assim a árvore sempre bate com o texto (os exports do planner tinham divergências).
 * - Calcula o diff com a fase anterior (o que pegar agora / o que desalocar).
 */
import path from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { parsePobCode, type PobBuild } from './pob.ts';
import { resolvePlanner, type PlannerFile } from './planner.ts';
import type { BuildData } from './schemas.ts';
import type { CompactTree, PhaseTree } from './tree-types.ts';

export interface ResolvedPhaseTree extends PhaseTree {
  /** Nodes da árvore principal (sem ascendência, sem início de classe). */
  mainPoints: number;
  wsPoints: number;
  ascPoints: number;
  added: number[];
  removed: number[];
  /** Notáveis/keystones novos nesta fase (árvore principal + ascendência). */
  newNotables: { id: number; name: string; kind: string; asc?: string; stats: string[] }[];
  removedNotables: { id: number; name: string; kind: string; asc?: string }[];
  error?: string;
}

const pobCache = new Map<string, PobBuild>();

export function loadTreeData(root: string, version: string): CompactTree {
  const f = path.join(root, 'public', 'tree', `${version}.json`);
  if (!existsSync(f)) throw new Error(`Árvore ${version} não encontrada em public/tree. Rode: npm run update-tree -- --version ${version}`);
  return JSON.parse(readFileSync(f, 'utf8')) as CompactTree;
}

function shortestPaths(tree: CompactTree, ascName: string, targets: number[], prefer: Set<number>): number[] {
  const ascNodes = new Map(tree.nodes.filter((n) => n.asc === ascName).map((n) => [n.id, n]));
  const start = [...ascNodes.values()].find((n) => n.k === 'A');
  if (!start || !targets.length) return [];
  const adj = new Map<number, number[]>();
  for (const e of tree.edges) {
    const [a, b] = e;
    if (!ascNodes.has(a) || !ascNodes.has(b)) continue;
    (adj.get(a) ?? adj.set(a, []).get(a)!).push(b);
    (adj.get(b) ?? adj.set(b, []).get(b)!).push(a);
  }
  // BFS preferindo vizinhos que já estavam na fonte (empates resolvidos a favor do guia)
  const prev = new Map<number, number>();
  const seen = new Set([start.id]);
  const queue = [start.id];
  while (queue.length) {
    const cur = queue.shift()!;
    const next = [...(adj.get(cur) ?? [])].sort((x, y) => Number(prefer.has(y)) - Number(prefer.has(x)));
    for (const nb of next) {
      if (seen.has(nb)) continue;
      seen.add(nb);
      prev.set(nb, cur);
      queue.push(nb);
    }
  }
  const out = new Set<number>([start.id]);
  for (const t of targets) {
    let cur: number | undefined = t;
    while (cur != null && cur !== start.id) {
      out.add(cur);
      cur = prev.get(cur);
    }
  }
  return [...out];
}

export function resolveBuildTrees(opts: {
  build: BuildData;
  /** Raiz do projeto. */
  root: string;
  /** Pasta da build (onde ficam os arquivos de sources). */
  dir: string;
  tree: CompactTree;
  /** id da entity de passiva → nodeId */
  passiveNodes: Map<string, number>;
}): ResolvedPhaseTree[] {
  const { build, dir, tree } = opts;
  const byId = new Map(tree.nodes.map((n) => [n.id, n]));
  const stringIds = new Map<string, number>();
  // stringIds ficam no node-index (não vão pro navegador)
  const idxFile = path.join(opts.root, 'data', 'tree', build.meta.treeVersion, 'node-index.json');
  if (existsSync(idxFile)) {
    for (const n of JSON.parse(readFileSync(idxFile, 'utf8')) as { id: number; stringId?: string }[]) {
      if (n.stringId) stringIds.set(n.stringId, n.id);
    }
  }
  const ascName = build.meta.ascendancy;
  const ascSet = new Set<string>();
  const out: ResolvedPhaseTree[] = [];
  let prevAll: Set<number> | null = null;

  for (const ph of build.phases) {
    for (const p of ph.ascendancy?.refund ?? []) ascSet.delete(p);
    for (const p of ph.ascendancy?.take ?? []) ascSet.add(p);

    let nodes: number[] = [];
    let ws1: number[] = [];
    let ws2: number[] = [];
    let originPt = '';
    let pobUrl: string | undefined;
    let error: string | undefined;
    const t = ph.tree;
    try {
      if (!t) throw new Error('fase sem árvore');
      if ('pob' in t) {
        const ref = build.meta.pob[t.pob];
        if (!ref) throw new Error(`pob "${t.pob}" não existe`);
        const file = path.join(dir, ref.file);
        let pob = pobCache.get(file);
        if (!pob) {
          pob = parsePobCode(readFileSync(file, 'utf8'));
          pobCache.set(file, pob);
        }
        const spec = pob.specs.find((s) => s.title === t.spec);
        if (!spec) throw new Error(`spec "${t.spec}" não encontrada`);
        nodes = spec.nodes;
        ws1 = spec.ws1;
        ws2 = spec.ws2;
        originPt = `PoB · ${ref.label} · spec "${spec.title}"`;
        pobUrl = ref.url;
      } else if ('planner' in t) {
        const file = path.join(dir, t.planner);
        const res = resolvePlanner(JSON.parse(readFileSync(file, 'utf8')) as PlannerFile, stringIds);
        nodes = res.nodes;
        ws1 = res.ws1;
        ws2 = res.ws2;
        originPt = `Build Planner · ${res.name}`;
      } else {
        nodes = t.nodes;
        originPt = 'Lista de nodes no YAML';
      }
    } catch (e) {
      error = String((e as Error).message ?? e);
    }

    const source = new Set(nodes.filter((id) => byId.has(id)));
    const main = [...source].filter((id) => {
      const n = byId.get(id)!;
      return !n.asc;
    });
    const targets = [...ascSet].map((p) => opts.passiveNodes.get(p)).filter((x): x is number => x != null);
    const asc = shortestPaths(tree, ascName, targets, source);
    const all = new Set([...main, ...asc]);
    const wsAll = new Set([...ws1, ...ws2]);
    for (const id of wsAll) if (byId.has(id)) all.add(id);

    const counted = (ids: Iterable<number>) =>
      [...ids].filter((id) => {
        const n = byId.get(id);
        return n && n.k !== 'S' && n.k !== 'A';
      });
    const mainPoints = counted(main).filter((id) => !wsAll.has(id)).length;
    const ascPoints = counted(asc).length;

    const added = prevAll ? [...all].filter((id) => !prevAll!.has(id)) : [...all];
    const removed = prevAll ? [...prevAll].filter((id) => !all.has(id)) : [];
    const isBig = (id: number) => {
      const k = byId.get(id)?.k;
      return k === 'N' || k === 'K' || k === 'J';
    };
    const describe = (id: number) => {
      const n = byId.get(id)!;
      return { id, name: n.n, kind: n.k, asc: n.asc, stats: n.s ?? [] };
    };

    out.push({
      phaseId: ph.id,
      label: ph.stagePt ? `${ph.stagePt} · ${ph.title}` : ph.title,
      levels: ph.levels,
      nodes: [...all],
      ws1: ws1.filter((id) => byId.has(id)),
      ws2: ws2.filter((id) => byId.has(id)),
      originPt,
      pobUrl,
      mainPoints,
      wsPoints: counted(wsAll).length,
      ascPoints,
      added,
      removed,
      newNotables: added.filter(isBig).map(describe),
      removedNotables: removed.filter(isBig).map((id) => {
        const { stats: _s, ...rest } = describe(id);
        return rest;
      }),
      error,
    });
    prevAll = all;
  }
  return out;
}
