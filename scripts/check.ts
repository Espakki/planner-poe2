/**
 * npm run check
 *
 * Valida TODO o conteúdo sem precisar do Astro:
 *  - schema de cada entity (itens, gemas, passivas) e de cada build (YAML)
 *  - referências: gema/item/passiva usada numa build existe em entities/
 *  - árvore: arquivo PoB / planner existe, decodifica, spec existe, nodes existem na versão da árvore
 *  - resumos "TODO" esquecidos
 * Avisos (não quebram): campos `verify`, ícones que ainda não foram baixados, nomes PT-BR faltando.
 * Sai com código 1 se houver erro.
 */
import path from 'node:path';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { buildSchema, gemSchema, itemSchema, passiveSchema } from '../src/lib/schemas.ts';
import { parsePobCode } from '../src/lib/pob.ts';
import { resolvePlanner, type PlannerFile } from '../src/lib/planner.ts';
import type { NodeIndexEntry } from '../src/lib/tree-build.ts';
import { ENTITY_TYPES, collectRefs, loadBuilds, loadEntities, type EntityType } from './lib/content.ts';
import { P, c, readJson } from './lib/util.ts';

const errors: string[] = [];
const warnings: string[] = [];
const verifies: string[] = [];
const err = (m: string) => errors.push(m);
const warn = (m: string) => warnings.push(m);

const schemas = { items: itemSchema, gems: gemSchema, passives: passiveSchema } as const;

function zodMsg(e: { issues: { path: PropertyKey[]; message: string }[] }) {
  return e.issues.map((i) => `${i.path.join('.') || '(raiz)'}: ${i.message}`).join('; ');
}

