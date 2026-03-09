import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReplyForm from "./reply-form";
import AttachmentList from "./attachment-preview";
import MarkAsRead from "./mark-read";
import { getLocale } from "@/lib/get-locale";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
}

function formatCurrency(val: unknown): string {
  if (val == null) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(val));
}

export default async function EmailDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const emailId = parseInt(id, 10);
  if (isNaN(emailId)) notFound();

  const email = await prisma.email.findUnique({
    where: { id: emailId },
    include: { customer: true },
  });
  if (!email) notFound();

  // Use pre-computed contact_email (indexed)
  const contactEmail = email.contact_email;

  // Run independent queries in parallel
  const [allEmails, customerByEmail] = await Promise.all([
    // All emails with this contact via indexed contact_email column
    contactEmail
      ? prisma.email.findMany({
          where: { contact_email: contactEmail },
          orderBy: { date: "desc" },
          select: {
            id: true, gmail_id: true, thread_id: true,
            from_email: true, from_name: true, to_emails: true,
            subject: true, body_text: true, date: true,
            is_inbound: true, snippet: true, customer_id: true,
            has_attachments: true, labels: true,
            attachments: {
              select: {
                id: true, filename: true, mime_type: true, size: true,
              },
            },
          },
        })
      : Promise.resolve([] as Array<{
          id: number; gmail_id: string; thread_id: string | null;
          from_email: string | null; from_name: string | null; to_emails: string | null;
          subject: string | null; body_text: string | null; date: Date | null;
          is_inbound: boolean; snippet: string | null; customer_id: string | null;
          has_attachments: boolean; labels: string[];
          attachments: { id: number; filename: string; mime_type: string | null; size: number | null }[];
        }>),
    // Find customer by contact email if not already linked
    !email.customer && contactEmail
      ? prisma.customer.findFirst({
          where: { email: { equals: contactEmail, mode: "insensitive" } },
        })
      : Promise.resolve(null),
  ]);

  const customer = email.customer ?? customerByEmail;

  const invoices = customer
    ? await prisma.invoice.findMany({
        where: { customer_id: customer.customer_id },
        orderBy: { date: "desc" },
        take: 10,
        include: {
          lineItems: {
            select: {
              line_item_id: true,
              name: true,
              quantity: true,
              rate: true,
              item_total: true,
            },
          },
        },
      })
    : [];

  // Latest inbound for reply
  const latestInbound = allEmails.find((e) => e.is_inbound);

  // Check if any unread emails in this conversation
  const hasUnread = allEmails.some((e) => e.labels?.includes("UNREAD"));

  // Group by month
  const grouped = new Map<string, typeof allEmails>();
  for (const e of allEmails) {
    const key = e.date
      ? new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long" }).format(new Date(e.date))
      : "Unknown";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(e);
  }

  return (
    <div>
      {hasUnread && contactEmail && (
        <MarkAsRead contactEmail={contactEmail} />
      )}
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/emails"
          className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          &larr; {t(locale, "emailDetail.back")}
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">
            {customer?.customer_name || email.from_name || contactEmail}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {t(locale, "emailDetail.emailCount", { count: allEmails.length })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main: conversation timeline */}
        <div className="lg:col-span-2 space-y-6">
          {Array.from(grouped.entries()).map(([month, emails]) => (
            <div key={month}>
              <div className="sticky top-0 z-10 py-2">
                <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                  {month}
                </span>
              </div>
              <div className="space-y-3 mt-2">
                {emails.map((e) => {
                  const isEmailUnread = e.labels?.includes("UNREAD");
                  return (
                  <div
                    key={e.id}
                    id={`email-${e.id}`}
                    className={`rounded-xl border-2 shadow-sm overflow-hidden ${
                      e.id === emailId
                        ? "border-blue-400 ring-2 ring-blue-200"
                        : isEmailUnread
                          ? "border-blue-300 bg-blue-50"
                          : "border-gray-200"
                    }`}
                  >
                    <div className={`px-5 py-3 flex items-center justify-between ${
                      isEmailUnread
                        ? "bg-blue-50"
                        : e.is_inbound ? "bg-white" : "bg-green-50"
                    }`}>
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            isEmailUnread
                              ? "bg-blue-600"
                              : e.is_inbound ? "bg-blue-400" : "bg-green-400"
                          }`}
                        />
                        <span className={`text-sm ${isEmailUnread ? "font-bold text-gray-950" : "font-medium text-gray-900"}`}>
                          {e.is_inbound
                            ? e.from_name || e.from_email
                            : t(locale, "emailDetail.me")}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          e.is_inbound
                            ? "bg-blue-100 text-blue-600"
                            : "bg-green-100 text-green-600"
                        }`}>
                          {e.is_inbound ? t(locale, "emailDetail.received") : t(locale, "emailDetail.sent")}
                        </span>
                        {isEmailUnread && (
                          <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full font-bold">
                            {t(locale, "emails.unread")}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">
                        {formatDate(e.date)}
                      </span>
                    </div>
                    <div className="px-5 py-3 border-t border-gray-100">
                      <p className="text-sm font-medium text-gray-800 mb-2">
                        {e.subject || t(locale, "emailDetail.noSubject")}
                      </p>
                      {e.body_text ? (
                        <pre className="text-sm text-gray-600 whitespace-pre-wrap font-sans leading-relaxed max-h-[400px] overflow-y-auto">
                          {e.body_text}
                        </pre>
                      ) : (
                        <p className="text-sm text-gray-500">{e.snippet}</p>
                      )}
                      {e.attachments && e.attachments.length > 0 && (
                        <AttachmentList
                          attachments={e.attachments}
                          locale={locale}
                        />
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Reply form */}
          {latestInbound && (
            <ReplyForm
              locale={locale}
              emailId={latestInbound.id}
              toEmail={latestInbound.from_email ?? ""}
              subject={
                latestInbound.subject?.startsWith("Re:")
                  ? latestInbound.subject
                  : `Re: ${latestInbound.subject ?? ""}`
              }
            />
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {customer ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">{t(locale, "emailDetail.customerInfo")}</h3>
              <div className="space-y-2 text-sm">
                <p className="font-medium text-gray-800">{customer.customer_name}</p>
                {customer.company_name && (
                  <p className="text-gray-500">{customer.company_name}</p>
                )}
                {customer.country && (
                  <p className="text-gray-500">{customer.country}</p>
                )}
                {customer.email && (
                  <p className="text-gray-400 text-xs">{customer.email}</p>
                )}
              </div>

              {invoices.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <h4 className="text-xs font-semibold text-gray-500 mb-3">
                    {t(locale, "emailDetail.purchaseHistory", { count: invoices.length })}
                  </h4>
                  <div className="space-y-3">
                    {invoices.map((inv) => (
                      <div key={inv.invoice_id}>
                        <Link
                          href={`/invoices/${inv.invoice_id}`}
                          className="flex items-center justify-between text-xs hover:bg-gray-50 px-2 py-1.5 rounded"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-blue-600 font-medium">
                              {inv.invoice_number}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                              inv.status === "paid"
                                ? "bg-green-100 text-green-700"
                                : inv.status === "sent"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-gray-100 text-gray-600"
                            }`}>
                              {inv.status}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-gray-700 font-medium">
                              {formatCurrency(inv.total)}
                            </span>
                            {inv.date && (
                              <p className="text-gray-400 text-[10px] mt-0.5">
                                {new Intl.DateTimeFormat("ko-KR", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                }).format(new Date(inv.date))}
                              </p>
                            )}
                          </div>
                        </Link>
                        {inv.lineItems.length > 0 && (
                          <div className="ml-3 mt-1 space-y-0.5">
                            {inv.lineItems.map((item) => (
                              <div
                                key={item.line_item_id}
                                className="flex items-center justify-between text-[11px] text-gray-500 px-2 py-0.5"
                              >
                                <span className="truncate flex-1 mr-2">
                                  {item.name || "—"}
                                </span>
                                <span className="flex-shrink-0 text-gray-400">
                                  x{Number(item.quantity ?? 0)}
                                </span>
                                <span className="flex-shrink-0 ml-2 text-gray-600 font-medium w-16 text-right">
                                  {formatCurrency(item.item_total)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-sm text-gray-400">{t(locale, "emailDetail.noCustomer")}</p>
              <p className="text-xs text-gray-400 mt-1">{contactEmail}</p>
            </div>
          )}

          {/* Summary */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">{t(locale, "emailDetail.summary")}</h3>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-blue-50 rounded-lg px-3 py-2">
                <p className="text-lg font-bold text-blue-700">
                  {allEmails.filter((e) => e.is_inbound).length}
                </p>
                <p className="text-xs text-blue-500">{t(locale, "emailDetail.receivedCount")}</p>
              </div>
              <div className="bg-green-50 rounded-lg px-3 py-2">
                <p className="text-lg font-bold text-green-700">
                  {allEmails.filter((e) => !e.is_inbound).length}
                </p>
                <p className="text-xs text-green-500">{t(locale, "emailDetail.sentCount")}</p>
              </div>
            </div>
            {allEmails.length > 0 && (
              <p className="text-xs text-gray-400 mt-3 text-center">
                {t(locale, "emailDetail.firstContact", { date: formatDate(allEmails[0].date) })}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
