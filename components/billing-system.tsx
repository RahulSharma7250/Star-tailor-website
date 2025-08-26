"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, Plus, Trash2, Printer, Calculator, Loader2, Pen, Eraser } from "lucide-react"
import { api } from "@/lib/api"

interface Customer {
  _id: string
  name: string
  phone: string
  email?: string
  address: string
  notes?: string
}

interface BillItem {
  id: string
  itemType: string
  description: string
  quantity: number
  rate: number
  sizes: { [key: string]: string }
  total: number
}

interface Bill {
  _id?: string
  billNoStr?: string
  customerId: string
  customerName: string
  customerPhone: string
  customerAddress: string
  items: BillItem[]
  subtotal: number
  discount: number
  total: number
  advance: number
  balance: number
  dueDate: string
  specialInstructions: string
  designImages: string[]
  drawings: string[]
  signature: string
  createdDate: string
  status: string
}

const ITEM_TYPES = [
  { value: "shirt", label: "Shirt", sizes: ["Chest", "Waist", "Length", "Shoulder", "Sleeve"] },
  { value: "trouser", label: "Trouser", sizes: ["Waist", "Length", "Hip", "Thigh", "Bottom"] },
  {
    value: "suit",
    label: "Suit",
    sizes: ["Chest", "Waist", "Length", "Shoulder", "Sleeve", "Trouser Waist", "Trouser Length"],
  },
  { value: "dress", label: "Dress", sizes: ["Bust", "Waist", "Hip", "Length", "Shoulder"] },
  { value: "blouse", label: "Blouse", sizes: ["Bust", "Waist", "Length", "Shoulder", "Sleeve"] },
  { value: "kurta", label: "Kurta", sizes: ["Chest", "Length", "Shoulder", "Sleeve"] },
  { value: "saree_blouse", label: "Saree Blouse", sizes: ["Bust", "Waist", "Length", "Shoulder"] },
]

