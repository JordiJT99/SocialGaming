export const winnerFromScore = (home, away) => {
  if (home > away) return "1";
  if (home < away) return "2";
  return "X";
};

export function parseMatchScore(match) {
  const parsed = String(match?.score || "").match(/(\d+)\s*[-:]\s*(\d+)/);
  return parsed ? { homeScore: Number(parsed[1]), awayScore: Number(parsed[2]) } : null;
}

export function scorePorraPrediction(prediction, match) {
  const actual = parseMatchScore(match);
  if (!actual || !prediction) return { points: 0, exactScores: 0, correctWinners: 0 };
  const predictedWinner = winnerFromScore(Number(prediction.homeScore), Number(prediction.awayScore));
  const actualWinner = winnerFromScore(actual.homeScore, actual.awayScore);
  const exact = Number(prediction.homeScore) === actual.homeScore && Number(prediction.awayScore) === actual.awayScore;
  const winner = predictedWinner === actualWinner;
  const diff = Number(prediction.homeScore) - Number(prediction.awayScore) === actual.homeScore - actual.awayScore;
  const goals = Number(prediction.homeScore) + Number(prediction.awayScore) === actual.homeScore + actual.awayScore;
  const both = (Number(prediction.homeScore) > 0 && Number(prediction.awayScore) > 0) === (actual.homeScore > 0 && actual.awayScore > 0);
  return {
    points: (exact ? 5 : 0) + (winner ? 2 : 0) + (diff ? 1 : 0) + (goals ? 1 : 0) + (both ? 1 : 0),
    exactScores: exact ? 1 : 0,
    correctWinners: winner ? 1 : 0,
  };
}

export function scorePorraEntry(entry, porra, matches) {
  return porra.matchIds.reduce((total, matchId) => {
    const match = matches.find((item) => item.id === matchId);
    const score = scorePorraPrediction(entry.predictions?.[matchId], match);
    return {
      points: total.points + score.points,
      exactScores: total.exactScores + score.exactScores,
      correctWinners: total.correctWinners + score.correctWinners,
    };
  }, { points: 0, exactScores: 0, correctWinners: 0 });
}
