/**
 * Advanced Omegle Clone - Backend Server
 * Features: Interest matching, screen sharing, stats broadcast, reconnection, auth, friends
 */

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const matchmaking = require('./matchmaking');
const moderation = require('./moderation');
const auth = require('./auth');

// Initialize Express app
const app = express();
const httpServer = createServer(app);

// CORS origins configuration
const getAllowedOrigins = () => {
  const frontendUrl = process.env.FRONTEND_URL;
  if (!frontendUrl) return "*";
  
  // Support multiple origins separated by comma
  const origins = frontendUrl.split(',').map(url => url.trim());
  return origins.length === 1 ? origins[0] : origins;
};

const corsOptions = {
  origin: getAllowedOrigins(),
  methods: ["GET", "POST", "OPTIONS"],
  credentials: true
};

// Socket.IO with CORS configuration  
const io = new Server(httpServer, {
  cors: corsOptions,
  pingTimeout: 300000, // 5 minutes for large uploads
  pingInterval: 25000,
  maxHttpBufferSize: 5e8, // 500MB to allow large video files
  allowUpgrades: true,
  transports: ['websocket', 'polling']
});

// Middleware
app.use(cors(corsOptions));
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

// ====================
// AUTH API ROUTES
// ====================

// Register new user
app.post('/api/auth/register', (req, res) => {
  const { username, email, password, displayName } = req.body;
  const result = auth.register(username, email, password, displayName);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

// Login user
app.post('/api/auth/login', (req, res) => {
  const { usernameOrEmail, password } = req.body;
  const result = auth.login(usernameOrEmail, password);
  if (result.success) {
    res.json(result);
  } else {
    res.status(401).json(result);
  }
});

// Guest login
app.post('/api/auth/guest', (req, res) => {
  const result = auth.guestLogin();
  res.json(result);
});

// Validate session
app.get('/api/auth/session', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const user = auth.validateSession(token);
  if (user) {
    res.json({ success: true, user });
  } else {
    res.status(401).json({ success: false, error: 'Invalid session' });
  }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const result = auth.logout(token);
  res.json(result);
});

// Update profile
app.put('/api/auth/profile', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const user = auth.validateSession(token);
  if (!user) {
    return res.status(401).json({ success: false, error: 'Invalid session' });
  }
  const result = auth.updateProfile(user.id, req.body);
  res.json(result);
});

// Convert guest to registered user
app.post('/api/auth/convert', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const user = auth.validateSession(token);
  if (!user) {
    return res.status(401).json({ success: false, error: 'Invalid session' });
  }
  const { username, email, password } = req.body;
  const result = auth.convertGuestToUser(user.id, username, email, password);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

// Get available avatars
app.get('/api/auth/avatars', (req, res) => {
  res.json({ avatars: auth.AVATARS });
});

// ====================
// FRIENDS API ROUTES
// ====================

// Get friends list
app.get('/api/friends', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const user = auth.validateSession(token);
  if (!user) {
    return res.status(401).json({ success: false, error: 'Invalid session' });
  }
  const friends = auth.getFriends(user.id);
  res.json({ success: true, friends });
});

// Get friend requests
app.get('/api/friends/requests', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const user = auth.validateSession(token);
  if (!user) {
    return res.status(401).json({ success: false, error: 'Invalid session' });
  }
  const requests = auth.getFriendRequests(user.id);
  const sent = auth.getSentRequests(user.id);
  res.json({ success: true, received: requests, sent });
});

// Search users
app.get('/api/users/search', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const user = auth.validateSession(token);
  if (!user) {
    return res.status(401).json({ success: false, error: 'Invalid session' });
  }
  const { q } = req.query;
  const users = auth.searchUsers(q, user.id);
  res.json({ success: true, users });
});

// Store user sessions for reconnection
const userSessions = new Map(); // sessionId -> { socketId, partnerId, messages }

