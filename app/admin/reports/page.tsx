import { AuthGuard } from "@/components/auth-guard"
import { ReportsModule } from "@/components/reports-module"

export default function ReportsPage() {
  return (
    <AuthGuard allowedRoles={["admin"]}>
      <ReportsModule />
    </AuthGuard>
  )
}
