/**
 * Mock Tutor Reply Engine for AI Tutor (Phase 7).
 * To be replaced by hybrid RAG / LLM in Phase 11.
 */

export interface TutorContext {
  board?: string;
  className?: string;
  subject?: string;
}

const CANNED_REPLIES: { keywords: string[]; reply: string }[] = [
  {
    keywords: ["photosynthesis", "photo", "chlorophyll", "plants"],
    reply:
      "Photosynthesis is how green plants convert sunlight, water, and carbon dioxide into oxygen and glucose. In Tamil Nadu Class 10 Science Chapter 12, this process takes place in the chloroplasts using chlorophyll. It is the fundamental energy source for almost all life on Earth.",
  },
  {
    keywords: ["pythagoras", "theorem", "hypotenuse", "right triangle"],
    reply:
      "The Pythagorean theorem states that in a right-angled triangle, the square of the hypotenuse equals the sum of squares of the other two sides: a² + b² = c². In CBSE Class 9 and 10 Mathematics, it is used extensively in geometry and coordinate distance formulas. It allows us to calculate unknown distances easily.",
  },
  {
    keywords: ["gravity", "gravitation", "newton", "force"],
    reply:
      "Gravity is the universal attractive force between any two objects with mass. Sir Isaac Newton formulated that this force is directly proportional to the product of their masses and inversely proportional to the square of the distance between them. It keeps the planets in orbit and objects on the ground.",
  },
  {
    keywords: ["constitution", "fundamental", "rights", "republic"],
    reply:
      "The Constitution of India guarantees six fundamental rights to all citizens, including the Right to Equality and the Right to Freedom. In Standard 8 Social Science Civics, Dr. B.R. Ambedkar is recognized as the chief architect of our Constitution. It protects every student's right to education and dignity.",
  },
  {
    keywords: ["water", "cycle", "evaporation", "rain"],
    reply:
      "The water cycle describes the continuous movement of water on, above, and below the surface of the Earth. Water evaporates into vapor, condenses into clouds, and falls back to Earth as precipitation or rain. This natural cycle sustains all ecosystems and freshwater reserves.",
  },
  {
    keywords: ["fraction", "fractions", "numerator", "denominator"],
    reply:
      "A fraction represents part of a whole number, written with a numerator on top and a denominator on the bottom. For example, 1/2 means one part out of two equal parts. In Middle School Mathematics, fractions help us divide quantities and compare ratios accurately.",
  },
];

/**
 * Returns a student-friendly canned answer echoing the question after a simulated 1s delay.
 */
export async function getTutorReply(
  question: string,
  context?: TutorContext
): Promise<string> {
  // Simulate 1000ms thinking delay
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const cleanQ = question.trim().toLowerCase();
  if (!cleanQ) {
    return "I couldn't catch your question. Please try asking again!";
  }

  // Look for matched canned curriculum replies
  for (const item of CANNED_REPLIES) {
    if (item.keywords.some((kw) => cleanQ.includes(kw))) {
      return item.reply;
    }
  }

  // Context-aware fallback reply
  const subjectPrefix = context?.subject ? `In ${context.subject}` : "In your studies";
  const classPrefix = context?.className ? `for ${context.className}` : "";
  const boardPrefix = context?.board ? ` (${context.board})` : "";

  return (
    `Great question about "${question.trim()}"! ` +
    `${subjectPrefix} ${classPrefix}${boardPrefix}, this topic explains fundamental concepts step by step. ` +
    `Let's explore this together as you practice and review your textbook lessons.`
  );
}
