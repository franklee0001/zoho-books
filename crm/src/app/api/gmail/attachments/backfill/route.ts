import { prisma } from "@/lib/prisma";
import {
  refreshAccessToken,
  getMessage,
  extractAttachmentMeta,
} from "@/lib/gmail";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const token = await prisma.gmailToken.findFirst({
      orderBy: { updated_at: "desc" },
    });

    if (!token) {
      return NextResponse.json({ error: "Gmail not connected" }, { status: 401 });
    }

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

    // Find emails with attachments but no attachment records
    const emailsWithAttachments = await prisma.email.findMany({
      where: {
        has_attachments: true,
        attachments: { none: {} },
      },
      select: { id: true, gmail_id: true },
    });

    let totalAttachments = 0;
    const CONCURRENCY = 5;

    for (let i = 0; i < emailsWithAttachments.length; i += CONCURRENCY) {
      const chunk = emailsWithAttachments.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        chunk.map(async (email) => {
          const full = await getMessage(accessToken, email.gmail_id);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const metas = extractAttachmentMeta(full.payload as any);
          if (metas.length > 0) {
            await prisma.emailAttachment.createMany({
              data: metas.map((m) => ({
                email_id: email.id,
                gmail_message_id: email.gmail_id,
                gmail_attachment_id: m.attachmentId,
                filename: m.filename,
                mime_type: m.mimeType,
                size: m.size,
              })),
              skipDuplicates: true,
            });
          }
          return metas.length;
        })
      );

      for (const r of results) {
        if (r.status === "fulfilled") totalAttachments += r.value;
      }
    }

    return NextResponse.json({
      emails_processed: emailsWithAttachments.length,
      attachments_found: totalAttachments,
    });
  } catch (error) {
    console.error("POST /api/gmail/attachments/backfill error:", error);
    return NextResponse.json({ error: "Backfill failed" }, { status: 500 });
  }
}
