"""
dataset_front.py - Descripcion del conjunto de datos para el panel del gemelo.

El informe mostraba el analisis pero no los datos de partida. Este modulo arma
la ficha del dataset: de donde sale, que columnas trae, cual es el papel de cada
una en el estudio, que estaciones lo componen y una muestra real de filas.

El apartado de roles es el que mas importa para defender la tesis. Deja a la
vista que radiacion, viento y humedad se descargaron pero NO alimentan al
modelo. Esa exclusion es deliberada: la ecuacion FAO-56 usa esas tres variables
directamente, de modo que incluirlas volveria el problema casi trivial y el
resultado no serviria a una estacion peruana real, que no tiene esos sensores.
"""

from __future__ import annotations

import pandas as pd

from acentos import acentuar
from config import ESTACIONES, FECHA_FIN, FECHA_INICIO, VARIABLES_DIARIAS
from preparacion import PREDICTORES

URL_API = "https://archive-api.open-meteo.com/v1/archive"

# columna -> (unidad, papel en el estudio, explicacion)
ESQUEMA = {
    "fecha":           ("fecha",      "indice",     "Dia del registro. Define el orden y los cortes de validacion."),
    "estacion":        ("codigo",     "identificador", "Codigo de la estacion. Agrupa las filas del mismo punto."),
    "nombre":          ("texto",      "identificador", "Nombre de la estacion en la red del gemelo."),
    "subcuenca":       ("categoria",  "identificador", "Tramo de cuenca: Alta, Media o Baja."),
    "lat":             ("grados",     "predictor",  "Latitud. Entra en el calculo de radiacion extraterrestre."),
    "lon":             ("grados",     "descartada", "Longitud. No aporta senal en una cuenca de este tamano."),
    "elev":            ("m s.n.m.",   "predictor",  "Elevacion de la celda del reanalisis. Recoge el gradiente altitudinal."),
    "t_max":           ("grados C",   "predictor",  "Temperatura maxima diaria. Sensor barato y presente en casi toda estacion."),
    "t_min":           ("grados C",   "predictor",  "Temperatura minima diaria."),
    "t_media":         ("grados C",   "predictor",  "Temperatura media diaria."),
    "precipitacion":   ("mm",         "predictor",  "Lluvia acumulada. Un dia lluvioso suele ser nuboso, y eso frena la evaporacion."),
    "radiacion":       ("MJ/m2",      "excluida",   "Radiacion solar. Se descarga pero NO se usa: exige radiometro, que las estaciones del Moche no tienen."),
    "viento":          ("km/h",       "excluida",   "Velocidad maxima del viento. Excluida por el mismo motivo: exige anemometro."),
    "humedad":         ("%",          "excluida",   "Humedad relativa media. Excluida: exige higrometro calibrado."),
    "et0":             ("mm/dia",     "OBJETIVO",   "Evapotranspiracion de referencia FAO-56 Penman-Monteith. Es lo que el modelo debe estimar."),
    "rango_termico":   ("grados C",   "derivada",   "t_max menos t_min. Sustituto barato de la radiacion: un cielo despejado calienta de dia y enfria de noche."),
    "ra":              ("MJ/m2",      "derivada",   "Radiacion extraterrestre por geometria orbital. No necesita instrumento alguno."),
    "estacion_sin":    ("-1 a 1",     "derivada",   "Seno del dia del anio. Codifica la estacionalidad sin salto entre diciembre y enero."),
    "estacion_cos":    ("-1 a 1",     "derivada",   "Coseno del dia del anio, pareja del anterior."),
    "et0_hargreaves":  ("mm/dia",     "linea base", "ET0 por la ecuacion de Hargreaves-Samani. Es el rival a batir, no un predictor."),
}

COLUMNAS_MUESTRA = ["fecha", "estacion", "subcuenca", "elev", "t_max", "t_min",
                    "precipitacion", "rango_termico", "ra", "et0_hargreaves", "et0"]


