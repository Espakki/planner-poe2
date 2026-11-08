# UI-03 · Inventário do personagem + detalhe do item

Caixa **Equipamento** de cada fase (`src/components/phase/GearPanel.astro`). Notas do padrão visual pra quem for mexer depois
(e pra sessão principal levar o que for geral pro `docs/design-system.md`).

## Layout

```
painel largo (container "gear" ≥ 760px)          painel estreito (celular, < 760px)
┌───────────────────────┬────────────────────┐   ┌────────────────────┐
│ [I][II] weapon set    │ Detalhe do slot    │   │ [I][II]            │
│ boneco (8 × 6 células)│ (sticky, rola      │   │ boneco             │
│ frascos + charms      │  sozinho)          │   │ frascos + charms   │
│ legenda               │                    │   │ legenda            │
│ resumo por slot       │                    │   │ resumo por slot    │
├───────────────────────┴────────────────────┤   │ pra conseguir      │
│ Pra conseguir / craftar                    │   └────────────────────┘
└────────────────────────────────────────────┘   tocar → bottom sheet (<dialog>)
```

- Quebra por **container query** (`container: gear / inline-size` no `.gear-panel`), não pela tela — o modo jogando e a
  página da build usam a mesma regra.
- O JS (`src/scripts/gear.ts`) decide o modo olhando se a coluna do detalhe está visível; no estreito ele **move** a seção do
  detalhe pro `<dialog>` e devolve ao fechar (Esc, ✕ ou toque no fundo; o foco volta pro slot).
- Sem JS: a coluna do detalhe aparece embaixo do resumo (`.gear-panel:not([data-gear-ready])`).

## Boneco

- Grade `8 × 6` de `--cell` com `--g` de espaço (`grid-template-areas` em `gear/Inventory.astro`), igual ao PoE2:
  arma | elmo / peitoral / cinto | mão secundária; amuleto ao lado do elmo; anéis ao lado do peitoral; luvas e botas embaixo.
  Faixa do cinto: frasco de vida (1×2) · 3 charms (1×1) · frasco de mana (1×2).
- `--cell`: `clamp(28px, (100cqi − espaços) / 8, --cell-max)` — **52px** na página, **44px** no modo jogando (`compact`),
  ~33px num celular de 375px. A arte do item usa `item.art.cw/ch` × `--cell` (tamanho real em células).
- **Weapon set I/II**: dois radios (`fieldset.ws`) + `:has()` mostram só o set escolhido. Cor `--ws1` / `--ws2`; bolinha no
  botão = aquele set tem item ou dica. Abrir o detalhe de "Weapon Set II" troca o boneco pro II (e vice-versa).
- Estados do slot (`gear/GearSlot.astro`):
  | estado | visual |
  |---|---|
  | com item | arte centralizada, fundo com brilho da raridade (`--unique`, `--currency`, `--normal`) |
  | obrigatório | ◆ `--warn` no canto superior esquerdo |
  | mais de um item no slot | pílula `+N` no canto inferior direito (principal = obrigatório primeiro, depois ordem do YAML) |
  | sem item, com nota da fase | borda tracejada `--acc-gear`, rótulo do slot + bases/prioridades (some no celular → lupa) |
  | sem nada | slot apagado (decorativo, `aria-hidden`) |
  | aberto no painel | borda `--bronze-hi` com brilho (`aria-current="true"`) |

## Resumo por slot (`gear/Overview.astro`)

Substitui a lista "O que procurar por slot". Uma linha por grupo que tem algo: nome do grupo (cor da seção; weapon sets em
`--ws1/--ws2`), item(ns) na cor da raridade com ◆, "ou <alternativas>", e as notas da fase (bases em `--font-item`, prioridades
com ›, nota em `--muted`). A linha abre o mesmo detalhe do slot.

## Detalhe (`gear/GroupDetail.astro` + `ItemCard.astro`)

- Um detalhe por **grupo**: Weapon Set I/II (arma + mão secundária), Elmo, Peitoral, Luvas, Botas, Amuleto, Anéis, Cinto,
  Frascos, Charms — e um por item da faixa "Pra conseguir".
- Ordem: item principal (`ItemCard size="lg"`: arte grande em cima + "tooltip") → **Alternativas** (`size="md"`, arte ao lado)
  → **O que procurar** / **Se for trocar, procure** (bases, prioridades numeradas, nota).
- Tooltip do item: cabeçalho centralizado com fundo tingido pela raridade, nome EN `.game-name` na cor da raridade, base,
  nome PT (`.pt`); chips (slot/weapon set, tipo, nível, obrigatório/opcional/alternativa, a verificar); **Mods pra focar**
  (`keyModsEn`) em `--magic` como no jogo; resumo; Por quê / Onde pegar / Craft / Nota / A verificar (texto visível — `title`
  não funciona no toque); links poe2wiki e poe2db.
- Painel largo: coluna sticky (`top: 64px`, 116px no jogando por causa da barra de fase) com rolagem própria.

## Regras de slot (`gear/inventory.ts`)

- Arma com base contendo "Talisman" (ou `kind: talisman`) → **Weapon Set II**; outra arma → Set I; mão secundária → Set I.
- Anel → anel 1; frasco com "Mana" no nome/base → frasco de mana, senão de vida; charms enchem os 3 slots em ordem.
- `currency`, `rune`, `soul-core`, `jewel` (ou slot `currency`/`socketable`/`jewel`) → faixa **Pra conseguir / craftar**.
- Notas (`phase.gear`): `ring` vale pros dois anéis, `flask` pros dois frascos, `charm` pros três; arma com base "Talisman" → Set II.
- Quando a regra errar: campo opcional **`equip`** no item da fase ou na nota (`weapon-1`, `offhand-1`, `weapon-2`, `offhand-2`,
  `ring-1`, `ring-2`, `flask-life`, `flask-mana`). Hoje nenhum YAML precisa dele.

## Não feito / ideias

- A mão secundária não mostra "ocupada por arma de duas mãos" (não deu pra confirmar na wiki se talismã é 2H; a poe2wiki bloqueou
  o acesso automático).
- Fases não herdam itens da fase anterior: o boneco mostra só o que o YAML da fase lista (ex.: Ato 3 sem talismã no Set II).
