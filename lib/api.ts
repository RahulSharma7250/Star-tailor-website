// API utility functions for backend communication
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"

// Helper function to get auth token
const getAuthToken = () => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("auth_token")
  }
  return null
}

// Helper function to make authenticated requests
const makeRequest = async (endpoint: string, options: RequestInit = {}) => {
  const token = getAuthToken()
  const url = `${API_BASE_URL}${endpoint}`

  const headers = new Headers()
  headers.append("Content-Type", "application/json")
  if (token) {
    headers.append("Authorization", `Bearer ${token}`)
  }

  if (options.headers) {
    Object.entries(options.headers).forEach(([key, value]) => {
      headers.append(key, value)
    })
  }

  const config: RequestInit = {
    headers,
    ...options,
  }

  try {
    const response = await fetch(url, config)

    if (response.status === 401) {
      localStorage.removeItem("auth_token")
      localStorage.removeItem("user")
      throw new Error("Session expired. Please login again.")
    }

    if (!response.ok) {
      let errorData
      try {
        errorData = await response.json()
      } catch {
        errorData = { message: `HTTP error! status: ${response.status}` }
      }
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
    }

    return response.json()
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error)
    throw error
  }
}

// Authentication API
export const authAPI = {
  login: async (username: string, password: string) => {
    const response = await makeRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    })

    if (response.token) {
      localStorage.setItem("auth_token", response.token)
      localStorage.setItem("user", JSON.stringify(response.user))
    }

    return response
  },

  register: async (name: string, email: string, password: string, role = "user") => {
    return makeRequest("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password, role }),
    })
  },

  verify: async () => {
    return makeRequest("/auth/verify")
  },

  logout: () => {
    localStorage.removeItem("auth_token")
    localStorage.removeItem("user")
  },

  getCurrentUser: () => {
    if (typeof window !== "undefined") {
      const user = localStorage.getItem("user")
      return user ? JSON.parse(user) : null
    }
    return null
  },
}

// Customer API
export const customerAPI = {
  getAll: async (params: { search?: string; page?: number; limit?: number } = {}) => {
    const searchParams = new URLSearchParams()
    if (params.search) searchParams.append("search", params.search)
    if (params.page) searchParams.append("page", params.page.toString())
    if (params.limit) searchParams.append("limit", params.limit.toString())

    return makeRequest(`/customers?${searchParams.toString()}`)
  },

  getById: async (id: string) => {
    return makeRequest(`/customers/${id}`)
  },

  create: async (customer: { name: string; phone: string; email?: string; address?: string; notes?: string }) => {
    return makeRequest("/customers", {
      method: "POST",
      body: JSON.stringify(customer),
    })
  },

  update: async (
    id: string,
    customer: { name: string; phone: string; email?: string; address?: string; notes?: string },
  ) => {
    return makeRequest(`/customers/${id}`, {
      method: "PUT",
      body: JSON.stringify(customer),
    })
  },

  delete: async (id: string) => {
    return makeRequest(`/customers/${id}`, {
      method: "DELETE",
    })
  },

  getStats: async () => {
    return makeRequest("/customers/stats")
  },
}

// Bills API - UPDATED with complete implementation
export const billsAPI = {
  getAll: async (
    params: {
      search?: string
      status?: string
      customer_id?: string
      page?: number
      limit?: number
    } = {},
  ) => {
    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        searchParams.append(key, value.toString())
      }
    })

    return makeRequest(`/bills?${searchParams.toString()}`)
  },

  getById: async (id: string) => {
    return makeRequest(`/bills/${id}`)
  },

  create: async (bill: {
    customer_id: string
    customer_name: string
    customer_phone?: string
    customer_address?: string
    items: Array<{
      type: string
      description: string
      quantity: number
      price: number
      measurements: Record<string, any>
    }>
    subtotal: number
    discount: number
    total: number
    advance: number
    balance: number
    due_date?: string
    special_instructions?: string
    design_images?: string[]
    drawings?: string[]
    signature?: string
    status?: string
  }) => {
    return makeRequest("/bills", {
      method: "POST",
      body: JSON.stringify(bill),
    })
  },

  update: async (id: string, bill: any) => {
    return makeRequest(`/bills/${id}`, {
      method: "PUT",
      body: JSON.stringify(bill),
    })
  },

  delete: async (id: string) => {
    return makeRequest(`/bills/${id}`, {
      method: "DELETE",
    })
  },

  updateStatus: async (id: string, status: string) => {
    return makeRequest(`/bills/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    })
  },

  getStats: async (params: { from_date?: string; to_date?: string } = {}) => {
    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value) searchParams.append(key, value)
    })

    return makeRequest(`/bills/stats?${searchParams.toString()}`)
  },

  // NEW: Get bills for customer
  getByCustomerId: async (customerId: string) => {
    return makeRequest(`/bills?customer_id=${customerId}`)
  },

  // NEW: Search bills with multiple parameters
  search: async (params: {
    customer_name?: string
    phone?: string
    status?: string
    from_date?: string
    to_date?: string
  }) => {
    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value) searchParams.append(key, value.toString())
    })

    return makeRequest(`/bills/search?${searchParams.toString()}`)
  },
}

// Tailors API - UPDATED with complete implementation
export const tailorsAPI = {
  getAll: async (
    params: {
      search?: string
      status?: string
      page?: number
      limit?: number
    } = {},
  ) => {
    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        searchParams.append(key, value.toString())
      }
    })

    return makeRequest(`/tailors?${searchParams.toString()}`)
  },

  getById: async (id: string) => {
    return makeRequest(`/tailors/${id}`)
  },

  create: async (tailor: {
    name: string
    phone: string
    email?: string
    specialization?: string
    experience?: string
    status?: string
  }) => {
    return makeRequest("/tailors", {
      method: "POST",
      body: JSON.stringify(tailor),
    })
  },

  update: async (id: string, tailor: any) => {
    return makeRequest(`/tailors/${id}`, {
      method: "PUT",
      body: JSON.stringify(tailor),
    })
  },

  delete: async (id: string) => {
    return makeRequest(`/tailors/${id}`, {
      method: "DELETE",
    })
  },

  getJobs: async (id: string, params: { status?: string; page?: number; limit?: number } = {}) => {
    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value) searchParams.append(key, value.toString())
    })

    return makeRequest(`/tailors/${id}/jobs?${searchParams.toString()}`)
  },

  getStats: async () => {
    return makeRequest("/tailors/stats")
  },

  // NEW: Update tailor status
  updateStatus: async (id: string, status: string) => {
    return makeRequest(`/tailors/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    })
  },
}

