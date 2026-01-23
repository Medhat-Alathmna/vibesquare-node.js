import type { Knex } from 'knex';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'postgresql',
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
    migrations: {
      directory: path.join(__dirname, 'migrations'),
      extension: 'ts',
      tableName: 'knex_migrations',
    },
    seeds: {
      directory: path.join(__dirname, 'seeds'),
      extension: 'ts',
    },
  },

  production: {
    client: 'postgresql',
    connection: process.env.DATABASE_URL,
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      directory: path.join(__dirname, 'migrations'),
      extension: 'ts',
      tableName: 'knex_migrations',
    },
    seeds: {
      directory: path.join(__dirname, 'seeds'),
      extension: 'ts',
    },
  },
};

export default config;
