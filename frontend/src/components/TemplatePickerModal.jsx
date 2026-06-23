import { useEffect, useState } from 'react'
import { Sparkles, FileCode, Check } from 'lucide-react'
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

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId)

  const footer = (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 min-w-0 text-xs text-stellar-muted">
        {selectedTemplate ? (
          <span>
            Selected: <span className="text-stellar-heading font-medium">{selectedTemplate.name}</span>
          </span>
        ) : (
          <span>Pick a template to get started</span>
        )}
      </div>
      <div className="flex gap-3 w-full sm:w-auto">
        <Button variant="secondary" className="flex-1 sm:flex-none justify-center min-w-[100px]" onClick={onClose}>
          Cancel
        </Button>
        <Button
          className="flex-1 sm:flex-none justify-center min-w-[140px] shadow-lg shadow-stellar-accent/20"
          size="lg"
          loading={loading}
          onClick={onCreate}
        >
          Create Project
        </Button>
      </div>
    </div>
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Project"
      className="max-w-5xl"
      bodyClassName="pb-4"
      footer={footer}
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-stellar-heading">Choose a template</p>
              <p className="text-xs text-stellar-muted mt-0.5">8 starter contracts with real Soroban code</p>
            </div>
            <button
              type="button"
              onClick={() => onSelectTemplate('blank')}
              className="text-xs px-2.5 py-1 rounded-md border border-stellar-border text-stellar-muted hover:text-stellar-accent hover:border-stellar-accent/40 transition-colors"
            >
              Start Blank
            </button>
          </div>

          {templatesLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="h-32 rounded-xl bg-stellar-surface border border-stellar-border animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[min(420px,45vh)] overflow-y-auto pr-1">
              {templates.map((template) => {
                const selected = selectedTemplateId === template.id
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => onSelectTemplate(template.id)}
                    className={`text-left rounded-xl border p-4 transition-all min-h-[120px] relative ${
                      selected
                        ? 'border-stellar-accent bg-stellar-accent/10 ring-2 ring-stellar-accent/40'
                        : 'border-stellar-border bg-stellar-surface hover:border-stellar-accent/40 hover:bg-stellar-card'
                    }`}
                  >
                    {selected && (
                      <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-stellar-accent flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </span>
                    )}
                    <div className="flex items-start gap-3 mb-2 pr-6">
                      <div className="w-9 h-9 rounded-lg bg-stellar-card border border-stellar-border flex items-center justify-center flex-shrink-0">
                        {template.id === 'blank' ? (
                          <FileCode className="w-4 h-4 text-stellar-muted" />
                        ) : (
                          <Sparkles className="w-4 h-4 text-stellar-accent" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-stellar-heading">{template.name}</p>
                        <p className="text-xs text-stellar-muted leading-relaxed mt-1 line-clamp-2">
                          {template.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1">
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
      </div>
    </Modal>
  )
}
