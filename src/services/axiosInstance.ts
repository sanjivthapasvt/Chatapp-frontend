import axios from "axios";

const baseUrl = import.meta.env.VITE_BASE_URL;

const axiosInstance = axios.create({
  baseURL: baseUrl,
});

//interceptor for adding header automatically on every request
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    //add token to header if it exist
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// response interceptor for token refresh
axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // if we got error 401 and we haven't tried to refresh the token yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Get refresh token
        const refreshToken = localStorage.getItem("refresh_token");

        if (refreshToken) {
          // Try to get a new token
          const response = await axios.post(`${baseUrl}/token/refresh/`, {
            refresh: refreshToken,
          });

          if (response.data.access) {
            // update token in localStorage
            localStorage.setItem("token", response.data.access);

            // update the authorization header
            originalRequest.headers.Authorization = `Bearer ${response.data.access}`;

            // retry the original request
            return axiosInstance(originalRequest);
          }
        }

        // If refresh failed or no refresh token, redirect to login
        window.location.href = "/auth";
        localStorage.clear();
        return Promise.reject(error);
      } catch (refreshError) {
        // If refresh token is invalid or expired
        localStorage.clear();
        window.location.href = "/auth";
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
