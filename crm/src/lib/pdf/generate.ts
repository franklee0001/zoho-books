import { renderToBuffer } from "@react-pdf/renderer";
import React, { type ReactElement } from "react";
import { prisma } from "@/lib/prisma";
import { uploadDocument } from "@/lib/supabase";
import { generateFileName, generateStoragePath } from "./file-naming";
import PackingListPDF from "./packing-list";
import CommercialInvoicePDF from "./commercial-invoice";

interface GenerateResult {
  packingList: { id: number; file_name: string; storage_path: string } | null;
  commercialInvoice: {
    id: number;
    file_name: string;
    storage_path: string;
  } | null;
}

export async function generateDocuments(
  invoiceId: string
): Promise<GenerateResult> {
  // Fetch all required data
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { invoice_id: invoiceId },
    include: {
      customer: true,
      addresses: true,
      lineItems: {
        include: { packingInfo: true },
      },
      generatedDocuments: true,
    },
  });

  const settings = await prisma.businessSettings.findFirst({
    where: { key: "default" },
  });

  if (!settings) {
    throw new Error("Business settings not configured. Go to /settings first.");
  }

  if (invoice.lineItems.length === 0) {
    throw new Error("No line items found for this invoice. Run line items ETL first.");
  }

  const billingAddr =
    invoice.addresses.find((a) => a.kind === "billing") ?? null;
  const shippingAddr =
    invoice.addresses.find((a) => a.kind === "shipping") ?? null;

  // Format date as MMM/DD/YY (e.g., FEB/10/26)
  const invoiceDate = invoice.date
    ? (() => {
        const d = new Date(invoice.date);
        const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
        return `${months[d.getMonth()]}/${String(d.getDate()).padStart(2, "0")}/${String(d.getFullYear() % 100).padStart(2, "0")}`;
      })()
    : "";

  const sellerData = {
    company_name: settings.company_name,
    contact_name: settings.contact_name,
    address: settings.address,
    city: settings.city,
    state: settings.state,
    zipcode: settings.zipcode,
    country: settings.country,
    phone: settings.phone,
    email: settings.email,
    dhl_account: settings.dhl_account,
    incoterms: settings.incoterms,
    origin_country: settings.origin_country,
    packing_type: settings.packing_type,
    exporter_code: settings.exporter_code,
  };

  const buyerData = {
    name: invoice.customer?.customer_name ?? null,
    email: invoice.customer?.email ?? null,
    phone: invoice.customer?.phone ?? billingAddr?.phone ?? null,
    address: billingAddr
      ? {
          attention: billingAddr.attention,
          address: billingAddr.address,
          street2: billingAddr.street2,
          city: billingAddr.city,
          state: billingAddr.state,
          zipcode: billingAddr.zipcode,
          country: billingAddr.country,
          phone: billingAddr.phone,
        }
      : null,
  };

  const destinationData = shippingAddr
    ? {
        attention: shippingAddr.attention,
        address: shippingAddr.address,
        street2: shippingAddr.street2,
        city: shippingAddr.city,
        state: shippingAddr.state,
        zipcode: shippingAddr.zipcode,
        country: shippingAddr.country,
        phone: shippingAddr.phone,
      }
    : buyerData.address;

  // Determine country for file naming (from shipping address or customer)
  const destCountry =
    shippingAddr?.country ??
    billingAddr?.country ??
    invoice.customer?.country ??
    null;

  // Build items with packing info
  const plItems = invoice.lineItems.map((li, idx) => ({
    line_item_id: li.line_item_id,
    name: li.name,
    sku: li.sku,
    quantity: Number(li.quantity ?? 0),
    packingNo: li.packingInfo?.packing_no ?? idx + 1,
    lengthMm: li.packingInfo?.length_mm
      ? Number(li.packingInfo.length_mm)
      : null,
    widthMm: li.packingInfo?.width_mm
      ? Number(li.packingInfo.width_mm)
      : null,
    heightMm: li.packingInfo?.height_mm
      ? Number(li.packingInfo.height_mm)
      : null,
    packageType:
      li.packingInfo?.package_type ?? settings.packing_type ?? "BOX",
    netWeightKg: li.packingInfo?.net_weight_kg
      ? Number(li.packingInfo.net_weight_kg)
      : null,
    grossWeightKg: li.packingInfo?.gross_weight_kg
      ? Number(li.packingInfo.gross_weight_kg)
      : null,
  }));

  const ciItems = invoice.lineItems.map((li) => ({
    line_item_id: li.line_item_id,
    name: li.name,
    sku: li.sku,
    quantity: Number(li.quantity ?? 0),
    rate: Number(li.rate ?? 0),
    itemTotal: Number(li.item_total ?? 0),
    packageType: li.packingInfo?.package_type ?? settings.packing_type ?? "BOX",
  }));

  const fileNameItems = invoice.lineItems.map((li) => ({
    sku: li.sku,
    quantity: li.quantity ? Number(li.quantity) : null,
  }));

  const result: GenerateResult = {
    packingList: null,
    commercialInvoice: null,
  };

  // Generate Packing List
  const plFileName = generateFileName({
    invoiceDate: invoice.date,
    country: destCountry,
    items: fileNameItems,
    docType: "packing_list",
  });
  const plStoragePath = generateStoragePath(invoiceId, plFileName);

  const plElement = React.createElement(PackingListPDF, {
    invoiceNumber: invoice.invoice_number ?? invoiceId,
    invoiceDate,
    seller: sellerData,
    buyer: buyerData,
    destination: destinationData,
    items: plItems,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plBuffer = await renderToBuffer(plElement as any);

  await uploadDocument(plStoragePath, Buffer.from(plBuffer), "application/pdf");

  const plDoc = await prisma.generatedDocument.upsert({
    where: {
      invoice_id_doc_type: {
        invoice_id: invoiceId,
        doc_type: "packing_list",
      },
    },
    create: {
      invoice_id: invoiceId,
      doc_type: "packing_list",
      file_name: plFileName,
      storage_path: plStoragePath,
      file_size: plBuffer.byteLength,
    },
    update: {
      file_name: plFileName,
      storage_path: plStoragePath,
      file_size: plBuffer.byteLength,
      generated_at: new Date(),
    },
  });

  result.packingList = {
    id: plDoc.id,
    file_name: plDoc.file_name,
    storage_path: plDoc.storage_path,
  };

  // Generate Commercial Invoice
  const ciFileName = generateFileName({
    invoiceDate: invoice.date,
    country: destCountry,
    items: fileNameItems,
    docType: "commercial_invoice",
  });
  const ciStoragePath = generateStoragePath(invoiceId, ciFileName);

  const ciElement = React.createElement(CommercialInvoicePDF, {
    invoiceNumber: invoice.invoice_number ?? invoiceId,
    invoiceDate,
    seller: sellerData,
    buyer: buyerData,
    destination: destinationData,
    items: ciItems,
    totalAmount: Number(invoice.total ?? 0),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ciBuffer = await renderToBuffer(ciElement as any);

  await uploadDocument(ciStoragePath, Buffer.from(ciBuffer), "application/pdf");

  const ciDoc = await prisma.generatedDocument.upsert({
    where: {
      invoice_id_doc_type: {
        invoice_id: invoiceId,
        doc_type: "commercial_invoice",
      },
    },
    create: {
      invoice_id: invoiceId,
      doc_type: "commercial_invoice",
      file_name: ciFileName,
      storage_path: ciStoragePath,
      file_size: ciBuffer.byteLength,
    },
    update: {
      file_name: ciFileName,
      storage_path: ciStoragePath,
      file_size: ciBuffer.byteLength,
      generated_at: new Date(),
    },
  });

  result.commercialInvoice = {
    id: ciDoc.id,
    file_name: ciDoc.file_name,
    storage_path: ciDoc.storage_path,
  };

  return result;
}
