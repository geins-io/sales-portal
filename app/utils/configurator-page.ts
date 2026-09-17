import type {
  CommittedConfiguration,
  Configuration,
} from '#shared/types/configurator';
import type {
  ConfiguratorSessionError,
  ConfiguratorSessionStatus,
} from '~/composables/useConfiguratorSession';

// ---------------------------------------------------------------------------
// What the configurator page shows, and what the buyer may do.
//
// In a .ts rather than in the page for the reason the rest of the configurator
// keeps its rules out of templates: Stryker instruments a file before the Vue
// compiler runs, so a condition written in a template is one nothing proves.
// ---------------------------------------------------------------------------

/** The verbs the page calls, so a failure can be told apart afterwards. */
export type ConfiguratorAction = 'start' | 'change' | 'renew' | 'commit';

export type ConfiguratorStage =
  | 'committed'
  | 'expired'
  | 'form'
  | 'error'
  | 'loading';

export interface ConfiguratorPageState {
  status: ConfiguratorSessionStatus;
  configuration: Configuration | null;
  committed: CommittedConfiguration | null;
  error: ConfiguratorSessionError | null;
}

/**
 * Which of the five faces of this page is on screen.
 *
 * Two rows are worth reading twice. A `closed` session with nothing committed
 * is the instant between `release()` and `start()` during a restart, and
 * `loading` is what belongs there. An error while a document is held stays on
 * the form: a change batch failed, and the document the buyer is looking at is
 * still the last thing the provider said.
 */
export function configuratorStage(
  state: ConfiguratorPageState,
): ConfiguratorStage {
  if (state.committed) return 'committed';
  if (state.status === 'expired') return 'expired';
  if (state.configuration && state.status === 'active') return 'form';
  if (state.error) return 'error';
  return 'loading';
}

/**
 * `isValid` is compared to `true` rather than read for truthiness: it comes off
 * the wire, and anything else that arrives is drift that must not enable the
 * one irreversible action on the page.
 */
export function canCommit(
  state: Pick<ConfiguratorPageState, 'status' | 'configuration'> & {
    busy: boolean;
  },
): boolean {
  return (
    state.status === 'active' &&
    state.configuration?.isValid === true &&
    !state.busy
  );
}

/**
 * The error the header may render, which is only ever a failed renew.
 *
 * The session holds one `error` for every verb, and the header's message names
 * renew. Once the page posts change batches and commits through the same ref, a
 * failed batch would tell a buyer their session could not be extended. So the
 * page remembers which verb it called and answers this question for the header;
 * every other failure is rendered by the page itself.
 */
export function headerError(
  lastAction: ConfiguratorAction,
  error: ConfiguratorSessionError | null,
): ConfiguratorSessionError | null {
  return lastAction === 'renew' ? error : null;
}
