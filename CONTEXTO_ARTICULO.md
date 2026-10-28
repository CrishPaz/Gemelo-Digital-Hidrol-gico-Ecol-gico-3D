# Contexto para redactar el artículo de investigación

Documento de trabajo. Reúne todo lo que hace falta para escribir un artículo
sobre el gemelo digital hidrológico-ecológico del río Moche y su motor
analítico. Está pensado para que Claude Code, o cualquier persona, redacte sin
tener que volver a inspeccionar el código.

**Fecha de corte de los datos:** 7 de octubre de 2026.
**Última revisión:** 28 de octubre de 2026. Se añadió qué datos de la interfaz
son reales y cuáles de demostración (sección 7), cómo levantar el gemelo
(sección 8), las aplicaciones en La Libertad (sección 12) y los parámetros de la
arquitectura con mediciones propias de latencia, acierto del copiloto y MASE
(secciones 5 y 13).
**Autor:** Crishtian Paz, Universidad Nacional de Trujillo, Tesis 2.
**Repositorio:** `CrishPaz/Gemelo-Digital-Hidrol-gico-Ecol-gico-3D`, rama
`feat/gemelo-3d-datos-reales`.

---

## 0. Advertencia sobre el uso de este documento

Este archivo contiene **datos verificados**, tomados directamente de la
ejecución del software. Ninguna cifra está inventada ni redondeada al alza.
Cuando algo no se midió, se dice que no se midió.

Dos reglas para quien redacte a partir de aquí:

1. **No añadir cifras que no estén en este documento.** Si el artículo necesita
   un dato que falta, hay que ejecutar el código y medirlo, no estimarlo.
2. **No suavizar los resultados negativos.** Están recogidos a propósito en la
   sección 7. Son la parte más defendible del trabajo.

---

## 1. Qué es el software

Un gemelo digital de la cuenca del río Moche (La Libertad, Perú), construido
como aplicación web. Integra tres cosas que normalmente viven separadas:

- Visualización tridimensional del terreno real de la cuenca.
- Motores de simulación hidrológica, hidráulica y de calidad de agua.
- Un copiloto conversacional que **ejecuta** esos motores en lugar de describirlos.

### Pila tecnológica

| Capa | Tecnología |
|---|---|
| Interfaz | React 19, TypeScript, Tailwind 4, Three.js |
| Servidor | Node.js, Express 4, Vite 6 como middleware |
| Copiloto | Gemini vía `@google/genai`, llamada a funciones nativa |
| Motor analítico | Python 3.10, scikit-learn 1.5, SHAP 0.49 |

### Área de estudio

Cuenca del río Moche, 2708 km². Recuadro envolvente: 79.10° a 78.25° O,
8.28° a 7.78° S. Doce estaciones de monitoreo, de 4032 m s.n.m. en Quiruvilca
hasta 0 m en la desembocadura.

### Fuentes de datos, todas sin credenciales

| Fuente | Qué aporta |
|---|---|
| AWS Terrain Tiles (Terrarium) | Modelo digital de elevación, SRTM y Copernicus GLO-30 |
| OpenStreetMap vía Overpass | Cauces, cuerpos de agua, localidades |
| Open-Meteo Archive (ERA5) | Precipitación, temperatura, ET0, radiación, viento, humedad |
| Google Maps Elevation | Opcional, solo como contraste. Requiere clave propia |

Que ninguna fuente obligatoria exija credenciales es una decisión de diseño:
hace el trabajo reproducible por un jurado sin pedir permisos a nadie.

---

## 2. Arquitectura del copiloto

Este es el aporte de ingeniería más defendible del trabajo, porque resuelve un
problema concreto y verificable.

### El problema de partida

La versión inicial tenía un copiloto que **hablaba sobre** el gemelo pero no lo
**operaba**. Tres defectos medibles:

1. El endpoint inyectaba un bloque de contexto escrito a mano, con valores
   literales como 6.45 m³/s que nunca cambiaban. El modelo redactaba cifras
   plausibles sobre esa base.
2. Las acciones de interfaz salían de buscar subcadenas en la respuesta. Una
   contestación que dijera "no se detectan metales pesados" abría igual el panel
   de dispersión de metales.
3. Se anexaban las mismas cuatro normas legales a toda respuesta, viniera o no
   a cuento.

### La solución

Un registro de nueve herramientas sobre los motores deterministas ya existentes,
en `src/server/basinTools.ts`. Cada herramienta declara su esquema de
parámetros, las normas que su resultado implica y las vistas que justifica
abrir.

| Herramienta | Motor que ejecuta |
|---|---|
| `consultar_estado_cuenca` | Red de 12 estaciones |
| `simular_caudal_gr4j` | GR4J lluvia-escorrentía |
| `asimilar_datos_enkf` | Filtro de Kalman por ensambles |
| `calcular_perfil_hidraulico` | Inversión de Manning |
| `evaluar_calidad_agua_wqi` | Índice WQI ponderado |
| `simular_transporte_metales` | Advección-dispersión de metales |
| `optimizar_asignacion_caudal` | Reparto por prioridad legal |
| `evaluar_caudal_ecologico` | Umbrales de Tennant |
| `consultar_estandares_eca` | Tabla ECA D.S. 004-2017-MINAM |

### Dos caminos, un registro

- **Con clave de Gemini:** bucle de llamada a funciones. El modelo decide qué
  motores invocar, recibe los resultados y redacta sobre lo calculado.
- **Sin clave:** enrutador determinista. Deduce la intención por palabras clave,
  extrae las magnitudes del enunciado y ejecuta los mismos motores.

Esta dualidad importa para el artículo: demuestra que la utilidad del sistema no
depende de un servicio comercial de terceros. Con un matiz medido: sin modelo,
el sistema solo entiende consultas escritas con vocabulario técnico (sección
13.6).

### Evidencia de que el copiloto calcula

Misma pregunta, distinto porcentaje de remediación del efluente minero:

| Remediación | Pb máximo | Puntos críticos ECA |
|---|---|---|
| 0 % | 0.185 mg/L | 2 de 9 |
| 80 % | 0.055 mg/L | 1 de 9 |
| 95 % | 0.030 mg/L | 0 de 9 |

Antes, la plantilla fija devolvía siempre 0.185 mg/L, escribiera el operador lo
que escribiera.

