"""
exportar_front.py - Publica el estudio CRISP-DM en el frontend del gemelo.

Convierte las piezas del informe a un JSON que el panel de React consume, y
copia las figuras a la carpeta `public/` que Vite sirve tal cual.

Se eligio esta via, y no un endpoint nuevo en Express, porque el estudio es un
resultado congelado: se recalcula cuando se reentrena, no en cada peticion.
Servirlo como archivo estatico evita anadir rutas al servidor y mantiene el
gemelo funcionando aunque Python no este instalado en la maquina que lo ejecute.

Uso:
    python exportar_front.py        despues de run_pipeline.py
"""

from __future__ import annotations

import contextlib
import io
import json
import re
import shutil
from pathlib import Path

import pandas as pd

from acentos import acentuar
from config import FIGURAS, RAIZ, SALIDA, TABLAS
from informe import DPI_PUBLICACION, FIGURAS_WEB

DESTINO_PUBLICO = RAIZ.parent / "public" / "crispdm"
DESTINO_FIGURAS = DESTINO_PUBLICO / "figuras"
DESTINO_TABLAS = DESTINO_PUBLICO / "tablas"
DESTINO_ALTA = DESTINO_PUBLICO / "figuras_600ppp"


def _csv_a_tabla(ruta: Path) -> dict:
    df = pd.read_csv(ruta)
    return {
        "columnas": [str(c) for c in df.columns],
        "filas": [[_formatear(v) for v in fila] for fila in df.values.tolist()],
    }


def _formatear(v) -> str:
    if isinstance(v, float):
        if pd.isna(v):
            return ""
        return "{:.4f}".format(v).rstrip("0").rstrip(".") if abs(v) < 1e6 else "{:.4g}".format(v)
    return str(v)


