import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET /api/ai-chat/conversations — list conversations
export async function GET() {
  try {
    const conversations = await prisma.chatConversation.findMany({
      orderBy: { updated_at: "desc" },
      take: 50,
      select: {
        id: true,
        title: true,
        created_at: true,
        updated_at: true,
        _count: { select: { messages: true } },
      },
    });

    return NextResponse.json(
      conversations.map((c) => ({
        id: c.id,
        title: c.title,
        created_at: c.created_at,
        updated_at: c.updated_at,
        message_count: c._count.messages,
      })),
    );
  } catch (error) {
    console.error("GET /api/ai-chat/conversations error:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 },
    );
  }
}

// POST /api/ai-chat/conversations — create new conversation
export async function POST() {
  try {
    const conversation = await prisma.chatConversation.create({
      data: {},
    });

    return NextResponse.json({
      id: conversation.id,
      title: conversation.title,
      created_at: conversation.created_at,
    });
  } catch (error) {
    console.error("POST /api/ai-chat/conversations error:", error);
    return NextResponse.json(
      { error: "Failed to create conversation" },
      { status: 500 },
    );
  }
}
