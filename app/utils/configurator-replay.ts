// ---------------------------------------------------------------------------
// A configured order row opened in the configurator lives in the product
// page's URL, as ids only: the order's public id and the row's position. The
// server reads the row's choices itself.
// ---------------------------------------------------------------------------

const ORDER = 'order';
const ROW = 'row';

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const POSITION = /^\d+$/;

/** An order row, by its order's public id and its position in the rows. */
export interface OrderRowRef {
  publicOrderId: string;
  row: number;
}

/** The product page replaying an order row: the page's path plus the two ids. */
export function replayLineHref(path: string, ref: OrderRowRef): string {
  const query = new URLSearchParams({
    [ORDER]: ref.publicOrderId,
    [ROW]: String(ref.row),
  });
  return `${path}?${query.toString()}`;
}

/**
 * The order row a product page's query names. `stale` is a link the page
 * cannot replay — half a link, an id that is not one — which the page says
 * rather than ignore.
 */
export function replayTarget(query: Record<string, unknown>): {
  row: OrderRowRef | null;
  stale: boolean;
} {
  if (!(ORDER in query) && !(ROW in query)) return { row: null, stale: false };
  const order = query[ORDER];
  const row = query[ROW];
  if (
    typeof order !== 'string' ||
    typeof row !== 'string' ||
    !GUID.test(order) ||
    !POSITION.test(row)
  ) {
    return { row: null, stale: true };
  }
  return { row: { publicOrderId: order, row: Number(row) }, stale: false };
}

/** The query without the order row, once the page no longer replays it. */
export function withoutReplay<T extends Record<string, unknown>>(
  query: T,
): Omit<T, typeof ORDER | typeof ROW> {
  const { [ORDER]: _order, [ROW]: _row, ...rest } = query;
  return rest;
}
