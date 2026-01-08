/**
 * Advanced Moderation System
 * Features: Rate limiting, spam detection, profanity filter, reports, bans
 */

// Common profanity words (basic list - extend for production)
const PROFANITY_LIST = [
  // Add actual words in production
];

// Spam patterns
const SPAM_PATTERNS = [
  /(.)\1{10,}/,           // Repeated characters
  /(.)(.)\1\2{5,}/,       // Repeated patterns
  /https?:\/\/[^\s]+/gi,  // URLs
  /\b\d{10,}\b/,          // Long numbers (phone numbers)
  /[A-Z]{10,}/,           // All caps spam
];

class ModerationSystem {
  constructor() {
    // Rate limiting: Map<socketId, { messageCount, lastReset, warnings }>
    this.rateLimits = new Map();
    
    // Reported users: Map<socketId, { count, reasons, reporters }>
    this.reports = new Map();
    
    // Banned IPs
    this.bannedIPs = new Set();
    
    // Banned fingerprints (for more persistent bans)
    this.bannedFingerprints = new Set();
    
    // Temporary mutes: Map<socketId, unmuteTime>
    this.mutes = new Map();
    
    // Message history for spam detection: Map<socketId, messages[]>
    this.messageHistory = new Map();
    
    // Configuration
    this.config = {
      maxMessagesPerMinute: 30,
      maxMessagesPerSecond: 3,
      maxReportsBeforeBan: 3,
      messageMaxLength: 1000,
      rateLimitWindowMs: 60000,
      muteTimerMs: 300000,          // 5 minute mute
      warningsBeforeMute: 3,
      duplicateMessageLimit: 3,      // Same message 3 times = spam
      minMessageInterval: 200,       // 200ms between messages
    };

    // Stats
    this.stats = {
      totalMessagesBlocked: 0,
      totalReports: 0,
      totalBans: 0,
      totalMutes: 0
    };
  }

  /**
   * Check if user is rate limited
   */
  isRateLimited(socketId) {
    const now = Date.now();
    let userLimit = this.rateLimits.get(socketId);

    if (!userLimit) {
      userLimit = { 
        messageCount: 0, 
        lastReset: now, 
        lastMessage: 0,
        warnings: 0,
        recentMessages: []
      };
      this.rateLimits.set(socketId, userLimit);
    }

    // Reset window if expired
    if (now - userLimit.lastReset > this.config.rateLimitWindowMs) {
      userLimit.messageCount = 0;
      userLimit.lastReset = now;
      userLimit.recentMessages = [];
    }

    // Check minimum interval between messages
    if (now - userLimit.lastMessage < this.config.minMessageInterval) {
      return { limited: true, reason: 'Too fast! Slow down.' };
    }

    // Check per-minute limit
    if (userLimit.messageCount >= this.config.maxMessagesPerMinute) {
      return { limited: true, reason: 'Rate limit reached. Wait a moment.' };
    }

    // Update counters
    userLimit.messageCount++;
    userLimit.lastMessage = now;

    return { limited: false };
  }

  /**
   * Check if user is muted
   */
  isMuted(socketId) {
    const unmuteTime = this.mutes.get(socketId);
    if (unmuteTime) {
      if (Date.now() < unmuteTime) {
        const remaining = Math.ceil((unmuteTime - Date.now()) / 1000);
        return { muted: true, remaining };
      }
      this.mutes.delete(socketId);
    }
    return { muted: false };
  }

  /**
   * Mute a user temporarily
   */
  muteUser(socketId, durationMs = this.config.muteTimerMs) {
    this.mutes.set(socketId, Date.now() + durationMs);
    this.stats.totalMutes++;
  }

