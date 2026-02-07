import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Conflicts from "./pages/Conflicts";
import FolgaViolations from "./pages/FolgaViolations";
import DeslocamentoRisks from "./pages/DeslocamentoRisks";
import InterjornadaAlerts from "./pages/InterjornadaAlerts";
import PersonProfile from "./pages/PersonProfile";
import GradesAnalysis from "./pages/GradesAnalysis";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/dashboard/:runId"} component={Dashboard} />
      <Route path={"/conflicts/:runId"} component={Conflicts} />
      <Route path={"/folga/:runId"} component={FolgaViolations} />
      <Route path={"/deslocamento/:runId"} component={DeslocamentoRisks} />
      <Route path={"/interjornada/:runId"} component={InterjornadaAlerts} />
      <Route path={"/profile/:runId"} component={PersonProfile} />
      <Route path={"/grades"} component={GradesAnalysis} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
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

export default App;
