// Database client for PostgreSQL connection management

import { Pool, PoolClient, PoolConfig, QueryResult, QueryResultRow } from 'pg';

/**
 * Database configuration options
 */
export interface DatabaseConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  poolSize?: number;
  idleTimeoutMs?: number;
  connectionTimeoutMs?: number;
  ssl?: boolean | { rejectUnauthorized: boolean };
}

/**
 * Query result with typed rows
 */
export interface TypedQueryResult<T extends QueryResultRow> extends QueryResult<T> {
  rows: T[];
}

/**
 * Transaction function type
 */
export type TransactionFn<T> = (client: PoolClient) => Promise<T>;

/**
 * Database client singleton for managing PostgreSQL connections
 */
export class DatabaseClient {
  private static instance: DatabaseClient | null = null;
  private pool: Pool | null = null;
  private config: DatabaseConfig;

  private constructor(config: DatabaseConfig) {
    this.config = config;
  }

  /**
   * Get the singleton database client instance
   */
  static getInstance(config?: DatabaseConfig): DatabaseClient {
    if (!DatabaseClient.instance) {
      if (!config) {
        throw new Error('Database configuration required for first initialization');
      }
      DatabaseClient.instance = new DatabaseClient(config);
    }
    return DatabaseClient.instance;
  }

  /**
   * Initialize the database client with configuration from environment
   */
  static fromEnv(): DatabaseClient {
    const config: DatabaseConfig = {
      connectionString: process.env.DATABASE_URL,
      poolSize: parseInt(process.env.DATABASE_POOL_SIZE || '20', 10),
      idleTimeoutMs: parseInt(process.env.DATABASE_IDLE_TIMEOUT_MS || '30000', 10),
      connectionTimeoutMs: parseInt(process.env.DATABASE_CONNECTION_TIMEOUT_MS || '10000', 10),
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
    };
    return DatabaseClient.getInstance(config);
  }

  /**
   * Connect to the database
   */
  async connect(): Promise<void> {
    if (this.pool) {
      return; // Already connected
    }

    const poolConfig: PoolConfig = {
      connectionString: this.config.connectionString,
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      max: this.config.poolSize || 20,
      idleTimeoutMillis: this.config.idleTimeoutMs || 30000,
      connectionTimeoutMillis: this.config.connectionTimeoutMs || 10000,
      ssl: this.config.ssl,
    };

    this.pool = new Pool(poolConfig);

    // Test connection
    const client = await this.pool.connect();
    try {
      await client.query('SELECT 1');
    } finally {
      client.release();
    }
  }

  /**
   * Disconnect from the database
   */
  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
    DatabaseClient.instance = null;
  }

  /**
   * Get the connection pool
   */
  getPool(): Pool {
    if (!this.pool) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.pool;
  }

  /**
   * Execute a query
   */
  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<TypedQueryResult<T>> {
    const pool = this.getPool();
    const startTime = Date.now();

    try {
      const result = await pool.query<T>(text, params);
      const duration = Date.now() - startTime;

      // Log slow queries (> 100ms)
      if (duration > 100) {
        console.warn(`Slow query (${duration}ms): ${text.substring(0, 100)}...`);
      }

      return result;
    } catch (error) {
      console.error('Query error:', { text: text.substring(0, 100), error });
      throw error;
    }
  }

  /**
   * Execute a query and return the first row or null
   */
  async queryOne<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<T | null> {
    const result = await this.query<T>(text, params);
    return result.rows[0] || null;
  }

  /**
   * Execute a query and return all rows
   */
  async queryAll<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<T[]> {
    const result = await this.query<T>(text, params);
    return result.rows;
  }

  /**
   * Execute a query within a transaction
   */
  async withTransaction<T>(fn: TransactionFn<T>): Promise<T> {
    const pool = this.getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Execute a query within a transaction with savepoint support
   */
  async withSavepoint<T>(
    client: PoolClient,
    savepointName: string,
    fn: () => Promise<T>
  ): Promise<T> {
    try {
      await client.query(`SAVEPOINT ${savepointName}`);
      const result = await fn();
      await client.query(`RELEASE SAVEPOINT ${savepointName}`);
      return result;
    } catch (error) {
      await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
      throw error;
    }
  }

  /**
   * Check if the database connection is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.queryOne('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get pool statistics
   */
  getPoolStats(): {
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  } {
    const pool = this.getPool();
    return {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
    };
  }
}

/**
 * Helper to build parameterized queries
 */
export class QueryBuilder {
  private paramIndex = 1;
  private values: unknown[] = [];

  /**
   * Add a parameter and return its placeholder
   */
  param(value: unknown): string {
    this.values.push(value);
    return `$${this.paramIndex++}`;
  }

  /**
   * Get all parameter values
   */
  getValues(): unknown[] {
    return this.values;
  }

  /**
   * Reset the builder
   */
  reset(): void {
    this.paramIndex = 1;
    this.values = [];
  }

  /**
   * Build an INSERT statement
   */
  static insert(
    table: string,
    data: Record<string, unknown>,
    returning: string[] = ['*']
  ): { text: string; values: unknown[] } {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map((_, i) => `$${i + 1}`);

    const text = `
      INSERT INTO ${table} (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING ${returning.join(', ')}
    `.trim();

    return { text, values };
  }

  /**
   * Build an UPDATE statement
   */
  static update(
    table: string,
    data: Record<string, unknown>,
    whereColumn: string,
    whereValue: unknown,
    returning: string[] = ['*']
  ): { text: string; values: unknown[] } {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const setClause = columns.map((col, i) => `${col} = $${i + 1}`);

    const text = `
      UPDATE ${table}
      SET ${setClause.join(', ')}
      WHERE ${whereColumn} = $${columns.length + 1}
      RETURNING ${returning.join(', ')}
    `.trim();

    return { text, values: [...values, whereValue] };
  }
}

// Export a convenience function for getting the database client
export function getDatabase(config?: DatabaseConfig): DatabaseClient {
  if (config) {
    return DatabaseClient.getInstance(config);
  }
  return DatabaseClient.fromEnv();
}
