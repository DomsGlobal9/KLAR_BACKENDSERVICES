/**
 * Guards the deployment surface, not the runtime: PM2 must carry an explicit
 * NODE_ENV into the process, and no start/restart script may launch the server
 * in a way that bypasses ecosystem.config.js and inherits the shell's NODE_ENV.
 * That bypass is how production email ended up in the development database.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

const ROOT = path.join(__dirname, '..', '..');
const ecosystem = require(path.join(ROOT, 'ecosystem.config.js'));
const pkg = require(path.join(ROOT, 'package.json'));

const [appConfig] = ecosystem.apps;

describe('PM2 ecosystem configuration', () => {
    test('production environment sets NODE_ENV=production', () => {
        assert.equal(appConfig.env_production.NODE_ENV, 'production');
    });

    test('development environment sets NODE_ENV=development', () => {
        assert.equal(appConfig.env_development.NODE_ENV, 'development');
    });

    test('the default environment sets no NODE_ENV, so a bare start fails closed', () => {
        assert.equal(appConfig.env?.NODE_ENV, undefined);
    });

    test('runs the compiled server', () => {
        assert.equal(appConfig.script, 'dist/server.js');
    });

    test('holds no secrets', () => {
        const serialized = JSON.stringify(ecosystem);
        assert.doesNotMatch(serialized, /postgres(ql)?:\/\/|SUPABASE_\w*DATABASE_URL|AWS_SECRET|PASSWORD/i);
    });
});

describe('npm start/restart scripts', () => {
    // Matched on the command, not the script name, so a new script that launches
    // the app is covered no matter what it is called. `pm2 startup` (boot script
    // generation) and `pm2 stop|save|logs` are not launches and do not match.
    const launchScripts = Object.entries(pkg.scripts as Record<string, string>)
        .filter(([, command]) => /\bpm2 (start|restart)\b/.test(command));

    test('every PM2 launch script goes through ecosystem.config.js with an explicit --env', () => {
        assert.ok(launchScripts.length > 0, 'expected at least one pm2 launch script');

        for (const [name, command] of launchScripts) {
            assert.match(command, /ecosystem\.config\.js/, `${name} must use ecosystem.config.js`);
            assert.match(command, /--env (production|development)/, `${name} must pass --env explicitly`);
            assert.doesNotMatch(command, /pm2 (start|restart) dist\//, `${name} must not launch the script directly`);
        }
    });

    test('the production launch script targets production', () => {
        assert.match(pkg.scripts['pm2:start'], /--env production/);
    });

    test('npm start does not depend on devDependencies', () => {
        // A production host installs with --omit=dev; tsx would not be there.
        assert.doesNotMatch(pkg.scripts.start, /\btsx\b/);
    });
});
