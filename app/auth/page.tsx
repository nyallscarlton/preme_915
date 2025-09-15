"use client"

import { useRouter, useSearchParams } from "next/navigation"

export default function AuthPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextUrl = searchParams.get("next") || "/apply"

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL

  const missingVars = []
  if (!supabaseUrl) missingVars.push("NEXT_PUBLIC_SUPABASE_URL")
  if (!supabaseAnonKey) missingVars.push("NEXT_PUBLIC_SUPABASE_ANON_KEY")

  if (missingVars.length > 0) {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "400px",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            padding: "24px",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                backgroundColor: "#ef4444",
                borderRadius: "50%",
                margin: "0 auto 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: "24px",
              }}
            >
              ⚠
            </div>
            <h1 style={{ fontSize: "24px", fontWeight: "bold", margin: "0 0 8px 0" }}>Environment Variables Missing</h1>
            <p style={{ color: "#6b7280", margin: 0 }}>The following environment variables need to be configured:</p>
          </div>

          <div style={{ marginBottom: "24px" }}>
            <div style={{ fontSize: "14px", marginBottom: "16px" }}>
              {missingVars.map((varName) => (
                <div
                  key={varName}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    color: "#dc2626",
                    marginBottom: "8px",
                  }}
                >
                  <span>❌</span>
                  <span style={{ fontFamily: "monospace", fontSize: "12px" }}>{varName}</span>
                </div>
              ))}
              {supabaseUrl && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    color: "#16a34a",
                    marginBottom: "8px",
                  }}
                >
                  <span>✅</span>
                  <span style={{ fontFamily: "monospace", fontSize: "12px" }}>NEXT_PUBLIC_SUPABASE_URL</span>
                </div>
              )}
              {supabaseAnonKey && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    color: "#16a34a",
                    marginBottom: "8px",
                  }}
                >
                  <span>✅</span>
                  <span style={{ fontFamily: "monospace", fontSize: "12px" }}>NEXT_PUBLIC_SUPABASE_ANON_KEY</span>
                </div>
              )}
            </div>

            <div
              style={{
                fontSize: "14px",
                color: "#6b7280",
                backgroundColor: "#f9fafb",
                padding: "12px",
                borderRadius: "6px",
                marginBottom: "16px",
              }}
            >
              <p style={{ fontWeight: "500", margin: "0 0 8px 0" }}>Add these to your Vercel project:</p>
              <ol style={{ margin: 0, paddingLeft: "16px", fontSize: "12px" }}>
                <li>Click the gear icon (⚙️) in the top right</li>
                <li>Select "Environment Variables"</li>
                <li>Add the missing variables</li>
              </ol>
            </div>

            <button
              onClick={() => router.push(`${nextUrl}?guest=1`)}
              style={{
                width: "100%",
                padding: "12px",
                backgroundColor: "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              Continue as Guest →
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          padding: "24px",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              backgroundColor: "#16a34a",
              borderRadius: "50%",
              margin: "0 auto 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: "24px",
            }}
          >
            ✓
          </div>
          <h1 style={{ fontSize: "24px", fontWeight: "bold", margin: "0 0 8px 0" }}>
            Environment Variables Configured
          </h1>
          <p style={{ color: "#6b7280", margin: 0 }}>Supabase environment variables are properly set up!</p>
        </div>

        <div style={{ marginBottom: "24px" }}>
          <div style={{ fontSize: "14px", marginBottom: "16px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                color: "#16a34a",
                marginBottom: "8px",
              }}
            >
              <span>✅</span>
              <span style={{ fontFamily: "monospace", fontSize: "12px" }}>NEXT_PUBLIC_SUPABASE_URL</span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                color: "#16a34a",
                marginBottom: "8px",
              }}
            >
              <span>✅</span>
              <span style={{ fontFamily: "monospace", fontSize: "12px" }}>NEXT_PUBLIC_SUPABASE_ANON_KEY</span>
            </div>
            {baseUrl && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  color: "#16a34a",
                  marginBottom: "8px",
                }}
              >
                <span>✅</span>
                <span style={{ fontFamily: "monospace", fontSize: "12px" }}>NEXT_PUBLIC_BASE_URL</span>
              </div>
            )}
          </div>

          <div
            style={{
              fontSize: "14px",
              color: "#6b7280",
              backgroundColor: "#f0fdf4",
              padding: "12px",
              borderRadius: "6px",
              marginBottom: "16px",
            }}
          >
            <p style={{ fontWeight: "500", margin: "0 0 8px 0" }}>Ready for authentication!</p>
            <p style={{ margin: 0, fontSize: "12px" }}>The Supabase client can now be properly initialized.</p>
          </div>

          <button
            onClick={() => router.push(nextUrl)}
            style={{
              width: "100%",
              padding: "12px",
              backgroundColor: "#16a34a",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            Continue to Application →
          </button>
        </div>
      </div>
    </div>
  )
}
