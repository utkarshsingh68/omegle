/**
 * Advanced Socket Hook
 * Features: Auto-reconnection, interest matching, stats sync, authentication
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_SERVER = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

export default function useSocket(sessionToken = null) {
  const socketRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [partnerId, setPartnerId] = useState(null);
  const [isInitiator, setIsInitiator] = useState(false);
  const [messages, setMessages] = useState([]);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);
  const [matchInfo, setMatchInfo] = useState(null);
  const [stats, setStats] = useState({ online: 0, waiting: 0, chatting: 0 });
  const [latency, setLatency] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [partnerInfo, setPartnerInfo] = useState(null); // Partner's user info if logged in

  // Initialize socket connection
  useEffect(() => {
    const connect = () => {
      socketRef.current = io(SOCKET_SERVER, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: maxReconnectAttempts,
        reconnectionDelay: 1000,
        timeout: 10000
      });

      const socket = socketRef.current;

      // Connection events
      socket.on('connect', () => {
        console.log('✅ Connected to server');
        setIsConnected(true);
        setConnectionStatus('connected');
        reconnectAttempts.current = 0;
        
        // Authenticate if we have a session token
        if (sessionToken) {
          socket.emit('authenticate', { sessionToken });
        }
        
        // Start latency check
        startLatencyCheck();
      });
      
      // Authentication response
      socket.on('authenticated', (data) => {
        console.log('🔐 Authenticated:', data.user?.displayName);
        setIsAuthenticated(true);
      });
      
      socket.on('auth-error', (data) => {
        console.error('Auth error:', data.error);
        setIsAuthenticated(false);
      });

      socket.on('disconnect', (reason) => {
        console.log('❌ Disconnected:', reason);
        setIsConnected(false);
        setConnectionStatus('disconnected');
        setPartnerId(null);
        setMatchInfo(null);
      });

      socket.on('connect_error', (err) => {
        console.error('Connection error:', err);
        setConnectionStatus('error');
        reconnectAttempts.current++;
        
        if (reconnectAttempts.current >= maxReconnectAttempts) {
          setError('Could not connect to server. Please refresh the page.');
        }
      });

      // Stats updates
      socket.on('stats-update', (data) => {
        setStats(data);
      });

      // Matchmaking events
      socket.on('waiting', (data) => {
        console.log('⏳ Waiting for partner...', data);
        setConnectionStatus('waiting');
        setPartnerId(null);
        setMatchInfo(null);
        setMessages([]);
      });

      socket.on('matched', (data) => {
        console.log('🎉 Matched with partner:', data);
        setConnectionStatus('matched');
        setPartnerId(data.partnerId);
        setIsInitiator(data.isInitiator);
        setMatchInfo({
          matchScore: data.matchScore,
          commonInterests: data.commonInterests || []
        });
        setMessages([{
          type: 'system',
          text: data.commonInterests?.length > 0
            ? `You both like: ${data.commonInterests.join(', ')}! Say hi! 👋`
            : "You're now chatting with a stranger. Say hi! 👋",
          timestamp: Date.now()
        }]);
      });

      socket.on('partner-disconnected', (data) => {
        console.log('👋 Partner disconnected:', data.reason);
        setConnectionStatus('partner-left');
        setPartnerId(null);
        setMatchInfo(null);
        setPartnerTyping(false);
        setMessages(prev => [...prev, {
          type: 'system',
          text: data.reason || 'Stranger has disconnected.',
          timestamp: Date.now()
        }]);
      });

      // Chat events
      socket.on('chat-message', (data) => {
        playNotificationSound();
        setMessages(prev => [...prev, {
          id: data.id,
          type: 'stranger',
          text: data.message,
          media: data.media || null,
          timestamp: data.timestamp,
          reactions: []
        }]);
      });

      socket.on('message-sent', (data) => {
        // Message confirmed sent
      });

      socket.on('partner-typing', (isTyping) => {
        setPartnerTyping(isTyping);
      });

      socket.on('message-reaction', (data) => {
        setMessages(prev => prev.map(msg => {
          if (msg.id === data.messageId) {
            return {
              ...msg,
              reactions: [...(msg.reactions || []), data.reaction]
            };
          }
          return msg;
        }));
      });

      // Error events
      socket.on('error', (data) => {
        setError(data.message);
        setTimeout(() => setError(null), 4000);
      });

      socket.on('warning', (data) => {
        setWarning(data.message);
        setTimeout(() => setWarning(null), 4000);
      });

      socket.on('banned', (data) => {
        setError(data.reason);
        setConnectionStatus('banned');
      });

      socket.on('report-received', (data) => {
        if (data.success) {
          setMessages(prev => [...prev, {
            type: 'system',
            text: '✓ Report submitted. Thank you.',
            timestamp: Date.now()
          }]);
        }
      });

      // Latency check
      socket.on('pong-check', (timestamp) => {
        const lat = Date.now() - timestamp;
        setLatency(lat);
      });
    };

    connect();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [sessionToken]);

  // Latency check interval
  const startLatencyCheck = () => {
    const interval = setInterval(() => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('ping-check', Date.now());
      }
    }, 5000);
    
    return () => clearInterval(interval);
  };

  // Notification sound
  const playNotificationSound = () => {
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2Onp6TiHlvdH+Mmp2UiHZtcX2KlpiShHNrcHyIk5aRfnJpcHyHkJOPe3BocHuFjo+MeG5ncHqDjI2KeG1ncHmCiouHdmtmb3iBiYqGdGpmbneBh4iDc2lmbnZ/hYaDcWhlbXV+g4WBcGdlbHR9gYN/bmVkbHN7f4F+bWRja3J6fX98a2NianF5fH16aWJhaXB3ent4Z2FgaG92eHl2ZmBfZ252dnd0ZV9eZmx0dXZzY15dZWtzdHRxYl1cZGpxc3JwYVxbY2lwcnFuYFtaYmducHBsX1pZYWZtb25rXllYYGVsbW1qXVhXX2RqbGtpXFdWXmNpamloW1ZVXWFnaWdmWlVUXGBmZ2ZkWVRTW19lZmRiV1NRWl5kZGNgVlJQWV1jY2FfVVFPV1xhYWBeVFBOVltgYF5cU09NVVleX11bUk5MVFhdXlxZUU1LU1ZcXVtYUExKUlVaW1lWT0tJUFRZWlhVTkpITlNXWFZTTUlHTVJWVlRRTEhFTFBUVFJPSkdESk9TU1FOS0ZDSk5RUU9MSUVCSE1QT01KR0RBR0tOTkxJRkM/RklMTEpHREE+RUhKSkhFQj49REZJSEZDQDw8QkVHR0RBPjs6QENFREJAPTo5P0FCQT8+Ojg4PkBAPz07ODY3PT4+PTk3NjU7PD08ODY0NDk7Ozk2NDMyNzo6ODUzMjE2OTg3NDIxMDU3NzUzMS8vNDY1MzEvLy8yNDQyMC8uLjEzMzEwLi4tMDIxMC8tLS0vMTAwLi0tLCwuMC8uLC0sKywtLi4tKyssKyorLC0sKyoqKikpKissKyoqKSkpKSorKiopKSkpKCgpKioqKSkpKCgoKCkpKSkpKCgoKCgoKCkpKSkpKCgoKCgoKCkpKSkpKCgoKCgo');
      audio.volume = 0.3;
      audio.play().catch(() => {});
    } catch (e) {}
  };

  // Find partner with preferences
  const findPartner = useCallback((preferences = {}) => {
    if (socketRef.current) {
      setConnectionStatus('searching');
      socketRef.current.emit('find-partner', preferences);
    }
  }, []);

  // Skip to next partner
  const skipPartner = useCallback((preferences = {}) => {
    if (socketRef.current) {
      setConnectionStatus('searching');
      setPartnerId(null);
      setMatchInfo(null);
      setMessages([]);
      setPartnerTyping(false);
      socketRef.current.emit('skip', preferences);
    }
  }, []);

  // Stop searching
  const stopSearch = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('stop-search');
      setConnectionStatus('connected');
      setPartnerId(null);
      setMatchInfo(null);
      setMessages([]);
    }
  }, []);

  // Send chat message (with optional media - uses chunked upload for large files)
  const sendMessage = useCallback((message, media = null) => {
    if (socketRef.current && partnerId && (message.trim() || media)) {
      const msgId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // For large media files, use chunked transfer
      const CHUNK_SIZE = 64 * 1024; // 64KB chunks
      const MAX_DIRECT_SIZE = 100 * 1024; // 100KB - send directly if smaller
      
      if (media && media.data && media.data.length > MAX_DIRECT_SIZE) {
        // Chunked upload for large files
        const totalChunks = Math.ceil(media.data.length / CHUNK_SIZE);
        const transferId = `${msgId}-transfer`;
        
        console.log(`📤 Sending large media in ${totalChunks} chunks...`);
        
        // Send chunks with small delays to avoid overwhelming the socket
        let chunkIndex = 0;
        const sendNextChunk = () => {
          if (chunkIndex < totalChunks) {
            const start = chunkIndex * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, media.data.length);
            const chunkData = media.data.slice(start, end);
            
            socketRef.current.emit('media-chunk', {
              transferId,
              chunkIndex,
              totalChunks,
              data: chunkData,
              type: media.type,
              name: media.name
            });
            
            chunkIndex++;
            // Small delay between chunks to prevent transport overload
            setTimeout(sendNextChunk, 10);
          } else {
            // All chunks sent, send completion signal with message
            socketRef.current.emit('media-complete', {
              transferId,
              message: message,
              type: media.type,
              name: media.name,
              totalChunks
            });
            console.log('✅ Media transfer complete');
          }
        };
        
        sendNextChunk();
      } else {
        // Small media or text only - send directly
        socketRef.current.emit('chat-message', { message, media });
      }
      
      // Add to local messages immediately
      setMessages(prev => [...prev, {
        id: msgId,
        type: 'you',
        text: message,
        media: media,
        timestamp: Date.now(),
        reactions: []
      }]);
    }
  }, [partnerId]);

  // Send typing indicator
  const sendTyping = useCallback((isTyping) => {
    if (socketRef.current && partnerId) {
      socketRef.current.emit('typing', isTyping);
    }
  }, [partnerId]);

  // Send reaction
  const sendReaction = useCallback((messageId, reaction) => {
    if (socketRef.current && partnerId) {
      socketRef.current.emit('message-reaction', { messageId, reaction });
      // Update local state
      setMessages(prev => prev.map(msg => {
        if (msg.id === messageId) {
          return {
            ...msg,
            reactions: [...(msg.reactions || []), reaction]
          };
        }
        return msg;
      }));
    }
  }, [partnerId]);

  // Report user
  const reportUser = useCallback((reason) => {
    if (socketRef.current && partnerId) {
      socketRef.current.emit('report-user', { reason });
    }
  }, [partnerId]);

  return {
    socket: socketRef.current,
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
    isAuthenticated,
    partnerInfo,
    findPartner,
    skipPartner,
    stopSearch,
    sendMessage,
    sendTyping,
    sendReaction,
    reportUser
  };
}
