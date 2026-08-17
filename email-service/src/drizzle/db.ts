import postgres from 'postgres';
import * as schema from './schemas';
import { drizzle } from 'drizzle-orm/postgres-js';
import { DATABASE_URL, supabaseConfig } from '../config/supabase.config';

const client = postgres(DATABASE_URL, { prepare: false });
export const db = drizzle(client, { schema });

/**
 * Verifies the process is actually talking to the intended database and prints a
 * credential-free fingerprint, so a wrong-environment deployment is obvious in
 * the first lines of the log instead of being discovered in the wrong dataset.
 */
export const verifyDatabaseIdentity = async (): Promise<void> => {
    const info = supabaseConfig.describe();
    console.log(`[database] environment=${info.environment}`);
    console.log(`[database] target=${info.target}`);
    console.log(`[database] host=${info.host} project=${info.projectRef}`);

    const [row] = await client<{ database: string; schema: string }[]>`
        SELECT current_database() AS database, current_schema() AS schema
    `;
    console.log(`[database] connected database=${row.database} schema=${row.schema}`);
};
