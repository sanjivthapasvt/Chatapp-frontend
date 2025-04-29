import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Bounce, ToastContainer, toast } from "react-toastify";
import { jwtDecode } from "jwt-decode";

interface DecodedToken {
  user_id: number;
  exp: number;
  iat: number;
  [key: string]: any;
}

function Auth() {
  const baseUrl = "http://localhost:8000/api";
  const [isLoginForm, setIsLoginForm] = useState(true);
  const [formData, setFormData] = useState({
    //identfier because my backend expects either username or password
    identifier: "",
    username: "",
    email: "",
    password: "",
    confirm_password: "",
  });

  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const toggleForm = () => setIsLoginForm(!isLoginForm);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!isLoginForm && formData.password !== formData.confirm_password) {
      toast.error("Passwords do not match");
      return;
    }

    try {
      const url = isLoginForm ? `${baseUrl}/login/` : `${baseUrl}/register/`;
      const data = isLoginForm
        ? {
            identifier:
            formData.identifier,
            password: formData.password,
          }
        : formData;

      const response = await axios.post(url, data);

      const accessToken = response.data.tokens?.access;
      const refreshToken = response.data.tokens?.refresh;

      if (accessToken && refreshToken) {
        localStorage.setItem("token", accessToken);
        localStorage.setItem("refresh_token", refreshToken);
        const decodedToken = jwtDecode<DecodedToken>(accessToken);
        const userId = decodedToken.user_id;
        localStorage.setItem("user_id", userId.toString());
        navigate("/home", { state: { showLoginSuccess: true } });
      } else {
        toast.error("No token found in response");
      }
    } catch (error: any) {
      const err = error.response?.data;
      if (typeof err === "string") {
        toast.error(err);
      } else if (typeof err === "object") {
        toast.error(Object.values(err).flat().join(" "));
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-900 p-4">
      <ToastContainer
        position="top-right"
        autoClose={1500}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnFocusLoss={false}
        draggable
        pauseOnHover={false}
        theme="dark"
        transition={Bounce}
      />
      <div className="w-full max-w-md p-8 space-y-6 bg-slate-800 rounded-2xl shadow-xl border border-slate-700">
        <div className="mb-6 text-center">
          <h2 className="text-4xl font-bold text-white mb-1">
            {isLoginForm ? "Login" : "Signup"}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {isLoginForm ? (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Email or Username
                </label>
                <input
                  type="text"
                  name="identifier"
                  placeholder="Enter email or username"
                  value={formData.identifier}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 rounded-xl bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  name="username"
                  placeholder="Enter username"
                  value={formData.username}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 rounded-xl bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </>
          )}
          {!isLoginForm && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  placeholder="example@email.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 rounded-xl bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Password
            </label>
            <input
              type="password"
              name="password"
              placeholder="Enter password"
              value={formData.password}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 rounded-xl bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {!isLoginForm && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                name="confirm_password"
                placeholder="Enter confirm password"
                value={formData.confirm_password}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 rounded-xl bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          <button
            type="submit"
            className="w-full cursor-pointer px-4 py-3 mt-6 font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-800"
          >
            {isLoginForm ? "Sign In" : "Create Account"}
          </button>
        </form>

        <div className="pt-2">
          <p className="text-sm text-center text-slate-400">
            {isLoginForm
              ? "Don't have an account?"
              : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={toggleForm}
              className="font-medium cursor-pointer text-blue-400 hover:text-blue-300 focus:outline-none"
            >
              {isLoginForm ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Auth;