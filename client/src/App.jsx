import { Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell.jsx";
import { EntryScreen } from "./components/EntryScreen.jsx";
import { GroupScreen } from "./components/GroupScreen.jsx";
import { HistoryScreen } from "./components/HistoryScreen.jsx";
import { HomeScreen } from "./components/HomeScreen.jsx";

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/group" element={<GroupScreen />} />
        <Route path="/entry" element={<EntryScreen />} />
        <Route path="/history" element={<HistoryScreen />} />
      </Routes>
    </AppShell>
  );
}
