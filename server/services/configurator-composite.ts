import type { ConfiguratorBackend, ConfiguratorContext } from './configurator';
import type { FixtureConfiguratorBackend } from './configurator-fixture';

// ---------------------------------------------------------------------------
// Dev's backend: the fixture for the products its seeds stand for, the real
// backend for every other product, so the team tenant's seeds and a real
// configurable product work on one environment.
//
// A create names a product; every later call names only a configuration id, so
// those go to whichever backend owns the id. The fixture forgets its ids on a
// restart together with its sessions, so the rule stays right across one.
// ---------------------------------------------------------------------------

export function createCompositeConfiguratorBackend(
  fixture: FixtureConfiguratorBackend,
  real: ConfiguratorBackend,
): ConfiguratorBackend {
  const byId = (id: string, ctx: ConfiguratorContext) =>
    fixture.owns(id, ctx) ? fixture : real;

  return {
    isConfigurable: (product, ctx) =>
      fixture.isConfigurable(product, ctx) || real.isConfigurable(product, ctx),
    create: (input, ctx) =>
      fixture.isConfigurable({ productId: input.productId }, ctx)
        ? fixture.create(input, ctx)
        : real.create(input, ctx),
    get: (id, ctx) => byId(id, ctx).get(id, ctx),
    applyChanges: (id, changes, ctx) =>
      byId(id, ctx).applyChanges(id, changes, ctx),
    renew: (id, ctx) => byId(id, ctx).renew(id, ctx),
    release: (id, ctx) => byId(id, ctx).release(id, ctx),
    commit: (id, ctx) => byId(id, ctx).commit(id, ctx),
  };
}
