import { config } from '../config/env.js';

/**
 * Authentication and RBAC Middleware.
 * Supports token authorization or mock session roles for development & dashboard testing.
 */
export function requireAuth(allowedRoles = ['ADMIN', 'SUPERADMIN']) {
  return (req, res, next) => {
    // 1. Check custom role header or Bearer authorization
    const roleHeader = req.headers['x-user-role'];
    const authHeader = req.headers['authorization'];

    let userRole = 'ADMIN'; // Default fallback role in dev
    let userId = 'admin_user_01';

    if (roleHeader) {
      userRole = roleHeader.toUpperCase();
    } else if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      if (token === 'superadmin-token') {
        userRole = 'SUPERADMIN';
        userId = 'superadmin_01';
      } else if (token === 'admin-token') {
        userRole = 'ADMIN';
        userId = 'admin_01';
      }
    }

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Role '${userRole}' is not permitted to access this resource. Required: ${allowedRoles.join(', ')}`
      });
    }

    req.user = {
      id: userId,
      role: userRole,
      name: userRole === 'SUPERADMIN' ? 'Senior Managing Partner' : 'MCA Compliance Associate'
    };

    next();
  };
}

/**
 * Extension API Key Middleware.
 * Ensures only authorized MCA browser extension callers can access client dossier handoff.
 */
export function requireExtensionKey(req, res, next) {
  const extensionKey = req.headers['x-extension-key'];
  if (!extensionKey || extensionKey !== config.security.extensionApiKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or missing MCA Extension API Key'
    });
  }
  next();
}
