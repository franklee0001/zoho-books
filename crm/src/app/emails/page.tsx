import { prisma } from "@/lib/prisma";
import Link from "next/link";
import EmailSyncButton from "./sync-button";
import { Prisma } from "@prisma/client";
import { getLocale } from "@/lib/get-locale";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

interface SearchParams {
  q?: string;
  filter?: string;
  page?: string;
}

const PAGE_SIZE = 30;

interface ConversationRow {
  contact_email: string;
  contact_name: string;
  customer_name: string | null;
  customer_id: string | null;
  latest_subject: string | null;
  latest_snippet: string | null;
  latest_date: Date | null;
  email_count: number;
  last_is_inbound: boolean;
  latest_id: number;
  attachment_count: number;
  unread_count: number;
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  const now = new Date();
  const date = new Date(d);
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return new Intl.DateTimeFormat("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }
  if (days < 7) {
    return new Intl.DateTimeFormat("ko-KR", {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function buildHref(query: string, filter: string, page: number): string {
  const p = new URLSearchParams();
  if (query) p.set("q", query);
  if (filter !== "all") p.set("filter", filter);
  if (page > 1) p.set("page", String(page));
  const qs = p.toString();
  return `/emails${qs ? `?${qs}` : ""}`;
}

const FILTER_OPTIONS = [
  { key: "all", labelKey: "emails.all" },
  { key: "unread", labelKey: "emails.unread" },
  { key: "unanswered", labelKey: "emails.unanswered" },
  { key: "answered", labelKey: "emails.answered" },
];

const chipBase =
  "inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer";
const chipActive = "bg-blue-600 text-white";
const chipInactive = "bg-gray-100 text-gray-600 hover:bg-gray-200";

export default async function EmailsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const locale = await getLocale();
  const query = params.q ?? "";
  const filter = params.filter ?? "all";
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const offset = (page - 1) * PAGE_SIZE;

  let isConnected = false;
  let connectedEmail = "";
  let conversations: ConversationRow[] = [];
  let total = 0;
  let error: string | null = null;

  try {
    const token = await prisma.gmailToken.findFirst({
      orderBy: { updated_at: "desc" },
      select: { email: true },
    });
    isConnected = !!token;
    connectedEmail = token?.email ?? "";

    if (isConnected) {
      // Build search condition
      const searchWhere = query
        ? Prisma.sql`AND (e.subject ILIKE ${"%" + query + "%"} OR e.from_email ILIKE ${"%" + query + "%"} OR e.from_name ILIKE ${"%" + query + "%"} OR e.snippet ILIKE ${"%" + query + "%"})`
        : Prisma.empty;

      // Filter conditions
      const filterWhere =
        filter === "unread"
          ? Prisma.sql`AND uc.unread_count > 0`
          : filter === "unanswered"
            ? Prisma.sql`AND sub.last_is_inbound = true`
            : filter === "answered"
              ? Prisma.sql`AND sub.last_is_inbound = false`
              : Prisma.empty;

      // Query conversations grouped by pre-computed contact_email (indexed)
      const result = await prisma.$queryRaw<ConversationRow[]>`
        WITH latest AS (
          SELECT DISTINCT ON (e.contact_email)
            e.contact_email,
            COALESCE(e.from_name, e.from_email) AS contact_name,
            e.subject,
            e.snippet,
            e.date,
            e.is_inbound,
            e.id,
            e.customer_id
          FROM emails e
          WHERE e.contact_email IS NOT NULL ${searchWhere}
          ORDER BY e.contact_email, e.date DESC
        ),
        counts AS (
          SELECT contact_email, COUNT(*)::bigint AS total_count
          FROM emails
          WHERE contact_email IS NOT NULL
          GROUP BY contact_email
        ),
        att_counts AS (
          SELECT e.contact_email, COUNT(ea.id)::int AS att_count
          FROM emails e
          JOIN email_attachments ea ON ea.email_id = e.id
          WHERE e.contact_email IS NOT NULL
          GROUP BY e.contact_email
        ),
        unread_counts AS (
          SELECT contact_email, COUNT(*)::int AS unread_count
          FROM emails
          WHERE contact_email IS NOT NULL AND 'UNREAD' = ANY(labels)
          GROUP BY contact_email
        )
        SELECT
          l.contact_email,
          l.contact_name,
          c.customer_name,
          l.customer_id,
          l.subject AS latest_subject,
          l.snippet AS latest_snippet,
          l.date AS latest_date,
          l.id::int AS latest_id,
          l.is_inbound AS last_is_inbound,
          ct.total_count::int AS email_count,
          COALESCE(ac.att_count, 0)::int AS attachment_count,
          COALESCE(uc.unread_count, 0)::int AS unread_count
        FROM latest l
        JOIN counts ct USING (contact_email)
        LEFT JOIN att_counts ac USING (contact_email)
        LEFT JOIN unread_counts uc USING (contact_email)
        LEFT JOIN customers c ON c.customer_id = l.customer_id
        WHERE 1=1 ${filterWhere}
        ORDER BY l.date DESC NULLS LAST
        LIMIT ${PAGE_SIZE} OFFSET ${offset}
      `;

      conversations = result.map((r) => ({
        ...r,
        email_count: Number(r.email_count),
        latest_id: Number(r.latest_id),
        attachment_count: Number(r.attachment_count ?? 0),
        unread_count: Number(r.unread_count ?? 0),
      }));

      // Count total conversations
      const countResult = await prisma.$queryRaw<[{ count: bigint }]>`
        WITH latest AS (
          SELECT DISTINCT ON (contact_email) contact_email, is_inbound
          FROM emails
          WHERE contact_email IS NOT NULL ${searchWhere}
          ORDER BY contact_email, date DESC
        ),
        unread_counts AS (
          SELECT contact_email, COUNT(*)::int AS unread_count
          FROM emails
          WHERE contact_email IS NOT NULL AND 'UNREAD' = ANY(labels)
          GROUP BY contact_email
        )
        SELECT COUNT(*)::bigint AS count
        FROM latest sub
        LEFT JOIN unread_counts uc USING (contact_email)
        WHERE 1=1 ${filterWhere}
      `;
      total = Number(countResult[0]?.count ?? 0);
    }
  } catch (e) {
    error = e instanceof Error ? e.message : "DB connection failed";
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t(locale, "emails.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isConnected
              ? t(locale, "emails.conversations", { email: connectedEmail, count: total })
              : t(locale, "emails.notConnected")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isConnected ? (
            <EmailSyncButton locale={locale} />
          ) : (
            <a
              href="/api/gmail/auth"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              {t(locale, "emails.connectGmail")}
            </a>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm">
          <p className="font-semibold text-amber-800">Error</p>
          <p className="text-amber-700 mt-1">{error}</p>
        </div>
      )}

      {!isConnected && !error && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
          <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <h2 className="text-lg font-semibold text-gray-700 mb-2">{t(locale, "emails.connectTitle")}</h2>
          <p className="text-sm text-gray-500 mb-6">{t(locale, "emails.connectDesc")}</p>
          <a href="/api/gmail/auth" className="px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
            {t(locale, "emails.connectGmail")}
          </a>
        </div>
      )}

      {isConnected && (
        <>
          {/* Search */}
          <form method="GET" className="mb-4">
            <div className="flex gap-3">
              <input
                type="text"
                name="q"
                defaultValue={query}
                placeholder={t(locale, "emails.searchPlaceholder")}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input type="hidden" name="filter" value={filter} />
              <button type="submit" className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                {t(locale, "common.search")}
              </button>
            </div>
          </form>

          {/* Filter chips */}
          <div className="mb-6 flex flex-wrap gap-2">
            {FILTER_OPTIONS.map((f) => {
              const isActive = filter === f.key;
              return (
                <a
                  key={f.key}
                  href={buildHref(query, f.key, 1)}
                  className={`${chipBase} ${isActive ? chipActive : chipInactive}`}
                >
                  {t(locale, f.labelKey)}
                </a>
              );
            })}
          </div>

          {/* Conversation list */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-100">
              {conversations.map((conv) => {
                const isUnread = conv.unread_count > 0;
                return (
                  <Link
                    key={conv.contact_email}
                    href={`/emails/${conv.latest_id}`}
                    className={`block px-6 py-4 hover:bg-gray-100 transition-colors ${isUnread ? "bg-blue-50 border-l-3 border-l-blue-500" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {/* Unread indicator */}
                          {isUnread && (
                            <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-600 flex-shrink-0" title={t(locale, "emails.unread")} />
                          )}
                          {/* Unanswered badge */}
                          {!isUnread && conv.last_is_inbound && (
                            <span className="inline-block w-2 h-2 rounded-full bg-red-400 flex-shrink-0" title="Unanswered" />
                          )}
                          <span className={`text-sm truncate ${isUnread ? "font-bold text-gray-950" : "font-medium text-gray-700"}`}>
                            {conv.customer_name || conv.contact_name || conv.contact_email}
                          </span>
                          {conv.customer_name && (
                            <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                              {t(locale, "emails.customer")}
                            </span>
                          )}
                          {isUnread && (
                            <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full font-bold flex-shrink-0">
                              {conv.unread_count}
                            </span>
                          )}
                          {conv.attachment_count > 0 && (
                            <span className="text-gray-400 flex-shrink-0" title={`${conv.attachment_count} attachments`}>
                              <svg className="w-3.5 h-3.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                              </svg>
                            </span>
                          )}
                          <span className={`text-xs flex-shrink-0 ${isUnread ? "text-gray-500" : "text-gray-400"}`}>
                            {conv.email_count}
                          </span>
                        </div>
                        <p className={`text-sm truncate ${isUnread ? "font-bold text-gray-950" : "text-gray-600"}`}>
                          {conv.latest_subject || "(no subject)"}
                        </p>
                        <p className={`text-xs truncate mt-0.5 ${isUnread ? "text-gray-700" : "text-gray-400"}`}>
                          {conv.latest_snippet}
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <span className={`text-xs whitespace-nowrap ${isUnread ? "font-bold text-blue-700" : "text-gray-400"}`}>
                          {formatDate(conv.latest_date)}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
              {conversations.length === 0 && (
                <div className="px-6 py-12 text-center text-gray-400 text-sm">
                  {query || filter !== "all"
                    ? t(locale, "emails.noMatch")
                    : t(locale, "emails.noEmails")}
                </div>
              )}
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-gray-500">{t(locale, "common.page", { page, total: totalPages })}</p>
              <div className="flex items-center gap-1">
                {page > 1 && (
                  <a href={buildHref(query, filter, page - 1)} className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                    &lsaquo; {t(locale, "common.previous")}
                  </a>
                )}
                {page < totalPages && (
                  <a href={buildHref(query, filter, page + 1)} className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                    {t(locale, "common.next")} &rsaquo;
                  </a>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
