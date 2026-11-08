/**
 * npm run sync-gems                      → cria entities/gems/<id>.json pra toda gema referenciada nas builds que ainda não existe
 * npm run sync-gems -- "Rage I" "Whirling Assault"  → cria essas (por nome em inglês)
 * npm run sync-gems -- --refresh         → atualiza os campos automáticos de TODAS as gemas existentes
 *
 * Fonte: dados do Path of Building PoE2 (src/Data/Gems.lua + src/Data/Skills/*.lua), que são exportados do jogo.
 * Campos automáticos: nameEn, kind, attribute, tags, tier, gameId, descriptionEn, wikiUrl, poe2dbUrl.
 * Campos manuais preservados: summaryPt, namePtBr, wherePt, verify, iconFile.
 * Gema nova nasce com summaryPt "TODO: ..." — o `npm run check` acusa até alguém escrever.
 */
import path from 'node:path';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { P, ROOT, args, c, fetchWithRetry, writeJson } from './lib/util.ts';
import { collectRefs, kebab, loadBuilds, loadEntities } from './lib/content.ts';

const REPO_RAW = 'https://raw.githubusercontent.com/PathOfBuildingCommunity/PathOfBuilding-PoE2/dev/src/Data';
const SKILL_FILES = ['act_str', 'act_dex', 'act_int', 'other', 'sup_str', 'sup_dex', 'sup_int'];

interface PobGem {
  key: string;
  name: string;
  gameId: string;
  grantedEffectId?: string;
  gemType?: string;
  tags: string[];
  reqStr: number;
  reqDex: number;
  reqInt: number;
  tier?: number;
}

async function cached(name: string, url: string, refresh: boolean): Promise<string> {
  const file = path.join(P.cache, 'pob', name);
  if (!refresh && existsSync(file)) return readFile(file, 'utf8');
  const res = await fetchWithRetry(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  const text = await res.text();
  const { mkdir, writeFile } = await import('node:fs/promises');
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text, 'utf8');
  return text;
}

function parseGems(lua: string): PobGem[] {
  const out: PobGem[] = [];
  for (const m of lua.matchAll(/\n\t\["([^"]+)"\] = \{([\s\S]*?)\n\t\},/g)) {
    const b = m[2];
    const s = (k: string) => b.match(new RegExp(`\\b${k} = "([^"]*)"`))?.[1];
    const n = (k: string) => {
      const v = b.match(new RegExp(`\\b${k} = (\\d+)`))?.[1];
      return v == null ? undefined : Number(v);
    };
    const tagsBlock = b.match(/tags = \{([\s\S]*?)\}/)?.[1] ?? '';
    out.push({
      key: m[1],
      name: s('name') ?? '',
      gameId: s('gameId') ?? m[1],
      grantedEffectId: s('grantedEffectId'),
      gemType: s('gemType'),
      tags: [...tagsBlock.matchAll(/(\w+) = true/g)].map((x) => x[1]),
      reqStr: n('reqStr') ?? 0,
      reqDex: n('reqDex') ?? 0,
      reqInt: n('reqInt') ?? 0,
      tier: n('Tier'),
    });
  }
  return out;
}

function parseDescriptions(luas: string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const lua of luas) {
    for (const m of lua.matchAll(/skills\["([^"]+)"\] = \{([\s\S]*?)\n\}/g)) {
      const d = m[2].match(/\bdescription = "((?:[^"\\]|\\.)*)"/)?.[1];
      if (d) out.set(m[1], d.replace(/\\n/g, ' ').replace(/\\"/g, '"'));
    }
  }
  return out;
}

const ATTR_TAG: Record<string, 'str' | 'dex' | 'int'> = { strength: 'str', dexterity: 'dex', intelligence: 'int' };
const NOISE_TAGS = new Set(['grants_active_skill', 'strength', 'dexterity', 'intelligence', 'payoff', 'repeatable']);

function attributeOf(g: PobGem): 'str' | 'dex' | 'int' | 'none' {
  const reqs: [number, 'str' | 'dex' | 'int'][] = [
    [g.reqStr, 'str'],
    [g.reqDex, 'dex'],
    [g.reqInt, 'int'],
  ];
  const max = Math.max(...reqs.map((r) => r[0]));
  if (max > 0) {
    const tied = reqs.filter((r) => r[0] === max).map((r) => r[1]);
    if (tied.length === 1) return tied[0];
    // empate (gemas híbridas): usa a ordem das tags do próprio jogo
    const firstTag = g.tags.find((t) => ATTR_TAG[t] && tied.includes(ATTR_TAG[t]));
    return firstTag ? ATTR_TAG[firstTag] : tied[0];
  }
  const tag = g.tags.find((t) => ATTR_TAG[t]);
  return tag ? ATTR_TAG[tag] : 'none';
}