**Cuidado al citar esta tabla.** Las concentraciones son salida del modelo, no
mediciones. El perfil de partida, con 0.185 mg/L de plomo en el km 0, está
escrito a mano en `src/data/mocheHydroData.ts` sin fuente de monitoreo citada.
La tabla prueba que el copiloto calcula y responde a lo que se le pide; no
prueba cuánto plomo lleva el Moche. Para afirmar lo segundo hace falta un
monitoreo de la ANA o del OEFA como dato de partida.

---

## 3. El estudio de minería de datos

### Problema

El modelo GR4J exige evapotranspiración de referencia (ET0) como entrada
obligatoria en cada paso de tiempo. El gemelo la rellenaba con una constante de
3.5 mm/día. La media real de la cuenca es 3.68 mm/día con desviación 0.68, de
modo que la constante acierta en el promedio y yerra en los extremos.

El modelo de este estudio todavía no reemplaza esa constante dentro del gemelo;
ver la limitación 6 de la sección 7.

### Decisión metodológica central

El modelo **no recibe** radiación solar, viento ni humedad, pese a estar
disponibles en la fuente. Incluirlas volvería el problema casi trivial, porque
la ecuación FAO-56 Penman-Monteith las usa directamente. El resultado no
serviría a una estación peruana real, que carece de radiómetro, anemómetro e
higrómetro.

**Se renuncia a precisión para ganar aplicabilidad.** Esta frase resume el
aporte metodológico y conviene que aparezca argumentada en el artículo.

### Conjunto de datos

| Atributo | Valor |
|---|---|
| Fuente | Open-Meteo Archive API, reanálisis ERA5 (ECMWF) |
| Registros | 109 584 |
| Estaciones | 12 |
| Días distintos | 9132 |
| Periodo | 1 enero 2000 a 31 diciembre 2024 |
| Valores nulos | 0 |
| Gradiente altitudinal | 0 a 4032 m s.n.m. |
| Variable objetivo | `et0_fao_evapotranspiration`, mm/día |

Predictores finales, diez: `t_max`, `t_min`, `t_media`, `rango_termico`,
`precipitacion`, `elev`, `lat`, `ra`, `estacion_sin`, `estacion_cos`.

Variables derivadas y su justificación física:

- **Rango térmico** (`t_max` − `t_min`): sustituto barato de la radiación. Un
  cielo despejado calienta mucho de día y enfría mucho de noche.
- **Radiación extraterrestre** (`ra`): geometría orbital pura, ecuación 21 de
  FAO-56. Depende solo de latitud y fecha, nunca de un instrumento.
- **Estacionalidad** como seno y coseno del día del año: evita el salto
  artificial entre el 31 de diciembre y el 1 de enero.

### Línea base

Ecuación de Hargreaves-Samani (1985), que es lo que la propia FAO recomienda
cuando faltan datos. Competir contra la práctica establecida, y no contra un
promedio ingenuo, es lo que da valor al resultado.

---

## 4. Diseño experimental

### Partición y validación

Dos cuidados, ambos por la misma razón: evitar la fuga de información.

1. **Partición temporal, no aleatoria.** Entrenamiento de 2000 a 2019, 87 660
   registros. Prueba de 2020 a 2024, 21 924 registros. Con datos meteorológicos
   diarios los vecinos están autocorrelacionados, así que barajar filas coloca
   el 3 de marzo en entrenamiento y el 4 en validación, y el modelo aprueba por
   vecindad en lugar de por capacidad predictiva.

2. **Cortes por fecha, no por posición de fila.** El conjunto es un panel de
   doce estaciones que comparten calendario, de modo que cada fecha ocupa doce
   filas. Cortar por posición partiría un mismo día entre entrenamiento y
   validación.

**Validación cruzada temporal expansiva**, cinco particiones. La partición 1
entrena con el bloque más antiguo y valida con el siguiente; la 2 entrena con
los dos primeros, y así sucesivamente.

### Modelos comparados

Siete alternativas que cubren familias distintas de hipótesis, más dos
referencias: el control de la media y la ecuación de Hargreaves.

---

## 5. Resultados

### Validación cruzada, cinco particiones

| Puesto | Modelo | RMSE medio | Desv. | R² medio | Segundos |
|---|---|---|---|---|---|
| 1 | Red neuronal | 0.3279 | 0.1143 | 0.7410 | 23.8 |
| 2 | Potenciación por gradiente | 0.3338 | 0.1168 | 0.7314 | 5.0 |
| 3 | Bosque aleatorio | 0.3436 | 0.1138 | 0.7179 | 23.8 |
| 4 | K-vecinos | 0.3470 | 0.1003 | 0.7173 | 1.7 |
| 5 | Árbol de decisión | 0.3877 | 0.1060 | 0.6492 | 1.2 |
| 6 | Ridge | 0.4018 | 0.0943 | 0.6279 | 0.1 |
| 7 | Media (control) | 0.6705 | 0.0290 | −0.0113 | 0.0 |
| 8 | Hargreaves-Samani | 0.7425 | 0.0193 | −0.2468 | — |

Unidades de RMSE: mm/día.

### Conjunto de prueba, 2020-2024

| Método | RMSE | MAE | Sesgo | NSE | IC 95 % del RMSE |
|---|---|---|---|---|---|
| Red neuronal | 0.3942 | 0.2978 | +0.0412 | 0.6978 | 0.3895 a 0.3987 |
| Hargreaves-Samani | 0.7375 | 0.6002 | −0.4773 | −0.0579 | 0.7314 a 0.7439 |
| Constante 3.5 del gemelo | 0.7447 | 0.5946 | −0.2008 | −0.0784 | — |

Reducción del RMSE frente a Hargreaves: 46.6 %. Los intervalos bootstrap, 2000
repeticiones, no se solapan.

**El hallazgo más relevante no es la precisión sino el sesgo**, que pasa de
−0.4773 a +0.0412 mm/día. Sobre un año completo equivale a corregir unos 189 mm
de lámina evaporada acumulada, magnitud que sí altera un balance hídrico.

### Hiperparámetros

Búsqueda aleatoria, ocho configuraciones, sobre las tres últimas particiones.
Mejor configuración: una capa oculta de 64 neuronas, tasa de aprendizaje inicial
0.005, regularización alfa 1e-05.

**El ajuste no mejoró la configuración por defecto.** La ganancia fue de
−10.56 %, es decir negativa. Esto indica que el techo lo ponen los predictores
disponibles, no el ajuste del algoritmo. Es un resultado negativo honesto y
conviene reportarlo así.

