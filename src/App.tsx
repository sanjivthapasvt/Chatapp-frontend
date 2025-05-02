import { useState, useEffect, ReactNode } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
  Navigate,
  useNavigate,
} from "react-router-dom";
import Chats from "./components/sideBar";
import Auth from "./components/auth";
import Friends from "./components/friends";
import Home from "./components/home";
import ChatRoom from "./components/chatRoom";
import Notification from "./components/notification";
import Profile from "./components/profile";
import { ChatProvider } from "./services/ChatContext";

type ProtectedRouteProps = {
  children: ReactNode;
};

function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isAuthenticated = !!localStorage.getItem("token");
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/auth");
    }
  }, [isAuthenticated, navigate]);

  return isAuthenticated ? children : null;
}

function Layout() {
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(
    !!localStorage.getItem("token")
  );

  // update authentication state whenever the location changes
  useEffect(() => {
    setIsAuthenticated(!!localStorage.getItem("token"));
  }, [location]);

  // Only show sidebar when authenticated
  const showChats = isAuthenticated && !location.pathname.startsWith("/auth");

  return (
    <div className="w-full h-full flex overflow-x-hidden">
      {showChats && <Chats />}
      <div className={`flex-grow ${showChats ? "ml-0 md:ml-64" : "w-full"}`}>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route
            path="/home"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notification"
            element={
              <ProtectedRoute>
                <Notification />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chatroom/:id"
            element={
              <ProtectedRoute>
                <ChatRoom />
              </ProtectedRoute>
            }
          />
          <Route
            path="/friends"
            element={
              <ProtectedRoute>
                <Friends />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/home" />} />
        </Routes>
      </div>
    </div>
  );
}

function App() {
  return (
    <ChatProvider>
      <Router>
        <Layout />
      </Router>
    </ChatProvider>
  );
}

export default App;