function kindOf(g: PobGem) {
  if (/Ascendancy/i.test(g.gameId)) return 'ascendancy';
  if (g.tags.includes('support')) return 'support';
  if (g.tags.includes('shapeshift')) return 'shapeshift';
  if (g.tags.includes('persistent') && (g.gemType === 'Buff' || g.tags.includes('buff'))) return 'spirit';
  if (g.tags.includes('curse')) return 'curse';
  if (g.tags.includes('meta')) return 'meta';
  return 'active';
}

const wikiUrl = (name: string) => `https://www.poe2wiki.net/wiki/${encodeURIComponent(name.replace(/ /g, '_'))}`;
const poe2dbUrl = (name: string) => `https://poe2db.tw/us/${encodeURIComponent(name.replace(/ /g, '_')).replace(/%27/g, "'")}`;

function autoFields(g: PobGem, desc: Map<string, string>) {
  return {
    nameEn: g.name,
    kind: kindOf(g),
    attribute: attributeOf(g),
    tags: g.tags.filter((t) => !NOISE_TAGS.has(t)),
    ...(g.tier != null ? { tier: g.tier } : {}),
    gameId: g.gameId,
    wikiUrl: wikiUrl(g.name),
    poe2dbUrl: poe2dbUrl(g.name),
    ...(g.grantedEffectId && desc.get(g.grantedEffectId) ? { descriptionEn: desc.get(g.grantedEffectId) } : {}),
  };
}

async function main() {
  const a = args();
  const refresh = a.refresh === true;
  const names = process.argv.slice(2).filter((x) => !x.startsWith('--'));

  const gemsLua = await cached('Gems.lua', `${REPO_RAW}/Gems.lua`, refresh);
  const skillLuas = await Promise.all(SKILL_FILES.map((f) => cached(`${f}.lua`, `${REPO_RAW}/Skills/${f}.lua`, refresh)));
  const pobGems = parseGems(gemsLua);
  const desc = parseDescriptions(skillLuas);
  await writeJson(
    path.join(ROOT, 'data', 'pob', 'gems.json'),
    pobGems.map((g) => ({ ...g, attribute: attributeOf(g), kind: kindOf(g) })),
    false,
  );

  const byKebab = new Map<string, PobGem>();
  for (const g of pobGems) if (!byKebab.has(kebab(g.name))) byKebab.set(kebab(g.name), g);

  const existing = await loadEntities('gems');
  const existingIds = new Set(existing.map((e) => e.id));

  let wanted: string[] = names.map(kebab);
  if (!names.length) {
    const builds = await loadBuilds();
    wanted = [...new Set(builds.flatMap((b) => collectRefs(b).gems.map((g) => g.id)))];
  }

  let created = 0;
  const notFound: string[] = [];
  for (const id of wanted) {
    if (existingIds.has(id)) continue;
    const g = byKebab.get(id);
    if (!g) {
      notFound.push(id);
      continue;
    }
    const data = {
      ...autoFields(g, desc),
      summaryPt: `TODO: resumo em PT-BR de ${g.name}`,
    };
    await writeJson(path.join(P.entities, 'gems', `${id}.json`), data);
    created++;
    console.log(c.green(`+ gems/${id}.json`) + c.dim(`  (${data.kind}, ${data.attribute}, tier ${g.tier ?? '-'})`));
  }

  let refreshed = 0;
  if (refresh) {
    for (const e of existing) {
      const g = byKebab.get(e.id) ?? pobGems.find((x) => x.gameId === (e.data as { gameId?: string }).gameId);
      if (!g) {
        console.log(c.yellow(`? gems/${e.id}.json não encontrada nos dados do PoB (mantida como está)`));
        continue;
      }
      const merged = { ...e.data, ...autoFields(g, desc) };
      await writeJson(e.file, merged);
      refreshed++;
    }
  }

  console.log(c.bold(`\n${created} criada(s)${refresh ? `, ${refreshed} atualizada(s)` : ''}.`));
  if (notFound.length) {
    console.log(c.yellow(`Sem correspondência no PoB (confira o id = nome em kebab-case): ${notFound.join(', ')}`));
  }
  const todo = (await loadEntities<{ summaryPt?: string }>('gems')).filter((e) => e.data.summaryPt?.startsWith('TODO'));
  if (todo.length) console.log(c.yellow(`${todo.length} gema(s) ainda com summaryPt TODO.`));
}

main().catch((e) => {
  console.error(c.red(String(e?.stack ?? e)));
  process.exit(1);
});
