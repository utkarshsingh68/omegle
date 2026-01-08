/**
 * Omegle Clone - Advanced Main App
 * Features: Interest matching, themes, screen sharing, quality controls
 */

import { useState, useCallback } from 'react';
import useSocket from './hooks/useSocket';
import useWebRTC from './hooks/useWebRTC';
import useTheme from './hooks/useTheme';
import VideoPlayer from './components/VideoPlayer';
import ChatBox from './components/ChatBox';
import Controls from './components/Controls';
import InterestInput from './components/InterestInput';
import StatsBar from './components/StatsBar';

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const [chatMode, setChatMode] = useState('video');
  const [interests, setInterests] = useState([]);
  const [showPreferences, setShowPreferences] = useState(false);
  
  // Socket.IO connection
  const {
    socket,
    isConnected,
    connectionStatus,
    partnerId,
    isInitiator,
    messages,
    partnerTyping,
    error,
    warning,
    matchInfo,
    stats,
    latency,
    findPartner,
    skipPartner,
    stopSearch,
    sendMessage,
    sendTyping,
    sendReaction,
    reportUser
  } = useSocket();

  // WebRTC for video
  const {
    localStream,
    remoteStream,
    screenStream,
    isVideoEnabled,
    isAudioEnabled,
    isScreenSharing,
    connectionState,
    connectionQuality,
    currentQuality,
    partnerScreenSharing,
    toggleVideo,
    toggleAudio,
    startScreenShare,
    stopScreenShare,
    switchQuality
  } = useWebRTC(socket, chatMode === 'video' ? partnerId : null, isInitiator);

  // Start with preferences
  const handleFindPartner = useCallback((additionalPrefs = {}) => {
    const preferences = {
      interests,
      mode: chatMode,
      ...additionalPrefs
    };
    findPartner(preferences);
    setShowPreferences(false);
  }, [interests, chatMode, findPartner]);

  // Skip with same preferences
  const handleSkip = useCallback(() => {
    skipPartner({ interests, mode: chatMode });
  }, [interests, chatMode, skipPartner]);

  // Status text
  const getStatusText = () => {
    switch (connectionStatus) {
      case 'disconnected': return { icon: '🔴', text: 'Disconnected' };
      case 'connected': return { icon: '🟢', text: 'Ready to chat' };
      case 'searching':
      case 'waiting': return { icon: '🔍', text: 'Finding stranger...' };
      case 'matched': return { icon: '🎉', text: 'Connected!' };
      case 'partner-left': return { icon: '👋', text: 'Stranger left' };
      case 'banned': return { icon: '🚫', text: 'Banned' };
      default: return { icon: '⚪', text: 'Unknown' };
    }
  };

  const status = getStatusText();
  const isMatched = connectionStatus === 'matched';
  const isSearching = connectionStatus === 'searching' || connectionStatus === 'waiting';
  const showWelcome = connectionStatus === 'connected' && !partnerId;
  const showChat = isMatched || connectionStatus === 'partner-left';

  return (
    <div className={`min-h-screen gradient-bg transition-colors duration-300`}>
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-white/80 dark:bg-gray-900/80 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xl shadow-lg">
                🎭
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900 dark:text-white">Omegle Clone</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">Talk to strangers</p>
              </div>
            </div>

            {/* Center - Stats */}
            <div className="hidden md:block">
              <StatsBar stats={stats} latency={latency} />
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3">
              {/* Status Badge */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800">
                <span>{status.icon}</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">{status.text}</span>
              </div>

              {/* Mode Toggle */}
              <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
                <button
                  onClick={() => setChatMode('video')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    chatMode === 'video'
                      ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  📹 Video
                </button>
                <button
                  onClick={() => setChatMode('text')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    chatMode === 'text'
                      ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  💬 Text
                </button>
              </div>

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 
                         dark:hover:bg-gray-700 transition-colors"
              >
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Stats */}
      <div className="md:hidden px-4 py-2">
        <StatsBar stats={stats} latency={latency} />
      </div>

      {/* Error/Warning Toasts */}
      {error && (
        <div className="fixed top-20 right-4 bg-red-500 text-white px-4 py-3 rounded-xl shadow-lg z-50 animate-shake flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {warning && (
        <div className="fixed top-20 right-4 bg-yellow-500 text-white px-4 py-3 rounded-xl shadow-lg z-50 animate-slide-right flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {warning}
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 pb-32">
        {/* Welcome Screen */}
        {showWelcome && (
          <div className="max-w-2xl mx-auto animate-fade-in">
            <div className="text-center py-8">
              <div className="text-7xl mb-6 animate-float">👋</div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                Meet New People
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
                Chat with random strangers anonymously. {chatMode === 'video' ? 'Video' : 'Text'} mode is on.
              </p>
            </div>

            {/* Feature Cards */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              {[
                { icon: '🔒', label: 'Anonymous', desc: 'No signup required' },
                { icon: '⚡', label: 'Instant', desc: 'Connect in seconds' },
                { icon: '🎯', label: 'Matching', desc: 'Find similar interests' }
              ].map((feature) => (
                <div key={feature.label} className="bg-white dark:bg-gray-800 rounded-2xl p-4 text-center shadow-lg border border-gray-100 dark:border-gray-700">
                  <div className="text-3xl mb-2">{feature.icon}</div>
                  <div className="font-medium text-gray-900 dark:text-white">{feature.label}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{feature.desc}</div>
                </div>
              ))}
            </div>

            {/* Preferences Toggle */}
            <button
              onClick={() => setShowPreferences(prev => !prev)}
              className="w-full mb-4 px-4 py-3 bg-gray-100 dark:bg-gray-800 rounded-xl 
                       text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700
                       transition-colors flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                <span>Matching Preferences</span>
                {interests.length > 0 && (
                  <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full text-xs">
                    {interests.length} interest{interests.length > 1 ? 's' : ''}
                  </span>
                )}
              </span>
              <svg className={`w-5 h-5 transition-transform ${showPreferences ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Preferences Panel */}
            {showPreferences && (
              <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 animate-slide-up">
                <InterestInput
                  interests={interests}
                  onChange={setInterests}
                  maxInterests={5}
                />
              </div>
            )}

            {/* Start Button */}
            <button
              onClick={() => handleFindPartner()}
              disabled={!isConnected}
              className="w-full btn btn-success text-lg py-4 rounded-2xl shadow-xl 
                       hover:shadow-emerald-500/25 hover:scale-[1.02] transition-all"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Start {chatMode === 'video' ? 'Video' : 'Text'} Chat
            </button>

            <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
              Press <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs">Enter</kbd> to start
            </p>
          </div>
        )}

        {/* Searching Screen */}
        {isSearching && (
          <div className="max-w-md mx-auto text-center py-16 animate-fade-in">
            <div className="relative w-32 h-32 mx-auto mb-8">
              <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-pulse-ring" />
              <div className="absolute inset-4 rounded-full bg-blue-500/30 animate-pulse-ring" style={{ animationDelay: '0.5s' }} />
              <div className="absolute inset-8 rounded-full bg-blue-500/40 animate-pulse" />
              <div className="absolute inset-0 flex items-center justify-center text-5xl">
                🔍
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
              Looking for a stranger...
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              {stats.waiting > 0 ? `${stats.waiting} people waiting` : 'Searching...'}
            </p>
            {interests.length > 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Matching interests: {interests.join(', ')}
              </p>
            )}
            <button
              onClick={stopSearch}
              className="mt-8 btn btn-secondary px-6 py-3"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Chat Screen */}
        {showChat && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-in">
            {/* Video Section */}
            {chatMode === 'video' && (
              <div className="lg:col-span-1">
                <VideoPlayer
                  localStream={localStream}
                  remoteStream={remoteStream}
                  screenStream={screenStream}
                  isVideoEnabled={isVideoEnabled}
                  connectionState={connectionState}
                  connectionQuality={connectionQuality}
                  partnerScreenSharing={partnerScreenSharing}
                  currentQuality={currentQuality}
                />
              </div>
            )}
            
            {/* Chat Section */}
            <div className={chatMode === 'text' ? 'lg:col-span-2' : 'lg:col-span-1'}>
              <div className={chatMode === 'text' ? 'h-[600px]' : 'h-[400px] lg:h-full'}>
                <ChatBox
                  messages={messages}
                  onSendMessage={sendMessage}
                  onTyping={sendTyping}
                  onReaction={sendReaction}
                  partnerTyping={partnerTyping}
                  isConnected={isMatched}
                  matchInfo={matchInfo}
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Controls */}
      {isConnected && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 z-30">
          <Controls
            connectionStatus={connectionStatus}
            isVideoEnabled={isVideoEnabled}
            isAudioEnabled={isAudioEnabled}
            isScreenSharing={isScreenSharing}
            currentQuality={currentQuality}
            onToggleVideo={toggleVideo}
            onToggleAudio={toggleAudio}
            onScreenShare={startScreenShare}
            onStopScreenShare={stopScreenShare}
            onSwitchQuality={switchQuality}
            onFindPartner={handleFindPartner}
            onSkip={handleSkip}
            onStop={stopSearch}
            onReport={reportUser}
            latency={latency}
          />
        </div>
      )}

      {/* Footer */}
      <footer className="fixed bottom-24 left-0 right-0 text-center pointer-events-none">
        <p className="text-xs text-gray-400 dark:text-gray-600">
          Be respectful. Report inappropriate behavior.
        </p>
      </footer>
    </div>
  );
}
