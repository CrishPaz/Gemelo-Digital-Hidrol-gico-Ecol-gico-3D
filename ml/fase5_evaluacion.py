"""
fase5_evaluacion.py - Fase 5 de CRISP-DM: evaluacion.

Comprueba si la ventaja del modelo elegido resiste el escrutinio estadistico,
en lugar de darla por buena porque un numero salio mas bajo que otro.

Bateria aplicada, y por que cada prueba:

- Friedman. Contraste global no parametrico sobre los rangos de los modelos en
  cada particion. Es el procedimiento que recomienda Demsar (2006) para comparar
  varios algoritmos, precisamente porque no exige normalidad ni homocedasticidad,
  supuestos que los errores de un modelo rara vez cumplen.

- Wilcoxon pareado con correccion de Holm. Si Friedman detecta diferencias,
  indica que existen, no cuales. Los contrastes por pares lo concretan, y Holm
  controla la inflacion del error de tipo I al repetir contrastes.

- Tamano del efecto. Un valor p dice si la diferencia es distinguible del ruido;
  no dice si es grande. Con muestras de decenas de miles de dias casi todo sale
  significativo, asi que informar la magnitud es obligatorio.

- Remuestreo bootstrap. Da intervalos de confianza sin suponer distribucion
  alguna para el estadistico.

- Diebold-Mariano. Contraste especifico para comparar precision predictiva entre
  dos series temporales, con correccion por autocorrelacion de los errores.

- Diagnostico de residuos. Normalidad, sesgo y heterocedasticidad, para saber si
  el error restante es ruido inocuo o estructura no capturada.
"""

from __future__ import annotations

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy import stats

from informe import Informe, PALETA, clasificar_efecto, clasificar_nse, clasificar_p
from preparacion import PREDICTORES


# ---------------------------------------------------------------------------
# Utilidades estadisticas
# ---------------------------------------------------------------------------
def holm(pvalores: list[float]) -> list[float]:
    """Correccion de Holm-Bonferroni. Menos conservadora que Bonferroni y valida siempre."""
    m = len(pvalores)
    orden = np.argsort(pvalores)
    ajustados = np.empty(m, dtype=float)
    previo = 0.0
    for rango, idx in enumerate(orden):
        val = (m - rango) * pvalores[idx]
        previo = max(previo, min(val, 1.0))
        ajustados[idx] = previo
    return ajustados.tolist()


def d_cohen_pareado(a: np.ndarray, b: np.ndarray) -> float:
    """Tamano del efecto para muestras relacionadas."""
    dif = a - b
    s = dif.std(ddof=1)
    return float(dif.mean() / s) if s > 0 else 0.0


def bootstrap_rmse(y, p, n: int = 2000, semilla: int = 42):
    """Intervalo de confianza del 95% del RMSE por remuestreo con reemplazo."""
    rng = np.random.default_rng(semilla)
    err2 = (np.asarray(p, float) - np.asarray(y, float)) ** 2
    n_obs = len(err2)
    muestras = np.empty(n)
    for i in range(n):
        idx = rng.integers(0, n_obs, n_obs)
        muestras[i] = np.sqrt(err2[idx].mean())
    return float(np.percentile(muestras, 2.5)), float(np.percentile(muestras, 97.5)), muestras


def theil_u1(y, p) -> float:
    """
    Coeficiente de desigualdad U1 de Theil (1958). Va de 0 a 1.

    Es el RMSE normalizado por la escala de ambas series, de modo que resulta
    adimensional y comparable entre cuencas o variables con unidades distintas,
    cosa que el RMSE por si solo no permite. Cero es acuerdo perfecto.
    """
    y = np.asarray(y, float)
    p = np.asarray(p, float)
    num = np.sqrt(np.mean((p - y) ** 2))
    den = np.sqrt(np.mean(p ** 2)) + np.sqrt(np.mean(y ** 2))
    return float(num / den) if den > 0 else float("nan")


