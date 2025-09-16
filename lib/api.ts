const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "/api"

interface ApiResponse<T = any> {
  data?: T
  error?: string
  success: boolean
}

class ApiClient {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    try {
      const url = `${API_BASE_URL}${endpoint}`
      const response = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
        ...options,
      })

      // For now, return mock data since this is UI-only
      if (endpoint.includes("/applications")) {
        return {
          success: true,
          data: { id: "mock-app-123", status: "submitted" } as T,
        }
      }

      if (endpoint.includes("/auth/resend")) {
        return {
          success: true,
          data: { message: "Verification email sent" } as T,
        }
      }

      return {
        success: true,
        data: {} as T,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "An error occurred",
      }
    }
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: "GET" })
  }

  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: "DELETE" })
  }

  // Specific helper methods
  async resendVerification(email: string): Promise<ApiResponse> {
    return this.post("/auth/resend", { email })
  }

  async submitApplication(formData: any): Promise<ApiResponse> {
    return this.post("/applications", formData)
  }
}

export const api = new ApiClient()
