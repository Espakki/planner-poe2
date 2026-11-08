# UI-04 · Árvore no modo jogando — notas

Branch `claude/ui-04-arvore-jogando-0fa3d0`. Arquivos: `src/components/PlayMode.astro`, `src/components/TreeViewer.astro`,
`src/scripts/tree-viewer.ts`. Inclui o bônus **TREE-02**.

## O que mudou

- **`/jogando/`**: no fim da página, a caixa `<details class="box box--tree play-tree" data-box="tree-play">` "Árvore desta fase"
  com **uma** instância do `TreeViewer`. Trocar a fase (select, ‹ ›, "Estou aqui") troca a árvore: o `PlayMode` salva a fase com
  `update()` → evento `plan-poe:state` → `viewer.selectPhase()`. O título da caixa mostra o resumo da fase atual
  (`+N novos · respec −M`; 1ª fase: `N pontos`), visível mesmo com a caixa fechada.
- **`TreeViewer` ganhou props** (padrões mantêm a página da build igual):
  | prop | padrão | uso |
  |---|---|---|
  | `phaseButtons` | `true` | `false` esconde os botões de fase do viewer (o jogando já tem seletor) |
  | `embedded` | `false` | dentro de uma `.box`: sem moldura de painel nem `h2`; no celular o palco vai até a borda da caixa |
  | `load` | `'idle'` | `'idle'` baixa a árvore logo após o load da página (TREE-02); `'visible'` só perto da tela |
- **Contador**: sem botões de fase, na **tela cheia** aparece o nome da fase antes dos pontos (`Ato 3 · 56 pontos…`),
  porque o seletor do jogando fica escondido atrás do overlay.
- **Legenda**: cada item (bolinha + rótulo) não quebra mais no meio (antes "○ / Weapon Set 1" separava no celular).

## Carregamento (tree-viewer.ts)

- `load()` é único por viewer (promessa reaproveitada) — nunca baixa o JSON duas vezes.
- `loadOn: 'visible'`: IntersectionObserver (400px de margem) **e** a caixa `<details>` em volta aberta.
  Atenção: no Chrome o conteúdo de `<details>` fechado continua com tamanho no `getBoundingClientRect()` (é
  `content-visibility: hidden`, não `display: none`), por isso o teste é `box.open`, não o tamanho.
- Ao abrir a caixa (`toggle`): reobserva (o `observe()` entrega o estado atual → carrega se já estiver na tela) e
  **centraliza nos nodes da fase**. Trocar de fase com a caixa fechada só marca "centralizar quando aparecer".
- `loadOn: 'idle'` (página completa): `requestIdleCallback` (fallback `setTimeout`) depois do `load` da janela.
- O contador (pontos / +novos / respec) aparece antes da árvore baixar.

## Por que a caixa fica no fim da fase

1. Durante o jogo o que se consulta mais é skills/equipamento/checklist; a árvore é consulta pontual.
2. O canvas captura o toque (arrastar = mover a árvore, `touch-action: none`). No meio da página ele "prenderia" a rolagem
   no celular; no fim, só se chega nele de propósito.
3. Com `load="visible"`, a árvore (~700 KB) só baixa quando o usuário rola até ela — economiza dados no celular.

## Pra sessão principal

- `docs/design-system.md` (não editado aqui): vale registrar a caixa `tree-play` e as props `embedded`/`phaseButtons`/`load`
  do `TreeViewer` na lista de componentes.
- Backlog: UI-04 e TREE-02 podem ir pra `[x]` depois do merge.
