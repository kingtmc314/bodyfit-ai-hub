import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import AppLayout from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Nutrition from "./pages/Nutrition";
import Workout from "./pages/Workout";
import BodyComposition from "./pages/BodyComposition";
import HeartRate from "./pages/HeartRate";
import Sleep from "./pages/Sleep";
import ProgressPhotos from "./pages/ProgressPhotos";
import Insights from "./pages/Insights";
import Login from "./pages/Login";
import Import from "./pages/Import";
import Trends from "./pages/Trends";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={() => <AppLayout><Dashboard /></AppLayout>} />
      <Route path="/nutrition" component={() => <AppLayout><Nutrition /></AppLayout>} />
      <Route path="/workout" component={() => <AppLayout><Workout /></AppLayout>} />
      <Route path="/body" component={() => <AppLayout><BodyComposition /></AppLayout>} />
      <Route path="/heart-rate" component={() => <AppLayout><HeartRate /></AppLayout>} />
      <Route path="/sleep" component={() => <AppLayout><Sleep /></AppLayout>} />
      <Route path="/photos" component={() => <AppLayout><ProgressPhotos /></AppLayout>} />
      <Route path="/insights" component={() => <AppLayout><Insights /></AppLayout>} />
      <Route path="/import" component={() => <AppLayout><Import /></AppLayout>} />
      <Route path="/trends" component={() => <AppLayout><Trends /></AppLayout>} />
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
