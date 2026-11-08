# Plano PoE2 — site pessoal de builds (Path of Exile 2)

Site estático (Astro + TypeScript) em **PT-BR** pra seguir builds de PoE2 fase a fase, na segunda tela ou no celular.
Dono: Espakki (joga com o cliente em inglês; lê melhor em português). Deploy: GitHub Pages via Actions.

## Regras de conteúdo (importantes)

- **Nomes de jogo sempre em inglês** (`nameEn`) — itens, gemas, passivas, quests. O nome PT-BR (`namePtBr`) é opcional e
  **nunca inventado**: vem do `npm run fetch-names` (poe2db.tw/pt) ou é escrito à mão com `namePtBrSource: "manual"`.
- Texto explicativo em PT-BR fica em campos terminados em `Pt`. Escreva com palavras próprias (não copiar guias).
- **Não chutar dado de jogo.** Na dúvida: campo `verify: "o que falta conferir"` (aparece como "a verificar" no site e
  no `npm run check`) e/ou comentário `# TODO verificar` no YAML.
- Atualizar uma build = editar dados. Componentes só mudam se o *formato* mudar.

## Estrutura

```
src/content/
  entities/items/*.json      itens (únicos, runas, frascos, charms, currency) — schema itemSchema
  entities/gems/*.json       gemas (geradas por sync-gems a partir do PoB) — schema gemSchema
  entities/passives/*.json   notáveis de ascendência/keystones citados no texto — schema passiveSchema
  builds/<slug>/<patch>.yaml uma versão da build por patch — schema buildSchema
  builds/<slug>/sources/     códigos PoB (.pob) e exports do Build Planner (.json) usados nas árvores
src/lib/schemas.ts           TODOS os schemas Zod (usados pelo Astro e pelo check)
src/lib/build-tree.ts        resolve a árvore de cada fase (PoB spec / planner / lista) + diff entre fases
src/lib/pob.ts               decodifica código PoB (base64url → zlib → XML) e lê <Spec>, weapon sets, gemas
src/lib/tree-build.ts        tree.json do PoB → formato compacto (posições, arcos, ascendência no centro)
src/scripts/tree-viewer.ts   árvore interativa (canvas 2D): zoom/pan/pinça, tooltip, busca, diff, weapon sets
src/scripts/state.ts         fase atual + checklist no localStorage (sempre com try/catch)
src/components/              BuildPage, PhaseSection, GemGroup, ItemCard, TreeViewer, PlayMode...
src/pages/                   / · /builds/<slug>/ · /builds/<slug>/<patch>/ · .../jogando/ · /lab/arvore/
public/tree/<versão>.json    árvore compacta (gerada) · public/icons/ ícones webp (gerados)
data/tree/<versão>/          node-index.json (nome, stringId, ícone da wiki) + meta.json (commit de origem)
data/pob/gems.json           base de gemas do PoB (gerada) · data/logs/ logs dos scripts
```

## Comandos

