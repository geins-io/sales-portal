import { describe, it, expect } from 'vitest';
import {
  evaluateAccess,
  canAccessFeature,
  canConfigure,
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

  describe('rule outside the union', () => {
    // The switch is exhaustive, so this value cannot exist in typed code — the
    // cast constructs it deliberately to prove the runtime guard denies rather
    // than throws. `FeatureAccessSchema` is a separate source of truth from
    // `FeatureAccess`, so a literal added only to the schema arrives this way.
    // tests/ is outside the typecheck today, so the cast documents intent; it
    // becomes load-bearing once the directory is in the gate.
    const unhandled = 'staff' as unknown as FeatureAccess;

    it('denies access to anonymous users', () => {
      expect(evaluateAccess(unhandled, anonymous)).toBe(false);
    });

    it('denies access to authenticated users', () => {
      expect(evaluateAccess(unhandled, loggedIn)).toBe(false);
    });

    it('denies an enabled feature through canAccessFeature', () => {
      const feature = { enabled: true, access: unhandled };
      expect(canAccessFeature(feature, anonymous)).toBe(false);
      expect(canAccessFeature(feature, loggedIn)).toBe(false);
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

describe('canConfigure', () => {
  it('needs the configurator switched on and a signed-in buyer', () => {
    expect(canConfigure({ enabled: true }, loggedIn)).toBe(true);
    expect(canConfigure({ enabled: true }, anonymous)).toBe(false);
  });

  it('refuses when the configurator is off or absent', () => {
    expect(canConfigure({ enabled: false }, loggedIn)).toBe(false);
    expect(canConfigure(undefined, loggedIn)).toBe(false);
  });

  it('does not read the access rule', () => {
    const openToAll = { enabled: true, access: 'all' as FeatureAccess };
    const signedInOnly = {
      enabled: true,
      access: 'authenticated' as FeatureAccess,
    };
    expect(canConfigure(openToAll, anonymous)).toBe(false);
    expect(canConfigure(signedInOnly, loggedIn)).toBe(true);
  });
});
