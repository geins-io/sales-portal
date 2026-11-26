/**
 * Build-time trim of an Iconify icon set for `icon.serverBundle` in
 * nuxt.config.ts. Material Symbols holds 16,000+ icons in every style; the USP
 * block only ever asks for the rounded outline one.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

interface IconData {
  body: string;
  [key: string]: unknown;
}

interface IconAlias {
  parent: string;
  [key: string]: unknown;
}

/** The part of Iconify's JSON format this reads and writes. */
export interface IconSet {
  prefix: string;
  icons: Record<string, IconData>;
  aliases?: Record<string, IconAlias>;
  width?: number;
  height?: number;
}

const OUTLINE_ROUNDED = '-outline-rounded';
const ROUNDED = '-rounded';

/**
 * The `-outline-rounded` icons and aliases, with what they point at. Where an
 * icon's outline and filled forms are one drawing, the set has only
 * `X-rounded`; an alias `X-outline-rounded → X-rounded` keeps the name working.
 */
export function outlineRoundedSubset(set: IconSet): IconSet {
  const aliases = set.aliases ?? {};
  const has = (name: string) => name in set.icons || name in aliases;
  const subset: IconSet = {
    prefix: set.prefix,
    icons: {},
    aliases: {},
    width: set.width,
    height: set.height,
  };

  function keep(name: string) {
    let current: string | undefined = name;
    while (current !== undefined) {
      const icon = set.icons[current];
      if (icon) {
        subset.icons[current] = icon;
        return;
      }
      const alias: IconAlias | undefined = aliases[current];
      if (!alias) return;
      subset.aliases![current] = alias;
      current = alias.parent;
    }
  }

  for (const name of [...Object.keys(set.icons), ...Object.keys(aliases)]) {
    if (name.endsWith(OUTLINE_ROUNDED)) {
      keep(name);
    } else if (name.endsWith(ROUNDED)) {
      const outline = name.slice(0, -ROUNDED.length) + OUTLINE_ROUNDED;
      if (!has(outline)) {
        subset.aliases![outline] = { parent: name };
        keep(name);
      }
    }
  }
  return subset;
}

/** An installed `@iconify-json/<name>` set. */
export function readIconSet(name: string): IconSet {
  const path = createRequire(import.meta.url).resolve(
    `@iconify-json/${name}/icons.json`,
  );
  return JSON.parse(readFileSync(path, 'utf8')) as IconSet;
}
