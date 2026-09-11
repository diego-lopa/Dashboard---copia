-- ============================================================================
-- CORNEA IoT — Migración 003: unicidad (device_id, time) + limpieza
-- 1. Elimina filas duplicadas exactas (la API y el worker se suscribían a la
--    vez a MQTT e insertaban cada uplink dos veces). Conserva una fila por
--    grupo (la de id mínimo, determinista).
-- 2. Crea la restricción UNIQUE para idempotencia futura: reintentos y
--    backfills con el mismo (device_id, time) no duplican (el INSERT de
--    ingesta lleva ON CONFLICT DO NOTHING).
-- Válido en hypertables (incluye la columna de partición `time`).
-- Idempotente: puede ejecutarse varias veces.
--
--   Get-Content docker/timescale/migrations/003_unique_measurement.sql -Raw |
--     docker exec -i cornea_postgres psql -U iot -d iot
-- ============================================================================

-- (measurements no tiene PK id: se usa ctid, determinista por grupo)
DELETE FROM measurements a USING measurements b
WHERE a.device_id = b.device_id
  AND a.time = b.time
  AND a.ctid > b.ctid;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_measurements_device_time'
  ) THEN
    ALTER TABLE measurements
      ADD CONSTRAINT uq_measurements_device_time UNIQUE (device_id, time);
  END IF;
END $$;
