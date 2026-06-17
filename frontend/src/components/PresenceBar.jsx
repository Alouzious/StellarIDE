import { Users } from 'lucide-react'

export default function PresenceBar({ presence, connectionStatus }) {
  if (!presence?.length) {
    return (
      <div className="flex items-center gap-2 px-3 py-1 border-b border-stellar-border bg-stellar-card/60 flex-shrink-0">
        <Users className="w-3.5 h-3.5 text-stellar-muted" />
        <span className="text-xs text-stellar-muted">
          {connectionStatus === 'connected' ? 'You are editing alone' : 'Connecting...'}
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1 border-b border-stellar-border bg-stellar-card/60 flex-shrink-0 overflow-x-auto">
      <Users className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
      <span className="text-xs text-stellar-muted flex-shrink-0">Live:</span>
      {presence.map((u) => (
        <div
          key={u.user_id}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-stellar-border bg-stellar-surface flex-shrink-0"
          title={`${u.name} (${u.role})`}
        >
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: u.color || '#4ECDC4' }}
          />
          <span className="text-xs text-stellar-text font-medium max-w-[80px] truncate">
            {u.name}
          </span>
          {u.role === 'viewer' && (
            <span className="text-[10px] text-stellar-muted uppercase">view</span>
          )}
        </div>
      ))}
      <span className={`text-[10px] ml-auto flex-shrink-0 ${
        connectionStatus === 'connected' ? 'text-green-400' : 'text-yellow-400'
      }`}>
        {connectionStatus === 'connected' ? '● synced' : '○ connecting'}
      </span>
    </div>
  )
}
