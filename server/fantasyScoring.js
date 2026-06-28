const n = (value) => Number(value || 0);

const statNumber = (stats, ...names) => {
  const match = stats.find((entry) => names.includes(entry?.name));
  return n(match?.value ?? match?.displayValue);
};

const eventMinute = (value) => {
  const text = String(value || "");
  const match = text.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
};

function summaryMinutes(player, substitutions, matchMinutes) {
  const athleteId = String(player.athlete?.id || "");
  const change = substitutions.get(athleteId) || {};
  if (player.starter) return Math.max(0, change.outMinute || matchMinutes);
  if (player.subbedIn) return Math.max(0, matchMinutes - (change.inMinute || matchMinutes));
  return statNumber(player.stats || [], "appearances") > 0 ? 1 : 0;
}

export function espnFantasyStats(player, keyEvents = []) {
  const substitutions = new Map();
  let matchMinutes = 90;
  for (const event of keyEvents) {
    matchMinutes = Math.max(matchMinutes, eventMinute(event.clock?.displayValue));
    if (event.type?.type !== "substitution") continue;
    const [incoming, outgoing] = event.participants || [];
    const minute = eventMinute(event.clock?.displayValue);
    if (incoming?.athlete?.id) substitutions.set(String(incoming.athlete.id), { ...(substitutions.get(String(incoming.athlete.id)) || {}), inMinute: minute });
    if (outgoing?.athlete?.id) substitutions.set(String(outgoing.athlete.id), { ...(substitutions.get(String(outgoing.athlete.id)) || {}), outMinute: minute });
  }

  const stats = player.stats || [];
  return {
    games: { minutes: summaryMinutes(player, substitutions, matchMinutes) },
    goals: {
      total: statNumber(stats, "totalGoals"),
      assists: statNumber(stats, "goalAssists"),
      saves: statNumber(stats, "saves"),
      conceded: statNumber(stats, "goalsConceded"),
    },
    cards: {
      yellow: statNumber(stats, "yellowCards"),
      red: statNumber(stats, "redCards"),
    },
    penalty: {
      missed: statNumber(stats, "penaltyMisses", "penaltiesMissed", "penaltyMissed"),
      saved: statNumber(stats, "penaltySaves", "penaltiesSaved", "penaltySaved"),
    },
  };
}

export function fantasyPoints(stats, position) {
  const minutes = n(stats.games?.minutes);
  let points = minutes > 0 ? 1 : 0;
  if (minutes >= 60) points += 2;
  points += n(stats.goals?.assists) * 3;
  points -= n(stats.cards?.yellow) + n(stats.cards?.red) * 3;
  points -= n(stats.penalty?.missed) * 2;

  const goals = n(stats.goals?.total);
  points += goals * ({ POR: 5, DEF: 6, MED: 5, DEL: 4 }[position] || 5);
  if (position === "POR") {
    points += n(stats.goals?.saves) / 3 | 0;
    points += n(stats.penalty?.saved) * 5;
  }
  if (["POR", "DEF"].includes(position) && minutes >= 60 && n(stats.goals?.conceded) === 0) points += 4;
  if (position === "MED" && minutes >= 60 && n(stats.goals?.conceded) === 0) points += 1;
  if (["POR", "DEF"].includes(position)) points -= n(stats.goals?.conceded) / 2 | 0;
  return points;
}

export const nextFantasyPrice = (price, points, demand = 0) => {
  const change = Math.max(-0.15, Math.min(0.15, (points - 3) * 0.015 + demand * 0.002));
  return Math.max(500000, Math.round(price * (1 + change) / 10000) * 10000);
};
