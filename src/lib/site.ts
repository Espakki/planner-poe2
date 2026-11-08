/**
 * Helpers de build-time do site (rodam no Astro, no Node).
 * Juntam as content collections, ícones e árvores resolvidas por fase.
 */
import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { getCollection } from 'astro:content';
import type { BuildData, GemData, ItemData, PassiveData } from './schemas.ts';
import { loadTreeData, resolveBuildTrees, type ResolvedPhaseTree } from './build-tree.ts';

export const ROOT = process.cwd();

/** Junta BASE_URL com um caminho, sem barras duplicadas. */
export function url(p = ''): string {
  const base = import.meta.env.BASE_URL.replace(/\/+$/, '');
  const clean = p.replace(/^\/+/, '');
  return `${base}/${clean}`;
}

export type Entity<T> = T & { id: string; icon?: string; skillIcon?: string; art?: ItemArtSize };

export interface ItemArtSize {
  /** px da arte (nativa do inventário do jogo, ~106px por célula) */
  w: number;
  h: number;
  /** células do inventário (ex.: luva 2×2, cajado 1×4) */
  cw: number;
  ch: number;
}

let iconIndex: Record<string, string> | null = null;
let nodeIconIndex: Record<string, string> | null = null;
let sizeIndex: Record<string, ItemArtSize> | null = null;
function readJsonIfExists<T>(file: string, fallback: T): T {
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as T) : fallback;
}
function icons() {
  if (!iconIndex) {
    const dir = path.join(ROOT, 'public', 'icons');
    iconIndex = readJsonIfExists(path.join(dir, 'index.json'), {});
    nodeIconIndex = readJsonIfExists(path.join(dir, 'nodes.json'), {});
    sizeIndex = readJsonIfExists(path.join(dir, 'sizes.json'), {});
  }
  return { iconIndex: iconIndex!, nodeIconIndex: nodeIconIndex!, sizeIndex: sizeIndex! };
}

export function iconFor(key: string): string | undefined {
  const rel = icons().iconIndex[key];
  return rel ? url(rel) : undefined;
}

/** Ícone da HABILIDADE de uma gema (o da barra de skills), quando existe. */
export function skillIconFor(gemId: string): string | undefined {
  return iconFor(`skills/${gemId}`);
}

/** Tamanho da arte e células de inventário de um item (de public/icons/sizes.json). */
export function itemArtSize(itemId: string): ItemArtSize | undefined {
  return icons().sizeIndex[`items/${itemId}`];
}

export function nodeIcon(nodeId: number): string | undefined {
  const { iconIndex: idx, nodeIconIndex: nodes } = icons();
  const key = nodes[String(nodeId)];
  const rel = key ? idx[key] : undefined;
  return rel ? url(rel) : undefined;
}

export interface Entities {
  items: Map<string, Entity<ItemData>>;
  gems: Map<string, Entity<GemData>>;
  passives: Map<string, Entity<PassiveData>>;
}

let entitiesCache: Entities | null = null;
export async function getEntities(): Promise<Entities> {
  if (entitiesCache) return entitiesCache;
  const [items, gems, passives] = await Promise.all([getCollection('items'), getCollection('gems'), getCollection('passives')]);
  entitiesCache = {
    items: new Map(items.map((e) => [e.id, { ...e.data, id: e.id, icon: iconFor(`items/${e.id}`), art: itemArtSize(e.id) }])),
    gems: new Map(gems.map((e) => [e.id, { ...e.data, id: e.id, icon: iconFor(`gems/${e.id}`), skillIcon: skillIconFor(e.id) }])),
    passives: new Map(passives.map((e) => [e.id, { ...e.data, id: e.id, icon: iconFor(`passives/${e.id}`) }])),
  };
  return entitiesCache;
}

