# Servicio en Linux y Túnel con Cloudflare (Orange Pi Zero 3)

Este documento explica cómo está desplegado **Project Organizer** en una **Orange Pi Zero 3** (4 GB de RAM, Armbian/Ubuntu `arm64`). Corre como servicio de `systemd` y se publica en **https://edt.gida.lat** mediante un **túnel con nombre de Cloudflare**, protegido con **Cloudflare Access** (ver [[04-acceso-cloudflare-y-google]]).

> **Historial:** hasta el 2026-10-11 la app corría en una Raspberry Pi 4 con un *Quick Tunnel* (`*.trycloudflare.com`), cuyo enlace cambiaba con cada reinicio. Se reemplazó por un dominio propio y un túnel con nombre, que mantienen el enlace fijo. Ver la sección 7.

---

## 1. Arquitectura del despliegue

```text
Integrantes del grupo (navegador)
        │
        ▼  https://edt.gida.lat
┌───────────────────────────────────────────────────────────┐
│ Cloudflare                                                │
│  • DNS de gida.lat (nameservers audrey/bowen)             │
│  • Cloudflare Access: inicio con Google o código (PIN)    │
│    → solo los correos de la política "Equipo GIDA"        │
└───────────────────────────┬───────────────────────────────┘
                            │ túnel cifrado (saliente, QUIC)
┌───────────────────────────▼───────────────────────────────┐
│ Orange Pi Zero 3 (usuario <USUARIO>)                        │
│                                                           │
│  1. project-organizer-tunnel.service                      │
│     └─► cloudflared tunnel --no-autoupdate run edt        │
│                 │                                         │
│                 ▼ (tráfico local)                         │
│  2. project-organizer.service                             │
│     └─► python3 servidor.py 8088 --bind 127.0.0.1         │
│         (sirve ~/project-organizer y guardados/)          │
└───────────────────────────────────────────────────────────┘
```

- **Sin puertos abiertos:** `cloudflared` abre la conexión **hacia fuera**, así que no hay que abrir puertos en el router.
- **Sin acceso que salte el login:** el servidor de Python escucha solo en `127.0.0.1:8088`. La única entrada desde fuera es el túnel, que pasa obligatoriamente por Cloudflare Access.
- **Guardado por versiones:** `servidor.py` carga siempre la versión más reciente (`guardados/datosN.json` o `datos.json`) y guarda versiones nuevas sin borrar las anteriores.
- **Sin root:** ambos servicios corren como el usuario normal (`systemd --user`).

---

## 2. Datos del despliegue

| Elemento | Valor |
|---|---|
| Equipo | Orange Pi Zero 3, `<HOSTNAME>`, IP local `<IP-LOCAL>` |
| Usuario | `<USUARIO>` |
| URL pública | https://edt.gida.lat |
| Dominio | `gida.lat`, en **Namecheap**. Comprado el 2026-10-11 por 1 año (1,80 USD). **Renovación automática desactivada** (renovar cuesta 40,98 USD/año). **Caduca el 2027-10-11** |
| DNS | Cloudflare, plan Free. Nameservers `audrey.ns.cloudflare.com` y `bowen.ns.cloudflare.com` |
| Túnel | Nombre `edt`, ID `<TU-TUNNEL-ID>` |
| Equipo de Zero Trust | `summer-sea-d4a8` (`summer-sea-d4a8.cloudflareaccess.com`), plan Zero Trust Free |

---

## 3. Instalación paso a paso realizada

### Paso 1: Sistema y paquetes
Sobre Armbian (imagen *Minimal/CLI*, conectada por Ethernet):

```bash
sudo apt update && sudo apt full-upgrade -y
sudo apt install -y git python-is-python3 curl
```

### Paso 2: Acceso SSH a GitHub y clonado del repo
El repo es privado y en la red de la casa el puerto 22 está bloqueado, por eso se usa SSH por el puerto 443:

```bash
ssh-keygen -t ed25519 -C "key para usar mi repo personal en la orange pi de la casa" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub     # se pegó en GitHub → Settings → SSH keys (clave "orangepi")

cat >> ~/.ssh/config <<'EOF'
Host github.com
    HostName ssh.github.com
    Port 443
    User git
EOF
chmod 600 ~/.ssh/config

ssh -T git@github.com
git clone git@github.com:JysusCrack2321/project-organizer.git
```

> La clave `orangepi` está registrada como **clave de la cuenta** (lectura y escritura sobre todos los repos). Si la Orange Pi se ve comprometida, hay que borrarla en GitHub → Settings → SSH keys.

