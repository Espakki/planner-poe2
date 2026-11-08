// @ts-check
import { defineConfig } from 'astro/config';

// O site roda na raiz ("/") por padrão — local ou no homelab.
// Se um dia ficar atrás de um subcaminho (ex.: proxy em /poe/), use BASE_PATH=/poe no build.
const base = process.env.BASE_PATH ?? '/';
const site = process.env.SITE_URL || undefined;

export default defineConfig({
  site,
  base,
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
  },
  server: {
    // escuta na rede local (pra abrir do celular no mesmo Wi-Fi)
    host: true,
  },
  devToolbar: { enabled: false },
});
