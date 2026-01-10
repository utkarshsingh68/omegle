/**
 * Advanced WebRTC Hook
 * Features: Screen sharing, connection quality, adaptive bitrate
 */

import { useEffect, useRef, useState, useCallback } from 'react';

// ICE servers configuration
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ]
};

// Video constraints for different quality levels
const QUALITY_PRESETS = {
  high: { width: 1280, height: 720, frameRate: 30 },
  medium: { width: 640, height: 480, frameRate: 24 },
  low: { width: 320, height: 240, frameRate: 15 }
};

export default function useWebRTC(socket, partnerId, isInitiator) {
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const statsIntervalRef = useRef(null);
  
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [connectionState, setConnectionState] = useState('new');
  const [connectionQuality, setConnectionQuality] = useState('good'); // good, fair, poor
  const [currentQuality, setCurrentQuality] = useState('high');
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
      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      
      // Try audio only
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = audioStream;
        setLocalStream(audioStream);
        setIsVideoEnabled(false);
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
  }, [socket]);

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
   * Create WebRTC peer connection
   */
  const createPeerConnection = useCallback((stream) => {
    // Close existing connection if any
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    
    const pc = new RTCPeerConnection(ICE_SERVERS);
    
    // Add local tracks - use passed stream or ref
    const localMediaStream = stream || localStreamRef.current;
    if (localMediaStream) {
      console.log('📹 Adding local tracks to peer connection');
      localMediaStream.getTracks().forEach(track => {
        console.log('📹 Adding track:', track.kind);
        pc.addTrack(track, localMediaStream);
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
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        stopStatsMonitoring();
      }
    };
    
    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState);
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
    console.log('📹 Toggling video, current state:', isVideoEnabled);
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      console.log('📹 Video tracks found:', videoTracks.length);
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
        console.log('📹 Video track enabled:', track.enabled);
      });
      setIsVideoEnabled(prev => !prev);
    } else {
      console.warn('📹 No local stream available for video toggle');
    }
  }, [isVideoEnabled]);

  /**
   * Toggle audio
   */
  const toggleAudio = useCallback(() => {
    console.log('🎤 Toggling audio, current state:', isAudioEnabled);
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      console.log('🎤 Audio tracks found:', audioTracks.length);
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
        console.log('🎤 Audio track enabled:', track.enabled);
      });
      setIsAudioEnabled(prev => !prev);
    } else {
      console.warn('🎤 No local stream available for audio toggle');
    }
  }, [isAudioEnabled]);

  /**
   * Close connection and cleanup
   */
  const closeConnection = useCallback(() => {
    stopStatsMonitoring();
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
    
    return () => {
      socket.off('webrtc-offer', handleOffer);
      socket.off('webrtc-answer', handleAnswer);
      socket.off('ice-candidate', handleIceCandidate);
      socket.off('partner-screen-share');
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
    partnerScreenSharing,
    toggleVideo,
    toggleAudio,
    startScreenShare,
    stopScreenShare,
    switchQuality,
    closeConnection,
    getLocalStream
  };
}
