# PostgreSQL runtime-role rollout

## Current verified baseline

The connected Neon project currently exposes the `neondb_owner` role as its application-facing custom role. A read-only catalog check returned `current_user = neondb_owner`, and all seven current `public` application tables are owned by `neondb_owner`. The Render environment values were not retrieved or exposed, so the exact credential currently configured on the running web service has not been independently confirmed.

## Target arrangement

- `DATABASE_URL`: restricted `facicuse_runtime` login used by the running application.
- `MIGRATION_DATABASE_URL`: elevated migration-owner connection used only by Drizzle CLI/migration work.
- The runtime role receives CRUD rights on the seven current operational tables, sequence usage, and only SELECT/INSERT for `audit_logs`.
- The runtime role must not own tables, create roles/databases, bypass RLS, replicate, create schema objects, or perform DDL.
- New tables require explicit runtime grants in their migration. Do not give `audit_logs` UPDATE, DELETE, or TRUNCATE permissions.

## Controlled rollout

1. Review `database/postgres/permissions/runtime-role.sql`. Confirm the target table owners and inspect any existing `facicuse_runtime` role memberships before reusing that role.
2. Run that script manually in the production `neondb` database as `neondb_owner`. The script is not called by application startup or CI.
3. Set a strong unique password interactively with psql: `\password facicuse_runtime`.
4. Construct a new Neon connection URI for `facicuse_runtime` with `sslmode=verify-full&channel_binding=require`. Keep the URI secret.
5. Verify the new login from a trusted environment. Confirm `current_user`, SELECT access to every required table, and the necessary CRUD/sequence operations in a transaction that is deliberately rolled back.
6. Configure `MIGRATION_DATABASE_URL` only in the environment used for Drizzle migrations. Keep the elevated credential out of the web runtime.
7. Replace Render's `DATABASE_URL` with the tested runtime URI during a controlled rollout. Do not change the live environment until step 5 passes.
8. Confirm the service starts, the health endpoint succeeds, login works, and reservation / maintenance / admin workflows pass before retiring the old runtime credential.

## Important

This repository change does not create the role, set its password, update Render secrets, run a migration, or deploy the service. Those production actions remain separate so a bad grant or credential cannot lock out the currently running app.

Render auto-deploy for the tracker service was observed disabled during the audit. Keep it disabled until the runtime URI has been verified and a deliberate deployment is scheduled.
