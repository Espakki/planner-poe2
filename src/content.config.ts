import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { buildSchema, gemSchema, itemSchema, passiveSchema } from './lib/schemas.ts';

const items = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/entities/items' }),
  schema: itemSchema,
});

const gems = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/entities/gems' }),
  schema: gemSchema,
});

const passives = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/entities/passives' }),
  schema: passiveSchema,
});

/** Uma entrada por build por patch: id = "<slug>/<patch>". */
const builds = defineCollection({
  loader: glob({ pattern: '*/*.yaml', base: './src/content/builds' }),
  schema: buildSchema,
});

export const collections = { items, gems, passives, builds };
