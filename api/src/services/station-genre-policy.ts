const EXCLUDED_GENRE_FRAGMENTS = ["document", "talk"];
const PREFERRED_GENRE_FRAGMENTS = ["dance", "pop"];

export function isExcludedStationGenre(genre: string): boolean {
  const normalizedGenre = genre.trim().toLowerCase();
  return normalizedGenre === "public radio" ||
    EXCLUDED_GENRE_FRAGMENTS.some((fragment) => normalizedGenre.includes(fragment));
}

export function stationGenrePrioritySql(alias: string): string {
  const genre = `LOWER(${alias}.genre)`;
  const preferred = PREFERRED_GENRE_FRAGMENTS
    .map((fragment) => `${genre} LIKE '%${fragment}%'`)
    .join(" OR ");
  return `CASE WHEN ${preferred} THEN 0 ELSE 1 END`;
}
