import React, { useState, useEffect, useRef } from 'react';
import { Question, Interviewer } from '../types';
import { Volume2, Mic, Square, SkipForward, RotateCcw, Video, VideoOff, HelpCircle, Eye, EyeOff } from 'lucide-react';
import Avatar3D from './Avatar3D';

const asset = (p: string) => `${import.meta.env.BASE_URL}${p}`;

interface InterviewStageProps {
  currentQuestionIndex: number;
  totalQuestionsCount: number;
  question: Question;
  interviewer: Interviewer;
  voiceName: string;
  onAnswerSubmitted: (userAnswer: string, speakDurationSec: number, confidence: number) => void;
}

export default function InterviewStage({
  currentQuestionIndex,
  totalQuestionsCount,
  question,
  interviewer,
  voiceName,
  onAnswerSubmitted,
}: InterviewStageProps) {
  const [phase, setPhase] = useState<'asking' | 'ready' | 'answering'>('asking');
  const [transcript, setTranscript] = useState('');
  const [speakDuration, setSpeakDuration] = useState(0);
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [showQuestion, setShowQuestion] = useState(true);

  const recognitionRef = useRef<any>(null);
  const durationIntervalRef = useRef<any>(null);
  const userVideoRef = useRef<HTMLVideoElement>(null);
  const confRef = useRef<{ sum: number; count: number }>({ sum: 0, count: 0 });

  useEffect(() => {
    setPhase('asking');
    setTranscript('');
    setSpeakDuration(0);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR) {
      const rec = new SR();
      rec.continuous = true; rec.interimResults = true; rec.lang = 'en-US';
      rec.onresult = (event: any) => {
        let finalT = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalT += event.results[i][0].transcript;
            const c = event.results[i][0].confidence;
            if (typeof c === 'number' && c > 0) { confRef.current.sum += c; confRef.current.count += 1; }
          }
        }
        if (finalT) setTranscript(prev => (prev ? prev + ' ' : '') + finalT);
      };
      rec.onerror = () => {};
      recognitionRef.current = rec;
    }

    const timer = setTimeout(speakQuestion, 700);
    return () => {
      clearTimeout(timer);
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    if (isCameraActive && navigator.mediaDevices) {
      navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 }, audio: false })
        .then(s => { stream = s; if (userVideoRef.current) userVideoRef.current.srcObject = s; })
        .catch(() => {});
    }
    return () => { if (stream) stream.getTracks().forEach(t => t.stop()); };
  }, [isCameraActive]);

  const speakQuestion = () => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    setPhase('asking');
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} }

    const u = new SpeechSynthesisUtterance(question.text);
    if (voiceName) {
      const match = window.speechSynthesis.getVoices().find(v => v.name === voiceName);
      if (match) u.voice = match;
    }
    u.rate = 0.92; u.pitch = 1.0;
    u.onend = () => setPhase('ready');
    u.onerror = () => setPhase('ready');
    window.speechSynthesis.speak(u);
  };

  const handleStartAnswering = () => {
    setPhase('answering'); setTranscript(''); setSpeakDuration(0);
    confRef.current = { sum: 0, count: 0 };
    if (recognitionRef.current) { try { recognitionRef.current.start(); } catch {} }
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    durationIntervalRef.current = setInterval(() => setSpeakDuration(p => p + 1), 1000);
  };

  const stopAll = () => {
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} }
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
  };

  const handleStopAndNext = () => {
    stopAll();
    const finalAnswer = transcript.trim() || "(No speech captured for this answer.)";
    const conf = confRef.current.count ? confRef.current.sum / confRef.current.count : 0;
    onAnswerSubmitted(finalAnswer, speakDuration || 1, conf);
  };

  const handleSkipQuestion = () => { stopAll(); onAnswerSubmitted("Skipped", 0, 0); };

  const speaking = phase === 'asking';

  return (
    <div className="max-w-4xl mx-auto px-4 py-2 space-y-6 animate-fade-in">

      {/* mini HUD */}
      <div className="flex items-center justify-between bg-slate-900/35 backdrop-blur-md px-5 py-2.5 rounded-2xl border border-slate-800/50 shadow-md">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black bg-purple-500/10 text-purple-400 px-2.5 py-0.5 rounded-full border border-purple-500/15 uppercase tracking-widest">
            {question.role.replace('_', ' ').toUpperCase()} ROOM
          </span>
          <span className="text-slate-600 text-[10px]">|</span>
          <span className="text-[11px] font-bold text-slate-300">
            Question <span className="text-white font-extrabold">{currentQuestionIndex + 1}</span> of <span className="text-slate-400">{totalQuestionsCount}</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setShowQuestion(v => !v)}
            className="flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-white transition-colors cursor-pointer">
            {showQuestion ? <><Eye className="w-3.5 h-3.5 text-purple-400" /><span>Question Shown</span></>
                          : <><EyeOff className="w-3.5 h-3.5 text-slate-500" /><span>Question Hidden</span></>}
          </button>
          <button onClick={() => setIsCameraActive(!isCameraActive)}
            className="flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-white transition-colors cursor-pointer">
            {isCameraActive ? <><Video className="w-3.5 h-3.5 text-cyan-400" /><span>Camera Enabled</span></>
                            : <><VideoOff className="w-3.5 h-3.5 text-slate-500" /><span>Camera Disabled</span></>}
          </button>
        </div>
      </div>

      {/* stage */}
      <div className="w-full aspect-[4/3] sm:aspect-[16/10] lg:aspect-[16/9] bg-slate-950 relative overflow-hidden rounded-3xl border border-slate-800/80 shadow-2xl">

        <div className="absolute inset-0 z-0 select-none pointer-events-none">
          <img src={asset(interviewer.image)} alt="" className="w-full h-full object-cover blur-2xl scale-110 opacity-35" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/40" />
          <div className="absolute inset-0 bg-black/30" />
        </div>

        {/* centered coach */}
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-full max-w-md h-full z-10 flex items-center justify-center">
          <div className="relative h-full aspect-[3/4] max-h-full flex items-center justify-center">
            {/* speaking ring */}
            {speaking && (
              <div className="absolute inset-0 rounded-2xl ring-4 ring-purple-500/40 animate-speaking-pulse pointer-events-none" />
            )}
            {interviewer.model && !avatarFailed ? (
              <div className="w-full h-full rounded-2xl overflow-hidden border border-white/5 shadow-2xl bg-gradient-to-b from-slate-800/40 to-slate-950">
                <Avatar3D
                  modelUrl={/^https?:/.test(interviewer.model!) ? interviewer.model! : asset(interviewer.model!)}
                  speaking={phase === 'asking'}
                  listening={phase === 'answering'}
                  onError={() => setAvatarFailed(true)}
                />
              </div>
            ) : interviewer.video && !videoFailed ? (
              <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-2xl border border-white/5 bg-slate-950">
                {/* speaking clip */}
                <video
                  src={asset(interviewer.video)}
                  poster={asset(interviewer.image)}
                  onError={() => setVideoFailed(true)}
                  autoPlay loop muted playsInline
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ease-in-out ${(speaking || !interviewer.videoListening) ? 'opacity-100' : 'opacity-0'}`}
                />
                {/* listening clip (crossfades in while you answer) */}
                {interviewer.videoListening && (
                  <video
                    src={asset(interviewer.videoListening)}
                    autoPlay loop muted playsInline
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ease-in-out ${!speaking ? 'opacity-100' : 'opacity-0'}`}
                  />
                )}
              </div>
            ) : (
              <img
                src={asset(interviewer.image)}
                alt={interviewer.name}
                className={`w-full h-full object-cover rounded-2xl shadow-2xl border border-white/5 transition-all duration-500 ${speaking ? 'scale-105 brightness-100 animate-avatar-breath' : 'scale-100 brightness-90'}`}
              />
            )}
          </div>
        </div>

        {/* self cam */}
        {isCameraActive && (
          <div className="absolute top-4 right-4 z-20 w-28 sm:w-36 aspect-video rounded-2xl overflow-hidden border border-slate-700/60 shadow-2xl bg-slate-900">
            <video ref={userVideoRef} autoPlay playsInline muted className="w-full h-full object-cover transform -scale-x-100" />
            <div className="absolute bottom-1 right-2 bg-black/60 px-1.5 py-0.5 rounded text-[9px] font-bold text-white tracking-wider">YOU</div>
          </div>
        )}

        {/* name */}
        <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/5 shadow-lg">
          <span className={`w-2 h-2 rounded-full ${speaking ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
          <div>
            <span className="text-[10px] font-black text-white block uppercase tracking-wider leading-none">{interviewer.name}</span>
            <span className="text-[8px] text-slate-400 block mt-0.5 leading-none">{interviewer.role}</span>
          </div>
        </div>

        {/* subtitles — fully hidden when the user chooses to hide the question */}
        {showQuestion && (
          <div className="absolute bottom-0 inset-x-0 z-20 bg-gradient-to-t from-black via-black/90 to-transparent px-6 py-5 flex flex-col justify-end min-h-[100px]">
            <span className="text-[9px] font-extrabold text-purple-400 uppercase tracking-widest block mb-1">
              {speaking ? '🔊 Coach asks' : '💬 Question'}
            </span>
            <p className="text-xs sm:text-sm md:text-base font-medium text-slate-100 leading-relaxed max-w-3xl">
              {question.text}
            </p>
          </div>
        )}
      </div>

      {/* controller */}
      <div className="bg-slate-900/30 backdrop-blur-md rounded-2xl border border-slate-800/60 p-6 space-y-4">
        {phase === 'answering' && (
          <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1.5 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" /><span>Transcribing Live…</span>
              </span>
              <span className="text-[10px] bg-red-500/10 text-red-400 px-2.5 py-0.5 rounded-full font-bold border border-red-500/20">REC: {speakDuration}s</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-200 italic leading-relaxed">{transcript || "Speak into your microphone now…"}</p>
          </div>
        )}

        <div className="w-full">
          {phase === 'asking' && (
            <button onClick={() => { window.speechSynthesis?.cancel(); setPhase('ready'); }}
              className="w-full flex items-center justify-center gap-2 py-4 px-6 rounded-2xl font-bold bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-all cursor-pointer shadow-lg active:scale-[0.99]">
              <Volume2 className="w-4 h-4 text-purple-400 animate-pulse" />
              <span>Coach is speaking… (click to skip and prepare)</span>
            </button>
          )}
          {phase === 'ready' && (
            <button onClick={handleStartAnswering}
              className="w-full flex items-center justify-center gap-2.5 py-4 px-6 rounded-2xl font-extrabold bg-gradient-to-r from-purple-500 via-indigo-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white shadow-xl shadow-purple-500/15 animate-pulse-glow active:scale-[0.99] transition-all cursor-pointer">
              <Mic className="w-4.5 h-4.5 text-white animate-bounce" />
              <span className="text-sm">Start Answer & Recording 🎙️</span>
            </button>
          )}
          {phase === 'answering' && (
            <button onClick={handleStopAndNext}
              className="w-full flex items-center justify-center gap-2.5 py-4 px-6 rounded-2xl font-extrabold bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-2xl shadow-red-500/20 border border-red-500/20 active:scale-[0.99] transition-all cursor-pointer">
              <Square className="w-4.5 h-4.5 text-white fill-white animate-pulse" />
              <span className="text-sm">Stop Recording & Submit ⏹️</span>
            </button>
          )}
        </div>

        <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
          <button onClick={speakQuestion} disabled={phase === 'answering'}
            className="flex items-center gap-1 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">
            <RotateCcw className="w-3.5 h-3.5" /><span>Listen Again</span>
          </button>
          <button onClick={handleSkipQuestion} disabled={phase === 'answering'}
            className="flex items-center gap-1 hover:text-rose-400 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">
            <span>Skip Question</span><SkipForward className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="p-4 bg-slate-950/40 rounded-2xl border border-slate-800/50 flex gap-3 text-xs">
        <HelpCircle className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <h5 className="font-bold text-slate-300">STAR Framework Reminder</h5>
          <p className="text-slate-400 leading-relaxed">
            Structure your answer with <span className="text-purple-400 font-extrabold">Situation</span>, <span className="text-indigo-400 font-extrabold">Task</span>, <span className="text-cyan-400 font-extrabold">Action</span>, and <span className="text-emerald-400 font-extrabold">Result</span>. Speak with rhythm and key metrics.
          </p>
        </div>
      </div>
    </div>
  );
}
