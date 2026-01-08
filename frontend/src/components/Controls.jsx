/**
 * Advanced Controls Component
 * Features: Screen sharing, quality settings, keyboard shortcuts display
 */

import { useState, useEffect } from 'react';

export default function Controls({
  connectionStatus,
  isVideoEnabled,
  isAudioEnabled,
  isScreenSharing,
  currentQuality,
  onToggleVideo,
  onToggleAudio,
  onScreenShare,
  onStopScreenShare,
  onSwitchQuality,
  onFindPartner,
  onSkip,
  onStop,
  onReport,
  latency
}) {
  const [showReportModal, setShowReportModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const isMatched = connectionStatus === 'matched';
  const isSearching = connectionStatus === 'searching' || connectionStatus === 'waiting';

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if typing in input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.key.toLowerCase()) {
        case 'v':
          if (isMatched) onToggleVideo();
          break;
        case 'm':
          if (isMatched) onToggleAudio();
          break;
        case 'n':
        case 'escape':
          if (isMatched) onSkip();
          else if (isSearching) onStop();
          break;
        case 's':
          if (isMatched && !isScreenSharing && e.shiftKey) onScreenShare();
          break;
        case 'enter':
          if (!isMatched && !isSearching) onFindPartner({});
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMatched, isSearching, isScreenSharing, onToggleVideo, onToggleAudio, onSkip, onStop, onScreenShare, onFindPartner]);

  const reportReasons = [
    { id: 'inappropriate', label: 'Inappropriate content', icon: '🚫' },
    { id: 'harassment', label: 'Harassment / Bullying', icon: '😠' },
    { id: 'spam', label: 'Spam / Advertising', icon: '📢' },
    { id: 'underage', label: 'Underage user', icon: '⚠️' },
    { id: 'other', label: 'Other', icon: '❓' }
  ];

  return (
    <>
      <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3 p-3 md:p-4">
        {/* Video Toggle */}
        <button
          onClick={onToggleVideo}
          disabled={!isMatched}
          className={`p-3 rounded-full transition-all duration-200 tooltip ${
            isVideoEnabled
              ? 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200'
              : 'bg-red-500 hover:bg-red-600 text-white'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          data-tooltip="Toggle Video (V)"
        >
          {isVideoEnabled ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2zM3 3l18 18" />
            </svg>
          )}
        </button>

        {/* Audio Toggle */}
        <button
          onClick={onToggleAudio}
          disabled={!isMatched}
          className={`p-3 rounded-full transition-all duration-200 tooltip ${
            isAudioEnabled
              ? 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200'
              : 'bg-red-500 hover:bg-red-600 text-white'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          data-tooltip="Toggle Mic (M)"
        >
          {isAudioEnabled ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          )}
        </button>

        {/* Screen Share Toggle */}
        <button
          onClick={isScreenSharing ? onStopScreenShare : onScreenShare}
          disabled={!isMatched}
          className={`p-3 rounded-full transition-all duration-200 tooltip ${
            isScreenSharing
              ? 'bg-blue-500 hover:bg-blue-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          data-tooltip="Screen Share (Shift+S)"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </button>

        {/* Divider */}
        <div className="w-px h-8 bg-gray-300 dark:bg-gray-600 mx-1" />

        {/* Start Button */}
        {!isMatched && !isSearching && (
          <button
            onClick={() => onFindPartner({})}
            className="btn btn-success px-6 py-3"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Start</span>
          </button>
        )}

        {/* Searching Button */}
        {isSearching && (
          <button
            onClick={onStop}
            className="btn bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-3"
          >
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Searching...</span>
          </button>
        )}

        {/* Next/Skip Button */}
        {isMatched && (
          <button
            onClick={onSkip}
            className="btn btn-primary px-6 py-3"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
            <span>Next</span>
          </button>
        )}

        {/* Stop Button */}
        {isMatched && (
          <button
            onClick={onStop}
            className="btn btn-danger px-6 py-3"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
            </svg>
            <span>Stop</span>
          </button>
        )}

        {/* Settings Button */}
        {isMatched && (
          <button
            onClick={() => setShowSettings(prev => !prev)}
            className={`p-3 rounded-full transition-all duration-200 ${
              showSettings 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        )}

        {/* Report Button */}
        {isMatched && (
          <button
            onClick={() => setShowReportModal(true)}
            className="p-3 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-red-500 
                     text-gray-500 hover:text-white transition-all duration-200 tooltip"
            data-tooltip="Report User"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
            </svg>
          </button>
        )}

        {/* Latency Display */}
        {latency > 0 && (
          <div className={`text-xs px-2 py-1 rounded-full ${
            latency < 100 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' :
            latency < 300 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300' :
            'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
          }`}>
            {latency}ms
          </div>
        )}
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="px-4 pb-4 animate-slide-up">
          <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Video Quality</h4>
            <div className="flex gap-2">
              {['low', 'medium', 'high'].map((quality) => (
                <button
                  key={quality}
                  onClick={() => onSwitchQuality(quality)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    currentQuality === quality
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {quality.charAt(0).toUpperCase() + quality.slice(1)}
                </button>
              ))}
            </div>
            
            <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
              <strong>Keyboard Shortcuts:</strong>
              <div className="grid grid-cols-2 gap-1 mt-2">
                <span>V - Toggle video</span>
                <span>M - Toggle mic</span>
                <span>N/Esc - Next/Skip</span>
                <span>Shift+S - Screen share</span>
                <span>Enter - Start chat</span>
                <span>Ctrl+E - Emoji</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-slide-up">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Report User</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Help us keep the community safe</p>
              </div>
            </div>
            
            <div className="space-y-2">
              {reportReasons.map((reason) => (
                <button
                  key={reason.id}
                  onClick={() => {
                    onReport(reason.label);
                    setShowReportModal(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-gray-100 dark:bg-gray-700 
                           hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl text-left 
                           transition-colors text-gray-700 dark:text-gray-200"
                >
                  <span className="text-xl">{reason.icon}</span>
                  <span>{reason.label}</span>
                </button>
              ))}
            </div>
            
            <button
              onClick={() => setShowReportModal(false)}
              className="w-full mt-4 px-4 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 
                       dark:hover:bg-gray-600 rounded-xl text-gray-700 dark:text-gray-300 
                       transition-colors font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
