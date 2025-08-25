"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Scissors, Phone, Mail, CheckCircle, Users, Briefcase, Search, RefreshCw, FileText } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api"

interface Tailor {
  id: string
  name: string
  phone: string
  email?: string
  specialization: string
  experience?: string
  status: "active" | "inactive"
  total_jobs?: number
  completed_jobs?: number
  pending_jobs?: number
  completion_rate?: number
  created_at: string
}

interface Job {
  id: string
  bill_id: string
  tailor_id: string
  tailor_name?: string
  customer_name: string
  customer_phone: string
  items: Array<{
    type: string
    description: string
    measurements: Record<string, any>
  }>
  instructions: string
  priority: "low" | "medium" | "high"
  status: "assigned" | "in_progress" | "completed" | "delivered"
  assigned_date: string
  due_date?: string
  completed_date?: string
}

interface Bill {
  id?: string
  _id?: string
  bill_no?: number
  bill_no_str?: string
  customer_id: string
  customer_name: string
  customer_phone: string
  customer_address?: string
  items: Array<{
    type: string
    description: string
    quantity: number
    price: number
    measurements: Record<string, any>
    total: number
  }>
  subtotal: number
  discount: number
  total: number
  advance: number
  balance: number
  status: "pending" | "paid" | "cancelled"
  created_at: string
  due_date?: string
  special_instructions?: string
}

