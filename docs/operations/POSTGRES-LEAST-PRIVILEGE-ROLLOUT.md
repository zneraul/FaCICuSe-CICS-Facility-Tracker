# PostgreSQL runtime-role rollout

## Current verified baseline

The connected Neon project currently exposes the `neondb_owner` role as its application-facing custom role. A read-only catalog check returned `current_user = neondb_owner`, and that role owns broad table privileges. The Render environment values were not retrieved or exposed, so the exact credential currently configured on the running web service has not been independently confirmed.

## Target arrangement

- `DATABASE_URL`: restricted `facicuse_runtime` login used by the running application.
- `MIGRATION_DATABASE_URL`: elevated migration-owner connection used only by Drizzle CLI/migration work.
- The runtime role receives operational table CRUD rights, sequence usage, and only SELECT/INSERT for `audit_logs`.
- The runtime role must not own tables, create roles/databases, bypass RLS, replicate, or perform DDL.

## Controlled rollout

1. Review `database/postgres/permissions/runtime-role.sql` and confirm the actual database/schema/table owners.
2. Run that script manually in the production `neondb` database as `neondb_owner`. The script is not called by application startup or CI.
3. Set a strong unique password interactively with psql: `\\password facicuse_runtime`.
4. Construct a new Neon connection URI for `facicuse_runtime` with `sslmode=verify-full&channel_binding=require`. Keep the URI secret.
5. Verify the new login from a trusted environment. Run read-only checks for current_user, SELECT access to each required table, and a rollback-only transaction that tests required INSERT/UPDATE/DELETE capabilities without committing data.
6. Configure `MIGRATION_DATABASE_URL` only in the environment used for Drizzle migrations. Keep the elevated credential out of the web runtime.
7. Replace Render's `DATABASE_URL` with the tested runtime URI during a controlled rollout. Do not change the live environment until step 5 passes.
8. Confirm the service starts, the health endpoint succeeds, login works, and reservation / maintenance / admin workflows pass before retiring the old runtime credential.

## Important

This repository change does not create the role, set its password, update Render secrets, run a migration, or deploy the service. Those production actions remain separate so a bad grant or credential cannot lock out the currently running app.

Render auto-deploy for the tracker service was observed disabled during the audit. Keep it disabled until the runtime URI has been verified and a deliberate deployment is scheduled.
