import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

vi.mock('../../server/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const setCookieMock = vi.fn();
const deleteCookieMock = vi.fn();
const getCookieMock = vi.fn();

vi.stubGlobal('setCookie', setCookieMock);
vi.stubGlobal('getCookie', getCookieMock);
vi.stubGlobal('deleteCookie', deleteCookieMock);

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
vi.stubGlobal('defineEventHandler', (fn: Function) => fn);

const { default: storeSettingsPreviewExitHandler } =
  await import('../../server/api/auth/store-settings-preview-exit.post');

const mockEvent = {} as H3Event;

describe('POST /api/auth/store-settings-preview-exit', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns success and clears the STORE_SETTINGS_PREVIEW cookie', async () => {
    const result = await storeSettingsPreviewExitHandler(mockEvent);

    expect(result).toEqual({ success: true });
    expect(deleteCookieMock).toHaveBeenCalledWith(
      mockEvent,
      'store_settings_preview',
      expect.objectContaining({ path: '/' }),
    );
  });

  it('does not clear PREVIEW_MODE or auth cookies', async () => {
    await storeSettingsPreviewExitHandler(mockEvent);

    const clearedCookieNames = deleteCookieMock.mock.calls.map(
      (call) => call[1] as string,
    );
    expect(clearedCookieNames).not.toContain('preview_mode');
    expect(clearedCookieNames).not.toContain('auth_token');
    expect(clearedCookieNames).not.toContain('refresh_token');
  });
});
