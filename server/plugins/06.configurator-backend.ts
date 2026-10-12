import { resolveConfiguratorBackendName } from '../services/configurator-backend-name';
import { readConfiguratorBackendValue } from '../services/configurator-config';

/** Fails startup on a `CONFIGURATOR_BACKEND` that names no backend. */
export default defineNitroPlugin(() => {
  resolveConfiguratorBackendName(readConfiguratorBackendValue());
});
