"""Prueba de humo de Gemini vía Agent Platform (Vertex AI) con ADC.

Uso:  python scripts/prueba_humo.py [modelo]
Lee GOOGLE_CLOUD_PROJECT del entorno o, si no está, del proyecto activo de gcloud.
"""
import os
import subprocess
import sys
import time

from google import genai


def proyecto() -> str:
    p = os.environ.get("GOOGLE_CLOUD_PROJECT")
    if p:
        return p
    gcloud = "gcloud.cmd" if os.name == "nt" else "gcloud"
    return subprocess.run([gcloud, "config", "get-value", "project"],
                          capture_output=True, text=True).stdout.strip()


def main() -> int:
    modelo = sys.argv[1] if len(sys.argv) > 1 else "gemini-3.8-flash"
    client = genai.Client(vertexai=True, project=proyecto(),
                          location=os.environ.get("GOOGLE_CLOUD_LOCATION", "global"))
    t0 = time.perf_counter()
    r = client.models.generate_content(model=modelo, contents="Responde solo: Hola")
    print(f"modelo={modelo} latencia={time.perf_counter() - t0:.2f}s respuesta={r.text.strip()!r}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
