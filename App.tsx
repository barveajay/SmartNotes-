
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { processLectureMedia } from './services/geminiService';
import { generatePDF } from './utils/pdfGenerator';
import { SmartNotes, AppStatus, PageView, QuizItem, Flashcard } from './types';

// --- Components ---

const Navbar = ({ currentView, setView }: { currentView: PageView, setView: (v: PageView) => void }) => (
  <nav className="w-full h-16 glass-morphism sticky top-0 z-50 flex items-center px-8 justify-between shadow-sm">
    <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('HOME')}>
      <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">S</div>
      <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent hidden sm:block">
        SmartNotes AI
      </h1>
    </div>
    <div className="flex gap-4 md:gap-8 text-sm font-medium">
      {(['HOME', 'HISTORY', 'RESOURCES', 'SETTINGS'] as PageView[]).map((v) => (
        <button
          key={v}
          onClick={() => setView(v)}
          className={`transition-colors py-1 border-b-2 ${
            currentView === v ? 'text-indigo-600 border-indigo-600' : 'text-slate-500 border-transparent hover:text-indigo-400'
          }`}
        >
          {v.replace('_', ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}
        </button>
      ))}
    </div>
  </nav>
);

const PomodoroTimer = () => {
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState<'FOCUS' | 'BREAK'>('FOCUS');

  useEffect(() => {
    let interval: number;
    if (isActive && timeLeft > 0) {
      interval = window.setInterval(() => setTimeLeft(t => t - 1), 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
      const nextMode = mode === 'FOCUS' ? 'BREAK' : 'FOCUS';
      setMode(nextMode);
      setTimeLeft(nextMode === 'FOCUS' ? 25 * 60 : 5 * 60);
      alert(`${mode === 'FOCUS' ? 'Focus session' : 'Break'} finished!`);
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft, mode]);

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-6 bg-slate-900 text-white rounded-3xl shadow-xl flex flex-col items-center gap-4">
      <div className="text-xs font-bold uppercase tracking-widest text-indigo-400">{mode}</div>
      <div className="text-4xl font-mono font-bold">{formatTime(timeLeft)}</div>
      <div className="flex gap-2">
        <button 
          onClick={() => setIsActive(!isActive)}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${isActive ? 'bg-red-500 hover:bg-red-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}
        >
          {isActive ? 'Pause' : 'Start'}
        </button>
        <button 
          onClick={() => { setTimeLeft(mode === 'FOCUS' ? 25 * 60 : 5 * 60); setIsActive(false); }}
          className="px-4 py-1.5 bg-slate-700 rounded-full text-xs hover:bg-slate-600"
        >
          Reset
        </button>
      </div>
    </div>
  );
};

const QuizComponent = ({ quiz }: { quiz: QuizItem[] }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);

  const handleNext = () => {
    if (selected === quiz[currentIdx].answer) setScore(s => s + 1);
    if (currentIdx < quiz.length - 1) {
      setCurrentIdx(i => i + 1);
      setSelected(null);
    } else {
      setShowResult(true);
    }
  };

  if (showResult) {
    return (
      <div className="text-center p-8 space-y-4">
        <h4 className="text-2xl font-bold text-slate-800">Quiz Finished!</h4>
        <p className="text-4xl font-black text-indigo-600">{score} / {quiz.length}</p>
        <button onClick={() => { setShowResult(false); setCurrentIdx(0); setScore(0); setSelected(null); }} className="text-indigo-600 font-bold underline">Try Again</button>
      </div>
    );
  }

  const q = quiz[currentIdx];
  return (
    <div className="space-y-6">
      <div className="text-xs text-slate-400">Question {currentIdx + 1} of {quiz.length}</div>
      <h4 className="text-lg font-bold text-slate-800">{q.question}</h4>
      <div className="space-y-2">
        {q.options.map((opt, i) => (
          <button
            key={i}
            onClick={() => setSelected(opt)}
            className={`w-full p-4 text-left rounded-xl border-2 transition-all ${selected === opt ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-100 hover:border-slate-200'}`}
          >
            {opt}
          </button>
        ))}
      </div>
      <button 
        disabled={!selected}
        onClick={handleNext}
        className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold disabled:opacity-50"
      >
        {currentIdx === quiz.length - 1 ? 'Finish' : 'Next Question'}
      </button>
    </div>
  );
};

// --- Main App ---

const App: React.FC = () => {
  const [view, setView] = useState<PageView>('HOME');
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [notes, setNotes] = useState<SmartNotes | null>(null);
  const [history, setHistory] = useState<SmartNotes[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deepAnalysis, setDeepAnalysis] = useState(false);
  
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('smart_notes_v2');
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  const saveToHistory = (note: SmartNotes) => {
    const updated = [note, ...history].slice(0, 30);
    setHistory(updated);
    localStorage.setItem('smart_notes_v2', JSON.stringify(updated));
  };

  const processFile = async (file: Blob) => {
    setStatus(AppStatus.PROCESSING);
    setErrorMessage(null);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64 = (reader.result as string).split(',')[1];
          const result = await processLectureMedia(base64, file.type, deepAnalysis);
          setNotes(result);
          saveToHistory(result);
          setStatus(AppStatus.COMPLETED);
        } catch (err: any) {
          setErrorMessage(err.message);
          setStatus(AppStatus.ERROR);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setErrorMessage(err.message);
      setStatus(AppStatus.ERROR);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      audioChunksRef.current = [];
      mr.ondataavailable = e => audioChunksRef.current.push(e.data);
      mr.onstop = () => processFile(new Blob(audioChunksRef.current, { type: 'audio/wav' }));
      mr.start();
      setIsRecording(true);
      setStatus(AppStatus.RECORDING);
    } catch (e) { setErrorMessage("Mic error"); }
  };

  // Fix: Added stopRecording to handle the end of a recording session
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const copyAsMarkdown = () => {
    if (!notes) return;
    const md = `# ${notes.title}\n\n## Summary\n${notes.summary}\n\n## Concepts\n${notes.keyConcepts.join('\n')}\n\n## Actions\n${notes.actionItems.join('\n')}`;
    navigator.clipboard.writeText(md);
    alert("Copied as Markdown!");
  };

  // --- Views ---

  const renderHome = () => (
    <div className="space-y-12 py-10 animate-in fade-in">
      <div className="text-center space-y-4">
        <h2 className="text-5xl font-black text-slate-900">Your AI Study Partner.</h2>
        <p className="text-xl text-slate-500 max-w-2xl mx-auto">Upload lectures or documents. Get notes, quizzes, and flashcards instantly.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6 justify-center">
        <div className="w-full max-w-xs group relative">
          <input type="file" accept="audio/*,video/mp4,application/pdf" onChange={e => e.target.files?.[0] && processFile(e.target.files[0])} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
          <div className="p-8 border-2 border-dashed border-slate-200 bg-white rounded-3xl flex flex-col items-center gap-4 transition-all group-hover:border-indigo-400 group-hover:shadow-lg">
            <div className="text-4xl">📄</div>
            <div className="text-center">
              <p className="font-bold text-slate-800">Import Content</p>
              <p className="text-xs text-slate-400">Audio, Video, PDF</p>
            </div>
          </div>
        </div>
        <button onClick={startRecording} className="w-full max-w-xs p-8 bg-white border-2 border-slate-200 rounded-3xl flex flex-col items-center gap-4 hover:border-red-400 hover:shadow-lg transition-all">
          <div className="text-4xl">🎙️</div>
          <div className="text-center">
            <p className="font-bold text-slate-800">Record Class</p>
            <p className="text-xs text-slate-400">Capture live lecture</p>
          </div>
        </button>
      </div>

      {history.length > 0 && (
        <div className="pt-12">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">Recent Activity</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {history.slice(0, 4).map(h => (
              <div key={h.id} onClick={() => { setNotes(h); setStatus(AppStatus.COMPLETED); }} className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md cursor-pointer transition-all">
                <p className="text-xs text-slate-400 mb-1">{new Date(h.timestamp).toLocaleDateString()}</p>
                <h4 className="font-bold text-slate-800 line-clamp-1">{h.title}</h4>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderHistory = () => (
    <div className="space-y-6 animate-in slide-in-from-left-4">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-black text-slate-900">Your Vault</h2>
        <button onClick={() => { localStorage.removeItem('smart_notes_v2'); setHistory([]); }} className="text-xs text-red-500 font-bold hover:underline">Reset All</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {history.map(h => (
          <div key={h.id} className="p-6 bg-white border border-slate-100 rounded-3xl flex justify-between items-center shadow-sm">
            <div>
              <p className="text-xs text-indigo-600 font-bold">{new Date(h.timestamp).toDateString()}</p>
              <h4 className="text-lg font-bold text-slate-800">{h.title}</h4>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setNotes(h); setStatus(AppStatus.COMPLETED); }} className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-sm">Review</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderResources = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-in fade-in">
      <div className="md:col-span-1 space-y-6">
        <PomodoroTimer />
        <div className="p-6 bg-white border border-slate-100 rounded-3xl space-y-4 shadow-sm">
          <h4 className="font-bold text-slate-800">Study Tip</h4>
          <p className="text-sm text-slate-500 leading-relaxed">Try the <strong>Feynman Technique</strong>: Explain your lecture notes to someone else in simple terms. If you get stuck, re-read that section.</p>
        </div>
      </div>
      <div className="md:col-span-2 space-y-6">
        <h2 className="text-3xl font-black text-slate-900">Learning Toolkit</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { title: "Zettelkasten Method", desc: "Link notes together to form a web of knowledge.", color: "bg-amber-100 text-amber-800" },
            { title: "Spaced Repetition", desc: "Review notes at 1, 3, and 7-day intervals.", color: "bg-green-100 text-green-800" },
            { title: "Active Recall", desc: "Use the built-in AI Quiz to test your memory.", color: "bg-blue-100 text-blue-800" }
          ].map(tool => (
            <div key={tool.title} className="p-6 bg-white border border-slate-100 rounded-3xl space-y-2">
              <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${tool.color}`}>{tool.title}</span>
              <p className="text-sm text-slate-500">{tool.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="max-w-xl mx-auto py-10 space-y-8 animate-in slide-in-from-bottom-4">
      <h2 className="text-3xl font-bold text-slate-900">Preferences</h2>
      <div className="bg-white p-8 rounded-3xl border border-slate-100 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-bold text-slate-800">Advanced AI (Gemini Pro)</h4>
            <p className="text-sm text-slate-500">More detailed summaries and complex quizzes.</p>
          </div>
          <button onClick={() => setDeepAnalysis(!deepAnalysis)} className={`w-12 h-6 rounded-full transition-all relative ${deepAnalysis ? 'bg-indigo-600' : 'bg-slate-200'}`}>
            <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-all ${deepAnalysis ? 'translate-x-6' : ''}`} />
          </button>
        </div>
        <div className="pt-6 border-t border-slate-100">
          <h4 className="font-bold text-slate-800 mb-2">Browser Storage</h4>
          <p className="text-sm text-slate-500 mb-4">Everything is stored locally on this machine.</p>
          <button className="text-sm text-indigo-600 font-bold">Download Backup (.json)</button>
        </div>
      </div>
    </div>
  );

  const renderCompleted = () => {
    if (!notes) return null;
    return (
      <div className="space-y-8 animate-in fade-in">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <span className="text-[10px] font-black uppercase text-indigo-500 tracking-widest">Analysis Result</span>
            <h2 className="text-3xl font-black text-slate-900">{notes.title}</h2>
          </div>
          <div className="flex gap-2">
            <button onClick={() => generatePDF(notes)} className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold shadow-lg">PDF</button>
            <button onClick={copyAsMarkdown} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold">MD</button>
            <button onClick={() => setView('STUDY_MODE')} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold">Study Mode</button>
            <button onClick={() => setStatus(AppStatus.IDLE)} className="px-4 py-2 text-slate-400">✕</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <section className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
              <h3 className="text-xl font-bold text-slate-800 mb-4">Lecture Summary</h3>
              <p className="text-slate-600 leading-relaxed whitespace-pre-line">{notes.summary}</p>
            </section>
            <section className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
              <h3 className="text-xl font-bold text-slate-800 mb-4">Raw Content / Transcription</h3>
              <div className="bg-slate-50 p-6 rounded-2xl h-80 overflow-y-auto text-sm text-slate-500 font-mono leading-relaxed">{notes.transcription}</div>
            </section>
          </div>
          <div className="space-y-6">
            <section className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-4">Key Terms</h3>
              <div className="flex flex-wrap gap-2">
                {notes.keyConcepts.map((c, i) => (
                  <span key={i} className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium">{c}</span>
                ))}
              </div>
            </section>
            <section className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-4">To-Do</h3>
              <ul className="space-y-2">
                {notes.actionItems.map((a, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-600"><input type="checkbox" className="mt-1" /> <span>{a}</span></li>
                ))}
              </ul>
            </section>
            {notes.sources && notes.sources.length > 0 && (
              <section className="bg-slate-900 p-8 rounded-3xl text-white">
                <h3 className="text-lg font-bold mb-4 text-indigo-400">External Resources</h3>
                <div className="space-y-2">
                  {notes.sources.map((s, i) => (
                    <a key={i} href={s.uri} target="_blank" className="block p-3 bg-white/10 rounded-xl text-xs hover:bg-white/20 transition-all truncate">🔗 {s.title}</a>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderStudyMode = () => {
    if (!notes) return null;
    return (
      <div className="max-w-4xl mx-auto space-y-12 py-6 animate-in zoom-in-95">
        <div className="flex justify-between items-center">
          <button onClick={() => setView('HOME')} className="text-slate-400 hover:text-slate-600">← Exit Study Mode</button>