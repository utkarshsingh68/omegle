/**
 * Authentication & User Management
 * Features: Login, Register, Guest login, Friend system
 */

const { v4: uuidv4 } = require('uuid');

// In-memory storage (replace with database in production)
const users = new Map(); // id -> { id, username, email, password, displayName, avatar, friends, friendRequests, createdAt, isGuest }
const sessions = new Map(); // sessionToken -> { userId, createdAt, expiresAt }
const onlineUsers = new Map(); // socketId -> userId

// Avatar options
const AVATARS = ['🎭', '🦊', '🐱', '🐶', '🦁', '🐼', '🐨', '🐸', '🦄', '🐙', '🦋', '🌸', '⭐', '🌈', '🔥', '💎'];

/**
 * Generate a random guest username
 */
function generateGuestName() {
  const adjectives = ['Happy', 'Cool', 'Swift', 'Brave', 'Clever', 'Witty', 'Calm', 'Bold', 'Kind', 'Wild'];
  const nouns = ['Panda', 'Tiger', 'Eagle', 'Fox', 'Wolf', 'Bear', 'Hawk', 'Lion', 'Owl', 'Raven'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 1000);
  return `${adj}${noun}${num}`;
}

/**
 * Generate a session token
 */
function generateSessionToken() {
  return uuidv4() + '-' + Date.now().toString(36);
}

/**
 * Hash password (simple hash for demo - use bcrypt in production)
 */
function hashPassword(password) {
  // In production, use bcrypt: return await bcrypt.hash(password, 10);
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'hash_' + Math.abs(hash).toString(16);
}

/**
 * Verify password
 */
function verifyPassword(password, hashedPassword) {
  return hashPassword(password) === hashedPassword;
}

/**
 * Register a new user
 */
function register(username, email, password, displayName) {
  // Validate inputs
  if (!username || username.length < 3) {
    return { success: false, error: 'Username must be at least 3 characters' };
  }
  if (!email || !email.includes('@')) {
    return { success: false, error: 'Invalid email address' };
  }
  if (!password || password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters' };
  }

  // Check if username or email already exists
  for (const user of users.values()) {
    if (user.username.toLowerCase() === username.toLowerCase()) {
      return { success: false, error: 'Username already taken' };
    }
    if (user.email && user.email.toLowerCase() === email.toLowerCase()) {
      return { success: false, error: 'Email already registered' };
    }
  }

  const userId = uuidv4();
  const avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];
  
  const user = {
    id: userId,
    username: username.toLowerCase(),
    email: email.toLowerCase(),
    password: hashPassword(password),
    displayName: displayName || username,
    avatar,
    friends: [], // Array of user IDs
    friendRequests: [], // Array of { from: userId, timestamp }
    sentRequests: [], // Array of user IDs (requests sent by this user)
    createdAt: Date.now(),
    isGuest: false
  };

  users.set(userId, user);

  // Create session
  const sessionToken = generateSessionToken();
  sessions.set(sessionToken, {
    userId,
    createdAt: Date.now(),
    expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
  });

  return {
    success: true,
    user: sanitizeUser(user),
    sessionToken
  };
}

/**
 * Login user
 */
function login(usernameOrEmail, password) {
  let foundUser = null;

  for (const user of users.values()) {
    if (user.isGuest) continue;
    if (user.username === usernameOrEmail.toLowerCase() || 
        user.email === usernameOrEmail.toLowerCase()) {
      foundUser = user;
      break;
    }
  }

  if (!foundUser) {
    return { success: false, error: 'User not found' };
  }

  if (!verifyPassword(password, foundUser.password)) {
    return { success: false, error: 'Invalid password' };
  }

  // Create session
  const sessionToken = generateSessionToken();
  sessions.set(sessionToken, {
    userId: foundUser.id,
    createdAt: Date.now(),
    expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
  });

  return {
    success: true,
    user: sanitizeUser(foundUser),
    sessionToken
  };
}

/**
 * Guest login (anonymous user)
 */
function guestLogin() {
  const userId = uuidv4();
  const guestName = generateGuestName();
  const avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];

  const user = {
    id: userId,
    username: `guest_${userId.slice(0, 8)}`,
    email: null,
    password: null,
    displayName: guestName,
    avatar,
    friends: [],
    friendRequests: [],
    sentRequests: [],
    createdAt: Date.now(),
    isGuest: true
  };

  users.set(userId, user);

  // Create session (shorter for guests - 24 hours)
  const sessionToken = generateSessionToken();
  sessions.set(sessionToken, {
    userId,
    createdAt: Date.now(),
    expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
  });

  return {
    success: true,
    user: sanitizeUser(user),
    sessionToken
  };
}

