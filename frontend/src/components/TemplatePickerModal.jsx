import { useEffect, useState } from 'react'
import { Sparkles, FileCode } from 'lucide-react'
import Modal from './ui/Modal'
import Input from './ui/Input'
import Button from './ui/Button'
import api from '../services/api'

const TAG_STYLE = {
  Beginner: 'bg-green-500/10 text-green-400 border-green-500/30',
  DeFi: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  NFT: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  Governance: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  Security: 'bg-red-500/10 text-red-400 border-red-500/30',
  Token: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
}

export default function TemplatePickerModal({
  open,
  onClose,
  onCreate,
  loading,
  error,
  name,
  description,
  onNameChange,
  onDescriptionChange,
  selectedTemplateId,
  onSelectTemplate,
}) {
  const [templates, setTemplates] = useState([])
  const [templatesLoading, setTemplatesLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setTemplatesLoading(true)
    api.get('/templates')
      .then(({ data }) => setTemplates(Array.isArray(data) ? data : []))
      .catch(() => setTemplates([]))
      .finally(() => setTemplatesLoading(false))
  }, [open])

  return (
    <Modal open={open} onClose={onClose} title="New Project" className="max-w-4xl">
      <div className="space-y-5">
        <Input
          label="Project name"
          placeholder="my-token-contract"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          error={error}
          autoFocus
        />
        <Input
          label="Description (optional)"
          placeholder="A brief description of your contract"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
        />

        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-stellar-heading">Choose a template</p>
            <button
              type="button"
              onClick={() => onSelectTemplate('blank')}
              className="text-xs text-stellar-muted hover:text-stellar-accent transition-colors"
            >
              Start Blank
            </button>
          </div>

          {templatesLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-28 rounded-xl bg-stellar-surface border border-stellar-border animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[340px] overflow-y-auto pr-1">
              {templates.map((template) => {
                const selected = selectedTemplateId === template.id
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => onSelectTemplate(template.id)}
                    className={`text-left rounded-xl border p-4 transition-all ${
                      selected
                        ? 'border-stellar-accent bg-stellar-accent/10 shadow-[0_0_0_1px_rgba(59,130,246,0.35)]'
                        : 'border-stellar-border bg-stellar-surface hover:border-stellar-accent/40'
                    }`}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-stellar-card border border-stellar-border flex items-center justify-center flex-shrink-0">
                        {template.id === 'blank' ? (
                          <FileCode className="w-4 h-4 text-stellar-muted" />
                        ) : (
                          <Sparkles className="w-4 h-4 text-stellar-accent" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-stellar-heading">{template.name}</p>
                        <p className="text-xs text-stellar-muted leading-relaxed mt-1">{template.description}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {(template.tags || []).map((tag) => (
                        <span
                          key={tag}
                          className={`text-[10px] px-1.5 py-0.5 rounded border ${TAG_STYLE[tag] || 'border-stellar-border text-stellar-muted'}`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" className="flex-1 justify-center" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1 justify-center" loading={loading} onClick={onCreate}>
            Create Project
          </Button>
        </div>
      </div>
    </Modal>
  )
}
