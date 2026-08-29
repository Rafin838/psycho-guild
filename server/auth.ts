import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { AdminUser } from '../src/types.js';

export interface AuthenticatedRequest extends Request {
  user?: AdminUser;
}

export function isProductionEnv(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    Boolean(process.env.NETLIFY) ||
    Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) ||
    Boolean(process.env.NETLIFY_BLOBS_CONTEXT) ||
    Boolean(process.env.URL)
  );
}

export function getAdminConfig(): {
  isConfigured: boolean;
  adminEmail: string;
  adminPassword?: string;
  jwtSecret?: string;
  error?: string;
} {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const jwtSecret = process.env.JWT_SECRET;

  if (isProductionEnv()) {
    // In production, strictly require environment variables
    if (!adminEmail || !adminPassword || !jwtSecret) {
      return {
        isConfigured: false,
        adminEmail: '',
        error:
          'Admin authentication is not configured in production. Please set ADMIN_EMAIL, ADMIN_PASSWORD, and JWT_SECRET in Netlify environment variables.',
      };
    }

    return {
      isConfigured: true,
      adminEmail: adminEmail.trim(),
      adminPassword: adminPassword.trim(),
      jwtSecret: jwtSecret.trim(),
    };
  }

  // Development environment fallback
  return {
    isConfigured: true,
    adminEmail: (adminEmail || 'rafin2250@gmail.com').trim(),
    adminPassword: (adminPassword || 'rafin@1214').trim(),
    jwtSecret: (jwtSecret || 'guild_sys_dev_jwt_secret_token_secure_9281734').trim(),
  };
}

export function authenticateAdmin(
  email: string,
  password: string
): { success: boolean; token?: string; user?: AdminUser; message?: string } {
  const config = getAdminConfig();

  if (!config.isConfigured || !config.adminPassword || !config.jwtSecret) {
    return {
      success: false,
      message:
        config.error ||
        'Server authentication is not configured. Please set ADMIN_EMAIL, ADMIN_PASSWORD, and JWT_SECRET in environment variables.',
    };
  }

  const normalizedEmail = (email || '').trim().toLowerCase();
  const targetEmail = config.adminEmail.toLowerCase();

  if (normalizedEmail !== targetEmail || (password || '').trim() !== config.adminPassword) {
    return { success: false, message: 'Invalid admin email or password' };
  }

  const user: AdminUser = {
    email: config.adminEmail,
    name: 'Guild Master / Admin',
    role: 'admin',
  };

  const token = jwt.sign(
    { email: user.email, role: user.role, name: user.name },
    config.jwtSecret,
    { expiresIn: '7d' }
  );

  return { success: true, token, user };
}

export function verifyAdminToken(token: string): AdminUser | null {
  try {
    const config = getAdminConfig();
    if (!config.isConfigured || !config.jwtSecret) {
      return null;
    }

    const decoded = jwt.verify(token, config.jwtSecret) as AdminUser;
    if (decoded && decoded.role === 'admin') {
      return decoded;
    }
    return null;
  } catch {
    return null;
  }
}

export function requireAdminAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.query.token && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Admin authentication token required',
    });
  }

  const user = verifyAdminToken(token);
  if (!user) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Invalid or expired admin token',
    });
  }

  req.user = user;
  next();
}
