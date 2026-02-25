'use client';

import {
  ChevronDown,
  ChevronRight,
  FileText,
  FolderUp,
  Menu,
  MessageSquarePlus,
  Send,
  Settings,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import ReactMarkdown from 'react-markdown';
import DocumentTree from './components/DocumentTree';
import PasswordGate from './components/PasswordGate';
import SettingsModal, { loadSettings } from './components/SettingsModal';
import type {
  ChatResponse,
  ChatSettings,
  Document,
  DocumentsResponse,
  Message,
  UploadResponse,
} from './types';
import { DEFAULT_SETTINGS } from './types';

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(320); // Default 320px (was w-80 = 20rem = 320px)
  const [isResizing, setIsResizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<ChatSettings>(DEFAULT_SETTINGS);
  const [expandedSources, setExpandedSources] = useState<Set<number>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const tokenStats = useMemo(() => {
    // Token counting with model context limits
    const MODEL_CONTEXT_LIMITS: Record<string, number> = {
      'gpt-4o-mini': 128000,
      'gpt-4o': 128000,
      'gpt-3.5-turbo': 16385,
    };

    try {
      // Use a simpler estimation: ~4 chars per token
      let totalTokens = 0;

      // Count tokens in system prompt
      totalTokens += Math.ceil(settings.system_prompt.length / 4);

      // Count tokens in messages
      messages.forEach((msg) => {
        totalTokens += Math.ceil(msg.content.length / 4) + 4;
        if (msg.sources) {
          msg.sources.forEach((source) => {
            totalTokens += Math.ceil((source.text || '').length / 4);
          });
        }
      });

      const contextLimit = MODEL_CONTEXT_LIMITS[settings.chat_model] || 128000;
      const percentage = Math.min(100, Math.round((totalTokens / contextLimit) * 100));

      return { totalTokens, contextLimit, percentage };
    } catch (err) {
      console.error('Token counting error:', err);
      return { totalTokens: 0, contextLimit: 128000, percentage: 0 };
    }
  }, [messages, settings.system_prompt, settings.chat_model]);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch('/backend/documents');
      if (res.ok) {
        const data: DocumentsResponse = await res.json();
        setDocuments(data.documents || []);
        // Auto-select all documents by default
        setSelectedDocIds((data.documents || []).map((d) => d.id));
      }
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    }
  }, []);

  // Load settings on mount
  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  // Fetch documents on mount
  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/backend/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          history: messages.map(({ role, content }) => ({ role, content })), // Only send role and content, not sources
          settings: settings,
          document_ids: selectedDocIds.length > 0 && selectedDocIds.length < documents.length
            ? selectedDocIds
            : undefined, // undefined means search all
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to get response');
      }

      const data: ChatResponse = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.answer,
          sources: data.sources,
        },
      ]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const processFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    setIsUploading(true);
    setError(null);

    const supportedExtensions = ['.pdf', '.docx', '.pptx', '.txt', '.md', '.csv'];
    const validFiles = files.filter((f) =>
      supportedExtensions.some((ext) => f.name.toLowerCase().endsWith(ext))
    );

    if (validFiles.length === 0) {
      setError('No supported files found. Please upload PDF, DOCX, PPTX, TXT, MD, or CSV files.');
      setIsUploading(false);
      return;
    }

    let successCount = 0;
    let failCount = 0;

    // Determine if we're uploading a folder (check first file for path info)
    const firstFile = validFiles[0] as File & { webkitRelativePath?: string; path?: string };
    const firstPath = firstFile.webkitRelativePath || firstFile.path || '';
    const isFolder = firstPath.includes('/');
    const folderName = isFolder ? firstPath.split('/')[0] : null;

    // Size threshold for using server-side upload proxy (4MB)
    const BLOB_UPLOAD_THRESHOLD = 4 * 1024 * 1024;
    for (const file of validFiles) {
      try {
        const fileWithPath = file as File & { webkitRelativePath?: string; path?: string };

        // Get the full path (webkitRelativePath from folder input, path from drag/drop)
        const fullPath = fileWithPath.webkitRelativePath || fileWithPath.path || '';

        // Display progress
        const displayName = folderName
          ? `${folderName} (${successCount + failCount + 1}/${validFiles.length})`
          : file.name;
        setUploadStatus(`Uploading ${displayName}... Do not refresh the page.`);

        // Prepare form data
        const formData = new FormData();
        formData.append('file', file);

        // Build the final filename path
        // Clean up the path by removing leading ./ and /
        let finalFilename = fullPath || file.name;

        // Remove leading ./ or / from the path
        finalFilename = finalFilename.replace(/^\.\//, '').replace(/^\//, '');

        // If after cleanup there's no path (just filename), use file.name
        if (!finalFilename || finalFilename === file.name) {
          finalFilename = file.name;
        }

        console.log('Uploading file:', file.name, 'with path:', finalFilename, 'size:', file.size);

        let data: UploadResponse;

        // Choose upload method based on file size
        if (file.size > BLOB_UPLOAD_THRESHOLD) {
          // Large files: Use chunked multipart upload via server to bypass 4.5MB serverless body limit.
          // Splits file into chunks, uploads each through /api/upload-chunk, then processes the blob.
          const CHUNK_SIZE = 3.5 * 1024 * 1024; // 3.5MB chunks (well within 4.5MB serverless limit)
          const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
          console.log(`Using chunked upload for ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB, ${totalChunks} chunks)`);

          // Step 1: Create multipart upload
          const createRes = await fetch('/api/upload-chunk?action=create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: finalFilename }),
          });
          if (!createRes.ok) {
            const errData = await createRes.json().catch(() => ({}));
            throw new Error(errData.error || 'Failed to start chunked upload');
          }
          const { uploadId, key } = await createRes.json();

          // Step 2: Upload each chunk as a part
          const parts: Array<{ etag: string; partNumber: number }> = [];
          for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, file.size);
            const chunk = file.slice(start, end);
            const partNumber = i + 1; // 1-indexed

            setUploadStatus(`Uploading ${displayName}... (part ${partNumber}/${totalChunks}) Do not refresh the page.`);

            const partFormData = new FormData();
            partFormData.append('chunk', chunk);
            partFormData.append('uploadId', uploadId);
            partFormData.append('key', key);
            partFormData.append('partNumber', String(partNumber));

            const partRes = await fetch('/api/upload-chunk?action=part', {
              method: 'POST',
              body: partFormData,
            });
            if (!partRes.ok) {
              const errData = await partRes.json().catch(() => ({}));
              throw new Error(errData.error || `Failed to upload part ${partNumber}`);
            }
            const partData = await partRes.json();
            parts.push({ etag: partData.etag, partNumber: partData.partNumber });
          }

          // Step 3: Complete multipart upload
          setUploadStatus(`Processing ${displayName}... Do not refresh the page.`);
          const completeRes = await fetch('/api/upload-chunk?action=complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uploadId, key, parts }),
          });
          if (!completeRes.ok) {
            const errData = await completeRes.json().catch(() => ({}));
            throw new Error(errData.error || 'Failed to complete chunked upload');
          }
          const { url: blobUrl } = await completeRes.json();

          // Step 4: Process the blob via backend
          console.log(`Chunked upload complete: ${blobUrl}, sending for processing...`);
          const res = await fetch('/api/upload-large', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: blobUrl, filename: finalFilename }),
          });
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || errData.detail || 'Upload failed');
          }

          data = await res.json();
        } else {
          // Small files: Direct upload
          console.log(`Using direct upload for ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

          formData.append('filename', finalFilename);

          const res = await fetch('/backend/upload', {
            method: 'POST',
            body: formData,
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.detail || 'Upload failed');
          }

          data = await res.json();
        }

        successCount++;

        // Add the new document to selection
        if (data.document_id && !data.document_id.startsWith('temp_')) {
          setSelectedDocIds((prev) => [...prev, data.document_id]);
        }
      } catch (err) {
        console.error(`Failed to upload ${file.name}:`, err);
        failCount++;
      }
    }

    await fetchDocuments();

    if (failCount === 0) {
      const message = folderName
        ? `✓ Uploaded folder "${folderName}" (${successCount} file${successCount !== 1 ? 's' : ''})`
        : `✓ Uploaded ${successCount} file${successCount !== 1 ? 's' : ''}`;
      setUploadStatus(message);
    } else {
      const message = folderName
        ? `✓ Folder "${folderName}": ${successCount} uploaded, ✗ ${failCount} failed`
        : `✓ ${successCount} uploaded, ✗ ${failCount} failed`;
      setUploadStatus(message);
    }

    setIsUploading(false);
    setTimeout(() => setUploadStatus(null), 3000);
  }, [fetchDocuments]);

  const onDrop = useCallback(async (acceptedFiles: File[], _fileRejections: unknown, event: any) => {
    // Try to extract folder structure from drag event
    const items = event?.dataTransfer?.items;
    if (items) {
      const filesWithPaths: Array<File & { path?: string }> = [];

      // Helper to traverse directory entries recursively
      const traverseFileTree = async (item: any, parentPath = ''): Promise<void> => {
        return new Promise((resolve) => {
          if (item.isFile) {
            item.file((file: File) => {
              const fileWithPath = file as File & { path?: string };
              // Build the full path: parentPath already includes trailing slash if not empty
              fileWithPath.path = parentPath + file.name;
              filesWithPaths.push(fileWithPath);
              resolve();
            });
          } else if (item.isDirectory) {
            const dirReader = item.createReader();
            dirReader.readEntries(async (entries: any[]) => {
              // Add this directory to the path with trailing slash
              const newPath = parentPath + item.name + '/';
              for (const entry of entries) {
                await traverseFileTree(entry, newPath);
              }
              resolve();
            });
          } else {
            resolve();
          }
        });
      };

      // Process all dropped items
      const promises = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i].webkitGetAsEntry();
        if (item) {
          promises.push(traverseFileTree(item, ''));
        }
      }

      await Promise.all(promises);

      if (filesWithPaths.length > 0) {
        await processFiles(filesWithPaths);
        return;
      }
    }

    // Fallback to regular files if no path info available
    await processFiles(acceptedFiles);
  }, [processFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      'text/csv': ['.csv'],
    },
    disabled: isUploading,
  });

  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      await processFiles(Array.from(files));
    }
    // Reset input so same folder can be selected again
    e.target.value = '';
  };

  const deleteDocument = async (id: string) => {
    try {
      const res = await fetch(`/backend/documents/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSelectedDocIds((prev) => prev.filter((sid) => sid !== id));
        await fetchDocuments();
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const suggestedQuestions = [
    'What are the key concepts in my uploaded materials?',
    'Summarize the main points from my documents',
    'Help me understand the frameworks discussed',
    'What are the practical applications mentioned?',
  ];

  const searchScope = selectedDocIds.length === 0 || selectedDocIds.length === documents.length
    ? 'all documents'
    : `${selectedDocIds.length} selected document${selectedDocIds.length !== 1 ? 's' : ''}`;

  const handleNewChat = () => {
    if (messages.length > 0 && !confirm('Start a new chat? Current conversation will be cleared.')) {
      return;
    }
    setMessages([]);
    setInput('');
    setError(null);
    setExpandedSources(new Set());
  };

  const toggleSources = (messageIndex: number) => {
    const newExpanded = new Set(expandedSources);
    if (newExpanded.has(messageIndex)) {
      newExpanded.delete(messageIndex);
    } else {
      newExpanded.add(messageIndex);
    }
    setExpandedSources(newExpanded);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      // Set min width to 240px and max width to 600px
      const newWidth = Math.min(Math.max(e.clientX, 240), 600);
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      // Prevent text selection while resizing
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing]);

  return (
    <PasswordGate>
      <div className="flex h-screen bg-slate-50">
        {/* Error Banner */}
        {error && (
          <div className="fixed top-0 left-0 right-0 z-50 bg-red-500 text-white px-4 py-2 text-center text-sm">
            {error}
            <button onClick={() => setError(null)} className="ml-4 hover:underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Settings Modal */}
        <SettingsModal
          key={settingsOpen ? 'open' : 'closed'}
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          settings={settings}
          onSave={setSettings}
        />

        {/* Sidebar */}
        <aside
          className="bg-white border-r border-slate-200 flex flex-col overflow-hidden flex-shrink-0 relative"
          style={{
            width: sidebarOpen ? `${sidebarWidth}px` : '0px',
            transition: isResizing ? 'none' : 'width 0.3s'
          }}
        >
          <div className="p-4 border-b border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-800">Documents</h2>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1 hover:bg-slate-100 rounded lg:hidden"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            {/* Upload Area */}
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
                ${isDragActive ? 'border-columbia-500 bg-columbia-50' : 'border-slate-300 hover:border-columbia-400 hover:bg-slate-50'}
                ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <input {...getInputProps()} />
              <Upload className="w-6 h-6 mx-auto mb-2 text-slate-400" />
              <p className="text-sm text-slate-600">
                {isDragActive ? 'Drop files here' : 'Drag & drop files'}
              </p>
              <p className="text-xs text-slate-400 mt-1">PDF, DOCX, PPTX, TXT, MD, CSV</p>
            </div>

            {/* Folder Upload Button */}
            <input
              ref={folderInputRef}
              type="file"
              /* @ts-expect-error webkitdirectory is not in React types */
              webkitdirectory=""
              multiple
              className="hidden"
              onChange={handleFolderUpload}
            />
            <button
              onClick={() => folderInputRef.current?.click()}
              disabled={isUploading}
              className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <FolderUp className="w-4 h-4" />
              Upload Folder
            </button>

            {uploadStatus && (
              <p
                className={`mt-2 text-sm ${
                  uploadStatus.startsWith('✓')
                    ? 'text-green-600'
                    : uploadStatus.startsWith('✗')
                    ? 'text-red-600'
                    : 'text-slate-600'
                }`}
              >
                {uploadStatus}
              </p>
            )}
          </div>

          {/* Document Tree */}
          <div className="flex-1 overflow-y-auto p-4">
            {documents.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">
                No documents yet. Upload some to get started!
              </p>
            ) : (
              <DocumentTree
                documents={documents}
                selectedIds={selectedDocIds}
                onSelectionChange={setSelectedDocIds}
                onDelete={deleteDocument}
              />
            )}
          </div>

          {/* Resize Handle */}
          {sidebarOpen && (
            <div
              onMouseDown={handleMouseDown}
              className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-columbia-400 transition-colors group"
              style={{
                backgroundColor: isResizing ? '#93c5fd' : 'transparent'
              }}
            >
              <div className="absolute top-0 right-0 w-1 h-full group-hover:w-1 group-hover:bg-columbia-500" />
            </div>
          )}
        </aside>

        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            >
              <Menu className="w-5 h-5 text-slate-600" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-semibold text-slate-800">MBA Copilot</h1>
              <div className="flex items-center gap-3">
                <p className="text-sm text-slate-500 hidden sm:block">
                  Searching {searchScope}
                </p>
                {messages.length > 0 && (
                  <div className="hidden sm:flex items-center gap-2">
                    <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          tokenStats.percentage > 80
                            ? 'bg-red-500'
                            : tokenStats.percentage > 50
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                        }`}
                        style={{ width: `${tokenStats.percentage}%` }}
                      />
                    </div>
                    <span
                      className={`text-xs font-medium ${
                        tokenStats.percentage > 80
                          ? 'text-red-600'
                          : tokenStats.percentage > 50
                          ? 'text-yellow-600'
                          : 'text-slate-500'
                      }`}
                      title={`${tokenStats.totalTokens.toLocaleString()} / ${tokenStats.contextLimit.toLocaleString()} tokens`}
                    >
                      {tokenStats.percentage}%
                    </span>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={handleNewChat}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title="New Chat"
            >
              <MessageSquarePlus className="w-5 h-5 text-slate-600" />
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title="Settings"
            >
              <Settings className="w-5 h-5 text-slate-600" />
            </button>
          </header>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {messages.length === 0 ? (
              <div className="max-w-2xl mx-auto text-center py-8 sm:py-12">
                <Sparkles className="w-12 h-12 mx-auto mb-4 text-columbia-500" />
                <h2 className="text-2xl font-semibold text-slate-800 mb-2">
                  Welcome to MBA Copilot
                </h2>
                <p className="text-slate-600 mb-8">
                  Upload your course materials and ask questions. I&apos;ll help you understand
                  concepts, summarize readings, and prepare for discussions.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {suggestedQuestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => setInput(q)}
                      className="p-3 text-left text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:border-columbia-400 hover:bg-columbia-50 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto space-y-6">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[90%] sm:max-w-[85%] ${
                        msg.role === 'user'
                          ? 'bg-columbia-600 text-white'
                          : 'bg-white border border-slate-200'
                      } rounded-2xl px-4 py-3 shadow-sm`}
                    >
                      <div
                        className={`markdown-content ${
                          msg.role === 'user' ? 'text-white' : 'text-slate-700'
                        }`}
                      >
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-slate-200">
                          <button
                            onClick={() => toggleSources(i)}
                            className="flex items-center gap-2 text-xs font-semibold text-slate-700 uppercase tracking-wide hover:text-columbia-600 transition-colors w-full"
                          >
                            {expandedSources.has(i) ? (
                              <ChevronDown className="w-4 h-4 text-columbia-500" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-columbia-500" />
                            )}
                            <span className="w-1 h-4 bg-columbia-500 rounded"></span>
                            Sources Used ({msg.sources.length})
                          </button>
                          {expandedSources.has(i) && (
                            <div className="space-y-2.5 mt-3">
                              {msg.sources.map((source, j) => (
                                <div
                                  key={j}
                                  className="bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 rounded-lg p-3 hover:shadow-sm transition-shadow"
                                >
                                  <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2 flex-1">
                                      <FileText className="w-3.5 h-3.5 text-columbia-600 flex-shrink-0" />
                                      <span className="font-semibold text-slate-800 text-xs">
                                        {source.filename}
                                      </span>
                                    </div>
                                    <span className="text-xs font-bold text-columbia-600 bg-columbia-100 px-2 py-0.5 rounded-full">
                                      {Math.round(source.score * 100)}%
                                    </span>
                                  </div>
                                  {source.text && (
                                    <p className="text-xs text-slate-600 leading-relaxed italic border-l-2 border-columbia-300 pl-3 py-1 bg-white/50 rounded">
                                      &ldquo;{source.text.length > 200 ? source.text.substring(0, 200) + '...' : source.text}&rdquo;
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm">
                      <div className="flex gap-1.5">
                        <div className="w-2 h-2 bg-slate-400 rounded-full loading-dot" />
                        <div className="w-2 h-2 bg-slate-400 rounded-full loading-dot" />
                        <div className="w-2 h-2 bg-slate-400 rounded-full loading-dot" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-slate-200 bg-white p-4">
            <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  documents.length === 0
                    ? 'Upload documents to get started...'
                    : `Ask about ${searchScope}...`
                }
                className="flex-1 px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-columbia-500 focus:border-transparent transition-shadow"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="px-4 py-3 bg-columbia-600 text-white rounded-xl hover:bg-columbia-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Send message"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        </main>
      </div>
    </PasswordGate>
  );
}