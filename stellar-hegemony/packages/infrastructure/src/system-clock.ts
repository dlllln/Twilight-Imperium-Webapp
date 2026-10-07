import type { ClockPort } from '@stellar/domain';

export class SystemClock implements ClockPort {
  now(): number {
    return Date.now();
  }
}
