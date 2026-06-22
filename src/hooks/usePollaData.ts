import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import type { Pronostico, ResultadoReal, PuntajeJugador, OLDBMatch } from '../types';
import { calcularPuntos } from '../utils/scoring';

// OpenLigaDB: one endpoint per Gruppenphase matchday (1, 2, 3)
const OLDB = (round: number) =>
  `https://api.openligadb.de/getmatchdata/wm26/2026/${round}`;

// Spanish team name (lowercase) → OpenLigaDB shortName (FIFA/UEFA code)
const TEAM_CODE: Record<string, string> = {
  // Group A
  mexico: 'MEX', sudafrica: 'RSA', 'corea sur': 'KOR', corea: 'KOR',
  chequia: 'CZE', checa: 'CZE',
  // Group B
  canada: 'CAN', 'canada\u0301': 'CAN', bosnia: 'BIH', suiza: 'CHE', catar: 'QAT',
  // Group C
  haiti: 'HTI', escocia: 'SCT', brasil: 'BRA', marruecos: 'MAR',
  // Group D
  usa: 'USA', paraguay: 'PAR', australia: 'AUS', turquia: 'TUR',
  // Group E
  alemania: 'GER', curazao: 'CUW', 'costa de marfil': 'CIV', ecuador: 'ECU',
  // Group F
  holanda: 'NLD', japon: 'JPN', suecia: 'SWE', tunez: 'TUN',
  // Group G
  iran: 'IRN', 'nueva zelanda': 'NZL', belgica: 'BEL', egipto: 'EGY',
  // Group H
  'arabia saudi': 'SAU', uruguay: 'URY', espana: 'ESP', espa\u00f1a: 'ESP',
  'cabo verde': 'CPV', cabo: 'CPV',
  // Group I
  francia: 'FRA', senegal: 'SEN', irak: 'IRQ', noruega: 'NOR',
  // Group J
  argentina: 'ARG', argelia: 'DZA', austria: 'AUT', jordania: 'JOR',
  // Group K
  portugal: 'PRT', congo: 'COD', uzbekistan: 'UZB', colombia: 'COL',
  // Group L
  ghana: 'GHA', panama: 'PAN', 'panam\u00e1': 'PAN', inglaterra: 'ENG', croacia: 'HRV',
};

function toCode(name: string): string {
  const key = name.trim().toLowerCase().normalize('NFC');
  // exact match
  if (TEAM_CODE[key]) return TEAM_CODE[key];
  // try NFD stripped (removes accent combining chars)
  const stripped = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return TEAM_CODE[stripped] ?? stripped.toUpperCase().slice(0, 3);
}

export interface PollaData {
  pronosticos: Pronostico[];
  resultados: ResultadoReal[];
  ranking: PuntajeJugador[];
  jugados: number;
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
}

export function usePollaData(): PollaData {
  const [pronosticos, setPronosticos] = useState<Pronostico[]>([]);
  const [resultados, setResultados] = useState<ResultadoReal[]>([]);
  const [ranking, setRanking] = useState<PuntajeJugador[]>([]);
  const [jugados, setJugados] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [csvText, r1, r2, r3] = await Promise.all([
          fetch('/pronosticos.csv').then((r) => {
            if (!r.ok) throw new Error('No se pudo cargar pronosticos.csv');
            return r.text();
          }),
          fetch(OLDB(1)).then((r) => r.json() as Promise<OLDBMatch[]>),
          fetch(OLDB(2)).then((r) => r.json() as Promise<OLDBMatch[]>),
          fetch(OLDB(3)).then((r) => r.json() as Promise<OLDBMatch[]>),
        ]);

        // Parse CSV
        const { data } = Papa.parse<Record<string, string>>(csvText, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: false,
          transformHeader: (h) => h.trim(),
        });

        const pronosticosData: Pronostico[] = data
          .filter((r) => r.nombre && r.nombre.trim() !== 'nombre')
          .map((r) => ({
            nombre: r.nombre.trim(),
            id_partido: parseInt(r.id_partido, 10),
            grupo: r.grupo?.trim() ?? '',
            equipo_a: r.equipo_a?.trim() ?? '',
            equipo_b: r.equipo_b?.trim() ?? '',
            goles_a: parseInt(r.goles_a, 10),
            goles_b: parseInt(r.goles_b, 10),
          }));
        setPronosticos(pronosticosData);

        // Build lookup from OpenLigaDB: "CODE1__CODE2" → final score
        const allMatches: OLDBMatch[] = [...r1, ...r2, ...r3];
        const lookup = new Map<string, { ga: number; gb: number; jugado: boolean; fecha: string; round: string }>();
        for (const m of allMatches) {
          const ft = m.matchResults.find((r) => r.resultTypeID === 2);
          const key = `${m.team1.shortName}__${m.team2.shortName}`;
          lookup.set(key, {
            ga: ft?.pointsTeam1 ?? 0,
            gb: ft?.pointsTeam2 ?? 0,
            jugado: m.matchIsFinished && !!ft,
            fecha: m.matchDateTimeUTC,
            round: m.group.groupName,
          });
        }

        // Build unique match → id_partido map using first participant rows
        const uniqueById = new Map<number, Pronostico>();
        for (const p of pronosticosData) {
          if (!uniqueById.has(p.id_partido)) uniqueById.set(p.id_partido, p);
        }

        const ress: ResultadoReal[] = [];
        for (const [id, p] of uniqueById.entries()) {
          const cA = toCode(p.equipo_a);
          const cB = toCode(p.equipo_b);
          const fwd = lookup.get(`${cA}__${cB}`);
          const rev = lookup.get(`${cB}__${cA}`);
          const found = fwd ?? (rev ? { ...rev, ga: rev.gb, gb: rev.ga } : null);

          ress.push({
            id,
            team1_original: p.equipo_a,
            team2_original: p.equipo_b,
            goles_a: found?.ga ?? 0,
            goles_b: found?.gb ?? 0,
            jugado: found?.jugado ?? false,
            grupo: p.grupo,
            fecha: found?.fecha ?? '',
            round: found?.round ?? '',
          });
        }
        ress.sort((a, b) => a.id - b.id);
        setResultados(ress);

        const totalJugados = ress.filter((r) => r.jugado).length;
        setJugados(totalJugados);

        // Calculate ranking
        const scores: Record<string, PuntajeJugador> = {};
        for (const p of pronosticosData) {
          if (!scores[p.nombre]) {
            scores[p.nombre] = { nombre: p.nombre, puntos: 0, aciertos: 0, exactos: 0, jugados: 0 };
          }
          const res = ress.find((r) => r.id === p.id_partido);
          if (!res?.jugado) continue;

          const pts = calcularPuntos(
            { goles_a: p.goles_a, goles_b: p.goles_b },
            { goles_a: res.goles_a, goles_b: res.goles_b }
          );
          scores[p.nombre].jugados += 1;
          scores[p.nombre].puntos += pts;
          if (pts >= 1) scores[p.nombre].aciertos += 1;
          if (pts === 2) scores[p.nombre].exactos += 1;
        }

        const sorted = Object.values(scores).sort((a, b) => {
          if (b.puntos !== a.puntos) return b.puntos - a.puntos;
          if (b.exactos !== a.exactos) return b.exactos - a.exactos;
          return a.nombre.localeCompare(b.nombre);
        });
        setRanking(sorted);

        setLastUpdated(
          new Date().toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' })
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return { pronosticos, resultados, ranking, jugados, loading, error, lastUpdated };
}
