import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const dbConfig = this.configService.get('database');
    this.pool = new Pool({
      connectionString: dbConfig.url,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    this.pool.on('error', (err) => {
      this.logger.error('Unexpected error on idle PostgreSQL client', err.stack);
    });

    try {
      const client = await this.pool.connect();
      this.logger.log('Conexión exitosa con PostgreSQL + TimescaleDB');
      client.release();
      // Auto-reparación de esquema (migración 007): volúmenes creados antes
      // de la columna `devices.visible` quedan alineados sin psql manual.
      await this.ensureVisibleColumn();
      // Blindaje anti-duplicados de alertas (migración 008).
      await this.ensureAlertDedupeIndex();
      // Tablas del simulador gestionable (migración 009).
      await this.ensureSimTables();
    } catch (err) {
      this.logger.error(`Error conectando con la base de datos: ${err.message}`);
    }
  }

  /** Idempotente: garantiza `devices.visible` aunque el volumen sea anterior. */
  private async ensureVisibleColumn(): Promise<void> {
    try {
      await this.pool.query(
        'ALTER TABLE devices ADD COLUMN IF NOT EXISTS visible BOOLEAN NOT NULL DEFAULT true',
      );
    } catch (err) {
      this.logger.warn(`No se pudo asegurar devices.visible: ${err.message}`);
    }
  }

  /** Idempotente (migración 009): tablas del simulador gestionable. */
  private async ensureSimTables(): Promise<void> {
    try {
      await this.pool.query(
        `CREATE TABLE IF NOT EXISTS sim_state (
           tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
           enabled BOOLEAN NOT NULL DEFAULT false,
           interval_ms INTEGER NOT NULL DEFAULT 30000,
           updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
         )`,
      );
      await this.pool.query(
        `CREATE TABLE IF NOT EXISTS sim_sensors (
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
         )`,
      );
      await this.pool.query(
        'CREATE INDEX IF NOT EXISTS idx_sim_sensors_tenant ON sim_sensors(tenant_id, enabled)',
      );
    } catch (err) {
      this.logger.warn(`No se pudieron asegurar tablas del simulador: ${err.message}`);
    }
  }

  /** Idempotente (migración 008): dedupe + índice único de alerta activa. */
  private async ensureAlertDedupeIndex(): Promise<void> {
    try {
      await this.pool.query(
        `DELETE FROM alert_events e
         WHERE e.state IN ('triggered', 'acknowledged')
           AND EXISTS (
             SELECT 1 FROM alert_events k
             WHERE k.rule_id = e.rule_id
               AND k.device_id = e.device_id
               AND k.state IN ('triggered', 'acknowledged')
               AND (k.triggered_at, k.id) < (e.triggered_at, e.id)
           )`,
      );
      await this.pool.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS uq_active_alert_per_rule_device
         ON alert_events (rule_id, device_id)
         WHERE state IN ('triggered', 'acknowledged')`,
      );
    } catch (err) {
      this.logger.warn(`No se pudo asegurar dedupe de alertas: ${err.message}`);
    }
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.end();
      this.logger.log('Pool de conexiones de base de datos cerrado');
    }
  }

  async query<T extends QueryResultRow = any>(
    text: string,
    params?: any[],
  ): Promise<QueryResult<T>> {
    const start = Date.now();
    try {
      const res = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;
      if (duration > 1000) {
        this.logger.warn(`Slow query (${duration}ms): ${text.substring(0, 100)}...`);
      }
      return res;
    } catch (error) {
      this.logger.error(`Query error: ${error.message} | Query: ${text}`);
      throw error;
    }
  }

  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }
}
