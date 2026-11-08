/** Utilitários comuns dos scripts (Node 22+, roda .ts direto via type stripping). */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const P = {
  entities: path.join(ROOT, 'src', 'content', 'entities'),
  builds: path.join(ROOT, 'src', 'content', 'builds'),
  icons: path.join(ROOT, 'public', 'icons'),
  treePublic: path.join(ROOT, 'public', 'tree'),
  treeData: path.join(ROOT, 'data', 'tree'),
  logs: path.join(ROOT, 'data', 'logs'),
  cache: path.join(ROOT, '.cache'),
};

export const USER_AGENT = 'plan-poe/0.1 (site pessoal de builds; github.com/Espakki)';

export async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, 'utf8')) as T;
}

export async function writeJson(file: string, data: unknown, pretty = true) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data, null, pretty ? 2 : 0) + (pretty ? '\n' : ''), 'utf8');
}

export async function listJson(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  return (await readdir(dir)).filter((f) => f.endsWith('.json')).sort();
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchWithRetry(url: string, init: RequestInit = {}, tries = 3): Promise<Response> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: { 'User-Agent': USER_AGENT, ...(init.headers ?? {}) },
      });
      if (res.status === 429 || res.status >= 500) {
        last = new Error(`HTTP ${res.status} em ${url}`);
        await sleep(1500 * (i + 1));
        continue;
      }
      return res;
    } catch (e) {
      last = e;
      await sleep(1500 * (i + 1));
    }
  }
  throw last;
}

/** Lê `--chave valor` e `--flag` de process.argv. */
export function args(): Record<string, string | true> {
  const out: Record<string, string | true> = {};
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i++) {
    if (!a[i].startsWith('--')) continue;
    const key = a[i].slice(2);
    const next = a[i + 1];
    if (next && !next.startsWith('--')) {
      out[key] = next;
      i++;
    } else out[key] = true;
  }
  return out;
}

export const c = {
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};
