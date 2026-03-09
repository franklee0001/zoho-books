"use client";

import { useState } from "react";
import { t, type Locale } from "@/lib/i18n";

interface ChatInputProps {
  onSend: (text: string) => void;
  isLoading: boolean;
  locale: Locale;
  disabled: boolean;
  onCreateChat: () => void;
}

export default function ChatInput({
  onSend,
  isLoading,
  locale,
  disabled,
  onCreateChat,
}: ChatInputProps) {
  const [input, setInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || disabled) return;
    onSend(input);
    setInput("");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && input.trim() && !isLoading) {
        onSend(input);
        setInput("");
      }
    }
  };

  if (disabled) {
    return (
      <div className="px-6 py-4 border-t border-gray-100">
        <button
          onClick={onCreateChat}
          className="w-full px-4 py-3 text-sm font-medium text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors"
        >
          + {t(locale, "aiChat.newChat")}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="px-6 py-4 border-t border-gray-100">
      <div className="flex items-end gap-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t(locale, "aiChat.placeholder")}
          rows={1}
          className="flex-1 resize-none px-4 py-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent max-h-32"
          style={{ minHeight: "44px" }}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="px-5 py-3 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
        >
          {isLoading ? t(locale, "aiChat.thinking") : t(locale, "aiChat.send")}
        </button>
      </div>
    </form>
  );
}
