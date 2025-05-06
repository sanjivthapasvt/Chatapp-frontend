import { useState, useEffect, ChangeEvent, FormEvent } from "react";
import {
  User,
  UserPasswordUpdate,
  UserProfileUpdate,
} from "../services/interface";
import axiosInstance from "../services/AxiosInstance";
import { UserCheck, Mail, Users, Edit, Camera, UserX } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Swal from "sweetalert2";

function Profile() {
  const baseUrl = import.meta.env.VITE_BASE_URL;
  const mediaBaseUrl = import.meta.env.VITE_MEDIA_BASE_URL;
  const isAuthenticated = Boolean(localStorage.getItem("token"));
  const [userData, setUserData] = useState<User | null>(null);
  const [friends, setFriends] = useState<User[]>([]);
  const [formData, setFormData] = useState<UserProfileUpdate>({
    first_name: "",
    last_name: "",
    bio: "",
    email: "",
  });
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [passwordFormData, setPasswordFormData] = useState<UserPasswordUpdate>({
    old_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
    fetchFriends();
  }, []);

  const fetchProfile = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const { data } = await axiosInstance.get(`${baseUrl}/profile/`);
      setUserData(data);
      setFormData({
        first_name: data.first_name || "",
        last_name: data.last_name || "",
        bio: data.bio || "",
        email: data.email || "",
      });
      setImagePreview(data.profile_pic || null);
    } catch (err) {
      setError("Unable to load profile.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFriends = async () => {
    try {
      const { data } = await axiosInstance.get<User[]>(
        `${baseUrl}/friends/list_friends/`
      );
      setFriends(data);
    } catch (err) {
      console.error(err);
    }
  };

  const friendImage = (path: string) => {
    if (path.startsWith("http")) {
      return;
    }
    if (path.startsWith("/media")) {
      return `${mediaBaseUrl}/${path}`;
    }
  };
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePasswordChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const form = new FormData();
    form.append("first_name", formData.first_name);
    form.append("last_name", formData.last_name);
    form.append("bio", formData.bio);
    form.append("email", formData.email);
    if (selectedImage) form.append("profile_pic", selectedImage);
    if (showPasswordFields) {
      Object.entries(passwordFormData).forEach(([key, val]) => {
        form.append(key, val as string);
      });
    }
    try {
      const response = await axiosInstance.patch(`${baseUrl}/profile/`, form);
      if (response.status === 200) {
        setSuccess("Profile updated successfully!");
        setIsEditing(false);
        setShowPasswordFields(false);
        fetchProfile();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to update profile.");
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <span className="text-xl text-blue-400">Loading profile...</span>
      </div>
    );
  }

  const removeFriend = async (id: number) => {
    try {
      const result = await Swal.fire({
        title: "Do you want to remove the friend?",
        text: "Are you sure?",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Yes",
        cancelButtonText: "No",
      });
      if (result.isConfirmed) {
        await axiosInstance.post(`${baseUrl}/friends/${id}/remove_friend/`);
        Swal.fire("Removed!", "The friend has been removed.", "success");
        fetchFriends();
      }
    } catch (error) {
      console.error(error);
      Swal.fire(
        "Error",
        "Something went wrong while removing the friend.",
        "error"
      );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-gray-100">
      <div className="relative h-34 bg-gradient-to-r from-purple-900 via-indigo-800 to-purple-900">
        <div className="absolute -bottom-16 left-1/2 transform -translate-x-1/2">
          <div className="relative">
            <div className="h-32 w-32 rounded-full border-4 border-gray-800 bg-gray-700 overflow-hidden shadow-lg">
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Profile"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  <UserCheck size={64} className="text-gray-500" />
                </div>
              )}
            </div>
            {isEditing && (
              <label className="absolute bottom-1 right-1 p-2 bg-blue-600 hover:bg-blue-700 rounded-full cursor-pointer shadow-lg">
                <Camera size={16} className="text-white" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                 />
              </label>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 pt-20 pb-16 max-w-5xl">
        {isEditing ? (
          <form onSubmit={handleSubmit} className="mt-8 space-y-6 bg-gray-800 p-8 rounded-xl border border-gray-700 shadow-xl">
            <h2 className="text-2xl font-bold text-white text-center mb-6">Edit Profile</h2>
            {!showPasswordFields && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {["first_name", "last_name"].map((field) => (
                  <div key={field}>
                    <label className="block text-sm font-medium text-gray-300 capitalize mb-1">
                      {field.replace("_", " ")}
                    </label>
                    <input
                      name={field}
                      type="text"
                      value={
                        formData[field as keyof UserProfileUpdate] as string
                      }
                      onChange={handleInputChange}
                      className="w-full p-3 bg-gray-700 border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-gray-200"
                    />
                  </div>
                ))}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Email
                  </label>
                  <input
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full p-3 bg-gray-700 border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-gray-200"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Bio
                  </label>
                  <input
                    name="bio"
                    value={formData.bio}
                    onChange={handleInputChange}
                    className="w-full p-3 bg-gray-700 border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-gray-200"
                  ></input>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowPasswordFields((prev) => !prev)}
              className="text-sm text-blue-400 hover:text-blue-300 font-medium flex items-center"
            >
              {showPasswordFields
                ? "← Back to Edit Profile"
                : "Change Password?"}
            </button>

            {showPasswordFields && (
              <div className="mt-4 space-y-4 pt-4 border-t border-gray-700">
                {["old_password", "new_password", "confirm_password"].map(
                  (field) => (
                    <div key={field}>
                      <label className="block text-sm font-medium text-gray-300 capitalize mb-1">
                        {field.replace(/_/g, " ")}
                      </label>
                      <input
                        type="password"
                        name={field}
                        autoComplete={
                          field === "old_password"
                            ? "new-password"
                            : undefined
                        }
                        value={
                          passwordFormData[field as keyof UserPasswordUpdate]
                        }
                        onChange={handlePasswordChange}
                        className="w-full p-3 bg-gray-700 border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-gray-200"
                      />
                    </div>
                  )
                )}
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-6">
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setShowPasswordFields(false);
                  if (userData) {
                    setFormData({
                      first_name: userData.first_name || "",
                      last_name: userData.last_name || "",
                      bio: userData.bio || "",
                      email: userData.email || "",
                    });
                    setPasswordFormData({
                      old_password: "",
                      new_password: "",
                      confirm_password: "",
                    });
                    setSelectedImage(null);
                    setImagePreview(userData.profile_pic || null);
                  }
                }}
                className="px-5 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium shadow-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium shadow-md"
              >
                Save Changes
              </button>
            </div>

            {(error || success) && (
              <div className="mt-4 p-3 rounded-lg text-center">
                {error && <p className="text-red-500 font-medium">{error}</p>}
                {success && <p className="text-green-500 font-medium">{success}</p>}
              </div>
            )}
          </form>
        ) : (
          <>
            <div className="text-center">
              <h2 className="text-4xl font-bold text-white">
                {userData?.first_name} {userData?.last_name}
              </h2>
              <p className="mt-2 flex items-center justify-center text-gray-400">
                <UserCheck className="mr-2" size={16} />@{userData?.username}
              </p>
              <p className="mt-2 flex items-center justify-center text-gray-400">
                <Mail className="mr-2" size={16} /> {userData?.email}
              </p>
              <div className="mt-6 text-gray-300 max-w-2xl mx-auto bg-gray-800 bg-opacity-70 p-6 rounded-xl border border-gray-700 shadow-lg">
                <p className="italic">{userData?.bio || "No bio available."}</p>
              </div>
              <button
                onClick={() => setIsEditing(true)}
                className="mt-8 inline-flex items-center px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-medium shadow-lg"
              >
                <Edit size={18} className="mr-2" /> Edit Profile
              </button>
            </div>

            <section className="mt-16">
              <h3 className="text-2xl font-bold text-white flex items-center border-b border-gray-700 pb-3">
                <Users className="mr-2 text-indigo-400" size={24} />
                Friends ({friends.length})
              </h3>
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {friends.length > 0 ? (
                  friends.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center p-4 bg-gray-800 rounded-xl hover:bg-gray-700 transition border border-gray-700 shadow-md"
                    >
                      <div className="h-16 w-16 rounded-full bg-gray-600 overflow-hidden flex-shrink-0 border border-gray-500">
                        {f.profile_pic ? (
                          <img
                            src={friendImage(f.profile_pic)}
                            alt={f.username.charAt(0).toUpperCase()}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full text-gray-300 font-bold text-xl">
                            {f.username.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="ml-4 flex flex-col space-y-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="text-white font-semibold text-lg">
                            {f.first_name} {f.last_name}
                          </h4>
                          <span
                            className={`h-3 w-3 rounded-full ${
                              f.online_status ? "bg-green-500" : "bg-gray-500"
                            }`}
                            title={f.online_status ? "Online" : "Offline"}
                          ></span>
                        </div>
                        <p className="text-gray-400 text-sm">@{f.username}</p>
                        <p className="text-gray-400 text-xs italic">
                          {f.online_status
                            ? "Online"
                            : `Last seen ${formatDistanceToNow(
                                new Date(f.last_seen),
                                { addSuffix: true }
                              )}`}
                        </p>
                        <button
                          className="px-3 py-2 mt-1 text-sm bg-gray-600 hover:bg-red-700 text-white rounded-md flex items-center gap-1 transition-colors duration-200"
                          onClick={() => removeFriend(f.id)}
                        >
                          <UserX size={16} />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full p-8 text-center text-gray-400 bg-gray-800 bg-opacity-50 rounded-xl border border-gray-700">
                    <Users size={48} className="mx-auto mb-4 text-gray-500" />
                    <p className="text-lg">No friends found</p>
                    <p className="text-sm mt-2">Connect with other users to add them to your friends list</p>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

export default Profile;
