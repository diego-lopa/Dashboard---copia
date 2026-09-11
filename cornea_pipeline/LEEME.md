# Calibración CRNS (fuente maestra de física)

`config/calibration_config.json` es la **fuente maestra de calibración** del
detector neutrónico CORNEA (sincronizado con `CORNEA_PROJECT/cornea_pipeline`):

- `N0_suelo_seco = 143.0` — recuento con suelo seco (n/s)
- Modelo `exponential`: `θ(%) = a0·e^(−a1·ratio) + a2`, con `ratio = N_corr/N0`
- `a0 = 107.381…`, `a1 = 3.036…`, `a2 = −4.894…` (Geant4, R² = 0.9687)
- `P0 = 981.4 hPa`, `L = 137.0` (corrección barométrica)
- EMA α = 0.3 (constante en `ingestion.service.ts`)

El backend NestJS lo carga dinámicamente (`payload-codec.service.ts →
getCalibrationConfig()`), montado en Docker como
`/cornea_pipeline/config/calibration_config.json` (ver `docker-compose.yml`).
Si el fichero no se encuentra, se usan estos mismos valores como fallback.
Al recalibrar en Geant4, actualiza este JSON y el backend lo adopta sin
reconstruir la imagen (se lee en cada cálculo).
