"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MobileNav } from "@/components/mobile-nav"
import { BottomNav } from "@/components/bottom-nav"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api"
import {
  Users,
  Receipt,
  Scissors,
  BarChart3,
  LogOut,
  TrendingUp,
  TrendingDown,
  Clock,
  AlertTriangle,
  IndianRupee,
  Bell,
  Settings,
  Sparkles,
  Loader2,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Package,
  Calendar,
} from "lucide-react"

interface Customer {
  _id: string
  name: string
  phone: string
  email?: string
  address?: string
  notes?: string
  createdAt: string
}

interface Bill {
  _id: string
  customerName: string
  customer_id: string
  items: Array<{
    itemType: string
    quantity: number
    rate: number
    amount: number
  }>
  subtotal: number
  discount: number
  advanceAmount: number
  totalAmount: number
  status: "pending" | "in_progress" | "completed"
  createdAt: string
  notes?: string
  // Augmented fields: job status coming from tailor-management (jobs)
  jobStatus?: "pending" | "assigned" | "acknowledged" | "in_progress" | "completed" | "delivered"
  jobId?: string
}

interface Tailor {
  _id: string
  name: string
  phone: string
  email?: string
  specialization?: string
  status: "active" | "inactive"
  createdAt: string
}

interface Job {
  _id: string
  bill_id: string
  tailor_id: string
  itemType: string
  status: "assigned" | "acknowledged" | "in_progress" | "completed" | "delivered"
  priority: "low" | "medium" | "high"
  createdAt: string
  instructions?: string
}

interface DashboardStats {
  totalCustomers: number
  activeOrders: number
  completedOrders: number
  totalRevenue: number
  monthlyRevenue: number
  outstandingAmount: number
  activeTailors: number
  pendingJobs: number
}

interface RecentActivity {
  id: string
  type: "order" | "payment" | "job" | "customer"
  message: string
  timestamp: string
  status: "success" | "warning" | "error" | "info"
}

interface Alert {
  id: string
  type: "overdue" | "payment" | "job" | "system"
  title: string
  message: string
  priority: "high" | "medium" | "low"
  timestamp: string
}