// Store media chunks during transfer
const mediaTransfers = new Map(); // transferId -> { chunks: [], type, name, socketId }

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
  // AUTH EVENTS
  // ------------------

  /**
   * User authenticates with session token
   */
  socket.on('authenticate', (data) => {
    const { sessionToken } = data;
    const user = auth.validateSession(sessionToken);
    if (user) {
      auth.setUserOnline(socket.id, user.id);
      socket.userId = user.id;
      socket.emit('authenticated', { user });
      console.log(`🔐 User authenticated: ${user.displayName} (${socket.id})`);
      
      // Notify friends that user is online
      const friends = auth.getFriends(user.id);
      friends.forEach(friend => {
        const friendSocketId = auth.getSocketIdByUserId(friend.id);
        if (friendSocketId) {
          io.to(friendSocketId).emit('friend-online', { friendId: user.id, displayName: user.displayName });
        }
      });
    } else {
      socket.emit('auth-error', { error: 'Invalid session' });
    }
  });

  // ------------------
  // FRIEND EVENTS
  // ------------------

  /**
   * Send friend request to current chat partner
   */
  socket.on('send-friend-request', (data) => {
    if (!socket.userId) {
      socket.emit('friend-error', { error: 'Please login to add friends' });
      return;
    }

    const partnerId = matchmaking.getPartner(socket.id);
    if (!partnerId) {
      socket.emit('friend-error', { error: 'No partner to add' });
      return;
    }

    // Get partner's user ID
    const partnerUser = auth.getUserBySocketId(partnerId);
    if (!partnerUser) {
      socket.emit('friend-error', { error: 'Partner is not logged in' });
      return;
    }

    const result = auth.sendFriendRequest(socket.userId, partnerUser.id);
    if (result.success) {
      socket.emit('friend-request-sent', result);
      
      // Notify the partner
      io.to(partnerId).emit('friend-request-received', {
        from: socket.userId,
        fromName: auth.getUserById(socket.userId)?.displayName,
        fromAvatar: auth.getUserById(socket.userId)?.avatar
      });
    } else {
      socket.emit('friend-error', result);
    }
  });

  /**
   * Accept friend request
   */
  socket.on('accept-friend-request', (data) => {
    if (!socket.userId) {
      socket.emit('friend-error', { error: 'Not authenticated' });
      return;
    }

    const { fromUserId } = data;
    const result = auth.acceptFriendRequest(socket.userId, fromUserId);
    if (result.success) {
      socket.emit('friend-request-accepted', result);
      
      // Notify the other user
      const otherSocketId = auth.getSocketIdByUserId(fromUserId);
      if (otherSocketId) {
        io.to(otherSocketId).emit('friend-added', {
          friend: auth.getUserById(socket.userId)
        });
      }
    } else {
      socket.emit('friend-error', result);
    }
  });

  /**
   * Decline friend request
   */
  socket.on('decline-friend-request', (data) => {
    if (!socket.userId) {
      socket.emit('friend-error', { error: 'Not authenticated' });
      return;
    }

    const { fromUserId } = data;
    const result = auth.declineFriendRequest(socket.userId, fromUserId);
    socket.emit('friend-request-declined', result);
  });

  /**
   * Remove friend
   */
  socket.on('remove-friend', (data) => {
    if (!socket.userId) {
      socket.emit('friend-error', { error: 'Not authenticated' });
      return;
    }

    const { friendId } = data;
    const result = auth.removeFriend(socket.userId, friendId);
    if (result.success) {
      socket.emit('friend-removed', { friendId });
      
      // Notify the other user
      const otherSocketId = auth.getSocketIdByUserId(friendId);
      if (otherSocketId) {
        io.to(otherSocketId).emit('friend-removed', { friendId: socket.userId });
      }
    } else {
      socket.emit('friend-error', result);
    }
  });

  /**
   * Get friends list via socket
   */
  socket.on('get-friends', () => {
    if (!socket.userId) {
      socket.emit('friends-list', { friends: [], requests: [] });
      return;
    }

    const friends = auth.getFriends(socket.userId);
    const requests = auth.getFriendRequests(socket.userId);
    socket.emit('friends-list', { friends, requests });
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
      mode: preferences.mode || 'video',
      genderPreference: preferences.genderPreference || preferences.gender || 'both',
      selfGender: preferences.selfGender || 'unspecified'
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
   * Text message from user (with optional media)
   */
  socket.on('chat-message', (data) => {
    const { message, media } = data;
    
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
    
    // Validate message (if text exists)
    let sanitizedMessage = message || '';
    if (message) {
      const validation = moderation.validateMessage(socket.id, message);
      if (!validation.valid) {
        socket.emit('error', { message: validation.reason, type: 'validation' });
        return;
      }
      if (validation.warning) {
        socket.emit('warning', { message: validation.warning });
      }
      sanitizedMessage = validation.sanitized;
    }
    
    // Get partner and send message
    const partnerId = matchmaking.getPartner(socket.id);
    if (partnerId) {
      const messageData = { 
        message: sanitizedMessage,
        media: media || null,
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
   * Receive media chunk (for large file transfers)
   */
  socket.on('media-chunk', (data) => {
    const { transferId, chunkIndex, totalChunks, data: chunkData, type, name } = data;
    
    // Initialize transfer if first chunk
    if (!mediaTransfers.has(transferId)) {
      mediaTransfers.set(transferId, {
        chunks: new Array(totalChunks),
        type,
        name,
        socketId: socket.id,
        receivedCount: 0
      });
    }
    
    const transfer = mediaTransfers.get(transferId);
    transfer.chunks[chunkIndex] = chunkData;
    transfer.receivedCount++;
    
    // Log progress for debugging
    if (chunkIndex % 10 === 0 || chunkIndex === totalChunks - 1) {
      console.log(`📦 Chunk ${chunkIndex + 1}/${totalChunks} received for transfer ${transferId}`);
    }
  });

  /**
   * Media transfer complete - assemble and send to partner
   */
  socket.on('media-complete', (data) => {
    const { transferId, message, type, name, totalChunks } = data;
    
    const transfer = mediaTransfers.get(transferId);
    if (!transfer) {
      socket.emit('error', { message: 'Media transfer not found', type: 'transfer-error' });
      return;
    }
    
    // Verify all chunks received
    if (transfer.receivedCount !== totalChunks) {
      console.log(`⚠️ Missing chunks: received ${transfer.receivedCount}/${totalChunks}`);
      socket.emit('error', { message: 'Some media chunks were lost. Please try again.', type: 'transfer-error' });
      mediaTransfers.delete(transferId);
      return;
    }
    
    // Assemble the complete media data
    const completeData = transfer.chunks.join('');
    console.log(`✅ Media assembled: ${(completeData.length / 1024 / 1024).toFixed(2)}MB`);
    
    // Clean up transfer
    mediaTransfers.delete(transferId);
    
    // Get partner and send complete message
    const partnerId = matchmaking.getPartner(socket.id);
    if (partnerId) {
      const messageData = {
        message: message || '',
        media: {
          type: type,
          data: completeData,
          name: name
        },
        timestamp: Date.now(),
        id: `${socket.id}-${Date.now()}`
      };
      
      io.to(partnerId).emit('chat-message', messageData);
      socket.emit('message-sent', { id: messageData.id });
      console.log(`📤 Large media sent to partner ${partnerId}`);
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

  /**
   * WebRTC keepalive - prevents connection timeout
   */
  socket.on('webrtc-keepalive', (data) => {
    const partnerId = matchmaking.getPartner(socket.id);
    if (partnerId) {
      io.to(partnerId).emit('webrtc-keepalive', { from: socket.id });
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
    
    // Cleanup any pending media transfers for this user
    for (const [transferId, transfer] of mediaTransfers.entries()) {
      if (transfer.socketId === socket.id) {
        mediaTransfers.delete(transferId);
        console.log(`🗑️ Cleaned up abandoned transfer: ${transferId}`);
      }
    }
    
    // Notify partner
    const partnerId = matchmaking.removeUser(socket.id);
    if (partnerId) {
      io.to(partnerId).emit('partner-disconnected', { 
        reason: 'Stranger has disconnected',
        canReconnect: reason === 'transport close' || reason === 'ping timeout'
      });
    }
    
    // Notify friends that user went offline
    if (socket.userId) {
      const friends = auth.getFriends(socket.userId);
      friends.forEach(friend => {
        const friendSocketId = auth.getSocketIdByUserId(friend.id);
        if (friendSocketId) {
          io.to(friendSocketId).emit('friend-offline', { friendId: socket.userId });
        }
      });
      auth.setUserOffline(socket.id);
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
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`
  ╔════════════════════════════════════════╗
  ║  🚀 Omegle Clone Server v2.0          ║
  ╠════════════════════════════════════════╣
  ║  📍 Port: ${PORT}                         ║
  ║  🌐 URL: http://0.0.0.0:${PORT}           ║
  ║  ⚡ Features:                          ║
  ║     • Interest-based matching         ║
  ║     • Screen sharing support          ║
  ║     • Advanced moderation             ║
  ║     • Real-time stats                 ║
  ╚════════════════════════════════════════╝
  `);
});

module.exports = { app, httpServer, io };