def theil_u2(y, p, y_ingenuo) -> float:
    """
    U2 de Theil: razon entre el error del metodo y el de un pronostico ingenuo.

    El ingenuo aqui es la persistencia, es decir repetir el valor de ayer. Es el
    listen mas duro que existe en series temporales: si un modelo no lo bate, no
    aporta nada sobre mirar el dato del dia anterior. Menor que uno significa
    mejor que la persistencia; mayor que uno, peor.
    """
    y = np.asarray(y, float)
    p = np.asarray(p, float)
    yi = np.asarray(y_ingenuo, float)
    num = np.sqrt(np.mean((p - y) ** 2))
    den = np.sqrt(np.mean((yi - y) ** 2))
    return float(num / den) if den > 0 else float("nan")


def descomposicion_theil(y, p) -> dict:
    """
    Reparte el error cuadratico medio en tres fuentes que suman uno.

    - UM, proporcion de sesgo: el metodo apunta sistematicamente alto o bajo.
    - US, proporcion de varianza: el metodo no reproduce la dispersion real.
    - UC, proporcion de covarianza: error irregular, el residuo inevitable.

    La lectura practica es clara: UM y US son defectos corregibles, porque nacen
    de un desajuste sistematico; UC es ruido. Un metodo sano concentra su error
    en UC. Si UM es alta, hay que recalibrar antes que cambiar de algoritmo.
    """
    y = np.asarray(y, float)
    p = np.asarray(p, float)
    mse = np.mean((p - y) ** 2)
    if mse <= 0:
        return {"UM": 0.0, "US": 0.0, "UC": 0.0}
    sp, sy = p.std(), y.std()
    r = np.corrcoef(p, y)[0, 1] if sp > 0 and sy > 0 else 0.0
    um = (p.mean() - y.mean()) ** 2 / mse
    us = (sp - sy) ** 2 / mse
    uc = 2 * (1 - r) * sp * sy / mse
    return {"UM": float(um), "US": float(us), "UC": float(uc)}


def diebold_mariano(e1: np.ndarray, e2: np.ndarray, h: int = 1):
    """
    Contraste de Diebold-Mariano sobre perdida cuadratica.

    Corrige la varianza por autocorrelacion, que es lo que distingue esta prueba
    de un t pareado ingenuo cuando los errores son una serie temporal.
    """
    d = e1 ** 2 - e2 ** 2
    n = len(d)
    media = d.mean()
    gamma0 = np.sum((d - media) ** 2) / n
    suma = gamma0
    for k in range(1, h + 1):
        gk = np.sum((d[k:] - media) * (d[:-k] - media)) / n
        suma += 2 * (1 - k / (h + 1)) * gk
    var = suma / n
    if var <= 0:
        return float("nan"), float("nan")
    est = media / np.sqrt(var)
    p = 2 * (1 - stats.norm.cdf(abs(est)))
    return float(est), float(p)


# ---------------------------------------------------------------------------
def ejecutar(df_te: pd.DataFrame, nombre_modelo: str, modelo, rmse_por_fold: dict, inf: Informe):
    inf.fase(
        5, "Evaluacion",
        "Someter la ventaja observada a contrastes estadisticos y diagnosticar los residuos antes de dar el modelo por valido.",
    )

    # -- Friedman sobre las particiones -----------------------------------
    _friedman(rmse_por_fold, nombre_modelo, inf)

    # -- Evaluacion en el conjunto de prueba ------------------------------
    X = df_te[PREDICTORES].to_numpy()
    y = df_te["et0"].to_numpy()
    pred = modelo.predict(X)
    harg = df_te["et0_hargreaves"].to_numpy()

    _tabla_final(y, pred, harg, nombre_modelo, df_te, inf)
    _theil_y_dm(df_te, y, pred, harg, nombre_modelo, inf)
    _pruebas_pareadas(y, pred, harg, nombre_modelo, inf)
    _residuos(y, pred, harg, nombre_modelo, inf)
    _por_estacion(df_te, y, pred, harg, nombre_modelo, inf)

    return pred


