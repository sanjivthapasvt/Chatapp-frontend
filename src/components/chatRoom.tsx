import { jwtDecode } from "jwt-decode";
import axiosInstance from "../services/axiosInstance";
import { useEffect, useState } from "react";
import { FaUser } from "react-icons/fa";
import { useParams } from "react-router-dom";

interface User {
  id: number;
  user_id: string;
  profile_pic: string;
}

interface Message {
  id: number;
  room: number;
  sender: User;
  content: string;
  timestamp: string;
  image: string;
  read_statuses: User[];
}

interface ChatInfo {
  id: number;
  room_name: string;
  is_group: boolean;
  creator: User;
  participants: User[];
  group_image: string;
}
let typingTimeout: any;

function ChatRoom() {
  const baseUrl = import.meta.env.VITE_BASE_URL
  const WsBaseUrl = import.meta.env.VITE_WS_URL;
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [inputValue, setInputValue] = useState("");
  const { id } = useParams();
  let currentUsername: string;
  const [message, setMessage] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatInfo, setChatInfo] = useState<ChatInfo | null>(null);
  const currentUser: number | null =
    parseInt(localStorage.getItem("user_id") ?? "", 10) || null;
  const [typingUsers, setTypingUsers] = useState<Set<string>>(
    new Set<string>()
  );
  const token = localStorage.getItem("token");
  if (token) {
    const decoded: any = jwtDecode(token);
    currentUsername = decoded.username;
  }
  const fetchMessages = async () => {
    try {
      const response = await axiosInstance.get(
        `${baseUrl}/chatrooms/${id}/messages/`
      );
      const sortedMessages = [...response.data].sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      setMessage(sortedMessages);
    } catch (error) {
      console.error("Error fetching messages: ", error);
    }
  };

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
  useEffect(() => {
    fetchChatInfo();
    fetchMessages();
  }, [id]);

  useEffect(() => {
    const newSocket: WebSocket = new WebSocket(
      `${WsBaseUrl}/chat/${id}/?token=${localStorage.getItem("token")}`
    );
    newSocket.onopen = () => {
      console.log("Web socket conneected");
    };

    newSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "new_message") {
          const newMessage: Message = data.message;
          setMessage((prevMessages) =>
            [...prevMessages, newMessage].sort(
              (a, b) =>
                new Date(a.timestamp).getTime() -
                new Date(b.timestamp).getTime()
            )
          );
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

    newSocket.onclose = () => {
      console.log("WebSocket connection closed");
    };

    newSocket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    setSocket(newSocket);
    return () => {
      newSocket.close();
    };
  }, [id]);

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

  const sendMessage = async () => {
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

        {/* Chat Body */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
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
        </div>
        {[...typingUsers].filter((u) => u !== currentUsername).length > 0 && (
          <div className="typing-indicator">
            {[...typingUsers].filter((u) => u !== currentUsername).join(", ")}{" "}
            {[...typingUsers].filter((u) => u !== currentUsername).length === 1
              ? "is"
              : "are"}{" "}
            typing...
          </div>
        )}
        {/* Chat Input */}
        <div className="p-4 border-t border-gray-800 flex items-center">
          <input
            type="text"
            placeholder="Send a message ..."
            value={inputValue}
            onChange={handleInputChange}
            className="flex-1 p-2 rounded-l bg-[#2A2A40] text-white placeholder-gray-400"
          />
          <button
            className="bg-blue-600 px-4 py-2 rounded-r"
            onClick={sendMessage}
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChatRoom;
