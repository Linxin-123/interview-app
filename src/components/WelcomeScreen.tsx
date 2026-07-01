import React, { useState, useEffect, useMemo } from 'react';
import { JobRole, Interviewer, InterviewData } from '../types';
import { assignVoices, inferGender, genderTag } from '../lib/voices';
import { Sparkles, ArrowRight, ArrowLeftRight, Check } from 'lucide-react';

const asset = (p: string) => `${import.meta.env.BASE_URL}${p}`;

interface WelcomeScreenProps {
  data: InterviewData;
  onStart: (
    role: JobRole,
    interviewer: Interviewer,
    roundType: 1 | 2 | 3,
    durationMinutes: number,
    totalQuestions: number,
    selectedVoiceName: string
  ) => void;
}

export default function WelcomeScreen({ data, onStart }: WelcomeScreenProps) {
  const { roles, interviewers } = data;
  const [selectedRole, setSelectedRole] = useState<JobRole>(roles[0].id);
  const [selectedInterviewer, setSelectedInterviewer] = useState<Interviewer>(interviewers[0]);
  const [selectedRound, setSelectedRound] = useState<1 | 2 | 3>(1);
  const [duration, setDuration] = useState<number>(20);

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  // map: interviewer id -> chosen voice name (each different + gender-correct)
  const [voiceMap, setVoiceMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const load = () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        setVoices(window.speechSynthesis.getVoices());
      }
    };
    load();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = load;
    }
  }, []);

  // Auto-assign a distinct, gender-correct voice to each interviewer whenever voices load
  useEffect(() => {
    if (voices.length) setVoiceMap(assignVoices(interviewers, voices));
  }, [voices, interviewers]);

  const englishVoices = useMemo(
    () => voices.filter(v => (v.lang || '').toLowerCase().startsWith('en')),
    [voices]
  );

  const currentVoiceName = voiceMap[selectedInterviewer.id] || '';
  const currentVoice = voices.find(v => v.name === currentVoiceName);
  const currentVoiceGender = currentVoice ? inferGender(currentVoice) : selectedInterviewer.gender;

  const getQuestionsCount = (mins: number) => Math.max(2, Math.min(15, Math.round(mins * 0.375)));

  const previewVoice = () => {
    if (!window.speechSynthesis || !currentVoice) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(`Hi, I'm ${selectedInterviewer.name}. Let's begin your interview.`);
    u.voice = currentVoice; u.rate = 0.95;
    window.speechSynthesis.speak(u);
  };

  const handleStart = () => {
    onStart(selectedRole, selectedInterviewer, selectedRound, duration, getQuestionsCount(duration), currentVoiceName);
  };

  const activeRoleConfig = roles.find(r => r.id === selectedRole) || roles[0];

  return (
    <div className="max-w-6xl mx-auto px-4 py-2 space-y-8 animate-fade-in">

      {/* Hero */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 bg-purple-500/10 text-purple-400 px-4 py-1.5 rounded-full text-xs font-semibold border border-purple-500/20">
          <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
          <span>Empowering Non-Native English Job Seekers Abroad</span>
        </div>
        <h1 className="text-5xl md:text-6xl font-black tracking-tight text-white font-display">AI English Interview Coach</h1>
        <p className="text-base md:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
          Practice realistic 3-round interviews with animated digital-human coaches. Get encouraging, customized feedback to speak like a native and land your dream job.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* LEFT */}
        <div className="lg:col-span-7 space-y-6">

          {/* Step 1: role */}
          <div className="bg-slate-900/30 backdrop-blur-md rounded-2xl border border-slate-800/60 p-6 space-y-4">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 text-xs font-black">1</span>
              <span>Choose Your Target Role</span>
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {roles.map(role => {
                const isSelected = selectedRole === role.id;
                return (
                  <button key={role.id} onClick={() => setSelectedRole(role.id)}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border text-center transition-all duration-200 cursor-pointer ${
                      isSelected ? 'bg-gradient-to-br from-purple-500/15 to-indigo-500/5 border-purple-500 text-white ring-2 ring-purple-500/30'
                                 : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-400'}`}>
                    <span className="text-3xl mb-1.5">{role.icon}</span>
                    <span className="font-bold text-base text-white block">{role.title}</span>
                    <span className="text-xs text-slate-400 mt-1 block leading-none truncate w-full">{role.subTitle}</span>
                  </button>
                );
              })}
            </div>
            <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800 space-y-1">
              <span className="text-xs text-purple-400 font-bold uppercase tracking-wider block">📋 Scope description:</span>
              <p className="text-sm text-slate-300 leading-relaxed font-medium">{activeRoleConfig.description}</p>
            </div>
          </div>

          {/* Step 2: interviewer */}
          <div className="bg-slate-900/30 backdrop-blur-md rounded-2xl border border-slate-800/60 p-6 space-y-4">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 text-xs font-black">2</span>
              <span>Choose Your Interviewer Coach</span>
            </h2>
            <div className="space-y-2.5">
              {interviewers.map(interviewer => {
                const isSelected = selectedInterviewer.id === interviewer.id;
                const vName = voiceMap[interviewer.id];
                const vObj = voices.find(v => v.name === vName);
                const g = vObj ? inferGender(vObj) : interviewer.gender;
                return (
                  <button key={interviewer.id} onClick={() => setSelectedInterviewer(interviewer)}
                    className={`w-full flex items-center gap-4 p-3 rounded-xl border text-left transition-all duration-200 cursor-pointer group ${
                      isSelected ? 'bg-gradient-to-r from-purple-500/15 to-indigo-500/5 border-purple-500 text-white ring-2 ring-purple-500/20'
                                 : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-400'}`}>
                    <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 border border-slate-800 group-hover:border-purple-500/50 transition-colors">
                      <img src={asset(interviewer.image)} alt={interviewer.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-base text-white">{interviewer.name}</span>
                        <span className="text-[9px] bg-purple-500/15 text-purple-300 px-1.5 py-0.5 rounded-full border border-purple-500/20 font-bold">{genderTag(g)}</span>
                        <span className="text-[9px] bg-slate-900 text-slate-400 px-1.5 py-0.5 rounded border border-slate-800 uppercase tracking-widest">{interviewer.accent}</span>
                      </div>
                      <p className="text-sm text-slate-400 font-medium truncate mt-0.5">{interviewer.role}</p>
                      <p className="text-xs text-slate-500 truncate leading-none mt-1.5">🎙 {vName || 'auto-selecting…'}</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${isSelected ? 'bg-purple-500 border-purple-500 text-white' : 'border-slate-800 text-transparent'}`}>
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Voice override for the SELECTED interviewer */}
            <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{selectedInterviewer.name}'s voice — {genderTag(currentVoiceGender)}</span>
                <button onClick={previewVoice} className="text-[10px] font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer">
                  <Sparkles className="w-3 h-3" /> Preview
                </button>
              </div>
              <select
                value={currentVoiceName}
                onChange={e => setVoiceMap(prev => ({ ...prev, [selectedInterviewer.id]: e.target.value }))}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 cursor-pointer"
              >
                {englishVoices.length === 0 && <option>No English voices installed on this device</option>}
                {englishVoices.map(v => (
                  <option key={v.name} value={v.name}>{genderTag(inferGender(v))} — {v.name} ({v.lang})</option>
                ))}
              </select>
              <p className="text-[9px] text-slate-500 flex items-center gap-1">
                <ArrowLeftRight className="w-2.5 h-2.5" /> Each coach uses a different voice. This dropdown only changes the selected coach above.
              </p>
            </div>
          </div>

          {/* Step 3: round + duration */}
          <div className="bg-slate-900/30 backdrop-blur-md rounded-2xl border border-slate-800/60 p-6 space-y-4">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 text-xs font-black">3</span>
              <span>Configure Practice Level & Time</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Difficulty Round</label>
                <div className="grid grid-cols-3 gap-2">
                  {([1, 2, 3] as const).map(r => (
                    <button key={r} onClick={() => setSelectedRound(r)}
                      className={`py-2 px-1 rounded-lg border text-xs font-bold text-center transition-all cursor-pointer ${
                        selectedRound === r ? 'bg-purple-500/20 border-purple-500 text-white'
                                            : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'}`}>
                      Round {r}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Duration limit</label>
                  <span className="text-xs font-extrabold text-purple-400">{duration} min (~{getQuestionsCount(duration)} Qs)</span>
                </div>
                <input type="range" min="5" max="40" step="5" value={duration}
                  onChange={e => setDuration(parseInt(e.target.value))}
                  className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-purple-500" />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT preview */}
        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
          <div className="bg-slate-900/30 backdrop-blur-md rounded-3xl border border-slate-800/60 p-5 space-y-5 shadow-2xl relative overflow-hidden">
            <div className="aspect-[4/3] sm:aspect-[16/10] lg:aspect-square rounded-2xl overflow-hidden relative border border-slate-800 bg-slate-950 group">
              <img src={asset(selectedInterviewer.image)} alt={selectedInterviewer.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/10 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                <div>
                  <span className="text-[10px] bg-purple-500 text-white font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full mb-1 inline-block">DIGITAL INTERVIEWER</span>
                  <h3 className="text-2xl font-black text-white leading-tight">{selectedInterviewer.name}</h3>
                </div>
                <span className="text-[10px] bg-black/60 text-emerald-400 px-2 py-1 rounded-lg border border-emerald-500/20 font-bold uppercase tracking-wider">{genderTag(currentVoiceGender)} Voice</span>
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">ASSIGNED COACH ROLE</span>
                <p className="text-sm font-black text-white tracking-wide">{selectedInterviewer.role}</p>
              </div>
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">INTERVIEWER STYLE</span>
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-sm text-slate-300 italic leading-relaxed">"{selectedInterviewer.description}"</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-2">
        <button onClick={handleStart}
          className="w-full flex items-center justify-center gap-2.5 py-4 px-6 rounded-2xl font-bold bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white shadow-xl shadow-purple-500/15 active:scale-[0.99] transition-all duration-200 cursor-pointer">
          <span className="text-base font-black tracking-wide">Start Practice Interview</span>
          <ArrowRight className="w-4.5 h-4.5" />
        </button>
      </div>
    </div>
  );
}
