# Puesta en marcha en un ordenador nuevo

Instrucciones para Claude Code cuando Antonio abra este proyecto en otro ordenador
(el definitivo del hackathon). Ejecútalas en orden, verificando cada paso, y dile a
Antonio en pocas líneas qué está listo y qué tiene que hacer él.

## 0. Contexto que no está en otro sitio
- Usuario: **Antonio**. Usa `owner=antonio`, ramas `antonio/<tema>`, recursos de prueba `agente-antonio`, `bucket-antonio-...`.
  Guarda esto en tu memoria de usuario si aún no lo tienes (la memoria del ordenador anterior no viaja).
- Repositorio: `github.com/antoniobareare/google_cloud` (privado). Rama de trabajo `antonio/setup`; a `main` solo por pull request.
- Cuentas que usó en el ordenador anterior: GitHub `antoniobareare`, Google Cloud `antoniobareare@gmail.com`.
  En el hackathon puede ser otra cuenta (laboratorio): pregunta antes de suponer.
- Proyecto de Google Cloud del reto: **aún sin decidir** (`GOOGLE_CLOUD_PROJECT` vacío en `.env`).
  Sus proyectos personales (`disco-vista-473214-b3`, `gen-lang-client-0156398206`, `mis-fincas-df3e1`) NO son del hackathon: no los toques.
- Las reglas completas están en AGENTS.md y CLAUDE.md; este documento solo cubre la instalación.

## 1. Comprobar la carpeta
La carpeta se copia entera desde el ordenador anterior (incluidos `.git`, `.claude`, `.env`).
```bash
ls -A                      # deben estar .claude .env .env.example .git .gitattributes .gitignore .mcp.json AGENTS.md CLAUDE.md LEEME.md docs scripts tests
git status -sb             # rama antonio/setup
git remote -v              # origin → github.com/antoniobareare/google_cloud
```
- Si falta `.git` o la carpeta está incompleta: clónala con `gh repo clone antoniobareare/google_cloud` (tras el paso 3) y `git checkout antonio/setup`.
- Si falta `.env`: créalo desde `.env.example` con `OWNER=antonio`. Nunca lo subas al repo.
- Si git avisa de "dubious ownership" (carpeta copiada de otro usuario): `git config --global --add safe.directory "$(pwd)"`.

## 2. Herramientas (instalar solo lo que falte)
Comprueba primero; instala con winget desde PowerShell (Windows) o con brew (Mac).

| Herramienta | Comprobar | Instalar en Windows |
|---|---|---|
| Git (incluye Git Bash) | `git --version` | `winget install --id Git.Git -e` |
| Python 3.11+ | `python --version` | `winget install --id Python.Python.3.11 -e` |
| Google Cloud SDK | `gcloud --version` | `winget install --id Google.CloudSDK -e` |
| GitHub CLI | `gh --version` | `winget install --id GitHub.cli -e` |
| uv (opcional, entornos rápidos) | `uv --version` | `winget install --id astral-sh.uv -e` |
| Terraform (solo si el reto trae `.tf`) | `terraform -version` | `winget install --id Hashicorp.Terraform -e` (se instala en `%LOCALAPPDATA%\Microsoft\WinGet\Packages\Hashicorp.Terraform_Microsoft.Winget.Source_8wekyb3d8bbwe`) |

Añade `--accept-source-agreements --accept-package-agreements --silent` para que no pregunte.
El instalador de Google Cloud SDK pide permisos de administrador: avisa a Antonio.

Tras instalar, la terminal de la sesión no ve el PATH nuevo. En Git Bash:
```bash
export PATH="$PATH:$(cygpath "$LOCALAPPDATA")/Google/Cloud SDK/google-cloud-sdk/bin:/c/Program Files/GitHub CLI"
```
En PowerShell:
```powershell
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
```
Lo más limpio: pedir a Antonio que reinicie VS Code / Claude Code.

## 3. Inicios de sesión (los hace Antonio, no tú)
Abren el navegador; las contraseñas y tokens nunca pasan por ti ni se guardan en archivos.
Pídele que los ejecute en una terminal:
```
gh auth login --web
gcloud auth login
gcloud auth application-default login
```
- `gh auth login --web` muestra un código de 8 caracteres en la terminal que hay que escribir en la página de GitHub.
- Verifica después: `gh auth status`, `gcloud auth list`, y que exista el ADC
  (`%APPDATA%\gcloud\application_default_credentials.json` en Windows, `~/.config/gcloud/` en Mac).
- No copies tokens al `.env`: se quedan en el llavero del sistema y en la configuración de gcloud.

## 4. Proyecto y región (cuando se conozca el reto)
Pregunta a Antonio el proyecto y la región; no los supongas. Si es un laboratorio con cuenta temporal, sigue docs/LABORATORIO.md.
```bash
gcloud config configurations create hackathon      # opcional: separa la cuenta del reto de la personal
gcloud config set project <ID>
gcloud auth application-default set-quota-project <ID>
gcloud config set run/region europe-west1          # o la que diga el reto
gcloud billing projects describe <ID>              # billingEnabled debe ser True
```
Rellena `GOOGLE_CLOUD_PROJECT` en `.env`.
Si hay que crear un proyecto propio, aplica la doble confirmación de CLAUDE.md (vincular facturación lo hace Antonio a mano).