### Pruebas estadísticas

| Prueba | Resultado |
|---|---|
| Friedman | χ² = 33.000, p < 0.001 |
| Wilcoxon con corrección de Holm | 2 de 2 comparaciones significativas |
| d de Cohen frente a Hargreaves | −0.646, efecto mediano |
| Diebold-Mariano | 9 de 9 comparaciones favorecen al modelo, p < 0.001 |
| Shapiro-Wilk sobre residuos | p < 0.001, no normales |
| Heterocedasticidad (Spearman) | ρ = +0.046, sin heterocedasticidad relevante |

Sobre la no normalidad de los residuos: es esperable con decenas de miles de
observaciones, donde el contraste detecta desviaciones mínimas e irrelevantes en
la práctica. Conviene decirlo así y no omitirlo.

### U de Theil y descomposición del error

| Método | U1 | U2 vs persistencia | Sesgo | Varianza | Covarianza |
|---|---|---|---|---|---|
| Red neuronal | 0.0521 | 0.7572 | 1.1 % | 0.9 % | 98.0 % |
| Hargreaves-Samani | 0.1044 | 1.4165 | 41.9 % | 0.3 % | 57.8 % |
| Constante 3.5 | 0.1024 | 1.4300 | 7.3 % | 92.7 % | 0.0 % |
| Persistencia (ingenuo) | 0.0691 | 1.0000 | 0.0 % | 0.0 % | 100.0 % |

Dos lecturas que vale la pena desarrollar en el artículo:

1. **Hargreaves no bate a la persistencia.** Su U2 es 1.4165, mayor que uno. En
   esta cuenca, repetir el valor de ayer sería más preciso que aplicar la
   ecuación de la FAO. La red neuronal sí la bate, con 0.7572.

2. **La descomposición explica por qué.** El modelo concentra el 98 % de su
   error en covarianza, es decir ruido irreducible, y solo el 1 % en sesgo.
   Hargreaves arrastra un 42 % de sesgo, que es error corregible. Un método cuyo
   error es casi todo ruido ha agotado la señal disponible.

### MASE

Calculado el 28 de octubre de 2026 con el modelo guardado en
`ml/outputs/modelo_et0.joblib`, que reproduce el RMSE de prueba de 0.3942 sobre
21 924 registros. Escala de Hyndman y Koehler (2006): MAE de la persistencia de
un día, construida por estación, en el conjunto de entrenamiento, 0.3356 mm/día.

| Método | MAE | MASE |
|---|---|---|
| Red neuronal | 0.2978 | 0.8875 |
| Hargreaves-Samani | 0.6002 | 1.7885 |
| Constante 3.5 | 0.5946 | 1.7718 |
| Persistencia del periodo de prueba | 0.3734 | 1.1128 |

Confirma con otra métrica lo que dice la U2: solo la red queda por debajo de 1.
Hargreaves comete casi el doble de error que repetir el valor de ayer. Que la
propia persistencia de prueba pase de 1 indica que 2020-2024 varía de un día a
otro algo más que el periodo de entrenamiento. Script: `ml/mase_et0.py`.

### Explicabilidad

Tres técnicas complementarias sobre la red neuronal.

**Importancia por permutación**, quince repeticiones:

| Variable | Importancia | % del total |
|---|---|---|
| `t_media` | 2.6027 | 49.2 |
| `elev` | 0.8610 | 16.3 |
| `rango_termico` | 0.6027 | 11.4 |
| `t_max` | 0.3465 | 6.5 |
| `t_min` | 0.3448 | 6.5 |
| `precipitacion` | 0.1999 | 3.8 |

Las tres primeras explican el 77 % de la importancia total. Ninguna variable
resulta prescindible.

**Dependencia parcial.** De las relaciones interpretables, las dos con signo
físico predecible coinciden con lo esperado: el rango térmico sube la ET0 y la
precipitación la baja.

Advertencia metodológica que conviene incluir: `t_media`, `t_max`, `t_min` y
`elev` quedan **excluidas de la lectura causal** por colinealidad superior a 0.9.
La dependencia parcial mueve una variable dejando las demás quietas, y eso exige
independencia. No existe un día con la temperatura máxima alta y la media sin
cambiar, de modo que la curva recorre combinaciones que el clima no produce y su
pendiente es un artefacto del método.

**SHAP.** Coincide con la permutación en señalar `t_media` como contribuyente
principal. La coincidencia entre dos métodos de fundamento distinto, uno basado
en degradar el error y otro en repartir la predicción según teoría de juegos,
refuerza que el hallazgo no depende de la técnica elegida.

---

## 6. Desempeño por estación

| Estación | Subcuenca | Elevación (m) | RMSE modelo | RMSE Hargreaves | Mejora |
|---|---|---|---|---|---|
| E-01 Quiruvilca | Alta | 4032 | 0.3650 | 0.6270 | +41.8 % |
| E-02 Shorey | Alta | 3636 | 0.3775 | 0.5502 | +31.4 % |
| E-03 Julcán | Alta | 3310 | 0.3640 | 0.5489 | +33.7 % |
| E-04 Otuzco | Media | 2965 | 0.4451 | 0.8434 | +47.2 % |
| E-05 Usquil | Media | 2712 | 0.4024 | 0.4298 | +6.4 % |
| E-07 Poroto | Media | 721 | 0.4057 | 0.5908 | +31.3 % |
| **E-09 Quirihuac** | **Baja** | **668** | **0.4429** | **0.3758** | **−17.8 %** |
| E-06 Simbal | Media | 424 | 0.4460 | 0.5029 | +11.3 % |
| E-11 Conache | Baja | 101 | 0.3345 | 0.5538 | +39.6 % |
| E-08 Laredo | Baja | 97 | 0.3497 | 0.5388 | +35.1 % |
| E-10 Campiña de Moche | Baja | 13 | 0.4233 | 1.2819 | +67.0 % |
| E-12 Boca de Río | Baja | 0 | 0.3511 | 1.2849 | +72.7 % |

La mejora no covaría significativamente con la altitud: ρ = −0.294, p = 0.354.

---

## 7. Resultados negativos y limitaciones

**Esta sección es la más valiosa del artículo.** Un trabajo que solo reporta
éxitos resulta sospechoso; uno que delimita dónde falla, creíble.

### Resultados negativos medidos

