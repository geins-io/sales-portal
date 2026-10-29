import type { H3Event } from 'h3';
import { H3Error } from 'h3';
import * as cartService from '../services/cart';
import {
  buyerIdOf,
  cartAtSignIn,
  readCartOwners,
  rememberCart,
} from './cart-owner';

/** Geins refused the cart as another buyer's; anything else is a failed copy. */
function refusedCart(error: unknown): boolean {
  return (
    error instanceof H3Error &&
    Reflect.get(Object(error.data), 'code') === ErrorCode.CART_NOT_OWN
  );
}

/**
 * The cart a buyer gets on signing in with `token`: their own cart when this
 * browser noted one; otherwise a guest cart is copied into a new authenticated
 * cart, as before. Another buyer's cart is never copied.
 */
export async function settleSignInCart(
  event: H3Event,
  token: string,
): Promise<void> {
  const signIn = cartAtSignIn(
    getCartCookie(event),
    buyerIdOf(token),
    readCartOwners(event),
  );
  if (signIn.kind === 'keep') {
    setCartCookie(event, signIn.cartId);
    // Written again, so a buyer who only signs in is not the one evicted.
    rememberCart(event, token, signIn.cartId);
  } else if (signIn.kind === 'copy') {
    try {
      const newCart = await cartService.copyCart(signIn.cartId, event, token);
      setCartCookie(event, newCart.id);
      rememberCart(event, token, newCart.id);
    } catch (error) {
      // A failed copy never fails the sign-in. A cart Geins refused is gone
      // for this buyer: a new cart on the first add. Any other failure keeps
      // the cart, as before.
      if (refusedCart(error)) clearCartCookie(event);
    }
  } else {
    clearCartCookie(event);
  }
}
