import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET /api/ai-chat/conversations/[id] — get conversation messages
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const conversationId = parseInt(id, 10);
  if (isNaN(conversationId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const conversation = await prisma.chatConversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { created_at: "asc" },
          select: {
            id: true,
            role: true,
            content: true,
            sources: true,
            created_at: true,
          },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(conversation);
  } catch (error) {
    console.error("GET /api/ai-chat/conversations/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversation" },
      { status: 500 },
    );
  }
}

// DELETE /api/ai-chat/conversations/[id] — delete conversation
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const conversationId = parseInt(id, 10);
  if (isNaN(conversationId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    await prisma.chatConversation.delete({
      where: { id: conversationId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/ai-chat/conversations/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete conversation" },
      { status: 500 },
    );
  }
}
