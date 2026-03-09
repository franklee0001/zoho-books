"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { t, type Locale } from "@/lib/i18n";

interface ReplyFormProps {
  emailId: number;
  toEmail: string;
  subject: string;
  locale: Locale;
}

type Status = "idle" | "generating" | "ready" | "sending" | "sent" | "error";

export default function ReplyForm({ emailId, toEmail, subject, locale }: ReplyFormProps) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleGenerate() {
    setStatus("generating");
    setErrorMsg("");
    try {
      const res = await fetch("/api/gmail/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setDraft(data.draft);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Generation failed");
    }
  }

  async function handleSend() {
    if (!draft.trim()) return;
    setStatus("sending");
    setErrorMsg("");
    try {
      const res = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId, body: draft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      setStatus("sent");
      router.refresh();
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Send failed");
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{t(locale, "reply.title")}</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {t(locale, "reply.to", { email: toEmail, subject })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {status === "sent" && (
            <span className="text-sm text-green-600 font-medium">{t(locale, "reply.sentBadge")}</span>
          )}
          {status === "error" && (
            <span className="text-sm text-red-600 font-medium">{errorMsg}</span>
          )}
        </div>
      </div>

      <div className="p-6">
        {status === "idle" && (
          <div className="text-center py-8">
            <button
              onClick={handleGenerate}
              className="px-6 py-3 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
            >
              {t(locale, "reply.generateAI")}
            </button>
            <p className="text-xs text-gray-400 mt-2">
              {t(locale, "reply.generateDesc")}
            </p>
          </div>
        )}

        {status === "generating" && (
          <div className="text-center py-8">
            <div className="inline-block w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500 mt-3">{t(locale, "reply.generating")}</p>
          </div>
        )}

        {(status === "ready" || status === "sending" || status === "sent" || (status === "error" && draft)) && (
          <div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={12}
              disabled={status === "sending" || status === "sent"}
              className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y disabled:bg-gray-50 disabled:text-gray-500"
              placeholder={t(locale, "reply.editPlaceholder")}
            />
            <div className="flex items-center justify-between mt-4">
              <button
                onClick={handleGenerate}
                disabled={status === "sending" || status === "sent"}
                className="px-4 py-2 text-sm font-medium text-purple-600 border border-purple-300 rounded-lg hover:bg-purple-50 transition-colors disabled:opacity-50"
              >
                {t(locale, "reply.regenerate")}
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSend}
                  disabled={status === "sending" || status === "sent" || !draft.trim()}
                  className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {status === "sending" ? t(locale, "reply.sending") : status === "sent" ? t(locale, "reply.sent") : t(locale, "reply.send")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
