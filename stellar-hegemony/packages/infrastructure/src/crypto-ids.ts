import type { IdGeneratorPort } from '@stellar/application';

/** Ohne leicht verwechselbare Zeichen (0/O, 1/I); 32 Zeichen, damit jedes gleich oft vorkommt. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

/** Lobbycodes zum Vorlesen und nicht erratbare Platzschlüssel. */
export class CryptoIds implements IdGeneratorPort {
  lobbyCode(): string {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
    return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length] ?? 'A').join('');
  }

  seatToken(): string {
    return globalThis.crypto.randomUUID();
  }
}
