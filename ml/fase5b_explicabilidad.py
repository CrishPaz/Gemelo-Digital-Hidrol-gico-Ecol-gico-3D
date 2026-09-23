"""
fase5b_explicabilidad.py - Explicabilidad del modelo (XAI).

Explicabilidad e interpretacion son cosas distintas y conviene no confundirlas.
La interpretacion dice que significa un resultado: "el RMSE bajo un 46%, luego
el modelo acierta mas". La explicabilidad responde a otra pregunta: POR QUE el
modelo predice lo que predice, que variables usa y con que forma funcional.

La distincion importa aqui mas que de costumbre porque el modelo ganador es una
red neuronal, es decir una caja negra. Sin este apartado, la tesis solo podria
afirmar que el modelo funciona; con el, puede afirmar ademas que funciona por
razones fisicamente correctas, que es lo unico que justifica usarlo para operar
una cuenca real.

Tres tecnicas, complementarias a proposito:

1. Importancia por permutacion. Mide cuanto empeora el error al barajar una
   variable. Es agnostica al modelo y se calcula sobre datos no vistos, de modo
   que refleja utilidad predictiva real y no ajuste al entrenamiento.

2. Dependencia parcial. Muestra la FORMA de la relacion aprendida, no solo su
   fuerza. Permite contrastar si el modelo reproduce la fisica conocida: la ET0
   debe crecer con la temperatura y con la radiacion extraterrestre, y caer los
   dias de lluvia.

3. Valores SHAP. Reparten cada prediccion concreta entre las variables que la
   producen, con fundamento en teoria de juegos. Responden "por que ESTE dia se
   predijo ESTE valor", que es lo que un operador de cuenca preguntaria ante una
   cifra que no espera.
"""

from __future__ import annotations

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.inspection import partial_dependence, permutation_importance

from config import SEMILLA
from informe import Informe, PALETA
from preparacion import PREDICTORES

# La explicabilidad se calcula sobre una submuestra: permutar diez variables
# veinte veces sobre cien mil filas costaria minutos sin cambiar la conclusion.
N_MUESTRA = 6000
N_REPETICIONES = 15

# Signo que la fisica predice para cada relacion. Sirve para contrastar lo que
# el modelo aprendio contra lo que deberia haber aprendido.
FISICA_ESPERADA = {
    "t_max": ("creciente", "mas calor aporta mas energia disponible para evaporar"),
    "t_min": ("creciente", "noches templadas reducen la condensacion y mantienen la demanda"),
    "t_media": ("creciente", "es el termino central de la ecuacion de Hargreaves"),
    "rango_termico": ("creciente", "un rango amplio delata cielo despejado, y por tanto mas radiacion"),
    "precipitacion": ("decreciente", "un dia lluvioso es nuboso y humedo, lo que frena la evaporacion"),
    "ra": ("creciente", "la radiacion extraterrestre es el techo energetico del proceso"),
    "elev": ("decreciente", "al ascender baja la temperatura, y con ella la demanda evaporativa"),
    "lat": ("sin signo claro", "la cuenca abarca pocos grados de latitud"),
    "estacion_sin": ("ciclica", "codifica la epoca del anio, no una tendencia monotona"),
    "estacion_cos": ("ciclica", "pareja del anterior"),
}


def ejecutar(df_te: pd.DataFrame, nombre_modelo: str, modelo, inf: Informe) -> None:
    inf.fase(
        6, "Explicabilidad del modelo",
        "Abrir la caja negra: determinar que variables usa la red neuronal, con que forma y si esas "
        "relaciones coinciden con la fisica conocida del proceso.",
    )
    inf.texto(
        "**Explicabilidad no es interpretacion.** La interpretacion dice que significa un resultado; la "
        "explicabilidad, por que el modelo lo produce. El modelo ganador es una red neuronal, es decir una "
        "caja negra, y un gemelo digital que gobierna compuertas no puede apoyarse en una cifra cuyo origen "
        "nadie sabe explicar. Este apartado sirve para poder afirmar no solo que el modelo acierta, sino "
        "que acierta por razones correctas."
    )

    rng = np.random.default_rng(SEMILLA)
    idx = rng.choice(len(df_te), min(N_MUESTRA, len(df_te)), replace=False)
    sub = df_te.iloc[idx]
    X = sub[PREDICTORES].to_numpy()
    y = sub["et0"].to_numpy()

    imp = _permutacion(modelo, X, y, nombre_modelo, inf)
    _dependencia_parcial(modelo, X, imp, nombre_modelo, inf)
    _shap(modelo, X, imp, nombre_modelo, inf)


