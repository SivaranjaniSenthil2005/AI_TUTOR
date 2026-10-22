/**
 * Starter questions configuration for AI Tutor.
 * Generic syllabus-aligned example questions per curriculum board and subject.
 * These are editable and designed to spark curiosity without verbatim textbook copying.
 */

export interface StarterQuestion {
  id: string;
  question: string;
  topic: string;
}

export const STARTER_QUESTIONS: Record<
  string, // board: "tn" | "cbse"
  Record<
    string, // subject: "science" | "social_science"
    StarterQuestion[]
  >
> = {
  tn: {
    science: [
      {
        id: "tn-sci-1",
        question: "Explain Newton's first law of motion and give an example",
        topic: "Physics · Laws of Motion",
      },
      {
        id: "tn-sci-2",
        question: "What is photosynthesis and why is chlorophyll important?",
        topic: "Biology · Plant Physiology",
      },
      {
        id: "tn-sci-3",
        question: "What is Ohm's Law and its formula?",
        topic: "Physics · Electricity",
      },
    ],
    social_science: [
      {
        id: "tn-soc-1",
        question: "What were the main causes of the First World War?",
        topic: "History · World History",
      },
      {
        id: "tn-soc-2",
        question: "Explain the preamble of the Constitution of India",
        topic: "Civics · Indian Constitution",
      },
      {
        id: "tn-soc-3",
        question: "What are renewable and non-renewable natural resources?",
        topic: "Geography · Natural Resources",
      },
    ],
  },
  cbse: {
    science: [
      {
        id: "cbse-sci-1",
        question: "What is the difference between combination and decomposition reactions?",
        topic: "Chemistry · Chemical Reactions",
      },
      {
        id: "cbse-sci-2",
        question: "How does the human digestive system break down food?",
        topic: "Biology · Life Processes",
      },
      {
        id: "cbse-sci-3",
        question: "Explain Snell's law of refraction of light",
        topic: "Physics · Light Reflection & Refraction",
      },
    ],
    social_science: [
      {
        id: "cbse-soc-1",
        question: "What was the Non-Cooperation Movement and why was it started?",
        topic: "History · Nationalism in India",
      },
      {
        id: "cbse-soc-2",
        question: "Explain federalism and power sharing in Indian democracy",
        topic: "Political Science · Federalism",
      },
      {
        id: "cbse-soc-3",
        question: "What is sustainable development in resource management?",
        topic: "Geography · Resources and Development",
      },
    ],
  },
};

export function getStarterQuestions(board: string, subject: string): StarterQuestion[] {
  const normBoard = board.toLowerCase();
  const normSubject = subject.toLowerCase().replace("-", "_");

  const boardObj = STARTER_QUESTIONS[normBoard] || STARTER_QUESTIONS.tn;
  const questions = boardObj[normSubject] || boardObj.science;

  return questions.slice(0, 3);
}
