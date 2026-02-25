import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadDocument, deleteDocument } from "@/lib/supabase";
import { generateStoragePath } from "@/lib/pdf/file-naming";

const ALLOWED_DOC_TYPES = ["packing_list", "waybill"] as const;
type AllowedDocType = (typeof ALLOWED_DOC_TYPES)[number];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: invoiceId } = await params;

  try {
    // Validate invoice exists
    const invoice = await prisma.invoice.findUnique({
      where: { invoice_id: invoiceId },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const docType = formData.get("doc_type") as string | null;

    if (!file || !docType) {
      return NextResponse.json(
        { error: "file and doc_type are required" },
        { status: 400 }
      );
    }

    if (!ALLOWED_DOC_TYPES.includes(docType as AllowedDocType)) {
      return NextResponse.json(
        { error: `doc_type must be one of: ${ALLOWED_DOC_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    if (!file.type.includes("pdf") && !file.name.endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Only PDF files are allowed" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Build storage path using existing naming utility
    const storagePath = generateStoragePath(invoiceId, file.name);

    // Check for existing document of same type for this invoice
    const existing = await prisma.generatedDocument.findFirst({
      where: { invoice_id: invoiceId, doc_type: docType },
    });

    // Delete old file from storage if replacing
    if (existing && existing.storage_path !== storagePath) {
      try {
        await deleteDocument(existing.storage_path);
      } catch {
        // ignore delete errors for old file
      }
    }

    // Upload new file
    await uploadDocument(storagePath, buffer, "application/pdf");

    // Upsert document record
    const doc = existing
      ? await prisma.generatedDocument.update({
          where: { id: existing.id },
          data: {
            file_name: file.name,
            storage_path: storagePath,
            file_size: buffer.byteLength,
            generated_at: new Date(),
          },
        })
      : await prisma.generatedDocument.create({
          data: {
            invoice_id: invoiceId,
            doc_type: docType,
            file_name: file.name,
            storage_path: storagePath,
            file_size: buffer.byteLength,
            generated_at: new Date(),
          },
        });

    return NextResponse.json({ document: doc });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("POST /api/invoices/[id]/upload-document error:", msg);
    return NextResponse.json(
      { error: msg || "Upload failed" },
      { status: 500 }
    );
  }
}
