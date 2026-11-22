import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

export function CicsFlightGame() {
  const gameRef = useRef(null);

  useEffect(() => {
    if (gameRef.current && typeof window.initCicsFlightGame === 'function') {
      window.initCicsFlightGame(gameRef.current);
    }
  }, []);

  return (
    <section className="landing-section cics-flight-section" aria-labelledby="cics-flight-heading">
      <div className="section-header-row">
        <div>
          <span className="section-kicker">Quick Campus Break</span>
          <h2 id="cics-flight-heading" className="section-title">CICS Flight</h2>
          <p className="section-subcopy">
            Guide a little paper plane between the room pillars. It is just for fun; your best score stays on this device.
          </p>
        </div>
      </div>

      <div className="cics-flight-game" data-cics-flight-game ref={gameRef}>
        <div className="cics-flight-toolbar">
          <div className="cics-flight-scores" aria-label="Game scores">
            <span>Score <strong data-flight-score>0</strong></span>
            <span>Best <strong data-flight-best>0</strong></span>
          </div>
          <div className="cics-flight-controls">
            <button type="button" className="btn btn-coral btn-sm" data-flight-start>Play</button>
            <button type="button" className="btn btn-glass btn-sm" data-flight-pause disabled>Pause</button>
          </div>
        </div>

        <canvas
          className="cics-flight-canvas"
          data-flight-canvas
          tabIndex={0}
          aria-label="CICS Flight game. Tap or click to fly, or focus this game and press Space or Arrow Up. Press Escape to pause."
        >
          CICS Flight: tap, click, or press Space to fly between the room pillars.
        </canvas>

        <p className="cics-flight-status" data-flight-status role="status" aria-live="polite">
          Press Play, tap, or press Space to start.
        </p>

        <div className="cics-flight-cta" data-flight-cta hidden>
          <span>Ready for the real CICS spaces?</span>
          <div>
            <Link to="/facilities" className="btn btn-on-coral btn-sm">Browse Spaces</Link>
            <Link to="/#reservations" className="btn btn-cta-secondary btn-sm">Check Availability</Link>
          </div>
        </div>
      </div>
      <p className="cics-flight-hint">Controls: tap or click the playfield, press Space / ↑ to fly, or press Esc to pause.</p>
    </section>
  );
}
