const ACCOUNTS_URL = "https://accounts.zoho.com";
const API_DOMAIN = "https://www.zohoapis.com";

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export async function refreshAccessToken(): Promise<string> {
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET / ZOHO_REFRESH_TOKEN");
  }

  const params = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
  });

  const res = await fetch(`${ACCOUNTS_URL}/oauth/v2/token`, {
    method: "POST",
    body: params,
  });

  if (!res.ok) {
    throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`);
  }

  const data: TokenResponse = await res.json();
  if (!data.access_token) {
    throw new Error(`No access_token in response: ${JSON.stringify(data)}`);
  }

  return data.access_token;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class ZohoClient {
  private accessToken: string;
  private orgId: string;
  private maxRetries: number;

  private constructor(accessToken: string, orgId: string) {
    this.accessToken = accessToken;
    this.orgId = orgId;
    this.maxRetries = 5;
  }

  static async create(): Promise<ZohoClient> {
    const orgId = process.env.ZOHO_ORG_ID;
    if (!orgId) throw new Error("Missing ZOHO_ORG_ID");
    const accessToken = await refreshAccessToken();
    return new ZohoClient(accessToken, orgId);
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Zoho-oauthtoken ${this.accessToken}`,
      "X-com-zoho-books-organizationid": this.orgId,
    };
  }

  async request(
    method: string,
    path: string,
    params?: Record<string, string>,
  ): Promise<Record<string, unknown>> {
    const url = new URL(`${API_DOMAIN}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
      }
    }

    let retriedToken = false;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const res = await fetch(url.toString(), {
        method,
        headers: this.headers(),
      });

      // 401 → refresh token once
      if (res.status === 401 && !retriedToken) {
        this.accessToken = await refreshAccessToken();
        retriedToken = true;
        continue;
      }

      // 429 → backoff
      if (res.status === 429) {
        if (attempt >= this.maxRetries) {
          throw new Error(`Rate limited after ${this.maxRetries} retries`);
        }
        const retryAfter = res.headers.get("Retry-After");
        const delay = retryAfter ? Math.max(1000, parseInt(retryAfter) * 1000) : 1000 * 2 ** attempt;
        await sleep(Math.min(delay, 60000));
        continue;
      }

      // 5xx → retry
      if (res.status >= 500) {
        if (attempt >= this.maxRetries) {
          throw new Error(`Server error after ${this.maxRetries} retries: ${res.status}`);
        }
        await sleep(Math.min(1000 * 2 ** attempt, 60000));
        continue;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      }

      return (await res.json()) as Record<string, unknown>;
    }

    throw new Error("Request failed after retries");
  }

  async *getPaginated(
    path: string,
    params: Record<string, string>,
    listKey: string,
  ): AsyncGenerator<Record<string, unknown>[]> {
    let page = 1;
    const perPage = "200";

    while (true) {
      const data = await this.request("GET", path, {
        ...params,
        page: String(page),
        per_page: perPage,
      });

      const items = (data[listKey] ?? []) as Record<string, unknown>[];
      if (items.length > 0) {
        yield items;
      }

      const ctx = data.page_context as Record<string, unknown> | undefined;
      if (!ctx?.has_more_page) break;
      page++;
    }
  }
}