def exportar() -> Path:
    """Reconstruye el informe desde informe.md y lo deja listo para el navegador."""
    DESTINO_FIGURAS.mkdir(parents=True, exist_ok=True)
    DESTINO_TABLAS.mkdir(parents=True, exist_ok=True)
    DESTINO_ALTA.mkdir(parents=True, exist_ok=True)

    # Las tablas se copian ademas en crudo para que el panel ofrezca descargarlas:
    # quien revise la tesis querra abrirlas en una hoja de calculo.
    for csv in TABLAS.glob("*.csv"):
        shutil.copy2(csv, DESTINO_TABLAS / csv.name)

    md = io.open(SALIDA / "informe.md", encoding="utf-8").read()

    # El informe se genera con una estructura fija, de modo que se puede volver
    # a trocear sin ambiguedad: cada fase abre con "## Fase N." y cada pieza con
    # "### Figura N." o "### Tabla N.".
    piezas: list[dict] = []
    fase_actual = None

    bloques = re.split(r"\n(?=## Fase |### Figura |### Tabla )", md)

    for bloque in bloques:
        b = bloque.strip()
        if not b:
            continue

        m_fase = re.match(r"## Fase (\d+)\.\s*(.+)", b)
        if m_fase:
            cuerpo = b.split("\n", 1)[1] if "\n" in b else ""
            proposito = ""
            texto = []
            for linea in cuerpo.split("\n"):
                s = linea.strip()
                if not s:
                    continue
                # El separador horizontal de Markdown no tiene sentido en el
                # panel, que ya separa las fases con su propia cabecera.
                if s == "---":
                    continue
                if s.startswith("_") and s.endswith("_") and not proposito:
                    proposito = s.strip("_")
                elif not s.startswith("#"):
                    texto.append(s)
            fase_actual = {
                "tipo": "fase",
                "numero": int(m_fase.group(1)),
                "titulo": acentuar(m_fase.group(2).strip()),
                "proposito": acentuar(proposito),
                # El contenido de las tablas NO se acentúa: debe coincidir con
                # los nombres de columna de los CSV que se ofrecen a descargar.
                "texto": acentuar("\n\n".join(texto)),
            }
            piezas.append(fase_actual)
            continue

        m_fig = re.match(r"### Figura (\d+)\.\s*(.+)", b)
        m_tab = re.match(r"### Tabla (\d+)\.\s*(.+)", b)
        if not (m_fig or m_tab):
            continue

        lecturas = {}
        for clave, etiqueta in [("que", "Qué muestra"), ("como", "Cómo leerlo"),
                                ("interpretacion", "Interpretación")]:
            m = re.search(r"\*\*" + etiqueta + r"\.\*\*\s*(.+?)(?=\n\*\*|\Z)", b, re.S)
            crudo = m.group(1).strip() if m else ""
            # La ultima lectura de cada fase arrastra el separador "---" que en
            # el Markdown precede a la fase siguiente. Se recorta antes de unir
            # las lineas, porque una vez unidas ya no se distingue del texto.
            crudo = re.sub(r"\n-{3,}\s*$", "", crudo).strip()
            lecturas[clave] = acentuar(crudo.replace("\n", " "))

        if m_fig:
            m_img = re.search(r"!\[[^\]]*\]\(figuras/([^)]+)\)", b)
            archivo = m_img.group(1) if m_img else None
            meta = {}
            if archivo:
                # El panel carga la version ligera; la de 600 ppp queda aparte
                # para descargar. Servir diez imagenes de mas de un mega haria
                # la pestana inusable, y una pantalla no aprovecha esa densidad.
                if (FIGURAS_WEB / archivo).exists():
                    shutil.copy2(FIGURAS_WEB / archivo, DESTINO_FIGURAS / archivo)
                elif (FIGURAS / archivo).exists():
                    shutil.copy2(FIGURAS / archivo, DESTINO_FIGURAS / archivo)
                if (FIGURAS / archivo).exists():
                    shutil.copy2(FIGURAS / archivo, DESTINO_ALTA / archivo)
                    meta = {
                        "alta": "/crispdm/figuras_600ppp/{}".format(archivo),
                        "kb_alta": round((FIGURAS / archivo).stat().st_size / 1024),
                    }
            piezas.append({
                "tipo": "figura",
                "numero": int(m_fig.group(1)),
                "titulo": acentuar(m_fig.group(2).strip()),
                "imagen": "/crispdm/figuras/{}".format(archivo) if archivo else None,
                "fase": fase_actual["numero"] if fase_actual else None,
                "dpi": DPI_PUBLICACION,
                **meta,
                **lecturas,
            })
        else:
            n = int(m_tab.group(1))
            candidatos = sorted(TABLAS.glob("tab{:02d}_*.csv".format(n)))
            datos = _csv_a_tabla(candidatos[0]) if candidatos else {"columnas": [], "filas": []}
            piezas.append({
                "tipo": "tabla",
                "numero": n,
                "titulo": acentuar(m_tab.group(2).strip()),
                "csv": candidatos[0].name if candidatos else None,
                "fase": fase_actual["numero"] if fase_actual else None,
                **datos,
                **lecturas,
            })

    # Cifras de cabecera, leidas de las tablas para no repetirlas a mano.
    resumen = {}
    t8 = sorted(TABLAS.glob("tab08_*.csv"))
    if t8:
        d = pd.read_csv(t8[0])
        mejor = d.iloc[0]
        base = d[d.metodo.str.contains("Hargreaves")].iloc[0]
        resumen = {
            "modelo": str(mejor.metodo),
            "rmse": float(mejor.RMSE),
            "rmse_base": float(base.RMSE),
            "mejora_pct": 100 * (float(base.RMSE) - float(mejor.RMSE)) / float(base.RMSE),
            "nse": float(mejor.NSE),
            "sesgo": float(mejor.sesgo),
            "sesgo_base": float(base.sesgo),
        }

    # Ficha del conjunto de datos. Se calcula del panel real, no de constantes,
    # para que no pueda quedar desfasada respecto a lo que se entrenó.
    ficha = None
    try:
        from adquisicion import obtener_dataset
        from dataset_front import describir
        from preparacion import preparar

        buffer = io.StringIO()
        with contextlib.redirect_stdout(buffer):
            panel = preparar(obtener_dataset())
        ficha = describir(panel)

        # Muestra descargable: mil filas bastan para inspeccionar el formato sin
        # publicar los doce megas del panel completo en el repositorio.
        muestra = panel.sample(min(1000, len(panel)), random_state=42).sort_values(["fecha", "estacion"])
        muestra.to_csv(DESTINO_PUBLICO / "muestra_dataset.csv", index=False, encoding="utf-8")
        print("  ficha del dataset: {:,} filas descritas".format(ficha["volumen"]["filas"]))
    except Exception as exc:  # noqa: BLE001
        print("  AVISO: no se pudo describir el dataset ({})".format(exc))

    documento = {
        "dataset": ficha,
        "titulo": "Estimación de evapotranspiración de referencia en la cuenca del Río Moche",
        "subtitulo": "Estudio CRISP-DM sobre reanálisis ERA5 para alimentar el modelo GR4J",
        "fuente": "Open-Meteo Archive API (reanálisis ERA5), sin credenciales",
        "registros": 109584,
        "estaciones": 12,
        "periodo": "2000-01-01 a 2024-12-31",
        "resumen": resumen,
        "piezas": piezas,
    }

    destino = DESTINO_PUBLICO / "informe.json"
    io.open(destino, "w", encoding="utf-8").write(
        json.dumps(documento, ensure_ascii=False, indent=1)
    )

    figuras = sum(1 for p in piezas if p["tipo"] == "figura")
    tablas = sum(1 for p in piezas if p["tipo"] == "tabla")
    fases = sum(1 for p in piezas if p["tipo"] == "fase")
    print("Exportado a {}".format(destino))
    print("  fases {} | figuras {} | tablas {}".format(fases, figuras, tablas))
    sin_lectura = [p for p in piezas if p["tipo"] in ("figura", "tabla")
                   and not (p.get("que") and p.get("como") and p.get("interpretacion"))]
    if sin_lectura:
        print("  AVISO: {} piezas sin interpretacion completa".format(len(sin_lectura)))
    else:
        print("  todas las piezas llevan sus tres bloques de lectura")
    return destino


if __name__ == "__main__":
    exportar()
