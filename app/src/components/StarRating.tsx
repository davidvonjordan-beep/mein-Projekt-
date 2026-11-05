interface Props {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
}

export function StarRating({ value, onChange, size = 16 }: Props) {
  return (
    <span className="stars" style={{ fontSize: size }} aria-label={`${value.toFixed(1)} von 5 Sternen`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - (i - 1)));
        const star = (
          <span className="star" key={i}>
            <span className="star-bg">★</span>
            <span className="star-fg" style={{ width: `${fill * 100}%` }}>★</span>
          </span>
        );
        return onChange ? (
          <button type="button" key={i} className="star-btn" onClick={() => onChange(i)} aria-label={`${i} Sterne`}>
            {star}
          </button>
        ) : (
          star
        );
      })}
    </span>
  );
}
