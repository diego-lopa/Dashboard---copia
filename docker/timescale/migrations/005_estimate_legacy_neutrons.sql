-- ============================================================================
-- CORNEA IoT — Migración 005: estimar N_raw en filas históricas sin neutrones
-- Aplica la inversa del modelo Geant4 (misma fórmula que el backend y el
-- seed) a las mediciones antiguas con humedad pero sin neutron_counts, para
-- que TODOS los registros tengan todos los tipos de datos.
-- Idempotente: solo toca filas con neutron_counts IS NULL.
--
--   Get-Content docker/timescale/migrations/005_estimate_legacy_neutrons.sql -Raw |
--     docker exec -i cornea_postgres psql -U iot -d iot
-- ============================================================================

UPDATE measurements
SET neutron_counts = GREATEST(
  1,
  ROUND(
    (
      (-LN(
        (LEAST(99, GREATEST(0.5, humidity)) + 4.894223415942227)
        / 107.38107297640175
      ) / 3.0361746292354415) * 143.0
      / EXP((981.4 - COALESCE(pressure, 981.4)) / 137.0)
    )::numeric,
    1
  )
)
WHERE neutron_counts IS NULL
  AND humidity IS NOT NULL
  AND ((LEAST(99, GREATEST(0.5, humidity)) + 4.894223415942227) / 107.38107297640175) > 0;
