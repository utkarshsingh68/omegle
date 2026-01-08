/**
 * Stats Bar Component
 * Shows online users, people chatting, and waiting
 */

export default function StatsBar({ stats, latency }) {
  return (
    <div className="stats-bar">
      <div className="stat-item">
        <div className="stat-dot stat-dot-green animate-pulse" />
        <span className="text-gray-700 dark:text-gray-300">
          <strong>{stats.online || 0}</strong> online
        </span>
      </div>
      
      <div className="stat-item">
        <div className="stat-dot stat-dot-blue" />
        <span className="text-gray-700 dark:text-gray-300">
          <strong>{stats.chatting || 0}</strong> chatting
        </span>
      </div>
      
      <div className="stat-item">
        <div className="stat-dot stat-dot-yellow" />
        <span className="text-gray-700 dark:text-gray-300">
          <strong>{stats.waiting || 0}</strong> waiting
        </span>
      </div>
      
      {latency > 0 && (
        <div className={`stat-item ml-auto ${
          latency < 100 ? 'text-emerald-600' :
          latency < 300 ? 'text-yellow-600' : 'text-red-600'
        }`}>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span>{latency}ms</span>
        </div>
      )}
    </div>
  );
}
