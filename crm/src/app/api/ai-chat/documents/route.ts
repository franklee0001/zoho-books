import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { extractText, getFileType, ALLOWED_EXTENSIONS, MAX_FILE_SIZE } from "@/lib/ai/extractors";
import { chunkText } from "@/lib/ai/chunker";
import { generateEmbeddings } from "@/lib/ai/embeddings";

// GET /api/ai-chat/documents — list RAG documents
export async function GET() {
  try {
    const documents = await prisma.ragDocument.findMany({
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        category: true,
        file_name: true,
        file_type: true,
        file_size: true,
        status: true,
        chunk_count: true,
        error_message: true,
        created_at: true,
      },
    });

    return NextResponse.json(documents);
  } catch (error) {
    console.error("GET /api/ai-chat/documents error:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 },
    );
  }
}

// POST /api/ai-chat/documents — upload + process document
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const category = (formData.get("category") as string) || "misc";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const ext = file.name.toLowerCase().split(".").pop() ?? "";
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: `Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}` },
        { status: 400 },
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large (max 10MB)" },
        { status: 400 },
      );
    }

    const fileType = getFileType(file.name);
    if (!fileType) {
      return NextResponse.json(
        { error: "Cannot determine file type" },
        { status: 400 },
      );
    }

    // Create document record
    const doc = await prisma.ragDocument.create({
      data: {
        category,
        file_name: file.name,
        file_type: fileType,
        file_size: file.size,
        status: "processing",
      },
    });

    // Process asynchronously (but we'll await it for simplicity)
    try {
      // 1. Extract text
      const buffer = Buffer.from(await file.arrayBuffer());
      const text = await extractText(buffer, fileType);

      if (!text.trim()) {
        await prisma.ragDocument.update({
          where: { id: doc.id },
          data: { status: "error", error_message: "No text content extracted" },
        });
        return NextResponse.json(
          { error: "No text content could be extracted from the file" },
          { status: 422 },
        );
      }

      // 2. Chunk text
      const chunks = chunkText(text, {
        file_name: file.name,
        category,
      });

      // 3. Generate embeddings
      const embeddings = await generateEmbeddings(
        chunks.map((c) => c.content),
      );

      // 4. Insert chunks with embeddings via raw SQL
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

      // 5. Update document status
      await prisma.ragDocument.update({
        where: { id: doc.id },
        data: {
          status: "ready",
          chunk_count: chunks.length,
          updated_at: new Date(),
        },
      });

      return NextResponse.json({
        id: doc.id,
        file_name: doc.file_name,
        status: "ready",
        chunk_count: chunks.length,
      });
    } catch (processError) {
      console.error("Document processing error:", processError);
      await prisma.ragDocument.update({
        where: { id: doc.id },
        data: {
          status: "error",
          error_message:
            processError instanceof Error
              ? processError.message
              : "Processing failed",
        },
      });
      return NextResponse.json(
        { error: "Document processing failed" },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("POST /api/ai-chat/documents error:", error);
    return NextResponse.json(
      { error: "Failed to upload document" },
      { status: 500 },
    );
  }
}
