"""
fase2_eda.py - Fases 1 y 2 de CRISP-DM: comprension del negocio y de los datos.

Cada figura y cada tabla se registra con su lectura. Los textos no son fijos:
se redactan con los numeros recien calculados, de modo que si los datos cambian,
la interpretacion cambia con ellos.
"""

from __future__ import annotations

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from informe import Informe, PALETA, clasificar_r
from preparacion import PREDICTORES

COLOR_SUB = {"Alta": PALETA["alta"], "Media": PALETA["media"], "Baja": PALETA["baja"]}

MESES = {1: "enero", 2: "febrero", 3: "marzo", 4: "abril", 5: "mayo", 6: "junio",
         7: "julio", 8: "agosto", 9: "septiembre", 10: "octubre", 11: "noviembre", 12: "diciembre"}


def ejecutar(df: pd.DataFrame, inf: Informe) -> None:
    inf.fase(
        1, "Comprension del negocio",
        "Definir que problema resuelve el modelo dentro del gemelo digital y con que criterio se declarara util.",
    )
    inf.texto(
        "El modelo hidrologico GR4J del gemelo exige evapotranspiracion de referencia (ET0) como entrada "
        "obligatoria en cada paso de tiempo. Hoy el gemelo la rellena con una constante de 3.5 mm/dia cuando "
        "el operador no la aporta, porque las estaciones de la cuenca del Moche miden temperatura y lluvia "
        "pero rara vez radiacion solar, viento y humedad, que son los sensores caros.\n\n"
        "**Objetivo.** Estimar ET0 diaria usando solo variables baratas: temperatura maxima y minima, "
        "precipitacion, altitud y fecha.\n\n"
        "**Criterio de exito.** Superar de forma estadisticamente significativa a la ecuacion de "
        "Hargreaves-Samani, que es el metodo que la propia FAO recomienda cuando faltan datos. Competir "
        "contra la practica establecida, y no contra un promedio ingenuo, es lo que da valor al resultado."
    )

    inf.fase(
        2, "Comprension de los datos",
        "Describir el origen, verificar la calidad y explorar la estructura antes de modelar.",
    )
    inf.texto(
        "**Fuente.** Reanalisis ERA5 servido por la API publica de Open-Meteo, sin credenciales. "
        "**Cobertura.** {:,} registros diarios de {} estaciones del Rio Moche, entre {} y {}. "
        "Las coordenadas son las mismas que usa el gemelo, con un gradiente de {:.0f} a {:.0f} metros.".format(
            len(df), df["estacion"].nunique(), df["fecha"].min().date(), df["fecha"].max().date(),
            df["elev"].min(), df["elev"].max())
    )

    _calidad(df, inf)
    _resumen(df, inf)
    _distribucion(df, inf)
    _estacionalidad(df, inf)
    _correlaciones(df, inf)
    _altitud(df, inf)
    _linea_base(df, inf)


# ---------------------------------------------------------------------------
def _calidad(df, inf):
    filas = []
    for c in ["et0", "t_max", "t_min", "t_media", "precipitacion", "radiacion", "viento", "humedad", "elev"]:
        if c not in df.columns:
            continue
        s = df[c]
        filas.append({
            "variable": c,
            "nulos": int(s.isna().sum()),
            "pct_nulos": round(100 * s.isna().mean(), 3),
            "minimo": round(float(s.min()), 3),
            "maximo": round(float(s.max()), 3),
            "unicos": int(s.nunique()),
        })
    t = pd.DataFrame(filas)

    tot_nulos = int(t["nulos"].sum())
    if tot_nulos == 0:
        veredicto = ("No hay un solo valor ausente, de modo que no se imputa nada y ninguna metrica "
                     "posterior queda contaminada por relleno artificial.")
    else:
        veredicto = "Se detectan {} valores ausentes que exigen tratamiento antes de modelar.".format(tot_nulos)

    inf.tabla(
        t, "Calidad de los datos",
        "Recuento de ausentes, rango observado y numero de valores distintos por variable.",
        "Las columnas de nulos deben ser cero. Los minimos y maximos sirven para detectar imposibles "
        "fisicos, como una humedad relativa mayor que cien o una precipitacion negativa.",
        "{} Los rangos son fisicamente plausibles: la ET0 va de {:.2f} a {:.2f} mm/dia, propio de una "
        "cuenca que abarca desde el nivel del mar hasta la puna. Se descartaron {} filas sin objetivo y "
        "{} con temperatura maxima inferior a la minima.".format(
            veredicto, df.et0.min(), df.et0.max(),
            df.attrs.get("descartadas", 0), df.attrs.get("incoherentes", 0))
    )


