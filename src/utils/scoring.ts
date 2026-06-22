type Signo = 'local' | 'empate' | 'visitante';

function signo(a: number, b: number): Signo {
  if (a > b) return 'local';
  if (a < b) return 'visitante';
  return 'empate';
}

export function calcularPuntos(
  pred: { goles_a: number; goles_b: number },
  real: { goles_a: number; goles_b: number }
): number {
  if (signo(pred.goles_a, pred.goles_b) !== signo(real.goles_a, real.goles_b)) return 0;
  if (pred.goles_a === real.goles_a && pred.goles_b === real.goles_b) return 2;
  return 1;
}
