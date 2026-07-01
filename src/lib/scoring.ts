import { AnsweredQuestion, ComprehensiveEvaluation } from '../types';

const PLACEHOLDERS = ['skipped', '(no speech captured for this answer.)'];
const FILLERS = ['um', 'uh', 'er', 'ah', 'like', 'you know', 'kind of', 'sort of',
  'basically', 'actually', 'literally', 'i mean', 'so yeah'];
const STOP = new Set(['the','a','an','and','or','but','to','of','in','on','for','with','at','by',
  'is','are','was','were','be','been','being','do','did','does','how','what','why','when','who',
  'you','your','i','me','my','we','our','they','it','this','that','these','those','can','could',
  'would','should','will','about','from','as','if','so','then','there','here','have','has','had']);

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const words = (t: string) => t.toLowerCase().replace(/[^a-z0-9'\s]/g, ' ').split(/\s+/).filter(Boolean);
const isReal = (t?: string) => {
  const s = (t || '').trim().toLowerCase();
  return !!s && !PLACEHOLDERS.includes(s);
};

export interface SpeakingStats {
  spokeWords: number;
  answeredCount: number;
  totalQuestions: number;
  avgWords: number;
  wpm: number;
  fillerCount: number;
  avgConfidence: number;
  hasConfidence: boolean;
  relevance: number; // 0..1
}

export function computeStats(answers: AnsweredQuestion[]): SpeakingStats {
  let spokeWords = 0, answeredCount = 0, totalSecs = 0, fillerCount = 0;
  let confSum = 0, confCount = 0, relSum = 0, relCount = 0;
  answers.forEach(a => {
    if (!isReal(a.userAnswer)) return;
    const w = words(a.userAnswer!);
    if (w.length === 0) return;
    answeredCount++; spokeWords += w.length; totalSecs += a.speakDurationSec || 0;
    const text = ' ' + w.join(' ') + ' ';
    FILLERS.forEach(f => { const m = text.match(new RegExp(`\\s${f}\\s`, 'g')); if (m) fillerCount += m.length; });
    if (typeof a.confidence === 'number' && a.confidence > 0) { confSum += a.confidence; confCount++; }
    // relevance: overlap of answer content words with the question's content words
    const qw = new Set(words(a.question.text).filter(x => x.length > 3 && !STOP.has(x)));
    if (qw.size) {
      const aw = new Set(w.filter(x => x.length > 3 && !STOP.has(x)));
      let hit = 0; qw.forEach(x => { if (aw.has(x)) hit++; });
      relSum += hit / qw.size; relCount++;
    }
  });
  const wpm = totalSecs > 0 ? Math.round(spokeWords / (totalSecs / 60)) : 0;
  return {
    spokeWords, answeredCount, totalQuestions: answers.length,
    avgWords: answeredCount ? Math.round(spokeWords / answeredCount) : 0,
    wpm, fillerCount,
    avgConfidence: confCount ? confSum / confCount : 0,
    hasConfidence: confCount > 0,
    relevance: relCount ? relSum / relCount : 0,
  };
}

const CONGRATS = [
  "You finished the whole round — that consistency is exactly how fluency is built.",
  "Round complete! Showing up and speaking is the hardest part, and you did it.",
  "Nicely done — every question answered. Your confidence is compounding.",
  "That's a wrap on this round. Real reps like this are what move the needle.",
  "Strong finish. Practicing out loud beats re-reading notes every time.",
];
const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

export function buildLocalEvaluation(answers: AnsweredQuestion[]): ComprehensiveEvaluation {
  const s = computeStats(answers);

  // Nothing spoken -> honest warm-up, no fake scores.
  if (s.spokeWords === 0) {
    return {
      score: 0, confidenceRating: 1, pronunciationScore: 0, fluencyScore: 0, relevanceScore: 0,
      encouragingComment: "You completed the round — brave first step! I didn't catch any spoken words this time, so there's nothing to grade yet. Next round, press \"Start Answer\" and speak your reply out loud, even a sentence or two, and I'll give you a real breakdown.",
      generalStrengths: [
        "You went through every question without quitting — great persistence.",
        "You already know the interview flow.",
        "You're set up and ready; the only step left is to speak.",
      ],
      dimensionNotes: {
        pronunciation: "No speech captured, so clarity couldn't be measured this round.",
        fluency: "Speak for ~30–60 seconds per answer next time so pacing can be assessed.",
        relevance: "Aim to name the exact thing the question asks about in your first sentence.",
      },
      questionsFeedback: answers.map(a => ({
        questionId: a.question.id, questionText: a.question.text,
        strength: "You reached this question — next time, answer it out loud so it can be reviewed.",
        phraseUpgrade: {
          original: "(no spoken answer captured)",
          upgraded: "Start with: \"In my last role, I…\" then give one concrete example with a number.",
          explanation: "Even a short spoken answer lets the coach give specific, useful feedback.",
        },
        suggestedStarAnswer: "Situation: set the scene briefly.\nTask: what you owned.\nAction: the steps you took (most detail here).\nResult: the outcome, with a metric if possible.",
      })),
    };
  }

  // --- Pronunciation / clarity (from recognition confidence) ---
  let pronunciationScore: number;
  let pronNote: string;
  if (s.hasConfidence) {
    pronunciationScore = Math.round(clamp(s.avgConfidence * 100, 45, 98));
    pronNote = pronunciationScore >= 85
      ? `The recognizer understood you clearly (~${Math.round(s.avgConfidence * 100)}% confidence). Your sounds are landing well — keep it up.`
      : pronunciationScore >= 70
      ? `Mostly clear (~${Math.round(s.avgConfidence * 100)}% recognition confidence). Slow down slightly on longer words and finish word endings (‑ed, ‑s, ‑th) to sharpen clarity.`
      : `Some words were hard to catch (~${Math.round(s.avgConfidence * 100)}% confidence). Try over-articulating consonants and pausing between phrases; it improves fast with practice.`;
  } else {
    pronunciationScore = 78; // browser didn't expose confidence
    pronNote = "Your browser didn't provide clarity data this time, so this is an estimate. For a precise pronunciation score you'd need a dedicated speech-assessment tool; focus on clear word endings and steady pacing.";
  }

  // --- Fluency (pacing + fillers + length) ---
  const wpm = s.wpm;
  const pacePenalty = wpm === 0 ? 10 : wpm < 90 ? (90 - wpm) * 0.35 : wpm > 165 ? (wpm - 165) * 0.35 : 0;
  const fillerRatio = s.spokeWords ? s.fillerCount / s.spokeWords : 0;
  const fillerPenalty = fillerRatio * 220;
  const lengthBonus = clamp(s.avgWords / 90, 0, 1) * 18;
  const fluencyScore = Math.round(clamp(72 + lengthBonus - pacePenalty - fillerPenalty, 40, 98));
  const paceWord = wpm === 0 ? "unknown" : wpm < 95 ? "a bit slow" : wpm > 160 ? "a bit fast" : "well-paced";
  const fluencyNote =
    `You spoke at about ${wpm} words/min (${paceWord})` +
    (s.fillerCount ? `, with ${s.fillerCount} filler word${s.fillerCount > 1 ? 's' : ''} (um/like/you know). ` : `, with almost no fillers — great. `) +
    (wpm > 160 ? "Add short pauses between sentences to sound more composed. "
      : wpm > 0 && wpm < 95 ? "Try to keep a steadier flow so momentum doesn't drop. " : "") +
    (fillerRatio > 0.04 ? "Replacing fillers with a brief silent pause instantly raises perceived confidence." : "");

  // --- Relevance (answer vs question) ---
  const relevanceScore = Math.round(clamp(45 + s.relevance * 55, 40, 98));
  const relevanceNote = s.relevance >= 0.5
    ? "Your answers directly addressed what each question asked — strong topical focus."
    : s.relevance >= 0.25
    ? "You mostly stayed on topic. Echo a key word from the question in your first sentence so the link is unmistakable."
    : "Some answers drifted from the question. Start by restating the ask (\"You're asking how I'd handle X — here's my approach…\") to lock in relevance.";

  const overall = Math.round((pronunciationScore + fluencyScore + relevanceScore) / 3);

  return {
    score: overall,
    confidenceRating: clamp(Math.round(overall / 20), 1, 5),
    pronunciationScore, fluencyScore, relevanceScore,
    encouragingComment: pick(CONGRATS) + " " +
      (overall >= 85 ? "Your delivery is already strong and interview-ready."
        : overall >= 70 ? "You've got a solid base — a few tweaks below will take you up a level."
        : "You're building real momentum; the specific fixes below are your fastest wins."),
    generalStrengths: [
      `You spoke on ${s.answeredCount} of ${s.totalQuestions} questions, ~${s.avgWords} words each — real out-loud practice.`,
      s.relevance >= 0.3 ? "Answers connected clearly to the questions asked." : "You engaged with every prompt in English under time pressure.",
      s.fillerCount <= 2 ? "Clean delivery with very few filler words." : "You pushed through and kept talking — pacing will smooth out with reps.",
    ],
    dimensionNotes: { pronunciation: pronNote, fluency: fluencyNote, relevance: relevanceNote },
    questionsFeedback: answers.map(a => {
      const real = isReal(a.userAnswer);
      const snippet = real ? (a.userAnswer!.length > 70 ? a.userAnswer!.slice(0, 70) + '…' : a.userAnswer!) : "(no spoken answer captured)";
      return {
        questionId: a.question.id, questionText: a.question.text,
        strength: real ? "You gave a spoken answer and engaged directly with the question." : "Try answering this one out loud next round.",
        phraseUpgrade: {
          original: snippet,
          upgraded: "I led this by designing a clear, measurable plan and driving it to a concrete result.",
          explanation: "Ownership verbs (led, designed, drove) plus a number make answers land with more authority.",
        },
        suggestedStarAnswer: "Situation: set the scene briefly.\nTask: what you owned.\nAction: the specific steps you took (most of your answer).\nResult: the outcome, ideally with a metric.",
      };
    }),
  };
}
