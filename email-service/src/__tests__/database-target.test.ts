/**
 * Database routing tests. Uses node:test (no test framework dependency).
 *
 * Configuration is resolved at import time, so each case runs in a fresh child
 * process. The child runs from a scratch cwd so the real .env is never loaded,
 * and all URLs below are fake — nothing here connects to a database.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PROBE = path.join(__dirname, 'probe-database-target.ts');
const TSX = path.join(__dirname, '..', '..', 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');

const DEV_URL = 'postgresql://postgres.devproject111:pw@dev-pooler.example.com:6543/postgres';
const PROD_URL = 'postgresql://postgres.prodproject222:pw@prod-pooler.example.com:6543/postgres';

const BASE_ENV: Record<string, string> = {
    PORT: '5013',
    AWS_ACCESS_KEY: 'test-key',
    AWS_SECRET_KEY: 'test-secret',
    AWS_REGION: 'ap-south-1',
    AWS_BUCKET_NAME: 'test-bucket',
    EMAIL_DOMAIN: 'example.com',
    SES_FROM_EMAIL: 'noreply@example.com',
};

let scratchCwd: string;

before(() => {
    scratchCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'klar-env-test-'));
});

after(() => {
    fs.rmSync(scratchCwd, { recursive: true, force: true });
});

/** Runs the probe with exactly the given env (plus PATH), inheriting nothing else. */
const resolveConfig = (env: Record<string, string | undefined>) => {
    // Only what the runtime itself needs (tsx/esbuild); nothing that could leak a
    // real database URL from the developer's or the CI runner's shell.
    const childEnv: Record<string, string> = {
        PATH: process.env.PATH || '',
        SystemRoot: process.env.SystemRoot || '',
        HOME: process.env.HOME || '',
        TMPDIR: process.env.TMPDIR || '',
        ...BASE_ENV,
    };
    for (const [key, value] of Object.entries(env)) {
        if (value === undefined) delete childEnv[key];
        else childEnv[key] = value;
    }

    const result = spawnSync(TSX, [PROBE], {
        cwd: scratchCwd,
        env: childEnv,
        encoding: 'utf8',
        shell: process.platform === 'win32',
    });

    return {
        code: result.status,
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        json: () => JSON.parse((result.stdout || '').trim().split('\n').pop() || '{}'),
    };
};

describe('database routing by NODE_ENV', () => {
    test('NODE_ENV=development resolves to the development database', () => {
        const r = resolveConfig({
            NODE_ENV: 'development',
            SUPABASE_DEVELOPMENT_DATABASE_URL: DEV_URL,
            SUPABASE_PRODUCTION_DATABASE_URL: PROD_URL,
        });

        assert.equal(r.code, 0, r.stderr);
        assert.equal(r.json().target, 'development');
        assert.equal(r.json().projectRef, 'devproject111');
    });

    test('NODE_ENV=production resolves to the production database', () => {
        const r = resolveConfig({
            NODE_ENV: 'production',
            SUPABASE_DEVELOPMENT_DATABASE_URL: DEV_URL,
            SUPABASE_PRODUCTION_DATABASE_URL: PROD_URL,
        });

        assert.equal(r.code, 0, r.stderr);
        assert.equal(r.json().target, 'production');
        assert.equal(r.json().projectRef, 'prodproject222');
    });

    test('production does not require the development URL to be present', () => {
        const r = resolveConfig({
            NODE_ENV: 'production',
            SUPABASE_DEVELOPMENT_DATABASE_URL: undefined,
            SUPABASE_PRODUCTION_DATABASE_URL: PROD_URL,
        });

        assert.equal(r.code, 0, r.stderr);
        assert.equal(r.json().target, 'production');
    });
});

