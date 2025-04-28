// services/authService.ts

import axios from "axios";
import { toast } from "react-toastify";
import { NavigateFunction } from "react-router-dom";
const baseUrl = "http://localhost:8000";

export const handleLogout = async (navigate: NavigateFunction) => {
  try {
    const token = localStorage.getItem("token");
    if (token) {
      await axios.post(
        `${baseUrl}/logout`,
        { refresh_token: localStorage.getItem("refresh_token") },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
    }
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user_id");

    toast.success("Successfully logged out!");
    navigate("/auth");
  } catch (error) {
    console.error(error);
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user_id");

    toast.error("Logged out");
    navigate("/auth");
  }
};
