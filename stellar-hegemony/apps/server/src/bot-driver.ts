import type { OnlineGames } from '@stellar/application';
import type { DomainError } from '@stellar/domain';

/**
 * Lässt die KI auf dem Server ziehen: nach jedem gespeicherten Zug einmal anstoßen,
 * mit kurzer Pause, damit Menschen jeden KI-Zug mitverfolgen können.
 */
export class BotDriver {
  private readonly pending = new Set<string>();

  constructor(
    private readonly online: OnlineGames,
    private readonly delayMs: number,
    private readonly report: (code: string, error: DomainError) => void,
  ) {}

  kick(code: string): void {
    if (this.pending.has(code)) return;
    this.pending.add(code);
    setTimeout(() => void this.step(code), this.delayMs);
  }

  private async step(code: string): Promise<void> {
    this.pending.delete(code);
    const result = await this.online.botStep(code);
    if (!result.ok) this.report(code, result.error);
  }
}
