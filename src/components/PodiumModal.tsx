import { useEffect } from 'react';
import type { PuntajeJugador } from '../types';

interface Props {
  players: PuntajeJugador[];
  onClose: () => void;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export default function PodiumModal({ players, onClose }: Props) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop podium-backdrop" onClick={onClose}>
      <div className="modal-content podium-content" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header podium-header">
          <div>
            <span className="podium-kicker">Final de la polla</span>
            <h2>Podio final</h2>
            <p className="podium-subtitle">Los tres mejores pronosticadores del torneo</p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar podio">
            ✕
          </button>
        </div>

        <div className="podium-body">
          <div className="podium-list">
            {players.map((player, index) => (
              <article key={player.nombre} className={`podium-card podium-card-${index + 1}`}>
                <div className="podium-rank">{MEDALS[index]}</div>
                <div className="podium-player">
                  <h3>{player.nombre}</h3>
                  <div className="podium-points">{player.puntos} pts</div>
                </div>
                <div className="podium-stats">
                  <span>
                    <strong>{player.exactos}</strong> exactos
                  </span>
                  <span>
                    <strong>{player.aciertos}</strong> acertados
                  </span>
                  <span>
                    <strong>{player.jugados}</strong> jugados
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}