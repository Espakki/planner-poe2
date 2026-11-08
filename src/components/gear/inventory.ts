/**
 * Monta o inventário ("boneco") de uma fase: em que slot vai cada item e cada nota de "o que procurar".
 * Roda no build (Astro). UI em Inventory/GearSlot/Overview/GroupDetail; comportamento em src/scripts/gear.ts.
 *
 * Regras de slot (o campo opcional `equip` do YAML sobrescreve):
 *  - arma com base "Talisman" → Weapon Set II; outra arma → Weapon Set I; mão secundária → Set I
 *  - anel → anel 1 · frasco com "Mana" no nome/base → frasco de mana, senão de vida · charms enchem os 3 slots em ordem
 *  - currency, runas, soul cores, joias e uncut gems não vão no boneco → faixa "Pra conseguir / craftar"
 */
import type { EquipSlot, GearNote, ItemData, PhaseData, PhaseItem } from '../../lib/schemas.ts';
import type { Entity } from '../../lib/site.ts';

export type CellKey =
  | EquipSlot
  | 'helmet'
  | 'amulet'
  | 'body'
  | 'gloves'
  | 'boots'
  | 'belt'
  | 'charm-1'
  | 'charm-2'
  | 'charm-3';

export type GroupKey = 'ws1' | 'ws2' | 'helmet' | 'body' | 'gloves' | 'boots' | 'amulet' | 'ring' | 'belt' | 'flask' | 'charm';

export interface CellDef {
  key: CellKey;
  group: GroupKey;
  /** rótulo curto (dentro do slot vazio) */
  label: string;
  /** rótulo completo (detalhe, leitor de tela) */
  labelLong: string;
  /** tamanho do slot em células */
  cw: number;
  ch: number;
  /** grid-area no boneco (zona "doll") */
  area: string;
  ws?: 1 | 2;
  zone: 'doll' | 'belt';
}

export const CELLS: CellDef[] = [
  { key: 'weapon-1', group: 'ws1', label: 'Arma', labelLong: 'Arma · Weapon Set I', cw: 2, ch: 4, area: 'wp', ws: 1, zone: 'doll' },
  { key: 'offhand-1', group: 'ws1', label: 'Mão sec.', labelLong: 'Mão secundária · Weapon Set I', cw: 2, ch: 4, area: 'of', ws: 1, zone: 'doll' },
  { key: 'weapon-2', group: 'ws2', label: 'Arma', labelLong: 'Arma · Weapon Set II', cw: 2, ch: 4, area: 'wp', ws: 2, zone: 'doll' },
  { key: 'offhand-2', group: 'ws2', label: 'Mão sec.', labelLong: 'Mão secundária · Weapon Set II', cw: 2, ch: 4, area: 'of', ws: 2, zone: 'doll' },
  { key: 'helmet', group: 'helmet', label: 'Elmo', labelLong: 'Elmo', cw: 2, ch: 2, area: 'hm', zone: 'doll' },
  { key: 'amulet', group: 'amulet', label: 'Amuleto', labelLong: 'Amuleto', cw: 1, ch: 1, area: 'am', zone: 'doll' },
  { key: 'body', group: 'body', label: 'Peitoral', labelLong: 'Peitoral', cw: 2, ch: 3, area: 'bd', zone: 'doll' },
  { key: 'ring-1', group: 'ring', label: 'Anel', labelLong: 'Anel 1', cw: 1, ch: 1, area: 'r1', zone: 'doll' },
  { key: 'ring-2', group: 'ring', label: 'Anel', labelLong: 'Anel 2', cw: 1, ch: 1, area: 'r2', zone: 'doll' },
  { key: 'gloves', group: 'gloves', label: 'Luvas', labelLong: 'Luvas', cw: 2, ch: 2, area: 'gl', zone: 'doll' },
  { key: 'boots', group: 'boots', label: 'Botas', labelLong: 'Botas', cw: 2, ch: 2, area: 'bt', zone: 'doll' },
  { key: 'belt', group: 'belt', label: 'Cinto', labelLong: 'Cinto', cw: 2, ch: 1, area: 'bl', zone: 'doll' },
  { key: 'flask-life', group: 'flask', label: 'Vida', labelLong: 'Frasco de vida', cw: 1, ch: 2, area: 'fl', zone: 'belt' },
  { key: 'charm-1', group: 'charm', label: 'Charm', labelLong: 'Charm', cw: 1, ch: 1, area: 'c1', zone: 'belt' },
  { key: 'charm-2', group: 'charm', label: 'Charm', labelLong: 'Charm', cw: 1, ch: 1, area: 'c2', zone: 'belt' },
  { key: 'charm-3', group: 'charm', label: 'Charm', labelLong: 'Charm', cw: 1, ch: 1, area: 'c3', zone: 'belt' },
  { key: 'flask-mana', group: 'flask', label: 'Mana', labelLong: 'Frasco de mana', cw: 1, ch: 2, area: 'fm', zone: 'belt' },
];

