import { Icon } from '../../components/icons';
import { shortDate } from '../../lib/dates';
import { initials } from '../../lib/text';
import type { Component } from '../../types';
import { requiredStudio } from './detail';

export function OverviewTab({ c }: { c: Component }) {
  const isCatalogComponent = !c.status;
  return (
    <div className="tab-panel prose">
      <h3>Overview</h3>
      {c.description ? (
        c.description.split(/\n{2,}/).map((paragraph, i) => (
          <p key={i} className="pre-line">
            {paragraph}
          </p>
        ))
      ) : (
        <p>
          {c.short} {c.name} integrates seamlessly with your existing applications and follows platform best practices,
          helping teams reduce custom development and deliver faster.
        </p>
      )}
      <p>
        NOTE: version {c.version} requires at least Studio version {requiredStudio(c)}.
        {isCatalogComponent &&
          ' For older Studio versions, use one of the previous releases listed under the Releases tab.'}
      </p>
      {isCatalogComponent && (
        <>
          <h3>Typical usage scenario</h3>
          <ul>
            <li>Accelerate delivery of {c.category.toLowerCase()} features</li>
            <li>Standardize implementation across multiple apps</li>
            <li>Reduce maintenance with a supported, versioned component</li>
          </ul>
        </>
      )}
      {c.features.length > 0 && (
        <>
          <h3>Features and limitations</h3>
          <ul>
            {c.features.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

const CONFIG_CONSTANTS = [
  { suffix: 'Enabled', description: 'Turns the component on or off', defaultValue: 'true' },
  { suffix: 'LogLevel', description: 'Logging verbosity', defaultValue: 'INFO' },
  { suffix: 'Timeout', description: 'Request timeout in seconds', defaultValue: '30' },
];

export function DocumentationTab({ c }: { c: Component }) {
  const prefix = c.name.replace(/\W+/g, '');
  return (
    <div className="tab-panel prose">
      <h3>Installation</h3>
      <ol>
        <li>
          Click <b>Use in Studio</b>, or download the package from the Releases tab.
        </li>
        <li>
          Import the package into your app via <code>App › Import module package</code>.
        </li>
        <li>Configure the constants listed below for each environment.</li>
        <li>Add the provided snippets or pages to your navigation.</li>
      </ol>
      <h3>Configuration</h3>
      <table className="table">
        <thead>
          <tr>
            <th>Constant</th>
            <th>Description</th>
            <th>Default</th>
          </tr>
        </thead>
        <tbody>
          {CONFIG_CONSTANTS.map(({ suffix, description, defaultValue }) => (
            <tr key={suffix}>
              <td>
                <code>
                  {prefix}.{suffix}
                </code>
              </td>
              <td>{description}</td>
              <td>{defaultValue}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>Dependencies</h3>
      <ul>
        <li>Community Commons (v9+)</li>
        <li>Studio {requiredStudio(c)} or newer</li>
      </ul>
    </div>
  );
}

export function ReleasesTab({ c, onDownload }: { c: Component; onDownload: (version: string) => void }) {
  return (
    <div className="tab-panel">
      {c.releases.map((release, i) => (
        <div key={release.version + i} className="release">
          <div className="release-head">
            <h3>Version {release.version}</h3>
            {i === 0 && <span className="badge badge-platform">Latest</span>}
            <button className="btn btn-secondary sm" onClick={() => onDownload(release.version)}>
              <Icon name="download" /> Download
            </button>
          </div>
          <div className="muted small">
            Released {shortDate(release.date)} · Requires Studio {release.minPlatform}.0 or higher
          </div>
          <ul>
            {release.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function DevelopersTab({ developers, publisher }: { developers: string[]; publisher: string }) {
  return (
    <div className="tab-panel">
      <div className="dev-list">
        {developers.map((name) => (
          <div key={name} className="dev">
            <span className="avatar lg">{initials(name)}</span>
            <div>
              <b>{name}</b>
              <div className="muted small">{publisher}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
