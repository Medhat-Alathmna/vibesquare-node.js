import mongoose from 'mongoose';
import { Pool } from 'pg';
import { env } from './env';

// PostgreSQL Pool (lazy initialization)
let _pgPool: Pool | null = null;

export const pgPool = new Proxy({} as Pool, {
  get(_, prop) {
    if (!_pgPool) {
      _pgPool = new Pool({
        host: env.POSTGRES_HOST,
        user: env.POSTGRES_USER,
        password: env.POSTGRES_PASSWORD,
        database: env.POSTGRES_DATABASE,
        max: 20,
        idleTimeoutMillis: env.POSTGRES_IDLE_TIMEOUT,
        connectionTimeoutMillis: env.POSTGRES_CONNECTION_TIMEOUT,
        ssl: env.POSTGRES_SSL ? { rejectUnauthorized: env.POSTGRES_REJECT_UNAUTHORIZED } : false
      });
    }
    return (_pgPool as any)[prop];
  }
});

// MongoDB Connection
export const connectMongoDB = async (): Promise<void> => {
  if (env.DB_TYPE !== 'mongodb') {
    console.log('DB_TYPE is not mongodb, skipping MongoDB connection');
    return;
  }

  if (!env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required when DB_TYPE is mongodb');
  }

  const options = {
    autoIndex: true,
    maxPoolSize: 10
  };

  await mongoose.connect(env.MONGODB_URI, options);
  console.log('MongoDB connected successfully');

  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected');
  });
};

// PostgreSQL Connection
export const connectPostgres = async (): Promise<void> => {
  if (env.DB_TYPE !== 'postgres') {
    console.log('DB_TYPE is not postgres, skipping PostgreSQL connection');
    return;
  }

  try {
    if (!_pgPool) {
      _pgPool = new Pool({
        host: env.POSTGRES_HOST,
        user: env.POSTGRES_USER,
        password: env.POSTGRES_PASSWORD,
        database: env.POSTGRES_DATABASE,
        max: 20,
        idleTimeoutMillis: env.POSTGRES_IDLE_TIMEOUT,
        connectionTimeoutMillis: env.POSTGRES_CONNECTION_TIMEOUT,
        ssl: true
      });
    }
    const client = await _pgPool.connect();
    console.log('PostgreSQL connected successfully');
    client.release();
  } catch (err) {
    console.error('PostgreSQL connection error:', err);
    throw err;
  }

  _pgPool.on('error', (err) => {
    console.error('PostgreSQL pool error:', err);
  });
};

// Connect to the selected database
export const connectDatabase = async (): Promise<void> => {
  console.log(`Connecting to database (type: ${env.DB_TYPE})...`);

  if (env.DB_TYPE === 'mongodb') {
    await connectMongoDB();
  } else {
    await connectPostgres();
  }
};
