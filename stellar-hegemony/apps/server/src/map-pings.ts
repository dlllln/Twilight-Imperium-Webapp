import { type MapPing, type MapPingRequest, type SeatTicket } from '@stellar/application';
import { domainError, err, ok } from '@stellar/domain';
import { randomUUID } from 'node:crypto';
import type { Services } from './composition-root.ts';
import type { GameServer } from './socket-gateway.ts';

const LIFETIME_MS = 4000;
const COOLDOWN_MS = 700;
const failure = (code: string, message: string) => err(domainError(code, message));

const isRequest = (request: unknown): request is MapPingRequest =>
  typeof request === 'object' &&
  request !== null &&
  'code' in request &&
  typeof request.code === 'string' &&
  'system' in request &&
  typeof request.system === 'string' &&
  request.system.length <= 100;

/** Ein Zeigen existiert nur als Socket-Nachricht; kein Event, keine Speicherung, kein Reconnect-Replay. */
export class MapPings {
  private readonly lastSent = new WeakMap<object, number>();

  constructor(
    private readonly io: GameServer,
    private readonly services: Services,
  ) {}

  async send(connection: object, ticket: SeatTicket | undefined, request: unknown) {
    if (ticket === undefined) return failure('lobby.unknownSeat', 'Erst einer Partie beitreten');
    if (!isRequest(request) || request.code !== ticket.code)
      return failure('map.invalidPing', 'Nur auf Systeme der eigenen Partie zeigen');
    if (!this.reserve(connection)) return failure('map.pingCooldown', 'Bitte einen Moment warten');
    const result = await this.build(ticket, request.system);
    if (result.ok) this.io.to(ticket.code).emit('map:ping', result.value);
    return result;
  }

  private async build(ticket: SeatTicket, system: string) {
    const resumed = await this.services.online.resume(ticket.code, ticket.token);
    if (!resumed.ok) return resumed;
    const state = await this.services.online.state(ticket.code);
    if (!state.ok) return state;
    if (!Object.hasOwn(state.value.systems, system))
      return failure('map.unknownSystem', 'Unbekanntes System');
    const seat = resumed.value.ticket.seat;
    const name = resumed.value.lobby.seats[seat]?.name ?? `P${String(seat + 1)}`;
    return ok(this.ping(resumed.value.ticket, system, name));
  }

  private reserve(connection: object): boolean {
    const now = Date.now();
    if (now - (this.lastSent.get(connection) ?? -Infinity) < COOLDOWN_MS) return false;
    this.lastSent.set(connection, now);
    return true;
  }

  private ping(ticket: SeatTicket, system: string, name: string): MapPing {
    return {
      id: randomUUID(),
      code: ticket.code,
      system,
      seat: ticket.seat,
      player: ticket.player,
      name,
      lifetimeMs: LIFETIME_MS,
    };
  }
}
