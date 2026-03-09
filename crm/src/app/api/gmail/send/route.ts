import { prisma } from "@/lib/prisma";
import {
  refreshAccessToken,
  buildRawEmail,
  sendGmailMessage,
} from "@/lib/gmail";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { emailId, body: replyBody } = await request.json();

    if (!emailId || !replyBody?.trim()) {
      return NextResponse.json({ error: "emailId and body are required" }, { status: 400 });
    }

    // Get original email
    const email = await prisma.email.findUnique({
      where: { id: emailId },
    });

    if (!email) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    // Get token
    const token = await prisma.gmailToken.findFirst({
      orderBy: { updated_at: "desc" },
    });

    if (!token) {
      return NextResponse.json({ error: "Gmail not connected" }, { status: 401 });
    }

    // Refresh if needed
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

    // Build reply
    const subject = email.subject?.startsWith("Re:")
      ? email.subject
      : `Re: ${email.subject ?? ""}`;

    const rawMessage = buildRawEmail({
      from: token.email,
      to: email.from_email ?? "",
      subject,
      body: replyBody,
      inReplyTo: email.gmail_id ? `<${email.gmail_id}@mail.gmail.com>` : undefined,
      references: email.gmail_id ? `<${email.gmail_id}@mail.gmail.com>` : undefined,
      threadId: email.thread_id ?? undefined,
    });

    const result = await sendGmailMessage(accessToken, rawMessage);

    return NextResponse.json({
      sent: true,
      messageId: result.id,
      threadId: result.threadId,
    });
  } catch (error) {
    console.error("POST /api/gmail/send error:", error);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