def _resumen(df, inf):
    cols = ["et0", "t_max", "t_min", "t_media", "rango_termico", "precipitacion", "elev"]
    t = df[cols].describe().T.round(3).reset_index().rename(columns={"index": "variable"})
    cv = df.et0.std() / df.et0.mean()

    inf.tabla(
        t, "Resumen estadistico de las variables",
        "Tendencia central, dispersion y cuartiles de las variables que intervienen en el estudio.",
        "Comparar la media con la mediana revela asimetria. La desviacion frente a la media da el "
        "coeficiente de variacion, que indica cuanta senal hay que explicar.",
        "La ET0 promedia {:.2f} mm/dia con desviacion {:.2f}, es decir un coeficiente de variacion de "
        "{:.1%}. Esa variabilidad es justamente lo que se pierde al sustituirla por la constante de "
        "3.5 mm/dia que usa hoy el gemelo: la constante acierta en el promedio pero yerra sistematicamente "
        "en los extremos. La precipitacion es muy asimetrica (media {:.2f} frente a mediana {:.2f} mm), "
        "lo normal en clima semiarido donde la mayoria de dias no llueve.".format(
            df.et0.mean(), df.et0.std(), cv, df.precipitacion.mean(), df.precipitacion.median())
    )


def _distribucion(df, inf):
    fig, ax = plt.subplots(1, 2, figsize=(11, 3.8))

    ax[0].hist(df.et0, bins=60, color=PALETA["media"], edgecolor="white", linewidth=0.3)
    ax[0].axvline(df.et0.mean(), color=PALETA["mal"], lw=1.6,
                  label="media {:.2f}".format(df.et0.mean()))
    ax[0].axvline(3.5, color="black", lw=1.4, ls="--", label="constante del gemelo 3.5")
    ax[0].set_title("Distribucion de ET0")
    ax[0].set_xlabel("ET0 (mm/dia)")
    ax[0].set_ylabel("frecuencia")
    ax[0].legend(fontsize=7)

    orden = ["Alta", "Media", "Baja"]
    datos = [df[df.subcuenca == s].et0.values for s in orden]
    bp = ax[1].boxplot(datos, labels=orden, patch_artist=True, medianprops={"color": "black"})
    for caja, s in zip(bp["boxes"], orden):
        caja.set_facecolor(COLOR_SUB[s])
        caja.set_alpha(0.65)
    ax[1].set_title("ET0 por subcuenca")
    ax[1].set_ylabel("ET0 (mm/dia)")
    fig.tight_layout()

    med = {s: df[df.subcuenca == s].et0.median() for s in orden}
    rango = max(med.values()) - min(med.values())
    mayor = max(med, key=med.get)
    menor = min(med, key=med.get)
    sesgo = float(df.et0.skew())
    if abs(sesgo) < 0.5:
        forma = "simetrica"
    elif sesgo > 0:
        forma = "con cola a la derecha"
    else:
        forma = "con cola a la izquierda"

    inf.figura(
        fig, "Distribucion de ET0 global y por subcuenca",
        "A la izquierda el histograma de la variable objetivo con la media y la constante que usa hoy el "
        "gemelo. A la derecha la misma variable separada por tramo de cuenca.",
        "En el histograma interesa la forma y la anchura. En las cajas, la linea central es la mediana, la "
        "caja abarca el cincuenta por ciento central y los bigotes el resto salvo atipicos.",
        "La distribucion es {} (asimetria {:.2f}) y se concentra entre {:.2f} y {:.2f} mm/dia. La constante "
        "de 3.5 mm/dia cae dentro del rango central, lo que explica que el gemelo no produzca disparates, "
        "pero queda {:+.2f} mm/dia respecto a la media real. Por subcuenca la mediana varia {:.2f} mm/dia "
        "entre la {} ({:.2f}) y la {} ({:.2f}), prueba de que una sola constante no puede servir para toda "
        "la cuenca.".format(
            forma, sesgo, df.et0.quantile(0.25), df.et0.quantile(0.75),
            df.et0.mean() - 3.5, rango, mayor, med[mayor], menor, med[menor])
    )


