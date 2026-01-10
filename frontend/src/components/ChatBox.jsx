/**
 * ChatBox Component with Photo/Video Sharing
 */

import { useState, useRef, useEffect, useCallback } from 'react';

const QUICK_EMOJIS = ['👋', '😊', '😂', '❤️', '👍', '🎉', '🔥', '💯', '🤔', '😎'];
const REACTION_EMOJIS = ['❤️', '😂', '👍', '😮', '😢', '🔥'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export default function ChatBox({ 
  messages, 
  onSendMessage, 
  onTyping,
  onReaction,
  partnerTyping,
  isConnected
}) {
  const [inputValue, setInputValue] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [hoveredMessageId, setHoveredMessageId] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, partnerTyping]);

  useEffect(() => {
    if (isConnected) inputRef.current?.focus();
  }, [isConnected]);

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    onTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => onTyping(false), 1000);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if ((inputValue.trim() || mediaPreview) && isConnected) {
      if (mediaPreview) {
        onSendMessage(inputValue.trim(), { type: mediaPreview.type, data: mediaPreview.data, name: mediaPreview.name });
        setMediaPreview(null);
      } else {
        onSendMessage(inputValue.trim());
      }
      setInputValue('');
      onTyping(false);
      setShowEmojiPicker(false);
    }
  };

  const insertEmoji = (emoji) => {
    setInputValue(prev => prev + emoji);
    inputRef.current?.focus();
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      alert('File too large. Max 5MB.');
      return;
    }

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (!isImage && !isVideo) {
      alert('Only images and videos are allowed.');
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      setMediaPreview({
        type: isImage ? 'image' : 'video',
        data: event.target.result,
        name: file.name
      });
      setIsUploading(false);
    };
    reader.onerror = () => {
      alert('Failed to read file.');
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removeMediaPreview = () => {
    setMediaPreview(null);
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMedia = (media) => {
    if (!media) return null;
    if (media.type === 'image') {
      return (
        <img 
          src={media.data} 
          alt={media.name || 'Shared image'} 
          className="max-w-[200px] max-h-[150px] rounded-lg cursor-pointer hover:opacity-90 object-cover"
          onClick={() => window.open(media.data, '_blank')}
        />
      );
    }
    if (media.type === 'video') {
      return (
        <video 
          src={media.data} 
          controls 
          className="max-w-[200px] max-h-[150px] rounded-lg"
        />
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col h-full bg-[#1a1a2e] rounded-2xl overflow-hidden border border-[#2a2a4a] min-h-0">
      {/* Header - Mobile Responsive */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 border-b border-[#2a2a4a] bg-[#16162a]">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
          <span className="font-medium text-white text-sm sm:text-base">{isConnected ? 'Stranger' : 'Disconnected'}</span>
        </div>
      </div>

      {/* Messages - Mobile Responsive */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 sm:space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8 sm:py-12">
            <div className="text-3xl sm:text-4xl mb-2 sm:mb-3">💬</div>
            <p className="font-medium text-sm sm:text-base">No messages yet</p>
            <p className="text-xs sm:text-sm mt-1">Say something to break the ice!</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={msg.id || index}
              className={`${msg.type === 'system' ? 'text-center' : msg.type === 'you' ? 'text-right' : 'text-left'}`}
              onMouseEnter={() => setHoveredMessageId(msg.id)}
              onMouseLeave={() => setHoveredMessageId(null)}
            >
              {msg.type === 'system' ? (
                <span className="inline-block px-3 py-1 bg-[#2a2a4a] text-gray-400 text-sm rounded-full">{msg.text}</span>
              ) : (
                <div className="relative inline-block max-w-[85%] sm:max-w-[80%]">
                  <div className={`rounded-2xl px-3 sm:px-4 py-2 text-sm sm:text-base ${msg.type === 'you' ? 'bg-purple-600 text-white rounded-br-md' : 'bg-[#2a2a4a] text-white rounded-bl-md'}`}>
                    {msg.media && <div className="mb-2">{renderMedia(msg.media)}</div>}
                    {msg.text && <div className="whitespace-pre-wrap break-words" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{msg.text}</div>}
                    <div className={`text-[9px] sm:text-[10px] mt-1 ${msg.type === 'you' ? 'text-purple-200' : 'text-gray-500'}`}>
                      {formatTime(msg.timestamp)}
                    </div>
                  </div>
                  
                  {msg.reactions?.length > 0 && (
                    <div className={`flex gap-0.5 mt-1 ${msg.type === 'you' ? 'justify-end' : 'justify-start'}`}>
                      {msg.reactions.map((reaction, i) => <span key={i} className="text-sm">{reaction}</span>)}
                    </div>
                  )}
                  
                  {msg.type === 'stranger' && hoveredMessageId === msg.id && (
                    <div className="absolute -top-8 left-0 flex gap-1 bg-[#16162a] rounded-full shadow-lg px-2 py-1 border border-[#2a2a4a]">
                      {REACTION_EMOJIS.map((emoji) => (
                        <button key={emoji} onClick={() => onReaction(msg.id, emoji)} className="hover:scale-125 transition-transform">{emoji}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
        
        {partnerTyping && (
          <div className="text-left">
            <div className="inline-block bg-[#2a2a4a] rounded-2xl rounded-bl-md px-4 py-2">
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-400">typing</span>
                <div className="flex gap-1">
                  {[0, 150, 300].map((delay) => (
                    <div key={delay} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Emoji Bar */}
      {showEmojiPicker && (
        <div className="px-4 py-2 border-t border-[#2a2a4a] bg-[#16162a]">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {QUICK_EMOJIS.map((emoji) => (
              <button key={emoji} onClick={() => insertEmoji(emoji)} className="text-2xl hover:scale-125 transition-transform flex-shrink-0">{emoji}</button>
            ))}
          </div>
        </div>
      )}

      {/* Media Preview */}
      {mediaPreview && (
        <div className="px-3 py-2 border-t border-[#2a2a4a] bg-[#16162a] flex items-center gap-3">
          <div className="relative flex-shrink-0">
            {mediaPreview.type === 'image' ? (
              <img src={mediaPreview.data} alt="Preview" className="h-16 w-16 object-cover rounded-lg" />
            ) : (
              <video src={mediaPreview.data} className="h-16 w-16 object-cover rounded-lg" />
            )}
            <button 
              onClick={removeMediaPreview}
              className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs hover:bg-red-600"
            >
              ×
            </button>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-300 truncate">{mediaPreview.name}</p>
            <p className="text-xs text-gray-500">Ready to send</p>
          </div>
        </div>
      )}

      {/* Input Area - Mobile Responsive */}
      <form onSubmit={handleSubmit} className="p-2 sm:p-3 border-t border-[#2a2a4a] bg-[#16162a]">
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Emoji Toggle */}
          <button
            type="button"
            onClick={() => setShowEmojiPicker(prev => !prev)}
            className={`p-2 sm:p-2.5 rounded-xl transition-colors text-sm sm:text-base ${showEmojiPicker ? 'bg-purple-600 text-white' : 'hover:bg-[#2a2a4a] text-gray-400'}`}
            title="Emoji"
          >
            😊
          </button>

          {/* Photo Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 sm:p-2.5 rounded-xl hover:bg-[#2a2a4a] text-gray-400 transition-colors text-sm sm:text-base"
            title="Send Photo"
            disabled={!isConnected || isUploading}
          >
            📷
          </button>

          {/* Video Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 rounded-xl hover:bg-[#2a2a4a] text-gray-400 transition-colors"
            title="Send Video"
            disabled={!isConnected || isUploading}
          >
            🎥
          </button>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Text Input */}
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
            className="flex-1 px-4 py-2.5 bg-[#2a2a4a] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />

          {/* Send Button */}
          <button
            type="submit"
            disabled={!isConnected || (!inputValue.trim() && !mediaPreview)}
            className="p-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            ➤
          </button>
        </div>
        
        {isUploading && (
          <div className="text-xs text-purple-400 mt-2 flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
            Processing file...
          </div>
        )}
      </form>
    </div>
  );
}
