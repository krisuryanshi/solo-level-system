export default function SystemModal({ open, title, lines = [], onAccept }) {
  if (!open) return null;

  return (
    <div className="sys-overlay" onClick={onAccept}>
      <div className="sys-card" onClick={(e) => e.stopPropagation()}>
        <div className="sys-header">
          <div className="sys-tag">NOTIFICATION</div>
          <div className="sys-title">{title}</div>
        </div>

        <div className="sys-body">
          {lines.map((line, i) => (
            <div key={i} className="sys-line">
              <span className="sys-num">{String(i + 1).padStart(2, "0")}</span>
              <span className="sys-text">{line}</span>
            </div>
          ))}
        </div>

        <div className="sys-actions">
          <button className="sys-btn" onClick={onAccept}>
            Accept rewards
          </button>
        </div>
      </div>
    </div>
  );
}
