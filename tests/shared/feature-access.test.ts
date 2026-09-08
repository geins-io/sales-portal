import { describe, it, expect } from 'vitest';
import {
  evaluateAccess,
  canAccessFeature,
} from '../../shared/utils/feature-access';
import type { UserContext } from '../../shared/utils/feature-access';
import type { FeatureAccess } from '../../shared/types/tenant-config';

const anonymous: UserContext = { authenticated: false };
const loggedIn: UserContext = { authenticated: true };

describe('evaluateAccess', () => {
  describe('rule: "all"', () => {
    it('grants access to anonymous users', () => {
      expect(evaluateAccess('all', anonymous)).toBe(true);
    });

    it('grants access to authenticated users', () => {
      expect(evaluateAccess('all', loggedIn)).toBe(true);
    });
  });

  describe('rule: "authenticated"', () => {
    it('denies access to anonymous users', () => {
      expect(evaluateAccess('authenticated', anonymous)).toBe(false);
    });

    it('grants access to authenticated users', () => {
      expect(evaluateAccess('authenticated', loggedIn)).toBe(true);
    });
  });
});

describe('canAccessFeature', () => {
  it('returns false when feature is undefined', () => {
    expect(canAccessFeature(undefined, loggedIn)).toBe(false);
  });

  it('returns false when feature is not enabled', () => {
    expect(canAccessFeature({ enabled: false }, loggedIn)).toBe(false);
  });

  it('returns false when feature is disabled with access rule', () => {
    expect(canAccessFeature({ enabled: false, access: 'all' }, loggedIn)).toBe(
      false,
    );
  });

  it('returns true when enabled with no access rule (defaults to all)', () => {
    expect(canAccessFeature({ enabled: true }, anonymous)).toBe(true);
  });

  it('returns true when enabled with access: "all"', () => {
    expect(canAccessFeature({ enabled: true, access: 'all' }, anonymous)).toBe(
      true,
    );
  });

  it('evaluates access: "authenticated" correctly', () => {
    const feature = { enabled: true, access: 'authenticated' as FeatureAccess };
    expect(canAccessFeature(feature, anonymous)).toBe(false);
    expect(canAccessFeature(feature, loggedIn)).toBe(true);
  });
});
