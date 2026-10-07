"""
informe.py - Acumulador del informe CRISP-DM.

El encargo exige que ningun grafico ni tabla aparezca sin interpretacion. Esta
clase lo vuelve estructural en vez de disciplinario: `figura()` y `tabla()`
obligan a pasar los tres textos, asi que no se puede registrar una salida muda.

Las interpretaciones no son plantillas fijas. Cada fase las redacta a partir de
los numeros que acaba de calcular, usando los clasificadores de abajo.
"""

from __future__ import annotations

import io
from pathlib import Path

import matplotlib
matplotlib.use("Agg")  # sin ventana: el pipeline corre en consola
import matplotlib.pyplot as plt
import pandas as pd

from config import FIGURAS, SALIDA, TABLAS

# ---------------------------------------------------------------------------
# Resolucion
# ---------------------------------------------------------------------------
# Cada figura se guarda dos veces. La de 600 ppp es la que exige una revista
# cientifica para figuras de linea; la ligera existe solo para que el panel del
# gemelo cargue rapido, porque diez imagenes de mas de un mega harian la pestana
# inusable y una pantalla no aprovecha esa densidad de todas formas.
DPI_PUBLICACION = 600
DPI_WEB = 150
FIGURAS_WEB = FIGURAS.parent / "figuras_web"
FIGURAS_WEB.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Estilo comun de las figuras
# ---------------------------------------------------------------------------
# Los tamanos y grosores estan pensados para que la figura siga siendo legible
# impresa al ancho de una columna. A 600 ppp una linea de 0.8 puntos se imprime
# nitida pero casi invisible, de ahi que se suban los grosores por defecto.
plt.rcParams.update({
    "figure.dpi": 110,
    "savefig.dpi": DPI_PUBLICACION,
    "savefig.bbox": "tight",
    "savefig.facecolor": "white",
    "savefig.pad_inches": 0.08,
    "font.size": 10,
    "font.family": "DejaVu Sans",
    "axes.titlesize": 11.5,
    "axes.titleweight": "bold",
    "axes.labelsize": 10,
    "xtick.labelsize": 9,
    "ytick.labelsize": 9,
    "legend.fontsize": 8.5,
    "legend.frameon": True,
    "legend.framealpha": 0.9,
    "axes.linewidth": 0.9,
    "lines.linewidth": 1.8,
    "lines.markersize": 4.5,
    "patch.linewidth": 0.6,
    "grid.linewidth": 0.6,
    "xtick.major.width": 0.9,
    "ytick.major.width": 0.9,
    "axes.grid": True,
    "grid.alpha": 0.25,
    "axes.spines.top": False,
    "axes.spines.right": False,
    "figure.facecolor": "white",
})

PALETA = {
    "alta": "#1d4ed8",
    "media": "#0891b2",
    "baja": "#ea580c",
    "modelo": "#7c3aed",
    "base": "#64748b",
    "bien": "#059669",
    "mal": "#dc2626",
}


# ---------------------------------------------------------------------------
# Clasificadores: convierten un numero en un juicio verbal defendible
# ---------------------------------------------------------------------------
def clasificar_r(r: float) -> str:
    """Escala de Evans (1996) para el valor absoluto de una correlacion."""
    a = abs(r)
    if a >= 0.80: return "muy fuerte"
    if a >= 0.60: return "fuerte"
    if a >= 0.40: return "moderada"
    if a >= 0.20: return "debil"
    return "muy debil"


def clasificar_nse(v: float) -> str:
    """Criterio de Moriasi et al. (2007), habitual en modelizacion hidrologica."""
    if v > 0.75: return "muy bueno"
    if v > 0.65: return "bueno"
    if v > 0.50: return "satisfactorio"
    return "insatisfactorio"


def clasificar_p(p: float, alfa: float = 0.05) -> str:
    if p < 0.001: return f"p < 0.001, diferencia altamente significativa"
    if p < alfa:  return f"p = {p:.4f} < {alfa}, diferencia significativa"
    return f"p = {p:.4f} >= {alfa}, sin evidencia de diferencia"


def clasificar_efecto(d: float) -> str:
    """Tamanio del efecto segun Cohen (1988)."""
    a = abs(d)
    if a >= 0.80: return "grande"
    if a >= 0.50: return "mediano"
    if a >= 0.20: return "pequenio"
    return "insignificante"


