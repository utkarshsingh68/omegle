/**
 * Age Verification Modal - 18+ Only
 */

import { useState } from 'react';

export default function AgeVerification({ onVerify, isDark }) {
  const [birthdate, setBirthdate] = useState({ day: '', month: '', year: '' });
  const [error, setError] = useState('');
  const [agreed, setAgreed] = useState(false);

  const handleVerify = () => {
    if (!agreed) {
      setError('You must agree to the terms');
      return;
    }

    const { day, month, year } = birthdate;
    
    if (!day || !month || !year) {
      setError('Please enter your complete date of birth');
      return;
    }

    const dayNum = parseInt(day);
    const monthNum = parseInt(month);
    const yearNum = parseInt(year);

    if (dayNum < 1 || dayNum > 31 || monthNum < 1 || monthNum > 12 || yearNum < 1900 || yearNum > 2026) {
      setError('Please enter a valid date');
      return;
    }

    // Calculate age
    const today = new Date();
    const birthDate = new Date(yearNum, monthNum - 1, dayNum);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    if (age < 18) {
      setError('You must be 18 or older to use Strango');
      return;
    }

    // Age verified
    localStorage.setItem('age_verified', 'true');
    localStorage.setItem('age_verified_date', new Date().toISOString());
    onVerify();
  };

  const currentYear = new Date().getFullYear();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0, 0, 0, 0.85)' }}>
      <div className={`max-w-md w-full rounded-2xl p-8 ${isDark ? 'bg-[#1a1f2e] border border-white/10' : 'bg-white border border-slate-200'}`}>
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-3xl">
            🔞
          </div>
          <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Age Verification</h2>
          <p className={`text-sm ${isDark ? 'text-white/60' : 'text-slate-600'}`}>
            You must be 18 or older to use Strango
          </p>
        </div>

        {/* Date of Birth Input */}
        <div className="mb-6">
          <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-white/80' : 'text-slate-700'}`}>
            Enter your date of birth
          </label>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <input
                type="number"
                placeholder="DD"
                min="1"
                max="31"
                value={birthdate.day}
                onChange={(e) => setBirthdate({ ...birthdate, day: e.target.value.slice(0, 2) })}
                className={`w-full px-4 py-3 rounded-xl border-2 text-center transition-all ${
                  isDark 
                    ? 'bg-white/5 border-white/10 text-white placeholder-white/40 focus:border-blue-500' 
                    : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500'
                } outline-none`}
              />
              <span className={`text-xs mt-1 block text-center ${isDark ? 'text-white/50' : 'text-slate-500'}`}>Day</span>
            </div>
            <div>
              <input
                type="number"
                placeholder="MM"
                min="1"
                max="12"
                value={birthdate.month}
                onChange={(e) => setBirthdate({ ...birthdate, month: e.target.value.slice(0, 2) })}
                className={`w-full px-4 py-3 rounded-xl border-2 text-center transition-all ${
                  isDark 
                    ? 'bg-white/5 border-white/10 text-white placeholder-white/40 focus:border-blue-500' 
                    : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500'
                } outline-none`}
              />
              <span className={`text-xs mt-1 block text-center ${isDark ? 'text-white/50' : 'text-slate-500'}`}>Month</span>
            </div>
            <div>
              <input
                type="number"
                placeholder="YYYY"
                min="1900"
                max={currentYear}
                value={birthdate.year}
                onChange={(e) => setBirthdate({ ...birthdate, year: e.target.value.slice(0, 4) })}
                className={`w-full px-4 py-3 rounded-xl border-2 text-center transition-all ${
                  isDark 
                    ? 'bg-white/5 border-white/10 text-white placeholder-white/40 focus:border-blue-500' 
                    : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500'
                } outline-none`}
              />
              <span className={`text-xs mt-1 block text-center ${isDark ? 'text-white/50' : 'text-slate-500'}`}>Year</span>
            </div>
          </div>
        </div>

        {/* Terms Agreement */}
        <label className={`flex items-start gap-3 mb-6 cursor-pointer group ${isDark ? 'text-white/70' : 'text-slate-600'}`}>
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1 w-5 h-5 rounded border-2 accent-blue-500"
          />
          <span className="text-sm leading-relaxed">
            I confirm that I am 18 years or older and agree to use Strango responsibly. I understand this is a random chat platform.
          </span>
        </label>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-400 text-center">{error}</p>
          </div>
        )}

        {/* Verify Button */}
        <button
          onClick={handleVerify}
          className="w-full py-3.5 rounded-xl font-semibold bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 transition-all"
        >
          Verify & Continue
        </button>

        {/* Privacy Note */}
        <p className={`text-xs text-center mt-4 ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
          🔒 Your information is not stored and is only used for age verification
        </p>
      </div>
    </div>
  );
}
