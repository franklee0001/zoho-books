import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { matchCategory, extractModelVersion } from "@/lib/product-categories";

export async function POST() {
  try {
    // Find paid invoices with line items but no production order
    const invoices = await prisma.invoice.findMany({
      where: {
        status: "paid",
        lineItems: { some: {} },
        productionOrder: null,
      },
      select: {
        invoice_id: true,
        lineItems: {
          select: {
            line_item_id: true,
            name: true,
            quantity: true,
          },
        },
      },
    });

    if (invoices.length === 0) {
      return NextResponse.json({ created: 0, message: "No new orders to sync" });
    }

    // Create production orders with status log + production units
    const results = await prisma.$transaction(
      invoices.map((inv) => {
        // Build production units from line items with matched categories
        const unitData: {
          line_item_id: string;
          category_slug: string;
          unit_index: number;
          model_version: string | null;
        }[] = [];

        for (const li of inv.lineItems) {
          const cat = li.name ? matchCategory(li.name) : null;
          if (!cat) continue; // skip accessories

          const qty = li.quantity ? Math.max(1, Math.floor(Number(li.quantity))) : 1;
          const modelVer = li.name ? extractModelVersion(li.name, cat) : null;

          for (let i = 1; i <= qty; i++) {
            unitData.push({
              line_item_id: li.line_item_id,
              category_slug: cat.slug,
              unit_index: i,
              model_version: modelVer,
            });
          }
        }

        return prisma.productionOrder.create({
          data: {
            invoice_id: inv.invoice_id,
            status: "confirmed",
            statusLogs: {
              create: {
                old_status: null,
                new_status: "confirmed",
                changed_by: "system",
                note: "Auto-created from paid invoice sync",
              },
            },
            units: {
              create: unitData,
            },
          },
        });
      })
    );

    return NextResponse.json({ created: results.length });
  } catch (error) {
    console.error("POST /api/production/sync error:", error);
    return NextResponse.json(
      { error: "Failed to sync production orders" },
      { status: 500 }
    );
  }
}
