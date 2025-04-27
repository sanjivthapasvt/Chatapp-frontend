import React, {useState, useEffect } from "react";
import {Link, useLocation, useNavigate} from "react-router-dom";
import axios from "axios";

function Chats(){
    const baseUrl = "127.0.0.1:8000/api"
    const navigate = useNavigate;
    const isAuthenticated = !!localStorage.getItem("token");
    return(
        <div></div>
    )
}

export default Chats;