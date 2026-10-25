import { sumar as sumaConAlias, Calculadora } from './matematicas.js';
import { ejecutarOperacion } from './modulo_contexto.js';

export function accionInterna() {
  return 42;
}

export function procesarDatos() {
  // 1. Llamada con alias
  const s = sumaConAlias(10, 20);

  // 2. Llamada a método de clase
  const calc = new Calculadora();
  calc.acumular(s);

  // 3. Llamada dentro de flecha en addEventListener
  const btn = document.createElement('button');
  btn.addEventListener('click', () => accionInterna());

  // 4. Función pasada en un objeto a otro módulo
  ejecutarOperacion({ operacion: sumaConAlias });

  // 5. GET a /api/saludo
  fetch('/api/saludo');

  // 6. POST a /api/saludo
  fetch('/api/saludo', { method: 'POST', body: '{}' });

  // 7. Llamada nativa ([].map) -> externa
  const duplicados = [1, 2, 3].map(x => x * 2);

  // 8. Llamada que no se puede resolver (debe quedar dudosa)
  llamadaMisteriosa();

  return s;
}
