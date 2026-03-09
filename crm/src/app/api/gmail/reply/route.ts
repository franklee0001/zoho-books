import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    const { emailId } = await request.json();

    const email = await prisma.email.findUnique({
      where: { id: emailId },
      include: { customer: true },
    });

    if (!email) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    // Gather context: customer invoices + thread history
    let customerContext = "";
    if (email.customer) {
      const invoices = await prisma.invoice.findMany({
        where: { customer_id: email.customer.customer_id },
        orderBy: { date: "desc" },
        take: 10,
        include: {
          lineItems: { select: { name: true, sku: true, quantity: true, item_total: true } },
        },
      });

      customerContext = `
## Customer Info
- Name: ${email.customer.customer_name ?? "Unknown"}
- Company: ${email.customer.company_name ?? "Unknown"}
- Country: ${email.customer.country ?? "Unknown"}
- Email: ${email.customer.email ?? "Unknown"}

## Order History (recent ${invoices.length} invoices)
${invoices.map((inv) => {
  const items = inv.lineItems.map((li) => `  - ${li.name} (${li.sku ?? "N/A"}) x${Number(li.quantity)} = $${Number(li.item_total)}`).join("\n");
  return `- Invoice ${inv.invoice_number} | ${inv.status} | $${Number(inv.total)} | ${inv.date?.toISOString().slice(0, 10) ?? "N/A"}\n${items}`;
}).join("\n")}`;
    }

    // Thread history
    let threadContext = "";
    if (email.thread_id) {
      const threadEmails = await prisma.email.findMany({
        where: { thread_id: email.thread_id, id: { not: email.id } },
        orderBy: { date: "asc" },
        take: 5,
        select: { from_email: true, from_name: true, subject: true, body_text: true, date: true, is_inbound: true },
      });

      if (threadEmails.length > 0) {
        threadContext = `
## Previous Conversation
${threadEmails.map((e) => `[${e.date?.toISOString().slice(0, 16) ?? ""}] ${e.is_inbound ? "From" : "To"}: ${e.from_name || e.from_email}
${(e.body_text ?? "").slice(0, 500)}
---`).join("\n")}`;
      }
    }

    const systemPrompt = `You are a professional B2B sales representative for a Korean manufacturing/distribution company.

Your job: Write a reply email to the customer's inquiry.

Rules:
- Be professional, friendly, and concise
- If customer has order history, reference it naturally (e.g., "Thank you for your continued business")
- If they ask about products/pricing, provide helpful information based on their past orders
- If you don't have enough info, ask clarifying questions politely
- Write in the same language as the customer's email
- Do NOT include subject line — only the email body
- Do NOT include greetings like "Dear" if the original email is casual
- Match the tone of the original email

${customerContext}
${threadContext}`;

    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Reply to this email:\n\nFrom: ${email.from_name || email.from_email}\nSubject: ${email.subject}\n\n${email.body_text ?? email.snippet ?? ""}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Claude API error:", err);
      return NextResponse.json({ error: "AI generation failed" }, { status: 502 });
    }

    const data = await res.json();
    const draft = data.content?.[0]?.text ?? "";

    return NextResponse.json({ draft, hasCustomer: !!email.customer });
  } catch (error) {
    console.error("POST /api/gmail/reply error:", error);
    return NextResponse.json({ error: "Failed to generate reply" }, { status: 500 });
  }
}
