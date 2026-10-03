import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Trash2, Eye, Cpu, Database } from 'lucide-react';
import { DocumentItem, ChunkItem } from '../types/rag';
import { uploadDocumentFile, deleteDocument, fetchDocumentChunks } from '../services/api';

interface UploadFilesProps {
  documents: DocumentItem[];
  onRefreshDocs: () => void;
  onNavigateToAgent: () => void;
  onErrorOccurred?: (err: any) => void;
}

export const UploadFiles: React.FC<UploadFilesProps> = ({
  documents,
  onRefreshDocs,
  onNavigateToAgent,
  onErrorOccurred,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [docChunks, setDocChunks] = useState<ChunkItem[]>([]);
  const [isLoadingChunks, setIsLoadingChunks] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const result = await uploadDocumentFile(file);
      setUploadSuccess(
        `✓ Successfully parsed "${file.name}", generated ${result.chunksCreated} vector embeddings, and stored into MS SQL Server!`
      );
      onRefreshDocs();
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload document.');
      if (onErrorOccurred && err.type) {
        onErrorOccurred(err);
      }
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Delete document "${name}" and all its vector embeddings from MS SQL Server?`)) {
      try {
        await deleteDocument(id);
        if (selectedDocId === id) {
          setSelectedDocId(null);
          setDocChunks([]);
        }
        onRefreshDocs();
      } catch (err: any) {
        alert('Failed to delete document: ' + err.message);
      }
    }
  };

  const handleViewChunks = async (id: string) => {
    if (selectedDocId === id) {
      setSelectedDocId(null);
      setDocChunks([]);
      return;
    }

    setSelectedDocId(id);
    setIsLoadingChunks(true);
    try {
      const chunks = await fetchDocumentChunks(id);
      setDocChunks(chunks);
    } catch (err) {
      console.error('Failed to load chunks:', err);
    } finally {
      setIsLoadingChunks(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Dropzone */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-indigo-600" />
              Upload Files for Vector Conversion
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Browse PDF, Word (.docx), or plain text. The .NET API chunks the document, converts text to 768-d vectors via Gemini, and commits into MS SQL Server.
            </p>
          </div>
          <button
            onClick={onNavigateToAgent}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg transition border border-indigo-200 cursor-pointer self-start sm:self-auto"
          >
            <Cpu className="w-4 h-4 text-indigo-600" />
            <span>Go to Agent Q&amp;A &rarr;</span>
          </button>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition cursor-pointer flex flex-col items-center justify-center gap-3 ${
            isDragging
              ? 'border-indigo-500 bg-indigo-50/50'
              : 'border-slate-300 hover:border-indigo-400 bg-slate-50/50 hover:bg-slate-50'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".pdf,.docx,.doc,.txt,.md,.json"
            className="hidden"
          />
          <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-xs">
            <UploadCloud className="w-6 h-6" />
          </div>
          <div>
            <span className="font-semibold text-sm text-slate-800">
              Click to browse file or drag &amp; drop
            </span>
            <p className="text-xs text-slate-500 mt-1">
              Supports PDF, Word (.docx), Plain Text (.txt, .md). Vector format: VECTOR(768).
            </p>
          </div>
          <span className="px-3 py-1 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-600 shadow-2xs">
            Browse Document
          </span>
        </div>

        {isUploading && (
          <div className="mt-4 p-4 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center gap-3 text-xs text-indigo-900">
            <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <div>
              <span className="font-semibold">Processing RAG Pipeline:</span>
              <span className="ml-1 text-indigo-700">
                Parsing document &rarr; Generating 768-d Gemini embeddings &rarr; Storing in MS SQL Server...
              </span>
            </div>
          </div>
        )}

        {uploadSuccess && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs text-emerald-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{uploadSuccess}</span>
          </div>
        )}

        {uploadError && (
          <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}
      </div>

      {/* MS SQL Server Documents Catalog Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-600" />
            <h3 className="font-bold text-sm text-slate-900">
              MS SQL Server 2025 Vector Store (<code className="text-xs bg-slate-200 px-1 py-0.5 rounded text-slate-800 font-mono">dbo.Documents</code>)
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {documents.length} document{documents.length === 1 ? '' : 's'} indexed
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200 text-[11px]">
              <tr>
                <th className="py-3 px-4">Document Name</th>
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-3">Size</th>
                <th className="py-3 px-3">Vector Chunks</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {documents.map((doc) => (
                <React.Fragment key={doc.DocumentId}>
                  <tr className="hover:bg-indigo-50/30 transition">
                    <td className="py-3 px-4 font-medium text-slate-900 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="truncate max-w-xs">{doc.FileName}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                        {doc.FileType}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-500 font-mono">
                      {(doc.FileSize / 1024).toFixed(1)} KB
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                        {doc.ChunkCount} chunks (VECTOR[768])
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200">
                        ✓ In MS SQL
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleViewChunks(doc.DocumentId)}
                          className={`p-1.5 rounded-lg border transition cursor-pointer text-xs flex items-center gap-1 ${
                            selectedDocId === doc.DocumentId
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                          title="View vector chunks in MS SQL"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">
                            {selectedDocId === doc.DocumentId ? 'Close Chunks' : 'Inspect Vectors'}
                          </span>
                        </button>
                        <button
                          onClick={() => handleDelete(doc.DocumentId, doc.FileName)}
                          className="p-1.5 rounded-lg bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 transition cursor-pointer"
                          title="Delete from MS SQL"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded Chunks View */}
                  {selectedDocId === doc.DocumentId && (
                    <tr>
                      <td colSpan={6} className="bg-slate-900 p-4 text-slate-100 border-y border-slate-800">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                            <span className="font-mono text-xs text-indigo-300 font-semibold">
                              dbo.DocumentChunks for &quot;{doc.FileName}&quot;
                            </span>
                            <span className="text-[11px] text-slate-400">
                              Native Vector Type: VECTOR(768) | DiskANN Index
                            </span>
                          </div>

                          {isLoadingChunks ? (
                            <div className="text-center py-4 text-slate-400 text-xs">
                              Loading chunks from MS SQL Server...
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
                              {docChunks.map((chunk, idx) => (
                                <div key={chunk.ChunkId} className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-2">
                                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                                    <span className="font-bold text-indigo-400 font-mono">
                                      Chunk #{idx + 1}
                                    </span>
                                    <span className="font-mono text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/50">
                                      768 dimensions
                                    </span>
                                  </div>
                                  <p className="text-slate-300 whitespace-pre-wrap text-[11px] leading-relaxed line-clamp-4">
                                    {chunk.Content}
                                  </p>
                                  {chunk.Embedding && (
                                    <div className="text-[10px] font-mono text-slate-500 truncate pt-1 border-t border-slate-800">
                                      VECTOR: [{chunk.Embedding.slice(0, 4).map((n) => n.toFixed(3)).join(', ')}... (768 dims)]
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
