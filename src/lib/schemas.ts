/**
 * Schemas Zod compartilhados entre o Astro (content collections) e os scripts
 * (`npm run check`). Se um campo obrigatório faltar, o build quebra.
 *
 * Convenções:
 *  - Nomes de jogo SEMPRE em inglês (`nameEn`); `namePtBr` é opcional e nunca inventado.
 *  - Texto explicativo em PT-BR termina com `Pt` (summaryPt, notesPt, whyPt...).
 *  - Referências entre arquivos são por `id` (nome do arquivo sem extensão).
 */
import { z } from 'astro/zod';

const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'id deve ser kebab-case: ex. "lochtonial-caress"');
const url = z.url();

/** Origem do nome PT-BR, para saber se veio de fonte automática ou foi escrito à mão. */
const ptSource = z.enum(['poe2db', 'manual']);

/* ---------------------------------------------------------------- entities */

export const itemKinds = ['unique', 'base', 'rune', 'soul-core', 'flask', 'charm', 'jewel', 'currency', 'talisman'] as const;
export const itemSlots = [
  'weapon',
  'offhand',
  'helmet',
  'body',
  'gloves',
  'boots',
  'amulet',
  'ring',
  'belt',
  'flask',
  'charm',
  'jewel',
  'socketable',
  'currency',
] as const;

export const itemSchema = z.object({
  nameEn: z.string().min(1),
  namePtBr: z.string().optional(),
  namePtBrSource: ptSource.optional(),
  kind: z.enum(itemKinds),
  slot: z.enum(itemSlots),
  /** Base do item (ex.: "Fists of Stone" para Lochtonial Caress). */
  baseType: z.string().optional(),
  levelReq: z.number().int().min(1).max(100).optional(),
  /** Nome do arquivo na poe2wiki, quando foge do padrão `<nameEn> inventory icon.png`. */
  iconFile: z.string().optional(),
  wikiUrl: url,
  poe2dbUrl: url.optional(),
  /** O que o item faz, em até ~2 linhas. */
  summaryPt: z.string().min(10),
  /** Mods principais no texto original do jogo (inglês). */
  keyModsEn: z.array(z.string()).default([]),
  notesPt: z.string().optional(),
  /** Onde conseguir (padrão do item; a fase pode sobrescrever). */
  wherePt: z.string().optional(),
  /** Marca algo que ainda precisa ser conferido no jogo/fonte. */
  verify: z.string().optional(),
});

export const gemKinds = ['active', 'support', 'spirit', 'meta', 'ascendancy', 'shapeshift', 'curse'] as const;
export const gemAttributes = ['str', 'dex', 'int', 'none'] as const;

export const gemSchema = z.object({
  nameEn: z.string().min(1),
  namePtBr: z.string().optional(),
  namePtBrSource: ptSource.optional(),
  kind: z.enum(gemKinds),
  /** Cor da gema: atributo dominante (do requisito no PoB). */
  attribute: z.enum(gemAttributes),
  tags: z.array(z.string()).default([]),
  /** Tier da gema (suporte: tier da Uncut Support Gem; ativa: nível mínimo da Uncut Skill Gem). */
  tier: z.number().int().min(0).max(20).optional(),
  /** Id interno do jogo (Metadata/Items/Gems/...), usado pra casar com PoB/planner. */
  gameId: z.string().optional(),
  iconFile: z.string().optional(),
  wikiUrl: url,
  poe2dbUrl: url.optional(),
  summaryPt: z.string().min(10),
  /** Descrição oficial (inglês) vinda dos dados do jogo via PoB. */
  descriptionEn: z.string().optional(),
  /** Onde conseguir, quando não é o padrão (Uncut Gem do tier). */
  wherePt: z.string().optional(),
  verify: z.string().optional(),
});

export const passiveKinds = ['notable', 'keystone', 'ascendancy'] as const;

