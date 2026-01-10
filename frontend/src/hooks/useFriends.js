/**
 * Friends Hook - Handles friend system via socket
 */

import { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function useFriends(socket, sessionToken) {
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [notification, setNotification] = useState(null);

  // Fetch friends list via API
  const fetchFriends = useCallback(async () => {
    if (!sessionToken) return;

    try {
      const response = await fetch(`${API_URL}/api/friends`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });
      const data = await response.json();
      if (data.success) {
        setFriends(data.friends);
      }
    } catch (err) {
      console.error('Failed to fetch friends:', err);
    }
  }, [sessionToken]);

  // Fetch friend requests via API
  const fetchRequests = useCallback(async () => {
    if (!sessionToken) return;

    try {
      const response = await fetch(`${API_URL}/api/friends/requests`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });
      const data = await response.json();
      if (data.success) {
        setFriendRequests(data.received);
        setSentRequests(data.sent);
      }
    } catch (err) {
      console.error('Failed to fetch friend requests:', err);
    }
  }, [sessionToken]);

  // Initialize on mount
  useEffect(() => {
    if (sessionToken) {
      fetchFriends();
      fetchRequests();
    } else {
      setFriends([]);
      setFriendRequests([]);
      setSentRequests([]);
    }
  }, [sessionToken, fetchFriends, fetchRequests]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    // Friend came online
    socket.on('friend-online', (data) => {
      setFriends(prev => prev.map(f => 
        f.id === data.friendId ? { ...f, isOnline: true } : f
      ));
      setNotification({ type: 'online', message: `${data.displayName} is now online` });
      setTimeout(() => setNotification(null), 3000);
    });

    // Friend went offline
    socket.on('friend-offline', (data) => {
      setFriends(prev => prev.map(f => 
        f.id === data.friendId ? { ...f, isOnline: false } : f
      ));
    });

    // New friend request received
    socket.on('friend-request-received', (data) => {
      setFriendRequests(prev => [...prev, {
        from: data.from,
        fromName: data.fromName,
        fromAvatar: data.fromAvatar,
        timestamp: Date.now()
      }]);
      setNotification({ type: 'request', message: `${data.fromName} wants to be your friend!` });
      setTimeout(() => setNotification(null), 5000);
    });

    // Friend request was sent successfully
    socket.on('friend-request-sent', (data) => {
      if (data.request) {
        setSentRequests(prev => [...prev, data.request]);
      }
      setNotification({ type: 'success', message: data.message || 'Friend request sent!' });
      setTimeout(() => setNotification(null), 3000);
    });

    // Friend request accepted
    socket.on('friend-request-accepted', (data) => {
      if (data.friend) {
        setFriends(prev => [...prev, data.friend]);
      }
      fetchRequests(); // Refresh requests list
      setNotification({ type: 'success', message: 'Friend request accepted!' });
      setTimeout(() => setNotification(null), 3000);
    });

    // Someone accepted our request
    socket.on('friend-added', (data) => {
      if (data.friend) {
        setFriends(prev => [...prev, data.friend]);
        setSentRequests(prev => prev.filter(r => r.to !== data.friend.id));
      }
      setNotification({ type: 'success', message: `${data.friend?.displayName} accepted your friend request!` });
      setTimeout(() => setNotification(null), 3000);
    });

    // Friend was removed
    socket.on('friend-removed', (data) => {
      setFriends(prev => prev.filter(f => f.id !== data.friendId));
    });

    // Error
    socket.on('friend-error', (data) => {
      setNotification({ type: 'error', message: data.error || 'An error occurred' });
      setTimeout(() => setNotification(null), 4000);
    });

    // Get friends list response
    socket.on('friends-list', (data) => {
      setFriends(data.friends || []);
      setFriendRequests(data.requests || []);
    });

    return () => {
      socket.off('friend-online');
      socket.off('friend-offline');
      socket.off('friend-request-received');
      socket.off('friend-request-sent');
      socket.off('friend-request-accepted');
      socket.off('friend-added');
      socket.off('friend-removed');
      socket.off('friend-error');
      socket.off('friends-list');
    };
  }, [socket, fetchRequests]);

  // Send friend request to current partner
  const sendFriendRequest = useCallback(() => {
    if (socket) {
      socket.emit('send-friend-request', {});
    }
  }, [socket]);

  // Accept friend request
  const acceptRequest = useCallback((fromUserId) => {
    if (socket) {
      socket.emit('accept-friend-request', { fromUserId });
      setFriendRequests(prev => prev.filter(r => r.from !== fromUserId));
    }
  }, [socket]);

  // Decline friend request
  const declineRequest = useCallback((fromUserId) => {
    if (socket) {
      socket.emit('decline-friend-request', { fromUserId });
      setFriendRequests(prev => prev.filter(r => r.from !== fromUserId));
    }
  }, [socket]);

  // Remove friend
  const removeFriend = useCallback((friendId) => {
    if (socket) {
      socket.emit('remove-friend', { friendId });
    }
  }, [socket]);

  // Refresh friends
  const refreshFriends = useCallback(() => {
    if (socket) {
      socket.emit('get-friends');
    }
    fetchFriends();
    fetchRequests();
  }, [socket, fetchFriends, fetchRequests]);

  return {
    friends,
    friendRequests,
    sentRequests,
    notification,
    sendFriendRequest,
    acceptRequest,
    declineRequest,
    removeFriend,
    refreshFriends,
    onlineFriendsCount: friends.filter(f => f.isOnline).length
  };
}
