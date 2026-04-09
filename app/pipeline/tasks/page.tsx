"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { Phone, CheckCircle2, Clock, AlertTriangle } from "lucide-react"

interface Task {
  id: string
  lead_id: string
  type: string
  title: string
  description: string | null
  due_at: string
  status: string
  completed_at: string | null
  leads?: {
    id: string
    first_name: string
    last_name: string
    phone: string
    email: string
    temperature: string | null
    score: number | null
  }
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"pending" | "completed">("pending")

  const fetchTasks = useCallback(async () => {
    const res = await fetch(`/api/pipeline/tasks?status=${filter}&limit=100`)
    if (res.ok) {
      const data = await res.json()
      setTasks(data.tasks || [])
    }
    setLoading(false)
  }, [filter])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  async function completeTask(taskId: string) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
    await fetch("/api/pipeline/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: taskId, status: "completed" }),
    })
  }

  async function skipTask(taskId: string) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
    await fetch("/api/pipeline/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: taskId, status: "skipped" }),
    })
  }

  const now = new Date()
  const overdueTasks = tasks.filter((t) => new Date(t.due_at) < now && t.status === "pending")
  const upcomingTasks = tasks.filter((t) => new Date(t.due_at) >= now || t.status !== "pending")

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
        <div className="flex gap-2">
          <button
            onClick={() => { setFilter("pending"); setLoading(true) }}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              filter === "pending" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Pending ({filter === "pending" ? tasks.length : "..."})
          </button>
          <button
            onClick={() => { setFilter("completed"); setLoading(true) }}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              filter === "completed" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Completed
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-500" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-xl border bg-white py-16 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-400" />
          <p className="mt-4 text-lg font-medium text-gray-900">All caught up!</p>
          <p className="mt-1 text-sm text-gray-500">No {filter} tasks right now.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Overdue section */}
          {overdueTasks.length > 0 && filter === "pending" && (
            <div>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-red-600">
                <AlertTriangle className="h-4 w-4" />
                Overdue ({overdueTasks.length})
              </h2>
              <div className="space-y-2">
                {overdueTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isOverdue
                    onComplete={completeTask}
                    onSkip={skipTask}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Upcoming section */}
          <div>
            {overdueTasks.length > 0 && filter === "pending" && (
              <h2 className="mb-3 text-sm font-semibold text-gray-700">
                Upcoming ({upcomingTasks.length})
              </h2>
            )}
            <div className="space-y-2">
              {(filter === "pending" ? upcomingTasks : tasks).map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  isOverdue={false}
                  onComplete={filter === "pending" ? completeTask : undefined}
                  onSkip={filter === "pending" ? skipTask : undefined}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TaskCard({
  task,
  isOverdue,
  onComplete,
  onSkip,
}: {
  task: Task
  isOverdue: boolean
  onComplete?: (id: string) => void
  onSkip?: (id: string) => void
}) {
  const lead = task.leads
  const dueDate = new Date(task.due_at)
  const isToday = dueDate.toDateString() === new Date().toDateString()

  return (
    <div className={`flex items-center gap-4 rounded-xl border bg-white p-4 transition hover:shadow-sm ${
      isOverdue ? "border-red-200 bg-red-50" : ""
    }`}>
      {/* Complete button */}
      {onComplete && (
        <button
          onClick={() => onComplete(task.id)}
          className="shrink-0 rounded-full p-1 text-gray-400 hover:bg-green-50 hover:text-green-600 transition"
          title="Mark complete"
        >
          <CheckCircle2 className="h-6 w-6" />
        </button>
      )}

      {/* Task info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-900">{task.title}</p>
          {task.type === "call" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
              <Phone className="h-3 w-3" /> Call
            </span>
          )}
        </div>
        {task.description && (
          <p className="mt-0.5 text-xs text-gray-500 truncate">{task.description}</p>
        )}
        <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
          <span className={`flex items-center gap-1 ${isOverdue ? "text-red-500 font-medium" : ""}`}>
            <Clock className="h-3 w-3" />
            {isToday ? dueDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : dueDate.toLocaleDateString()}
          </span>
          {lead && (
            <span>{lead.temperature === "hot" ? "🔥" : lead.temperature === "warm" ? "🟡" : "🔵"} Score: {lead.score || 0}</span>
          )}
        </div>
      </div>

      {/* Lead quick actions */}
      {lead && (
        <div className="shrink-0 flex items-center gap-2">
          <a
            href={`tel:${lead.phone}`}
            className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition"
          >
            Call
          </a>
          <Link
            href={`/admin/leads/${lead.id}`}
            className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 transition"
          >
            View
          </Link>
        </div>
      )}

      {/* Skip button */}
      {onSkip && (
        <button
          onClick={() => onSkip(task.id)}
          className="shrink-0 text-xs text-gray-400 hover:text-gray-600 transition"
        >
          Skip
        </button>
      )}
    </div>
  )
}
