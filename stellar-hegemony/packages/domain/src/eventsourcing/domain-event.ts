/** Ein Domain-Event ist eine unveränderliche Tatsache: „ist passiert“. */
export interface DomainEvent<T extends string = string> {
  readonly type: T;
}

/**
 * Für jeden Event-Typ genau ein Reducer. Der Typ erzwingt Vollständigkeit:
 * ein neues Event ohne Reducer kompiliert nicht.
 */
export type ReducerMap<S, E extends DomainEvent> = {
  readonly [K in E['type']]: (state: S, event: Extract<E, { type: K }>) => S;
};

/** Reducer können nicht scheitern: Events wurden vorher validiert. */
export function applyEvent<S, E extends DomainEvent>(
  reducers: ReducerMap<S, E>,
  state: S,
  event: E,
): S {
  // Typ-Korrelation zwischen event.type und Reducer kann TypeScript nicht selbst herstellen.
  const reducer = reducers[event.type as E['type']] as (current: S, applied: E) => S;
  return reducer(state, event);
}

export function replay<S, E extends DomainEvent>(
  reducers: ReducerMap<S, E>,
  initial: S,
  events: readonly E[],
): S {
  return events.reduce((state, event) => applyEvent(reducers, state, event), initial);
}
