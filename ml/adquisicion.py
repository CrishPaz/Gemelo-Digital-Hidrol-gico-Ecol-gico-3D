"""
adquisicion.py - Fase 2 de CRISP-DM: comprension de los datos (obtencion).

Descarga el reanalisis ERA5 de Open-Meteo para las doce estaciones del Moche.
La API es publica y no pide credenciales, lo que importa para que la tesis sea
reproducible por el jurado sin pedir permisos a nadie.

Cada estacion se guarda en cache como CSV. Una segunda ejecucion no vuelve a
descargar: el estudio debe poder repetirse sin depender de que la red responda.
"""

from __future__ import annotations

import time
import io
import sys

import pandas as pd
import requests

from config import (
    CACHE,
    ESTACIONES,
    FECHA_FIN,
    FECHA_INICIO,
    VARIABLES_DIARIAS,
)

URL = "https://archive-api.open-meteo.com/v1/archive"

# Nombres cortos en espanol. El resto del pipeline trabaja con estos.
RENOMBRA = {
    "time": "fecha",
    "temperature_2m_max": "t_max",
    "temperature_2m_min": "t_min",
    "temperature_2m_mean": "t_media",
    "precipitation_sum": "precipitacion",
    "shortwave_radiation_sum": "radiacion",
    "et0_fao_evapotranspiration": "et0",
    "wind_speed_10m_max": "viento",
    "relative_humidity_2m_mean": "humedad",
}


def _descargar_estacion(est: dict, reintentos: int = 6) -> pd.DataFrame:
    """Trae una estacion, reintentando ante fallos transitorios de red."""
    params = {
        "latitude": est["lat"],
        "longitude": est["lon"],
        "start_date": FECHA_INICIO,
        "end_date": FECHA_FIN,
        "daily": ",".join(VARIABLES_DIARIAS),
        "timezone": "America/Lima",
    }

    ultimo_error = None
    for intento in range(1, reintentos + 1):
        try:
            r = requests.get(URL, params=params, timeout=120)
            # Open-Meteo limita peticiones por minuto. Un 429 no es un fallo de
            # red: es el servicio pidiendo calma, y merece esperar de verdad.
            if r.status_code == 429:
                espera = int(r.headers.get("Retry-After", 0)) or 65
                print(f"    limite de peticiones alcanzado; esperando {espera}s")
                time.sleep(espera)
                continue
            r.raise_for_status()
            payload = r.json()
            if "daily" not in payload:
                raise RuntimeError(f"respuesta sin bloque 'daily': {str(payload)[:200]}")

            df = pd.DataFrame(payload["daily"]).rename(columns=RENOMBRA)
            df["fecha"] = pd.to_datetime(df["fecha"])
            df["estacion"] = est["code"]
            df["nombre"] = est["nombre"]
            df["subcuenca"] = est["subcuenca"]
            df["lat"] = est["lat"]
            df["lon"] = est["lon"]
            # Elevacion real del modelo digital que usa el reanalisis, no la
            # nominal de la ficha: es la que corresponde a la celda descargada.
            df["elev"] = payload.get("elevation", est["elev"])
            df["elev_ficha"] = est["elev"]
            return df
        except Exception as exc:  # noqa: BLE001
            ultimo_error = exc
            if intento < reintentos:
                espera = 2 ** intento
                print(f"    intento {intento} fallido ({exc}); reintento en {espera}s")
                time.sleep(espera)

    raise RuntimeError(f"No se pudo descargar {est['code']}: {ultimo_error}")


def obtener_dataset(forzar: bool = False) -> pd.DataFrame:
    """Devuelve el panel completo estacion x dia, usando cache cuando existe."""
    marcos = []
    for est in ESTACIONES:
        destino = CACHE / f"{est['code']}.csv"
        if destino.exists() and not forzar:
            df = pd.read_csv(destino, parse_dates=["fecha"])
            print(f"  {est['code']} {est['nombre']:26s} cache   {len(df):6d} dias")
        else:
            print(f"  {est['code']} {est['nombre']:26s} descargando...")
            df = _descargar_estacion(est)
            df.to_csv(destino, index=False)
            print(f"  {est['code']} {est['nombre']:26s} bajado  {len(df):6d} dias")
            time.sleep(12)  # cortesia: el servicio es gratuito y limita por minuto
        marcos.append(df)

    panel = pd.concat(marcos, ignore_index=True)
    panel = panel.sort_values(["estacion", "fecha"]).reset_index(drop=True)
    return panel


if __name__ == "__main__":
    forzar = "--forzar" in sys.argv
    print("Descargando reanalisis ERA5 para la cuenca del Moche\n")
    panel = obtener_dataset(forzar=forzar)
    print(f"\nPanel: {len(panel):,} filas x {panel.shape[1]} columnas")
    print(f"Periodo: {panel['fecha'].min().date()} a {panel['fecha'].max().date()}")
    print(f"Estaciones: {panel['estacion'].nunique()}")
