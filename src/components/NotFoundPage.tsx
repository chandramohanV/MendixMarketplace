import { Link } from 'react-router-dom';
import { routes } from '../lib/routes';

export default function NotFoundPage() {
  return (
    <div className="container page narrow center">
      <div className="empty-icon">🧩</div>
      <h1>Page not found</h1>
      <p className="muted">The page or component you're looking for doesn't exist.</p>
      <Link to={routes.explore()} className="btn btn-primary">
        Browse components
      </Link>
    </div>
  );
}
