import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getLocale } from "@/lib/get-locale";
import LeadDetailClient from "./lead-detail-client";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const leadId = parseInt(id, 10);

  if (isNaN(leadId)) notFound();

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) notFound();

  // Serialize Decimal and Date fields for client component
  const serialized = {
    ...lead,
    amount: lead.amount ? Number(lead.amount) : null,
    timestamp: lead.timestamp?.toISOString() ?? null,
    synced_at: lead.synced_at?.toISOString() ?? null,
    created_at: lead.created_at.toISOString(),
    updated_at: lead.updated_at.toISOString(),
    extra_data: lead.extra_data as Record<string, string>,
  };

  return <LeadDetailClient lead={serialized} locale={locale} />;
}
