import axiosInstance from "../services/axiosInstance";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

interface User {
  id: number;
  username: string;
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
}
function ChatRoom() {
  const baseUrl = "http://127.0.0.1:8000/api";
  const WsBaseUrl = "ws://localhost:8000/ws";
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [inputValue, setInputValue] = useState("");
  const { id } = useParams();
  const [message, setMessage] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatInfo, setChatInfo] = useState<ChatInfo | null>(null);
  const currentUser: number | null =
    parseInt(localStorage.getItem("user_id") ?? "", 10) || null;
  const [typingUser, setTypingUser] = useState<string | null>(null);

  const fetchMessages = async () => {
    try {
      const response = await axiosInstance.get(
        `${baseUrl}/chatrooms/${id}/messages/`
      );
      setMessage(response.data);
      console.log(message);
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
          setMessage((prevMessages) => [...prevMessages, newMessage]);
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
  }, []);

  const sendMessage = () => {
    if (socket && socket.readyState === WebSocket.OPEN && inputValue.trim()) {
      socket.send(
        JSON.stringify({
          type: "chat_message",
          message: inputValue,
        })
      );
      setInputValue("");
    }
  };

  return (
    <div className="flex h-screen">
      <div className="flex-1 flex flex-col bg-[#111827] text-white">
        {/* Chat Header */}
        <div className="flex items-center p-4 border-b border-gray-700">
          <div className="w-10 h-10 bg-gray-500 rounded-full mr-3"></div>
          <div>
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

        {/* Chat Input */}
        <div className="p-4 border-t border-gray-800 flex items-center">
          <input
            type="text"
            placeholder="Send a message ..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
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
