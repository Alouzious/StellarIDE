import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Search, X } from 'lucide-react'
import api from '../services/api'

function highlightMatch(text, start, end) {
  if (start == null || end == null) return text
  return (
    <>
      {text.slice(0, start)}
      <mark className="bg-stellar-accent/30 text-stellar-heading rounded px-0.5">{text.slice(start, end)}</mark>
      {text.slice(end)}
    </>
  )
}

export default function SearchPanel({
  projectId,
  onClose,
  onOpenMatch,
  onReplaceAll,
}) {
  const [query, setQuery] = useState('')
  const [replace, setReplace] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [useRegex, setUseRegex] = useState(false)
  const [results, setResults] = useState([])
  const [totalMatches, setTotalMatches] = useState(0)
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const debounceRef = useRef(null)
  const inputRef = useRef(null)

  const flatMatches = results.flatMap((file) =>
    file.matches.map((m) => ({ ...m, file_path: file.file_path }))
  )

  const runSearch = useCallback(async (q) => {
    if (!projectId || !q.trim()) {
      setResults([])
      setTotalMatches(0)
      return
    }
    setLoading(true)
    try {
      const { data } = await api.get(`/projects/${projectId}/search`, {
        params: {
          q: q.trim(),
          case_sensitive: caseSensitive,
          whole_word: wholeWord,
          regex: useRegex,
        },
      })
      setResults(data.results || [])
      setTotalMatches(data.total_matches || 0)
      setSelectedIndex(0)
    } catch {
      setResults([])
      setTotalMatches(0)
    } finally {
      setLoading(false)
    }
  }, [projectId, caseSensitive, wholeWord, useRegex])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(query), 300)
    return () => clearTimeout(debounceRef.current)
  }, [query, runSearch])

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose?.()
      return
    }
    if (e.key === 'Enter' && flatMatches.length) {
      e.preventDefault()
      const match = flatMatches[selectedIndex % flatMatches.length]
      onOpenMatch?.(match)
      setSelectedIndex((i) => (i + 1) % flatMatches.length)
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, flatMatches.length - 1))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    }
  }

  const handleReplaceOne = async () => {
    if (!query.trim() || !flatMatches.length) return
    const match = flatMatches[selectedIndex]
    await onReplaceAll?.({
      query,
      replace,
      caseSensitive,
      wholeWord,
      useRegex,
      matches: [match],
    })
    runSearch(query)
  }

  const handleReplaceAll = async () => {
    if (!query.trim() || !flatMatches.length) return
    await onReplaceAll?.({
      query,
      replace,
      caseSensitive,
      wholeWord,
      useRegex,
      matches: flatMatches,
    })
    runSearch(query)
  }

  let matchCounter = 0

  return (
    <div className="flex flex-col h-full bg-stellar-card" onKeyDown={handleKeyDown}>
      <div className="p-3 border-b border-stellar-border space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-stellar-heading uppercase tracking-wide">Search</span>
          <button type="button" onClick={onClose} className="text-stellar-muted hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <Search className="w-3.5 h-3.5 text-stellar-muted flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search across files"
            className="flex-1 bg-transparent text-xs text-stellar-text placeholder:text-stellar-border focus:outline-none"
          />
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-stellar-muted" />}
        </div>
        <div className="flex items-center gap-1">
          <input
            value={replace}
            onChange={(e) => setReplace(e.target.value)}
            placeholder="Replace"
            className="flex-1 input-field py-1 text-xs"
          />
          <button
            type="button"
            onClick={handleReplaceOne}
            disabled={!query.trim() || !flatMatches.length}
            className="px-2 py-1 text-[10px] font-semibold rounded border border-stellar-border text-stellar-muted hover:text-white disabled:opacity-40"
          >
            Replace
          </button>
          <button
            type="button"
            onClick={handleReplaceAll}
            disabled={!query.trim() || !flatMatches.length}
            className="px-2 py-1 text-[10px] font-semibold rounded border border-stellar-border text-stellar-muted hover:text-white disabled:opacity-40"
          >
            Replace All
          </button>
        </div>
        <div className="flex items-center gap-1">
          {[
            { label: 'Aa', active: caseSensitive, toggle: () => setCaseSensitive((v) => !v), title: 'Case sensitive' },
            { label: 'W', active: wholeWord, toggle: () => setWholeWord((v) => !v), title: 'Whole word' },
            { label: '.*', active: useRegex, toggle: () => setUseRegex((v) => !v), title: 'Regex' },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              title={opt.title}
              onClick={opt.toggle}
              className={`px-2 py-0.5 text-[10px] font-mono rounded border transition-colors ${
                opt.active
                  ? 'border-stellar-accent bg-stellar-accent/15 text-stellar-accent'
                  : 'border-stellar-border text-stellar-muted hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
          {totalMatches > 0 && (
            <span className="ml-auto text-[10px] text-stellar-muted">
              {flatMatches.length ? `${selectedIndex + 1} of ${totalMatches} matches` : `${totalMatches} matches`}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {!query.trim() && (
          <p className="text-xs text-stellar-border px-2 py-4">Type to search all project files</p>
        )}
        {query.trim() && !loading && totalMatches === 0 && (
          <p className="text-xs text-stellar-border px-2 py-4">No results for &apos;{query}&apos;</p>
        )}
        {results.map((file) => (
          <div key={file.file_path} className="mb-3">
            <p className="text-[11px] font-semibold text-stellar-accent px-2 py-1 truncate">
              {file.file_path} ({file.matches.length})
            </p>
            <ul className="space-y-0.5">
              {file.matches.map((match) => {
                const idx = matchCounter++
                const selected = idx === selectedIndex
                return (
                  <li key={`${file.file_path}-${match.line_number}-${match.match_start}`}>
                    <button
                      type="button"
                      onClick={() => onOpenMatch?.({ ...match, file_path: file.file_path })}
                      className={`w-full text-left px-2 py-1.5 rounded text-[11px] font-mono transition-colors ${
                        selected ? 'bg-stellar-accent/15 text-stellar-text' : 'text-stellar-muted hover:bg-stellar-surface'
                      }`}
                    >
                      <span className="text-stellar-border mr-2">{match.line_number}</span>
                      {highlightMatch(match.line_content.trim(), match.match_start, match.match_end)}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
