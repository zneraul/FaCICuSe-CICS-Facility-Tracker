-- Run manually against the production "neondb" database as neondb_owner.
-- This script is intentionally NOT run by application startup or CI.
-- Set the role password separately with psql's interactive: \password facicuse_runtime

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'facicuse_runtime') THEN
    CREATE ROLE facicuse_runtime;
  END IF;
END
$$;

ALTER ROLE facicuse_runtime
  WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;

GRANT CONNECT ON DATABASE neondb TO facicuse_runtime;
GRANT USAGE ON SCHEMA public TO facicuse_runtime;

-- Application CRUD permissions for operational tables.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO facicuse_runtime;

-- Audit records are append-only for the runtime application role.
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.audit_logs FROM facicuse_runtime;
GRANT SELECT, INSERT ON TABLE public.audit_logs TO facicuse_runtime;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO facicuse_runtime;

-- Keep future tables/sequences created by the migration owner usable by the app role.
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO facicuse_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO facicuse_runtime;

COMMIT;
