"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { User, Search, Filter, Plus, Edit, Trash2, Mail, Phone, Calendar, Shield, UserCheck } from "lucide-react"

const mockUsers = [
  {
    id: "1",
    firstName: "John",
    lastName: "Smith",
    email: "john.smith@email.com",
    phone: "555-0101",
    role: "applicant",
    status: "active",
    createdAt: "2024-01-10T10:30:00Z",
    lastLogin: "2024-01-16T14:20:00Z",
    applicationCount: 2,
  },
  {
    id: "2",
    firstName: "Jane",
    lastName: "Doe",
    email: "jane.doe@email.com",
    phone: "555-0102",
    role: "applicant",
    status: "active",
    createdAt: "2024-01-08T09:15:00Z",
    lastLogin: "2024-01-15T16:45:00Z",
    applicationCount: 1,
  },
  {
    id: "3",
    firstName: "Sarah",
    lastName: "Johnson",
    email: "sarah.johnson@preme.com",
    phone: "555-0201",
    role: "admin",
    status: "active",
    createdAt: "2023-12-01T08:00:00Z",
    lastLogin: "2024-01-16T09:30:00Z",
    applicationCount: 0,
  },
  {
    id: "4",
    firstName: "Mike",
    lastName: "Chen",
    email: "mike.chen@preme.com",
    phone: "555-0202",
    role: "admin",
    status: "active",
    createdAt: "2023-12-01T08:00:00Z",
    lastLogin: "2024-01-15T11:20:00Z",
    applicationCount: 0,
  },
]

export function UsersManagement() {
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  const filteredUsers = mockUsers.filter((user) => {
    const matchesSearch =
      user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = roleFilter === "all" || user.role === roleFilter
    const matchesStatus = statusFilter === "all" || user.status === statusFilter
    return matchesSearch && matchesRole && matchesStatus
  })

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-[#997100] text-black"
      case "applicant":
        return "bg-blue-600 text-white"
      default:
        return "bg-gray-600 text-white"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-600 text-white"
      case "inactive":
        return "bg-gray-600 text-white"
      case "suspended":
        return "bg-red-600 text-white"
      default:
        return "bg-gray-600 text-white"
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Users Management</h2>
          <p className="text-muted-foreground">Manage system users and permissions</p>
        </div>
        <Button className="bg-[#997100] hover:bg-[#b8850a] text-black">
          <Plus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>

      {/* Filters */}
      <Card className="bg-card border-border">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-card border-border text-foreground"
                />
              </div>
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-48 bg-card border-border text-foreground">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="applicant">Applicant</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48 bg-card border-border text-foreground">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      <div className="grid gap-4">
        {filteredUsers.map((user) => (
          <Card key={user.id} className="bg-card border-border hover:border-muted-foreground transition-colors">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                    <User className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">
                      {user.firstName} {user.lastName}
                    </h3>
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <div className="flex items-center space-x-1">
                        <Mail className="h-3 w-3" />
                        <span>{user.email}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Phone className="h-3 w-3" />
                        <span>{user.phone}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4 text-xs text-muted-foreground mt-1">
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-3 w-3" />
                        <span>Joined {formatDate(user.createdAt)}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <UserCheck className="h-3 w-3" />
                        <span>Last login {formatDate(user.lastLogin)}</span>
                      </div>
                      {user.role === "applicant" && (
                        <span>
                          {user.applicationCount} application{user.applicationCount !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex flex-col items-end space-y-2">
                    <Badge className={getRoleColor(user.role)}>
                      {user.role === "admin" ? <Shield className="h-3 w-3 mr-1" /> : <User className="h-3 w-3 mr-1" />}
                      {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </Badge>
                    <Badge className={getStatusColor(user.status)}>
                      {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                    </Badge>
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-red-400">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredUsers.length === 0 && (
        <Card className="bg-card border-border">
          <CardContent className="text-center py-8">
            <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No users found</p>
            <p className="text-sm text-muted-foreground">Try adjusting your search or filter criteria</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
