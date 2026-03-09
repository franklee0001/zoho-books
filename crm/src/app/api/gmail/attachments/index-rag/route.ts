import { prisma } from "@/lib/prisma";
import { refreshAccessToken, getAttachmentData } from "@/lib/gmail";
import { extractText, getFileType } from "@/lib/ai/extractors";
import { chunkText } from "@/lib/ai/chunker";
import { generateEmbeddings } from "@/lib/ai/embeddings";
import { NextResponse } from "next/server";

// MIME types we can extract text from
const INDEXABLE_MIMES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

// Map Gmail MIME types to our extractor types
function toExtractorType(mime: string, filename: string): string | null {
  if (INDEXABLE_MIMES.has(mime)) return mime;
  // Fallback: infer from filename extension
  return getFileType(filename);
}

export async function POST() {
  try {
    // Find un-indexed attachments with indexable MIME types
    const candidates = await prisma.emailAttachment.findMany({
      where: {
        rag_document_id: null,
        OR: [
          { mime_type: "application/pdf" },
          { mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
          { mime_type: "text/plain" },
          { filename: { endsWith: ".pdf" } },
          { filename: { endsWith: ".docx" } },
          { filename: { endsWith: ".txt" } },
        ],
      },
      include: {
        email: {
          select: { from_email: true, from_name: true, subject: true, date: true },
        },
      },
      orderBy: { created_at: "desc" },
    });

    if (candidates.length === 0) {
      return NextResponse.json({ indexed: 0, skipped: 0, message: "No new attachments to index" });
    }

    // Get Gmail access token
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

    let indexed = 0;
    let skipped = 0;

    for (const att of candidates) {
      try {
        const fileType = toExtractorType(att.mime_type ?? "", att.filename);
        if (!fileType) {
          skipped++;
          continue;
        }

        // Skip very large files (>10MB)
        if (att.size && att.size > 10 * 1024 * 1024) {
          skipped++;
          continue;
        }

        // 1. Download from Gmail
        const buffer = await getAttachmentData(
          accessToken,
          att.gmail_message_id,
          att.gmail_attachment_id
        );

        // 2. Extract text
        let text: string;
        try {
          text = await extractText(buffer, fileType);
        } catch {
          skipped++;
          continue;
        }

        // Remove null bytes and other invalid UTF-8 sequences
        // eslint-disable-next-line no-control-regex
        text = text.replace(/\x00/g, "").replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, " ");

        if (!text.trim()) {
          skipped++;
          continue;
        }

        // 3. Create RAG document record
        const emailContext = att.email;
        const docName = `[Email] ${att.filename}`;
        const doc = await prisma.ragDocument.create({
          data: {
            category: "email_attachment",
            file_name: docName,
            file_type: fileType,
            file_size: buffer.length,
            status: "processing",
          },
        });

        // 4. Chunk text with email context metadata
        const chunks = chunkText(text, {
          file_name: att.filename,
          category: "email_attachment",
          email_from: emailContext?.from_email ?? "",
          email_from_name: emailContext?.from_name ?? "",
          email_subject: emailContext?.subject ?? "",
          email_date: emailContext?.date?.toISOString() ?? "",
        });

        // 5. Generate embeddings
        const embeddings = await generateEmbeddings(
          chunks.map((c) => c.content)
        );

        // 6. Insert chunks with embeddings
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const embeddingStr = `[${embeddings[i].join(",")}]`;

          await prisma.$executeRaw`
            INSERT INTO rag_chunks (document_id, content, embedding, chunk_index, metadata)
            VALUES (
              ${doc.id},
              ${chunk.content},
              ${embeddingStr}::vector,
              ${chunk.index},
              ${JSON.stringify(chunk.metadata)}::jsonb
            )
          `;
        }

        // 7. Update document status
        await prisma.ragDocument.update({
          where: { id: doc.id },
          data: {
            status: "ready",
            chunk_count: chunks.length,
            updated_at: new Date(),
          },
        });

        // 8. Link attachment to RAG document
        await prisma.emailAttachment.update({
          where: { id: att.id },
          data: { rag_document_id: doc.id },
        });

        indexed++;
      } catch (err) {
        console.error(`Failed to index attachment ${att.id} (${att.filename}):`, err);
        skipped++;
      }
    }

    return NextResponse.json({
      total: candidates.length,
      indexed,
      skipped,
    });
  } catch (error) {
    console.error("POST /api/gmail/attachments/index-rag error:", error);
    return NextResponse.json(
      { error: "RAG indexing failed" },
      { status: 500 }
    );
  }
}
