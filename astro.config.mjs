// @ts-check
import { defineConfig } from 'astro/config';

// No GitHub Pages o site fica em https://<user>.github.io/<repo>/.
// O workflow de deploy define BASE_PATH=/<repo>; localmente fica "/".
const base = process.env.BASE_PATH ?? '/';
const site = process.env.SITE_URL ?? 'https://espakki.github.io';

export default defineConfig({
  site,
  base,
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
  },
  devToolbar: { enabled: false },
});
