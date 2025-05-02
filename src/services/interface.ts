export interface User {
  id: number;
  user_id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  profile_pic: string;
  friends: any[];
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

export interface ChatInfo {
  id: number;
  room_name: string;
  is_group: boolean;
  creator: User;
  participants: User[];
  group_image: string;
  last_message: {
    content: string;
    timestamp: string;
  } | null;
}
