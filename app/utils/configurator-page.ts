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
 * The cart line the held session was opened from, as the cart has it: its
 * quantity, or `null` when no line is behind the session or the cart does not
 * hold it, and whether a quantity change of it is still settling or on its way.
 */
export interface SourceLineState {
  lineQuantity?: number | null;
  linePending?: boolean;
}

/**
 * A session at another quantity than its line, or a line the cart is still
 * changing, would add or update at a quantity the line no longer has.
 */
function atLine(
  configuration: Configuration | null,
  line: SourceLineState,
): boolean {
  if (line.linePending) return false;
  return (
    line.lineQuantity == null || configuration?.quantity === line.lineQuantity
  );
}

/**
 * `isValid` is compared to `true` rather than read for truthiness: it comes off
 * the wire, and anything else that arrives is drift that must not enable the
 * one irreversible action on the page.
 */
export function canCommit(
  state: Pick<ConfiguratorPageState, 'status' | 'configuration'> &
    SourceLineState & {
      busy: boolean;
      /** What the line is added as; a commit with nothing to add would strand it. */
      skuId?: number | null;
    },
): boolean {
  return (
    state.status === 'active' &&
    state.configuration?.isValid === true &&
    !state.busy &&
    state.skuId !== null &&
    atLine(state.configuration, state)
  );
}

/**
 * Whether a press on the action goes on to the session. While a request is in
 * flight it does whatever the document in hand says: the batch the press's own
 * blur sent may be what completes it, and the session waits for its answer.
 */
export function canPress(
  state: Pick<ConfiguratorPageState, 'status' | 'configuration'> &
    SourceLineState & {
      busy: boolean;
      skuId?: number | null;
    },
): boolean {
  return (
    state.status === 'active' &&
    state.skuId !== null &&
    (state.busy || state.configuration?.isValid === true) &&
    atLine(state.configuration, state)
  );
}

/** A quantity sent to a session to follow its line. */
export interface FollowedQuantity {
  configurationId: string;
  quantity: number;
}

/**
 * The quantity to send the held session so it follows its line in the cart,
 * or `null`. Never while a request is in flight: the answer may move the
 * session, and the next check runs once it is in. A quantity is sent to a
 * session once, whatever it answers, so a provider that lands elsewhere is
 * not asked again until the line moves.
 */
export function quantityToFollow(state: {
  status: ConfiguratorSessionStatus;
  busy: boolean;
  configuration: Configuration | null;
  lineQuantity: number | null;
  followed: FollowedQuantity | null;
}): number | null {
  const { configuration, lineQuantity, followed } = state;
  if (state.status !== 'active' || state.busy || !configuration) return null;
  // Without a line every check below falls through to `lineQuantity`: null.
  if (configuration.quantity === lineQuantity) return null;
  if (
    followed?.configurationId === configuration.configurationId &&
    followed.quantity === lineQuantity
  ) {
    return null;
  }
  return lineQuantity;
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
 * The portal's codes for what no second try can fix: the session or the record
 * is priced in another currency than the buyer's market, or the account has no
 * configurator behind it.
 */
const CURRENCY_MISMATCH = 'CURRENCY_MISMATCH';
const NOT_AVAILABLE = 'CONFIGURATOR_NOT_AVAILABLE';

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
  | 'configurator.currency_mismatch'
  | 'configurator.add_not_added'
  | 'configurator.add_failed' {
  if (error?.code === 'UNAUTHORIZED') return 'configurator.sign_in_required';
  if (error?.code === CURRENCY_MISMATCH)
    return 'configurator.currency_mismatch';
  if (error?.status === 409) return 'configurator.add_not_added';
  return 'configurator.add_failed';
}

/** Whether a failed add is worth sending again. */
export function addRetryable(error: ConfiguratorSessionError | null): boolean {
  return error?.code !== CURRENCY_MISMATCH;
}

/**
 * The copy for a failed swap onto an edited line, told apart by the portal's
 * code: a line that is gone has no old choices to keep.
 */
export function replaceFailureKey(
  error: ConfiguratorSessionError | null,
):
  | 'configurator.edit.line_gone'
  | 'configurator.edit.currency_mismatch'
  | 'configurator.edit.update_failed' {
  if (error?.code === 'CART_LINE_GONE') return 'configurator.edit.line_gone';
  if (error?.code === CURRENCY_MISMATCH) {
    return 'configurator.edit.currency_mismatch';
  }
  return 'configurator.edit.update_failed';
}

/**
 * Whether a failed swap onto an edited line is worth sending again. A 404 is a
 * record or a line that is gone, and would be gone on the retry too; anything
 * else may have been a moment, and the swap is safe to repeat.
 */
export function replaceRetryable(
  error: ConfiguratorSessionError | null,
): boolean {
  return error?.status !== 404 && error?.code !== CURRENCY_MISMATCH;
}

/** The copy for a cart line that could not be opened for an edit. */
export function editOpenFailureKey(
  error: ConfiguratorSessionError | null,
):
  | 'configurator.edit.currency_mismatch'
  | 'configurator.not_available'
  | 'configurator.edit.open_failed' {
  if (error?.code === CURRENCY_MISMATCH) {
    return 'configurator.edit.currency_mismatch';
  }
  if (error?.code === NOT_AVAILABLE) return 'configurator.not_available';
  return 'configurator.edit.open_failed';
}

/** Whether opening the line again could answer anything else. */
export function editOpenRetryable(
  error: ConfiguratorSessionError | null,
): boolean {
  return error?.code !== CURRENCY_MISMATCH && error?.code !== NOT_AVAILABLE;
}

/**
 * Whether the page offers to resume the held choices in a new session, in the
 * buyer's market now. Not in an edit: the line itself is in the other currency.
 */
export function restartsInMarket({
  error,
  editing,
}: {
  error: ConfiguratorSessionError | null;
  editing: boolean;
}): boolean {
  return !editing && error?.code === CURRENCY_MISMATCH;
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
 * The copy for a session that could not start or carry on, outside an edit. A
 * 404 here is the account without a configurator or a product it does not
 * know; on the form it would be an unknown session, which is why this is not
 * `failureKey`.
 */
export function startFailureKey(
  error: ConfiguratorSessionError | null,
):
  | 'configurator.currency_mismatch'
  | 'configurator.not_available'
  | ReturnType<typeof failureKey> {
  if (error?.code === CURRENCY_MISMATCH)
    return 'configurator.currency_mismatch';
  if (error?.status === 404) return 'configurator.not_available';
  return failureKey(error);
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
