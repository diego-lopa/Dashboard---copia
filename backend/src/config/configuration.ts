export default () => ({
  port: parseInt(process.env.PORT, 10) || 8000,
  database: {
    url: process.env.DATABASE_URL || 'postgresql://iot:changeme_db_password@postgres:5432/iot?schema=public',
    host: process.env.POSTGRES_HOST || 'postgres',
    port: parseInt(process.env.POSTGRES_PORT, 10) || 5432,
    user: process.env.POSTGRES_USER || 'iot',
    password: process.env.POSTGRES_PASSWORD || 'changeme_db_password',
    database: process.env.POSTGRES_DB || 'iot',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://redis:6379',
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  },
  mqtt: {
    url: process.env.MQTT_URL || 'mqtt://mosquitto:1883',
    username: process.env.MQTT_USERNAME || 'iot',
    password: process.env.MQTT_PASSWORD || 'changeme',
    topicSubscription: process.env.MQTT_TOPIC_SUBSCRIPTION || 'application/+/device/+/event/up',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'super_secret_jwt_key_32_characters_minimum_entropy_random_hex',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
  security: {
    apiKeyIngest: process.env.API_KEY_INGEST || 'secret_ingest_key_for_http_gateways_123456',
  },
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    from: process.env.SMTP_FROM || 'alerts@example.com',
  },
  webhook: {
    alertUrl: process.env.ALERT_WEBHOOK_URL || '',
  }
});
