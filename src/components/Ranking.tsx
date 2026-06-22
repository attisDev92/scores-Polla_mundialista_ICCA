import { useState } from 'react';
import type { PuntajeJugador, Pronostico, ResultadoReal } from '../types';
import { calcularPuntos } from '../utils/scoring';
import PlayerModal from './PlayerModal';

interface Props {
  ranking: PuntajeJugador[];
  pronosticos: Pronostico[];
  resultados: ResultadoReal[];
}

const MEDALS = ['🥇', '🥈', '🥉'];

export default function Ranking({ ranking, pronosticos, resultados }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');

  const rankingFiltrado = busqueda.trim()
    ? ranking.filter((j) =>
        j.nombre.toLowerCase().includes(busqueda.toLowerCase())
      )
    : ranking;

  const selectedPlayer = selected
    ? {
        nombre: selected,
        pronosticos: pronosticos
          .filter((p) => p.nombre === selected)
          .sort((a, b) => a.id_partido - b.id_partido)
          .map((p) => {
            const res = resultados.find((r) => r.id === p.id_partido);
            return {
              ...p,
              res,
              puntos: res?.jugado
                ? calcularPuntos(
                    { goles_a: p.goles_a, goles_b: p.goles_b },
                    { goles_a: res.goles_a, goles_b: res.goles_b }
                  )
                : null,
            };
          }),
      }
    : null;

  return (
    <>
      <div className="search-bar">
        <input
          type="search"
          placeholder="Buscar jugador..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="search-input"
        />
      </div>
      <div className="ranking-table">
        <div className="ranking-header">
          <span className="col-pos">#</span>
          <span className="col-nombre">Jugador</span>
          <span className="col-pts">Pts</span>
          <span className="col-stat col-stat-label">⭐ Marcador exacto</span>
          <span className="col-stat col-stat-label">✓ Partido adivinado</span>
        </div>

        {rankingFiltrado.map((jugador) => {
          const posReal = ranking.indexOf(jugador);
          return (
          <div
            key={jugador.nombre}
            className={`ranking-row ${posReal < 3 ? 'top-' + (posReal + 1) : ''}`}
            onClick={() => setSelected(jugador.nombre)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && setSelected(jugador.nombre)}
          >
            <span className="col-pos">{posReal < 3 ? MEDALS[posReal] : posReal + 1}</span>
            <span className="col-nombre">{jugador.nombre}</span>
            <span className="col-pts points-badge">{jugador.puntos}</span>
            <span className="col-stat col-stat-value exactos">{jugador.exactos}</span>
            <span className="col-stat col-stat-value aciertos">{jugador.aciertos}</span>
          </div>
          );
        })}
      </div>

      {selectedPlayer && (
        <PlayerModal player={selectedPlayer} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
