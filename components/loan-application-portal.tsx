"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { CalendarDays, DollarSign, FileText, User } from "lucide-react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

// Mock data for existing applications
const mockApplications = [
  {
    id: "APP-001",
    property: "123 Main St, Beverly Hills, CA",
    loanAmount: 850000,
    status: "Under Review",
    submittedDate: "2024-01-15",
    loanType: "Conventional",
  },
  {
    id: "APP-002",
    property: "456 Oak Ave, Manhattan Beach, CA",
    loanAmount: 1200000,
    status: "Approved",
    submittedDate: "2024-01-10",
    loanType: "Jumbo",
  },
]

export function LoanApplicationPortal() {
  const [activeTab, setActiveTab] = useState("dashboard")
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    propertyAddress: "",
    loanAmount: "",
    loanType: "",
    creditScore: "",
    annualIncome: "",
    employmentStatus: "",
    downPayment: "",
    additionalInfo: "",
    gender: "",
    dateOfBirth: "",
    ssn: "",
    citizenshipStatus: "",
    homeAddress: "",
    ownOrRent: "",
    currentEmployer: "",
    selfEmployed: "",
    accountName: "",
    accountType: "",
    accountNumber: "",
    accountBalance: "",
    balanceDate: "",
    entityName: "",
    einNumber: "",
    stateOfFormation: "",
    ownershipPercent: "",
    outstandingJudgments: "",
    declaredBankruptcy: "",
    propertyForeclosed: "",
    partyToLawsuit: "",
    loanForeclosure: "",
    downpaymentBorrowed: "",
    usCitizen: "",
    permanentResident: "",
    foreignNational: "",
    intendToOccupy: "",
    entityJudgments: "",
    entityLawsuit: "",
    felonyConviction: "",
    propertiesOwned: "",
    signature: "",
    printedName: "",
    signatureDate: "",
  })

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Form submitted:", formData)
    // Here you would typically send to your backend/Supabase
    alert("Application submitted successfully!")
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Approved":
        return "bg-green-600"
      case "Under Review":
        return "bg-yellow-600"
      case "Pending":
        return "bg-blue-600"
      default:
        return "bg-gray-600"
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-background">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img src="/PremeLogo_TextWhite_Transparent.png" alt="PREME Home Loans" className="h-12 w-auto" />
            </div>
            <Button
              variant="outline"
              className="border-primary text-primary hover:bg-primary hover:text-primary-foreground bg-transparent"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-2">Loan Application Portal</h2>
          <p className="text-muted-foreground">Manage your loan applications and submit new requests</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-muted border border-border">
            <TabsTrigger
              value="dashboard"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground"
            >
              <User className="w-4 h-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger
              value="applications"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground"
            >
              <FileText className="w-4 h-4 mr-2" />
              My Applications
            </TabsTrigger>
            <TabsTrigger
              value="new-application"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground"
            >
              <DollarSign className="w-4 h-4 mr-2" />
              New Application
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="mt-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Card className="bg-card border-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Applications</CardTitle>
                  <FileText className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">2</div>
                  <p className="text-xs text-muted-foreground">Active loan applications</p>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Loan Amount</CardTitle>
                  <DollarSign className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">$2.05M</div>
                  <p className="text-xs text-muted-foreground">Across all applications</p>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Last Activity</CardTitle>
                  <CalendarDays className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">5 days</div>
                  <p className="text-xs text-muted-foreground">Since last submission</p>
                </CardContent>
              </Card>
            </div>

            <Card className="mt-6 bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">Recent Activity</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Your latest loan application updates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm text-foreground">Application APP-001 moved to "Under Review"</p>
                      <p className="text-xs text-muted-foreground">2 days ago</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm text-foreground">Application APP-002 approved!</p>
                      <p className="text-xs text-muted-foreground">5 days ago</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* My Applications Tab */}
          <TabsContent value="applications" className="mt-6">
            <div className="space-y-4">
              {mockApplications.map((app) => (
                <Card key={app.id} className="bg-card border-border">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-foreground">{app.id}</CardTitle>
                      <Badge className={`${getStatusColor(app.status)} text-white`}>{app.status}</Badge>
                    </div>
                    <CardDescription className="text-muted-foreground">{app.property}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Loan Amount</p>
                        <p className="text-foreground font-semibold">${app.loanAmount.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Loan Type</p>
                        <p className="text-foreground font-semibold">{app.loanType}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Submitted</p>
                        <p className="text-foreground font-semibold">{app.submittedDate}</p>
                      </div>
                      <div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-primary text-primary hover:bg-primary hover:text-primary-foreground bg-transparent"
                        >
                          View Details
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* New Application Tab */}
          <TabsContent value="new-application" className="mt-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">New Loan Application</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Complete all sections below to submit your loan request
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-8">
                  {/* 1. Loan Details */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">
                      1. Loan Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="loanAmount" className="text-foreground">
                          Loan Amount
                        </Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                            $
                          </span>
                          <Input
                            id="loanAmount"
                            type="number"
                            value={formData.loanAmount}
                            onChange={(e) => handleInputChange("loanAmount", e.target.value)}
                            className="bg-input border-border text-foreground focus:border-primary pl-8"
                            placeholder="500000"
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="loanType" className="text-foreground">
                          Loan Type
                        </Label>
                        <RadioGroup
                          value={formData.loanType}
                          onValueChange={(value) => handleInputChange("loanType", value)}
                          className="flex flex-col space-y-2"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="fix-flip" id="fix-flip" />
                            <Label htmlFor="fix-flip" className="text-foreground">
                              Fix & Flip
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="buy-hold" id="buy-hold" />
                            <Label htmlFor="buy-hold" className="text-foreground">
                              Buy & Hold
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="refinance" id="refinance" />
                            <Label htmlFor="refinance" className="text-foreground">
                              Refinance
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="propertyAddress" className="text-foreground">
                        Subject Property Address
                      </Label>
                      <Textarea
                        id="propertyAddress"
                        value={formData.propertyAddress}
                        onChange={(e) => handleInputChange("propertyAddress", e.target.value)}
                        className="bg-input border-border text-foreground focus:border-primary"
                        placeholder="Enter complete property address including street, city, state, and ZIP code"
                        required
                      />
                    </div>
                  </div>

                  {/* 2. Sponsor Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">
                      2. Sponsor Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName" className="text-foreground">
                          First Name
                        </Label>
                        <Input
                          id="firstName"
                          value={formData.firstName}
                          onChange={(e) => handleInputChange("firstName", e.target.value)}
                          className="bg-input border-border text-foreground focus:border-primary"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName" className="text-foreground">
                          Last Name
                        </Label>
                        <Input
                          id="lastName"
                          value={formData.lastName}
                          onChange={(e) => handleInputChange("lastName", e.target.value)}
                          className="bg-input border-border text-foreground focus:border-primary"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-foreground">Gender</Label>
                        <RadioGroup
                          value={formData.gender || ""}
                          onValueChange={(value) => handleInputChange("gender", value)}
                          className="flex flex-row space-x-6"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="male" id="male" />
                            <Label htmlFor="male" className="text-foreground">
                              Male
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="female" id="female" />
                            <Label htmlFor="female" className="text-foreground">
                              Female
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="other" id="other" />
                            <Label htmlFor="other" className="text-foreground">
                              Other
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dateOfBirth" className="text-foreground">
                          Date of Birth
                        </Label>
                        <Input
                          id="dateOfBirth"
                          type="date"
                          value={formData.dateOfBirth || ""}
                          onChange={(e) => handleInputChange("dateOfBirth", e.target.value)}
                          className="bg-input border-border text-foreground focus:border-primary"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-foreground">
                          Email Address
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => handleInputChange("email", e.target.value)}
                          className="bg-input border-border text-foreground focus:border-primary"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-foreground">Citizenship Status</Label>
                        <RadioGroup
                          value={formData.citizenshipStatus || ""}
                          onValueChange={(value) => handleInputChange("citizenshipStatus", value)}
                          className="flex flex-col space-y-2"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="us-citizen" id="us-citizen" />
                            <Label htmlFor="us-citizen" className="text-foreground">
                              U.S. Citizen
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="permanent-resident" id="permanent-resident" />
                            <Label htmlFor="permanent-resident" className="text-foreground">
                              Permanent Resident
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="foreign-national" id="foreign-national" />
                            <Label htmlFor="foreign-national" className="text-foreground">
                              Foreign National
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ssn" className="text-foreground">
                          Social Security Number
                        </Label>
                        <Input
                          id="ssn"
                          value={formData.ssn || ""}
                          onChange={(e) => handleInputChange("ssn", e.target.value)}
                          className="bg-input border-border text-foreground focus:border-primary"
                          placeholder="###-##-####"
                          maxLength={11}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone" className="text-foreground">
                          Phone Number
                        </Label>
                        <Input
                          id="phone"
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => handleInputChange("phone", e.target.value)}
                          className="bg-input border-border text-foreground focus:border-primary"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="creditScore" className="text-foreground">
                          Estimated Credit Score
                        </Label>
                        <Input
                          id="creditScore"
                          type="number"
                          value={formData.creditScore}
                          onChange={(e) => handleInputChange("creditScore", e.target.value)}
                          className="bg-input border-border text-foreground focus:border-primary"
                          placeholder="750"
                          min="300"
                          max="850"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="rentalsOwned" className="text-foreground">
                          Number of Rentals Owned
                        </Label>
                        <Input
                          id="rentalsOwned"
                          type="number"
                          value={formData.rentalsOwned || ""}
                          onChange={(e) => handleInputChange("rentalsOwned", e.target.value)}
                          className="bg-input border-border text-foreground focus:border-primary"
                          placeholder="0"
                          min="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="fixFlipOwned" className="text-foreground">
                          Number of Fix & Flip Properties Owned
                        </Label>
                        <Input
                          id="fixFlipOwned"
                          type="number"
                          value={formData.fixFlipOwned || ""}
                          onChange={(e) => handleInputChange("fixFlipOwned", e.target.value)}
                          className="bg-input border-border text-foreground focus:border-primary"
                          placeholder="0"
                          min="0"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="homeAddress" className="text-foreground">
                        Home Address
                      </Label>
                      <Textarea
                        id="homeAddress"
                        value={formData.homeAddress || ""}
                        onChange={(e) => handleInputChange("homeAddress", e.target.value)}
                        className="bg-input border-border text-foreground focus:border-primary"
                        placeholder="Enter your complete home address"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-foreground">Do you own or rent?</Label>
                        <RadioGroup
                          value={formData.ownOrRent || ""}
                          onValueChange={(value) => handleInputChange("ownOrRent", value)}
                          className="flex flex-row space-x-6"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="own" id="own" />
                            <Label htmlFor="own" className="text-foreground">
                              Own
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="rent" id="rent" />
                            <Label htmlFor="rent" className="text-foreground">
                              Rent
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="currentEmployer" className="text-foreground">
                          Current Employer
                        </Label>
                        <Input
                          id="currentEmployer"
                          value={formData.currentEmployer || ""}
                          onChange={(e) => handleInputChange("currentEmployer", e.target.value)}
                          className="bg-input border-border text-foreground focus:border-primary"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-foreground">Self Employed?</Label>
                      <RadioGroup
                        value={formData.selfEmployed || ""}
                        onValueChange={(value) => handleInputChange("selfEmployed", value)}
                        className="flex flex-row space-x-6"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="yes" id="self-employed-yes" />
                          <Label htmlFor="self-employed-yes" className="text-foreground">
                            Yes
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="no" id="self-employed-no" />
                          <Label htmlFor="self-employed-no" className="text-foreground">
                            No
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </div>

                  {/* 3. Liquidity Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">
                      3. Liquidity Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="accountName" className="text-foreground">
                          Account Name
                        </Label>
                        <Input
                          id="accountName"
                          value={formData.accountName || ""}
                          onChange={(e) => handleInputChange("accountName", e.target.value)}
                          className="bg-input border-border text-foreground focus:border-primary"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="accountType" className="text-foreground">
                          Account Type
                        </Label>
                        <Input
                          id="accountType"
                          value={formData.accountType || ""}
                          onChange={(e) => handleInputChange("accountType", e.target.value)}
                          className="bg-input border-border text-foreground focus:border-primary"
                          placeholder="Checking, Savings, Investment, etc."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="accountNumber" className="text-foreground">
                          Account Number
                        </Label>
                        <Input
                          id="accountNumber"
                          value={formData.accountNumber || ""}
                          onChange={(e) => handleInputChange("accountNumber", e.target.value)}
                          className="bg-input border-border text-foreground focus:border-primary"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="accountBalance" className="text-foreground">
                          Account Balance
                        </Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                            $
                          </span>
                          <Input
                            id="accountBalance"
                            type="number"
                            value={formData.accountBalance || ""}
                            onChange={(e) => handleInputChange("accountBalance", e.target.value)}
                            className="bg-input border-border text-foreground focus:border-primary pl-8"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="balanceDate" className="text-foreground">
                          Date of Balance
                        </Label>
                        <Input
                          id="balanceDate"
                          type="date"
                          value={formData.balanceDate || ""}
                          onChange={(e) => handleInputChange("balanceDate", e.target.value)}
                          className="bg-input border-border text-foreground focus:border-primary"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 4. Borrowing Entity */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">
                      4. Borrowing Entity
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="entityName" className="text-foreground">
                          Entity Legal Name
                        </Label>
                        <Input
                          id="entityName"
                          value={formData.entityName || ""}
                          onChange={(e) => handleInputChange("entityName", e.target.value)}
                          className="bg-input border-border text-foreground focus:border-primary"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="einNumber" className="text-foreground">
                          EIN Number
                        </Label>
                        <Input
                          id="einNumber"
                          value={formData.einNumber || ""}
                          onChange={(e) => handleInputChange("einNumber", e.target.value)}
                          className="bg-input border-border text-foreground focus:border-primary"
                          placeholder="##-#######"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="stateOfFormation" className="text-foreground">
                          State of Formation
                        </Label>
                        <Select
                          value={formData.stateOfFormation || ""}
                          onValueChange={(value) => handleInputChange("stateOfFormation", value)}
                        >
                          <SelectTrigger className="bg-input border-border text-foreground focus:border-primary">
                            <SelectValue placeholder="Select state" />
                          </SelectTrigger>
                          <SelectContent className="bg-input border-border">
                            <SelectItem value="AL">Alabama</SelectItem>
                            <SelectItem value="AK">Alaska</SelectItem>
                            <SelectItem value="AZ">Arizona</SelectItem>
                            <SelectItem value="AR">Arkansas</SelectItem>
                            <SelectItem value="CA">California</SelectItem>
                            <SelectItem value="CO">Colorado</SelectItem>
                            <SelectItem value="CT">Connecticut</SelectItem>
                            <SelectItem value="DE">Delaware</SelectItem>
                            <SelectItem value="FL">Florida</SelectItem>
                            <SelectItem value="GA">Georgia</SelectItem>
                            <SelectItem value="HI">Hawaii</SelectItem>
                            <SelectItem value="ID">Idaho</SelectItem>
                            <SelectItem value="IL">Illinois</SelectItem>
                            <SelectItem value="IN">Indiana</SelectItem>
                            <SelectItem value="IA">Iowa</SelectItem>
                            <SelectItem value="KS">Kansas</SelectItem>
                            <SelectItem value="KY">Kentucky</SelectItem>
                            <SelectItem value="LA">Louisiana</SelectItem>
                            <SelectItem value="ME">Maine</SelectItem>
                            <SelectItem value="MD">Maryland</SelectItem>
                            <SelectItem value="MA">Massachusetts</SelectItem>
                            <SelectItem value="MI">Michigan</SelectItem>
                            <SelectItem value="MN">Minnesota</SelectItem>
                            <SelectItem value="MS">Mississippi</SelectItem>
                            <SelectItem value="MO">Missouri</SelectItem>
                            <SelectItem value="MT">Montana</SelectItem>
                            <SelectItem value="NE">Nebraska</SelectItem>
                            <SelectItem value="NV">Nevada</SelectItem>
                            <SelectItem value="NH">New Hampshire</SelectItem>
                            <SelectItem value="NJ">New Jersey</SelectItem>
                            <SelectItem value="NM">New Mexico</SelectItem>
                            <SelectItem value="NY">New York</SelectItem>
                            <SelectItem value="NC">North Carolina</SelectItem>
                            <SelectItem value="ND">North Dakota</SelectItem>
                            <SelectItem value="OH">Ohio</SelectItem>
                            <SelectItem value="OK">Oklahoma</SelectItem>
                            <SelectItem value="OR">Oregon</SelectItem>
                            <SelectItem value="PA">Pennsylvania</SelectItem>
                            <SelectItem value="RI">Rhode Island</SelectItem>
                            <SelectItem value="SC">South Carolina</SelectItem>
                            <SelectItem value="SD">South Dakota</SelectItem>
                            <SelectItem value="TN">Tennessee</SelectItem>
                            <SelectItem value="TX">Texas</SelectItem>
                            <SelectItem value="UT">Utah</SelectItem>
                            <SelectItem value="VT">Vermont</SelectItem>
                            <SelectItem value="VA">Virginia</SelectItem>
                            <SelectItem value="WA">Washington</SelectItem>
                            <SelectItem value="WV">West Virginia</SelectItem>
                            <SelectItem value="WI">Wisconsin</SelectItem>
                            <SelectItem value="WY">Wyoming</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ownershipPercent" className="text-foreground">
                          Ownership %
                        </Label>
                        <Input
                          id="ownershipPercent"
                          type="number"
                          value={formData.ownershipPercent || ""}
                          onChange={(e) => handleInputChange("ownershipPercent", e.target.value)}
                          className="bg-input border-border text-foreground focus:border-primary"
                          placeholder="100"
                          min="0"
                          max="100"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 5. Declarations */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">
                      5. Declarations
                    </h3>
                    <div className="space-y-4">
                      {[
                        { key: "outstandingJudgments", label: "Outstanding judgments against you?" },
                        { key: "declaredBankruptcy", label: "Declared bankruptcy within past 4 years?" },
                        { key: "propertyForeclosed", label: "Property foreclosed in last 4 years?" },
                        { key: "partyToLawsuit", label: "Party to a lawsuit?" },
                        { key: "loanForeclosure", label: "Loan obligation resulting in foreclosure?" },
                        { key: "downpaymentBorrowed", label: "Part of downpayment borrowed?" },
                        { key: "usCitizen", label: "Are you a U.S. Citizen?" },
                        { key: "permanentResident", label: "Are you a Permanent Resident Alien?" },
                        { key: "foreignNational", label: "Are you a Foreign National?" },
                        { key: "intendToOccupy", label: "Do you intend to occupy the property?" },
                        { key: "entityJudgments", label: "Any outstanding judgments by your entity?" },
                        { key: "entityLawsuit", label: "Been party to lawsuit with financial liability?" },
                        { key: "felonyConviction", label: "Charged/convicted of felony or fraud crime?" },
                      ].map((declaration) => (
                        <div key={declaration.key} className="flex items-center justify-between">
                          <Label className="text-foreground flex-1">{declaration.label}</Label>
                          <RadioGroup
                            value={formData[declaration.key] || ""}
                            onValueChange={(value) => handleInputChange(declaration.key, value)}
                            className="flex flex-row space-x-4"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="yes" id={`${declaration.key}-yes`} />
                              <Label htmlFor={`${declaration.key}-yes`} className="text-foreground">
                                Yes
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="no" id={`${declaration.key}-no`} />
                              <Label htmlFor={`${declaration.key}-no`} className="text-foreground">
                                No
                              </Label>
                            </div>
                          </RadioGroup>
                        </div>
                      ))}
                      <div className="space-y-2">
                        <Label htmlFor="propertiesOwned" className="text-foreground">
                          How many properties do you own?
                        </Label>
                        <Input
                          id="propertiesOwned"
                          type="number"
                          value={formData.propertiesOwned || ""}
                          onChange={(e) => handleInputChange("propertiesOwned", e.target.value)}
                          className="bg-input border-border text-foreground focus:border-primary w-32"
                          placeholder="0"
                          min="0"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 6. Signature Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">
                      6. Signature Section
                    </h3>
                    <div className="bg-muted p-4 rounded-lg">
                      <p className="text-muted-foreground text-sm italic mb-4">
                        "I hereby verify that the information provided in this loan request form is true, complete, and
                        accurate to the best of my knowledge."
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="signature" className="text-foreground">
                          Signature (Type your full name)
                        </Label>
                        <Input
                          id="signature"
                          value={formData.signature || ""}
                          onChange={(e) => handleInputChange("signature", e.target.value)}
                          className="bg-input border-border text-foreground focus:border-primary"
                          placeholder="Type your full legal name"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="printedName" className="text-foreground">
                          Printed Name
                        </Label>
                        <Input
                          id="printedName"
                          value={formData.printedName || ""}
                          onChange={(e) => handleInputChange("printedName", e.target.value)}
                          className="bg-input border-border text-foreground focus:border-primary"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signatureDate" className="text-foreground">
                          Date
                        </Label>
                        <Input
                          id="signatureDate"
                          type="date"
                          value={formData.signatureDate || new Date().toISOString().split("T")[0]}
                          onChange={(e) => handleInputChange("signatureDate", e.target.value)}
                          className="bg-input border-border text-foreground focus:border-primary"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3"
                  >
                    Submit Loan Application
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
