# Prompt: Site de builds do Path of Exile 2 (Claude Code)

> Cola tudo abaixo no Claude Code, numa pasta vazia. Começa em **plan mode** (Shift+Tab duas vezes) pra ele te mostrar o plano antes de escrever código.

---

## Contexto

Quero um site pessoal pra guardar e seguir builds do **Path of Exile 2** enquanto jogo. A primeira build é o **Monk Martial Artist, Hollow Form Whirling Assault** (liga Forbidden Rites, patch 0.5.5). O jogo atualiza a cada poucos meses (a 1.0 sai em 11/12/2026), então o site precisa ser **guiado por dados**: atualizar uma build é editar arquivo de dados, não mexer em componente.

Eu jogo com o cliente em **inglês** (os nomes batem com os guias), mas leio melhor em português. O site é em **PT-BR**, com os nomes de jogo (itens, gemas, passivas) **sempre em inglês** e, quando der, o nome PT-BR do lado, em menor.

Uso o site em segunda tela ou no celular enquanto jogo. Tem que ser rápido de bater o olho.

## Objetivo de cada página de build

1. **Roteiro por fase** (ex.: Lvl 1–12, 12–25, 25–40, 40–41 transição, mapas iniciais, endgame). Em cada fase:
   - **Card de cada coisa usada:** ícone real do jogo, nome EN, nome PT-BR, tipo/slot, o que faz (2 linhas em PT), por que está na build e **onde conseguir** (quest, vendor, drop, Uncut Gem de nível X)
   - Gemas com os suportes visualmente ligados, cor por atributo (STR/DEX/INT)
   - Ponto de ascendância da fase
   - **Árvore de passivas daquela fase** (ver seção abaixo)
   - Checklist da fase
2. **Árvore de passivas interativa** com seletor de fase.
3. Ascendância (ordem + explicação), spirit/auras, prioridade de stats por slot, progressão do filtro (NeverSink), checklist geral, changelog, fontes.
4. **Modo "jogando":** uma tela compacta só com a fase atual (eu escolho a fase e ela fica salva).

## Stack (sugestão, pode contestar no plano)

- **Astro + TypeScript**, com **content collections + Zod** pros dados das builds (o schema valida e quebra o build se faltar campo)
- Tailwind ou CSS próprio, o que ficar mais limpo
- Árvore de passivas: componente cliente (island), canvas 2D ou PixiJS
- Deploy: **GitHub Pages** via GitHub Actions (meu GitHub: `Espakki`)
- Sem backend. Estado do usuário (fase atual, checklist) em `localStorage`, com try/catch

## Modelo de dados

```
src/content/
  entities/          # compartilhado entre builds
    items/*.json     # { id, nameEn, namePtBr?, kind: unique|base|rune|..., slot, icon, wikiUrl, poe2dbUrl, summaryPt, notesPt? }
    gems/*.json      # { id, nameEn, namePtBr?, kind: active|support|spirit, attribute: str|dex|int, tags[], icon, wikiUrl, summaryPt }
  builds/
    monk-hollow-form/
      0.5.5.yaml     # uma versão da build por patch
public/icons/        # ícones baixados pelo script (ver abaixo)
```

Arquivo da build (por patch):

```yaml
meta:
  slug: monk-hollow-form
  title: Hollow Form Whirling Assault
  class: Monk
  ascendancy: Martial Artist
  patch: "0.5.5"
  league: Forbidden Rites
  lastVerified: 2026-11-07
  status: active        # active | outdated | archived
  sources: [ { label, url } ]
  pob:                  # código(s) Path of Building de referência
    main: "<código PoB do guia principal>"
phases:
  - id: lvl-1-12
    levels: [1, 12]
    title: ...
    goalsPt: [...]
    skills: [ { gem: quarterstaff-strike, supports: [rage-i, rapid-attacks-i] } ]
    items: [ { item: ..., why: ..., required: false } ]
    ascendancy: null
    tree: { pobSpecTitle: "Lvl 12" }   # ou lista de node hashes
    checklist: [...]
gearPriorities: [...]
spirit: [...]
filter: [...]
changelog: [ { date, patch, notesPt } ]
```

Referências entre arquivos são por `id`. Faz um script `npm run check` que avisa se uma build referencia um item ou gema que não existe.

## Ícones (parte importante)

- Os ícones vêm da **poe2wiki.net** (MediaWiki). O padrão de arquivo é `File:<Nome>_inventory_icon.png`. Usa a API (`action=query&prop=imageinfo&iiprop=url`) pra pegar a URL e baixa pra `public/icons/` (converte pra webp).
- Script `npm run fetch-icons`: lê todas as entities, baixa só o que falta, guarda cache e registra num log o que não achou. No site, ícone faltando vira placeholder com a inicial e a cor do tipo.
- Investiga se gemas e passivas notáveis seguem o mesmo padrão de nome. Se não seguirem, ajusta o script.
- Rodapé: "Site de fã não oficial. Ícones e nomes © Grinding Gear Games."

## Nomes em PT-BR

- O jogo não tem modo híbrido (texto PT com nomes EN), por isso o site mostra os dois.
- Investiga uma fonte automática: poe2db.tw tem versão em português, e a API de trade oficial (`br.pathofexile.com`, endpoints de data do trade do PoE2) pode devolver nomes localizados. Se o mapeamento EN→PT não for confiável, deixa `namePtBr` opcional e preenchido à mão. **Não inventa tradução.**

## Árvore de passivas (a parte mais difícil, planeja com cuidado)

