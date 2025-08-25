"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar, Download, FileText, TrendingUp, Users, Scissors, AlertTriangle, IndianRupee } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api"

interface RevenueData {
  date: string
  amount: number
  bills_count: number
}

interface CustomerReport {
  customer_id: string
  name: string
  phone: string
  total_orders: number
  total_spent: number
  outstanding_amount: number
  last_order_date: string
}

interface TailorReport {
  tailor_id: string
  name: string
  phone: string
  total_jobs: number
  completed_jobs: number
  pending_jobs: number
  completion_rate: number
  avg_completion_time: number
}

interface OutstandingReport {
  customer_id: string
  customer_name: string
  phone: string
  outstanding_amount: number
  overdue_days: number
  last_payment_date: string
}

export function ReportsModule() {
  const [dateRange, setDateRange] = useState({ from: "", to: "" })
  const [reportType, setReportType] = useState("revenue")
  const [revenueData, setRevenueData] = useState<RevenueData[]>([])
  const [customerReports, setCustomerReports] = useState<CustomerReport[]>([])
  const [tailorReports, setTailorReports] = useState<TailorReport[]>([])
  const [outstandingReports, setOutstandingReports] = useState<OutstandingReport[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    // Set default date range (last 30 days)
    const today = new Date()
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
    setDateRange({
      from: thirtyDaysAgo.toISOString().split("T")[0],
      to: today.toISOString().split("T")[0],
    })

    loadReportsData()
  }, [])

  const loadReportsData = async () => {
    setIsLoading(true)
    try {
      // Load all report data in parallel
      const [revenueResponse, customerResponse, tailorResponse, outstandingResponse] = await Promise.all([
        api.reports.getRevenue({ from_date: dateRange.from, to_date: dateRange.to }),
        api.reports.getCustomers(),
        api.reports.getTailors(),
        api.reports.getOutstanding(),
      ])

      setRevenueData(revenueResponse.revenue_data || [])
      setCustomerReports(customerResponse.customer_reports || [])
      setTailorReports(tailorResponse.tailor_reports || [])
      setOutstandingReports(outstandingResponse.outstanding_reports || [])
    } catch (error) {
      console.error("Error loading reports data:", error)
      toast.error("Failed to load reports data")
    } finally {
      setIsLoading(false)
    }
  }

  const generateReport = async () => {
    setIsLoading(true)
    try {
      await loadReportsData()
      toast.success("Report has been generated successfully.")
    } catch (error) {
      toast.error("Failed to generate report")
    } finally {
      setIsLoading(false)
    }
  }

  const exportToPDF = async () => {
    try {
      await api.reports.export(reportType, "pdf")
      toast.success("PDF export is being prepared...")
    } catch (error) {
      toast.error("Failed to export PDF")
    }
  }

  const exportToCSV = async () => {
    try {
      await api.reports.export(reportType, "csv")
      toast.success("CSV export is being prepared...")
    } catch (error) {
      toast.error("Failed to export CSV")
    }
  }

  const getTotalRevenue = () => {
    return revenueData.reduce((sum, item) => sum + item.amount, 0)
  }

  const getTotalBills = () => {
    return revenueData.reduce((sum, item) => sum + item.bills_count, 0)
  }

  const getAverageOrderValue = () => {
    const totalRevenue = getTotalRevenue()
    const totalBills = getTotalBills()
    return totalBills > 0 ? totalRevenue / totalBills : 0
  }

  const filteredCustomers = customerReports.filter(
    (customer) => customer.name.toLowerCase().includes(searchTerm.toLowerCase()) || customer.phone.includes(searchTerm),
  )

  const filteredTailors = tailorReports.filter(
    (tailor) => tailor.name.toLowerCase().includes(searchTerm.toLowerCase()) || tailor.phone.includes(searchTerm),
  )

  const filteredOutstanding = outstandingReports.filter(
    (report) =>
      report.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) || report.phone.includes(searchTerm),
  )

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading reports...</p>
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
              Reports & Analytics
            </h1>
            <p className="text-gray-600 mt-2">Comprehensive business insights and performance metrics</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={generateReport} disabled={isLoading} className="bg-violet-600 hover:bg-violet-700">
              <TrendingUp className="w-4 h-4 mr-2" />
              Generate Report
            </Button>
            <Button
              onClick={exportToPDF}
              variant="outline"
              className="border-violet-200 hover:bg-violet-50 bg-transparent"
            >
              <FileText className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
            <Button
              onClick={exportToCSV}
              variant="outline"
              className="border-violet-200 hover:bg-violet-50 bg-transparent"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Date Range Filter */}
        <Card className="border-violet-100 shadow-lg backdrop-blur-sm bg-white/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-violet-800">
              <Calendar className="w-5 h-5" />
              Date Range Filter
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
                <Input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => setDateRange((prev) => ({ ...prev, from: e.target.value }))}
                  className="border-violet-200 focus:border-violet-400"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
                <Input
                  type="date"
                  value={dateRange.to}
                  onChange={(e) => setDateRange((prev) => ({ ...prev, to: e.target.value }))}
                  className="border-violet-200 focus:border-violet-400"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Report Type</label>
                <Select value={reportType} onValueChange={setReportType}>
                  <SelectTrigger className="border-violet-200 focus:border-violet-400">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="revenue">Revenue Analysis</SelectItem>
                    <SelectItem value="customers">Customer Reports</SelectItem>
                    <SelectItem value="tailors">Tailor Performance</SelectItem>
                    <SelectItem value="outstanding">Outstanding Balances</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={loadReportsData} className="bg-violet-600 hover:bg-violet-700">
                Apply Filter
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-violet-100 shadow-lg backdrop-blur-sm bg-white/80 hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-violet-600">₹{getTotalRevenue().toLocaleString()}</p>
                </div>
                <div className="p-3 bg-violet-100 rounded-full">
                  <IndianRupee className="w-6 h-6 text-violet-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-violet-100 shadow-lg backdrop-blur-sm bg-white/80 hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Bills</p>
                  <p className="text-2xl font-bold text-indigo-600">{getTotalBills()}</p>
                </div>
                <div className="p-3 bg-indigo-100 rounded-full">
                  <FileText className="w-6 h-6 text-indigo-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-violet-100 shadow-lg backdrop-blur-sm bg-white/80 hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Order Value</p>
                  <p className="text-2xl font-bold text-emerald-600">₹{getAverageOrderValue().toFixed(0)}</p>
                </div>
                <div className="p-3 bg-emerald-100 rounded-full">
                  <TrendingUp className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-violet-100 shadow-lg backdrop-blur-sm bg-white/80 hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Outstanding</p>
                  <p className="text-2xl font-bold text-red-600">
                    ₹{outstandingReports.reduce((sum, item) => sum + item.outstanding_amount, 0).toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-red-100 rounded-full">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Reports Tabs */}
        <Tabs value={reportType} onValueChange={setReportType} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-violet-100">
            <TabsTrigger value="revenue" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white">
              Revenue
            </TabsTrigger>
            <TabsTrigger value="customers" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white">
              Customers
            </TabsTrigger>
            <TabsTrigger value="tailors" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white">
              Tailors
            </TabsTrigger>
            <TabsTrigger
              value="outstanding"
              className="data-[state=active]:bg-violet-600 data-[state=active]:text-white"
            >
              Outstanding
            </TabsTrigger>
          </TabsList>

          <TabsContent value="revenue" className="space-y-6">
            <Card className="border-violet-100 shadow-lg backdrop-blur-sm bg-white/80">
              <CardHeader>
                <CardTitle className="text-violet-800">Revenue Analysis</CardTitle>
                <CardDescription>Daily revenue breakdown for the selected period</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {revenueData.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-violet-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{new Date(item.date).toLocaleDateString()}</p>
                        <p className="text-sm text-gray-600">{item.bills_count} bills</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-violet-600">₹{item.amount.toLocaleString()}</p>
                        <Progress
                          value={(item.amount / Math.max(...revenueData.map((d) => d.amount))) * 100}
                          className="w-20 mt-1"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="customers" className="space-y-6">
            <Card className="border-violet-100 shadow-lg backdrop-blur-sm bg-white/80">
              <CardHeader>
                <CardTitle className="text-violet-800">Customer Reports</CardTitle>
                <CardDescription>Customer spending and order analysis</CardDescription>
                <div className="flex gap-4">
                  <Input
                    placeholder="Search customers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-sm border-violet-200 focus:border-violet-400"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredCustomers.map((customer, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-violet-50 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-violet-100 rounded-full">
                            <Users className="w-4 h-4 text-violet-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{customer.name}</p>
                            <p className="text-sm text-gray-600">{customer.phone}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-6 text-right">
                        <div>
                          <p className="text-sm text-gray-600">Orders</p>
                          <p className="font-bold text-indigo-600">{customer.total_orders}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Total Spent</p>
                          <p className="font-bold text-emerald-600">₹{customer.total_spent.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Outstanding</p>
                          <p className="font-bold text-red-600">₹{customer.outstanding_amount.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tailors" className="space-y-6">
            <Card className="border-violet-100 shadow-lg backdrop-blur-sm bg-white/80">
              <CardHeader>
                <CardTitle className="text-violet-800">Tailor Performance</CardTitle>
                <CardDescription>Tailor productivity and completion metrics</CardDescription>
                <div className="flex gap-4">
                  <Input
                    placeholder="Search tailors..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-sm border-violet-200 focus:border-violet-400"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredTailors.map((tailor, index) => (
                    <div key={index} className="p-4 bg-violet-50 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-violet-100 rounded-full">
                            <Scissors className="w-4 h-4 text-violet-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{tailor.name}</p>
                            <p className="text-sm text-gray-600">{tailor.phone}</p>
                          </div>
                        </div>
                        <Badge variant={tailor.completion_rate >= 80 ? "default" : "secondary"}>
                          {tailor.completion_rate.toFixed(1)}% completion
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-sm text-gray-600">Total Jobs</p>
                          <p className="font-bold text-indigo-600">{tailor.total_jobs}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Completed</p>
                          <p className="font-bold text-emerald-600">{tailor.completed_jobs}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Pending</p>
                          <p className="font-bold text-orange-600">{tailor.pending_jobs}</p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <Progress value={tailor.completion_rate} className="h-2" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="outstanding" className="space-y-6">
            <Card className="border-violet-100 shadow-lg backdrop-blur-sm bg-white/80">
              <CardHeader>
                <CardTitle className="text-violet-800">Outstanding Balances</CardTitle>
                <CardDescription>Customers with pending payments</CardDescription>
                <div className="flex gap-4">
                  <Input
                    placeholder="Search customers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-sm border-violet-200 focus:border-violet-400"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredOutstanding.map((report, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-100"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 rounded-full">
                          <AlertTriangle className="w-4 h-4 text-red-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{report.customer_name}</p>
                          <p className="text-sm text-gray-600">{report.phone}</p>
                        </div>
                      </div>
                      <div className="flex gap-6 text-right">
                        <div>
                          <p className="text-sm text-gray-600">Outstanding</p>
                          <p className="font-bold text-red-600">₹{report.outstanding_amount.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Overdue Days</p>
                          <p className="font-bold text-orange-600">{report.overdue_days}</p>
                        </div>
                        <div>
                          <Badge variant={report.overdue_days > 30 ? "destructive" : "secondary"}>
                            {report.overdue_days > 30 ? "Critical" : "Pending"}
                          </Badge>
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
