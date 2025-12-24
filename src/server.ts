import app from './app';
import { connectDatabase, env } from './config';

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDatabase();
    console.log(`Connected to ${env.DB_TYPE === 'mongodb' ? 'MongoDB' : 'PostgreSQL'}`);

    // Start server
    app.listen(env.PORT, () => {
      console.log(`Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
      console.log(`Health check: http://localhost:${env.PORT}/health`);
      console.log(`API base URL: http://localhost:${env.PORT}/api`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
