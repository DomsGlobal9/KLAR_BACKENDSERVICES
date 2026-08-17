/**
 * Prints the resolved database target as JSON, or exits non-zero with the
 * configuration error. Spawned by database-target.test.ts with a controlled
 * environment. Never opens a database connection.
 */
import { supabaseConfig } from '../config/supabase.config';

const info = supabaseConfig.describe();
console.log(JSON.stringify({
    environment: info.environment,
    target: info.target,
    projectRef: info.projectRef,
    health: supabaseConfig.healthStatus(),
}));
