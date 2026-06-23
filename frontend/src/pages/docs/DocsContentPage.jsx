import { Navigate, useLocation } from 'react-router-dom'
import DocArticle from '../../components/docs/DocArticle'
import CONTENT_BY_PATH from '../../docs/content'

export default function DocsContentPage() {
  const { pathname } = useLocation()
  const normalized = pathname.replace(/\/$/, '') || '/docs'
  const content = CONTENT_BY_PATH[normalized]

  if (!content) {
    return <Navigate to="/docs/guide" replace />
  }

  return (
    <DocArticle
      title={content.title}
      description={content.description}
      sections={content.sections}
      editFile={content.editFile}
    />
  )
}
