# Motor analítico CRISP-DM · Cuenca del Río Moche

Estudio de minería de datos que acompaña al gemelo digital hidrológico-ecológico.
Estima la **evapotranspiración de referencia (ET0)** a partir de variables
meteorológicas baratas, para alimentar el modelo hidrológico GR4J del gemelo.

## Por qué este problema

GR4J exige ET0 como entrada obligatoria en cada paso de tiempo. Hoy el gemelo la
rellena con una **constante de 3.5 mm/día** cuando el operador no la aporta,
porque las estaciones de la cuenca miden temperatura y lluvia pero rara vez
radiación solar, viento y humedad, que son los sensores caros.

El modelo aquí entrenado sustituye esa constante por una estimación que responde
a la temperatura observada, la altitud y la época del año.

## Dataset

| | |
|---|---|
| Fuente | Reanálisis ERA5 vía [Open-Meteo Archive API](https://open-meteo.com/en/docs/historical-weather-api) |
| Credenciales | Ninguna. API pública |
| Cobertura | 109.584 registros diarios |
| Estaciones | Las 12 del gemelo, de 0 a 4032 m s.n.m. |
| Periodo | 2000-01-01 a 2024-12-31 |
| Objetivo | `et0_fao_evapotranspiration` (FAO-56 Penman-Monteith) |

## Decisión metodológica central

El modelo **no ve** radiación, viento ni humedad, pese a estar disponibles en la
fuente. Incluirlas volvería el problema casi trivial, porque la ecuación FAO-56
las usa directamente, y el resultado no serviría a una estación peruana real que
carece de esos sensores. Se renuncia a precisión para ganar aplicabilidad.

La línea base es la ecuación de **Hargreaves-Samani (1985)**, que es lo que la
propia FAO recomienda cuando faltan datos. Competir contra la práctica
establecida, y no contra un promedio ingenuo, es lo que da valor al resultado.

## Fases CRISP-DM

| Fase | Archivo | Contenido |
|---|---|---|
| 1. Comprensión del negocio | `fase2_eda.py` | Objetivo y criterio de éxito |
| 2. Comprensión de los datos | `fase2_eda.py` | Calidad, distribuciones, correlaciones, gradiente altitudinal |
| 3. Preparación | `preparacion.py` | Variables derivadas, partición temporal |
| 4. Modelado | `fase4_modelado.py` | 7 modelos, validación cruzada temporal, hiperparámetros |
| 5. Evaluación | `fase5_evaluacion.py` | Friedman, Wilcoxon con Holm, bootstrap, Diebold-Mariano, residuos |
| 6. Explicabilidad | `fase5b_explicabilidad.py` | Permutación, dependencia parcial, SHAP |
| 7. Despliegue | `run_pipeline.py` | Modelo serializado y límites de validez |

## Cómo se valida

**Partición temporal, nunca aleatoria.** Con datos meteorológicos diarios los
vecinos están autocorrelacionados: barajar filas coloca el 3 de marzo en
entrenamiento y el 4 en validación, y el modelo aprueba por vecindad en vez de
por capacidad predictiva.

**Cortes por fecha, no por posición de fila.** El conjunto es un panel de doce
estaciones que comparten calendario, así que cada fecha ocupa doce filas. Cortar
por posición partiría un mismo día entre entrenamiento y validación.

**Validación cruzada expansiva.** El fold 1 entrena con el bloque más antiguo y
valida con el siguiente; el fold 2 entrena con los dos primeros, y así. El
entrenamiento siempre precede a la validación en el tiempo.

## Pruebas estadísticas y por qué cada una

- **Friedman.** Contraste global no paramétrico sobre los rangos. Es el
  procedimiento que recomienda Demšar (2006) para comparar varios algoritmos,
  porque no exige normalidad ni homocedasticidad.
- **Wilcoxon pareado con corrección de Holm.** Friedman dice que hay diferencias,
  no cuáles. Holm controla la inflación del error de tipo I al repetir contrastes.
- **d de Cohen.** Un valor p dice si la diferencia es distinguible del ruido, no
  si es grande. Con decenas de miles de días casi todo sale significativo.
- **Bootstrap.** Intervalos de confianza sin suponer distribución alguna.
- **Diebold-Mariano.** Específico para precisión predictiva entre series
  temporales, con corrección por autocorrelación de los errores.
- **Diagnóstico de residuos.** Normalidad, sesgo y heterocedasticidad.

## Ejecución

```bash
cd ml
python run_pipeline.py            # estudio completo, unos 5 minutos
python run_pipeline.py --rapido   # menos particiones
python adquisicion.py --forzar    # volver a descargar ignorando la caché
```

Requiere `numpy`, `pandas`, `scipy`, `scikit-learn`, `matplotlib`, `joblib` y `shap`.
No usa `seaborn`, `xgboost`, `lightgbm` ni `tabulate`.

## Salidas

```
outputs/
  informe.md            informe completo; cada figura y tabla con su interpretación
  figuras/*.png
  tablas/*.csv
  modelo_et0.joblib     modelo entrenado, listo para cargar con joblib.load
  consola.log
```

La caché de `cache/*.csv` evita volver a descargar: el estudio se reproduce sin
depender de que la red responda.

## Límites de validez

Deben declararse en la memoria:

1. **El objetivo procede de reanálisis, no de lisímetros.** El modelo reproduce
   la ET0 que calcula FAO-56 con datos ERA5, y hereda cualquier sesgo de ERA5
   frente a la realidad de campo. Validarlo contra una estación agrometeorológica
   del SENAMHI sería el siguiente paso.
2. **El rango de aplicación es el de los datos vistos**, de 0 a 4032 m y el clima
   de la vertiente occidental andina.
3. **El modelo no mejora a Hargreaves en todas las estaciones.** El informe
   identifica cuáles por nombre. En esos puntos conviene conservar la ecuación.
