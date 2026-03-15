import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  LayoutDashboard, MessageSquarePlus, BarChart3,
  Users, Bell, LogOut, Shield, Building2, ClipboardList, TableProperties, UserCog,
} from "lucide-react";
import { getInitials, getRoleColor, cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/api";

const ROLE_META: Record<string, { label: string; badgeClass: string }> = {
  admin: { label: "Admin", badgeClass: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  staff: { label: "Staff", badgeClass: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
  student: { label: "Student", badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
};

export function AppSidebar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const { data: unreadCount } = useQuery<number>({
    queryKey: ["/api/notifications/unread-count"],
    queryFn: () => authFetch("/api/notifications/unread-count").then((d) => d.count),
    enabled: !!user,
    refetchInterval: 30000,
  });

  const studentNav = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard },
    { title: "My Complaints", url: "/complaints", icon: ClipboardList },
    { title: "Submit Complaint", url: "/complaints/new", icon: MessageSquarePlus },
    { title: "Notifications", url: "/notifications", icon: Bell, badge: unreadCount },
  ];

  const staffNav = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard },
    { title: "Complaints", url: "/complaints", icon: ClipboardList },
    { title: "Notifications", url: "/notifications", icon: Bell, badge: unreadCount },
  ];

  const adminNav = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard },
    { title: "All Complaints", url: "/complaints", icon: ClipboardList },
    { title: "Manage Complaints", url: "/admin/complaints", icon: TableProperties },
    { title: "Submit Complaint", url: "/complaints/new", icon: MessageSquarePlus },
    { title: "Analytics", url: "/analytics", icon: BarChart3 },
    { title: "Users", url: "/users", icon: Users },
    { title: "Departments", url: "/departments", icon: Building2 },
    { title: "Notifications", url: "/notifications", icon: Bell, badge: unreadCount },
  ];

  const navItems = user?.role === "admin" ? adminNav : user?.role === "staff" ? staffNav : studentNav;
  const roleMeta = ROLE_META[user?.role ?? "student"];

  return (
    <Sidebar>
      {/* ── Logo header ─────────────────────────────────────────── */}
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary shadow-sm shrink-0">
            <Shield className="w-4 h-4 text-primary-foreground" />
          </div>
          {!isCollapsed && (
            <div className="overflow-hidden">
              <p className="font-bold text-sm leading-tight tracking-tight">UniCore</p>
              <p className="text-[10px] text-muted-foreground leading-tight truncate">Complaint System</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <Separator className="mx-4 w-auto" />

      {/* ── Navigation ──────────────────────────────────────────── */}
      <SidebarContent className="px-2 py-3">
        <SidebarGroup>
          {!isCollapsed && (
            <SidebarGroupLabel className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-2 mb-1">
              Navigation
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {navItems.map((navItem) => {
                const isActive = location === navItem.url || (navItem.url !== "/" && location.startsWith(navItem.url));
                const content = (
                  <Link href={navItem.url} data-testid={`nav-${navItem.title.toLowerCase().replace(/\s+/g, "-")}`}>
                    <navItem.icon className={cn("w-4 h-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                    {!isCollapsed && (
                      <>
                        <span className="flex-1 text-sm">{navItem.title}</span>
                        {navItem.badge && navItem.badge > 0 ? (
                          <Badge className="h-5 min-w-5 px-1 text-xs justify-center bg-primary text-primary-foreground">
                            {navItem.badge > 99 ? "99+" : navItem.badge}
                          </Badge>
                        ) : null}
                      </>
                    )}
                    {isCollapsed && navItem.badge && navItem.badge > 0 ? (
                      <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary" />
                    ) : null}
                  </Link>
                );

                return (
                  <SidebarMenuItem key={navItem.title}>
                    {isCollapsed ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <SidebarMenuButton
                            asChild
                            data-active={isActive}
                            className={cn(
                              "relative flex items-center justify-center rounded-md px-2.5 py-2 text-sm transition-all duration-150",
                              isActive
                                ? "bg-primary/10 text-primary font-medium border border-primary/20"
                                : "text-sidebar-foreground hover:bg-sidebar-accent"
                            )}
                          >
                            {content}
                          </SidebarMenuButton>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="text-xs">
                          {navItem.title}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <SidebarMenuButton
                        asChild
                        data-active={isActive}
                        className={cn(
                          "relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-all duration-150",
                          isActive
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-sidebar-foreground hover:bg-sidebar-accent"
                        )}
                      >
                        {content}
                      </SidebarMenuButton>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* ── Footer / user profile ───────────────────────────────── */}
      <SidebarFooter className="p-3 mt-auto">
        <Separator className="mb-3" />
        {user && (
          <div className={cn("flex items-center gap-2.5", isCollapsed ? "justify-center" : "px-1")}>
            {isCollapsed ? (
              <div className="flex flex-col items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link href="/profile" data-testid="nav-profile">
                      <Avatar className="w-8 h-8 cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all">
                        <AvatarFallback className="text-[10px] font-bold bg-primary text-primary-foreground">
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p className="font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button onClick={logout} data-testid="button-logout" className="text-muted-foreground hover:text-destructive transition-colors">
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Sign out</TooltipContent>
                </Tooltip>
              </div>
            ) : (
              <>
                <Link href="/profile" data-testid="nav-profile" className="shrink-0">
                  <Avatar className="w-8 h-8 cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all">
                    {user.profilePhoto && <AvatarImage src={user.profilePhoto} alt={user.name} />}
                    <AvatarFallback className="text-[10px] font-bold bg-primary text-primary-foreground">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                </Link>
                <div className="flex-1 min-w-0">
                  <Link href="/profile" className="hover:underline">
                    <p className="text-sm font-medium truncate leading-tight">{user.name}</p>
                  </Link>
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded-sm font-semibold inline-block mt-0.5", roleMeta.badgeClass)}>
                    {roleMeta.label}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="ghost" asChild className="w-7 h-7 text-muted-foreground hover:text-primary">
                        <Link href="/profile" aria-label="Edit profile">
                          <UserCog className="w-3.5 h-3.5" />
                        </Link>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Edit profile</TooltipContent>
                  </Tooltip>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={logout}
                    data-testid="button-logout"
                    title="Sign out"
                    className="w-7 h-7 text-muted-foreground hover:text-destructive"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
