"""
preparacion.py - Fase 3 de CRISP-DM: preparacion de los datos.

Construye el conjunto de trabajo: limpieza, variables derivadas y la linea base
fisica contra la que se juzgara cualquier modelo de aprendizaje automatico.

La decision de diseno que sostiene toda la tesis esta aqui: el modelo solo ve
temperatura, lluvia, altitud y fecha. No ve radiacion, viento ni humedad, que son
las variables caras. Si viera la radiacion, predecir ET0 seria casi trivial,
porque la ecuacion FAO-56 la usa directamente, y el resultado no serviria para
una estacion peruana real que no tiene radiometro.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from config import CORTE_TEST


# ---------------------------------------------------------------------------
# Linea base fisica
# ---------------------------------------------------------------------------
def radiacion_extraterrestre(lat_grados: np.ndarray, dia_del_anio: np.ndarray) -> np.ndarray:
    """
    Radiacion extraterrestre Ra en MJ/m2/dia, ecuacion 21 de FAO-56.

    Es geometria orbital pura: depende solo de latitud y fecha, nunca de un
    instrumento. Por eso puede usarse en cualquier estacion, incluso sin sensores.
    """
    lat = np.radians(lat_grados)
    # Distancia relativa inversa Tierra-Sol
    dr = 1 + 0.033 * np.cos(2 * np.pi * dia_del_anio / 365.0)
    # Declinacion solar
    decl = 0.409 * np.sin(2 * np.pi * dia_del_anio / 365.0 - 1.39)
    # Angulo horario al ocaso, recortado para evitar dominios invalidos
    x = np.clip(-np.tan(lat) * np.tan(decl), -1.0, 1.0)
    ws = np.arccos(x)
    gsc = 0.0820  # constante solar, MJ/m2/min
    return (24 * 60 / np.pi) * gsc * dr * (
        ws * np.sin(lat) * np.sin(decl) + np.cos(lat) * np.cos(decl) * np.sin(ws)
    )


def hargreaves_samani(t_max, t_min, t_media, ra) -> np.ndarray:
    """
    ET0 por Hargreaves-Samani (1985), en mm/dia.

    Es el metodo que la propia FAO recomienda cuando faltan datos de radiacion,
    viento y humedad. Usar esto como referencia, y no un promedio ingenuo, hace
    que superarlo signifique algo: se compite contra la practica establecida.
    """
    rango = np.maximum(t_max - t_min, 0.0)
    return 0.0023 * (t_media + 17.8) * np.sqrt(rango) * ra * 0.408


# ---------------------------------------------------------------------------
# Construccion del conjunto de trabajo
# ---------------------------------------------------------------------------
def preparar(panel: pd.DataFrame) -> pd.DataFrame:
    df = panel.copy()
    df["fecha"] = pd.to_datetime(df["fecha"])

    # -- Limpieza -----------------------------------------------------------
    # Se descartan filas sin objetivo: imputar el valor a predecir seria
    # fabricar la respuesta y contaminaria la evaluacion.
    antes = len(df)
    df = df.dropna(subset=["et0", "t_max", "t_min", "t_media"])
    df["precipitacion"] = df["precipitacion"].fillna(0.0)  # sin registro = no llovio
    descartadas = antes - len(df)

    # Coherencia fisica: la maxima no puede ser menor que la minima.
    incoherentes = int((df["t_max"] < df["t_min"]).sum())
    df = df[df["t_max"] >= df["t_min"]]

    # -- Variables derivadas ------------------------------------------------
    df["dia_anio"] = df["fecha"].dt.dayofyear
    df["mes"] = df["fecha"].dt.month
    df["anio"] = df["fecha"].dt.year

    # El rango termico diario es el corazon de Hargreaves: un cielo despejado
    # calienta mucho de dia y enfria mucho de noche, asi que el rango actua como
    # sustituto barato de la radiacion que no se mide.
    df["rango_termico"] = df["t_max"] - df["t_min"]

    # La estacionalidad es ciclica: 31 de diciembre y 1 de enero son vecinos.
    # Codificarla con seno y coseno evita el salto artificial de 365 a 1.
    ang = 2 * np.pi * df["dia_anio"] / 365.25
    df["estacion_sin"] = np.sin(ang)
    df["estacion_cos"] = np.cos(ang)

    df["ra"] = radiacion_extraterrestre(df["lat"].to_numpy(), df["dia_anio"].to_numpy())
    df["et0_hargreaves"] = hargreaves_samani(
        df["t_max"].to_numpy(), df["t_min"].to_numpy(), df["t_media"].to_numpy(), df["ra"].to_numpy()
    )

    df.attrs["descartadas"] = descartadas
    df.attrs["incoherentes"] = incoherentes
    return df.reset_index(drop=True)


# Predictores disponibles en una estacion sin instrumentacion cara.
PREDICTORES = [
    "t_max", "t_min", "t_media", "rango_termico",
    "precipitacion", "elev", "lat", "ra",
    "estacion_sin", "estacion_cos",
]


def particion_temporal(df: pd.DataFrame, corte: str = CORTE_TEST):
    """
    Divide entrenamiento y prueba por fecha, no al azar.

    Una particion aleatoria pondria dias de 2024 junto a sus vecinos de 2023 en
    el entrenamiento. Como el clima de dias consecutivos esta autocorrelacionado,
    eso filtra informacion del futuro y devuelve metricas infladas.
    """
    corte_dt = pd.Timestamp(corte)
    entrena = df[df["fecha"] < corte_dt]
    prueba = df[df["fecha"] >= corte_dt]
    return entrena, prueba
