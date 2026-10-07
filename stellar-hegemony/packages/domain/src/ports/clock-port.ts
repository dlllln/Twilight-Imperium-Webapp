/** Zeitquelle (Dependency Inversion), z. B. für Zeitstempel und Reaktions-Timeouts. */
export interface ClockPort {
  /** Millisekunden seit Unix-Epoche. */
  now(): number;
}
