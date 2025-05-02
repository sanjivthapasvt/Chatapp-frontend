import {
  BrowserRouter as Router,
  Routes,
  Route,
  // Navigate,
  useLocation,
} from "react-router-dom";
import Chats from "./components/sideBar";
import Auth from "./components/auth";
import Friends from "./components/friends";
import Home from "./components/home";
import ChatRoom from "./components/chatRoom";
import Notification from "./components/notification";
import Profile from "./components/profile";

function Layout() {
  const location = useLocation();
  const showChats = !location.pathname.startsWith("/auth");

  // function NotFoundRedirect() {
  //   return <Navigate to="/home" />;
  // }

  return (
    <div className="w-full h-full flex overflow-x-hidden">
      {showChats && <Chats />}
      <div className={`flex-grow ${showChats ? "ml-0 md:ml-64" : "w-full"}`}>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/home" element={<Home />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/notification" element={<Notification />} />
          <Route path="/chatroom/:id" element={<ChatRoom />} />
          <Route path="/friends" element={<Friends />} />
          {/* <Route path="*" element={<NotFoundRedirect />} /> */}
        </Routes>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Layout/>
    </Router>
  );
}

export default App;