/**
 * Validate session and get user
 */
function validateSession(sessionToken) {
  if (!sessionToken) return null;

  const session = sessions.get(sessionToken);
  if (!session) return null;

  if (Date.now() > session.expiresAt) {
    sessions.delete(sessionToken);
    return null;
  }

  const user = users.get(session.userId);
  if (!user) return null;

  return sanitizeUser(user);
}

/**
 * Logout user
 */
function logout(sessionToken) {
  sessions.delete(sessionToken);
  return { success: true };
}

/**
 * Update user profile
 */
function updateProfile(userId, updates) {
  const user = users.get(userId);
  if (!user) return { success: false, error: 'User not found' };

  if (updates.displayName) {
    user.displayName = updates.displayName;
  }
  if (updates.avatar && AVATARS.includes(updates.avatar)) {
    user.avatar = updates.avatar;
  }

  return { success: true, user: sanitizeUser(user) };
}

/**
 * Convert guest to registered user
 */
function convertGuestToUser(userId, username, email, password) {
  const user = users.get(userId);
  if (!user) return { success: false, error: 'User not found' };
  if (!user.isGuest) return { success: false, error: 'User is already registered' };

  // Check if username or email already exists
  for (const u of users.values()) {
    if (u.id === userId) continue;
    if (u.username.toLowerCase() === username.toLowerCase()) {
      return { success: false, error: 'Username already taken' };
    }
    if (u.email && u.email.toLowerCase() === email.toLowerCase()) {
      return { success: false, error: 'Email already registered' };
    }
  }

  user.username = username.toLowerCase();
  user.email = email.toLowerCase();
  user.password = hashPassword(password);
  user.isGuest = false;

  return { success: true, user: sanitizeUser(user) };
}

// ===================
// FRIEND SYSTEM
// ===================

/**
 * Send friend request
 */
function sendFriendRequest(fromUserId, toUserId) {
  const fromUser = users.get(fromUserId);
  const toUser = users.get(toUserId);

  if (!fromUser || !toUser) {
    return { success: false, error: 'User not found' };
  }

  if (fromUserId === toUserId) {
    return { success: false, error: 'Cannot add yourself as friend' };
  }

  // Check if already friends
  if (fromUser.friends.includes(toUserId)) {
    return { success: false, error: 'Already friends' };
  }

  // Check if request already sent
  if (fromUser.sentRequests.includes(toUserId)) {
    return { success: false, error: 'Friend request already sent' };
  }

  // Check if there's a pending request from the other user
  const existingRequest = fromUser.friendRequests.find(r => r.from === toUserId);
  if (existingRequest) {
    // Auto-accept if they already sent us a request
    return acceptFriendRequest(fromUserId, toUserId);
  }

  // Add to sent requests and recipient's friend requests
  fromUser.sentRequests.push(toUserId);
  toUser.friendRequests.push({
    from: fromUserId,
    fromName: fromUser.displayName,
    fromAvatar: fromUser.avatar,
    timestamp: Date.now()
  });

  return { 
    success: true, 
    message: 'Friend request sent',
    request: {
      to: toUserId,
      toName: toUser.displayName,
      toAvatar: toUser.avatar
    }
  };
}

/**
 * Accept friend request
 */
function acceptFriendRequest(userId, fromUserId) {
  const user = users.get(userId);
  const fromUser = users.get(fromUserId);

  if (!user || !fromUser) {
    return { success: false, error: 'User not found' };
  }

  // Remove from friend requests
  const requestIndex = user.friendRequests.findIndex(r => r.from === fromUserId);
  if (requestIndex === -1) {
    return { success: false, error: 'No pending request from this user' };
  }

  user.friendRequests.splice(requestIndex, 1);
  
  // Remove from sender's sent requests
  const sentIndex = fromUser.sentRequests.indexOf(userId);
  if (sentIndex !== -1) {
    fromUser.sentRequests.splice(sentIndex, 1);
  }

  // Add to both users' friends lists
  if (!user.friends.includes(fromUserId)) {
    user.friends.push(fromUserId);
  }
  if (!fromUser.friends.includes(userId)) {
    fromUser.friends.push(userId);
  }

  return { 
    success: true, 
    message: 'Friend request accepted',
    friend: {
      id: fromUserId,
      displayName: fromUser.displayName,
      avatar: fromUser.avatar,
      isGuest: fromUser.isGuest
    }
  };
}

/**
 * Decline friend request
 */
