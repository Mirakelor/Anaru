import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';

export function StatsPage() {
  const stats = useLiveQuery(async () => {
    const [words, reviews, clips] = await Promise.all([db.words.toArray(), db.reviews.toArray(), db.clips.count()]);
    const days = new Map<string, number>();
    for (const review of reviews) {
      const day = new Date(review.reviewedAt).toISOString().slice(0, 10);
      days.set(day, (days.get(day) ?? 0) + 1);
    }
    const streak = computeStreak(days);
    const byLevel: Record<number, number> = {};
    for (const word of words) {
      if (word.jlpt) byLevel[word.jlpt] = (byLevel[word.jlpt] ?? 0) + 1;
    }
    const last14: { day: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      last14.push({ day: key, count: days.get(key) ?? 0 });
    }
    return {
      words: words.length,
      reviews: reviews.length,
      clips,
      streak,
      today: days.get(new Date().toISOString().slice(0, 10)) ?? 0,
      byLevel,
      last14,
    };
  }, []);

  if (!stats) return <div className="page-loading" />;

  const maxBar = Math.max(1, ...stats.last14.map((d) => d.count));

  return (
    <div className="page stats">
      <div className="page-head">
        <h1>Stats</h1>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <p className="stat-value">{stats.streak}</p>
          <p className="stat-label">day streak</p>
        </div>
        <div className="stat-card">
          <p className="stat-value">{stats.words}</p>
          <p className="stat-label">words saved</p>
        </div>
        <div className="stat-card">
          <p className="stat-value">{stats.reviews}</p>
          <p className="stat-label">reviews done</p>
        </div>
        <div className="stat-card">
          <p className="stat-value">{stats.today}</p>
          <p className="stat-label">today</p>
        </div>
      </div>

      <h2 className="stats-section">Reviews — last 14 days</h2>
      <div className="stat-chart">
        {stats.last14.map((d) => (
          <div key={d.day} className="stat-bar-wrap" title={`${d.day}: ${d.count}`}>
            <div className="stat-bar" style={{ height: `${(d.count / maxBar) * 100}%` }} />
          </div>
        ))}
      </div>

      <h2 className="stats-section">Words by JLPT level</h2>
      <ul className="level-list">
        {[5, 4, 3, 2, 1].map((level) => (
          <li key={level} className="level-row">
            <span className={`jlpt-badge n${level}`}>N{level}</span>
            <div className="level-bar-track">
              <div
                className="level-bar"
                style={{ width: `${stats.words ? ((stats.byLevel[level] ?? 0) / stats.words) * 100 : 0}%` }}
              />
            </div>
            <span className="level-count">{stats.byLevel[level] ?? 0}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function computeStreak(days: Map<string, number>): number {
  let streak = 0;
  const cursor = new Date();
  const key = (d: Date) => d.toISOString().slice(0, 10);
  if (!days.has(key(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(key(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
