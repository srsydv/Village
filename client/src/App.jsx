import { Navigate, Route, Routes } from "react-router-dom";
import { ServiceWorkerRegister } from "./components/ServiceWorkerRegister.jsx";
import { ChatInbox, ChatThread } from "./components/news/ChatScreen.jsx";
import { ComposePost } from "./components/news/ComposePost.jsx";
import { NewsShell } from "./components/news/NewsShell.jsx";
import { OfficialFeed } from "./components/news/OfficialFeed.jsx";
import { ProfileScreen } from "./components/news/ProfileScreen.jsx";
import { PostDetail } from "./components/news/PostDetail.jsx";
import { UserProfile } from "./components/news/UserProfile.jsx";
import { VillageFeed } from "./components/news/VillageFeed.jsx";

export default function App() {
  return (
    <>
      <ServiceWorkerRegister />
      <Routes>
        <Route path="/" element={<Navigate to="/news" replace />} />
        <Route path="/news" element={<NewsShell />}>
          <Route index element={<VillageFeed />} />
          <Route path="official" element={<OfficialFeed />} />
          <Route path="compose" element={<ComposePost />} />
          <Route path="profile" element={<ProfileScreen />} />
          <Route path="saved" element={<VillageFeed savedOnly />} />
          <Route path="post/:postId" element={<PostDetail />} />
          <Route path="u/:userId" element={<UserProfile />} />
          <Route path="chat" element={<ChatInbox />} />
          <Route path="chat/dm/:peerId" element={<ChatThread />} />
          <Route path="chat/group/:groupId" element={<ChatThread />} />
        </Route>
        <Route path="/samooh/*" element={<Navigate to="/news" replace />} />
        <Route path="/seva/*" element={<Navigate to="/news" replace />} />
        <Route path="/group" element={<Navigate to="/news" replace />} />
        <Route path="/entry" element={<Navigate to="/news" replace />} />
        <Route path="/history" element={<Navigate to="/news" replace />} />
      </Routes>
    </>
  );
}
