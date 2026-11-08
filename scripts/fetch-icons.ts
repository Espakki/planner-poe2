/**
 * npm run fetch-icons [-- --force]
 *
 * Baixa ícones da poe2wiki.net (MediaWiki API: action=query&prop=imageinfo&iiprop=url) e converte pra webp.
 *   public/icons/<tipo>/<id>.webp   (items, gems, passives)
 *   public/icons/nodes/<arquivo>.webp  (notáveis/keystones que aparecem nas árvores das builds)
 *   public/icons/index.json          ("items/lochtonial-caress" → "icons/items/lochtonial-caress.webp")
 *   data/logs/fetch-icons.log        (o que não foi achado e quais nomes foram tentados)
 *
 * Padrões de nome na wiki (investigados):
 *   Itens, gemas, suportes, runas, uncut gems → "File:<Nome> inventory icon.png"
 *   Passivas (árvore principal)              → "File:<ArquivoDDS>_passive_skill_icon.png"  (ex.: Harrier_passive_skill_icon.png)
 *   Passivas de ascendência                  → "File:<ArquivoDDS>_(<Pasta>)_passive_skill_icon.png"
 *   Gemas de ascendência (Hollow Form...)    → sem inventory icon; caímos no ícone da passiva que concede a skill.
 * Só baixa o que falta (use --force pra rebaixar). Respeita a wiki: lotes de 50 títulos e pausa entre downloads.
 */
import path from 'node:path';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { ENTITY_TYPES, loadBuilds, loadEntities } from './lib/content.ts';
import { P, ROOT, args, c, fetchWithRetry, readJson, sleep, writeJson } from './lib/util.ts';
import { buildSchema } from '../src/lib/schemas.ts';
import { loadTreeData, resolveBuildTrees } from '../src/lib/build-tree.ts';
import type { NodeIndexEntry } from '../src/lib/tree-build.ts';

const API = 'https://www.poe2wiki.net/api.php';

interface Target {
  key: string; // "items/lochtonial-caress" ou "nodes/Harrier"
  out: string; // caminho relativo a public/
  candidates: string[]; // nomes de arquivo na wiki, em ordem
}

const norm = (f: string) => f.replace(/^File:/i, '').replace(/_/g, ' ').trim();

async function resolveUrls(files: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(files.map(norm))];
  for (let i = 0; i < unique.length; i += 50) {
    const batch = unique.slice(i, i + 50);
    const url = `${API}?action=query&format=json&prop=imageinfo&iiprop=url&titles=${encodeURIComponent(batch.map((f) => `File:${f}`).join('|'))}`;
    const res = await fetchWithRetry(url);
    if (!res.ok) throw new Error(`wiki API ${res.status}`);
    const json = (await res.json()) as {
      query: {
        normalized?: { from: string; to: string }[];
        pages: Record<string, { title: string; imageinfo?: { url: string }[] }>;
      };
    };
    const back = new Map((json.query.normalized ?? []).map((n) => [n.to, n.from]));
    for (const p of Object.values(json.query.pages)) {
      const u = p.imageinfo?.[0]?.url;
      if (!u) continue;
      const original = back.get(p.title) ?? p.title;
      out.set(norm(original), u);
      out.set(norm(p.title), u);
    }
    await sleep(300);
  }
  return out;
}

