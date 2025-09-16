"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { MessageSquare, Send, User, Clock } from "lucide-react"

interface Application {
  id: string
  propertyAddress: string
  loanAmount: number
  status: string
  submittedAt: string
  loanType: string
  progress: number
}

interface MessagingCenterProps {
  applications: Application[]
}

const mockMessages = [
  {
    id: "1",
    applicationId: "PREME-2024-001",
    sender: "admin",
    senderName: "Sarah Johnson - Loan Officer",
    subject: "Additional Documentation Required",
    message:
      "Hi there! We've reviewed your application and need a few additional documents to proceed. Please upload your most recent bank statements (last 3 months) and a letter of employment verification from your current employer. Let me know if you have any questions!",
    timestamp: "2024-01-16T14:30:00Z",
    isRead: false,
  },
  {
    id: "2",
    applicationId: "PREME-2024-001",
    sender: "user",
    senderName: "You",
    subject: "Re: Additional Documentation Required",
    message:
      "Thank you for the update. I'll upload the bank statements today. For the employment verification letter, should it include my salary information or just confirm my employment status?",
    timestamp: "2024-01-16T16:45:00Z",
    isRead: true,
  },
  {
    id: "3",
    applicationId: "PREME-2024-002",
    sender: "admin",
    senderName: "Mike Chen - Underwriter",
    subject: "Congratulations - Loan Approved!",
    message:
      "Great news! Your loan application has been approved. We'll be sending you the final loan documents within the next 2 business days. Please review them carefully and let us know if you have any questions before signing.",
    timestamp: "2024-01-12T11:30:00Z",
    isRead: true,
  },
]

export function MessagingCenter({ applications }: MessagingCenterProps) {
  const [selectedApplication, setSelectedApplication] = useState<string>("all")
  const [newMessage, setNewMessage] = useState({
    applicationId: "",
    subject: "",
    message: "",
  })
  const [showCompose, setShowCompose] = useState(false)

  const filteredMessages =
    selectedApplication === "all"
      ? mockMessages
      : mockMessages.filter((msg) => msg.applicationId === selectedApplication)

  const unreadCount = mockMessages.filter((msg) => !msg.isRead && msg.sender === "admin").length

  const handleSendMessage = () => {
    if (!newMessage.applicationId || !newMessage.subject || !newMessage.message) {
      return
    }

    // In a real app, this would send the message to the backend
    console.log("Sending message:", newMessage)

    // Reset form
    setNewMessage({ applicationId: "", subject: "", message: "" })
    setShowCompose(false)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Messages</h2>
          <p className="text-muted-foreground">Communicate with your loan team</p>
          {unreadCount > 0 && (
            <Badge className="bg-red-600 text-white mt-2">
              {unreadCount} unread message{unreadCount !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <div className="flex items-center space-x-4">
          <Select value={selectedApplication} onValueChange={setSelectedApplication}>
            <SelectTrigger className="w-64 bg-input border-border text-foreground">
              <SelectValue placeholder="Filter by application" />
            </SelectTrigger>
            <SelectContent className="bg-input border-border">
              <SelectItem value="all">All Applications</SelectItem>
              {applications.map((app) => (
                <SelectItem key={app.id} value={app.id}>
                  {app.id} - {app.propertyAddress.split(",")[0]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button className="bg-[#997100] hover:bg-[#b8850a] text-black" onClick={() => setShowCompose(!showCompose)}>
            <MessageSquare className="mr-2 h-4 w-4" />
            New Message
          </Button>
        </div>
      </div>

      {/* Compose New Message */}
      {showCompose && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Compose New Message</CardTitle>
            <CardDescription className="text-muted-foreground">Send a message to your loan team</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Application</label>
              <Select
                value={newMessage.applicationId}
                onValueChange={(value) => setNewMessage((prev) => ({ ...prev, applicationId: value }))}
              >
                <SelectTrigger className="bg-input border-border text-foreground">
                  <SelectValue placeholder="Select application" />
                </SelectTrigger>
                <SelectContent className="bg-input border-border">
                  {applications.map((app) => (
                    <SelectItem key={app.id} value={app.id}>
                      {app.id} - {app.propertyAddress.split(",")[0]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Subject</label>
              <Input
                value={newMessage.subject}
                onChange={(e) => setNewMessage((prev) => ({ ...prev, subject: e.target.value }))}
                className="bg-input border-border text-foreground"
                placeholder="Enter message subject"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Message</label>
              <Textarea
                value={newMessage.message}
                onChange={(e) => setNewMessage((prev) => ({ ...prev, message: e.target.value }))}
                className="bg-input border-border text-foreground min-h-[120px]"
                placeholder="Type your message here..."
              />
            </div>

            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                className="border-border text-foreground hover:bg-muted bg-transparent"
                onClick={() => setShowCompose(false)}
              >
                Cancel
              </Button>
              <Button className="bg-[#997100] hover:bg-[#b8850a] text-black" onClick={handleSendMessage}>
                <Send className="mr-2 h-4 w-4" />
                Send Message
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Messages List */}
      <div className="space-y-4">
        {filteredMessages.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="text-center py-8">
              <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No messages yet</p>
              <p className="text-sm text-muted-foreground">Start a conversation with your loan team</p>
            </CardContent>
          </Card>
        ) : (
          filteredMessages.map((message) => (
            <Card
              key={message.id}
              className={`bg-card border-border ${!message.isRead && message.sender === "admin" ? "border-[#997100]" : ""}`}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        message.sender === "admin" ? "bg-[#997100] text-black" : "bg-muted text-foreground"
                      }`}
                    >
                      <User className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{message.senderName}</p>
                      <p className="text-sm text-muted-foreground">Application: {message.applicationId}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {!message.isRead && message.sender === "admin" && (
                      <Badge className="bg-red-600 text-white">New</Badge>
                    )}
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Clock className="h-4 w-4 mr-1" />
                      {formatDate(message.timestamp)}
                    </div>
                  </div>
                </div>
                <CardTitle className="text-foreground text-lg">{message.subject}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-foreground leading-relaxed">{message.message}</p>
                <div className="flex justify-end mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-border text-foreground hover:bg-muted bg-transparent"
                  >
                    Reply
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
