
import React, { useState, useRef, useEffect } from 'react';
import { processLectureMedia } from './services/geminiService';
import { generatePDF } from './utils/pdfGenerator';
import { SmartNotes, AppStatus, PageView } from './types';

// --- Sub-components ---

const Navbar = ({ currentView, setView }: { currentView: PageView, setView: (v: PageView) => void }) => {
  const links: { id: PageView, label: string }[] = [
    { id: 'HOME', label: 'Dashboard' },
    { id: 'HISTORY', label: 'History' },
    { id: 'HOW_IT_WORKS', label: 'How it works' },
    { id: 'RESOURCES', label: 'Resources' },
    { id: 'SETTINGS', label: 'Settings' },
  ];

  return (
    <nav className="w-full h-16 glass-morphism sticky top-0 z-50 flex items-center px-8 justify-between shadow-sm">
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('HOME')}>
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">S</div>
        <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent hidden sm:block">
          SmartNotes AI
        </h1>
      </div>
      <div className="flex gap-4 md:gap-8 text-sm font-medium">
        {links.map((link) => (
          <button
            key={link.id}
            onClick={() => setView(link.id)}
            className={`transition-colors py-1 border-b-2 ${
              currentView === link.id ? 'text-indigo-600 border-indigo-600' : 'text-slate-500 border-transparent hover:text-indigo-400'
            }`}
          >
            {link.label}
          </button>
        ))}
      </div>
    </nav>
  );
};

const FeatureCard = ({ icon, title, desc }: { icon: string, title: string, desc: string }) => (
  <div className="p-6 bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
    <div className="text-3xl mb-4">{icon}</div>
    <h3 className="text-lg font-semibold text-slate-800 mb-2">{title}</h3>
    <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
  </div>
);

