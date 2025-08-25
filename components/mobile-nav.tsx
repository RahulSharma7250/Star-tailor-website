"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { useRouter, usePathname } from "next/navigation"
import { Menu, Home, Users, Receipt, Scissors, BarChart3, LogOut, X } from "lucide-react"

interface MobileNavProps {
  user?: any
  onLogout?: () => void
}

export function MobileNav({ user, onLogout }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  const navigationItems = [
    { href: "/admin", label: "Dashboard", icon: Home, roles: ["admin"] },
    { href: "/admin/customers", label: "Customers", icon: Users, roles: ["admin", "billing"] },
    { href: "/admin/billing", label: "Billing", icon: Receipt, roles: ["admin", "billing"] },
    { href: "/admin/tailors", label: "Tailors", icon: Scissors, roles: ["admin"] },
    { href: "/admin/reports", label: "Reports", icon: BarChart3, roles: ["admin"] },
    { href: "/tailor", label: "My Jobs", icon: Scissors, roles: ["tailor"] },
  ]

  const filteredItems = navigationItems.filter((item) => item.roles.includes(user?.role))

  const handleNavigation = (href: string) => {
    router.push(href)
    setIsOpen(false)
  }

  return (
    <div className="md:hidden">
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="sm">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[300px] bg-white">
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-6 border-b bg-blue-600 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">STAR TAILORS</h2>
                  {user && (
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-sm opacity-90">{user.username}</span>
                      <Badge variant="secondary" className="text-xs">
                        {user.role}
                      </Badge>
                    </div>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)} className="text-white">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Navigation Items */}
            <div className="flex-1 py-4">
              <nav className="flex flex-col gap-4 px-4">
                {filteredItems.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname === item.href
                  return (
                    <button
                      key={item.href}
                      onClick={() => handleNavigation(item.href)}
                      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${
                        isActive ? "bg-blue-50 text-blue-600 border border-blue-200" : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="font-medium">{item.label}</span>
                    </button>
                  )
                })}
              </nav>
            </div>

            {/* Footer */}
            {onLogout && (
              <div className="p-4 border-t">
                <Button variant="outline" onClick={onLogout} className="w-full bg-transparent">
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
