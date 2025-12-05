// Authentication routes

import { createLogger } from '@entropy/shared';
import crypto from 'crypto';
import { Router, type IRouter, type Request, type Response } from 'express';

const logger = createLogger('auth');

export const authRouter: IRouter = Router();

// Database client (lazy loaded)
let dbClient: {
  query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
} | null = null;

async function getDbClient() {
  if (dbClient) return dbClient;
  try {
    const { getDatabase } = await import('@entropy/shared');
    dbClient = getDatabase();
    return dbClient;
  } catch {
    return null;
  }
}

// Simple JWT-like token (for development - use proper JWT in production)
function generateToken(userId: string): string {
  const payload = {
    userId,
    exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64');
  const signature = crypto
    .createHmac('sha256', process.env.JWT_SECRET || 'entropy-dev-secret')
    .update(data)
    .digest('base64');
  return `${data}.${signature}`;
}

function verifyToken(token: string): { userId: string } | null {
  try {
    const [data, signature] = token.split('.');
    const expectedSignature = crypto
      .createHmac('sha256', process.env.JWT_SECRET || 'entropy-dev-secret')
      .update(data)
      .digest('base64');

    if (signature !== expectedSignature) return null;

    const payload = JSON.parse(Buffer.from(data, 'base64').toString());
    if (payload.exp < Date.now()) return null;

    return { userId: payload.userId };
  } catch {
    return null;
  }
}

// Password hashing using scrypt
async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const [salt, key] = hash.split(':');
    if (!salt || !key) {
      resolve(false);
      return;
    }
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      resolve(key === derivedKey.toString('hex'));
    });
  });
}

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  client_id: string;
  is_active: boolean;
  password_hash: string;
}

/**
 * POST /api/v1/auth/login
 * Authenticate user with email and password
 */
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const db = await getDbClient();
    if (!db) {
      logger.error('Database not available for auth');
      res.status(503).json({ error: 'Service temporarily unavailable' });
      return;
    }

    // Find user by email
    const result = await db.query(
      'SELECT id, email, name, role, client_id, is_active, password_hash FROM users WHERE email = $1',
      [username]
    );

    const user = result.rows[0] as User | undefined;

    if (!user) {
      logger.warn('Login attempt for non-existent user', { email: username });
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    if (!user.is_active) {
      logger.warn('Login attempt for inactive user', { email: username });
      res.status(401).json({ error: 'Account is disabled' });
      return;
    }

    if (!user.password_hash) {
      logger.warn('Login attempt for user without password', { email: username });
      res.status(401).json({ error: 'Password not set for this account' });
      return;
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      logger.warn('Invalid password attempt', { email: username });
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Update last login
    await db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    // Generate token
    const token = generateToken(user.id);

    logger.info('User logged in successfully', { userId: user.id, email: user.email });

    res.json({
      user: {
        id: user.id,
        username: user.email,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    logger.error('Login error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/auth/me
 * Get current authenticated user
 */
authRouter.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    if (!payload) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    const db = await getDbClient();
    if (!db) {
      res.status(503).json({ error: 'Service temporarily unavailable' });
      return;
    }

    const result = await db.query(
      'SELECT id, email, name, role, client_id, is_active FROM users WHERE id = $1',
      [payload.userId]
    );

    const user = result.rows[0] as Omit<User, 'password_hash'> | undefined;

    if (!user || !user.is_active) {
      res.status(401).json({ error: 'User not found or inactive' });
      return;
    }

    res.json({
      id: user.id,
      username: user.email,
      email: user.email,
      name: user.name,
      role: user.role,
    });
  } catch (error) {
    logger.error('Get user error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/auth/logout
 * Logout current user (client-side token removal)
 */
authRouter.post('/logout', (_req: Request, res: Response) => {
  // Token-based auth - logout is client-side
  // In production, you might want to maintain a token blacklist
  res.json({ success: true });
});

/**
 * POST /api/v1/auth/register
 * Register a new user (admin only in production)
 */
authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name, role = 'viewer' } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    const validRoles = ['admin', 'product_manager', 'developer', 'viewer'];
    if (!validRoles.includes(role)) {
      res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
      return;
    }

    const db = await getDbClient();
    if (!db) {
      res.status(503).json({ error: 'Service temporarily unavailable' });
      return;
    }

    // Check if user exists
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if ((existing.rows as unknown[]).length > 0) {
      res.status(409).json({ error: 'User with this email already exists' });
      return;
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const result = await db.query(
      `INSERT INTO users (email, name, role, password_hash, client_id)
       VALUES ($1, $2, $3, $4, '00000000-0000-0000-0000-000000000001')
       RETURNING id, email, name, role`,
      [email, name || email.split('@')[0], role, passwordHash]
    );

    const user = result.rows[0] as { id: string; email: string; name: string; role: string };

    logger.info('User registered', { userId: user.id, email: user.email });

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    logger.error('Registration error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});
