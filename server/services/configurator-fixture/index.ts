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
} from '../configurator';
import { applyChangeBatch } from './changes';
import { createSessionState, evaluate } from './evaluate';
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
  /** What a committed configuration froze, for a cart line to read back. */
  readCommitted(
    id: string,
    ctx: ConfiguratorContext,
  ): CommittedConfiguration | undefined;
}

export function createFixtureConfiguratorBackend({
  now = Date.now,
}: { now?: () => number } = {}): FixtureConfiguratorBackend {
  const store = createSessionStore(now, DEPARTED_RETENTION_HOURS * HOUR);
  const committed = new Map<string, CommittedConfiguration>();

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
        productId: config.productId,
        quantity: config.quantity,
        // Frozen: the session departs with this call, so nothing can move the
        // price under a cart line that references the record.
        unitPrice: config.unitPrice,
        summary: buildSummary(config, session.seed),
      };
      committed.set(
        `${ctx.hostname}|${record.committedConfigurationId}`,
        record,
      );
      session.departedAt = now();
      return record;
    },

    readCommitted(id: string, ctx: ConfiguratorContext) {
      return committed.get(`${ctx.hostname}|${id}`);
    },
  };
}

/** The instance the seam hands out, on the real clock. */
export const fixtureConfiguratorBackend: FixtureConfiguratorBackend =
  createFixtureConfiguratorBackend();
