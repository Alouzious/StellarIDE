import { useEffect, useRef } from 'react'
import Editor from '@monaco-editor/react'
import { MonacoBinding } from 'y-monaco'
import { createCollabSession } from '../features/collab/collabProvider'
import { getWsBaseUrl } from '../services/api'

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
  onFileConnectionStatus,
  onSessionRestored,
  editorHighlight,
  editorOptions = {},
  theme = 'vs-dark',
  onEditorReady,
  autoSaveMs = 1500,
}) {
  const sessionRef = useRef(null)
  const bindingRef = useRef(null)
  const editorRef = useRef(null)
  const monacoRef = useRef(null)
  const decorationsRef = useRef([])
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
      fallbackText: initialContent || '',
      onStatus: onFileConnectionStatus,
      onSessionRestored,
    })
    sessionRef.current = session

    if (editorRef.current) {
      attachBinding(editorRef.current, session, readOnly)
    }

    const textObserver = () => {
      const content = session.ytext.toString()
      onContentChange?.(content)
      if (readOnly) return
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        onSaveDebounced?.(content)
      }, autoSaveMs)
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
  }, [projectId, filePath, token, userId, readOnly, autoSaveMs])

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions(editorOptions)
    }
  }, [editorOptions])

  useEffect(() => {
    const editor = editorRef.current
    const monaco = monacoRef.current
    if (!editor || !monaco || !editorHighlight) {
      if (editor) {
        decorationsRef.current = editor.deltaDecorations(decorationsRef.current, [])
      }
      return
    }
    const fileName = filePath?.split('/').pop()
    const highlightFile = editorHighlight.file
    if (highlightFile && highlightFile !== filePath && highlightFile !== fileName) {
      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, [])
      return
    }
    const start = editorHighlight.lineStart || 1
    const end = editorHighlight.lineEnd || start
    const decos = [{
      range: new monaco.Range(start, 1, end, 1),
      options: {
        isWholeLine: !editorHighlight.matchStart,
        className: 'audit-highlight-line',
        glyphMarginClassName: 'audit-highlight-glyph',
      },
    }]
    if (editorHighlight.matchStart != null && editorHighlight.matchEnd != null) {
      decos.push({
        range: new monaco.Range(start, editorHighlight.matchStart + 1, start, editorHighlight.matchEnd + 1),
        options: { inlineClassName: 'search-match-highlight' },
      })
    }
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, decos)
    editor.revealLineInCenter(start)
  }, [editorHighlight, filePath])

  const attachBinding = (editor, session, isReadOnly) => {
    bindingRef.current?.destroy()
    editor.updateOptions({ readOnly: isReadOnly, ...editorOptions })
    bindingRef.current = new MonacoBinding(
      session.ytext,
      editor.getModel(),
      new Set([editor]),
      session.awareness
    )
  }

  const handleMount = (editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco
    onEditorReady?.(editor, monaco)
    if (sessionRef.current) {
      attachBinding(editor, sessionRef.current, readOnly)
    }
  }

  return (
    <div className="h-full w-full">
      <Editor
        height="100%"
        language={language}
        defaultValue=""
        onMount={handleMount}
        theme={theme}
        options={{
          ...editorOptions,
          readOnly,
          glyphMargin: true,
        }}
      />
    </div>
  )
}
