import { supabase } from "./supabase"

export interface Message {
  id: string
  application_id: string
  sender_id: string
  sender_type: "admin" | "applicant"
  recipient_id: string
  subject: string
  message: string
  is_read: boolean
  created_at: string
  updated_at: string
  sender_name?: string
  recipient_name?: string
}

export interface Notification {
  id: string
  user_id: string
  type: "status_update" | "document_request" | "approval" | "rejection" | "message" | "system"
  title: string
  message: string
  is_read: boolean
  application_id?: string
  created_at: string
}

export async function sendMessage(messageData: {
  application_id: string
  recipient_id: string
  subject: string
  message: string
}): Promise<{ data: Message | null; error: string | null }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { data: null, error: "User not authenticated" }
    }

    // Get sender profile to determine type
    const { data: senderProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

    const { data, error } = await supabase
      .from("messages")
      .insert({
        application_id: messageData.application_id,
        sender_id: user.id,
        sender_type: senderProfile?.role || "applicant",
        recipient_id: messageData.recipient_id,
        subject: messageData.subject,
        message: messageData.message,
      })
      .select()
      .single()

    if (error) {
      return { data: null, error: error.message }
    }

    return { data, error: null }
  } catch (error) {
    return { data: null, error: "Failed to send message" }
  }
}

export async function getMessages(applicationId?: string): Promise<Message[]> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return []

    let query = supabase
      .from("messages")
      .select(`
        *,
        sender:profiles!messages_sender_id_fkey(first_name, last_name, role),
        recipient:profiles!messages_recipient_id_fkey(first_name, last_name, role)
      `)
      .order("created_at", { ascending: false })

    if (applicationId) {
      query = query.eq("application_id", applicationId)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching messages:", error)
      return []
    }

    return (
      data?.map((msg) => ({
        ...msg,
        sender_name: `${msg.sender?.first_name} ${msg.sender?.last_name}`,
        recipient_name: `${msg.recipient?.first_name} ${msg.recipient?.last_name}`,
      })) || []
    )
  } catch (error) {
    console.error("Error fetching messages:", error)
    return []
  }
}

export async function markMessageAsRead(messageId: string): Promise<void> {
  try {
    await supabase.from("messages").update({ is_read: true }).eq("id", messageId)
  } catch (error) {
    console.error("Error marking message as read:", error)
  }
}

export async function getNotifications(): Promise<Notification[]> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching notifications:", error)
      return []
    }

    return data || []
  } catch (error) {
    console.error("Error fetching notifications:", error)
    return []
  }
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  try {
    await supabase.from("notifications").update({ is_read: true }).eq("id", notificationId)
  } catch (error) {
    console.error("Error marking notification as read:", error)
  }
}

export async function deleteNotification(notificationId: string): Promise<void> {
  try {
    await supabase.from("notifications").delete().eq("id", notificationId)
  } catch (error) {
    console.error("Error deleting notification:", error)
  }
}

export function subscribeToMessages(callback: (message: Message) => void) {
  return supabase
    .channel("messages")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
      callback(payload.new as Message)
    })
    .subscribe()
}

export function subscribeToNotifications(callback: (notification: Notification) => void) {
  return supabase
    .channel("notifications")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, (payload) => {
      callback(payload.new as Notification)
    })
    .subscribe()
}
