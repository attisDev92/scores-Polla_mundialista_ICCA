import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import type { Pronostico, ResultadoReal, PuntajeJugador, OLDBMatch } from '../types';
import { calcularPuntos } from '../utils/scoring';

type StageConfig = {
  key: string;
  label: string;
  order: number;
  csvCandidates: string[];
  rounds: number[];
};

const STAGES: StageConfig[] = [
  {
    key: 'grupos',
    label: 'Grupos',
    order: 0,
    csvCandidates: ['/pronosticos.csv', '/pronosticos_limpios.csv'],
    rounds: [1, 2, 3],
  },
  {
    key: '16avos',
    label: '16avos de final',
    order: 1,
    csvCandidates: ["/pronosticos-16.csv", "/pronosticos-16'.csv"],
    rounds: [4],
  },
  {
    key: '8avos',
    label: '8avos de final',
    order: 2,
    csvCandidates: ['/pronosticos-8.csv'],
    rounds: [5],
  },
  {
    key: '4tos',
    label: '4tos de final',
    order: 3,
    csvCandidates: ['/pronosticos-4.csv'],
    rounds: [6],
  },
  {
    key: 'semis',
    label: 'Semifinales',
    order: 4,
    csvCandidates: ['/pronosticos-semis.csv'],
    rounds: [7],
  },
  {
    key: 'final',
    label: 'Final',
    order: 5,
    csvCandidates: ['/pronosticos-final.csv'],
    rounds: [8],
  },
];

const OLDB = (round: number) => `https://api.openligadb.de/getmatchdata/wm26/2026/${round}`;

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

const PLAYER_NAME_ALIASES: Record<string, string> = {
  'betsa paredes': 'Betsabe Paredes',
  'besta paredes': 'Betsabe Paredes',
  'betsabe paredes': 'Betsabe Paredes',
};

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizePlayerName(value: string): string {
  const normalized = normalizeText(value);
  if (!normalized) return '';

  const key = normalized
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  return PLAYER_NAME_ALIASES[key] ?? normalized;
}

function toCode(name: string): string {
  const key = name.trim().toLowerCase().normalize('NFC');
  // exact match
  if (TEAM_CODE[key]) return TEAM_CODE[key];
  // try NFD stripped (removes accent combining chars)
  const stripped = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return TEAM_CODE[stripped] ?? stripped.toUpperCase().slice(0, 3);
}

async function fetchFirstExistingText(candidates: string[]): Promise<string | null> {
  for (const candidate of candidates) {
    const response = await fetch(candidate);
    if (response.ok) return response.text();
  }
  return null;
}

async function fetchMatches(rounds: number[]): Promise<OLDBMatch[]> {
  const responses = await Promise.all(
    rounds.map(async (round) => {
      const response = await fetch(OLDB(round));
      if (!response.ok) return [] as OLDBMatch[];
      return (await response.json()) as OLDBMatch[];
    })
  );
  return responses.flat();
}

function getRegulationScore(match: OLDBMatch): { ga: number; gb: number } {
  const afterNinety = match.matchResults.find((result) => result.resultTypeID === 3);
  if (afterNinety) {
    return {
      ga: afterNinety.pointsTeam1,
      gb: afterNinety.pointsTeam2,
    };
  }

  const hasExtraTimeOrPenalties = match.matchResults.some(
    (result) => result.resultTypeID === 4 || result.resultTypeID === 5
  );

  if (!hasExtraTimeOrPenalties) {
    const official = match.matchResults.find((result) => result.resultTypeID === 2);
    return {
      ga: official?.pointsTeam1 ?? 0,
      gb: official?.pointsTeam2 ?? 0,
    };
  }

  const team1Id = match.team1.teamId;
  const team2Id = match.team2.teamId;
  const afterExtraTime = match.matchResults.find((result) => result.resultTypeID === 4);
  const regulationGoals = (match.goals ?? []).filter((goal) => {
    const comment = goal.comment?.toLowerCase() ?? '';
    return !comment.includes('elfmeterschie') && goal.matchMinute != null;
  });
  const usesContinuousExtraTimeClock = regulationGoals.some(
    (goal) => (goal.matchMinute ?? 0) > 100
  );

  let ga = 0;
  let gb = 0;
  let hasClearExtraTimeGoal = false;

  for (const goal of regulationGoals) {
    const comment = goal.comment?.toLowerCase() ?? '';
    const minute = goal.matchMinute ?? 0;

    // Keep goals scored in added time of regular play (e.g. 90+4 => minute 94),
    // but exclude extra-time goals and shootout events.
    if (
      minute > 90 &&
      (usesContinuousExtraTimeClock || goal.isOvertime || comment.includes('verlangerung'))
    ) {
      hasClearExtraTimeGoal = true;
      continue;
    }

    if (goal.scoringTeamId === team1Id) ga += 1;
    if (goal.scoringTeamId === team2Id) gb += 1;
  }

  // OpenLigaDB sometimes omits minute details for added-time goals. If we do not see
  // explicit extra-time goals, prefer the "after extra time" aggregate score.
  if (!hasClearExtraTimeGoal && afterExtraTime) {
    return {
      ga: afterExtraTime.pointsTeam1,
      gb: afterExtraTime.pointsTeam2,
    };
  }

  return { ga, gb };
}