- **Dados da árvore:** investiga o repositório **PathOfBuildingCommunity/PathOfBuilding-PoE2** (pasta de TreeData, com a versão da árvore + sprites) e/ou o que a GGG exporta. Escolhe a fonte, documenta a versão usada e cria um script `npm run update-tree` pra atualizar quando sair patch.
- **Entrada da build:** código PoB. Decodifica (base64 url-safe → inflate zlib → XML), lê as tags `<Spec>` (guias costumam ter várias, uma por nível) e extrai os node hashes de cada spec, a classe e a ascendância. Cada fase da build aponta pra uma spec pelo título, ou recebe a lista de nodes direto.
- **Render:**
  - Árvore inteira apagada; nodes alocados acesos
  - **Nodes novos daquela fase em outra cor**, comparando com a fase anterior: é isso que mostra o que pegar agora
  - Zoom e pan com mouse e com toque no celular
  - Tooltip ao passar por cima com nome e stats do node
  - Busca por nome
  - Contador de pontos da fase
- **Fallback:** se a árvore não carregar, mostra um botão pra abrir o código PoB no pobb.in e a lista textual dos notáveis da fase.
- Faz a árvore funcionar **primeiro como protótipo isolado** (uma página de teste com um código PoB real) antes de integrar.

## Design

- Escuro, inspirado no tooltip do jogo: fundo quase preto, bordas bronze, nome de única em laranja, gema ativa e suporte com cores próprias
- Fonte de display com cara de PoE: Fontin (licença livre) ou Cinzel. Corpo legível
- Mobile primeiro: os cards empilham, a árvore ocupa a tela inteira no celular
- Nada de texto escondido atrás de clique pra entender a fase. O essencial fica visível de cara

## Fluxo de atualização (o site vai ter update sempre)

- Cria um **`CLAUDE.md`** no repo explicando como atualizar uma build quando sai patch:
  1. Copiar `0.5.5.yaml` pra `<novo-patch>.yaml`
  2. Marcar a antiga como `outdated`
  3. Atualizar o PoB e as fontes
  4. Rodar `fetch-icons`, `update-tree` e `check`
  5. Registrar no changelog
- Script `npm run new-patch -- --build monk-hollow-form --from 0.5.5 --to 0.6`
- Na página, um seletor de patch mostra versões antigas com um aviso de "desatualizada"
- Estrutura pronta pra várias builds (na 1.0 vem o Duelist)

## Conteúdo inicial: Monk Hollow Form (0.5.5)

Usa como semente. **Antes de fechar, verifica cada ponto contra as fontes** e corrige.

- **Fontes:**
  - Guia principal (fonte da verdade, tem PoB): https://mobalytics.gg/poe-2/builds/scorps-hollow-form-endgame-monk
  - https://mobalytics.gg/poe-2/profile/cliptis/builds/monk-martial-arts-endgame
  - https://pobarchives.com/build/7LKUbi76
- ⚠️ **O leveling que eu tinha (Quarterstaff Strike, Falling Thunder com Elemental Armament + Perpetual Charge, Killing Palm; Rage I e Rapid Attacks I) veio de um guia da 0.4.** Procura um guia de leveling de Martial Artist da 0.5/0.5.5 com PoB (ex.: o leveling guide do Barricade pra 0.5.5, ou o do nicktew na Mobalytics) e monta as fases 1–40 a partir dele.
- **Transição:** Nazir's Judgement no lvl 40 com 2x Greater Iron Rune. No lvl 41, Whirling Assault socketado no Hollow Form. Luvas Lochtonial Caress com ~9–10% de proc de charge.
- **Ascendância:** Way of the Stonefist → Hollow Form Technique → Hollow Focus Technique → livre (Way of the Mountain ou Hollow Resonance). Confere com o guia.
- **Endgame:**
  - Hollow Form: Whirling Assault + Mobility, Blindside, Magnified Area II (+ Efficiency II ou Rakiata's Flow)
  - Hollow Focus: Magnified Area II, Culling Strike II, Blind II, Cooldown Recovery II
  - Rend: Perpetual Charge, Rapid Attacks II, Prolonged Duration II, Rage III
  - Devour: Charge Profusion II, Thrill of the Kill, Prolonged Duration
  - Pounce: Rapid Attacks, Mark for Death
  - Rend, Devour e Pounce precisam de Talisman no Weapon Set 2
- **Spirit:** Wind Dancer, Ghost Dance, Convalescence (defensivas primeiro), Charge Regulation (Clarity), Blasphemy (Temporal Chains)
- **Itens:**
  - Upgrade de arma: Duality perto do T12
  - Opcional: Farrul's Rune of the Hunt
  - Leveling: Amor Mandragora, Hysseg's Claw, Goldrim, Wanderlust, Bramblejack, Northpaw. **Confere o slot e se ainda valem na 0.5.5.**
- **Flask:** Transcendent Mana Flask que recupera charges por segundo
- **Pontos de Weapon Set** vêm de quests: Hunting Grounds, Ogham Farmlands, Keth, Desharl, Aggorat, Journey's End, Wolvenhold, Khari Crossing, Howling Caves, Halls of the Dead
- **Filtro:** NeverSink via ladder oficial. 1regular na campanha, 2semistr em T1–5, 3strict em T6–12, 4verystr em T13+

## Como quero que tu trabalhe

1. **Plano primeiro:** estrutura de pastas, schemas, como vai resolver ícones, nomes PT e árvore, e os riscos. Espera meu ok.
2. Marcos, cada um testável:
   - **M1:** projeto + schemas + `check` + `fetch-icons`
   - **M2:** página da build com fases e cards
   - **M3:** protótipo da árvore, depois integração
   - **M4:** modo jogando + deploy no GitHub Pages + `CLAUDE.md`
3. Quando não tiver certeza de algum dado do jogo, marca `# TODO verificar` no YAML e me lista no fim, em vez de chutar.
4. Commits pequenos por marco.