export function BillingSystem() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>({
    _id: "new",
    name: "",
    phone: "",
    address: "",
  })
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
  })
  const [billItems, setBillItems] = useState<BillItem[]>([
    {
      id: "1",
      itemType: "",
      description: "",
      quantity: 1,
      rate: 0,
      sizes: {},
      total: 0,
    },
  ])
  const [discount, setDiscount] = useState(0)
  const [advance, setAdvance] = useState(0)
  const [dueDate, setDueDate] = useState("")
  const [specialInstructions, setSpecialInstructions] = useState("")
  const [designImages, setDesignImages] = useState<string[]>([])
  const [drawings, setDrawings] = useState<string[]>([])
  const [signature, setSignature] = useState("")
  const [currentBill, setCurrentBill] = useState<Bill | null>(null)
  const [showBillPreview, setShowBillPreview] = useState(false)
  const [isDrawingMode, setIsDrawingMode] = useState(false)
  const [isSignatureMode, setIsSignatureMode] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawingColor, setDrawingColor] = useState("#000000")
  const [drawingWidth, setDrawingWidth] = useState(2)
  const [upiId, setUpiId] = useState("startailors@paytm")
  const [businessName, setBusinessName] = useState("STAR TAILORS")
  const [businessAddress, setBusinessAddress] = useState("Baramati, Maharashtra")
  const [loading, setLoading] = useState(false)
  const [customersLoading, setCustomersLoading] = useState(true)
  const router = useRouter()
  const { toast } = useToast()
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null)
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    loadCustomers()
    loadUpiSettings()
    loadBusinessInfo()
  }, [])

  const loadCustomers = async () => {
    try {
      setCustomersLoading(true)
      const response = await api.customers.getAll()
      setCustomers(response.customers || [])
    } catch (error) {
      console.error("Error loading customers:", error)
      toast({
        title: "Error",
        description: "Failed to load customers. Please try again.",
        variant: "destructive",
      })
    } finally {
      setCustomersLoading(false)
    }
  }

  const loadUpiSettings = async () => {
    try {
      const settings = await api.settings.getUpi()
      const value = settings.upi_id || settings.upiId
      if (value) {
        setUpiId(value)
      }
    } catch (error) {
      const savedUpiId = localStorage.getItem("adminUpiId")
      if (savedUpiId) {
        setUpiId(savedUpiId)
      }
    }
  }

  const loadBusinessInfo = async () => {
    try {
      const res = await api.settings.getBusiness()
      if (res.business_name) setBusinessName(res.business_name)
      if (res.address) setBusinessAddress(res.address)
    } catch (e) {
      // ignore, keep defaults
    }
  }

  const addBillItem = () => {
    const newItem: BillItem = {
      id: Date.now().toString(),
      itemType: "",
      description: "",
      quantity: 1,
      rate: 0,
      sizes: {},
      total: 0,
    }
    setBillItems([...billItems, newItem])
  }

  const updateBillItem = (id: string, field: string, value: any) => {
    setBillItems(
      billItems.map((item) => {
        if (item.id === id) {
          const updatedItem = { ...item, [field]: value }
          if (field === "quantity" || field === "rate") {
            updatedItem.total = updatedItem.quantity * updatedItem.rate
          }
          return updatedItem
        }
        return item
      }),
    )
  }

  const removeBillItem = (id: string) => {
    if (billItems.length > 1) {
      setBillItems(billItems.filter((item) => item.id !== id))
    }
  }

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files) {
      const newImages = Array.from(files).map((file) => URL.createObjectURL(file))
      setDesignImages([...designImages, ...newImages])
    }
  }

  const calculateSubtotal = () => {
    return billItems.reduce((sum, item) => sum + item.total, 0)
  }

  const calculateTotal = () => {
    const subtotal = calculateSubtotal()
    return subtotal - discount
  }

  const calculateBalance = () => {
    return calculateTotal() - advance
  }

  const generateBill = async () => {
    if (!newCustomer.name.trim() || !newCustomer.phone.trim()) {
      toast({
        title: "Error",
        description: "Name and phone are required fields for customer.",
        variant: "destructive",
      })
      return
    }

    if (billItems.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one item to the bill.",
        variant: "destructive",
      })
      return
    }

    try {
      setLoading(true)

      // Create customer first
      const customerData = {
        name: newCustomer.name.trim(),
        phone: newCustomer.phone.trim(),
        email: newCustomer.email.trim(),
        address: newCustomer.address.trim(),
        notes: newCustomer.notes.trim(),
      }

      console.log("Creating customer with data:", customerData)

      const customerResponse = await api.customers.create(customerData)
      const customerId = customerResponse._id || customerResponse.customer?._id

      console.log("Customer created with ID:", customerId)

      if (!customerId) {
        throw new Error("Customer ID not returned from server")
      }

      // Create bill with the new customer ID
      const billData = {
        customer_id: customerId,
        customer_name: newCustomer.name,
        customer_phone: newCustomer.phone,
        customer_address: newCustomer.address,
        items: billItems.map((item) => ({
          type: item.itemType,
          description: item.description || "",
          quantity: Number(item.quantity) || 1,
          price: Number(item.rate) || 0,
          measurements: item.sizes || {},
          total: Number(item.total) || 0,
        })),
        subtotal: Number(calculateSubtotal()) || 0,
        discount: Number(discount) || 0,
        total: Number(calculateTotal()) || 0,
        advance: Number(advance) || 0,
        balance: Number(calculateBalance()) || 0,
        due_date: dueDate || "",
        special_instructions: specialInstructions || "",
        design_images: designImages || [],
        drawings: drawings || [],
        signature: signature || "",
        status: "pending",
      }

      console.log("Creating bill with data:", billData)

      const billResponse = await api.bills.create(billData)

      const created = billResponse.bill || billResponse
      const billNoStr = created?.bill_no_str || created?.billNoStr || (created?.bill_no != null ? String(created.bill_no).padStart(3, "0") : undefined)

      const bill: Bill = {
        _id: created?._id || billResponse._id,
        billNoStr: billNoStr,
        customerId: customerId,
        customerName: newCustomer.name,
        customerPhone: newCustomer.phone,
        customerAddress: newCustomer.address,
        items: billItems,
        subtotal: calculateSubtotal(),
        discount,
        total: calculateTotal(),
        advance,
        balance: calculateBalance(),
        dueDate,
        specialInstructions,
        designImages,
        drawings,
        signature,
        createdDate: new Date().toISOString().split("T")[0],
        status: "pending",
      }

      setCurrentBill(bill)
      setShowBillPreview(true)

      // Refresh customers list
      await loadCustomers()

      toast({
        title: "Success",
        description: "Customer added and bill generated successfully!",
      })
    } catch (error: any) {
      console.error("Error generating bill:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to generate bill. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const generateQRCode = (amount: number) => {
    const merchantName = businessName || "STAR TAILORS"
    const upiString = `upi://pay?pa=${upiId}&pn=${merchantName}&am=${amount}&cu=INR`
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiString)}`
    return qrCodeUrl
  }

  const printBill = () => {
    window.print()
  }

  // Drawing functions
  const startDrawing = (e: React.MouseEvent, canvasRef: React.RefObject<HTMLCanvasElement>) => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    ctx.beginPath()
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
    setIsDrawing(true)
  }

  const draw = (e: React.MouseEvent, canvasRef: React.RefObject<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.strokeStyle = drawingColor
    ctx.lineWidth = drawingWidth
    ctx.lineCap = "round"
    ctx.lineJoin = "round"

    const rect = canvas.getBoundingClientRect()
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top)
    ctx.stroke()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  // Touch events for mobile devices
  const startDrawingTouch = (e: React.TouchEvent, canvasRef: React.RefObject<HTMLCanvasElement>) => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const touch = e.touches[0]
    ctx.beginPath()
    ctx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top)
    setIsDrawing(true)
    e.preventDefault()
  }

  const drawTouch = (e: React.TouchEvent, canvasRef: React.RefObject<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.strokeStyle = drawingColor
    ctx.lineWidth = drawingWidth
    ctx.lineCap = "round"
    ctx.lineJoin = "round"

    const rect = canvas.getBoundingClientRect()
    const touch = e.touches[0]
    ctx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top)
    ctx.stroke()
    e.preventDefault()
  }

  const clearCanvas = (canvasRef: React.RefObject<HTMLCanvasElement>) => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  const saveDrawing = () => {
    if (!drawingCanvasRef.current) return

    const canvas = drawingCanvasRef.current
    const dataUrl = canvas.toDataURL("image/png")
    setDrawings([...drawings, dataUrl])
    clearCanvas(drawingCanvasRef)
    setIsDrawingMode(false)
  }

  const saveSignature = () => {
    if (!signatureCanvasRef.current) return

    const canvas = signatureCanvasRef.current
    const dataUrl = canvas.toDataURL("image/png")
    setSignature(dataUrl)
    clearCanvas(signatureCanvasRef)
    setIsSignatureMode(false)
  }

  // Initialize canvas context when mode changes
  useEffect(() => {
    if (isDrawingMode && drawingCanvasRef.current) {
      const canvas = drawingCanvasRef.current
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.strokeStyle = drawingColor
        ctx.lineWidth = drawingWidth
        ctx.lineCap = "round"
        ctx.lineJoin = "round"
      }
    }

    if (isSignatureMode && signatureCanvasRef.current) {
      const canvas = signatureCanvasRef.current
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.strokeStyle = "#000000"
        ctx.lineWidth = 2
        ctx.lineCap = "round"
        ctx.lineJoin = "round"
      }
    }
  }, [isDrawingMode, isSignatureMode, drawingColor, drawingWidth])

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50">
      <header className="bg-white/80 backdrop-blur-md shadow-sm border-b border-violet-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Button variant="ghost" size="sm" onClick={() => router.push("/admin")} className="hover:bg-violet-50">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
              <h1 className="text-xl font-semibold text-gray-900 ml-4">Billing System</h1>
            </div>
            <Button
              onClick={generateBill}
              disabled={loading}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
            >
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Calculator className="h-4 w-4 mr-2" />}
              Generate Bill
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {/* Customer Information Card */}
            <Card className="bg-white/70 backdrop-blur-sm border-violet-100 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-violet-50 to-indigo-50 rounded-t-lg">
                <CardTitle className="text-violet-900">Customer Information</CardTitle>
                <CardDescription>Enter customer details for billing</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-6">
                  <div className="p-4 border border-violet-200 rounded-lg bg-violet-50/50">
                    <h3 className="font-medium text-violet-900 mb-4">Customer Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="name">Name *</Label>
                        <Input
                          id="name"
                          value={newCustomer.name}
                          onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                          placeholder="Enter customer name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="phone">Phone *</Label>
                        <Input
                          id="phone"
                          value={newCustomer.phone}
                          onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                          placeholder="Enter phone number"
                        />
                      </div>
                      <div>
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={newCustomer.email}
                          onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                          placeholder="Enter email address"
                        />
                      </div>
                      <div>
                        <Label htmlFor="address">Address</Label>
                        <Input
                          id="address"
                          value={newCustomer.address}
                          onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                          placeholder="Enter customer address"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                          id="notes"
                          value={newCustomer.notes}
                          onChange={(e) => setNewCustomer({ ...newCustomer, notes: e.target.value })}
                          placeholder="Any special preferences or notes"
                          rows={2}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bill Items Card */}
            <Card className="bg-white/70 backdrop-blur-sm border-violet-100 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-violet-50 to-indigo-50 rounded-t-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-violet-900">Bill Items</CardTitle>
                    <CardDescription>Add items and measurements</CardDescription>
                  </div>
                  <Button
                    onClick={addBillItem}
                    className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {billItems.map((item, index) => {
                    const itemType = ITEM_TYPES.find((type) => type.value === item.itemType)
                    return (
                      <div
                        key={item.id}
                        className="p-4 border border-violet-100 rounded-lg space-y-4 bg-gradient-to-r from-violet-25 to-indigo-25"
                      >
                        <div className="flex justify-between items-center">
                          <h4 className="font-medium text-violet-900">Item {index + 1}</h4>
                          {billItems.length > 1 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => removeBillItem(item.id)}
                              className="border-red-200 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label>Item Type</Label>
                            <Select
                              value={item.itemType}
                              onValueChange={(value: string) => updateBillItem(item.id, "itemType", value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select item type" />
                              </SelectTrigger>
                              <SelectContent>
                                {ITEM_TYPES.map((type) => (
                                  <SelectItem key={type.value} value={type.value}>
                                    {type.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Description</Label>
                            <Input
                              value={item.description}
                              onChange={(e) => updateBillItem(item.id, "description", e.target.value)}
                              placeholder="Item description"
                            />
                          </div>
                        </div>

                        {itemType && (
                          <div>
                            <Label className="text-sm font-medium">Measurements</Label>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                              {itemType.sizes.map((size) => (
                                <div key={size}>
                                  <Label className="text-xs">{size}</Label>
                                  <Input
                                    placeholder="Size"
                                    value={item.sizes[size] || ""}
                                    onChange={(e) =>
                                      updateBillItem(item.id, "sizes", { ...item.sizes, [size]: e.target.value })
                                    }
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <Label>Quantity</Label>
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) =>
                                updateBillItem(item.id, "quantity", Number.parseInt(e.target.value) || 0)
                              }
                              min="1"
                            />
                          </div>
                          <div>
                            <Label>Rate (₹)</Label>
                            <Input
                              type="number"
                              value={item.rate}
                              onChange={(e) => updateBillItem(item.id, "rate", Number.parseFloat(e.target.value) || 0)}
                              min="0"
                            />
                          </div>
                          <div>
                            <Label>Total (₹)</Label>
                            <Input value={item.total.toFixed(2)} readOnly className="bg-violet-50" />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Design Images Card */}
            <Card className="bg-white/70 backdrop-blur-sm border-violet-100 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-violet-50 to-indigo-50 rounded-t-lg">
                <CardTitle className="text-violet-900">Design Images</CardTitle>
                <CardDescription>Upload customer design references</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="images">Upload Images</Label>
                    <Input
                      id="images"
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="cursor-pointer"
                    />
                  </div>
                  {designImages.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {designImages.map((image, index) => (
                        <div key={index} className="relative">
                          <img
                            src={image || "/placeholder.svg"}
                            alt={`Design ${index + 1}`}
                            className="w-full h-24 object-cover rounded border border-violet-100"
                          />
                          <Button
                            variant="destructive"
                            size="sm"
                            className="absolute top-1 right-1 h-6 w-6 p-0"
                            onClick={() => setDesignImages(designImages.filter((_, i) => i !== index))}
                          >
                            ×
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Design Drawing Card */}
            <Card className="bg-white/70 backdrop-blur-sm border-violet-100 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-violet-50 to-indigo-50 rounded-t-lg">
                <CardTitle className="text-violet-900">Design Drawing</CardTitle>
                <CardDescription>Create design sketches directly on the canvas</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {!isDrawingMode ? (
                    <div className="flex flex-col gap-4">
                      <Button
                        onClick={() => setIsDrawingMode(true)}
                        variant="outline"
                        className="border-violet-200 hover:bg-violet-50"
                      >
                        <Pen className="h-4 w-4 mr-2" />
                        Start Drawing
                      </Button>

                      {drawings.length > 0 && (
                        <div>
                          <h4 className="font-medium text-violet-900 mb-2">Saved Drawings</h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {drawings.map((drawing, index) => (
                              <div key={index} className="relative">
                                <img
                                  src={drawing || "/placeholder.svg"}
                                  alt={`Drawing ${index + 1}`}
                                  className="w-full h-24 object-contain rounded border border-violet-100 bg-white"
                                />
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="absolute top-1 right-1 h-6 w-6 p-0"
                                  onClick={() => setDrawings(drawings.filter((_, i) => i !== index))}
                                >
                                  ×
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex gap-2 items-center">
                        <Label htmlFor="drawingColor">Color:</Label>
                        <Input
                          id="drawingColor"
                          type="color"
                          value={drawingColor}
                          onChange={(e) => setDrawingColor(e.target.value)}
                          className="w-10 h-10 p-1"
                        />

                        <Label htmlFor="drawingWidth" className="ml-2">
                          Width:
                        </Label>
                        <Select
                          value={drawingWidth.toString()}
                          onValueChange={(value) => setDrawingWidth(Number.parseInt(value))}
                        >
                          <SelectTrigger className="w-20">
                            <SelectValue placeholder="Width" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">Thin</SelectItem>
                            <SelectItem value="2">Medium</SelectItem>
                            <SelectItem value="4">Thick</SelectItem>
                            <SelectItem value="6">Extra Thick</SelectItem>
                          </SelectContent>
                        </Select>

                        <Button
                          variant="outline"
                          onClick={() => clearCanvas(drawingCanvasRef)}
                          className="ml-auto border-red-200 hover:bg-red-50"
                        >
                          <Eraser className="h-4 w-4 mr-2" />
                          Clear
                        </Button>
                      </div>

                      <div className="border rounded-lg p-2 bg-white">
                        <canvas
                          ref={drawingCanvasRef}
                          width={500}
                          height={300}
                          className="border rounded bg-white w-full"
                          onMouseDown={(e) => startDrawing(e, drawingCanvasRef)}
                          onMouseMove={(e) => draw(e, drawingCanvasRef)}
                          onMouseUp={stopDrawing}
                          onMouseLeave={stopDrawing}
                          onTouchStart={(e) => startDrawingTouch(e, drawingCanvasRef)}
                          onTouchMove={(e) => drawTouch(e, drawingCanvasRef)}
                          onTouchEnd={stopDrawing}
                        />
                      </div>

                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={() => setIsDrawingMode(false)}>
                          Cancel
                        </Button>
                        <Button
                          onClick={saveDrawing}
                          className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
                        >
                          Save Drawing
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Signature Card */}
            <Card className="bg-white/70 backdrop-blur-sm border-violet-100 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-violet-50 to-indigo-50 rounded-t-lg">
                <CardTitle className="text-violet-900">Customer Signature</CardTitle>
                <CardDescription>Capture customer signature for approval</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {!isSignatureMode ? (
                    <div className="flex flex-col gap-4">
                      <Button
                        onClick={() => setIsSignatureMode(true)}
                        variant="outline"
                        className="border-violet-200 hover:bg-violet-50"
                      >
                        <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                          />
                        </svg>
                        Add Signature
                      </Button>

                      {signature && (
                        <div>
                          <h4 className="font-medium text-violet-900 mb-2">Customer Signature</h4>
                          <div className="relative inline-block">
                            <img
                              src={signature || "/placeholder.svg"}
                              alt="Customer Signature"
                              className="w-48 h-24 object-contain rounded border border-violet-100 bg-white"
                            />
                            <Button
                              variant="destructive"
                              size="sm"
                              className="absolute top-1 right-1 h-6 w-6 p-0"
                              onClick={() => setSignature("")}
                            >
                              ×
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          onClick={() => clearCanvas(signatureCanvasRef)}
                          className="border-red-200 hover:bg-red-50"
                        >
                          <Eraser className="h-4 w-4 mr-2" />
                          Clear
                        </Button>
                      </div>

                      <div className="border rounded-lg p-2 bg-white">
                        <canvas
                          ref={signatureCanvasRef}
                          width={500}
                          height={200}
                          className="border rounded bg-white w-full"
                          onMouseDown={(e) => startDrawing(e, signatureCanvasRef)}
                          onMouseMove={(e) => draw(e, signatureCanvasRef)}
                          onMouseUp={stopDrawing}
                          onMouseLeave={stopDrawing}
                          onTouchStart={(e) => startDrawingTouch(e, signatureCanvasRef)}
                          onTouchMove={(e) => drawTouch(e, signatureCanvasRef)}
                          onTouchEnd={stopDrawing}
                        />
                      </div>

                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={() => setIsSignatureMode(false)}>
                          Cancel
                        </Button>
                        <Button
                          onClick={saveSignature}
                          className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
                        >
                          Save Signature
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Special Instructions Card */}
            <Card className="bg-white/70 backdrop-blur-sm border-violet-100 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-violet-50 to-indigo-50 rounded-t-lg">
                <CardTitle className="text-violet-900">Special Instructions</CardTitle>
                <CardDescription>Add any special notes or requirements</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <Textarea
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  placeholder="Enter special instructions for the tailor..."
                  rows={3}
                />
              </CardContent>
            </Card>
          </div>

          {/* Bill Summary Card */}
          <div className="space-y-6">
            <Card className="bg-white/70 backdrop-blur-sm border-violet-100 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-violet-50 to-indigo-50 rounded-t-lg">
                <CardTitle className="text-violet-900">Bill Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-6">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>₹{calculateSubtotal().toFixed(2)}</span>
                </div>
                <div>
                  <Label htmlFor="discount">Discount (₹)</Label>
                  <Input
                    id="discount"
                    type="number"
                    value={discount}
                    onChange={(e) => setDiscount(Number.parseFloat(e.target.value) || 0)}
                    min="0"
                  />
                </div>
                <div className="flex justify-between font-medium">
                  <span>Total:</span>
                  <span>₹{calculateTotal().toFixed(2)}</span>
                </div>
                <div>
                  <Label htmlFor="advance">Advance Paid (₹)</Label>
                  <Input
                    id="advance"
                    type="number"
                    value={advance}
                    onChange={(e) => setAdvance(Number.parseFloat(e.target.value) || 0)}
                    min="0"
                  />
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Balance:</span>
                  <span className={calculateBalance() > 0 ? "text-red-600" : "text-green-600"}>
                    ₹{calculateBalance().toFixed(2)}
                  </span>
                </div>
                <div>
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>

                {calculateBalance() > 0 && (
                  <div className="border-t border-violet-100 pt-4 mt-4">
                    <div className="text-center">
                      <h3 className="font-medium mb-3 text-sm text-violet-900">Payment QR Code</h3>
                      <div className="bg-white p-3 rounded-lg border border-violet-100 inline-block">
                        <img
                          src={generateQRCode(calculateBalance()) || "/placeholder.svg"}
                          alt="Payment QR Code"
                          className="w-24 h-24 mx-auto"
                        />
                      </div>
                      <div className="mt-2 text-xs text-violet-700 space-y-1">
                        <div>
                          <strong>Amount:</strong> ₹{calculateBalance().toFixed(2)}
                        </div>
                        <div>
                          <strong>UPI ID:</strong> {upiId}
                        </div>
                        <div className="text-violet-600">Scan to pay balance</div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Bill Preview Dialog */}
        <Dialog open={showBillPreview} onOpenChange={setShowBillPreview}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Bill Preview</DialogTitle>
              <DialogDescription>Review and print the bill</DialogDescription>
            </DialogHeader>
            {currentBill && (
              <div className="space-y-6 print:space-y-4" id="bill-content">
                <div className="text-center border-b pb-4">
                  <h1 className="text-2xl font-bold text-violet-900">{businessName || "STAR TAILORS"}</h1>
                  <p className="text-sm text-gray-600">Professional Tailoring Services</p>
                  <p className="text-sm text-gray-600">{businessAddress}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div>
                      <strong>Bill No:</strong> {currentBill.billNoStr || currentBill._id}
                    </div>
                    <div>
                      <strong>Date:</strong> {new Date(currentBill.createdDate).toLocaleDateString()}
                    </div>
                    <div>
                      <strong>Due Date:</strong> {new Date(currentBill.dueDate).toLocaleDateString()}
                    </div>
                  </div>
                  <div>
                    <div>
                      <strong>Customer:</strong> {currentBill.customerName}
                    </div>
                    <div>
                      <strong>Phone:</strong> {currentBill.customerPhone}
                    </div>
                    <div>
                      <strong>Address:</strong> {currentBill.customerAddress}
                    </div>
                  </div>
                </div>

                <div>
                  <table className="w-full border-collapse border border-gray-300 text-sm">
                    <thead>
                      <tr className="bg-violet-50">
                        <th className="border border-gray-300 p-2 text-left">Item</th>
                        <th className="border border-gray-300 p-2 text-left">Description</th>
                        <th className="border border-gray-300 p-2 text-center">Qty</th>
                        <th className="border border-gray-300 p-2 text-right">Rate</th>
                        <th className="border border-gray-300 p-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentBill.items.map((item, index) => (
                        <tr key={index}>
                          <td className="border border-gray-300 p-2">
                            {ITEM_TYPES.find((type) => type.value === item.itemType)?.label}
                          </td>
                          <td className="border border-gray-300 p-2">{item.description}</td>
                          <td className="border border-gray-300 p-2 text-center">{item.quantity}</td>
                          <td className="border border-gray-300 p-2 text-right">₹{item.rate.toFixed(2)}</td>
                          <td className="border border-gray-300 p-2 text-right">₹{item.total.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end">
                  <div className="w-64 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>₹{currentBill.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Discount:</span>
                      <span>₹{currentBill.discount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>Total:</span>
                      <span>₹{currentBill.total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Advance:</span>
                      <span>₹{currentBill.advance.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg border-t pt-2">
                      <span>Balance:</span>
                      <span>₹{currentBill.balance.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Measurements Section */}
                {currentBill.items.some((item) => Object.keys(item.sizes).length > 0) && (
                  <div className="border-t pt-4 mt-4">
                    <h3 className="font-medium mb-2">Measurements</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {currentBill.items.map(
                        (item, index) =>
                          Object.keys(item.sizes).length > 0 && (
                            <div key={index} className="border rounded p-3">
                              <h4 className="font-medium text-violet-900 mb-2">
                                {ITEM_TYPES.find((type) => type.value === item.itemType)?.label} {index + 1}
                              </h4>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                {Object.entries(item.sizes).map(
                                  ([key, value]) =>
                                    value && (
                                      <div key={key} className="flex justify-between">
                                        <span className="text-gray-600">{key}:</span>
                                        <span className="font-medium">{value}</span>
                                      </div>
                                    ),
                                )}
                              </div>
                            </div>
                          ),
                      )}
                    </div>
                  </div>
                )}

                {/* Design Images Section */}
                {currentBill.designImages.length > 0 && (
                  <div className="border-t pt-4 mt-4">
                    <h3 className="font-medium mb-2">Design Images</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {currentBill.designImages.map((image, index) => (
                        <div key={index} className="text-center">
                          <img
                            src={image || "/placeholder.svg"}
                            alt={`Design Image ${index + 1}`}
                            className="w-full h-40 object-contain border rounded bg-white mx-auto"
                          />
                          <p className="text-xs mt-1">Design Image {index + 1}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Design Drawings & Signature Section */}
                {(currentBill.drawings.length > 0 || currentBill.signature) && (
                  <div className="border-t pt-4 mt-4">
                    <h3 className="font-medium mb-2">Design Drawings & Signature</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {currentBill.drawings.map((drawing, index) => (
                        <div key={index} className="text-center">
                          <img
                            src={drawing || "/placeholder.svg"}
                            alt={`Design Drawing ${index + 1}`}
                            className="w-full h-40 object-contain border rounded bg-white mx-auto"
                          />
                          <p className="text-xs mt-1">Design Drawing {index + 1}</p>
                        </div>
                      ))}

                      {currentBill.signature && (
                        <div className="text-center">
                          <img
                            src={currentBill.signature || "/placeholder.svg"}
                            alt="Customer Signature"
                            className="w-full h-40 object-contain border rounded bg-white mx-auto"
                          />
                          <p className="text-xs mt-1">Customer Signature</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {currentBill.specialInstructions && (
                  <div className="border-t pt-4">
                    <h3 className="font-medium mb-2">Special Instructions:</h3>
                    <p className="text-sm">{currentBill.specialInstructions}</p>
                  </div>
                )}

                {currentBill.balance > 0 && (
                  <div className="text-center border-t pt-4">
                    <h3 className="font-medium mb-2">Pay Balance Amount</h3>
                    <div className="flex justify-center items-center space-x-4">
                      <div>
                        <img
                          src={generateQRCode(currentBill.balance) || "/placeholder.svg"}
                          alt="Payment QR Code"
                          className="w-32 h-32 border"
                        />
                        <p className="text-xs mt-1">Scan to pay ₹{currentBill.balance.toFixed(2)}</p>
                      </div>
                      <div className="text-left text-sm">
                        <div>
                          <strong>UPI ID:</strong> {upiId}
                        </div>
                        <div>
                          <strong>Amount:</strong> ₹{currentBill.balance.toFixed(2)}
                        </div>
                        <div>
                          <strong>Merchant:</strong> STAR TAILORS
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="text-center text-xs text-gray-500 border-t pt-4">
                  <p>Thank you for choosing STAR TAILORS!</p>
                  <p>For any queries, please contact us.</p>
                </div>

                <div className="flex justify-center space-x-4 print:hidden">
                  <Button
                    onClick={printBill}
                    className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Print Bill
                  </Button>
                  <Button variant="outline" onClick={() => setShowBillPreview(false)}>
                    Close
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}
