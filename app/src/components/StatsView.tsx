import { useState } from 'react';
import type { Round } from '../types';
import { clubLabel, clubStats, deleteRound, formatToPar, loadHistory, roundTotals, shotDistances } from '../lib/rounds';

interface Props {
  onClose: () => void;
}

export function StatsView({ onClose }: Props) {
  const [tab, setTab] = useState<'rounds' | 'clubs'>('rounds');
  const [history, setHistory] = useState<Round[]>(loadHistory);
  const [openId, setOpenId] = useState<string | null>(null);
  const stats = clubStats(history);
  const maxAvg = Math.max(1, ...stats.map((s) => s.max));

  return (
    <div className="stats">
      <div className="detail-header">
        <h2>Meine Runden</h2>
        <button className="icon-btn" onClick={onClose} aria-label="Schließen">✕</button>
      </div>
      <div className="tabs">
        <button className={tab === 'rounds' ? 'on' : ''} onClick={() => setTab('rounds')}>Runden ({history.length})</button>
        <button className={tab === 'clubs' ? 'on' : ''} onClick={() => setTab('clubs')}>Schlägerweiten</button>
      </div>

      {tab === 'rounds' &&
        (history.length === 0 ? (
          <p className="empty">
            Noch keine gespeicherten Runden. Starte auf einem Platz „⛳ Auf dem Platz“ und beende die Runde über die Scorekarte.
          </p>
        ) : (
          <ul className="round-list">
            {history.map((r) => {
              const t = roundTotals(r);
              const holes = Object.keys(r.scores).map(Number).sort((a, b) => a - b);
              const open = openId === r.id;
              return (
                <li key={r.id} className="round">
                  <button className="round-head" onClick={() => setOpenId(open ? null : r.id)}>
                    <div>
                      <strong>{r.clubName}</strong>
                      <span className="muted">
                        {new Date(r.date).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })} · {t.holes} Loch
                      </span>
                    </div>
                    <div className="round-score">
                      <strong>{t.strokes || '–'}</strong>
                      {t.hasPar && <span className={t.toPar < 0 ? 'under' : t.toPar > 0 ? 'over' : ''}>{formatToPar(t.toPar)}</span>}
                    </div>
                  </button>
                  {open && (
                    <div className="round-body">
                      {holes.length > 0 && (
                        <div className="scorecard">
                          <table>
                            <thead><tr><th>Loch</th>{holes.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                            <tbody>
                              <tr><td>Par</td>{holes.map((h) => <td key={h}>{r.pars[h] ?? '–'}</td>)}</tr>
                              <tr>
                                <td>Score</td>
                                {holes.map((h) => {
                                  const d = r.pars[h] ? r.scores[h] - r.pars[h] : 0;
                                  return <td key={h} className={d < 0 ? 'under' : d > 0 ? 'over' : 'even'}>{r.scores[h]}</td>;
                                })}
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                      {r.shots.length > 0 && (
                        <p className="muted small">
                          {r.shots.length} erfasste Schläge · längster:{' '}
                          {(() => {
                            const best = shotDistances(r.shots)
                              .filter((x) => x.distance != null && x.shot.club !== 'Pt' && x.distance < 400)
                              .sort((a, b) => b.distance! - a.distance!)[0];
                            return best ? `${Math.round(best.distance!)} m (${clubLabel(best.shot.club)})` : '–';
                          })()}
                        </p>
                      )}
                      <button
                        className="link-btn danger"
                        onClick={() => {
                          if (!confirm('Diese Runde löschen?')) return;
                          deleteRound(r.id);
                          setHistory(loadHistory());
                        }}
                      >
                        Runde löschen
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ))}

      {tab === 'clubs' &&
        (stats.length === 0 ? (
          <p className="empty">
            Noch keine Schlagdaten. Erfasse auf dem Platz deine Schläge mit „📍 Schlag von hier“ – die Weite wird automatisch bis zum nächsten Schlag gemessen.
          </p>
        ) : (
          <div className="club-stats">
            {stats.map((s) => (
              <div key={s.club} className="club-stat">
                <span className="cs-name">{clubLabel(s.club)}</span>
                <div className="cs-bar">
                  <span className="cs-max" style={{ width: `${(s.max / maxAvg) * 100}%` }} />
                  <span className="cs-avg" style={{ width: `${(s.avg / maxAvg) * 100}%` }} />
                </div>
                <span className="cs-val">
                  <strong>{Math.round(s.avg)} m</strong>
                  <span className="muted"> max {Math.round(s.max)} · {s.count}×</span>
                </span>
              </div>
            ))}
            <p className="muted small">Balken: Durchschnitt (dunkel) und längster Schlag (hell). Putts werden nicht gezählt.</p>
          </div>
        ))}
    </div>
  );
}