describe('fail fast on invalid configuration', () => {
    test('missing NODE_ENV fails startup instead of defaulting to development', () => {
        const r = resolveConfig({
            NODE_ENV: undefined,
            SUPABASE_DEVELOPMENT_DATABASE_URL: DEV_URL,
            SUPABASE_PRODUCTION_DATABASE_URL: PROD_URL,
        });

        assert.notEqual(r.code, 0);
        assert.match(r.stderr, /NODE_ENV is not set/);
        assert.doesNotMatch(r.stdout, /"target"/);
    });

    test('invalid NODE_ENV fails startup', () => {
        const r = resolveConfig({
            NODE_ENV: 'prod',
            SUPABASE_DEVELOPMENT_DATABASE_URL: DEV_URL,
            SUPABASE_PRODUCTION_DATABASE_URL: PROD_URL,
        });

        assert.notEqual(r.code, 0);
        assert.match(r.stderr, /NODE_ENV="prod" is not valid/);
    });

    test('production without SUPABASE_PRODUCTION_DATABASE_URL fails startup', () => {
        const r = resolveConfig({
            NODE_ENV: 'production',
            SUPABASE_DEVELOPMENT_DATABASE_URL: DEV_URL,
            SUPABASE_PRODUCTION_DATABASE_URL: undefined,
        });

        assert.notEqual(r.code, 0);
        assert.match(r.stderr, /Missing environment variable: SUPABASE_PRODUCTION_DATABASE_URL/);
    });

    test('development without SUPABASE_DEVELOPMENT_DATABASE_URL fails startup', () => {
        const r = resolveConfig({
            NODE_ENV: 'development',
            SUPABASE_DEVELOPMENT_DATABASE_URL: undefined,
            SUPABASE_PRODUCTION_DATABASE_URL: PROD_URL,
        });

        assert.notEqual(r.code, 0);
        assert.match(r.stderr, /Missing environment variable: SUPABASE_DEVELOPMENT_DATABASE_URL/);
    });
});

describe('production data-integrity guard', () => {
    test('production pointing at the development project fails startup', () => {
        const r = resolveConfig({
            NODE_ENV: 'production',
            SUPABASE_DEVELOPMENT_DATABASE_URL: DEV_URL,
            SUPABASE_PRODUCTION_DATABASE_URL: DEV_URL,
        });

        assert.notEqual(r.code, 0);
        assert.match(r.stderr, /same[\s\S]*Supabase project/);
        assert.doesNotMatch(r.stdout, /"target"/);
    });

    test('NODE_ENV=test never resolves to the production database', () => {
        const r = resolveConfig({
            NODE_ENV: 'test',
            SUPABASE_DEVELOPMENT_DATABASE_URL: DEV_URL,
            SUPABASE_PRODUCTION_DATABASE_URL: PROD_URL,
        });

        assert.equal(r.code, 0, r.stderr);
        assert.equal(r.json().target, 'development');
    });
});

describe('health output', () => {
    test('reports the production environment and target, without secrets', () => {
        const r = resolveConfig({
            NODE_ENV: 'production',
            SUPABASE_DEVELOPMENT_DATABASE_URL: DEV_URL,
            SUPABASE_PRODUCTION_DATABASE_URL: PROD_URL,
        });

        assert.equal(r.code, 0, r.stderr);
        assert.deepEqual(r.json().health, { environment: 'production', databaseTarget: 'production' });

        // The payload is public: it must not carry host, project ref or credentials.
        const serialized = JSON.stringify(r.json().health);
        assert.doesNotMatch(serialized, /prod-pooler|prodproject222|:pw@/);
    });

    test('reports the development environment and target', () => {
        const r = resolveConfig({
            NODE_ENV: 'development',
            SUPABASE_DEVELOPMENT_DATABASE_URL: DEV_URL,
            SUPABASE_PRODUCTION_DATABASE_URL: PROD_URL,
        });

        assert.equal(r.code, 0, r.stderr);
        assert.deepEqual(r.json().health, { environment: 'development', databaseTarget: 'development' });
    });
});

describe('credential safety', () => {
    test('the safe descriptor never contains the password', () => {
        const r = resolveConfig({
            NODE_ENV: 'production',
            SUPABASE_DEVELOPMENT_DATABASE_URL: DEV_URL,
            SUPABASE_PRODUCTION_DATABASE_URL: PROD_URL,
        });

        assert.equal(r.code, 0, r.stderr);
        assert.doesNotMatch(r.stdout, /:pw@|password/i);
    });

    test('configuration errors do not leak the connection string', () => {
        const r = resolveConfig({
            NODE_ENV: 'production',
            SUPABASE_DEVELOPMENT_DATABASE_URL: DEV_URL,
            SUPABASE_PRODUCTION_DATABASE_URL: DEV_URL,
        });

        assert.doesNotMatch(r.stderr, /:pw@/);
    });
});
