import { Interviewer } from '../types';

/* The Web Speech API does NOT expose gender, so we infer it from the voice name.
   'female' is checked before 'male' because the word "female" contains "male". */
const FEMALE_HINTS = ['female', 'woman', 'zira', 'hazel', 'susan', 'catherine', 'linda', 'heera',
  'eva', 'samantha', 'victoria', 'karen', 'moira', 'tessa', 'fiona', 'serena', 'allison', 'ava',
  'aria', 'jenny', 'michelle', 'sonia', 'libby', 'clara', 'amber', 'nora', 'emma', 'amy', 'joanna',
  'salli', 'google us english', 'google uk english female', 'sora'];
const MALE_HINTS = ['male', 'man', 'david', 'mark', 'george', 'james', 'ryan', 'guy', 'daniel',
  'alex', 'fred', 'oliver', 'thomas', 'paul', 'richard', 'eric', 'brian', 'arthur', 'matthew',
  'william', 'liam', 'google uk english male'];

export type Gender = 'female' | 'male' | 'unknown';

export function inferGender(v: SpeechSynthesisVoice): Gender {
  const n = (v.name || '').toLowerCase();
  for (const h of FEMALE_HINTS) if (n.indexOf(h) >= 0) return 'female';
  for (const h of MALE_HINTS) if (n.indexOf(h) >= 0) return 'male';
  return 'unknown';
}

export function genderTag(g: Gender | string): string {
  return g === 'female' ? '\u2640 Female' : g === 'male' ? '\u2642 Male' : '\u2022 Voice';
}

function scoreVoice(v: SpeechSynthesisVoice, person: Interviewer): number {
  const n = (v.name || '').toLowerCase();
  const lang = (v.lang || '').toLowerCase();
  let s = 0;
  const hints = person.voiceHints || [];
  const hi = hints.findIndex(h => n.indexOf(h) >= 0);
  if (hi >= 0) s += 1000 - hi * 60;                        // earlier hint = stronger preference
  const g = inferGender(v);
  const want = person.gender || 'unknown';
  if (g === want) s += 600; else if (g === 'unknown') s += 120; else s -= 600; // never male face + female voice
  const acc = (person.accent || 'en-US').toLowerCase();
  if (lang === acc) s += 300; else if (lang.split('-')[0] === acc.split('-')[0]) s += 80;
  if (/google|microsoft|natural|online|premium/.test(n)) s += 40;
  return s;
}

/* Returns a map of interviewer id -> chosen voice name.
   Guarantees every interviewer gets a DIFFERENT voice when enough are installed. */
export function assignVoices(interviewers: Interviewer[], voices: SpeechSynthesisVoice[]): Record<string, string> {
  const en = voices.filter(v => (v.lang || '').toLowerCase().indexOf('en') === 0);
  const pool = en.length ? en : voices;
  const taken = new Set<string>();
  const result: Record<string, string> = {};
  interviewers.forEach(p => {
    let best: SpeechSynthesisVoice | null = null, bestS = -1e9;
    pool.forEach(v => {
      if (taken.has(v.name)) return;                       // keep all voices different
      const sc = scoreVoice(v, p);
      if (sc > bestS) { bestS = sc; best = v; }
    });
    if (!best) pool.forEach(v => { const sc = scoreVoice(v, p); if (sc > bestS) { bestS = sc; best = v; } });
    if (best) { result[p.id] = best.name; taken.add(best.name); }
  });
  return result;
}