const CELL_BY_KEY = new Map(CELLS.map((c) => [c.key, c]));
export const cellDef = (k: CellKey): CellDef => CELL_BY_KEY.get(k)!;

export interface GroupDef {
  key: GroupKey;
  label: string;
}

/** Ordem do resumo e do detalhe. */
export const GROUPS: GroupDef[] = [
  { key: 'ws1', label: 'Weapon Set I' },
  { key: 'ws2', label: 'Weapon Set II' },
  { key: 'helmet', label: 'Elmo' },
  { key: 'body', label: 'Peitoral' },
  { key: 'gloves', label: 'Luvas' },
  { key: 'boots', label: 'Botas' },
  { key: 'amulet', label: 'Amuleto' },
  { key: 'ring', label: 'Anéis' },
  { key: 'belt', label: 'Cinto' },
  { key: 'flask', label: 'Frascos' },
  { key: 'charm', label: 'Charms' },
];

export interface Placed {
  pi: PhaseItem;
  item: Entity<ItemData>;
  cell: CellKey;
  /** não é o item principal do slot (fica atrás do "+N") */
  alt: boolean;
}

export interface Cell {
  def: CellDef;
  /** principal primeiro (obrigatório antes de opcional, depois a ordem do YAML) */
  items: Placed[];
  notes: GearNote[];
}

export interface Group {
  def: GroupDef;
  cells: Cell[];
  primaries: Placed[];
  alts: Placed[];
  notes: GearNote[];
}

export interface Extra {
  pi: PhaseItem;
  item: Entity<ItemData>;
  key: string;
}

export interface Inventory {
  cells: Map<CellKey, Cell>;
  /** só grupos com item ou nota */
  groups: Group[];
  extras: Extra[];
  extraNotes: GearNote[];
  /** grupo aberto por padrão no painel ao lado (desktop) */
  defaultKey: string | null;
}

const OFF_DOLL_KINDS = new Set<string>(['currency', 'rune', 'soul-core', 'jewel']);
const OFF_DOLL_SLOTS = new Set<string>(['currency', 'socketable', 'jewel']);

export function isTalisman(item: Pick<ItemData, 'kind' | 'baseType' | 'nameEn'>): boolean {
  return item.kind === 'talisman' || /talisman/i.test(item.baseType ?? '');
}

export function isOffDoll(item: Pick<ItemData, 'kind' | 'slot'>): boolean {
  return OFF_DOLL_KINDS.has(item.kind) || OFF_DOLL_SLOTS.has(item.slot);
}

type Target = CellKey | 'charm' | null;

function targetForItem(pi: PhaseItem, item: ItemData): Target {
  if (pi.equip) return pi.equip;
  if (isOffDoll(item)) return null;
  switch (item.slot) {
    case 'weapon':
      return isTalisman(item) ? 'weapon-2' : 'weapon-1';
    case 'offhand':
      return 'offhand-1';
    case 'ring':
      return 'ring-1';
    case 'flask':
      return /mana/i.test(`${item.nameEn} ${item.baseType ?? ''}`) ? 'flask-mana' : 'flask-life';
    case 'charm':
      return 'charm';
    case 'helmet':
    case 'body':
    case 'gloves':
    case 'boots':
    case 'amulet':
    case 'belt':
      return item.slot;
    default:
      return null;
  }
}

