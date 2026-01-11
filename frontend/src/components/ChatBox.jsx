/**
 * ChatBox Component with Photo/Video Sharing
 */

import { useState, useRef, useEffect, useCallback } from 'react';

const QUICK_EMOJIS = ['👋', '😊', '😂', '❤️', '👍', '🎉', '🔥', '💯', '🤔', '😎'];
const REACTION_EMOJIS = ['❤️', '😂', '👍', '😮', '😢', '🔥'];
// No file size limit

export default function ChatBox({ 
  messages, 
  onSendMessage, 
  onTyping,
  onReaction,
  partnerTyping,
  isConnected,
  theme
}) {
  const isDark = theme === 'dark';
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

  // Custom Video Player Component
  const VideoPlayer = ({ src }) => {
    const videoRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [showControls, setShowControls] = useState(true);

    const togglePlay = (e) => {
      e.stopPropagation();
      if (videoRef.current) {
        if (isPlaying) {
          videoRef.current.pause();
        } else {
          videoRef.current.play();
        }
        setIsPlaying(!isPlaying);
      }
    };

    const handleTimeUpdate = () => {
      if (videoRef.current) {
        const percent = (videoRef.current.currentTime / videoRef.current.duration) * 100;
        setProgress(percent || 0);
      }
    };

    const handleVideoEnd = () => {
      setIsPlaying(false);
      setProgress(0);
    };

    const handleSeek = (e) => {
      e.stopPropagation();
      if (videoRef.current) {
        const rect = e.currentTarget.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        videoRef.current.currentTime = percent * videoRef.current.duration;
      }
    };

    return (
      <div 
        className="relative w-full max-w-[280px] sm:max-w-[220px] rounded-lg overflow-hidden bg-black"
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => setShowControls(!showControls)}
      >
        <video
          ref={videoRef}
          src={src}
          playsInline
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleVideoEnd}
          onContextMenu={(e) => e.preventDefault()}
          className="w-full rounded-lg"
          style={{ maxHeight: '180px', objectFit: 'contain' }}
        />
        
        {/* Custom Controls Overlay */}
        <div className={`absolute inset-0 flex flex-col justify-end transition-opacity ${showControls ? 'opacity-100' : 'opacity-0'}`}>
          {/* Play/Pause Button */}
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center text-white text-xl">
              {isPlaying ? '⏸' : '▶️'}
            </div>
          </button>
          
          {/* Progress Bar */}
          <div 
            className="h-1 bg-white/30 cursor-pointer mx-1 mb-1 rounded-full"
            onClick={handleSeek}
          >
            <div 
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    );
  };

  const renderMedia = (media) => {
    if (!media) return null;
    if (media.type === 'image') {
      return (
        <img 
          src={media.data} 
          alt={media.name || 'Shared image'} 
          className="w-full max-w-[280px] sm:max-w-[200px] rounded-lg cursor-pointer hover:opacity-90 object-cover"
          onClick={() => window.open(media.data, '_blank')}
          onContextMenu={(e) => e.preventDefault()}
        />
      );
    }
    if (media.type === 'video') {
      return <VideoPlayer src={media.data} />;
    }
    return null;
  };

  return (
    <div className={`flex flex-col h-full rounded-2xl overflow-hidden min-h-0 ${isDark ? 'bg-white/5 backdrop-blur-lg border border-white/10' : 'bg-white shadow-xl shadow-slate-200/50 border border-slate-100'}`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? 'border-white/10 bg-white/5' : 'border-slate-100 bg-slate-50/50'}`}>
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
          <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{isConnected ? 'Stranger' : 'Disconnected'}</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
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
                <span className={`inline-block px-4 py-1.5 text-sm rounded-full ${isDark ? 'bg-white/10 text-white/60' : 'bg-slate-100 text-slate-600'}`}>{msg.text}</span>
              ) : (
                <div className="relative inline-block max-w-[85%]">
                  <div className={`rounded-2xl px-4 py-2.5 text-sm ${msg.type === 'you' ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-br-md shadow-lg shadow-blue-500/20' : isDark ? 'bg-white/10 text-white rounded-bl-md' : 'bg-slate-100 text-slate-900 rounded-bl-md'}`}>
                    {msg.media && <div className="mb-2">{renderMedia(msg.media)}</div>}
                    {msg.text && <div className="whitespace-pre-wrap break-words" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{msg.text}</div>}
                    <div className={`text-[10px] mt-1.5 ${msg.type === 'you' ? 'text-white/60' : isDark ? 'text-white/40' : 'text-slate-400'}`}>
                      {formatTime(msg.timestamp)}
                    </div>
                  </div>
                  
                  {msg.reactions?.length > 0 && (
                    <div className={`flex gap-0.5 mt-1 ${msg.type === 'you' ? 'justify-end' : 'justify-start'}`}>
                      {msg.reactions.map((reaction, i) => <span key={i} className="text-sm">{reaction}</span>)}
                    </div>
                  )}
                  
                  {msg.type === 'stranger' && hoveredMessageId === msg.id && (
                    <div className={`absolute -bottom-10 left-0 flex gap-1 rounded-xl shadow-xl px-2 py-1.5 z-10 ${isDark ? 'bg-[#1a1f2e] border border-white/10' : 'bg-white border border-slate-200'}`}>
                      {REACTION_EMOJIS.map((emoji) => (
                        <button key={emoji} onClick={() => onReaction(msg.id, emoji)} className="hover:scale-125 transition-transform text-lg">{emoji}</button>
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
            <div className={`inline-block rounded-2xl rounded-bl-md px-4 py-2.5 ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${isDark ? 'text-white/50' : 'text-slate-500'}`}>typing</span>
                <div className="flex gap-1">
                  {[0, 150, 300].map((delay) => (
                    <div key={delay} className={`w-1.5 h-1.5 rounded-full animate-bounce ${isDark ? 'bg-blue-400' : 'bg-blue-500'}`} style={{ animationDelay: `${delay}ms` }} />
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
        <div className={`px-4 py-3 border-t ${isDark ? 'border-white/10 bg-white/5' : 'border-slate-100 bg-slate-50'}`}>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {QUICK_EMOJIS.map((emoji) => (
              <button key={emoji} onClick={() => insertEmoji(emoji)} className="text-2xl hover:scale-125 transition-transform flex-shrink-0">{emoji}</button>
            ))}
          </div>
        </div>
      )}

      {/* Media Preview */}
      {mediaPreview && (
        <div className={`px-4 py-3 border-t flex items-center gap-3 ${isDark ? 'border-white/10 bg-white/5' : 'border-slate-100 bg-slate-50'}`}>
          <div className="relative flex-shrink-0">
            {mediaPreview.type === 'image' ? (
              <img src={mediaPreview.data} alt="Preview" className="h-16 w-16 object-cover rounded-xl" />
            ) : (
              <video src={mediaPreview.data} className="h-16 w-16 object-cover rounded-xl" />
            )}
            <button 
              onClick={removeMediaPreview}
              className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs hover:bg-red-600 shadow-lg"
            >
              ×
            </button>
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm truncate ${isDark ? 'text-white' : 'text-slate-700'}`}>{mediaPreview.name}</p>
            <p className={`text-xs ${isDark ? 'text-white/50' : 'text-slate-500'}`}>Ready to send</p>
          </div>
        </div>
      )}

      {/* Input Area */}
      <form onSubmit={handleSubmit} className={`p-4 border-t ${isDark ? 'border-white/10 bg-white/5' : 'border-slate-100 bg-white'}`}>
        <div className="flex items-center gap-2">
          {/* Text Input */}
          <div className="flex-1 min-w-0">
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
              className={`w-full px-4 py-3 rounded-xl transition-all ${isDark ? 'bg-white/5 text-white placeholder-white/40 border border-white/10 focus:border-blue-500 focus:bg-white/10' : 'bg-slate-100 text-slate-900 placeholder-slate-400 border border-transparent focus:border-blue-500 focus:bg-white'} focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Emoji Toggle */}
            <button
              type="button"
              onClick={() => setShowEmojiPicker(prev => !prev)}
              className={`w-11 h-11 flex items-center justify-center rounded-xl transition-all ${showEmojiPicker ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg' : isDark ? 'hover:bg-white/10 text-white/60' : 'hover:bg-slate-200 text-slate-500'}`}
              title="Emoji"
            >
              😊
            </button>

            {/* Photo/Video Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`w-11 h-11 flex items-center justify-center rounded-xl transition-all ${isDark ? 'hover:bg-white/10 text-white/60' : 'hover:bg-slate-200 text-slate-500'}`}
              title="Send Photo/Video"
              disabled={!isConnected || isUploading}
            >
              📎
            </button>

            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={!isConnected || (!inputValue.trim() && !mediaPreview)}
              className="w-11 h-11 flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/25"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
              </svg>
            </button>
          </div>
        </div>
        
        {isUploading && (
          <div className={`text-xs mt-2 flex items-center gap-2 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
            <div className={`w-4 h-4 border-2 border-t-transparent rounded-full animate-spin ${isDark ? 'border-blue-400' : 'border-blue-500'}`}></div>
            Processing file...
          </div>
        )}
      </form>
    </div>
  );
}
