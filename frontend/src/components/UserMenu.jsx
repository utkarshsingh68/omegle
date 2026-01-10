/**
 * User Menu Component
 * Features: User dropdown with profile, friends, logout
 * Uses React Portal to avoid z-index stacking issues
 */

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function UserMenu({ 
  user, 
  onLogout, 
  onOpenFriends, 
  friendRequestCount,
  onOpenAuth
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  // Calculate dropdown position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right
      });
    }
  }, [isOpen]);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        buttonRef.current && 
        !buttonRef.current.contains(e.target) &&
        menuRef.current &&
        !menuRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  if (!user) {
    return (
      <button
        onClick={onOpenAuth}
        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 
                 text-white rounded-2xl font-semibold hover:shadow-lg hover:shadow-indigo-500/25
                 transition-all duration-300 hover:scale-105"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <span>Login</span>
      </button>
    );
  }

  const dropdownContent = isOpen ? (
    <div 
      ref={menuRef}
      className="fixed w-72 rounded-2xl shadow-2xl overflow-hidden animate-scale-in
                bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700"
      style={{ 
        top: dropdownPosition.top,
        right: dropdownPosition.right,
        zIndex: 99999
      }}
    >
      {/* User Info */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 bg-gradient-to-r from-indigo-500/10 to-purple-500/10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 
                        flex items-center justify-center text-2xl shadow-md">
            {user.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-zinc-900 dark:text-white truncate">{user.displayName}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {user.isGuest ? 'Guest Account' : `@${user.username}`}
            </p>
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <div className="py-2">
        <button
          onClick={() => { onOpenFriends(); setIsOpen(false); }}
          className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <span className="text-lg">👥</span>
          <span className="text-zinc-700 dark:text-zinc-200">Friends</span>
          {friendRequestCount > 0 && (
            <span className="ml-auto px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
              {friendRequestCount}
            </span>
          )}
        </button>
        
        <button
          className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <span className="text-lg">⚙️</span>
          <span className="text-zinc-700 dark:text-zinc-200">Settings</span>
        </button>

        {user.isGuest && (
          <button
            className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <span className="text-lg">✨</span>
            <span className="text-zinc-700 dark:text-zinc-200">Create Account</span>
            <span className="ml-auto text-xs text-indigo-500">Save data</span>
          </button>
        )}
      </div>

      {/* Logout */}
      <div className="border-t border-zinc-200 dark:border-zinc-700 py-2">
        <button
          onClick={() => { onLogout(); setIsOpen(false); }}
          className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-600 dark:text-red-400"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span>Logout</span>
        </button>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center gap-2 px-3 py-2 rounded-2xl glass-card
                 hover:scale-105 transition-all duration-300"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 
                      flex items-center justify-center text-lg shadow-md">
          {user.avatar}
        </div>
        <span className="font-medium text-zinc-900 dark:text-white max-w-[100px] truncate hidden sm:block">
          {user.displayName}
        </span>
        {user.isGuest && (
          <span className="text-xs px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 rounded-lg hidden sm:block">
            Guest
          </span>
        )}
        {friendRequestCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center animate-bounce-subtle">
            {friendRequestCount}
          </span>
        )}
        <svg className={`w-4 h-4 text-zinc-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} 
             fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Render dropdown in portal to avoid z-index issues */}
      {typeof document !== 'undefined' && createPortal(dropdownContent, document.body)}
    </>
  );
}
