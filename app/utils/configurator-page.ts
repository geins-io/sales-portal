import type {
  CommittedConfiguration,
  Configuration,
  ConfigurationChange,
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

/**
 * The copy for a failure the page renders itself. A 403 is the provider's
 * `MissingCustomerNumber`: the buyer is signed out, or their company has no
 * customer number, and either way a company account is what fixes it.
 */
export function failureKey(
  error: ConfiguratorSessionError | null,
): 'configurator.sign_in_required' | 'configurator.failed' {
  return error?.status === 403
    ? 'configurator.sign_in_required'
    : 'configurator.failed';
}

/**
 * The change the provider refused, when the last change batch was refused.
 *
 * The page sends one change per batch, so a refusal is always about the change
 * it sent last. The status alone does not say the provider refused: the code
 * does, and survives the production error body. A quantity change has no node
 * on the form to carry the message, so it stays a general failure.
 */
export function refusedChange(
  lastAction: ConfiguratorAction,
  error: ConfiguratorSessionError | null,
  lastChange: ConfigurationChange | null,
): ConfigurationChange | null {
  if (lastAction !== 'change' || lastChange?.type === 'quantity') return null;
  return error?.status === 422 && error.code === 'VALIDATION_ERROR'
    ? lastChange
    : null;
}

/**
 * The failure the page writes above the form: anything on the form that is
 * neither the header's failed renew nor a refusal, which its own node shows.
 */
export function formError(
  lastAction: ConfiguratorAction,
  stage: ConfiguratorStage,
  error: ConfiguratorSessionError | null,
  refused: ConfigurationChange | null,
): ConfiguratorSessionError | null {
  if (stage !== 'form' || lastAction === 'renew' || refused) return null;
  return error;
}

/** `lg:top-48`, where the box sticks, and Tailwind's `lg` breakpoint. */
const STICKY_TOP_PX = 192;
const LG_PX = 1024;

/**
 * How tall the sticky right column may be, as the prototype measures it: the
 * viewport under the sticky offset, but never past the bottom of the left
 * column. A fixed `calc` lets the grid end under a box that is still the
 * viewport's height, and the box then slides up under the header with the
 * price and the action on it. Below lg the box stacks and has no cap.
 */
export function stickyBoxMaxHeight({
  viewportWidth,
  viewportHeight,
  leftBottom,
}: {
  viewportWidth: number;
  viewportHeight: number;
  leftBottom: number;
}): string | undefined {
  if (viewportWidth < LG_PX) return undefined;
  const bottom = Math.min(viewportHeight - 16, leftBottom);
  return `${Math.max(240, bottom - STICKY_TOP_PX)}px`;
}
