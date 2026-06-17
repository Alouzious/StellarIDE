import { useEffect, useRef } from 'react'
import Editor from '@monaco-editor/react'
import { MonacoBinding } from 'y-monaco'
import { createCollabSession } from '../features/collab/collabProvider'
import { getWsBaseUrl } from '../../services/api'

export default function CollabEditor({
  projectId,
  filePath,
  token,
  userId,
  userName,
  userColor,
  initialContent,
  language,
  readOnly,
  onContentChange,
  onSaveDebounced,
}) {
  const containerRef = useRef(null)
  const sessionRef = useRef(null)
  const bindingRef = useRef(null)
  const editorRef = useRef(null)
  const saveTimerRef = useRef(null)

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      bindingRef.current?.destroy()
      sessionRef.current?.provider?.destroy()
      sessionRef.current?.ydoc?.destroy()
      sessionRef.current = null
      bindingRef.current = null
    }
  }, [])

  useEffect(() => {
    bindingRef.current?.destroy()
    sessionRef.current?.provider?.destroy()
    sessionRef.current?.ydoc?.destroy()
    bindingRef.current = null
    sessionRef.current = null

    if (!projectId || !filePath || !token || !userId || readOnly === undefined) return

    const wsUrl = `${getWsBaseUrl()}/collab/${projectId}?token=${encodeURIComponent(token)}&file=${encodeURIComponent(filePath)}`

    const session = createCollabSession({
      url: wsUrl,
      userId,
      userName,
      userColor,
      initialText: initialContent || '',
    })
    sessionRef.current = session

    if (editorRef.current) {
      attachBinding(editorRef.current, session, readOnly)
    }

    const textObserver = () => {
      const content = session.ytext.toString()
      onContentChange?.(content)
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        onSaveDebounced?.(content)
      }, 1500)
    }
    session.ytext.observe(textObserver)

    return () => {
      session.ytext.unobserve(textObserver)
      bindingRef.current?.destroy()
      session.provider?.destroy()
      session.ydoc?.destroy()
      bindingRef.current = null
      sessionRef.current = null
    }
  }, [projectId, filePath, token, userId, readOnly])

  const attachBinding = (editor, session, isReadOnly) => {
    bindingRef.current?.destroy()
    editor.updateOptions({ readOnly: isReadOnly })
    bindingRef.current = new MonacoBinding(
      session.ytext,
      editor.getModel(),
      new Set([editor]),
      session.awareness
    )
  }

  const handleMount = (editor) => {
    editorRef.current = editor
    if (sessionRef.current) {
      attachBinding(editor, sessionRef.current, readOnly)
    }
  }

  return (
    <div ref={containerRef} className="h-full w-full">
      <Editor
        height="100%"
        language={language}
        defaultValue={initialContent || ''}
        onMount={handleMount}
        theme="vs-dark"
        options={{
          fontSize: 13,
          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          fontLigatures: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          lineNumbers: 'on',
          renderLineHighlight: 'line',
          automaticLayout: true,
          tabSize: 4,
          insertSpaces: true,
          padding: { top: 16, bottom: 16 },
          readOnly: readOnly,
        }}
      />
    </div>
  )
}
