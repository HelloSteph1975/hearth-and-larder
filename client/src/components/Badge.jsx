export function Badge({ tone = 'honey', className = '', children, ...props }) {
  return (
    <span className={`badge badge-${tone} ${className}`.trim()} {...props}>
      {children}
    </span>
  );
}