async function main() {
  const force = args().force === true;
  const targets: Target[] = [];

  // passivas que concedem skill (pra ícone de gema de ascendência)
  const passives = await loadEntities<{ nameEn: string; iconFile?: string; statsEn?: string[] }>('passives');
  const grantIcon = new Map<string, string>();
  for (const p of passives) {
    for (const s of p.data.statsEn ?? []) {
      const m = s.match(/^Grants Skill: (.+)$/);
      if (m && p.data.iconFile) grantIcon.set(m[1].trim(), p.data.iconFile);
    }
  }

  for (const type of ENTITY_TYPES) {
    for (const e of await loadEntities<{ nameEn: string; iconFile?: string; kind?: string }>(type)) {
      const cands: string[] = [];
      if (e.data.iconFile) cands.push(e.data.iconFile);
      if (type !== 'passives') {
        cands.push(`${e.data.nameEn} inventory icon.png`);
        if (type === 'gems') {
          const name = e.data.nameEn;
          // suportes II/III usam o ícone do tier I ("Blind II" → "Blind I inventory icon.png")
          const base = name.replace(/\s+(?:II|III|IV|V)$/, '');
          if (base !== name) cands.push(`${base} I inventory icon.png`);
          // nomes que colidem com status/skill: "Shock (support gem) inventory icon.png"
          if (e.data.kind === 'support') cands.push(`${name} (support gem) inventory icon.png`, `${name} I inventory icon.png`);
          cands.push(`${name} skill icon.png`);
          const g = grantIcon.get(e.data.nameEn);
          if (g) cands.push(g);
        }
      }
      targets.push({ key: `${type}/${e.id}`, out: `icons/${type}/${e.id}.webp`, candidates: cands });
    }
  }

  // notáveis/keystones/joias das árvores das builds
  const passiveNodes = new Map(
    (await loadEntities<{ nodeId: number }>('passives')).map((p) => [p.id, p.data.nodeId] as [string, number]),
  );
  const nodeFiles = new Map<number, string>();
  for (const b of await loadBuilds()) {
    const parsed = buildSchema.safeParse(b.data);
    if (!parsed.success) continue;
    const tv = parsed.data.meta.treeVersion;
    const idxFile = path.join(P.treeData, tv, 'node-index.json');
    if (!existsSync(idxFile)) continue;
    const index = new Map((await readJson<NodeIndexEntry[]>(idxFile)).map((n) => [n.id, n]));
    const trees = resolveBuildTrees({ build: parsed.data, root: ROOT, dir: b.dir, tree: loadTreeData(ROOT, tv), passiveNodes });
    for (const t of trees) {
      for (const n of [...t.newNotables, ...t.removedNotables]) {
        const wi = index.get(n.id)?.wikiIcon;
        if (wi) nodeFiles.set(n.id, wi);
      }
    }
  }
  const nodeTargets = new Map<string, Target>();
  for (const file of nodeFiles.values()) {
    const slug = file.replace(/_passive_skill_icon\.png$/, '').replace(/[^A-Za-z0-9]+/g, '-');
    if (!nodeTargets.has(slug)) nodeTargets.set(slug, { key: `nodes/${slug}`, out: `icons/nodes/${slug}.webp`, candidates: [file] });
  }
  targets.push(...nodeTargets.values());

  // índice atual
  const indexFile = path.join(P.icons, 'index.json');
  const index: Record<string, string> = existsSync(indexFile) ? await readJson(indexFile) : {};
  // nodeId → chave do ícone
  const nodeIconIndex: Record<string, string> = {};
  for (const [id, file] of nodeFiles) {
    const slug = file.replace(/_passive_skill_icon\.png$/, '').replace(/[^A-Za-z0-9]+/g, '-');
    nodeIconIndex[String(id)] = `nodes/${slug}`;
  }

  const todo = targets.filter((t) => force || !existsSync(path.join(ROOT, 'public', t.out)));
  console.log(c.bold(`${targets.length} ícones conhecidos, ${todo.length} pra baixar`));

  const urls = todo.length ? await resolveUrls(todo.flatMap((t) => t.candidates)) : new Map<string, string>();
  const missing: string[] = [];
  let ok = 0;
  for (const t of todo) {
    const hit = t.candidates.map(norm).find((f) => urls.has(f));
    if (!hit) {
      missing.push(`${t.key}\ttentado: ${t.candidates.join(' | ') || '(nenhum nome)'}`);
      delete index[t.key];
      continue;
    }
    const res = await fetchWithRetry(urls.get(hit)!);
    if (!res.ok) {
      missing.push(`${t.key}\tHTTP ${res.status} em ${urls.get(hit)}`);
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const file = path.join(ROOT, 'public', t.out);
    await mkdir(path.dirname(file), { recursive: true });
    await sharp(buf).resize(128, 128, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 88 }).toFile(file);
    index[t.key] = t.out;
    ok++;
    process.stdout.write(c.green('.'));
    await sleep(150);
  }
  // mantém no índice o que já existia em disco
  for (const t of targets) if (existsSync(path.join(ROOT, 'public', t.out))) index[t.key] = t.out;

  await writeJson(indexFile, Object.fromEntries(Object.entries(index).sort()));
  await writeJson(path.join(P.icons, 'nodes.json'), nodeIconIndex);
  await mkdir(P.logs, { recursive: true });
  await writeFile(
    path.join(P.logs, 'fetch-icons.log'),
    `# ${new Date().toISOString()} — ícones não encontrados na poe2wiki\n# Defina "iconFile" na entity com o nome certo do arquivo na wiki e rode de novo.\n${missing.join('\n')}\n`,
    'utf8',
  );
  console.log(`\n${c.green(`✔ ${ok} baixado(s)`)}${missing.length ? c.yellow(`, ${missing.length} não encontrado(s) → data/logs/fetch-icons.log`) : ''}`);
}

main().catch((e) => {
  console.error(c.red(String(e?.stack ?? e)));
  process.exit(1);
});
