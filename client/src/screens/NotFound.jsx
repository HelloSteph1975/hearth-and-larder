import { Link } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState.jsx';
import { Button } from '../components/Button.jsx';

export function NotFound() {
  return (
    <EmptyState art="basket" title="That page wandered off"
      body="We looked in the pantry and under the table, but it isn't here."
      action={<Button as={Link} to="/">Back to the hearth</Button>} />
  );
}
