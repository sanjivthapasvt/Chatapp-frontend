export interface User {
  id: number;
  user_id: string;
  profile_pic: string;
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
}
