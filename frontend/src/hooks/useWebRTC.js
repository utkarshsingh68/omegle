/**
 * Advanced WebRTC Hook
 * Features: Screen sharing, connection quality, adaptive bitrate
 */

import { useEffect, useRef, useState, useCallback } from 'react';

// ICE servers configuration with STUN + TURN for NAT traversal
const TURN_URL = import.meta.env.VITE_TURN_URL; // e.g. turn:YOUR_IP:3478
const TURN_USER = import.meta.env.VITE_TURN_USER;
const TURN_PASS = import.meta.env.VITE_TURN_PASS;
const METERED_API_KEY = import.meta.env.VITE_METERED_API_KEY;

// Cache for Metered TURN credentials
let meteredCredentialsCache = null;
let meteredCredentialsExpiry = 0;

/**
 * Fetch TURN credentials from Metered.ca API (if API key is set)
 * Returns fresh credentials valid for 24 hours
 */
async function getMeteredTurnServers() {
  if (!METERED_API_KEY) return [];
  
  // Return cached if still valid (refresh 1 hour before expiry)
  if (meteredCredentialsCache && Date.now() < meteredCredentialsExpiry - 3600000) {
    return meteredCredentialsCache;
  }
  
  try {
    const response = await fetch(
      `https://omegle.metered.live/api/v1/turn/credentials?apiKey=${METERED_API_KEY}`
    );
    if (!response.ok) throw new Error('Failed to fetch TURN credentials');
    
    const servers = await response.json();
    meteredCredentialsCache = servers;
    meteredCredentialsExpiry = Date.now() + 24 * 3600000; // 24 hours
    console.log('✅ Fetched Metered TURN credentials:', servers.length, 'servers');
    return servers;
  } catch (error) {
    console.warn('⚠️ Could not fetch Metered TURN credentials:', error.message);
    return [];
  }
}

// Build static ICE servers (self-hosted + free fallback)
function buildStaticIceServers() {
  const servers = [
    // Google STUN servers
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ];

  // Add self-hosted TURN if configured
  if (TURN_URL && TURN_USER && TURN_PASS) {
    servers.push(
      { urls: TURN_URL, username: TURN_USER, credential: TURN_PASS },
      { urls: `${TURN_URL}?transport=tcp`, username: TURN_USER, credential: TURN_PASS }
    );
  }

  // Fallback free TURN (unreliable, rate-limited)
  servers.push(
    {
      urls: 'turn:a.relay.metered.ca:80',
      username: 'e8dd65b92c62d5e5e3c02c65',
      credential: 'uWdWNmkhvyqTEuTB'
    },
    {
      urls: 'turn:a.relay.metered.ca:80?transport=tcp',
      username: 'e8dd65b92c62d5e5e3c02c65',
      credential: 'uWdWNmkhvyqTEuTB'
    },
    {
      urls: 'turn:a.relay.metered.ca:443',
      username: 'e8dd65b92c62d5e5e3c02c65',
      credential: 'uWdWNmkhvyqTEuTB'
    },
    {
      urls: 'turn:a.relay.metered.ca:443?transport=tcp',
      username: 'e8dd65b92c62d5e5e3c02c65',
      credential: 'uWdWNmkhvyqTEuTB'
    },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  );

  return servers;
}

/**
 * Get full ICE configuration with Metered (if configured) + static servers
 */
async function getIceServers() {
  const staticServers = buildStaticIceServers();
  const meteredServers = await getMeteredTurnServers();
  
  // Metered servers first (most reliable), then static
  return {
    iceServers: [...meteredServers, ...staticServers],
    iceCandidatePoolSize: 10
  };
}

// Synchronous fallback for initial render
const ICE_SERVERS = {
  iceServers: buildStaticIceServers(),
  iceCandidatePoolSize: 10
};

// Video constraints for different quality levels - HIGH QUALITY BUT STABLE
const QUALITY_PRESETS = {
  high: { 
    width: { ideal: 1280, max: 1920 }, 
    height: { ideal: 720, max: 1080 }, 
    frameRate: { ideal: 30, max: 30 },
    aspectRatio: 16/9
  },
  medium: { 
    width: { ideal: 640, max: 1280 }, 
    height: { ideal: 480, max: 720 }, 
    frameRate: { ideal: 24, max: 30 } 
  },
  low: { 
    width: { ideal: 320, max: 640 }, 
    height: { ideal: 240, max: 480 }, 
    frameRate: { ideal: 15, max: 24 } 
  }
};

