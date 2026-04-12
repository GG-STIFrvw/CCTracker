import { useRef, useState } from 'react'
import Modal from './Modal.jsx'
import Button from './Button.jsx'
import {
  useTransactionAttachments,
  useLoanAttachments,
  useUploadAttachment,
  useDeleteAttachment,
  MAX_FILES,
} from '../../hooks/useAttachments.js'

export default function AttachmentModal({ entityType, entityId, borrowerId, readOnly, onClose }) {
  const fileInputRef = useRef(null)
  const [uploadError, setUploadError] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  if (process.env.NODE_ENV !== 'production' && entityType !== 'transaction' && entityType !== 'loan') {
    console.error(`AttachmentModal: unknown entityType "${entityType}"`)
  }

  const txQuery = useTransactionAttachments(entityType === 'transaction' ? entityId : null)
  const loanQuery = useLoanAttachments(entityType === 'loan' ? entityId : null)
  const query = entityType === 'transaction' ? txQuery : loanQuery
  const attachments = query.data ?? []

  const upload = useUploadAttachment()
  const deleteAtt = useDeleteAttachment()

  async function handleFileChange(e) {
    setUploadError('')
    const file = e.target.files?.[0]
    if (!file) return
    if (attachments.length >= MAX_FILES) {
      setUploadError('Maximum 10 files reached')
      e.target.value = ''
      return
    }
    try {
      await upload.mutateAsync({ file, entityType, entityId, borrowerId })
    } catch (err) {
      setUploadError(err.message)
    }
    e.target.value = ''
  }

  return (
    <Modal title={`Attachments (${attachments.length})`} onClose={onClose}>
      {/* Upload — owner only */}
      {!readOnly && (
        <div className="mb-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={upload.isPending || attachments.length >= MAX_FILES}
            className="w-full justify-center"
          >
            {upload.isPending ? 'Uploading…' : '+ Upload File'}
          </Button>
          <p className="text-gray-400 dark:text-gray-500 text-xs mt-1 text-center">
            JPG, PNG, WEBP, PDF · max 10 MB · max 10 files
          </p>
          {uploadError && (
            <p className="text-red-500 text-xs mt-1 text-center">{uploadError}</p>
          )}
        </div>
      )}

      {/* List */}
      {query.isLoading ? (
        <p className="text-gray-400 text-sm text-center py-6">Loading…</p>
      ) : attachments.length === 0 ? (
        <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
          {readOnly ? 'No attachments.' : 'No files yet. Upload one above.'}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-3 border border-gray-200 dark:border-gray-700 rounded-lg p-2"
            >
              {/* Preview / icon */}
              {att.mime_type.startsWith('image/') ? (
                att.signedUrl ? (
                  <a href={att.signedUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                    <img src={att.signedUrl} alt={att.file_name} className="w-16 h-16 object-cover rounded" />
                  </a>
                ) : (
                  <div className="shrink-0 w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center text-2xl">🖼️</div>
                )
              ) : (
                att.signedUrl ? (
                  <a href={att.signedUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center text-3xl">
                    📄
                  </a>
                ) : (
                  <div className="shrink-0 w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center text-3xl">📄</div>
                )
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 dark:text-white truncate">{att.file_name}</p>
                <p className="text-xs text-gray-400 mb-1">
                  {(att.file_size / 1024).toFixed(0)} KB
                </p>
                {att.signedUrl ? (
                  <a href={att.signedUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">
                    {att.mime_type === 'application/pdf' ? 'Download PDF' : 'View full size'}
                  </a>
                ) : (
                  <span className="text-xs text-red-400">File unavailable</span>
                )}
              </div>

              {/* Delete — owner only */}
              {!readOnly && (
                <div className="shrink-0">
                  {confirmDeleteId === att.id ? (
                    <span className="flex items-center gap-1 text-xs">
                      <button
                        onClick={() => {
                          deleteAtt.mutate(
                            { attachment: att, entityType, entityId },
                            {
                              onError: (err) => setUploadError(err.message),
                              onSettled: () => setConfirmDeleteId(null),
                            }
                          )
                        }}
                        className="text-red-500 hover:text-red-400 font-medium"
                        disabled={deleteAtt.isPending}
                      >
                        Yes
                      </button>
                      <span className="text-gray-300 dark:text-gray-600">/</span>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        No
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(att.id)}
                      className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 text-xs transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
