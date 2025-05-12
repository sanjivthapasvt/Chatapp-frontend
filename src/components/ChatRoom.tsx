import axiosInstance from "../services/AxiosInstance";
import { useEffect, useContext, useRef, useState } from "react";
import {
  FaUser,
  FaEllipsisV,
  FaUsers,
  FaPaperPlane,
  FaUserFriends,
  FaCrown,
  FaUserMinus,
} from "react-icons/fa";
import { useParams } from "react-router-dom";
import { Message, User } from "../services/interface";
import InfiniteScroll from "react-infinite-scroll-component";
import { ChatContext } from "../services/ChatContext";
import { toast } from "react-toastify";
import { EllipsisVertical } from "lucide-react";
let typingTimeout: any;
import { Menu } from "@headlessui/react";
import GroupActions from "./dependencies/GroupActions";
import Swal from "sweetalert2";

function ChatRoom() {
  const context = useContext(ChatContext);
  if (!context) return null;

  // Base URLs from environment variables
  const baseUrl = import.meta.env.VITE_BASE_URL;
  const WsBaseUrl = import.meta.env.VITE_WS_URL;

  // Get chat room ID from URL
  const { id } = useParams();

  // ----- State Management -----
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const socketRef = useRef<WebSocket | null>(null); // Ref helps access socket in cleanup functions
  const [inputValue, setInputValue] = useState("");
  const [message, setMessage] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const { chatInfo, setChatInfo } = context;

  const [currentUserInfo, setCurrentUserInfo] = useState<User | null>(null);

  // Refs for scrolling behavior
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Pagination state
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  // UI state
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);

  // ----- User Authentication -----
  // Extract current user info from localStorage
  const currentUser: number | null =
    parseInt(localStorage.getItem("user_id") ?? "", 10) || null;

  const token = localStorage.getItem("token");
  const currentUsername = currentUserInfo?.username;

  // Smoothly scroll chat to bottom - called after loading initial messages or sending a new one
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Fetch messages with pagination support
  // appendToTop=true when loading older messages during scroll
  const fetchMessages = async (appendToTop = false) => {
    // Prevent duplicate requests while already loading
    if (isLoadingMore) return;
    setIsLoadingMore(true);

    //Save scroll position before adding new content to maintain user's place
    const container = messagesContainerRef.current;
    const prevScrollHeight = container?.scrollHeight ?? 0;
    const prevScrollTop = container?.scrollTop ?? 0;
    const distanceFromBottom = prevScrollHeight - prevScrollTop;

    try {
      // Add cursor to URL for pagination
      const cursorParam = cursor ? `&cursor=${encodeURIComponent(cursor)}` : "";
      const response = await axiosInstance.get(
        `${baseUrl}/chatrooms/${id}/messages/?limit=35${cursorParam}`
      );

      const results: Message[] = response.data.results;

      if (results && results.length > 0) {
        // sort messages by timestamp
        const sortedMessages = [...results].sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        if (appendToTop) {
          // Adding older messages
          setMessage((prev) => {
            // Filter out messages we already have to avoid duplicates
            const existingIds = new Set(prev.map((msg) => msg.id));
            const newMessages = sortedMessages.filter(
              (msg) => !existingIds.has(msg.id)
            );
            return [...newMessages, ...prev];
          });

          // Restore scroll position after DOM updates
          setTimeout(() => {
            if (container) {
              const newScrollHeight = container.scrollHeight;
              container.scrollTop = newScrollHeight - distanceFromBottom;
            }
          }, 0);
        } else {
          // Initial fetch
          setMessage(sortedMessages);
          setTimeout(() => {
            scrollToBottom();
          }, 0);
        }

        // Extract next cursor from response for subsequent pagination requests
        const nextCursor = response.data.next
          ? new URL(response.data.next).searchParams.get("cursor")
          : null;

        setCursor(nextCursor);
        setHasMore(!!response.data.next);
      } else {
        // No more messages to load
        setHasMore(false);
      }
    } catch (error) {
      console.error("Error fetching messages: ", error);
      toast.error("Something went wrong while fetching the message");
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Get info about the current chat (name, participants, etc)
  const fetchChatInfo = async () => {
    try {
      const response = await axiosInstance.get(`${baseUrl}/chatrooms/${id}/`);
      setChatInfo(response.data);
      const currentUserData = response.data.participants.find(
        (participant: User) => participant.id === currentUser
      );
      setCurrentUserInfo(currentUserData);
    } catch (error) {
      console.error("Error fetching ChatInfo", error);
    } finally {
      setLoading(false);
    }
  };

  const addMember = async (chatId: number, userIds: User["id"][]) => {
    try {
      const response = await axiosInstance.post(
        `${baseUrl}/chatrooms/${chatId}/add_members/`,
        {
          users: userIds,
        }
      );
      const addedUsers = response.data.participants.filter((user: User) =>
        userIds.includes(user.id)
      );
      const addedUsernames = addedUsers
        .map((user: User) => user.username)
        .join(", ");
      toast.success(`Successfully added ${addedUsernames} to group!`);
      fetchChatInfo();
    } catch (error) {
      console.error("Error while adding member", error);
      toast.error(
        "Something went wrong while adding user, Please try again later!"
      );
    }
  };

  const removeMember = async (
    chatId: number,
    userId: User["id"],
    username: User["username"]
  ) => {
    try {
      const result = await Swal.fire({
        title: `Are you sure you want to remove ${username} from the group?`,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Yes",
        cancelButtonText: "No",
      });
      if (result.isConfirmed) {
        await axiosInstance.post(
          `${baseUrl}/chatrooms/${chatId}/remove_member/`,
          {
            user_id: userId,
          }
        );
        toast.success(`Successfully removed ${username} from group!`);
        fetchChatInfo();
      }
    } catch (error: any) {
      console.error("Error while removing member", error);
      const errorMessage =
        error.response?.data?.detail || "An unexpected error occured.";
      toast.error(errorMessage);
    }
  };

  const leaveRoom = async (chatId: number) => {
    try {
      const result = await Swal.fire({
        title: "Do you want to leave the Group?",
        text: "All the messages will be deleted, are you sure?",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Yes",
        cancelButtonText: "No",
      });
      if (result.isConfirmed) {
        await axiosInstance.post(`${baseUrl}/chatrooms/${chatId}/leave_room/`);
        toast.success("Successfully left the group!");
        fetchChatInfo();
      }
    } catch (error: any) {
      console.error("Error while removing member", error);
      const errorMessage =
        error.response?.data?.detail || "An unexpected error occured.";
      toast.error(errorMessage);
    }
  };

  const assignAdmin = async (
    chatId: number,
    userId: User["id"],
    username: User["username"]
  ) => {
    try {
      const result = await Swal.fire({
        title: `Are you sure you want to remove ${username} from the group?`,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Yes",
        cancelButtonText: "No",
      });
      if (result.isConfirmed) {
        await axiosInstance.post(
          `${baseUrl}/chatrooms/${chatId}/assign_admin/`,
          {
            user_id: userId,
          }
        );
        toast.success(`Successfully added ${username} as admin!`);
        fetchChatInfo();
      }
    } catch (error: any) {
      console.error("Error while assigning admin", error);
      const errorMessage =
        error.response?.data?.detail || "An unexpected error occured.";
      toast.error(errorMessage);
    }
  };

  const MemberActions = ({ chatId, user }: { chatId: number; user: User }) => {
    const handleAddAdmin = () => assignAdmin(chatId, user.id, user.username);
    const handleRemove = () => removeMember(chatId, user.id, user.username);

    return (
      <Menu as="div" className="relative inline-block text-left">
        <Menu.Button className="text-gray-400 hover:text-white transition-colors">
          <EllipsisVertical size={15} />
        </Menu.Button>
        <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-gray-800 shadow-lg ring-1 ring-gray-700 ring-opacity-5 focus:outline-none">
          <div className="py-1 text-sm text-gray-300">
            {/* Only show Assign Admin option if user is not already an admin */}
            {!user.is_admin && (
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={handleAddAdmin}
                    className={`${
                      active ? "bg-gray-700" : ""
                    } block w-full px-4 py-2 text-left flex items-center`}
                  >
                    <FaCrown className="text-yellow-400 mr-2 w-3 h-3" />
                    Assign Admin
                  </button>
                )}
              </Menu.Item>
            )}
            <Menu.Item>
              {({ active }) => (
                <button
                  onClick={handleRemove}
                  className={`${
                    active ? "bg-gray-700" : ""
                  } block w-full px-4 py-2 text-left flex items-center text-red-400`}
                >
                  <FaUserMinus className="mr-2 w-3 h-3" />
                  Remove Member
                </button>
              )}
            </Menu.Item>
          </div>
        </Menu.Items>
      </Menu>
    );
  };


  // Reset and refresh data when changing chat rooms
  useEffect(() => {
    // Clear state for the new room
    setCursor(null);
    setHasMore(true);
    setMessage([]);

    // Load new data
    fetchChatInfo();
    fetchMessages();
  }, [id]);

  // WebSocket connection for real-time messaging
  useEffect(() => {
    // Create new connection with auth token
    const ws: WebSocket = new WebSocket(
      `${WsBaseUrl}/chat/${id}/?token=${token}`
    );
    socketRef.current = ws;

    ws.onopen = () => {
      console.log("Web socket connected");
    };

    // Handle incoming websocket events
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "new_message") {
          // Add new messages to the chat, avoiding duplicates
          const newMessage: Message = data.message;

          setMessage((prevMessages) => {
            // Check if we already have this message
            if (prevMessages.some((msg) => msg.id === newMessage.id)) {
              return prevMessages;
            }

            // Add message and maintain chronological sorting
            return [...prevMessages, newMessage].sort(
              (a, b) =>
                new Date(a.timestamp).getTime() -
                new Date(b.timestamp).getTime()
            );
          });
        } else if (data.type === "typing") {
          // Someone started typing
          setTypingUsers((prev) => {
            const updated = new Set(prev);
            updated.add(data.username);
            return updated;
          });
        } else if (data.type === "stop_typing") {
          // Someone stopped typing
          setTypingUsers((prev) => {
            const updated = new Set(prev);
            updated.delete(data.username);
            return updated;
          });
        }
      } catch (err) {
        console.error("Failed to parse incoming message", err);
      }
    };

    ws.onclose = () => {
      console.log("WebSocket connection closed");
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    setSocket(ws);

    // Close socket when changing rooms or unmounting
    return () => {
      // Handle case where component unmounts before connection completes
      if (ws.readyState === WebSocket.CONNECTING) {
        ws.onopen = () => ws.close();
      } else if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [id]);

  // Smart typing indicator
  const handleInputChange = (e: any) => {
    const value = e.target.value;
    setInputValue(value);

    // Send typing event when user starts typing
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: "typing",
          username: currentUsername,
        })
      );
    }

    // Use debounce to avoid spamming typing events
    // Only send "stop typing" after user pauses for 1.5s
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: "stop_typing",
            username: currentUsername,
          })
        );
      }
    }, 1500);
  };

  // Send message and clear input field
  const sendMessage = async () => {
    if (!inputValue.trim()) return; // Don't send empty messages

    try {
      // Send message to server via API
      await axiosInstance.post(`${baseUrl}/chatrooms/${id}/messages/`, {
        content: inputValue,
      });

      // Manually clear typing indicator since we're done typing
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: "stop_typing",
            username: currentUsername,
          })
        );
      }

      setInputValue("");
    } catch (error) {
      console.error("Something went wrong", error);
    }
  };

  const toggleSidebar = () => {
    setShowSidebar(!showSidebar);
  };

  // Format timestamp in a user-friendly way (hours:minutes)
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex h-screen bg-gray-950">
      {/* Main chat area */}
      <div
        className={`flex-1 flex flex-col bg-gray-950 text-white transition-all duration-300 ${
          showSidebar ? "mr-64" : ""
        }`}
      >
        {/* Enhanced Chat Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900 shadow-lg">
          <div className="flex items-center">
            {/* Avatar with subtle glow effect */}
            <div className="relative">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-800 flex items-center justify-center shadow-inner">
                {chatInfo?.group_image ? (
                  <img
                    src={chatInfo.group_image}
                    alt="Group"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <FaUser className="text-gray-400 w-5 h-5" />
                )}
              </div>
              {!chatInfo?.is_group &&
                chatInfo?.participants &&
                chatInfo.participants.length === 2 &&
                (() => {
                  const otherUser = chatInfo.participants.find(
                    (p) => p.id !== currentUser
                  );
                  if (otherUser?.online_status) {
                    return (
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-gray-900"></span>
                    );
                  }
                  return null;
                })()}
            </div>

            {/* Chat Info with improved typography */}
            <div className="pl-3">
              {!loading && chatInfo && (
                <>
                  <div className="text-base font-semibold text-white tracking-wide">
                    {chatInfo.chat_name}
                  </div>

                  {/* Show online status only in DM chats */}
                  {!chatInfo.is_group && currentUser && (
                    <>
                      {chatInfo.participants &&
                        chatInfo.participants.length === 2 &&
                        (() => {
                          // Find the other user in a DM (not the current user)
                          const otherUser = chatInfo.participants.find(
                            (p) => p.id !== currentUser
                          );

                          return otherUser ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400">
                                {otherUser.online_status ? "Online" : "Offline"}
                              </span>
                            </div>
                          ) : null;
                        })()}
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSidebar}
              className="p-2 rounded-full hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
              title={showSidebar ? "Hide sidebar" : "Show sidebar"}
            >
              {chatInfo?.is_group ? (
                <FaUsers className="text-gray-300 hover:text-blue-400 transition-colors" />
              ) : (
                <FaEllipsisV className="text-gray-300 hover:text-blue-400 transition-colors" />
              )}
            </button>
          </div>
        </div>

        {/* Enhanced Messages area with better gradients */}
        <div
          id="scrollableDiv"
          className="flex-1 overflow-y-auto flex flex-col-reverse bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950"
          ref={messagesContainerRef}
        >
          <InfiniteScroll
            dataLength={message.length}
            next={() => fetchMessages(true)}
            hasMore={hasMore}
            loader={
              <div className="text-center text-gray-400 py-2 text-sm">
                <div className="inline-block px-3 py-1 bg-gray-900 rounded-full animate-pulse">
                  Loading messages...
                </div>
              </div>
            }
            style={{ display: "flex", flexDirection: "column-reverse" }}
            inverse={true}
            scrollableTarget="scrollableDiv"
            className="p-4 space-y-4"
            initialScrollY={0}
          >
            {/* Invisible div that helps with auto-scrolling */}
            <div ref={messagesEndRef} />

            {/* Enhanced Message bubbles with better styling */}
            <div className="flex flex-col space-y-4">
              {message.map((msg, index) => {
                const isCurrentUser = currentUser === msg.sender.id;
                const senderInfo = chatInfo?.participants.find((user: { id: number; }) => user.id === msg.sender.id);
                const showSender =
                  index === 0 || message[index - 1].sender.id !== msg.sender.id;
                const showAvatar = !isCurrentUser && showSender;

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      isCurrentUser ? "items-end" : "items-start"
                    }`}
                  >
                    {/* Username for other people's messages */}
                    {!isCurrentUser && showSender && (
                      <span className="text-xs text-gray-500 ml-12 mb-1">
                        {senderInfo?.username}
                      </span>
                    )}
                    <div className="flex items-end gap-2">
                      {/* Avatar for first message in a sequence */}
                      {showAvatar ? (
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-800 flex items-center justify-center">
                          {senderInfo?.profile_pic ? (
                            <img
                              src={senderInfo.profile_pic}
                              alt={senderInfo.username.charAt(0).toUpperCase()}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <FaUser className="text-gray-400 w-3 h-3" />
                          )}
                        </div>
                      ) : (
                        <div className="w-8"></div>
                      )}

                      {/* Message bubble with enhanced styling */}
                      <div
                        className={`px-4 py-2 rounded-2xl max-w-xs md:max-w-md lg:max-w-lg break-words shadow-md ${
                          isCurrentUser
                            ? "bg-blue-600 bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-br-sm"
                            : "bg-gray-800 bg-gradient-to-br from-gray-700 to-gray-800 text-white rounded-bl-sm"
                        }`}
                      >
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                        <div className="text-xs opacity-70 mt-1 text-right">
                          {formatTime(msg.timestamp)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </InfiniteScroll>
        </div>

        {/* Enhanced "X is typing" indicator */}
        {[...typingUsers].filter((u) => u !== currentUsername).length > 0 && (
          <div className="typing-indicator px-4 py-2 text-xs text-gray-400 bg-gray-900 bg-opacity-80 backdrop-blur-sm border-t border-gray-800">
            <div className="flex items-center">
              <div className="flex space-x-1 mr-2 opacity-75">
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce delay-75"></span>
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce delay-150"></span>
              </div>
              <span className="font-medium">
                {[...typingUsers]
                  .filter((u) => u !== currentUsername)
                  .join(", ")}{" "}
                {[...typingUsers].filter((u) => u !== currentUsername)
                  .length === 1
                  ? "is"
                  : "are"}{" "}
                typing...
              </span>
            </div>
          </div>
        )}

        {/* Enhanced Message input area */}
        <div className="p-4 border-t border-gray-800 bg-gray-900">
          <div className="flex items-center bg-gray-800 rounded-full px-4 py-1 shadow-inner hover:shadow-md transition-shadow duration-300">
            <input
              type="text"
              placeholder="Type a message..."
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  sendMessage();
                }
              }}
              className="flex-1 py-3 px-2 bg-transparent text-white placeholder-gray-400 focus:outline-none text-sm"
            />

            <button
              className={`p-2 rounded-full focus:outline-none transition-all duration-300 ${
                inputValue.trim()
                  ? "bg-blue-600 hover:bg-blue-500 text-white"
                  : "text-gray-500 cursor-not-allowed"
              }`}
              onClick={sendMessage}
              disabled={!inputValue.trim()}
              title="Send message"
            >
              <FaPaperPlane className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      {showSidebar && chatInfo && (
        <div className="fixed right-0 w-64 h-full bg-gray-900 border-l border-gray-800 flex flex-col shadow-xl animate-slideIn">
          <div className="p-4 border-b border-gray-800 bg-gray-950">
            <h2 className="text-base font-semibold text-white flex items-center justify-between">
              <span>Group Info</span>
              <GroupActions
                chatId={chatInfo.id}
                users={chatInfo?.participants}
                addMember={addMember}
                leaveRoom={leaveRoom}
                participants={chatInfo.participants || []}
              />
            </h2>
          </div>

          <div className="p-4 flex-1 overflow-y-auto">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center">
              <FaUserFriends className="mr-2 text-gray-500" />
              Participants
            </h3>

            {/* Online Users Section */}
            <div className="mb-6">
              <h4 className="text-xs text-green-500 mb-2 flex items-center font-medium">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                ONLINE
              </h4>
              <div className="space-y-2">
                {/* Map through online participants */}
                {!loading &&
                  chatInfo?.participants &&
                  chatInfo.participants
                    .filter((p) => p.online_status)
                    .map((participant) => (
                      <div
                        key={participant.id}
                        className="flex items-center gap-2 hover:bg-gray-800 p-2 rounded-lg transition-colors group"
                      >
                        {/* User avatar with enhanced online indicator */}
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-800 flex items-center justify-center relative shadow-md">
                          {participant.profile_pic ? (
                            <img
                              src={participant.profile_pic}
                              alt={participant.username}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <FaUser className="text-gray-400 w-3 h-3" />
                          )}
                        </div>
                        <div className="flex-1 overflow-hidden flex items-center">
                          <span className="text-sm text-white font-medium truncate block">
                            {participant.username}
                          </span>
                          {participant.is_admin && (
                            <FaCrown
                              className="text-yellow-400 ml-1 w-3 h-3"
                              title="Admin"
                            />
                          )}
                        </div>
                        {/* Only show MemberActions if current user is admin */}
                        {currentUserInfo?.is_admin &&
                          currentUserInfo.id !== participant.id && (
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <MemberActions
                                chatId={chatInfo.id}
                                user={participant}
                              />
                            </div>
                          )}
                      </div>
                    ))}
                {/* Show message when no online users */}
                {!loading &&
                  chatInfo?.participants &&
                  !chatInfo.participants.filter((p) => p.online_status)
                    .length && (
                    <div className="text-xs text-gray-500 italic pl-4">
                      No users online
                    </div>
                  )}
              </div>
            </div>

            {/* Offline Users Section */}
            <div>
              <h4 className="text-xs text-gray-500 mb-2 flex items-center font-medium">
                <span className="w-2 h-2 bg-gray-500 rounded-full mr-2"></span>
                OFFLINE
              </h4>
              <div className="space-y-2">
                {/* Map through offline participants */}
                {!loading &&
                  chatInfo?.participants &&
                  chatInfo.participants
                    .filter((p) => !p.online_status)
                    .map((participant) => (
                      <div
                        key={participant.id}
                        className="flex items-center gap-2 hover:bg-gray-800 p-2 rounded-lg transition-colors group"
                      >
                        {/* User avatar */}
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-800 flex items-center justify-center relative shadow-inner opacity-90">
                          {participant.profile_pic ? (
                            <img
                              src={participant.profile_pic}
                              alt={participant.username}
                              className="w-full h-full object-cover grayscale opacity-90"
                            />
                          ) : (
                            <FaUser className="text-gray-500 w-3 h-3" />
                          )}
                        </div>
                        <div className="flex-1 overflow-hidden flex items-center">
                          <span className="text-sm text-gray-300 truncate block">
                            {participant.username}
                          </span>
                          {participant.is_admin && (
                            <FaCrown
                              className="text-yellow-400 ml-1 w-3 h-3"
                              title="Admin"
                            />
                          )}
                        </div>
                        {/* Only show MemberActions if current user is admin */}
                        {currentUserInfo?.is_admin &&
                          currentUserInfo.id !== participant.id && (
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <MemberActions
                                chatId={chatInfo.id}
                                user={participant}
                              />
                            </div>
                          )}
                      </div>
                    ))}
                {/* Show message when no offline users */}
                {!loading &&
                  chatInfo?.participants &&
                  !chatInfo.participants.filter((p) => !p.online_status)
                    .length && (
                    <div className="text-xs text-gray-500 italic pl-4">
                      No offline users
                    </div>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatRoom;
