/**
 * Advanced ChatBox Component
 * Features: Emoji picker, reactions, export chat, keyboard shortcuts
 */

import { useState, useRef, useEffect, useCallback } from 'react';

// Common emojis for quick access
const QUICK_EMOJIS = ['👋', '😊', '😂', '❤️', '👍', '🎉', '🔥', '💯', '🤔', '😎'];
const REACTION_EMOJIS = ['❤️', '😂', '👍', '😮', '😢', '🔥'];

export default function ChatBox({ 
  messages, 
  onSendMessage, 
  onTyping,
  onReaction,
  partnerTyping,
  isConnected,
  matchInfo
}) {
  const [inputValue, setInputValue] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [hoveredMessageId, setHoveredMessageId] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, partnerTyping]);

  // Focus input on mount
  useEffect(() => {
    if (isConnected) {
      inputRef.current?.focus();
    }
  }, [isConnected]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // ESC to close emoji picker
      if (e.key === 'Escape') {
        setShowEmojiPicker(false);
      }
      // Ctrl+E for emoji picker
      if (e.ctrlKey && e.key === 'e') {
        e.preventDefault();
        setShowEmojiPicker(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle input change
  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    onTyping(true);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      onTyping(false);
    }, 1000);
  };

  // Handle submit
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (inputValue.trim() && isConnected) {
      onSendMessage(inputValue.trim());
      setInputValue('');
      onTyping(false);
      setShowEmojiPicker(false);
    }
  };

  // Insert emoji
  const insertEmoji = (emoji) => {
    setInputValue(prev => prev + emoji);
    inputRef.current?.focus();
  };

  // Export chat
  const exportChat = useCallback(() => {
    const chatContent = messages
      .map(msg => {
        const time = new Date(msg.timestamp).toLocaleTimeString();
        const sender = msg.type === 'you' ? 'You' : msg.type === 'stranger' ? 'Stranger' : 'System';
        return `[${time}] ${sender}: ${msg.text}`;
      })
      .join('\n');
    
    const blob = new Blob([chatContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [messages]);

  // Format time
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-xl border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-gray-400'}`} />
          <span className="font-medium text-gray-900 dark:text-white">
            {isConnected ? 'Stranger' : 'Disconnected'}
          </span>
          {matchInfo?.commonInterests?.length > 0 && (
            <div className="flex items-center gap-1 ml-2">
              {matchInfo.commonInterests.slice(0, 2).map((interest, i) => (
                <span key={i} className="tag text-xs">
                  {interest}
                </span>
              ))}
            </div>
          )}
        </div>
        
        {/* Export button */}
        {messages.length > 0 && (
          <button
            onClick={exportChat}
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 transition-colors"
            title="Export chat"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-12">
            <div className="text-4xl mb-3">💬</div>
            <p className="font-medium">No messages yet</p>
            <p className="text-sm mt-1">Say something to break the ice!</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={msg.id || index}
              className={`animate-slide-up ${
                msg.type === 'system' ? 'text-center' :
                msg.type === 'you' ? 'text-right' : 'text-left'
              }`}
              onMouseEnter={() => setHoveredMessageId(msg.id)}
              onMouseLeave={() => setHoveredMessageId(null)}
            >
              {msg.type === 'system' ? (
                <span className="message-system">
                  {msg.text}
                </span>
              ) : (
                <div className="relative inline-block max-w-[80%] group">
                  <div className={`message-bubble ${
                    msg.type === 'you' ? 'message-you' : 'message-stranger'
                  }`}>
                    <div className="break-words">{msg.text}</div>
                    <div className={`text-[10px] mt-1 ${
                      msg.type === 'you' ? 'text-blue-200' : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {formatTime(msg.timestamp)}
                    </div>
                  </div>
                  
                  {/* Reactions display */}
                  {msg.reactions?.length > 0 && (
                    <div className={`flex gap-0.5 mt-1 ${msg.type === 'you' ? 'justify-end' : 'justify-start'}`}>
                      {msg.reactions.map((reaction, i) => (
                        <span key={i} className="text-sm animate-bounce-subtle">{reaction}</span>
                      ))}
                    </div>
                  )}
                  
                  {/* Reaction picker (only for stranger messages) */}
                  {msg.type === 'stranger' && hoveredMessageId === msg.id && (
                    <div className="absolute -top-8 left-0 flex gap-1 bg-white dark:bg-gray-700 rounded-full shadow-lg px-2 py-1 animate-fade-in">
                      {REACTION_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => onReaction(msg.id, emoji)}
                          className="hover:scale-125 transition-transform"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
        
        {/* Typing indicator */}
        {partnerTyping && (
          <div className="text-left animate-fade-in">
            <div className="inline-block bg-gray-200 dark:bg-gray-700 rounded-2xl rounded-bl-md px-4 py-2">
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500 dark:text-gray-400">typing</span>
                <div className="flex gap-1">
                  {[0, 150, 300].map((delay) => (
                    <div
                      key={delay}
                      className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Emoji Bar */}
      {showEmojiPicker && (
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 animate-slide-up">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => insertEmoji(emoji)}
                className="text-2xl hover:scale-125 transition-transform flex-shrink-0"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-2">
          {/* Emoji Toggle */}
          <button
            type="button"
            onClick={() => setShowEmojiPicker(prev => !prev)}
            className={`p-2.5 rounded-xl transition-colors ${
              showEmojiPicker 
                ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600' 
                : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500'
            }`}
            title="Emoji (Ctrl+E)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          {/* Input */}
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder={isConnected ? "Type a message..." : "Not connected"}
            disabled={!isConnected}
            maxLength={1000}
            className="input flex-1"
          />

          {/* Send Button */}
          <button
            type="submit"
            disabled={!isConnected || !inputValue.trim()}
            className="btn btn-primary p-2.5"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        
        {/* Character count */}
        {inputValue.length > 800 && (
          <div className={`text-xs mt-1 text-right ${
            inputValue.length > 950 ? 'text-red-500' : 'text-gray-500'
          }`}>
            {inputValue.length}/1000
          </div>
        )}
      </form>
    </div>
  );
}
