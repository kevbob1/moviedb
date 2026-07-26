export interface Torrent {
  hash: string;
  name: string;
  percentDone: number;
  status: number;
  error?: string;
}

export interface TransmissionAdapter {
  getTorrents(hashes: string[]): Promise<Torrent[]>;
  getAll(): Promise<Torrent[]>;
  ping(): Promise<{ reachable: boolean; error?: string }>;
}

interface TransmissionArguments {
  torrents?: Array<{
    hashString?: string;
    name?: string;
    percentDone?: number;
    status?: number;
    errorString?: string;
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
    this.url = opts?.url ?? process.env.TRANSMISSION_URL ?? '';
    this.username = opts?.username ?? process.env.TRANSMISSION_USERNAME ?? '';
    this.password = opts?.password ?? process.env.TRANSMISSION_PASSWORD ?? '';
  }

  private get authHeader(): string | undefined {
    if (!this.username && !this.password) return undefined;
    return `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`;
  }

  private async getSessionId(): Promise<string> {
    if (this.sessionId) return this.sessionId;

    const headers: Record<string, string> = {};
    const auth = this.authHeader;
    if (auth) headers['Authorization'] = auth;

    const response = await fetch(this.url, { method: 'GET', headers });

    if (response.status === 409) {
      const sessionId = response.headers.get('X-Transmission-Session-Id');
      if (sessionId) {
        this.sessionId = sessionId;
        return sessionId;
      }
    }

    if (response.ok) {
      this.sessionId = '';
      return '';
    }

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

    const response = await fetch(`${this.url}/rpc`, {
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
      throw new Error(`Transmission RPC error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<TransmissionResponse>;
  }

  async getTorrents(hashes: string[]): Promise<Torrent[]> {
    if (!this.url) return [];

    const fields = ['hashString', 'name', 'percentDone', 'status', 'errorString'];
    const result = await this.rpcCall('torrent-get', {
      fields,
      ids: hashes,
    });

    return (result.arguments.torrents ?? []).map(t => ({
      hash: t.hashString ?? '',
      name: t.name ?? '',
      percentDone: t.percentDone ?? 0,
      status: t.status ?? 0,
      ...(t.errorString ? { error: t.errorString } : {}),
    }));
  }

  async getAll(): Promise<Torrent[]> {
    if (!this.url) return [];

    const fields = ['hashString', 'name', 'percentDone', 'status', 'errorString'];
    const result = await this.rpcCall('torrent-get', { fields });

    return (result.arguments.torrents ?? []).map(t => ({
      hash: t.hashString ?? '',
      name: t.name ?? '',
      percentDone: t.percentDone ?? 0,
      status: t.status ?? 0,
      ...(t.errorString ? { error: t.errorString } : {}),
    }));
  }

  async ping(): Promise<{ reachable: boolean; error?: string }> {
    if (!this.url) {
      return { reachable: false, error: 'Transmission not configured' };
    }

    try {
      const headers: Record<string, string> = {};
      const auth = this.authHeader;
      if (auth) headers['Authorization'] = auth;

      const response = await fetch(this.url, { method: 'GET', headers });

      if (response.status === 409) {
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

  async getTorrents(hashes: string[]): Promise<Torrent[]> {
    const hashSet = new Set(hashes);
    return this.torrents.filter(t => hashSet.has(t.hash)).map(t => ({ ...t }));
  }

  async getAll(): Promise<Torrent[]> {
    return this.torrents.map(t => ({ ...t }));
  }

  async ping(): Promise<{ reachable: boolean; error?: string }> {
    return { ...this.pingResult };
  }
}
