import { useEffect, useMemo, useState } from 'react';
import { usePollaData } from './hooks/usePollaData';
import Ranking from './components/Ranking';
import PodiumModal from './components/PodiumModal';
import './App.css';

function App() {
  const { ranking, pronosticos, resultados, jugados, loading, error, lastUpdated } =
    usePollaData();
  const partidosTotales = resultados.length;
  const podium = useMemo(() => ranking.slice(0, 3), [ranking]);
  const [showPodium, setShowPodium] = useState(false);

  useEffect(() => {
    if (loading || error) return;
    if (partidosTotales === 0 || jugados !== partidosTotales || podium.length < 3) return;
    if (window.sessionStorage.getItem('podium-dismissed') === '1') return;
    setShowPodium(true);
  }, [loading, error, jugados, partidosTotales, podium.length]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <h1>⚽ Polla Mundialista ICCA 2026</h1>
          <p className="header-subtitle">Mundial Canada - USA - Mexico</p>
        </div>
      </header>

      <main className="app-main">
        {loading && (
          <div className="status-card loading">
            <div className="spinner" />
            <span>Cargando resultados en vivo...</span>
          </div>
        )}

        {error && (
          <div className="status-card error">
            <span>⚠️ {error}</span>
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="stats-bar">
              <div className="stat-item">
                <span className="stat-num">{jugados}</span>
                <span className="stat-label">Partidos jugados</span>
              </div>
              <div className="stat-item">
                <span className="stat-num">{partidosTotales - jugados}</span>
                <span className="stat-label">Pendientes</span>
              </div>
              <div className="stat-item">
                <span className="stat-num">{ranking.length}</span>
                <span className="stat-label">Participantes</span>
              </div>
              {lastUpdated && (
                <div className="stat-item">
                  <span className="stat-num updated">{lastUpdated}</span>
                  <span className="stat-label">Actualizado</span>
                </div>
              )}
            </div>

            <p className="section-hint">Haz clic en un jugador para ver sus pronosticos</p>

            <Ranking ranking={ranking} pronosticos={pronosticos} resultados={resultados} />
          </>
        )}
      </main>

      {!loading && !error && showPodium && podium.length >= 3 && (
        <PodiumModal
          players={podium}
          onClose={() => {
            window.sessionStorage.setItem('podium-dismissed', '1');
            setShowPodium(false);
          }}
        />
      )}

      <footer className="app-footer">
        <span>
          Resultados via{' '}
          <a
            href="https://www.openligadb.de/"
            target="_blank"
            rel="noreferrer"
          >
            OpenLigaDB
          </a>
        </span>
      </footer>
    </div>
  );
}

export default App;
