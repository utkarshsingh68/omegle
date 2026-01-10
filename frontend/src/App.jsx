/**
 * Omegle Clone - Clean UI
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import useSocket from './hooks/useSocket';
import useWebRTC from './hooks/useWebRTC';
import useAuth from './hooks/useAuth';
import useFriends from './hooks/useFriends';
import VideoPlayer from './components/VideoPlayer';
import ChatBox from './components/ChatBox';
import AuthModal from './components/AuthModal';

export default function App() {
  const [chatMode, setChatMode] = useState('video');
  const [interests, setInterests] = useState([]);
  const [interestsEnabled, setInterestsEnabled] = useState(true);
  const [genderFilter, setGenderFilter] = useState('both');
  const [myGender, setMyGender] = useState('unspecified');
  const [newInterest, setNewInterest] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showFriendRequests, setShowFriendRequests] = useState(false);
  const friendRequestsRef = useRef(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  
  const {
    user,
    isLoading: authLoading,
    error: authError,
    isAuthenticated,
    sessionToken,
    register,
    login,
    guestLogin,
    logout,
    clearError: clearAuthError
  } = useAuth();
  
  const {
    socket,
    isConnected,
    connectionStatus,
    partnerId,
    isInitiator,
    messages,
    partnerTyping,
    error,
    stats,
    findPartner,
    skipPartner,
    stopSearch,
    sendMessage,
    sendTyping,
    sendReaction,
  } = useSocket(sessionToken);
  
  const {
    friends,
    friendRequests,
    sendFriendRequest,
    acceptRequest,
    declineRequest,
  } = useFriends(socket, sessionToken);

  const {
    localStream,
    remoteStream,
    screenStream,
    isVideoEnabled,
    isAudioEnabled,
    connectionState,
    connectionQuality,
    toggleVideo,
    toggleAudio,
  } = useWebRTC(socket, chatMode === 'video' ? partnerId : null, isInitiator);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (friendRequestsRef.current && !friendRequestsRef.current.contains(event.target)) {
        setShowFriendRequests(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleFriendRequests = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setDropdownPosition({ top: rect.bottom + 8, left: rect.right - 320 });
    setShowFriendRequests(!showFriendRequests);
  };

  const addInterest = (e) => {
    e.preventDefault();
    if (newInterest.trim() && interests.length < 5 && !interests.includes(newInterest.trim().toLowerCase())) {
      setInterests([...interests, newInterest.trim().toLowerCase()]);
      setNewInterest('');
    }
  };

  const removeInterest = (interest) => {
    setInterests(interests.filter(i => i !== interest));
  };

  const handleStartChat = useCallback(() => {
    findPartner({
      interests: interestsEnabled ? interests : [],
      mode: chatMode,
      genderPreference: genderFilter,
      selfGender: myGender
    });
  }, [interests, interestsEnabled, chatMode, genderFilter, myGender, findPartner]);

  const handleSkip = useCallback(() => {
    skipPartner({ interests: interestsEnabled ? interests : [], mode: chatMode, genderPreference: genderFilter, selfGender: myGender });
  }, [interests, interestsEnabled, chatMode, genderFilter, myGender, skipPartner]);

  const isMatched = connectionStatus === 'matched';
  const isSearching = connectionStatus === 'searching' || connectionStatus === 'waiting';

  const FriendRequestsDropdown = () => {
    if (!showFriendRequests) return null;
    return createPortal(
      <div ref={friendRequestsRef} style={{ position: 'fixed', top: dropdownPosition.top, left: dropdownPosition.left, zIndex: 99999 }} className="w-80 bg-[#16162a] border border-[#2a2a4a] rounded-xl shadow-2xl">
        <div className="p-4 border-b border-[#2a2a4a] flex items-center justify-between">
          <h3 className="font-semibold">👥 Friend Requests</h3>
          <button onClick={() => setShowFriendRequests(false)} className="text-gray-400 hover:text-white">✕</button>
        </div>
        <div className="max-h-80 overflow-y-auto p-3">
          {friendRequests.length === 0 ? (
            <p className="text-center py-6 text-gray-500 text-sm">No pending requests</p>
          ) : (
            <div className="space-y-3">
              {friendRequests.map(request => (
                <div key={request.from} className="bg-[#1a1a2e] rounded-xl p-3">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      {request.fromAvatar || request.fromName?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{request.fromName || 'Unknown'}</p>
                      <p className="text-xs text-gray-500">wants to be friends</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => acceptRequest(request.from)} className="flex-1 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium">Accept</button>
                    <button onClick={() => declineRequest(request.from)} className="flex-1 py-2 bg-[#2a2a4a] hover:bg-[#3a3a5a] rounded-lg text-sm font-medium">Ignore</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>,
      document.body
    );
  };

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white flex flex-col">
      {/* Header */}
      <header className="h-14 bg-[#16162a] border-b border-[#2a2a4a] flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">💬</div>
          <span className="text-lg font-bold">ChatClone</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400"><span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-2"></span>{stats.online} online</span>
          
          {isAuthenticated && (
            <button onClick={toggleFriendRequests} className="relative p-2 hover:bg-[#2a2a4a] rounded-lg">
              👥
              {friendRequests.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center">{friendRequests.length}</span>
              )}
            </button>
          )}
          
          {user ? (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">{user.avatar}</div>
              <span className="text-sm">{user.displayName}</span>
              <button onClick={logout} className="p-2 hover:bg-[#2a2a4a] rounded-lg text-gray-400 hover:text-red-500">🚪</button>
            </div>
          ) : (
            <button onClick={() => setShowAuthModal(true)} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium">Login</button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {isMatched ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Video + Chat Area */}
            <div className={chatMode === 'video' ? 'flex-1 flex gap-4 p-4 min-h-0' : 'flex-1 flex p-4 min-h-0'}>
              {chatMode === 'video' && (
                <div className="flex-1 min-w-0">
                  <VideoPlayer localStream={localStream} remoteStream={remoteStream} screenStream={screenStream} isVideoEnabled={isVideoEnabled} connectionState={connectionState} connectionQuality={connectionQuality} />
                </div>
              )}
              <div className={chatMode === 'video' ? 'w-96 flex-shrink-0 flex flex-col min-h-0' : 'flex-1 flex flex-col min-h-0'}>
                <ChatBox messages={messages} onSendMessage={sendMessage} onTyping={sendTyping} onReaction={sendReaction} partnerTyping={partnerTyping} isConnected={isMatched} />
              </div>
            </div>
            {/* Controls */}
            <div className="p-4 bg-[#16162a] border-t border-[#2a2a4a] flex items-center justify-center gap-3 flex-shrink-0">
              {chatMode === 'video' && (
                <>
                  <button onClick={toggleVideo} className={`p-3 rounded-full ${isVideoEnabled ? 'bg-[#2a2a4a]' : 'bg-red-500'}`}>{isVideoEnabled ? '📹' : '📷'}</button>
                  <button onClick={toggleAudio} className={`p-3 rounded-full ${isAudioEnabled ? 'bg-[#2a2a4a]' : 'bg-red-500'}`}>{isAudioEnabled ? '🎤' : '🔇'}</button>
                </>
              )}
              <button onClick={stopSearch} className="p-3 rounded-full bg-red-500 hover:bg-red-600">⏹️</button>
              <button onClick={handleSkip} className="px-6 py-3 rounded-full bg-purple-600 hover:bg-purple-700 font-medium">⏭️ Next</button>
              {isAuthenticated && <button onClick={sendFriendRequest} className="px-4 py-3 rounded-full bg-pink-500 hover:bg-pink-600 font-medium">➕ Add Friend</button>}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            {/* Interests */}
            <div className="w-full max-w-md bg-[#16162a] rounded-2xl p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Interests</h3>
                <button onClick={() => setInterestsEnabled(!interestsEnabled)} className={`px-3 py-1 rounded-full text-xs font-medium ${interestsEnabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                  {interestsEnabled ? 'ON' : 'OFF'}
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                {interests.map(interest => (
                  <span key={interest} className="px-3 py-1.5 bg-[#2a2a4a] rounded-full text-sm flex items-center gap-2">
                    {interest}
                    <button onClick={() => removeInterest(interest)} className="text-gray-400 hover:text-white">×</button>
                  </span>
                ))}
              </div>
              <form onSubmit={addInterest} className="flex gap-2">
                <input type="text" value={newInterest} onChange={(e) => setNewInterest(e.target.value)} placeholder="Add interest..." className="flex-1 px-4 py-2 bg-[#2a2a4a] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" maxLength={20} />
                <button type="submit" className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium">Add</button>
              </form>
            </div>

            {/* Gender Filter */}
            <div className="w-full max-w-md bg-[#16162a] rounded-2xl p-6 mb-6">
              <h3 className="font-semibold mb-3">Looking for:</h3>
              <div className="flex justify-center gap-3 mb-4">
                {[{ id: 'male', label: '👨 Male' }, { id: 'both', label: '👥 Both' }, { id: 'female', label: '👩 Female' }].map(option => (
                  <button key={option.id} onClick={() => setGenderFilter(option.id)} className={`px-4 py-2 rounded-lg text-sm font-medium ${genderFilter === option.id ? 'bg-purple-600' : 'bg-[#2a2a4a] hover:bg-[#3a3a5a]'}`}>
                    {option.label}
                  </button>
                ))}
              </div>
              <h3 className="font-semibold mb-3">I am:</h3>
              <div className="flex justify-center gap-3">
                {[{ id: 'male', label: 'Male' }, { id: 'female', label: 'Female' }, { id: 'unspecified', label: 'Skip' }].map(option => (
                  <button key={option.id} onClick={() => setMyGender(option.id)} className={`px-4 py-2 rounded-lg text-sm font-medium ${myGender === option.id ? 'bg-purple-600' : 'bg-[#2a2a4a] hover:bg-[#3a3a5a]'}`}>
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Mode & Start */}
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => setChatMode('video')} className={`px-4 py-2 rounded-lg text-sm font-medium ${chatMode === 'video' ? 'bg-purple-600' : 'bg-[#2a2a4a]'}`}>📹 Video</button>
              <button onClick={() => setChatMode('text')} className={`px-4 py-2 rounded-lg text-sm font-medium ${chatMode === 'text' ? 'bg-purple-600' : 'bg-[#2a2a4a]'}`}>💬 Text</button>
            </div>

            <div className="flex items-center gap-4">
              {isSearching && <button onClick={stopSearch} className="w-14 h-14 rounded-xl bg-red-500 hover:bg-red-600 flex items-center justify-center text-xl">⏹️</button>}
              <button onClick={handleStartChat} disabled={!isConnected || isSearching} className="px-8 py-4 bg-purple-600 hover:bg-purple-700 rounded-xl font-semibold disabled:opacity-50">
                {isSearching ? 'Searching...' : `Start ${chatMode === 'video' ? 'Video' : 'Text'} Chat`}
              </button>
            </div>

            {isSearching && (
              <div className="mt-6 flex items-center gap-3 text-purple-400">
                <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
                <span>Looking for someone...</span>
              </div>
            )}
          </div>
        )}
      </main>

      <FriendRequestsDropdown />

      {error && <div className="fixed top-4 right-4 bg-red-500 text-white px-4 py-3 rounded-xl shadow-lg z-50">{error}</div>}

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => { setShowAuthModal(false); clearAuthError(); }}
        onLogin={async (email, password) => { const result = await login(email, password); if (result.success) setShowAuthModal(false); }}
        onRegister={async (username, email, password, displayName) => { const result = await register(username, email, password, displayName); if (result.success) setShowAuthModal(false); }}
        onGuestLogin={async () => { const result = await guestLogin(); if (result.success) setShowAuthModal(false); }}
        isLoading={authLoading}
        error={authError}
      />
    </div>
  );
}
