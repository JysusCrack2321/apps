# Control de acceso: Cloudflare Access + Google

**https://edt.gida.lat** no es público: antes de llegar a la app, **Cloudflare Access** pide identificarse y solo deja pasar los correos autorizados. Así se evita que cualquiera con el enlace pueda abrir y **editar o borrar el EDT**.

El servidor solo escucha en `127.0.0.1`, así que no hay otra entrada que no pase por Access (ver [[02-servicio-y-tunel-cloudflare]]).

---

## 1. Cómo entra un integrante

```text
edt.gida.lat
    │
    ▼
Pantalla de Cloudflare Access (summer-sea-d4a8.cloudflareaccess.com)
    ├─► "Google" ............ elige su cuenta de Google → entra
    └─► "One-time PIN" ...... escribe su correo → recibe un código de 6 dígitos → entra
    │
    ▼  ¿El correo está en la política "Equipo GIDA"?
    ├─ sí → abre Project Organizer (la sesión dura lo configurado en la app)
    └─ no → acceso denegado (con PIN, el código ni siquiera llega)
```

- **No hay contraseñas propias:** la seguridad depende de la cuenta de Google o del correo de cada persona.
- **Google** solo funciona para cuentas que también estén en los **usuarios de prueba** de Google (ver sección 4). Quien no esté puede entrar igual con **One-time PIN**.

---

## 2. Configuración en Cloudflare Zero Trust

| Elemento | Valor |
|---|---|
| Panel | `one.dash.cloudflare.com` (cuenta <TU-CUENTA-CLOUDFLARE>) |
| Equipo (*team domain*) | `summer-sea-d4a8.cloudflareaccess.com` |
| Plan | Zero Trust Free (hasta 50 usuarios) |
| Aplicación | **EDT**: *Self-hosted and private → Public DNS* |
| Destino | `edt` . `gida.lat`, sin ruta (protege toda la app) |
| Política | **Equipo GIDA**: *Allow*, *Include → Emails* |
| Métodos de inicio de sesión | **Google** y **One-time PIN** (el método "Cloudflare" queda desmarcado) |

### Dónde está cada cosa (panel nuevo)
- **Aplicaciones:** *Access controls → Applications → EDT*
- **Políticas:** *Access controls → Policies → Equipo GIDA*
- **Proveedores de identidad:** *Integrations → Identity providers*
- **Datos del equipo y plan:** *Settings*

### Dar de alta a un integrante

Cada persona se autoriza en **dos sitios**, y hacen cosas distintas:

| Dónde | Para qué | Si falta |
|---|---|---|
| Política **Equipo GIDA** en Cloudflare | Dejarla entrar al sitio | No le llega el PIN; acceso denegado |
| `usuarios.json` (local, no versionado) | Que la app sepa **quién** es | La app le crea la ficha sola: id a partir del correo (ej. `gmunozca`) y rol `miembro`, para renombrarla luego |

`quien_es()` cruza el encabezado `Cf-Access-Authenticated-User-Email` que envía
Access contra el campo `correo` de `usuarios.json`, ignorando mayúsculas. Si el
correo no coincide exactamente, la persona queda sin identificar.

Los correos del equipo viven solo en `usuarios.json`, que está en `.gitignore`
para no publicarlos. Para obtener la lista que se pega en la política:

```bash
python3 -c "import json; print('\n'.join(u['correo'] for u in json.load(open('usuarios.json')) if u['correo']))"
```

En la política, *Include → Emails*, una entrada por correo **completo**
(`usuario@dominio`); ver los errores conocidos más abajo.

### Errores conocidos
- **"Cloudflare sign-in is restricted to members of the account":** el usuario eligió el método **"Cloudflare"**, que solo sirve para miembros de la cuenta de Cloudflare. Por eso ese método está desmarcado en la app EDT. Debe usar **Google** o **One-time PIN**.
- **La app se crea pero no protege nada:** al crearla hay que llegar hasta el botón final **Save/Create**. Si no, la aplicación no se guarda (solo queda la política). Para comprobarlo, `edt.gida.lat` en incógnito debe redirigir a `summer-sea-d4a8.cloudflareaccess.com`.
- **En la política, cada entrada debe ser un correo completo** (`usuario@dominio`). Un texto como `pbellob` sin `@…` no sirve.

---

## 3. Configuración en Google Cloud (inicio con Google)

| Elemento | Valor |
|---|---|
| Proyecto | **GIDA Access** (ID `gida-access`), sin organización |
| Google Auth Platform → Público | **Usuarios externos**, estado **Prueba** |
| Cliente OAuth | Tipo *Aplicación web*, nombre `Cloudflare Access` |
| Orígenes autorizados de JavaScript | `https://summer-sea-d4a8.cloudflareaccess.com` |
| URI de redireccionamiento autorizados | `https://summer-sea-d4a8.cloudflareaccess.com/cdn-cgi/access/callback` |

El **ID de cliente** y el **secreto** se pegaron en *Cloudflare → Integrations → Identity providers → Google* y se comprobaron con **Test** ("Your connection works!").

> ⚠️ **El secreto del cliente nunca se guarda en este repo ni en notas.** Si se filtra, hay que regenerarlo en Google Cloud (*Clientes → Cloudflare Access*) y pegar el nuevo en Cloudflare.

**¿Por qué en modo "Prueba"?** Para publicar la app, Google exige completar la *Información de la marca* (página principal, política de privacidad publicada, dominios autorizados). Para un grupo pequeño no compensa: en modo prueba se admiten hasta **100 usuarios de prueba**.

---

## 4. Añadir o quitar un integrante

**Añadir** (en los dos sitios):
1. **Cloudflare:** *Access controls → Policies → Equipo GIDA → Include → Emails* → añadir el correo y guardar.
2. **Google Cloud:** *Google Auth Platform → Público → Usuarios de prueba → + Agregar usuarios* → añadir el mismo correo. Si se omite, esa persona solo podrá entrar con One-time PIN.

**Quitar:**
- Basta con quitarlo de la política de **Cloudflare**, que es la que controla el acceso. Pierde el acceso cuando caduque su sesión actual.
- Quitarlo también de Google es opcional.

---

## 5. Comprobar que la protección está activa

Desde cualquier PC, sin sesión:

```bash
curl -sI https://edt.gida.lat | grep -i location
# Debe mostrar: location: https://summer-sea-d4a8.cloudflareaccess.com/cdn-cgi/access/login/edt.gida.lat?...
```

Si devuelve directamente la app (`200` con "Project Organizer"), **Access no está aplicado**: revisar que la aplicación EDT exista y tenga la política asignada.
