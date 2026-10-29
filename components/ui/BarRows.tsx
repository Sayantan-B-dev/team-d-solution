type Row = { name: string; clicks: number };

type Props = {
  title: string;
  rows: Row[];
  empty: string;
};

export default function BarRows({ title, rows, empty }: Props) {
  const max = Math.max(1, ...rows.map((row) => row.clicks));

  return (
    <div>
      <span className="label">{title}</span>
      {rows.length === 0 ? (
        <p className="bars-empty">{empty}</p>
      ) : (
        rows.map((row) => (
          <div className="bar-row" key={row.name}>
            <span className="name" title={row.name}>
              {row.name}
            </span>
            <div className="track">
              <div
                className="fill"
                style={{ width: `${Math.max(3, (row.clicks / max) * 100)}%` }}
              />
            </div>
            <span className="count">{row.clicks}</span>
          </div>
        ))
      )}
    </div>
  );
}
