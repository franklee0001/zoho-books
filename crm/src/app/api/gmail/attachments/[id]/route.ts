import { prisma } from "@/lib/prisma";
import { refreshAccessToken, getAttachmentData } from "@/lib/gmail";
import { uploadDocument, getSignedUrl } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const attachmentId = parseInt(id, 10);
  if (isNaN(attachmentId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  try {
    const attachment = await prisma.emailAttachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Already cached in storage — return signed URL
    if (attachment.storage_path && attachment.cached_at) {
      const url = await getSignedUrl(attachment.storage_path);
      return NextResponse.redirect(url);
    }

    // Lazy download from Gmail API → cache to storage
    const token = await prisma.gmailToken.findFirst({
      orderBy: { updated_at: "desc" },
    });

    if (!token) {
      return NextResponse.json(
        { error: "Gmail not connected" },
        { status: 401 }
      );
    }

    // Refresh token if needed
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

    // Download attachment from Gmail
    const buffer = await getAttachmentData(
      accessToken,
      attachment.gmail_message_id,
      attachment.gmail_attachment_id
    );

    // Cache to storage
    const storagePath = `email-attachments/${attachment.email_id}/${attachment.filename}`;
    await uploadDocument(
      storagePath,
      buffer,
      attachment.mime_type ?? "application/octet-stream"
    );

    // Update DB with cache info
    await prisma.emailAttachment.update({
      where: { id: attachmentId },
      data: {
        storage_path: storagePath,
        cached_at: new Date(),
        size: buffer.length,
      },
    });

    // Return the file directly this first time
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": attachment.mime_type ?? "application/octet-stream",
        "Content-Disposition": `inline; filename="${encodeURIComponent(attachment.filename)}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("GET /api/gmail/attachments/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch attachment" },
      { status: 500 }
    );
  }
}
