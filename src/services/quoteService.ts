/**
 * Fetches random motivational fitness quotes for the Run Screen idle state.
 * Uses ZenQuotes API (Free, no key required).
 */

export interface QuoteData {
  text: string;
  author: string;
}

export async function fetchMotivationalQuote(): Promise<QuoteData | null> {
  try {
    const response = await fetch('https://zenquotes.io/api/random');
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data && data.length > 0) {
      return {
        text: data[0].q,
        author: data[0].a,
      };
    }
    return null;
  } catch (error) {
    console.warn('Quote fetch failed:', error);
    return null;
  }
}
