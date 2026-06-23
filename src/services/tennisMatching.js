const words = (name) => (name || "").toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((word) => word.length >= 2);

const samePlayer = (a, b) => {
  const aWords = words(a);
  const bWords = words(b);
  return aWords.length > 0 && bWords.length > 0
    && aWords.filter((word) => bWords.includes(word)).length >= Math.min(2, aWords.length, bWords.length);
};

export const tennisPairOrientation = (match, odds) => {
  if (samePlayer(match.home, odds.home) && samePlayer(match.away, odds.away)) return "same";
  if (samePlayer(match.home, odds.away) && samePlayer(match.away, odds.home)) return "reversed";
  return null;
};