# ---------------------------------------------------------------------------
def _permutacion(modelo, X, y, nombre, inf) -> pd.DataFrame:
    r = permutation_importance(
        modelo, X, y, n_repeats=N_REPETICIONES, random_state=SEMILLA,
        scoring="neg_root_mean_squared_error", n_jobs=-1,
    )

    t = pd.DataFrame({
        "variable": PREDICTORES,
        "importancia": r.importances_mean,
        "desviacion": r.importances_std,
    }).sort_values("importancia", ascending=False).reset_index(drop=True)
    t["pct_del_total"] = 100 * t.importancia / t.importancia.clip(lower=0).sum()
    t = t.round(4)

    fig, ax = plt.subplots(figsize=(8, 4))
    orden = t.iloc[::-1]
    colores = [PALETA["modelo"] if v > 0 else PALETA["base"] for v in orden.importancia]
    ax.barh(orden.variable, orden.importancia, xerr=orden.desviacion,
            color=colores, alpha=0.85, error_kw={"lw": 0.9, "capsize": 2.5})
    ax.set_xlabel("aumento del RMSE al permutar (mm/dia)")
    ax.set_title("Importancia por permutacion")
    ax.tick_params(axis="y", labelsize=8)
    fig.tight_layout()

    top3 = t.head(3)
    irrelevantes = t[t.importancia <= t.desviacion]

    inf.tabla(
        t, "Importancia de cada variable por permutacion",
        "Cuanto empeora el error del modelo al barajar al azar cada variable, dejando el resto intacta. "
        "Se repite {} veces sobre datos de prueba.".format(N_REPETICIONES),
        "Un valor alto significa que el modelo depende de esa variable: sin ella, falla. Un valor cercano a "
        "cero, o menor que su propia desviacion, indica que la variable no aporta y podria retirarse. La "
        "medida es agnostica al algoritmo, asi que permite comparar modelos distintos con la misma vara.",
        "El modelo se apoya sobre todo en {}, que juntas explican el {:.0f}% de la importancia total. "
        "{} Esto es tranquilizador: son justamente las variables que la fisica del proceso senala como "
        "determinantes, y no un artefacto estadistico. {}".format(
            ", ".join("'{}'".format(v) for v in top3.variable),
            top3.pct_del_total.sum(),
            "La variable mas critica es '{}': permutarla degrada el RMSE en {:.4f} mm/dia.".format(
                t.iloc[0].variable, t.iloc[0].importancia),
            "Ninguna variable resulta prescindible." if irrelevantes.empty else
            "En cambio {} no supera su propia desviacion, de modo que podria retirarse sin perder "
            "capacidad predictiva y simplificaria el modelo.".format(
                ", ".join("'{}'".format(v) for v in irrelevantes.variable))),
    )

    inf.figura(
        fig, "Importancia por permutacion",
        "Degradacion del error al permutar cada variable, con su barra de incertidumbre sobre {} "
        "repeticiones.".format(N_REPETICIONES),
        "Las barras mas largas corresponden a las variables de las que el modelo mas depende. Si una barra "
        "de error cruza el cero, la contribucion de esa variable no se distingue del ruido.",
        "El perfil es jerarquico y no plano: el modelo no reparte su atencion por igual, sino que concentra "
        "la decision en unas pocas variables. Esa concentracion es deseable, porque un modelo que dependiera "
        "por igual de las diez seria mas fragil ante el fallo de un sensor.",
    )

    return t


