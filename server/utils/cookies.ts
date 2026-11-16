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
 * @see docs/adr/006-cookie-utility-module.md
 */

import type { H3Event } from 'h3';
import { COOKIE_NAMES } from '#shared/constants/storage';
import { isDevMode } from './dev-mode';

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

/**
 * `rememberMe` is the sign-in choice. Left out — a rotation, a password change
 * — the choice already made for this session stands: a cookie's max-age never
 * reaches the server, so the choice travels as the `session_only` mark.
 */
export function setAuthCookies(
  event: H3Event,
  tokens: {
    token: string;
    refreshToken: string;
    expiresIn?: number;
    rememberMe?: boolean;
  },
) {
  const persist =
    tokens.rememberMe ?? getCookie(event, COOKIE_NAMES.SESSION_ONLY) !== '1';
  if (tokens.rememberMe === false) {
    setCookie(event, COOKIE_NAMES.SESSION_ONLY, '1', cookieDefaults());
  } else if (tokens.rememberMe === true) {
    deleteCookie(event, COOKIE_NAMES.SESSION_ONLY, { path: '/' });
  }
  setCookie(event, COOKIE_NAMES.AUTH_TOKEN, tokens.token, {
    ...cookieDefaults(),
    ...(persist ? { maxAge: tokens.expiresIn ?? 3600 } : {}),
  });
  setCookie(event, COOKIE_NAMES.REFRESH_TOKEN, tokens.refreshToken, {
    ...cookieDefaults(),
    ...(persist ? { maxAge: 30 * 24 * 60 * 60 } : {}), // 30 days
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
  deleteCookie(event, COOKIE_NAMES.SESSION_ONLY, { path: '/' });
  expirePartitionedAuthToken(event);
}

/**
 * Puts `names` deletes, with `attrs`, ahead of the response's other
 * Set-Cookie headers.
 *
 * Call it after every auth cookie set in the response: h3's `setCookie` keeps
 * one header per name and path, ignoring Partitioned, and drops these. They go
 * first because a browser without partitioned cookies reads a partitioned
 * delete or set as a plain one, and a delete must not land after a new token.
 */
function expireAhead(event: H3Event, names: string[], attrs: string) {
  const current = getResponseHeader(event, 'set-cookie');
  const kept =
    typeof current === 'string' || Array.isArray(current)
      ? splitCookiesString(current)
      : [];
  const expires = names.map((name) => `${name}=; Max-Age=0; Path=/${attrs}`);
  setResponseHeader(event, 'set-cookie', [...expires, ...kept]);
}

/**
 * Deletes an `auth_token` set Partitioned (by preview, and by login-as until
 * it moved to a plain cookie): a plain delete leaves it in place, and the
 * browser sends it ahead of a newer token.
 */
export function expirePartitionedAuthToken(event: H3Event) {
  if (isDevMode()) return;
  expireAhead(
    event,
    [COOKIE_NAMES.AUTH_TOKEN],
    '; Secure; SameSite=None; Partitioned',
  );
}

/**
 * Lax, so every engine ignores these deletes in a cross-site iframe (Studio
 * preview) and only a top-level page can end the storefront session.
 */
const UNPARTITIONED_DELETE = '; SameSite=Lax';

/**
 * Deletes a signed-in buyer's plain `auth_token` when preview sets its
 * partitioned one: otherwise both are sent, and the older plain one wins.
 */
export function expireUnpartitionedAuthToken(event: H3Event) {
  if (isDevMode()) return;
  expireAhead(event, [COOKIE_NAMES.AUTH_TOKEN], UNPARTITIONED_DELETE);
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

export function clearCartCookie(event: H3Event) {
  deleteCookie(event, COOKIE_NAMES.CART_ID, { path: '/' });
}

// --- Cart owner cookie (read through server/utils/cart-owner) ---

export function getCartOwnerCookie(event: H3Event) {
  return getCookie(event, COOKIE_NAMES.CART_OWNER);
}

export function setCartOwnerCookie(event: H3Event, value: string) {
  setCookie(event, COOKIE_NAMES.CART_OWNER, value, {
    ...cookieDefaults(),
    maxAge: 30 * 24 * 60 * 60, // 30 days, as the cart cookie
  });
}

export function clearCartOwnerCookie(event: H3Event) {
  deleteCookie(event, COOKIE_NAMES.CART_OWNER, { path: '/' });
}

// --- Login-as cookie ---

/**
 * Merchant Center opens login-as as a top-level page, never in an iframe, so
 * the token is an ordinary first-party cookie that logout can delete.
 */
export function setLoginAsAuthToken(event: H3Event, token: string) {
  setCookie(event, COOKIE_NAMES.AUTH_TOKEN, token, {
    ...cookieDefaults(),
    maxAge: 3600,
  });
}

// --- Preview cookies ---

/**
 * Preview cookie options — different from regular cookies because preview
 * may run inside a cross-origin iframe (CMS Studio embedding storefront).
 * SameSite=None + Secure is required for cross-origin cookies in production.
 * In dev (HTTP), SameSite=Lax + Secure=false since browsers reject
 * SameSite=None without Secure, and Secure requires HTTPS.
 */
function previewCookieDefaults() {
  const isProd = !isDevMode();
  return {
    sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
    secure: isProd,
    path: '/',
    // CHIPS: scope the cookie to the embedding top-level site so a Studio
    // iframe session cannot bleed into a separate top-level tab on the same
    // storefront host. Without this, opening alpha.sales-portal.geins.dev
    // in its own tab would still send the preview cookie set inside Studio.
    partitioned: isProd,
  };
}

export function setPreviewAuthToken(
  event: H3Event,
  token: string,
  maxAge: number = 3600,
) {
  setCookie(event, COOKIE_NAMES.AUTH_TOKEN, token, {
    httpOnly: true,
    ...previewCookieDefaults(),
    maxAge,
  });
}

export function setPreviewCookie(event: H3Event) {
  setCookie(event, COOKIE_NAMES.PREVIEW_MODE, 'true', {
    httpOnly: false, // Client needs to read for banner UI
    ...previewCookieDefaults(),
    maxAge: 3600,
  });
}

export function getPreviewCookie(event: H3Event): boolean {
  return getCookie(event, COOKIE_NAMES.PREVIEW_MODE) === 'true';
}

export function clearPreviewCookie(event: H3Event) {
  deleteCookie(event, COOKIE_NAMES.PREVIEW_MODE, { path: '/' });
}

export function clearPreviewSession(event: H3Event) {
  // Preview cookies are set with previewCookieDefaults() (SameSite=None; Secure;
  // Partitioned in prod). A delete Set-Cookie only removes a partitioned (CHIPS)
  // cookie when it repeats Partitioned + SameSite=None + Secure; with a bare
  // { path: '/' } delete the browser keeps the partitioned cookie, so the
  // httpOnly auth_token survives exit and /api/auth/me keeps decoding the preview
  // JWT, leaving the topbar identity on the preview user. Match the set
  // attributes here, and delete plain auth cookies too, so exit leaves no
  // session the UI does not show. clearPreviewCookie keeps a path-only delete,
  // since the regular flows never set preview_mode partitioned.
  const previewAttrs = previewCookieDefaults();
  deleteCookie(event, COOKIE_NAMES.AUTH_TOKEN, previewAttrs);
  deleteCookie(event, COOKIE_NAMES.REFRESH_TOKEN, previewAttrs);
  deleteCookie(event, COOKIE_NAMES.PREVIEW_MODE, previewAttrs);
  if (!isDevMode()) {
    expireAhead(
      event,
      [COOKIE_NAMES.AUTH_TOKEN, COOKIE_NAMES.REFRESH_TOKEN],
      UNPARTITIONED_DELETE,
    );
  }
}

// --- Market cookie ---

export function setMarketCookie(event: H3Event, market: string) {
  setCookie(event, COOKIE_NAMES.MARKET, market, {
    ...cookieDefaults(),
    httpOnly: false, // client needs to read for UI
    maxAge: 365 * 24 * 60 * 60, // 1 year
  });
}

export function getMarketCookie(event: H3Event) {
  return getCookie(event, COOKIE_NAMES.MARKET);
}

// --- Impersonation (spoofed-by) cookie ---

export function setSpoofedByCookie(event: H3Event, spoofedBy: string) {
  setCookie(event, COOKIE_NAMES.SPOOFED_BY, spoofedBy, {
    ...cookieDefaults(),
    httpOnly: false, // client needs to read for impersonation banner
    maxAge: 3600,
  });
}

export function getSpoofedByCookie(event: H3Event): string | undefined {
  return getCookie(event, COOKIE_NAMES.SPOOFED_BY);
}

export function clearSpoofedByCookie(event: H3Event) {
  deleteCookie(event, COOKIE_NAMES.SPOOFED_BY, { path: '/' });
}