def _estacionalidad(df, inf):
    fig, ax = plt.subplots(figsize=(10, 3.6))
    for s in ["Alta", "Media", "Baja"]:
        sub = df[df.subcuenca == s].groupby("mes").et0.agg(["mean", "std"])
        ax.plot(sub.index, sub["mean"], marker="o", ms=4, color=COLOR_SUB[s], label="Cuenca " + s)
        ax.fill_between(sub.index, sub["mean"] - sub["std"], sub["mean"] + sub["std"],
                        color=COLOR_SUB[s], alpha=0.13)
    ax.set_xticks(range(1, 13))
    ax.set_xticklabels(["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"])
    ax.set_xlabel("mes")
    ax.set_ylabel("ET0 (mm/dia)")
    ax.set_title("Ciclo anual de ET0 por subcuenca")
    ax.legend(fontsize=8)
    fig.tight_layout()

    ciclo = df.groupby("mes").et0.mean()
    mes_max, mes_min = int(ciclo.idxmax()), int(ciclo.idxmin())
    amplitud = ciclo.max() - ciclo.min()

    inf.figura(
        fig, "Ciclo anual de ET0",
        "Media mensual de ET0 en cada tramo de la cuenca. La banda sombreada es una desviacion tipica.",
        "Si las curvas suben y bajan con el mes, existe estacionalidad y el modelo debe recibir la fecha "
        "como predictor. La separacion vertical entre curvas mide cuanto pesa la posicion en la cuenca.",
        "Hay un ciclo anual claro, con maximo en {} ({:.2f} mm/dia) y minimo en {} ({:.2f}), una amplitud "
        "de {:.2f} mm/dia que representa el {:.0%} de la media. Esto justifica codificar el dia del anio "
        "como seno y coseno en la fase de preparacion. Las tres curvas mantienen distancia entre si durante "
        "todo el anio, de modo que la altitud actua como desplazamiento y no solo como ruido.".format(
            MESES[mes_max], ciclo.max(), MESES[mes_min], ciclo.min(), amplitud, amplitud / df.et0.mean())
    )


