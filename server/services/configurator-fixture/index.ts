import { randomUUID } from 'node:crypto';
import type {
  CommittedConfiguration,
  Configuration,
  ConfigurationChange,
  CreateConfigurationInput,
} from '#shared/types/configurator';
import type {
  ConfigurableCandidate,
  ConfiguratorBackend,
  ConfiguratorContext,
  ConfiguredCartLine,
} from '../configurator';
import { applyChangeBatch } from './changes';
import { cloneSessionState, createSessionState, evaluate } from './evaluate';
import { findSeed } from './seed';
import { createSessionStore, type StoredSession } from './store';
import { buildSummary } from './summary';

// ---------------------------------------------------------------------------
// Fixture backend.
//
// A small in-memory stand-in for the CPQ service: start a session, post every
// choice as a batch, get the whole re-evaluated document back. It exists so the
// portal can build routes and UI against the real flow before the SDK can reach
// the service, and it is meant to be deleted whole when the SDK lands. No Geins
// SDK import belongs in this folder.
// ---------------------------------------------------------------------------

/** How long a session lives from its last change. */
export const SESSION_MINUTES = 20;

/** How long a finished session answers 410 before the id goes back to 404. */
export const DEPARTED_RETENTION_HOURS = 24;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export interface FixtureConfiguratorBackend extends ConfiguratorBackend {
  /**
   * Whether the id is one of this fixture's sessions, finished ones included.
   * The composite backend routes an id-only call by it, so it answers and
   * never throws.
   */
  owns(id: string, ctx: ConfiguratorContext): boolean;
  /** What a committed configuration froze, for a cart line to read back. */
  readCommitted(
    id: string,
    ctx: ConfiguratorContext,
  ): CommittedConfiguration | undefined;
  /** Whether the cart line is one this fixture added, so it can reopen it. */
  ownsLine(cartId: string, itemId: string, ctx: ConfiguratorContext): boolean;
}

