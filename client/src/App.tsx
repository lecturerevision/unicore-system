import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthProvider, useAuth } from "@/lib/auth";
import { EmailVerificationBanner } from "@/components/email-verification-banner";
import LandingPage from "@/pages/landing";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import VerifyEmailPage from "@/pages/verify-email";
import DashboardPage from "@/pages/dashboard";
import ComplaintsPage from "@/pages/complaints";
import NewComplaintPage from "@/pages/new-complaint";
import ComplaintDetailPage from "@/pages/complaint-detail";
import AnalyticsPage from "@/pages/analytics";
import UsersPage from "@/pages/users";
import DepartmentsPage from "@/pages/departments";
import NotificationsPage from "@/pages/notifications";
import AdminComplaintsPage from "@/pages/admin-complaints";
import ProfilePage from "@/pages/profile";
import NotFound from "@/pages/not-found";
import { Loader2 } from "lucide-react";

const sidebarStyle = {
  "--sidebar-width": "17rem",
  "--sidebar-width-icon": "3.5rem",
};

function AppLayout() {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <Switch>
        <Route path="/" component={LandingPage} />
        <Route path="/login" component={LoginPage} />
        <Route path="/register" component={RegisterPage} />
        <Route path="/verify-email">
          <VerifyEmailPage />
        </Route>
        <Route>
          <LandingPage />
        </Route>
      </Switch>
    );
  }

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full bg-background overflow-hidden">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <EmailVerificationBanner />
          <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-50">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-2">
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-y-auto flex flex-col">
            <Switch>
              <Route path="/" component={DashboardPage} />
              <Route path="/dashboard" component={DashboardPage} />
              <Route path="/profile" component={ProfilePage} />
              <Route path="/verify-email">
                <VerifyEmailPage />
              </Route>
              <Route path="/complaints/new" component={NewComplaintPage} />
              <Route path="/complaints/:id" component={ComplaintDetailPage} />
              <Route path="/complaints" component={ComplaintsPage} />
              <Route path="/analytics" component={AnalyticsPage} />
              <Route path="/admin/complaints" component={AdminComplaintsPage} />
              <Route path="/users" component={UsersPage} />
              <Route path="/departments" component={DepartmentsPage} />
              <Route path="/notifications" component={NotificationsPage} />
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <AppLayout />
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
