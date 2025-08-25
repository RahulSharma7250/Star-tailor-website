import { AuthGuard } from "@/components/auth-guard"
import { BillingSystem } from "@/components/billing-system"

export default function BillingPage() {
  return (
    <AuthGuard allowedRoles={["admin", "billing"]}>
      <BillingSystem />
    </AuthGuard>
  )
}
