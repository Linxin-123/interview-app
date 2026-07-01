import React from 'react';
import { InterviewSession, ComprehensiveEvaluation } from '../types';
import { computeStats } from '../lib/scoring';
import Confetti from './Confetti';
import GirlWithFlowers from './GirlWithFlowers';
import { RefreshCcw } from 'lucide-react';

interface FinalReportProps {
  session: InterviewSession;
  onRestart: () => void;
  selectedVoiceName: string;
}

export default function FinalReport({ session, onRestart }: FinalReportProps) {
  const evaluation: ComprehensiveEvaluation | undefined = session.evaluation;

  if (!evaluation) {
    return (
      <div className="max-w-md mx-auto text-center py-12 px-4">
        <p className="text-slate-400 text-xs">No evaluation report available. Please restart.</p>
        <button onClick={onRestart} className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold">
          Go Home
        </button>
      </div>
    );
  }

  const stats = computeStats(session.answers);
  const spoke = stats.spokeWords > 0;

  const getTier = () => {
    if (evaluation.score >= 85) return {
      headline: 'Excellent — round complete!', badgeWord: 'Confident Professional',
      badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', confetti: 1.2,
    };
    if (evaluation.score >= 70) return {
      headline: 'Great job — round complete!', badgeWord: 'Strong Effort',
      badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/20', confetti: 1,
    };
    return {
      headline: 'Well done — round complete!', badgeWord: 'Round Complete',
      badgeClass: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20', confetti: 0.9,
    };
  };
  const tier = getTier();

  const dims = [
    { title: 'Pronunciation', score: evaluation.pronunciationScore, note: evaluation.dimensionNotes?.pronunciation, color: 'text-purple-400', ring: 'text-purple-300' },
    { title: 'Fluency', score: evaluation.fluencyScore, note: evaluation.dimensionNotes?.fluency, color: 'text-cyan-400', ring: 'text-cyan-300' },
    { title: 'Relevance', score: evaluation.relevanceScore, note: evaluation.dimensionNotes?.relevance, color: 'text-emerald-400', ring: 'text-emerald-300' },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 relative animate-fade-in">
      <Confetti intensity={tier.confetti} />

      {/* Celebration header */}
      <div className="relative z-10 text-center mb-8">
        <GirlWithFlowers className="w-40 h-40 sm:w-48 sm:h-48 mx-auto mb-2 animate-bob drop-shadow-[0_8px_24px_rgba(168,85,247,0.35)]" />
        <span className={`inline-block text-xs font-black uppercase tracking-widest px-4 py-1.5 rounded-full border ${tier.badgeClass}`}>
          {tier.badgeWord}
        </span>
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mt-4">{tier.headline}</h1>
        <p className="text-sm text-slate-300 leading-relaxed mt-3 max-w-xl mx-auto">{evaluation.encouragingComment}</p>
        <p className="text-xs text-slate-500 mt-3 uppercase tracking-wider">
          {session.role.replace('_', ' ')} · with {session.interviewer.name} · {session.totalQuestions} questions
        </p>
      </div>

      {/* Same report for every finish: three dimensions + notes */}
      <div className="relative z-10 space-y-5">
        <div className="grid grid-cols-3 gap-3">
          {dims.map((d, i) => (
            <div key={i} className="p-4 bg-slate-900/40 rounded-2xl border border-slate-800/80 text-center">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">{d.title}</span>
              <span className={`text-3xl font-black block mt-1 ${d.color}`}>{d.score}</span>
            </div>
          ))}
        </div>
        <div className="space-y-3">
          {dims.map((d, i) => d.note && (
            <div key={i} className="p-4 bg-slate-900/40 rounded-2xl border border-slate-800/70">
              <span className={`text-xs font-bold uppercase tracking-wider block mb-1 ${d.ring}`}>{d.title}</span>
              <p className="text-sm text-slate-300 leading-relaxed">{d.note}</p>
            </div>
          ))}
        </div>
        {!spoke && (
          <p className="text-center text-xs text-slate-500 italic">
            Tip: press <span className="text-purple-300 font-semibold">Start Answer</span> and speak out loud next time for the most accurate scores.
          </p>
        )}
      </div>

      {/* single action */}
      <div className="relative z-10 mt-8 text-center">
        <button onClick={onRestart}
          className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-2xl text-base font-bold shadow-lg transition-all cursor-pointer">
          <RefreshCcw className="w-5 h-5" />
          Practice Another Round
        </button>
      </div>
    </div>
  );
}