export const passiveSchema = z.object({
  nameEn: z.string().min(1),
  namePtBr: z.string().optional(),
  namePtBrSource: ptSource.optional(),
  kind: z.enum(passiveKinds),
  /** Hash do node na árvore (PoB/GGG). */
  nodeId: z.number().int().positive(),
  ascendancy: z.string().optional(),
  /** Arquivo de ícone na poe2wiki (gerado pelo update-tree a partir do caminho do .dds). */
  iconFile: z.string().optional(),
  wikiUrl: url.optional(),
  poe2dbUrl: url.optional(),
  summaryPt: z.string().min(10),
  statsEn: z.array(z.string()).default([]),
  verify: z.string().optional(),
});

/* ------------------------------------------------------------------ builds */

const levelRange = z.tuple([z.number().int().min(1).max(100), z.number().int().min(1).max(100)]);

export const sourceSchema = z.object({
  id,
  label: z.string(),
  url,
  author: z.string().optional(),
  patch: z.string().optional(),
  /** O que essa fonte cobre (ex.: "leveling", "endgame"). */
  coversPt: z.string().optional(),
  primary: z.boolean().default(false),
});

/** Uma gema usada numa fase, com seus suportes. */
export const skillSetupSchema = z.object({
  gem: id,
  supports: z.array(id).default([]),
  /** Nível da gema sugerido no guia. */
  level: z.number().int().min(1).max(40).optional(),
  /** Ex.: "Weapon Set 2 (Talismã)". */
  slotPt: z.string().optional(),
  role: z.enum(['main', 'utility', 'movement', 'boss', 'buff', 'aura', 'defense', 'curse']).optional(),
  notePt: z.string().optional(),
  /** Gema/suporte que entra no lugar de outro (mostra aviso de troca). */
  replacesPt: z.string().optional(),
  optional: z.boolean().default(false),
  verify: z.string().optional(),
});

/**
 * Slot exato no inventário do personagem, quando a regra automática não resolve.
 * Regra (src/components/gear/inventory.ts): arma com base "Talisman" → Weapon Set II, outra arma → Weapon Set I;
 * mão secundária → Set I; anel → anel 1; frasco com "Mana" no nome → frasco de mana, senão de vida.
 */
export const equipSlots = ['weapon-1', 'offhand-1', 'weapon-2', 'offhand-2', 'ring-1', 'ring-2', 'flask-life', 'flask-mana'] as const;

export const phaseItemSchema = z.object({
  item: id,
  whyPt: z.string(),
  required: z.boolean().default(false),
  /** Onde fica no boneco (só quando a regra automática erra — ex.: segundo anel, arma no Weapon Set II). */
  equip: z.enum(equipSlots).optional(),
  /** Sobrescreve o "onde conseguir" padrão do item. */
  wherePt: z.string().optional(),
  /** Runas/sockets ou observação de craft. */
  craftPt: z.string().optional(),
  verify: z.string().optional(),
});

/** De onde vem a árvore da fase. */
export const treeRefSchema = z.union([
  z.object({ pob: id, spec: z.string() }),
  z.object({ planner: z.string() }),
  z.object({ nodes: z.array(z.number().int().positive()).min(1) }),
]);

export const ascendancyStepSchema = z.object({
  /** Passivas (ids de entities/passives) a pegar neste momento. */
  take: z.array(id).default([]),
  /** Passivas a desalocar (respec no Hooded One). */
  refund: z.array(id).default([]),
  /** Ex.: "1ª ascensão — Trial of the Sekhemas". */
  whenPt: z.string(),
  notePt: z.string().optional(),
  verify: z.string().optional(),
});

export const gearNoteSchema = z.object({
  slot: z.enum(itemSlots),
  /** Slot exato no boneco quando a regra erra (ex.: nota de arma que é do Weapon Set II). */
  equip: z.enum(equipSlots).optional(),
  /** Bases sugeridas (texto livre em inglês, como no jogo). */
  basesEn: z.array(z.string()).default([]),
  priorityPt: z.array(z.string()).min(1),
  notePt: z.string().optional(),
});