function declineFriendRequest(userId, fromUserId) {
  const user = users.get(userId);
  const fromUser = users.get(fromUserId);

  if (!user) {
    return { success: false, error: 'User not found' };
  }

  // Remove from friend requests
  const requestIndex = user.friendRequests.findIndex(r => r.from === fromUserId);
  if (requestIndex === -1) {
    return { success: false, error: 'No pending request from this user' };
  }

  user.friendRequests.splice(requestIndex, 1);
  
  // Remove from sender's sent requests
  if (fromUser) {
    const sentIndex = fromUser.sentRequests.indexOf(userId);
    if (sentIndex !== -1) {
      fromUser.sentRequests.splice(sentIndex, 1);
    }
  }

  return { success: true, message: 'Friend request declined' };
}

/**
 * Remove friend
 */
function removeFriend(userId, friendId) {
  const user = users.get(userId);
  const friend = users.get(friendId);

  if (!user) {
    return { success: false, error: 'User not found' };
  }

  // Remove from user's friends
  const friendIndex = user.friends.indexOf(friendId);
  if (friendIndex === -1) {
    return { success: false, error: 'Not friends with this user' };
  }

  user.friends.splice(friendIndex, 1);
  
  // Remove from friend's friends
  if (friend) {
    const reverseIndex = friend.friends.indexOf(userId);
    if (reverseIndex !== -1) {
      friend.friends.splice(reverseIndex, 1);
    }
  }

  return { success: true, message: 'Friend removed' };
}

/**
 * Get friends list
 */
function getFriends(userId) {
  const user = users.get(userId);
  if (!user) return [];

  return user.friends.map(friendId => {
    const friend = users.get(friendId);
    if (!friend) return null;
    return {
      id: friend.id,
      displayName: friend.displayName,
      avatar: friend.avatar,
      isGuest: friend.isGuest,
      isOnline: isUserOnline(friend.id)
    };
  }).filter(Boolean);
}

/**
 * Get friend requests
 */
function getFriendRequests(userId) {
  const user = users.get(userId);
  if (!user) return [];

  return user.friendRequests.map(req => {
    const fromUser = users.get(req.from);
    return {
      from: req.from,
      fromName: fromUser ? fromUser.displayName : 'Unknown',
      fromAvatar: fromUser ? fromUser.avatar : '👤',
      timestamp: req.timestamp
    };
  });
}

/**
 * Get sent requests
 */
function getSentRequests(userId) {
  const user = users.get(userId);
  if (!user) return [];

  return user.sentRequests.map(toId => {
    const toUser = users.get(toId);
    if (!toUser) return null;
    return {
      to: toId,
      toName: toUser.displayName,
      toAvatar: toUser.avatar
    };
  }).filter(Boolean);
}

// ===================
// SOCKET TRACKING
// ===================

function setUserOnline(socketId, userId) {
  onlineUsers.set(socketId, userId);
}

function setUserOffline(socketId) {
  onlineUsers.delete(socketId);
}

function isUserOnline(userId) {
  for (const uid of onlineUsers.values()) {
    if (uid === userId) return true;
  }
  return false;
}

function getUserBySocketId(socketId) {
  const userId = onlineUsers.get(socketId);
  if (!userId) return null;
  return users.get(userId);
}

function getSocketIdByUserId(userId) {
  for (const [socketId, uid] of onlineUsers.entries()) {
    if (uid === userId) return socketId;
  }
  return null;
}

// ===================
// HELPERS
// ===================

/**
 * Sanitize user object (remove sensitive data)
 */
function sanitizeUser(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatar: user.avatar,
    isGuest: user.isGuest,
    friendCount: user.friends.length,
    pendingRequests: user.friendRequests.length,
    createdAt: user.createdAt
  };
}

/**
 * Get user by ID (sanitized)
 */
function getUserById(userId) {
  const user = users.get(userId);
  return user ? sanitizeUser(user) : null;
}

/**
 * Search users by display name or username
 */
function searchUsers(query, excludeUserId = null) {
  if (!query || query.length < 2) return [];

  const results = [];
  const lowerQuery = query.toLowerCase();

  for (const user of users.values()) {
    if (user.id === excludeUserId) continue;
    if (user.isGuest) continue; // Don't show guests in search

    if (user.displayName.toLowerCase().includes(lowerQuery) ||
        user.username.toLowerCase().includes(lowerQuery)) {
      results.push({
        id: user.id,
        displayName: user.displayName,
        avatar: user.avatar,
        isOnline: isUserOnline(user.id)
      });
    }

    if (results.length >= 10) break;
  }

  return results;
}

module.exports = {
  register,
  login,
  guestLogin,
  validateSession,
  logout,
  updateProfile,
  convertGuestToUser,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  getFriends,
  getFriendRequests,
  getSentRequests,
  setUserOnline,
  setUserOffline,
  isUserOnline,
  getUserBySocketId,
  getSocketIdByUserId,
  getUserById,
  searchUsers,
  AVATARS
};
