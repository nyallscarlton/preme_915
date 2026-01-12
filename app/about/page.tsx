"use client";
import { useEffect, useState } from "react";

export default function AboutPage() {
  const [foreground, setForeground] = useState<string>("");

  useEffect(() => {
    // Only run this in the browser, not on the server!
    try {
      const root = document.documentElement;
      const style = getComputedStyle(root);
      setForeground(style.getPropertyValue("--foreground")?.trim() || "");
    } catch (error) {
      // It's okay if this fails, we just won't show the color
    }
  }, []);

  return (
    <div className="mx-auto max-w-3xl p-6 bg-white border rounded-xl">
      <h1 className="text-2xl font-semibold mb-2">About</h1>
      <p className="text-sm text-gray-600 mb-2">
        This page is now a client component to avoid SSR issues.
      </p>
      {foreground && (
        <p className="text-xs text-gray-500">Foreground color: {foreground}</p>
      )}
    </div>
  );
}
