import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import apiRoutes from './api';
import { errorConverter, errorHandler } from './middleware';
import { corsOptions } from './config';

const app: Express = express();

// Trust proxy - Required for Vercel/serverless environments
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// CORS with credentials
app.use(cors({
  ...corsOptions,
  credentials: true
}));

// Cookie parser
app.use(cookieParser());

// Request parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Compression
app.use(compression());

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  // Use X-Forwarded-For header for IP (Vercel/serverless)
  keyGenerator: (req) => {
    return req.ip || req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown';
  }
});
app.use('/api/', limiter);

// API routes
app.use('/api', apiRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorConverter);
app.use(errorHandler);

export default app;
