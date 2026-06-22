import { usePollaData } from './hooks/usePollaData';
import Ranking from './components/Ranking';
import './App.css';

function App() {
  const { ranking, pronosticos, resultados, jugados, loading, error, lastUpdated } =
    usePollaData();

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
                <span className="stat-num">{72 - jugados}</span>
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

      <footer className="app-footer">
        <span>
          Resultados via{' '}
          <a
            href="https://github.com/openfootball/worldcup.json"
            target="_blank"
            rel="noreferrer"
          >
            OpenFootball
          </a>
        </span>
      </footer>
    </div>
  );
}

export default App;
