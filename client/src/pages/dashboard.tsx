import { useAuth } from "@/lib/auth";
import StudentDashboard from "./student-dashboard";
import StaffDashboard from "./staff-dashboard";
import AdminDashboard from "./admin-dashboard";

export default function DashboardPage() {
  const { user } = useAuth();

  if (user?.role === "admin") return <AdminDashboard />;
  if (user?.role === "staff") return <StaffDashboard />;
  return <StudentDashboard />;
}
