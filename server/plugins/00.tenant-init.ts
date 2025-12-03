import { createTenant } from '../utils/tenant';

export default defineNitroPlugin(async (_nitroApp) => {
  // Initialize tenant-a.localhost
  return false;
  await createTenant({
    hostname: 'tenant-a.localhost',
    tenantId: 'tenant-a.localhost',
    config: {
      theme: {
        name: 'tenant-a',
        colors: {
          primary: '#000000',
          secondary: '#ffffff',
        },
      },
    },
  });
});
