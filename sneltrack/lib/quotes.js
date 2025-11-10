const quotes = [
  { quote: "Madness, badness —  combination.", author: "Drake" },
  { quote: "Measure twice, cut once.", author: "ChatGPT" },
  {
    quote: "The road to success is always under construction.",
    author: "Lily Tomlin",
  },
  {
    quote:
      "It is not the beauty of a building you should look at; it's the construction of the foundation that will stand the test of time.",
    author: "David Allan Coe",
  },
  {
    quote: "Hard work beats talent when talent doesn't work hard.",
    author: "Tim Notke",
  },
  {
    quote: "Every nail you drive is a step toward something that will last.",
    author: "ChatGPT",
  },
  {
    quote: "We shape our buildings; thereafter they shape us.",
    author: "Winston Churchill",
  },
  { quote: "Dream big. Work hard. Build your future.", author: "ChatGPT" },
  {
    quote: "The best way to predict the future is to build it.",
    author: "Peter Drucker",
  },
  {
    quote:
      "Construction is not just about building structures — it's about building dreams.",
    author: "ChatGPT",
  },
  { quote: "Without labor nothing prospers.", author: "Sophocles" },
  {
    quote: "It always seems impossible until it's done.",
    author: "Nelson Mandela",
  },
  {
    quote: "Success is the sum of small efforts, repeated day in and day out.",
    author: "Robert Collier",
  },
  {
    quote: "Build with your hands, but lead with your heart.",
    author: "ChatGPT",
  },
  { quote: "The foundation of greatness is hard work.", author: "ChatGPT" },
  {
    quote:
      "Great things are done by a series of small things brought together.",
    author: "Vincent van Gogh",
  },
  {
    quote: "Don't watch the clock; do what it does. Keep going.",
    author: "Sam Levenson",
  },
  {
    quote: "Quality means doing it right when no one is looking.",
    author: "Henry Ford",
  },
  { quote: "The harder you work, the luckier you get.", author: "Gary Player" },
  { quote: "Tools don't build things. People do.", author: "ChatGPT" },
  { quote: "Madness, badness —  combination.", author: "Drake" },
  {
    quote: "Craftsmanship is what turns ordinary into exceptional.",
    author: "ChatGPT",
  },

  { quote: "The reward for good work is more work.", author: "Tom Sachs" },
  {
    quote: "You can't build a reputation on what you are going to do.",
    author: "Henry Ford",
  },
  {
    quote:
      "Building is about more than concrete and steel — it's about passion and pride.",
    author: "ChatGPT",
  },
  {
    quote: "Perseverance is the secret of all triumphs.",
    author: "Victor Hugo",
  },
  {
    quote: "If you build it, they will come.",
    author: "Field of Dreams (1989)",
  },
  {
    quote: "There are no shortcuts to any place worth going.",
    author: "Beverly Sills",
  },
  {
    quote: "Strength does not come from the body. It comes from the will.",
    author: "Mahatma Gandhi",
  },
  {
    quote: "Work hard in silence, let your success make the noise.",
    author: "Frank Ocean",
  },
  {
    quote: "Every great structure was once just a blueprint.",
    author: "ChatGPT",
  },
  {
    quote: "Keep building — not just walls, but your legacy.",
    author: "ChatGPT",
  },
  {
    quote:
      "A true builder doesn't just work with bricks and steel — he builds trust, pride, and a better tomorrow.",
    author: "ChatGPT",
  },
];

/**
 * Gets today's quote based on days since epoch.
 * Returns null if anything goes wrong (graceful degradation).
 * @returns {{quote: string, author: string} | null}
 */
export function getTodaysQuote() {
  try {
    // Check if quotes array exists and is not empty
    if (!quotes || !Array.isArray(quotes) || quotes.length === 0) {
      return null;
    }

    // Calculate days since epoch
    const today = new Date();
    const daysSinceEpoch = Math.floor(today.getTime() / (1000 * 60 * 60 * 24));

    // Check if daysSinceEpoch is a valid number
    if (!Number.isFinite(daysSinceEpoch) || daysSinceEpoch < 0) {
      return null;
    }

    // Calculate index using modulo
    const index = daysSinceEpoch % quotes.length;

    // Get the quote at the calculated index
    const selectedQuote = quotes[index];

    // Check if quote exists and has required properties
    if (!selectedQuote || typeof selectedQuote !== "object") {
      return null;
    }

    if (!selectedQuote.quote || !selectedQuote.author) {
      return null;
    }

    // Return the quote object
    return {
      quote: selectedQuote.quote,
      author: selectedQuote.author,
    };
  } catch (error) {
    // If anything goes wrong, return null (graceful degradation)
    return null;
  }
}
