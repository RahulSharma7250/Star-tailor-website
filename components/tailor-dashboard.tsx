"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { api } from "@/lib/api"
import {
  LogOut,
  CheckCircle,
  Clock,
  AlertCircle,
  Phone,
  Calendar,
  Sparkles,
  Scissors,
  Loader2,
  AlertTriangle,
} from "lucide-react"

interface Job {
  _id: string
  billId: string
  tailorId: string
  customerName: string
  customerPhone: string
  itemType: string
  description: string
  measurements: { [key: string]: string }
  specialInstructions: string
  designImages: string[]
  dueDate: string
  status: "assigned" | "acknowledged" | "in_progress" | "completed"
  createdAt: string
  acknowledgedAt?: string
  completedAt?: string
  priority: "low" | "medium" | "high"
}

export function TailorDashboard() {
  const [user, setUser] = useState<any>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    const userData = localStorage.getItem("user")
    if (userData) {
      const parsedUser = JSON.parse(userData)
      setUser(parsedUser)
      loadTailorJobs(parsedUser.id)
    }
  }, [])

  const loadTailorJobs = async (tailorId: string) => {
    try {
      setLoading(true)
      setError("")

      const response = await api.tailors.getJobs(tailorId)
      setJobs(response.jobs || [])
    } catch (err: any) {
      console.error("Error loading tailor jobs:", err)
      setError(err.message || "Failed to load jobs")
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("user")
    localStorage.removeItem("token")
    router.push("/")
  }

  const updateJobStatus = async (jobId: string, status: Job["status"]) => {
    try {
      await api.jobs.updateStatus(jobId, status)

      setJobs(
        jobs.map((job) => {
          if (job._id === jobId) {
            const updatedJob = { ...job, status }
            if (status === "acknowledged") {
              updatedJob.acknowledgedAt = new Date().toISOString()
            } else if (status === "completed") {
              updatedJob.completedAt = new Date().toISOString()
            }
            return updatedJob
          }
          return job
        }),
      )

      toast({
        title: "Status Updated",
        description: `Job status updated to ${status.replace("_", " ")}`,
      })
    } catch (err: any) {
      console.error("Error updating job status:", err)
      toast({
        title: "Error",
        description: "Failed to update job status. Please try again.",
        variant: "destructive",
      })
    }
  }

  const getStatusColor = (status: Job["status"]) => {
    switch (status) {
      case "assigned":
        return "bg-yellow-100 text-yellow-800"
      case "acknowledged":
        return "bg-blue-100 text-blue-800"
      case "in_progress":
        return "bg-orange-100 text-orange-800"
      case "completed":
        return "bg-green-100 text-green-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getPriorityColor = (priority: Job["priority"]) => {
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

  const activeJobs = jobs.filter((job) => job.status !== "completed")
  const completedJobs = jobs.filter((job) => job.status === "completed")

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600 mx-auto mb-4" />
          <p className="text-violet-600 font-medium">Loading your jobs...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 font-medium mb-4">{error}</p>
          <Button
            onClick={() => user && loadTailorJobs(user.id)}
            className="bg-gradient-to-r from-violet-500 to-indigo-500"
          >
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50">
      <header className="bg-white/80 backdrop-blur-md shadow-lg border-b border-violet-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex items-center">
                <Sparkles className="h-6 w-6 text-violet-600 mr-2" />
                <h1 className="text-xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                  STAR TAILORS
                </h1>
              </div>
              <Badge variant="secondary" className="ml-3 bg-violet-100 text-violet-700 border-violet-200">
                Tailor Panel
              </Badge>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-violet-700 font-medium">Welcome, {user?.username}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="border-violet-200 hover:bg-violet-50 text-violet-700 bg-transparent"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white/70 backdrop-blur-sm border-violet-100 hover:shadow-xl hover:shadow-violet-100/50 transition-all duration-300 hover:-translate-y-1">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                    {activeJobs.length}
                  </div>
                  <p className="text-sm text-violet-600 font-medium">Active Jobs</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-violet-500 to-indigo-500 rounded-lg">
                  <Scissors className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur-sm border-violet-100 hover:shadow-xl hover:shadow-violet-100/50 transition-all duration-300 hover:-translate-y-1">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                    {jobs.filter((j) => j.status === "assigned").length}
                  </div>
                  <p className="text-sm text-amber-600 font-medium">New Assignments</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg">
                  <AlertCircle className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur-sm border-violet-100 hover:shadow-xl hover:shadow-violet-100/50 transition-all duration-300 hover:-translate-y-1">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                    {jobs.filter((j) => j.status === "in_progress").length}
                  </div>
                  <p className="text-sm text-blue-600 font-medium">In Progress</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg">
                  <Clock className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur-sm border-violet-100 hover:shadow-xl hover:shadow-violet-100/50 transition-all duration-300 hover:-translate-y-1">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                    {completedJobs.length}
                  </div>
                  <p className="text-sm text-emerald-600 font-medium">Completed</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg">
                  <CheckCircle className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-8 bg-white/70 backdrop-blur-sm border-violet-100 hover:shadow-xl hover:shadow-violet-100/50 transition-all duration-300">
          <CardHeader>
            <CardTitle className="text-gray-800 flex items-center gap-2">
              <Scissors className="h-5 w-5 text-violet-600" />
              My Active Jobs
            </CardTitle>
            <CardDescription className="text-violet-600">Jobs assigned to you that need attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeJobs.map((job) => (
                <div
                  key={job._id}
                  className="p-6 border border-violet-100 rounded-xl bg-gradient-to-r from-white to-violet-50/50 hover:shadow-lg transition-all duration-300"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-bold text-gray-800">{job._id}</div>
                      <div className="text-sm text-violet-600 font-medium">
                        {job.customerName} • {job.itemType}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Badge className={`${getPriorityColor(job.priority)} font-medium`}>{job.priority}</Badge>
                      <Badge className={`${getStatusColor(job.status)} font-medium`}>
                        {job.status.replace("_", " ")}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <div className="text-sm">
                        <strong>Description:</strong> {job.description}
                      </div>
                      <div className="text-sm flex items-center mt-1">
                        <Phone className="h-3 w-3 mr-1" />
                        {job.customerPhone}
                      </div>
                      <div className="text-sm flex items-center mt-1">
                        <Calendar className="h-3 w-3 mr-1" />
                        Due: {new Date(job.dueDate).toLocaleDateString()}
                      </div>
                    </div>
                    <div>
                      {job.specialInstructions && (
                        <div className="text-sm">
                          <strong>Special Instructions:</strong>
                          <div className="bg-yellow-50 p-2 rounded mt-1 text-xs">{job.specialInstructions}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {Object.keys(job.measurements).length > 0 && (
                    <div className="mb-4">
                      <div className="text-sm font-medium mb-2">Measurements:</div>
                      <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                        {Object.entries(job.measurements).map(([key, value]) => (
                          <div key={key} className="bg-blue-50 p-2 rounded text-center">
                            <div className="text-xs font-medium">{key}</div>
                            <div className="text-sm">{value}"</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <div className="text-xs text-violet-600 font-medium">
                      Assigned: {new Date(job.createdAt).toLocaleDateString()}
                      {job.acknowledgedAt && (
                        <span> • Acknowledged: {new Date(job.acknowledgedAt).toLocaleDateString()}</span>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      {job.status === "assigned" && (
                        <Button
                          size="sm"
                          onClick={() => updateJobStatus(job._id, "acknowledged")}
                          className="bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600"
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Acknowledge
                        </Button>
                      )}
                      {job.status === "acknowledged" && (
                        <Button
                          size="sm"
                          onClick={() => updateJobStatus(job._id, "in_progress")}
                          className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
                        >
                          <Clock className="h-3 w-3 mr-1" />
                          Start Work
                        </Button>
                      )}
                      {job.status === "in_progress" && (
                        <Button
                          size="sm"
                          onClick={() => updateJobStatus(job._id, "completed")}
                          className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Mark Complete
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {activeJobs.length === 0 && (
                <div className="text-center py-12 text-violet-400">
                  <div className="p-4 bg-gradient-to-br from-violet-100 to-indigo-100 rounded-full w-24 h-24 mx-auto mb-4 flex items-center justify-center">
                    <AlertCircle className="h-12 w-12 text-violet-400" />
                  </div>
                  <p className="text-lg font-medium">No active jobs at the moment</p>
                  <p className="text-sm text-violet-500 mt-1">New assignments will appear here</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
