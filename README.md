# Plano PoE2

Site pessoal pra guardar e seguir builds do **Path of Exile 2** enquanto joga — em PT-BR, com os nomes do jogo em inglês.

- Roteiro por fase (nível) com gemas ligadas aos suportes, itens, ascendência, árvore da fase e checklist
- Árvore de passivas interativa (zoom/pan/pinça, busca, nodes novos da fase destacados, weapon sets)
- **Modo jogando**: uma tela compacta só com a fase atual (fica salva no navegador)
- Várias builds e vários patches (versões antigas ficam com aviso de desatualizada)

Primeira build: **Monk · Martial Artist — Hollow Form Whirling Assault** (0.5.5, Forbidden Rites).

## Rodar local (editando)

```bash
npm install
npm run dev
```

Abre em http://localhost:4321 — e no celular pelo IP do PC na mesma rede (o dev server escuta na rede local).
Detalhes de dados, scripts e fluxo de patch no [CLAUDE.md](CLAUDE.md).

## Rodar no homelab

Sem deploy público: o site é estático e roda em qualquer máquina da casa.

**Com Docker (recomendado):**

```bash
git clone https://github.com/Espakki/planner-poe2.git
cd planner-poe2
docker compose up -d --build
```

Fica em `http://<ip-do-homelab>:8080` (outra porta: `PLANNER_PORT=9090` no `.env` da stack).
Pra atualizar depois de mudar a build: `git pull && docker compose up -d --build`.

**Com Dockge:** clone dentro da pasta de stacks (padrão `/opt/stacks`) — o `compose.yaml` está na raiz do repo, então a stack
`planner-poe2` aparece sozinha no Dockge. Primeiro "Deploy" gera a imagem; depois de `git pull`, "Deploy" de novo reconstrói.
O build da imagem roda o `npm run check` antes — se algum dado estiver quebrado, a imagem não é gerada e o site antigo continua no ar.

**Sem Docker (Node 22+):**

```bash
npm ci
npm run serve
```

Faz check + build e serve em `http://<ip>:8080`. Ou copie a pasta `dist/` (de `npm run build`) pra qualquer servidor web (nginx, Caddy…).

Atrás de um proxy reverso num subcaminho (ex.: `/poe/`)? Gere com `BASE_PATH=/poe` (no `compose.yaml`, em `build.args`).

---

Site de fã não oficial. Ícones e nomes © Grinding Gear Games. Árvore: dados do Path of Building Community.