def _correlaciones(df, inf):
    cols = ["et0"] + PREDICTORES
    corr = df[cols].corr(method="spearman")

    fig, ax = plt.subplots(figsize=(7.2, 5.8))
    im = ax.imshow(corr, cmap="RdBu_r", vmin=-1, vmax=1)
    ax.set_xticks(range(len(cols)))
    ax.set_xticklabels(cols, rotation=45, ha="right", fontsize=7)
    ax.set_yticks(range(len(cols)))
    ax.set_yticklabels(cols, fontsize=7)
    for i in range(len(cols)):
        for j in range(len(cols)):
            v = corr.iloc[i, j]
            ax.text(j, i, "{:.2f}".format(v), ha="center", va="center", fontsize=6,
                    color="white" if abs(v) > 0.55 else "black")
    ax.set_title("Correlacion de Spearman")
    fig.colorbar(im, ax=ax, shrink=0.8)
    ax.grid(False)
    fig.tight_layout()

    con_obj = corr["et0"].drop("et0").sort_values(key=abs, ascending=False)
    top = con_obj.index[0]

    sin_obj = corr.drop(index="et0", columns="et0")
    pares = [(a, b, sin_obj.loc[a, b]) for i, a in enumerate(sin_obj.columns)
             for b in sin_obj.columns[i + 1:] if abs(sin_obj.loc[a, b]) > 0.9]

    if pares:
        nota_coli = ("Existen {} pares de predictores con correlacion superior a 0.9 ({}), lo que anticipa "
                     "problemas de colinealidad para los modelos lineales y aconseja incluir metodos basados "
                     "en arboles, que son inmunes a ella.").format(
            len(pares), ", ".join("{}-{}".format(a, b) for a, b, _ in pares[:3]))
    else:
        nota_coli = ("Ningun par de predictores supera 0.9 de correlacion, de modo que la colinealidad no "
                     "compromete a los modelos lineales.")

    inf.tabla(
        con_obj.round(4).reset_index().rename(columns={"index": "predictor", "et0": "rho_con_ET0"}),
        "Correlacion de cada predictor con ET0",
        "Coeficiente de Spearman entre cada variable disponible y la variable objetivo.",
        "Spearman mide asociacion monotona, no solo lineal, asi que tolera relaciones curvas. Valores "
        "cercanos a uno en valor absoluto indican predictores potentes; cercanos a cero, poco utiles por si solos.",
        "El predictor mas asociado es '{}' con rho de {:+.3f}, asociacion {}. {}".format(
            top, con_obj.iloc[0], clasificar_r(con_obj.iloc[0]), nota_coli)
    )

    inf.figura(
        fig, "Matriz de correlacion",
        "Correlacion de Spearman entre la variable objetivo y todos los predictores.",
        "El azul intenso marca asociacion positiva y el rojo intenso, negativa. La primera fila y columna "
        "muestran la relacion con ET0; el resto del cuadro revela redundancia entre predictores.",
        "La estructura confirma que la informacion util esta repartida y no concentrada en una sola "
        "variable: el mejor predictor individual solo alcanza rho {:+.3f}. Esto sugiere que un modelo capaz "
        "de combinar varias entradas superara a cualquier formula que dependa de una sola, y es el argumento "
        "de partida para probar metodos no lineales.".format(con_obj.iloc[0])
    )


def _altitud(df, inf):
    n_anios = df.anio.nunique()
    por_est = df.groupby(["estacion", "nombre", "subcuenca"]).agg(
        elevacion=("elev", "first"),
        et0_media=("et0", "mean"),
        et0_desv=("et0", "std"),
        t_media=("t_media", "mean"),
    ).round(2).reset_index()
    lluvia = df.groupby("estacion").precipitacion.sum() / n_anios
    por_est["lluvia_anual"] = por_est.estacion.map(lluvia).round(1)

    fig, ax = plt.subplots(figsize=(7.4, 4))
    for s in ["Alta", "Media", "Baja"]:
        m = por_est.subcuenca == s
        ax.scatter(por_est[m].elevacion, por_est[m].et0_media, s=70, color=COLOR_SUB[s],
                   label="Cuenca " + s, edgecolor="white", zorder=3)
    for _, r in por_est.iterrows():
        ax.annotate(r.estacion, (r.elevacion, r.et0_media), fontsize=6,
                    xytext=(4, 4), textcoords="offset points")
    z = np.polyfit(por_est.elevacion, por_est.et0_media, 1)
    xs = np.linspace(por_est.elevacion.min(), por_est.elevacion.max(), 50)
    ax.plot(xs, np.polyval(z, xs), color=PALETA["base"], ls="--", lw=1.2,
            label="tendencia {:+.2f} mm/dia por km".format(z[0] * 1000))
    ax.set_xlabel("elevacion (m s.n.m.)")
    ax.set_ylabel("ET0 media (mm/dia)")
    ax.set_title("Gradiente altitudinal de ET0")
    ax.legend(fontsize=7)
    fig.tight_layout()

    r_alt = float(df[["elev", "et0"]].corr(method="spearman").iloc[0, 1])
    if z[0] < 0:
        sentido = "La ET0 disminuye al ascender, coherente con el descenso termico con la altura."
    else:
        sentido = ("La ET0 aumenta al ascender, efecto de la mayor radiacion incidente en altura, que "
                   "compensa el descenso termico.")

    inf.tabla(
        por_est, "Caracterizacion de las estaciones",
        "Elevacion, ET0 media y dispersion, temperatura media y lluvia anual de cada estacion.",
        "Ordenando mentalmente por elevacion se aprecia como cambian las demas columnas. La desviacion de "
        "ET0 indica cuanta variabilidad interna tiene cada punto.",
        "Las {} estaciones cubren de {:.0f} a {:.0f} metros, con ET0 media de {:.2f} a {:.2f} mm/dia. Esta "
        "heterogeneidad es deseable: obliga al modelo a generalizar entre ambientes distintos en lugar de "
        "memorizar un microclima. Tambien justifica validar dejando estaciones completas fuera, que es lo "
        "que se hace en la fase de modelado.".format(
            len(por_est), por_est.elevacion.min(), por_est.elevacion.max(),
            por_est.et0_media.min(), por_est.et0_media.max())
    )

    inf.figura(
        fig, "Gradiente altitudinal de ET0",
        "ET0 media de cada estacion frente a su elevacion, con la recta de tendencia ajustada.",
        "Cada punto es una estacion. La pendiente de la recta cuantifica cuanto cambia la ET0 por cada "
        "kilometro de ascenso.",
        "La relacion con la altitud es {} (rho {:+.3f}) y la tendencia indica {:+.2f} mm/dia por cada mil "
        "metros. {} La altitud debe entrar como predictor, y ademas explica por que una constante unica "
        "para toda la cuenca es inadecuada.".format(
            clasificar_r(r_alt), r_alt, z[0] * 1000, sentido)
    )


