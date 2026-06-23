import { useMemo, useState } from 'react'
import { ChevronRight, ChevronDown, FileCode, FolderOpen } from 'lucide-react'

function buildTree(files) {
  const root = { name: '', children: new Map(), file: null }

  for (const f of files) {
    const parts = (f.file_path || '').split('/').filter(Boolean)
    let node = root
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isFile = i === parts.length - 1
      if (!node.children.has(part)) {
        node.children.set(part, { name: part, children: new Map(), file: null })
      }
      node = node.children.get(part)
      if (isFile) node.file = f
    }
  }

  return root
}

function TreeNode({
  node,
  depth,
  activeFile,
  onSelect,
  defaultExpanded,
  readOnly,
  onDelete,
  onRename,
}) {
  const isFile = node.file && node.children.size === 0
  const [expanded, setExpanded] = useState(defaultExpanded || depth < 2)
  const [menu, setMenu] = useState(null)

  const handleContextMenu = (e, file) => {
    if (readOnly || !file) return
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY, file })
  }

  if (isFile) {
    const f = node.file
    const active = activeFile?.file_path === f.file_path
    return (
      <>
        <div
          onClick={() => onSelect(f)}
          onContextMenu={(e) => handleContextMenu(e, f)}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          className={`flex items-center gap-2 py-1.5 pr-2 rounded cursor-pointer text-xs font-mono transition-colors ${
            active
              ? 'bg-stellar-accent/15 text-stellar-accent border border-stellar-accent/20'
              : 'text-stellar-muted hover:text-stellar-text hover:bg-stellar-surface'
          }`}
        >
          <FileCode className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">{node.name}</span>
        </div>
        {menu?.file?.file_path === f.file_path && (
          <div
            className="fixed z-50 bg-stellar-card border border-stellar-border rounded-md shadow-lg py-1 min-w-[120px]"
            style={{ top: menu.y, left: menu.x }}
            onMouseLeave={() => setMenu(null)}
          >
            <button
              type="button"
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-stellar-surface"
              onClick={() => {
                setMenu(null)
                onRename?.(f)
              }}
            >
              Rename
            </button>
            <button
              type="button"
              className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-stellar-surface"
              onClick={() => {
                setMenu(null)
                onDelete?.(f)
              }}
            >
              Delete
            </button>
          </div>
        )}
      </>
    )
  }

  const children = [...node.children.values()].sort((a, b) => {
    const aDir = a.children.size > 0 || !a.file
    const bDir = b.children.size > 0 || !b.file
    if (aDir !== bDir) return aDir ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return (
    <div>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        className="flex items-center gap-1.5 py-1.5 pr-2 cursor-pointer text-stellar-muted hover:text-stellar-text rounded"
      >
        {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        <FolderOpen className="w-3.5 h-3.5 text-stellar-accent flex-shrink-0" />
        <span className="text-xs font-semibold truncate">{node.name || 'project'}</span>
      </div>
      {expanded && children.map((child) => (
        <TreeNode
          key={child.name + (child.file?.file_path || '')}
          node={child}
          depth={depth + 1}
          activeFile={activeFile}
          onSelect={onSelect}
          readOnly={readOnly}
          onDelete={onDelete}
          onRename={onRename}
        />
      ))}
    </div>
  )
}

export default function NestedFileTree({
  files,
  activeFile,
  onSelect,
  readOnly,
  onDelete,
  onRename,
}) {
  const tree = useMemo(() => buildTree(files), [files])
  const displayFiles = files.length > 0 ? files : [{ file_path: 'src/lib.rs', content: '' }]
  const root = displayFiles.length === 1 && !displayFiles[0].id
    ? buildTree(displayFiles)
    : tree

  if (!root.name && root.children.size > 0) {
    const children = [...root.children.values()].sort((a, b) => {
      const aDir = a.children.size > 0 || !a.file
      const bDir = b.children.size > 0 || !b.file
      if (aDir !== bDir) return aDir ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    return (
      <div className="h-full overflow-auto p-2" onClick={() => {}}>
        {children.map((child) => (
          <TreeNode
            key={child.name + (child.file?.file_path || '')}
            node={child}
            depth={0}
            activeFile={activeFile}
            onSelect={onSelect}
            defaultExpanded
            readOnly={readOnly}
            onDelete={onDelete}
            onRename={onRename}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto p-2">
      <TreeNode
        node={root}
        depth={0}
        activeFile={activeFile}
        onSelect={onSelect}
        defaultExpanded
        readOnly={readOnly}
        onDelete={onDelete}
        onRename={onRename}
      />
    </div>
  )
}
