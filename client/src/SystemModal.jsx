// SystemModal.jsx
export default function SystemModal({
  open,
  title,
  highlight = "",
  suffix = "",
  lines = [],
  onAccept,
  animClass = "sys-open",
}) {
  if (!open) return null;

  return (
    <div className="sys-overlay" onClick={onAccept}>
      <div
        className={`sys-card bg-surface ${animClass}`}
        style={{ "--trackPopup": 1 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sys-header">
          <div className="sys-tag">NOTIFICATION</div>

          <div className="sys-title">
            {title}{" "}
            {highlight ? <span className="sys-highlight">[{highlight}]</span> : null}
            {suffix}
          </div>
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
