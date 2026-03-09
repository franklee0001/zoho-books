import { anthropic } from "@ai-sdk/anthropic";
import { streamText, stepCountIs, convertToModelMessages, type UIMessage } from "ai";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { searchSimilarChunks } from "@/lib/ai/vector-search";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { aiTools } from "@/lib/ai/tools";

export const maxDuration = 60;

export async function POST(request: Request) {
  const { messages: uiMessages, conversationId, locale = "ko" } = await request.json();

  if (!uiMessages || !Array.isArray(uiMessages) || uiMessages.length === 0) {
    return new Response("messages required", { status: 400 });
  }

  // Extract text from last user message (UIMessage format: parts array)
  const lastUserMsg = [...uiMessages]
    .reverse()
    .find((m: UIMessage) => m.role === "user");
  const query = lastUserMsg?.parts
    ?.filter((p: { type: string }) => p.type === "text")
    ?.map((p: { text: string }) => p.text)
    ?.join(" ") ?? "";

  // Convert UIMessages to ModelMessages for streamText
  const messages = await convertToModelMessages(uiMessages);

  // RAG: search similar document chunks
  let ragResults: Awaited<ReturnType<typeof searchSimilarChunks>> = [];
  try {
    if (query) {
      ragResults = await searchSimilarChunks(query, 5);
    }
  } catch {
    // RAG search failure is non-fatal — continue without document context
  }

  const systemPrompt = buildSystemPrompt(ragResults, locale);

  const sources = ragResults.map((r) => ({
    id: r.id,
    file_name: r.file_name,
    category: r.category,
    chunk_index: r.chunk_index,
    similarity: r.similarity,
    preview: r.content.slice(0, 100),
  }));

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: systemPrompt,
    messages,
    tools: aiTools,
    stopWhen: stepCountIs(5),
    onFinish: async ({ text }) => {
      // Save to DB if we have a conversation
      if (conversationId && text) {
        try {
          // Save user message
          await prisma.chatMessage.create({
            data: {
              conversation_id: conversationId,
              role: "user",
              content: query,
            },
          });
          // Save assistant message
          await prisma.chatMessage.create({
            data: {
              conversation_id: conversationId,
              role: "assistant",
              content: text,
              sources: sources as unknown as Prisma.InputJsonValue,
            },
          });
          // Update conversation title from first message
          const conv = await prisma.chatConversation.findUnique({
            where: { id: conversationId },
          });
          if (conv && !conv.title) {
            await prisma.chatConversation.update({
              where: { id: conversationId },
              data: {
                title: query.slice(0, 100),
                updated_at: new Date(),
              },
            });
          } else {
            await prisma.chatConversation.update({
              where: { id: conversationId },
              data: { updated_at: new Date() },
            });
          }
        } catch (e) {
          console.error("Failed to save chat message:", e);
        }
      }
    },
  });

  return result.toUIMessageStreamResponse({
    headers: {
      "x-sources": JSON.stringify(sources),
    },
  });
}
