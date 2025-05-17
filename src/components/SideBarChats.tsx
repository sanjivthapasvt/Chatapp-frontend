import {
  useState,
  useContext,
  useEffect,
  useCallback,
  useRef,
  Fragment,
} from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LogOut,
  Settings,
  Users,
  Search,
  X,
  Image,
  PlusCircle,
  Check,
  ChevronsUpDown,
} from "lucide-react";
import { Listbox, Transition } from "@headlessui/react";
import axiosInstance from "../services/AxiosInstance";
import { handleLogout } from "../services/AuthService";
import { ChatContext } from "../services/ChatContext";
import { ChatDetails, CreateRoomData, User } from "../services/interface";
import logo from "../assets/svt.png";
import { toast } from "react-toastify";

function Chats() {
  const context = useContext(ChatContext);
  if (!context) return null;

  // Base API URL from environment variables
  const baseUrl = import.meta.env.VITE_BASE_URL;
  const WsBaseUrl = import.meta.env.VITE_WS_URL;

  // State to store loading status
  const [loading, setLoading] = useState<boolean>(true);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [showCreateForm, setShowCreateForm] = useState<boolean>(false);

  const { userInfo, chatList, setUserInfo, setChatList } = context;
  const navigate = useNavigate();
  const location = useLocation();

  //for friends while creating chat
  const [friends, setFriends] = useState<User[]>([]);

  // State for chatroom search
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Check if the user is authenticated
  const isAuthenticated = !!localStorage.getItem("token");

  //form data for creating new group or chat
  const [formData, setFormData] = useState<CreateRoomData>({
    room_name: "",
    participant_ids: [],
    group_image: null,
  });

  // File input refs
  const createFileInputRef = useRef<HTMLInputElement>(null);

  // Selected files
  const [createImageFile, setCreateImageFile] = useState<File | null>(null);

  // Preview URLs
  const [createImagePreview, setCreateImagePreview] = useState<string>("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    if (name === "participant_ids") {
      const ids = value.split(",").map((id) => parseInt(id.trim(), 10));
      setFormData((prev) => ({ ...prev, participant_ids: ids }));
    } else if (type === "checkbox") {
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else if (type === "file") {
      // Handle file inputs
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        setCreateImageFile(file);
        setCreateImagePreview(URL.createObjectURL(file));
      }
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleCreateChat = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Use FormData to handle file uploads
      const formDataToSend = new FormData();
      formDataToSend.append("room_name", formData.room_name);

      // Append participant IDs
      if (formData.participant_ids.length === 0) {
        toast.error("Please select at least one friend.");
        return;
      }
      formData.participant_ids.forEach((id) => {
        formDataToSend.append("participant_ids", String(id));
      });

      // Append file if selected
      if (createImageFile) {
        formDataToSend.append("group_image", createImageFile);
      }

      await axiosInstance.post(`${baseUrl}/chatrooms/`, formDataToSend, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      fetchChats();
      setShowCreateForm(false);
      setFormData({
        room_name: "",
        participant_ids: [],
        group_image: null,
      });
      setCreateImageFile(null);
      setCreateImagePreview("");
      toast.success("Chat created successfully");
    } catch (error) {
      console.error("Error creating chatroom: ", error);
      toast.error(
        "Something went wrong while creating chat, Please try again later"
      );
    }
  };

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

  //function to fetch friends
  const fetchFriends = async () => {
    try {
      const { data } = await axiosInstance.get<User[]>(`${baseUrl}/friends/`);
      setFriends(data);
      sessionStorage.setItem("friends", JSON.stringify(data));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (showCreateForm) {
      fetchFriends();
    }
  }, [showCreateForm]);

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

        if (data.type === "group_created" && data.group) {
          setChatList((prev) => {
            const exists = prev.some((chat) => chat.id === data.group.id);
            if (exists) {
              return prev.map((chat) =>
                chat.id === data.group.id ? data.group : chat
              );
            }
            return [data.group, ...prev];
          });
        } else if (
          data.type === "last_message_updated" &&
          data.group_id &&
          data.last_message
        ) {
          setChatList((prev) => {
            const chatIndex = prev.findIndex(
              (chat) => chat.id === data.group_id
            );
            if (chatIndex === -1) {
              return prev;
            }

            const updatedChat = {
              ...prev[chatIndex],
              last_message: data.last_message,
            };

            const newList = [...prev];
            newList.splice(chatIndex, 1);
            return [updatedChat, ...newList];
          });
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

  // Truncate message for display
  const truncateMessage = (
    message: string | undefined,
    maxLength = 30
  ): string => {
    if (!message) return "No message yet";
    return message.length > maxLength
      ? `${message.substring(0, maxLength)}...`
      : message;
  };

  // Format timestamp to compact format (1m, 2h, 3d)
  const formatCompactTime = (timestamp: string | undefined): string => {
    if (!timestamp) return "";
    try {
      const now = new Date();
      const messageDate = new Date(timestamp);
      const diffInSeconds = Math.floor(
        (now.getTime() - messageDate.getTime()) / 1000
      );

      if (diffInSeconds < 60) return "now";
      if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
      if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
      if (diffInSeconds < 604800)
        return `${Math.floor(diffInSeconds / 86400)}d`;
      if (diffInSeconds < 2419200)
        return `${Math.floor(diffInSeconds / 604800)}w`;

      // For older messages, just show the date
      return messageDate.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    } catch (error) {
      return "";
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div
      id="sidebar"
      className="fixed left-0 top-0 h-full bg-slate-900 text-white transition-all duration-300 z-40 shadow-xl 
          md:w-64 w-64 flex flex-col"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src={logo} height={25} width={25} />
          <h1 className="font-semibold text-lg tracking-tight">SvT Chat</h1>
        </div>
        <div className="flex items-center">
          <div className="flex items-center">
            <span
              className={`w-2 h-2 rounded-full mr-1 ${
                userInfo?.online_status ? "bg-green-400" : "bg-red-400"
              }`}
            ></span>
            <span className="text-xs text-slate-400">
              {userInfo?.online_status ? "Connected" : "Offline"}
            </span>
          </div>
        </div>
      </div>

      {/* Create Chat Form */}
      {showCreateForm && (
        <div className="absolute bottom-24 left-0 right-0 p-4 bg-slate-800 border-t border-b border-slate-700 shadow-lg z-50">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-medium text-slate-300">
              Create New Chat
            </h3>
            <button
              onClick={() => setShowCreateForm(false)}
              className="p-1 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
          <form onSubmit={handleCreateChat} className="space-y-3">
            <div>
              <input
                type="text"
                name="room_name"
                value={formData.room_name}
                onChange={handleChange}
                placeholder="Chat name"
                className="w-full p-2 bg-slate-700 border border-slate-600 rounded text-sm"
                required
              />
            </div>
            {/* Add Participants */}
            <div>
              <label className="block text-sm mb-1 text-slate-300">
                Add Participants
              </label>

              <Listbox
                multiple
                value={friends.filter((f) =>
                  formData.participant_ids.includes(f.id)
                )}
                onChange={(selectedFriends: User[]) => {
                  // sync back to formData
                  setFormData((fd) => ({
                    ...fd,
                    participant_ids: selectedFriends.map((f) => f.id),
                  }));
                }}
              >
                <div className="relative">
                  <Listbox.Button className="w-full p-2 bg-slate-700 border border-slate-600 rounded text-left flex justify-between items-center">
                    <span className="truncate text-white text-sm">
                      {formData.participant_ids.length > 0
                        ? friends
                            .filter((f) =>
                              formData.participant_ids.includes(f.id)
                            )
                            .map((f) => f.username)
                            .join(", ")
                        : "Select friends…"}
                    </span>
                    <ChevronsUpDown className="w-5 h-5 text-slate-400" />
                  </Listbox.Button>

                  <Transition
                    as={Fragment}
                    leave="transition ease-in duration-100"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                  >
                    <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded bg-slate-700 py-1 text-sm shadow-lg ring-1 ring-black ring-opacity-20 focus:outline-none">
                      {friends.map((friend) => (
                        <Listbox.Option
                          key={friend.id}
                          className={({ active }) =>
                            `cursor-pointer select-none py-2 px-3 flex justify-between ${
                              active ? "bg-slate-600" : ""
                            }`
                          }
                          value={friend}
                        >
                          {({ selected }) => (
                            <>
                              <span className={selected ? "font-semibold" : ""}>
                                {friend.username}
                              </span>
                              {selected && (
                                <Check className="w-4 h-4 text-indigo-400" />
                              )}
                            </>
                          )}
                        </Listbox.Option>
                      ))}
                    </Listbox.Options>
                  </Transition>
                </div>
              </Listbox>
            </div>

            {/* Group Image Field */}
            <div>
              <label className="text-sm text-slate-300 mb-2 flex items-center justify-between">
                <span>Group Image</span>
                <input
                  type="file"
                  ref={createFileInputRef}
                  onChange={handleChange}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => createFileInputRef.current?.click()}
                  className="text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded flex items-center gap-1 text-slate-300"
                >
                  <Image size={14} />
                  Browse...
                </button>
              </label>

              {/* Image preview */}
              {createImagePreview && (
                <div className="mt-2 relative">
                  <img
                    src={createImagePreview}
                    alt="Preview"
                    className="w-14 h-14 object-cover object-center rounded-full border border-indigo-500/30"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setCreateImageFile(null);
                      setCreateImagePreview("");
                    }}
                    className="absolute top-1 right-1 bg-red-500 rounded-full p-1 text-white"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 rounded text-sm font-medium transition-colors"
            >
              Create
            </button>
          </form>
        </div>
      )}

      {/* Chat sidebar navigation */}
      <nav className="flex-grow overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900">
        {/* Chatroom search input */}
        <div className="sticky top-0 bg-slate-900 px-5 py-4 z-10">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500"
            />
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
                className="w-full pl-9 p-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
              />
            </form>
          </div>
        </div>

        {/* Chat list */}
        <div className="px-3">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm text-slate-400">Loading chats...</span>
              </div>
            </div>
          ) : (
            <ul className="space-y-1 py-2">
              {chatList.length > 0 ? (
                chatList.map((chatroom: ChatDetails) => {
                  // Highlight currently active chatroom
                  const isActive =
                    location.pathname === `/chatroom/${chatroom.id}`;

                  return (
                    <li key={chatroom.id} className="relative group">
                      <Link
                        to={`/chatroom/${chatroom.id}`}
                        className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200
                                ${
                                  isActive
                                    ? "bg-indigo-600/10 border border-indigo-600/30"
                                    : "border border-transparent hover:bg-slate-800/70"
                                }`}
                      >
                        {/* Chatroom image */}
                        <div
                          className={`relative w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br ${
                            isActive
                              ? "from-indigo-500 to-violet-500"
                              : "from-slate-700 to-slate-600"
                          } flex items-center justify-center flex-shrink-0`}
                        >
                          {chatroom.group_image ? (
                            <img
                              src={chatroom.group_image}
                              alt={chatroom.chat_name.charAt(0).toUpperCase()}
                              className="`rounded-full object-cover"
                            />
                          ) : (
                            <span className="text-lg font-medium text-white">
                              {chatroom.chat_name
                                ? chatroom.chat_name.charAt(0).toUpperCase()
                                : "?"}
                            </span>
                          )}
                        </div>

                        {/* Chat details */}
                        <div className="flex flex-col flex-grow min-w-0">
                          <div className="flex justify-between items-center">
                            <span
                              className={`text-sm truncate ${
                                isActive
                                  ? "font-semibold text-indigo-400"
                                  : "font-medium text-slate-200"
                              }`}
                            >
                              {chatroom.chat_name}
                            </span>
                            {chatroom.last_message &&
                              chatroom.last_message.timestamp && (
                                <span className="text-xs text-slate-500 flex-shrink-0">
                                  {formatCompactTime(
                                    chatroom.last_message.timestamp
                                  )}
                                </span>
                              )}
                          </div>
                          <span className="text-xs truncate text-slate-500">
                            {chatroom.last_message ? (
                              <>
                                {chatroom.last_message.sender_name && (
                                  <span className="font-medium mr-1">
                                    {
                                      chatroom.last_message.sender_name.split(
                                        " "
                                      )[0]
                                    }
                                    :
                                  </span>
                                )}
                                {truncateMessage(chatroom.last_message.content)}
                              </>
                            ) : (
                              <span className="italic">
                                Start a conversation
                              </span>
                            )}
                          </span>
                        </div>

                        {/* Active chat indicator */}
                        {isActive && (
                          <div className="w-2 h-2 rounded-full bg-indigo-500 ml-auto flex-shrink-0"></div>
                        )}
                      </Link>
                    </li>
                  );
                })
              ) : (
                <div className="text-center py-10 px-4">
                  <div className="mb-3 bg-slate-800 rounded-full w-16 h-16 flex items-center justify-center mx-auto">
                    <img src={logo} height={20} width={20} />
                  </div>
                  <h3 className="text-slate-300 font-medium mb-1">
                    No chats found
                  </h3>
                </div>
              )}
            </ul>
          )}
        </div>
      </nav>

      {/* Floating Create Chat Button */}
      <div className="absolute bottom-20 right-4">
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="w-12 h-12 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 rounded-full shadow-lg transition-colors text-white"
          title="Create new chat"
        >
          <PlusCircle size={22} />
        </button>
      </div>

      {/* Footer */}
      <div className="mt-auto border-t border-slate-800">
        <div className="p-4 flex items-center justify-between">
          {userInfo ? (
            <div className="flex items-center gap-3">
              <div className="relative">
                {userInfo.profile_pic ? (
                  <img
                    src={userInfo.profile_pic}
                    className="w-10 h-10 rounded-full object-cover border-2 border-slate-700"
                    alt={userInfo.username.charAt(0).toUpperCase()}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                    {userInfo.username.charAt(0).toUpperCase()}
                  </div>
                )}
                {/* Online status */}
                <div
                  className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-slate-900 rounded-full ${
                    userInfo.online_status ? "bg-green-500" : "bg-slate-400"
                  }`}
                  title={userInfo.online_status ? "Online" : "Offline"}
                ></div>
              </div>
              <div className="flex flex-col">
                <span className="text-slate-200 text-sm font-semibold">
                  {userInfo.username}
                </span>
                <span className="text-xs text-slate-400">
                  {userInfo.online_status ? "Online" : "Offline"}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-700"></div>
              <div className="flex flex-col">
                <div className="w-20 h-3 bg-slate-700 rounded mb-1"></div>
                <div className="w-12 h-2 bg-slate-800 rounded"></div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Link
              to="/friends"
              className="text-slate-400 hover:text-indigo-400 transition-colors"
            >
              <Users size={20} />
            </Link>
            <Link
              to="/profile"
              className="text-slate-400 hover:text-indigo-400 transition-colors"
            >
              <Settings size={20} />
            </Link>
            <button
              onClick={logout}
              className="text-slate-400 hover:text-indigo-400 transition-colors"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Chats;
