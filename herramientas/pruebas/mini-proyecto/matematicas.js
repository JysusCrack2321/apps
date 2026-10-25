export function sumar(a, b) {
  return a + b;
}

export class Calculadora {
  constructor() {
    this.total = 0;
  }

  acumular(val) {
    this.total = sumar(this.total, val);
    return this.total;
  }
}