def describir(df: pd.DataFrame, n_muestra: int = 40) -> dict:
    """Construye la ficha completa del dataset a partir del panel preparado."""

    # Esquema con las cifras reales de cada columna
    filas_esquema = []
    for col, (unidad, papel, explicacion) in ESQUEMA.items():
        if col not in df.columns:
            continue
        s = df[col]
        if pd.api.types.is_numeric_dtype(s):
            rango = "{:.2f} a {:.2f}".format(float(s.min()), float(s.max()))
            media = round(float(s.mean()), 3)
        else:
            rango = "{} valores".format(int(s.nunique()))
            media = None
        filas_esquema.append({
            "columna": col,
            "unidad": unidad,
            "papel": papel,
            "rango": rango,
            "media": media,
            "nulos": int(s.isna().sum()),
            "explicacion": acentuar(explicacion),
        })

    # Muestra intercalando estaciones, para que se vea el gradiente altitudinal
    # en lugar de cuarenta dias seguidos del mismo punto.
    por_estacion = max(1, n_muestra // df["estacion"].nunique())
    muestra = (df.sort_values(["estacion", "fecha"])
                 .groupby("estacion", group_keys=False)
                 .head(por_estacion)
                 .sort_values(["fecha", "estacion"]))

    def fmt(v):
        if isinstance(v, pd.Timestamp):
            return v.strftime("%Y-%m-%d")
        if isinstance(v, float):
            return "{:.2f}".format(v)
        return str(v)

    muestra_filas = [[fmt(v) for v in fila]
                     for fila in muestra[COLUMNAS_MUESTRA].values.tolist()]

    estaciones = []
    for e in ESTACIONES:
        sub = df[df.estacion == e["code"]]
        estaciones.append({
            "codigo": e["code"],
            "nombre": e["nombre"],
            "subcuenca": e["subcuenca"],
            "lat": e["lat"],
            "lon": e["lon"],
            "elev_ficha": e["elev"],
            "elev_era5": int(sub.elev.iloc[0]) if len(sub) else None,
            "registros": int(len(sub)),
            "et0_media": round(float(sub.et0.mean()), 2) if len(sub) else None,
        })

    papeles = {}
    for f in filas_esquema:
        papeles[f["papel"]] = papeles.get(f["papel"], 0) + 1

    lecturas = _lecturas(df, filas_esquema, estaciones, papeles, muestra)

    return {
        "fuente": {
            "nombre": "Open-Meteo Archive API",
            "modelo": "Reanalisis ERA5 (ECMWF)",
            "url": URL_API,
            "credenciales": acentuar("No requiere. API publica y gratuita para uso no comercial."),
            "licencia": acentuar("Datos ERA5 bajo licencia Copernicus; API bajo CC BY 4.0."),
            "variables_pedidas": VARIABLES_DIARIAS,
            "consulta_ejemplo": (
                "{}?latitude={}&longitude={}&start_date={}&end_date={}"
                "&daily={}&timezone=America%2FLima"
            ).format(URL_API, ESTACIONES[0]["lat"], ESTACIONES[0]["lon"],
                     FECHA_INICIO, FECHA_FIN, ",".join(VARIABLES_DIARIAS[:3]) + ",..."),
        },
        "volumen": {
            "filas": int(len(df)),
            "columnas": int(df.shape[1]),
            "estaciones": int(df.estacion.nunique()),
            "dias": int(df.fecha.nunique()),
            "periodo": "{} a {}".format(df.fecha.min().date(), df.fecha.max().date()),
            "anios": int(df.anio.nunique()),
            "nulos_totales": int(df.isna().sum().sum()),
            "elev_min": int(df.elev.min()),
            "elev_max": int(df.elev.max()),
        },
        "papeles": papeles,
        "esquema": filas_esquema,
        "estaciones": estaciones,
        "muestra": {
            "columnas": COLUMNAS_MUESTRA,
            "filas": muestra_filas,
        },
        # Cada vista del dataset lleva los mismos tres bloques de lectura que
        # las figuras y tablas del informe, por la misma razon: una tabla sin
        # interpretacion obliga al lector a deducir que deberia mirar.
        "lecturas": lecturas,
    }


def _lecturas(df, esquema, estaciones, papeles, muestra) -> dict:
    """Redacta la lectura de cada vista con las cifras recien calculadas."""

    n_pred = papeles.get("predictor", 0) + papeles.get("derivada", 0)
    n_exc = papeles.get("excluida", 0)
    excluidas = [f["columna"] for f in esquema if f["papel"] == "excluida"]

    alt = sorted(estaciones, key=lambda e: e["elev_era5"] or 0)
    baja, alta = alt[0], alt[-1]
    por_et0 = sorted([e for e in estaciones if e["et0_media"] is not None],
                     key=lambda e: e["et0_media"])
    reg = {e["registros"] for e in estaciones}

    # Dispersion de ET0 dentro del mismo dia, que es lo que revela la muestra
    fechas_muestra = muestra["fecha"].unique()
    dia = muestra[muestra["fecha"] == fechas_muestra[0]]
    disp = float(dia.et0.max() - dia.et0.min()) if len(dia) > 1 else 0.0

    return {
        "esquema": {
            "que": acentuar(
                "Las {} columnas del conjunto, con su unidad, el rango realmente observado y el papel que "
                "desempena cada una en el estudio.".format(len(esquema))),
            "como": acentuar(
                "La columna de papel es la clave. 'Objetivo' es lo que se predice; 'predictor' y 'derivada', "
                "lo que el modelo ve; 'excluida', lo que se descarto a proposito. El rango sirve para "
                "detectar valores imposibles antes de confiar en el dato."),
            "interpretacion": acentuar(
                "El modelo trabaja con {} variables de entrada y deja fuera {} que si estaban disponibles: "
                "{}. Esa exclusion es la decision central del estudio, no un descuido. La ecuacion FAO-56 "
                "usa esas tres directamente, de modo que incluirlas convertiria la prediccion en una copia "
                "de la formula y el resultado no serviria a una estacion peruana real, que carece de "
                "radiometro, anemometro e higrometro. El objetivo, et0, recorre de {} y es lo que hoy el "
                "gemelo sustituye por una constante.".format(
                    n_pred, n_exc, ", ".join(excluidas),
                    next(f["rango"] for f in esquema if f["columna"] == "et0") + " mm/dia")),
        },
        "estaciones": {
            "que": acentuar(
                "Las {} estaciones que componen el panel, con su posicion, la elevacion que les asigna el "
                "reanalisis, cuantos registros aporta cada una y su ET0 media.".format(len(estaciones))),
            "como": acentuar(
                "Conviene leerla ordenada por elevacion. Si el numero de registros fuese desigual, unas "
                "estaciones pesarian mas que otras en el entrenamiento y el modelo se sesgaria hacia ellas."),
            "interpretacion": acentuar(
                "Las estaciones cubren de {} m ({}) a {} m ({}), casi cuatro kilometros de desnivel en una "
                "sola cuenca. {} La ET0 media va de {} mm/dia en {} a {} mm/dia en {}, de modo que ninguna "
                "constante unica puede servir para toda la cuenca. Esta heterogeneidad obliga al modelo a "
                "generalizar entre ambientes distintos en vez de memorizar un microclima.".format(
                    baja["elev_era5"], baja["nombre"], alta["elev_era5"], alta["nombre"],
                    "Todas aportan el mismo numero de registros ({:,}), asi que ninguna domina el "
                    "entrenamiento.".format(list(reg)[0]) if len(reg) == 1 else
                    "El numero de registros difiere entre estaciones, lo que desequilibra su peso en el "
                    "entrenamiento y conviene vigilar.",
                    por_et0[0]["et0_media"], por_et0[0]["nombre"],
                    por_et0[-1]["et0_media"], por_et0[-1]["nombre"])),
        },
        "muestra": {
            "que": acentuar(
                "Filas reales del conjunto, tomadas de las {} estaciones para que se vea el formato exacto "
                "con el que trabaja el modelo.".format(df.estacion.nunique())),
            "como": acentuar(
                "Compare filas del mismo dia en estaciones distintas: la ultima columna, et0, es el valor a "
                "predecir, y la penultima es lo que estima la ecuacion de Hargreaves. La diferencia entre "
                "ambas es el error que el modelo debe corregir."),
            "interpretacion": acentuar(
                "En un mismo dia la ET0 varia hasta {:.2f} mm/dia entre estaciones, pese a compartir fecha y "
                "estar en la misma cuenca: la altitud y el rango termico explican esa diferencia, y por eso "
                "ambos entran como predictores. Se aprecia tambien que et0_hargreaves queda casi siempre por "
                "debajo de et0, que es el sesgo sistematico de la ecuacion y el defecto concreto que el "
                "modelo viene a corregir.".format(disp)),
        },
    }
