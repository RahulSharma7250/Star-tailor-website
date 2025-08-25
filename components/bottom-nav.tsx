"use client"

import { useRouter, usePathname } from "next/navigation"
import { Home, Users, Receipt, Scissors, BarChart3 } from "lucide-react"

interface BottomNavProps {
  userRole?: string
}

export function BottomNav({ userRole }: BottomNavProps) {
  const router = useRouter()
  const pathname = usePathname()

  const navigationItems = [
    { href: "/admin", label: "Home", icon: Home, roles: ["admin"] },
    { href: "/admin/customers", label: "Customers", icon: Users, roles: ["admin", "billing"] },
    { href: "/admin/billing", label: "Billing", icon: Receipt, roles: ["admin", "billing"] },
    { href: "/admin/tailors", label: "Tailors", icon: Scissors, roles: ["admin"] },
    { href: "/admin/reports", label: "Reports", icon: BarChart3, roles: ["admin"] },
    { href: "/tailor", label: "Jobs", icon: Scissors, roles: ["tailor"] },
  ]

  const filteredItems = navigationItems.filter((item) => item.roles.includes(userRole || ""))

  if (!userRole || filteredItems.length === 0) return null

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="grid grid-cols-4 gap-1 p-2">
        {filteredItems.slice(0, 4).map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-colors ${
                isActive ? "bg-blue-50 text-blue-600" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Icon className="h-5 w-5 mb-1" />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
