# Backlog

Como usar:
- Cada item tem **ID** (`UI-`, `DATA-`, `TREE-`, `OPS-`, `DOC-`), status, critério de aceite e os arquivos que ele "possui".
- Status: `[ ]` a fazer · `[~]` em andamento (diz a sessão/branch) · `[x]` feito (diz o commit/merge).
- Item grande e independente → vira **sessão própria** num branch `ui-02-skills`, `data-01-rota`… (ver CLAUDE.md → Fluxo de trabalho).
- Duas sessões ao mesmo tempo **não** mexem nos mesmos arquivos. Se precisar, combina antes aqui.
- Ao terminar: marcar `[x]`, anotar o branch/commit e, se criou padrão visual, atualizar `docs/design-system.md`.

## Agora

### [x] UI-01 · Base do design (fontes, cores, caixas das fases)
Feito na sessão principal (main). Fontes temáticas com 4 temas em `/lab/tipografia` (padrão Grimório: Alegreya SC + Alegreya Sans),
paleta com mais contraste e cor por seção, fase reorganizada em caixas que abrem/fecham (estado salvo), arte dos itens no tamanho
nativo do inventário (`public/icons/sizes.json`) e ícones de habilidade das gemas (`public/icons/skills/`).

### [~] UI-02 · Skills estilo jogo — sessão `ui02-skills`, branch `*ui-02-skills*`
A caixa **Skills** mostra cada grupo como no painel de gemas do PoE2: ícone da habilidade (o da barra de skills) + a gema
com os encaixes de suporte ao lado, cor por atributo. Clicar/tocar abre o detalhe (o que faz, onde conseguir, nível sugerido, nota da fase).
- Aceite: dá pra entender de relance "qual skill, quais suportes, em que weapon set"; detalhes não poluem a visão geral; 375px ok;
  modo jogando continua compacto; `npm run validate` limpo.
- Arquivos (dono): `src/components/phase/SkillsPanel.astro`, `src/components/GemGroup.astro`, novos em `src/components/skills/`.
- Dados: `gem.icon` (arte da gema), `gem.skillIcon` (habilidade, não existe pra suporte), `gem.attribute`, `gem.kind`, `setup.slotPt`, `setup.role`.

### [~] UI-03 · Inventário do personagem + detalhe do item — sessão `ui03-inventario`, branch `*ui-03-inventario*`
A caixa **Equipamento** mostra um "boneco" com os slots do PoE2 (arma/talismã nos 2 weapon sets, elmo, peitoral, luvas, botas,
amuleto, anéis, cinto, frascos, charms) com a arte do item no tamanho real (células em `sizes.json`); slot sem item mostra o que
procurar (bases/prioridades). Clicar no item abre o detalhe: arte grande, nome EN/PT, por quê, onde pegar, mods principais pra focar, craft.
- Aceite: visão de inventário clara no desktop e no celular (pode virar lista de slots em 375px); detalhe acessível por teclado; validate limpo.
- Arquivos (dono): `src/components/phase/GearPanel.astro`, `src/components/ItemCard.astro`, novos em `src/components/gear/`,
  e se precisar de dado novo: `src/lib/schemas.ts` (só campos de item/fase de equipamento) + YAML/entities.
- Itens de currency (uncut gems, Lesser Jeweller's Orb, runas) não são slot de personagem — mostrar à parte ("Pra conseguir/craftar").

### [~] UI-04 · Árvore no modo jogando — sessão `ui04-arvore-jogando`, branch `*ui-04-arvore-jogando*`
No `/jogando/`, a árvore da fase atual aparece numa caixa "Árvore" e acompanha a troca de fase (selecionar outra fase muda a árvore).
Carrega só quando a caixa abre/aparece; tela cheia continua funcionando no celular.
- Aceite: trocar a fase no seletor do jogando troca a árvore; sem baixar a árvore duas vezes; validate limpo.
- Arquivos (dono): `src/components/PlayMode.astro`, `src/components/TreeViewer.astro`, `src/scripts/tree-viewer.ts`.

## Próximo

- [ ] **UI-05 · Fonte definitiva** — o dono testa `/lab/tipografia`; manter só o tema escolhido (tirar as outras fontes do bundle).
- [ ] **UI-06 · Polimento pós UI-02/03/04** — consistência de espaçamento, hierarquia, revisar mobile inteiro, cabeçalho/hero da build.
- [ ] **DATA-01 · Rota da transição** (decisão do dono): Hollow Palm sem arma até os mapas (Barricade, atual) × Nazir's Judgement no 40 (Scorpius).
- [ ] **DATA-02 · 4ª ascendência**: Runic Meridians (Barricade/Cliptis, atual) × Way of the Mountain / Hollow Resonance.
- [ ] **DATA-03 · Resolver `verify`** — lista no `npm run check` (Duality na liga, mods de runa/charm/frasco, 5º socket do Hollow Form, 1ª ascensão, 22×24 pontos de weapon set).
- [ ] **OPS-01 · Subir no homelab** depois de juntar UI-02..04 (`ops-homelab`).
- [ ] **UI-07 · PWA** — manifest + ícone pra "adicionar à tela inicial"; service worker opcional (offline no celular).
- [ ] **TREE-01 · Ícones dos notáveis na árvore** quando o zoom estiver alto.
- [ ] **TREE-02 · Árvore carrega mais cedo** (começar o download no load da página, não só ao rolar até ela).

## Depois

- [ ] **DATA-04 · Build do Duelist** (1.0 — 11/12/2026).
- [ ] **DATA-05 · Patch 0.6 / 1.0** da build do Monk (`npm run new-patch`).
- [ ] **UI-08 · Busca no site** (gema/item/passiva → onde aparece nas fases).
- [ ] **UI-09 · Comparar patches** (o que mudou de uma versão da build pra outra).
- [ ] **OPS-02 · `npm run homelab`** — atualizar o notebook com 1 comando (usuário/IP vindo de `.env.local`, nunca no repo).
- [ ] **DOC-01 · Alimentar "Dúvidas resolvidas"** (`faq:` no YAML) conforme as dúvidas aparecerem.

## Feito

- [x] M1 — projeto Astro, schemas Zod, scripts (`check`, `update-tree`, `sync-gems`, `fetch-icons`, `fetch-names`).
- [x] Conteúdo — Monk Hollow Form 0.5.5 (7 fases, 66 gemas, 18 itens, nomes PT-BR, ícones).
- [x] M2 — página da build com fases, cards e checklist.
- [x] M3 — árvore interativa + `/lab/arvore`.
- [x] M4 — modo jogando, `new-patch`, homelab (Docker + Dockge, porta 8090).
