export function AboutSection() {
  return (
    <div className="settings-section__body">
      <div className="settings-about">
        <div className="settings-about__row">
          <span className="settings-about__label">Version</span>
          <span className="settings-about__value">0.1.0</span>
        </div>

        <div className="settings-about__row">
          <span className="settings-about__label">Built with</span>
          <span className="settings-about__value">
            Built with love, faith, and a lot of late nights.
          </span>
        </div>

        <div className="settings-about__acknowledgments">
          <span className="settings-about__label">Acknowledgments</span>
          <ul className="settings-about__list">
            <li>Stephen R. Covey</li>
            <li>Nicholeen Peck</li>
            <li>Oliver DeMille</li>
            <li>Rabbi Daniel Lapin</li>
          </ul>
        </div>

        <div className="settings-about__links">
          <a
            href="mailto:feedback@stewardship.app"
            className="settings-about__link"
          >
            Have feedback? Get in touch
          </a>
        </div>
      </div>
    </div>
  );
}