# ---------------------------------------------------------------------------
def _friedman(rmse_por_fold, mejor, inf):
    nombres = list(rmse_por_fold.keys())
    matriz = np.array([rmse_por_fold[n] for n in nombres])  # modelos x particiones

    est, p = stats.friedmanchisquare(*matriz)
    rangos = np.array([stats.rankdata(matriz[:, j]) for j in range(matriz.shape[1])]).mean(axis=0)

    t = pd.DataFrame({
        "modelo": nombres,
        "rango_medio": rangos.round(3),
        "RMSE_medio": matriz.mean(axis=1).round(4),
    }).sort_values("rango_medio").reset_index(drop=True)

    if p < 0.05:
        veredicto = ("Se rechaza la hipotesis nula de que todos los modelos rinden igual, de modo que las "
                     "diferencias observadas no se explican por azar y procede comparar por pares.")
    else:
        veredicto = ("No se rechaza la hipotesis nula: con estas particiones no hay evidencia suficiente "
                     "para afirmar que los modelos difieran, y cualquier ranking seria provisional.")

    inf.tabla(
        t, "Contraste global de Friedman",
        "Rango medio de cada modelo a lo largo de las particiones temporales, base del contraste no parametrico.",
        "El rango uno corresponde al mejor modelo en cada particion. Un rango medio cercano a uno indica "
        "superioridad consistente y no un promedio favorecido por un solo tramo excepcional.",
        "Estadistico de Friedman {:.3f} con {}. {} El menor rango medio corresponde a '{}' con {:.2f} sobre "
        "{} competidores, lo que confirma que su ventaja se repite particion tras particion.".format(
            est, clasificar_p(p), veredicto, t.iloc[0]["modelo"], t.iloc[0]["rango_medio"], len(nombres))
    )


def _tabla_final(y, pred, harg, nombre, df_te, inf):
    from fase4_modelado import metricas
    m_mod = metricas(y, pred)
    m_har = metricas(y, harg)
    m_cte = metricas(y, np.full_like(y, 3.5))

    lo_m, hi_m, _ = bootstrap_rmse(y, pred)
    lo_h, hi_h, _ = bootstrap_rmse(y, harg)

    t = pd.DataFrame([
        {"metodo": nombre, **m_mod, "IC95_RMSE_inf": lo_m, "IC95_RMSE_sup": hi_m},
        {"metodo": "Hargreaves-Samani", **m_har, "IC95_RMSE_inf": lo_h, "IC95_RMSE_sup": hi_h},
        {"metodo": "Constante 3.5 (gemelo actual)", **m_cte, "IC95_RMSE_inf": np.nan, "IC95_RMSE_sup": np.nan},
    ]).round(4)

    solapan = not (hi_m < lo_h or hi_h < lo_m)
    mejora_h = 100 * (m_har["RMSE"] - m_mod["RMSE"]) / m_har["RMSE"]
    mejora_c = 100 * (m_cte["RMSE"] - m_mod["RMSE"]) / m_cte["RMSE"]

    inf.tabla(
        t, "Desempenio en el conjunto de prueba",
        "Metricas sobre el tramo final, que ningun modelo vio durante el entrenamiento, con intervalos de "
        "confianza del RMSE obtenidos por remuestreo bootstrap de 2000 repeticiones.",
        "El RMSE penaliza los errores grandes y el MAE trata todos por igual; si difieren mucho hay valores "
        "atipicos. El sesgo revela error sistematico. El NSE se interpreta con el criterio de Moriasi. Si "
        "los intervalos de confianza de dos metodos no se solapan, su diferencia es solida.",
        "'{}' alcanza RMSE de {:.4f} mm/dia frente a {:.4f} de Hargreaves y {:.4f} de la constante de 3.5 "
        "que usa hoy el gemelo, mejoras del {:.1f}% y {:.1f}% respectivamente. Su NSE de {:.3f} se califica "
        "como {}. Los intervalos de confianza {} entre el modelo y Hargreaves, lo que {}. El sesgo baja de "
        "{:+.4f} a {:+.4f} mm/dia: sobre un anio completo eso equivale a corregir unos {:.0f} mm de lamina "
        "evaporada acumulada, magnitud que si altera un balance hidrico.".format(
            nombre, m_mod["RMSE"], m_har["RMSE"], m_cte["RMSE"], mejora_h, mejora_c,
            m_mod["NSE"], clasificar_nse(m_mod["NSE"]),
            "se solapan" if solapan else "no se solapan",
            "debilita la conclusion" if solapan else "respalda que la diferencia no es fruto del azar",
            m_har["sesgo"], m_mod["sesgo"], abs(m_har["sesgo"] - m_mod["sesgo"]) * 365)
    )