async function main() {
  // ---- entities
  const ids: Record<EntityType, Set<string>> = { items: new Set(), gems: new Set(), passives: new Set() };
  const iconIndex = existsSync(path.join(P.icons, 'index.json'))
    ? await readJson<Record<string, string>>(path.join(P.icons, 'index.json'))
    : {};
  let missingPt = 0;
  for (const type of ENTITY_TYPES) {
    for (const e of await loadEntities<Record<string, unknown>>(type)) {
      ids[type].add(e.id);
      const r = schemas[type].safeParse(e.data);
      if (!r.success) {
        err(`${type}/${e.id}.json — ${zodMsg(r.error)}`);
        continue;
      }
      const d = r.data as { summaryPt: string; verify?: string; namePtBr?: string; nameEn: string };
      if (d.summaryPt.trim().startsWith('TODO')) err(`${type}/${e.id}.json — summaryPt ainda é TODO`);
      if (d.verify) verifies.push(`${type}/${e.id}: ${d.verify}`);
      if (!d.namePtBr) missingPt++;
      if (!iconIndex[`${type}/${e.id}`]) warn(`ícone ainda não baixado: ${type}/${e.id} (rode npm run fetch-icons)`);
    }
  }

  // ---- builds
  const builds = await loadBuilds();
  if (!builds.length) err('Nenhuma build em src/content/builds/<slug>/<patch>.yaml');
  const treeIndexCache = new Map<string, NodeIndexEntry[]>();

  for (const b of builds) {
    const label = `builds/${b.slug}/${b.patch}.yaml`;
    const r = buildSchema.safeParse(b.data);
    if (!r.success) {
      err(`${label} — ${zodMsg(r.error)}`);
      continue;
    }
    const build = r.data;
    if (build.meta.slug !== b.slug) err(`${label} — meta.slug "${build.meta.slug}" ≠ pasta "${b.slug}"`);
    if (build.meta.patch !== b.patch) err(`${label} — meta.patch "${build.meta.patch}" ≠ arquivo "${b.patch}.yaml"`);

    const refs = collectRefs(b);
    for (const g of refs.gems) if (!ids.gems.has(g.id)) err(`${label} — gema "${g.id}" não existe (${g.where}). Rode: npm run sync-gems`);
    for (const i of refs.items) if (!ids.items.has(i.id)) err(`${label} — item "${i.id}" não existe (${i.where})`);
    for (const p of refs.passives) if (!ids.passives.has(p.id)) err(`${label} — passiva "${p.id}" não existe (${p.where})`);

    const sourceIds = new Set(build.meta.sources.map((s) => s.id));
    const filterIds = new Set(build.filter.map((f) => f.id));
    const phaseIds = new Set<string>();
    for (const ph of build.phases) {
      if (phaseIds.has(ph.id)) err(`${label} — fase duplicada "${ph.id}"`);
      phaseIds.add(ph.id);
      if (!sourceIds.has(ph.source)) err(`${label} — fase ${ph.id}: source "${ph.source}" não está em meta.sources`);
      if (ph.filter && !filterIds.has(ph.filter)) err(`${label} — fase ${ph.id}: filter "${ph.filter}" não existe em filter[]`);
      if (ph.levels[0] > ph.levels[1]) err(`${label} — fase ${ph.id}: levels invertido`);
      for (const s of [...ph.skills, ...ph.spirit]) if (s.verify) verifies.push(`${b.slug}/${b.patch} · ${ph.id} · ${s.gem}: ${s.verify}`);
      for (const it of ph.items) if (it.verify) verifies.push(`${b.slug}/${b.patch} · ${ph.id} · ${it.item}: ${it.verify}`);
      if (ph.ascendancy?.verify) verifies.push(`${b.slug}/${b.patch} · ${ph.id} · ascendência: ${ph.ascendancy.verify}`);
    }
    for (const a of build.ascendancyOrder) if (a.verify) verifies.push(`${b.slug}/${b.patch} · ascendancyOrder ${a.passive}: ${a.verify}`);
    for (const s of build.spirit) if (s.verify) verifies.push(`${b.slug}/${b.patch} · spirit ${s.gem}: ${s.verify}`);

    // árvore
    const tv = build.meta.treeVersion;
    if (!treeIndexCache.has(tv)) {
      const f = path.join(P.treeData, tv, 'node-index.json');
      if (!existsSync(f)) {
        err(`${label} — árvore ${tv} não encontrada. Rode: npm run update-tree -- --version ${tv}`);
        treeIndexCache.set(tv, []);
      } else treeIndexCache.set(tv, await readJson<NodeIndexEntry[]>(f));
    }
    const index = treeIndexCache.get(tv)!;
    const nodeIds = new Set(index.map((n) => n.id));
    const stringIds = new Map(index.filter((n) => n.stringId).map((n) => [n.stringId!, n.id]));

    const pobs = new Map<string, ReturnType<typeof parsePobCode>>();
    for (const [key, pob] of Object.entries(build.meta.pob)) {
      if (!sourceIds.has(pob.source)) err(`${label} — pob.${key}: source "${pob.source}" não existe`);
      const f = path.join(b.dir, pob.file);
      if (!existsSync(f)) {
        err(`${label} — pob.${key}: arquivo ${pob.file} não existe`);
        continue;
      }
      try {
        pobs.set(key, parsePobCode(await readFile(f, 'utf8')));
      } catch (e) {
        err(`${label} — pob.${key}: não consegui decodificar (${String(e)})`);
      }
    }

    for (const ph of build.phases) {
      const t = ph.tree;
      if (!t) {
        warn(`${label} — fase ${ph.id} sem árvore`);
        continue;
      }
      let nodes: number[] = [];
      if ('pob' in t) {
        const pob = pobs.get(t.pob);
        if (!pob) {
          err(`${label} — fase ${ph.id}: pob "${t.pob}" não existe em meta.pob`);
          continue;
        }
        const spec = pob.specs.find((s) => s.title === t.spec);
        if (!spec) {
          err(`${label} — fase ${ph.id}: spec "${t.spec}" não existe. Disponíveis: ${pob.specs.map((s) => `"${s.title}"`).join(', ')}`);
          continue;
        }
        if (spec.treeVersion && spec.treeVersion !== tv) warn(`${label} — fase ${ph.id}: spec é da árvore ${spec.treeVersion}, build usa ${tv}`);
        nodes = spec.nodes;
      } else if ('planner' in t) {
        const f = path.join(b.dir, t.planner);
        if (!existsSync(f)) {
          err(`${label} — fase ${ph.id}: arquivo ${t.planner} não existe`);
          continue;
        }
        const res = resolvePlanner(await readJson<PlannerFile>(f), stringIds);
        if (res.missing.length) err(`${label} — fase ${ph.id}: ${res.missing.length} passiva(s) do planner não existem na árvore ${tv}: ${res.missing.slice(0, 5).join(', ')}`);
        nodes = res.nodes;
      } else nodes = t.nodes;
      const unknown = nodes.filter((n) => !nodeIds.has(n));
      if (unknown.length) err(`${label} — fase ${ph.id}: ${unknown.length} node(s) não existem na árvore ${tv}: ${unknown.slice(0, 8).join(', ')}`);
    }
  }

  // passivas: node existe?
  for (const tv of treeIndexCache.keys()) {
    const nodeIds = new Set(treeIndexCache.get(tv)!.map((n) => n.id));
    for (const e of await loadEntities<{ nodeId: number }>('passives')) {
      if (!nodeIds.has(e.data.nodeId)) err(`passives/${e.id}.json — nodeId ${e.data.nodeId} não existe na árvore ${tv}`);
    }
  }

  // ---- saída
  const total = ENTITY_TYPES.map((t) => `${ids[t].size} ${t}`).join(', ');
  console.log(c.bold(`Conteúdo: ${total}, ${builds.length} build(s)`));
  if (warnings.length) {
    const iconWarn = warnings.filter((w) => w.startsWith('ícone'));
    const other = warnings.filter((w) => !w.startsWith('ícone'));
    for (const w of other) console.log(c.yellow(`⚠ ${w}`));
    if (iconWarn.length) console.log(c.yellow(`⚠ ${iconWarn.length} ícone(s) ainda não baixado(s) — npm run fetch-icons`));
  }
  if (missingPt) console.log(c.dim(`ℹ ${missingPt} entidade(s) sem namePtBr — npm run fetch-names`));
  if (verifies.length) {
    console.log(c.yellow(`\n${verifies.length} ponto(s) marcado(s) pra verificar:`));
    for (const v of verifies) console.log(c.dim(`  • ${v}`));
  }
  if (errors.length) {
    console.log(c.red(`\n✖ ${errors.length} erro(s):`));
    for (const e of errors) console.log(c.red(`  • ${e}`));
    process.exit(1);
  }
  console.log(c.green('\n✔ check ok'));
}

main().catch((e) => {
  console.error(c.red(String(e?.stack ?? e)));
  process.exit(1);
});
