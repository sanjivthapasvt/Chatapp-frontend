import { useEffect, useState } from "react";
import { User } from "../services/interface";
import axiosInstance from "../services/AxiosInstance";
import { toast} from "react-toastify";
import {
  UserPlus,
  Users,
  Search,
  X,
  Check,
} from "lucide-react";

function Friends() {
  const baseUrl = import.meta.env.VITE_BASE_URL;
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const currentUser: number | null =
    parseInt(localStorage.getItem("user_id") ?? "", 10) || null;

  const fetchUser = async () => {
    setIsLoading(true);
    try {
      const response = await axiosInstance.get(`${baseUrl}/users/`, {
        params: {
          search: searchTerm,
          ordering: "username",
        },
      });
      // Filter out current user
      const filteredUsers = response.data.filter(
        (user: User) => user.id !== currentUser
      );
      setUsers(filteredUsers);
    } catch (error) {
      console.error("Error fetching users: ", error);
      toast.error("Failed to load users");
    } finally {
      setIsLoading(false);
    }
  };

  const addFriend = async (id: number) => {
    try {
      const response = await axiosInstance.post(`${baseUrl}/friend-requests/`, {
        to_user: id,
      });
      if (response.status === 200 || response.status === 201) {
        toast.success("Friend request sent!");
      }
    } catch (error: any) {
      if (error.response?.status === 409) {
        toast.error("Friend request already sent!");
      } else {
        toast.error("Error while sending friend request!");
      }
      console.error("Error sending friend request", error);
    }
    fetchUser();
  };

  const acceptFriendRequest = async (id: number) => {
    try {
      const response = await axiosInstance.post(
        `${baseUrl}/friend-requests/${id}/accept/`
      );
      if (response.status === 200 || response.status === 201) {
        toast.success("Successfully accepted friend request");
        sessionStorage.removeItem("friends");
      }
    } catch (error: any) {
      if (error.response?.status === 404 || error.response?.status === 410) {
        toast.error("Friend request not found or already accepted!");
      } else {
        toast.error("Error while accepting request!");
      }
      console.error(error);
    }
    fetchUser();
  };

  const rejectFriendRequest = async (id: number) => {
    try {
      const response = await axiosInstance.post(
        `${baseUrl}/friend-requests/${id}/reject/`
      );
      if (response.status === 200 || response.status === 201) {
        toast.success("Successfully rejected friend request");
      }
    } catch (error: any) {
      if (error.response?.status === 404 || error.response?.status === 410) {
        toast.error("Friend request not found or already rejected");
      }
    }
    fetchUser();
  };

  const cancelFriendRequest = async (id: number) => {
    try {
      const response = await axiosInstance.post(
        `${baseUrl}/friend-requests/${id}/cancel/`
      );
      if (response.status === 200 || response.status === 201) {
        toast.success("Successfully cancelled friend request");
      }
    } catch (error: any) {
      if (error.response?.status === 404 || error.response?.status === 410) {
        toast.error("Friend request not found or already cancelled!");
      }
    }
    fetchUser();
  };

  useEffect(() => {
    fetchUser();
  }, []);

  return (
    <div className="bg-gray-900 text-white min-h-screen p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Users size={24} className="text-indigo-400" />
          <h1 className="text-xl font-bold">Friends</h1>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative mb-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchUser();
          }}
          className="relative"
        >
          <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search users..."
            className="w-full pl-10 pr-4 py-2 bg-gray-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-700"
          />
        </form>
      </div>

      {/* Users list */}
      {isLoading ? (
        <div className="flex justify-center mt-8">
          <div className="text-gray-400">Loading users...</div>
        </div>
      ) : users.length > 0 ? (
        <div className="space-y-3">
          {users.map((u) => {
            // determine which request ID to use for cancel/accept/reject
            const requestId =
              u.friendship_status === "request_sent"
                ? u.outgoing_request_id
                : u.friendship_status === "request_received"
                ? u.incoming_request_id
                : null;

            return (
              <div
                key={u.id}
                className="flex items-center gap-3 p-4 bg-gray-800 rounded-lg border border-gray-700"
              >
                <div className="w-12 h-12 rounded-full overflow-hidden bg-indigo-600 flex items-center justify-center">
                  {u.profile_pic ? (
                    <img
                      src={u.profile_pic}
                      alt={u.username}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-white font-medium text-lg">
                      {u.username.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-grow">
                  <p className="font-medium">{u.username}</p>
                  <p className="text-xs text-gray-400">
                    {u.friendship_status === "friends" && "Friend"}
                    {u.friendship_status === "request_sent" && "Request sent"}
                    {u.friendship_status === "request_received" &&
                      "Request received"}
                    {(u.friendship_status === null ||
                      u.friendship_status === "none") &&
                      "Not connected"}
                  </p>
                </div>

                <div className="flex gap-2">
                  {u.friendship_status === "friends" && (
                    <button className="px-3 py-2 text-sm bg-gray-700 hover:bg-gray-900 text-white rounded-md flex items-center gap-1">
                      <Users size={16} />
                      <span className="hidden sm:inline">Friends</span>
                    </button>
                  )}

                  {u.friendship_status === "request_sent" && (
                    <button
                      className="px-3 py-2 text-sm bg-yellow-800 hover:bg-yellow-900 text-white rounded-md flex items-center gap-1"
                      onClick={() => cancelFriendRequest(requestId!)}
                    >
                      <X size={16} />
                      <span className="hidden sm:inline">Cancel</span>
                    </button>
                  )}

                  {u.friendship_status === "request_received" && (
                    <div className="flex gap-2">
                      <button
                        className="px-3 py-2 text-sm bg-green-700 hover:bg-green-800 text-white rounded-md flex items-center gap-1"
                        onClick={() => acceptFriendRequest(requestId!)}
                      >
                        <Check size={16} />
                        <span className="hidden sm:inline">Accept</span>
                      </button>
                      <button
                        className="px-3 py-2 text-sm bg-red-700 hover:bg-red-800 text-white rounded-md flex items-center gap-1"
                        onClick={() => rejectFriendRequest(requestId!)}
                      >
                        <X size={16} />
                        <span className="hidden sm:inline">Reject</span>
                      </button>
                    </div>
                  )}

                  {(u.friendship_status === null ||
                    u.friendship_status === "none") && (
                    <button
                      className="px-3 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-md flex items-center gap-1"
                      onClick={() => addFriend(u.id)}
                    >
                      <UserPlus size={16} />
                      <span className="hidden sm:inline">Add</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center mt-16 text-gray-400">
          <Search size={48} className="mb-4 opacity-50" />
          <p>No users found matching your search.</p>
        </div>
      )}
    </div>
  );
}

export default Friends;