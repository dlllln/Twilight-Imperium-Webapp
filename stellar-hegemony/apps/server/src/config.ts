/** Einstellungen aus der Umgebung; ohne Datenbank und Redis läuft alles im Speicher. */
export interface ServerConfig {
  readonly port: number;
  readonly host: string;
  readonly databaseUrl: string | null;
  readonly redisUrl: string | null;
  /** Gebaute Web-App, die der Server mit ausliefert (eine Adresse für Seite und Socket). */
  readonly webDist: string | null;
  readonly botDelayMs: number;
  readonly logLevel: string;
}

const DEFAULT_PORT = 3000;
const DEFAULT_BOT_DELAY_MS = 400;

const text = (value: string | undefined): string | null =>
  value === undefined || value.trim() === '' ? null : value.trim();

const number = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return value !== undefined && Number.isFinite(parsed) ? parsed : fallback;
};

export const readConfig = (env: Readonly<Record<string, string | undefined>>): ServerConfig => ({
  port: number(env['PORT'], DEFAULT_PORT),
  host: text(env['HOST']) ?? '0.0.0.0',
  databaseUrl: text(env['DATABASE_URL']),
  redisUrl: text(env['REDIS_URL']),
  webDist: text(env['WEB_DIST']),
  botDelayMs: number(env['BOT_DELAY_MS'], DEFAULT_BOT_DELAY_MS),
  logLevel: text(env['LOG_LEVEL']) ?? 'info',
});
