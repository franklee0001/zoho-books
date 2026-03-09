import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { readAllSheet } from "@/lib/google-sheets";

// Known column mappings (lowercase normalized → DB field)
const COLUMN_MAP: Record<string, string> = {
  uniquekey: "unique_key",
  unique_key: "unique_key",
  timestamp: "timestamp",
  date: "date",
  email: "email",
  name: "name",
  company: "company",
  country: "country",
  phone: "phone",
  phonenumber: "phone",
  website: "website",
  source: "source",
  acquisitionchannel: "source",
  acquisition_channel: "source",
  productinterest: "product_interest",
  product_interest: "product_interest",
  productofinterest: "product_interest",
  quantity: "quantity",
  message: "message",
  details: "message",
  subject: "subject",
  replystatus: "reply_status",
  reply_status: "reply_status",
  responsecount: "reply_status",
  response_count: "reply_status",
  dealstatus: "deal_status",
  deal_status: "deal_status",
  orderstatus: "order_status",
  order_status: "order_status",
  amount: "amount",
  notes: "notes",
  distributor: "distributor",
};

// Columns that get merged into "name" (First Name + Last Name)
const FIRST_NAME_KEYS = ["firstname", "first_name"];
const LAST_NAME_KEYS = ["lastname", "last_name"];

// Fields that should NOT be overwritten from Sheets if already set in DB
const DB_OWNED_FIELDS = new Set([
  "notes",
  "deal_status",
  "order_status",
  "amount",
]);

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[\s_-]/g, "");
}

function parseTimestamp(val: string): Date | null {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

export async function POST() {
  try {
    const { headers, rows } = await readAllSheet();

    if (headers.length === 0) {
      return NextResponse.json(
        { error: "No headers found in sheet" },
        { status: 400 },
      );
    }

    // Build column index map
    const colMap: { dbField: string; colIdx: number }[] = [];
    const extraCols: { header: string; colIdx: number }[] = [];
    let firstNameIdx = -1;
    let lastNameIdx = -1;

    for (let i = 0; i < headers.length; i++) {
      const normalized = normalizeHeader(headers[i]);

      // Detect First Name / Last Name columns for merging
      if (FIRST_NAME_KEYS.includes(normalized)) {
        firstNameIdx = i;
        continue;
      }
      if (LAST_NAME_KEYS.includes(normalized)) {
        lastNameIdx = i;
        continue;
      }

      const dbField = COLUMN_MAP[normalized];
      if (dbField) {
        colMap.push({ dbField, colIdx: i });
      } else {
        extraCols.push({ header: headers[i], colIdx: i });
      }
    }

    // Find unique_key column
    const ukMapping = colMap.find((c) => c.dbField === "unique_key");
    if (!ukMapping) {
      return NextResponse.json(
        {
          error: "UniqueKey column not found in sheet",
          headers: headers,
        },
        { status: 400 },
      );
    }

    let created = 0;
    let updated = 0;
    let unchanged = 0;
    let skipped = 0;

    for (const row of rows) {
      const uniqueKey = row[ukMapping.colIdx]?.trim();
      if (!uniqueKey) {
        skipped++;
        continue;
      }

      // Extract mapped fields
      const data: Record<string, unknown> = {};
      for (const { dbField, colIdx } of colMap) {
        if (dbField === "unique_key") continue;
        const val = row[colIdx]?.trim() ?? "";
        if (!val) continue;

        if (dbField === "timestamp") {
          data[dbField] = parseTimestamp(val);
        } else if (dbField === "amount") {
          const num = parseFloat(val.replace(/[,$]/g, ""));
          data[dbField] = isNaN(num) ? null : num;
        } else {
          // If field already has a value (e.g. multiple columns map to same field), keep first non-empty
          if (!data[dbField]) {
            data[dbField] = val;
          }
        }
      }

      // Merge First Name + Last Name → name
      const firstName = (firstNameIdx >= 0 ? row[firstNameIdx]?.trim() : "") ?? "";
      const lastName = (lastNameIdx >= 0 ? row[lastNameIdx]?.trim() : "") ?? "";
      const fullName = [firstName, lastName].filter(Boolean).join(" ");
      if (fullName && !data.name) {
        data.name = fullName;
      }

      // Collect extra data
      const extraData: Record<string, string> = {};
      for (const { header, colIdx } of extraCols) {
        const val = row[colIdx]?.trim() ?? "";
        if (val) extraData[header] = val;
      }
      if (Object.keys(extraData).length > 0) {
        data.extra_data = extraData;
      }

      // Check existing record
      const existing = await prisma.lead.findUnique({
        where: { unique_key: uniqueKey },
      });

      if (!existing) {
        // INSERT new lead
        await prisma.lead.create({
          data: {
            unique_key: uniqueKey,
            ...data,
            synced_at: new Date(),
          } as Record<string, unknown> & { unique_key: string },
        });
        created++;
      } else {
        // UPDATE — preserve DB-owned fields
        const updateData: Record<string, unknown> = {};
        for (const [field, value] of Object.entries(data)) {
          if (DB_OWNED_FIELDS.has(field)) {
            // Only set from Sheets if DB value is null/empty
            const existingVal = existing[field as keyof typeof existing];
            if (
              existingVal === null ||
              existingVal === undefined ||
              existingVal === ""
            ) {
              updateData[field] = value;
            }
          } else {
            updateData[field] = value;
          }
        }

        if (Object.keys(updateData).length > 0) {
          await prisma.lead.update({
            where: { unique_key: uniqueKey },
            data: {
              ...updateData,
              synced_at: new Date(),
              updated_at: new Date(),
            },
          });
          updated++;
        } else {
          // Just update synced_at
          await prisma.lead.update({
            where: { unique_key: uniqueKey },
            data: { synced_at: new Date() },
          });
          unchanged++;
        }
      }
    }

    return NextResponse.json({
      total: rows.length,
      created,
      updated,
      unchanged,
      skipped,
      headers,
    });
  } catch (error) {
    console.error("POST /api/leads/sync error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to sync leads",
      },
      { status: 500 },
    );
  }
}
