import dotenv from 'dotenv';
import Joi from 'joi';

dotenv.config();

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  DB_TYPE: Joi.string().valid('postgres', 'mongodb').default('postgres').description('Database type'),
  MONGODB_URI: Joi.string().optional().allow('').description('MongoDB connection string'),
  FRONTEND_URL: Joi.string().default('http://localhost:4200'),
  ADMIN_URL: Joi.string().default('http://localhost:4300'),
  OPENAI_API_KEY: Joi.string().optional().allow(''),
  ANTHROPIC_API_KEY: Joi.string().optional().allow(''),
  GOOGLE_AI_KEY: Joi.string().optional().allow(''),

  // PostgreSQL
  POSTGRES_HOST: Joi.string().required().description('PostgreSQL host'),
  POSTGRES_USER: Joi.string().required().description('PostgreSQL username'),
  POSTGRES_PASSWORD: Joi.string().required().description('PostgreSQL password'),
  POSTGRES_DATABASE: Joi.string().required().description('PostgreSQL database name'),

  // JWT Configuration
  JWT_SECRET: Joi.string().min(32).default('your-super-secret-jwt-key-change-in-production-min-32-chars'),
  JWT_ACCESS_EXPIRATION: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRATION: Joi.string().default('7d'),

  // OAuth - Google
  GOOGLE_CLIENT_ID: Joi.string().optional().allow(''),
  GOOGLE_CLIENT_SECRET: Joi.string().optional().allow(''),
  GOOGLE_CALLBACK_URL: Joi.string().default('http://localhost:3000/api/auth/google/callback'),

  // OAuth - GitHub
  GITHUB_CLIENT_ID: Joi.string().optional().allow(''),
  GITHUB_CLIENT_SECRET: Joi.string().optional().allow(''),
  GITHUB_CALLBACK_URL: Joi.string().default('http://localhost:3000/api/auth/github/callback'),

  // SendGrid Email
  SENDGRID_API_KEY: Joi.string().optional().allow(''),
  SENDGRID_FROM_EMAIL: Joi.string().email().default('noreply@vibesquare.io'),
  SENDGRID_FROM_NAME: Joi.string().default('VibeSquare'),

  // Security
  BCRYPT_ROUNDS: Joi.number().min(10).max(14).default(12),
  RATE_LIMIT_WINDOW_MS: Joi.number().default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(100),
  LOGIN_RATE_LIMIT_MAX: Joi.number().default(5),
  ACCOUNT_LOCKOUT_MINUTES: Joi.number().default(30),

  // Default Admin
  DEFAULT_ADMIN_EMAIL: Joi.string().email().default('admin@vibesquare.io'),
  DEFAULT_ADMIN_PASSWORD: Joi.string().min(12).default('VibeSquare@Admin2025!')
}).unknown();

const { value: envVars, error } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

export const env = {
  NODE_ENV: envVars.NODE_ENV as string,
  PORT: envVars.PORT as number,
  DB_TYPE: envVars.DB_TYPE as 'postgres' | 'mongodb',
  MONGODB_URI: envVars.MONGODB_URI as string,
  FRONTEND_URL: envVars.FRONTEND_URL as string,
  ADMIN_URL: envVars.ADMIN_URL as string,
  OPENAI_API_KEY: envVars.OPENAI_API_KEY as string,
  ANTHROPIC_API_KEY: envVars.ANTHROPIC_API_KEY as string,
  GOOGLE_AI_KEY: envVars.GOOGLE_AI_KEY as string,

  // PostgreSQL
  POSTGRES_HOST: envVars.POSTGRES_HOST as string,
  POSTGRES_USER: envVars.POSTGRES_USER as string,
  POSTGRES_PASSWORD: envVars.POSTGRES_PASSWORD as string,
  POSTGRES_DATABASE: envVars.POSTGRES_DATABASE as string,

  // JWT
  JWT_SECRET: envVars.JWT_SECRET as string,
  JWT_ACCESS_EXPIRATION: envVars.JWT_ACCESS_EXPIRATION as string,
  JWT_REFRESH_EXPIRATION: envVars.JWT_REFRESH_EXPIRATION as string,

  // OAuth - Google
  GOOGLE_CLIENT_ID: envVars.GOOGLE_CLIENT_ID as string,
  GOOGLE_CLIENT_SECRET: envVars.GOOGLE_CLIENT_SECRET as string,
  GOOGLE_CALLBACK_URL: envVars.GOOGLE_CALLBACK_URL as string,

  // OAuth - GitHub
  GITHUB_CLIENT_ID: envVars.GITHUB_CLIENT_ID as string,
  GITHUB_CLIENT_SECRET: envVars.GITHUB_CLIENT_SECRET as string,
  GITHUB_CALLBACK_URL: envVars.GITHUB_CALLBACK_URL as string,

  // SendGrid
  SENDGRID_API_KEY: envVars.SENDGRID_API_KEY as string,
  SENDGRID_FROM_EMAIL: envVars.SENDGRID_FROM_EMAIL as string,
  SENDGRID_FROM_NAME: envVars.SENDGRID_FROM_NAME as string,

  // Security
  BCRYPT_ROUNDS: envVars.BCRYPT_ROUNDS as number,
  RATE_LIMIT_WINDOW_MS: envVars.RATE_LIMIT_WINDOW_MS as number,
  RATE_LIMIT_MAX_REQUESTS: envVars.RATE_LIMIT_MAX_REQUESTS as number,
  LOGIN_RATE_LIMIT_MAX: envVars.LOGIN_RATE_LIMIT_MAX as number,
  ACCOUNT_LOCKOUT_MINUTES: envVars.ACCOUNT_LOCKOUT_MINUTES as number,

  // Default Admin
  DEFAULT_ADMIN_EMAIL: envVars.DEFAULT_ADMIN_EMAIL as string,
  DEFAULT_ADMIN_PASSWORD: envVars.DEFAULT_ADMIN_PASSWORD as string
};
