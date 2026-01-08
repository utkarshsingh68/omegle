/**
 * Interest Tags Input Component
 * For adding interests to find matching partners
 */

import { useState, useRef, useEffect } from 'react';

const SUGGESTED_INTERESTS = [
  'Music', 'Gaming', 'Movies', 'Sports', 'Travel', 'Art', 
  'Technology', 'Books', 'Fitness', 'Cooking', 'Photography',
  'Anime', 'Fashion', 'Science', 'Politics', 'Memes'
];

export default function InterestInput({ interests, onChange, maxInterests = 5 }) {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Add interest
  const addInterest = (interest) => {
    const normalized = interest.trim().toLowerCase();
    if (normalized && !interests.includes(normalized) && interests.length < maxInterests) {
      onChange([...interests, normalized]);
      setInputValue('');
    }
  };

  // Remove interest
  const removeInterest = (interest) => {
    onChange(interests.filter(i => i !== interest));
  };

  // Handle input
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addInterest(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && interests.length > 0) {
      removeInterest(interests[interests.length - 1]);
    }
  };

  // Filter suggestions
  const filteredSuggestions = SUGGESTED_INTERESTS.filter(
    s => !interests.includes(s.toLowerCase()) && 
         s.toLowerCase().includes(inputValue.toLowerCase())
  );

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Interests <span className="text-gray-500">({interests.length}/{maxInterests})</span>
      </label>
      
      <div className="interest-input-container focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
        {/* Tags */}
        {interests.map((interest) => (
          <span
            key={interest}
            className="tag tag-removable cursor-pointer"
            onClick={() => removeInterest(interest)}
          >
            {interest}
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </span>
        ))}
        
        {/* Input */}
        {interests.length < maxInterests && (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={handleKeyDown}
            placeholder={interests.length === 0 ? "Add interests..." : ""}
            className="flex-1 min-w-[100px] bg-transparent border-none outline-none 
                     text-gray-900 dark:text-white placeholder-gray-500 text-sm"
          />
        )}
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 
                      dark:border-gray-700 rounded-xl shadow-lg max-h-48 overflow-y-auto animate-slide-up">
          {filteredSuggestions.slice(0, 8).map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => {
                addInterest(suggestion);
                setShowSuggestions(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300
                       hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      <p className="mt-1 text-xs text-gray-500">
        Press Enter or comma to add. Click tag to remove.
      </p>
    </div>
  );
}
