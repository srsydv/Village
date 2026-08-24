import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell.jsx";
import { EntryScreen } from "./components/EntryScreen.jsx";
import { GroupScreen } from "./components/GroupScreen.jsx";
import { HistoryScreen } from "./components/HistoryScreen.jsx";
import { HomeScreen } from "./components/HomeScreen.jsx";
import { ServiceWorkerRegister } from "./components/ServiceWorkerRegister.jsx";
import { VillageHub } from "./components/VillageHub.jsx";
import { DirectoryScreen } from "./components/seva/DirectoryScreen.jsx";
import { JobsScreen } from "./components/seva/JobsScreen.jsx";
import { PostJobScreen } from "./components/seva/PostJobScreen.jsx";
import { SevaHome } from "./components/seva/SevaHome.jsx";
import { SevaShell } from "./components/seva/SevaShell.jsx";

export default function App() {
  return (
    <>
      <ServiceWorkerRegister />
      <Routes>
        <Route path="/" element={<VillageHub />} />
        <Route path="/samooh" element={<AppShell />}>
          <Route index element={<HomeScreen />} />
          <Route path="group" element={<GroupScreen />} />
          <Route path="entry" element={<EntryScreen />} />
          <Route path="history" element={<HistoryScreen />} />
        </Route>
        <Route path="/seva" element={<SevaShell />}>
          <Route index element={<SevaHome />} />
          <Route path="directory" element={<DirectoryScreen />} />
          <Route path="jobs" element={<JobsScreen />} />
          <Route path="post" element={<PostJobScreen />} />
        </Route>
        <Route path="/group" element={<Navigate to="/samooh/group" replace />} />
        <Route path="/entry" element={<Navigate to="/samooh/entry" replace />} />
        <Route path="/history" element={<Navigate to="/samooh/history" replace />} />
      </Routes>
    </>
  );
}
