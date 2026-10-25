# Itinerario — App personal de tareas y horario

Itinerario es una aplicación personal de planificación de tareas y horarios diseñada para responder dos preguntas centrales:
1. **¿Qué hago ahora?**: un itinerario por horas para el día.
2. **¿Qué viene y qué tan urgente es?**: entregas ordenadas por urgencia calculada dinámicamente.

Desarrollada para correr en computadores personales Linux y microordenadores Orange Pi Zero 3 / Raspberry Pi, con interfaz adaptable para dispositivos móviles.

---

## 🛠️ Restricciones técnicas y filosofía

- **Frontend:** HTML, CSS y JavaScript puros con **módulos ES**. Sin frameworks, sin compilación, sin npm en tiempo de ejecución, sin CDN. Todo local.
- **Backend:** `servidor.py` utilizando **únicamente la biblioteca estándar de Python 3** (`http.server`, `json`, `pathlib`…). Sin dependencias pip.
- **Datos e independencia por usuario:** archivos individuales en `usuarios/<id>.json` por cada integrante definido en `~/apps/usuarios.json`. Modo local **sin contraseña** con selector directo en cabecera o mediante cookie `usuario=<id>`. En modo autónomo sin usuario se usa `datos.json`.
- **Concurrencia:** control de concurrencia optimista con encabezados `ETag` e `If-Match`, detección de cambios en tiempo real vía Server-Sent Events (`/api/eventos`) y respaldos automáticos rotativos (últimos 30) en `respaldos/`.
- **Pruebas:** ejecutadas directamente con `node --test` y `python3 -m unittest`.

---

## 🚀 Cómo ejecutar

### 1. Iniciar el servidor
Por defecto se enlaza al puerto **8090** en `127.0.0.1`:

```bash
python3 servidor.py
```

Para especificar otro puerto o dirección IP de la red local:
```bash
python3 servidor.py 8090 --bind 0.0.0.0
```

### 2. Abrir la aplicación
Visita en tu navegador web:
```
http://127.0.0.1:8090/
```

---

## 🧪 Pruebas automáticas

### Pruebas del modelo puro (Node.js sin dependencias)
```bash
node --test
```

### Pruebas de integración del servidor (Python unittest)
```bash
python3 pruebas/servidor_test.py
```

---

## 📁 Estructura del proyecto

```
itinerario-app/
├── index.html              # Punto de entrada HTML5
├── datos.json              # Datos de tareas, materias, bloques y fijos
├── servidor.py             # Servidor HTTP con ETag y respaldos
├── respaldos/              # Copias automáticas antes de cada guardado
├── comun/
│   ├── modelo.js           # Lógica pura: validación tolerante, urgencia y operaciones inmutables
│   ├── tiempo.js           # Utilidades de fecha y hora local ISO (sin DOM)
│   ├── archivo.js          # Carga y guardado con control de ETag
│   ├── app.js              # Coordinador: estado, deshacer/rehacer (Ctrl+Z/Y), autoguardado
│   ├── editor.js           # Editor unificado lateral / hoja inferior móvil
│   └── estilos.css         # Tokens de diseño claro/oscuro y diseño adaptable
├── vistas/
│   ├── hoy.js              # Vista Hoy: timeline vertical, bloques y entregas
│   ├── semana.js           # Vista Semana: cuadrícula de 7 días
│   └── pendientes.js       # Vista Pendientes: tareas agrupadas por urgencia y subtareas
├── pruebas/
│   ├── modelo.test.js      # Pruebas con node:test
│   └── servidor_test.py    # Pruebas de servidor, ETag y respaldos
├── README.md
├── ESPECIFICACION.md
└── PROMPT-ANTIGRAVITY.md   # Contrato original del proyecto
```

---

## ⌨️ Atajos de teclado

- `Ctrl + S` / `Cmd + S`: Guardar inmediatamente.
- `Ctrl + Z` / `Cmd + Z`: Deshacer cambio.
- `Ctrl + Y` / `Cmd + Shift + Z`: Rehacer cambio.
- `Escape`: Cerrar editor.

---

## 🤖 Uso vía API y conexión con Skills de IA / Agentes

Itinerario expone una API REST limpia basada en JSON que permite a agentes de IA, scripts o skills externas consultar, agendar o completar tareas y bloques programados:

### 1. Autenticación y selección de usuario
- **Por Cookie (modo local / agentes):**
  Envía el encabezado `Cookie: usuario=<id>` en cada petición (ej. `usuario=paola-bello` o `usuario=jysusman`).
- **Por Cloudflare Access (producción):**
  Envía `Cf-Access-Authenticated-User-Email: usuario@correo.com`.
- **Sin contraseña:** no requiere tokens ni contraseñas adicionales.

### 2. Endpoints principales

