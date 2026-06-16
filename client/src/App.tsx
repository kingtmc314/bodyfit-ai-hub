import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import AppLayout from "./components/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";

// Eagerly loaded (small, needed immediately)
import NotFound from "@/pages/NotFound";
import AuthCallback from "@/pages/AuthCallback";
import Login from "@/pages/Login";
import Dashboard from "./pages/Dashboard";

// Lazily loaded (large pages — split into separate chunks)
const Nutrition = lazy(() => import("./pages/Nutrition"));
const Workout = lazy(() => import("./pages/Workout"));
const BodyComposition = lazy(() => import("./pages/BodyComposition"));
const HeartRate = lazy(() => import("./pages/HeartRate"));
const Sleep = lazy(() => import("./pages/Sleep"));
const ProgressPhotos = lazy(() => import("./pages/ProgressPhotos"));
const Insights = lazy(() => import("./pages/Insights"));
const Import = lazy(() => import("./pages/Import"));
const Trends = lazy(() => import("./pages/Trends"));
const Goals = lazy(() => import("./pages/Goals"));
const Running = lazy(() => import("./pages/Running"));
const Steps = lazy(() => import("./pages/Steps"));
const Medical = lazy(() => import("./pages/Medical"));
const Supplements = lazy(() => import("./pages/Supplements"));
const BloodPressure = lazy(() => import("./pages/BloodPressure"));
const PhysioTherapy = lazy(() => import("./pages/PhysioTherapy"));
const Fasting = lazy(() => import("./pages/Fasting"));

const PageLoader = () => (
  <div className="p-6 space-y-4">
    <Skeleton className="h-8 w-48" />
    <Skeleton className="h-32 w-full rounded-2xl" />
    <div className="grid grid-cols-2 gap-3">
      <Skeleton className="h-24 rounded-2xl" />
      <Skeleton className="h-24 rounded-2xl" />
      <Skeleton className="h-24 rounded-2xl" />
      <Skeleton className="h-24 rounded-2xl" />
    </div>
  </div>
);

const Lazy = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<PageLoader />}>{children}</Suspense>
);

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <AppLayout><Dashboard /></AppLayout>} />
      <Route path="/nutrition" component={() => <AppLayout><Lazy><Nutrition /></Lazy></AppLayout>} />
      <Route path="/workout" component={() => <AppLayout><Lazy><Workout /></Lazy></AppLayout>} />
      <Route path="/body" component={() => <AppLayout><Lazy><BodyComposition /></Lazy></AppLayout>} />
      <Route path="/heart-rate" component={() => <AppLayout><Lazy><HeartRate /></Lazy></AppLayout>} />
      <Route path="/sleep" component={() => <AppLayout><Lazy><Sleep /></Lazy></AppLayout>} />
      <Route path="/photos" component={() => <AppLayout><Lazy><ProgressPhotos /></Lazy></AppLayout>} />
      <Route path="/insights" component={() => <AppLayout><Lazy><Insights /></Lazy></AppLayout>} />
      <Route path="/import" component={() => <AppLayout><Lazy><Import /></Lazy></AppLayout>} />
      <Route path="/trends" component={() => <AppLayout><Lazy><Trends /></Lazy></AppLayout>} />
      <Route path="/goals" component={() => <AppLayout><Lazy><Goals /></Lazy></AppLayout>} />
      <Route path="/running" component={() => <AppLayout><Lazy><Running /></Lazy></AppLayout>} />
      <Route path="/steps" component={() => <AppLayout><Lazy><Steps /></Lazy></AppLayout>} />
      <Route path="/medical" component={() => <AppLayout><Lazy><Medical /></Lazy></AppLayout>} />
      <Route path="/supplements" component={() => <AppLayout><Lazy><Supplements /></Lazy></AppLayout>} />
      <Route path="/blood-pressure" component={() => <AppLayout><Lazy><BloodPressure /></Lazy></AppLayout>} />
      <Route path="/physio" component={() => <AppLayout><Lazy><PhysioTherapy /></Lazy></AppLayout>} />
      <Route path="/fasting" component={() => <AppLayout><Lazy><Fasting /></Lazy></AppLayout>} />
      <Route path="/login" component={Login} />
      <Route path="/auth/callback" component={AuthCallback} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
