import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell.jsx";
import { ChatScreen } from "./components/ChatScreen.jsx";
import { ExploreScreen } from "./components/ExploreScreen.jsx";
import { HomeScreen } from "./components/HomeScreen.jsx";
import { Onboarding } from "./components/Onboarding.jsx";
import { PlanScreen } from "./components/PlanScreen.jsx";
import { PrivacyScreen } from "./components/PrivacyScreen.jsx";
import { ServiceWorkerRegister } from "./components/ServiceWorkerRegister.jsx";
import { TripDetail } from "./components/TripDetail.jsx";
import { TripsScreen } from "./components/TripsScreen.jsx";
import { useTravel } from "./lib/TravelContext.jsx";

export default function App() {
  const { ready } = useTravel();

  return (
    <div className="app-frame">
      <div className="phone-shell">
        <ServiceWorkerRegister />
        <Routes>
          <Route path="/welcome" element={ready ? <Navigate to="/" replace /> : <Onboarding />} />
          <Route path="/privacy" element={<PrivacyScreen />} />
          <Route element={ready ? <AppShell /> : <Navigate to="/welcome" replace />}>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/explore" element={<ExploreScreen />} />
            <Route path="/plan" element={<PlanScreen />} />
            <Route path="/trips" element={<TripsScreen />} />
            <Route path="/trips/:id" element={<TripDetail />} />
            <Route path="/ask" element={<ChatScreen />} />
          </Route>
          <Route path="*" element={<Navigate to={ready ? "/" : "/welcome"} replace />} />
        </Routes>
      </div>
    </div>
  );
}