## 5. Claude Code: permisos y MCP
Pide a Antonio que, con Claude Code abierto en esta carpeta, escriba:
- `/permissions` → deben aparecer las reglas de `.claude/settings.json` (deny de borrados, ask de despliegues).
- `/mcp` → servidores `bigquery`, `logging`, `cloudrun`.
  - El helper se lanza con `bash ./scripts/gcp-mcp-headers.sh`; en Windows `bash` debe resolver a Git Bash
    (`where bash` → primero `C:\Program Files\Git\...`). Si resuelve a WSL (`C:\Windows\System32\bash.exe`), el MCP fallará.
  - Necesita ADC y proyecto fijado. Prueba manual: `bash ./scripts/gcp-mcp-headers.sh` debe imprimir un JSON con `Authorization`.
  - Si no conecta, no bloquea nada: sigue con `gcloud` y `bq`.
  - Arreglo probado en Windows (2026-11-25). El error "Incompatible auth server: does not support dynamic client
    registration" significa que el script de cabeceras no llegó a ejecutarse. Hay dos causas:
    1. `where.exe bash` (desde PowerShell) devuelve `C:\Windows\System32\bash.exe` (WSL). Solución: configuración local
       de este ordenador, que tiene prioridad sobre `.mcp.json` y no lo cambia para los demás. Repite para logging y
       cloudrun (url `https://run.googleapis.com/mcp`):
       `claude mcp add-json --scope local bigquery '{"type":"http","url":"https://bigquery.googleapis.com/mcp","headersHelper":"\"C:/Program Files/Git/bin/bash.exe\" \"<ruta absoluta>/scripts/gcp-mcp-headers.sh\""}'`
       Usa barras `/`: con `\b` el JSON se corrompe. Genera el JSON con Python para evitar errores de escape.
    2. La carpeta no está marcada como de confianza, así que Claude Code no ejecuta `headersHelper`. Antonio abre
       `claude` una vez en una terminal dentro de la carpeta y acepta el diálogo de confianza. Claude no lo hace por él.
    3. El script tarda más de 10 s, que es el límite de Claude Code para `headersHelper`. En el registro aparece
       "headersHelper ... did not return a valid value" a los 10 s. Cada `gcloud` tarda 3–5 s en Windows y los
       tres servidores arrancan a la vez. Arreglado: el script lee el proyecto de `.env` o de la configuración de
       gcloud y pide el token directamente a oauth2.googleapis.com con `curl`. Tarda unos 1,3 s y solo recurre a
       gcloud si eso falla. Los registros están en `%LOCALAPPDATA%\claude-cli-nodejs\Cache\<carpeta>\mcp-logs-<servidor>\`.
    4. La unidad en mayúscula o minúscula cuenta como otra carpeta. El panel de Antigravity/VS Code abre la carpeta
       como `c:/Users/...` y el CLI desde Git Bash como `C:/Users/...`. En `~/.claude.json` hacen falta las dos
       entradas en `projects`, cada una con `hasTrustDialogAccepted: true` y los `mcpServers` locales. El registro lo
       delata: "set projects["c:/..."].hasTrustDialogAccepted". Tras cambiar `~/.claude.json`, reinicia el panel:
       el proceso en marcha conserva la configuración antigua.
  - En Antigravity el CLI está en `%USERPROFILE%\.antigravity-ide\extensions\anthropic.claude-code-*\resources\native-binary\claude.exe`.

## 6. Entorno Python para ADK (cuando haga falta)
```bash
python -m venv .venv
source .venv/Scripts/activate          # Git Bash en Windows (Mac/Linux: .venv/bin/activate)
pip install google-adk "google-cloud-aiplatform[agent_engines,adk]" google-cloud-bigquery
```
Después, prueba de humo de Gemini (AGENTS.md, sección 7.1) antes de construir nada.

## 7. Verificación final
Resume a Antonio en una tabla corta: herramientas y versiones, cuentas activas (GitHub y Google Cloud),
ADC sí/no, proyecto fijado, facturación, `/mcp` conectado sí/no, rama git. Indica solo lo que falta.
Después sigue con AGENTS.md sección 0 (leer `docs/reto.md`, inventario y plan).

## Lecciones del primer ordenador (Windows)
- La herramienta Bash de Claude Code es Git Bash; las reglas de `settings.json` están escritas para Bash. Usa Bash para gcloud/bq/git/gh.
- PowerShell 5.1 no tiene `&&`; usa `;`. Su salida muestra mal las tildes, pero los archivos están bien en UTF-8.
- `core.autocrlf` convierte saltos de línea; `.gitattributes` fuerza LF en los `.sh` (si no, bash falla con `\r`).
- Usa `--project <ID>` en consultas de solo lectura para no cambiar el proyecto activo sin avisar.
