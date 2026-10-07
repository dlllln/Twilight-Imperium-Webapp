/**
 * Einheitliches Fehlerformat der Domain. `code` ist maschinenlesbar (für i18n
 * und Tests), `message` ist eine Entwickler-Beschreibung, keine UI-Ausgabe.
 */
export interface DomainError {
  readonly code: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, string | number | boolean>>;
}

export function domainError(
  code: string,
  message: string,
  details?: Readonly<Record<string, string | number | boolean>>,
): DomainError {
  return details === undefined ? { code, message } : { code, message, details };
}

export type Check =
  { readonly ok: true; readonly value: true } | { readonly ok: false; readonly error: DomainError };

/** Kurzform für eine einzelne Regelprüfung: ok, wenn `condition` gilt. */
export function guard(
  condition: boolean,
  code: string,
  message: string,
  details?: Readonly<Record<string, string | number | boolean>>,
): Check {
  return condition
    ? { ok: true, value: true }
    : { ok: false, error: domainError(code, message, details) };
}

/** Erste fehlgeschlagene Prüfung oder ok. */
export function firstFailure(checks: readonly Check[]): Check {
  return checks.find((check) => !check.ok) ?? { ok: true, value: true };
}
