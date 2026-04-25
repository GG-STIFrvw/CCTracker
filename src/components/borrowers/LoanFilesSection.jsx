import { useRef, useState } from 'react'
import { useAllLoanAttachments, useUploadAttachment, useDeleteAttachment } from '../../hooks/useAttachments.js'
import { PdfFileIcon } from '../ui/icons.jsx'

function FileTile({ att, readOnly, loanDescription, deleteAtt }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const isImage = att.mime_type.startsWith('image/')

  return (
    <div className="relative group rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-900 hover:shadow-md transition-shadow">
      <a
        href={att.signedUrl || undefined}
        target="_blank"
        rel="noopener noreferrer"
        onClick={!att.signedUrl ? (e) => e.preventDefault() : undefined}
        className="block"
      >
        {isImage && att.signedUrl ? (
          <img src={att.signedUrl} alt={att.file_name} className="w-full h-32 object-cover" />
        ) : (
          <div className="w-full h-32 bg-red-50 dark:bg-red-900/10 flex flex-col items-center justify-center gap-1">
            <PdfFileIcon className="w-10 h-10 text-red-400" />
            <span className="text-xs font-bold text-red-400 tracking-wider">PDF</span>
          </div>
        )}
      </a>

      <div className="px-2.5 py-2 border-t border-gray-100 dark:border-gray-800">
        <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{att.file_name}</p>
        <p className="text-xs text-gray-400 truncate mt-0.5">{loanDescription}</p>
      </div>

      {!readOnly && (
        <div className="absolute top-1.5 right-1.5">
          {confirmDelete ? (
            <div className="flex items-center gap-1 bg-white dark:bg-gray-800 rounded-lg px-2 py-1 shadow-md border border-gray-200 dark:border-gray-700 text-xs">
              <button
                onClick={() =>
                  deleteAtt.mutate(
                    { attachment: att, entityType: 'loan', entityId: att.loan_id },
                    { onSettled: () => setConfirmDelete(false) }
                  )
                }
                className="text-red-500 font-semibold hover:text-red-400"
                disabled={deleteAtt.isPending}
              >
                Delete
              </button>
              <span className="text-gray-300 dark:text-gray-600">/</span>
              <button onClick={() => setConfirmDelete(false)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-6 h-6 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-full shadow flex items-center justify-center text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-all opacity-0 group-hover:opacity-100 text-base font-bold leading-none"
              title="Remove file"
            >
              ×
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function LoanFilesSection({ loans, borrowerId, readOnly }) {
  const loanIds = loans.map((l) => l.id)
  const [selectedLoanId, setSelectedLoanId] = useState(() => loans[0]?.id ?? '')
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef(null)

  const { data: attachments = [], isLoading } = useAllLoanAttachments(loanIds)
  const upload = useUploadAttachment()
  const deleteAtt = useDeleteAttachment()

  const loanMap = Object.fromEntries(loans.map((l) => [l.id, l.description || 'Loan']))

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file || !selectedLoanId) return
    setUploadError('')
    try {
      await upload.mutateAsync({ file, entityType: 'loan', entityId: selectedLoanId, borrowerId })
    } catch (err) {
      setUploadError(err.message)
    }
    e.target.value = ''
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Files {attachments.length > 0 && <span className="text-gray-400 font-normal text-base">({attachments.length})</span>}
        </h2>

        {!readOnly && loans.length > 0 && (
          <div className="flex items-center gap-2">
            {loans.length > 1 && (
              <select
                value={selectedLoanId}
                onChange={(e) => setSelectedLoanId(e.target.value)}
                className="text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 max-w-[180px] truncate"
              >
                {loans.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.description || 'Loan'}
                  </option>
                ))}
              </select>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={upload.isPending || !selectedLoanId}
              className="text-xs text-[#2D6A4F] dark:text-[#9FE870] border border-[#2D6A4F] dark:border-[#9FE870] px-3 py-1.5 rounded-xl hover:bg-[#9FE870]/10 transition-colors font-medium disabled:opacity-50"
            >
              {upload.isPending ? 'Uploading…' : '+ Upload File'}
            </button>
          </div>
        )}
      </div>

      {uploadError && <p className="text-red-500 text-xs mb-3">{uploadError}</p>}

      {isLoading ? (
        <p className="text-gray-400 text-sm py-8 text-center">Loading files…</p>
      ) : attachments.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl py-12 text-center">
          <PdfFileIcon className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
          <p className="text-gray-400 dark:text-gray-500 text-sm">
            {readOnly ? 'No files attached.' : 'No files yet. Upload one above.'}
          </p>
          <p className="text-gray-300 dark:text-gray-600 text-xs mt-1">JPG, PNG, WEBP, PDF · max 10 MB</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {attachments.map((att) => (
            <FileTile
              key={att.id}
              att={att}
              readOnly={readOnly}
              loanDescription={loanMap[att.loan_id] ?? 'Loan'}
              deleteAtt={deleteAtt}
            />
          ))}
        </div>
      )}
    </div>
  )
}
