import React, {useState, useEffect } from "react";
import {Link, useLocation, useNavigate} from "react-router-dom";
import axios from "axios";

function Chats(){
    const baseUrl = "http://localhost:8000/api";
    const navigate = useNavigate;
    //!! is for ts to know that the value will be on boolean
    const isAuthenticated= !!localStorage.getItem("token");
    return(
        <div></div>
    )
}

export default Chats;