/**
 * Advanced Matchmaking System
 * Features: Interest-based matching, country filters, priority queue
 */

class MatchmakingQueue {
  constructor() {
    // Users waiting to be matched: Map<socketId, UserProfile>
    this.waitingQueue = new Map();
    // Active pairs: Map<socketId, partnerSocketId>
    this.activePairs = new Map();
    // Online users count
    this.onlineUsers = new Set();
    // Interest index for faster matching
    this.interestIndex = new Map(); // interest -> Set<socketId>
  }

  /**
   * Add user to waiting queue with preferences
   * @param {string} socketId - Socket ID
   * @param {object} profile - User preferences
   */
  addToQueue(socketId, profile = {}) {
    const userProfile = {
      socketId,
      interests: (profile.interests || []).map(i => i.toLowerCase().trim()),
      country: profile.country || 'any',
      language: profile.language || 'en',
      mode: profile.mode || 'video',
      joinedAt: Date.now()
    };

    // Check if already in queue or paired
    if (this.waitingQueue.has(socketId) || this.activePairs.has(socketId)) {
      return null;
    }

    // Try to find a match based on interests
    const match = this.findBestMatch(userProfile);

    if (match) {
      // Remove matched user from queue
      this.removeFromQueue(match.socketId);
      
      // Create the pair
      this.activePairs.set(socketId, match.socketId);
      this.activePairs.set(match.socketId, socketId);

      // Calculate match info
      const commonInterests = this.getCommonInterests(userProfile, match);
      const matchScore = this.calculateMatchScore(userProfile, match);

      return { 
        partnerId: match.socketId, 
        isInitiator: true,
        matchScore,
        commonInterests
      };
    }

    // No match found, add to queue
    this.waitingQueue.set(socketId, userProfile);
    
    // Index by interests for faster lookup
    userProfile.interests.forEach(interest => {
      if (!this.interestIndex.has(interest)) {
        this.interestIndex.set(interest, new Set());
      }
      this.interestIndex.get(interest).add(socketId);
    });

    return null;
  }

  /**
   * Find best match based on interests and preferences
   */
  findBestMatch(userProfile) {
    let bestMatch = null;
    let bestScore = -1;

    // First, try to find users with common interests
    if (userProfile.interests.length > 0) {
      const candidateIds = new Set();
      
      userProfile.interests.forEach(interest => {
        const users = this.interestIndex.get(interest);
        if (users) {
          users.forEach(id => candidateIds.add(id));
        }
      });

      for (const socketId of candidateIds) {
        const profile = this.waitingQueue.get(socketId);
        if (!profile) continue;
        if (profile.mode !== userProfile.mode) continue;

        const score = this.calculateMatchScore(userProfile, profile);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = profile;
        }
      }
    }

    // If no interest-based match, return first compatible user by wait time
    if (!bestMatch) {
      let oldestWait = Infinity;
      
      for (const [socketId, profile] of this.waitingQueue) {
        if (profile.mode !== userProfile.mode) continue;
        
        if (profile.joinedAt < oldestWait) {
          oldestWait = profile.joinedAt;
          bestMatch = profile;
        }
      }
    }

    return bestMatch;
  }

  /**
   * Calculate match score between two users (0-100)
   */
  calculateMatchScore(user1, user2) {
    let score = 50; // Base score

    // Common interests (+10 each, max 40)
    const commonInterests = this.getCommonInterests(user1, user2);
    score += Math.min(commonInterests.length * 10, 40);

    // Same country (+5)
    if (user1.country !== 'any' && user2.country !== 'any') {
      if (user1.country === user2.country) score += 5;
    }

    // Same language (+5)
    if (user1.language === user2.language) score += 5;

    return Math.min(score, 100);
  }

  /**
   * Get common interests between two users
   */
  getCommonInterests(user1, user2) {
    const set2 = new Set(user2.interests);
    return user1.interests.filter(i => set2.has(i));
  }

  /**
   * Remove user from waiting queue
   */
  removeFromQueue(socketId) {
    const profile = this.waitingQueue.get(socketId);
    if (profile) {
      // Remove from interest index
      profile.interests.forEach(interest => {
        const index = this.interestIndex.get(interest);
        if (index) {
          index.delete(socketId);
          if (index.size === 0) {
            this.interestIndex.delete(interest);
          }
        }
      });
      this.waitingQueue.delete(socketId);
    }
  }

  /**
   * Remove user completely (disconnect or skip)
   */
  removeUser(socketId) {
    this.removeFromQueue(socketId);
    this.onlineUsers.delete(socketId);

    const partnerId = this.activePairs.get(socketId);
    if (partnerId) {
      this.activePairs.delete(socketId);
      this.activePairs.delete(partnerId);
      return partnerId;
    }

    return null;
  }

  /**
   * Get partner of a user
   */
  getPartner(socketId) {
    return this.activePairs.get(socketId) || null;
  }

  /**
   * Skip current partner and find new one
   */
  skip(socketId, profile = {}) {
    const oldPartner = this.removeUser(socketId);
    this.onlineUsers.add(socketId);
    const newMatch = this.addToQueue(socketId, profile);
    return { oldPartner, newMatch };
  }

  /**
   * Track user online status
   */
  userConnected(socketId) {
    this.onlineUsers.add(socketId);
  }

  userDisconnected(socketId) {
    this.onlineUsers.delete(socketId);
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      onlineCount: this.onlineUsers.size,
      waitingCount: this.waitingQueue.size,
      activePairsCount: this.activePairs.size / 2,
      popularInterests: this.getPopularInterests()
    };
  }

  /**
   * Get top interests being searched
   */
  getPopularInterests() {
    const interests = [];
    for (const [interest, users] of this.interestIndex) {
      interests.push({ interest, count: users.size });
    }
    return interests.sort((a, b) => b.count - a.count).slice(0, 10);
  }
}

module.exports = new MatchmakingQueue();