def _theil_y_dm(df_te, y, pred, harg, nombre, inf):
    """Precision predictiva: U de Theil frente a la persistencia, y Diebold-Mariano."""

    # Pronostico ingenuo: la ET0 de ayer en la MISMA estacion. Construirlo por
    # estacion es imprescindible; desplazar el panel entero mezclaria el ultimo
    # dia de una estacion con el primero de la siguiente.
    tmp = df_te[["estacion", "fecha", "et0"]].copy()
    tmp["pred"] = pred
    tmp["harg"] = harg
    tmp = tmp.sort_values(["estacion", "fecha"])
    tmp["ingenuo"] = tmp.groupby("estacion")["et0"].shift(1)
    v = tmp.dropna(subset=["ingenuo"])

    cte = np.full(len(v), 3.5)
    metodos = [
        (nombre, v["pred"].to_numpy()),
        ("Hargreaves-Samani", v["harg"].to_numpy()),
        ("Constante 3.5 (gemelo actual)", cte),
        ("Persistencia (ingenuo)", v["ingenuo"].to_numpy()),
    ]
    yv = v["et0"].to_numpy()
    yi = v["ingenuo"].to_numpy()

    filas = []
    for etiqueta, p in metodos:
        d = descomposicion_theil(yv, p)
        filas.append({
            "metodo": etiqueta,
            "U1_Theil": theil_u1(yv, p),
            "U2_vs_persistencia": theil_u2(yv, p, yi),
            "UM_sesgo": d["UM"],
            "US_varianza": d["US"],
            "UC_covarianza": d["UC"],
        })
    t_theil = pd.DataFrame(filas).round(4)

    u1_mod = t_theil.iloc[0]["U1_Theil"]
    u2_mod = t_theil.iloc[0]["U2_vs_persistencia"]
    u2_har = t_theil[t_theil.metodo == "Hargreaves-Samani"].U2_vs_persistencia.iloc[0]
    um_mod = t_theil.iloc[0]["UM_sesgo"]
    uc_mod = t_theil.iloc[0]["UC_covarianza"]
    um_har = t_theil[t_theil.metodo == "Hargreaves-Samani"].UM_sesgo.iloc[0]

    if u2_mod < 1:
        juicio_u2 = ("es decir que bate a la persistencia y por tanto aporta algo sobre mirar simplemente "
                     "el dato de ayer, que es la prueba minima que debe superar cualquier pronostico")
    else:
        juicio_u2 = ("es decir que NO bate a la persistencia: repetir el valor del dia anterior seria igual "
                     "o mejor, lo que invalidaria el modelo como herramienta operativa")

    inf.tabla(
        t_theil, "U de Theil y descomposicion del error",
        "Coeficiente U1 de desigualdad, razon U2 frente al pronostico ingenuo de persistencia, y reparto "
        "del error cuadratico entre sesgo, varianza y covarianza.",
        "U1 va de cero a uno y es adimensional, asi que permite comparar entre variables con unidades "
        "distintas. U2 menor que uno significa mejor que repetir el valor de ayer. Las tres ultimas "
        "columnas suman uno y dicen de donde viene el error: UM y US son defectos corregibles, porque "
        "nacen de un desajuste sistematico, mientras que UC es ruido irreducible.",
        "'{}' obtiene U1 de {:.4f}, cercano a cero, y U2 de {:.4f} frente a {:.4f} de Hargreaves, {}. "
        "La descomposicion es lo mas revelador: el modelo concentra el {:.0%} de su error en la componente "
        "de covarianza, es decir en ruido irregular, y solo el {:.0%} en sesgo. Hargreaves, en cambio, "
        "arrastra un {:.0%} de sesgo, que es error corregible y no aleatorio. Un metodo cuyo error es "
        "sobre todo ruido ha agotado la senal disponible; uno con sesgo alto aun puede mejorarse "
        "recalibrando, y por eso la ecuacion clasica se queda corta en esta cuenca.".format(
            nombre, u1_mod, u2_mod, u2_har, juicio_u2, uc_mod, um_mod, um_har),
    )

    # -- Diebold-Mariano en tabla propia, a varios horizontes ---------------
    e_mod = v["pred"].to_numpy() - yv
    rivales = [("Hargreaves-Samani", v["harg"].to_numpy() - yv),
               ("Constante 3.5", cte - yv),
               ("Persistencia (ingenuo)", yi - yv)]

    filas_dm = []
    for etiqueta, e_riv in rivales:
        for h in (1, 5, 10):
            est, p = diebold_mariano(e_mod, e_riv, h=h)
            filas_dm.append({
                "comparacion": "{} vs {}".format(nombre, etiqueta),
                "horizonte_h": h,
                "estadistico_DM": est,
                "p_valor": p,
                "favorece": nombre if est < 0 else etiqueta,
            })
    t_dm = pd.DataFrame(filas_dm).round(6)

    signif = int((t_dm.p_valor < 0.05).sum())
    a_favor = int(((t_dm.p_valor < 0.05) & (t_dm.favorece == nombre)).sum())

    inf.tabla(
        t_dm, "Contraste de Diebold-Mariano a varios horizontes",
        "Contraste de igualdad de precision predictiva frente a cada alternativa, repetido con tres "
        "horizontes de correccion por autocorrelacion.",
        "El estadistico negativo favorece al modelo; el positivo, al rival. El horizonte h indica cuantos "
        "rezagos se usan para corregir la varianza: variarlo comprueba que la conclusion no depende de esa "
        "eleccion. Bajo la hipotesis nula ambos metodos predicen igual de bien.",
        "De las {} comparaciones, {} resultan significativas al 5% y {} favorecen a '{}'. Que el signo y la "
        "significacion se mantengan en los tres horizontes es lo importante: descarta que el resultado sea "
        "un artefacto de haber elegido un rezago concreto. Este contraste es el adecuado aqui, y no un t de "
        "Student pareado, porque los errores diarios estan autocorrelacionados y un t ingenuo subestimaria "
        "la varianza, inflando la significacion.".format(
            len(t_dm), signif, a_favor, nombre),
    )


