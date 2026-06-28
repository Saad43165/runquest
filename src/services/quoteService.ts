/**
 * Fetches random motivational fitness quotes for the Run Screen idle state.
 * Uses ZenQuotes API (Free, no key required).
 */

export interface QuoteData {
  text: string;
  author: string;
}

const FALLBACK_QUOTES: QuoteData[] = [
  { text: "The map is waiting to be painted. Go claim your territory.", author: "RunQuest" },
  { text: "Every mile is a new pixel in your world.", author: "RunQuest" },
  { text: "Some people want it to happen, some wish it would happen, others make it happen.", author: "Michael Jordan" },
  { text: "The only bad run is the one that didn't happen.", author: "Anonymous" },
  { text: "Your body can stand almost anything. It's your mind that you have to convince.", author: "Anonymous" },
  { text: "Don't stop when you're tired. Stop when you are done.", author: "David Goggins" },
  { text: "Conquer your city, one block at a time.", author: "RunQuest" },
  { text: "A one hour run is 4% of your day. No excuses.", author: "Anonymous" },
  { text: "If it doesn't challenge you, it won't change you.", author: "Fred DeVito" },
  { text: "The hardest step for a runner is the first one out the front door.", author: "Ron Clarke" }
];

export async function fetchMotivationalQuote(): Promise<QuoteData | null> {
  // Return a random quote immediately without network latency
  const randomIndex = Math.floor(Math.random() * FALLBACK_QUOTES.length);
  return FALLBACK_QUOTES[randomIndex];
}
