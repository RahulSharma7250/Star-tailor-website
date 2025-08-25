"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Eye,
  Phone,
  Mail,
  MapPin,
  Calendar,
  IndianRupee,
  ArrowLeft,
  Loader2,
} from "lucide-react"
import { customerAPI } from "@/lib/api"

interface Customer {
  _id: string
  name: string
  phone: string
  email?: string
  address?: string
  notes?: string
  created_at: string
  updated_at: string
  total_orders: number
  total_spent: number
  outstanding_balance: number
  bills?: any[]
}

export function CustomerManagement() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [stats, setStats] = useState({
    total_customers: 0,
    customers_with_outstanding: 0,
    total_outstanding_amount: 0,
  })
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    loadCustomers()
    loadStats()
  }, [])

  const loadCustomers = async () => {
    try {
      setIsLoading(true)
      const response = await customerAPI.getAll({ search: searchTerm })
      setCustomers(response.customers || [])
    } catch (error: any) {
      toast({
        title: "Error Loading Customers",
        description: error.message || "Failed to load customers",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const response = await customerAPI.getStats()
      setStats(response)
    } catch (error: any) {
      console.error("Failed to load stats:", error)
    }
  }

  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      if (searchTerm !== "") {
        loadCustomers()
      } else {
        loadCustomers()
      }
    }, 300)

    return () => clearTimeout(delayedSearch)
  }, [searchTerm])

  const filteredCustomers = customers.filter(
    (customer) => customer.name.toLowerCase().includes(searchTerm.toLowerCase()) || customer.phone.includes(searchTerm),
  )

  const handleAddCustomer = async () => {
    if (!newCustomer.name || !newCustomer.phone) {
      toast({
        title: "Validation Error",
        description: "Name and phone are required fields",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSubmitting(true)
      const response = await customerAPI.create(newCustomer)

      toast({
        title: "Customer Added",
        description: `${response.customer.name} has been added successfully.`,
      })

      setNewCustomer({ name: "", phone: "", email: "", address: "", notes: "" })
      setIsAddDialogOpen(false)
      await loadCustomers()
      await loadStats()
    } catch (error: any) {
      toast({
        title: "Error Adding Customer",
        description: error.message || "Failed to add customer",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditCustomer = async () => {
    if (!editingCustomer || !editingCustomer.name || !editingCustomer.phone) {
      toast({
        title: "Validation Error",
        description: "Name and phone are required fields",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSubmitting(true)
      await customerAPI.update(editingCustomer._id, {
        name: editingCustomer.name,
        phone: editingCustomer.phone,
        email: editingCustomer.email,
        address: editingCustomer.address,
        notes: editingCustomer.notes,
      })

      toast({
        title: "Customer Updated",
        description: "Customer information has been updated successfully.",
      })

      setIsEditDialogOpen(false)
      setEditingCustomer(null)
      await loadCustomers()
    } catch (error: any) {
      toast({
        title: "Error Updating Customer",
        description: error.message || "Failed to update customer",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteCustomer = async (customerId: string) => {
    try {
      await customerAPI.delete(customerId)

      toast({
        title: "Customer Deleted",
        description: "Customer has been removed from the system.",
      })

      await loadCustomers()
      await loadStats()
    } catch (error: any) {
      toast({
        title: "Error Deleting Customer",
        description: error.message || "Failed to delete customer",
        variant: "destructive",
      })
    }
  }

  const handleViewCustomer = async (customer: Customer) => {
    try {
      const response = await customerAPI.getById(customer._id)
      setSelectedCustomer(response.customer)
      setIsViewDialogOpen(true)
    } catch (error: any) {
      toast({
        title: "Error Loading Customer Details",
        description: error.message || "Failed to load customer details",
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
          <span className="text-lg text-gray-600">Loading customers...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-violet-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Button variant="ghost" size="sm" onClick={() => router.push("/admin")} className="hover:bg-violet-100">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
              <h1 className="text-xl font-semibold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent ml-4">
                Customer Management
              </h1>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Customer
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-effect border-0">
                <DialogHeader>
                  <DialogTitle className="text-violet-900">Add New Customer</DialogTitle>
                  <DialogDescription>Enter customer details to add them to the system.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name" className="text-violet-900 font-medium">
                      Name *
                    </Label>
                    <Input
                      id="name"
                      value={newCustomer.name}
                      onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                      placeholder="Customer name"
                      className="border-violet-200 focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone" className="text-violet-900 font-medium">
                      Phone *
                    </Label>
                    <Input
                      id="phone"
                      value={newCustomer.phone}
                      onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                      placeholder="+91 9876543210"
                      className="border-violet-200 focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email" className="text-violet-900 font-medium">
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={newCustomer.email}
                      onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                      placeholder="customer@email.com"
                      className="border-violet-200 focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <Label htmlFor="address" className="text-violet-900 font-medium">
                      Address
                    </Label>
                    <Textarea
                      id="address"
                      value={newCustomer.address}
                      onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                      placeholder="Customer address"
                      className="border-violet-200 focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <Label htmlFor="notes" className="text-violet-900 font-medium">
                      Notes
                    </Label>
                    <Textarea
                      id="notes"
                      value={newCustomer.notes}
                      onChange={(e) => setNewCustomer({ ...newCustomer, notes: e.target.value })}
                      placeholder="Any special notes about the customer"
                      className="border-violet-200 focus:border-violet-500"
                    />
                  </div>
                  <Button
                    onClick={handleAddCustomer}
                    className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Adding Customer...
                      </>
                    ) : (
                      "Add Customer"
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-violet-400 h-4 w-4" />
            <Input
              placeholder="Search customers by name or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 glass-effect border-violet-200 focus:border-violet-500"
            />
          </div>
        </div>

        {/* Customer Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="glass-effect border-0 hover:shadow-lg transition-all duration-200">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-violet-900">{stats.total_customers}</div>
              <p className="text-sm text-violet-600">Total Customers</p>
            </CardContent>
          </Card>
          <Card className="glass-effect border-0 hover:shadow-lg transition-all duration-200">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-violet-900">{stats.customers_with_outstanding}</div>
              <p className="text-sm text-violet-600">Outstanding Balances</p>
            </CardContent>
          </Card>
          <Card className="glass-effect border-0 hover:shadow-lg transition-all duration-200">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-violet-900">
                ₹{customers.reduce((sum, c) => sum + (c.total_spent || 0), 0).toLocaleString()}
              </div>
              <p className="text-sm text-violet-600">Total Revenue</p>
            </CardContent>
          </Card>
          <Card className="glass-effect border-0 hover:shadow-lg transition-all duration-200">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-violet-900">
                ₹{stats.total_outstanding_amount.toLocaleString()}
              </div>
              <p className="text-sm text-violet-600">Total Outstanding</p>
            </CardContent>
          </Card>
        </div>

        {/* Customer List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCustomers.map((customer) => (
            <Card
              key={customer._id}
              className="glass-effect border-0 hover:shadow-lg transition-all duration-200 hover:scale-[1.02]"
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg text-violet-900">{customer.name}</CardTitle>
                    <CardDescription className="flex items-center mt-1 text-violet-600">
                      <Phone className="h-3 w-3 mr-1" />
                      {customer.phone}
                    </CardDescription>
                  </div>
                  {customer.outstanding_balance > 0 && (
                    <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-200">
                      ₹{customer.outstanding_balance}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2 text-sm">
                  {customer.email && (
                    <div className="flex items-center text-violet-600">
                      <Mail className="h-3 w-3 mr-2" />
                      {customer.email}
                    </div>
                  )}
                  {customer.address && (
                    <div className="flex items-center text-violet-600">
                      <MapPin className="h-3 w-3 mr-2" />
                      {customer.address}
                    </div>
                  )}
                  <div className="flex items-center text-violet-600">
                    <Calendar className="h-3 w-3 mr-2" />
                    Joined: {new Date(customer.created_at).toLocaleDateString()}
                  </div>
                  <div className="flex items-center text-violet-600">
                    <IndianRupee className="h-3 w-3 mr-2" />
                    Total Spent: ₹{(customer.total_spent || 0).toLocaleString()}
                  </div>
                </div>
                <div className="flex justify-between items-center mt-4 pt-4 border-t border-violet-100">
                  <span className="text-sm text-violet-600">{customer.total_orders || 0} orders</span>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewCustomer(customer)}
                      className="border-violet-200 text-violet-600 hover:bg-violet-50"
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingCustomer({ ...customer })
                        setIsEditDialogOpen(true)
                      }}
                      className="border-violet-200 text-violet-600 hover:bg-violet-50"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteCustomer(customer._id)}
                      className="border-red-200 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredCustomers.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <div className="text-gray-500 text-lg">No customers found</div>
            <div className="text-gray-400 text-sm mt-2">Try adjusting your search terms</div>
          </div>
        )}

        {/* Edit Customer Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="glass-effect border-0">
            <DialogHeader>
              <DialogTitle className="text-violet-900">Edit Customer</DialogTitle>
              <DialogDescription>Update customer information.</DialogDescription>
            </DialogHeader>
            {editingCustomer && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="edit-name" className="text-violet-900 font-medium">
                    Name
                  </Label>
                  <Input
                    id="edit-name"
                    value={editingCustomer.name}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, name: e.target.value })}
                    className="border-violet-200 focus:border-violet-500"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-phone" className="text-violet-900 font-medium">
                    Phone
                  </Label>
                  <Input
                    id="edit-phone"
                    value={editingCustomer.phone}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, phone: e.target.value })}
                    className="border-violet-200 focus:border-violet-500"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-email" className="text-violet-900 font-medium">
                    Email
                  </Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editingCustomer.email || ""}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, email: e.target.value })}
                    className="border-violet-200 focus:border-violet-500"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-address" className="text-violet-900 font-medium">
                    Address
                  </Label>
                  <Textarea
                    id="edit-address"
                    value={editingCustomer.address || ""}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, address: e.target.value })}
                    className="border-violet-200 focus:border-violet-500"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-notes" className="text-violet-900 font-medium">
                    Notes
                  </Label>
                  <Textarea
                    id="edit-notes"
                    value={editingCustomer.notes || ""}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, notes: e.target.value })}
                    className="border-violet-200 focus:border-violet-500"
                  />
                </div>
                <Button
                  onClick={handleEditCustomer}
                  className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Updating Customer...
                    </>
                  ) : (
                    "Update Customer"
                  )}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* View Customer Dialog */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="max-w-4xl glass-effect border-0">
            <DialogHeader>
              <DialogTitle className="text-violet-900">Customer Details</DialogTitle>
              <DialogDescription>Complete customer information and order history.</DialogDescription>
            </DialogHeader>
            {selectedCustomer && (
              <div className="space-y-6">
                {/* Customer Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="glass-effect border-violet-100">
                    <CardHeader>
                      <CardTitle className="text-lg text-violet-900">Contact Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-violet-700">
                      <div>
                        <strong>Name:</strong> {selectedCustomer.name}
                      </div>
                      <div>
                        <strong>Phone:</strong> {selectedCustomer.phone}
                      </div>
                      {selectedCustomer.email && (
                        <div>
                          <strong>Email:</strong> {selectedCustomer.email}
                        </div>
                      )}
                      {selectedCustomer.address && (
                        <div>
                          <strong>Address:</strong> {selectedCustomer.address}
                        </div>
                      )}
                      {selectedCustomer.notes && (
                        <div>
                          <strong>Notes:</strong> {selectedCustomer.notes}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  <Card className="glass-effect border-violet-100">
                    <CardHeader>
                      <CardTitle className="text-lg text-violet-900">Account Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-violet-700">
                      <div>
                        <strong>Join Date:</strong> {new Date(selectedCustomer.created_at).toLocaleDateString()}
                      </div>
                      <div>
                        <strong>Total Orders:</strong> {selectedCustomer.total_orders || 0}
                      </div>
                      <div>
                        <strong>Total Spent:</strong> ₹{(selectedCustomer.total_spent || 0).toLocaleString()}
                      </div>
                      <div>
                        <strong>Outstanding Balance:</strong>
                        <span
                          className={
                            (selectedCustomer.outstanding_balance || 0) > 0
                              ? "text-red-600 font-medium ml-2"
                              : "text-green-600 ml-2"
                          }
                        >
                          ₹{(selectedCustomer.outstanding_balance || 0).toLocaleString()}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Order History */}
                <Card className="glass-effect border-violet-100">
                  <CardHeader>
                    <CardTitle className="text-lg text-violet-900">Order History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedCustomer.bills && selectedCustomer.bills.length > 0 ? (
                      <div className="space-y-3">
                        {selectedCustomer.bills.map((bill: any) => (
                          <div
                            key={bill._id}
                            className="flex justify-between items-center p-3 border border-violet-100 rounded-lg bg-white/50"
                          >
                            <div>
                              <div className="font-medium text-violet-900">Bill #{bill._id.slice(-6)}</div>
                              <div className="text-sm text-violet-600">{bill.items?.length || 0} items</div>
                              <div className="text-sm text-violet-600">
                                Created: {new Date(bill.created_at).toLocaleDateString()}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-medium text-violet-900">
                                ₹{(bill.subtotal || 0).toLocaleString()}
                              </div>
                              <Badge
                                variant={bill.status === "paid" ? "secondary" : "outline"}
                                className={bill.status === "paid" ? "bg-green-100 text-green-700" : ""}
                              >
                                {bill.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-violet-600">No orders found for this customer</div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}