| comando | o que faz |
|---|---|
| `npm run dev` | servidor local (http://localhost:4321) |
| `npm run check` | valida schemas, referências (gema/item/passiva existe?), PoB/spec/planner, nodes da árvore; lista os `verify` |
| `npm run update-tree [-- --version 0_6]` | baixa tree.json do PathOfBuilding-PoE2 (branch dev) e gera public/tree + data/tree |
| `npm run sync-gems` | cria entities/gems pra toda gema referenciada nas builds (dados do PoB: atributo/cor, tier, tags, descrição) |
| `npm run sync-gems -- --refresh` | atualiza campos automáticos das gemas existentes (mantém summaryPt/namePtBr) |
| `npm run fetch-icons [-- --force]` | baixa ícones da poe2wiki → public/icons/*.webp (só o que falta; log em data/logs) |
| `npm run fetch-names [-- --force]` | preenche namePtBr via poe2db.tw/pt (não toca nos `manual`) |
| `npm run new-patch -- --build <slug> --from 0.5.5 --to 0.6 [--tree 0_6]` | cria a versão nova da build e marca a antiga como outdated |
| `npm run validate` | check + astro check + build |

## Quando sai patch (fluxo de atualização)

1. `npm run new-patch -- --build monk-hollow-form --from 0.5.5 --to 0.6 --tree 0_6`
   (copia o YAML, marca a antiga como `outdated`, abre entrada no changelog)
2. Atualizar fontes: `meta.sources`, código PoB novo em `sources/*.pob` (+ `meta.pob`), exports do planner.
   Conferir cada fase contra o guia; usar `verify` no que não der pra confirmar.
3. `npm run update-tree -- --version 0_6` (se a árvore mudou) → `npm run sync-gems` → `npm run fetch-icons` → `npm run fetch-names`
4. `npm run check` (tem que passar) e olhar no `npm run dev`
5. Registrar no `changelog` do YAML novo o que mudou. Ao terminar a revisão, atualizar `meta.lastVerified`.

A versão antiga continua acessível em `/builds/<slug>/<patch>/` com aviso de desatualizada; o seletor de patch aparece sozinho.

## Nova build (ex.: Duelist na 1.0)

Criar `src/content/builds/<slug>/<patch>.yaml` (copiar a estrutura da do Monk), colocar o PoB em `sources/`,
`npm run sync-gems`, criar os itens/passivas que faltarem em entities (o check acusa), `fetch-icons`, `fetch-names`, `check`.

## Árvore — como funciona

- Fonte: `PathOfBuildingCommunity/PathOfBuilding-PoE2`, `src/TreeData/<versão>/tree.json` (versão e commit em `data/tree/<v>/meta.json`).
  Posição: `x = grupo.x + sin(ângulo)·raio`, `y = grupo.y − cos(ângulo)·raio` (igual ao PoB). Grupos no JSON são 1-indexados.
- Cada fase aponta pra `tree: { pob: <chave>, spec: "<título>" }`, `{ planner: sources/x.json }` ou `{ nodes: [...] }`.
- **Ascendência é recalculada** a partir de `ascendancy.take/refund` das fases (acumulado) com menor caminho a partir do
  node inicial — os exports do Build Planner da Mobalytics vinham inconsistentes. Então a árvore sempre bate com o texto.
- Diff: nodes novos (verde) e desalocados (anel vermelho) em relação à fase anterior.
- Fallback: se o JSON não carregar, mostra link do pobb.in e a lista de notáveis por fase.

## Ícones e nomes — padrões descobertos

- Itens/gemas/runas/uncut: `File:<Nome> inventory icon.png`. Suportes II/III usam o ícone do I (`Blind I inventory icon.png`).
  Nomes ambíguos: `<Nome> (support gem) inventory icon.png` (Shock, Maim).
- Passivas: `<ArquivoDDS>_passive_skill_icon.png`; ascendência: `<ArquivoDDS>_(<Pasta>)_passive_skill_icon.png`.
- Gemas de ascendência (Hollow Form/Focus) não têm inventory icon → usa o ícone da passiva que concede a skill.
- PT-BR: poe2db usa o mesmo slug em inglês pra todo idioma (mapeamento exato). A API de trade em PT (`br.pathofexile.com/api/trade2/data/items`)
  **não** serve: ordem/contagem diferem entre idiomas.

## Dúvidas da build (FAQ)

Quando uma dúvida for resolvida (aqui ou numa conversa normal), registrar em `faq:` no YAML da build (`q`, `a`, `date`).
Aparece na seção "Dúvidas resolvidas" da página. Se a resposta muda o roteiro, editar a fase também e anotar no changelog.

## Pontos marcados pra verificar (0.5.5)

Rodar `npm run check` pra lista atualizada. Na criação:
- Duality ainda obtível na Forbidden Rites? (PoB marca como liga Runes of Aldur)
- Mods exatos: Greater Iron Rune, Farrul's Rune of the Hunt, Sapphire/Topaz Charm, mod "charges per second" do Transcendent Mana Flask
- Charge Regulation: planner marca só no 58; texto do guia troca na transição (depende de Uncut Spirit Gem 14)
- Em que nível o Hollow Form ganha o 5º socket
- 4ª ascendência: Runic Meridians (Barricade/Cliptis) × Way of the Mountain / Hollow Resonance
- 1ª ascensão: confirmar trial/ato exato
- Weapon set: 11 quests × 2 = 22, Mobalytics mostra 24
- pobarchives.com/build/7LKUbi76 (citado no prompt) não abriu (Cloudflare)
