import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Send,
  Bot,
  User,
  HelpCircle,
  Clock,
  Sparkles,
  Search,
  MessageSquare,
  FileText,
  Upload,
} from 'lucide-react';
import { ChatMessage, SearchResultChunk } from '../types/rag';
import { sendRagQuery } from '../services/api';

interface AgentQAProps {
  onNavigateToDocs: () => void;
  documentCount: number;
  onErrorOccurred?: (err: any) => void;
}

export const AgentQA: React.FC<AgentQAProps> = ({
  onNavigateToDocs,
  documentCount,
  onErrorOccurred,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-msg',
      role: 'agent',
      text: `Hello! I am Genie your AI Agent.

**Workflow when you send a message:**
1. **Vector Conversion**: Your prompt is converted to a 768-dimensional vector embedding.
2. **MS SQL Vector Search**: Queries our MS SQL Server database to fetch existing vectors and compute cosine similarity (\`VECTOR_DISTANCE('cosine')\`).
3. **Gemini LLM Prompting**: The retrieved vector context is passed to Gemini 3.8 Flash.
4. **Answer & Clarification**: An authoritative, grounded response is generated with source citations, and I will proactively ask clarifying questions if needed!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [topK, setTopK] = useState(4);
  const [minSimilarity, setMinSimilarity] = useState(0.2);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (queryToSend?: string) => {
    const query = (queryToSend || inputQuery).trim();
    if (!query || isLoading) return;

    setInputQuery('');

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const historyPayload = messages
        .filter((m) => m.id !== 'init-msg')
        .slice(-6)
        .map((m) => ({
          role: m.role,
          text: m.text,
        }));

      const response = await sendRagQuery(query, topK, minSimilarity, historyPayload);

      const agentMsg: ChatMessage = {
        id: `agent-${Date.now()}`,
        role: 'agent',
        text: response.answer,
        clarification: response.clarificationQuestion,
        retrievedChunks: response.retrievedChunks,
        sqlExecutionQuery: response.sqlExecutionQuery,
        searchTimeMs: response.searchTimeMs,
        llmTimeMs: response.llmTimeMs,
        modelUsed: response.modelUsed,
        confidenceScore: response.confidenceScore,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, agentMsg]);
    } catch (err: any) {
      if (onErrorOccurred && err.type) {
        onErrorOccurred(err);
      }
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'agent',
        text: `⚠️ **${err.title || 'Error connecting to RAG backend'}**\n\n${err.message || 'Unknown error'}\n\n👉 *Remediation:* ${err.remediation || 'Please verify that the .NET API and MS SQL Server are running.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClarificationClick = (clarificationText: string) => {
    handleSend(`Regarding your question: "${clarificationText}" - please provide full details and standard policy recommendations.`);
  };

  const starterPrompts = [
    'What is our disaster recovery RPO and RTO SLA target?',
    'How many weeks of fully paid parental leave are primary caregivers entitled to?',
    'What is the network isolation protocol during a security breach?',
    'What wellness stipends and remote allowances do employees receive?',
  ];

  return (
    <div className="flex flex-col h-[740px] bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Agent Header */}
      <div className="p-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-rose-500 p-0.5 flex items-center justify-center shadow-sm">
            <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center">
              <Bot className="w-5 h-5 text-indigo-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-white">
                Agent Q&amp;A (Vector + Gemini)
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Live RAG
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Query &rarr; Vectorize &rarr; MS SQL Cosine Search &rarr; Gemini LLM &rarr; Answer &amp; Clarification
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-2 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700/80">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">Top-K:</span>
            <select
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              className="bg-slate-900 text-slate-200 rounded px-1.5 py-0.5 text-xs border border-slate-700 font-mono"
            >
              <option value={2}>2 chunks</option>
              <option value={4}>4 chunks</option>
              <option value={6}>6 chunks</option>
            </select>
          </div>

          <button
            onClick={onNavigateToDocs}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Files</span>
          </button>
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-50/50">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-4xl ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center shadow-2xs ${
                  isUser
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-900 text-indigo-400 border border-slate-800'
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              {/* Message Bubble */}
              <div
                className={`rounded-2xl px-4 py-3.5 text-xs sm:text-sm leading-relaxed max-w-[88%] shadow-xs ${
                  isUser
                    ? 'bg-indigo-600 text-white rounded-tr-xs'
                    : 'bg-white text-slate-800 border border-slate-200/90 rounded-tl-xs'
                }`}
              > 
                {/* Body Content with Markdown Support */}
                {isUser ? (
                  <div className="whitespace-pre-wrap">{msg.text}</div>
                ) : (
                  <div className="text-slate-800 leading-relaxed space-y-2">
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                        strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
                        ul: ({ children }) => <ul className="list-disc list-outside pl-4 space-y-1 mb-2.5">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal list-outside pl-4 space-y-1.5 mb-2.5">{children}</ol>,
                        li: ({ children }) => <li className="leading-relaxed pl-0.5">{children}</li>,
                        code: ({ children }) => (
                          <code className="px-1.5 py-0.5 rounded bg-slate-100 text-indigo-700 font-mono text-[11px] sm:text-xs border border-slate-200">
                            {children}
                          </code>
                        ),
                        pre: ({ children }) => (
                          <pre className="p-3 rounded-lg bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto my-2.5">
                            {children}
                          </pre>
                        ),
                        blockquote: ({ children }) => (
                          <blockquote className="border-l-3 border-indigo-400 pl-3 py-1 my-2 bg-indigo-50/50 rounded-r text-slate-700 italic">
                            {children}
                          </blockquote>
                        ),
                        h1: ({ children }) => <h1 className="font-bold text-slate-900 text-base mt-2 mb-1">{children}</h1>,
                        h2: ({ children }) => <h2 className="font-bold text-slate-900 text-sm mt-2 mb-1">{children}</h2>,
                        h3: ({ children }) => <h3 className="font-bold text-slate-900 text-xs sm:text-sm mt-2 mb-1">{children}</h3>,
                        hr: () => <hr className="border-slate-200 my-2.5" />
                      }}
                    >
                      {msg.text
                        .replace(/^>\s*💡\s*\*\*Note:\*\*[\s\S]*?(?=\n\n|\n[A-Z]|$)/i, '')
                        .trim() || msg.text}
                    </ReactMarkdown>
                  </div>
                )}
                
                {/* Direct LLM Knowledge Notice Callout */}
                {!isUser && (msg.text.includes('Note: This answer is provided directly by the AI model') || msg.text.includes('LLM knowledge')) && (
                  <div className="mb-3 p-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-950 text-xs flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-sky-900 mb-0.5">No matching records were found. Answer from LLM.</div> 
                    </div>
                  </div>
                )}

                {/* Agent Proactive Clarifying Question Box */}
                {!isUser && msg.clarification && (
                  <div className="mt-3.5 p-3.5 rounded-xl bg-amber-50/90 border border-amber-300 text-amber-950 text-xs">
                    <div className="font-bold flex items-center gap-1.5 text-amber-900 mb-1">
                      <HelpCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Agent Clarifying Question:</span>
                    </div>
                    <p className="text-amber-900 font-medium leading-relaxed">{msg.clarification}</p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <button
                        onClick={() => handleClarificationClick(msg.clarification || '')}
                        className="px-3 py-1 bg-white hover:bg-amber-100 text-amber-900 font-semibold rounded-lg border border-amber-300 transition text-[11px] shadow-2xs cursor-pointer flex items-center gap-1"
                      >
                        <MessageSquare className="w-3 h-3 text-amber-700" />
                        <span>Answer this clarification</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Grounded MS SQL Chunks */}
                {!isUser && msg.retrievedChunks && msg.retrievedChunks.length > 0 && (
                  <div className="mt-3.5 pt-3 border-t border-slate-100 text-[11px]">
                    <div className="font-semibold text-slate-700 flex items-center gap-1 mb-1.5">
                      <FileText className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Retrieved from MS SQL Server (Cosine Similarity):</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.retrievedChunks.map((chunk) => (
                        <div
                          key={chunk.ChunkId}
                          className="bg-indigo-50/80 text-indigo-900 border border-indigo-200/80 rounded-md px-2 py-1 font-mono text-[10px]"
                        >
                          <span className="font-bold">{chunk.FileName}</span> (Part {chunk.ChunkIndex + 1}) —{' '}
                          <span className="text-emerald-700 font-semibold">
                            {(chunk.SimilarityScore * 100).toFixed(0)}% match
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer Metadata */}
                <div
                  className={`mt-2 flex items-center justify-between gap-3 text-[10px] ${
                    isUser ? 'text-indigo-200' : 'text-slate-400'
                  }`}
                >
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{msg.timestamp}</span>
                  </span>
                  {!isUser && msg.searchTimeMs !== undefined && (
                    <span className="font-mono text-[10px] text-slate-500">
                      MS SQL: {msg.searchTimeMs}ms • LLM: {msg.llmTimeMs}ms
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex gap-3 max-w-xl mr-auto">
            <div className="w-8 h-8 rounded-xl shrink-0 bg-slate-900 text-indigo-400 flex items-center justify-center border border-slate-800">
              <Bot className="w-4 h-4 animate-pulse" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-xs px-4 py-3 shadow-xs text-xs text-slate-600 flex items-center gap-3">
              <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin shrink-0" />
              <span>
                1. Vectorizing question &rarr; 2. Querying MS SQL Server (<code className="font-mono text-[11px] text-indigo-700">VECTOR_DISTANCE</code>) &rarr; 3. Prompting Gemini AI...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Starter Prompts */}
      <div className="px-4 py-2 bg-slate-50 border-t border-slate-200/80 overflow-x-auto flex gap-2">
        {starterPrompts.map((p, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(p)}
            className="text-[11px] font-medium px-3 py-1 rounded-full bg-white hover:bg-indigo-50 border border-slate-200 text-slate-700 hover:text-indigo-700 whitespace-nowrap transition cursor-pointer shadow-2xs"
          >
            💡 {p}
          </button>
        ))}
      </div>

      {/* Input Bar */}
      <div className="p-3 sm:p-4 bg-white border-t border-slate-200">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Ask questions about SLA, employee benefits, or disaster recovery runbooks..."
            className="flex-1 px-4 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
          />
          <button
            type="submit"
            disabled={isLoading || !inputQuery.trim()}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold rounded-xl transition cursor-pointer shrink-0 shadow-xs"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Ask Agent</span>
          </button>
        </form>
      </div>
    </div>
  );
};
