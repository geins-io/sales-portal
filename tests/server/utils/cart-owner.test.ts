import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

// ---------------------------------------------------------------------------
// The cart owner note: which signed-in buyer had which cart, in this browser.
// The cookie helpers run for real against an in-memory jar.
// ---------------------------------------------------------------------------

const jar = new Map<string, string>();
const setCookie = vi.fn((_event: H3Event, name: string, value: string) => {
  jar.set(name, value);
});
const deleteCookie = vi.fn((_event: H3Event, name: string) => {
  jar.delete(name);
});
vi.stubGlobal('getCookie', (_event: H3Event, name: string) => jar.get(name));
vi.stubGlobal('setCookie', setCookie);
vi.stubGlobal('deleteCookie', deleteCookie);

const {
  buyerIdOf,
  readCartOwners,
  rememberCart,
  forgetCart,
  cartAtSignIn,
  CART_OWNER_LIMIT,
} = await import('../../../server/utils/cart-owner');

const EVENT = {} as H3Event;
const NOTE = 'cart_owner';

/** The claim key as measured on real Geins sign-in tokens. */
const SID_CLAIM = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/sid';

function token(claims: Record<string, unknown>): string {
  const part = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${part({ alg: 'HS256' })}.${part(claims)}.signature`;
}

/** A token for a buyer in company 2, as Geins issues it. */
function buyer(sid: string): string {
  return token({
    [SID_CLAIM]: sid,
    MemberId: '2',
    CustomerType: 'ORGANIZATION',
  });
}

const A = '42cff023-d059-9054-2acd-80b95c6716dd';
const B = '9f253dea-00ac-c9ff-0bc2-aa1dba9e2a43';

beforeEach(() => {
  jar.clear();
  setCookie.mockClear();
  deleteCookie.mockClear();
});

describe('buyerIdOf', () => {
  it("reads the token's per-person sid claim", () => {
    expect(buyerIdOf(buyer(A))).toBe(A);
  });

  it('tells two buyers of the same company apart', () => {
    expect(buyerIdOf(buyer(A))).not.toBe(buyerIdOf(buyer(B)));
  });

  it.each([
    ['no sid, only the company MemberId', token({ MemberId: '2' })],
    ['an empty sid', token({ [SID_CLAIM]: '' })],
    ['a sid that is not a string', token({ [SID_CLAIM]: 42 })],
    ['a sid under the short claim name', token({ sid: A })],
    ['a token that is not a JWT', 'not-a-token'],
    ['no token', undefined],
  ])('has no buyer for %s', (_case, value) => {
    expect(buyerIdOf(value)).toBeUndefined();
  });
});

describe('rememberCart', () => {
  it('notes the cart under the buyer, in an httpOnly cookie for 30 days', () => {
    rememberCart(EVENT, buyer(A), 'cart-a');

    expect(readCartOwners(EVENT)).toEqual([{ buyerId: A, cartId: 'cart-a' }]);
    expect(setCookie).toHaveBeenCalledWith(
      EVENT,
      NOTE,
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
      }),
    );
  });

  it('notes nothing for a token without a buyer id', () => {
    rememberCart(EVENT, token({ MemberId: '2' }), 'cart-a');
    rememberCart(EVENT, undefined, 'cart-a');

    expect(setCookie).not.toHaveBeenCalled();
    expect(jar.has(NOTE)).toBe(false);
  });

  it("keeps each buyer's cart, the latest written first", () => {
    rememberCart(EVENT, buyer(A), 'cart-a');
    rememberCart(EVENT, buyer(B), 'cart-b');

    expect(readCartOwners(EVENT)).toEqual([
      { buyerId: B, cartId: 'cart-b' },
      { buyerId: A, cartId: 'cart-a' },
    ]);
  });

  it("replaces a buyer's earlier cart and moves the buyer to the front", () => {
    rememberCart(EVENT, buyer(A), 'cart-a');
    rememberCart(EVENT, buyer(B), 'cart-b');
    rememberCart(EVENT, buyer(A), 'cart-a2');

    expect(readCartOwners(EVENT)).toEqual([
      { buyerId: A, cartId: 'cart-a2' },
      { buyerId: B, cartId: 'cart-b' },
    ]);
  });

  it('gives a cart one owner: the buyer it was last written for', () => {
    rememberCart(EVENT, buyer(A), 'cart-x');
    rememberCart(EVENT, buyer(B), 'cart-x');

    expect(readCartOwners(EVENT)).toEqual([{ buyerId: B, cartId: 'cart-x' }]);
  });

  it(`holds ${CART_OWNER_LIMIT} buyers and lets the least recently written go`, () => {
    const buyers = Array.from(
      { length: CART_OWNER_LIMIT + 1 },
      (_, n) => `buyer-${n}`,
    );
    for (const id of buyers) rememberCart(EVENT, buyer(id), `cart-${id}`);

    const owners = readCartOwners(EVENT).map((owner) => owner.buyerId);
    expect(CART_OWNER_LIMIT).toBe(5);
    expect(owners).toHaveLength(CART_OWNER_LIMIT);
    expect(owners).not.toContain('buyer-0');
    expect(owners[0]).toBe(`buyer-${CART_OWNER_LIMIT}`);
  });
});

describe('readCartOwners', () => {
  it('reads no owners without the cookie', () => {
    expect(readCartOwners(EVENT)).toEqual([]);
  });

  it.each([
    ['garbage', 'garbage'],
    ['a buyer with no cart', `${A}|`],
    ['a cart with no buyer', '|cart-a'],
    ['one field too many', `${A}|cart-a|extra`],
    ['an id with a separator in it', `${A}|cart a`],
  ])('drops an entry that is %s', (_case, value) => {
    jar.set(NOTE, `${value},${B}|cart-b`);

    expect(readCartOwners(EVENT)).toEqual([{ buyerId: B, cartId: 'cart-b' }]);
  });
});

describe('forgetCart', () => {
  beforeEach(() => {
    rememberCart(EVENT, buyer(A), 'cart-a');
    rememberCart(EVENT, buyer(B), 'cart-b');
    setCookie.mockClear();
  });

  it('forgets the cart when the buyer asking owns that entry', () => {
    forgetCart(EVENT, buyer(A), 'cart-a');

    expect(readCartOwners(EVENT)).toEqual([{ buyerId: B, cartId: 'cart-b' }]);
  });

  it("never forgets another buyer's cart", () => {
    forgetCart(EVENT, buyer(B), 'cart-a');

    expect(readCartOwners(EVENT)).toHaveLength(2);
    expect(setCookie).not.toHaveBeenCalled();
  });

  it('never forgets a cart for a request without a buyer', () => {
    forgetCart(EVENT, undefined, 'cart-a');
    forgetCart(EVENT, token({ MemberId: '2' }), 'cart-a');

    expect(readCartOwners(EVENT)).toHaveLength(2);
    expect(setCookie).not.toHaveBeenCalled();
  });

  it("keeps the buyer's entry when it names another cart", () => {
    forgetCart(EVENT, buyer(A), 'cart-other');

    expect(readCartOwners(EVENT)).toHaveLength(2);
    expect(setCookie).not.toHaveBeenCalled();
  });

  it('removes the cookie with its last entry', () => {
    forgetCart(EVENT, buyer(A), 'cart-a');
    forgetCart(EVENT, buyer(B), 'cart-b');

    expect(deleteCookie).toHaveBeenCalledWith(EVENT, NOTE, { path: '/' });
    expect(jar.has(NOTE)).toBe(false);
  });
});

describe('cartAtSignIn', () => {
  const owners = [
    { buyerId: A, cartId: 'cart-a' },
    { buyerId: B, cartId: 'cart-b' },
  ];

  it('gives the buyer their noted cart and drops a guest cart, unmerged', () => {
    expect(cartAtSignIn('guest-cart', A, owners)).toEqual({
      kind: 'keep',
      cartId: 'cart-a',
    });
  });

  it('gives the buyer their noted cart when the browser has no cart', () => {
    expect(cartAtSignIn(undefined, B, owners)).toEqual({
      kind: 'keep',
      cartId: 'cart-b',
    });
  });

  it('gives the buyer back their own cart after an expired session', () => {
    expect(cartAtSignIn('cart-a', A, owners)).toEqual({
      kind: 'keep',
      cartId: 'cart-a',
    });
  });

  it("never copies another buyer's noted cart", () => {
    expect(cartAtSignIn('cart-a', 'buyer-c', owners)).toEqual({ kind: 'none' });
  });

  it("never copies another buyer's noted cart for a token without a buyer id", () => {
    expect(cartAtSignIn('cart-a', undefined, owners)).toEqual({ kind: 'none' });
  });

  it('copies a guest cart for a buyer with no note', () => {
    expect(cartAtSignIn('guest-cart', 'buyer-c', owners)).toEqual({
      kind: 'copy',
      cartId: 'guest-cart',
    });
  });

  it('copies a guest cart for a token without a buyer id', () => {
    expect(cartAtSignIn('guest-cart', undefined, [])).toEqual({
      kind: 'copy',
      cartId: 'guest-cart',
    });
  });

  it('gives no cart when there is neither a note nor a cart', () => {
    expect(cartAtSignIn(undefined, 'buyer-c', owners)).toEqual({
      kind: 'none',
    });
  });
});
