"""
run_pipeline.py - Orquestador del estudio CRISP-DM completo.

Recorre las seis fases en orden y deja en outputs/ el informe con todas las
figuras y tablas, cada una acompanada de su interpretacion.

Uso:
    python run_pipeline.py              estudio completo
    python run_pipeline.py --rapido     menos particiones y busqueda corta
"""

from __future__ import annotations

import sys
import time
import warnings

warnings.filterwarnings("ignore")

import joblib
import numpy as np

import fase2_eda
import fase4_modelado
import fase5_evaluacion
from adquisicion import obtener_dataset
from config import CORTE_TEST, SALIDA
from informe import Informe
from preparacion import PREDICTORES, particion_temporal, preparar


def main() -> None:
    rapido = "--rapido" in sys.argv
    n_folds = 3 if rapido else 5

    t0 = time.time()
    inf = Informe(
        "Estimacion de evapotranspiracion de referencia en la cuenca del Rio Moche\n\n"
        "Estudio CRISP-DM sobre reanalisis ERA5 para alimentar el modelo GR4J del gemelo digital"
    )

    # -- Datos -------------------------------------------------------------
    print("Cargando datos...\n")
    panel = obtener_dataset()
    df = preparar(panel)

    # -- Fases 1 y 2: negocio y datos --------------------------------------
    fase2_eda.ejecutar(df, inf)

    # -- Fase 3: preparacion -----------------------------------------------
    inf.fase(
        3, "Preparacion de los datos",
        "Construir las variables derivadas y separar entrenamiento de prueba sin filtrar informacion del futuro.",
    )
    tr, te = particion_temporal(df, CORTE_TEST)
    inf.texto(
        "**Variables derivadas.** Rango termico diario, que actua como sustituto barato de la radiacion "
        "porque un cielo despejado calienta mucho de dia y enfria mucho de noche. Radiacion "
        "extraterrestre por geometria orbital, que no requiere instrumento alguno. Estacionalidad "
        "codificada como seno y coseno del dia del anio, para que el 31 de diciembre y el 1 de enero "
        "queden contiguos en lugar de separados por todo el rango.\n\n"
        "**Exclusion deliberada.** El modelo no recibe radiacion medida, viento ni humedad, pese a estar "
        "disponibles en la fuente. Incluirlas volveria el problema casi trivial, porque la ecuacion FAO-56 "
        "las usa directamente, y el resultado no serviria a una estacion peruana real que carece de esos "
        "sensores. Se renuncia a precision para ganar aplicabilidad.\n\n"
        "**Particion.** Entrenamiento {:,} registros ({} a {}); prueba {:,} registros ({} a {}). El corte "
        "es temporal: una particion aleatoria colocaria dias contiguos a ambos lados y, al estar "
        "autocorrelacionados, devolveria metricas infladas.\n\n"
        "**Predictores finales ({}).** {}".format(
            len(tr), tr.fecha.min().date(), tr.fecha.max().date(),
            len(te), te.fecha.min().date(), te.fecha.max().date(),
            len(PREDICTORES), ", ".join(PREDICTORES))
    )

    # -- Fase 4: modelado ---------------------------------------------------
    nombre, modelo, rmse_folds = fase4_modelado.ejecutar(tr, inf, n_folds=n_folds)

    # -- Fase 5: evaluacion -------------------------------------------------
    pred = fase5_evaluacion.ejecutar(te, nombre, modelo, rmse_folds, inf)

    # -- Fase 6: despliegue -------------------------------------------------
    inf.fase(
        6, "Despliegue",
        "Dejar el modelo utilizable por el gemelo digital y senalar sus limites de validez.",
    )
    ruta_modelo = SALIDA / "modelo_et0.joblib"
    joblib.dump({"modelo": modelo, "predictores": PREDICTORES, "nombre": nombre}, ruta_modelo)

    err = pred - te["et0"].to_numpy()
    rmse = float(np.sqrt((err ** 2).mean()))

    inf.texto(
        "**Artefacto.** El modelo entrenado queda en `outputs/modelo_et0.joblib`, junto con la lista de "
        "predictores en el orden que espera. Se carga con `joblib.load`.\n\n"
        "**Integracion con el gemelo.** Hoy `basinTools.ts` alimenta GR4J con ET0 constante de 3.5 mm/dia "
        "cuando el operador no la aporta. Sustituir esa constante por este modelo mantiene la entrada "
        "obligatoria de GR4J pero la hace responder a la temperatura observada, a la altitud de la estacion "
        "y a la epoca del anio.\n\n"
        "**Limites de validez que deben declararse en la memoria.**\n\n"
        "1. El objetivo procede del reanalisis ERA5, no de lisimetros. El modelo reproduce la ET0 que "
        "calcula FAO-56 con datos de reanalisis, y hereda cualquier sesgo de ERA5 frente a la realidad "
        "de campo. Validarlo contra una estacion agrometeorologica del SENAMHI seria el siguiente paso.\n\n"
        "2. El rango de aplicacion es el de los datos vistos: de 0 a 4032 metros y el clima de la vertiente "
        "occidental andina. Extrapolar fuera de ahi no esta respaldado.\n\n"
        "3. La prueba abarca {} a {}. Un cambio de regimen climatico exigiria reentrenar.\n\n"
        "**Reproducibilidad.** Fuente publica sin credenciales, semilla fija ({}), datos en cache y "
        "particion temporal declarada. Ejecutar `python run_pipeline.py` reproduce el estudio entero.\n\n"
        "**Resultado.** Error tipico de {:.3f} mm/dia sobre datos nunca vistos.".format(
            te.fecha.min().date(), te.fecha.max().date(), 42, rmse)
    )

    destino = inf.escribir()
    print("\n" + "=" * 78)
    print("Informe: {}".format(destino))
    print("Figuras: {} | Tablas: {}".format(inf._n_fig, inf._n_tab))
    print("Modelo : {}".format(ruta_modelo))
    print("Tiempo : {:.1f} min".format((time.time() - t0) / 60))
    print("=" * 78)


if __name__ == "__main__":
    main()
