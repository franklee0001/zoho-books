import { prisma } from "@/lib/prisma";
import { refreshAccessToken, markAsRead } from "@/lib/gmail";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { contactEmail } = (await request.json()) as {
      contactEmail: string;
    };

    if (!contactEmail) {
      return NextResponse.json(
        { error: "contactEmail required" },
        { status: 400 }
      );
    }

    // Find unread emails for this contact
    const unreadEmails = await prisma.email.findMany({
      where: {
        contact_email: contactEmail,
        labels: { has: "UNREAD" },
      },
      select: { id: true, gmail_id: true, labels: true },
    });

    if (unreadEmails.length === 0) {
      return NextResponse.json({ marked: 0 });
    }

    // Update DB: remove UNREAD from labels
    for (const email of unreadEmails) {
      await prisma.email.update({
        where: { id: email.id },
        data: {
          labels: email.labels.filter((l) => l !== "UNREAD"),
        },
      });
    }

    // Try to sync to Gmail API
    let gmailSynced = false;
    try {
      const token = await prisma.gmailToken.findFirst({
        orderBy: { updated_at: "desc" },
      });

      if (token) {
        let accessToken = token.access_token;
        if (!token.token_expiry || token.token_expiry < new Date()) {
          const refreshed = await refreshAccessToken(token.refresh_token);
          accessToken = refreshed.access_token;
          await prisma.gmailToken.update({
            where: { email: token.email },
            data: {
              access_token: accessToken,
              token_expiry: new Date(
                Date.now() + refreshed.expires_in * 1000
              ),
              updated_at: new Date(),
            },
          });
        }

        await markAsRead(
          accessToken,
          unreadEmails.map((e) => e.gmail_id)
        );
        gmailSynced = true;
      }
    } catch (err) {
      console.error("Gmail mark-read sync failed (DB updated):", err);
    }

    return NextResponse.json({
      marked: unreadEmails.length,
      gmailSynced,
    });
  } catch (error) {
    console.error("Mark-read error:", error);
    return NextResponse.json(
      { error: "Failed to mark as read" },
      { status: 500 }
    );
  }
}
