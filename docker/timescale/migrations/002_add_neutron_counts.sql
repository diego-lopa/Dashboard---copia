-- ============================================================================
-- CORNEA IoT — Migración 002: recuento bruto de neutrones CRNS (N_raw, n/s)
-- Aplica a bases de datos YA creadas (en instalaciones frescas ya lo incluye
-- docker/timescale/init.sql). Idempotente: puede ejecutarse varias veces.
--
--   docker exec -i cornea_postgres psql -U iot -d iot \
--     < docker/timescale/migrations/002_add_neutron_counts.sql
-- ============================================================================

ALTER TABLE measurements
  ADD COLUMN IF NOT EXISTS neutron_counts DOUBLE PRECISION;

COMMENT ON COLUMN measurements.neutron_counts IS
  'Recuento bruto de neutrones del detector CRNS (N_raw, n/s). NULL en datos anteriores a la migración.';
