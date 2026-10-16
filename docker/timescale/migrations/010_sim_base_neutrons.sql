-- ============================================================================
-- CORNEA IoT — Migración 010: el escenario del simulador vive en NEUTRONES
-- `sim_sensors.base_neutrons` es el recuento base (N_raw) que emite cada
-- sensor virtual; la humedad la calcula la app (Geant4) a partir de N+presión,
-- igual que una sonda CRNS real. `base_humidity` queda obsoleto (se mantiene
-- la columna por compatibilidad, sin uso). Idempotente.
--
--   Get-Content docker/timescale/migrations/010_sim_base_neutrons.sql -Raw |
--     docker exec -i cornea_postgres psql -U iot -d iot
-- NOTA: el backend también la aplica solo al arrancar
-- (DatabaseService.ensureSimTables), así que el psql manual es opcional.
-- ============================================================================

ALTER TABLE sim_sensors ADD COLUMN IF NOT EXISTS base_neutrons DOUBLE PRECISION NOT NULL DEFAULT 30;