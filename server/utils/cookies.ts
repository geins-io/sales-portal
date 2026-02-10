/**
 * Cookie utility module — centralized cookie names, defaults, and helpers.
 *
 *                  .---. .---.
 *                 :     : o   :    me want cookie!
 *             _..-:   o :     :-..._
 *         .-''  '  `---' `---' "   ``-.
 *       .'   "   '  "  .    "  . '  "  `.
 *      :   '.---.,,.,...,.,.,.,..---.  ' ;
 *      `. " `.                     .' " .'
 *       `.  '`.                   .' ' .'
 *        `.    `-._           _.-' "  .'  .----.
 *          `. "    '"--...--"'  . ' .'  .'  o   `.
 *          .'`-._'    " .     " _.-'`. :       o  :
 *        .'      ```--.....--'''    ' `:_ o       :
 *      .'    "     '         "     "   ; `.;";";";'
 *     ;         '       "       '     . ; .' ; ; ;
 *    ;     '         '       '   "    .'      .-'
 *    '  "     "   '      "           "    _.-'
 *
 *                 Om nom nom nom!
 *
 * @module server/utils/cookies
 * @see docs/adr/007-cookie-utility-module.md
 */

import type { H3Event } from 'h3';
import { COOKIE_NAMES } from '#shared/constants/storage';

export { COOKIE_NAMES };

function cookieDefaults() {
  return {
    httpOnly: true,
    secure: !import.meta.dev,
    sameSite: 'lax' as const,
    path: '/',
  };
}

// --- Auth cookies (om nom nom) ---

export function setAuthCookies(
  event: H3Event,
  tokens: { token: string; refreshToken: string; expiresIn?: number },
) {
  setCookie(event, COOKIE_NAMES.AUTH_TOKEN, tokens.token, {
    ...cookieDefaults(),
    maxAge: tokens.expiresIn ?? 3600,
  });
  setCookie(event, COOKIE_NAMES.REFRESH_TOKEN, tokens.refreshToken, {
    ...cookieDefaults(),
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });
}

export function getAuthCookies(event: H3Event) {
  return {
    authToken: getCookie(event, COOKIE_NAMES.AUTH_TOKEN),
    refreshToken: getCookie(event, COOKIE_NAMES.REFRESH_TOKEN),
  };
}

/** Cookie Monster eats your auth cookies. Om nom nom nom! */
export function clearAuthCookies(event: H3Event) {
  deleteCookie(event, COOKIE_NAMES.AUTH_TOKEN, { path: '/' });
  deleteCookie(event, COOKIE_NAMES.REFRESH_TOKEN, { path: '/' });
}

// --- Tenant cookie ---

export function setTenantCookie(event: H3Event, tenantId: string) {
  setCookie(event, COOKIE_NAMES.TENANT_ID, tenantId, {
    ...cookieDefaults(),
    maxAge: 24 * 60 * 60, // 1 day
  });
}

export function getTenantCookie(event: H3Event) {
  return getCookie(event, COOKIE_NAMES.TENANT_ID);
}

// --- Cart cookie ---

export function setCartCookie(event: H3Event, cartId: string) {
  setCookie(event, COOKIE_NAMES.CART_ID, cartId, {
    ...cookieDefaults(),
    httpOnly: false, // client needs to read for optimistic UI
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });
}

export function getCartCookie(event: H3Event) {
  return getCookie(event, COOKIE_NAMES.CART_ID);
}
