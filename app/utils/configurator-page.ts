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
export type ConfiguratorAction = 'start' | 'change' | 'commit' | 'add';

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
    /** What the line is added as; a commit with nothing to add would strand it. */
    skuId?: number | null;
  },
): boolean {
  return (
    state.status === 'active' &&
    state.configuration?.isValid === true &&
    !state.busy &&
    state.skuId !== null
  );
}

/**
 * The SKU a configured line is added as: the product's only one. A product with
 * none or several has no answer here, and the page does not guess.
 */
export function configuredSkuId(
  skus: readonly { skuId: number }[],
): number | null {
  return skus.length === 1 ? skus[0]!.skuId : null;
}

/**
 * A held record is one whose add failed (the page always passes an add), so it
 * can be sent again.
 */
export function canRetryAdd(state: {
  committed: CommittedConfiguration | null;
  busy: boolean;
}): boolean {
  return state.committed !== null && !state.busy;
}

/** A failed add, which the committed summary shows, since the form is gone. */
export function addError(
  stage: ConfiguratorStage,
  error: ConfiguratorSessionError | null,
): ConfiguratorSessionError | null {
  return stage === 'committed' ? error : null;
}

/**
 * Whether the committed summary shows the retry: after a failed add, and while
 * a retry runs, so the button does not vanish under the buyer's click. The
 * first add runs before the summary shows, on the action's own spinner.
 */
export function showsAddRetry(state: {
  stage: ConfiguratorStage;
  error: ConfiguratorSessionError | null;
  busy: boolean;
}): boolean {
  return state.stage === 'committed' && (state.error !== null || state.busy);
}

/**
 * The copy for a failed add. `UNAUTHORIZED` is the cart's `LoginRequired`, read
 * by code as `refusedChange` does; a 403 is a signed-in buyer the cart refuses,
 * whom the sign-in copy would mislead. 409 is a line the cart dropped, which it
 * does without an error when stock is short.
 */
export function addFailureKey(
  error: ConfiguratorSessionError | null,
):
  | 'configurator.sign_in_required'
  | 'configurator.add_not_added'
  | 'configurator.add_failed' {
  if (error?.code === 'UNAUTHORIZED') return 'configurator.sign_in_required';
  if (error?.status === 409) return 'configurator.add_not_added';
  return 'configurator.add_failed';
}

/**
 * The copy for a failed swap onto an edited line, told apart by the portal's
 * code: a line that is gone has no old choices to keep.
 */
export function replaceFailureKey(
  error: ConfiguratorSessionError | null,
): 'configurator.edit.line_gone' | 'configurator.edit.update_failed' {
  return error?.code === 'CART_LINE_GONE'
    ? 'configurator.edit.line_gone'
    : 'configurator.edit.update_failed';
}

/**
 * Whether a failed swap onto an edited line is worth sending again. A 404 is a
 * record or a line that is gone, and would be gone on the retry too; anything
 * else may have been a moment, and the swap is safe to repeat.
 */
export function replaceRetryable(
  error: ConfiguratorSessionError | null,
): boolean {
  return error?.status !== 404;
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
 * The page sends one interaction per batch, so a refusal is about the change
 * it sent last; a single-choice switch puts its deselect first, in the same
 * group. The status alone does not say the provider refused: the code
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
 * not a refusal, which its own node shows.
 */
export function formError(
  stage: ConfiguratorStage,
  error: ConfiguratorSessionError | null,
  refused: ConfigurationChange | null,
): ConfiguratorSessionError | null {
  if (stage !== 'form' || refused) return null;
  return error;
}

/** How long before expiry an active buyer's session is renewed. */
export const RENEW_LEAD_MS = 5 * 60_000;

/**
 * Whether to renew the session now: it runs out within `RENEW_LEAD_MS`, and
 * the buyer has done something on the page since the session last answered.
 * An idle page lets its session run out; a change batch moves `expiresAt` on
 * its own, so activity before its answer does not count. Once `expiresAt` has
 * passed on this clock, it is due whatever the activity: this clock can be off
 * the server's, so the renew's answer says whether the session is gone.
 */
export function renewDue({
  expiresAt,
  now,
  lastActive,
  lastContact,
}: {
  expiresAt: string;
  now: number;
  lastActive: number;
  lastContact: number;
}): boolean {
  const left = Date.parse(expiresAt) - now;
  if (left <= 0) return true;
  return left <= RENEW_LEAD_MS && lastActive > lastContact;
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
