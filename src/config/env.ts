import dotenv from 'dotenv';
import Joi from 'joi';

dotenv.config();

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  DB_TYPE: Joi.string().valid('postgres', 'mongodb').default('postgres').description('Database type'),
  MONGODB_URI: Joi.string().optional().allow('').description('MongoDB connection string'),
  FRONTEND_URL: Joi.string().default('http://localhost:4200'),
  OPENAI_API_KEY: Joi.string().optional().allow(''),
  ANTHROPIC_API_KEY: Joi.string().optional().allow(''),
  GOOGLE_AI_KEY: Joi.string().optional().allow(''),

  // PostgreSQL
  POSTGRES_HOST: Joi.string().required().description('PostgreSQL host'),
  POSTGRES_USER: Joi.string().required().description('PostgreSQL username'),
  POSTGRES_PASSWORD: Joi.string().required().description('PostgreSQL password'),
  POSTGRES_DATABASE: Joi.string().required().description('PostgreSQL database name')
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
  OPENAI_API_KEY: envVars.OPENAI_API_KEY as string,
  ANTHROPIC_API_KEY: envVars.ANTHROPIC_API_KEY as string,
  GOOGLE_AI_KEY: envVars.GOOGLE_AI_KEY as string,

  // PostgreSQL
  POSTGRES_HOST: envVars.POSTGRES_HOST as string,
  POSTGRES_USER: envVars.POSTGRES_USER as string,
  POSTGRES_PASSWORD: envVars.POSTGRES_PASSWORD as string,
  POSTGRES_DATABASE: envVars.POSTGRES_DATABASE as string
};
