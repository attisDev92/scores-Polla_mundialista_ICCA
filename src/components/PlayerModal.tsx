import { useEffect } from 'react';
import type { Pronostico, ResultadoReal } from '../types';

interface PronosticoConResultado extends Pronostico {
  res?: ResultadoReal;
  puntos: number | null;
}

interface Props {
  player: {
    nombre: string;
    pronosticos: PronosticoConResultado[];
  };
  onClose: () => void;
}

const puntosClass = (pts: number | null) => {
  if (pts === null) return 'pts-pending';
  if (pts === 2) return 'pts-exacto';
  if (pts === 1) return 'pts-correcto';
  return 'pts-fallo';
};

const puntosLabel = (pts: number | null) => {
  if (pts === null) return '–';
  if (pts === 2) return '+2 ⭐';
  if (pts === 1) return '+1 ✓';
  return '0';
};

export default function PlayerModal({ player, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const byGroup = player.pronosticos.reduce<Record<string, PronosticoConResultado[]>>(
    (acc, p) => {
      const g = p.grupo || 'Otro';
      if (!acc[g]) acc[g] = [];
      acc[g].push(p);
      return acc;
    },
    {}
  );

  const totalPts = player.pronosticos.reduce((s, p) => s + (p.puntos ?? 0), 0);
  const exactos = player.pronosticos.filter((p) => p.puntos === 2).length;
  const aciertos = player.pronosticos.filter((p) => p.puntos === 1).length;
  const jugados = player.pronosticos.filter((p) => p.puntos !== null).length;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>{player.nombre}</h2>
            <div className="modal-stats">
              <span className="stat-badge stat-pts">{totalPts} pts</span>
              <span className="stat-badge stat-exacto">⭐ {exactos} exactos</span>
              <span className="stat-badge stat-correct">✓ {aciertos} correctos</span>
              <span className="stat-badge">{jugados} / {player.pronosticos.length} jugados</span>
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <div className="modal-body">
          {Object.entries(byGroup)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([grupo, prods]) => (
              <div key={grupo} className="group-section">
                <h3 className="group-title">Grupo {grupo}</h3>
                <div className="match-grid-header">
                  <span>Partido</span>
                  <span>Pronóstico</span>
                  <span>Real</span>
                  <span>Pts</span>
                </div>
                {prods.map((p) => (
                  <div key={p.id_partido} className={`match-row ${puntosClass(p.puntos)}`}>
                    <span className="match-teams">
                      {p.equipo_a} <em>vs</em> {p.equipo_b}
                    </span>
                    <span className="match-score pred">
                      {p.goles_a} – {p.goles_b}
                    </span>
                    <span className="match-score real">
                      {p.res?.jugado ? `${p.res.goles_a} – ${p.res.goles_b}` : '–'}
                    </span>
                    <span className={`match-pts ${puntosClass(p.puntos)}`}>
                      {puntosLabel(p.puntos)}
                    </span>
                  </div>
                ))}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
