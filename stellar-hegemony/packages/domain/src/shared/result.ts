/**
 * Fehler als Wert statt Exception (Clean Code: Fehlerbehandlung explizit im Typ).
 * Jede Domain-Operation, die scheitern kann, liefert ein `Result`.
 */
export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

export type Result<T, E> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });

export const err = <E>(error: E): Err<E> => ({ ok: false, error });

export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return result.ok ? ok(fn(result.value)) : result;
}

export function andThen<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>,
): Result<U, E> {
  return result.ok ? fn(result.value) : result;
}

/** Liefert alle Werte oder den ersten Fehler. */
export function combine<T, E>(results: readonly Result<T, E>[]): Result<readonly T[], E> {
  const values: T[] = [];
  for (const result of results) {
    if (!result.ok) return result;
    values.push(result.value);
  }
  return ok(values);
}

/** Wendet `step` nacheinander an und bricht beim ersten Fehler ab. */
export function foldResult<T, S, E>(
  items: readonly T[],
  initial: S,
  step: (accumulator: S, item: T) => Result<S, E>,
): Result<S, E> {
  let accumulator: Result<S, E> = ok(initial);
  for (const item of items) {
    if (!accumulator.ok) return accumulator;
    accumulator = step(accumulator.value, item);
  }
  return accumulator;
}

export function ensure<E>(condition: boolean, error: () => E): Result<true, E> {
  return condition ? ok(true) : err(error());
}
