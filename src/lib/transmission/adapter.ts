import { logger } from '@/lib/logger';

export interface Torrent {
  hash: string;
  name: string;
  percentDone: number;
  status: number;
  isFinished?: boolean;
  error?: string;
  files?: string[];
}

export interface TransmissionAdapter {
  getTorrents(hashes?: string[]): Promise<Torrent[]>;
  ping(): Promise<{ reachable: boolean; error?: string }>;
}
interface TransmissionArguments {
  torrents?: Array<{
    hashString?: string;
    name?: string;
    percentDone?: number;
    status?: number;
    isFinished?: boolean;
    errorString?: string;
    files?: Array<{ name?: string }>;
  }>;
  [key: string]: unknown;
}

interface TransmissionResponse {
  result: string;
  arguments: TransmissionArguments;
}

export class HttpTransmissionAdapter implements TransmissionAdapter {
  private readonly url: string;
  private readonly username: string;
  private readonly password: string;
  private sessionId: string | null = null;

  constructor(opts?: { url?: string; username?: string; password?: string }) {
    this.url = (opts?.url ?? process.env.TRANSMISSION_URL ?? '').replace(/\/+$/, '');
    this.username = opts?.username ?? process.env.TRANSMISSION_USERNAME ?? '';
    this.password = opts?.password ?? process.env.TRANSMISSION_PASSWORD ?? '';
  }

  private get authHeader(): string | undefined {
    if (!this.username && !this.password) return undefined;
    return `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`;
  }

  private get rpcUrl(): string {
    return `${this.url}/transmission/rpc`;
  }

  private async getSessionId(): Promise<string> {
    if (this.sessionId !== null) return this.sessionId;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const auth = this.authHeader;
    if (auth) headers['Authorization'] = auth;

    const response = await fetch(this.rpcUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ method: 'session-get' }),
    });

    if (response.status === 409) {
      const sessionId = response.headers.get('X-Transmission-Session-Id');
      if (sessionId) {
        logger.debug({ url: this.rpcUrl }, 'transmission session established');
        this.sessionId = sessionId;
        return sessionId;
      }
    }

    if (response.ok) {
      this.sessionId = '';
      return '';
    }

    logger.error(
      { url: this.rpcUrl, status: response.status, statusText: response.statusText },
      'transmission session handshake failed'
    );
    throw new Error(`Transmission session handshake failed: ${response.status} ${response.statusText}`);
  }

  private async rpcCall(method: string, args?: Record<string, unknown>): Promise<TransmissionResponse> {
    const sessionId = await this.getSessionId();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (sessionId) headers['X-Transmission-Session-Id'] = sessionId;
    const auth = this.authHeader;
    if (auth) headers['Authorization'] = auth;

    const start = performance.now();
    const response = await fetch(this.rpcUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        method,
        arguments: args ?? {},
      }),
    });

    if (response.status === 409) {
      this.sessionId = null;
      return this.rpcCall(method, args);
    }

    if (!response.ok) {
      logger.error(
        { url: this.rpcUrl, method, status: response.status, statusText: response.statusText },
        'transmission rpc error'
      );
      throw new Error(`Transmission RPC error: ${response.status} ${response.statusText}`);
    }

    const result = (await response.json()) as TransmissionResponse;
    logger.debug(
      {
        url: this.rpcUrl,
        method,
        durationMs: Math.round(performance.now() - start),
        torrents: result.arguments.torrents?.length,
      },
      'transmission rpc call'
    );
    return result;
  }

  private mapTorrent(t: NonNullable<TransmissionArguments['torrents']>[number]): Torrent {
    return {
      hash: t.hashString ?? '',
      name: t.name ?? '',
      percentDone: t.percentDone ?? 0,
      status: t.status ?? 0,
      ...(t.isFinished !== undefined ? { isFinished: t.isFinished } : {}),
      ...(t.errorString ? { error: t.errorString } : {}),
      ...(t.files !== undefined ? {
        files: (t.files ?? [])
          .map(f => f.name)
          .filter((n): n is string => !!n),
      } : {}),
    };
  }

  async getTorrents(hashes?: string[]): Promise<Torrent[]> {
    if (!this.url) return [];
    if (hashes !== undefined && hashes.length === 0) return [];

    const fields = ['hashString', 'name', 'percentDone', 'status', 'isFinished', 'errorString', 'files'];
    const result = await this.rpcCall('torrent-get', hashes === undefined ? { fields } : { fields, ids: hashes });

    return (result.arguments.torrents ?? []).map(t => this.mapTorrent(t));
  }

  async ping(): Promise<{ reachable: boolean; error?: string }> {
    if (!this.url) {
      return { reachable: false, error: 'Transmission not configured' };
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      const auth = this.authHeader;
      if (auth) headers['Authorization'] = auth;

      const response = await fetch(this.rpcUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ method: 'session-get' }),
      });

      if (response.status === 409 || response.status === 401) {
        return { reachable: true };
      }

      return {
        reachable: false,
        error: `Transmission API error: ${response.status} ${response.statusText}`,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Network error';
      return { reachable: false, error: `Transmission connection failed: ${errorMessage}` };
    }
  }
}

interface InMemoryTransmissionAdapterInit {
  torrents?: Torrent[];
  ping?: { reachable: boolean; error?: string };
}

export class InMemoryTransmissionAdapter implements TransmissionAdapter {
  private readonly torrents: Torrent[];
  private readonly pingResult: { reachable: boolean; error?: string };

  constructor(init: InMemoryTransmissionAdapterInit = {}) {
    this.torrents = init.torrents ?? [];
    this.pingResult = init.ping ?? { reachable: true };
  }

  async getTorrents(hashes?: string[]): Promise<Torrent[]> {
    if (hashes === undefined) return this.torrents.map(t => ({ ...t }));
    if (hashes.length === 0) return [];
    const hashSet = new Set(hashes);
    return this.torrents.filter(t => hashSet.has(t.hash)).map(t => ({ ...t }));
  }

  async ping(): Promise<{ reachable: boolean; error?: string }> {
    return { ...this.pingResult };
  }
}
