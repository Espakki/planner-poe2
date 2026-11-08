# Design system

Fonte de verdade dos tokens: `src/styles/global.css`. Este arquivo explica **quando usar o quê**.
Mudou um padrão? Atualize aqui no mesmo commit.

## Princípios
1. **Leitura rápida em segunda tela/celular.** Hierarquia clara: título da fase → resumo/objetivos → caixas.
2. **Cara de PoE sem perder legibilidade.** Fundo quase preto, bordas bronze, cores de raridade/atributo do jogo; corpo de texto
   sempre em fonte de leitura (nunca a fonte decorativa em parágrafo).
3. **Nome do jogo em inglês destacado; PT-BR menor ao lado** (`.game-name` + `.pt`).
4. **Mobile primeiro:** 375px sem rolagem horizontal; alvos de toque ≥ 40px.

## Tipografia
| token | uso | padrão (tema Grimório) |
|---|---|---|
| `--font-display` | títulos (h1–h4), títulos de caixa, botões | Alegreya SC |
| `--font-item` | nomes de item/gema/passiva (`.game-name`) | Alegreya SC |
| `--font-body` | texto corrido, listas, chips | Alegreya Sans |
| `--display-weight` / `--display-tracking` | peso/espaçamento do display (varia por tema) | 700 / .02em |
| `--body-size` | tamanho base do corpo | 16.5px |

Temas em `:root[data-fonts='…']` (gravura, pergaminho, gotico), escolhidos em `/lab/tipografia` e salvos no navegador
(`plan-poe:fonts`). O `Base.astro` aplica antes do primeiro paint. Quando o dono escolher (UI-05), remover os outros.

## Cores
- Superfícies: `--bg` < `--bg-2` < `--panel` < `--panel-2` < `--panel-3`; `--inset` pra áreas "afundadas" (canvas, amostras).
- Texto: `--text` (principal), `--text-2` (secundário), `--muted` (rótulos/meta), `--faint` (só decoração).
- **Cor por seção da fase** (borda superior da caixa e título): `--acc-skills` (verde-água, gemas) · `--acc-gear` (laranja, itens)
  · `--acc-tree` (dourado, árvore/ascendência) · `--acc-play` (azul claro, dicas) · `--acc-check` (verde, checklist).
- Raridade: `--unique`, `--rare`, `--magic`, `--normal`, `--currency`. Atributo de gema: `--str`, `--dex`, `--int`, `--none`.
- Estado: `--new` (novo na fase), `--removed` (sai no respec), `--warn` (a verificar / obrigatório), `--ws1`/`--ws2` (weapon sets).

## Componentes base (CSS global)
- **`.box`** — seção que abre/fecha: `<details class="box box--skills" open data-box="skills"><summary><span class="box-title">…</span><span class="box-meta">…</span></summary><div class="box-body">…</div></details>`.
  O `data-box` faz o estado aberto/fechado ser lembrado por tipo (`src/scripts/boxes.ts`).
- **`.panel`** + **`.panel-title`** — painel genérico e subtítulo com linha.
- **`.chip`** (+ `.req`, `.opt`, `.ws2`, `.verify`) — rótulos curtos. `verify` sempre com `title` explicando o que falta.
- **`.btn`** (+ `.ghost`, `aria-pressed`) — botões.
- **`GameIcon.astro`** — ícone do jogo com placeholder (inicial + cor do tipo) quando falta arte.

## Estrutura da fase (`PhaseSection.astro`)
Cabeçalho → `intro` (resumo + Objetivos) → `.boxes`:
`Skills` (largura total) · `Equipamento` (largura total) · `Árvore & Ascendência` | [`Como jogar` + `Checklist`].
Conteúdo de cada caixa em `src/components/phase/*` — **cada um tem dono no backlog**, não editar o de outro item.

## Componentes das caixas
Detalhes completos (decisões, medidas, comportamento) em `docs/design/*.md` — um arquivo por item do backlog.

- **Skills** (`phase/SkillsPanel` + `GemGroup` + `skills/*`, script `src/scripts/skills.ts`) — [ui-02-skills.md](design/ui-02-skills.md)
  - Grupo `.gg`: cabeça = botão com o ícone da habilidade (52px) + nome EN na cor do atributo + PT; suportes como gemas
    encaixadas (`.socks`, pílulas ligadas por traço bronze); gema de skill encaixada (Whirling Assault no Hollow Form) em encaixe quadrado.
  - Weapon set: selo "II"/"I" no ícone + borda esquerda em `--ws2`/`--ws1`. Opcional: borda tracejada.
  - Detalhe: um painel por grupo logo abaixo, texto de cada gema 1× por página em `<template data-gem-tpl>`.
  - Layout por container query (`gg`), não media query. Skills e Spirit/auras separados.
- **Equipamento** (`phase/GearPanel` + `gear/*` + `ItemCard`, script `src/scripts/gear.ts`) — [ui-03-inventario.md](design/ui-03-inventario.md)
  - Boneco com Weapon Set I/II (radios + `:has()`), arte em células reais (`--cell-max` 52px; 44px no jogando).
  - Painel largo (≥ 760px, container query `gear`): boneco + resumo | detalhe fixo ao lado. Estreito: detalhe em bottom sheet (`<dialog>`).
  - Regras de slot em `gear/inventory.ts`; exceções com `equip:` no item da fase (`weapon-2`, `ring-2`, `flask-mana`…).
  - Currency/runas/uncut gems fora do boneco, na faixa "Pra conseguir / craftar".
- **Árvore** (`TreeViewer` + `src/scripts/tree-viewer.ts`) — [ui-04-arvore-jogando.md](design/ui-04-arvore-jogando.md)
  - Props: `embedded` (sem cabeçalho próprio, dentro de caixa), `phaseButtons={false}` (fase vem de fora, via `plan-poe:state`),
    `load` (quando baixar o JSON). Página da build mantém os botões de fase.
  - No `/jogando/`: caixa `box--tree` `data-box="tree-play"` no fim da página, acompanha o seletor de fase.

## Arte do jogo
- Itens: `public/icons/items/*.webp` no tamanho nativo do inventário; `public/icons/sizes.json` → `{ w, h, cw, ch }` (cw×ch = células).
  Uma célula ≈ 106px na arte; no site, escolha um tamanho de célula (ex.: 44px) e multiplique.
- Gemas: `public/icons/gems/*` (arte da gema) e `public/icons/skills/*` (ícone da habilidade — só gemas não-suporte).
- Passivas: `public/icons/passives/*` e `public/icons/nodes/*`.
- No código: `entity.icon`, `gem.skillIcon`, `item.art` (via `getEntities()` em `src/lib/site.ts`).