// SDP modification to set max bitrate for high quality video
const setMaxBitrate = (sdp, maxBitrate = 8000) => {
  // Add bandwidth restriction to video
  const lines = sdp.split('\r\n');
  const newLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    newLines.push(lines[i]);
    // After m=video line, add bandwidth
    if (lines[i].startsWith('m=video')) {
      newLines.push(`b=AS:${maxBitrate}`);
    }
  }
  
  return newLines.join('\r\n');
};

export default function useWebRTC(socket, partnerId, isInitiator) {
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const statsIntervalRef = useRef(null);
  const keepaliveIntervalRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const lastIceRestartRef = useRef(0);
  
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [connectionState, setConnectionState] = useState('new');
  const [connectionQuality, setConnectionQuality] = useState('good'); // good, fair, poor
  const [currentQuality, setCurrentQuality] = useState('high');
  const [currentCameraFacing, setCurrentCameraFacing] = useState('user');
  const [partnerScreenSharing, setPartnerScreenSharing] = useState(false);

  /**
   * Get user's camera and microphone
   */
  const getLocalStream = useCallback(async (quality = 'high') => {
    try {
      const constraints = {
        video: {
          ...QUALITY_PRESETS[quality],
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
      setCurrentQuality(quality);
      setCurrentCameraFacing(constraints.video?.facingMode === 'environment' ? 'environment' : 'user');
      
      // Sync state with actual track enabled status
      const hasVideo = stream.getVideoTracks().length > 0;
      const hasAudio = stream.getAudioTracks().length > 0;
      setIsVideoEnabled(hasVideo && stream.getVideoTracks()[0]?.enabled);
      setIsAudioEnabled(hasAudio && stream.getAudioTracks()[0]?.enabled);
      
      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      
      // Try audio only
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = audioStream;
        setLocalStream(audioStream);
        setIsVideoEnabled(false);
        setIsAudioEnabled(audioStream.getAudioTracks()[0]?.enabled ?? true);
        return audioStream;
      } catch (audioError) {
        console.error('Error accessing audio:', audioError);
        return null;
      }
    }
  }, []);

  /**
   * Switch video quality
   */
  const switchQuality = useCallback(async (quality) => {
    if (!localStreamRef.current) return;
    
    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      try {
        await videoTrack.applyConstraints(QUALITY_PRESETS[quality]);
        setCurrentQuality(quality);
      } catch (error) {
        console.error('Error switching quality:', error);
      }
    }
  }, []);

  /**
   * Stop screen sharing
   */
  const stopScreenShare = useCallback(async () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
      setScreenStream(null);
      setIsScreenSharing(false);

      // Restore camera video
      const pc = peerConnectionRef.current;
      if (pc && localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        if (videoTrack) {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            await sender.replaceTrack(videoTrack);
          }
        }
      }

      // Notify partner
      if (socket) {
        socket.emit('screen-share-stopped');
      }
    }
  }, [socket]);

  /**
   * Start screen sharing
   */
  const startScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor'
        },
        audio: false
      });

      screenStreamRef.current = stream;
      setScreenStream(stream);
      setIsScreenSharing(true);

      // Replace video track in peer connection
      const pc = peerConnectionRef.current;
      if (pc) {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(stream.getVideoTracks()[0]);
        }
      }

      // Notify partner
      if (socket) {
        socket.emit('screen-share-started');
      }

      // Handle stream end (user clicks "Stop sharing")
      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };

      return stream;
    } catch (error) {
      console.error('Error starting screen share:', error);
      return null;
    }
  }, [socket, stopScreenShare]);

  /**
   * Switch between front/rear cameras (where available)
   */
  const switchCamera = useCallback(async () => {
    try {
      // If screen sharing is on, stop it before switching cameras
      if (isScreenSharing) {
        await stopScreenShare();
      }

      const nextFacing = currentCameraFacing === 'user' ? 'environment' : 'user';

      // Only request video; reuse existing audio tracks
      const newVideoStream = await navigator.mediaDevices.getUserMedia({
        video: { ...QUALITY_PRESETS[currentQuality], facingMode: { ideal: nextFacing } },
        audio: false
      });

      const newVideoTrack = newVideoStream.getVideoTracks()[0];
      if (!newVideoTrack) return false;

      const existingAudioTracks = localStreamRef.current?.getAudioTracks() || [];
      const newCombinedStream = new MediaStream([...existingAudioTracks, newVideoTrack]);

      // Replace video track in peer connection
      const pc = peerConnectionRef.current;
      if (pc) {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(newVideoTrack);
        }
      }

      // Stop old video tracks
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach(track => track.stop());
      }

      localStreamRef.current = newCombinedStream;
      setLocalStream(newCombinedStream);
      setIsVideoEnabled(true);
      setCurrentCameraFacing(nextFacing);
      return true;
    } catch (error) {
      console.error('Error switching camera:', error);
      return false;
    }
  }, [currentCameraFacing, currentQuality, isScreenSharing, stopScreenShare]);

  /**
   * Start keepalive mechanism
   */
  const startKeepalive = () => {
    stopKeepalive();
    keepaliveIntervalRef.current = setInterval(() => {
      if (socket && partnerId) {
        socket.emit('webrtc-keepalive', { to: partnerId });
      }
    }, 15000); // Send keepalive every 15 seconds
  };

  /**
   * Stop keepalive
   */
  const stopKeepalive = () => {
    if (keepaliveIntervalRef.current) {
      clearInterval(keepaliveIntervalRef.current);
      keepaliveIntervalRef.current = null;
    }
  };

  /**
   * Attempt ICE restart to recover connection
   */
  const attemptIceRestart = async (pc) => {
    // Prevent too frequent restarts
    const now = Date.now();
    if (now - lastIceRestartRef.current < 10000) {
      console.log('⏳ ICE restart too soon, skipping...');
      return;
    }
    
    if (reconnectAttempts.current >= 3) {
      console.log('❌ Max reconnect attempts reached');
      return;
    }
    
    lastIceRestartRef.current = now;
    reconnectAttempts.current++;
    
    try {
      if (isInitiator) {
        console.log('🔄 Creating new offer with ICE restart...');
        const offer = await pc.createOffer({ iceRestart: true });
        await pc.setLocalDescription(offer);
        socket.emit('webrtc-offer', { offer, iceRestart: true });
      }
    } catch (error) {
      console.error('Error during ICE restart:', error);
    }
  };

  /**
   * Create WebRTC peer connection
   * Uses async ICE servers if Metered API key is configured
   */
  const createPeerConnection = useCallback(async (stream) => {
    // Close existing connection if any
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    
    // Get ICE servers (async to support Metered API)
    const iceConfig = METERED_API_KEY ? await getIceServers() : ICE_SERVERS;
    console.log('🌐 Using', iceConfig.iceServers.length, 'ICE servers');
    
    const pc = new RTCPeerConnection(iceConfig);
    
    // Add local tracks - use passed stream or ref
    const localMediaStream = stream || localStreamRef.current;
    if (localMediaStream) {
      console.log('📹 Adding local tracks to peer connection');
      localMediaStream.getTracks().forEach(track => {
        console.log('📹 Adding track:', track.kind);
        const sender = pc.addTrack(track, localMediaStream);
        
        // Set high quality encoding parameters for video (stable bitrate)
        if (track.kind === 'video' && sender) {
          const params = sender.getParameters();
          if (!params.encodings) {
            params.encodings = [{}];
          }
          // Set max bitrate to 2.5 Mbps for stable high quality video
          params.encodings[0].maxBitrate = 2500000; // 2.5 Mbps - stable for most connections
          params.encodings[0].maxFramerate = 30;
          sender.setParameters(params).catch(e => console.log('Could not set video params:', e));
        }
        
        // Set high quality for audio
        if (track.kind === 'audio' && sender) {
          const params = sender.getParameters();
          if (!params.encodings) {
            params.encodings = [{}];
          }
          params.encodings[0].maxBitrate = 128000; // 128 kbps audio
          sender.setParameters(params).catch(e => console.log('Could not set audio params:', e));
        }
      });
    } else {
      console.warn('⚠️ No local stream available when creating peer connection');
    }
    
    // Handle incoming remote tracks
    pc.ontrack = (event) => {
      console.log('📹 Received remote track:', event.track.kind);
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };
    
    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        console.log('🧊 Sending ICE candidate');
        socket.emit('ice-candidate', { candidate: event.candidate });
      }
    };
    
    // Monitor connection state
    pc.onconnectionstatechange = () => {
      console.log('WebRTC connection state:', pc.connectionState);
      setConnectionState(pc.connectionState);
      
      if (pc.connectionState === 'connected') {
        startStatsMonitoring(pc);
        startKeepalive();
        reconnectAttempts.current = 0;
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        stopStatsMonitoring();
        stopKeepalive();
      }
    };
    
    pc.oniceconnectionstatechange = async () => {
      console.log('ICE connection state:', pc.iceConnectionState);
      
      // Handle disconnected/failed states with ICE restart
      if (pc.iceConnectionState === 'disconnected') {
        console.log('⚠️ ICE disconnected, will attempt restart if fails...');
        // Wait a bit to see if it recovers
        setTimeout(async () => {
          if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
            console.log('🔄 Attempting ICE restart...');
            await attemptIceRestart(pc);
          }
        }, 3000);
      } else if (pc.iceConnectionState === 'failed') {
        console.log('❌ ICE failed, restarting...');
        await attemptIceRestart(pc);
      } else if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        console.log('✅ ICE connection restored');
        reconnectAttempts.current = 0;
        startKeepalive();
      }
    };
    
    peerConnectionRef.current = pc;
    return pc;
  }, [socket]);

  /**
   * Start monitoring connection stats
   */
  const startStatsMonitoring = (pc) => {
    stopStatsMonitoring();
    
    statsIntervalRef.current = setInterval(async () => {
      try {
        const stats = await pc.getStats();
        let packetsLost = 0;
        let packetsReceived = 0;
        let jitter = 0;
        let rtt = 0;

        stats.forEach(report => {
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            packetsLost = report.packetsLost || 0;
            packetsReceived = report.packetsReceived || 0;
            jitter = report.jitter || 0;
          }
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            rtt = report.currentRoundTripTime || 0;
          }
        });

        // Calculate quality based on metrics
        const lossRate = packetsReceived > 0 ? packetsLost / packetsReceived : 0;
        
        let quality = 'good';
        if (lossRate > 0.1 || rtt > 0.5 || jitter > 0.1) {
          quality = 'poor';
        } else if (lossRate > 0.03 || rtt > 0.2 || jitter > 0.05) {
          quality = 'fair';
        }

        setConnectionQuality(quality);

        // Report to partner
        if (socket) {
          socket.emit('connection-quality', { quality, rtt, lossRate });
        }

        // Adaptive quality
        if (quality === 'poor' && currentQuality !== 'low') {
          await switchQuality('low');
        } else if (quality === 'fair' && currentQuality === 'high') {
          await switchQuality('medium');
        } else if (quality === 'good' && currentQuality !== 'high') {
          await switchQuality('high');
        }
      } catch (error) {
        // Stats not available
      }
    }, 3000);
  };

  /**
   * Stop stats monitoring
   */
  const stopStatsMonitoring = () => {
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
  };

  /**
   * Start WebRTC connection
   */
  const startConnection = useCallback(async () => {
    if (!partnerId) {
      console.log('⚠️ No partner ID, cannot start connection');
      return;
    }
    
    console.log('🚀 Starting WebRTC connection, isInitiator:', isInitiator);
    
    // Get local stream first and wait for it
    const stream = await getLocalStream();
    if (!stream) {
      console.error('❌ Failed to get local stream');
      return;
    }
    
    console.log('✅ Got local stream with tracks:', stream.getTracks().map(t => t.kind));
    
    // Create peer connection with the stream
    const pc = createPeerConnection(stream);
    
    if (isInitiator) {
      try {
        console.log('📤 Creating WebRTC offer...');
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });
        await pc.setLocalDescription(offer);
        
        console.log('📤 Sending WebRTC offer');
        socket.emit('webrtc-offer', { offer });
      } catch (error) {
        console.error('Error creating offer:', error);
      }
    } else {
      console.log('⏳ Waiting for offer from initiator...');
    }
  }, [partnerId, isInitiator, socket, getLocalStream, createPeerConnection]);

  /**
   * Handle incoming WebRTC offer
   */
  const handleOffer = useCallback(async (data) => {
    console.log('📥 Received WebRTC offer');
    
    // Get local stream if we don't have one
    let stream = localStreamRef.current;
    if (!stream) {
      console.log('📹 Getting local stream for answer...');
      stream = await getLocalStream();
    }
    
    // Create peer connection if needed
    if (!peerConnectionRef.current) {
      createPeerConnection(stream);
    }
    
    const pc = peerConnectionRef.current;
    
    try {
      console.log('📥 Setting remote description (offer)');
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      
      console.log('📤 Creating answer...');
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      console.log('📤 Sending WebRTC answer');
      socket.emit('webrtc-answer', { answer });
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  }, [socket, getLocalStream, createPeerConnection]);

  /**
   * Handle incoming WebRTC answer
   */
  const handleAnswer = useCallback(async (data) => {
    console.log('📥 Received WebRTC answer');
    
    const pc = peerConnectionRef.current;
    if (pc) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      } catch (error) {
        console.error('Error handling answer:', error);
      }
    }
  }, []);

  /**
   * Handle incoming ICE candidate
   */
  const handleIceCandidate = useCallback(async (data) => {
    const pc = peerConnectionRef.current;
    if (pc && data.candidate) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    }
  }, []);

  /**
   * Toggle video
   */
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      if (videoTracks.length > 0) {
        // Get current state from the actual track, not from React state
        const currentEnabled = videoTracks[0].enabled;
        const newEnabled = !currentEnabled;
        
        videoTracks.forEach(track => {
          track.enabled = newEnabled;
        });
        
        console.log('📹 Video toggled:', currentEnabled, '->', newEnabled);
        setIsVideoEnabled(newEnabled);
      }
    } else {
      console.warn('📹 No local stream available for video toggle');
    }
  }, []);

  /**
   * Toggle audio
   */
  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        // Get current state from the actual track, not from React state
        const currentEnabled = audioTracks[0].enabled;
        const newEnabled = !currentEnabled;
        
        audioTracks.forEach(track => {
          track.enabled = newEnabled;
        });
        
        console.log('🎤 Audio toggled:', currentEnabled, '->', newEnabled);
        setIsAudioEnabled(newEnabled);
      }
    } else {
      console.warn('🎤 No local stream available for audio toggle');
    }
  }, []);

  /**
   * Close connection and cleanup
   */
  const closeConnection = useCallback(() => {
    stopStatsMonitoring();
    stopKeepalive();
    stopScreenShare();
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    setLocalStream(null);
    setRemoteStream(null);
    setConnectionState('new');
    setConnectionQuality('good');
  }, [stopScreenShare]);

  // Socket listeners for WebRTC signaling
  useEffect(() => {
    if (!socket) return;
    
    socket.on('webrtc-offer', handleOffer);
    socket.on('webrtc-answer', handleAnswer);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('partner-screen-share', (data) => {
      setPartnerScreenSharing(data.active);
    });
    socket.on('webrtc-keepalive', () => {
      // Keepalive received from partner - connection is alive
      console.log('💓 Keepalive received from partner');
    });
    
    return () => {
      socket.off('webrtc-offer', handleOffer);
      socket.off('webrtc-answer', handleAnswer);
      socket.off('ice-candidate', handleIceCandidate);
      socket.off('partner-screen-share');
      socket.off('webrtc-keepalive');
    };
  }, [socket, handleOffer, handleAnswer, handleIceCandidate]);

  // Start connection when matched
  useEffect(() => {
    if (partnerId) {
      console.log('🔗 Partner ID changed, starting connection...');
      startConnection();
    } else {
      console.log('🔗 No partner, closing connection...');
      closeConnection();
    }
    
    return () => {
      // Cleanup on partner change
    };
  }, [partnerId, startConnection, closeConnection]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      closeConnection();
    };
  }, []);

  return {
    localStream,
    remoteStream,
    screenStream,
    isVideoEnabled,
    isAudioEnabled,
    isScreenSharing,
    connectionState,
    connectionQuality,
    currentQuality,
    currentCameraFacing,
    partnerScreenSharing,
    toggleVideo,
    toggleAudio,
    switchCamera,
    startScreenShare,
    stopScreenShare,
    switchQuality,
    closeConnection,
    getLocalStream
  };
}
