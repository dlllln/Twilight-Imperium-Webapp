/**
 * Führt Aufgaben je Schlüssel nacheinander aus. So greifen ein Spielerzug und ein KI-Zug
 * derselben Partie nie gleichzeitig auf den Event Store zu.
 */
export class SerialQueue {
  private readonly tails = new Map<string, Promise<unknown>>();

  run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    const next = previous.then(task, task);
    const tail = next.catch(() => undefined);
    this.tails.set(key, tail);
    void tail.then(() => {
      if (this.tails.get(key) === tail) this.tails.delete(key);
    });
    return next;
  }
}