export function AdminDashboard() {
  const [user, setUser] = useState<any>(null)
  const [stats, setStats] = useState<DashboardStats>({
    totalCustomers: 0,
    activeOrders: 0,
    completedOrders: 0,
    totalRevenue: 0,
    monthlyRevenue: 0,
    outstandingAmount: 0,
    activeTailors: 0,
    pendingJobs: 0,
  })
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [activeTab, setActiveTab] = useState("overview")
  const [upiId, setUpiId] = useState("")
  const [businessName, setBusinessName] = useState("STAR TAILORS")
  const [businessInfo, setBusinessInfo] = useState<{ address?: string; phone?: string; email?: string }>({})
  const [isEditingUpi, setIsEditingUpi] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const router = useRouter()
  const [orders, setOrders] = useState<Bill[]>([])
  const [filteredOrders, setFilteredOrders] = useState<Bill[]>([])
  const [orderSearchTerm, setOrderSearchTerm] = useState("")
  const [orderStatusFilter, setOrderStatusFilter] = useState("all")
  const [orderSortBy, setOrderSortBy] = useState("newest")
  const [selectedOrder, setSelectedOrder] = useState<Bill | null>(null)
  const [showOrderDetails, setShowOrderDetails] = useState(false)
  const [jobsList, setJobsList] = useState<Job[]>([])

  const generateAdminQRCode = (upiId: string, amount = 100) => {
    if (!upiId.trim()) return ""

    const upiString = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent("STAR TAILORS")}&am=${amount}&cu=INR&tn=${encodeURIComponent("Sample Bill Payment")}`
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiString)}`
  }

  useEffect(() => {
    const userData = localStorage.getItem("user")
    if (userData) {
      setUser(JSON.parse(userData))
    }

    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      setError("")

      // First verify the token is valid
      try {
        await api.auth.verify()
      } catch (verifyError) {
        console.error("Token verification failed:", verifyError)
        // Handle token expiration or invalidity
        handleLogout()
        return
      }

      // Load data with proper error handling
      const [customersRes, billsRes, tailorsRes, jobsRes, upiRes, bizRes] = await Promise.all([
        api.customers.getAll().catch((e) => ({ customers: [], error: e.message })),
        api.bills.getAll({ limit: 1000 }).catch((e) => ({ bills: [], error: e.message })),
        api.tailors.getAll().catch((e) => ({ tailors: [], error: e.message })),
        api.jobs.getAll({ limit: 1000 }).catch((e) => ({ jobs: [], error: e.message })),
        api.settings.getUpi().catch((e) => ({ upiId: "startailors@paytm", error: e.message })),
        api.settings.getBusiness().catch((e) => ({ business_name: "STAR TAILORS", error: e.message })),
      ])

      // Check for errors in responses
      const errors = [customersRes.error, billsRes.error, tailorsRes.error, jobsRes.error, upiRes.error, bizRes.error].filter(Boolean)

      if (errors.length > 0) {
        console.error("Errors loading data:", errors)
        setError("Partial data loaded. Some features may not work.")
      }

      // Process data
      const customers: Customer[] = customersRes.customers || []
      const rawBills: any[] = billsRes.bills || []
      const tailors: Tailor[] = tailorsRes.tailors || []
      const jobs: Job[] = jobsRes.jobs || []

      // Normalize bill fields from backend -> UI shape
      const normalizedBills: Bill[] = rawBills.map((b: any) => ({
        _id: b._id,
        customerName: b.customer_name || b.customer?.name || b.customerName,
        customer_id: b.customer_id,
        items: Array.isArray(b.items)
          ? b.items.map((it: any) => ({
              itemType: it.itemType || it.type || "",
              quantity: it.quantity ?? it.qty ?? 0,
              rate: it.rate ?? it.price ?? 0,
              amount: it.amount ?? it.total ?? (it.quantity ?? 0) * (it.price ?? 0),
            }))
          : [],
        subtotal: b.subtotal ?? 0,
        discount: b.discount ?? 0,
        advanceAmount: b.advance ?? b.advanceAmount ?? 0,
        totalAmount: b.total ?? b.totalAmount ?? 0,
        status: b.status || "pending",
        createdAt: b.created_at || b.createdAt || new Date().toISOString(),
        notes: b.special_instructions || b.notes,
      }))

      // Merge job status into bills for Orders tab
      const mergedOrders: Bill[] = normalizedBills.map((bill) => {
        const job = jobs.find((j) => j.bill_id === bill._id)
        return {
          ...bill,
          jobStatus: (job?.status as any) || (bill.status as any) || "pending",
          jobId: job?._id,
        }
      })

      setJobsList(jobs)
      setOrders(mergedOrders)
      setFilteredOrders(mergedOrders)

      // ... existing stats calculation code ...
      const activeOrders = normalizedBills.filter(
        (bill: Bill) => bill.status === "pending" || bill.status === "in_progress",
      ).length
      const completedOrders = normalizedBills.filter((bill: Bill) => bill.status === "completed").length
      const totalRevenue = normalizedBills.reduce((sum: number, bill: Bill) => sum + (bill.totalAmount || 0), 0)
      const currentMonth = new Date().getMonth()
      const currentYear = new Date().getFullYear()
      const monthlyRevenue = normalizedBills
        .filter((bill: Bill) => {
          const billDate = new Date(bill.createdAt)
          return billDate.getMonth() === currentMonth && billDate.getFullYear() === currentYear
        })
        .reduce((sum: number, bill: Bill) => sum + (bill.totalAmount || 0), 0)

      const outstandingAmount = normalizedBills
        .filter((bill: Bill) => bill.status === "pending")
        .reduce((sum: number, bill: Bill) => sum + ((bill.totalAmount || 0) - (bill.advanceAmount || 0)), 0)

      const activeTailors = tailors.filter((tailor: Tailor) => tailor.status === "active").length
      const pendingJobs = jobs.filter((job: Job) => job.status === "assigned" || job.status === "acknowledged").length

      setStats({
        totalCustomers: customers.length,
        activeOrders,
        completedOrders,
        totalRevenue,
        monthlyRevenue,
        outstandingAmount,
        activeTailors,
        pendingJobs,
      })

      // Generate recent activity from real data
      const activity: RecentActivity[] = []

      // Add recent bills
      normalizedBills.slice(0, 3).forEach((bill: Bill) => {
        activity.push({
          id: `bill-${bill._id}`,
          type: "order",
          message: `New order from ${bill.customerName} - ${bill.items?.[0]?.itemType || "Order"}`,
          timestamp: new Date(bill.createdAt).toLocaleString(),
          status: "info",
        })
      })

      // Add recent jobs
      jobs.slice(0, 2).forEach((job: Job) => {
        activity.push({
          id: `job-${job._id}`,
          type: "job",
          message: `Job ${job.status === "completed" ? "completed" : "assigned"} - ${job.itemType}`,
          timestamp: new Date(job.createdAt).toLocaleString(),
          status: job.status === "completed" ? "success" : "info",
        })
      })

      setRecentActivity(activity.slice(0, 5))

      // Generate alerts from real data
      const alertsList: Alert[] = []

      if (pendingJobs > 0) {
        alertsList.push({
          id: "pending-jobs",
          type: "job",
          title: "Pending Jobs",
          message: `${pendingJobs} jobs are waiting for tailor attention`,
          priority: pendingJobs > 5 ? "high" : "medium",
          timestamp: "Now",
        })
      }

      if (outstandingAmount > 0) {
        alertsList.push({
          id: "outstanding-payments",
          type: "payment",
          title: "Outstanding Payments",
          message: `₹${outstandingAmount.toLocaleString()} in outstanding payments`,
          priority: outstandingAmount > 20000 ? "high" : "medium",
          timestamp: "Now",
        })
      }

      setAlerts(alertsList)

      // Set UPI settings
      const upiVal = (upiRes && (upiRes.upi_id || upiRes.upiId)) || "startailors@paytm"
      const bizName = (upiRes && (upiRes.business_name || upiRes.businessName)) || businessName || "STAR TAILORS"
      setUpiId(upiVal)
      setBusinessName(bizName)
      setQrCodeUrl(generateAdminQRCode(upiVal))
    } catch (err: any) {
      console.error("Error loading dashboard data:", err)
      setError(err.message || "Failed to load dashboard data")

      // If it's an authentication error, log the user out
      if (err.message.includes("401") || err.message.includes("Token")) {
        handleLogout()
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let filtered = [...orders]

    // Filter by search term
    if (orderSearchTerm) {
      filtered = filtered.filter(
        (order) =>
          order.customerName.toLowerCase().includes(orderSearchTerm.toLowerCase()) ||
          order._id.toLowerCase().includes(orderSearchTerm.toLowerCase()) ||
          order.items.some((item) => item.itemType.toLowerCase().includes(orderSearchTerm.toLowerCase())),
      )
    }

    // Filter by job status (from Tailor Management)
    if (orderStatusFilter !== "all") {
      filtered = filtered.filter((order) => (order.jobStatus || "pending") === orderStatusFilter)
    }

    // Sort orders
    filtered.sort((a, b) => {
      switch (orderSortBy) {
        case "newest":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        case "oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        case "amount-high":
          return (b.totalAmount || 0) - (a.totalAmount || 0)
        case "amount-low":
          return (a.totalAmount || 0) - (b.totalAmount || 0)
        default:
          return 0
      }
    })

    setFilteredOrders(filtered)
  }, [orders, orderSearchTerm, orderStatusFilter, orderSortBy])

  const handleOrderStatusUpdate = async (orderId: string, newStatus: "pending" | "in_progress" | "completed") => {
    try {
      await api.bills.updateStatus(orderId, newStatus)

      // Update local state
      setOrders((prev) => prev.map((order) => (order._id === orderId ? { ...order, status: newStatus } : order)))

      // Refresh dashboard data to update stats
      loadDashboardData()

      alert("Order status updated successfully!")
    } catch (err: any) {
      console.error("Error updating order status:", err)
      alert("Failed to update order status. Please try again.")
    }
  }

  const handleViewOrderDetails = (order: Bill) => {
    setSelectedOrder(order)
    setShowOrderDetails(true)
  }

  const handleLogout = () => {
    localStorage.removeItem("user")
    localStorage.removeItem("token")
    router.push("/")
  }

  const handleUpiUpdate = async () => {
    if (!upiId.trim()) return

    try {
      await api.settings.updateUpi(upiId.trim(), businessName.trim())
      setIsEditingUpi(false)
      setQrCodeUrl(generateAdminQRCode(upiId.trim()))
      alert("UPI ID updated successfully! This will be used in all new bills.")
    } catch (err: any) {
      console.error("Error updating UPI:", err)
      alert("Failed to update UPI ID. Please try again.")
    }
  }

  // Business Information state and update

  const handleUpiChange = (value: string) => {
    setUpiId(value)
    if (value.trim()) {
      setQrCodeUrl(generateAdminQRCode(value.trim()))
    } else {
      setQrCodeUrl("")
    }
  }

  const handleBusinessUpdate = async () => {
    try {
      await api.settings.updateBusiness({
        business_name: businessName.trim() || "STAR TAILORS",
        address: businessInfo.address || "",
        phone: businessInfo.phone || "",
        email: businessInfo.email || "",
      })
      alert("Business information updated for new bills.")
    } catch (err: any) {
      console.error("Error updating business info:", err)
      alert("Failed to update business information. Please try again.")
    }
  }

  const getActivityIcon = (type: RecentActivity["type"]) => {
    switch (type) {
      case "order":
        return <Receipt className="h-4 w-4" />
      case "payment":
        return <IndianRupee className="h-4 w-4" />
      case "job":
        return <Scissors className="h-4 w-4" />
      case "customer":
        return <Users className="h-4 w-4" />
      default:
        return <Bell className="h-4 w-4" />
    }
  }

  const getActivityColor = (status: RecentActivity["status"]) => {
    switch (status) {
      case "success":
        return "text-green-600 bg-green-50"
      case "warning":
        return "text-yellow-600 bg-yellow-50"
      case "error":
        return "text-red-600 bg-red-50"
      default:
        return "text-blue-600 bg-blue-50"
    }
  }

  const getAlertIcon = (type: Alert["type"]) => {
    switch (type) {
      case "overdue":
        return <Clock className="h-4 w-4" />
      case "payment":
        return <IndianRupee className="h-4 w-4" />
      case "job":
        return <Scissors className="h-4 w-4" />
      default:
        return <AlertTriangle className="h-4 w-4" />
    }
  }

  const getAlertColor = (priority: Alert["priority"]) => {
    switch (priority) {
      case "high":
        return "border-red-200 bg-red-50"
      case "medium":
        return "border-yellow-200 bg-yellow-50"
      default:
        return "border-blue-200 bg-blue-50"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "assigned":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "acknowledged":
        return "bg-indigo-100 text-indigo-800 border-indigo-200"
      case "in_progress":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "completed":
        return "bg-green-100 text-green-800 border-green-200"
      case "delivered":
        return "bg-purple-100 text-purple-800 border-purple-200"
      case "pending":
        return "bg-orange-100 text-orange-800 border-orange-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "assigned":
        return <Package className="h-4 w-4" />
      case "acknowledged":
      case "in_progress":
        return <Clock className="h-4 w-4" />
      case "completed":
      case "delivered":
        return <CheckCircle className="h-4 w-4" />
      case "pending":
        return <Package className="h-4 w-4" />
      default:
        return <XCircle className="h-4 w-4" />
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50 pb-20 md:pb-0">
      {loading ? (
        <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-violet-600 mx-auto mb-4" />
            <p className="text-violet-600 font-medium">Loading dashboard...</p>
          </div>
        </div>
      ) : error ? (
        <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50 flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 font-medium mb-4">{error}</p>
            <Button onClick={loadDashboardData} className="bg-gradient-to-r from-violet-500 to-indigo-500">
              Try Again
            </Button>
          </div>
        </div>
      ) : (
        <>
          <header className="bg-white/80 backdrop-blur-md shadow-lg border-b border-violet-100 sticky top-0 z-40">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16">
                <div className="flex items-center">
                  <MobileNav user={user} onLogout={handleLogout} />
                  <div className="flex items-center ml-2 md:ml-0">
                    <Sparkles className="h-6 w-6 text-violet-600 mr-2" />
                    <h1 className="text-xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                      STAR TAILORS
                    </h1>
                  </div>
                  <Badge
                    variant="secondary"
                    className="ml-3 hidden sm:inline-flex bg-violet-100 text-violet-700 border-violet-200"
                  >
                    Admin Panel
                  </Badge>
                </div>
                <div className="flex items-center space-x-2 md:space-x-4">
                  <div className="relative hidden sm:block">
                    <Button variant="outline" size="sm" className="border-violet-200 hover:bg-violet-50 bg-transparent">
                      <Bell className="h-4 w-4" />
                      {alerts.length > 0 && (
                        <Badge
                          variant="destructive"
                          className="absolute -top-2 -right-2 h-5 w-5 p-0 text-xs bg-gradient-to-r from-red-500 to-pink-500"
                        >
                          {alerts.length}
                        </Badge>
                      )}
                    </Button>
                  </div>
                  <span className="text-sm text-violet-700 hidden sm:inline font-medium">
                    Welcome, {user?.username}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLogout}
                    className="hidden md:inline-flex bg-transparent border-violet-200 hover:bg-violet-50 text-violet-700"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </Button>
                </div>
              </div>
            </div>
          </header>

          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8">
            <div className="mb-6 md:mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Dashboard Overview</h2>
              <p className="text-violet-600 text-sm md:text-base font-medium">
                Real-time insights into your tailoring business
              </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 md:space-y-6">
              <div className="overflow-x-auto">
                <TabsList className="grid w-full grid-cols-6 min-w-max md:min-w-0 bg-white/60 backdrop-blur-sm border border-violet-100">
                  <TabsTrigger
                    value="overview"
                    className="text-xs md:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white"
                  >
                    Overview
                  </TabsTrigger>
                  <TabsTrigger
                    value="orders"
                    className="text-xs md:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white"
                  >
                    Orders
                  </TabsTrigger>
                  <TabsTrigger
                    value="analytics"
                    className="text-xs md:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white"
                  >
                    Analytics
                  </TabsTrigger>
                  <TabsTrigger
                    value="activity"
                    className="text-xs md:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white"
                  >
                    Activity
                  </TabsTrigger>
                  <TabsTrigger
                    value="alerts"
                    className="text-xs md:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white"
                  >
                    Alerts
                  </TabsTrigger>
                  <TabsTrigger
                    value="settings"
                    className="text-xs md:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white"
                  >
                    Settings
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="overview" className="space-y-4 md:space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
                  <Card className="bg-white/70 backdrop-blur-sm border-violet-100 hover:shadow-xl hover:shadow-violet-100/50 transition-all duration-300 hover:-translate-y-1">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-xs md:text-sm font-medium text-gray-700">Total Customers</CardTitle>
                      <div className="p-2 bg-gradient-to-br from-violet-500 to-indigo-500 rounded-lg">
                        <Users className="h-3 w-3 md:h-4 md:w-4 text-white" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-lg md:text-2xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                        {stats.totalCustomers}
                      </div>
                      <p className="text-xs text-emerald-600 font-medium">
                        <TrendingUp className="inline h-2 w-2 md:h-3 md:w-3 mr-1" />
                        +12% from last month
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-white/70 backdrop-blur-sm border-violet-100 hover:shadow-xl hover:shadow-violet-100/50 transition-all duration-300 hover:-translate-y-1">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-xs md:text-sm font-medium text-gray-700">Active Orders</CardTitle>
                      <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg">
                        <Receipt className="h-3 w-3 md:h-4 md:w-4 text-white" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-lg md:text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                        {stats.activeOrders}
                      </div>
                      <p className="text-xs text-emerald-600 font-medium">
                        <TrendingUp className="inline h-2 w-2 md:h-3 md:w-3 mr-1" />
                        +5% from yesterday
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-white/70 backdrop-blur-sm border-violet-100 hover:shadow-xl hover:shadow-violet-100/50 transition-all duration-300 hover:-translate-y-1">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-xs md:text-sm font-medium text-gray-700">Monthly Revenue</CardTitle>
                      <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg">
                        <IndianRupee className="h-3 w-3 md:h-4 md:w-4 text-white" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-lg md:text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                        ₹{stats.monthlyRevenue.toLocaleString()}
                      </div>
                      <p className="text-xs text-emerald-600 font-medium">
                        <TrendingUp className="inline h-2 w-2 md:h-3 md:w-3 mr-1" />
                        +18% from last month
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-white/70 backdrop-blur-sm border-violet-100 hover:shadow-xl hover:shadow-violet-100/50 transition-all duration-300 hover:-translate-y-1">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-xs md:text-sm font-medium text-gray-700">Outstanding Amount</CardTitle>
                      <div className="p-2 bg-gradient-to-br from-red-500 to-pink-500 rounded-lg">
                        <AlertTriangle className="h-3 w-3 md:h-4 md:w-4 text-white" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-lg md:text-2xl font-bold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent">
                        ₹{stats.outstandingAmount.toLocaleString()}
                      </div>
                      <p className="text-xs text-emerald-600 font-medium">
                        <TrendingDown className="inline h-2 w-2 md:h-3 md:w-3 mr-1" />
                        -8% from last week
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                  <Card
                    className="bg-white/70 backdrop-blur-sm border-violet-100 hover:shadow-xl hover:shadow-violet-100/50 transition-all duration-300 cursor-pointer hover:-translate-y-1 group"
                    onClick={() => router.push("/admin/customers")}
                  >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-gray-700 group-hover:text-violet-700 transition-colors">
                        Customer Management
                      </CardTitle>
                      <div className="p-2 bg-gradient-to-br from-violet-500 to-indigo-500 rounded-lg group-hover:scale-110 transition-transform">
                        <Users className="h-4 w-4 text-white" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xl md:text-2xl font-bold mb-1 bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                        {stats.totalCustomers}
                      </div>
                      <p className="text-xs text-gray-600">Manage customer records</p>
                    </CardContent>
                  </Card>

                  <Card
                    className="bg-white/70 backdrop-blur-sm border-violet-100 hover:shadow-xl hover:shadow-violet-100/50 transition-all duration-300 cursor-pointer hover:-translate-y-1 group"
                    onClick={() => router.push("/admin/billing")}
                  >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-gray-700 group-hover:text-violet-700 transition-colors">
                        Billing System
                      </CardTitle>
                      <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg group-hover:scale-110 transition-transform">
                        <Receipt className="h-4 w-4 text-white" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xl md:text-2xl font-bold mb-1 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                        {stats.activeOrders}
                      </div>
                      <p className="text-xs text-gray-600">Create bills with QR codes</p>
                    </CardContent>
                  </Card>

                  <Card
                    className="bg-white/70 backdrop-blur-sm border-violet-100 hover:shadow-xl hover:shadow-violet-100/50 transition-all duration-300 cursor-pointer hover:-translate-y-1 group"
                    onClick={() => router.push("/admin/tailors")}
                  >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-gray-700 group-hover:text-violet-700 transition-colors">
                        Tailor Management
                      </CardTitle>
                      <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg group-hover:scale-110 transition-transform">
                        <Scissors className="h-4 w-4 text-white" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xl md:text-2xl font-bold mb-1 bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                        {stats.activeTailors}
                      </div>
                      <p className="text-xs text-gray-600">Manage tailors and jobs</p>
                    </CardContent>
                  </Card>

                  <Card
                    className="bg-white/70 backdrop-blur-sm border-violet-100 hover:shadow-xl hover:shadow-violet-100/50 transition-all duration-300 cursor-pointer hover:-translate-y-1 group"
                    onClick={() => router.push("/admin/reports")}
                  >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-gray-700 group-hover:text-violet-700 transition-colors">
                        Reports & Analytics
                      </CardTitle>
                      <div className="p-2 bg-gradient-to-br from-violet-500 to-indigo-500 rounded-lg group-hover:scale-110 transition-transform">
                        <BarChart3 className="h-4 w-4 text-white" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xl md:text-2xl font-bold mb-1 bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                        ₹{stats.totalRevenue.toLocaleString()}
                      </div>
                      <p className="text-xs text-gray-600">Business insights</p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="orders" className="space-y-6">
                {/* Orders Header with Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="bg-white/70 backdrop-blur-sm border-violet-100">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">Total Orders</p>
                          <p className="text-2xl font-bold text-gray-900">{orders.length}</p>
                        </div>
                        <Receipt className="h-8 w-8 text-violet-600" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white/70 backdrop-blur-sm border-violet-100">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">Pending</p>
                          <p className="text-2xl font-bold text-yellow-600">
                            {
                              orders.filter((o) => (o.jobStatus ?? "pending") === "pending" || o.jobStatus === "assigned").length
                            }
                          </p>
                        </div>
                        <Package className="h-8 w-8 text-yellow-600" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white/70 backdrop-blur-sm border-violet-100">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">In Progress</p>
                          <p className="text-2xl font-bold text-blue-600">
                            {orders.filter((o) => o.jobStatus === "in_progress" || o.jobStatus === "acknowledged").length}
                          </p>
                        </div>
                        <Clock className="h-8 w-8 text-blue-600" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white/70 backdrop-blur-sm border-violet-100">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">Completed</p>
                          <p className="text-2xl font-bold text-green-600">
                            {orders.filter((o) => o.jobStatus === "completed" || o.jobStatus === "delivered").length}
                          </p>
                        </div>
                        <CheckCircle className="h-8 w-8 text-green-600" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Orders Filters and Search */}
                <Card className="bg-white/70 backdrop-blur-sm border-violet-100">
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="flex-1">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                          <Input
                            placeholder="Search orders by customer name, order ID, or item type..."
                            value={orderSearchTerm}
                            onChange={(e) => setOrderSearchTerm(e.target.value)}
                            className="pl-10 bg-white/80 border-violet-200 focus:border-violet-500"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Select value={orderStatusFilter} onValueChange={setOrderStatusFilter}>
                          <SelectTrigger className="w-40 bg-white/80 border-violet-200">
                            <Filter className="h-4 w-4 mr-2" />
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="pending">Pending (no job)</SelectItem>
                            <SelectItem value="assigned">Assigned</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="delivered">Delivered</SelectItem>
                          </SelectContent>
                        </Select>

                        <Select value={orderSortBy} onValueChange={setOrderSortBy}>
                          <SelectTrigger className="w-40 bg-white/80 border-violet-200">
                            <SelectValue placeholder="Sort by" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="newest">Newest First</SelectItem>
                            <SelectItem value="oldest">Oldest First</SelectItem>
                            <SelectItem value="amount-high">Amount: High to Low</SelectItem>
                            <SelectItem value="amount-low">Amount: Low to High</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Orders List */}
                <div className="space-y-4">
                  {filteredOrders.length === 0 ? (
                    <Card className="bg-white/70 backdrop-blur-sm border-violet-100">
                      <CardContent className="p-12 text-center">
                        <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No orders found</h3>
                        <p className="text-gray-600">
                          {orderSearchTerm || orderStatusFilter !== "all"
                            ? "Try adjusting your search or filters"
                            : "No orders have been created yet"}
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    filteredOrders.map((order) => (
                      <Card
                        key={order._id}
                        className="bg-white/70 backdrop-blur-sm border-violet-100 hover:shadow-lg transition-all duration-300"
                      >
                        <CardContent className="p-6">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="font-semibold text-gray-900">{order.customerName}</h3>
                                <Badge className={`${getStatusColor(order.jobStatus || "pending")} border`}>
                                  {getStatusIcon(order.jobStatus || "pending")}
                                  <span className="ml-1 capitalize">{(order.jobStatus || "pending").replace("_", " ")}</span>
                                </Badge>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                                <div className="flex items-center gap-2">
                                  <Receipt className="h-4 w-4" />
                                  <span>Order ID: {order._id.slice(-8)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4" />
                                  <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <IndianRupee className="h-4 w-4" />
                                  <span className="font-medium">₹{order.totalAmount?.toLocaleString()}</span>
                                </div>
                              </div>

                              <div className="mt-3">
                                <p className="text-sm text-gray-700">
                                  <strong>Items:</strong>{" "}
                                  {order.items?.map((item) => `${item.quantity}x ${item.itemType}`).join(", ")}
                                </p>
                                {order.notes && (
                                  <p className="text-sm text-gray-600 mt-1">
                                    <strong>Notes:</strong> {order.notes}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-col md:flex-row gap-2">
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>

                {/* Order Details Modal */}
                {showOrderDetails && selectedOrder && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
                      <CardHeader className="border-b">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-xl">Order Details</CardTitle>
                            <CardDescription>Order ID: {selectedOrder._id}</CardDescription>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => setShowOrderDetails(false)}>
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>

                      <CardContent className="p-6 space-y-6">
                        {/* Customer Information */}
                        <div>
                          <h3 className="font-semibold text-gray-900 mb-3">Customer Information</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-gray-500" />
                              <span>{selectedOrder.customerName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={`${getStatusColor(selectedOrder.status)} border`}>
                                {getStatusIcon(selectedOrder.status)}
                                <span className="ml-1 capitalize">{selectedOrder.status.replace("_", " ")}</span>
                              </Badge>
                            </div>
                          </div>
                        </div>

                        {/* Order Items */}
                        <div>
                          <h3 className="font-semibold text-gray-900 mb-3">Order Items</h3>
                          <div className="space-y-2">
                            {selectedOrder.items?.map((item, index) => (
                              <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                <div>
                                  <span className="font-medium">{item.itemType}</span>
                                  <span className="text-gray-600 ml-2">x{item.quantity}</span>
                                </div>
                                <div className="text-right">
                                  <div className="font-medium">₹{item.amount?.toLocaleString()}</div>
                                  <div className="text-sm text-gray-600">₹{item.rate} each</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Payment Summary */}
                        <div>
                          <h3 className="font-semibold text-gray-900 mb-3">Payment Summary</h3>
                          <div className="space-y-2 p-4 bg-gray-50 rounded-lg">
                            <div className="flex justify-between">
                              <span>Subtotal:</span>
                              <span>₹{selectedOrder.subtotal?.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Discount:</span>
                              <span>-₹{selectedOrder.discount?.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Advance Paid:</span>
                              <span>₹{selectedOrder.advanceAmount?.toLocaleString()}</span>
                            </div>
                            <div className="border-t pt-2 flex justify-between font-semibold">
                              <span>Total Amount:</span>
                              <span>₹{selectedOrder.totalAmount?.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-red-600">
                              <span>Outstanding:</span>
                              <span>
                                ₹
                                {(
                                  (selectedOrder.totalAmount || 0) - (selectedOrder.advanceAmount || 0)
                                ).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Order Notes */}
                        {selectedOrder.notes && (
                          <div>
                            <h3 className="font-semibold text-gray-900 mb-3">Notes</h3>
                            <p className="text-gray-700 p-3 bg-gray-50 rounded-lg">{selectedOrder.notes}</p>
                          </div>
                        )}

                        {/* Order Timeline */}
                        <div>
                          <h3 className="font-semibold text-gray-900 mb-3">Order Timeline</h3>
                          <div className="text-sm text-gray-600">
                            <div className="flex items-center gap-2 mb-2">
                              <Calendar className="h-4 w-4" />
                              <span>Created: {new Date(selectedOrder.createdAt).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="analytics" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Order Status Distribution */}
                  <Card className="bg-white/70 backdrop-blur-sm border-violet-100 hover:shadow-xl hover:shadow-violet-100/50 transition-all duration-300 hover:-translate-y-1">
                    <CardHeader>
                      <CardTitle className="text-gray-700">Order Status Distribution</CardTitle>
                      <CardDescription className="text-violet-600">Current status of all orders</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-700">Completed</span>
                          <span className="text-sm font-medium text-gray-700">{stats.completedOrders}</span>
                        </div>
                        <Progress value={75} className="h-2 bg-violet-200" />

                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-700">In Progress</span>
                          <span className="text-sm font-medium text-gray-700">{stats.activeOrders}</span>
                        </div>
                        <Progress value={60} className="h-2 bg-violet-200" />

                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-700">Pending</span>
                          <span className="text-sm font-medium text-gray-700">{stats.pendingJobs}</span>
                        </div>
                        <Progress value={30} className="h-2 bg-violet-200" />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Tailor Performance */}
                  <Card className="bg-white/70 backdrop-blur-sm border-violet-100 hover:shadow-xl hover:shadow-violet-100/50 transition-all duration-300 hover:-translate-y-1">
                    <CardHeader>
                      <CardTitle className="text-gray-700">Tailor Performance</CardTitle>
                      <CardDescription className="text-violet-600">Top performing tailors this month</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-medium text-gray-700">Sunita Sharma</div>
                            <div className="text-sm text-gray-500">23 jobs completed</div>
                          </div>
                          <Badge variant="secondary" className="bg-violet-100 text-violet-700 border-violet-200">
                            ★ 4.9
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-medium text-gray-700">Ramesh Patil</div>
                            <div className="text-sm text-gray-500">19 jobs completed</div>
                          </div>
                          <Badge variant="secondary" className="bg-violet-100 text-violet-700 border-violet-200">
                            ★ 4.8
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-medium text-gray-700">Vijay Kumar</div>
                            <div className="text-sm text-gray-500">15 jobs completed</div>
                          </div>
                          <Badge variant="secondary" className="bg-violet-100 text-violet-700 border-violet-200">
                            ★ 4.6
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Revenue Trends */}
                  <Card className="bg-white/70 backdrop-blur-sm border-violet-100 hover:shadow-xl hover:shadow-violet-100/50 transition-all duration-300 hover:-translate-y-1">
                    <CardHeader>
                      <CardTitle className="text-gray-700">Revenue Trends</CardTitle>
                      <CardDescription className="text-violet-600">Monthly revenue comparison</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-700">December 2024</span>
                          <span className="text-sm font-medium text-gray-700">₹45,000</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-700">November 2024</span>
                          <span className="text-sm font-medium text-gray-700">₹38,200</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-700">October 2024</span>
                          <span className="text-sm font-medium text-gray-700">₹42,800</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-700">September 2024</span>
                          <span className="text-sm font-medium text-gray-700">₹39,500</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Customer Insights */}
                  <Card className="bg-white/70 backdrop-blur-sm border-violet-100 hover:shadow-xl hover:shadow-violet-100/50 transition-all duration-300 hover:-translate-y-1">
                    <CardHeader>
                      <CardTitle className="text-gray-700">Customer Insights</CardTitle>
                      <CardDescription className="text-violet-600">Customer behavior analysis</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-700">New Customers</span>
                          <span className="text-sm font-medium text-green-600">+15 this month</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-700">Repeat Customers</span>
                          <span className="text-sm font-medium text-gray-700">78%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-700">Average Order Value</span>
                          <span className="text-sm font-medium text-gray-700">₹1,850</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-700">Customer Satisfaction</span>
                          <span className="text-sm font-medium text-gray-700">4.7/5</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="activity" className="space-y-6">
                <Card className="bg-white/70 backdrop-blur-sm border-violet-100 hover:shadow-xl hover:shadow-violet-100/50 transition-all duration-300 hover:-translate-y-1">
                  <CardHeader>
                    <CardTitle className="text-gray-700">Recent Activity</CardTitle>
                    <CardDescription className="text-violet-600">Live updates from your business</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {recentActivity.map((activity) => (
                        <div key={activity.id} className="flex items-start space-x-3">
                          <div className={`p-2 rounded-full ${getActivityColor(activity.status)}`}>
                            {getActivityIcon(activity.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">{activity.message}</p>
                            <p className="text-xs text-gray-500">{activity.timestamp}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="alerts" className="space-y-6">
                <div className="space-y-4">
                  {alerts.map((alert) => (
                    <Card
                      key={alert.id}
                      className={`border-l-4 ${getAlertColor(alert.priority)} bg-white/70 backdrop-blur-sm`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0">{getAlertIcon(alert.type)}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-medium text-gray-900">{alert.title}</h4>
                              <Badge
                                variant={alert.priority === "high" ? "destructive" : "secondary"}
                                className="bg-violet-100 text-violet-700 border-violet-200"
                              >
                                {alert.priority}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                            <p className="text-xs text-gray-500 mt-2">{alert.timestamp}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="settings" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="bg-white/70 backdrop-blur-sm border-violet-100 hover:shadow-xl hover:shadow-violet-100/50 transition-all duration-300">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-gray-800">
                        <div className="p-2 bg-gradient-to-br from-violet-500 to-indigo-500 rounded-lg">
                          <IndianRupee className="h-5 w-5 text-white" />
                        </div>
                        UPI Payment Settings
                      </CardTitle>
                      <CardDescription className="text-violet-600">
                        Manage your UPI ID for QR code generation in bills
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Current UPI ID</label>
                        {isEditingUpi ? (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={upiId}
                              onChange={(e) => handleUpiChange(e.target.value)}
                              className="flex-1 px-3 py-2 border border-violet-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-white/80 backdrop-blur-sm"
                              placeholder="Enter UPI ID (e.g., yourname@paytm)"
                            />
                            <Button
                              onClick={handleUpiUpdate}
                              size="sm"
                              className="bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600"
                            >
                              Save
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setIsEditingUpi(false)}
                              className="border-violet-200 hover:bg-violet-50"
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between p-3 bg-gradient-to-r from-violet-50 to-indigo-50 rounded-lg border border-violet-100">
                            <span className="font-mono text-sm text-violet-700">{upiId}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setIsEditingUpi(true)}
                              className="border-violet-200 hover:bg-violet-50"
                            >
                              <Settings className="h-4 w-4 mr-2" />
                              Edit
                            </Button>
                          </div>
                        )}
                      </div>

                      {qrCodeUrl && (
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700">QR Code Preview</label>
                          <div className="flex flex-col items-center p-6 bg-gradient-to-br from-white to-violet-50 border-2 border-dashed border-violet-300 rounded-xl">
                            <div className="p-3 bg-white rounded-lg shadow-lg">
                              <img
                                src={qrCodeUrl || "/placeholder.svg"}
                                alt="UPI QR Code Preview"
                                className="w-32 h-32"
                              />
                            </div>
                            <p className="text-xs text-violet-600 text-center mt-3 font-medium">
                              Sample QR code for ₹100
                              <br />
                              This is how it will appear in bills
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="p-4 bg-blue-50 rounded-lg">
                        <h4 className="font-medium text-blue-900 mb-2">How it works:</h4>
                        <ul className="text-sm text-blue-800 space-y-1">
                          <li>• This UPI ID will be used in all generated bills</li>
                          <li>• QR codes will automatically include the bill amount</li>
                          <li>• Customers can scan and pay instantly</li>
                          <li>• Changes apply to all new bills immediately</li>
                        </ul>
                      </div>

                      <div className="p-4 bg-green-50 rounded-lg">
                        <h4 className="font-medium text-green-900 mb-2">Current Status:</h4>
                        <div className="flex items-center gap-2 text-sm text-green-800">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          UPI payments are active and ready
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Business Information */}
                  <Card className="bg-white/70 backdrop-blur-sm border-violet-100 hover:shadow-xl hover:shadow-violet-100/50 transition-all duration-300">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-gray-800">
                        <div className="p-2 bg-gradient-to-br from-violet-500 to-indigo-500 rounded-lg">
                          <Settings className="h-5 w-5 text-white" />
                        </div>
                        Business Information
                      </CardTitle>
                      <CardDescription className="text-violet-600">
                        Update your business details for bills and receipts
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                    <div className="space-y-3">
                        <div>
                          <label className="text-sm font-medium text-gray-700">Business Name</label>
                          <input
                            type="text"
                            value={businessName}
                            onChange={(e) => setBusinessName(e.target.value)}
                            className="w-full mt-1 px-3 py-2 border border-violet-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-white/80 backdrop-blur-sm"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-700">Address</label>
                          <textarea
                            value={(businessInfo.address ?? "") as string}
                            onChange={(e) => setBusinessInfo((prev: any) => ({ ...prev, address: e.target.value }))}
                            className="w-full mt-1 px-3 py-2 border border-violet-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-white/80 backdrop-blur-sm"
                            rows={3}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-700">Phone Number</label>
                          <input
                            type="tel"
                            value={(businessInfo.phone ?? "") as string}
                            onChange={(e) => setBusinessInfo((prev: any) => ({ ...prev, phone: e.target.value }))}
                            className="w-full mt-1 px-3 py-2 border border-violet-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-white/80 backdrop-blur-sm"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-700">Email</label>
                          <input
                            type="email"
                            value={(businessInfo.email ?? "") as string}
                            onChange={(e) => setBusinessInfo((prev: any) => ({ ...prev, email: e.target.value }))}
                            className="w-full mt-1 px-3 py-2 border border-violet-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-white/80 backdrop-blur-sm"
                          />
                        </div>
                      </div>

                      <Button onClick={handleBusinessUpdate} className="w-full bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white">
                        Update Business Information
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </main>

          <BottomNav userRole={user?.role} />
        </>
      )}
    </div>
  )
}
