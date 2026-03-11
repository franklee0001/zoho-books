import type { SearchResult } from "./vector-search";

export function buildSystemPrompt(
  ragResults: SearchResult[],
  locale: string = "ko",
): string {
  const lang = locale === "ko" ? "Korean" : "English";

  let ragContext = "";
  if (ragResults.length > 0) {
    ragContext = `

## Reference Documents
The following document excerpts may be relevant to the user's question:

${ragResults
  .map(
    (r, i) =>
      `### [Source ${i + 1}] ${r.file_name} (${r.category}, similarity: ${r.similarity.toFixed(3)})
${r.content}`,
  )
  .join("\n\n")}

Use these documents as context when answering. Cite the source number [Source N] when referencing specific information.`;
  }

  return `You are Hue AI Workspace's AI assistant. You help users with questions about customers, invoices, production orders, distributors, and uploaded documents.

## Guidelines
- Respond in ${lang}
- Be concise and professional
- When you have relevant document context, reference it naturally
- Use the available tools to look up real-time data from the database when needed
- For numerical data (revenue, counts, etc.), always use tools to get accurate numbers — do not guess
- Format currency values appropriately (e.g., $1,234.56 or ₩1,234,560)
- If you don't have enough information, say so honestly and suggest what the user could do
${ragContext}`;
}
