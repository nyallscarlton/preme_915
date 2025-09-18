"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, Plus } from "lucide-react"
import Link from "next/link"
import { api } from "@/lib/api"

interface Application {
  id: string
  status: string
  loanAmount: number
  propertyAddress: string
  submittedAt: string
}

export default function DashboardPage() {
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchApplications = async () => {
      try {
        const response = await api.get<Application[]>("/applications")

        // Mock empty state for now - in production this would use real data
        setApplications([])
      } catch (error) {
        console.error("Error fetching applications:", error)
        setApplications([])
      } finally {
        setLoading(false)
      }
    }

    fetchApplications()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <header className="border-b border-gray-200">
          <div className="container mx-auto px-6 py-6">
            <Link href="/" className="flex items-center">
              <div className="relative">
                <div className="absolute -top-2 left-[1.1rem] w-4 h-1 bg-[#997100]"></div>
                <span className="text-3xl font-bold tracking-wide text-gray-900">PREME</span>
              </div>
            </Link>
          </div>
        </header>
        <div className="container mx-auto px-6 py-24">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#997100] mx-auto mb-4"></div>
            <p className="text-gray-600">Loading your dashboard...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center">
              <div className="relative">
                <div className="absolute -top-2 left-[1.1rem] w-4 h-1 bg-[#997100]"></div>
                <span className="text-3xl font-bold tracking-wide text-gray-900">PREME</span>
              </div>
            </Link>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Dashboard</span>
              <Button variant="outline" asChild size="sm">
                <Link href="/account">Account Settings</Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Welcome Section */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome back</h1>
            <p className="text-gray-600">Manage your loan applications and track their progress</p>
          </div>

          {/* Applications Section */}
          {applications.length === 0 ? (
            <Card className="bg-white border-gray-200">
              <CardContent className="p-12 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <FileText className="h-8 w-8 text-gray-400" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome back</h2>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                  You don't have any applications yet. Get started by applying for a loan or browse our loan programs.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button asChild className="bg-[#997100] hover:bg-[#b8850a] text-white">
                    <Link href="/apply">
                      <Plus className="mr-2 h-4 w-4" />
                      Start an Application
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    asChild
                    className="border-gray-300 text-gray-700 hover:bg-gray-50 bg-transparent"
                  >
                    <Link href="/apply">Go to Apply</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            // Applications list (for when user has applications)
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Your Applications</h2>
                <Button asChild className="bg-[#997100] hover:bg-[#b8850a] text-white">
                  <Link href="/apply">
                    <Plus className="mr-2 h-4 w-4" />
                    New Application
                  </Link>
                </Button>
              </div>

              <div className="grid gap-6">
                {applications.map((app) => (
                  <Card key={app.id} className="bg-white border-gray-200">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-gray-900">Application #{app.id}</CardTitle>
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">{app.status}</span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-sm text-gray-600">Loan Amount</p>
                          <p className="font-semibold text-gray-900">${app.loanAmount.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Property</p>
                          <p className="font-semibold text-gray-900">{app.propertyAddress}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Submitted</p>
                          <p className="font-semibold text-gray-900">
                            {new Date(app.submittedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
