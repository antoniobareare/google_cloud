"""Mide latencia y aciertos de varios modelos Gemini en 4 tareas (clasificar, extraer JSON, herramienta, razonar).
Uso: .venv/Scripts/python.exe -u scripts/bench_modelos.py   (proyecto: GOOGLE_CLOUD_PROJECT del entorno o de .env)
Coste: unas 100 llamadas cortas, céntimos. Resultados y conclusiones: docs/modelos.md
"""
import os, pathlib
import warnings, time, json, statistics; warnings.filterwarnings("ignore")
from google import genai
from google.genai import types
from pydantic import BaseModel
P = os.environ.get("GOOGLE_CLOUD_PROJECT") or next((l.split("=",1)[1].strip() for l in (pathlib.Path(__file__).resolve().parent.parent / ".env").read_text(encoding="utf-8").splitlines() if l.startswith("GOOGLE_CLOUD_PROJECT=")), None)
print("Proyecto:", P)
def cli(loc): return genai.Client(vertexai=True, project=P, location=loc,
    http_options=types.HttpOptions(timeout=60000, retry_options=types.HttpRetryOptions(attempts=1)))
G = cli("global")

# Modelo -> thinking_level a usar (None = por defecto)
MODELOS = [("gemini-3.5-flash-lite", "minimal"), ("gemini-3.5-flash-lite", None),
           ("gemini-3.8-flash", "low"), ("gemini-3.8-flash", None),
           ("gemini-4-hydrogen", "low"), ("gemini-4-neon", "low"),
           ("gemini-4-argon", "low"), ("gemini-3.1-pro-preview", "low")]

class Ticket(BaseModel):
    cliente: str
    importe_eur: float
    fecha: str
    urgente: bool

def tool_ventas(region: str, mes: str) -> dict:
    """Devuelve las ventas totales en euros de una región y un mes (formato AAAA-MM)."""
    return {"ventas": 1234}

TAREAS = {
 "clasificar": (lambda: dict(contents="Clasifica el sentimiento de esta reseña en una palabra (positivo/negativo/neutro): 'El envío tardó, pero el producto es excelente y volvería a comprar.'"),
                lambda r: "positivo" in (r.text or "").lower()),
 "extraer_json": (lambda: dict(contents="Correo: 'Hola, soy Laura Pérez de Frutas Norte. La factura de 1.250,50 € del 3 de noviembre de 2026 sigue sin pagar y necesitamos resolverlo hoy mismo.' Extrae los datos (fecha en AAAA-MM-DD).",
                               config_extra=dict(response_mime_type="application/json", response_schema=Ticket)),
                lambda r: (lambda d: abs(d["importe_eur"]-1250.5)<0.01 and d["fecha"]=="2026-11-03" and d["urgente"] is True)(json.loads(r.text))),
 "herramienta": (lambda: dict(contents="¿Cuánto vendimos en Andalucía en octubre de 2026?",
                              config_extra=dict(tools=[tool_ventas], automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True))),
                 lambda r: bool(r.function_calls) and r.function_calls[0].name=="tool_ventas" and r.function_calls[0].args.get("mes")=="2026-10"),
 "razonar": (lambda: dict(contents="Un almacén tiene 3 estanterías con 4 baldas cada una. En cada balda caben 12 cajas, pero hoy 5 baldas están vacías y el resto llenas. Además hay 7 cajas en el suelo. ¿Cuántas cajas hay en total? Responde solo con el número."),
             lambda r: (r.text or "").strip().rstrip(".").endswith("91")),
}

def llamar(c, modelo, nivel, t):
    kw = t()
    extra = kw.pop("config_extra", {})
    cfg = dict(max_output_tokens=2048, **extra)
    if nivel: cfg["thinking_config"] = types.ThinkingConfig(thinking_level=nivel)
    t0 = time.time()
    r = c.models.generate_content(model=modelo, config=types.GenerateContentConfig(**cfg), **kw)
    return time.time()-t0, r

print("modelo|thinking|tarea|aciertos|mediana_s|tokens_salida+thinking")
for modelo, nivel in MODELOS:
    try: llamar(G, modelo, nivel, TAREAS["clasificar"][0])  # calentar
    except Exception as e: print(f"{modelo}|{nivel}|calentar|ERROR {str(e)[:120]}"); continue
    for nombre, (t, ok) in TAREAS.items():
        tiempos, aciertos, toks = [], 0, []
        for _ in range(3):
            try:
                dt, r = llamar(G, modelo, nivel, t)
                tiempos.append(dt)
                try: aciertos += bool(ok(r))
                except Exception: pass
                u = r.usage_metadata
                toks.append((u.candidates_token_count or 0) + (u.thoughts_token_count or 0))
            except Exception as e:
                print(f"{modelo}|{nivel}|{nombre}|ERROR {str(e)[:120]}"); break
        if tiempos:
            print(f"{modelo}|{nivel or 'defecto'}|{nombre}|{aciertos}/{len(tiempos)}|{statistics.median(tiempos):.2f}|{int(statistics.median(toks))}", flush=True)

print("\nUBICACIONES")
for loc in ["us", "eu"]:
    c = cli(loc)
    for m in ["gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-4-hydrogen", "gemini-4-argon", "gemini-embedding-001"]:
        try:
            t0 = time.time()
            if "embedding" in m: c.models.embed_content(model=m, contents="hola")
            else: c.models.generate_content(model=m, contents="Responde solo: Hola", config=types.GenerateContentConfig(max_output_tokens=200))
            print(f"OK   {loc} {m} {time.time()-t0:.1f}s", flush=True)
        except Exception as e:
            print(f"FAIL {loc} {m} {str(e)[:90]}", flush=True)