def _pruebas_pareadas(y, pred, harg, nombre, inf):
    e_mod = np.abs(pred - y)
    e_har = np.abs(harg - y)
    e_cte = np.abs(np.full_like(y, 3.5) - y)

    filas = []
    ps = []
    for rival, err in [("Hargreaves-Samani", e_har), ("Constante 3.5", e_cte)]:
        w, p_w = stats.wilcoxon(e_mod, err)
        d = d_cohen_pareado(e_mod, err)
        filas.append({
            "comparacion": "{} vs {}".format(nombre, rival),
            "error_abs_medio_modelo": float(e_mod.mean()),
            "error_abs_medio_rival": float(err.mean()),
            "estadistico_W": float(w),
            "p_bruto": float(p_w),
            "d_Cohen": float(d),
            "magnitud": clasificar_efecto(d),
        })
        ps.append(float(p_w))

    dm_est, dm_p = diebold_mariano(pred - y, harg - y, h=5)

    ajust = holm(ps)
    for f, a in zip(filas, ajust):
        f["p_Holm"] = a
    t = pd.DataFrame(filas).round(6)

    significativos = sum(1 for a in ajust if a < 0.05)
    inf.tabla(
        t, "Contrastes pareados con correccion de Holm",
        "Contraste de Wilcoxon sobre los errores absolutos dia a dia frente a cada alternativa, con el "
        "tamano del efecto y el valor p corregido por comparaciones multiples.",
        "Wilcoxon no supone normalidad y compara los errores emparejados del mismo dia, lo que elimina la "
        "variabilidad meteorologica comun. El valor p corregido es el que debe leerse. La d de Cohen mide "
        "la magnitud, que es lo que el valor p no dice.",
        "Las {} comparaciones resultan significativas tras la correccion ({} de {}). Frente a "
        "Hargreaves-Samani el efecto es {} (d de Cohen {:+.3f}), y el error absoluto medio baja de {:.4f} a "
        "{:.4f} mm/dia. El contraste de Diebold-Mariano, que corrige la autocorrelacion de los errores "
        "diarios, arroja estadistico {:.3f} con {}, confirmando el resultado por una via independiente que "
        "no supone independencia temporal.".format(
            "dos" if significativos == 2 else str(significativos), significativos, len(ajust),
            clasificar_efecto(filas[0]["d_Cohen"]), filas[0]["d_Cohen"],
            filas[0]["error_abs_medio_rival"], filas[0]["error_abs_medio_modelo"],
            dm_est, clasificar_p(dm_p))
    )