1. **El modelo empeora en una estación.** En Quirihuac Puente el RMSE sube un
   17.8 % frente a Hargreaves. Gana en 11 de 12, no en las 12. En ese punto
   conviene conservar la ecuación clásica.

2. **El ajuste de hiperparámetros no aportó nada.** Ganancia de −10.56 % frente
   a la configuración por defecto. El límite está en los predictores.

3. **Los residuos no son normales.** Shapiro-Wilk con p < 0.001.

4. **Cuatro de las seis variables más influyentes no admiten lectura causal** por
   colinealidad, de modo que la explicabilidad por dependencia parcial queda
   limitada a un subconjunto.

5. **El enrutador sin modelo no entiende paráfrasis.** Ejecuta el motor
   correcto en 17 de 17 consultas con vocabulario técnico y en 3 de 15
   parafraseadas. Además, la búsqueda por subcadenas da falsos positivos:
   "Dame un resumen" activa el motor de drenaje ácido porque "dame" contiene
   "dam". Detalle en la sección 13.6.

### Limitaciones de validez

1. **El objetivo procede de reanálisis, no de lisímetros.** El modelo reproduce
   la ET0 que calcula FAO-56 con datos ERA5, y hereda cualquier sesgo de ERA5
   frente a la realidad de campo. Validarlo contra una estación
   agrometeorológica del SENAMHI sería el siguiente paso, y debe declararse como
   trabajo futuro, no como logro alcanzado.

2. **El rango de aplicación es el de los datos vistos:** de 0 a 4032 m y el
   clima de la vertiente occidental andina. Extrapolar fuera de ahí no está
   respaldado.

3. **El periodo de prueba abarca 2020 a 2024.** Un cambio de régimen climático
   exigiría reentrenar.

4. **Las estaciones del estudio son puntos de reanálisis, no sensores físicos.**
   El estudio de ET0 usa sus coordenadas reales, pero los valores provienen de
   un modelo atmosférico, no de instrumentos instalados en campo.

5. **Buena parte de lo que muestra la interfaz es de demostración.** Revisado en
   el código el 28 de octubre de 2026:

   | Dato en la interfaz | Origen |
   |---|---|
   | Relieve | Real: SRTM y Copernicus GLO-30 |
   | Cauces y localidades | Real: OpenStreetMap |
   | Serie de 60 días de lluvia, ET0 y caudal "observado" con la que arrancan GR4J y el filtro de Kalman | Sintética: `Math.random` en `generateInitialSimulation`, `src/App.tsx` |
   | Lecturas de las 12 estaciones: caudal, WQI, turbidez, oxígeno disuelto | Sintéticas: paseo aleatorio cada 12 s en `src/App.tsx` |
   | Pozos y cuña salina | Escritos a mano en `src/data/hydrogeologyData.ts` |
   | Perfil de metales | Escrito a mano en `src/data/mocheHydroData.ts` |
   | Clima Open-Meteo de las 12 estaciones | Real; se descarga, pero ningún componente ni motor lo usa |

   Consecuencia: los caudales y asimilaciones que se ven en la interfaz
   demuestran que los motores funcionan, no que reproducen el río Moche. No
   deben presentarse como resultados. La etiqueta "Nodos IoT Activos"
   (`src/i18n/dictionary.ts`) sugiere sensores instalados que no existen;
   conviene cambiarla antes de mostrar el gemelo a un jurado.

6. **El modelo de ET0 no está conectado a GR4J.** Las herramientas del copiloto
   siguen usando 3.5 mm/día cuando no reciben una serie
   (`src/server/basinTools.ts`), y la simulación inicial de la interfaz usa 3.5
   más una oscilación y ruido. El informe del estudio se publica en la pestaña
   "Minería IA", pero sus predicciones no entran en ningún motor. El artículo no
   debe afirmar que el gemelo ya usa la ET0 estimada. Conectarla, junto con la
   lluvia de Open-Meteo que ya se descarga, es el siguiente paso natural.

---

## 8. Reproducibilidad

```bash
cd ml
python run_pipeline.py        # estudio completo, unos 3 minutos
python exportar_front.py      # publica el informe en la interfaz
```

Semilla fija en 42. Caché de descargas en disco. Partición temporal declarada.
Fuente pública sin credenciales.

El informe completo se genera en `ml/outputs/informe.md` y se publica en la
pestaña "Minería IA" del gemelo: siete fases, diez figuras y catorce tablas,
cada una con tres bloques de lectura.

### Levantar el gemelo

```bash
npm install
npm run dev                   # Express con Vite como middleware
```

El puerto sale de `PORT` en `.env`; por defecto es 3000. En el equipo del autor
es 3002, porque 3000 y 3001 los ocupan otros proyectos. `GEMINI_API_KEY` es
opcional: sin ella, `/api/health` informa `copilotMode: deterministic_engine` y
el copiloto usa el enrutador determinista de la sección 2.

Comprobación del 16 de octubre de 2026, con el servidor recién levantado:
`/api/health` respondió `ok` con las nueve herramientas registradas,
`/api/geo/dem` devolvió 856 254 bytes y `/api/geo/hydrography` 287 130 bytes,
ambos en menos de 0.4 s, y la vista 3D cargó 70 de 70 teselas, 71 cauces y 58
localidades.

### Reproducir las mediciones de la sección 13

```bash
npm run dev                                    # en una terminal
node scripts/bench_copiloto.mjs http://localhost:3002 scripts/resultados/bench_copiloto.json
python ml/mase_et0.py                          # MASE de la sección 5
```

El resultado del 28 de octubre de 2026 está guardado en
`scripts/resultados/bench_copiloto_2026-10-28.json`, con el detalle de cada
consulta.

### Huecos de reproducibilidad pendientes

- `ml/` no tiene `requirements.txt`. Las versiones instaladas constan en la
  sección 13.7, pero ningún archivo las fija.
- Este documento dice que el estudio tarda unos 3 minutos y `ml/README.md` dice
  unos 5. Conviene medirlo una vez y dejar la misma cifra en los dos.

---

## 9. Cómo redactar el artículo sin que suene generado

Esta sección responde al problema de Turnitin. Conviene entender primero qué
está midiendo ese informe.

### Qué detectan realmente estas herramientas