#### `GET /api/yo`
Consulta la identidad del usuario activo según la cookie enviada.
- **Respuesta `200`:** `{"id": "paola-bello", "nombre": "Paola Bello", "rol": "miembro"}` o `null`.

#### `GET /api/usuarios`
Lista los usuarios registrados en el sistema.
- **Respuesta `200`:** `[{"id": "jysusman", "nombre": "Jesús Aragón", "rol": "admin"}, ...]`

#### `GET /api/datos`
Descarga el itinerario completo del usuario activo.
- **Cabeceras devueltas:** `ETag: "<timestamp_ns>"` (¡importante guardarlo para escribir!).
- **Estructura JSON devuelta (fuente de verdad: `validarDatos()` en `comun/modelo.js`):**

> **Advertencia de convención:** En el EDT (`project-organizer`) las actividades usan `nombre`; en el Itinerario (`itinerario-app`) las tareas y los fijos usan `titulo`. Usar `nombre` en una tarea hace que se guarde como `"Tarea N"` y se pierda el texto silenciosamente.

```json
{
  "version": 1,
  "config": { "inicioDia": "06:00", "finDia": "23:00", "bloqueMaxMin": 120, "pausaMin": 5 },
  "materias": [ { "id": "mat1", "nombre": "Cálculo", "color": "#2563eb" } ],
  "tareas": [ { "id": "t1", "titulo": "Taller 3", "materia": "mat1", "padre": null, "entrega": "2026-10-28T23:59", "duracionMin": 90, "avance": 0, "estado": "pendiente", "notas": "" } ],
  "bloques": [ { "id": "b1", "fecha": "2026-10-25", "inicio": "08:00", "fin": "09:30", "tarea": "t1", "titulo": "", "hecho": false, "propuesto": false } ],
  "fijos": [ { "id": "f1", "titulo": "Clase", "materia": "mat1", "dias": [1], "inicio": "07:00", "fin": "09:00", "lugar": "", "desde": "2026-08-01", "hasta": "2026-12-31" } ]
}
```

- **Estados válidos de una tarea (`comun/modelo.js:122`):** `'pendiente'`, `'en curso'`, `'hecha'`. Cualquier otro valor se normaliza a `'pendiente'` al validar y guardar.
- **`hecho` vs `estado`:** el campo booleano `hecho: true/false` pertenece exclusivamente a los `bloques` del calendario. No cierra una tarea; una tarea se cierra únicamente con `estado: 'hecha'`.

#### `POST /api/datos`
Guarda el itinerario actualizado para el usuario activo.
- **Cabeceras obligatorias:**
  - `Content-Type: application/json`
  - `If-Match: "<etag_actual>"`
  - `Cookie: usuario=<id>`
- **Respuestas:**
  - `200 OK`: `{"ok": true, "etag": "<nuevo_etag>"}` (el navegador abierto del usuario recargará de inmediato vía SSE).
  - `409 Conflict`: `{"error": "Conflicto de edición...", "etagActual": "..."}` si otro cliente modificó el archivo antes.
  - `428 Precondition Required`: si se omitió `If-Match`.

#### `GET /api/eventos`
Stream Server-Sent Events (SSE). Emite `event: cambio` con `{"etag": ...}` en tiempo real cuando el archivo del usuario cambia.

### 3. Ejemplo de integración con una Skill de IA (Python / cURL)

```python
import json
import time
import urllib.request

BASE_URL = "http://127.0.0.1:8090"
HEADERS = {"Cookie": "usuario=paola-bello"}

# 1. Leer itinerario y ETag
req = urllib.request.Request(f"{BASE_URL}/api/datos", headers=HEADERS)
with urllib.request.urlopen(req) as resp:
    etag = resp.headers["ETag"]
    datos = json.loads(resp.read().decode("utf-8"))

# 2. Agregar una tarea con la IA usando el esquema real
nueva_tarea = {
    "id": f"t_{int(time.time())}",
    "titulo": "Estudiar tema X sugerido por IA",
    "materia": datos["materias"][0]["id"] if datos["materias"] else "",
    "padre": None,
    "entrega": "2026-10-30T23:59",
    "duracionMin": 60,
    "avance": 0,
    "estado": "pendiente",
    "notas": "Generada automáticamente por skill de IA"
}
datos["tareas"].append(nueva_tarea)

# 3. Guardar con If-Match
req_post = urllib.request.Request(
    f"{BASE_URL}/api/datos",
    data=json.dumps(datos, ensure_ascii=False, indent=2).encode("utf-8"),
    headers={**HEADERS, "Content-Type": "application/json", "If-Match": etag},
    method="POST"
)
with urllib.request.urlopen(req_post) as resp_post:
    resultado = json.loads(resp_post.read().decode("utf-8"))
    print("Guardado exitoso:", resultado["etag"])
```