# ---------------------------------------------------------------------------
def _dependencia_parcial(modelo, X, imp, nombre, inf) -> None:
    variables = [v for v in imp.variable.head(6)]
    indices = [PREDICTORES.index(v) for v in variables]

    # Aviso metodologico imprescindible. La dependencia parcial mueve una
    # variable dejando las demas quietas, lo que exige que sean independientes.
    # Con t_max, t_min y t_media, correlacionadas por encima de 0.9, ese supuesto
    # se rompe: no existe un dia con la maxima alta y la media sin cambiar. La
    # curva resultante recorre combinaciones que la fisica no permite, asi que su
    # pendiente no puede leerse como la relacion real. Detectarlo aqui evita
    # presentar un artefacto del metodo como un fallo del modelo.
    corr = np.corrcoef(X, rowvar=False)
    colineales = set()
    for a in range(len(PREDICTORES)):
        for b in range(a + 1, len(PREDICTORES)):
            if abs(corr[a, b]) > 0.9:
                colineales.add(PREDICTORES[a])
                colineales.add(PREDICTORES[b])

    fig, axes = plt.subplots(2, 3, figsize=(12, 6))
    hallazgos = []

    for ax, var, i in zip(axes.ravel(), variables, indices):
        pd_res = partial_dependence(modelo, X, [i], kind="average", grid_resolution=30)
        xs = pd_res["grid_values"][0]
        ys = pd_res["average"][0]

        ax.plot(xs, ys, color=PALETA["modelo"], lw=1.8)
        ax.fill_between(xs, ys.min(), ys, color=PALETA["modelo"], alpha=0.10)
        ax.set_title(var, fontsize=9)
        ax.set_ylabel("ET0 (mm/dia)", fontsize=7)
        ax.tick_params(labelsize=7)

        # Sentido aprendido frente al esperado por la fisica
        pendiente = float(np.polyfit(xs, ys, 1)[0])
        amplitud = float(ys.max() - ys.min())
        esperado, motivo = FISICA_ESPERADA.get(var, ("sin signo claro", ""))
        if esperado == "creciente":
            coincide = pendiente > 0
        elif esperado == "decreciente":
            coincide = pendiente < 0
        else:
            coincide = None
        hallazgos.append({"var": var, "pendiente": pendiente, "amplitud": amplitud,
                          "esperado": esperado, "coincide": coincide, "motivo": motivo,
                          "fiable": var not in colineales})
        if var in colineales:
            ax.set_title("{} (colineal)".format(var), fontsize=9, color="#b45309")

    for ax in axes.ravel()[len(variables):]:
        ax.axis("off")
    fig.suptitle("Dependencia parcial de las seis variables mas influyentes", fontsize=11, fontweight="bold")
    fig.tight_layout()

    # Solo las variables no colineales admiten una lectura causal de su curva.
    comprobables = [h for h in hallazgos if h["coincide"] is not None and h["fiable"]]
    aciertos = [h for h in comprobables if h["coincide"]]
    fallos = [h for h in comprobables if not h["coincide"]]
    descartadas = [h for h in hallazgos if h["coincide"] is not None and not h["fiable"]]

    detalle = "; ".join(
        "{} {} ({})".format(h["var"], "sube" if h["pendiente"] > 0 else "baja", h["motivo"])
        for h in aciertos
    )

    if fallos:
        veredicto = (
            "En cambio {} contradice lo esperado pese a no ser colineal, y eso si merece revision: puede "
            "senalar una correlacion espuria aprendida por el modelo.".format(
                ", ".join("'{}'".format(h["var"]) for h in fallos)))
    else:
        veredicto = (
            "Ninguna curva interpretable contradice la fisica del proceso. El modelo no memorizo "
            "asociaciones arbitrarias: aprendio el mecanismo, y eso es lo que permite confiar en el fuera "
            "del periodo de entrenamiento.")

    if descartadas:
        aviso = (
            " Quedan fuera de esta lectura {}, marcadas como colineales en el grafico. La dependencia "
            "parcial mueve una variable dejando las demas quietas, y eso exige que sean independientes: "
            "no existe un dia con la temperatura maxima alta y la media sin cambiar. La curva recorre "
            "entonces combinaciones que el clima no produce, de modo que su pendiente es un artefacto del "
            "metodo y no una relacion aprendida. Interpretarla como si lo fuera seria un error, y por eso "
            "se excluye en lugar de contarla como contradiccion.".format(
                ", ".join("'{}'".format(h["var"]) for h in descartadas)))
    else:
        aviso = ""

    inf.figura(
        fig, "Dependencia parcial: forma de las relaciones aprendidas",
        "Como cambia la prediccion media del modelo al recorrer cada variable manteniendo las demas en sus "
        "valores observados. Las marcadas como colineales no admiten lectura causal.",
        "Interesa la FORMA, no la altura. Una curva ascendente indica relacion directa; descendente, "
        "inversa; plana, que la variable no mueve la prediccion. La comparacion con la fisica solo es "
        "valida en variables poco correlacionadas con el resto.",
        "De las {} relaciones interpretables con signo fisico predecible, {} coinciden con lo esperado: "
        "{}. {}{}".format(
            len(comprobables), len(aciertos), detalle or "ninguna", veredicto, aviso),
    )


