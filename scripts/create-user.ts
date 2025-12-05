#!/usr/bin/env npx tsx
/**
 * Create User Script
 *
 * Creates a new user account with a hashed password.
 *
 * Usage:
 *   npx tsx scripts/create-user.ts --email admin@entropy.app --password entropy123 --name "Admin User" --role admin
 *   npx tsx scripts/create-user.ts -e user@example.com -p mypassword
 */

import crypto from 'crypto';

// ============================================================================
// Password Hashing
// ============================================================================

async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

// ============================================================================
// Database Connection
// ============================================================================

interface DbClient {
  query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
  end?: () => Promise<void>;
}

async function getDbClient(): Promise<DbClient | null> {
  // Try to use @entropy/shared database client
  try {
    const { getDatabase } = await import('@entropy/shared');
    return getDatabase() as DbClient;
  } catch {
    // Fallback to direct pg connection
    try {
      const pg = await import('pg');
      const client = new pg.default.Client({
        connectionString:
          process.env.DATABASE_URL || 'postgresql://entropy:entropy@localhost:5432/entropy_dev',
      });
      await client.connect();
      return client as DbClient;
    } catch (err) {
      console.error('Failed to connect to database:', err);
      return null;
    }
  }
}

// ============================================================================
// CLI
// ============================================================================

interface UserOptions {
  email: string;
  password: string;
  name?: string;
  role: 'admin' | 'product_manager' | 'developer' | 'viewer';
}

function parseArgs(): UserOptions {
  const args = process.argv.slice(2);
  const options: Partial<UserOptions> = {
    role: 'admin',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--email':
      case '-e':
        options.email = nextArg;
        i++;
        break;
      case '--password':
      case '-p':
        options.password = nextArg;
        i++;
        break;
      case '--name':
      case '-n':
        options.name = nextArg;
        i++;
        break;
      case '--role':
      case '-r':
        options.role = nextArg as UserOptions['role'];
        i++;
        break;
      case '--help':
      case '-h':
        console.log(`
Create User Script

Usage:
  npx tsx scripts/create-user.ts [options]

Options:
  -e, --email <email>      User email (required)
  -p, --password <pass>    User password (required)
  -n, --name <name>        User display name (optional)
  -r, --role <role>        User role: admin, product_manager, developer, viewer (default: admin)
  -h, --help               Show this help message

Examples:
  npx tsx scripts/create-user.ts -e admin@entropy.app -p entropy123
  npx tsx scripts/create-user.ts --email user@test.com --password secret --name "Test User" --role developer
        `);
        process.exit(0);
    }
  }

  if (!options.email || !options.password) {
    console.error('Error: Email and password are required');
    console.error('Run with --help for usage information');
    process.exit(1);
  }

  return options as UserOptions;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const options = parseArgs();

  console.log(`\n🔐 Creating user: ${options.email}`);
  console.log(`   Role: ${options.role}`);
  console.log(`   Name: ${options.name || options.email.split('@')[0]}\n`);

  // Hash password
  console.log('Hashing password...');
  const passwordHash = await hashPassword(options.password);

  // Connect to database
  console.log('Connecting to database...');
  const db = await getDbClient();
  if (!db) {
    console.error('Failed to connect to database');
    process.exit(1);
  }

  try {
    // Check if user exists
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [options.email]);
    if ((existing.rows as unknown[]).length > 0) {
      console.log('\n⚠️  User already exists. Updating password...');
      await db.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2', [
        passwordHash,
        options.email,
      ]);
      console.log('✅ Password updated successfully!\n');
    } else {
      // Create user
      const result = await db.query(
        `INSERT INTO users (email, name, role, password_hash, client_id)
         VALUES ($1, $2, $3, $4, '00000000-0000-0000-0000-000000000001')
         RETURNING id, email, name, role`,
        [options.email, options.name || options.email.split('@')[0], options.role, passwordHash]
      );

      const user = result.rows[0] as { id: string; email: string; name: string; role: string };
      console.log('\n✅ User created successfully!');
      console.log(`   ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Name: ${user.name}`);
      console.log(`   Role: ${user.role}\n`);
    }

    console.log('You can now login with:');
    console.log(`   Email: ${options.email}`);
    console.log(`   Password: ${options.password}\n`);
  } catch (error) {
    console.error('Failed to create user:', error);
    process.exit(1);
  } finally {
    if (db.end) {
      await db.end();
    }
  }
}

main().catch(console.error);
