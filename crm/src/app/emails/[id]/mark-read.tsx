"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export default function MarkAsRead({
  contactEmail,
}: {
  contactEmail: string;
}) {
  const called = useRef(false);
  const router = useRouter();

  useEffect(() => {
    if (called.current || !contactEmail) return;
    called.current = true;

    fetch("/api/gmail/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactEmail }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.marked > 0) {
          router.refresh();
        }
      })
      .catch(() => {});
  }, [contactEmail, router]);

  return null;
}