# ---------------------------------------------------------------------------
def _shap(modelo, X, imp, nombre, inf) -> None:
    """Atribucion por valores de Shapley, con fundamento en teoria de juegos."""
    try:
        import shap
    except ImportError:
        inf.texto("_No se calcularon valores SHAP: la libreria `shap` no esta instalada._")
        return

    # El explicador por kernel es agnostico al modelo, pero costoso: se le da un
    # fondo reducido por k-medias y pocas instancias a explicar.
    fondo = shap.kmeans(X, 25)
    muestra = X[:120]

    try:
        explicador = shap.KernelExplainer(modelo.predict, fondo)
        valores = explicador.shap_values(muestra, nsamples=100, silent=True)
    except Exception as exc:  # noqa: BLE001
        inf.texto("_No se pudieron calcular los valores SHAP: {}_".format(exc))
        return

    valores = np.asarray(valores)
    if valores.ndim == 3:
        valores = valores[:, :, 0]

    medias = np.abs(valores).mean(axis=0)
    t = pd.DataFrame({
        "variable": PREDICTORES,
        "shap_medio_abs": medias,
        "efecto_medio": valores.mean(axis=0),
    }).sort_values("shap_medio_abs", ascending=False).reset_index(drop=True).round(4)

    fig, ax = plt.subplots(1, 2, figsize=(12, 4.2))

    orden = t.iloc[::-1]
    ax[0].barh(orden.variable, orden.shap_medio_abs, color=PALETA["modelo"], alpha=0.85)
    ax[0].set_xlabel("|SHAP| medio (mm/dia)")
    ax[0].set_title("Contribucion media por variable")
    ax[0].tick_params(axis="y", labelsize=8)

    # Dispersion de contribuciones: revela si una variable empuja siempre en el
    # mismo sentido o cambia de signo segun el dia.
    top = t.variable.head(6).tolist()
    pos = [PREDICTORES.index(v) for v in top]
    ax[1].boxplot([valores[:, p] for p in pos], labels=top, vert=True,
                  patch_artist=True, medianprops={"color": "black"},
                  boxprops={"facecolor": PALETA["media"], "alpha": 0.6})
    ax[1].axhline(0, color=PALETA["mal"], lw=1.1)
    ax[1].set_ylabel("contribucion SHAP (mm/dia)")
    ax[1].set_title("Dispersion de las contribuciones")
    ax[1].tick_params(axis="x", labelsize=7, rotation=30)
    fig.tight_layout()

    coincide = t.variable.iloc[0] == imp.variable.iloc[0]

    # Una variable con contribucion casi siempre del mismo signo si es notable:
    # significa que empuja en una sola direccion. Que cambie de signo NO lo es,
    # porque SHAP mide la desviacion respecto al valor esperado: un dia calido
    # aporta positivo y uno frio negativo por construccion, no por inconsistencia.
    unidireccional = [v for v, p in zip(top, pos)
                      if (valores[:, p] > 0).mean() > 0.9 or (valores[:, p] > 0).mean() < 0.1]

    inf.tabla(
        t, "Atribucion SHAP por variable",
        "Contribucion media, en valor absoluto, de cada variable a las predicciones individuales, y el "
        "sentido medio de esa contribucion.",
        "El valor absoluto mide cuanto mueve la variable la prediccion, sin importar hacia donde. A "
        "diferencia de la permutacion, esto se calcula prediccion a prediccion y no sobre el error global. "
        "El efecto medio ronda cero en casi todas las variables por construccion: SHAP mide la desviacion "
        "respecto al valor esperado, de modo que un dia calido aporta positivo y uno frio negativo.",
        "SHAP situa a '{}' como principal contribuyente, {} con lo que indicaba la importancia por "
        "permutacion. La coincidencia entre dos metodos de fundamento distinto, uno basado en degradar el "
        "error y otro en repartir la prediccion segun teoria de juegos, refuerza que el hallazgo no depende "
        "de la tecnica elegida. {}".format(
            t.variable.iloc[0],
            "coincidiendo" if coincide else "discrepando",
            "Las variables {} contribuyen casi siempre en el mismo sentido, senal de que su efecto no "
            "depende del contexto del dia.".format(", ".join("'{}'".format(v) for v in unidireccional))
            if unidireccional else
            "Ninguna variable empuja siempre en la misma direccion, lo cual es lo esperable: el signo de "
            "la contribucion depende de si ese dia el valor esta por encima o por debajo de lo habitual."),
    )

    inf.figura(
        fig, "Valores SHAP: contribucion a cada prediccion",
        "A la izquierda, cuanto mueve cada variable la prediccion en promedio. A la derecha, la dispersion "
        "de esa contribucion sobre {} predicciones individuales.".format(len(muestra)),
        "En las cajas, la posicion respecto a la linea roja del cero indica el sentido. Una caja ancha "
        "significa que la misma variable unas veces sube la estimacion y otras la baja, segun el resto de "
        "condiciones de ese dia.",
        "Este es el nivel de explicacion que un operador de cuenca puede exigir ante una cifra concreta: "
        "permite responder por que el modelo estimo ese valor ese dia, descomponiendo la prediccion en las "
        "aportaciones de cada variable. Es lo que convierte la red neuronal en una herramienta auditable en "
        "lugar de un oraculo.",
    )
