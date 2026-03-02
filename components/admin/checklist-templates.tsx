"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Plus, Copy, Trash2, GripVertical, FileText, CheckCircle, Clock, Save, Eye, Settings } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

const supabase = createClient()

interface ChecklistTemplate {
  id: string
  name: string
  description: string
  loan_type: string
  is_active: boolean
  created_at: string
  items?: ChecklistTemplateItem[]
}

interface ChecklistTemplateItem {
  id: string
  template_id: string
  item_name: string
  description: string
  is_required: boolean
  sort_order: number
}

export function ChecklistTemplates() {
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<ChecklistTemplate | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const [newTemplate, setNewTemplate] = useState({
    name: "",
    description: "",
    loan_type: "",
    is_active: true,
  })

  const [newItem, setNewItem] = useState({
    item_name: "",
    description: "",
    is_required: true,
  })

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from("checklist_templates")
        .select(`
          *,
          checklist_template_items (*)
        `)
        .order("created_at", { ascending: false })

      if (error) throw error

      setTemplates(data || [])
    } catch (error) {
      console.error("Error fetching templates:", error)
    } finally {
      setLoading(false)
    }
  }

  const createTemplate = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from("checklist_templates")
        .insert({
          ...newTemplate,
          created_by: user.id,
        })
        .select()
        .single()

      if (error) throw error

      setTemplates([data, ...templates])
      setNewTemplate({ name: "", description: "", loan_type: "", is_active: true })
      setIsCreateDialogOpen(false)
    } catch (error) {
      console.error("Error creating template:", error)
    }
  }

  const cloneTemplate = async (templateId: string) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const template = templates.find((t) => t.id === templateId)
      if (!template) return

      // Create new template
      const { data: newTemplate, error: templateError } = await supabase
        .from("checklist_templates")
        .insert({
          name: `${template.name} (Copy)`,
          description: template.description,
          loan_type: template.loan_type,
          is_active: false,
          created_by: user.id,
        })
        .select()
        .single()

      if (templateError) throw templateError

      // Clone items if they exist
      if (template.items && template.items.length > 0) {
        const itemsToInsert = template.items.map((item) => ({
          template_id: newTemplate.id,
          item_name: item.item_name,
          description: item.description,
          is_required: item.is_required,
          sort_order: item.sort_order,
        }))

        const { error: itemsError } = await supabase.from("checklist_template_items").insert(itemsToInsert)

        if (itemsError) throw itemsError
      }

      fetchTemplates()
    } catch (error) {
      console.error("Error cloning template:", error)
    }
  }

  const toggleTemplateStatus = async (templateId: string, isActive: boolean) => {
    try {
      const { error } = await supabase.from("checklist_templates").update({ is_active: isActive }).eq("id", templateId)

      if (error) throw error

      setTemplates(templates.map((t) => (t.id === templateId ? { ...t, is_active: isActive } : t)))
    } catch (error) {
      console.error("Error updating template status:", error)
    }
  }

  const addItemToTemplate = async (templateId: string) => {
    try {
      const maxOrder = selectedTemplate?.items?.reduce((max, item) => Math.max(max, item.sort_order), 0) || 0

      const { data, error } = await supabase
        .from("checklist_template_items")
        .insert({
          template_id: templateId,
          ...newItem,
          sort_order: maxOrder + 1,
        })
        .select()
        .single()

      if (error) throw error

      if (selectedTemplate) {
        setSelectedTemplate({
          ...selectedTemplate,
          items: [...(selectedTemplate.items || []), data],
        })
      }

      setNewItem({ item_name: "", description: "", is_required: true })
    } catch (error) {
      console.error("Error adding item:", error)
    }
  }

  const deleteItem = async (itemId: string) => {
    try {
      const { error } = await supabase.from("checklist_template_items").delete().eq("id", itemId)

      if (error) throw error

      if (selectedTemplate) {
        setSelectedTemplate({
          ...selectedTemplate,
          items: selectedTemplate.items?.filter((item) => item.id !== itemId) || [],
        })
      }
    } catch (error) {
      console.error("Error deleting item:", error)
    }
  }

  const getLoanTypeColor = (loanType: string) => {
    switch (loanType) {
      case "mortgage":
        return "bg-blue-600 text-white"
      case "commercial":
        return "bg-purple-600 text-white"
      case "personal":
        return "bg-green-600 text-white"
      default:
        return "bg-gray-600 text-white"
    }
  }

  const formatLoanType = (loanType: string) => {
    return loanType
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-white">Loading templates...</div>
      </div>
    )
  }

  if (selectedTemplate) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            className="border-gray-600 text-white hover:bg-gray-800 bg-transparent"
            onClick={() => setSelectedTemplate(null)}
          >
            ← Back to Templates
          </Button>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              className="border-gray-600 text-white hover:bg-gray-800 bg-transparent"
              onClick={() => cloneTemplate(selectedTemplate.id)}
            >
              <Copy className="mr-2 h-4 w-4" />
              Clone Template
            </Button>
            <Button className="bg-[#997100] hover:bg-[#b8850a] text-black">
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </Button>
          </div>
        </div>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white text-2xl">{selectedTemplate.name}</CardTitle>
                <CardDescription className="text-gray-400 mt-2">{selectedTemplate.description}</CardDescription>
              </div>
              <div className="flex items-center space-x-3">
                <Badge className={getLoanTypeColor(selectedTemplate.loan_type)}>
                  {formatLoanType(selectedTemplate.loan_type)}
                </Badge>
                <Badge className={selectedTemplate.is_active ? "bg-green-600 text-white" : "bg-gray-600 text-white"}>
                  {selectedTemplate.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Add New Item */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Add New Item</CardTitle>
            <CardDescription className="text-gray-400">Add a new checklist item to this template</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-300">Item Name</Label>
                <Input
                  value={newItem.item_name}
                  onChange={(e) => setNewItem({ ...newItem, item_name: e.target.value })}
                  className="bg-gray-800 border-gray-600 text-white"
                  placeholder="e.g., Income Verification"
                />
              </div>
              <div className="flex items-center space-x-2 pt-6">
                <Switch
                  checked={newItem.is_required}
                  onCheckedChange={(checked) => setNewItem({ ...newItem, is_required: checked })}
                />
                <Label className="text-gray-300">Required Item</Label>
              </div>
            </div>
            <div>
              <Label className="text-gray-300">Description</Label>
              <Textarea
                value={newItem.description}
                onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                className="bg-gray-800 border-gray-600 text-white"
                placeholder="Describe what documents or information is needed..."
              />
            </div>
            <Button
              className="bg-[#997100] hover:bg-[#b8850a] text-black"
              onClick={() => addItemToTemplate(selectedTemplate.id)}
              disabled={!newItem.item_name}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
          </CardContent>
        </Card>

        {/* Template Items */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Template Items ({selectedTemplate.items?.length || 0})</CardTitle>
            <CardDescription className="text-gray-400">Manage checklist items for this template</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {selectedTemplate.items && selectedTemplate.items.length > 0 ? (
                selectedTemplate.items
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((item, index) => (
                    <div key={item.id} className="flex items-center space-x-4 p-4 bg-gray-800 rounded-lg">
                      <GripVertical className="h-5 w-5 text-gray-400 cursor-move" />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium text-white">{item.item_name}</h4>
                          {item.is_required ? (
                            <Badge className="bg-red-600 text-white text-xs">Required</Badge>
                          ) : (
                            <Badge className="bg-gray-600 text-white text-xs">Optional</Badge>
                          )}
                        </div>
                        {item.description && <p className="text-sm text-gray-400 mt-1">{item.description}</p>}
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-400">#{index + 1}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-gray-400 hover:text-white"
                          onClick={() => deleteItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No items in this template</p>
                  <p className="text-sm text-gray-500">Add items above to get started</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Checklist Templates</h2>
          <p className="text-gray-400">Manage checklist templates for different loan types</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#997100] hover:bg-[#b8850a] text-black">
              <Plus className="mr-2 h-4 w-4" />
              New Template
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-gray-900 border-gray-800 text-white">
            <DialogHeader>
              <DialogTitle>Create New Template</DialogTitle>
              <DialogDescription className="text-gray-400">
                Create a new checklist template for a specific loan type
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-gray-300">Template Name</Label>
                <Input
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                  className="bg-gray-800 border-gray-600 text-white"
                  placeholder="e.g., Standard Mortgage Application"
                />
              </div>
              <div>
                <Label className="text-gray-300">Description</Label>
                <Textarea
                  value={newTemplate.description}
                  onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                  className="bg-gray-800 border-gray-600 text-white"
                  placeholder="Describe this template..."
                />
              </div>
              <div>
                <Label className="text-gray-300">Loan Type</Label>
                <Select
                  value={newTemplate.loan_type}
                  onValueChange={(value) => setNewTemplate({ ...newTemplate, loan_type: value })}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                    <SelectValue placeholder="Select loan type" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    <SelectItem value="mortgage">Mortgage</SelectItem>
                    <SelectItem value="commercial">Commercial</SelectItem>
                    <SelectItem value="personal">Personal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={newTemplate.is_active}
                  onCheckedChange={(checked) => setNewTemplate({ ...newTemplate, is_active: checked })}
                />
                <Label className="text-gray-300">Active Template</Label>
              </div>
              <div className="flex justify-end space-x-3">
                <Button
                  variant="outline"
                  className="border-gray-600 text-white hover:bg-gray-800 bg-transparent"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-[#997100] hover:bg-[#b8850a] text-black"
                  onClick={createTemplate}
                  disabled={!newTemplate.name || !newTemplate.loan_type}
                >
                  Create Template
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((template) => (
          <Card key={template.id} className="bg-gray-900 border-gray-800 hover:border-gray-600 transition-colors">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-white text-lg">{template.name}</CardTitle>
                  <CardDescription className="text-gray-400 mt-2">{template.description}</CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  {template.is_active ? (
                    <CheckCircle className="h-5 w-5 text-green-400" />
                  ) : (
                    <Clock className="h-5 w-5 text-gray-400" />
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge className={getLoanTypeColor(template.loan_type)}>{formatLoanType(template.loan_type)}</Badge>
                  <span className="text-sm text-gray-400">{template.items?.length || 0} items</span>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    checked={template.is_active}
                    onCheckedChange={(checked) => toggleTemplateStatus(template.id, checked)}
                  />
                  <Label className="text-gray-300 text-sm">Active</Label>
                </div>

                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 border-gray-600 text-white hover:bg-gray-800 bg-transparent"
                    onClick={() => setSelectedTemplate(template)}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-gray-600 text-white hover:bg-gray-800 bg-transparent"
                    onClick={() => cloneTemplate(template.id)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {templates.length === 0 && (
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="text-center py-12">
            <Settings className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Templates Yet</h3>
            <p className="text-gray-400 mb-6">Create your first checklist template to get started</p>
            <Button className="bg-[#997100] hover:bg-[#b8850a] text-black" onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create First Template
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
