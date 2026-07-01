/* Vercel serverless function: keeps the Gemini key secret (server-side only).
   If no key or the AI fails, returns 503 so the client uses its local analysis. */
import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "method-not-allowed" });

  const { role, accent, roundType, answers } = req.body || {};
  if (!answers || !Array.isArray(answers) || answers.length === 0) {
    return res.status(400).json({ error: "answers-required" });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(503).json({ error: "no-api-key", useLocal: true });

  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const prompt = `
You are a highly supportive, world-class English interview coach for non-native speakers practicing for jobs abroad.
Job Role: ${role} · Accent: ${accent} · Round ${roundType} (1 recruiter, 2 behavioral, 3 technical).
Here are the questions and the candidate's transcribed spoken answers:
${JSON.stringify(answers, null, 2)}

Return ONE JSON object per the schema. Be warm and encouraging in "encouragingComment" (100+ words).
Scores 0-100:
- pronunciationScore: clarity/intelligibility inferred from how clean the transcript reads.
- fluencyScore: pacing, natural flow, absence of fillers (um/like/you know).
- relevanceScore: how directly each answer addressed the question.
dimensionNotes: { pronunciation, fluency, relevance } — one specific, actionable sentence each, referring to what they actually said.
generalStrengths: 3 specific strengths. questionsFeedback: one item per question with questionId, questionText, strength, phraseUpgrade {original, upgraded, explanation}, suggestedStarAnswer (a polished STAR sample).`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.INTEGER },
            confidenceRating: { type: Type.INTEGER },
            pronunciationScore: { type: Type.INTEGER },
            fluencyScore: { type: Type.INTEGER },
            relevanceScore: { type: Type.INTEGER },
            encouragingComment: { type: Type.STRING },
            generalStrengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            dimensionNotes: {
              type: Type.OBJECT,
              properties: {
                pronunciation: { type: Type.STRING },
                fluency: { type: Type.STRING },
                relevance: { type: Type.STRING },
              },
              required: ["pronunciation", "fluency", "relevance"],
            },
            questionsFeedback: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  questionId: { type: Type.STRING },
                  questionText: { type: Type.STRING },
                  strength: { type: Type.STRING },
                  phraseUpgrade: {
                    type: Type.OBJECT,
                    properties: {
                      original: { type: Type.STRING },
                      upgraded: { type: Type.STRING },
                      explanation: { type: Type.STRING },
                    },
                    required: ["original", "upgraded", "explanation"],
                  },
                  suggestedStarAnswer: { type: Type.STRING },
                },
                required: ["questionId", "questionText", "strength", "phraseUpgrade", "suggestedStarAnswer"],
              },
            },
          },
          required: ["score", "confidenceRating", "pronunciationScore", "fluencyScore", "relevanceScore",
            "encouragingComment", "generalStrengths", "dimensionNotes", "questionsFeedback"],
        },
        temperature: 0.7,
      },
    });

    const text = (response as any).text ?? "";
    return res.status(200).json(JSON.parse(text));
  } catch (error: any) {
    console.error("AI evaluation failed:", error?.message || error);
    return res.status(503).json({ error: "ai-failed", useLocal: true });
  }
}
