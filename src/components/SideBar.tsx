import { useState, useContext, useEffect, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogOut, Settings } from "lucide-react";
import { FaUser } from "react-icons/fa";
import axiosInstance from "../services/AxiosInstance";
import { handleLogout } from "../services/AuthService";
import { ChatContext } from "../services/ChatContext";
import { ChatDetails } from "../services/interface";

function Chats() {
  const context = useContext(ChatContext);
  if (!context) return null;

  // Base API URL from environment variables
  const baseUrl = import.meta.env.VITE_BASE_URL;
  const WsBaseUrl = import.meta.env.VITE_WS_URL;

  // State to store loading status
  const [loading, setLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);

  const { userInfo, chatList, setUserInfo, setChatList } = context;
  const navigate = useNavigate();
  const location = useLocation();

  // State for chatroom search
  const [searchTerm, setSearchTerm] = useState("");

  // Check if the user is authenticated
  const isAuthenticated = !!localStorage.getItem("token");

  // Function to fetch chats info from API
  const fetchChats = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      setLoading(true);
      const response = await axiosInstance.get(`${baseUrl}/chatrooms/`, {
        params: {
          search: searchTerm,
          ordering: "lastmessage",
        },
      });
      const data = response.data;
      setChatList(Array.isArray(data.results) ? data.results : []);
    } catch (error) {
      console.error("Error fetching chats", error);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, searchTerm, isAuthenticated, setChatList]);

  // Function to fetch user info from API
  const fetchUser = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const response = await axiosInstance.get(`${baseUrl}/profile/`);
      const data = response.data;
      setUserInfo(data);
    } catch (error) {
      console.error("Cannot fetch user info", error);
    }
  }, [baseUrl, isAuthenticated, setUserInfo]);

  // Fetch user info on mount and when authentication changes
  useEffect(() => {
    if (isAuthenticated) {
      fetchUser();
    }
  }, [fetchUser, isAuthenticated]);

  // Fetch chatrooms when user info is available
  useEffect(() => {
    if (userInfo) {
      fetchChats();
    }
  }, [userInfo, fetchChats]);

  // Setup WebSocket connection
  useEffect(() => {
    if (!isAuthenticated || wsConnected) return;

    const token = localStorage.getItem("token");
    if (!token) return;

    const wsConnection = new WebSocket(`${WsBaseUrl}/sidebar/?token=${token}`);

    wsConnection.onopen = () => {
      console.log("Sidebar Websocket Connected");
      setWsConnected(true);
      setWs(wsConnection);
    };

    wsConnection.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("WebSocket message received:", data);

        if (data.type === "group_created" && data.group) {
          // Add the new group at the top
          setChatList((prev) => [data.group, ...prev]);
        } else if (data.type === "last_message_updated") {
          // Refresh the entire chat list
          fetchChats();
        }
      } catch (error) {
        console.error("Error processing WebSocket message:", error);
      }
    };

    wsConnection.onclose = () => {
      console.log("Sidebar WebSocket disconnected");
      setWsConnected(false);
      setWs(null);
    };

    wsConnection.onerror = (error) => {
      console.error("WebSocket error:", error);
      setWsConnected(false);
      setWs(null);
    };

    return () => {
      if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
        wsConnection.close();
      }
    };
  }, [isAuthenticated, wsConnected, WsBaseUrl, fetchChats, setChatList]);

  // Logout function
  const logout = async () => {
    if (context) {
      // Close WebSocket connection before logout
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      await handleLogout(navigate, context.logout);
    }
  };

  // If not authenticated, don't render the sidebar
  if (!isAuthenticated) return null;

  return (
    <div
      id="sidebar"
      className="fixed left-0 top-0 h-full bg-gray-900 text-white transition-all duration-300 z-40 shadow-xl 
          md:w-64 w-64 flex flex-col"
    >
      {/* Chat sidebar navigation */}
      <nav className="mt-2 px-2 flex-grow overflow-y-auto">
        {/* Chatroom search input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchChats();
          }}
        >
          <input
            type="text"
            placeholder="Search chats..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-2 bg-gray-800 rounded-md text-white mb-3"
          />
        </form>
        {/* Show loading or chat list */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            Loading...
          </div>
        ) : (
          <ul className="space-y-1">
            {chatList.length > 0 ? (
              chatList.map((chatroom: ChatDetails) => {
                // Highlight currently active chatroom
                const isActive =
                  location.pathname === `/chatroom/${chatroom.id}`;

                return (
                  <li key={chatroom.id}>
                    <Link
                      to={`/chatroom/${chatroom.id}`}
                      className={`flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-200
                              ${
                                isActive
                                  ? "bg-indigo-600 text-white"
                                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
                              }`}
                    >
                      {/* Chatroom image or fallback icon */}
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                        {chatroom.group_image ? (
                          <img
                            src={chatroom.group_image}
                            alt="Group"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <FaUser className="text-gray-500 w-6 h-6" />
                        )}
                      </div>

                      {/* Chatroom name and last message */}
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {chatroom.room_name}
                        </span>
                        <span className="text-xs text-gray-500">
                          {chatroom.last_message
                            ? chatroom.last_message.content
                            : "No message yet"}
                        </span>
                      </div>

                      {/* Dot indicator for active chat */}
                      {isActive && (
                        <span className="ml-auto bg-indigo-500 h-2 w-2 rounded-full"></span>
                      )}
                    </Link>
                  </li>
                );
              })
            ) : (
              <div className="text-center text-gray-500 py-4">
                No chats found
              </div>
            )}
          </ul>
        )}
      </nav>

      {/* Footer buttons: settings, logout */}
      <div className="mt-auto border-t border-gray-800 py-4 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {userInfo ? (
              <>
                <div className="relative">
                  <img
                    src={userInfo.profile_pic}
                    className="w-7 h-7 rounded-full object-cover"
                    alt={userInfo.username.charAt(0).toUpperCase()}
                  />
                  {/* Online status indicator */}
                  <div
                    className={`absolute -bottom-1 -right-1 w-3 h-3 border-2 border-gray-900 rounded-full ${
                      userInfo.online_status ? "bg-green-500" : "bg-gray-400"
                    }`}
                    title={userInfo.online_status ? "Online" : "Offline"}
                  ></div>
                </div>
                <div className="flex flex-col">
                  <span className="text-white text-sm font-semibold">
                    {userInfo.username}
                  </span>
                  <span className="text-xs text-gray-400">
                    {userInfo.online_status ? "Online" : "Offline"}
                  </span>
                </div>
              </>
            ) : (
              <FaUser className="text-gray-500 w-5 h-5" />
            )}
          </div>
          <div className="flex items-center gap-4">
            <Link to="/profile" className="text-gray-300 hover:text-white">
              <Settings size={18} />
            </Link>
            <button onClick={logout} className="text-gray-300 hover:text-white">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Chats;