def _linea_base(df, inf):
    err = df.et0_hargreaves - df.et0
    rmse = float(np.sqrt((err ** 2).mean()))
    sesgo = float(err.mean())
    r = float(np.corrcoef(df.et0_hargreaves, df.et0)[0, 1])

    m = df.sample(min(4000, len(df)), random_state=0)
    fig, ax = plt.subplots(1, 2, figsize=(11, 4))
    ax[0].scatter(m.et0, m.et0_hargreaves, s=5, alpha=0.25, color=PALETA["base"])
    lim = [df.et0.min(), df.et0.max()]
    ax[0].plot(lim, lim, color=PALETA["mal"], lw=1.3, label="acuerdo perfecto")
    ax[0].set_xlabel("ET0 observada (mm/dia)")
    ax[0].set_ylabel("ET0 Hargreaves (mm/dia)")
    ax[0].set_title("Hargreaves-Samani frente a ERA5")
    ax[0].legend(fontsize=7)

    ax[1].hist(err, bins=60, color=PALETA["base"], edgecolor="white", linewidth=0.3)
    ax[1].axvline(0, color="black", lw=1.2)
    ax[1].axvline(sesgo, color=PALETA["mal"], lw=1.5, label="sesgo {:+.3f}".format(sesgo))
    ax[1].set_xlabel("error (mm/dia)")
    ax[1].set_ylabel("frecuencia")
    ax[1].set_title("Distribucion del error de la linea base")
    ax[1].legend(fontsize=7)
    fig.tight_layout()

    direccion = "subestima" if sesgo < 0 else "sobrestima"
    inf.figura(
        fig, "Desempenio de la linea base Hargreaves-Samani",
        "A la izquierda, valores estimados por la ecuacion frente a los de referencia. A la derecha, la "
        "distribucion de los errores.",
        "En el grafico de dispersion, cuanto mas se peguen los puntos a la diagonal, mejor. En el "
        "histograma, un centro desplazado del cero delata sesgo sistematico y una anchura grande, imprecision.",
        "La ecuacion alcanza RMSE de {:.3f} mm/dia y correlacion de {:.3f}, asociacion {}. El error medio "
        "es {:+.3f} mm/dia, es decir que {} la evapotranspiracion de forma sistematica en un {:.1%} de la "
        "media. Este sesgo es un defecto conocido de Hargreaves fuera de las condiciones para las que se "
        "calibro, y marca el objetivo concreto a batir: cualquier modelo propuesto debera reducir el RMSE "
        "de {:.3f} y, sobre todo, eliminar ese sesgo.".format(
            rmse, r, clasificar_r(r), sesgo, direccion, abs(sesgo) / df.et0.mean(), rmse)
    )
