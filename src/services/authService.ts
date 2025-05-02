import axios from "axios";
import { NavigateFunction } from "react-router-dom";

const baseUrl = import.meta.env.VITE_BASE_URL;

export const handleLogout = async (
  navigate: NavigateFunction,
  resetState: () => void
) => {
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
    resetState();
    navigate("/", { replace: true });
  } catch (error) {
    resetState();
    navigate("/", { replace: true });
  }
};
