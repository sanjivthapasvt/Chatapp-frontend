import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogOut, Settings } from "lucide-react";
import { FaUserFriends, FaUser } from "react-icons/fa";
import axiosInstance from "../services/axiosInstance";
import { handleLogout } from "../services/authService";

interface LastMessage {
  content: string;
}
interface ChatRoom {
  id: number;
  room_name: "string";
  is_group: boolean;
  group_image: "string";
  last_message: LastMessage;
}

function Chats() {
  const baseUrl = "http://localhost:8000/api";
  const [chatList, setChatList] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  //!! is for ts to know that the value will be on boolean
  const isAuthenticated = !!localStorage.getItem("token");
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/auth");
    }
  }, [navigate]);

  const fetchChats = async () => {
    try {
      const response = await axiosInstance.get(`${baseUrl}/chatrooms/`, {
        params: {
          search: searchTerm,
          ordering: "timestamp",
        },
      });
      setChatList(response.data);
    } catch (error) {
      console.error("Error fetching chats", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChats();
  }, [location]);

  const logout = () => {
    handleLogout(navigate);
  };

  return (
    <div
      id="sidebar"
      className="fixed left-0 top-0 h-full bg-gray-900 text-white transition-all duration-300 z-40 shadow-xl 
          md:w-64 w-64 flex flex-col"
    >
      <nav className="mt-2 px-2 flex-grow overflow-y-auto">
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
        {loading ? (
          <div className="flex justify-center items-center h-64">
            Loading...
          </div>
        ) : (
          <ul className="space-y-1">
            {chatList.map((chatroom: ChatRoom) => {
              const isActive =
                location.pathname === `/chatroom${chatroom.id}`;
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
      <div className="mt-auto border-t border-gray-800 py-4">
        <div className="flex justify-center">
          <button
            onClick={logout}
            className="items-right gap-3 px-4 py-3 cursor-pointer text-gray-300 hover:text-white"
          >
            <div className="w-6 justify-right">
              <FaUserFriends size={15} />
            </div>
          </button>
          <button
            onClick={logout}
            className="items-right gap-3 px-4 py-3 cursor-pointer text-gray-300 hover:text-white"
          >
            <div className="w-6 justify-right">
              <Settings size={15} />
            </div>
          </button>
          <button
            onClick={logout}
            className="items-right gap-3 px-4 py-3 cursor-pointer text-gray-300 hover:text-white"
          >
            <div className="w-6 flex justify-right">
              <LogOut size={15} />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

export default Chats;
