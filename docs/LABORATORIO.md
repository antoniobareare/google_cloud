# Si el reto es un laboratorio (Qwiklabs / Skills Boost)

Usa esta guía cuando no os compartan un proyecto y os den un laboratorio con cuenta temporal
(`student-xx-xxxx@qwiklabs.net`), proyecto temporal (`qwiklabs-gcp-xx-xxxxxxxx`) y un temporizador.
Todo lo que no se diga aquí sigue igual que en AGENTS.md.

## Qué cambia respecto a un proyecto compartido
| Tema | Proyecto compartido | Laboratorio |
|---|---|---|
| Cuenta | Tu cuenta de Google | Cuenta temporal del panel del laboratorio |
| Proyecto | Lo fijáis vosotros | Viene creado, con facturación incluida. No se crean proyectos ni se toca la facturación |
| Duración | Sin límite | Temporizador. Al acabar se BORRA el proyecto con todo lo desplegado |
| Nombres y región | Convenciones de AGENTS.md (`agente-antonio`, europe-west1…) | Lo que diga el enunciado, al pie de la letra. "Comprobar progreso" busca nombres y regiones exactos |
| Permisos | Los que tengáis | Limitados. A menudo no se puede cambiar IAM y hay políticas de organización (regiones, APIs, tipos de máquina) |
| Coste | Lo pagas tú | Lo paga el laboratorio. Crear recursos caros o no permitidos puede cerrarlo |

## Trampas de nuestra configuración (auditadas el 2026-11-25)
1. **`.env` tiene prioridad sobre gcloud.** `scripts/gcp-mcp-headers.sh` toma el proyecto en este orden:
   variable `GOOGLE_CLOUD_PROJECT` → `.env` → configuración de gcloud. Hoy `.env` dice `hackathon-prueba-antonio`.
   Si solo cambias gcloud, los MCP y ADK siguen apuntando a tu proyecto con el token del laboratorio, y fallan por permisos.
   **Hay que cambiar `GOOGLE_CLOUD_PROJECT` en `.env`.**
2. **Solo hay un ADC por ordenador.** `gcloud auth application-default login` con la cuenta del laboratorio
   sobrescribe el tuyo (`%APPDATA%\gcloud\application_default_credentials.json`). Al terminar hay que volver a
   iniciar sesión con tu cuenta (ver "Al acabar").
3. **El navegador abre tu cuenta personal.** `gcloud auth login` abre el navegador predeterminado, donde ya tienes
   tu sesión de Google. Cierra esa pestaña y pega en la ventana de incógnito del laboratorio la URL que gcloud
   imprime en la terminal. La vuelta a `localhost` funciona igual desde incógnito. Así no hace falta escribir
   códigos en la terminal, que en Git Bash a veces se bloquea.
4. **Los MCP guardan la cabecera anterior.** Tras cambiar cuenta y proyecto, reconecta en `/mcp` (o reinicia el panel).
5. **AGENTS.md §9.1** (latencias y modelos disponibles) se midió en `hackathon-prueba-antonio`. En el laboratorio
   hay que volver a comprobar qué modelos existen y en qué ubicación.
6. **La regla de CLAUDE.md sobre crear proyectos o vincular facturación no aplica.** En un laboratorio no se hace nunca.

## Arranque rápido (unos 10 minutos)
Lo hace Antonio en una terminal Git Bash dentro de la carpeta del repo. Los inicios de sesión los hace él, porque
la contraseña del laboratorio nunca pasa por el chat.

0. En el panel del laboratorio: **Start Lab**, apunta la hora de fin, el usuario y el ID del proyecto.
   Abre la consola con **clic derecho → ventana de incógnito** e inicia sesión con el usuario del laboratorio.
