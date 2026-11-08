/**
 * Conversão do tree.json bruto do PoB (PoE2) pro formato compacto do site.
 * Roda no Node (scripts e build do Astro). Geometria igual à do PoB:
 *   x = grupo.x + sin(ângulo) * raio ; y = grupo.y - cos(ângulo) * raio
 * Ver PathOfBuilding-PoE2/src/Classes/PassiveTree.lua (ProcessNode / BuildConnector).
 */
import type { CompactTree, NodeKind, TreeEdge, TreeNode } from './tree-types.ts';

export interface RawNode {
  skill: number;
  name?: string;
  stringId?: string;
  icon?: string;
  group?: number;
  orbit?: number;
  orbitIndex?: number;
  stats?: string[];
  connections?: { id: number; orbit: number }[];
  isNotable?: boolean;
  isKeystone?: boolean;
  isJewelSocket?: boolean;
  isAscendancyStart?: boolean;
  isOnlyImage?: boolean;
  isAttribute?: boolean;
  isMultipleChoice?: boolean;
  isMultipleChoiceOption?: boolean;
  classesStart?: string[];
  ascendancyName?: string;
}

export interface RawTree {
  nodes: Record<string, RawNode>;
  groups: ({ x: number; y: number; orbits: number[]; nodes: number[] } | null)[];
  constants: { orbitRadii: number[]; orbitAnglesByOrbit: number[][]; skillsPerOrbit: number[] };
  classes: { name: string; ascendancies: { id: string; name: string }[] }[];
}

export interface NodeIndexEntry {
  id: number;
  name: string;
  kind: NodeKind;
  asc?: string;
  stringId?: string;
  /** Nome do arquivo de ícone na poe2wiki (padrão `<dds>_passive_skill_icon.png`). */
  wikiIcon?: string;
  stats: string[];
}

/** Grupos no JSON do PoB são 1-indexados (vieram do Lua). */
function groupOf(raw: RawTree, g: number) {
  return raw.groups[g - 1] ?? null;
}

function kindOf(n: RawNode): NodeKind {
  if (n.classesStart) return 'S';
  if (n.isAscendancyStart) return 'A';
  if (n.isJewelSocket) return 'J';
  if (n.isKeystone) return 'K';
  if (n.isNotable) return 'N';
  if (n.isMultipleChoice) return 'M';
  if (n.isAttribute) return 'a';
  return 'n';
}

/** "Art/2DArt/SkillIcons/passives/MartialArtist/MartialArtistHandWraps.dds" → arquivo na wiki. */
export function wikiIconFor(iconPath: string | undefined): string | undefined {
  if (!iconPath) return undefined;
  const m = iconPath.match(/passives\/(?:(.+)\/)?([^/]+)\.dds$/i);
  if (!m) return undefined;
  const folder = m[1];
  let base = m[2];
  base = base.charAt(0).toUpperCase() + base.slice(1);
  return folder ? `${base}_(${folder.split('/').pop()})_passive_skill_icon.png` : `${base}_passive_skill_icon.png`;
}

function rawPos(raw: RawTree, n: RawNode): { x: number; y: number } | null {
  if (n.group == null || n.orbit == null || n.orbitIndex == null) return null;
  const g = groupOf(raw, n.group);
  if (!g) return null;
  const angle = raw.constants.orbitAnglesByOrbit[n.orbit]?.[n.orbitIndex];
  const r = raw.constants.orbitRadii[n.orbit];
  if (angle == null || r == null) return null;
  return { x: g.x + Math.sin(angle) * r, y: g.y - Math.cos(angle) * r };
}

const round = (v: number) => Math.round(v * 10) / 10;

/**
 * Ascendências ficam espalhadas fora da árvore nos dados; no jogo aparecem no centro.
 * Movemos cada ascendência pra (0,0) usando o centro do grupo do node inicial.
 */
function ascendancyOffsets(raw: RawTree): Map<string, { dx: number; dy: number }> {
  const out = new Map<string, { dx: number; dy: number }>();
  for (const n of Object.values(raw.nodes)) {
    if (!n.isAscendancyStart || !n.ascendancyName || n.group == null) continue;
    const g = groupOf(raw, n.group);
    if (g) out.set(n.ascendancyName, { dx: -g.x, dy: -g.y });
  }
  return out;
}

