import knex, { Knex } from 'knex';
import { env } from './env';

/**
 * Knex instance for query building in repositories
 * This is separate from the migration knex instance
 */
let knexInstance: Knex | null = null;

export function getKnex(): Knex {
  if (!knexInstance) {
    knexInstance = knex({
      client: 'pg',
      connection: process.env.DATABASE_URL || {
        host: process.env.PGHOST,
        port: 5432,
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        database: process.env.PGDATABASE,
        ssl: { rejectUnauthorized: false },
      },
      pool: {
        min: 2,
        max: 10,
      },
      // Enable debug mode in development
      debug: env.NODE_ENV === 'development' ? false : false,
    });
  }

  return knexInstance;
}

/**
 * Close the Knex connection pool
 * Call this when shutting down the application
 */
export async function closeKnex(): Promise<void> {
  if (knexInstance) {
    await knexInstance.destroy();
    knexInstance = null;
  }
}
