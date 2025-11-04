import { Injectable } from '@nestjs/common';

type NonceRecord = { message: string; expiresAt: number };

@Injectable()
export class NonceService {
  private map = new Map<string, NonceRecord>();

  create(address: string, message: string, ttlMs = 5 * 60 * 1000) {
    const expiresAt = Date.now() + ttlMs;
    this.map.set(address.toLowerCase(), { message, expiresAt });
  }

  get(address: string) {
    const rec = this.map.get(address.toLowerCase());
    if (!rec) return null;
    if (Date.now() > rec.expiresAt) {
      this.map.delete(address.toLowerCase());
      return null;
    }
    return rec;
  }

  use(address: string) {
    this.map.delete(address.toLowerCase());
  }
}