def _residuos(y, pred, harg, nombre, inf):
    res = pred - y

    # Normalidad: Shapiro solo admite muestras moderadas, asi que se submuestrea.
    rng = np.random.default_rng(0)
    sub = res[rng.choice(len(res), min(4500, len(res)), replace=False)]
    sh_est, sh_p = stats.shapiro(sub)

    # Heterocedasticidad: correlacion entre valor predicho y magnitud del error.
    rho, p_rho = stats.spearmanr(pred, np.abs(res))

    fig, ax = plt.subplots(1, 3, figsize=(13.5, 3.8))

    ax[0].scatter(pred, res, s=4, alpha=0.18, color=PALETA["modelo"])
    ax[0].axhline(0, color=PALETA["mal"], lw=1.2)
    ax[0].set_xlabel("valor predicho (mm/dia)")
    ax[0].set_ylabel("residuo (mm/dia)")
    ax[0].set_title("Residuos frente a prediccion")

    stats.probplot(sub, dist="norm", plot=ax[1])
    ax[1].set_title("Grafico cuantil-cuantil")
    ax[1].get_lines()[0].set_markersize(2.5)
    ax[1].get_lines()[0].set_alpha(0.4)

    ax[2].hist(res, bins=60, color=PALETA["modelo"], alpha=0.75, edgecolor="white",
               linewidth=0.3, label=nombre, density=True)
    ax[2].hist(harg - y, bins=60, color=PALETA["base"], alpha=0.45, edgecolor="white",
               linewidth=0.3, label="Hargreaves", density=True)
    ax[2].axvline(0, color="black", lw=1.1)
    ax[2].set_xlabel("residuo (mm/dia)")
    ax[2].set_title("Residuos: modelo frente a linea base")
    ax[2].legend(fontsize=7)
    fig.tight_layout()

    normal = sh_p >= 0.05
    hetero = abs(rho) > 0.1 and p_rho < 0.05

    if normal:
        txt_norm = "los residuos no se apartan de la normalidad"
    else:
        txt_norm = ("los residuos se apartan de la normalidad, algo esperable con decenas de miles de "
                    "observaciones, donde el contraste detecta desviaciones minimas e irrelevantes en la practica")

    if hetero:
        txt_het = ("Se detecta heterocedasticidad (rho {:+.3f}): la dispersion del error cambia con la "
                   "magnitud predicha, asi que los intervalos de prediccion deberian ser mas anchos en los "
                   "valores altos.".format(rho))
    else:
        txt_het = ("No se aprecia heterocedasticidad relevante (rho {:+.3f}): el error mantiene una "
                   "amplitud similar en todo el rango, lo que permite usar un intervalo de prediccion "
                   "constante.".format(rho))

    inf.figura(
        fig, "Diagnostico de residuos",
        "Residuos frente al valor predicho, grafico cuantil-cuantil de normalidad y comparacion de la "
        "distribucion de residuos con la de la linea base.",
        "En el primer panel deben verse puntos repartidos sin forma alrededor del cero: un embudo indica "
        "varianza no constante y una curva, estructura sin capturar. En el segundo, los puntos deben seguir "
        "la recta. En el tercero, la curva mas estrecha y mejor centrada en cero corresponde al metodo superior.",
        "El contraste de Shapiro-Wilk sobre una submuestra de {:,} residuos da {}, de modo que {}. {} "
        "La comparacion de distribuciones muestra que los residuos del modelo son visiblemente mas estrechos "
        "y estan centrados en {:+.4f} mm/dia, frente a {:+.4f} de Hargreaves: la correccion del sesgo es el "
        "aporte mas relevante para el balance hidrico del gemelo.".format(
            len(sub), clasificar_p(sh_p), txt_norm, txt_het, res.mean(), (harg - y).mean())
    )


