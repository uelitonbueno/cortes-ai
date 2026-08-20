import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import Analytics from "@/pages/Analytics";
import Home from "@/pages/Home";
import Publications from "@/pages/Publications";
import PipelineDetail from "@/pages/PipelineDetail";
import Review from "@/pages/Review";
import SettingsIntegrations from "@/pages/SettingsIntegrations";
import Videos from "@/pages/Videos";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/videos" component={Videos} />
      <Route path="/videos/:id" component={PipelineDetail} />
      <Route path="/review" component={Review} />
      <Route path="/publications" component={Publications} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/settings" component={SettingsIntegrations} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