function buildLookup(matches: OLDBMatch[]) {
  const lookup = new Map<string, { ga: number; gb: number; jugado: boolean; fecha: string }>();

  for (const match of matches) {
    const regulation = getRegulationScore(match);
    const base = {
      ga: regulation.ga,
      gb: regulation.gb,
      jugado: Boolean(match.matchIsFinished),
      fecha: match.matchDateTimeUTC,
    };

    lookup.set(`${match.team1.shortName}__${match.team2.shortName}`, base);
    lookup.set(`${match.team2.shortName}__${match.team1.shortName}`, {
      ...base,
      ga: base.gb,
      gb: base.ga,
    });
  }

  return lookup;
}

function parsePronosticos(csvText: string, stage: StageConfig): Pronostico[] {
  const { data } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    transformHeader: (header) => header.replace(/^\uFEFF/, '').trim(),
  });

  const rows = data
    .map((row) => ({
      nombre: normalizePlayerName(row.nombre ?? ''),
      id_partido: parseInt(row.id_partido, 10),
      grupo: normalizeText(row.grupo ?? row.fase ?? stage.label),
      etapa: normalizeText(row.etapa ?? row.fase ?? stage.label),
      etapaOrden: stage.order,
      equipo_a_code: toCode(row.equipo_a ?? ''),
      equipo_b_code: toCode(row.equipo_b ?? ''),
      equipo_a: normalizeText(row.equipo_a ?? ''),
      equipo_b: normalizeText(row.equipo_b ?? ''),
      goles_a: parseInt(row.goles_a, 10),
      goles_b: parseInt(row.goles_b, 10),
    }))
    .filter((row) => row.nombre && !Number.isNaN(row.id_partido));

  const deduped = new Map<string, Pronostico>();
  for (const row of rows) {
    deduped.set(`${row.nombre}__${row.id_partido}`, row);
  }

  return [...deduped.values()];
}

function buildResultados(
  matches: OLDBMatch[],
  stage: StageConfig,
  lookup: Map<string, { ga: number; gb: number; jugado: boolean; fecha: string }>
): ResultadoReal[] {
  const orderedMatches = [...matches].sort((a, b) =>
    a.matchDateTimeUTC.localeCompare(b.matchDateTimeUTC) || a.matchID - b.matchID
  );

  return orderedMatches.map((match, index) => {
    const found = lookup.get(`${match.team1.shortName}__${match.team2.shortName}`) ?? null;

    return {
      id: index + 1,
      etapa: stage.label,
      etapaOrden: stage.order,
      team1_code: match.team1.shortName,
      team2_code: match.team2.shortName,
      team1_original: match.team1.teamName,
      team2_original: match.team2.teamName,
      goles_a: found?.ga ?? 0,
      goles_b: found?.gb ?? 0,
      jugado: found?.jugado ?? false,
      grupo: stage.label,
      fecha: found?.fecha ?? match.matchDateTimeUTC,
    };
  });
}

function findResultado(
  resultados: ResultadoReal[],
  pronostico: Pronostico
): { resultado: ResultadoReal | undefined; invertido: boolean } {
  const directo = resultados.find(
    (r) =>
      r.etapaOrden === pronostico.etapaOrden &&
      r.team1_code === pronostico.equipo_a_code &&
      r.team2_code === pronostico.equipo_b_code
  );

  if (directo) return { resultado: directo, invertido: false };

  const invertido = resultados.find(
    (r) =>
      r.etapaOrden === pronostico.etapaOrden &&
      r.team1_code === pronostico.equipo_b_code &&
      r.team2_code === pronostico.equipo_a_code
  );

  return { resultado: invertido, invertido: true };
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
        const stageData = await Promise.all(
          STAGES.map(async (stage) => {
            const [csvText, matches] = await Promise.all([
              fetchFirstExistingText(stage.csvCandidates),
              fetchMatches(stage.rounds),
            ]);

            const lookup = buildLookup(matches);
            const pronosticosStage = csvText ? parsePronosticos(csvText, stage) : [];
            const resultadosStage = buildResultados(matches, stage, lookup);

            return {
              stage,
              pronosticos: pronosticosStage,
              resultados: resultadosStage,
              jugados: resultadosStage.filter((result) => result.jugado).length,
            };
          })
        );

        const pronosticosData = stageData.flatMap((item) => item.pronosticos);
        const resultadosData = stageData.flatMap((item) => item.resultados);

        setPronosticos(pronosticosData);
        setResultados(resultadosData);
        setJugados(resultadosData.filter((result) => result.jugado).length);

        // Calculate ranking
        const scores: Record<string, PuntajeJugador> = {};
        for (const p of pronosticosData) {
          if (!scores[p.nombre]) {
            scores[p.nombre] = { nombre: p.nombre, puntos: 0, aciertos: 0, exactos: 0, jugados: 0 };
          }
          const { resultado: res, invertido } = findResultado(resultadosData, p);
          if (!res?.jugado) continue;

          const real = invertido
            ? { goles_a: res.goles_b, goles_b: res.goles_a }
            : { goles_a: res.goles_a, goles_b: res.goles_b };

          const pts = calcularPuntos(
            { goles_a: p.goles_a, goles_b: p.goles_b },
            real
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
