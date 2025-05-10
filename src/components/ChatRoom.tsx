import { jwtDecode } from "jwt-decode";
import axiosInstance from "../services/AxiosInstance";
import { useEffect, useContext, useRef, useState } from "react";
import { FaUser, FaEllipsisV, FaUsers, FaPaperPlane } from "react-icons/fa";
import { useParams } from "react-router-dom";
import { Message } from "../services/interface";
import InfiniteScroll from "react-infinite-scroll-component";
import { ChatContext } from "../services/ChatContext";
let typingTimeout: any;

function ChatRoom() {
  const context = useContext(ChatContext);
  if (!context) return null;
  // Base URLs from environment variables
  const baseUrl = import.meta.env.VITE_BASE_URL;
  const WsBaseUrl = import.meta.env.VITE_WS_URL;

  // Extract the chat room ID from URL parameters
  const { id } = useParams();

  // State variables
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [message, setMessage] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const { chatInfo, setChatInfo } = context;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);

  // Get current user info from localStorage
  const currentUser: number | null =
    parseInt(localStorage.getItem("user_id") ?? "", 10) || null;

  let currentUsername: string = "";
  const token = localStorage.getItem("token");
  if (token) {
    const decoded: any = jwtDecode(token);
    currentUsername = decoded.username;
  }

  // Scrolls the message container to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Fetch messages with optional pagination (cursor-based)
  const fetchMessages = async (appendToTop = false) => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);

    // Save current scroll position before loading new messages
    const container = messagesContainerRef.current;
    const prevScrollHeight = container?.scrollHeight ?? 0;
    const prevScrollTop = container?.scrollTop ?? 0;
    const distanceFromBottom = prevScrollHeight - prevScrollTop;

    try {
      const cursorParam = cursor ? `&cursor=${encodeURIComponent(cursor)}` : "";
      const response = await axiosInstance.get(
        `${baseUrl}/chatrooms/${id}/messages/?limit=35${cursorParam}`
      );

      const results: Message[] = response.data.results;

      if (results && results.length > 0) {
        const sortedMessages = [...results].sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        if (appendToTop) {
          // Append older messages to top without duplication
          setMessage((prev) => {
            const existingIds = new Set(prev.map((msg) => msg.id));
            const newMessages = sortedMessages.filter(
              (msg) => !existingIds.has(msg.id)
            );
            return [...newMessages, ...prev];
          });

          // Maintain scroll position after adding new messages
          setTimeout(() => {
            if (container) {
              const newScrollHeight = container.scrollHeight;
              container.scrollTop = newScrollHeight - distanceFromBottom;
            }
          }, 0);
        } else {
          // Initial fetch, replace message list
          setMessage(sortedMessages);
          setTimeout(() => {
            scrollToBottom();
          }, 0);
        }

        // Update cursor for next fetch
        const nextCursor = response.data.next
          ? new URL(response.data.next).searchParams.get("cursor")
          : null;

        setCursor(nextCursor);
        setHasMore(!!response.data.next);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Error fetching messages: ", error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Fetch chat room details
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

  // Re-fetch chat info and messages when room changes
  useEffect(() => {
    setCursor(null);
    setHasMore(true);
    setMessage([]);
    fetchChatInfo();
    fetchMessages();
  }, [id]);

  // Initialize WebSocket connection
  useEffect(() => {
    const ws: WebSocket = new WebSocket(
      `${WsBaseUrl}/chat/${id}/?token=${token}`
    );
    socketRef.current = ws;

    ws.onopen = () => {
      console.log("Web socket connected");
    };

    // Handle incoming messages
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "new_message") {
          const newMessage: Message = data.message;

          // Add new message if not already in the list
          setMessage((prevMessages) => {
            if (prevMessages.some((msg) => msg.id === newMessage.id)) {
              return prevMessages;
            }
            return [...prevMessages, newMessage].sort(
              (a, b) =>
                new Date(a.timestamp).getTime() -
                new Date(b.timestamp).getTime()
            );
          });
        } else if (data.type === "typing") {
          setTypingUsers((prev) => {
            const updated = new Set(prev);
            updated.add(data.username);
            return updated;
          });
        } else if (data.type === "stop_typing") {
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

    // Cleanup WebSocket on unmount or room change
    return () => {
      if (ws.readyState === WebSocket.CONNECTING) {
        ws.onopen = () => ws.close();
      } else if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [id]);

  // Handle input field change and emit typing event
  const handleInputChange = (e: any) => {
    const value = e.target.value;
    setInputValue(value);

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: "typing",
          username: currentUsername,
        })
      );
    }

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

  // Send a message to the server
  const sendMessage = async () => {
    if (!inputValue.trim()) return;

    try {
      await axiosInstance.post(`${baseUrl}/chatrooms/${id}/messages/`, {
        content: inputValue,
      });

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

  // Toggle sidebar visibility
  const toggleSidebar = () => {
    setShowSidebar(!showSidebar);
  };

  // Format the timestamp for message bubble
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="flex h-screen bg-gray-950">
      <div
        className={`flex-1 flex flex-col bg-gray-950 text-white transition-all ${
          showSidebar ? "mr-64" : ""
        }`}
      >
        {/* Chat Header */}
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

            {/* Chat Info */}
            <div className="pl-3">
              {!loading && chatInfo && (
                <>
                  <div className="text-base font-semibold text-white">
                    {chatInfo.chat_name}
                  </div>

                  {!chatInfo.is_group && currentUser && (
                    <>
                      {chatInfo.participants &&
                        chatInfo.participants.length === 2 &&
                        (() => {
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

          {/* Toggle sidebar button */}
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

        {/* Chat Body with infinite scroll */}
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
            inverse={true}
            scrollableTarget="scrollableDiv"
            className="p-4 space-y-4"
            initialScrollY={0}
          >
            <div ref={messagesEndRef} />
            <div className="flex flex-col space-y-3">
              {message.map((msg, index) => {
                const isCurrentUser = currentUser === msg.sender.id;
                const showSender = index === 0 || 
                  message[index - 1].sender.id !== msg.sender.id;
                
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      isCurrentUser ? "items-end" : "items-start"
                    }`}
                  >
                    {!isCurrentUser && showSender && (
                      <span className="text-xs text-gray-500 ml-2 mb-1">
                        {msg.sender.username}
                      </span>
                    )}
                    <div className="flex items-end gap-1">
                      {!isCurrentUser && !showSender && (
                        <div className="w-6"></div>
                      )}
                      <div
                        className={`px-4 py-2 rounded-2xl max-w-xs break-words ${
                          isCurrentUser
                            ? "bg-blue-600 text-white rounded-br-sm"
                            : "bg-gray-800 text-white rounded-bl-sm"
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

        {/* Typing indicator */}
        {[...typingUsers].filter((u) => u !== currentUsername).length > 0 && (
          <div className="typing-indicator px-4 py-1 text-xs text-gray-400 bg-gray-900 bg-opacity-70">
            <div className="flex items-center">
              <div className="flex space-x-1 mr-2">
                <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce"></span>
                <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce delay-75"></span>
                <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce delay-150"></span>
              </div>
              {[...typingUsers].filter((u) => u !== currentUsername).join(", ")}{" "}
              {[...typingUsers].filter((u) => u !== currentUsername).length === 1
                ? "is"
                : "are"}{" "}
              typing...
            </div>
          </div>
        )}

        {/* Message input field */}
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
            <button
              className={`ml-2 p-2 rounded-full focus:outline-none ${
                inputValue.trim()
                  ? "text-blue-400 hover:text-blue-300"
                  : "text-gray-500"
              }`}
              onClick={sendMessage}
              disabled={!inputValue.trim()}
            >
              <FaPaperPlane className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Right Sidebar for Participants */}
      {showSidebar && (
        <div className="fixed right-0 w-64 h-full bg-gray-900 border-l border-gray-800 flex flex-col shadow-xl">
          <div className="p-4 border-b border-gray-800 bg-gray-950">
            <h2 className="text-base font-semibold text-white flex items-center">
              <span>Group Info</span>
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

            {/* Online Users */}
            <div className="mb-6">
              <h4 className="text-xs text-green-500 mb-2 flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                ONLINE
              </h4>
              <div className="space-y-3">
                {!loading &&
                  chatInfo?.participants &&
                  chatInfo.participants
                    .filter((p) => p.online_status)
                    .map((participant) => (
                      <div
                        key={participant.id}
                        className="flex items-center gap-2 hover:bg-gray-800 p-1 rounded-lg transition-colors"
                      >
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
                {!loading && 
                  chatInfo?.participants && 
                  !chatInfo.participants.filter(p => p.online_status).length && (
                    <div className="text-xs text-gray-500 italic">No users online</div>
                )}
              </div>
            </div>

            {/* Offline Users */}
            <div>
              <h4 className="text-xs text-gray-500 mb-2 flex items-center">
                <span className="w-2 h-2 bg-gray-500 rounded-full mr-2"></span>
                OFFLINE
              </h4>
              <div className="space-y-3">
                {!loading &&
                  chatInfo?.participants &&
                  chatInfo.participants
                    .filter((p) => !p.online_status)
                    .map((participant) => (
                      <div
                        key={participant.id}
                        className="flex items-center gap-2 hover:bg-gray-800 p-1 rounded-lg transition-colors"
                      >
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