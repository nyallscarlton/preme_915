"use client";
import { useEffect } from "react";

interface VerifyGuestTokenClientProps {
  token?: string;
}

export default function VerifyGuestTokenClient({ token }: VerifyGuestTokenClientProps) {
  useEffect(() => {
    if (!token) return;

    const verifyToken = async () => {
      try {
        const response = await fetch(`/api/guest/verify-token?token=${token}`, {
          cache: "no-store",
        });
        const data = await response.json();
        console.log("Token verified:", data);
      } catch (error) {
        console.log("Token verification failed:", error);
      }
    };

    verifyToken();
  }, [token]);

  return null;
}


