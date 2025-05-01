import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogOut, Settings } from "lucide-react";
import { FaUserFriends, FaUser } from "react-icons/fa";
import axiosInstance from "../services/axiosInstance";
import { handleLogout } from "../services/authService";
import { ChatInfo, User } from "../services/interface";

function Chats() {
  // Base API URL from environment variables
  const baseUrl = import.meta.env.VITE_BASE_URL;

  // State to store chatroom list and loading status
  const [chatList, setChatList] = useState<ChatInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [userInfo, setUserInfo] = useState<User | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // State for chatroom search
  const [searchTerm, setSearchTerm] = useState("");

  // Check if the user is authenticated
  const isAuthenticated = !!localStorage.getItem("token");

  // Redirect to auth page if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/auth");
    }
  }, [navigate]);

  // Function to fetch chatrooms from API
  const fetchChats = async () => {
    try {
      const response = await axiosInstance.get(`${baseUrl}/chatrooms/`, {
        params: {
          search: searchTerm,
          ordering: "lastmessage", // Sort by latest message
        },
      });
      const data = response.data;
      setChatList(Array.isArray(data.results) ? data.results : []);
    } catch (error) {
      console.error("Error fetching chats", error);
      setChatList([]);
    } finally {
      setLoading(false);
    }
  };

  //function to fetch user info from API
  const fetchUser = async () => {
    try {
      const response = await axiosInstance.get(`${baseUrl}/profile/`);
      const data = response.data;
      setUserInfo(data);
    } catch (error) {
      console.error("Cannot fetch user info", error);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  // Fetch chatrooms when the route changes
  useEffect(() => {
    fetchChats();
  }, [location]);

  // Logout handler
  const logout = () => {
    handleLogout(navigate);
  };

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
            {chatList.map((chatroom: ChatInfo) => {
              // Highlight currently active chatroom
              const isActive = location.pathname === `/chatroom${chatroom.id}`;

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
            })}
          </ul>
        )}
      </nav>

      {/* Footer buttons: friends, settings, logout */}
      <div className="mt-auto border-t border-gray-800 py-4 px-4">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      {userInfo ? (
        <>
          <img
            src={userInfo.profile_pic}
            className="w-7 h-7 rounded-full object-cover"
            alt="Profile"
          />
          <span className="text-white text-sm font-semibold">{userInfo.username}</span>
        </>
      ) : (
        <FaUser className="text-gray-500 w-10 h-10" />
      )}
    </div>
    <div className="flex items-center gap-4">
      <button className="text-gray-300 hover:text-white">
        <FaUserFriends size={18} />
      </button>
      <button className="text-gray-300 hover:text-white">
        <Settings size={18} />
      </button>
      <button
        onClick={logout}
        className="text-gray-300 hover:text-white"
      >
        <LogOut size={18} />
      </button>
    </div>
  </div>
</div>

    </div>
  );
}

export default Chats;
