import { useState } from 'react';
import type { CourseHole, CourseLayout, GolfClub } from '../types';
import { formatLen, pathLength, type GreenDistances, type Unit } from '../lib/courseGeo';

interface Props {
  club: GolfClub;
  layout: CourseLayout | null;
  loading: boolean;
  notice: string | null;
  hole: CourseHole | null;
  holeIdx: number;
  distances: GreenDistances | null;
  measureDistances: { toPoint: number; pointToGreen: number | null } | null;
  positionInfo: { gps: boolean; accuracy: number | null };
  unit: Unit;
  scores: Record<number, number>;
  onUnit: (u: Unit) => void;
  onHole: (idx: number) => void;
  onScore: (ref: number, strokes: number) => void;
  onResetScores: () => void;
  onClearMeasure: () => void;
  onExit: () => void;
}

export function CoursePanel(p: Props) {
  const [showCard, setShowCard] = useState(false);
  const { layout, hole, unit } = p;
  const holes = layout?.holes ?? [];
  const played = holes.filter((h) => p.scores[h.ref]);
  const total = played.reduce((s, h) => s + p.scores[h.ref], 0);
  const parPlayed = played.reduce((s, h) => s + (h.par ?? 0), 0);
  const diff = total - parPlayed;
  const strokes = hole ? p.scores[hole.ref] ?? 0 : 0;

  return (
    <div className="course">
      <div className="course-head">
        <div className="course-title">
          <span className="muted">Auf dem Platz</span>
          <strong>{p.club.name}</strong>
        </div>
        <div className="unit-toggle">
          {(['m', 'yd'] as Unit[]).map((u) => (
            <button key={u} className={u === unit ? 'on' : ''} onClick={() => p.onUnit(u)}>{u}</button>
          ))}
        </div>
        <button className="btn" onClick={p.onExit}>Beenden</button>
      </div>

      {p.loading && <p className="muted center">Lade Platzdaten …</p>}
      {p.notice && <p className="notice">{p.notice}</p>}

      {hole && (
        <>
          <div className="hole-nav">
            <button className="icon-btn" disabled={p.holeIdx === 0} onClick={() => p.onHole(p.holeIdx - 1)} aria-label="Vorheriges Loch">‹</button>
            <div className="hole-info">
              <span className="hole-no">Loch {hole.ref}</span>
              <span className="muted">
                {[hole.par && `Par ${hole.par}`, `${formatLen(pathLength(hole.path), unit)} ${unit}`, hole.handicap && `HCP ${hole.handicap}`]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </div>
            <button className="icon-btn" disabled={p.holeIdx >= holes.length - 1} onClick={() => p.onHole(p.holeIdx + 1)} aria-label="Nächstes Loch">›</button>
          </div>

          {p.distances && (
            <div className="green-dist">
              <Dist label="Vorne" value={p.distances.front} unit={unit} />
              <Dist label="Mitte" value={p.distances.center} unit={unit} big />
              <Dist label="Hinten" value={p.distances.back} unit={unit} />
            </div>
          )}
        </>
      )}

      <p className="pos-info muted">
        {p.positionInfo.gps
          ? `📡 GPS aktiv${p.positionInfo.accuracy ? ` (±${Math.round(p.positionInfo.accuracy)} m)` : ''}`
          : hole
            ? '📍 Gemessen vom Abschlag – du bist gerade nicht auf diesem Platz'
            : '📍 Kein GPS-Standort auf dem Platz'}
      </p>

      {p.measureDistances ? (
        <div className="measure">
          <span>
            🎯 Bis Punkt: <strong>{formatLen(p.measureDistances.toPoint, unit)} {unit}</strong>
            {p.measureDistances.pointToGreen != null && (
              <> · danach zum Grün: <strong>{formatLen(p.measureDistances.pointToGreen, unit)} {unit}</strong></>
            )}
          </span>
          <button className="icon-btn" onClick={p.onClearMeasure} aria-label="Messung löschen">✕</button>
        </div>
      ) : (
        <p className="hint">Tippe auf die Karte, um eine Entfernung zu messen (z. B. bis zum Bunker).</p>
      )}

      {hole && (
        <div className="score-row">
          <span>Schläge</span>
          <div className="stepper">
            <button onClick={() => p.onScore(hole.ref, Math.max(0, strokes - 1))} aria-label="Weniger">−</button>
            <strong className={strokes ? '' : 'placeholder'} title={strokes ? undefined : 'Noch kein Score'}>{strokes || hole.par || 0}</strong>
            <button onClick={() => p.onScore(hole.ref, strokes ? strokes + 1 : hole.par ?? 1)} aria-label="Mehr">+</button>
          </div>
          <button className="link-btn" onClick={() => setShowCard(!showCard)}>
            Gesamt {total || '–'}
            {played.length > 0 && parPlayed > 0 && ` (${diff === 0 ? 'E' : diff > 0 ? `+${diff}` : diff})`} {showCard ? '▴' : '▾'}
          </button>
        </div>
      )}

      {showCard && holes.length > 0 && (
        <div className="scorecard">
          <table>
            <thead>
              <tr><th>Loch</th>{holes.map((h) => <th key={h.ref}>{h.ref}</th>)}</tr>
            </thead>
            <tbody>
              <tr><td>Par</td>{holes.map((h) => <td key={h.ref}>{h.par ?? '–'}</td>)}</tr>
              <tr>
                <td>Score</td>
                {holes.map((h) => {
                  const s = p.scores[h.ref];
                  const d = s && h.par ? s - h.par : 0;
                  return (
                    <td key={h.ref} className={s ? (d < 0 ? 'under' : d > 0 ? 'over' : 'even') : ''} onClick={() => p.onHole(holes.indexOf(h))}>
                      {s || '·'}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
          <button className="link-btn" onClick={() => confirm('Neue Runde starten und Scores löschen?') && p.onResetScores()}>
            Neue Runde starten
          </button>
        </div>
      )}
    </div>
  );
}

function Dist({ label, value, unit, big }: { label: string; value: number | null; unit: Unit; big?: boolean }) {
  return (
    <div className={`gd${big ? ' big' : ''}`}>
      <span className="gd-value">{value == null ? '–' : formatLen(value, unit)}</span>
      <span className="gd-label">{label}</span>
    </div>
  );
}
