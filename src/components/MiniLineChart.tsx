export function MiniLineChart({
  title,
  values,
  format = (value) => String(value),
  tone = "blue",
}: {
  title: string;
  values: Array<{ label: string; value: number }>;
  format?: (value: number) => string;
  tone?: "blue" | "gold" | "coral";
}) {
  if (!values.length) {
    return <div className="mini-chart empty"><h4>{title}</h4><p>Not enough data yet.</p></div>;
  }
  const width = 320;
  const height = 112;
  const padX = 18;
  const padY = 18;
  const min = Math.min(...values.map((point) => point.value));
  const max = Math.max(...values.map((point) => point.value));
  const range = max - min || 1;
  const points = values.map((point, index) => ({
    ...point,
    x: values.length === 1 ? width / 2 : padX + (index / (values.length - 1)) * (width - padX * 2),
    y: height - padY - ((point.value - min) / range) * (height - padY * 2),
  }));

  return (
    <figure className={`mini-chart ${tone}`}>
      <figcaption><h4>{title}</h4><strong>{format(values.at(-1)!.value)}</strong></figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title}: ${values.map((point) => `${point.label}, ${format(point.value)}`).join("; ")}`}>
        <line x1={padX} x2={width - padX} y1={height - padY} y2={height - padY} className="chart-axis" />
        <polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} className="chart-line" />
        {points.map((point, index) => <circle key={`${point.label}-${index}`} cx={point.x} cy={point.y} r="3.5" className="chart-point"><title>{point.label}: {format(point.value)}</title></circle>)}
      </svg>
      <div className="chart-range"><span>{values[0].label}</span><span>{values.at(-1)!.label}</span></div>
    </figure>
  );
}