export function createFixtureConfiguratorBackend({
  now = Date.now,
}: { now?: () => number } = {}): FixtureConfiguratorBackend {
  const store = createSessionStore(now, DEPARTED_RETENTION_HOURS * HOUR);
  const committed = new Map<string, CommittedConfiguration>();
  /** The state each record was committed from, so a line can be reopened. */
  const committedStates = new Map<
    string,
    Pick<StoredSession, 'seed' | 'state'>
  >();
  /** Which record each added line carries: `hostname|cartId|itemId`. */
  const lines = new Map<string, string>();
  const lineKey = (ctx: ConfiguratorContext, cartId: string, itemId: string) =>
    `${ctx.hostname}|${cartId}|${itemId}`;

  const expiry = () => now() + SESSION_MINUTES * MINUTE;

  const identityOf = (id: string, session: StoredSession) => ({
    configurationId: id,
    expiresAt: new Date(session.expiresAt).toISOString(),
  });

  const documentOf = (id: string, session: StoredSession): Configuration =>
    evaluate(session.seed, session.state, identityOf(id, session));

  return {
    // The fixture is one catalogue for every tenant, so the context is not
    // read here; the seam passes it because a backend that asks the platform
    // will need it. The type is not read either: the seeds stand for ordinary
    // catalogue products, typed `"product"`.
    isConfigurable({ productId }: ConfigurableCandidate): boolean {
      return findSeed(productId) !== undefined;
    },

    async create(
      input: CreateConfigurationInput,
      ctx: ConfiguratorContext,
    ): Promise<Configuration> {
      const seed = findSeed(input.productId);
      if (!seed) {
        throw createAppError(
          ErrorCode.NOT_FOUND,
          `'${input.productId}' is not a configurable product`,
        );
      }

      const id = randomUUID();
      const session: StoredSession = {
        seed,
        state: createSessionState(input.quantity),
        expiresAt: expiry(),
      };
      store.put(ctx.hostname, id, session);
      return documentOf(id, session);
    },

    async get(id: string, ctx: ConfiguratorContext): Promise<Configuration> {
      return documentOf(id, store.require(ctx.hostname, id));
    },

    async applyChanges(
      id: string,
      changes: ConfigurationChange[],
      ctx: ConfiguratorContext,
    ): Promise<Configuration> {
      const session = store.require(ctx.hostname, id);
      session.state = applyChangeBatch(
        session.seed,
        session.state,
        identityOf(id, session),
        changes,
      );
      session.expiresAt = expiry();
      return documentOf(id, session);
    },

    async renew(
      id: string,
      ctx: ConfiguratorContext,
    ): Promise<{ expiresAt: string }> {
      const session = store.require(ctx.hostname, id);
      session.expiresAt = expiry();
      return { expiresAt: new Date(session.expiresAt).toISOString() };
    },

    async release(id: string, ctx: ConfiguratorContext): Promise<void> {
      store.require(ctx.hostname, id).departedAt = now();
    },

    async commit(
      id: string,
      ctx: ConfiguratorContext,
    ): Promise<CommittedConfiguration> {
      const session = store.require(ctx.hostname, id);
      const config = documentOf(id, session);
      if (!config.isValid) {
        throw createAppError(
          ErrorCode.VALIDATION_ERROR,
          'The configuration is not complete',
        );
      }

      const record: CommittedConfiguration = {
        committedConfigurationId: randomUUID(),
        configurationId: id,
        articleNumber: config.articleNumber,
        quantity: config.quantity,
        // Frozen: the session departs with this call, so nothing can move the
        // price under a cart line that references the record.
        unitPrice: config.unitPrice,
        discountPercent: config.discountPercent,
        weightPerUnit: config.weightPerUnit,
        summary: buildSummary(config, session.seed),
      };
      const key = `${ctx.hostname}|${record.committedConfigurationId}`;
      committed.set(key, record);
      committedStates.set(key, {
        seed: session.seed,
        state: cloneSessionState(session.state),
      });
      session.departedAt = now();
      return record;
    },

    // There is no configured cart behind the fixture, so the line goes in as a
    // plain one: what the buyer sees is the SKU, at its catalogue price.
    async addToCart(
      cartId: string,
      line: ConfiguredCartLine,
      ctx: ConfiguratorContext,
    ): Promise<{ itemId: string | null }> {
      const key = `${ctx.hostname}|${line.committedConfigurationId}`;
      if (!committed.has(key)) {
        throw createAppError(
          ErrorCode.NOT_FOUND,
          'No such committed configuration',
        );
      }
      if (!ctx.cart) {
        throw createAppError(
          ErrorCode.INTERNAL_ERROR,
          'The configurator context carries no cart',
        );
      }
      const cart = await ctx.cart.addPlainItem(cartId, {
        skuId: line.skuId,
        quantity: line.quantity,
      });
      // A plain add of a SKU already in the cart lands on that line, which then
      // reopens as the latest configuration added to it.
      const itemId =
        cart.items?.find((item) => item.skuId === line.skuId)?.id ?? null;
      if (itemId) lines.set(lineKey(ctx, cartId, itemId), key);
      return { itemId };
    },

    async reopen(
      cartId: string,
      itemId: string,
      ctx: ConfiguratorContext,
    ): Promise<Configuration> {
      const from = committedStates.get(
        lines.get(lineKey(ctx, cartId, itemId)) ?? '',
      );
      if (!from) {
        throw createAppError(
          ErrorCode.NOT_FOUND,
          'No configured line to reopen',
        );
      }
      const id = randomUUID();
      const session: StoredSession = {
        seed: from.seed,
        state: cloneSessionState(from.state),
        expiresAt: expiry(),
      };
      store.put(ctx.hostname, id, session);
      return documentOf(id, session);
    },

    // Its lines are plain lines in the cart, which carry no configuration.
    async cartLineConfigurations() {
      return new Map();
    },

    // So are the rows of an order placed from them.
    async orderLineConfigurations() {
      return new Map();
    },

    ownsLine(cartId: string, itemId: string, ctx: ConfiguratorContext) {
      return lines.has(lineKey(ctx, cartId, itemId));
    },

    owns(id: string, ctx: ConfiguratorContext): boolean {
      return store.has(ctx.hostname, id);
    },

    readCommitted(id: string, ctx: ConfiguratorContext) {
      return committed.get(`${ctx.hostname}|${id}`);
    },
  };
}

/** The instance the seam hands out, on the real clock. */
export const fixtureConfiguratorBackend: FixtureConfiguratorBackend =
  createFixtureConfiguratorBackend();
