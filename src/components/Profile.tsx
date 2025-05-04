import { useState, useEffect, ChangeEvent, FormEvent } from "react";
import {
  User,
  UserPasswordUpdate,
  UserProfileUpdate,
} from "../services/interface";
import axiosInstance from "../services/AxiosInstance";
import { UserCheck, Mail, Users, Edit, Camera } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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

  return (
    <div className="min-h-screen p-6 bg-gray-900 text-gray-100">
      <div className="max-w-3xl mx-auto bg-gray-800 rounded-lg shadow-lg overflow-hidden">
        {/* Profile Header */}
        <div className="relative">
          <div className="absolute inset-x-0 flex justify-center">
            <div className="relative">
              <div className="h-24 w-24 rounded-full border-4 border-gray-900 bg-gray-800 overflow-hidden">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Profile"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <UserCheck size={48} className="text-gray-500" />
                )}
              </div>
              {isEditing && (
                <label className="absolute bottom-0 right-0 p-1 bg-blue-500 rounded-full cursor-pointer">
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

        <div className="pt-16 px-6 pb-8">
          {/* Edit Mode */}
          {isEditing ? (
            <form onSubmit={handleSubmit} className="mt-8 space-y-6">
              {/* Profile Fields */}
              {!showPasswordFields && (
                <div className="space-y-4">
                  {["first_name", "last_name", "bio", "email"].map((field) => (
                    <div key={field}>
                      <label className="block text-sm text-gray-300 capitalize">
                        {field.replace("_", " ")}
                      </label>
                      <input
                        name={field}
                        type={field === "email" ? "email" : "text"}
                        value={
                          formData[field as keyof UserProfileUpdate] as string
                        }
                        onChange={handleInputChange}
                        className="w-full mt-1 p-2 bg-gray-700 rounded text-gray-200"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Toggle Password Fields */}
              <button
                type="button"
                onClick={() => setShowPasswordFields((prev) => !prev)}
                className="text-sm text-blue-400 hover:underline"
              >
                {showPasswordFields
                  ? "Back to Edit Profile"
                  : "Change Password?"}
              </button>

              {showPasswordFields && (
                <div className="mt-4 space-y-4 pt-4 border-t border-gray-700">
                  {["old_password", "new_password", "confirm_password"].map(
                    (field) => (
                      <div key={field}>
                        <label className="block text-sm text-gray-300">
                          {field.replace("_", " ")}
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
                          className="w-full mt-1 p-2 bg-gray-700 rounded text-gray-200"
                        />
                      </div>
                    )
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-4">
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
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded"
                >
                  Save
                </button>
              </div>

              {(error || success) && (
                <div className="mt-4 space-y-2">
                  {error && <p className="text-red-500">{error}</p>}
                  {success && <p className="text-green-500">{success}</p>}
                </div>
              )}
            </form>
          ) : (
            // Display Mode
            <>
              <div className="mt-16 text-center">
                <h2 className="text-3xl font-semibold text-white">
                  {userData?.first_name} {userData?.last_name}
                </h2>
                <p className="mt-1 flex items-center justify-center text-gray-400">
                  <UserCheck className="mr-1" size={16} />@{userData?.username}
                </p>
                <p className="mt-1 flex items-center justify-center text-gray-400">
                  <Mail className="mr-1" size={16} /> {userData?.email}
                </p>
                <p className="mt-3 text-gray-300 max-w-lg mx-auto">
                  {userData?.bio || "No bio available."}
                </p>
                <button
                  onClick={() => setIsEditing(true)}
                  className="mt-4 inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-md text-white"
                >
                  <Edit size={16} className="mr-2" /> Edit Profile
                </button>
              </div>

              <section className="mt-12">
                <h3 className="text-xl font-semibold text-white flex items-center">
                  <Users className="mr-2 text-indigo-400" size={20} />
                  Friends ({friends.length})
                </h3>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {friends.length > 0 ? (
                    friends.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center p-4 bg-gray-800 rounded-lg hover:bg-gray-700 transition"
                      >
                        <div className="h-12 w-12 rounded-full bg-gray-700 overflow-hidden flex-shrink-0">
                          {f.profile_pic ? (
                            <img
                              src={friendImage(f.profile_pic)}
                              alt={f.username.charAt(0).toUpperCase()}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="flex items-center justify-center h-full text-gray-400">
                              {f.username.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="ml-4 flex flex-col space-y-1">
                          <div className="flex items-center space-x-2">
                            <h4 className="text-white font-semibold text-lg">
                              {f.first_name} {f.last_name}
                            </h4>
                            <span
                              className={`h-2.5 w-2.5 rounded-full ${
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
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="mt-4 text-gray-400">No friends found.</p>
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Profile;
