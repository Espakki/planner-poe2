/**
 * Decodificação de códigos do Path of Building (PoE2) — roda no Node (build/scripts).
 * Código PoB = base64 url-safe → zlib inflate → XML.
 * Lemos só o que o site usa: <Build>, cada <Spec> (nodes, weapon sets, classe),
 * <Skills> (gemas por grupo) e itens por slot.
 */
import { inflateSync } from 'node:zlib';

export interface PobSpec {
  title: string;
  treeVersion: string;
  classId: number;
  ascendClassId: number;
  nodes: number[];
  ws1: number[];
  ws2: number[];
}

export interface PobGem {
  nameSpec: string;
  gemId: string;
  skillId: string;
  level: number;
  quality: number;
  enabled: boolean;
}

export interface PobSkillGroup {
  label: string;
  enabled: boolean;
  gems: PobGem[];
}

export interface PobBuild {
  className: string;
  ascendClassName: string;
  level: number;
  specs: PobSpec[];
  skillSets: { title: string; groups: PobSkillGroup[] }[];
  /** slot → primeira linha útil do item (nome) e raridade. */
  items: { slot: string; rarity: string; name: string; base: string }[];
}

export function decodePobCode(code: string): string {
  const clean = code.trim().replace(/\s+/g, '');
  const b64 = clean.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  return inflateSync(Buffer.from(padded, 'base64')).toString('utf8');
}

function attr(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? decodeXml(m[1]) : undefined;
}

function decodeXml(s: string) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

const nums = (s: string | undefined) =>
  (s ?? '')
    .split(',')
    .map((x) => Number.parseInt(x, 10))
    .filter((n) => Number.isFinite(n) && n > 0);

export function parsePobXml(xml: string): PobBuild {
  const buildTag = xml.match(/<Build\s[^>]*>/)?.[0] ?? '';
  const specs: PobSpec[] = [];
  for (const m of xml.matchAll(/<Spec\s([^>]*?)(\/>|>([\s\S]*?)<\/Spec>)/g)) {
    const tag = `<Spec ${m[1]}>`;
    const body = m[3] ?? '';
    specs.push({
      title: attr(tag, 'title') ?? `Spec ${specs.length + 1}`,
      treeVersion: attr(tag, 'treeVersion') ?? '',
      classId: Number(attr(tag, 'classId') ?? 0),
      ascendClassId: Number(attr(tag, 'ascendClassId') ?? 0),
      nodes: nums(attr(tag, 'nodes')),
      ws1: nums(body.match(/<WeaponSet1\s+nodes="([^"]*)"/)?.[1]),
      ws2: nums(body.match(/<WeaponSet2\s+nodes="([^"]*)"/)?.[1]),
    });
  }

  const skillSets: PobBuild['skillSets'] = [];
  const skillsBlock = xml.match(/<Skills[\s\S]*?<\/Skills>/)?.[0] ?? '';
  const setMatches = [...skillsBlock.matchAll(/<SkillSet\s([^>]*)>([\s\S]*?)<\/SkillSet>/g)];
  const sets = setMatches.length ? setMatches.map((m) => ({ tag: `<x ${m[1]}>`, body: m[2] })) : [{ tag: '', body: skillsBlock }];
  for (const s of sets) {
    const groups: PobSkillGroup[] = [];
    for (const g of s.body.matchAll(/<Skill\s([^>]*)>([\s\S]*?)<\/Skill>/g)) {
      const tag = `<x ${g[1]}>`;
      const gems: PobGem[] = [];
      for (const gm of g[2].matchAll(/<Gem\s[^>]*\/?>/g)) {
        const gt = gm[0];
        gems.push({
          nameSpec: attr(gt, 'nameSpec') ?? '',
          gemId: attr(gt, 'gemId') ?? '',
          skillId: attr(gt, 'skillId') ?? '',
          level: Number(attr(gt, 'level') ?? 1),
          quality: Number(attr(gt, 'quality') ?? 0),
          enabled: attr(gt, 'enabled') !== 'false',
        });
      }
      groups.push({ label: attr(tag, 'label') ?? '', enabled: attr(tag, 'enabled') !== 'false', gems });
    }
    skillSets.push({ title: attr(s.tag, 'title') ?? 'Default', groups });
  }

  const itemById = new Map<string, { rarity: string; name: string; base: string }>();
  for (const m of xml.matchAll(/<Item\s+id="(\d+)"[^>]*>([\s\S]*?)<\/Item>/g)) {
    const lines = m[2]
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('<'));
    const rarity = (lines[0] ?? '').replace('Rarity: ', '');
    itemById.set(m[1], { rarity, name: lines[1] ?? '', base: lines[2] ?? '' });
  }
  const items: PobBuild['items'] = [];
  for (const m of xml.matchAll(/<Slot\s[^>]*itemId="(\d+)"[^>]*name="([^"]*)"/g)) {
    if (m[1] === '0') continue;
    const it = itemById.get(m[1]);
    if (it) items.push({ slot: m[2], ...it });
  }

  return {
    className: attr(buildTag, 'className') ?? '',
    ascendClassName: attr(buildTag, 'ascendClassName') ?? '',
    level: Number(attr(buildTag, 'level') ?? 0),
    specs,
    skillSets,
    items,
  };
}

export function parsePobCode(code: string): PobBuild {
  return parsePobXml(decodePobCode(code));
}
