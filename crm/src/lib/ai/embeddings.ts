import OpenAI from "openai";

const MODEL = "text-embedding-3-small";

function getClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const res = await getClient().embeddings.create({
    model: MODEL,
    input: text.replace(/\n/g, " ").trim(),
  });
  return res.data[0].embedding;
}

export async function generateEmbeddings(
  texts: string[],
): Promise<number[][]> {
  if (texts.length === 0) return [];

  // OpenAI supports batch embedding (max 2048 inputs)
  const batches: string[][] = [];
  for (let i = 0; i < texts.length; i += 2048) {
    batches.push(texts.slice(i, i + 2048));
  }

  const results: number[][] = [];
  for (const batch of batches) {
    const res = await getClient().embeddings.create({
      model: MODEL,
      input: batch.map((t) => t.replace(/\n/g, " ").trim()),
    });
    for (const item of res.data) {
      results.push(item.embedding);
    }
  }
  return results;
}
