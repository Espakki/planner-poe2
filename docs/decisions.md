# Decisões

Registro curto do porquê das escolhas. Nova decisão → nova entrada no topo (data, decisão, motivo, alternativa descartada).

## 2026-11-08 · Trabalho dividido em sessões por item do backlog
Cada item grande do `docs/backlog.md` roda numa sessão própria, num branch próprio (worktree). A sessão principal coordena,
revisa e junta os branches **depois do ok do dono**. Motivo: não perder contexto num chat gigante e permitir trabalho em paralelo
sem um item atropelar o outro. Regra: duas sessões não editam os mesmos arquivos (o backlog diz quem é dono do quê).

## 2026-11-08 · Fontes temáticas com 4 temas testáveis
Saíram Cinzel + Inter (genéricas). Padrão "Grimório" (Alegreya SC + Alegreya Sans) — versalete caligráfico parecido com o Fontin do
jogo, com corpo humanista legível. Fontin não foi usada: não tem pacote/licença clara pra web. Os outros temas ficam em
`/lab/tipografia` até o dono escolher (UI-05).

## 2026-11-08 · Sem deploy público — homelab
O dono não quer o site publicado. Roda local (`npm run dev`) e no notebook homelab (Ubuntu + Dockge) via Docker/nginx na porta 8090.
GitHub Pages foi removido. Repositório continua público (só código), commits com e-mail noreply; IP/usuário do homelab não entram no repo.

## 2026-11-07 · Leveling do Barricade/psynister, endgame do Scorpius
O leveling que o dono tinha era da 0.4. Não havia guia 0.5.5 do Scorpius pra leveling; o guia escrito do Barricade (0.5.5) tem árvore
por variante (Build Planner). Endgame segue o PoB do Scorpius (fonte da verdade). Consequência: respec na entrada dos mapas
(sai Hollow Palm, entra cajado). Em aberto: DATA-01 (Nazir's no 40) e DATA-02 (4ª ascendência).

## 2026-11-07 · Ascendência da árvore recalculada pelo YAML
Os exports do Build Planner tinham ascendência inconsistente entre variantes. A árvore de cada fase usa os nodes da fonte só pra
árvore principal; a ascendência vem de `ascendancy.take/refund` (acumulado) com menor caminho. Assim árvore e texto sempre batem.

## 2026-11-07 · Nomes PT-BR só da poe2db
A poe2db usa o mesmo slug inglês em todos os idiomas → mapeamento exato. A API de trade em PT foi descartada: ordem/contagem
diferem entre idiomas (mapear por índice inventaria nomes).

## 2026-11-07 · Árvore a partir do PoB, render em canvas 2D
`tree.json` do PathOfBuilding-PoE2 (mesma geometria do PoB), convertido pra um JSON compacto (~180 KB com gzip). Canvas 2D sem
dependência (PixiJS seria exagero pra ~4500 nodes). Sprites DDS do PoB não são usados.

## 2026-11-07 · Astro + TypeScript, content collections com Zod
Atualizar build = editar dados (YAML/JSON); o schema quebra o build se faltar campo. Site estático, sem backend; estado do usuário
no localStorage.
