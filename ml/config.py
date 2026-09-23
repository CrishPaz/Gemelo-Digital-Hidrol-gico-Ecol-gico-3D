"""
config.py - Parametros del motor analitico CRISP-DM del gemelo del Rio Moche.

Centraliza rutas, estaciones y constantes para que ninguna fase tenga valores
magicos escritos a mano. Las coordenadas son las mismas doce estaciones que usa
el gemelo en src/data/mocheBasinData.ts, de modo que el estudio y la aplicacion
hablan de los mismos puntos.
"""

from pathlib import Path

# ---------------------------------------------------------------------------
# Rutas
# ---------------------------------------------------------------------------
RAIZ = Path(__file__).resolve().parent
CACHE = RAIZ / "cache"
SALIDA = RAIZ / "outputs"
FIGURAS = SALIDA / "figuras"
TABLAS = SALIDA / "tablas"

for _d in (CACHE, SALIDA, FIGURAS, TABLAS):
    _d.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Ventana temporal
# ---------------------------------------------------------------------------
# Veinticinco anios cubren varios ciclos ENSO (El Nino 2015-16, La Nina 2020-22),
# que es justo la variabilidad que el modelo debe aprender a tolerar.
FECHA_INICIO = "2000-01-01"
FECHA_FIN = "2024-12-31"

# Corte temporal para la particion final: se entrena con el pasado y se prueba
# con el futuro, nunca al reves. Mezclar anios al azar filtraria informacion.
CORTE_TEST = "2020-01-01"

# ---------------------------------------------------------------------------
# Estaciones reales de la cuenca del Moche
# ---------------------------------------------------------------------------
ESTACIONES = [
    {"code": "E-01", "nombre": "Quiruvilca Cabecera",      "subcuenca": "Alta",  "lat": -7.9654, "lon": -78.3142, "elev": 3950},
    {"code": "E-02", "nombre": "Shorey Confluencia",       "subcuenca": "Alta",  "lat": -7.9891, "lon": -78.4012, "elev": 3420},
    {"code": "E-03", "nombre": "Julcan Agricola Alto",     "subcuenca": "Alta",  "lat": -8.0412, "lon": -78.4821, "elev": 3180},
    {"code": "E-04", "nombre": "Otuzco Hidrometrica",      "subcuenca": "Media", "lat": -7.9042, "lon": -78.5833, "elev": 2450},
    {"code": "E-05", "nombre": "Usquil Valles",            "subcuenca": "Media", "lat": -7.8421, "lon": -78.4321, "elev": 2890},
    {"code": "E-06", "nombre": "Simbal Estacion Central",  "subcuenca": "Media", "lat": -8.0125, "lon": -78.8142, "elev": 620},
    {"code": "E-07", "nombre": "Poroto Toma de Riego",     "subcuenca": "Media", "lat": -8.0195, "lon": -78.7756, "elev": 780},
    {"code": "E-08", "nombre": "Laredo Agroindustrial",    "subcuenca": "Baja",  "lat": -8.0892, "lon": -78.9583, "elev": 120},
    {"code": "E-09", "nombre": "Quirihuac Puente",         "subcuenca": "Baja",  "lat": -8.0581, "lon": -78.8912, "elev": 280},
    {"code": "E-10", "nombre": "Campina de Moche",         "subcuenca": "Baja",  "lat": -8.1481, "lon": -79.0092, "elev": 45},
    {"code": "E-11", "nombre": "Conache Laguna Control",   "subcuenca": "Baja",  "lat": -8.1124, "lon": -78.9321, "elev": 90},
    {"code": "E-12", "nombre": "Boca de Rio Moche",        "subcuenca": "Baja",  "lat": -8.1695, "lon": -79.0342, "elev": 4},
]

# ---------------------------------------------------------------------------
# Variables descargadas de Open-Meteo (reanalisis ERA5)
# ---------------------------------------------------------------------------
VARIABLES_DIARIAS = [
    "temperature_2m_max",
    "temperature_2m_min",
    "temperature_2m_mean",
    "precipitation_sum",
    "shortwave_radiation_sum",
    "et0_fao_evapotranspiration",
    "wind_speed_10m_max",
    "relative_humidity_2m_mean",
]

# Variable objetivo: evapotranspiracion de referencia FAO-56 Penman-Monteith.
OBJETIVO = "et0"

# Predictores "pobres": lo que una estacion peruana modesta si mide.
# La tesis defiende precisamente esto: estimar ET0 sin radiometro ni anemometro.
PREDICTORES_BASE = ["t_max", "t_min", "t_media", "rango_termico", "precipitacion"]

SEMILLA = 42
