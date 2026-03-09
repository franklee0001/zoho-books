const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 200;

export interface Chunk {
  content: string;
  index: number;
  metadata: Record<string, unknown>;
}

export function chunkText(
  text: string,
  metadata: Record<string, unknown> = {},
): Chunk[] {
  const cleaned = text.replace(/\r\n/g, "\n").trim();
  if (!cleaned) return [];

  // Split by paragraphs first
  const paragraphs = cleaned.split(/\n{2,}/);
  const chunks: Chunk[] = [];
  let currentChunk = "";
  let chunkIndex = 0;

  for (const paragraph of paragraphs) {
    // If adding this paragraph would exceed chunk size, finalize current chunk
    if (
      currentChunk.length > 0 &&
      currentChunk.length + paragraph.length + 2 > CHUNK_SIZE
    ) {
      chunks.push({
        content: currentChunk.trim(),
        index: chunkIndex,
        metadata,
      });
      chunkIndex++;

      // Keep overlap from end of previous chunk
      const words = currentChunk.split(/\s+/);
      const overlapWords: string[] = [];
      let overlapLen = 0;
      for (let i = words.length - 1; i >= 0; i--) {
        if (overlapLen + words[i].length + 1 > CHUNK_OVERLAP) break;
        overlapWords.unshift(words[i]);
        overlapLen += words[i].length + 1;
      }
      currentChunk = overlapWords.join(" ");
    }

    // If a single paragraph is too long, split by sentences
    if (paragraph.length > CHUNK_SIZE) {
      const sentences = paragraph.match(/[^.!?]+[.!?]+\s*/g) || [paragraph];
      for (const sentence of sentences) {
        if (
          currentChunk.length > 0 &&
          currentChunk.length + sentence.length > CHUNK_SIZE
        ) {
          chunks.push({
            content: currentChunk.trim(),
            index: chunkIndex,
            metadata,
          });
          chunkIndex++;

          const words = currentChunk.split(/\s+/);
          const overlapWords: string[] = [];
          let overlapLen = 0;
          for (let i = words.length - 1; i >= 0; i--) {
            if (overlapLen + words[i].length + 1 > CHUNK_OVERLAP) break;
            overlapWords.unshift(words[i]);
            overlapLen += words[i].length + 1;
          }
          currentChunk = overlapWords.join(" ");
        }
        currentChunk += (currentChunk ? " " : "") + sentence;
      }
    } else {
      currentChunk +=
        (currentChunk ? "\n\n" : "") + paragraph;
    }
  }

  // Final chunk
  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      index: chunkIndex,
      metadata,
    });
  }

  return chunks;
}
