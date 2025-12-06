#!/usr/bin/env npx tsx
/**
 * Database Migration Script
 * Runs SQL migration files in order against PostgreSQL
 */

import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import pg from 'pg';

const { Pool } = pg;

const MIGRATIONS_DIR = join(import.meta.dirname, '..', 'database', 'migrations');

async function getMigrationFiles(): Promise<string[]> {
  const files = await readdir(MIGRATIONS_DIR);
  return files
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => {
      // Sort by numeric prefix (001, 002, etc.)
      const numA = parseInt(a.split('_')[0] || '0', 10);
      const numB = parseInt(b.split('_')[0] || '0', 10);
      return numA - numB;
    });
}

async function ensureMigrationsTable(pool: pg.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
}

async function getExecutedMigrations(pool: pg.Pool): Promise<Set<string>> {
  const result = await pool.query('SELECT name FROM _migrations ORDER BY id');
  return new Set(result.rows.map((r) => r.name as string));
}

async function runMigration(pool: pg.Pool, filename: string): Promise<void> {
  const filepath = join(MIGRATIONS_DIR, filename);
  const sql = await readFile(filepath, 'utf-8');

  console.log(`  Running migration: ${filename}`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Execute the migration SQL
    await client.query(sql);

    // Record the migration
    await client.query('INSERT INTO _migrations (name) VALUES ($1)', [filename]);

    await client.query('COMMIT');
    console.log(`  ✓ Migration ${filename} completed`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`  ✗ Migration ${filename} failed:`, error);
    throw error;
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL environment variable is not set');
    console.error('');
    console.error('Set it in your .env file or run:');
    console.error('  export DATABASE_URL=postgresql://entropy:entropy@localhost:5432/entropy_dev');
    process.exit(1);
  }

  console.log('');
  console.log('=== Entropy Database Migration ===');
  console.log('');
  console.log(`Database: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`);
  console.log('');

  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
  });

  try {
    // Test connection
    console.log('Connecting to database...');
    await pool.query('SELECT 1');
    console.log('Connected successfully!');
    console.log('');

    // Ensure migrations table exists
    await ensureMigrationsTable(pool);

    // Get list of migrations
    const migrationFiles = await getMigrationFiles();
    const executedMigrations = await getExecutedMigrations(pool);

    console.log(`Found ${migrationFiles.length} migration files`);
    console.log(`Already executed: ${executedMigrations.size}`);
    console.log('');

    // Run pending migrations
    const pendingMigrations = migrationFiles.filter((f) => !executedMigrations.has(f));

    if (pendingMigrations.length === 0) {
      console.log('No pending migrations to run.');
    } else {
      console.log(`Running ${pendingMigrations.length} pending migrations...`);
      console.log('');

      for (const migration of pendingMigrations) {
        await runMigration(pool, migration);
      }

      console.log('');
      console.log('All migrations completed successfully!');
    }

    // Show current migration status
    console.log('');
    console.log('Migration status:');
    for (const file of migrationFiles) {
      const status = executedMigrations.has(file) || pendingMigrations.includes(file) ? '✓' : '○';
      console.log(`  ${status} ${file}`);
    }
  } catch (error) {
    console.error('');
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }

  console.log('');
  console.log('=== Migration Complete ===');
  console.log('');
}

main();