### Paso 3: Instalar `cloudflared` (ARM64)

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb -o /tmp/cloudflared.deb
sudo dpkg -i /tmp/cloudflared.deb && rm /tmp/cloudflared.deb
cloudflared --version
```

### Paso 4: Dominio en Cloudflare
1. Se compró `gida.lat` en Namecheap, sin extras (ni SSL, ni PremiumDNS, ni hosting) y **sin renovación automática**.
2. En Cloudflare: **Add a domain → gida.lat → plan Free**. Se borraron los registros DNS importados de Namecheap: la página de aparcamiento (A y CNAME `www`) y el reenvío de correo (5 MX y el TXT SPF).
3. En Namecheap: **Domain List → gida.lat → Nameservers → Custom DNS**, con los nameservers de Cloudflare.

### Paso 5: Crear el túnel con nombre

```bash
cloudflared tunnel login                         # se abre el enlace en el navegador y se elige gida.lat
cloudflared tunnel create edt                    # crea ~/.cloudflared/<ID>.json (secreto, no compartir)
cloudflared tunnel route dns edt edt.gida.lat    # crea el CNAME edt.gida.lat → túnel
```

Archivo `~/.cloudflared/config.yml`:

```yaml
tunnel: <TU-TUNNEL-ID>
credentials-file: /home/<USUARIO>/.cloudflared/<TU-TUNNEL-ID>.json

ingress:
  - hostname: edt.gida.lat
    service: http://127.0.0.1:8088
  - service: http_status:404
```

### Paso 6: Servicios de `systemd`

`~/.config/systemd/user/project-organizer.service`:

```ini
[Unit]
Description=Servidor web local de Project Organizer
After=network.target

[Service]
Type=simple
WorkingDirectory=%h/project-organizer
ExecStart=/usr/bin/python3 %h/project-organizer/servidor.py 8088 --bind 127.0.0.1
Restart=on-failure
RestartSec=3

[Install]
WantedBy=default.target
```

`~/.config/systemd/user/project-organizer-tunnel.service`:

```ini
[Unit]
Description=Cloudflare Tunnel (edt.gida.lat) para Project Organizer
After=network-online.target project-organizer.service
Wants=network-online.target
Requires=project-organizer.service

[Service]
Type=simple
ExecStart=/usr/bin/cloudflared tunnel --no-autoupdate run edt
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
```

Para activarlos (con `enable-linger` arrancan con la placa aunque no haya sesión iniciada):

```bash
sudo loginctl enable-linger $USER
systemctl --user daemon-reload
systemctl --user enable --now project-organizer.service project-organizer-tunnel.service
```

---

## 4. Comandos útiles de mantenimiento

| Acción | Comando |
|---|---|
| **Ver el estado de ambos servicios** | `systemctl --user status project-organizer project-organizer-tunnel` |
| **Ver las conexiones del túnel** | `cloudflared tunnel list` (columna `CONNECTIONS`) |
| **Ver los registros del túnel** | `journalctl --user -u project-organizer-tunnel -f` |
| **Reiniciar el servidor web** | `systemctl --user restart project-organizer` |
| **Reiniciar el túnel** *(el enlace NO cambia)* | `systemctl --user restart project-organizer-tunnel` |
| **Detener todo temporalmente** | `systemctl --user stop project-organizer-tunnel project-organizer` |
| **Actualizar el proyecto desde GitHub** | `cd ~/project-organizer && git pull` |
| **Validar `config.yml`** | `cloudflared tunnel ingress validate` |

> El aviso `ICMP proxy feature is disabled` en el registro del túnel es inofensivo: solo afecta al *ping* a través del túnel, no a la web.

---

## 5. Cambiar de dominio (cuando caduque `gida.lat`)

El túnel, las credenciales, los servicios y la política de Access **se conservan**. Solo hay que:

1. Comprar el dominio nuevo y añadirlo a Cloudflare (*Add a domain*, plan Free, cambiar los nameservers en el registrador).
2. En la Orange Pi:
   ```bash
   cloudflared tunnel route dns edt edt.NUEVODOMINIO
   sed -i 's/edt.gida.lat/edt.NUEVODOMINIO/' ~/.cloudflared/config.yml
   systemctl --user restart project-organizer-tunnel
   ```
3. En **Zero Trust → Access controls → Applications → EDT → Destinations**, cambiar el dominio.
4. Pasar el enlace nuevo al grupo.

> Para no repetir esto cada año, elegir un dominio con **precio de renovación** bajo, no solo con el primer año barato.

---

## 6. Página pública del grupo (pendiente)

La raíz `gida.lat` está libre. Se puede publicar ahí la página pública del grupo (por ejemplo con **Cloudflare Pages**, incluido en el plan Free) y mantener `edt.gida.lat` privada con Access.

---

## 7. Despliegue anterior (Raspberry Pi 4 + Quick Tunnel)

Hasta el 2026-10-11 se usaba `cloudflared tunnel --url http://127.0.0.1:8088` (*Quick Tunnel*, sin cuenta), con la URL en `curl -s http://127.0.0.1:20241/quicktunnel`. Tenía tres inconvenientes: el enlace `*.trycloudflare.com` **cambiaba con cada reinicio**, no tenía garantía de disponibilidad y **cualquiera con el enlace podía entrar y editar el EDT**.
