import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
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
  Sun,
  ChevronRight,
  Activity,
  Languages,
  Upload,
  TrendingUp,
  Target,
  Footprints,
  Stethoscope,
  Pill,
  Droplets,
  Timer,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { APP_VERSION } from "@/lib/appMeta";
import { useTranslation } from "react-i18next";

type NavGroup = {
  groupKey: string;
  items: { path: string; key: string; icon: React.ElementType; badgeClass: string }[];
};

const navGroups: NavGroup[] = [
  {
    groupKey: "group_overview",
    items: [
      { path: "/",         key: "dashboard", icon: LayoutDashboard, badgeClass: "icon-badge-orange" },
      { path: "/insights", key: "insights",  icon: Sparkles,        badgeClass: "icon-badge-orange" },
      { path: "/trends",   key: "trends",    icon: TrendingUp,      badgeClass: "icon-badge-blue"   },
      { path: "/goals",    key: "goals",     icon: Target,          badgeClass: "icon-badge-orange" },
    ],
  },
  {
    groupKey: "group_fitness",
    items: [
      { path: "/workout",    key: "workout",  icon: Dumbbell,   badgeClass: "icon-badge-blue"   },
      { path: "/running",    key: "running",  icon: Footprints, badgeClass: "icon-badge-red"    },
      { path: "/steps",      key: "steps",    icon: Activity,   badgeClass: "icon-badge-green"  },
    ],
  },
  {
    groupKey: "group_health",
    items: [
      { path: "/nutrition",  key: "nutrition",    icon: Utensils,     badgeClass: "icon-badge-yellow" },
      { path: "/fasting",    key: "fasting",      icon: Timer,        badgeClass: "icon-badge-orange" },
      { path: "/body",       key: "body",         icon: Scale,        badgeClass: "icon-badge-green"  },
      { path: "/heart-rate",     key: "heartrate",      icon: Heart,      badgeClass: "icon-badge-red"    },
      { path: "/blood-pressure",  key: "bloodpressure",  icon: Droplets,   badgeClass: "icon-badge-red"    },
      { path: "/sleep",           key: "sleep",          icon: Moon,       badgeClass: "icon-badge-purple" },
      { path: "/supplements",     key: "supplements",    icon: Pill,       badgeClass: "icon-badge-blue"   },
    ],
  },
  {
    groupKey: "group_records",
    items: [
      { path: "/medical",  key: "medical",  icon: Stethoscope, badgeClass: "icon-badge-red"    },
      { path: "/physio",   key: "physio",   icon: Activity,    badgeClass: "icon-badge-teal"   },
      { path: "/photos",   key: "photos",   icon: Camera,      badgeClass: "icon-badge-blue"   },
      { path: "/import",   key: "import",   icon: Upload,      badgeClass: "icon-badge-green"  },
    ],
  },
];

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { t, i18n } = useTranslation();

  const toggleLanguage = () => {
    const next = i18n.language === 'zh' ? 'en' : 'zh';
    i18n.changeLanguage(next);
    localStorage.setItem('bf-lang', next);
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="app-brand px-5 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3.5">
          <div className="brand-mark w-10 h-10 rounded-2xl hero-gradient flex items-center justify-center shadow-md">
            <Activity className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-[15px] font-extrabold text-foreground leading-none tracking-tight gradient-text">BodyFit AI</p>
            <p className="text-[11px] text-muted-foreground mt-1 font-semibold tracking-wide">{t('app.tagline').split(' ').slice(0,3).join(' ')}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {navGroups.map((group, gi) => (
          <div key={group.groupKey} className={gi > 0 ? "mt-3" : ""}>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground/55 px-2 mb-1.5">
              {t(`nav.${group.groupKey}`, { defaultValue: '' })}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = location === item.path;
                return (
                  <Link key={item.path} href={item.path} onClick={() => setSidebarOpen(false)}>
                    <div className={cn("nav-item", isActive && "active")}>
                      <div className={cn("icon-badge", item.badgeClass)}>
                        <item.icon className="w-4 h-4" />
                      </div>
                      <span className={cn(
                        "text-sm font-semibold flex-1",
                        isActive ? "text-primary" : "text-foreground/80"
                      )}>
                        {t(`nav.${item.key}`)}
                      </span>
                      {isActive && <ChevronRight className="w-3.5 h-3.5 text-primary shrink-0" />}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom controls */}
      <div className="border-t border-sidebar-border p-3 app-sidebar-footer">
        <div className="flex items-center gap-2.5 px-2.5 py-2.5 rounded-2xl bg-secondary/55 border border-white/70 dark:border-white/5">
          <div className="w-8 h-8 rounded-xl hero-gradient flex items-center justify-center shrink-0 shadow-sm">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">kingmath</p>
            <p className="text-xs text-muted-foreground truncate">BodyFit AI Hub</p>
          </div>
          <div className="flex items-center gap-0.5">
            {/* Language toggle */}
            <Button
              variant="ghost" size="icon"
              className="w-7 h-7 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg"
              onClick={toggleLanguage}
              title={i18n.language === 'zh' ? 'Switch to English' : '切換中文'}
            >
              <Languages className="w-3.5 h-3.5" />
            </Button>
            {/* Theme toggle */}
            <Button
              variant="ghost" size="icon"
              className="w-7 h-7 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg"
              onClick={toggleTheme}
            >
              {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground/60 text-center mt-2.5 select-none font-semibold tracking-wide">v{APP_VERSION}</p>
      </div>
    </div>
  );

  return (
    <div className="app-frame flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="app-sidebar hidden lg:flex w-[17rem] shrink-0 flex-col bg-card border-r border-border shadow-sm">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="app-sidebar absolute left-0 top-0 bottom-0 w-[17rem] bg-card border-r border-border shadow-xl">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="mobile-topbar lg:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card shadow-sm">
          <Button variant="ghost" size="icon" className="w-9 h-9 rounded-xl" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl hero-gradient flex items-center justify-center shadow-sm">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="block font-extrabold text-sm leading-none gradient-text">BodyFit AI</span>
              <span className="block text-[9px] text-muted-foreground mt-0.5 font-semibold tracking-wide">v{APP_VERSION}</span>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" className="w-8 h-8" onClick={toggleLanguage}>
              <Languages className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="w-8 h-8" onClick={toggleTheme}>
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="app-main flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
