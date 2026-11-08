# UI-02 · Skills estilo jogo — notas do padrão visual

Notas pra incorporar no `docs/design-system.md` ao juntar o branch. Tudo usa tokens que já existem em `global.css`;
estilos ficam scoped nos componentes.

## Peças

| arquivo | o que é |
|---|---|
| `src/components/phase/SkillsPanel.astro` | caixa Skills: dica de uso, lista de grupos, seção "Spirit / auras", `<template>` do texto das gemas |
| `src/components/GemGroup.astro` | um grupo (skill + suportes) — layout e estados |
| `src/components/skills/SetupChips.astro` | chips do grupo: papel · weapon set · nível · opcional · a verificar |
| `src/components/skills/GemDetail.astro` | painel de detalhe do grupo (um por grupo, começa `hidden`) — parte "Nesta fase" |
| `src/components/skills/GemInfo.astro` | parte da gema do detalhe (arte, tipo, nome, o que faz, texto do jogo, onde conseguir, links) |
| `src/components/skills/GemArt.astro` | arte de gema sem moldura, com placeholder (inicial na cor do atributo) |
| `src/scripts/skills.ts` | abre/fecha/troca o detalhe (delegação no `document`) |

## Grupo de gemas (`.gg`)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [ícone]  Storm Wave           ⌄ │ ─(◉ Elemental Armament II)─(◉ Shock)─… │
│  ◆gema   Onda de Tempestade     │ ↻ troca  Substitui o …                 │
│ (Principal) (nível 7)           │ ▏nota da fase                          │
├──────────────────────────────────────────────────────────────────────────┤
│ [painel de detalhe — só quando uma gema é tocada]                        │
└──────────────────────────────────────────────────────────────────────────┘
```

- **Cabeça = botão** (`.gg-main`): ícone da habilidade 52px (`gem.skillIcon`, moldura quadrada escura como a barra de skills)
  com a **arte da gema** 24px no canto inferior direito (`gem.icon`). Gema de ascendência (Hollow Form/Focus) usa o mesmo
  ícone nos dois → sem o selo. Sem `skillIcon` → a arte da gema num encaixe redondo com anel na cor do atributo.
- **Nome EN** em `.game-name` com a cor do atributo (`.c-str/.c-dex/.c-int/.c-none`); **PT** embaixo, em `.pt`.
- Seta (`.gg-more`) indica que abre; gira quando aberto. Estado aberto = borda/fundo em `--acc-skills`.
- **Weapon set**: selo "II" (ou "I") no canto superior esquerdo do ícone em `--ws2`/`--ws1`, **borda esquerda** do grupo
  na mesma cor e chip `.chip.ws2` com o `slotPt`. Lido de `setup.slotPt` (regex `Weapon Set N`).
- **Opcional**: borda tracejada + chip `.chip.opt`.
- **Chips** (`SetupChips`): papel (`ROLE_PT`; "Principal" ganha cor `--acc-skills`), weapon set, nível, opcional,
  "a verificar" (`.chip.verify`, texto completo no `title` **e** no detalhe — `title` não funciona no toque).
  O tipo da gema (Ascendência/Forma/Spirit) saiu da visão geral: fica na primeira linha do detalhe.
- **Troca** (`replacesPt`): linha em `--warn` começando com um chip "↻ troca" + o texto.
- **Nota da fase** (`notePt`): visível, com fio à esquerda (`--border-2`), `--text-2`.

## Suportes = gemas encaixadas (`.socks`)

- Cada suporte é um **botão-pílula**: encaixe redondo 36px com **anel na cor do atributo** e brilho suave, arte do suporte
  dentro, nome EN em `.game-name`. `title` = "Nome (PT) — resumo" (dica rápida no mouse).
- **Gema de skill encaixada** (ex.: Whirling Assault dentro do Hollow Form, `kind !== 'support'`): encaixe **quadrado**,
  ícone da habilidade e nome na cor do atributo — pra diferenciar de suporte.
- **Ligação**: cada item é "traço (16px, bronze 65%) + pílula". Ao quebrar a linha o traço aparece no começo da linha nova,
  então a corrente continua legível. Quando os suportes ficam **embaixo** da skill, uma "espinha" vertical à esquerda liga
  as linhas (└─ Rage I ─ Brink I).

## Layout responsivo (container query `gg`, não media query)

O grupo é `container: gg / inline-size` — o layout depende da largura do **grupo**, não da tela (funciona igual na página
da build e no jogando).

| largura do grupo | layout |
|---|---|
| ≥ 760px | cabeça à esquerda (230–300px) · suportes + troca + nota à direita; corrente sai da cabeça, sem espinha |
| 460–759px | empilhado; suportes em linha com quebra + espinha |
| < 460px (celular) | empilhado; suportes **em coluna**, ligados por traço vertical entre os encaixes (sem espinha) |
| < 460px, compacto | suportes em linha com quebra + espinha (mais baixo que a coluna) |

Alvos de toque: cabeça ≥ 56px (48 no compacto), pílula ≥ 42px (40 no compacto), × e links 40px. Sem rolagem horizontal em 375px.

## Detalhe (clique/toque/Enter)

- **Um painel por grupo** (`<section role="region" hidden>` logo abaixo do grupo); todos os botões do grupo têm
  `aria-controls` pra ele e `aria-expanded` (só o da gema aberta fica `true`). Tocar outra gema troca o conteúdo; tocar a
  mesma de novo, no × ou **Esc** fecha e devolve o foco pro botão. No celular rola só o necessário pra mostrar o painel.
- Conteúdo: arte grande (ícone 60px + gema no canto) · tipo ("Skill", "Suporte", "Spirit", "Ascendência", "Forma") ·
  nome EN/PT · **O que faz** (`summaryPt`) · **Texto do jogo** (`descriptionEn`, itálico, `lang="en"`, tags embaixo) ·
  **Onde conseguir** (`gemWhere()`) · **Nesta fase** (só na gema principal: nível, weapon set, troca, nota) ·
  **A verificar** (`setup.verify`/`gem.verify`) · links poe2wiki/poe2db.
- Rótulos (`dt`) em `--font-display` bronze; em grupo ≥ 560px viram coluna de 9.5rem à esquerda.
- Fundo `--inset` com degradê leve de `--acc-skills` e borda `--acc-skills` 40%.

### Por que `<template>` + um painel por grupo
A mesma gema aparece em várias fases (Rend em 7). Renderizar o detalhe completo em cada gema de cada grupo dobrava o HTML
(206 painéis). Agora o texto da gema vai **uma vez por página** em `<template data-gem-tpl="id">` (deduplicado entre as
fases via `Astro.locals`) e o script clona ao abrir. Página da build: 556 KB / 71 KB gzip (main antes: 390 KB / 56 KB);
jogando: 485 KB / 58 KB gzip (antes: 276 KB / 33 KB) — o jogando antes não tinha detalhe nenhum.

## Modo jogando (`compact`)

Ícone 42px, sem nome PT, chips **dentro da cabeça** (embaixo do nome; sem o chip de nível — ele aparece no detalhe),
pílulas 40px, suportes sempre em linha com quebra. Nota da fase continua visível. Detalhe igual (toque).

## Separação Skills × Spirit

Os grupos de `phase.spirit` ficam sob o título "Spirit / auras" (`.panel-title`) com a legenda "reservam Spirit — ficam ligadas".