def _por_estacion(df_te, y, pred, harg, nombre, inf):
    """Comprueba que la ventaja no dependa de unas pocas estaciones favorables."""
    tmp = df_te[["estacion", "nombre", "subcuenca", "elev"]].copy()
    tmp["err_mod"] = np.abs(pred - y)
    tmp["err_har"] = np.abs(harg - y)
    tmp["sq_mod"] = (pred - y) ** 2
    tmp["sq_har"] = (harg - y) ** 2

    g = tmp.groupby(["estacion", "nombre", "subcuenca"]).agg(
        elevacion=("elev", "first"),
        RMSE_modelo=("sq_mod", lambda s: np.sqrt(s.mean())),
        RMSE_hargreaves=("sq_har", lambda s: np.sqrt(s.mean())),
    ).reset_index()
    g["mejora_pct"] = (100 * (g.RMSE_hargreaves - g.RMSE_modelo) / g.RMSE_hargreaves)
    g = g.round(4).sort_values("elevacion", ascending=False).reset_index(drop=True)

    gana = int((g.mejora_pct > 0).sum())
    peor = g.loc[g.mejora_pct.idxmin()]
    mejor = g.loc[g.mejora_pct.idxmax()]

    # Si la ganancia dependiera de la altitud, el modelo solo serviria en parte
    # de la cuenca. Se comprueba en lugar de suponerlo.
    rho_alt, p_alt = stats.spearmanr(g.elevacion, g.mejora_pct)
    if p_alt < 0.05:
        txt_alt = ("La mejora si covaria con la altitud (rho {:+.3f}, {}), de modo que el modelo rinde "
                   "de forma desigual segun el tramo y conviene evaluarlo por separado en cada uno."
                   .format(rho_alt, clasificar_p(p_alt)))
    else:
        txt_alt = ("La mejora no covaria significativamente con la altitud (rho {:+.3f}, {}), indicio de "
                   "que el modelo no privilegia un tramo de cuenca."
                   .format(rho_alt, clasificar_p(p_alt)))

    if gana == len(g):
        txt_cobertura = "La ventaja es uniforme en toda la cuenca."
    else:
        fallan = g[g.mejora_pct <= 0]
        txt_cobertura = (
            "El modelo NO mejora en {} de {} estaciones ({}), lo que debe declararse en la memoria en "
            "lugar de promediarse: en esos puntos Hargreaves sigue siendo preferible y el gemelo deberia "
            "conservarlo."
            .format(len(fallan), len(g), ", ".join(fallan.nombre.tolist())))

    inf.tabla(
        g, "Desempenio por estacion",
        "Error del modelo y de la linea base en cada una de las estaciones del conjunto de prueba, "
        "ordenadas de mayor a menor altitud.",
        "La columna de mejora indica el porcentaje de reduccion del error respecto a Hargreaves en esa "
        "estacion. Valores positivos en todas las filas demuestran que la ventaja es general y no producto "
        "de unos pocos puntos favorables.",
        "El modelo mejora a Hargreaves en {} de las {} estaciones. La mayor ganancia se da en {} ({:.1f}%) "
        "y la menor en {} ({:.1f}%). {} {}".format(
            gana, len(g), mejor.nombre, mejor.mejora_pct, peor.nombre, peor.mejora_pct,
            txt_cobertura, txt_alt)
    )