export function buildCompactTree(raw: RawTree, version: string, source: CompactTree['source']): CompactTree {
  const offsets = ascendancyOffsets(raw);
  const nodes: TreeNode[] = [];
  const pos = new Map<number, { x: number; y: number; group?: number; orbit?: number; asc?: string }>();

  for (const n of Object.values(raw.nodes)) {
    if (n.isOnlyImage || n.isMultipleChoiceOption) continue;
    const p = rawPos(raw, n);
    if (!p) continue;
    let { x, y } = p;
    if (n.ascendancyName) {
      const off = offsets.get(n.ascendancyName);
      if (!off) continue;
      x += off.dx;
      y += off.dy;
    }
    const k = kindOf(n);
    const node: TreeNode = { id: n.skill, x: round(x), y: round(y), k, n: n.name ?? '' };
    if (n.stats?.length) node.s = n.stats;
    if (n.ascendancyName) node.asc = n.ascendancyName;
    nodes.push(node);
    pos.set(n.skill, { x, y, group: n.group, orbit: n.orbit, asc: n.ascendancyName });
  }

  const edges: TreeEdge[] = [];
  const seen = new Set<string>();
  for (const n of Object.values(raw.nodes)) {
    const a = pos.get(n.skill);
    if (!a) continue;
    for (const c of n.connections ?? []) {
      const b = pos.get(c.id);
      if (!b) continue;
      // Não liga ascendência com árvore principal (e vice-versa).
      if ((a.asc ?? '') !== (b.asc ?? '')) continue;
      const key = n.skill < c.id ? `${n.skill}-${c.id}` : `${c.id}-${n.skill}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const radii = raw.constants.orbitRadii;
      if (c.orbit !== 0 && radii[Math.abs(c.orbit)]) {
        const r = radii[Math.abs(c.orbit)];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0 && dist < r * 2) {
          const perp = Math.sqrt(r * r - (dist * dist) / 4) * (c.orbit > 0 ? 1 : -1);
          const cx = a.x + dx / 2 + perp * (dy / dist);
          const cy = a.y + dy / 2 - perp * (dx / dist);
          edges.push([n.skill, c.id, round(cx), round(cy), round(r)]);
          continue;
        }
      } else if (c.orbit === 0 && a.group != null && a.group === b.group && a.orbit === b.orbit && a.orbit) {
        const g = groupOf(raw, a.group);
        if (g) {
          const off = a.asc ? offsets.get(a.asc) : undefined;
          const cx = g.x + (off?.dx ?? 0);
          const cy = g.y + (off?.dy ?? 0);
          edges.push([n.skill, c.id, round(cx), round(cy), raw.constants.orbitRadii[a.orbit]]);
          continue;
        }
      }
      edges.push([n.skill, c.id]);
    }
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    if (n.asc) continue;
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x);
    maxY = Math.max(maxY, n.y);
  }

  const startByClass = new Map<string, number>();
  for (const n of Object.values(raw.nodes)) for (const c of n.classesStart ?? []) startByClass.set(c, n.skill);

  return {
    version,
    source,
    bounds: [round(minX), round(minY), round(maxX), round(maxY)],
    nodes,
    edges,
    classes: raw.classes.map((c) => ({
      name: c.name,
      ascendancies: c.ascendancies.map((a) => a.name ?? a.id),
      startNode: startByClass.get(c.name),
    })),
  };
}

/** Índice usado no build (nome/stringId → node), sem geometria. */
export function buildNodeIndex(raw: RawTree): NodeIndexEntry[] {
  const out: NodeIndexEntry[] = [];
  for (const n of Object.values(raw.nodes)) {
    if (n.isOnlyImage) continue;
    out.push({
      id: n.skill,
      name: n.name ?? '',
      kind: kindOf(n),
      asc: n.ascendancyName,
      stringId: n.stringId,
      wikiIcon: n.isNotable || n.isKeystone || n.isJewelSocket || n.ascendancyName ? wikiIconFor(n.icon) : undefined,
      stats: n.stats ?? [],
    });
  }
  return out;
}
