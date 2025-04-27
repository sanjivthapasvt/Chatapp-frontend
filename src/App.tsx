// import { useState } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Chats from "./components/chats";
import Auth from "./components/auth";
import Friends from "./components/friends";
import Home from "./components/home";
import ChatRoom from "./components/chatRoom";
import Notification from "./components/notification";
import Profile from "./components/profile";

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Auth />} />
          <Route path="/home" element={<Home />} />
          <Route path="/chat" element={<Chats />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/notification" element={<Notification />} />
          <Route path="/room" element={<ChatRoom />} />
          <Route path="/friends" element={<Friends />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
