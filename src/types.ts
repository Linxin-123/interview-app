export type JobRole = string;
export type ExaminerAccent = 'en-US' | 'en-GB' | 'en-AU' | 'en-IN';
export type Gender = 'female' | 'male' | 'unknown';

export interface RoleConfig {
  id: JobRole;
  title: string;
  subTitle: string;
  icon: string;
  description: string;
}

export interface Interviewer {
  id: string;
  name: string;
  role: string;            // assigned coach role / title
  image: string;           // relative path, e.g. "images/interviewer_david.jpg"
  accent: ExaminerAccent;
  gender: Gender;
  voiceHints?: string[];   // preferred voice-name fragments, best first
  voiceName?: string;      // resolved at runtime from the device's installed voices
  video?: string;          // OPTIONAL looping talking-head clip, e.g. "videos/david.mp4"
  videoListening?: string; // OPTIONAL clip played while the candidate answers (quiet/nodding)
  model?: string;          // OPTIONAL Ready Player Me .glb URL for the live 3D avatar
  description: string;
}

export interface Question {
  id: string;
  text: string;
  translation?: string;
  round: 1 | 2 | 3;
  role: JobRole;
  scenario: string;
}

export interface InterviewData {
  roles: RoleConfig[];
  interviewers: Interviewer[];
  questions: Question[];
}

export interface QuestionFeedback {
  questionId: string;
  questionText: string;
  strength: string;
  phraseUpgrade: { original: string; upgraded: string; explanation: string };
  suggestedStarAnswer: string;
}

export interface ComprehensiveEvaluation {
  score: number;
  confidenceRating: number;
  pronunciationScore: number;   // clarity / intelligibility
  fluencyScore: number;         // pacing, fillers, length
  relevanceScore: number;       // how well the answer addressed the question
  grammarScore?: number;
  vocabularyScore?: number;
  encouragingComment: string;
  generalStrengths: string[];
  dimensionNotes?: { pronunciation: string; fluency: string; relevance: string };
  questionsFeedback: QuestionFeedback[];
}

export interface AnsweredQuestion {
  question: Question;
  speakDurationSec: number;
  userAnswer?: string;
  confidence?: number;   // avg speech-recognition confidence (clarity proxy), 0..1
}

export interface InterviewSession {
  id: string;
  role: JobRole;
  interviewer: Interviewer;
  accent: ExaminerAccent;
  voiceName: string;
  roundType: 1 | 2 | 3;
  durationMinutes: number;
  totalQuestions: number;
  questions: Question[];
  currentQuestionIndex: number;
  answers: AnsweredQuestion[];
  evaluation?: ComprehensiveEvaluation;
}
