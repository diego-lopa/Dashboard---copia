-- ============================================================================
-- CORNEA IoT — Migración 006: lugar + presión de referencia por sonda
-- Además alinea los defaults de umbrales a 15–85 % (rango Galicia).
-- Idempotente.
--
--   Get-Content docker/timescale/migrations/006_add_place_pressure.sql -Raw |
--     docker exec -i cornea_postgres psql -U iot -d iot
-- ============================================================================

ALTER TABLE devices ADD COLUMN IF NOT EXISTS place_name VARCHAR(255);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS pressure DOUBLE PRECISION;

-- Alinear defaults (solo afecta a futuras filas; las 5 sondas demo las
-- corrige el seed en cada ejecución).
ALTER TABLE devices ALTER COLUMN humidity_min_threshold SET DEFAULT 15.0;
ALTER TABLE devices ALTER COLUMN humidity_max_threshold SET DEFAULT 85.0;
