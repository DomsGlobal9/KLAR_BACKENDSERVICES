/**
 * PM2 deployment config.
 *
 * NODE_ENV is set explicitly here because it selects the target database.
 * Without it PM2 inherits whatever the deploying shell happened to have, which
 * is how production ended up writing to the development database.
 *
 * Secrets (SUPABASE_*_DATABASE_URL, AWS_*, REDIS_PASSWORD) are NOT stored here.
 * They come from the .env file on the host — see .env.example.
 *
 * Start production with:   pm2 start ecosystem.config.js --env production
 * Start development with:  pm2 start ecosystem.config.js --env development
 *
 * The base env deliberately sets no NODE_ENV: starting without --env makes the
 * service refuse to boot rather than guess which database to write to.
 */
module.exports = {
    apps: [
        {
            name: 'klar-crm-backend-email-server',
            script: 'dist/server.js',
            instances: 1,
            exec_mode: 'fork',
            autorestart: true,
            max_memory_restart: '512M',
            env: {},
            env_development: {
                NODE_ENV: 'development',
            },
            env_production: {
                NODE_ENV: 'production',
            },
        },
    ],
};