// --- Main App Component ---

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

  // Load History
  useEffect(() => {
    const saved = localStorage.getItem('smart_notes_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  // Save History
  const addToHistory = (note: SmartNotes) => {
    const newHistory = [note, ...history].slice(0, 50); // Keep last 50
    setHistory(newHistory);
    localStorage.setItem('smart_notes_history', JSON.stringify(newHistory));
  };

  const deleteHistoryItem = (id: string) => {
    const newHistory = history.filter(item => item.id !== id);
    setHistory(newHistory);
    localStorage.setItem('smart_notes_history', JSON.stringify(newHistory));
  };

  const clearAllHistory = () => {
    if (confirm("Are you sure you want to delete all saved notes?")) {
      setHistory([]);
      localStorage.removeItem('smart_notes_history');
    }
  };

  const processFile = async (file: Blob) => {
    setStatus(AppStatus.PROCESSING);
    setErrorMessage(null);
    
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = (reader.result as string).split(',')[1];
        const result = await processLectureMedia(base64String, file.type || 'audio/mpeg', deepAnalysis);
        setNotes(result);
        addToHistory(result);
        setStatus(AppStatus.COMPLETED);
      };
      reader.onerror = () => {
        throw new Error("Failed to read file");
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setErrorMessage(err.message || "An error occurred.");
      setStatus(AppStatus.ERROR);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        processFile(audioBlob);
      };
      mediaRecorder.start();
      setIsRecording(true);
      setStatus(AppStatus.RECORDING);
    } catch (err) {
      setErrorMessage("Microphone access denied.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
  };

  const reset = () => {
    setStatus(AppStatus.IDLE);
    setNotes(null);
    setErrorMessage(null);
    setView('HOME');
  };

  // --- Render Functions ---

  const renderHome = () => (
    <div className="space-y-16 animate-in fade-in duration-700">
      <div className="text-center space-y-6">
        <h2 className="text-4xl md:text-6xl font-extrabold text-slate-900 tracking-tight">
          Supercharge Your <br />
          <span className="text-indigo-600">Lecture Learning</span>
        </h2>
        <p className="text-xl text-slate-500 max-w-2xl mx-auto">
          One-click transcription, smart summarization, and AI-powered research for your <span className="text-indigo-600 font-semibold underline decoration-indigo-200">audio, video, or PDFs</span>.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-6 justify-center items-center">
        <div className="relative group w-full max-w-sm">
          <input
            type="file"
            accept="audio/*,video/mp4,application/pdf"
            onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          <div className="p-8 border-2 border-dashed border-slate-200 rounded-3xl bg-white flex flex-col items-center gap-4 transition-all group-hover:border-indigo-400 group-hover:bg-indigo-50/30">
            <div className="flex gap-2">
              <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-2xl">📁</div>
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-2xl">📄</div>
            </div>
            <div className="text-center">
              <p className="font-semibold text-slate-800">Upload Media or PDF</p>
              <p className="text-xs text-slate-400">MP3, WAV, MP4 or PDF</p>
            </div>
          </div>
        </div>

        <button
          onClick={startRecording}
          className="w-full max-w-sm p-8 border-2 border-slate-200 rounded-3xl bg-white flex flex-col items-center gap-4 hover:border-red-400 hover:bg-red-50/30 transition-all group"
        >
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-2xl">🎙️</div>
          <div className="text-center">
            <p className="font-semibold text-slate-800">Record Lecture</p>
            <p className="text-xs text-slate-400">Capture in real-time</p>
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <FeatureCard icon="🧠" title="Document Analysis" desc="Upload PDFs or textbooks to generate structured study outlines instantly." />
        <FeatureCard icon="🔗" title="Web Grounding" desc="We cross-reference material with the real-time web to find verified resources." />
        <FeatureCard icon="🗂️" title="Local Vault" desc="All your processing happens securely and is saved in your browser history." />
      </div>
    </div>
  );

  const renderHistory = () => (
    <div className="space-y-8 animate-in slide-in-from-left-4">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-slate-900">Your Lecture Vault</h2>
        {history.length > 0 && (
          <button onClick={clearAllHistory} className="text-red-500 text-sm font-medium hover:underline">Clear History</button>
        )}
      </div>
      
      {history.length === 0 ? (
        <div className="text-center py-20 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
          <p className="text-slate-400">No notes saved yet. Start by uploading a lecture or document!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {history.map((item) => (
            <div key={item.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-mono text-slate-400">{new Date(item.timestamp).toLocaleDateString()}</span>
                  <button onClick={() => deleteHistoryItem(item.id)} className="text-slate-300 hover:text-red-500">✕</button>
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2 line-clamp-1">{item.title}</h3>
                <p className="text-sm text-slate-500 line-clamp-3 mb-4">{item.summary}</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => { setNotes(item); setStatus(AppStatus.COMPLETED); }}
                  className="flex-1 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-bold hover:bg-indigo-100 transition-colors"
                >
                  View
                </button>
                <button 
                  onClick={() => generatePDF(item)}
                  className="px-3 py-2 bg-slate-50 text-slate-600 rounded-lg text-sm hover:bg-slate-100"
                >
                  PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderHowItWorks = () => (
    <div className="space-y-12 animate-in slide-in-from-right-4">
      <div className="text-center max-w-2xl mx-auto space-y-4">
        <h2 className="text-3xl font-bold text-slate-900">Multimodal Academic Analysis</h2>
        <p className="text-slate-500">Powered by Gemini 3 Flash and Pro to process audio, video, and documents with extreme context awareness.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {[
          { step: "1", title: "Ingestion", icon: "📥", desc: "Upload audio, video, or PDF textbooks. We support files up to 20MB." },
          { step: "2", title: "Parsing", icon: "📄", desc: "Documents are analyzed for text, layout, and images. Audio is transcribed via neural networks." },
          { step: "3", title: "Synthesis", icon: "🧪", desc: "AI identifies core themes, formulas, and critical assignments from the content." },
          { step: "4", title: "Deep Research", icon: "🌍", desc: "Our system uses Google Search to find supplemental readings for your specific topic." }
        ].map((item) => (
          <div key={item.step} className="relative p-6 bg-white rounded-2xl shadow-sm border border-slate-100">
            <span className="absolute -top-4 -left-4 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold shadow-lg">{item.step}</span>
            <div className="text-4xl mb-4">{item.icon}</div>
            <h4 className="font-bold text-slate-800 mb-2">{item.title}</h4>
            <p className="text-sm text-slate-500">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );

  const renderResources = () => (
    <div className="space-y-8 animate-in fade-in">
      <h2 className="text-3xl font-bold text-slate-900">Student Resources</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-indigo-600 rounded-3xl p-8 text-white space-y-6">
          <h3 className="text-2xl font-bold">The Science of Note-Taking</h3>
          <p className="opacity-90">Whether reading a PDF or listening to a lecture, the goal is synthesis. Use our AI to create the framework, then add your own insights to solidify your understanding.</p>
          <ul className="space-y-3 list-disc list-inside opacity-90 text-sm">
            <li>Review your notes within 24 hours</li>
            <li>Use the "Supplemental Sources" for extra context</li>
            <li>Export to PDF for distraction-free reading</li>
          </ul>
        </div>
        <div className="space-y-4">
          <h4 className="font-bold text-slate-800">Useful Links</h4>
          {[
            { name: "Google Scholar", url: "https://scholar.google.com", desc: "Search for scholarly literature" },
            { name: "Anki", url: "https://apps.ankiweb.net/", desc: "Powerful flashcards for memorization" },
            { name: "Khan Academy", url: "https://www.khanacademy.org", desc: "Supplementary learning for any subject" }
          ].map((link) => (
            <a key={link.name} href={link.url} target="_blank" className="block p-4 bg-white border border-slate-100 rounded-2xl hover:border-indigo-300 transition-all">
              <span className="font-bold text-indigo-600">{link.name}</span>
              <p className="text-sm text-slate-500">{link.desc}</p>
            </a>
          ))}
        </div>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="max-w-2xl mx-auto space-y-8 animate-in slide-in-from-bottom-4">
      <h2 className="text-3xl font-bold text-slate-900">Settings</h2>
      <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-bold text-slate-800">Deep Analysis Mode</h4>
            <p className="text-sm text-slate-500">Uses Gemini 3 Pro for complex PDFs and long lectures.</p>
          </div>
          <button 
            onClick={() => setDeepAnalysis(!deepAnalysis)}
            className={`w-14 h-8 rounded-full transition-colors relative ${deepAnalysis ? 'bg-indigo-600' : 'bg-slate-200'}`}
          >
            <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${deepAnalysis ? 'translate-x-6' : ''}`}></div>
          </button>
        </div>
        
        <div className="pt-8 border-t border-slate-100">
          <h4 className="font-bold text-slate-800 mb-4">Content Handling</h4>
          <div className="flex gap-2">
            <span className="px-4 py-2 bg-slate-100 rounded-lg text-sm text-slate-600">Auto-detect Language</span>
            <span className="px-4 py-2 bg-indigo-100 rounded-lg text-sm text-indigo-600">Multimodal Input</span>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-100">
          <h4 className="font-bold text-slate-800 mb-2">Storage</h4>
          <p className="text-sm text-slate-500 mb-4">You have {history.length} lectures/documents saved locally.</p>
          <button onClick={clearAllHistory} className="px-6 py-2 bg-red-50 text-red-600 rounded-xl text-sm font-bold hover:bg-red-100">
            Clear Local Data
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar currentView={view} setView={setView} />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-12">
        {status === AppStatus.PROCESSING ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-8">
            <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-bold text-slate-800 italic">Processing...</h3>
              <p className="text-slate-500">Reading content and generating study insights.</p>
            </div>
          </div>
        ) : status === AppStatus.RECORDING ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-8">
            <div className="w-24 h-24 bg-red-500 rounded-full flex items-center justify-center text-white text-4xl animate-pulse shadow-xl shadow-red-100">🎙️</div>
            <div className="text-center">
              <h3 className="text-2xl font-bold text-slate-800">Capturing Audio...</h3>
              <p className="text-slate-500 mb-6">Live recording in progress.</p>
              <button onClick={stopRecording} className="px-8 py-3 bg-slate-900 text-white rounded-full font-bold">Stop & Process</button>
            </div>
          </div>
        ) : status === AppStatus.ERROR ? (
          <div className="max-w-md mx-auto p-8 bg-red-50 text-center space-y-6 rounded-3xl border border-red-100">
            <h3 className="text-xl font-bold text-red-800">Error Occurred</h3>
            <p className="text-red-600 text-sm">{errorMessage}</p>
            <button onClick={reset} className="px-6 py-2 bg-red-600 text-white rounded-full">Back Home</button>
          </div>
        ) : status === AppStatus.COMPLETED && notes ? (
          <div className="space-y-8 animate-in fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-200">
              <div>
                <h2 className="text-3xl font-bold text-slate-900">{notes.title}</h2>
                <p className="text-slate-400 text-sm mt-1">{new Date(notes.timestamp).toLocaleString()}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => generatePDF(notes)} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold">PDF Export</button>
                <button onClick={reset} className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl">Close</button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <section className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                  <h3 className="text-xl font-bold text-slate-800 mb-4">Summary</h3>
                  <p className="text-slate-600 leading-relaxed whitespace-pre-line">{notes.summary}</p>
                </section>
                <section className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                  <h3 className="text-xl font-bold text-slate-800 mb-4">Content Extract / Transcription</h3>
                  <div className="bg-slate-50 p-6 rounded-2xl h-80 overflow-y-auto text-sm text-slate-500 font-mono leading-relaxed">
                    {notes.transcription}
                  </div>
                </section>
              </div>
              <div className="space-y-8">
                <section className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-800 mb-4">Key Concepts</h3>
                  <ul className="space-y-2">
                    {notes.keyConcepts.map((c, i) => (
                      <li key={i} className="text-sm text-slate-600 flex gap-2">
                        <span className="text-indigo-400 font-bold">•</span> {c}
                      </li>
                    ))}
                  </ul>
                </section>
                {notes.sources && notes.sources.length > 0 && (
                  <section className="bg-indigo-50 p-8 rounded-3xl border border-indigo-100">
                    <h3 className="text-lg font-bold text-indigo-900 mb-4">Supplemental Sources</h3>
                    <div className="space-y-3">
                      {notes.sources.map((s, i) => (
                        <a key={i} href={s.uri} target="_blank" className="block p-3 bg-white rounded-xl text-xs text-indigo-600 border border-indigo-100 hover:border-indigo-400 transition-all font-medium">
                          {s.title}
                        </a>
                      ))}
                    </div>
                  </section>
                )}
                <section className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-800 mb-4">To-Do List</h3>
                  <ul className="space-y-2">
                    {notes.actionItems.map((a, i) => (
                      <li key={i} className="text-sm text-slate-600 flex gap-2">
                        <input type="checkbox" className="mt-1" /> <span>{a}</span>
                      </li>
                    ))}
                    {notes.actionItems.length === 0 && <li className="text-slate-400 text-sm italic">No items found.</li>}
                  </ul>
                </section>
              </div>
            </div>
          </div>
        ) : (
          <div>
            {view === 'HOME' && renderHome()}
            {view === 'HISTORY' && renderHistory()}
            {view === 'HOW_IT_WORKS' && renderHowItWorks()}
            {view === 'RESOURCES' && renderResources()}
            {view === 'SETTINGS' && renderSettings()}
          </div>
        )}
      </main>

      <footer className="w-full py-8 border-t border-slate-100 text-center text-slate-400 text-xs">
        <p>&copy; {new Date().getFullYear()} SmartNotes AI • Researching for you.</p>
      </footer>
    </div>
  );
};

export default App;
