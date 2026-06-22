export interface Pronostico {
  nombre: string;
  id_partido: number;
  grupo: string;
  equipo_a: string;
  equipo_b: string;
  goles_a: number;
  goles_b: number;
}

export interface ResultadoReal {
  id: number;
  team1_original: string;
  team2_original: string;
  goles_a: number;
  goles_b: number;
  jugado: boolean;
  grupo: string;
  fecha: string;
  round: string;
}

export interface PuntajeJugador {
  nombre: string;
  puntos: number;
  aciertos: number;
  exactos: number;
  jugados: number;
}

export interface OLDBMatch {
  matchID: number;
  matchDateTimeUTC: string;
  group: { groupName: string; groupOrderID: number; groupID: number };
  team1: { teamId: number; teamName: string; shortName: string };
  team2: { teamId: number; teamName: string; shortName: string };
  matchIsFinished: boolean;
  matchResults: Array<{
    resultID: number;
    resultTypeID: number; // 1 = halftime, 2 = fulltime
    pointsTeam1: number;
    pointsTeam2: number;
  }>;
}
