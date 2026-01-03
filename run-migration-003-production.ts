import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load env
dotenv.config();

async function runMigrationOnProduction() {
    console.log('🚀 Running Migration 003 on PRODUCTION database...');
    console.log(`📍 Host: ${process.env.POSTGRES_HOST}`);
    console.log(`📍 Database: ${process.env.POSTGRES_DATABASE}`);
    console.log('');

    // Safety check - ask for confirmation
    console.log('⚠️  WARNING: This will modify the PRODUCTION database!');
    console.log('⚠️  Make sure you have a backup before proceeding.');
    console.log('');

    const pool = new Pool({
        host: process.env.POSTGRES_HOST,
        user: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
        database: process.env.POSTGRES_DATABASE,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        // First, verify current state
        console.log('1️⃣ Checking current token column length...');
        const beforeCheck = await pool.query(`
            SELECT column_name, data_type, character_maximum_length
            FROM information_schema.columns
            WHERE table_name = 'gallery_refresh_tokens' AND column_name = 'token';
        `);

        if (beforeCheck.rows.length === 0) {
            console.error('❌ Table or column not found!');
            process.exit(1);
        }

        const currentLength = beforeCheck.rows[0].character_maximum_length;
        console.log(`   Current length: ${currentLength}`);

        if (currentLength === 500) {
            console.log('✅ Migration already applied! Token length is 500.');
            console.log('   Nothing to do.');
            process.exit(0);
        }

        // Read the migration SQL
        console.log('');
        console.log('2️⃣ Reading migration file...');
        const sqlPath = path.join(__dirname, 'migrations', '003_fix_refresh_token_length.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log('   ✅ Migration file loaded');

        // Execute the migration
        console.log('');
        console.log('3️⃣ Executing migration...');
        await pool.query(sql);
        console.log('   ✅ Migration executed successfully!');

        // Verify the change
        console.log('');
        console.log('4️⃣ Verifying migration...');
        const afterCheck = await pool.query(`
            SELECT column_name, data_type, character_maximum_length
            FROM information_schema.columns
            WHERE table_name = 'gallery_refresh_tokens' AND column_name = 'token';
        `);

        const newLength = afterCheck.rows[0].character_maximum_length;
        console.log(`   New length: ${newLength}`);

        if (newLength === 500) {
            console.log('');
            console.log('✅✅✅ MIGRATION SUCCESSFUL! ✅✅✅');
            console.log('');
            console.log('📊 Summary:');
            console.log(`   - Before: VARCHAR(${currentLength})`);
            console.log(`   - After:  VARCHAR(${newLength})`);
            console.log('');
            console.log('🎉 Google OAuth should work now!');
        } else {
            console.error('');
            console.error('❌ MIGRATION FAILED!');
            console.error(`   Token length is still ${newLength}`);
            process.exit(1);
        }

    } catch (err) {
        console.error('');
        console.error('❌ Migration failed with error:');
        console.error(err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigrationOnProduction();
