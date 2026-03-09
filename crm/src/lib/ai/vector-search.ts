import { prisma } from "@/lib/prisma";
import { generateEmbedding } from "./embeddings";
import { Prisma } from "@prisma/client";

export interface SearchResult {
  id: number;
  content: string;
  similarity: number;
  document_id: number;
  file_name: string;
  category: string;
  chunk_index: number;
}

export async function searchSimilarChunks(
  query: string,
  topK: number = 5,
  minSimilarity: number = 0.3,
): Promise<SearchResult[]> {
  const queryEmbedding = await generateEmbedding(query);
  const embeddingStr = `[${queryEmbedding.join(",")}]`;

  const results = await prisma.$queryRaw<SearchResult[]>`
    SELECT
      c.id,
      c.content,
      1 - (c.embedding <=> ${embeddingStr}::vector) AS similarity,
      c.document_id,
      d.file_name,
      d.category,
      c.chunk_index
    FROM rag_chunks c
    JOIN rag_documents d ON d.id = c.document_id
    WHERE d.status = 'ready'
      AND c.embedding IS NOT NULL
      AND 1 - (c.embedding <=> ${embeddingStr}::vector) > ${Prisma.raw(String(minSimilarity))}
    ORDER BY c.embedding <=> ${embeddingStr}::vector
    LIMIT ${topK}
  `;

  return results.map((r) => ({
    ...r,
    similarity: Number(r.similarity),
  }));
}
