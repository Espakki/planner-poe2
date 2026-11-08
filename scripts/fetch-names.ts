/**
 * npm run fetch-names [-- --force]
 *
 * Preenche `namePtBr` (e `namePtBrSource: "poe2db"`) nas entities usando a versão em português da poe2db:
 *   https://poe2db.tw/pt/<Nome_em_inglês>
 * A poe2db usa o MESMO slug (nome em inglês) pra todos os idiomas, então o mapeamento EN→PT é exato —
 * diferente da API de trade em PT (br.pathofexile.com/api/trade2/data/items), cuja ordem/contagem
 * difere entre idiomas e por isso NÃO serve pra casar nomes sem inventar.
 *
 * Regras:
 *  - Únicos: pega só o nome do único (primeiro .itemName sem .typeLine), não a base.
 *  - Demais: og:title da página.
 *  - Nunca sobrescreve um namePtBr com namePtBrSource "manual" (nem com --force).
 *  - Página inexistente / sem título → não preenche e registra em data/logs/fetch-names.log.
 * Cache das páginas em .cache/poe2db (apague pra rebaixar).
 */
import path from 'node:path';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { ENTITY_TYPES, loadEntities } from './lib/content.ts';
import { P, args, c, fetchWithRetry, sleep, writeJson } from './lib/util.ts';

const decode = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();

async function page(slug: string): Promise<string | null> {
  const file = path.join(P.cache, 'poe2db', `${slug.replace(/[^A-Za-z0-9_'-]/g, '_')}.html`);
  if (existsSync(file)) return readFile(file, 'utf8');
  const res = await fetchWithRetry(`https://poe2db.tw/pt/${encodeURIComponent(slug).replace(/%27/g, "'")}`);
  await sleep(900);
  if (!res.ok) return null;
  const html = await res.text();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, html, 'utf8');
  return html;
}

function extract(html: string, isUnique: boolean): string | null {
  if (isUnique) {
    const m = html.match(/<div class="itemName">\s*<span class="lc">([^<]+)<\/span>/);
    if (m) return decode(m[1]);
  }
  const og = html.match(/<meta property="og:title" content="([^"]*)"/)?.[1];
  if (!og) return null;
  const t = decode(og);
  if (!t || /PoE2DB/i.test(t)) return null;
  return t;
}

async function main() {
  const force = args().force === true;
  const log: string[] = [];
  let filled = 0;
  for (const type of ENTITY_TYPES) {
    for (const e of await loadEntities<{ nameEn: string; namePtBr?: string; namePtBrSource?: string; kind?: string }>(type)) {
      if (e.data.namePtBrSource === 'manual') continue;
      if (e.data.namePtBr && !force) continue;
      const slug = e.data.nameEn.replace(/ /g, '_');
      const html = await page(slug);
      if (!html) {
        log.push(`${type}/${e.id}\tpágina não encontrada: https://poe2db.tw/pt/${slug}`);
        continue;
      }
      const name = extract(html, type === 'items' && e.data.kind === 'unique');
      if (!name) {
        log.push(`${type}/${e.id}\tsem título na página`);
        continue;
      }
      const data = { ...e.data, namePtBr: name, namePtBrSource: 'poe2db' };
      await writeJson(e.file, data);
      filled++;
      console.log(`${c.dim(`${type}/${e.id}`)}  ${e.data.nameEn} → ${c.green(name)}`);
    }
  }
  await mkdir(P.logs, { recursive: true });
  await writeFile(path.join(P.logs, 'fetch-names.log'), `# ${new Date().toISOString()}\n${log.join('\n')}\n`, 'utf8');
  console.log(c.bold(`\n✔ ${filled} nome(s) preenchido(s)`) + (log.length ? c.yellow(`, ${log.length} sem resultado → data/logs/fetch-names.log`) : ''));
}

main().catch((e) => {
  console.error(c.red(String(e?.stack ?? e)));
  process.exit(1);
});
