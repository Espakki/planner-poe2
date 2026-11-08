/** Leitura do conteúdo (entities + builds) fora do Astro, pros scripts. */
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { P, listJson, readJson } from './util.ts';

export type EntityType = 'items' | 'gems' | 'passives';
export const ENTITY_TYPES: EntityType[] = ['items', 'gems', 'passives'];

export interface EntityFile<T = Record<string, unknown>> {
  type: EntityType;
  id: string;
  file: string;
  data: T;
}

export async function loadEntities<T = Record<string, unknown>>(type: EntityType): Promise<EntityFile<T>[]> {
  const dir = path.join(P.entities, type);
  const files = await listJson(dir);
  return Promise.all(
    files.map(async (f) => ({
      type,
      id: f.replace(/\.json$/, ''),
      file: path.join(dir, f),
      data: await readJson<T>(path.join(dir, f)),
    })),
  );
}

export interface BuildFile {
  slug: string;
  patch: string;
  file: string;
  dir: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

export async function loadBuilds(): Promise<BuildFile[]> {
  if (!existsSync(P.builds)) return [];
  const out: BuildFile[] = [];
  for (const slug of await readdir(P.builds)) {
    const dir = path.join(P.builds, slug);
    if (!existsSync(dir) || slug.startsWith('.')) continue;
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      continue;
    }
    for (const f of entries.filter((x) => x.endsWith('.yaml'))) {
      const file = path.join(dir, f);
      out.push({ slug, patch: f.replace(/\.yaml$/, ''), file, dir, data: parseYaml(await readFile(file, 'utf8')) });
    }
  }
  return out;
}

/** Todas as referências de gema/item/passiva feitas por uma build, com o caminho onde aparecem. */
export function collectRefs(build: BuildFile) {
  const gems: { id: string; where: string }[] = [];
  const items: { id: string; where: string }[] = [];
  const passives: { id: string; where: string }[] = [];
  const d = build.data ?? {};
  const pushSetup = (s: { gem?: string; supports?: string[] }, where: string) => {
    if (s?.gem) gems.push({ id: s.gem, where });
    for (const sup of s?.supports ?? []) gems.push({ id: sup, where: `${where} (suporte)` });
  };
  (d.phases ?? []).forEach((ph: any, i: number) => {
    const w = `phases[${i}] ${ph?.id ?? ''}`;
    (ph?.skills ?? []).forEach((s: any) => pushSetup(s, `${w}.skills`));
    (ph?.spirit ?? []).forEach((s: any) => pushSetup(s, `${w}.spirit`));
    (ph?.items ?? []).forEach((it: any) => it?.item && items.push({ id: it.item, where: `${w}.items` }));
    for (const p of ph?.ascendancy?.take ?? []) passives.push({ id: p, where: `${w}.ascendancy.take` });
    for (const p of ph?.ascendancy?.refund ?? []) passives.push({ id: p, where: `${w}.ascendancy.refund` });
  });
  (d.spirit ?? []).forEach((s: any) => pushSetup(s, 'spirit'));
  (d.ascendancyOrder ?? []).forEach((a: any) => a?.passive && passives.push({ id: a.passive, where: 'ascendancyOrder' }));
  return { gems, items, passives };
}

export const kebab = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
