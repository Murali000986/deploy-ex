import assert from 'assert';
import { requireAuth, requireExtensionKey } from '../src/middleware/auth.js';
import { config } from '../src/config/env.js';

export async function testRbacAndPermissions() {
  console.log('  ▸ Testing Role-Based Access Control (RBAC)...');

  // 1. Admin allowed on admin endpoint
  const adminGuard = requireAuth(['ADMIN', 'SUPERADMIN']);
  let adminPassed = false;
  const adminReq = { headers: { 'x-user-role': 'ADMIN' } };
  const mockRes = {
    status: (code) => ({ json: (d) => ({ code, ...d }) })
  };

  adminGuard(adminReq, mockRes, () => { adminPassed = true; });
  assert.strictEqual(adminPassed, true, 'Admin must be granted access');

  // 2. Admin blocked from Superadmin endpoint
  const superadminGuard = requireAuth(['SUPERADMIN']);
  let blockedStatus = 0;
  const blockRes = {
    status: (code) => {
      blockedStatus = code;
      return { json: () => {} };
    }
  };

  superadminGuard(adminReq, blockRes, () => {});
  assert.strictEqual(blockedStatus, 403, 'Admin must receive 403 Forbidden on superadmin endpoint');

  // 3. Extension key guard
  let extBlockedStatus = 0;
  const extBlockRes = {
    status: (code) => {
      extBlockedStatus = code;
      return { json: () => {} };
    }
  };

  requireExtensionKey({ headers: { 'x-extension-key': 'invalid_key' } }, extBlockRes, () => {});
  assert.strictEqual(extBlockedStatus, 401, 'Invalid extension key must receive 401 Unauthorized');

  let extPassed = false;
  requireExtensionKey({ headers: { 'x-extension-key': config.security.extensionApiKey } }, extBlockRes, () => {
    extPassed = true;
  });
  assert.strictEqual(extPassed, true, 'Valid extension key must be granted access');

  console.log('    ✔ Role-based permissions and extension security guard passed');
}