function cellsForNote(g: GearNote): CellKey[] | null {
  if (g.equip) return [g.equip];
  switch (g.slot) {
    case 'weapon':
      return g.basesEn.some((b) => /talisman/i.test(b)) ? ['weapon-2'] : ['weapon-1'];
    case 'offhand':
      return ['offhand-1'];
    case 'ring':
      return ['ring-1', 'ring-2'];
    case 'flask':
      return ['flask-life', 'flask-mana'];
    case 'charm':
      return ['charm-1', 'charm-2', 'charm-3'];
    case 'helmet':
    case 'body':
    case 'gloves':
    case 'boots':
    case 'amulet':
    case 'belt':
      return [g.slot];
    default:
      return null;
  }
}

export function buildInventory(phase: PhaseData, items: Map<string, Entity<ItemData>>): Inventory {
  const cells = new Map<CellKey, Cell>(CELLS.map((def) => [def.key, { def, items: [], notes: [] }]));
  const extras: Extra[] = [];
  const extraNotes: GearNote[] = [];
  const charmKeys: CellKey[] = ['charm-1', 'charm-2', 'charm-3'];
  let nextCharm = 0;

  phase.items.forEach((pi, i) => {
    const item = items.get(pi.item);
    if (!item) return; // o check já acusa referência quebrada
    let target = targetForItem(pi, item);
    if (target === 'charm') target = charmKeys[Math.min(nextCharm++, charmKeys.length - 1)];
    if (!target) {
      extras.push({ pi, item, key: `x${i}-${item.id}` });
      return;
    }
    cells.get(target)!.items.push({ pi, item, cell: target, alt: false });
  });

  for (const cell of cells.values()) {
    // obrigatório primeiro; sort é estável, então o resto segue a ordem do YAML
    cell.items.sort((a, b) => Number(b.pi.required) - Number(a.pi.required));
    cell.items.forEach((p, i) => (p.alt = i > 0));
  }

  for (const g of phase.gear) {
    const keys = cellsForNote(g);
    if (!keys) extraNotes.push(g);
    else for (const k of keys) cells.get(k)!.notes.push(g);
  }

  const groups: Group[] = [];
  for (const def of GROUPS) {
    const gc = CELLS.filter((c) => c.group === def.key).map((c) => cells.get(c.key)!);
    const primaries = gc.flatMap((c) => c.items.filter((p) => !p.alt));
    const alts = gc.flatMap((c) => c.items.filter((p) => p.alt));
    const notes = [...new Set(gc.flatMap((c) => c.notes))];
    if (primaries.length + alts.length + notes.length === 0) continue;
    groups.push({ def, cells: gc, primaries, alts, notes });
  }

  const defaultKey =
    groups.find((g) => g.primaries.some((p) => p.pi.required))?.def.key ??
    groups.find((g) => g.primaries.length > 0)?.def.key ??
    groups[0]?.def.key ??
    extras[0]?.key ??
    null;

  return { cells, groups, extras, extraNotes, defaultKey };
}

/** Cor do nome pela raridade/tipo (tokens --unique, --currency, --normal). */
export function rarityOf(item: Pick<ItemData, 'kind'>): 'unique' | 'currency' | 'normal' {
  if (item.kind === 'unique') return 'unique';
  if (item.kind === 'currency' || item.kind === 'rune' || item.kind === 'soul-core') return 'currency';
  return 'normal';
}

/** Texto curto da dica dentro do slot vazio. */
export function hintText(g: GearNote): string {
  return [g.basesEn.join(' · '), g.priorityPt.join(' › ')].filter(Boolean).join(' — ');
}