export function TailorManagement() {
  const [tailors, setTailors] = useState<Tailor[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [bills, setBills] = useState<Bill[]>([])
  const [selectedTailor, setSelectedTailor] = useState<Tailor | null>(null)
  const [isAddTailorOpen, setIsAddTailorOpen] = useState(false)
  const [isAssignJobOpen, setIsAssignJobOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isBillsLoading, setIsBillsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState("overview")

  const [newTailor, setNewTailor] = useState({
    name: "",
    phone: "",
    email: "",
    specialization: "",
    experience: "",
  })

  const [newJob, setNewJob] = useState({
    bill_id: "",
    customer_name: "",
    customer_phone: "",
    tailor_id: "",
    item_type: "",
    description: "",
    measurements: "",
    instructions: "",
    priority: "medium" as "low" | "medium" | "high",
    due_date: "",
  })

  useEffect(() => {
    loadTailors()
    loadJobs()
    loadBills()
  }, [])

  const loadTailors = async () => {
    try {
      setIsLoading(true)
      const response = await api.tailors.getAll()
      setTailors(response.tailors || [])
    } catch (error) {
      console.error("Error loading tailors:", error)
      toast.error("Failed to load tailors")
    } finally {
      setIsLoading(false)
    }
  }

  const loadJobs = async () => {
    try {
      const response = await api.jobs.getAll()
      setJobs(response.jobs || [])
    } catch (error) {
      console.error("Error loading jobs:", error)
      toast.error("Failed to load jobs")
    }
  }

  const loadBills = async () => {
    try {
      setIsBillsLoading(true)
      const response = await api.bills.getAll({
        status: "pending",
        limit: 100,
      })
      setBills(response.bills || [])
    } catch (error) {
      console.error("Error loading bills:", error)
      toast.error("Failed to load bills")
    } finally {
      setIsBillsLoading(false)
    }
  }

  const addTailor = async () => {
    if (newTailor.name && newTailor.phone) {
      try {
        await api.tailors.create({
          name: newTailor.name,
          phone: newTailor.phone,
          email: newTailor.email,
          specialization: newTailor.specialization,
          experience: newTailor.experience,
          status: "active",
        })

        await loadTailors()
        setNewTailor({ name: "", phone: "", email: "", specialization: "", experience: "" })
        setIsAddTailorOpen(false)
        toast.success(`${newTailor.name} has been added successfully.`)
      } catch (error) {
        console.error("Error adding tailor:", error)
        toast.error("Failed to add tailor")
      }
    }
  }

  const assignJob = async () => {
    try {
      console.log("Assign job button clicked")
      console.log("Current job data:", newJob)

      // Validate required fields
      if (!newJob.tailor_id) {
        toast.error("Please select a tailor")
        return
      }

      if (!newJob.customer_name) {
        toast.error("Please enter customer name")
        return
      }

      if (!newJob.item_type) {
        toast.error("Please enter item type")
        return
      }

      // Parse measurements safely
      let parsedMeasurements = {}
      if (newJob.measurements) {
        try {
          parsedMeasurements = JSON.parse(newJob.measurements)
        } catch (error) {
          toast.error("Invalid measurements format. Please use valid JSON")
          return
        }
      }

      // Prepare job data
      const jobData: any = {
        tailor_id: newJob.tailor_id,
        customer_name: newJob.customer_name,
        customer_phone: newJob.customer_phone,
        items: [
          {
            type: newJob.item_type,
            description: newJob.description,
            measurements: parsedMeasurements,
          },
        ],
        instructions: newJob.instructions,
        priority: newJob.priority,
        status: "assigned" as const,
      }
      
      if (newJob.bill_id) {
        jobData.bill_id = newJob.bill_id
      }
      
      if (newJob.due_date) {
        jobData.due_date = newJob.due_date
      }

      console.log("Sending job data to API:", jobData)

      // Call API to create job
      await api.jobs.create(jobData)

      // Refresh data
      await Promise.all([loadJobs(), loadTailors()])

      // Reset form
      setNewJob({
        bill_id: "",
        customer_name: "",
        customer_phone: "",
        tailor_id: "",
        item_type: "",
        description: "",
        measurements: "",
        instructions: "",
        priority: "medium",
        due_date: "",
      })

      // Close dialog and show success message
      setIsAssignJobOpen(false)
      toast.success("Job has been assigned successfully")
    } catch (error) {
      console.error("Error assigning job:", error)
      toast.error("Failed to assign job. Please try again")
    }
  }

  const updateJobStatus = async (jobId: string, status: Job["status"]) => {
    try {
      await api.jobs.updateStatus(jobId, status)
      await loadJobs()
      await loadTailors()
      toast.success(`Job status updated to ${status.replace("_", " ")}`)
    } catch (error) {
      console.error("Error updating job status:", error)
      toast.error("Failed to update job status")
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "assigned":
        return "bg-blue-100 text-blue-800"
      case "in_progress":
        return "bg-yellow-100 text-yellow-800"
      case "completed":
        return "bg-green-100 text-green-800"
      case "delivered":
        return "bg-purple-100 text-purple-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800"
      case "medium":
        return "bg-yellow-100 text-yellow-800"
      case "low":
        return "bg-green-100 text-green-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getBillStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-orange-100 text-orange-800"
      case "paid":
        return "bg-green-100 text-green-800"
      case "cancelled":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  // Safe function to get bill ID suffix
  const getBillIdSuffix = (billId: string) => {
    if (!billId) return "N/A"
    return billId.length > 6 ? billId.slice(-6) : billId
  }

  const formatBillNumber = (bill: Bill) => {
    if (bill.bill_no_str) return bill.bill_no_str
    if (typeof bill.bill_no === "number") return String(bill.bill_no).padStart(3, "0")
    const id = bill.id || bill._id || ""
    return getBillIdSuffix(id)
  }

  const filteredTailors = tailors.filter(
    (tailor) =>
      tailor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tailor.phone.includes(searchTerm) ||
      tailor.specialization.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const filteredJobs = jobs.filter(
    (job) =>
      job.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.customer_phone.includes(searchTerm) ||
      job.items.some((item) => item.type.toLowerCase().includes(searchTerm.toLowerCase())),
  )

  const handleBillSelection = async (billId: string) => {
    const selectedBill = bills.find((bill) => (bill.id || bill._id) === billId)
    if (selectedBill) {
      // Get the first item from the bill for auto-population
      const firstItem = selectedBill.items[0]

      // Format measurements as JSON string
      const measurementsJson = firstItem?.measurements ? JSON.stringify(firstItem.measurements, null, 2) : ""

      // Combine all item descriptions
      const combinedDescription = selectedBill.items.map((item) => `${item.type}: ${item.description}`).join("; ")

      // Get the most common item type or first item type
      const itemType = firstItem?.type || ""

      // Format due date if available
      const dueDate = selectedBill.due_date ? new Date(selectedBill.due_date).toISOString().split("T")[0] : ""

      setNewJob((prev) => ({
        ...prev,
        bill_id: billId,
        customer_name: selectedBill.customer_name,
        customer_phone: selectedBill.customer_phone || "",
        item_type: itemType,
        description: combinedDescription,
        measurements: measurementsJson,
        instructions: selectedBill.special_instructions || "",
        due_date: dueDate,
      }))

      // Show success message
      toast.success(`Bill data loaded: ${selectedBill.items.length} item(s) found`)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading tailors...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
              Tailor Management
            </h1>
            <p className="text-gray-600 mt-2">Manage tailors, assign jobs, and track progress</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={loadBills}
              disabled={isBillsLoading}
              className="border-violet-200 hover:bg-violet-50 bg-transparent"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isBillsLoading ? "animate-spin" : ""}`} />
              Refresh Bills
            </Button>

            <Dialog open={isAddTailorOpen} onOpenChange={setIsAddTailorOpen}>
              <DialogTrigger asChild>
                <Button className="bg-violet-600 hover:bg-violet-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Tailor
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add New Tailor</DialogTitle>
                  <DialogDescription>Enter tailor details to add them to your team</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={newTailor.name}
                      onChange={(e) => setNewTailor((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter tailor name"
                      className="border-violet-200 focus:border-violet-400"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone *</Label>
                    <Input
                      id="phone"
                      value={newTailor.phone}
                      onChange={(e) => setNewTailor((prev) => ({ ...prev, phone: e.target.value }))}
                      placeholder="Enter phone number"
                      className="border-violet-200 focus:border-violet-400"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newTailor.email}
                      onChange={(e) => setNewTailor((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder="Enter email address"
                      className="border-violet-200 focus:border-violet-400"
                    />
                  </div>
                  <div>
                    <Label htmlFor="specialization">Specialization</Label>
                    <Input
                      id="specialization"
                      value={newTailor.specialization}
                      onChange={(e) => setNewTailor((prev) => ({ ...prev, specialization: e.target.value }))}
                      placeholder="e.g., Shirts, Pants, Suits"
                      className="border-violet-200 focus:border-violet-400"
                    />
                  </div>
                  <div>
                    <Label htmlFor="experience">Experience</Label>
                    <Input
                      id="experience"
                      value={newTailor.experience}
                      onChange={(e) => setNewTailor((prev) => ({ ...prev, experience: e.target.value }))}
                      placeholder="e.g., 5 years"
                      className="border-violet-200 focus:border-violet-400"
                    />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button onClick={addTailor} className="flex-1 bg-violet-600 hover:bg-violet-700">
                      Add Tailor
                    </Button>
                    <Button variant="outline" onClick={() => setIsAddTailorOpen(false)} className="flex-1">
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={isAssignJobOpen} onOpenChange={setIsAssignJobOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-violet-200 hover:bg-violet-50 bg-transparent">
                  <Briefcase className="w-4 h-4 mr-2" />
                  Assign Job
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Assign New Job</DialogTitle>
                  <DialogDescription>Assign a new tailoring job to a tailor</DialogDescription>
                </DialogHeader>

                {/* Bill Selection */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="bill_select">Select Bill *</Label>
                    <Select value={newJob.bill_id} onValueChange={handleBillSelection}>
                      <SelectTrigger className="border-violet-200 focus:border-violet-400">
                        <SelectValue placeholder="Select a bill to auto-populate data" />
                      </SelectTrigger>
                      <SelectContent>
                        {bills
                          .filter((bill) => bill.status === "pending" || bill.status === "paid")
                          .map((bill) => {
                            const value = bill.id || bill._id || ""
                            return (
                              <SelectItem key={value} value={value}>
                                {bill.customer_name} - Bill #{formatBillNumber(bill)} - ₹{bill.total} ({bill.items.length} items)
                              </SelectItem>
                            )
                          })}
                      </SelectContent>
                    </Select>
                    {isBillsLoading && <p className="text-sm text-gray-500 mt-1">Loading bills...</p>}
                    {newJob.bill_id && (
                      <p className="text-sm text-green-600 mt-1">✓ Bill data automatically loaded below</p>
                    )}
                  </div>

                  {/* Enhanced Bill Details Preview */}
                  {newJob.bill_id && (
                    <Card className="bg-violet-50 border-violet-200">
                      <CardContent className="p-4">
                        <h4 className="font-medium text-violet-800 mb-2">📋 Bill Details Preview</h4>
                        {(() => {
                          const selectedBill = bills.find((bill) => (bill.id || bill._id) === newJob.bill_id)
                          return selectedBill ? (
                            <div className="text-sm space-y-2">
                              <div className="flex justify-between items-center">
                                <span>
                                  <strong>Customer:</strong> {selectedBill.customer_name}
                                </span>
                                <Badge className={getBillStatusColor(selectedBill.status)}>{selectedBill.status}</Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p>
                                    <strong>Phone:</strong> {selectedBill.customer_phone || "N/A"}
                                  </p>
                                  <p>
                                    <strong>Total:</strong> ₹{selectedBill.total}
                                  </p>
                                  <p>
                                    <strong>Balance:</strong> ₹{selectedBill.balance}
                                  </p>
                                </div>
                                <div>
                                  <p>
                                    <strong>Items:</strong> {selectedBill.items.length}
                                  </p>
                                  <p>
                                    <strong>Due Date:</strong>{" "}
                                    {selectedBill.due_date
                                      ? new Date(selectedBill.due_date).toLocaleDateString()
                                      : "Not set"}
                                  </p>
                                </div>
                              </div>
                              <div>
                                <strong>Items Details:</strong>
                                <div className="mt-1 space-y-1 max-h-32 overflow-y-auto">
                                  {selectedBill.items.map((item, index) => (
                                    <div key={index} className="text-xs bg-white p-2 rounded border">
                                      <div className="flex justify-between">
                                        <span>
                                          <strong>{item.type}</strong> - {item.description}
                                        </span>
                                        <span>Qty: {item.quantity}</span>
                                      </div>
                                      {item.measurements && Object.keys(item.measurements).length > 0 && (
                                        <div className="mt-1 text-gray-600">
                                          <strong>Measurements:</strong>{" "}
                                          {Object.entries(item.measurements)
                                            .map(([key, value]) => `${key}: ${value}`)
                                            .join(", ")}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                              {selectedBill.special_instructions && (
                                <div className="mt-2 p-2 bg-yellow-50 rounded">
                                  <strong>Special Instructions:</strong> {selectedBill.special_instructions}
                                </div>
                              )}
                            </div>
                          ) : null
                        })()}
                      </CardContent>
                    </Card>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="col-span-2">
                    <Label htmlFor="customer_name">Customer Name *</Label>
                    <Input
                      id="customer_name"
                      value={newJob.customer_name}
                      onChange={(e) => setNewJob((prev) => ({ ...prev, customer_name: e.target.value }))}
                      placeholder="Enter customer name"
                      className="border-violet-200 focus:border-violet-400"
                      readOnly={!!newJob.bill_id}
                    />
                    {newJob.bill_id && <p className="text-xs text-gray-500 mt-1">Auto-filled from selected bill</p>}
                  </div>

                  <div className="col-span-2">
                    <Label htmlFor="customer_phone">Customer Phone</Label>
                    <Input
                      id="customer_phone"
                      value={newJob.customer_phone}
                      onChange={(e) => setNewJob((prev) => ({ ...prev, customer_phone: e.target.value }))}
                      placeholder="Enter customer phone"
                      className="border-violet-200 focus:border-violet-400"
                      readOnly={!!newJob.bill_id}
                    />
                    {newJob.bill_id && <p className="text-xs text-gray-500 mt-1">Auto-filled from selected bill</p>}
                  </div>

                  <div>
                    <Label htmlFor="tailor_id">Assign to Tailor *</Label>
                    <Select
                      value={newJob.tailor_id}
                      onValueChange={(value) => setNewJob((prev) => ({ ...prev, tailor_id: value }))}
                    >
                      <SelectTrigger className="border-violet-200 focus:border-violet-400">
                        <SelectValue placeholder="Select tailor" />
                      </SelectTrigger>
                      <SelectContent>
                        {tailors
                          .filter((tailor) => tailor.status === "active")
                          .map((tailor) => (
                            <SelectItem key={tailor.id} value={tailor.id}>
                              {tailor.name} - {tailor.specialization} ({tailor.pending_jobs || 0} pending)
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="item_type">Item Type *</Label>
                    <Input
                      id="item_type"
                      value={newJob.item_type}
                      onChange={(e) => setNewJob((prev) => ({ ...prev, item_type: e.target.value }))}
                      placeholder="e.g., Shirt, Pant, Suit"
                      className="border-violet-200 focus:border-violet-400"
                    />
                    {newJob.bill_id && <p className="text-xs text-gray-500 mt-1">Auto-filled from bill's first item</p>}
                  </div>

                  <div>
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                      value={newJob.priority}
                      onValueChange={(value) =>
                        setNewJob((prev) => ({ ...prev, priority: value as "low" | "medium" | "high" }))
                      }
                    >
                      <SelectTrigger className="border-violet-200 focus:border-violet-400">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low Priority</SelectItem>
                        <SelectItem value="medium">Medium Priority</SelectItem>
                        <SelectItem value="high">High Priority</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="due_date">Due Date</Label>
                    <Input
                      id="due_date"
                      type="date"
                      value={newJob.due_date}
                      onChange={(e) => setNewJob((prev) => ({ ...prev, due_date: e.target.value }))}
                      className="border-violet-200 focus:border-violet-400"
                    />
                    {newJob.bill_id && <p className="text-xs text-gray-500 mt-1">Auto-filled from bill due date</p>}
                  </div>

                  <div className="col-span-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={newJob.description}
                      onChange={(e) => setNewJob((prev) => ({ ...prev, description: e.target.value }))}
                      placeholder="Describe the work to be done"
                      className="border-violet-200 focus:border-violet-400"
                      rows={3}
                    />
                    {newJob.bill_id && <p className="text-xs text-gray-500 mt-1">Auto-filled from bill items</p>}
                  </div>

                  <div className="col-span-2">
                    <Label htmlFor="measurements">Measurements (JSON format)</Label>
                    <Textarea
                      id="measurements"
                      value={newJob.measurements}
                      onChange={(e) => setNewJob((prev) => ({ ...prev, measurements: e.target.value }))}
                      placeholder='{"chest": "40", "waist": "32", "length": "28"}'
                      className="border-violet-200 focus:border-violet-400 font-mono text-sm"
                      rows={4}
                    />
                    {newJob.bill_id && <p className="text-xs text-gray-500 mt-1">Auto-filled from bill measurements</p>}
                  </div>

                  <div className="col-span-2">
                    <Label htmlFor="instructions">Special Instructions</Label>
                    <Textarea
                      id="instructions"
                      value={newJob.instructions}
                      onChange={(e) => setNewJob((prev) => ({ ...prev, instructions: e.target.value }))}
                      placeholder="Any special instructions for the tailor"
                      className="border-violet-200 focus:border-violet-400"
                      rows={3}
                    />
                    {newJob.bill_id && <p className="text-xs text-gray-500 mt-1">Auto-filled from bill instructions</p>}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button onClick={assignJob} className="flex-1 bg-violet-600 hover:bg-violet-700">
                    Assign Job
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsAssignJobOpen(false)
                      setNewJob({
                        bill_id: "",
                        customer_name: "",
                        customer_phone: "",
                        tailor_id: "",
                        item_type: "",
                        description: "",
                        measurements: "",
                        instructions: "",
                        priority: "medium",
                        due_date: "",
                      })
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Search */}
        <Card className="border-violet-100 shadow-lg backdrop-blur-sm bg-white/80">
          <CardContent className="p-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search tailors, jobs, or customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-violet-200 focus:border-violet-400"
              />
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-violet-100 shadow-lg backdrop-blur-sm bg-white/80 hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Tailors</p>
                  <p className="text-2xl font-bold text-violet-600">{tailors.length}</p>
                </div>
                <div className="p-3 bg-violet-100 rounded-full">
                  <Users className="w-6 h-6 text-violet-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-violet-100 shadow-lg backdrop-blur-sm bg-white/80 hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Jobs</p>
                  <p className="text-2xl font-bold text-indigo-600">
                    {jobs.filter((job) => job.status === "assigned" || job.status === "in_progress").length}
                  </p>
                </div>
                <div className="p-3 bg-indigo-100 rounded-full">
                  <Briefcase className="w-6 h-6 text-indigo-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-violet-100 shadow-lg backdrop-blur-sm bg-white/80 hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending Bills</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {bills.filter((bill) => bill.status === "pending").length}
                  </p>
                </div>
                <div className="p-3 bg-orange-100 rounded-full">
                  <FileText className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-violet-100 shadow-lg backdrop-blur-sm bg-white/80 hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Completed Jobs</p>
                  <p className="text-2xl font-bold text-emerald-600">
                    {jobs.filter((job) => job.status === "completed" || job.status === "delivered").length}
                  </p>
                </div>
                <div className="p-3 bg-emerald-100 rounded-full">
                  <CheckCircle className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-violet-100">
            <TabsTrigger value="overview" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white">
              Overview
            </TabsTrigger>
            <TabsTrigger value="tailors" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white">
              Tailors
            </TabsTrigger>
            <TabsTrigger value="jobs" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white">
              Jobs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Jobs */}
              <Card className="border-violet-100 shadow-lg backdrop-blur-sm bg-white/80">
                <CardHeader>
                  <CardTitle className="text-violet-800">Recent Jobs</CardTitle>
                  <CardDescription>Latest job assignments and updates</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {jobs.slice(0, 5).map((job) => (
                      <div key={job.id} className="flex items-center justify-between p-3 bg-violet-50 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{job.customer_name}</p>
                          <p className="text-sm text-gray-600">
                            {job.items[0]?.type} - {job.tailor_name}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getPriorityColor(job.priority)}>{job.priority}</Badge>
                          <Badge className={getStatusColor(job.status)}>{job.status.replace("_", " ")}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Top Performers */}
              <Card className="border-violet-100 shadow-lg backdrop-blur-sm bg-white/80">
                <CardHeader>
                  <CardTitle className="text-violet-800">Top Performers</CardTitle>
                  <CardDescription>Tailors with highest completion rates</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {tailors
                      .sort((a, b) => (b.completion_rate || 0) - (a.completion_rate || 0))
                      .slice(0, 5)
                      .map((tailor) => (
                        <div key={tailor.id} className="flex items-center justify-between p-3 bg-violet-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-violet-100 rounded-full">
                              <Scissors className="w-4 h-4 text-violet-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{tailor.name}</p>
                              <p className="text-sm text-gray-600">{tailor.specialization}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-violet-600">{tailor.completion_rate || 0}%</p>
                            <Progress value={tailor.completion_rate || 0} className="w-16 mt-1" />
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="tailors" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTailors.map((tailor) => (
                <Card
                  key={tailor.id}
                  className="border-violet-100 shadow-lg backdrop-blur-sm bg-white/80 hover:shadow-xl transition-all duration-300"
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-violet-100 rounded-full">
                          <Scissors className="w-5 h-5 text-violet-600" />
                        </div>
                        <div>
                          <CardTitle className="text-lg text-gray-900">{tailor.name}</CardTitle>
                          <CardDescription>{tailor.specialization}</CardDescription>
                        </div>
                      </div>
                      <Badge variant={tailor.status === "active" ? "default" : "secondary"}>{tailor.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="w-4 h-4" />
                        {tailor.phone}
                      </div>
                      {tailor.email && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Mail className="w-4 h-4" />
                          {tailor.email}
                        </div>
                      )}
                      {tailor.experience && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <span>Experience: {tailor.experience}</span>
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-sm text-gray-600">Total</p>
                          <p className="font-bold text-indigo-600">{tailor.total_jobs || 0}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Done</p>
                          <p className="font-bold text-emerald-600">{tailor.completed_jobs || 0}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Pending</p>
                          <p className="font-bold text-orange-600">{tailor.pending_jobs || 0}</p>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Completion Rate</span>
                          <span>{tailor.completion_rate || 0}%</span>
                        </div>
                        <Progress value={tailor.completion_rate || 0} className="h-2" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="jobs" className="space-y-6">
            <Card className="border-violet-100 shadow-lg backdrop-blur-sm bg-white/80">
              <CardHeader>
                <CardTitle className="text-violet-800">All Jobs</CardTitle>
                <CardDescription>Manage and track all tailoring jobs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredJobs.map((job) => (
                    <div key={job.id} className="p-4 bg-violet-50 rounded-lg border border-violet-100">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-medium text-gray-900">{job.customer_name}</h3>
                            <Badge className={getPriorityColor(job.priority)}>{job.priority}</Badge>
                            <Badge className={getStatusColor(job.status)}>{job.status.replace("_", " ")}</Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                            <div>
                              <p>
                                <strong>Bill ID:</strong> {job.bill_id ? `#${getBillIdSuffix(job.bill_id)}` : "N/A"}
                              </p>
                              <p>
                                <strong>Phone:</strong> {job.customer_phone}
                              </p>
                            </div>
                            <div>
                              <p>
                                <strong>Tailor:</strong> {job.tailor_name || "Unassigned"}
                              </p>
                              <p>
                                <strong>Assigned:</strong> {new Date(job.assigned_date).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="mt-2">
                            <p className="text-sm text-gray-600">
                              <strong>Items:</strong> {job.items.map((item) => item.type).join(", ")}
                            </p>
                            {job.instructions && (
                              <p className="text-sm text-gray-600 mt-1">
                                <strong>Instructions:</strong> {job.instructions}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 ml-4">
                          {job.status === "assigned" && (
                            <Button
                              size="sm"
                              onClick={() => updateJobStatus(job.id, "in_progress")}
                              className="bg-yellow-600 hover:bg-yellow-700"
                            >
                              Start
                            </Button>
                          )}
                          {job.status === "in_progress" && (
                            <Button
                              size="sm"
                              onClick={() => updateJobStatus(job.id, "completed")}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              Complete
                            </Button>
                          )}
                          {job.status === "completed" && (
                            <Button
                              size="sm"
                              onClick={() => updateJobStatus(job.id, "delivered")}
                              className="bg-purple-600 hover:bg-purple-700"
                            >
                              Deliver
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}