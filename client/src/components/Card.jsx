export function Card({ as: Comp = 'div', tone = 'cream', className = '', children, ...props }) {
  return (
    <Comp className={`card card-${tone} ${className}`.trim()} {...props}>
      {children}
    </Comp>
  );
}
