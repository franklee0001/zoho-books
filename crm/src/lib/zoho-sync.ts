import { prisma } from "@/lib/prisma";
import { ZohoClient } from "@/lib/zoho";

interface SyncResult {
  invoices: number;
  customers: number;
  addresses: number;
  lineItems: number;
  durationMs: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseDate(value: any): Date | null {
  if (!value || typeof value !== "string") return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseDecimal(value: any): number | null {
  if (value == null) return null;
  const n = Number(value);
  return isNaN(n) ? null : n;
}

export async function syncInvoices(opts?: { full?: boolean }): Promise<SyncResult> {
  const start = Date.now();
  const client = await ZohoClient.create();

  // Step 1: Delta timestamp
  let lastModified: string | undefined;
  if (!opts?.full) {
    const latest = await prisma.invoice.aggregate({
      _max: { last_modified_time: true },
    });
    if (latest._max.last_modified_time) {
      // Zoho expects "yyyy-MM-ddTHH:mm:ss+0000" — no milliseconds
      lastModified = latest._max.last_modified_time
        .toISOString()
        .replace(/\.\d{3}Z$/, "+0000");
    }
  }

  // Step 2: Fetch invoices from Zoho
  const params: Record<string, string> = {};
  if (lastModified) {
    params.last_modified_time = lastModified;
  }

  let invoiceCount = 0;
  let customerCount = 0;
  let addressCount = 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allInvoices: Record<string, any>[] = [];

  for await (const page of client.getPaginated(
    "/books/v3/invoices",
    params,
    "invoices",
  )) {
    for (const inv of page) {
      allInvoices.push(inv);

      // Step 3a: Upsert customer
      const customerId = inv.customer_id as string | undefined;
      if (customerId) {
        await prisma.customer.upsert({
          where: { customer_id: customerId },
          create: {
            customer_id: customerId,
            customer_name: (inv.customer_name as string) ?? null,
            company_name: (inv.company_name as string) ?? null,
            email: (inv.email as string) ?? null,
            phone: (inv.phone as string) ?? null,
            country: (inv.country as string) ?? null,
            raw_json: inv as object,
            updated_at: new Date(),
          },
          update: {
            customer_name: (inv.customer_name as string) ?? undefined,
            company_name: (inv.company_name as string) ?? undefined,
            email: (inv.email as string) ?? undefined,
            phone: (inv.phone as string) ?? undefined,
            country: (inv.country as string) ?? undefined,
            raw_json: inv as object,
            updated_at: new Date(),
          },
        });
        customerCount++;
      }

      // Step 3b: Upsert invoice
      const invoiceUrl = typeof inv.invoice_url === "string" ? inv.invoice_url.trim() || null : null;

      await prisma.invoice.upsert({
        where: { invoice_id: inv.invoice_id as string },
        create: {
          invoice_id: inv.invoice_id as string,
          invoice_number: (inv.invoice_number as string) ?? null,
          date: parseDate(inv.date),
          due_date: parseDate(inv.due_date),
          status: (inv.status as string) ?? null,
          current_sub_status: (inv.current_sub_status as string) ?? null,
          total: parseDecimal(inv.total),
          balance: parseDecimal(inv.balance),
          currency_code: (inv.currency_code as string) ?? null,
          customer_id: customerId ?? null,
          customer_name: (inv.customer_name as string) ?? null,
          invoice_url: invoiceUrl,
          salesperson_id: (inv.salesperson_id as string) ?? null,
          salesperson_name: (inv.salesperson_name as string) ?? null,
          created_time: parseDate(inv.created_time),
          updated_time: parseDate(inv.updated_time),
          last_modified_time: parseDate(inv.last_modified_time),
          raw_json: inv as object,
        },
        update: {
          invoice_number: (inv.invoice_number as string) ?? undefined,
          date: parseDate(inv.date),
          due_date: parseDate(inv.due_date),
          status: (inv.status as string) ?? undefined,
          current_sub_status: (inv.current_sub_status as string) ?? undefined,
          total: parseDecimal(inv.total),
          balance: parseDecimal(inv.balance),
          currency_code: (inv.currency_code as string) ?? undefined,
          customer_id: customerId ?? undefined,
          customer_name: (inv.customer_name as string) ?? undefined,
          invoice_url: invoiceUrl,
          salesperson_id: (inv.salesperson_id as string) ?? undefined,
          salesperson_name: (inv.salesperson_name as string) ?? undefined,
          created_time: parseDate(inv.created_time),
          updated_time: parseDate(inv.updated_time),
          last_modified_time: parseDate(inv.last_modified_time),
          raw_json: inv as object,
        },
      });
      invoiceCount++;

      // Step 3c: Upsert addresses
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const kind of ["billing", "shipping"] as const) {
        const addr = inv[`${kind}_address`] as Record<string, unknown> | undefined;
        if (!addr || typeof addr !== "object") continue;

        await prisma.invoiceAddress.upsert({
          where: {
            invoice_id_kind: {
              invoice_id: inv.invoice_id as string,
              kind,
            },
          },
          create: {
            invoice_id: inv.invoice_id as string,
            kind,
            attention: (addr.attention as string) ?? null,
            address: (addr.address as string) ?? null,
            street2: (addr.street2 as string) ?? null,
            city: (addr.city as string) ?? null,
            state: (addr.state as string) ?? null,
            zipcode: ((addr.zipcode ?? addr.zip) as string) ?? null,
            country: (addr.country as string) ?? null,
            phone: (addr.phone as string) ?? null,
            raw_json: addr as object,
          },
          update: {
            attention: (addr.attention as string) ?? null,
            address: (addr.address as string) ?? null,
            street2: (addr.street2 as string) ?? null,
            city: (addr.city as string) ?? null,
            state: (addr.state as string) ?? null,
            zipcode: ((addr.zipcode ?? addr.zip) as string) ?? null,
            country: (addr.country as string) ?? null,
            phone: (addr.phone as string) ?? null,
            raw_json: addr as object,
          },
        });
        addressCount++;
      }
    }
  }

  // Step 4: Fetch line items for paid invoices that don't have them yet
  let lineItemCount = 0;
  const paidIds = allInvoices
    .filter((inv) => inv.status === "paid")
    .map((inv) => inv.invoice_id as string);

  if (paidIds.length > 0) {
    // Find which ones are missing line items
    const existing = await prisma.invoiceLineItem.groupBy({
      by: ["invoice_id"],
      where: { invoice_id: { in: paidIds } },
    });
    const hasLineItems = new Set(existing.map((e) => e.invoice_id));
    const missing = paidIds.filter((id) => !hasLineItems.has(id));

    // Fetch detail for each missing invoice (concurrency-limited)
    const CONCURRENCY = 5;
    for (let i = 0; i < missing.length; i += CONCURRENCY) {
      const batch = missing.slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map(async (invoiceId) => {
          try {
            const detail = await client.request(
              "GET",
              `/books/v3/invoices/${invoiceId}`,
            );
            const invoice = detail.invoice as Record<string, unknown> | undefined;
            if (!invoice) return;

            const lineItems = invoice.line_items as Record<string, unknown>[] | undefined;
            if (!lineItems?.length) return;

            for (const li of lineItems) {
              const lineItemId = li.line_item_id as string;
              if (!lineItemId) continue;

              await prisma.invoiceLineItem.upsert({
                where: { line_item_id: lineItemId },
                create: {
                  line_item_id: lineItemId,
                  invoice_id: invoiceId,
                  name: (li.name as string) ?? null,
                  description: (li.description as string) ?? null,
                  sku: (li.sku as string) ?? null,
                  rate: parseDecimal(li.rate),
                  quantity: parseDecimal(li.quantity),
                  discount: parseDecimal(li.discount),
                  tax_percentage: parseDecimal(li.tax_percentage),
                  item_total: parseDecimal(li.item_total),
                  item_id: (li.item_id as string) ?? null,
                  unit: (li.unit as string) ?? null,
                  hsn_or_sac: (li.hsn_or_sac as string) ?? null,
                  raw_json: li as object,
                },
                update: {
                  name: (li.name as string) ?? undefined,
                  description: (li.description as string) ?? undefined,
                  sku: (li.sku as string) ?? undefined,
                  rate: parseDecimal(li.rate),
                  quantity: parseDecimal(li.quantity),
                  discount: parseDecimal(li.discount),
                  tax_percentage: parseDecimal(li.tax_percentage),
                  item_total: parseDecimal(li.item_total),
                  item_id: (li.item_id as string) ?? undefined,
                  unit: (li.unit as string) ?? undefined,
                  hsn_or_sac: (li.hsn_or_sac as string) ?? undefined,
                  raw_json: li as object,
                },
              });
              lineItemCount++;
            }
          } catch (err) {
            console.error(`Failed to fetch line items for ${invoiceId}:`, err);
          }
        }),
      );
    }
  }

  return {
    invoices: invoiceCount,
    customers: customerCount,
    addresses: addressCount,
    lineItems: lineItemCount,
    durationMs: Date.now() - start,
  };
}