1. Un solo comando:
   ```bash
   bash scripts/lab.sh <ID_LAB> [REGION]            # p. ej. bash scripts/lab.sh qwiklabs-gcp-01-abc123 us-central1
   ```
   El script crea o activa la configuración `lab` de gcloud, sin tocar la `default` personal. Después lanza los dos
   inicios de sesión (gcloud y ADC), fija el proyecto, la región y el quota project, y copia `.env` a `.env.personal`
   antes de cambiar `GOOGLE_CLOUD_PROJECT` y `REGION`. Al final muestra tus roles y el número de APIs habilitadas.
   `bash scripts/lab.sh --estado` muestra en qué modo estás.
   <details><summary>Lo mismo a mano, si el script falla</summary>

   ```bash
   gcloud config configurations create lab          # la primera vez; después: activate lab
   gcloud auth login
   gcloud config set project <ID_LAB>
   gcloud auth application-default login
   gcloud auth application-default set-quota-project <ID_LAB>
   ```
   Y en `.env`: `GOOGLE_CLOUD_PROJECT=<ID_LAB>` y `REGION=<la del enunciado>`.
   </details>
2. En Claude Code, `/mcp` → reconectar los tres. Si alguno no conecta, se sigue con gcloud y bq (no bloquea).
3. Comprueba la hora de fin en el panel del laboratorio.
4. Pide a Claude: "estamos en un laboratorio, sigue docs/LABORATORIO.md". Claude hará esto:
   - `gcloud auth list` y `gcloud config list`: comprobar que la cuenta activa es la del lab.
   - Inventario (AGENTS.md §3). En un laboratorio suele haber recursos ya creados que forman parte del reto
     (o que están rotos a propósito). Antes de tocar nada hay que entenderlos.
   - `gcloud services list --enabled`. Activa solo las APIs que pida el enunciado o que falten.
   - Prueba de humo de Gemini (`scripts/prueba_humo.py`) y lista de modelos disponibles
     (`client.models.list(config={"query_base": True})`), primero en `global` y luego en la región del lab.
   - Si hay tiempo: `scripts/bench_modelos.py` para confirmar qué modelo usar (docs/modelos.md).
   - Rellena "Datos del entorno" en `docs/reto.md` (cuenta: laboratorio, hora de fin).

## Reglas durante el laboratorio
- **El enunciado manda** sobre las convenciones de AGENTS.md: nombres, regiones, cuentas de servicio y tipos de
  máquina. Las etiquetas `owner=antonio` solo se añaden si el enunciado no lo impide.
- **Comprobar progreso:** pulsa el botón de cada paso nada más terminarlo, sin dejarlo para el final.
- **Permisos:** si algo da PERMISSION_DENIED, explica qué rol falta. No intentes cambiar IAM salvo que el
  enunciado lo pida. Los permisos de `.claude/settings.json` siguen igual (los borrados siguen bloqueados).
- **Facturación:** `gcloud billing projects describe` puede fallar por permisos. Es normal en un lab y no indica un
  problema.
- **Coste y cuotas:** las cuotas son bajas. Usa `min-instances 0`, máquinas pequeñas y nada de GPU salvo que se pida.
- **Tiempo:** el código vive en el repo local, no en el lab. Haz commits pequeños y frecuentes en `antonio/<tema>`.
  Lo que solo exista en el proyecto (datos cargados, configuración de consola) se pierde cuando acaba el lab.
  Si hay que repetirlo, apunta los comandos en `docs/cambios.md`.
- **Equipo:** cada persona suele tener su propio lab y su propio proyecto. Decidid qué lab es el "oficial" de la
  demo. Las credenciales del lab no se comparten por chat.
- **Plan B, Cloud Shell:** desde la consola del lab ya está autenticado con la cuenta y el proyecto correctos.
  Sirve para lanzar gcloud o bq si el login local falla. No inicies sesión en GitHub desde Cloud Shell
  (es una máquina del laboratorio).

## Al acabar (volver a tu entorno personal)
```bash
bash scripts/lab.sh --volver
```
Activa la configuración `default` y vuelve a iniciar el ADC con tu cuenta. Devuelve `GOOGLE_CLOUD_PROJECT` y `REGION`
del `.env` a los valores de `.env.personal`, sin perder las variables nuevas, y ofrece revocar la cuenta del lab.
Después, reconecta en `/mcp`.
A mano: `gcloud config configurations activate default`, `gcloud auth application-default login`,
`gcloud auth application-default set-quota-project hackathon-prueba-antonio`, `gcloud auth revoke <usuario-del-lab>`
y el proyecto personal en `.env`.
No hace falta borrar los recursos del lab: se eliminan solos al terminar.
