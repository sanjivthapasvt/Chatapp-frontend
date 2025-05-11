import { Menu, Dialog, Transition } from "@headlessui/react";
import { EllipsisVertical, UserPlus, LogOut, Check } from "lucide-react";
import { Fragment, useState } from "react";
import { User } from "../../services/interface";

type GroupActionsProps = {
  chatId: number;
  users: User[];
  participants: User[];
  addMember: (chatId: number, userIds: User["id"][]) => void;
  leaveRoom: (chatId: number) => void;
};

const GroupActions = ({
  chatId,
  users,
  participants,
  addMember,
  leaveRoom,
}: GroupActionsProps) => {
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<User["id"][]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const availableUsersForAdd = users.filter(
    (user) => !participants.some((p) => p.id === user.id)
  );

  const filteredUsers = searchQuery 
    ? availableUsersForAdd.filter(user => 
        user.username.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : availableUsersForAdd;

  const toggleUser = (id: User["id"]) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((uid) => uid !== id) : [...prev, id]
    );
  };

  const handleAdd = () => {
    if (selectedIds.length) {
      addMember(chatId, selectedIds);
      setAddModalOpen(false);
      setSelectedIds([]);
      setSearchQuery("");
    }
  };

  const closeModal = () => {
    setAddModalOpen(false);
    setSelectedIds([]);
    setSearchQuery("");
  };

  return (
    <div className="relative inline-block text-left">
      <Menu as="div" className="relative">
        <Menu.Button className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50">
          <EllipsisVertical size={18} className="text-gray-300" />
        </Menu.Button>

        <Transition
          as={Fragment}
          enter="transition ease-out duration-100"
          enterFrom="transform opacity-0 scale-95"
          enterTo="transform opacity-100 scale-100"
          leave="transition ease-in duration-75"
          leaveFrom="transform opacity-100 scale-100"
          leaveTo="transform opacity-0 scale-95"
        >
          <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 divide-y divide-gray-700 focus:outline-none">
            <div className="py-1">
              {availableUsersForAdd.length > 0 && (
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={() => setAddModalOpen(true)}
                      className={`${
                        active ? "bg-gray-700" : ""
                      } group flex items-center w-full px-4 py-2 text-left text-gray-200 text-sm`}
                    >
                      <UserPlus size={16} className="mr-3 text-blue-400" />
                      Add Members
                    </button>
                  )}
                </Menu.Item>
              )}
            </div>
            <div className="py-1">
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={() => leaveRoom(chatId)}
                    className={`${
                      active ? "bg-gray-700" : ""
                    } group flex items-center w-full px-4 py-2 text-left text-red-400 text-sm`}
                  >
                    <LogOut size={16} className="mr-3" />
                    Leave Group
                  </button>
                )}
              </Menu.Item>
            </div>
          </Menu.Items>
        </Transition>
      </Menu>

      {/* Enhanced Add Member Modal */}
      <Transition appear show={isAddModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={closeModal}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />
          </Transition.Child>

          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md rounded-lg bg-gray-900 p-6 shadow-xl border border-gray-800">
                <Dialog.Title className="text-lg font-medium text-white flex items-center">
                  <UserPlus size={20} className="mr-2 text-blue-400" />
                  Add Members
                </Dialog.Title>
                
                <div className="mt-4">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full p-2 pl-8 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      className="h-4 w-4 absolute left-2.5 top-3 text-gray-400" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  
                  <div className="text-sm text-gray-400 mt-2 flex items-center justify-between">
                    <span>
                      {selectedIds.length} {selectedIds.length === 1 ? 'user' : 'users'} selected
                    </span>
                    {selectedIds.length > 0 && (
                      <button 
                        onClick={() => setSelectedIds([])}
                        className="text-xs text-blue-400 hover:text-blue-300"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="mt-3 space-y-1 max-h-60 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-800">
                  {filteredUsers.length === 0 ? (
                    searchQuery ? (
                      <p className="text-sm text-gray-400 py-2 text-center">
                        No users found matching "{searchQuery}"
                      </p>
                    ) : (
                      <p className="text-sm text-gray-400 py-2 text-center">
                        No available users to add
                      </p>
                    )
                  ) : (
                    filteredUsers.map((user) => (
                      <div 
                        key={user.id} 
                        onClick={() => toggleUser(user.id)}
                        className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${
                          selectedIds.includes(user.id) 
                            ? 'bg-blue-900/30 border border-blue-800' 
                            : 'hover:bg-gray-800 border border-transparent'
                        }`}
                      >
                        <div className="flex-shrink-0 w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center">
                          {user.profile_pic ? (
                            <img 
                              src={user.profile_pic} 
                              alt={user.username.charAt(0).toUpperCase()} 
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            <span className="text-gray-400 text-xs font-medium">
                              {user.username.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        
                        <span className="flex-1 text-sm text-white">
                          {user.username}
                        </span>
                        
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                          selectedIds.includes(user.id) 
                            ? 'bg-blue-500' 
                            : 'border border-gray-600'
                        }`}>
                          {selectedIds.includes(user.id) && (
                            <Check size={12} className="text-white" />
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 rounded-md hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAdd}
                    disabled={!selectedIds.length}
                    className={`px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      selectedIds.length
                        ? 'bg-blue-600 hover:bg-blue-500 transition-colors'
                        : 'bg-blue-800/50 cursor-not-allowed'
                    }`}
                  >
                    Add {selectedIds.length > 0 && `(${selectedIds.length})`}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
};

export default GroupActions;