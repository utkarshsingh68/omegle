/**
 * Friends Panel Component
 * Features: Friends list, friend requests, online status
 */

import { useState } from 'react';

export default function FriendsPanel({
  isOpen,
  onClose,
  friends,
  friendRequests,
  sentRequests,
  onAcceptRequest,
  onDeclineRequest,
  onRemoveFriend,
  onRefresh
}) {
  const [activeTab, setActiveTab] = useState('friends'); // 'friends', 'requests'

  if (!isOpen) return null;

  const onlineFriends = friends.filter(f => f.isOnline);
  const offlineFriends = friends.filter(f => !f.isOnline);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <span className="text-2xl">👥</span>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Friends</h2>
            {friends.length > 0 && (
              <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-full text-xs font-medium">
                {friends.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors"
              title="Refresh"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('friends')}
            className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'friends'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            <span>Friends</span>
            {onlineFriends.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'requests'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            <span>Requests</span>
            {friendRequests.length > 0 && (
              <span className="px-1.5 py-0.5 bg-red-500 text-white rounded-full text-xs">
                {friendRequests.length}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[50vh]">
          {activeTab === 'friends' && (
            <div className="space-y-2">
              {friends.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-5xl mb-3">🤝</div>
                  <p className="text-gray-500 dark:text-gray-400">No friends yet</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                    Start chatting and add people you enjoy talking to!
                  </p>
                </div>
              ) : (
                <>
                  {/* Online Friends */}
                  {onlineFriends.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                        Online — {onlineFriends.length}
                      </h3>
                      {onlineFriends.map(friend => (
                        <FriendItem 
                          key={friend.id} 
                          friend={friend} 
                          onRemove={() => onRemoveFriend(friend.id)} 
                        />
                      ))}
                    </div>
                  )}

                  {/* Offline Friends */}
                  {offlineFriends.length > 0 && (
                    <div>
                      <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                        Offline — {offlineFriends.length}
                      </h3>
                      {offlineFriends.map(friend => (
                        <FriendItem 
                          key={friend.id} 
                          friend={friend} 
                          onRemove={() => onRemoveFriend(friend.id)} 
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'requests' && (
            <div className="space-y-4">
              {/* Received Requests */}
              <div>
                <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  Received
                </h3>
                {friendRequests.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500 py-2">No pending requests</p>
                ) : (
                  <div className="space-y-2">
                    {friendRequests.map(request => (
                      <div 
                        key={request.from}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-lg">
                            {request.fromAvatar}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{request.fromName}</p>
                            <p className="text-xs text-gray-500">Wants to be your friend</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => onAcceptRequest(request.from)}
                            className="p-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
                            title="Accept"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => onDeclineRequest(request.from)}
                            className="p-2 rounded-lg bg-gray-300 dark:bg-gray-600 hover:bg-red-500 text-gray-700 dark:text-gray-300 hover:text-white transition-colors"
                            title="Decline"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sent Requests */}
              {sentRequests.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                    Sent
                  </h3>
                  <div className="space-y-2">
                    {sentRequests.map(request => (
                      <div 
                        key={request.to}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl opacity-75"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center text-lg">
                            {request.toAvatar}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{request.toName}</p>
                            <p className="text-xs text-gray-500">Request pending</p>
                          </div>
                        </div>
                        <div className="text-xs text-gray-400">⏳</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FriendItem({ friend, onRemove }) {
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-lg">
            {friend.avatar}
          </div>
          <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-700 ${
            friend.isOnline ? 'bg-emerald-500' : 'bg-gray-400'
          }`}></div>
        </div>
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{friend.displayName}</p>
          <p className="text-xs text-gray-500">
            {friend.isOnline ? '🟢 Online' : '⚫ Offline'}
            {friend.isGuest && ' • Guest'}
          </p>
        </div>
      </div>
      
      {showConfirm ? (
        <div className="flex items-center gap-2">
          <button
            onClick={() => { onRemove(); setShowConfirm(false); }}
            className="px-2 py-1 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600"
          >
            Remove
          </button>
          <button
            onClick={() => setShowConfirm(false)}
            className="px-2 py-1 text-xs bg-gray-300 dark:bg-gray-600 rounded-lg hover:bg-gray-400"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowConfirm(true)}
          className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400 hover:text-red-500 transition-colors"
          title="Remove friend"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
    </div>
  );
}
