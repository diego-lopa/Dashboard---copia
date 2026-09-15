-- ============================================================================
-- CORNEA IoT — Migración 007: visibilidad de sonda en paneles (display-only)
-- `visible=false` oculta la sonda en Dashboard/mapas sin desactivar la
-- ingesta (eso lo hace `enabled`). Solo admin puede cambiarlo vía
-- PATCH /api/v1/devices/:id/visibility. Idempotente.
--
--   Get-Content docker/timescale/migrations/007_add_visible.sql -Raw |
--     docker exec -i cornea_postgres psql -U iot -d iot
-- ============================================================================

ALTER TABLE devices ADD COLUMN IF NOT EXISTS visible BOOLEAN NOT NULL DEFAULT true;
