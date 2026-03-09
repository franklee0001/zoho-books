const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export function getGoogleAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email",
    access_type: "offline",
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export function getRedirectUri(): string {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  return `${base}/api/gmail/callback`;
}

export async function exchangeCode(code: string) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: getRedirectUri(),
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${err}`);
  }

  return res.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
  }>;
}

export async function refreshAccessToken(refreshToken: string) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed: ${err}`);
  }

  return res.json() as Promise<{
    access_token: string;
    expires_in: number;
  }>;
}

export async function getUserEmail(accessToken: string): Promise<string> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  return data.email;
}

// --- Gmail API helpers ---

interface GmailListResponse {
  messages?: { id: string; threadId: string }[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailPart {
  mimeType: string;
  headers?: GmailHeader[];
  body?: { data?: string; size?: number; attachmentId?: string };
  parts?: GmailPart[];
}

interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  payload?: {
    headers?: GmailHeader[];
    mimeType?: string;
    body?: { data?: string; size?: number };
    parts?: GmailPart[];
  };
  internalDate?: string;
}

export async function listMessages(
  accessToken: string,
  options: { maxResults?: number; pageToken?: string; q?: string } = {}
): Promise<GmailListResponse> {
  const params = new URLSearchParams();
  params.set("maxResults", String(options.maxResults ?? 100));
  if (options.pageToken) params.set("pageToken", options.pageToken);
  if (options.q) params.set("q", options.q);

  const res = await fetch(`${GMAIL_API_BASE}/messages?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail list failed: ${err}`);
  }

  return res.json();
}

export async function getMessage(
  accessToken: string,
  messageId: string
): Promise<GmailMessage> {
  const res = await fetch(
    `${GMAIL_API_BASE}/messages/${messageId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail get message failed: ${err}`);
  }

  return res.json();
}

// --- Send helpers ---

function encodeBase64Url(str: string): string {
  return Buffer.from(str, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function buildRawEmail(opts: {
  from: string;
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
  threadId?: string;
}): { raw: string; threadId?: string } {
  const boundary = `boundary_${Date.now()}`;
  const headers = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];

  if (opts.inReplyTo) headers.push(`In-Reply-To: ${opts.inReplyTo}`);
  if (opts.references) headers.push(`References: ${opts.references}`);

  const plainBody = opts.body;
  const htmlBody = opts.body
    .split("\n")
    .map((line) => (line.trim() === "" ? "<br>" : `<p>${line}</p>`))
    .join("\n");

  const message = [
    headers.join("\r\n"),
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    plainBody,
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "",
    htmlBody,
    `--${boundary}--`,
  ].join("\r\n");

  return { raw: encodeBase64Url(message), threadId: opts.threadId };
}

export async function sendGmailMessage(
  accessToken: string,
  rawMessage: { raw: string; threadId?: string }
): Promise<{ id: string; threadId: string }> {
  const body: Record<string, string> = { raw: rawMessage.raw };
  if (rawMessage.threadId) body.threadId = rawMessage.threadId;

  const res = await fetch(`${GMAIL_API_BASE}/messages/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail send failed: ${err}`);
  }

  return res.json();
}

// --- Parsing helpers ---

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
}

function getHeader(headers: GmailHeader[] | undefined, name: string): string {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function extractBody(
  payload: GmailMessage["payload"]
): { text: string; html: string } {
  let text = "";
  let html = "";

  if (!payload) return { text, html };

  function walk(part: GmailPart) {
    if (part.mimeType === "text/plain" && part.body?.data && !text) {
      text = decodeBase64Url(part.body.data);
    }
    if (part.mimeType === "text/html" && part.body?.data && !html) {
      html = decodeBase64Url(part.body.data);
    }
    if (part.parts) {
      for (const sub of part.parts) walk(sub);
    }
  }

  // Single-part message
  if (payload.body?.data) {
    if (payload.mimeType === "text/plain") text = decodeBase64Url(payload.body.data);
    else if (payload.mimeType === "text/html") html = decodeBase64Url(payload.body.data);
  }

  // Multi-part message
  if (payload.parts) {
    for (const part of payload.parts) walk(part);
  }

  return { text, html };
}

function parseEmailAddress(raw: string): { name: string; email: string } {
  const match = raw.match(/^(.+?)\s*<(.+?)>$/);
  if (match) return { name: match[1].trim().replace(/^"|"$/g, ""), email: match[2].trim() };
  return { name: "", email: raw.trim() };
}

function hasAttachments(payload: GmailMessage["payload"]): boolean {
  if (!payload?.parts) return false;
  function check(parts: GmailPart[]): boolean {
    for (const p of parts) {
      if (p.body?.attachmentId) return true;
      if (p.parts && check(p.parts)) return true;
    }
    return false;
  }
  return check(payload.parts);
}

// --- Attachment helpers ---

export interface AttachmentMeta {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
}

export function extractAttachmentMeta(
  payload: GmailMessage["payload"]
): AttachmentMeta[] {
  const attachments: AttachmentMeta[] = [];
  if (!payload?.parts) return attachments;

  function walk(parts: GmailPart[]) {
    for (const p of parts) {
      if (p.body?.attachmentId) {
        const filename =
          getHeader(p.headers, "Content-Disposition")
            .match(/filename="?([^";\n]+)"?/i)?.[1] ??
          p.headers?.find((h) => h.name.toLowerCase() === "content-type")
            ?.value?.match(/name="?([^";\n]+)"?/i)?.[1] ??
          "attachment";
        attachments.push({
          attachmentId: p.body.attachmentId,
          filename: filename.trim(),
          mimeType: p.mimeType,
          size: p.body.size ?? 0,
        });
      }
      if (p.parts) walk(p.parts);
    }
  }

  walk(payload.parts);
  return attachments;
}

export async function getAttachmentData(
  accessToken: string,
  messageId: string,
  attachmentId: string
): Promise<Buffer> {
  const res = await fetch(
    `${GMAIL_API_BASE}/messages/${messageId}/attachments/${attachmentId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail attachment fetch failed: ${err}`);
  }

  const data = await res.json();
  // Gmail returns base64url-encoded data
  const base64 = (data.data as string).replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64");
}

export interface ParsedEmail {
  gmail_id: string;
  thread_id: string;
  from_email: string;
  from_name: string;
  to_emails: string;
  cc_emails: string;
  subject: string;
  body_text: string;
  body_html: string;
  date: Date;
  labels: string[];
  is_inbound: boolean;
  has_attachments: boolean;
  snippet: string;
  raw_json: object;
}

export function parseMessage(msg: GmailMessage, userEmail: string): ParsedEmail {
  const headers = msg.payload?.headers;
  const from = parseEmailAddress(getHeader(headers, "From"));
  const { text, html } = extractBody(msg.payload);
  const labels = msg.labelIds ?? [];

  return {
    gmail_id: msg.id,
    thread_id: msg.threadId,
    from_email: from.email,
    from_name: from.name,
    to_emails: getHeader(headers, "To"),
    cc_emails: getHeader(headers, "Cc"),
    subject: getHeader(headers, "Subject"),
    body_text: text,
    body_html: html,
    date: msg.internalDate
      ? new Date(parseInt(msg.internalDate, 10))
      : new Date(),
    labels,
    is_inbound: !labels.includes("SENT") && from.email.toLowerCase() !== userEmail.toLowerCase(),
    has_attachments: hasAttachments(msg.payload),
    snippet: msg.snippet ?? "",
    raw_json: msg,
  };
}
