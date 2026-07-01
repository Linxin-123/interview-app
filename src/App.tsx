import React, { useState, useEffect } from 'react';
import { JobRole, InterviewSession, InterviewData, Interviewer, ComprehensiveEvaluation } from './types';
import { buildLocalEvaluation } from './lib/scoring';
import WelcomeScreen from './components/WelcomeScreen';
import Starfield from './components/Starfield';
import InterviewStage from './components/InterviewStage';
import FinalReport from './components/FinalReport';
import { Briefcase, Sparkles, Loader2, Award } from 'lucide-react';

const DATA_URL = `${import.meta.env.BASE_URL}interview-data.json`;

export default function App() {
  const [step, setStep] = useState<'welcome' | 'interview' | 'loading_evaluation' | 'report'>('welcome');
  const [data, setData] = useState<InterviewData | null>(null);
  const [dataError, setDataError] = useState<string>('');
  const [session, setSession] = useState<InterviewSession | null>(null);

  // Load the editable question bank at runtime (edit public/interview-data.json -> just refresh)
  useEffect(() => {
    fetch(DATA_URL)
      .then(r => { if (!r.ok) throw new Error('not found'); return r.json(); })
      .then((d: InterviewData) => setData(d))
      .catch(() => setDataError('Could not load interview-data.json. Keep it in the public/ folder.'));
  }, []);

  const handleStartInterview = (
    selectedRole: JobRole,
    interviewer: Interviewer,
    selectedRound: 1 | 2 | 3,
    duration: number,
    totalQuestionsCount: number,
    voiceName: string
  ) => {
    if (!data) return;
    const roleQuestions = data.questions.filter(q => q.role === selectedRole && q.round === selectedRound);
    const pool = [...(roleQuestions.length >= totalQuestionsCount ? roleQuestions : data.questions.filter(q => q.role === selectedRole))];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const selectedQuestions = pool.slice(0, totalQuestionsCount);

    setSession({
      id: Math.random().toString(36).substring(7),
      role: selectedRole,
      interviewer,
      accent: interviewer.accent,
      voiceName,
      roundType: selectedRound,
      durationMinutes: duration,
      totalQuestions: selectedQuestions.length,
      questions: selectedQuestions,
      currentQuestionIndex: 0,
      answers: [],
    });
    setStep('interview');
  };

  const handleAnswerSubmitted = async (userAnswer: string, speakDurationSec: number, confidence: number) => {
    if (!session) return;
    const currentAnswerObj = { question: session.questions[session.currentQuestionIndex], speakDurationSec, userAnswer, confidence };
    const updatedAnswers = [...session.answers, currentAnswerObj];
    const nextIndex = session.currentQuestionIndex + 1;

    if (nextIndex < session.totalQuestions) {
      setSession({ ...session, currentQuestionIndex: nextIndex, answers: updatedAnswers });
      return;
    }

    setSession({ ...session, answers: updatedAnswers });
    setStep('loading_evaluation');
    try {
      const response = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: session.role, accent: session.accent, roundType: session.roundType,
          answers: updatedAnswers.map(ans => ({
            questionId: ans.question.id, questionText: ans.question.text,
            scenario: ans.question.scenario, userAnswer: ans.userAnswer, speakDurationSec: ans.speakDurationSec,
          })),
        }),
      });
      if (!response.ok) throw new Error('API server returned error status.');
      const evaluation: ComprehensiveEvaluation = await response.json();
      setSession(prev => prev ? { ...prev, answers: updatedAnswers, evaluation } : null);
      setStep('report');
    } catch (err) {
      // Works 100% offline: honest local scoring based on what was actually said.
      const fallbackEvaluation = buildLocalEvaluation(updatedAnswers);
      setSession(prev => prev ? { ...prev, answers: updatedAnswers, evaluation: fallbackEvaluation } : null);
      setStep('report');
    }
  };

  const handleRestart = () => { setSession(null); setStep('welcome'); };

  return (
    <div className="relative min-h-screen text-slate-100 font-sans antialiased selection:bg-purple-500/30 selection:text-white flex flex-col justify-between">
      <Starfield />

      <header className="border-b border-slate-800/80 bg-slate-950/40 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={handleRestart}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-500 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-purple-500/15">
              <Briefcase className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="text-sm font-black tracking-tight text-white block">AI Interview Coach</span>
              <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-widest leading-none">Global Career Practice</span>
            </div>
          </div>
          <div className="flex items-center gap-1 text-slate-400 text-xs">
            <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
            <span className="hidden sm:inline font-semibold">Ready for Global Teams</span>
          </div>
        </div>
      </header>

      <main className="flex-grow py-8 flex flex-col justify-center">
        {dataError && (
          <div className="max-w-md mx-auto text-center text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-2xl px-6 py-5">{dataError}</div>
        )}

        {!dataError && !data && (
          <div className="max-w-md mx-auto text-center px-6 py-12 space-y-4">
            <Loader2 className="w-10 h-10 text-purple-400 animate-spin mx-auto" />
            <p className="text-sm text-slate-400">Loading question bank…</p>
          </div>
        )}

        {data && step === 'welcome' && (
          <WelcomeScreen data={data} onStart={handleStartInterview} />
        )}

        {data && step === 'interview' && session && (
          <InterviewStage
            currentQuestionIndex={session.currentQuestionIndex}
            totalQuestionsCount={session.totalQuestions}
            question={session.questions[session.currentQuestionIndex]}
            interviewer={session.interviewer}
            voiceName={session.voiceName}
            onAnswerSubmitted={handleAnswerSubmitted}
          />
        )}

        {step === 'loading_evaluation' && session && (
          <div className="max-w-md mx-auto text-center px-6 py-12 bg-slate-900/40 backdrop-blur-md rounded-3xl border border-slate-800/80 shadow-2xl space-y-6 animate-pulse">
            <Loader2 className="w-12 h-12 text-purple-400 animate-spin mx-auto" />
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1 bg-purple-500/10 text-purple-400 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-purple-500/20">
                <Award className="w-3.5 h-3.5" /><span>Compiling feedback</span>
              </span>
              <h2 className="text-lg font-black text-white">Analyzing Your STAR Performance</h2>
              <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
                Please wait while {session.interviewer.name} compiles your fluency grading, phrase upgrades, and custom report…
              </p>
            </div>
          </div>
        )}

        {step === 'report' && session && (
          <FinalReport session={session} onRestart={handleRestart} selectedVoiceName={session.voiceName} />
        )}
      </main>

      <footer className="border-t border-slate-900 bg-slate-950/80 py-6 text-center text-[10px] text-slate-500">
        <div className="max-w-6xl mx-auto px-4">
          <p>© 2026 AI English Interview Coach. Designed for confident international communication.</p>
        </div>
      </footer>
    </div>
  );
}
