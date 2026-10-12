import React, { useState, useEffect, useRef } from 'react';
import { Bot, X, Send, Mic, MicOff, Volume2, Square, Copy, Check, Sparkles, RefreshCw, AlertCircle, ArrowRight } from 'lucide-react';
import { sendAIChat } from '../services/api';

const SUGGESTED_PROMPTS = [
  "How do I report a broken lift or obstacle?",
  "How can I extract text from an image and hear it?",
  "Show me live speech captions for deaf assistance",
  "How does Indian Sign Language recognition work?",
  "Help me prepare an emergency SOS alert",
  "What accessibility features are available?"
];

export default function AIAssistant({ isOpen, onClose, onNavigate, currentPage }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hello! I am your **AccessAble AI Assistant**. I can help you report obstacles, navigate accessible routes, extract text from signs, generate live captions, prepare emergency alerts, or translate Indian Sign Language.\n\nHow can I support your accessibility needs today?"
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [speakingIndex, setSpeakingIndex] = useState(null);

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Voice speech-to-text input setup
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        const spoken = event.results[0][0].transcript;
        setInput((prev) => (prev ? prev + ' ' + spoken : spoken));
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleMic = () => {
    if (!recognitionRef.current) {
      alert('Speech-to-text is not supported by your browser.');
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch {
        setIsListening(false);
      }
    }
  };

  const handleSend = async (textToSend = input) => {
    const query = textToSend.trim();
    if (!query || isLoading) return;

    const newMessages = [...messages, { role: 'user', content: query }];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const res = await sendAIChat(newMessages, { current_page: currentPage });
      setMessages([...newMessages, { 
        role: 'assistant', 
        content: res.reply,
        toolAction: res.tool_action 
      }]);

      // If tool action says navigate and user clicked suggested intent
      if (res.tool_action && res.tool_action.type === 'navigate' && onNavigate) {
        // give option to navigate
      }
    } catch (err) {
      setMessages([...newMessages, {
        role: 'assistant',
        content: "I encountered an error connecting to the AI backend. Please verify that the FastAPI backend is running on port 8000."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = async (text, idx) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(idx);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {}
  };

  const handleSpeak = (text, idx) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    if (speakingIndex === idx) {
      setSpeakingIndex(null);
      return;
    }

    const cleanText = text.replace(/[*_#`]/g, '');
    const u = new SpeechSynthesisUtterance(cleanText);
    u.rate = 1.0;
    u.onend = () => setSpeakingIndex(null);
    u.onerror = () => setSpeakingIndex(null);
    setSpeakingIndex(idx);
    window.speechSynthesis.speak(u);
  };

  const handleClearChat = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setSpeakingIndex(null);
    setMessages([
      {
        role: 'assistant',
        content: "Conversation cleared. How can I assist you?"
      }
    ]);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="AccessAble AI Assistant Window">
      <div 
        className="modal-card" 
        style={{ 
          maxWidth: '680px', 
          height: '85vh', 
          display: 'flex', 
          flexDirection: 'column', 
          padding: '1.5rem',
          border: '2px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--primary)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={24} aria-hidden="true" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>AccessAble AI Assistant</h2>
                <span className="badge badge-online" style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem' }}>
                  Online
                </span>
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Intelligent Accessibility Assistant & Navigation Guide
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button 
              className="btn btn-outline" 
              style={{ minHeight: '36px', padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
              onClick={handleClearChat}
              aria-label="Clear chat conversation"
            >
              <RefreshCw size={14} aria-hidden="true" /> Clear
            </button>
            <button 
              className="btn btn-outline" 
              style={{ minHeight: '36px', minWidth: '36px', padding: '0.35rem' }}
              onClick={onClose}
              aria-label="Close assistant"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Message Stream */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 0', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {messages.map((m, idx) => (
            <div 
              key={idx} 
              style={{ 
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                backgroundColor: m.role === 'user' ? 'var(--primary)' : 'var(--bg-surface-hover)',
                color: m.role === 'user' ? '#FFFFFF' : 'var(--text-primary)',
                padding: '1rem 1.25rem',
                borderRadius: 'var(--radius-lg)',
                border: m.role === 'user' ? 'none' : '1px solid var(--border-color)',
                lineHeight: 1.6
              }}
            >
              <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.95rem' }}>
                {m.content}
              </div>

              {/* Action trigger button if toolAction present */}
              {m.toolAction && m.toolAction.page && onNavigate && (
                <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                  <button 
                    className="btn btn-primary"
                    style={{ minHeight: '36px', padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
                    onClick={() => {
                      onNavigate(m.toolAction.page);
                      onClose();
                    }}
                  >
                    Open {m.toolAction.page.toUpperCase()} <ArrowRight size={14} aria-hidden="true" />
                  </button>
                </div>
              )}

              {/* Assistant Message Actions (TTS, Copy) */}
              {m.role === 'assistant' && (
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed var(--border-color)' }}>
                  <button 
                    className="btn btn-outline" 
                    style={{ minHeight: '28px', minWidth: '28px', padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                    onClick={() => handleSpeak(m.content, idx)}
                    aria-label={speakingIndex === idx ? 'Stop speaking' : 'Speak answer aloud'}
                  >
                    {speakingIndex === idx ? <Square size={12} aria-hidden="true" /> : <Volume2 size={12} aria-hidden="true" />}
                    {speakingIndex === idx ? 'Stop' : 'Listen'}
                  </button>

                  <button 
                    className="btn btn-outline" 
                    style={{ minHeight: '28px', minWidth: '28px', padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                    onClick={() => handleCopy(m.content, idx)}
                    aria-label="Copy answer to clipboard"
                  >
                    {copiedIndex === idx ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
                    {copiedIndex === idx ? 'Copied' : 'Copy'}
                  </button>
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div style={{ alignSelf: 'flex-start', padding: '0.75rem 1rem', backgroundColor: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-lg)' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Thinking & analyzing platform data...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Prompts */}
        {messages.length <= 2 && (
          <div 
            style={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: '0.45rem', 
              padding: '0.35rem 0 0.75rem 0'
            }}
          >
            {SUGGESTED_PROMPTS.map((p, i) => (
              <button 
                key={i} 
                type="button"
                style={{ 
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.4rem 0.8rem', 
                  fontSize: '0.8rem', 
                  fontWeight: 600,
                  borderRadius: '20px',
                  backgroundColor: 'var(--bg-surface-hover)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  lineHeight: 1.3,
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-card)';
                  e.currentTarget.style.borderColor = 'var(--primary)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)';
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                onClick={() => handleSend(p)}
                aria-label={`Ask: ${p}`}
              >
                <Sparkles size={13} style={{ color: 'var(--primary)', flexShrink: 0 }} aria-hidden="true" />
                <span>{p}</span>
              </button>
            ))}
          </div>
        )}

        {/* Input Composer */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
          <button 
            type="button" 
            className={`btn ${isListening ? 'btn-danger' : 'btn-outline'}`}
            style={{ minHeight: '48px', minWidth: '48px', padding: '0.75rem' }}
            onClick={toggleMic}
            aria-label={isListening ? 'Stop microphone' : 'Speak message into microphone'}
          >
            {isListening ? <MicOff size={20} aria-hidden="true" /> : <Mic size={20} aria-hidden="true" />}
          </button>

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question or request platform help (Enter to send, Shift+Enter for new line)..."
            style={{ 
              flex: 1, 
              minHeight: '48px', 
              maxHeight: '120px', 
              padding: '0.75rem', 
              fontSize: '0.95rem',
              resize: 'none',
              borderRadius: 'var(--radius-sm)',
              border: '2px solid var(--border-color)'
            }}
            aria-label="Type message to AI assistant"
          />

          <button 
            type="button" 
            className="btn btn-primary"
            style={{ minHeight: '48px', minWidth: '48px', padding: '0.75rem' }}
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            aria-label="Send message"
          >
            <Send size={20} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
