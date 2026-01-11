/**
 * Strango - Meet Strangers
 * Dark Slate + Sky Blue Theme
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import useSocket from './hooks/useSocket';
import useWebRTC from './hooks/useWebRTC';
import useAuth from './hooks/useAuth';
import useFriends from './hooks/useFriends';
import useTheme from './hooks/useTheme';
import VideoPlayer from './components/VideoPlayer';
import ChatBox from './components/ChatBox';
import AuthModal from './components/AuthModal';
import AgeVerification from './components/AgeVerification';

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const [isAgeVerified, setIsAgeVerified] = useState(() => {
    return localStorage.getItem('age_verified') === 'true';
  });
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
    currentCameraFacing,
    toggleVideo,
    toggleAudio,
    switchCamera,
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

  // Show age verification if not verified
  if (!isAgeVerified) {
    return <AgeVerification onVerify={() => setIsAgeVerified(true)} isDark={isDark} />;
  }

  const FriendRequestsDropdown = () => {
    if (!showFriendRequests) return null;
    return createPortal(
      <div ref={friendRequestsRef} style={{ position: 'fixed', top: dropdownPosition.top, left: dropdownPosition.left, zIndex: 99999 }} className="w-80 bg-[#0f172a] border border-[#334155] rounded-xl shadow-2xl">
        <div className="p-4 border-b border-[#334155] flex items-center justify-between">
          <h3 className="font-semibold">👥 Friend Requests</h3>
          <button onClick={() => setShowFriendRequests(false)} className="text-slate-400 hover:text-white">✕</button>
        </div>
        <div className="max-h-80 overflow-y-auto p-3">
          {friendRequests.length === 0 ? (
            <p className="text-center py-6 text-slate-500 text-sm">No pending requests</p>
          ) : (
            <div className="space-y-3">
              {friendRequests.map(request => (
                <div key={request.from} className="bg-[#1e293b] rounded-xl p-3">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-cyan-500 flex items-center justify-center">
                      {request.fromAvatar || request.fromName?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{request.fromName || 'Unknown'}</p>
                      <p className="text-xs text-slate-500">wants to be friends</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => acceptRequest(request.from)} className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium">Accept</button>
                    <button onClick={() => declineRequest(request.from)} className="flex-1 py-2 bg-[#334155] hover:bg-[#3b4a62] rounded-lg text-sm font-medium">Ignore</button>
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
    <>
      {/* Age Verification Modal */}
      {!isAgeVerified && (
        <AgeVerification 
          onVerify={() => setIsAgeVerified(true)} 
          isDark={isDark}
        />
      )}

      <div
        className={`min-h-screen flex flex-col ${isDark ? 'text-white' : 'text-slate-900'}`}
        style={{
          background: isDark
            ? 'linear-gradient(135deg, #0f1419 0%, #1a1f2e 50%, #0f1419 100%)'
            : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)'
        }}
      >
      {/* Header */}
      <header className={`h-14 flex items-center justify-between px-4 sm:px-6 border-b backdrop-blur-md ${isDark ? 'bg-[#1a1f2e]/80 border-white/5' : 'bg-white/80 border-slate-200'} sticky top-0 z-20`}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-lg shadow-lg shadow-blue-500/25">🌐</div>
          <span className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Strango</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${isDark ? 'bg-white/5 hover:bg-white/10 text-white/80' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
          >
            {isDark ? '☀️' : '🌙'}
          </button>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className={`text-sm ${isDark ? 'text-white/70' : 'text-slate-600'}`}>{stats.online} online</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {isMatched ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Video + Chat Area - Mobile Responsive */}
            <div className={chatMode === 'video' ? 'flex-1 flex flex-col lg:flex-row gap-2 sm:gap-4 p-2 sm:p-4 min-h-0' : 'flex-1 flex p-2 sm:p-4 min-h-0'}>
              {chatMode === 'video' && (
                <div className="flex-1 min-w-0 h-64 sm:h-80 lg:h-auto">
                  <VideoPlayer theme={theme} localStream={localStream} remoteStream={remoteStream} screenStream={screenStream} isVideoEnabled={isVideoEnabled} connectionState={connectionState} connectionQuality={connectionQuality} />
                </div>
              )}
              <div className={chatMode === 'video' ? 'w-full lg:w-96 flex-shrink-0 flex flex-col min-h-0' : 'flex-1 flex flex-col min-h-0'}>
                <ChatBox theme={theme} messages={messages} onSendMessage={sendMessage} onTyping={sendTyping} onReaction={sendReaction} partnerTyping={partnerTyping} isConnected={isMatched} />
              </div>
            </div>
            {/* Controls */}
            <div className={`p-3 sm:p-4 border-t flex items-center justify-center gap-3 flex-shrink-0 ${isDark ? 'bg-[#1a1f2e]/80 border-white/5 backdrop-blur-md' : 'bg-white/80 border-slate-200'}`}>
              {chatMode === 'video' && (
                <>
                  <button onClick={toggleVideo} className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg transition-all ${isVideoEnabled ? (isDark ? 'bg-white/10 hover:bg-white/15' : 'bg-slate-100 hover:bg-slate-200') : 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/25'}`}>{isVideoEnabled ? '📹' : '📷'}</button>
                  <button onClick={toggleAudio} className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg transition-all ${isAudioEnabled ? (isDark ? 'bg-white/10 hover:bg-white/15' : 'bg-slate-100 hover:bg-slate-200') : 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/25'}`}>{isAudioEnabled ? '🎤' : '🔇'}</button>
                  <button onClick={switchCamera} className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg transition-all ${isDark ? 'bg-white/10 hover:bg-white/15' : 'bg-slate-100 hover:bg-slate-200'}`} title="Switch camera">🔄</button>
                </>
              )}
              <button onClick={stopSearch} className="w-12 h-12 rounded-xl bg-red-500 hover:bg-red-600 flex items-center justify-center text-lg text-white shadow-lg shadow-red-500/25 transition-all">⏹️</button>
              <button onClick={handleSkip} className="px-6 py-3 rounded-xl font-semibold bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 transition-all">⏭️ Next</button>
              {isAuthenticated && <button onClick={sendFriendRequest} className="px-4 py-3 rounded-xl font-medium bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/25 hidden sm:flex items-center gap-2 transition-all">➕ Add Friend</button>}
              {isAuthenticated && <button onClick={sendFriendRequest} className="w-12 h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center text-lg text-white shadow-lg shadow-emerald-500/25 sm:hidden transition-all">➕</button>}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-3 sm:p-8 overflow-y-auto">
            {/* Interests Card */}
            <div className={`w-full max-w-md rounded-2xl p-6 mb-5 ${isDark ? 'bg-white/5 backdrop-blur-lg border border-white/10' : 'bg-white shadow-xl shadow-slate-200/50 border border-slate-100'}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>✨ Interests</h3>
                <button onClick={() => setInterestsEnabled(!interestsEnabled)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${interestsEnabled ? 'bg-blue-500/20 text-blue-400' : (isDark ? 'bg-white/5 text-white/50' : 'bg-slate-100 text-slate-500')}`}>
                  {interestsEnabled ? 'ON' : 'OFF'}
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mb-4 min-h-[40px]">
                {interests.map(interest => (
                  <span key={interest} className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 ${isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>
                    {interest}
                    <button onClick={() => removeInterest(interest)} className="hover:text-red-400 transition-colors">×</button>
                  </span>
                ))}
              </div>
              <form onSubmit={addInterest} className="flex gap-2">
                <input
                  type="text"
                  value={newInterest}
                  onChange={(e) => setNewInterest(e.target.value)}
                  placeholder="Add interest..."
                  className={`flex-1 px-4 py-3 rounded-xl text-sm transition-all ${isDark ? 'bg-white/5 border border-white/10 text-white placeholder-white/40 focus:border-blue-500 focus:bg-white/10' : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white'} focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                  maxLength={20}
                />
                <button type="submit" className="px-5 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 transition-all">Add</button>
              </form>
            </div>

            {/* Mode Toggle */}
            <div className={`flex items-center gap-1 p-1 rounded-xl mb-6 ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
              <button onClick={() => setChatMode('video')} className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${chatMode === 'video' ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg' : (isDark ? 'text-white/60 hover:text-white' : 'text-slate-500 hover:text-slate-700')}`}>📹 Video</button>
              <button onClick={() => setChatMode('text')} className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${chatMode === 'text' ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg' : (isDark ? 'text-white/60 hover:text-white' : 'text-slate-500 hover:text-slate-700')}`}>💬 Text</button>
            </div>

            {/* Start Button */}
            <div className="flex items-center gap-4">
              {isSearching && <button onClick={stopSearch} className="w-14 h-14 rounded-2xl bg-red-500 hover:bg-red-600 flex items-center justify-center text-xl text-white shadow-lg shadow-red-500/25 transition-all">⏹️</button>}
              <button onClick={handleStartChat} disabled={!isConnected || isSearching} className="px-10 py-4 rounded-2xl font-bold text-lg bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 hover:from-blue-600 hover:via-indigo-600 hover:to-purple-700 text-white disabled:opacity-50 shadow-xl shadow-blue-500/30 transition-all hover:scale-[1.02] active:scale-[0.98]">
                {isSearching ? '🔍 Searching...' : `▶️ Start ${chatMode === 'video' ? 'Video' : 'Text'} Chat`}
              </button>
            </div>

            {isSearching && (
              <div className="mt-6 flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <span className={isDark ? 'text-white/70' : 'text-slate-600'}>Looking for someone...</span>
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
    </>
  );
}
