-- ==============================================================================
-- EXTENSIONES & SCHEMA INICIAL TIMESCALEDB / POSTGRESQL 16
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "hstore";
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- 1. TENANTS
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. USERS
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'operator', 'viewer')),
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_tenant_email ON users(tenant_id, email);

-- 3. DEVICES
CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    dev_eui VARCHAR(32) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    group_name VARCHAR(100) DEFAULT 'General',
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    enabled BOOLEAN NOT NULL DEFAULT true,
    last_seen_at TIMESTAMPTZ,
    battery_threshold DOUBLE PRECISION DEFAULT 20.0,
    humidity_min_threshold DOUBLE PRECISION DEFAULT 30.0,
    humidity_max_threshold DOUBLE PRECISION DEFAULT 80.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_devices_tenant_group ON devices(tenant_id, group_name);
CREATE INDEX IF NOT EXISTS idx_devices_dev_eui ON devices(dev_eui);

-- 4. MEASUREMENTS (TIMESCALEDB HYPERTABLE)
CREATE TABLE IF NOT EXISTS measurements (
    time TIMESTAMPTZ NOT NULL,
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    humidity DOUBLE PRECISION,
    temperature DOUBLE PRECISION,
    pressure DOUBLE PRECISION,
    battery DOUBLE PRECISION,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    rssi DOUBLE PRECISION,
    snr DOUBLE PRECISION,
    gateway_id VARCHAR(64),
    fcnt_up BIGINT,
    raw_payload TEXT,
    valid BOOLEAN NOT NULL DEFAULT true,
    neutron_counts DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Convertir a Hypertable particionada por chunks de 7 días
SELECT create_hypertable('measurements', 'time', chunk_time_interval => INTERVAL '7 days', if_not_exists => TRUE);

-- Índices de alto rendimiento
CREATE INDEX IF NOT EXISTS idx_measurements_device_time ON measurements (device_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_measurements_time ON measurements (time DESC);

-- Habilitar Compresión en TimescaleDB (Comprimir datos mayores a 7 días ordenados por time DESC)
ALTER TABLE measurements SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'device_id',
    timescaledb.compress_orderby = 'time DESC'
);

SELECT add_compression_policy('measurements', INTERVAL '7 days', if_not_exists => TRUE);

-- Política de Retención (Eliminar datos brutos después de 365 días)
SELECT add_retention_policy('measurements', INTERVAL '365 days', if_not_exists => TRUE);

-- 5. CONTINUOUS AGGREGATES (VISTAS MATERIALIZADAS AUTOMÁTICAS)
-- 5.1. Agregado por Hora
CREATE MATERIALIZED VIEW IF NOT EXISTS measurements_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS bucket,
    device_id,
    AVG(humidity) AS avg_humidity,
    MIN(humidity) AS min_humidity,
    MAX(humidity) AS max_humidity,
    AVG(temperature) AS avg_temperature,
    MIN(temperature) AS min_temperature,
    MAX(temperature) AS max_temperature,
    AVG(pressure) AS avg_pressure,
    AVG(battery) AS avg_battery,
    AVG(rssi) AS avg_rssi,
    AVG(snr) AS avg_snr,
    COUNT(*) AS sample_count
FROM measurements
WHERE valid = true
GROUP BY bucket, device_id
WITH NO DATA;

SELECT add_continuous_aggregate_policy('measurements_hourly',
    start_offset => INTERVAL '3 days',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '15 minutes',
    if_not_exists => TRUE);

-- 5.2. Agregado Diario
CREATE MATERIALIZED VIEW IF NOT EXISTS measurements_daily
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 day', time) AS bucket,
    device_id,
    AVG(humidity) AS avg_humidity,
    MIN(humidity) AS min_humidity,
    MAX(humidity) AS max_humidity,
    AVG(temperature) AS avg_temperature,
    MIN(temperature) AS min_temperature,
    MAX(temperature) AS max_temperature,
    AVG(pressure) AS avg_pressure,
    AVG(battery) AS avg_battery,
    COUNT(*) AS sample_count
FROM measurements
WHERE valid = true
GROUP BY bucket, device_id
WITH NO DATA;

SELECT add_continuous_aggregate_policy('measurements_daily',
    start_offset => INTERVAL '30 days',
    end_offset => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => TRUE);

-- 6. ALERT RULES
CREATE TABLE IF NOT EXISTS alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    metric VARCHAR(50) NOT NULL CHECK (metric IN ('humidity', 'temperature', 'battery', 'rssi', 'snr', 'offline')),
    condition VARCHAR(10) NOT NULL CHECK (condition IN ('>', '>=', '<', '<=', '==', '!=')),
    threshold DOUBLE PRECISION NOT NULL,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    hysteresis DOUBLE PRECISION NOT NULL DEFAULT 0,
    severity VARCHAR(50) NOT NULL DEFAULT 'warning' CHECK (severity IN ('low', 'warning', 'critical')),
    enabled BOOLEAN NOT NULL DEFAULT true,
    channels JSONB NOT NULL DEFAULT '["webhook", "email"]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_tenant ON alert_rules(tenant_id, enabled);

-- 7. ALERT EVENTS (INSTANCIAS DE ALERTAS DISPARADAS)
CREATE TABLE IF NOT EXISTS alert_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    state VARCHAR(50) NOT NULL CHECK (state IN ('triggered', 'acknowledged', 'resolved')),
    severity VARCHAR(50) NOT NULL DEFAULT 'warning',
    value DOUBLE PRECISION,
    message TEXT,
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_alert_events_state ON alert_events(state, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_events_device ON alert_events(device_id, triggered_at DESC);

-- 8. NOTIFICATION LOGS
CREATE TABLE IF NOT EXISTS notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_event_id UUID NOT NULL REFERENCES alert_events(id) ON DELETE CASCADE,
    channel VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('success', 'failed', 'pending')),
    recipient TEXT,
    response TEXT,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_event ON notification_logs(alert_event_id);