export const phaseSchema = z.object({
  id,
  levels: levelRange,
  title: z.string(),
  /** Ex.: "Ato 1". */
  stagePt: z.string().optional(),
  source: id,
  summaryPt: z.string(),
  goalsPt: z.array(z.string()).default([]),
  skills: z.array(skillSetupSchema).default([]),
  spirit: z.array(skillSetupSchema).default([]),
  items: z.array(phaseItemSchema).default([]),
  gear: z.array(gearNoteSchema).default([]),
  ascendancy: ascendancyStepSchema.nullable().default(null),
  tree: treeRefSchema.optional(),
  /** Notáveis a destacar manualmente (além do diff automático). */
  treeNotesPt: z.array(z.string()).default([]),
  howToPlayPt: z.array(z.string()).default([]),
  bossingPt: z.array(z.string()).default([]),
  checklist: z.array(z.string()).default([]),
  /** Estágio do filtro NeverSink recomendado (id de `filter`). */
  filter: id.optional(),
});

export const buildSchema = z.object({
  meta: z.object({
    slug: id,
    title: z.string(),
    taglinePt: z.string(),
    class: z.string(),
    ascendancy: z.string(),
    patch: z.string().regex(/^\d+\.\d+(\.\d+)?[a-z]?$/),
    league: z.string(),
    /** Pasta da árvore em data/tree (formato do PoB: 0_5). */
    treeVersion: z.string().regex(/^\d+_\d+$/),
    lastVerified: z.coerce.date(),
    status: z.enum(['active', 'outdated', 'archived']),
    summaryPt: z.string(),
    strengthsPt: z.array(z.string()).default([]),
    weaknessesPt: z.array(z.string()).default([]),
    sources: z.array(sourceSchema).min(1),
    /** Códigos PoB de referência (arquivo .pob na pasta sources da build). */
    pob: z
      .record(
        id,
        z.object({
          label: z.string(),
          file: z.string(),
          url: url.optional(),
          source: id,
        }),
      )
      .default({}),
  }),
  phases: z.array(phaseSchema).min(1),
  ascendancyOrder: z
    .array(
      z.object({
        passive: id,
        orderPt: z.string(),
        whyPt: z.string(),
        optional: z.boolean().default(false),
        verify: z.string().optional(),
      }),
    )
    .default([]),
  spirit: z
    .array(
      z.object({
        gem: id,
        supports: z.array(id).default([]),
        priority: z.number().int().min(1),
        whyPt: z.string(),
        verify: z.string().optional(),
      }),
    )
    .default([]),
  gearPriorities: z.array(gearNoteSchema).default([]),
  weaponSetPoints: z
    .array(z.object({ act: z.string(), zone: z.string(), questEn: z.string(), points: z.number().int().default(2) }))
    .default([]),
  filter: z
    .array(
      z.object({
        id,
        stagePt: z.string(),
        strictness: z.string(),
        notePt: z.string().optional(),
      }),
    )
    .default([]),
  checklist: z.array(z.object({ group: z.string(), items: z.array(z.string()).min(1) })).default([]),
  faq: z.array(z.object({ q: z.string(), a: z.string(), date: z.coerce.date().optional() })).default([]),
  changelog: z
    .array(z.object({ date: z.coerce.date(), patch: z.string(), notesPt: z.array(z.string()).min(1) }))
    .min(1),
});

export type ItemData = z.infer<typeof itemSchema>;
export type GemData = z.infer<typeof gemSchema>;
export type PassiveData = z.infer<typeof passiveSchema>;
export type BuildData = z.infer<typeof buildSchema>;
export type PhaseData = z.infer<typeof phaseSchema>;
export type SkillSetup = z.infer<typeof skillSetupSchema>;
export type PhaseItem = z.infer<typeof phaseItemSchema>;
export type GearNote = z.infer<typeof gearNoteSchema>;
export type EquipSlot = (typeof equipSlots)[number];
export type TreeRef = z.infer<typeof treeRefSchema>;
