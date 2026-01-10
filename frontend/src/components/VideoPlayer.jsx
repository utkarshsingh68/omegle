/**
 * Advanced Video Player Component
 * Features: Picture-in-picture, fullscreen, quality indicator
 */

import { useRef, useEffect, useState } from 'react';

export default function VideoPlayer({ 
  localStream, 
  remoteStream, 
  screenStream,
  isVideoEnabled,
  connectionState,
  connectionQuality,
  partnerScreenSharing,
  currentQuality
}) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPiP, setIsPiP] = useState(false);

  // Attach streams to video elements
  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = screenStream || localStream;
    }
  }, [localStream, screenStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Toggle fullscreen
  const toggleFullscreen = async () => {
    const container = document.getElementById('video-container');
    if (!container) return;

    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  };

  // Toggle Picture-in-Picture
  const togglePiP = async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPiP(false);
      } else if (remoteVideoRef.current) {
        await remoteVideoRef.current.requestPictureInPicture();
        setIsPiP(true);
      }
    } catch (error) {
      console.error('PiP error:', error);
    }
  };

  // Quality indicator colors
  const qualityColors = {
    good: 'bg-emerald-500',
    fair: 'bg-yellow-500',
    poor: 'bg-red-500'
  };

  return (
    <div id="video-container" className="relative rounded-2xl overflow-hidden bg-gray-900">
      {/* Main Grid */}
      <div className={`grid gap-2 p-2 ${isFullscreen ? 'h-screen' : 'aspect-video'}`}>
        {/* Remote Video (Stranger) - Main */}
        <div className="relative bg-gray-800 rounded-xl overflow-hidden">
          {remoteStream ? (
            <>
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              {/* Partner screen share indicator */}
              {partnerScreenSharing && (
                <div className="absolute top-3 left-3 flex items-center gap-2 bg-blue-600 px-3 py-1 rounded-full text-white text-sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Screen Share
                </div>
              )}
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
              <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center mb-3">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <span className="text-sm">
                {connectionState === 'connecting' ? 'Connecting...' : 'Waiting for stranger...'}
              </span>
            </div>
          )}
          
          {/* Stranger label */}
          <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs text-white flex items-center gap-2">
            <span>Stranger</span>
            {remoteStream && (
              <span className={`w-2 h-2 rounded-full ${qualityColors[connectionQuality]} animate-pulse`} />
            )}
          </div>
        </div>

        {/* Local Video (You) - PiP style overlay */}
        <div className="absolute bottom-16 right-4 w-32 md:w-48 aspect-video rounded-xl overflow-hidden shadow-2xl border-2 border-gray-700 bg-gray-800 hover:w-40 md:hover:w-56 transition-all duration-300">
          {localStream && isVideoEnabled ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform scale-x-[-1]"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-500">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
              </svg>
            </div>
          )}
          <div className="absolute bottom-1 left-1 bg-blue-600/80 px-2 py-0.5 rounded text-[10px] text-white">
            You
          </div>
        </div>
      </div>

      {/* Video Controls Overlay */}
      <div className="absolute top-3 right-3 flex items-center gap-2">
        {/* Quality Badge */}
        {remoteStream && currentQuality && (
          <div className={`px-2 py-1 rounded-full text-xs text-white flex items-center gap-1 ${
            connectionQuality === 'good' ? 'bg-emerald-600' :
            connectionQuality === 'fair' ? 'bg-yellow-600' : 'bg-red-600'
          }`}>
            <span>{currentQuality.toUpperCase()}</span>
            <div className="quality-indicator">
              <div className={`quality-bar h-2 ${connectionQuality === 'poor' ? 'bg-white' : 'bg-white/50'}`} />
              <div className={`quality-bar h-3 ${connectionQuality !== 'poor' ? 'bg-white' : 'bg-white/50'}`} />
              <div className={`quality-bar h-4 ${connectionQuality === 'good' ? 'bg-white' : 'bg-white/50'}`} />
            </div>
          </div>
        )}

        {/* PiP Button */}
        {document.pictureInPictureEnabled && remoteStream && (
          <button
            onClick={togglePiP}
            className="p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
            title="Picture in Picture"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M4 6h16M4 12h8m-8 6h16M4 18h16M8 6v12M16 6v12" />
            </svg>
          </button>
        )}

        {/* Fullscreen Button */}
        <button
          onClick={toggleFullscreen}
          className="p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          )}
        </button>
      </div>

      {/* Connection State Overlay */}
      {connectionState === 'connecting' && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <div className="text-center text-white">
            <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p>Establishing connection...</p>
          </div>
        </div>
      )}

      {connectionState === 'failed' && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
          <div className="text-center text-white">
            <svg className="w-12 h-12 text-red-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p>Connection failed</p>
            <p className="text-sm text-gray-400 mt-1">Try refreshing or skip to next</p>
          </div>
        </div>
      )}
    </div>
  );
}
