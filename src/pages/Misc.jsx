import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { SUPPORT_INFO } from '../data/components';

export function Guidelines() {
  return (
    <div className="container page narrow prose">
      <h1>Publishing guidelines</h1>
      <h2>Quality</h2>
      <ul>
        <li>Include clear documentation and at least one screenshot.</li>
        <li>Use semantic versioning and write release notes for every version.</li>
        <li>Test against the minimum platform version you declare.</li>
      </ul>
      <h2>Support levels</h2>
      <dl className="facts">
        {Object.entries(SUPPORT_INFO).map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}
      </dl>
      <h2>Security</h2>
      <p>Do not include credentials, and keep third-party libraries up to date. Components with known vulnerabilities may be unlisted.</p>
      <p><Link to="/submit" className="btn btn-primary">Start a submission</Link></p>
    </div>
  );
}

export function NotFound() {
  return (
    <div className="container page narrow center">
      <div className="empty-icon">🧩</div>
      <h1>Page not found</h1>
      <p className="muted">The page or component you're looking for doesn't exist.</p>
      <Link to="/components" className="btn btn-primary">Browse components</Link>
    </div>
  );
}
