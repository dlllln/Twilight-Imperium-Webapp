import { type DomainError, domainError } from '../shared/domain-error.ts';
import { err, ok, type Result } from '../shared/result.ts';

export type CommandPool = 'tactic' | 'fleet' | 'strategy';

export const COMMAND_POOLS: readonly CommandPool[] = ['tactic', 'fleet', 'strategy'];

export type PoolCounts = Readonly<Record<CommandPool, number>>;

/**
 * Wertobjekt Kommandotafel (Regel 45/46). Kennt die drei Pools und
 * prüft selbst, ob ein Marker ausgegeben werden kann.
 */
export class CommandSheet {
  private constructor(readonly pools: PoolCounts) {}

  static of(pools: PoolCounts): Result<CommandSheet, DomainError> {
    const negative = COMMAND_POOLS.find((pool) => pools[pool] < 0);
    if (negative !== undefined) {
      return err(
        domainError('commandSheet.negativePool', 'Pool darf nicht negativ sein', {
          pool: negative,
        }),
      );
    }
    return ok(new CommandSheet(pools));
  }

  tokensIn(pool: CommandPool): number {
    return this.pools[pool];
  }

  get total(): number {
    return COMMAND_POOLS.reduce((total, pool) => total + this.pools[pool], 0);
  }

  /** Regel 28.4: Marker im Flottenpool werden niemals ausgegeben. */
  spend(pool: Exclude<CommandPool, 'fleet'>): Result<CommandSheet, DomainError> {
    if (this.pools[pool] < 1) {
      return err(domainError('commandSheet.poolEmpty', 'Kein Kommandomarker im Pool', { pool }));
    }
    return ok(new CommandSheet({ ...this.pools, [pool]: this.pools[pool] - 1 }));
  }

  gain(pool: CommandPool, amount: number): CommandSheet {
    return new CommandSheet({ ...this.pools, [pool]: this.pools[pool] + amount });
  }

  /** Umverteilen (Statusphase): Summe muss gleich bleiben. */
  redistribute(target: PoolCounts): Result<CommandSheet, DomainError> {
    const next = CommandSheet.of(target);
    if (!next.ok) return next;
    if (next.value.total !== this.total) {
      return err(
        domainError('commandSheet.totalChanged', 'Umverteilen darf keine Marker erzeugen'),
      );
    }
    return next;
  }
}
