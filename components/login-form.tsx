"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { authAPI } from "@/lib/api"

export function LoginForm() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      if (username && password && role) {
        const response = await authAPI.login(username, password)

        toast({
          title: "Login Successful",
          description: `Welcome back, ${response.user.name}!`,
        })

        switch (response.user.role) {
          case "admin":
            router.push("/admin")
            break
          case "tailor":
            router.push("/tailor")
            break
          case "billing":
            router.push("/admin/billing")
            break
          default:
            router.push("/admin")
        }
      } else {
        toast({
          title: "Login Failed",
          description: "Please fill in all fields",
          variant: "destructive",
        })
      }
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: error.message || "Invalid credentials",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full glass-effect shadow-2xl border-0 backdrop-blur-xl">
      <CardHeader className="space-y-2 pb-8">
        <CardTitle className="text-2xl md:text-3xl text-center font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
          Welcome Back
        </CardTitle>
        <CardDescription className="text-center text-base text-gray-600">
          Enter your credentials to access your tailoring dashboard
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-3">
            <Label htmlFor="username" className="text-sm font-semibold text-gray-700">
              Username
            </Label>
            <Input
              id="username"
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="h-12 text-base border-2 border-gray-200 focus:border-violet-500 focus:ring-violet-500/20 transition-all duration-200 bg-white/80"
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="password" className="text-sm font-semibold text-gray-700">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-12 text-base border-2 border-gray-200 focus:border-violet-500 focus:ring-violet-500/20 transition-all duration-200 bg-white/80"
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="role" className="text-sm font-semibold text-gray-700">
              Role
            </Label>
            <Select value={role} onValueChange={setRole} required>
              <SelectTrigger className="h-12 text-base border-2 border-gray-200 focus:border-violet-500 focus:ring-violet-500/20 transition-all duration-200 bg-white/80">
                <SelectValue placeholder="Select your role" />
              </SelectTrigger>
              <SelectContent className="bg-white/95 backdrop-blur-sm">
                <SelectItem value="admin" className="text-base py-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-violet-500 rounded-full"></div>
                    <span>Admin</span>
                  </div>
                </SelectItem>
                <SelectItem value="tailor" className="text-base py-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <span>Tailor</span>
                  </div>
                </SelectItem>
                <SelectItem value="billing" className="text-base py-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                    <span>Billing Staff</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            type="submit"
            className="w-full h-12 text-base font-semibold bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 transform hover:scale-[1.02] transition-all duration-200 shadow-lg hover:shadow-xl"
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Signing in...</span>
              </div>
            ) : (
              "Get Started Today"
            )}
          </Button>
        </form>

        <div className="text-center pt-4">
          <p className="text-sm text-gray-500">Crafted with precision for tailoring professionals</p>
          <p className="text-xs text-gray-400 mt-2">Demo: admin / admin123 | tailor / tailor123 | billing / billing123</p>
        </div>
      </CardContent>
    </Card>
  )
}
