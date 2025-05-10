import { jwtDecode } from "jwt-decode";
import axiosInstance from "../services/AxiosInstance";
import { useEffect, useContext, useRef, useState } from "react";
import { FaUser, FaEllipsisV, FaUsers, FaPaperPlane } from "react-icons/fa";
import { useParams } from "react-router-dom";
import { Message } from "../services/interface";
import InfiniteScroll from "react-infinite-scroll-component";
import { ChatContext } from "../services/ChatContext";
import { toast } from "react-toastify";
let typingTimeout: any;

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

  // Get username from JWT token for typing indicators
  let currentUsername: string = "";
  const token = localStorage.getItem("token");
  if (token) {
    const decoded: any = jwtDecode(token);
    currentUsername = decoded.username;
  }

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
      toast.error("Something went wrong while fetching the message")
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Get info about the current chat (name, participants, etc)
  const fetchChatInfo = async () => {
    try {
      const response = await axiosInstance.get(`${baseUrl}/chatrooms/${id}/`);
      setChatInfo(response.data);
    } catch (error) {
      console.error("Error fetching ChatInfo", error);
    } finally {
      setLoading(false);
    }
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
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="flex h-screen bg-gray-950">
      {/* Main chat area */}
      <div
        className={`flex-1 flex flex-col bg-gray-950 text-white transition-all ${
          showSidebar ? "mr-64" : ""
        }`}
      >
        {/* Chat Header with room info and controls */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900 shadow-md">
          <div className="flex items-center">
            {/* Avatar / Group Image */}
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

            {/* Chat Info with name and online status */}
            <div className="pl-3">
              {!loading && chatInfo && (
                <>
                  <div className="text-base font-semibold text-white">
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
                              <span
                                className={`h-2 w-2 rounded-full ${
                                  otherUser.online_status
                                    ? "bg-green-500"
                                    : "bg-gray-500"
                                }`}
                                title={
                                  otherUser.online_status ? "Online" : "Offline"
                                }
                              ></span>
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

          {/* Sidebar toggle with appropriate icon based on chat type */}
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-full hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
          >
            {chatInfo?.is_group ? (
              <FaUsers className="text-gray-300" />
            ) : (
              <FaEllipsisV className="text-gray-300" />
            )}
          </button>
        </div>

        {/* Messages area with reverse infinite scroll for loading history */}
        <div
          id="scrollableDiv"
          className="flex-1 overflow-y-auto flex flex-col-reverse bg-gradient-to-b from-gray-950 to-gray-950"
          ref={messagesContainerRef}
        >
          <InfiniteScroll
            dataLength={message.length}
            next={() => fetchMessages(true)}
            hasMore={hasMore}
            loader={
              <div className="text-center text-gray-400 py-2 text-sm">
                <div className="inline-block px-3 py-1 bg-gray-900 rounded-full">Loading messages...</div>
              </div>
            }
            style={{ display: "flex", flexDirection: "column-reverse" }}
            inverse={true} // Important for chat-like behavior - newer messages at bottom
            scrollableTarget="scrollableDiv"
            className="p-4 space-y-4"
            initialScrollY={0}
          >
            {/* Invisible div that helps with auto-scrolling */}
            <div ref={messagesEndRef} />
            
            {/* Message bubbles */}
            <div className="flex flex-col space-y-3">
              {message.map((msg, index) => {
                const isCurrentUser = currentUser === msg.sender.id;
                // Only show username for first message in a sequence from the same user
                const showSender = index === 0 || 
                  message[index - 1].sender.id !== msg.sender.id;
                
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      isCurrentUser ? "items-end" : "items-start"
                    }`}
                  >
                    {/* Username for other people's messages */}
                    {!isCurrentUser && showSender && (
                      <span className="text-xs text-gray-500 ml-2 mb-1">
                        {msg.sender.username}
                      </span>
                    )}
                    <div className="flex items-end gap-1">
                      {/* Space placeholder for non-first messages in a sequence */}
                      {!isCurrentUser && !showSender && (
                        <div className="w-6"></div>
                      )}
                      {/* Message bubble with different styling based on sender */}
                      <div
                        className={`px-4 py-2 rounded-2xl max-w-xs break-words ${
                          isCurrentUser
                            ? "bg-blue-600 text-white rounded-br-sm" // Our messages - blue with pointed corner
                            : "bg-gray-800 text-white rounded-bl-sm" // Their messages - gray with pointed corner
                        }`}
                      >
                        {msg.content}
                        <span className="text-xs opacity-70 ml-2 float-right mt-1">
                          {formatTime(msg.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </InfiniteScroll>
        </div>

        {/* "X is typing" indicator - only shown when someone is actually typing */}
        {[...typingUsers].filter((u) => u !== currentUsername).length > 0 && (
          <div className="typing-indicator px-4 py-1 text-xs text-gray-400 bg-gray-900 bg-opacity-70">
            <div className="flex items-center">
              {/* Animated dots that look like typing */}
              <div className="flex space-x-1 mr-2">
                <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce"></span>
                <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce delay-75"></span>
                <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce delay-150"></span>
              </div>
              {/* Smart grammar: "is typing" vs "are typing" */}
              {[...typingUsers].filter((u) => u !== currentUsername).join(", ")}{" "}
              {[...typingUsers].filter((u) => u !== currentUsername).length === 1
                ? "is"
                : "are"}{" "}
              typing...
            </div>
          </div>
        )}

        {/* Message input area */}
        <div className="p-3 border-t border-gray-800 bg-gray-900">
          <div className="flex items-center bg-gray-800 rounded-full px-4 shadow-inner">
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
              className="flex-1 py-3 bg-transparent text-white placeholder-gray-400 focus:outline-none text-sm"
            />
            {/* Send button with dynamic color based on input state */}
            <button
              className={`ml-2 p-2 rounded-full focus:outline-none ${
                inputValue.trim()
                  ? "text-blue-400 hover:text-blue-300" // Active when there's text to send
                  : "text-gray-500" // Disabled appearance when empty
              }`}
              onClick={sendMessage}
              disabled={!inputValue.trim()}
            >
              <FaPaperPlane className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Right Sidebar for Participants - conditionally rendered */}
      {showSidebar && (
        <div className="fixed right-0 w-64 h-full bg-gray-900 border-l border-gray-800 flex flex-col shadow-xl">
          <div className="p-4 border-b border-gray-800 bg-gray-950">
            <h2 className="text-base font-semibold text-white flex items-center">
              <span>Group Info</span>
              {/* Member count badge for groups */}
              {chatInfo?.is_group && (
                <span className="ml-2 text-xs bg-gray-800 px-2 py-1 rounded-full text-gray-300">
                  {chatInfo?.participants?.length || 0} Members
                </span>
              )}
            </h2>
          </div>

          <div className="p-4 flex-1 overflow-y-auto">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              PARTICIPANTS
            </h3>

            {/* Online Users Section */}
            <div className="mb-6">
              <h4 className="text-xs text-green-500 mb-2 flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                ONLINE
              </h4>
              <div className="space-y-3">
                {/* Map through online participants */}
                {!loading &&
                  chatInfo?.participants &&
                  chatInfo.participants
                    .filter((p) => p.online_status)
                    .map((participant) => (
                      <div
                        key={participant.id}
                        className="flex items-center gap-2 hover:bg-gray-800 p-1 rounded-lg transition-colors"
                      >
                        {/* User avatar with online indicator */}
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
                          <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-green-500 border border-gray-800"></span>
                        </div>
                        <div className="flex items-center">
                          <span className="text-sm text-white">
                            {participant.username}
                          </span>
                        </div>
                      </div>
                    ))}
                {/* Show message when no online users */}
                {!loading && 
                  chatInfo?.participants && 
                  !chatInfo.participants.filter(p => p.online_status).length && (
                    <div className="text-xs text-gray-500 italic">No users online</div>
                )}
              </div>
            </div>

            {/* Offline Users Section */}
            <div>
              <h4 className="text-xs text-gray-500 mb-2 flex items-center">
                <span className="w-2 h-2 bg-gray-500 rounded-full mr-2"></span>
                OFFLINE
              </h4>
              <div className="space-y-3">
                {/* Map through offline participants */}
                {!loading &&
                  chatInfo?.participants &&
                  chatInfo.participants
                    .filter((p) => !p.online_status)
                    .map((participant) => (
                      <div
                        key={participant.id}
                        className="flex items-center gap-2 hover:bg-gray-800 p-1 rounded-lg transition-colors"
                      >
                        {/* User avatar with offline indicator */}
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-800 flex items-center justify-center relative shadow-inner">
                          {participant.profile_pic ? (
                            <img
                              src={participant.profile_pic}
                              alt={participant.username}
                              className="w-full h-full object-cover opacity-90"
                            />
                          ) : (
                            <FaUser className="text-gray-500 w-3 h-3" />
                          )}
                          <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-gray-500 border border-gray-800"></span>
                        </div>
                        <div className="flex items-center">
                          <span className="text-sm text-gray-300">
                            {participant.username}
                          </span>
                        </div>
                      </div>
                    ))}
                {/* Show message when no offline users */}
                {!loading && 
                  chatInfo?.participants && 
                  !chatInfo.participants.filter(p => !p.online_status).length && (
                    <div className="text-xs text-gray-500 italic">No offline users</div>
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