// Jobs API - UPDATED with complete implementation
export const jobsAPI = {
  getAll: async (
    params: {
      search?: string
      status?: string
      tailor_id?: string
      priority?: string
      page?: number
      limit?: number
    } = {},
  ) => {
    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        searchParams.append(key, value.toString())
      }
    })

    return makeRequest(`/jobs?${searchParams.toString()}`)
  },

  getById: async (id: string) => {
    return makeRequest(`/jobs/${id}`)
  },

  create: async (job: {
    bill_id: string
    tailor_id: string
    customer_name: string
    customer_phone?: string
    items: Array<{
      type: string
      description: string
      measurements: Record<string, any>
    }>
    instructions?: string
    priority?: "low" | "medium" | "high"
    due_date?: string
  }) => {
    return makeRequest("/jobs", {
      method: "POST",
      body: JSON.stringify(job),
    })
  },

  update: async (id: string, job: any) => {
    return makeRequest(`/jobs/${id}`, {
      method: "PUT",
      body: JSON.stringify(job),
    })
  },

  updateStatus: async (id: string, status: string) => {
    return makeRequest(`/jobs/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    })
  },

  delete: async (id: string) => {
    return makeRequest(`/jobs/${id}`, {
      method: "DELETE",
    })
  },

  // NEW: Get jobs by status
  getByStatus: async (status: string, params: { page?: number; limit?: number } = {}) => {
    const searchParams = new URLSearchParams()
    searchParams.append("status", status)
    Object.entries(params).forEach(([key, value]) => {
      if (value) searchParams.append(key, value.toString())
    })

    return makeRequest(`/jobs?${searchParams.toString()}`)
  },

  // NEW: Get jobs by tailor with filters
  getByTailor: async (tailorId: string, params: { status?: string; priority?: string } = {}) => {
    const searchParams = new URLSearchParams()
    searchParams.append("tailor_id", tailorId)
    Object.entries(params).forEach(([key, value]) => {
      if (value) searchParams.append(key, value.toString())
    })

    return makeRequest(`/jobs?${searchParams.toString()}`)
  },
}

// Settings API
export const settingsAPI = {
  getUPI: async () => {
    return makeRequest("/settings/upi")
  },

  updateUPI: async (upi_id: string, business_name: string) => {
    return makeRequest("/settings/upi", {
      method: "PUT",
      body: JSON.stringify({ upi_id, business_name }),
    })
  },
}

// Reports API
export const reportsAPI = {
  getRevenue: async (params: { from_date?: string; to_date?: string } = {}) => {
    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value) searchParams.append(key, value)
    })

    return makeRequest(`/reports/revenue?${searchParams.toString()}`)
  },

  getCustomers: async () => {
    return makeRequest("/reports/customers")
  },

  getTailors: async () => {
    return makeRequest("/reports/tailors")
  },

  getOutstanding: async () => {
    return makeRequest("/reports/outstanding")
  },

  export: async (report_type: string, format: "csv" | "pdf" = "csv") => {
    return makeRequest("/reports/export", {
      method: "POST",
      body: JSON.stringify({ report_type, format }),
    })
  },
}

// Dashboard API
export const dashboardAPI = {
  getStats: async () => {
    return makeRequest("/dashboard/stats")
  },
}

// NEW: Health check API
export const healthAPI = {
  check: async () => {
    return makeRequest("/health")
  },
}

// Complete API export with all endpoints
export const api = {
  auth: authAPI,
  customers: customerAPI,
  bills: billsAPI,
  tailors: tailorsAPI,
  jobs: jobsAPI,
  reports: reportsAPI,
  dashboard: dashboardAPI,
  health: healthAPI,
  settings: {
    getUpi: settingsAPI.getUPI,
    updateUpi: settingsAPI.updateUPI,
  },
}

export default api
