import { AuthGuard } from "@/components/auth-guard"
import { TailorDashboard } from "@/components/tailor-dashboard"

export default function TailorPage() {
  return (
    <AuthGuard allowedRoles={["tailor"]}>
      <TailorDashboard />
    </AuthGuard>
  )
}
