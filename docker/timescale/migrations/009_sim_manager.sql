-- ============================================================================
-- CORNEA IoT — Migración 009: simulador gestionable desde el panel admin
-- `sim_state`: interruptor + frecuencia por tenant (solo admin).
-- `sim_sensors`: perfiles de sensores virtuales (bases, anomalías, umbrales).
-- El worker publica uplinks ChirpStack v4 por MQTT cuando está activado;
-- la ingesta normal los auto-aprovisiona como dispositivos.
-- Idempotente.
--
--   Get-Content docker/timescale/migrations/009_sim_manager.sql -Raw |
--     docker exec -i cornea_postgres psql -U iot -d iot
-- NOTA: el backend también la aplica solo al arrancar
-- (DatabaseService.ensureSimTables), así que el psql manual es opcional.
-- ============================================================================

CREATE TABLE IF NOT EXISTS sim_state (
    tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT false,
    interval_ms INTEGER NOT NULL DEFAULT 30000,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sim_sensors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    dev_eui VARCHAR(32) UNIQUE NOT NULL,
    base_humidity DOUBLE PRECISION NOT NULL DEFAULT 55.0,
    base_temp DOUBLE PRECISION NOT NULL DEFAULT 19.0,
    base_battery DOUBLE PRECISION NOT NULL DEFAULT 3.9,
    base_pressure DOUBLE PRECISION NOT NULL DEFAULT 1012.0,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    anomaly_mode VARCHAR(10) NOT NULL DEFAULT 'none' CHECK (anomaly_mode IN ('none', 'high', 'low')),
    anomaly_every INTEGER NOT NULL DEFAULT 20,
    humidity_min_threshold DOUBLE PRECISION NOT NULL DEFAULT 15.0,
    humidity_max_threshold DOUBLE PRECISION NOT NULL DEFAULT 85.0,
    battery_threshold DOUBLE PRECISION NOT NULL DEFAULT 20.0,
    enabled BOOLEAN NOT NULL DEFAULT true,
    tick BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sim_sensors_tenant ON sim_sensors(tenant_id, enabled);
