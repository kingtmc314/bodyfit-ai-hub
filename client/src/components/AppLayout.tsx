import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  LayoutDashboard,
  Utensils,
  Dumbbell,
  Scale,
  Heart,
  Moon,
  Camera,
  Sparkles,
  Menu,
  X,
  LogOut,
  Sun,
  ChevronRight,
  Activity,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";

const navItems = [
  { path: "/", label: "Dashboard", labelZh: "儀表板", icon: LayoutDashboard, color: "text-primary" },
  { path: "/nutrition", label: "Nutrition", labelZh: "飲食追蹤", icon: Utensils, color: "text-[oklch(0.78_0.20_50)]" },
  { path: "/workout", label: "Workout", labelZh: "健身記錄", icon: Dumbbell, color: "text-[oklch(0.75_0.17_280)]" },
  { path: "/body", label: "Body Composition", labelZh: "身體成份", icon: Scale, color: "text-[oklch(0.72_0.19_160)]" },
  { path: "/heart-rate", label: "Heart Rate", labelZh: "心跳管理", icon: Heart, color: "text-[oklch(0.68_0.22_25)]" },
  { path: "/sleep", label: "Sleep", labelZh: "睡眠管理", icon: Moon, color: "text-[oklch(0.65_0.18_200)]" },
  { path: "/photos", label: "Progress Photos", labelZh: "進度相片", icon: Camera, color: "text-[oklch(0.75_0.17_280)]" },
  { path: "/insights", label: "AI Insights", labelZh: "AI 健康分析", icon: Sparkles, color: "text-primary" },
];

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, loading, isAuthenticated, logout } = useAuth();
  const { theme, toggleTheme, switchable } = useTheme();
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => { window.location.href = "/login"; }
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Activity className="w-10 h-10 text-primary animate-pulse" />
          <p className="text-muted-foreground text-sm">Loading BodyFit AI Hub…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  const initials = user?.name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "BF";

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
        <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center">
          <Activity className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-bold text-sidebar-foreground leading-none">BodyFit AI</p>
          <p className="text-xs text-sidebar-foreground/50 mt-0.5">Health Hub</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location === item.path;
          return (
            <Link key={item.path} href={item.path} onClick={() => setSidebarOpen(false)}>
              <div className={cn(
                "nav-item cursor-pointer",
                isActive && "active"
              )}>
                <item.icon className={cn("w-4.5 h-4.5 shrink-0", isActive ? "text-primary" : item.color)} />
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-medium leading-none", isActive ? "text-primary" : "text-sidebar-foreground")}>
                    {item.label}
                  </p>
                  <p className="text-xs text-sidebar-foreground/40 mt-0.5">{item.labelZh}</p>
                </div>
                {isActive && <ChevronRight className="w-3.5 h-3.5 text-primary shrink-0" />}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
          <Avatar className="w-8 h-8 shrink-0">
            <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.name || "User"}</p>
            <p className="text-xs text-sidebar-foreground/40 truncate">{user?.email || ""}</p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="w-7 h-7 text-sidebar-foreground/60 hover:text-sidebar-foreground" onClick={toggleTheme}>
              {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </Button>
            <Button variant="ghost" size="icon" className="w-7 h-7 text-sidebar-foreground/60 hover:text-destructive" onClick={() => logoutMutation.mutate()}>
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-60 shrink-0 flex-col bg-sidebar border-r border-sidebar-border">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-sidebar border-r border-sidebar-border">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card/50 backdrop-blur-sm">
          <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            <span className="font-bold text-sm">BodyFit AI</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="icon" className="w-8 h-8" onClick={toggleTheme}>
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