No detectan autoría. Detectan **baja perplejidad y baja ráfaga**: texto donde
cada palabra es la más previsible dada la anterior, y donde todas las frases
miden lo mismo. La prosa generada por defecto tiende a ser uniforme, abstracta y
equilibrada. La prosa de alguien que conoce su trabajo es irregular: se detiene
en lo que le costó, pasa rápido por lo rutinario y menciona detalles que nadie
inventaría.

Por eso el camino que funciona no es parafrasear ni cambiar sinónimos, que deja
el texto igual de plano y además lo empeora. El camino es **aumentar la
especificidad**. Un informe de similitud alto suele ser síntoma de un texto
vago, no de un texto copiado.

### Lo que no se debe hacer

Conviene descartarlo explícitamente, porque circula mucho:

- Sustituir caracteres por homoglifos Unicode. Es manipulación del detector, no
  del texto, y los sistemas actuales lo marcan.
- Insertar erratas a propósito.
- Parafrasear con herramientas automáticas. Baja la calidad y rara vez baja el
  índice.
- Añadir relleno para diluir el porcentaje.

Ninguna de esas técnicas mejora el artículo, y varias constituyen falta
académica por sí mismas. Además son frágiles: funcionan con un detector y fallan
con el siguiente.

### Lo que sí funciona, con material de este proyecto

**Usar las cifras exactas, no redondeadas.** Escribir 0.3942 mm/día en lugar de
"aproximadamente 0.4". Escribir 109 584 registros en lugar de "más de cien mil".
Los números específicos son, literalmente, improbables, y eso eleva la
perplejidad del texto.

**Contar los errores del proceso.** Este proyecto tiene varios documentados y
nadie los inventaría:

- La primera corrección automática de tildes renombró identificadores del código
  y dejó `from preparación import`, rompiendo el programa. Hubo que revertir
  desde el commit.
- La dependencia parcial anunciaba que cuatro variables contradecían la física.
  Era un artefacto de colinealidad, no un fallo del modelo.
- La descarga inicial falló con error 429 por límite de peticiones, y hubo que
  reescribir el reintento para respetar la cabecera `Retry-After`.

**Justificar las decisiones con el motivo concreto, no con la razón genérica.**
Comparar:

> Se utilizó validación cruzada temporal para evitar el sobreajuste.

frente a:

> Los cortes se hacen por fecha y no por posición de fila porque el conjunto es
> un panel de doce estaciones que comparten calendario: cada fecha ocupa doce
> filas, y cortar por posición partiría un mismo día entre entrenamiento y
> validación.

La segunda versión es más larga, más específica y mucho menos previsible.

**Nombrar lo que no funcionó.** La estación Quirihuac Puente, por su nombre. El
ajuste de hiperparámetros que dio −10.56 %. La U2 de Hargreaves de 1.4165, que
deja a la ecuación de la FAO por debajo de repetir el valor de ayer.

**Variar la longitud de las frases.** Alternar frases de cinco palabras con
otras de treinta. La prosa generada tiende a frases de longitud media uniforme.

**Evitar el vocabulario inflado.** Palabras como "robusto", "integral",
"holístico", "paradigma", "sinergia", "cabe destacar", "es importante señalar",
"en el contexto actual" aparecen con frecuencia desproporcionada en texto
generado. Casi siempre se pueden suprimir sin pérdida.

**Evitar la estructura tripartita mecánica.** Tres ventajas, tres limitaciones,
tres conclusiones. Si hay dos, poner dos. Si hay cinco, poner cinco.

### Declaración de uso de asistencia

Lo más sólido frente a un comité no es pasar el detector, sino declarar el uso
de asistencia si lo hubo. Muchas revistas y universidades ya lo exigen y lo
aceptan sin problema cuando el trabajo intelectual y los datos son propios. Una
nota de métodos del tipo "se empleó asistencia de IA para revisión de redacción;
el diseño experimental, la ejecución y el análisis son del autor" resuelve el
asunto mejor que cualquier reescritura.

**Nota pendiente:** el artículo previo mencionado no llegó adjunto. Para dar
correcciones concretas sobre él, hace falta el archivo.

---

## 10. Estructura sugerida del artículo

| Sección | Contenido y fuente en este documento |
|---|---|
| Introducción | Problema de la ET0 en estaciones sin instrumentación; sección 3 |
| Área de estudio | Sección 1 |
| Materiales y métodos | Secciones 3 y 4; insistir en la exclusión deliberada |
| Resultados | Sección 5, con las tablas tal cual |
| Explicabilidad | Sección 5, incluida la advertencia de colinealidad |
| Discusión | Sección 7; la U de Theil da el argumento más fuerte |
| Relevancia regional | Sección 12, con fuente para cada hecho externo |
| Arquitectura y parámetros | Sección 13; el texto de 13.8 sirve de base |
| Limitaciones | Sección 7, completa y sin suavizar |
| Conclusiones | Lo que se demostró y lo que no |

### Posibles títulos

- Estimación de evapotranspiración de referencia con variables meteorológicas
  limitadas en la cuenca del río Moche
- Un gemelo digital con copiloto que ejecuta los modelos: arquitectura y
  validación en la cuenca del río Moche
- Cuándo la ecuación de Hargreaves-Samani no basta: evidencia de la cuenca del
  río Moche

El tercero es el más honesto respecto al hallazgo principal.

---

## 11. Referencias que el trabajo ya usa

- Allen, R. G., Pereira, L. S., Raes, D., Smith, M. (1998). *Crop
  evapotranspiration: guidelines for computing crop water requirements*. FAO
  Irrigation and Drainage Paper 56.
- Hargreaves, G. H., Samani, Z. A. (1985). Reference crop evapotranspiration
  from temperature. *Applied Engineering in Agriculture*, 1(2), 96-99.
- Demšar, J. (2006). Statistical comparisons of classifiers over multiple data
  sets. *Journal of Machine Learning Research*, 7, 1-30.
- Diebold, F. X., Mariano, R. S. (1995). Comparing predictive accuracy. *Journal
  of Business and Economic Statistics*, 13(3), 253-263.
- Theil, H. (1958). *Economic Forecasts and Policy*. North-Holland.
- Hyndman, R. J., Koehler, A. B. (2006). Another look at measures of forecast
  accuracy. *International Journal of Forecasting*, 22(4), 679-688.
- Moriasi, D. N. et al. (2007). Model evaluation guidelines for systematic
  quantification of accuracy in watershed simulations. *Transactions of the
  ASABE*, 50(3), 885-900.
