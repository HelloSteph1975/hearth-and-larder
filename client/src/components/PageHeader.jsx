export function PageHeader({ title, note, actions, children, className = '', style }) {
  return (
    <header className={`page-header ${className}`.trim()} style={style}>
      <div className="page-header-text">
        <h1>{title}</h1>
        {note && <p className="hand page-note">{note}</p>}
        {children}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
