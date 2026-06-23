const IMPORTANT_FOOTBALL_TEAMS = [
  "arsenal", "barcelona", "bayern", "chelsea", "france", "germany", "inter",
  "italy", "juventus", "liverpool", "manchester", "madrid", "milan", "napoli",
  "netherlands", "paris saint germain", "portugal", "spain",
];

const text = (value) => (value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function matchPriority(match) {
  const league = text(match.league);
  if (match.sportKey === "tennis") {
    if (/wimbledon|roland garros|french open|us open|australian open/.test(league)) return 100;
    if (/masters|1000/.test(league)) return 80;
    if (/atp/.test(league)) return 60;
    if (/wta/.test(league)) return 50;
  }
  if (match.sportKey === "football") {
    let priority = /world cup|mundial/.test(league) ? 100
      : /champions/.test(league) ? 90
        : /premier league|laliga|la liga|serie a|bundesliga|ligue 1/.test(league) ? 70
          : 40;
    const teams = `${text(match.home)} ${text(match.away)}`;
    priority += IMPORTANT_FOOTBALL_TEAMS.filter((team) => teams.includes(team)).length * 5;
    return priority;
  }
  return 50;
}
