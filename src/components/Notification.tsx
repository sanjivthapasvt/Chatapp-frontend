import { useEffect, useRef, useState } from "react";
import axiosInstance from "../services/AxiosInstance";
import { toast } from "react-toastify";
import { NotificationInterface } from "../services/interface";
import { formatDistanceToNow } from "date-fns";
import { Bell, Check, Trash2, CheckCheck } from "lucide-react";

function Notification() {
  const baseUrl = import.meta.env.VITE_BASE_URL;
  const WsBaseUrl = import.meta.env.VITE_WS_URL;

  const [notifications, setNotifications] = useState<NotificationInterface[]>(
    []
  );
  const socketRef = useRef<WebSocket | null>(null);

  const fetchNotification = async () => {
    try {
      const response = await axiosInstance.get(`${baseUrl}/notifications/`);
      setNotifications(response.data);
    } catch (error: any) {
      console.error(error);
      toast.error(
        error.response?.data?.detail || "Failed to fetch notifications."
      );
    }
  };

  const handleNotificationDelete = async (id: number) => {
    try {
      await axiosInstance.delete(`${baseUrl}/notifications/${id}/`);
      toast.success("Notification deleted");
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (error: any) {
      toast.error(
        error.response?.data?.detail || "Failed to delete notification."
      );
    }
  };

  const markRead = async (id: number) => {
    try {
      await axiosInstance.post(`${baseUrl}/notifications/${id}/mark_read/`);
      toast.success("Marked as read");
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Failed to mark as read.");
    }
  };

  const markAllRead = async () => {
    try {
      await axiosInstance.post(`${baseUrl}/notifications/mark_all_read/`);
      toast.success("All notifications marked as read");
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (error: any) {
      toast.error(
        error.response?.data?.detail || "Failed to mark all as read."
      );
    }
  };

  useEffect(() => {
    fetchNotification();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const ws = new WebSocket(`${WsBaseUrl}/notifications/?token=${token}`);
    socketRef.current = ws;

    ws.onopen = () => console.log("WebSocket connected");

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        switch (data.type) {
          case "new_notification":
            toast.info("📨 New notification received!");
            setNotifications((prev) => [data.notification, ...prev]);
            break;
          case "notification_list":
            setNotifications(data.notifications);
            break;
          case "mark_read_response":
            console.log("Mark read result", data.success);
            break;
          case "mark_all_read_response":
            console.log("Mark all read result", data.success);
            break;
          case "error":
            toast.error(data.message || "WebSocket error");
            break;
        }
      } catch (err) {
        console.error("Error parsing WebSocket message:", err);
      }
    };

    ws.onclose = () => console.log("WebSocket disconnected");
    ws.onerror = (err) => console.error("WebSocket error:", err);

    return () => {
      ws.close();
    };
  }, []);

  return (
    <div className="bg-gray-900 text-white min-h-screen p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Bell size={24} className="text-indigo-400" />
          <h1 className="text-xl font-bold">Notifications</h1>
        </div>
        {notifications.length > 0 && (
          <button
            onClick={markAllRead}
            className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-md flex items-center gap-2"
          >
            <CheckCheck size={16} />
            <span className="hidden sm:inline">Mark All Read</span>
          </button>
        )}
      </div>

      {/* Notifications list */}
      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center mt-16 text-gray-400">
          <Bell size={48} className="mb-4 opacity-50" />
          <p>No notifications</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`flex items-start gap-3 p-4 rounded-lg border ${
                notification.is_read
                  ? "bg-gray-800 border-gray-700"
                  : "bg-gray-800 border-indigo-500"
              }`}
            >
              {/* Notification indicator */}
              <div className="flex-shrink-0 mt-1">
                {!notification.is_read && (
                  <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                )}
                {notification.is_read && (
                  <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                )}
              </div>

              {/* Notification content */}
              <div className="flex-grow min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-sm text-white">
                    {notification.chat_name || "Notification"}
                  </p>
                  {!notification.is_read && (
                    <span className="px-2 py-0.5 text-xs bg-indigo-600 text-white rounded-full">
                      New
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-300 mb-2">
                  <span className="font-medium">{notification.sender}:</span>{" "}
                  {notification.message}
                </p>
                <p className="text-xs text-gray-400">
                  {formatDistanceToNow(new Date(notification.timestamp), {
                    addSuffix: true,
                  })}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col gap-2 flex-shrink-0">
                {!notification.is_read && (
                  <button
                    onClick={() => markRead(notification.id)}
                    className="px-3 py-1.5 text-xs bg-green-700 hover:bg-green-800 text-white rounded-md flex items-center gap-1"
                  >
                    <Check size={12} />
                    <span className="hidden sm:inline">Read</span>
                  </button>
                )}
                <button
                  onClick={() => handleNotificationDelete(notification.id)}
                  className="px-3 py-1.5 text-xs bg-red-700 hover:bg-red-800 text-white rounded-md flex items-center gap-1"
                >
                  <Trash2 size={12} />
                  <span className="hidden sm:inline">Delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Notification;