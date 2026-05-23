import { type FormEvent, useEffect, useState } from 'react'
import './App.css'
import ChatPanel from './components/ChatPanel'
import MatchAnalysisPanel from './components/MatchAnalysisPanel'
import DashboardPanel from './components/DashboardPanel'

type IngestionResponse = {
  message: string
  data: {
    fileId: string
    chunkCount: number
    preview: string[]
    file: {
      originalName: string
      mimeType: string
      sizeBytes: number
      totalChars: number
      documentType: 'resume' | 'job_description' | 'other'
      chunkSize: number
      overlap: number
    }
  }
}

type IndexStatusResponse = {
  totalFiles: number
  indexedFiles: number
  partialFiles: number
  pendingFiles: number
  totalChunks: number
  indexedChunks: number
  pendingChunks: number
  qdrantCollection: string
  embeddingModel: string
}

type RetrievalResult = {
  score: number
  fileId: string
  fileName: string
  chunkId: string
  chunkIndex: number
  textPreview: string
}

function App() {
  const [activeTab, setActiveTab] = useState<'upload' | 'chat' | 'match'>('upload')
  const [indexingMode, setIndexingMode] = useState<'auto' | 'manual'>('manual')
  const [apiStatus, setApiStatus] = useState<'loading' | 'online' | 'offline'>('loading')
  const [serverTime, setServerTime] = useState<string>('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [documentType, setDocumentType] = useState<'resume' | 'job_description' | 'other'>(
    'resume',
  )
  const [chunkSize, setChunkSize] = useState<number>(800)
  const [overlap, setOverlap] = useState<number>(120)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [uploadMessage, setUploadMessage] = useState('')
  const [result, setResult] = useState<IngestionResponse['data'] | null>(null)
  const [indexFileId, setIndexFileId] = useState('')
  const [vectorLoading, setVectorLoading] = useState(false)
  const [vectorMessage, setVectorMessage] = useState('')
  const [indexStatus, setIndexStatus] = useState<IndexStatusResponse | null>(null)
  const [retrievalQuery, setRetrievalQuery] = useState('')
  const [retrievalTopK, setRetrievalTopK] = useState(5)
  const [retrievalFileId, setRetrievalFileId] = useState('')
  const [retrievalResults, setRetrievalResults] = useState<RetrievalResult[]>([])

  const fetchIndexStatus = async () => {
    const response = await fetch('/api/vector/index/status')
    const payload = (await response.json()) as {
      message?: string
      data?: IndexStatusResponse
    }
    if (!response.ok || !payload.data) {
      throw new Error(payload.message || 'Failed to fetch indexing status')
    }
    setIndexStatus(payload.data)
  }

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const response = await fetch('/api/health')
        if (!response.ok) {
          throw new Error('Backend health endpoint returned non-200 response')
        }

        const payload: { timestamp?: string } = await response.json()
        setApiStatus('online')
        setServerTime(payload.timestamp ?? '')
        await fetchIndexStatus()
      } catch (_error) {
        setApiStatus('offline')
      }
    }

    void checkBackend()
  }, [])

  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setUploadMessage('')
    setResult(null)

    if (!selectedFile) {
      setError('Please choose a file first.')
      return
    }

    if (overlap >= chunkSize) {
      setError('Overlap must be smaller than chunk size.')
      return
    }

    const formData = new FormData()
    formData.append('file', selectedFile)
    formData.append('documentType', documentType)
    formData.append('chunkSize', String(chunkSize))
    formData.append('overlap', String(overlap))

    try {
      setLoading(true)
      const response = await fetch('/api/ingest', {
        method: 'POST',
        body: formData,
      })

      const payload = (await response.json()) as IngestionResponse | { message?: string }
      if (!response.ok) {
        throw new Error(payload.message || 'Ingestion failed')
      }

      const uploadedData = (payload as IngestionResponse).data
      setResult(uploadedData)
      setIndexFileId(uploadedData.fileId)
      setRetrievalFileId(uploadedData.fileId)

      if (indexingMode === 'auto') {
        setVectorMessage('')
        const indexResponse = await fetch(`/api/vector/index/file/${uploadedData.fileId}`, {
          method: 'POST',
        })
        const indexPayload = (await indexResponse.json()) as {
          message?: string
          data?: { newlyIndexed: number }
        }
        if (!indexResponse.ok) {
          throw new Error(indexPayload.message || 'Auto indexing failed after upload')
        }
        setUploadMessage(
          `Document uploaded and indexed. New chunks indexed: ${indexPayload.data?.newlyIndexed ?? 0}.`,
        )
      } else {
        setUploadMessage('Document uploaded successfully. Click manual index to generate vectors.')
      }
      await fetchIndexStatus()
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : 'Upload failed.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleManualIndexUploadedFile = async () => {
    if (!indexFileId.trim()) {
      setUploadMessage('Upload a file first, then run manual index.')
      return
    }

    try {
      setVectorLoading(true)
      setVectorMessage('')
      setUploadMessage('')
      const response = await fetch(`/api/vector/index/file/${indexFileId.trim()}`, {
        method: 'POST',
      })
      const payload = (await response.json()) as { message?: string; data?: { newlyIndexed: number } }
      if (!response.ok) {
        throw new Error(payload.message || 'Manual indexing failed')
      }
      setUploadMessage(`Manual indexing completed. New chunks indexed: ${payload.data?.newlyIndexed ?? 0}.`)
      await fetchIndexStatus()
    } catch (indexError) {
      const message = indexError instanceof Error ? indexError.message : 'Manual indexing failed'
      setUploadMessage(message)
    } finally {
      setVectorLoading(false)
    }
  }

  const handleDeleteUploadedFiles = async () => {
    const shouldDelete = window.confirm(
      'Delete ALL uploaded files, chunks, and vector index mappings? This cannot be undone.',
    )
    if (!shouldDelete) {
      return
    }

    try {
      setLoading(true)
      setError('')
      setUploadMessage('')
      const response = await fetch('/api/ingest/files', { method: 'DELETE' })
      const payload = (await response.json()) as {
        message?: string
        data?: { deletedFiles: number; deletedChunks: number; deletedVectorIndexes: number }
      }
      if (!response.ok || !payload.data) {
        throw new Error(payload.message || 'Failed to delete uploaded files')
      }

      setSelectedFile(null)
      setResult(null)
      setIndexFileId('')
      setRetrievalFileId('')
      setRetrievalResults([])
      setUploadMessage(
        `Deleted ${payload.data.deletedFiles} files, ${payload.data.deletedChunks} chunks, and ${payload.data.deletedVectorIndexes} vector mappings.`,
      )
      setVectorMessage('Upload data was cleared. Re-index files after new uploads.')
      await fetchIndexStatus()
    } catch (uploadError) {
      const message =
        uploadError instanceof Error ? uploadError.message : 'Failed to delete uploaded files'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleIndexAll = async () => {
    try {
      setVectorLoading(true)
      setVectorMessage('')
      const response = await fetch('/api/vector/index/all', { method: 'POST' })
      const payload = (await response.json()) as {
        message?: string
        data?: { processedFiles: number }
      }
      if (!response.ok) {
        throw new Error(payload.message || 'Index all failed')
      }
      setVectorMessage(`Index all completed. Processed files: ${payload.data?.processedFiles ?? 0}`)
      await fetchIndexStatus()
    } catch (vectorError) {
      const message = vectorError instanceof Error ? vectorError.message : 'Index all failed'
      setVectorMessage(message)
    } finally {
      setVectorLoading(false)
    }
  }

  const handleIndexFile = async () => {
    if (!indexFileId.trim()) {
      setVectorMessage('Please provide a fileId to index.')
      return
    }

    try {
      setVectorLoading(true)
      setVectorMessage('')
      const response = await fetch(`/api/vector/index/file/${indexFileId.trim()}`, {
        method: 'POST',
      })
      const payload = (await response.json()) as { message?: string; data?: { newlyIndexed: number } }
      if (!response.ok) {
        throw new Error(payload.message || 'Index file failed')
      }
      setVectorMessage(`File indexed. New chunks indexed: ${payload.data?.newlyIndexed ?? 0}`)
      await fetchIndexStatus()
    } catch (vectorError) {
      const message = vectorError instanceof Error ? vectorError.message : 'Index file failed'
      setVectorMessage(message)
    } finally {
      setVectorLoading(false)
    }
  }

  const handleClearVectorDb = async () => {
    const shouldClear = window.confirm(
      'Delete ALL vectors from the vector database and reset indexing status? This cannot be undone.',
    )
    if (!shouldClear) {
      return
    }

    try {
      setVectorLoading(true)
      setVectorMessage('')
      const response = await fetch('/api/vector/index/all', { method: 'DELETE' })
      const payload = (await response.json()) as {
        message?: string
        data?: { clearedIndexRecords: number }
      }
      if (!response.ok || !payload.data) {
        throw new Error(payload.message || 'Failed to clear vector indexes')
      }

      setRetrievalResults([])
      setVectorMessage(`Cleared ${payload.data.clearedIndexRecords} vector index records.`)
      await fetchIndexStatus()
    } catch (vectorError) {
      const message = vectorError instanceof Error ? vectorError.message : 'Clear vectors failed'
      setVectorMessage(message)
    } finally {
      setVectorLoading(false)
    }
  }

  const handleRetrieve = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!retrievalQuery.trim()) {
      setVectorMessage('Please enter a retrieval query.')
      return
    }

    try {
      setVectorLoading(true)
      setVectorMessage('')
      setRetrievalResults([])
      const response = await fetch('/api/vector/retrieve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: retrievalQuery.trim(),
          topK: retrievalTopK,
          fileId: retrievalFileId.trim() || undefined,
        }),
      })
      const payload = (await response.json()) as {
        message?: string
        data?: { results: RetrievalResult[] }
      }
      if (!response.ok || !payload.data) {
        throw new Error(payload.message || 'Retrieval failed')
      }
      setRetrievalResults(payload.data.results)
      setVectorMessage(`Retrieved ${payload.data.results.length} chunks.`)
    } catch (vectorError) {
      const message = vectorError instanceof Error ? vectorError.message : 'Retrieval failed'
      setVectorMessage(message)
    } finally {
      setVectorLoading(false)
    }
  }

  return (
    <main className="container">
      <h1>RAG Career Assistant</h1>
      <p className="subtitle">
        Upload your resume and job description, then chat with grounded citations.
      </p>

      <section className="card">
        <h2>System Status</h2>
        <p>
          Backend API:{' '}
          <strong className={`status ${apiStatus}`}>
            {apiStatus === 'loading' ? 'Checking...' : apiStatus}
          </strong>
        </p>
        {serverTime && <p className="meta">Server timestamp: {serverTime}</p>}
      </section>

      <section className="tab-strip">
        <button
          type="button"
          className={activeTab === 'upload' ? 'active' : ''}
          onClick={() => setActiveTab('upload')}
        >
          Upload
        </button>
        <button
          type="button"
          className={activeTab === 'chat' ? 'active' : ''}
          onClick={() => setActiveTab('chat')}
        >
          RAG Chat
        </button>
        <button
          type="button"
          className={activeTab === 'match' ? 'active' : ''}
          onClick={() => setActiveTab('match')}
        >
          Match Analysis
        </button>
      </section>

      {activeTab === 'upload' && (
        <section className="card">
          <h2>Upload Documents</h2>
          <form className="upload-form" onSubmit={handleUpload}>
            <label>
              Choose file (PDF/TXT/DOCX)
              <input
                type="file"
                accept=".pdf,.txt,.docx"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  setSelectedFile(file ?? null)
                }}
              />
            </label>

            <label>
              Document type
              <select
                value={documentType}
                onChange={(event) =>
                  setDocumentType(event.target.value as 'resume' | 'job_description' | 'other')
                }
              >
                <option value="resume">Resume</option>
                <option value="job_description">Job description</option>
                <option value="other">Other</option>
              </select>
            </label>

            <label>
              Indexing mode
              <select
                value={indexingMode}
                onChange={(event) => setIndexingMode(event.target.value as 'auto' | 'manual')}
              >
                <option value="manual">Manual (I control when to index)</option>
                <option value="auto">Auto (index right after upload)</option>
              </select>
            </label>

            <div className="row">
              <label>
                Chunk size
                <input
                  type="number"
                  min={100}
                  value={chunkSize}
                  onChange={(event) => setChunkSize(Number(event.target.value))}
                />
              </label>
              <label>
                Overlap
                <input
                  type="number"
                  min={0}
                  value={overlap}
                  onChange={(event) => setOverlap(Number(event.target.value))}
                />
              </label>
            </div>

            <button type="submit" disabled={loading}>
              {loading ? 'Uploading...' : 'Ingest Document'}
            </button>
          </form>
          <div className="inline-actions">
            <button
              type="button"
              className="danger-button"
              onClick={handleDeleteUploadedFiles}
              disabled={loading}
            >
              Delete All Uploaded Files
            </button>
            {indexingMode === 'manual' && (
              <button
                type="button"
                onClick={handleManualIndexUploadedFile}
                disabled={loading || vectorLoading || !indexFileId.trim()}
              >
                {vectorLoading ? 'Indexing...' : 'Manual Index Uploaded File'}
              </button>
            )}
          </div>

          {error && <p className="error-text">{error}</p>}
          {uploadMessage && <p className="meta">{uploadMessage}</p>}

          {result && (
            <div className="result">
              <p>
                <strong>File ID:</strong> {result.fileId}
              </p>
              <p>
                <strong>Chunks:</strong> {result.chunkCount}
              </p>
              <p>
                <strong>Characters:</strong> {result.file.totalChars}
              </p>
              <p>
                <strong>Chunk config:</strong> size {result.file.chunkSize}, overlap{' '}
                {result.file.overlap}
              </p>
              <div>
                <strong>Preview:</strong>
                <ul>
                  {result.preview.map((item, index) => (
                    <li key={`${index}-${item.slice(0, 20)}`}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>
      )}

      {activeTab === 'chat' && <ChatPanel />}
      {activeTab === 'match' && <MatchAnalysisPanel />}

      <details className="card advanced-tools">
        <summary>Advanced Tools (Optional)</summary>

        <section className="card">
          <h2>Vector Indexing</h2>
          <div className="vector-actions">
            <button type="button" onClick={handleIndexAll} disabled={vectorLoading}>
              Index All Unindexed Files
            </button>
            <button
              type="button"
              className="danger-button"
              onClick={handleClearVectorDb}
              disabled={vectorLoading}
            >
              Delete All Vectors
            </button>
            <div className="row">
              <label>
                File ID for indexing
                <input
                  value={indexFileId}
                  onChange={(event) => setIndexFileId(event.target.value)}
                  placeholder="Paste fileId from ingestion result"
                />
              </label>
              <button type="button" onClick={handleIndexFile} disabled={vectorLoading}>
                Index This File
              </button>
            </div>
          </div>

          {indexStatus && (
            <div className="result">
              <p>
                <strong>Collection:</strong> {indexStatus.qdrantCollection}
              </p>
              <p>
                <strong>Embedding model:</strong> {indexStatus.embeddingModel}
              </p>
              <p>
                <strong>Files:</strong> {indexStatus.indexedFiles} indexed / {indexStatus.totalFiles}{' '}
                total
              </p>
              <p>
                <strong>Chunks:</strong> {indexStatus.indexedChunks} indexed / {indexStatus.totalChunks}{' '}
                total
              </p>
            </div>
          )}
        </section>

        <section className="card">
          <h2>Retrieval Debugger</h2>
          <form className="upload-form" onSubmit={handleRetrieve}>
            <label>
              Query
              <input
                value={retrievalQuery}
                onChange={(event) => setRetrievalQuery(event.target.value)}
                placeholder="e.g. Node.js backend experience"
              />
            </label>

            <div className="row">
              <label>
                Top K
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={retrievalTopK}
                  onChange={(event) => setRetrievalTopK(Number(event.target.value))}
                />
              </label>
              <label>
                Optional File ID filter
                <input
                  value={retrievalFileId}
                  onChange={(event) => setRetrievalFileId(event.target.value)}
                  placeholder="leave empty for all files"
                />
              </label>
            </div>

            <button type="submit" disabled={vectorLoading}>
              {vectorLoading ? 'Running...' : 'Run Retrieval'}
            </button>
          </form>

          {vectorMessage && <p className="meta">{vectorMessage}</p>}

          {retrievalResults.length > 0 && (
            <div className="result">
              <ul>
                {retrievalResults.map((item) => (
                  <li key={`${item.chunkId}-${item.chunkIndex}`}>
                    <strong>{item.fileName || item.fileId}</strong> | chunk #{item.chunkIndex} | score{' '}
                    {item.score.toFixed(4)}
                    <br />
                    {item.textPreview}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <DashboardPanel />
      </details>
    </main>
  )
}

export default App
