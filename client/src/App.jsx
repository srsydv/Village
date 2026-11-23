import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "./components/AppShell.jsx";
import { PhoneReminderSync } from "./components/PhoneReminders.jsx";
import { ChatScreen } from "./components/ChatScreen.jsx";
import { ExploreScreen } from "./components/ExploreScreen.jsx";
import { HomeScreen } from "./components/HomeScreen.jsx";
import { Onboarding } from "./components/Onboarding.jsx";
import { ChooseScreen } from "./components/ChooseScreen.jsx";
import { PlanScreen } from "./components/PlanScreen.jsx";
import { PrivacyPolicy } from "./components/PrivacyPolicy.jsx";
import { PrivacyScreen } from "./components/PrivacyScreen.jsx";
import { AdminScreen } from "./components/AdminScreen.jsx";
import { AdminUserScreen } from "./components/AdminUserScreen.jsx";
import { ServiceWorkerRegister } from "./components/ServiceWorkerRegister.jsx";
import { TripDetail, SharedTripDetail } from "./components/TripDetail.jsx";
import { TripsScreen } from "./components/TripsScreen.jsx";
import { useTravel } from "./lib/TravelContext.jsx";
import { GeminiGate } from "./components/SubscribeScreen.jsx";
import { Site } from "./components/site/Site.jsx";
import { TrySafar } from "./components/site/TrySafar.jsx";

export default function App() {
  const { ready, authChecked, account } = useTravel();
  const { pathname } = useLocation();
  const isAdmin = Boolean(account?.isAdmin);
  const adminView = pathname.startsWith("/admin");

  if (pathname === "/" || pathname === "/try") {
    if (window.Capacitor?.isNativePlatform?.()) return <Navigate to="/welcome" replace />;
    if (pathname === "/try") return <TrySafar />;
    return <Site />;
  }

  return (
    <div className="app-frame">
      <PhoneReminderSync />
      {!authChecked ? (
        <div className="phone-shell grid min-h-dvh place-items-center">
          <p className="kicker">Safar</p>
        </div>
      ) : (
        <div className={adminView ? "phone-shell phone-shell-admin" : "phone-shell"}>
        <ServiceWorkerRegister />
        <Routes>
          <Route path="/welcome" element={ready ? <Navigate to="/home" replace /> : <Onboarding />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route element={ready ? <AppShell /> : <Navigate to="/welcome" replace />}>
            <Route path="/home" element={<HomeScreen />} />
            <Route path="/explore" element={<ExploreScreen />} />
            <Route path="/plan" element={<GeminiGate><PlanScreen /></GeminiGate>} />
            <Route path="/choose" element={<ChooseScreen />} />
            <Route path="/trips" element={<TripsScreen />} />
            <Route path="/trips/shared/:shareId" element={<SharedTripDetail />} />
            <Route path="/trips/:id" element={<TripDetail />} />
            <Route path="/ask" element={<GeminiGate><ChatScreen /></GeminiGate>} />
            <Route path="/profile" element={<PrivacyScreen />} />
            <Route path="/admin" element={isAdmin ? <AdminScreen /> : <Navigate to="/home" replace />} />
            <Route path="/admin/users/:id" element={isAdmin ? <AdminUserScreen /> : <Navigate to="/home" replace />} />
          </Route>
          <Route path="*" element={<Navigate to={ready ? "/home" : "/welcome"} replace />} />
        </Routes>
        </div>
      )}
    </div>
  );
}
