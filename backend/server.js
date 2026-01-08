/**
 * Advanced Omegle Clone - Backend Server
 * Features: Interest matching, screen sharing, stats broadcast, reconnection
 */

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const matchmaking = require('./matchmaking');
const moderation = require('./moderation');

// Initialize Express app
const app = express();
const httpServer = createServer(app);

// Socket.IO with CORS configuration
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    version: '2.0.0',
    ...matchmaking.getStats(),
    moderation: moderation.getStats()
  });
});

// Get online stats (public endpoint)
app.get('/api/stats', (req, res) => {
  const stats = matchmaking.getStats();
  res.json({
    online: stats.onlineCount,
    waiting: stats.waitingCount,
    chatting: stats.activePairsCount * 2,
    popularInterests: stats.popularInterests
  });
});

// Store user sessions for reconnection
const userSessions = new Map(); // sessionId -> { socketId, partnerId, messages }

// Broadcast stats every 5 seconds
setInterval(() => {
  const stats = matchmaking.getStats();
  io.emit('stats-update', {
    online: stats.onlineCount,
    waiting: stats.waitingCount,
    chatting: stats.activePairsCount * 2
  });
}, 5000);

// ====================
// SOCKET.IO EVENTS
// ====================

io.on('connection', (socket) => {
  console.log(`✅ User connected: ${socket.id}`);
  
  // Track online user
  matchmaking.userConnected(socket.id);
  
  // Get user IP for moderation
  const userIP = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
  const fingerprint = socket.handshake.query.fingerprint;
  
  // Check if banned
  if (moderation.isBanned(userIP, fingerprint)) {
    socket.emit('banned', { reason: 'You have been banned from this service' });
    socket.disconnect();
    return;
  }

  // Send initial stats
  const stats = matchmaking.getStats();
  socket.emit('stats-update', {
    online: stats.onlineCount,
    waiting: stats.waitingCount,
    chatting: stats.activePairsCount * 2
  });

  // ------------------
  // MATCHMAKING EVENTS
  // ------------------

  /**
   * User wants to find a partner with preferences
   */
  socket.on('find-partner', (preferences = {}) => {
    console.log(`🔍 User ${socket.id} looking for partner with:`, preferences);
    
    const profile = {
      interests: preferences.interests || [],
      country: preferences.country || 'any',
      language: preferences.language || 'en',
      mode: preferences.mode || 'video'
    };
    
    const match = matchmaking.addToQueue(socket.id, profile);
    
    if (match) {
      console.log(`🎉 Matched: ${socket.id} <-> ${match.partnerId} (Score: ${match.matchScore})`);
      
      // Notify initiator
      socket.emit('matched', { 
        partnerId: match.partnerId,
        isInitiator: true,
        matchScore: match.matchScore,
        commonInterests: match.commonInterests
      });
      
      // Notify partner
      io.to(match.partnerId).emit('matched', { 
        partnerId: socket.id,
        isInitiator: false,
        matchScore: match.matchScore,
        commonInterests: match.commonInterests
      });
    } else {
      socket.emit('waiting', { 
        message: 'Looking for someone to chat with...',
        position: matchmaking.getStats().waitingCount
      });
    }
  });

  /**
   * User wants to skip current partner
   */
  socket.on('skip', (preferences = {}) => {
    console.log(`⏭️ User ${socket.id} skipped`);
    
    const { oldPartner, newMatch } = matchmaking.skip(socket.id, preferences);
    
    // Notify old partner
    if (oldPartner) {
      io.to(oldPartner).emit('partner-disconnected', { 
        reason: 'Stranger has disconnected',
        canReconnect: false
      });
    }
    
    // Handle new match
    if (newMatch) {
      socket.emit('matched', { 
        partnerId: newMatch.partnerId,
        isInitiator: true,
        matchScore: newMatch.matchScore,
        commonInterests: newMatch.commonInterests
      });
      
      io.to(newMatch.partnerId).emit('matched', { 
        partnerId: socket.id,
        isInitiator: false,
        matchScore: newMatch.matchScore,
        commonInterests: newMatch.commonInterests
      });
    } else {
      socket.emit('waiting', { 
        message: 'Looking for someone new...',
        position: matchmaking.getStats().waitingCount
      });
    }
  });

  /**
   * User stops looking for partner
   */
  socket.on('stop-search', () => {
    const partner = matchmaking.removeUser(socket.id);
    matchmaking.userConnected(socket.id); // Keep as online
    
    if (partner) {
      io.to(partner).emit('partner-disconnected', { 
        reason: 'Stranger has left the chat',
        canReconnect: false
      });
    }
    console.log(`🛑 User ${socket.id} stopped searching`);
  });

  // ------------------
  // CHAT EVENTS
  // ------------------

  /**
   * Text message from user
   */
  socket.on('chat-message', (data) => {
    const { message } = data;
    
    // Check if muted
    const muteStatus = moderation.isMuted(socket.id);
    if (muteStatus.muted) {
      socket.emit('error', { 
        message: `You are muted for ${muteStatus.remaining} seconds`,
        type: 'mute'
      });
      return;
    }
    
    // Rate limiting check
    const rateStatus = moderation.isRateLimited(socket.id);
    if (rateStatus.limited) {
      socket.emit('error', { message: rateStatus.reason, type: 'rate-limit' });
      return;
    }
    
    // Validate message
    const validation = moderation.validateMessage(socket.id, message);
    if (!validation.valid) {
      socket.emit('error', { message: validation.reason, type: 'validation' });
      return;
    }
    
    // Send warning if any
    if (validation.warning) {
      socket.emit('warning', { message: validation.warning });
    }
    
    // Get partner and send message
    const partnerId = matchmaking.getPartner(socket.id);
    if (partnerId) {
      const messageData = { 
        message: validation.sanitized,
        timestamp: Date.now(),
        id: `${socket.id}-${Date.now()}`
      };
      
      io.to(partnerId).emit('chat-message', messageData);
      
      // Confirm to sender
      socket.emit('message-sent', { id: messageData.id });
    } else {
      socket.emit('error', { message: 'Not connected to anyone', type: 'no-partner' });
    }
  });

  /**
   * Typing indicator
   */
  socket.on('typing', (isTyping) => {
    const partnerId = matchmaking.getPartner(socket.id);
    if (partnerId) {
      io.to(partnerId).emit('partner-typing', isTyping);
    }
  });

  /**
   * Message reaction (emoji reaction to messages)
   */
  socket.on('message-reaction', (data) => {
    const partnerId = matchmaking.getPartner(socket.id);
    if (partnerId) {
      io.to(partnerId).emit('message-reaction', {
        messageId: data.messageId,
        reaction: data.reaction
      });
    }
  });

  // ------------------
  // WEBRTC SIGNALING
  // ------------------

  socket.on('webrtc-offer', (data) => {
    const partnerId = matchmaking.getPartner(socket.id);
    if (partnerId) {
      console.log(`📡 WebRTC offer: ${socket.id} -> ${partnerId}`);
      io.to(partnerId).emit('webrtc-offer', {
        offer: data.offer,
        from: socket.id
      });
    }
  });

  socket.on('webrtc-answer', (data) => {
    const partnerId = matchmaking.getPartner(socket.id);
    if (partnerId) {
      console.log(`📡 WebRTC answer: ${socket.id} -> ${partnerId}`);
      io.to(partnerId).emit('webrtc-answer', {
        answer: data.answer,
        from: socket.id
      });
    }
  });

  socket.on('ice-candidate', (data) => {
    const partnerId = matchmaking.getPartner(socket.id);
    if (partnerId) {
      io.to(partnerId).emit('ice-candidate', {
        candidate: data.candidate,
        from: socket.id
      });
    }
  });

  /**
   * Screen sharing signals
   */
  socket.on('screen-share-started', () => {
    const partnerId = matchmaking.getPartner(socket.id);
    if (partnerId) {
      io.to(partnerId).emit('partner-screen-share', { active: true });
    }
  });

  socket.on('screen-share-stopped', () => {
    const partnerId = matchmaking.getPartner(socket.id);
    if (partnerId) {
      io.to(partnerId).emit('partner-screen-share', { active: false });
    }
  });

  /**
   * Connection quality report
   */
  socket.on('connection-quality', (data) => {
    const partnerId = matchmaking.getPartner(socket.id);
    if (partnerId) {
      io.to(partnerId).emit('partner-connection-quality', data);
    }
  });

  // ------------------
  // MODERATION EVENTS
  // ------------------

  /**
   * Report current partner
   */
  socket.on('report-user', (data) => {
    const partnerId = matchmaking.getPartner(socket.id);
    if (!partnerId) {
      socket.emit('error', { message: 'No user to report' });
      return;
    }

    const result = moderation.reportUser(partnerId, socket.id, data.reason);
    
    if (!result.success) {
      socket.emit('report-received', { message: result.message, success: false });
      return;
    }

    socket.emit('report-received', { 
      message: 'Report submitted. Thank you for helping keep our community safe.',
      success: true 
    });
    
    if (result.shouldBan) {
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        const partnerIP = partnerSocket.handshake.headers['x-forwarded-for'] || 
                         partnerSocket.handshake.address;
        moderation.banIP(partnerIP, 'multiple reports');
        partnerSocket.emit('banned', { reason: 'You have been banned due to multiple reports' });
        partnerSocket.disconnect();
      }
    }
  });

  // ------------------
  // DISCONNECT
  // ------------------

  socket.on('disconnect', (reason) => {
    console.log(`❌ User disconnected: ${socket.id} (${reason})`);
    
    // Notify partner
    const partnerId = matchmaking.removeUser(socket.id);
    if (partnerId) {
      io.to(partnerId).emit('partner-disconnected', { 
        reason: 'Stranger has disconnected',
        canReconnect: reason === 'transport close' || reason === 'ping timeout'
      });
    }
    
    // Cleanup
    matchmaking.userDisconnected(socket.id);
    moderation.cleanupUser(socket.id);
  });

  // ------------------
  // UTILITY EVENTS
  // ------------------

  /**
   * Ping for latency measurement
   */
  socket.on('ping-check', (timestamp) => {
    socket.emit('pong-check', timestamp);
  });

  /**
   * Get server time for sync
   */
  socket.on('get-server-time', () => {
    socket.emit('server-time', Date.now());
  });
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start server
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`
  ╔════════════════════════════════════════╗
  ║  🚀 Omegle Clone Server v2.0          ║
  ╠════════════════════════════════════════╣
  ║  📍 Port: ${PORT}                         ║
  ║  🌐 URL: http://localhost:${PORT}         ║
  ║  ⚡ Features:                          ║
  ║     • Interest-based matching         ║
  ║     • Screen sharing support          ║
  ║     • Advanced moderation             ║
  ║     • Real-time stats                 ║
  ╚════════════════════════════════════════╝
  `);
});

module.exports = { app, httpServer, io };