# ---------------------------------------------------------------------------
# Acumulador
# ---------------------------------------------------------------------------
class Informe:
    """Recoge secciones, figuras y tablas, y las vuelca a Markdown y HTML."""

    def __init__(self, titulo: str):
        self.titulo = titulo
        self.piezas: list[dict] = []
        self._n_fig = 0
        self._n_tab = 0

    # -- estructura ---------------------------------------------------------
    def fase(self, numero: int, nombre: str, proposito: str) -> None:
        self.piezas.append({
            "tipo": "fase", "numero": numero, "nombre": nombre, "proposito": proposito,
        })
        print(f"\n{'='*78}\nFASE {numero} - {nombre.upper()}\n{'='*78}\n{proposito}\n")

    def texto(self, contenido: str) -> None:
        self.piezas.append({"tipo": "texto", "contenido": contenido})
        print(contenido + "\n")

    # -- salidas con interpretacion obligatoria -----------------------------
    def figura(self, fig, titulo: str, que_muestra: str, como_leerlo: str, conclusion: str) -> Path:
        """Guarda una figura. Los tres textos son obligatorios por firma."""
        self._n_fig += 1
        nombre = f"fig{self._n_fig:02d}_{_slug(titulo)}.png"
        ruta = FIGURAS / nombre
        ancho, alto = fig.get_size_inches()
        fig.savefig(ruta, dpi=DPI_PUBLICACION)
        fig.savefig(FIGURAS_WEB / nombre, dpi=DPI_WEB)
        plt.close(fig)

        kb = ruta.stat().st_size / 1024
        px = f"{round(ancho * DPI_PUBLICACION)}x{round(alto * DPI_PUBLICACION)}"

        self.piezas.append({
            "tipo": "figura", "numero": self._n_fig, "titulo": titulo, "ruta": nombre,
            "que_muestra": que_muestra, "como_leerlo": como_leerlo, "conclusion": conclusion,
            # Se registra para poder declarar la resolucion en el articulo sin
            # tener que inspeccionar los archivos despues.
            "dpi": DPI_PUBLICACION, "pixeles": px, "pulgadas": f"{ancho:.1f}x{alto:.1f}", "kb": round(kb),
        })
        print(f"  [Figura {self._n_fig}] {titulo}  ->  outputs/figuras/{nombre}")
        print(f"     {DPI_PUBLICACION} ppp · {px} px · {ancho:.1f}x{alto:.1f} in · {kb:.0f} KB")
        print(f"     Que muestra : {que_muestra}")
        print(f"     Como leerlo : {como_leerlo}")
        print(f"     Conclusion  : {conclusion}\n")
        return ruta

    def tabla(self, df: pd.DataFrame, titulo: str, que_muestra: str, como_leerlo: str,
              conclusion: str, indice: bool = False) -> Path:
        """Guarda una tabla como CSV y la registra con su lectura."""
        self._n_tab += 1
        nombre = f"tab{self._n_tab:02d}_{_slug(titulo)}.csv"
        ruta = TABLAS / nombre
        df.to_csv(ruta, index=indice, encoding="utf-8")

        self.piezas.append({
            "tipo": "tabla", "numero": self._n_tab, "titulo": titulo, "ruta": nombre,
            "markdown": _a_markdown(df, indice),
            "que_muestra": que_muestra, "como_leerlo": como_leerlo, "conclusion": conclusion,
        })
        print(f"  [Tabla {self._n_tab}] {titulo}  ->  outputs/tablas/{nombre}")
        print(df.to_string(index=indice))
        print(f"     Que muestra : {que_muestra}")
        print(f"     Como leerlo : {como_leerlo}")
        print(f"     Conclusion  : {conclusion}\n")
        return ruta

    # -- volcado ------------------------------------------------------------
    def escribir(self) -> Path:
        md = [f"# {self.titulo}\n"]
        for p in self.piezas:
            if p["tipo"] == "fase":
                md.append(f"\n---\n\n## Fase {p['numero']}. {p['nombre']}\n")
                md.append(f"_{p['proposito']}_\n")
            elif p["tipo"] == "texto":
                md.append(p["contenido"] + "\n")
            elif p["tipo"] == "figura":
                md.append(f"\n### Figura {p['numero']}. {p['titulo']}\n")
                md.append(f"![{p['titulo']}](figuras/{p['ruta']})\n")
                md.append(f"**Qué muestra.** {p['que_muestra']}\n")
                md.append(f"**Cómo leerlo.** {p['como_leerlo']}\n")
                md.append(f"**Interpretación.** {p['conclusion']}\n")
            elif p["tipo"] == "tabla":
                md.append(f"\n### Tabla {p['numero']}. {p['titulo']}\n")
                md.append(p["markdown"] + "\n")
                md.append(f"**Qué muestra.** {p['que_muestra']}\n")
                md.append(f"**Cómo leerlo.** {p['como_leerlo']}\n")
                md.append(f"**Interpretación.** {p['conclusion']}\n")

        destino = SALIDA / "informe.md"
        io.open(destino, "w", encoding="utf-8").write("\n".join(md))
        return destino


def _slug(texto: str) -> str:
    import re, unicodedata
    t = unicodedata.normalize("NFD", texto).encode("ascii", "ignore").decode()
    t = re.sub(r"[^a-zA-Z0-9]+", "_", t).strip("_").lower()
    return t[:48]


def _a_markdown(df: pd.DataFrame, indice: bool = False) -> str:
    """
    Convierte un DataFrame a tabla Markdown sin depender de `tabulate`.

    pandas delega `to_markdown` en esa libreria opcional, que no siempre esta
    instalada. Como el formato que se necesita es elemental, sale mas barato
    generarlo que anadir una dependencia al entorno de la tesis.
    """
    tabla = df.reset_index() if indice else df
    cols = [str(c) for c in tabla.columns]

    def celda(v) -> str:
        if isinstance(v, float):
            return f"{v:.4f}"
        return str(v)

    lineas = ["| " + " | ".join(cols) + " |",
              "|" + "|".join("---" for _ in cols) + "|"]
    for _, fila in tabla.iterrows():
        lineas.append("| " + " | ".join(celda(v) for v in fila.tolist()) + " |")
    return chr(10).join(lineas)