- Lundberg, S. M., Lee, S. I. (2017). A unified approach to interpreting model
  predictions. *Advances in Neural Information Processing Systems*, 30.
- Perrin, C., Michel, C., Andréassian, V. (2003). Improvement of a parsimonious
  model for streamflow simulation. *Journal of Hydrology*, 279(1-4), 275-289.
- Evensen, G. (2003). The Ensemble Kalman Filter: theoretical formulation and
  practical implementation. *Ocean Dynamics*, 53, 343-367.

### Normativa peruana citada en el software

- D.S. N° 004-2017-MINAM. Estándares de Calidad Ambiental para Agua.
- Ley N° 29338, Ley de Recursos Hídricos, y su reglamento D.S. N° 001-2010-AG.
- R.J. N° 055-2022-ANA. Metodología para la determinación de caudales
  ecológicos.
- D.S. N° 040-2014-EM. Reglamento de Protección Ambiental en Actividades
  Mineras.
- Ley N° 29664, SINAGERD.

---

## 12. Aplicaciones en La Libertad

Material para la introducción o la discusión. Cada fila dice qué motor del
gemelo responde a qué decisión y en qué estado está hoy. Ninguna aplicación está
validada en campo; ver la sección 7.

| Problema regional | Motor del gemelo | Quién decide | Estado hoy |
|---|---|---|---|
| Drenaje de los pasivos mineros de Quiruvilca | Transporte de metales con escenarios de remediación | OEFA, ANA, Gobierno Regional | Calcula; perfil de partida sin fuente de medición |
| Calidad del agua para riego en el valle Santa Catalina | WQI y ECA categoría 3 | Junta de Usuarios, ALA Moche-Virú-Chao | Calcula con los parámetros que recibe; las lecturas de la interfaz son sintéticas |
| Reparto del agua en estiaje | Asignación por prioridad de la Ley 29338 | ALA Moche-Virú-Chao, Junta de Usuarios | Calcula con el caudal que se le indica |
| Demanda de agua de los cultivos | ET0 del estudio de minería de datos | Regantes, Junta de Usuarios | Evaluado frente a FAO-56 sobre ERA5; no conectado al gemelo |
| Avenidas de El Niño | GR4J, filtro de Kalman y alertas en formato CAP | COER La Libertad, INDECI | Funciona con caudales sintéticos |
| Salinización de pozos costeros | Cuña salina de Ghyben-Herzberg | SEDALIB, regantes con pozo | Pozos escritos a mano |
| Caudal mínimo del río | Umbrales de Tennant | ANA | Calcula; el caudal actual de la interfaz es sintético |

**Hechos externos que necesitan fuente antes de entrar al artículo.** Salieron
al discutir las aplicaciones, pero no se han verificado con documentos:

- Que la antigua mina de Quiruvilca sigue drenando aguas ácidas con metales
  hacia el Moche.
- Que en el Niño Costero de 2017 los huaicos que inundaron Trujillo bajaron por
  las quebradas San Ildefonso y El León. Si se confirma, es una limitación del
  sistema de alertas: esas quebradas no están modeladas.

---

## 13. Parámetros de la arquitectura

Responde a la práctica de aula que pide parametrizar n8n, LangFlow y LangChain
como en un artículo Q1. **El gemelo no usa ninguna de las tres.** Lo correcto en
el artículo es decirlo y parametrizar lo que cumple esas funciones, no rellenar
la plantilla con valores de otra arquitectura. Todo lo de esta sección se midió
o se leyó del código el 28 de octubre de 2026, en el equipo de la sección 13.7.

### 13.1 Correspondencia con la arquitectura de referencia

| Función | Herramienta de la práctica | Lo que usa el gemelo | Archivo |
|---|---|---|---|
| Integración y orquestación | n8n | Servidor Express en un solo proceso de Node.js | `server.ts` |
| Modelado visual del pipeline | LangFlow | No hay; el pipeline está escrito en código | `src/server/copilotAgent.ts` |
| Razonamiento y agentes | LangChain / LangGraph | Bucle propio de llamada a funciones sobre `@google/genai` | `src/server/copilotAgent.ts` |
| Recuperación (RAG) | Retriever y vector store | No hay; cada herramienta declara sus normas | `src/server/basinTools.ts` |
| Herramientas | Tools y `$fromAI` | Registro de 9 herramientas con esquema JSON | `src/server/basinTools.ts` |

Por qué esta arquitectura y no la de la práctica, argumentos para el artículo:

- **Menos piezas que desplegar.** Un jurado reproduce el sistema con
  `npm install` y `npm run dev`, sin levantar n8n, una base vectorial ni un
  broker.
- **El bucle cabe en unas 80 líneas** (`runWithGemini`) y cada vuelta queda en
  la traza de auditoría `toolRuns`: qué motor se ejecutó, con qué argumentos y
  qué devolvió.
- **El mismo registro sirve a un segundo camino sin LLM**, el enrutador
  determinista de la sección 2.
- **Sin RAG a propósito.** El corpus normativo es corto: los ECA, la Ley 29338,
  la metodología de caudal ecológico. Cada herramienta declara qué normas
  implica su resultado, así que la cita sale de lo que se calculó y no de una
  búsqueda por similitud que pueda traer un artículo que no aplica.

### 13.2 Capa de integración, en lugar de n8n

| Parámetro de la práctica | Valor en el gemelo |
|---|---|
| Modo de ejecución | Instancia única, un proceso Node.js 22.20.0. Sin cola, sin broker, sin workers |
| Disparo | Petición HTTP que inicia la interfaz: `POST /api/gemini/assist`, `POST /api/geo/weather`, `GET /api/geo/dem`, `GET /api/geo/hydrography` |
| Webhook desde el sistema físico | No aplica: no hay sensores conectados (sección 7) |
| Telemetría | Temporizador del navegador cada 12 s que genera lecturas sintéticas |
| Ingesta del relieve | AWS Terrain Tiles a zoom 12, 8 descargas en paralelo, 30 s de límite por tesela |
| Ingesta de cauces | Overpass, servidor principal y uno de respaldo, 120 s de límite |
| Ingesta del clima | Open-Meteo, hasta 25 puntos, de 1 a 90 días pasados (60 por defecto), 45 s de límite |
| Caché en disco | Relieve 90 días, cauces 30 días, clima 3 horas, en `.cache/geodata` |
| Tolerancia a fallos | Si la llamada a Gemini falla, el servidor responde por el camino determinista |

