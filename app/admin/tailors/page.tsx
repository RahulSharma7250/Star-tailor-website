import { AuthGuard } from "@/components/auth-guard"
import { TailorManagement } from "@/components/tailor-management"

export default function TailorsPage() {
  return (
    <AuthGuard allowedRoles={["admin"]}>
      <TailorManagement />
    </AuthGuard>
  )
}
