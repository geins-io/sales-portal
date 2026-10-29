/**
 * The cart owner note: which signed-in buyer had which cart, in this browser.
 * It decides only which cart a buyer gets at sign-in; it never opens a cart
 * Geins would refuse.
 */

import type { H3Event } from 'h3';
import { decodeJwtPayload } from './auth';
import {
  clearCartOwnerCookie,
  getCartOwnerCookie,
  setCartOwnerCookie,
} from './cookies';

/** Per person; the token's `MemberId` is per company, so two colleagues share it. */
const BUYER_ID_CLAIM =
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/sid';

/** Buyers a browser keeps a cart for; the least recently written goes first. */
export const CART_OWNER_LIMIT = 5;

const ENTRY = /^([\w-]+)\|([\w-]+)$/;

export interface CartOwner {
  buyerId: string;
  cartId: string;
}

export function buyerIdOf(token: string | undefined): string | undefined {
  if (!token) return undefined;
  const id = decodeJwtPayload(token)?.[BUYER_ID_CLAIM];
  return typeof id === 'string' && id !== '' ? id : undefined;
}

/** Latest written first. An entry that does not read as two ids is dropped. */
export function readCartOwners(event: H3Event): CartOwner[] {
  const value = getCartOwnerCookie(event);
  if (!value) return [];
  return value.split(',').flatMap((entry) => {
    const [, buyerId, cartId] = ENTRY.exec(entry) ?? [];
    return buyerId && cartId ? [{ buyerId, cartId }] : [];
  });
}

function writeCartOwners(event: H3Event, owners: CartOwner[]): void {
  if (owners.length === 0) return clearCartOwnerCookie(event);
  setCartOwnerCookie(
    event,
    owners.map(({ buyerId, cartId }) => `${buyerId}|${cartId}`).join(','),
  );
}

/** Notes the cart as the token's buyer's; a token without a buyer id notes nothing. */
export function rememberCart(
  event: H3Event,
  token: string | undefined,
  cartId: string,
): void {
  const buyerId = buyerIdOf(token);
  if (!buyerId) return;
  const others = readCartOwners(event).filter(
    (owner) => owner.buyerId !== buyerId && owner.cartId !== cartId,
  );
  writeCartOwners(
    event,
    [{ buyerId, cartId }, ...others].slice(0, CART_OWNER_LIMIT),
  );
}

/**
 * Notes the cart for the token's buyer unless it is noted for another buyer,
 * whose entry it never takes over.
 */
export function rememberCartUnlessOthers(
  event: H3Event,
  token: string | undefined,
  cartId: string,
): void {
  const buyerId = buyerIdOf(token);
  const owners = readCartOwners(event);
  if (owners.some((o) => o.cartId === cartId && o.buyerId !== buyerId)) return;
  rememberCart(event, token, cartId);
}

/** Forgets the cart only for the buyer whose entry it is. */
export function forgetCart(
  event: H3Event,
  token: string | undefined,
  cartId: string,
): void {
  const buyerId = buyerIdOf(token);
  if (!buyerId) return;
  const owners = readCartOwners(event);
  const rest = owners.filter(
    (owner) => !(owner.buyerId === buyerId && owner.cartId === cartId),
  );
  if (rest.length !== owners.length) writeCartOwners(event, rest);
}

export type SignInCart =
  | { kind: 'keep'; cartId: string }
  | { kind: 'copy'; cartId: string }
  | { kind: 'none' };

/**
 * The buyer's own noted cart wins over a guest cart, which is dropped, not
 * merged. A cart noted for another buyer is never copied.
 */
export function cartAtSignIn(
  cartId: string | undefined,
  buyerId: string | undefined,
  owners: readonly CartOwner[],
): SignInCart {
  const own = buyerId
    ? owners.find((owner) => owner.buyerId === buyerId)
    : undefined;
  if (own) return { kind: 'keep', cartId: own.cartId };
  if (!cartId || owners.some((owner) => owner.cartId === cartId)) {
    return { kind: 'none' };
  }
  return { kind: 'copy', cartId };
}