Topología del copiloto como grafo dirigido:

```
Interfaz ──POST /api/gemini/assist──► server.ts
                                         │
                              ¿hay GEMINI_API_KEY?
                         sí ┌────────────┴────────────┐ no (o si Gemini falla)
                            ▼                         ▼
               runWithGemini, hasta 4 vueltas    runDeterministic
               el modelo elige herramientas      detectIntents → extractQuantities
                            │                    → planTools → encadenamiento
                            └──────► runTool ◄────────┘
                                        │  9 motores: GR4J, EnKF, Manning, WQI,
                                        │  metales, reparto, Tennant, ECA, estado
                                        ▼
                     collectCitations · collectActions · buildProtocol
                                        │
Interfaz ◄── JSON {reply, toolRuns, citations, executableActions, actionProtocol, mode}
```

Latencia medida en el camino determinista, servidor y cliente en el mismo
equipo:

| Medición | n | P50 | P95 | P99 | Máximo | Errores |
|---|---|---|---|---|---|---|
| Copiloto, peticiones secuenciales | 320 | 1.44 ms | 3.40 ms | 5.35 ms | 7.71 ms | 0 |
| Copiloto, 10 clientes simultáneos | 320 | 7.37 ms | 14.54 ms | 21.69 ms | 35.11 ms | 0 |

Con 10 clientes simultáneos las 320 peticiones se atendieron en 0.271 s, unas
1180 peticiones por segundo.

| Geodatos, caché caliente | n | P50 | P95 | Máximo | Errores |
|---|---|---|---|---|---|
| `/api/geo/dem`, 856 254 bytes | 20 | 45.76 ms | 86.53 ms | 89.15 ms | 0 |
| `/api/geo/hydrography` | 20 | 11.62 ms | 16.31 ms | 27.76 ms | 0 |
| `/api/geo/weather`, 2 puntos | 20 | 3.83 ms | 12.38 ms | 946.04 ms | 0 |

El máximo del clima es la primera llamada, que descarga de Open-Meteo; las
demás salen de la caché. Se comprobó repitiendo con puntos nuevos: la primera
tardó en torno a 1 s y las siguientes mucho menos.

Límites de estas cifras, que el artículo debe declarar:

- Miden el camino determinista. **No incluyen la latencia de Gemini**, que
  dominará cuando haya clave, porque añade red e inferencia.
- Cliente y servidor comparten máquina, así que no hay latencia de red.
- El servidor corría en modo desarrollo (tsx con Vite como middleware), no con
  la compilación de producción.

### 13.3 Capa de razonamiento, en lugar de LangChain

| Parámetro de la práctica | Valor | Dónde |
|---|---|---|
| Framework de agentes | Bucle propio de llamada a funciones; hace el papel del AgentExecutor. No hay grafo cíclico con estado tipo LangGraph | `runWithGemini` |
| LLM | Google Gemini `gemini-2.0-flash`, vía `@google/genai` 2.19.0. Se cambia con `GEMINI_MODEL`. Modelo comercial; Google no publica su número de parámetros | `copilotAgent.ts`, línea 35 |
| temperature | 0.35 | línea 180 |
| max_tokens | 1400 (`maxOutputTokens`) | línea 43 |
| top_p, top_k | No se fijan; rigen los valores por defecto del proveedor | — |
| max_iterations | 4. En la cuarta se retiran las herramientas para obligar a redactar | líneas 37 y 187-194 |
| Memoria | Últimos 6 turnos, cada uno recortado a 700 caracteres | líneas 39-41 |
| Compactación de salidas | Series reducidas a 8 elementos, textos a 400 caracteres, hasta 3 niveles de anidamiento | `compactForModel` |
| Elección de herramienta | Modo automático de Gemini; no se fija `toolConfig` | — |
| Instrucciones de sistema | 5 perfiles de especialista más una regla común que prohíbe dar cifras sin ejecutar un motor | `SPECIALIST_INSTRUCTIONS`, `TOOL_DISCIPLINE` |
| RAG | No aplica: no hay chunk_size, chunk_overlap, top_k ni score_threshold | — |

El camino sin LLM tiene sus propios parámetros:

| Parámetro | Valor |
|---|---|
| Intenciones | 8, detectadas por listas de palabras clave sobre el texto sin tildes |
| Magnitudes | 5, extraídas con expresiones regulares: mm de lluvia, m³/s, %, días, pH |
| Valores por defecto | 45 mm de lluvia en 10 días (entre 3 y 60) con hietograma triangular; 6.45 m³/s si la interfaz no envía caudal |
| Encadenamiento | El pico de GR4J alimenta el perfil hidráulico; el caudal de la red alimenta el reparto y el caudal ecológico |

### 13.4 Herramientas y esquemas de parámetros

Equivalente a `$fromAI` de n8n: con Gemini, el modelo rellena los argumentos a
partir del esquema JSON de cada herramienta (`toGeminiDeclarations`); sin
Gemini, los extrae `extractQuantities`.

| Herramienta | Parámetros | Obligatorios |
|---|---|---|
| `consultar_estado_cuenca` | subcuenca (texto) | ninguno |
| `simular_caudal_gr4j` | precipitacion_mm_dia (serie), evapotranspiracion_mm_dia (serie), humedad_inicial (número) | precipitacion_mm_dia |
| `asimilar_datos_enkf` | precipitacion_mm_dia, caudal_observado_m3s, evapotranspiracion_mm_dia (series) | las dos primeras |
| `calcular_perfil_hidraulico` | caudal_base_m3s, escala_manning (números) | caudal_base_m3s |
| `evaluar_calidad_agua_wqi` | do, ph, ec, turbidity, tss, nitrates, total_p, fecal_coliforms, heavy_metals_lead (números), estacion (texto) | ninguno |
| `simular_transporte_metales` | eficiencia_remediacion_pct, multiplicador_dilucion (números) | ninguno |
| `optimizar_asignacion_caudal` | caudal_disponible_m3s (número) | caudal_disponible_m3s |
| `evaluar_caudal_ecologico` | caudal_actual_m3s, caudal_medio_anual_m3s (números), temporada_humeda (booleano) | caudal_actual_m3s |
| `consultar_estandares_eca` | categoria (texto) | ninguno |

### 13.5 Métricas de validación, por dimensión de la práctica

