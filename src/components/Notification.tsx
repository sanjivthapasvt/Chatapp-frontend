import { useEffect, useRef, useState } from "react";
import axiosInstance from "../services/AxiosInstance";
import { toast } from "react-toastify";
import { NotificationInterface } from "../services/interface";
import { formatDistanceToNow } from "date-fns";

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
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Notifications</h2>
        <button
          onClick={markAllRead}
          className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
        >
          Mark All as Read
        </button>
      </div>

      {notifications.length === 0 ? (
        <p className="text-gray-500 text-center">No notifications</p>
      ) : (
        <ul className="space-y-3">
          {notifications.map((notification) => (
            <li
              key={notification.id}
              className={`p-4 rounded shadow-md flex justify-between items-start ${
                notification.is_read
                  ? "bg-gray-100"
                  : "bg-white border-l-4 border-blue-500"
              }`}
            >
              <div>
                <p className="font-semibold text-sm text-gray-700 mb-1">
                  {notification.room_name || "Notification"}
                </p>
                <p className="text-sm text-gray-800">{notification.sender}: {notification.message}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {formatDistanceToNow(new Date(notification.timestamp), {
                    addSuffix: true,
                  })}
                </p>
              </div>

              <div className="flex flex-col space-y-1 items-end ml-4">
                {!notification.is_read && (
                  <button
                    onClick={() => markRead(notification.id)}
                    className="text-xs bg-green-500 text-white px-2 py-0.5 rounded hover:bg-green-600"
                  >
                    Mark Read
                  </button>
                )}
                <button
                  onClick={() => handleNotificationDelete(notification.id)}
                  className="text-xs bg-red-500 text-white px-2 py-0.5 rounded hover:bg-red-600"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default Notification;
