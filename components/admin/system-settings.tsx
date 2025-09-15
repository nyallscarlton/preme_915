"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Save, Mail, Bell, Shield, FileText, Globe } from "lucide-react"

export function SystemSettings() {
  const [settings, setSettings] = useState({
    // General Settings
    companyName: "PREME",
    companyEmail: "admin@preme.com",
    companyPhone: "555-0100",
    companyAddress: "123 Business Ave, Los Angeles, CA 90210",

    // Application Settings
    maxLoanAmount: "5000000",
    minLoanAmount: "50000",
    defaultLoanTerm: "360",
    autoAssignApplications: true,
    requireDocumentVerification: true,

    // Notification Settings
    emailNotifications: true,
    smsNotifications: false,
    adminNotifications: true,
    applicantNotifications: true,

    // Security Settings
    sessionTimeout: "60",
    passwordMinLength: "8",
    requireTwoFactor: false,
    allowPublicRegistration: false,

    // Email Templates
    welcomeEmailTemplate: "Welcome to PREME! Your loan application has been received.",
    approvalEmailTemplate: "Congratulations! Your loan application has been approved.",
    rejectionEmailTemplate: "We regret to inform you that your loan application has been declined.",
  })

  const handleSettingChange = (key: string, value: string | boolean) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const handleSaveSettings = () => {
    console.log("Saving settings:", settings)
    // In a real app, this would save to the database
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">System Settings</h2>
          <p className="text-gray-400">Configure system-wide settings and preferences</p>
        </div>
        <Button className="bg-[#997100] hover:bg-[#b8850a] text-black" onClick={handleSaveSettings}>
          <Save className="mr-2 h-4 w-4" />
          Save Changes
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* General Settings */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Globe className="mr-2 h-5 w-5" />
              General Settings
            </CardTitle>
            <CardDescription className="text-gray-400">Basic company and system information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="companyName" className="text-gray-300">
                Company Name
              </Label>
              <Input
                id="companyName"
                value={settings.companyName}
                onChange={(e) => handleSettingChange("companyName", e.target.value)}
                className="bg-gray-800 border-gray-600 text-white"
              />
            </div>
            <div>
              <Label htmlFor="companyEmail" className="text-gray-300">
                Company Email
              </Label>
              <Input
                id="companyEmail"
                type="email"
                value={settings.companyEmail}
                onChange={(e) => handleSettingChange("companyEmail", e.target.value)}
                className="bg-gray-800 border-gray-600 text-white"
              />
            </div>
            <div>
              <Label htmlFor="companyPhone" className="text-gray-300">
                Company Phone
              </Label>
              <Input
                id="companyPhone"
                value={settings.companyPhone}
                onChange={(e) => handleSettingChange("companyPhone", e.target.value)}
                className="bg-gray-800 border-gray-600 text-white"
              />
            </div>
            <div>
              <Label htmlFor="companyAddress" className="text-gray-300">
                Company Address
              </Label>
              <Textarea
                id="companyAddress"
                value={settings.companyAddress}
                onChange={(e) => handleSettingChange("companyAddress", e.target.value)}
                className="bg-gray-800 border-gray-600 text-white"
              />
            </div>
          </CardContent>
        </Card>

        {/* Application Settings */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <FileText className="mr-2 h-5 w-5" />
              Application Settings
            </CardTitle>
            <CardDescription className="text-gray-400">Configure loan application parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="maxLoanAmount" className="text-gray-300">
                Maximum Loan Amount ($)
              </Label>
              <Input
                id="maxLoanAmount"
                type="number"
                value={settings.maxLoanAmount}
                onChange={(e) => handleSettingChange("maxLoanAmount", e.target.value)}
                className="bg-gray-800 border-gray-600 text-white"
              />
            </div>
            <div>
              <Label htmlFor="minLoanAmount" className="text-gray-300">
                Minimum Loan Amount ($)
              </Label>
              <Input
                id="minLoanAmount"
                type="number"
                value={settings.minLoanAmount}
                onChange={(e) => handleSettingChange("minLoanAmount", e.target.value)}
                className="bg-gray-800 border-gray-600 text-white"
              />
            </div>
            <div>
              <Label htmlFor="defaultLoanTerm" className="text-gray-300">
                Default Loan Term (months)
              </Label>
              <Select
                value={settings.defaultLoanTerm}
                onValueChange={(value) => handleSettingChange("defaultLoanTerm", value)}
              >
                <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600">
                  <SelectItem value="120">10 Years (120 months)</SelectItem>
                  <SelectItem value="180">15 Years (180 months)</SelectItem>
                  <SelectItem value="240">20 Years (240 months)</SelectItem>
                  <SelectItem value="300">25 Years (300 months)</SelectItem>
                  <SelectItem value="360">30 Years (360 months)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="autoAssign" className="text-gray-300">
                Auto-assign Applications
              </Label>
              <Switch
                id="autoAssign"
                checked={settings.autoAssignApplications}
                onCheckedChange={(checked) => handleSettingChange("autoAssignApplications", checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="requireVerification" className="text-gray-300">
                Require Document Verification
              </Label>
              <Switch
                id="requireVerification"
                checked={settings.requireDocumentVerification}
                onCheckedChange={(checked) => handleSettingChange("requireDocumentVerification", checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Bell className="mr-2 h-5 w-5" />
              Notification Settings
            </CardTitle>
            <CardDescription className="text-gray-400">Configure notification preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="emailNotifications" className="text-gray-300">
                Email Notifications
              </Label>
              <Switch
                id="emailNotifications"
                checked={settings.emailNotifications}
                onCheckedChange={(checked) => handleSettingChange("emailNotifications", checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="smsNotifications" className="text-gray-300">
                SMS Notifications
              </Label>
              <Switch
                id="smsNotifications"
                checked={settings.smsNotifications}
                onCheckedChange={(checked) => handleSettingChange("smsNotifications", checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="adminNotifications" className="text-gray-300">
                Admin Notifications
              </Label>
              <Switch
                id="adminNotifications"
                checked={settings.adminNotifications}
                onCheckedChange={(checked) => handleSettingChange("adminNotifications", checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="applicantNotifications" className="text-gray-300">
                Applicant Notifications
              </Label>
              <Switch
                id="applicantNotifications"
                checked={settings.applicantNotifications}
                onCheckedChange={(checked) => handleSettingChange("applicantNotifications", checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Shield className="mr-2 h-5 w-5" />
              Security Settings
            </CardTitle>
            <CardDescription className="text-gray-400">Configure security and access controls</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="sessionTimeout" className="text-gray-300">
                Session Timeout (minutes)
              </Label>
              <Input
                id="sessionTimeout"
                type="number"
                value={settings.sessionTimeout}
                onChange={(e) => handleSettingChange("sessionTimeout", e.target.value)}
                className="bg-gray-800 border-gray-600 text-white"
              />
            </div>
            <div>
              <Label htmlFor="passwordMinLength" className="text-gray-300">
                Minimum Password Length
              </Label>
              <Input
                id="passwordMinLength"
                type="number"
                value={settings.passwordMinLength}
                onChange={(e) => handleSettingChange("passwordMinLength", e.target.value)}
                className="bg-gray-800 border-gray-600 text-white"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="requireTwoFactor" className="text-gray-300">
                Require Two-Factor Auth
              </Label>
              <Switch
                id="requireTwoFactor"
                checked={settings.requireTwoFactor}
                onCheckedChange={(checked) => handleSettingChange("requireTwoFactor", checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="allowPublicRegistration" className="text-gray-300">
                Allow Public Registration
              </Label>
              <Switch
                id="allowPublicRegistration"
                checked={settings.allowPublicRegistration}
                onCheckedChange={(checked) => handleSettingChange("allowPublicRegistration", checked)}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Email Templates */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Mail className="mr-2 h-5 w-5" />
            Email Templates
          </CardTitle>
          <CardDescription className="text-gray-400">Customize automated email templates</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="welcomeTemplate" className="text-gray-300">
              Welcome Email Template
            </Label>
            <Textarea
              id="welcomeTemplate"
              value={settings.welcomeEmailTemplate}
              onChange={(e) => handleSettingChange("welcomeEmailTemplate", e.target.value)}
              className="bg-gray-800 border-gray-600 text-white min-h-[100px]"
            />
          </div>
          <div>
            <Label htmlFor="approvalTemplate" className="text-gray-300">
              Approval Email Template
            </Label>
            <Textarea
              id="approvalTemplate"
              value={settings.approvalEmailTemplate}
              onChange={(e) => handleSettingChange("approvalEmailTemplate", e.target.value)}
              className="bg-gray-800 border-gray-600 text-white min-h-[100px]"
            />
          </div>
          <div>
            <Label htmlFor="rejectionTemplate" className="text-gray-300">
              Rejection Email Template
            </Label>
            <Textarea
              id="rejectionTemplate"
              value={settings.rejectionEmailTemplate}
              onChange={(e) => handleSettingChange("rejectionEmailTemplate", e.target.value)}
              className="bg-gray-800 border-gray-600 text-white min-h-[100px]"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
