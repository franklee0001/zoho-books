import { prisma } from "@/lib/prisma";
import {
  refreshAccessToken,
  listMessages,
  getMessage,
  parseMessage,
  extractAttachmentMeta,
} from "@/lib/gmail";
import { NextRequest, NextResponse } from "next/server";

interface GmailMessage {
  id: string;
  threadId: string;
  payload?: {
    headers?: { name: string; value: string }[];
    mimeType?: string;
    body?: { data?: string; size?: number };
    parts?: unknown[];
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const maxPages = (body.maxPages as number) || 3;
    const query = (body.query as string) || "";

    // Get stored token
    const token = await prisma.gmailToken.findFirst({
      orderBy: { updated_at: "desc" },
    });

    if (!token) {
      return NextResponse.json(
        { error: "Gmail not connected. Please authorize first." },
        { status: 401 }
      );
    }

    // Refresh access token if expired
    let accessToken = token.access_token;
    if (!token.token_expiry || token.token_expiry < new Date()) {
      const refreshed = await refreshAccessToken(token.refresh_token);
      accessToken = refreshed.access_token;
      await prisma.gmailToken.update({
        where: { email: token.email },
        data: {
          access_token: accessToken,
          token_expiry: new Date(Date.now() + refreshed.expires_in * 1000),
          updated_at: new Date(),
        },
      });
    }

    // Get existing gmail_ids to skip
    const existingIds = new Set(
      (await prisma.email.findMany({ select: { gmail_id: true } })).map(
        (e) => e.gmail_id
      )
    );

    // Get customer email map for auto-matching
    const customers = await prisma.customer.findMany({
      where: { email: { not: null } },
      select: { customer_id: true, email: true },
    });
    const customerByEmail = new Map(
      customers
        .filter((c) => c.email)
        .map((c) => [c.email!.toLowerCase(), c.customer_id])
    );

    // Fetch messages page by page
    let pageToken: string | undefined;
    let totalFetched = 0;
    let totalSaved = 0;

    for (let page = 0; page < maxPages; page++) {
      const list = await listMessages(accessToken, {
        maxResults: 100,
        pageToken,
        q: query || undefined,
      });

      if (!list.messages || list.messages.length === 0) break;

      // Filter out already-fetched messages
      const newMessages = list.messages.filter((m) => !existingIds.has(m.id));
      totalFetched += list.messages.length;

      // Fetch full message details in parallel (10 at a time)
      const CONCURRENCY = 10;
      for (let i = 0; i < newMessages.length; i += CONCURRENCY) {
        const chunk = newMessages.slice(i, i + CONCURRENCY);
        const results = await Promise.allSettled(
          chunk.map(async (msg) => {
            const full = await getMessage(accessToken, msg.id);
            return { parsed: parseMessage(full, token.email), rawMsg: full as GmailMessage };
          })
        );

        // Batch save successful fetches
        const toSave = results
          .filter((r): r is PromiseFulfilledResult<{ parsed: ReturnType<typeof parseMessage>; rawMsg: GmailMessage }> => r.status === "fulfilled")
          .map((r) => r.value);

        if (toSave.length > 0) {
          await prisma.email.createMany({
            data: toSave.map(({ parsed }) => ({
              gmail_id: parsed.gmail_id,
              thread_id: parsed.thread_id,
              from_email: parsed.from_email,
              from_name: parsed.from_name,
              to_emails: parsed.to_emails,
              cc_emails: parsed.cc_emails,
              subject: parsed.subject,
              body_text: parsed.body_text,
              body_html: parsed.body_html,
              date: parsed.date,
              labels: parsed.labels,
              is_inbound: parsed.is_inbound,
              has_attachments: parsed.has_attachments,
              snippet: parsed.snippet,
              customer_id: customerByEmail.get(parsed.from_email.toLowerCase()) ?? null,
              contact_email: parsed.is_inbound
                ? parsed.from_email.toLowerCase()
                : parsed.to_emails.split(",")[0]?.trim().toLowerCase() ?? null,
              account_email: token.email,
              raw_json: parsed.raw_json as object,
            })),
            skipDuplicates: true,
          });

          // Save attachment metadata for emails that have attachments
          for (const { parsed, rawMsg } of toSave) {
            if (!parsed.has_attachments) continue;
            const email = await prisma.email.findUnique({
              where: { gmail_id: parsed.gmail_id },
              select: { id: true },
            });
            if (!email) continue;

            const metas = extractAttachmentMeta(rawMsg.payload as Parameters<typeof extractAttachmentMeta>[0]);
            if (metas.length > 0) {
              await prisma.emailAttachment.createMany({
                data: metas.map((m) => ({
                  email_id: email.id,
                  gmail_message_id: parsed.gmail_id,
                  gmail_attachment_id: m.attachmentId,
                  filename: m.filename,
                  mime_type: m.mimeType,
                  size: m.size,
                })),
                skipDuplicates: true,
              });
            }
          }

          for (const { parsed } of toSave) existingIds.add(parsed.gmail_id);
          totalSaved += toSave.length;
        }

        for (const r of results) {
          if (r.status === "rejected") {
            console.error("Failed to fetch message:", r.reason);
          }
        }
      }

      if (!list.nextPageToken) break;
      pageToken = list.nextPageToken;
    }

    return NextResponse.json({
      fetched: totalFetched,
      saved: totalSaved,
      skipped: totalFetched - totalSaved,
    });
  } catch (error) {
    console.error("POST /api/gmail/sync error:", error);
    return NextResponse.json(
      { error: "Failed to sync emails" },
      { status: 500 }
    );
  }
}
