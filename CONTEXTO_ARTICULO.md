# Contexto para redactar el artículo de investigación

Documento de trabajo. Reúne todo lo que hace falta para escribir un artículo
sobre el gemelo digital hidrológico-ecológico del río Moche y su motor
analítico. Está pensado para que Claude Code, o cualquier persona, redacte sin
tener que volver a inspeccionar el código.

**Fecha de corte de los datos:** 7 de octubre de 2026.
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
depende de un servicio comercial de terceros.

### Evidencia de que el copiloto calcula

Misma pregunta, distinto porcentaje de remediación del efluente minero:

| Remediación | Pb máximo | Puntos críticos ECA |
|---|---|---|
| 0 % | 0.185 mg/L | 2 de 9 |
| 80 % | 0.055 mg/L | 1 de 9 |
| 95 % | 0.030 mg/L | 0 de 9 |

Antes, la plantilla fija devolvía siempre 0.185 mg/L, escribiera el operador lo
que escribiera.

---

## 3. El estudio de minería de datos

### Problema

El modelo GR4J exige evapotranspiración de referencia (ET0) como entrada
obligatoria en cada paso de tiempo. El gemelo la rellenaba con una constante de
3.5 mm/día. La media real de la cuenca es 3.68 mm/día con desviación 0.68, de
modo que la constante acierta en el promedio y yerra en los extremos.

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

4. **Las estaciones son puntos de reanálisis, no sensores físicos.** El gemelo
   usa sus coordenadas reales, pero los valores provienen de un modelo
   atmosférico, no de instrumentos instalados en campo.

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
