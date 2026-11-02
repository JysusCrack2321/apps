# Apps — Portal, Project Organizer (EDT) e Itinerario

Conjunto de herramientas locales de organización y planificación construidas con **JavaScript puro (módulos ES)** y **Python 3 (solo biblioteca estándar)**, sin dependencias externas.

## Estructura general

- `iniciar.py`: Lanzador unificado que valida `usuarios.json`, verifica disponibilidad de puertos y arranca los tres servidores con el mismo `--bind`.
- `portal/`: Portal de inicio en el puerto `8080` con selector de usuario compartido, modo claro/oscuro y tarjetas con estado en tiempo real hacia las dos aplicaciones.
- `project-organizer/`: Herramienta de Estructura de Desglose del Trabajo (EDT), Gantt y Tabla en el puerto `8088`.
- `itinerario-app/`: Herramienta de agenda diaria/semanal, entregas pendientes y planificador automático en el puerto `8090`.
- `usuarios.json`: Catálogo compartido de usuarios (`id`, `nombre`, `correo`, `rol`).
- `herramientas/grafo.mjs`: Generador y consultor estático del grafo de llamadas entre módulos JS y rutas Python (`grafo.json` y `GRAFO.md`).

---

## Cómo arrancar todo

### Modo unificado (recomendado)

Desde `~/apps`:

```bash
python3 iniciar.py
```

Para escuchar en todas las interfaces (red local o Tailscale):

```bash
python3 iniciar.py --bind 0.0.0.0
```

Al iniciar se imprimen las tres direcciones:
- **Portal:** `http://127.0.0.1:8080/`
- **Project Organizer (EDT):** `http://127.0.0.1:8080/edt/` (o directo en `http://127.0.0.1:8088/`)
- **Itinerario:** `http://127.0.0.1:8080/itinerario/` (o directo en `http://127.0.0.1:8090/`)

El portal es la **puerta única**: sirve cada app bajo su prefijo (`/edt/`, `/itinerario/`) y reenvía la petición al puerto correspondiente quitando el prefijo. Así un solo hostname (por ejemplo `web.gida.lat`) y un solo túnel de Cloudflare bastan para publicar todo, sin un enlace por aplicación.

Presiona `Ctrl+C` para cerrar limpiamente los tres servidores.

### Modo autónomo (cada aplicación por separado)

Ambas aplicaciones siguen funcionando de manera independiente sin el portal (y sin requerir `usuarios.json`):

```bash
# Solo Project Organizer (EDT)
python3 project-organizer/servidor.py

# Solo Itinerario
python3 itinerario-app/servidor.py
```

---

## Cómo correr las pruebas

Desde `~/apps`, ejecuta cualquiera de las suites de pruebas:

```bash
# 1. Pruebas de la Fase A (usuarios.json, generación de IDs, /api/yo, puertos)
python3 -m unittest pruebas/fase_a_test.py

# 2. Pruebas del servidor de Itinerario
(cd itinerario-app && python3 -m unittest pruebas/servidor_test.py)

# 3. Pruebas del modelo de Itinerario
node --test itinerario-app/pruebas/modelo.test.js

# 4. Pruebas del modelo de Project Organizer (EDT)
node --test project-organizer/pruebas/modelo.test.js

# 5. Pruebas de la herramienta de grafo de código
node --test herramientas/pruebas/grafo.test.mjs
```

---

## API para agentes: crear y borrar tareas

Además del documento completo (`GET/POST /api/datos` con `If-Match`), el Itinerario
expone endpoints por tarea pensados para agentes y scripts:

- `GET /api/tareas` — lista las tareas del usuario activo.
- `POST /api/tareas` — crea una tarea (`titulo` obligatorio; opcionales `materia`,
  `entrega`, `duracionMin`, `padre`, `notas`).
- `DELETE /api/tareas/<id>` — borra la tarea y sus subtareas.

El cliente listo para usar es `herramientas/tareas.py`:

```bash
# En local (sin túnel), eligiendo usuario por cookie:
python3 herramientas/tareas.py --cookie jysusman listar
python3 herramientas/tareas.py --cookie jysusman agregar --titulo "Informe" --duracion 90
python3 herramientas/tareas.py --cookie jysusman borrar --id t-a1b2c3

# Contra el sitio publicado, con un token de servicio de Cloudflare Access:
export GIDA_URL=https://web.gida.lat/itinerario
export CF_ACCESS_CLIENT_ID=... CF_ACCESS_CLIENT_SECRET=...
python3 herramientas/tareas.py agregar --titulo "Informe" --entrega 2026-11-06T23:59
```

---

## Cómo regenerar y verificar el grafo de código

Después de cualquier cambio en `.js` o `servidor.py`, regenera los archivos `grafo.json` y `GRAFO.md` de los tres proyectos:

```bash
node herramientas/grafo.mjs
```

Para comprobar que los grafos están sincronizados con el código fuente:

```bash
node herramientas/grafo.mjs --verificar
```
