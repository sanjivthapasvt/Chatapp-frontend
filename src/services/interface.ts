export interface User {
  id: number;
  user_id: string;
  username: string;
  bio: string;
  email: string;
  first_name: string;
  last_name: string;
  profile_pic: string;
  friends: User[];
  online_status:boolean;
  last_seen: string;
  friendship_status: "friends" | "request_sent" | "request_received" | "none" | null;
  outgoing_request_id: number | null;
  incoming_request_id: number | null;
  is_admin: boolean;
}

export interface Message {
  id: number;
  room: number;
  sender: User;
  content: string;
  timestamp: string;
  image: string;
  read_statuses: User[];
}

export interface ChatDetails {
  id: number;
  room_name: string;
  chat_name: string;
  is_group: boolean;
  creator: User;
  participants: User[];
  group_image: string;
  last_message: {
    content: string;
    timestamp: string;
    sender_name: string;
  } | null;
}

export type CreateRoomData = {
  room_name: string;
  participant_ids: number[];
  group_image: File | null;
};

export interface UserProfileUpdate {
  email: string;
  first_name: string;
  last_name: string;
  bio: string;
  profile_pic?: File | null;
}

export interface UserPasswordUpdate{
  old_password: string;
  new_password: string;
  confirm_password: string;
}