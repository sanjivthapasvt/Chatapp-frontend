import React, { createContext, useState, useEffect, ReactNode } from "react";
import axiosInstance from "./AxiosInstance";
import { ChatDetails, User } from "./interface";

type ChatContextType = {
  userInfo: User | null;
  setUserInfo: React.Dispatch<React.SetStateAction<User | null>>;
  chatInfo: ChatDetails | null;
  setChatInfo: React.Dispatch<React.SetStateAction<ChatDetails | null>>;
  chatList: ChatDetails[];
  setChatList: React.Dispatch<React.SetStateAction<ChatDetails[]>>;
  logout: () => void;
  isAuthenticated: boolean;
  login: () => void;
  loading: boolean;
};

export const ChatContext = createContext<ChatContextType | null>(null);

export const ChatProvider = ({ children }: { children: ReactNode }) => {
  const [userInfo, setUserInfo] = useState<User | null>(null);
  const [chatList, setChatList] = useState<ChatDetails[]>([]);
  const [chatInfo, setChatInfo] = useState<ChatDetails | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(
    !!localStorage.getItem("token")
  );
  const [loading, setLoading] = useState(true);

  const login = () => {
    setIsAuthenticated(true);
  };

  const logout = () => {
    setUserInfo(null);
    setChatList([]);
    setChatInfo(null);
    setIsAuthenticated(false);
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user_id");
  };

  const contextValue = {
    userInfo,
    setUserInfo,
    chatInfo,
    setChatInfo,
    chatList,
    setChatList,
    isAuthenticated,
    login,
    logout,
    loading,
  };

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }

      try {
        const baseUrl = import.meta.env.VITE_BASE_URL;
        await axiosInstance.get(`${baseUrl}/profile/`);
        setIsAuthenticated(true);
      } catch (error: any) {
        if (error.response?.status === 401) {
          logout();
        }
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  return (
    <ChatContext.Provider value={contextValue}>{children}</ChatContext.Provider>
  );
};
