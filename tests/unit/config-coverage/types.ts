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
 * What a referenced test proves about the value it is hung on.
 *
 *   - `carrier` — the value arrives, survives, or is returned unchanged:
 *     schema validation, the merge in `buildTenantConfig`, a getter.
 *   - `reader` — a shared mechanism between the config and the consumer
 *     produces a different result per value: `hasFeature`, `canAccess`,
 *     `isCatalogMode`, the fonts-URL builder.
 *   - `consumer` — the code the map names as this value's consumer does
 *     something different: a component, an endpoint, middleware, the CSS
 *     emitter.
 */
export type TestRefKind = 'carrier' | 'reader' | 'consumer';

/**
 * How deep a `consumer` test's fixture goes.
 *
 *   - `field` — the consumer receives the configured value itself: a config
 *     fixture, or a mocked getter returning the value. A prop counts only when
 *     the named consumer is the component that reads the config into that
 *     prop and the test drives it through the config. `PoweredBy` is the
 *     counter-example: its tests pass `variant` as a prop, but the footer
 *     mounts it without one and the component falls back to `watermark.value`
 *     — the tests exercise a path the app never takes, and prove nothing
 *     about the field.
 *   - `reader` — the consumer receives a decision derived from the value and
 *     the stub binds the key: `mockCanAccess.mockImplementation((name) =>
 *     name === 'orderPlacement')`, `mockIsCatalogMode`. The field was never
 *     read, so the test proves decision → behaviour; only a `reader` reference
 *     on the same cell, which proves cell → decision, makes it a claim about
 *     the cell. map.test.ts checks that composition.
 *   - `stub` — the consumer receives a blanket decision that binds no key:
 *     `mockCanAccess.mockReturnValue(true)`, a stubbed visibility composable.
 *     Checked against disk like any reference, never proof for a cell: it
 *     neither satisfies the consumer requirement nor lifts a cell to
 *     `has-test`.
 */
export type ConsumerDrives = 'field' | 'reader' | 'stub';

/**
 * Set by reading what the test executes, never by what the function under
 * test does. Two questions, in order:
 *
 *   1. Would the assertion pass unchanged with a different value in the
 *      field? Yes → `carrier`. Identity, presence and validity are all
 *      `carrier`: "returns 40 keys total" and "should return checkoutMode
 *      from config" both prove the value came back, not that anything acted
 *      on it.
 *   2. Otherwise: is the test's subject the code the map names as the
 *      consumer, or a function between the config and that consumer? The
 *      consumer → `consumer`. In between → `reader`.
 *
 * When the test stubs the reader, question 1 has no answer as written — the
 * field is never read. Ask it of the reader's decision instead, and hang the
 * reference on every cell that produces that decision (`drives: 'reader'`).
 *
 * When neither question decides, the weaker kind wins — `carrier` over
 * `reader`, `reader` over `consumer`. The map may under-claim; it may not
 * over-claim.
 *
 * A kind is a property of the test, so the same (spec, title) carries the
 * same kind on every entry it appears on; map.test.ts checks that.
 */
interface TestRefBase {
  /** Repo-relative path, e.g. `tests/composables/useTenant.test.ts`. */
  spec: string;
  /** A `describe` or `it` title inside that file, verbatim. */
  title: string;
}

/**
 * A pointer into the suite. `title` is a `describe` or `it` title copied
 * verbatim; map.test.ts checks that the file exists and contains the title,
 * so a rename or a move turns red instead of rotting.
 *
 * `kind` is required with no default, so a reference that does not say what
 * it proves fails `pnpm typecheck`. `drives` is required on `consumer` and
 * not allowed on the other two — the union below is what expresses that.
 */
export type TestRef =
  | (TestRefBase & { kind: 'carrier' | 'reader'; drives?: never })
  | (TestRefBase & { kind: 'consumer'; drives: ConsumerDrives });

/**
 * One reference, or several. A value is often read in more than one place —
 * the composable getter that exposes it and the consumers that branch on it —
 * and a single slot would force one to overwrite the other. map.test.ts checks
 * every entry in a list.
 */
export type TestRefs = TestRef | TestRef[];

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
   * A test asserts this value at its consumer: at least one reference is
   * `consumer`, checked in map.test.ts because the type cannot say "one member
   * of this list has this property" without contortion. What is verified is
   * that the spec and the title exist — not that the assertion inside is
   * correct. The status says what is known, and no more.
   */
  | { status: 'has-test'; test: TestRefs; note?: string }
  /**
   * Nothing in `app/` or `server/` reads this value. An optional `test` records
   * a `carrier` assertion where one exists — the value is carried and merged
   * with proof, just never read.
   */
  | { status: 'no-consumer'; note: string; test?: TestRefs }
  /**
   * A consumer exists, named as `file:line`, and no test asserts it there.
   * The optional references say what *is* asserted — a `carrier`, a `reader`,
   * or a `consumer` acting on a stubbed decision that no `reader` reference on
   * this cell binds to the value — so that the status names what is missing
   * and the references what exists.
   */
  | { status: 'no-test'; consumer: string; note: string; test?: TestRefs }
  /**
   * The boundary refuses this state, so no test at the consumer could assert
   * it: the value never arrives in this shape. `consumer` is still named — it
   * is the code that *would* read the value, and what the note refers to.
   *
   * The two `boundary` references are the proof, and they are two because one
   * of them alone is not an argument:
   *
   *   - `rejects` — the schema refuses the value. That says the parse fails,
   *     and nothing about what the app then serves.
   *   - `strips` — the resilient parser drops the failing *leaf* rather than
   *     substituting its branch, so the surrounding fields survive. This is
   *     the leg that decides what a merchant who clears the field actually
   *     gets, and it is the one that goes red if leaf-stripping is ever
   *     swapped for branch substitution.
   *
   * Both are required by the type rather than counted at runtime: a count is
   * a proxy that two schema references would satisfy, and the names say which
   * half each reference carries. An entry missing either leg fails
   * `pnpm typecheck`, the way a missing `note` does.
   *
   * A cell that has only one leg is not `unreachable`. It is `no-test` with a
   * note naming the leg that is missing.
   */
  | {
      status: 'unreachable';
      consumer: string;
      note: string;
      boundary: { rejects: TestRef; strips: TestRef };
    };

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
      ? { [S in keyof Social]-?: StringFieldCoverage }
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
