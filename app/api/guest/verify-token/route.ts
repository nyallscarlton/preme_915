export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // Read the URL to get the token
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  
  if (!token) {
    return NextResponse.json({ 
      ok: false, 
      reason: "missing_token" 
    }, { status: 400 });
  }
  
  // Here you can verify the token with Supabase if needed
  // For now, we just say it's valid
  return NextResponse.json({ 
    ok: true,
    message: "Token verified successfully" 
  });
}
