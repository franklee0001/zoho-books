import { prisma } from "@/lib/prisma";
import {
  refreshAccessToken,
  listMessages,
  getMessage,
  parseMessage,
  extractAttachmentMeta,
} from "@/lib/gmail";
import { extractText, getFileType } from "@/lib/ai/extractors";
import { chunkText } from "@/lib/ai/chunker";
import { generateEmbeddings } from "@/lib/ai/embeddings";
import { NextRequest, NextResponse } from "next/server";

// Vercel Cron sends this header for authentication
function verifyCron(request: NextRequest): boolean {
  // In development, allow all requests
  if (process.env.NODE_ENV === "development") return true;
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

const INDEXABLE_MIMES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

export async function GET(request: NextRequest) {
  if (!verifyCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Get stored Gmail token
    const token = await prisma.gmailToken.findFirst({
      orderBy: { updated_at: "desc" },
    });

    if (!token) {
      return NextResponse.json({ message: "Gmail not connected, skipping" });
    }

    // 2. Refresh access token if expired
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

    // 3. Get existing gmail_ids to skip
    const existingIds = new Set(
      (await prisma.email.findMany({ select: { gmail_id: true } })).map(
        (e) => e.gmail_id
      )
    );

    // 4. Customer email map
    const customers = await prisma.customer.findMany({
      where: { email: { not: null } },
      select: { customer_id: true, email: true },
    });
    const customerByEmail = new Map(
      customers
        .filter((c) => c.email)
        .map((c) => [c.email!.toLowerCase(), c.customer_id])
    );

    // 5. Fetch 1 page of recent emails (cron runs every 5 min, 1 page is enough)
    const list = await listMessages(accessToken, { maxResults: 50 });
    if (!list.messages || list.messages.length === 0) {
      return NextResponse.json({ fetched: 0, saved: 0 });
    }

    const newMessages = list.messages.filter((m) => !existingIds.has(m.id));
    if (newMessages.length === 0) {
      return NextResponse.json({ fetched: list.messages.length, saved: 0 });
    }

    // 6. Fetch full details + save
    let totalSaved = 0;
    const CONCURRENCY = 10;

    for (let i = 0; i < newMessages.length; i += CONCURRENCY) {
      const chunk = newMessages.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        chunk.map(async (msg) => {
          const full = await getMessage(accessToken, msg.id);
          return {
            parsed: parseMessage(full, token.email),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            rawMsg: full as any,
          };
        })
      );

      const toSave = results
        .filter(
          (r): r is PromiseFulfilledResult<{
            parsed: ReturnType<typeof parseMessage>;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            rawMsg: any;
          }> => r.status === "fulfilled"
        )
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
            customer_id:
              customerByEmail.get(parsed.from_email.toLowerCase()) ?? null,
            contact_email: parsed.is_inbound
              ? parsed.from_email.toLowerCase()
              : parsed.to_emails.split(",")[0]?.trim().toLowerCase() ?? null,
            account_email: token.email,
            raw_json: parsed.raw_json as object,
          })),
          skipDuplicates: true,
        });

        // 7. Save attachment metadata + auto RAG index
        for (const { parsed, rawMsg } of toSave) {
          if (!parsed.has_attachments) continue;
          const email = await prisma.email.findUnique({
            where: { gmail_id: parsed.gmail_id },
            select: { id: true },
          });
          if (!email) continue;

          const metas = extractAttachmentMeta(rawMsg.payload);
          if (metas.length === 0) continue;

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

          // Auto RAG index for PDF/DOCX/TXT
          for (const m of metas) {
            const fileType =
              INDEXABLE_MIMES.has(m.mimeType) ? m.mimeType : getFileType(m.filename);
            if (!fileType) continue;
            if (m.size > 10 * 1024 * 1024) continue;

            try {
              const buffer = await (
                await import("@/lib/gmail")
              ).getAttachmentData(accessToken, parsed.gmail_id, m.attachmentId);

              let text = await extractText(buffer, fileType);
              // eslint-disable-next-line no-control-regex
              text = text.replace(/\x00/g, "").replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, " ");
              if (!text.trim()) continue;

              const doc = await prisma.ragDocument.create({
                data: {
                  category: "email_attachment",
                  file_name: `[Email] ${m.filename}`,
                  file_type: fileType,
                  file_size: buffer.length,
                  status: "processing",
                },
              });

              const chunks = chunkText(text, {
                file_name: m.filename,
                category: "email_attachment",
                email_from: parsed.from_email,
                email_subject: parsed.subject,
              });

              const embeddings = await generateEmbeddings(
                chunks.map((c) => c.content)
              );

              for (let j = 0; j < chunks.length; j++) {
                const embeddingStr = `[${embeddings[j].join(",")}]`;
                await prisma.$executeRaw`
                  INSERT INTO rag_chunks (document_id, content, embedding, chunk_index, metadata)
                  VALUES (${doc.id}, ${chunks[j].content}, ${embeddingStr}::vector, ${chunks[j].index}, ${JSON.stringify(chunks[j].metadata)}::jsonb)
                `;
              }

              await prisma.ragDocument.update({
                where: { id: doc.id },
                data: { status: "ready", chunk_count: chunks.length, updated_at: new Date() },
              });

              // Link attachment to RAG doc
              const att = await prisma.emailAttachment.findFirst({
                where: {
                  gmail_message_id: parsed.gmail_id,
                  gmail_attachment_id: m.attachmentId,
                },
              });
              if (att) {
                await prisma.emailAttachment.update({
                  where: { id: att.id },
                  data: { rag_document_id: doc.id },
                });
              }
            } catch (err) {
              console.error(`Cron: Failed to RAG index ${m.filename}:`, err);
            }
          }
        }

        totalSaved += toSave.length;
      }
    }

    return NextResponse.json({
      fetched: list.messages.length,
      saved: totalSaved,
      skipped: list.messages.length - totalSaved,
    });
  } catch (error) {
    console.error("Cron sync-emails error:", error);
    return NextResponse.json(
      { error: "Cron sync failed" },
      { status: 500 }
    );
  }
}
