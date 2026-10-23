import type { Ref } from 'vue';
import type { ResolvedEntityUrl } from '~~/server/services/url-resolver';
import { stripLocaleMarketPrefix } from '#shared/utils/locale-market';
import { isSafeInternalPath } from '#shared/utils/redirect';
import { internalFetch } from '~/utils/internal-fetch';

/** What `settle` reads from a page's primary `useFetch`. */
export interface PrimaryRead {
  error: Readonly<
    Ref<{ statusCode?: number; statusMessage?: string } | null | undefined>
  >;
  status: Readonly<Ref<string>>;
}

/**
 * Content-miss recovery for the pages that load one entity (product, category,
 * brand, CMS page). Call it in setup; `settle` then decides what the primary
 * read means for the page:
 *
 *  - content: nothing, the page renders.
 *  - a failed read (anything but a 404): a fatal error with the read's status.
 *    A timed-out read answers 502, and recovering it would 404 a page that
 *    exists.
 *  - a 404 or missing data: the cached resolver gets a chance to 301 the URL to
 *    its canonical (`canonicalAppPath`) or a renamed slug (`redirect`, the
 *    current locale prefix re-applied). The loop guard and an unsafe target
 *    end in a fatal 404, as does a resolver that finds nothing or fails.
 *
 * A read that has answered (always on SSR, and after `await useFetch` on a
 * client navigation) is decided in setup, so a redirect or 404 carries a real
 * SSR status. A read Nuxt deferred while hydrating (its key was not in the
 * payload: `await useFetch` returns with status 'idle' and no request sent) is
 * decided when it answers. Its errors reject the watch callback, which Vue
 * hands to NuxtRoot's error capture: the error page, `vue:error`, and no error
 * page for bots.
 *
 * Nuxt context: `useLocaleMarket` needs the component instance and
 * `internalFetch` needs the Nuxt app on SSR, and neither survives an await
 * inside a composable. Everything is taken here, in setup; the resolver fetch
 * and every `navigateTo` run through `nuxtApp.runWithContext`.
 */
export function useEntityUrlRecovery() {
  const { localePath } = useLocaleMarket();
  const nuxtApp = useNuxtApp();
  const router = useRouter();

  // Suspense keeps a page mounted until the next one resolves, so a decision
  // can still be under way after the visitor has left it.
  let disposed = false;
  onScopeDispose(() => {
    disposed = true;
  });

  function throwNotFound(): never {
    throw createError({ statusCode: 404, fatal: true });
  }

  async function recover(path: string): Promise<void> {
    const left = () => disposed || router.currentRoute.value.path !== path;

    const res = await nuxtApp
      .runWithContext(() =>
        internalFetch<ResolvedEntityUrl>('/api/resolve-url', {
          query: { path },
        }),
      )
      .catch(() => null);
    if (left()) return;

    let target: string | undefined;
    if (res && 'canonicalAppPath' in res && res.canonicalAppPath) {
      target = res.canonicalAppPath;
    } else if (res && 'redirect' in res && res.redirect) {
      // A renamed slug is a bare url with no entity type; re-apply the current
      // locale prefix only.
      target = localePath(stripLocaleMarketPrefix(res.redirect));
    }
    // Never hand navigateTo an off-origin or protocol-relative path, and never
    // redirect a path to itself.
    if (!target || !isSafeInternalPath(target) || target === path) {
      throwNotFound();
    }
    await nuxtApp.runWithContext(() =>
      navigateTo(target, { redirectCode: 301, replace: true }),
    );
  }

  async function decide(
    read: PrimaryRead,
    isMissing: () => boolean,
    path: string,
  ): Promise<void> {
    const failed = read.error.value;
    if (failed && failed.statusCode !== 404) {
      throw createError({
        statusCode: failed.statusCode ?? 500,
        statusMessage: failed.statusMessage,
        fatal: true,
      });
    }
    if (failed || isMissing()) await recover(path);
  }

  function settle(
    read: PrimaryRead,
    isMissing: () => boolean,
    path: string,
  ): Promise<void> {
    const answered = (status: string) =>
      status === 'success' || status === 'error';
    if (answered(read.status.value)) return decide(read, isMissing, path);

    // Created synchronously, while the component instance is current, so a
    // rejected callback reaches the component's error capture.
    const stop = watch(read.status, (status) => {
      if (!answered(status)) return;
      stop();
      if (disposed || router.currentRoute.value.path !== path) return;
      return decide(read, isMissing, path);
    });
    return Promise.resolve();
  }

  return { settle };
}
