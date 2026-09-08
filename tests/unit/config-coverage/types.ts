/**
 * Types for the tenant config coverage map.
 *
 * The map is data. It asserts nothing about the app; it records, per value a
 * tenant can configure, whether a test asserts the app's behaviour for that
 * value — and when none does, why not.
 */

import type {
  PublicTenantConfig,
  ThemeColors,
} from '~~/shared/types/tenant-config';
import type { CmsSlotKey } from '~~/shared/types/cms-slots';
import type { CmsMenuKey } from '~~/shared/constants/cms';

/**
 * A pointer into the suite. `title` is a `describe` or `it` title copied
 * verbatim; map.test.ts checks that the file exists and contains the title,
 * so a rename or a move turns red instead of rotting.
 */
export interface TestRef {
  /** Repo-relative path, e.g. `tests/composables/useTenant.test.ts`. */
  spec: string;
  /** A `describe` or `it` title inside that file, verbatim. */
  title: string;
}

/**
 * Why a value is or is not covered.
 *
 * `no-consumer` and `no-test` are deliberately separate. They lead to
 * different work: the first is a question about whether the field should
 * exist at all, the second is a test someone writes against a consumer that
 * already exists. A single `no-test` flag would send both to the same place.
 */
export type Coverage =
  /**
   * A test names this value. What is verified is that the spec and the title
   * exist — not that the assertion inside is correct or asserts the right
   * thing. The status says what is known, and no more.
   */
  | { status: 'has-test'; test: TestRef; note?: string }
  /**
   * Nothing in `app/` or `server/` reads this value. An optional `test` records
   * a transport assertion where one exists — the value is carried and merged
   * with proof, just never read.
   */
  | { status: 'no-consumer'; note: string; test?: TestRef }
  /** A consumer exists, named as `file:line`, and no test asserts it. */
  | { status: 'no-test'; consumer: string; note: string };

/**
 * The three states an optional string field can arrive in. Absent and empty
 * are not the same thing: `??` fallbacks do not fire on `''` and `||` ones do,
 * and both operators are in use here.
 */
export type StringState = 'absent' | 'empty' | 'set';

/** The operator a consumer falls back with — what makes `empty` distinct. */
export type FallbackOperator = '??' | '||' | 'none';

export interface StringFieldCoverage {
  fallback: FallbackOperator;
  states: Record<StringState, Coverage>;
}

/**
 * The 40 keys `ThemeColorsSchema` names, taken from the schema rather than
 * from `TenantConfig['theme']['colors']` — the latter is `Record<string, …>`
 * and cannot be made total.
 */
export type ThemeColorKey = keyof ThemeColors;

/**
 * The 14 feature keys seeded for every tenant. Derived from the defaults
 * object literal rather than declared here, so a fifteenth feature fails
 * `pnpm typecheck` the day it is seeded.
 */
export type FeatureKey =
  keyof (typeof import('~~/server/utils/storefront-settings-defaults'))['STOREFRONT_SETTINGS_DEFAULTS']['features'];

export interface FeatureCoverage {
  enabled: Record<'true' | 'false', Coverage>;
  /** `undefined` is a third case and it means open to everyone. */
  access: Record<'all' | 'authenticated' | 'absent', Coverage>;
}

/**
 * Every nested level below is a mapped type over that level's own `keyof`,
 * never a hand-written list of sub-keys. A hand-written list is total on the
 * day it is written and silently partial after that: a key added to
 * `branding` or `seo` would slip through while the top level kept passing —
 * and a new config field is almost always a sub-key, rarely a nineteenth
 * top-level field.
 *
 * The nesting is written out per level rather than as a generic recursion,
 * because the leaf shape cannot be derived from the leaf type: a union wants
 * `Record<value, Coverage>`, an optional string wants its three states, a
 * scalar wants a bare `Coverage`. The depth is at most three, and each level
 * says which is which.
 */

type Theme = NonNullable<PublicTenantConfig['theme']>;
type Typography = NonNullable<Theme['typography']>;
type Branding = NonNullable<PublicTenantConfig['branding']>;
type Layout = NonNullable<PublicTenantConfig['layout']>;
type Cms = NonNullable<PublicTenantConfig['cms']>;
type Seo = NonNullable<PublicTenantConfig['seo']>;
type Contact = NonNullable<PublicTenantConfig['contact']>;
type Address = NonNullable<Contact['address']>;
type Social = NonNullable<Contact['social']>;

/**
 * Whether the block arrives at all is one behaviour — it decides if a fonts
 * stylesheet is emitted — and each family inside it is another.
 */
export interface TypographyCoverage {
  presence: Record<'present' | 'absent', Coverage>;
  families: { [K in keyof Typography]-?: Coverage };
}

export type ThemeCoverage = {
  [K in keyof Theme]-?: K extends 'colors'
    ? Record<ThemeColorKey, Coverage>
    : K extends 'typography'
      ? TypographyCoverage
      : Coverage;
};

export type BrandingCoverage = {
  [K in keyof Branding]-?: K extends 'watermark'
    ? Record<NonNullable<Branding['watermark']>, Coverage>
    : K extends 'name'
      ? Coverage
      : StringFieldCoverage;
};

export type LayoutCoverage = {
  [K in keyof Layout]-?: K extends 'headerNavVariant'
    ? Record<NonNullable<Layout['headerNavVariant']> | 'absent', Coverage>
    : Coverage;
};

export type CmsCoverage = {
  [K in keyof Cms]-?: K extends 'slots'
    ? Record<CmsSlotKey, Coverage>
    : K extends 'menus'
      ? Record<CmsMenuKey, Coverage>
      : Coverage;
};

export type SeoCoverage = {
  // `defaultKeywords` is an array, guarded on length rather than on a
  // fallback, so the three string states do not apply to it.
  [K in keyof Seo]-?: K extends 'defaultKeywords'
    ? Coverage
    : StringFieldCoverage;
};

export type ContactCoverage = {
  [K in keyof Contact]-?: K extends 'address'
    ? { [A in keyof Address]-?: Coverage }
    : K extends 'social'
      ? { [S in keyof Social]-?: Coverage }
      : StringFieldCoverage;
};

/**
 * The shape of each field's entry. The conditional picks a precise shape per
 * known key and falls through to a single `Coverage` for identity fields, so
 * a field added to `PublicTenantConfig` tomorrow still requires an entry.
 */
type FieldCoverage<K extends keyof PublicTenantConfig> = K extends 'mode'
  ? Record<PublicTenantConfig['mode'], Coverage>
  : K extends 'checkoutMode'
    ? Record<PublicTenantConfig['checkoutMode'], Coverage>
    : K extends 'theme'
      ? ThemeCoverage
      : K extends 'branding'
        ? BrandingCoverage
        : K extends 'layout'
          ? LayoutCoverage
          : K extends 'features'
            ? Record<FeatureKey, FeatureCoverage>
            : K extends 'cms'
              ? CmsCoverage
              : K extends 'seo'
                ? SeoCoverage
                : K extends 'contact'
                  ? ContactCoverage
                  : K extends 'isActive'
                    ? Record<'true' | 'false', Coverage>
                    : Coverage;

/**
 * The totality contract. `-?` strips optionality, so the eight optional fields
 * of `PublicTenantConfig` are as required here as the rest — this is the
 * `Record<keyof PublicTenantConfig, …>` the ADR calls for, with a per-key
 * shape instead of one loose union.
 */
export type ConfigCoverageMap = {
  [K in keyof PublicTenantConfig]-?: FieldCoverage<K>;
};
