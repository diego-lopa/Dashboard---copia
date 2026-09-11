-- ============================================================================
-- CORNEA IoT — Migración 004: un solo tenant (nombre único)
-- El seed antiguo creaba un tenant duplicado en cada ejecución (sin
-- restricción única, ON CONFLICT nunca saltaba). Esta migración:
-- 1. Elimina tenants huérfanos (sin dispositivos, sin usuarios y sin reglas
--    con eventos; sus reglas sin eventos se borran en cascada).
-- 2. Añade UNIQUE(name) para que el seed sea idempotente.
-- Idempotente: puede ejecutarse varias veces.
--
--   Get-Content docker/timescale/migrations/004_unique_tenant_name.sql -Raw |
--     docker exec -i cornea_postgres psql -U iot -d iot
-- ============================================================================

DELETE FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM devices d WHERE d.tenant_id = t.id)
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.tenant_id = t.id)
  AND NOT EXISTS (
    SELECT 1 FROM alert_rules r
    WHERE r.tenant_id = t.id
    AND EXISTS (SELECT 1 FROM alert_events e WHERE e.rule_id = r.id)
  );

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_tenants_name'
  ) THEN
    ALTER TABLE tenants ADD CONSTRAINT uq_tenants_name UNIQUE (name);
  END IF;
END $$;
