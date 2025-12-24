import { env } from './src/config/env';

console.log('Checking environment configuration...');
console.log(`POSTGRES_CONNECTION_TIMEOUT: ${env.POSTGRES_CONNECTION_TIMEOUT}`);
console.log(`POSTGRES_IDLE_TIMEOUT: ${env.POSTGRES_IDLE_TIMEOUT}`);

if (env.POSTGRES_CONNECTION_TIMEOUT === 30000 && env.POSTGRES_IDLE_TIMEOUT === 30000) {
    console.log('SUCCESS: Defaults are correctly set.');
} else {
    console.error('FAILURE: Defaults are not set correctly.');
    process.exit(1);
}