| Dimensión | Lo que hay | Estado |
|---|---|---|
| Fidelidad | ET0: RMSE 0.3942, MAE 0.2978, MASE 0.8875 (sección 5). Caudal simulado frente a medido: no hay métrica | ET0 medido; caudal pendiente de datos reales |
| Latencia y sincronización | Respuesta del copiloto con P95 de 3.40 ms en secuencia y 14.54 ms con 10 clientes. No hay sincronización con un sistema físico que medir | Medido solo en el camino determinista |
| Corrección de la consulta | 20 de 32 en total: 17 de 17 con vocabulario técnico, 3 de 15 en paráfrasis | Medido solo en el camino determinista |
| Corrección de la respuesta | Sin medir: hace falta que expertos o un evaluador califiquen cada informe | Pendiente |
| Coste por consulta | Camino determinista: 0 tokens y 0 USD. Camino Gemini: sin medir | Parcial |
| Robustez entre modelos | Un solo proveedor configurado; no se probó otro LLM | Pendiente |
| Ablación | Plantilla fija frente a herramientas, sección 2. Gemini frente a enrutador: sin medir | Parcial |

### 13.6 Prueba de corrección de la consulta

**Protocolo.** 32 consultas de operador, 4 por cada una de las 8 intenciones;
17 escritas con vocabulario técnico y 15 que dicen lo mismo con otras palabras.
Cada consulta lleva etiquetados a mano los motores que deben ejecutarse. Cuenta
como acierto que se ejecuten todos. `consultar_estado_cuenca` no cuenta, porque
se ejecuta siempre. Cada consulta se repitió 10 veces; el camino es
determinista, de modo que las repeticiones solo sirven para la latencia.

| Subconjunto | Aciertos | Magnitud bien extraída | Casos con motores sobrantes |
|---|---|---|---|
| Vocabulario técnico | 17 de 17 | 5 de 5 | 2 |
| Paráfrasis | 3 de 15 | 0 de 2 | 0 |
| Total | 20 de 32 | 5 de 7 | 2 |

De los 3 aciertos en paráfrasis, 2 son consultas de estado general, que es la
respuesta por defecto, y el tercero acierta por la palabra "contamina". Fallos
concretos, útiles para la discusión:

- "Si tratamos el agua que sale de la mina al 95, ¿el Pb cumple?": la lista
  tiene "miner" pero no "mina", tampoco "Pb", y el 95 sin "%" no se extrae.
- "¿Se sale el agua del cauce si el caudal sube a 120 m3/s?": ninguna palabra
  de la lista de crecidas.
- "¿Qué tan confiable es la simulación?": la lista tiene "confianza", no
  "confiable".
- "Dame un resumen del estado de la cuenca" ejecuta el motor de metales, porque
  "dame" contiene "dam", la sigla de drenaje ácido de mina.
- "Simula el drenaje ácido de Quiruvilca" lanza además GR4J y el perfil
  hidráulico, porque "simula" está en la lista de crecidas.

**Amenaza a la validez.** Las consultas las redactó el asistente de IA usado en
el desarrollo, después de leer las listas de palabras del enrutador. Las de
vocabulario técnico están sesgadas a favor y las paráfrasis se escribieron para
buscar fallos. La prueba mide funcionamiento, no generalización. La prueba
seria es un conjunto escrito por operadores de la ANA o de la Junta de Usuarios
sin conocer el código.

**Lectura para el artículo.** Es el mejor argumento a favor del camino con LLM,
pero solo vale cuando se mida ese camino con el mismo conjunto. Hasta entonces
no conviene afirmar que Gemini lo resolvería.

### 13.7 Entorno de software y hardware

| Componente | Versión o especificación |
|---|---|
| Sistema operativo | Windows 11 Home, compilación 26300 |
| CPU | Intel Core i7-1165G7, 4 núcleos, 8 hilos, 2.80 GHz |
| RAM | 19.8 GB visibles |
| GPU | Intel Iris Xe integrada. El LLM no corre en local, así que VRAM no aplica |
| Node.js y npm | 22.20.0 y 10.9.1 |
| Express | 4.22.2 |
| @google/genai | 2.19.0 |
| Vite, React, Three.js | 6.4.3, 19.2.8, 0.185.1 |
| TypeScript y tsx | 5.8.3 y 4.23.12 |
| Python | 3.10.11 |
| scikit-learn, SHAP, pandas, NumPy | 1.5.2, 0.49.1, 2.2.3, 2.2.6 |

### 13.8 Texto resumido para el artículo

Base para pegar y adaptar. Usa solo cifras de este documento.

> El gemelo no emplea n8n, LangFlow ni LangChain. La integración la resuelve un
> servidor Express 4.22 en un único proceso de Node.js 22.20, sin cola de
> mensajes ni workers. La interfaz dispara cada consulta con una petición HTTP, y
> los geodatos externos (AWS Terrain Tiles, Overpass y Open-Meteo) se descargan
> bajo demanda y se guardan en disco: 90 días el relieve, 30 la hidrografía y
> 3 horas el clima. El razonamiento corre en un bucle propio de llamada a
> funciones sobre gemini-2.0-flash (@google/genai 2.19), con temperatura 0.35,
> 1400 tokens de salida como máximo y cuatro vueltas, la última sin
> herramientas para obligar al modelo a redactar. La memoria conserva los seis
> turnos previos, recortados a 700 caracteres. No hay recuperación aumentada:
> las nueve herramientas exponen un esquema JSON de parámetros y cada una
> declara las normas que su resultado implica, de modo que la cita legal procede
> del cálculo ejecutado y no de una búsqueda por similitud. Si el modelo no está
> disponible, un enrutador determinista deduce la intención por palabras clave,
> extrae las magnitudes con expresiones regulares y ejecuta los mismos motores.
>
> En 32 consultas etiquetadas, ese enrutador ejecutó el motor correcto en las 17
> escritas con vocabulario técnico y solo en 3 de las 15 parafraseadas. La
> búsqueda por subcadenas produjo además falsos positivos: «dame» activa el
> motor de drenaje ácido de mina por contener «dam». En un Intel Core i7-1165G7
> con 19.8 GB de RAM, el camino determinista respondió con una mediana de
> 1.44 ms y un P99 de 5.35 ms en 320 peticiones secuenciales, y atendió unas
> 1180 peticiones por segundo con diez clientes simultáneos, sin errores. El
> camino con Gemini no se evaluó en esta versión; su precisión, su latencia y su
> coste por consulta quedan pendientes.