/** Compara versões "0.5.5" / "0.6" / "1.0". */
export function comparePatch(a: string, b: string): number {
  const pa = a.split('.').map((x) => Number.parseInt(x, 10) || 0);
  const pb = b.split('.').map((x) => Number.parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

export interface BuildVersion {
  data: BuildData;
  slug: string;
  patch: string;
  isLatest: boolean;
}

export async function getBuildVersions(): Promise<Map<string, BuildVersion[]>> {
  const all = await getCollection('builds');
  const bySlug = new Map<string, BuildVersion[]>();
  for (const e of all) {
    const d = e.data;
    const list = bySlug.get(d.meta.slug) ?? [];
    list.push({ data: d, slug: d.meta.slug, patch: d.meta.patch, isLatest: false });
    bySlug.set(d.meta.slug, list);
  }
  for (const list of bySlug.values()) {
    list.sort((a, b) => comparePatch(b.patch, a.patch));
    // "latest" = patch mais novo que não esteja arquivado
    const latest = list.find((v) => v.data.meta.status !== 'archived') ?? list[0];
    latest.isLatest = true;
  }
  return bySlug;
}

const treeCache = new Map<string, ResolvedPhaseTree[]>();
export async function getPhaseTrees(build: BuildData): Promise<ResolvedPhaseTree[]> {
  const key = `${build.meta.slug}@${build.meta.patch}`;
  const hit = treeCache.get(key);
  if (hit) return hit;
  const { passives } = await getEntities();
  const passiveNodes = new Map([...passives.values()].map((p) => [p.id, p.nodeId] as [string, number]));
  const dir = path.join(ROOT, 'src', 'content', 'builds', build.meta.slug);
  const res = resolveBuildTrees({ build, root: ROOT, dir, tree: loadTreeData(ROOT, build.meta.treeVersion), passiveNodes });
  treeCache.set(key, res);
  return res;
}

/** "Onde conseguir" padrão de uma gema. */
export function gemWhere(g: GemData): string {
  if (g.wherePt) return g.wherePt;
  const t = g.tier ?? 0;
  switch (g.kind) {
    case 'support':
      return t ? `Uncut Support Gem (tier ${t})` : 'Suporte especial (Lineage) — drop/trade';
    case 'spirit':
      return t ? `Uncut Spirit Gem (nível ${t}+)` : 'Gema de Spirit especial';
    case 'ascendancy':
      return 'Concedida pela ascendência';
    default:
      return t ? `Uncut Skill Gem (nível ${t}+)` : 'Concedida por item/ascendência';
  }
}

export const KIND_PT: Record<string, string> = {
  active: 'Skill',
  support: 'Suporte',
  spirit: 'Spirit',
  meta: 'Meta',
  ascendancy: 'Ascendência',
  shapeshift: 'Forma',
  curse: 'Maldição',
  unique: 'Único',
  base: 'Base',
  rune: 'Runa',
  'soul-core': 'Soul Core',
  flask: 'Frasco',
  charm: 'Charm',
  jewel: 'Joia',
  currency: 'Currency',
  talisman: 'Talismã',
  notable: 'Notável',
  keystone: 'Keystone',
};

export const SLOT_PT: Record<string, string> = {
  weapon: 'Arma',
  offhand: 'Mão secundária',
  helmet: 'Elmo',
  body: 'Peitoral',
  gloves: 'Luvas',
  boots: 'Botas',
  amulet: 'Amuleto',
  ring: 'Anel',
  belt: 'Cinto',
  flask: 'Frasco',
  charm: 'Charm',
  jewel: 'Joia',
  socketable: 'Runa / socket',
  currency: 'Currency',
};

export const ROLE_PT: Record<string, string> = {
  main: 'Principal',
  utility: 'Utilidade',
  movement: 'Movimento',
  boss: 'Chefe',
  buff: 'Buff',
  aura: 'Aura',
  defense: 'Defesa',
  curse: 'Maldição',
};

export const STATUS_PT: Record<string, string> = {
  active: 'Atual',
  outdated: 'Desatualizada',
  archived: 'Arquivada',
};

export function fmtDate(d: Date): string {
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Hash curto e estável (pra chave de checklist no localStorage). */
export function hashKey(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}
