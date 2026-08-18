import { envConfig, requiredEnv } from './env.config';

/**
 * Single owner of database selection for the whole service.
 *
 * NODE_ENV=production  -> SUPABASE_PRODUCTION_DATABASE_URL
 * NODE_ENV=development -> SUPABASE_DEVELOPMENT_DATABASE_URL
 * NODE_ENV=test        -> SUPABASE_DEVELOPMENT_DATABASE_URL (never production)
 * anything else        -> startup failure (see env.config.ts)
 *
 * There is no fallback: a misconfigured environment must stop the process, never
 * quietly resolve to a different database than the operator intended.
 */
export type DatabaseTarget = 'production' | 'development';

const targetForEnvironment = (nodeEnv: typeof envConfig.NODE_ENV): DatabaseTarget =>
    nodeEnv === 'production' ? 'production' : 'development';

/** Host/database/project only — never user, password, or query string. */
export const describeDatabaseUrl = (url: string) => {
    try {
        const parsed = new URL(url);
        return {
            host: parsed.host,
            database: parsed.pathname.replace(/^\//, '') || 'unknown',
            // Supabase pooler usernames are "postgres.<project-ref>"; the ref is not a secret.
            projectRef: decodeURIComponent(parsed.username).split('.')[1] || 'unknown',
        };
    } catch {
        return { host: 'unparseable', database: 'unknown', projectRef: 'unknown' };
    }
};

const resolve = (): { target: DatabaseTarget; url: string } => {
    const target = targetForEnvironment(envConfig.NODE_ENV);

    const url = target === 'production'
        ? requiredEnv('SUPABASE_PRODUCTION_DATABASE_URL', envConfig.SUPABASE_PRODUCTION_DATABASE_URL)
        : requiredEnv('SUPABASE_DEVELOPMENT_DATABASE_URL', envConfig.SUPABASE_DEVELOPMENT_DATABASE_URL);

    /**
     * Data-integrity guard: production must never end up on the development
     * database, even if the two variables were filled in with the same value.
     */
    if (target === 'production') {
        const developmentUrl = envConfig.SUPABASE_DEVELOPMENT_DATABASE_URL;
        const sameAsDevelopment = developmentUrl
            && describeDatabaseUrl(url).projectRef === describeDatabaseUrl(developmentUrl).projectRef;

        if (sameAsDevelopment) {
            throw new Error(
                'Refusing to start: NODE_ENV=production but SUPABASE_PRODUCTION_DATABASE_URL points at the same ' +
                `Supabase project as SUPABASE_DEVELOPMENT_DATABASE_URL (project=${describeDatabaseUrl(url).projectRef}). ` +
                'Production email must never be written to the development database.'
            );
        }
    }

    return { target, url };
};

const resolved = resolve();

export const supabaseConfig = {
    getDatabaseUrl: (): string => resolved.url,
    getDatabaseTarget: (): DatabaseTarget => resolved.target,
    /** Safe for logs and health output. */
    describe: () => ({
        environment: envConfig.NODE_ENV,
        target: resolved.target,
        ...describeDatabaseUrl(resolved.url),
    }),
    /**
     * Exactly what GET /health publishes. Routing facts only — host, project ref
     * and credentials stay in the server log, which is not publicly reachable.
     */
    healthStatus: () => ({
        environment: envConfig.NODE_ENV,
        databaseTarget: resolved.target,
    }),
};

export const DATABASE_URL = resolved.url;
export const DATABASE_TARGET = resolved.target;
