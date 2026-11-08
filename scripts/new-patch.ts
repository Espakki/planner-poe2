/**
 * npm run new-patch -- --build monk-hollow-form --from 0.5.5 --to 0.6 [--tree 0_6]
 *
 * 1. Copia src/content/builds/<build>/<from>.yaml → <to>.yaml
 * 2. No novo: meta.patch = <to>, status active, lastVerified = hoje, treeVersion (se --tree),
 *    changelog ganha uma entrada no topo, e um aviso "TODO verificar" no cabeçalho.
 * 3. No antigo: meta.status = outdated (mantém o arquivo — vira a versão antiga no seletor de patch).
 * Edita o YAML preservando comentários (lib yaml, modo Document).
 * Depois: atualizar PoB/fontes, rodar update-tree, sync-gems, fetch-icons, fetch-names e check (ver CLAUDE.md).
 */
import path from 'node:path';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { parseDocument } from 'yaml';
import { P, args, c } from './lib/util.ts';

async function main() {
  const a = args();
  const build = a.build;
  const from = a.from;
  const to = a.to;
  if (typeof build !== 'string' || typeof from !== 'string' || typeof to !== 'string') {
    console.log('Uso: npm run new-patch -- --build <slug> --from <patch> --to <patch> [--tree 0_6]');
    process.exit(1);
  }
  const dir = path.join(P.builds, build);
  const src = path.join(dir, `${from}.yaml`);
  const dst = path.join(dir, `${to}.yaml`);
  if (!existsSync(src)) throw new Error(`Não existe ${path.relative(P.builds, src)}`);
  if (existsSync(dst)) throw new Error(`${path.relative(P.builds, dst)} já existe — não vou sobrescrever.`);

  const today = new Date().toISOString().slice(0, 10);
  const text = await readFile(src, 'utf8');

  // novo patch
  const doc = parseDocument(text);
  doc.setIn(['meta', 'patch'], to);
  doc.setIn(['meta', 'status'], 'active');
  doc.setIn(['meta', 'lastVerified'], today);
  if (typeof a.tree === 'string') doc.setIn(['meta', 'treeVersion'], a.tree);
  const changelog = doc.get('changelog') as { items: unknown[] } | undefined;
  const entry = doc.createNode({
    date: today,
    patch: to,
    notesPt: [`Cópia da ${from} — revisar fases, gemas, itens e árvore pro patch ${to}.`],
  });
  if (changelog && Array.isArray(changelog.items)) changelog.items.unshift(entry);
  else doc.set('changelog', doc.createNode([entry]));
  doc.commentBefore = ` TODO verificar: criado por new-patch a partir da ${from} em ${today}. Revise tudo antes de marcar como verificado.\n${doc.commentBefore ?? ''}`;
  await writeFile(dst, doc.toString({ lineWidth: 0 }), 'utf8');

  // antigo vira outdated
  const old = parseDocument(text);
  old.setIn(['meta', 'status'], 'outdated');
  await writeFile(src, old.toString({ lineWidth: 0 }), 'utf8');

  console.log(c.green(`✔ ${build}/${to}.yaml criado (cópia da ${from})`));
  console.log(c.green(`✔ ${build}/${from}.yaml marcado como outdated`));
  console.log(c.bold('\nPróximos passos:'));
  console.log(`  1. Atualize o código PoB (sources/*.pob) e as fontes em meta.sources`);
  console.log(`  2. npm run update-tree${typeof a.tree === 'string' ? ` -- --version ${a.tree}` : ''}`);
  console.log('  3. npm run sync-gems   (gemas novas)  ·  npm run fetch-icons  ·  npm run fetch-names');
  console.log('  4. npm run check');
}

main().catch((e) => {
  console.error(c.red(String(e?.message ?? e)));
  process.exit(1);
});
