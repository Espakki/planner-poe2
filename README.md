# Plano PoE2

Site pessoal pra guardar e seguir builds do **Path of Exile 2** enquanto joga — em PT-BR, com os nomes do jogo em inglês.

- Roteiro por fase (nível) com gemas ligadas aos suportes, itens, ascendência, árvore da fase e checklist
- Árvore de passivas interativa (zoom/pan/pinça, busca, nodes novos da fase destacados, weapon sets)
- **Modo jogando**: uma tela compacta só com a fase atual (fica salva no navegador)
- Várias builds e vários patches (versões antigas ficam com aviso de desatualizada)

Primeira build: **Monk · Martial Artist — Hollow Form Whirling Assault** (0.5.5, Forbidden Rites).

## Rodar local

```bash
npm install
npm run dev
```

Abre em http://localhost:4321. Detalhes de dados, scripts e fluxo de patch no [CLAUDE.md](CLAUDE.md).

## Publicar no GitHub Pages

1. Crie um repositório no GitHub (ex.: `plan-poe`) e faça push da branch `main`.
2. No repositório: **Settings → Pages → Source: GitHub Actions**.
3. Cada push na `main` roda `npm run check`, faz o build e publica em `https://<usuario>.github.io/<repo>/`.

---

Site de fã não oficial. Ícones e nomes © Grinding Gear Games. Árvore: dados do Path of Building Community.
