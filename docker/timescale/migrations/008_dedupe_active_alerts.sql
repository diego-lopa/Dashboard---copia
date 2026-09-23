-- ============================================================================
-- CORNEA IoT — Migración 008: una sola alerta activa por (regla, sonda)
-- 1. Elimina duplicados activos (conserva el más antiguo): el worker podía
--    insertar varios `triggered` concurrentes para la misma regla+sonda.
-- 2. Crea índice único parcial para que `ON CONFLICT DO NOTHING` en
--    alerts-engine.service.ts impida futuros duplicados.
-- Idempotente.
--
--   Get-Content docker/timescale/migrations/008_dedupe_active_alerts.sql -Raw |
--     docker exec -i cornea_postgres psql -U iot -d iot
-- NOTA: el backend también la aplica solo al arrancar
-- (DatabaseService.ensureAlertDedupeIndex), así que el psql manual es opcional.
-- ============================================================================

-- 1. Deduplicar: conservar solo el evento activo más antiguo por (regla, sonda)
DELETE FROM alert_events e
WHERE e.state IN ('triggered', 'acknowledged')
  AND EXISTS (
    SELECT 1 FROM alert_events k
    WHERE k.rule_id = e.rule_id
      AND k.device_id = e.device_id
      AND k.state IN ('triggered', 'acknowledged')
      AND (k.triggered_at, k.id) < (e.triggered_at, e.id)
  );

-- 2. Blindaje anti-duplicados concurrentes
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_alert_per_rule_device
  ON alert_events (rule_id, device_id)
  WHERE state IN ('triggered', 'acknowledged');
