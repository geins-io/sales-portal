import { COOKIE_NAMES } from '#shared/constants/storage';

/** Trusted origins that the CMS Studio may send messages from. */
const TRUSTED_ORIGINS = [
  'https://studio.geins.io',
  'https://admin.geins.io',
  'https://cms.geins.io',
  'https://orange.litium.io',
];

function isTrustedOrigin(origin: string): boolean {
  return TRUSTED_ORIGINS.some(
    (trusted) =>
      origin === trusted ||
      origin.endsWith('.geins.io') ||
      origin.endsWith('.litium.io'),
  );
}

interface CmsMessage {
  type: string;
  data?: Record<string, unknown>;
}

function isValidCmsMessage(payload: unknown): payload is CmsMessage {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'type' in payload &&
    typeof (payload as CmsMessage).type === 'string' &&
    (payload as CmsMessage).type.startsWith('cms:')
  );
}

export default defineNuxtPlugin(() => {
  const previewCookie = useCookie<boolean | string | null>(
    COOKIE_NAMES.PREVIEW_MODE,
  );
  const isPreview =
    previewCookie.value === true || previewCookie.value === 'true';

  // Only activate in preview mode
  if (!isPreview) return;

  const studioConnected = useState('cms-studio-connected', () => false);

  function handleMessage(event: MessageEvent) {
    // Validate origin
    if (!isTrustedOrigin(event.origin)) return;

    // Validate message shape
    if (!isValidCmsMessage(event.data)) return;

    const { type, data } = event.data;

    if (import.meta.dev) {
      console.log(`[cms-preview] ${type}`, data);
    }

    // Mark Studio as connected on first valid message
    if (!studioConnected.value) {
      studioConnected.value = true;
    }

    switch (type) {
      case 'cms:refresh-area': {
        // Refresh a specific widget area
        const family = data?.family as string | undefined;
        const areaName = data?.areaName as string | undefined;
        if (family && areaName) {
          refreshNuxtData(`cms-area-${family}-${areaName}`);
        } else {
          // Refresh all CMS data
          refreshNuxtData();
        }
        break;
      }

      case 'cms:refresh-page':
        // Refresh all page data
        refreshNuxtData();
        break;

      case 'cms:navigate': {
        // Navigate to a path on the storefront
        const path = data?.path as string | undefined;
        if (path && typeof path === 'string' && path.startsWith('/')) {
          navigateTo(path);
        }
        break;
      }

      case 'cms:exit-preview':
        // Exit preview mode — delegate to composable
        $fetch('/api/auth/preview-exit', { method: 'POST' }).catch(() => {});
        previewCookie.value = null;
        navigateTo('/', { replace: true, external: true });
        break;

      case 'cms:ping':
        // Respond to ping from Studio to confirm connection
        if (event.source && 'postMessage' in event.source) {
          (event.source as Window).postMessage(
            { type: 'cms:pong', data: { url: window.location.href } },
            event.origin,
          );
        }
        break;
    }
  }

  window.addEventListener('message', handleMessage);

  // Notify parent iframe (if embedded) that we're ready
  if (window.parent !== window) {
    try {
      window.parent.postMessage(
        {
          type: 'cms:storefront-ready',
          data: { url: window.location.href },
        },
        '*',
      );
    } catch {
      // Cross-origin — parent will discover us via ping
    }
  }
});

export { isTrustedOrigin, isValidCmsMessage };
