export interface AemConfig {
  baseUrl: string;
  username: string;
  password: string;
}

export class AemClient {
  readonly #auth: string;
  readonly #base: string;

  constructor(config: AemConfig) {
    this.#base = config.baseUrl.replace(/\/$/, '');
    this.#auth = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`;
  }

  async getJson(path: string): Promise<unknown> {
    const url = `${this.#base}${path}`;
    const res = await fetch(url, { headers: { Authorization: this.#auth } });
    if (!res.ok) throw new Error(`GET ${url} → ${res.status} ${res.statusText}`);
    return res.json();
  }

  async post(path: string, fields: Record<string, string>): Promise<void> {
    const url = `${this.#base}${path}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: this.#auth,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(fields).toString(),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`POST ${url} → ${res.status} ${res.statusText}\n${body.slice(0, 500)}`);
    }
  }
}
