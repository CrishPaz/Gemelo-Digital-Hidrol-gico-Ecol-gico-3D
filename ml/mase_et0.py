"""MASE del modelo de ET0 sobre el conjunto de prueba 2020-2024.

Escala de Hyndman y Koehler (2006): MAE del pronostico ingenuo de un paso
(persistencia, la ET0 de ayer en la misma estacion) calculado sobre el
conjunto de ENTRENAMIENTO. Tambien se da la variante escalada con la
persistencia del propio conjunto de prueba, por transparencia.

Uso: python ml/mase_et0.py
"""
import sys
from pathlib import Path

ML = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parent
sys.path.insert(0, str(ML))

import joblib  # noqa: E402
import numpy as np  # noqa: E402

from adquisicion import obtener_dataset  # noqa: E402
from preparacion import particion_temporal, preparar  # noqa: E402


def mae_persistencia(df):
    d = df.sort_values(["estacion", "fecha"]).copy()
    d["ingenuo"] = d.groupby("estacion")["et0"].shift(1)
    d = d.dropna(subset=["ingenuo"])
    return float(np.mean(np.abs(d["et0"] - d["ingenuo"])))


art = joblib.load(ML / "outputs" / "modelo_et0.joblib")
modelo, predictores = art["modelo"], art["predictores"]

df = preparar(obtener_dataset())
entrena, prueba = particion_temporal(df)

y = prueba["et0"].to_numpy()
pred = modelo.predict(prueba[predictores].to_numpy())
harg = prueba["et0_hargreaves"].to_numpy()
cte = np.full(len(y), 3.5)

rmse = float(np.sqrt(np.mean((y - pred) ** 2)))
print(f"comprobacion RMSE modelo prueba: {rmse:.4f} (documento: 0.3942)  n={len(y)}")

escala_tr = mae_persistencia(entrena)
escala_te = mae_persistencia(prueba)
print(f"MAE persistencia entrenamiento: {escala_tr:.4f}  prueba: {escala_te:.4f}")

for nombre, p in [("Red neuronal", pred), ("Hargreaves-Samani", harg), ("Constante 3.5", cte)]:
    mae = float(np.mean(np.abs(y - p)))
    print(f"{nombre:20s} MAE={mae:.4f}  MASE(esc. entrenamiento)={mae / escala_tr:.4f}  MASE(esc. prueba)={mae / escala_te:.4f}")
print(f"{'Persistencia':20s} MAE={escala_te:.4f}  MASE(esc. entrenamiento)={escala_te / escala_tr:.4f}  MASE(esc. prueba)=1.0000")
