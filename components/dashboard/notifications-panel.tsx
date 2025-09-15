"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Bell,
  CheckCircle,
  FileText,
  AlertCircle,
  Clock,
  Trash2,
  KanbanSquareDashed as MarkAsUnread,
} from "lucide-react"

interface Notification {
  id: string
  type: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
}

interface NotificationsPanelProps {
  notifications: Notification[]
}

export function NotificationsPanel({ notifications }: NotificationsPanelProps) {
  const [notificationList, setNotificationList] = useState(notifications)

  const markAsRead = (id: string) => {
    setNotificationList((prev) => prev.map((notif) => (notif.id === id ? { ...notif, isRead: true } : notif)))
  }

  const markAsUnread = (id: string) => {
    setNotificationList((prev) => prev.map((notif) => (notif.id === id ? { ...notif, isRead: false } : notif)))
  }

  const deleteNotification = (id: string) => {
    setNotificationList((prev) => prev.filter((notif) => notif.id !== id))
  }

  const markAllAsRead = () => {
    setNotificationList((prev) => prev.map((notif) => ({ ...notif, isRead: true })))
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "status_update":
        return <Clock className="h-5 w-5 text-blue-400" />
      case "document_request":
        return <FileText className="h-5 w-5 text-yellow-400" />
      case "approval":
        return <CheckCircle className="h-5 w-5 text-green-400" />
      case "rejection":
        return <AlertCircle className="h-5 w-5 text-red-400" />
      default:
        return <Bell className="h-5 w-5 text-gray-400" />
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))

    if (diffInHours < 1) {
      return "Just now"
    } else if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours !== 1 ? "s" : ""} ago`
    } else {
      const diffInDays = Math.floor(diffInHours / 24)
      return `${diffInDays} day${diffInDays !== 1 ? "s" : ""} ago`
    }
  }

  const unreadCount = notificationList.filter((n) => !n.isRead).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Notifications</h2>
          <p className="text-muted-foreground">Stay updated on your loan applications</p>
          {unreadCount > 0 && (
            <Badge className="bg-destructive text-destructive-foreground mt-2">
              {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            className="border-border text-foreground hover:bg-muted bg-transparent"
            onClick={markAllAsRead}
          >
            Mark All as Read
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {notificationList.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="text-center py-8">
              <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No notifications yet</p>
              <p className="text-sm text-muted-foreground">We'll notify you of important updates here</p>
            </CardContent>
          </Card>
        ) : (
          notificationList.map((notification) => (
            <Card
              key={notification.id}
              className={`bg-card border-border ${!notification.isRead ? "border-[#997100] bg-muted/50" : ""}`}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    {getNotificationIcon(notification.type)}
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <CardTitle className="text-foreground text-lg">{notification.title}</CardTitle>
                        {!notification.isRead && <div className="w-2 h-2 bg-[#997100] rounded-full"></div>}
                      </div>
                      <CardDescription className="text-muted-foreground mt-1">
                        {formatDate(notification.createdAt)}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {notification.isRead ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => markAsUnread(notification.id)}
                      >
                        <MarkAsUnread className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => markAsRead(notification.id)}
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => deleteNotification(notification.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-foreground leading-relaxed">{notification.message}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
