//necessary libraries and components
import { jwtDecode } from "jwt-decode";
import axiosInstance from "../services/axiosInstance";
import { useEffect, useRef, useState } from "react";
import { FaUser } from "react-icons/fa";
import { useParams } from "react-router-dom";
import { Message, ChatInfo } from "../services/interface";
import InfiniteScroll from "react-infinite-scroll-component";

//global timeout variable for "typing" indicator
let typingTimeout: any;

function ChatRoom() {
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
  const [chatInfo, setChatInfo] = useState<ChatInfo | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [isLoadingMore, setIsLoadingMore] = useState(false);

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

  return (
    <div className="flex h-screen">
      <div className="flex-1 flex flex-col bg-[#111827] text-white">
        {/* Chat Header */}
        <div className="flex items-center p-4 border-b border-gray-700">
          <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
            {chatInfo?.group_image ? (
              <img
                src={chatInfo.group_image}
                alt="Group"
                className="w-full h-full object-cover"
              />
            ) : (
              <FaUser className="text-gray-500 w-6 h-6" />
            )}
          </div>

          <div className="pl-2">
            {!loading && chatInfo && (
              <div className="font-semibold">{chatInfo.room_name}</div>
            )}
            <div className="text-green-400 text-sm">
              {!chatInfo?.is_group && <div>Later for Online status</div>}
            </div>
          </div>
        </div>

        {/* Chat Body with infinite scroll */}
        <div
          id="scrollableDiv"
          className="flex-1 overflow-y-auto flex flex-col-reverse"
          ref={messagesContainerRef}
        >
          <InfiniteScroll
            dataLength={message.length}
            next={() => fetchMessages(true)}
            hasMore={hasMore}
            loader={
              <div className="text-center text-gray-400 py-2">Loading...</div>
            }
            style={{ display: "flex", flexDirection: "column-reverse" }}
            inverse={true}
            scrollableTarget="scrollableDiv"
            className="p-4 space-y-4"
            initialScrollY={0}
          >
            <div ref={messagesEndRef} />
            <div className="flex flex-col space-y-2">
              {message.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    currentUser === msg.sender.id
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >
                  <div
                    className={`px-4 py-2 rounded-xl max-w-xs ${
                      currentUser === msg.sender.id
                        ? "bg-blue-600 text-white"
                        : "bg-gray-400 text-black"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>
          </InfiniteScroll>
        </div>

        {/* Typing indicator */}
        {[...typingUsers].filter((u) => u !== currentUsername).length > 0 && (
          <div className="typing-indicator px-4 text-sm text-gray-400">
            {[...typingUsers].filter((u) => u !== currentUsername).join(", ")}{" "}
            {[...typingUsers].filter((u) => u !== currentUsername).length === 1
              ? "is"
              : "are"}{" "}
            typing...
          </div>
        )}

        {/* Message input field */}
        <div className="p-4 border-t border-gray-800 flex items-center">
          <input
            type="text"
            placeholder="Send a message ..."
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                sendMessage();
              }
            }}
            className="flex-1 p-2 rounded-l bg-[#2A2A40] text-white placeholder-gray-400"
          />
          <button
            className="bg-blue-600 px-4 py-2 rounded-r"
            onClick={sendMessage}
            disabled={!inputValue.trim()}
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChatRoom;
