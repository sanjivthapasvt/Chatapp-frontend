import { useContext } from "react";
import { ChatContext } from "../services/ChatContext";
import svtchat from '/svt.png';

const Home = () => {
  const context = useContext(ChatContext);
  if (!context) return null;

  const { userInfo } = context;
  const username = userInfo?.username || "User";

  return (
    <div className="min-h-screen bg-gray-800 text-white flex flex-col items-center justify-center p-6">
        <img src={svtchat} className="w-25 h-25 text-indigo-500 mb-4"/>
      <h1 className="text-3xl font-bold mb-2">Welcome, {username}!</h1>         
      <p className="text-lg text-gray-300">
        Select a chat to get started.
      </p>
    </div>
  );
};

export default Home;