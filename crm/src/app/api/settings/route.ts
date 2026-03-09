import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const settings = await prisma.businessSettings.findUnique({
      where: { key: "default" },
    });

    if (!settings) {
      return NextResponse.json(
        { error: "Settings not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(settings);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();

    const settings = await prisma.businessSettings.update({
      where: { key: "default" },
      data: {
        company_name: body.company_name ?? null,
        contact_name: body.contact_name ?? null,
        address: body.address ?? null,
        city: body.city ?? null,
        state: body.state ?? null,
        zipcode: body.zipcode ?? null,
        country: body.country ?? null,
        phone: body.phone ?? null,
        email: body.email ?? null,
        dhl_account: body.dhl_account ?? null,
        incoterms: body.incoterms ?? null,
        origin_country: body.origin_country ?? null,
        packing_type: body.packing_type ?? null,
        exporter_code: body.exporter_code ?? null,
        updated_at: new Date(),
      },
    });

    return NextResponse.json(settings);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to update settings" },
      { status: 500 }
    );
  }
}