  /**
   * Validate and sanitize message content
   */
  validateMessage(socketId, message) {
    if (!message || typeof message !== 'string') {
      return { valid: false, reason: 'Invalid message format' };
    }

    const trimmed = message.trim();

    if (trimmed.length === 0) {
      return { valid: false, reason: 'Empty message' };
    }

    if (trimmed.length > this.config.messageMaxLength) {
      return { valid: false, reason: `Message too long (max ${this.config.messageMaxLength} chars)` };
    }

    // Check for spam patterns
    for (const pattern of SPAM_PATTERNS) {
      if (pattern.test(trimmed)) {
        this.addWarning(socketId);
        this.stats.totalMessagesBlocked++;
        return { valid: false, reason: 'Message flagged as spam' };
      }
    }

    // Check for duplicate messages
    const history = this.messageHistory.get(socketId) || [];
    const duplicates = history.filter(m => m.text === trimmed).length;
    
    if (duplicates >= this.config.duplicateMessageLimit) {
      this.addWarning(socketId);
      return { valid: false, reason: 'Please stop repeating the same message' };
    }

    // Add to history
    history.push({ text: trimmed, time: Date.now() });
    if (history.length > 10) history.shift();
    this.messageHistory.set(socketId, history);

    // Check profanity (optional - warn but don't block)
    const hasProfanity = this.checkProfanity(trimmed);
    
    return { 
      valid: true, 
      sanitized: this.sanitize(trimmed),
      warning: hasProfanity ? 'Please keep the conversation respectful' : null
    };
  }

  /**
   * Check for profanity
   */
  checkProfanity(message) {
    const lower = message.toLowerCase();
    return PROFANITY_LIST.some(word => lower.includes(word));
  }

  /**
   * Sanitize message (basic XSS prevention)
   */
  sanitize(message) {
    return message
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Add warning to user
   */
  addWarning(socketId) {
    const userLimit = this.rateLimits.get(socketId);
    if (userLimit) {
      userLimit.warnings++;
      if (userLimit.warnings >= this.config.warningsBeforeMute) {
        this.muteUser(socketId);
        userLimit.warnings = 0;
        return { action: 'muted', duration: this.config.muteTimerMs / 1000 };
      }
    }
    return { action: 'warned' };
  }

  /**
   * Report a user
   */
  reportUser(reportedSocketId, reporterSocketId, reason = 'unspecified') {
    let report = this.reports.get(reportedSocketId);
    
    if (!report) {
      report = { count: 0, reasons: [], reporters: new Set() };
      this.reports.set(reportedSocketId, report);
    }

    // Prevent duplicate reports from same user
    if (report.reporters.has(reporterSocketId)) {
      return { success: false, message: 'Already reported this user' };
    }

    report.count++;
    report.reasons.push({ reason, time: Date.now() });
    report.reporters.add(reporterSocketId);
    this.stats.totalReports++;

    console.log(`⚠️ User ${reportedSocketId} reported. Count: ${report.count}. Reason: ${reason}`);

    // Auto-ban if threshold reached
    if (report.count >= this.config.maxReportsBeforeBan) {
      return { success: true, shouldBan: true, message: 'User will be banned' };
    }

    return { success: true, shouldBan: false, message: 'Report submitted' };
  }

  /**
   * Ban an IP address
   */
  banIP(ip, reason = 'reports') {
    this.bannedIPs.add(ip);
    this.stats.totalBans++;
    console.log(`🚫 IP ${ip} banned. Reason: ${reason}`);
  }

  /**
   * Ban a fingerprint (browser fingerprint for persistent bans)
   */
  banFingerprint(fingerprint) {
    this.bannedFingerprints.add(fingerprint);
  }

  /**
   * Check if IP is banned
   */
  isBanned(ip, fingerprint = null) {
    if (this.bannedIPs.has(ip)) return true;
    if (fingerprint && this.bannedFingerprints.has(fingerprint)) return true;
    return false;
  }

  /**
   * Clean up user data on disconnect
   */
  cleanupUser(socketId) {
    this.rateLimits.delete(socketId);
    this.messageHistory.delete(socketId);
    this.mutes.delete(socketId);
  }

  /**
   * Get moderation stats
   */
  getStats() {
    return {
      activeRateLimits: this.rateLimits.size,
      activeMutes: this.mutes.size,
      totalReports: this.stats.totalReports,
      totalBans: this.stats.totalBans,
      totalMessagesBlocked: this.stats.totalMessagesBlocked,
      bannedIPs: this.bannedIPs.size
    };
  }
}

module.exports = new ModerationSystem();
