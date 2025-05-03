import { User, UserUpdate } from "../services/interface";
import axiosInstance from "../services/axiosInstance";
import { useState, useEffect } from "react";

function Profile() {
  const baseUrl = import.meta.env.VITE_BASE_URL;
  const [isEditForm, setIsEditForm] = useState();
  const isAuthenticated = !!localStorage.getItem("token");
  const [userData, setUserData] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserUpdate>({
    first_name: "",
    last_name: "",
    email: "",
  });
  const [passwordData, setPasswordData] = useState({
    old_password: "",
    new_password: "",
    confirm_password: "",
  });

  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const fetchProfile = async () => {
      if (!isAuthenticated) return;
      try {
        setLoading(true);
        const response = await axiosInstance.get(`${baseUrl}/profile/`);
        setUserData(response.data);

        setFormData({
          first_name: response.data.first_name,
          last_name: response.data.last_name,
          email: response.data.email,
        });

        if (response.data.profile_pic) {
          setImagePreview(response.data.profile_pic);
        }
      } catch (error) {
        setError("Error loading profile");
        console.error("Error fetching user information", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      const updateData = new FormData();
      updateData.append("first_name", formData.first_name);
      updateData.append("last_name", formData.last_name);
      updateData.append("email", formData.email);

      if (selectedImage) {
        updateData.append("profile_pic", selectedImage);
      }

      if (isChangingPassword) {
        updateData.append("old_password", passwordData.old_password);
        updateData.append("new_password", passwordData.new_password);
        updateData.append("confirm_password", passwordData.confirm_password);
      }

      const response = await axiosInstance.patch(
        `${baseUrl}/profile/`,
        updateData
      );

      if (response.status === 200) {
        setSuccess("Profile update successfully!");
        setIsEditing(false);
        setIsChangingPassword(false);

        const profileUpdateResponse = await axiosInstance.get(
          `${baseUrl}/profile/`
        );
        setUserData(profileUpdateResponse.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to update profile");
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-900">
        <div className="text-blue-400 text-xl">Loading profile...</div>
      </div>
    );
  }
  if (!userData) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-900">
        <div className="text-red-400 text-xl">
          Unable to load profile. Please login again.
        </div>
      </div>
    );
  }

  return <div>Profile</div>;
}

export default Profile;
