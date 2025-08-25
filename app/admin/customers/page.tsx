import { AuthGuard } from "@/components/auth-guard"
import { CustomerManagement } from "@/components/customer-management"

export default function CustomersPage() {
  return (
    <AuthGuard allowedRoles={["admin", "billing"]}>
      <CustomerManagement />
    </AuthGuard>
  )
}
