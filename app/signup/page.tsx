"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"

export default function SignupPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSignup = async () => {
    console.log("=== SIGNUP ATTEMPT ===")
    console.log("Email:", email)
    console.log("Password length:", password.length)
    console.log("Name:", firstName, lastName)

    if (!email || !password || !firstName || !lastName) {
      alert("Please fill in all fields")
      return
    }

    setLoading(true)
    setError("")

    try {
      console.log("Calling Supabase signup...")

      const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
          },
        },
      })

      console.log("Supabase signup response:", { data, error })

      if (error) {
        console.error("Signup error:", error)
        setError(error.message)
        alert("Signup failed: " + error.message)
      } else if (data.user) {
        console.log("Signup successful!")
        alert("Account created successfully! You can now login.")
        window.location.href = "/login"
      } else {
        setError("Signup failed - no user returned")
        alert("Signup failed - no user returned")
      }
    } catch (err) {
      console.error("Exception during signup:", err)
      setError("Signup error: " + err.message)
      alert("Signup error: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "black", color: "white", padding: "40px" }}>
      <div style={{ maxWidth: "400px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "32px", marginBottom: "30px", textAlign: "center" }}>Create PREME Account</h1>

        <div style={{ marginBottom: "20px" }}>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            style={{
              width: "100%",
              padding: "12px",
              backgroundColor: "#333",
              color: "white",
              border: "1px solid #666",
              borderRadius: "4px",
            }}
            placeholder="First Name"
          />
        </div>

        <div style={{ marginBottom: "20px" }}>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            style={{
              width: "100%",
              padding: "12px",
              backgroundColor: "#333",
              color: "white",
              border: "1px solid #666",
              borderRadius: "4px",
            }}
            placeholder="Last Name"
          />
        </div>

        <div style={{ marginBottom: "20px" }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: "100%",
              padding: "12px",
              backgroundColor: "#333",
              color: "white",
              border: "1px solid #666",
              borderRadius: "4px",
            }}
            placeholder="Email Address"
          />
        </div>

        <div style={{ marginBottom: "20px" }}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: "100%",
              padding: "12px",
              backgroundColor: "#333",
              color: "white",
              border: "1px solid #666",
              borderRadius: "4px",
            }}
            placeholder="Password (min 6 characters)"
          />
        </div>

        <button
          onClick={handleSignup}
          disabled={loading}
          style={{
            width: "100%",
            padding: "15px",
            backgroundColor: loading ? "#666" : "#997100",
            color: "black",
            border: "none",
            borderRadius: "4px",
            fontSize: "16px",
            fontWeight: "bold",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Creating Account..." : "Create Account"}
        </button>

        <div style={{ textAlign: "center", marginTop: "20px" }}>
          <p style={{ color: "#ccc" }}>
            Already have an account?{" "}
            <a href="/login" style={{ color: "#997100" }}>
              Sign in here
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
