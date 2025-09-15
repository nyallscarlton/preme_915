"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { MessageSquare, Send, User, Clock, Search, Plus, Reply, Archive } from "lucide-react"

interface Application {
  id: string
  applicantName: string
  applicantEmail: string
  propertyAddress: string
  loanAmount: number
  status: string
  submittedAt: string
  loanType: string
  progress: number
  assignedTo: string | null
}

interface AdminMessagingProps {
  applications: Application[]
}

const mockMessages = [
  {
    id: "1",
    applicationId: "PREME-2024-001",
    applicantName: "John Smith",
    applicantEmail: "john.smith@email.com",
    subject: "Additional Documentation Required",
    lastMessage: "Please upload your most recent bank statements for review.",
    timestamp: "2024-01-16T14:30:00Z",
    isRead: false,
    messageCount: 3,
  },
  {
    id: "2",
    applicationId: "PREME-2024-002",
    applicantName: "Jane Doe",
    applicantEmail: "jane.doe@email.com",
    subject: "Application Status Update",
    lastMessage: "Your application has been approved! Congratulations.",
    timestamp: "2024-01-15T11:20:00Z",
    isRead: true,
    messageCount: 2,
  },
  {
    id: "3",
    applicationId: "PREME-2024-003",
    applicantName: "Robert Wilson",
    applicantEmail: "robert.wilson@email.com",
    subject: "Welcome to PREME",
    lastMessage: "Thank you for submitting your loan application.",
    timestamp: "2024-01-16T09:15:00Z",
    isRead: true,
    messageCount: 1,
  },
]

export function AdminMessaging({ applications }: AdminMessagingProps) {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [newMessage, setNewMessage] = useState({
    applicationId: "",
    subject: "",
    message: "",
  })
  const [showCompose, setShowCompose] = useState(false)

  const filteredMessages = mockMessages.filter(
    (msg) =>
      msg.applicantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      msg.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      msg.applicationId.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const handleSendMessage = () => {
    if (!newMessage.applicationId || !newMessage.subject || !newMessage.message) {
      return
    }

    console.log("Sending admin message:", newMessage)

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

  const unreadCount = mockMessages.filter((msg) => !msg.isRead).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Messaging Center</h2>
          <p className="text-gray-400">Communicate with loan applicants</p>
          {unreadCount > 0 && (
            <Badge className="bg-red-600 text-white mt-2">
              {unreadCount} unread message{unreadCount !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <Button className="bg-[#997100] hover:bg-[#b8850a] text-black" onClick={() => setShowCompose(!showCompose)}>
          <Plus className="mr-2 h-4 w-4" />
          New Message
        </Button>
      </div>

      {/* Compose New Message */}
      {showCompose && (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Compose New Message</CardTitle>
            <CardDescription className="text-gray-400">Send a message to a loan applicant</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Application</label>
              <Select
                value={newMessage.applicationId}
                onValueChange={(value) => setNewMessage((prev) => ({ ...prev, applicationId: value }))}
              >
                <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                  <SelectValue placeholder="Select application" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600">
                  {applications.map((app) => (
                    <SelectItem key={app.id} value={app.id}>
                      {app.id} - {app.applicantName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Subject</label>
              <Input
                value={newMessage.subject}
                onChange={(e) => setNewMessage((prev) => ({ ...prev, subject: e.target.value }))}
                className="bg-gray-800 border-gray-600 text-white"
                placeholder="Enter message subject"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Message</label>
              <Textarea
                value={newMessage.message}
                onChange={(e) => setNewMessage((prev) => ({ ...prev, message: e.target.value }))}
                className="bg-gray-800 border-gray-600 text-white min-h-[120px]"
                placeholder="Type your message here..."
              />
            </div>

            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                className="border-gray-600 text-white hover:bg-gray-800 bg-transparent"
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

      {/* Search */}
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-800 border-gray-600 text-white"
            />
          </div>
        </CardContent>
      </Card>

      {/* Messages List */}
      <div className="space-y-4">
        {filteredMessages.length === 0 ? (
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="text-center py-8">
              <MessageSquare className="h-12 w-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No conversations found</p>
              <p className="text-sm text-gray-500">Start a conversation with an applicant</p>
            </CardContent>
          </Card>
        ) : (
          filteredMessages.map((conversation) => (
            <Card
              key={conversation.id}
              className={`bg-gray-900 border-gray-800 hover:border-gray-600 transition-colors cursor-pointer ${
                !conversation.isRead ? "border-[#997100]" : ""
              }`}
              onClick={() => setSelectedConversation(conversation.id)}
            >
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
                      <User className="h-5 w-5 text-gray-300" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-semibold text-white">{conversation.applicantName}</h3>
                        {!conversation.isRead && <div className="w-2 h-2 bg-[#997100] rounded-full"></div>}
                      </div>
                      <p className="text-sm text-gray-400">{conversation.applicationId}</p>
                      <p className="text-lg font-medium text-white mt-1">{conversation.subject}</p>
                      <p className="text-sm text-gray-400 mt-1">{conversation.lastMessage}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className="flex items-center text-sm text-gray-400 mb-2">
                        <Clock className="h-4 w-4 mr-1" />
                        {formatDate(conversation.timestamp)}
                      </div>
                      <Badge className="bg-gray-700 text-gray-300">
                        {conversation.messageCount} message{conversation.messageCount !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                    <div className="flex flex-col space-y-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-gray-600 text-white hover:bg-gray-800 bg-transparent"
                      >
                        <Reply className="h-4 w-4 mr-2" />
                        Reply
                      </Button>
                      <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                        <Archive className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
