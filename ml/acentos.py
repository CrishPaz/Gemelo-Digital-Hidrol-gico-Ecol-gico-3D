"""
acentos.py - Restitucion de tildes en los textos de salida.

Los modulos del motor se escriben sin tildes para que el codigo fuente sea ASCII
puro y no dependa de la codificacion del terminal, que en Windows varia. Pero la
tesis se redacta en espanol y el informe debe leerse correctamente, asi que la
acentuacion se aplica **al volcar el texto**, nunca al fuente.

Hacerlo en tiempo de ejecucion es lo que lo vuelve seguro: la funcion solo
transforma cadenas que ya son prosa. Una sustitucion sobre los archivos .py
renombraria identificadores como `metricas` o el modulo `preparacion`, y el
programa dejaria de arrancar.

No se aplica al contenido de las tablas, que refleja nombres de columna y debe
coincidir con los CSV exportados.
"""

from __future__ import annotations

import re

# Palabras inequivocas. Al operar solo sobre prosa, no hay riesgo de colision
# con identificadores del programa.
_PALABRAS = {
    "comprension": "comprensión", "hidrologico": "hidrológico", "hidrologica": "hidrológica",
    "evapotranspiracion": "evapotranspiración", "dia": "día", "dias": "días",
    "maxima": "máxima", "maximo": "máximo", "maximos": "máximos", "maximas": "máximas",
    "minima": "mínima", "minimo": "mínimo", "minimos": "mínimos", "exito": "éxito",
    "estadisticamente": "estadísticamente", "estadistico": "estadístico",
    "estadisticos": "estadísticos", "estadistica": "estadística", "estadisticas": "estadísticas",
    "ecuacion": "ecuación", "metodo": "método", "metodos": "métodos", "practica": "práctica",
    "reanalisis": "reanálisis", "publica": "pública", "numero": "número", "numeros": "números",
    "fisicos": "físicos", "fisica": "física", "fisicamente": "físicamente", "fisico": "físico",
    "metrica": "métrica", "metricas": "métricas", "asimetria": "asimetría",
    "asimetrica": "asimétrica", "desviacion": "desviación", "variacion": "variación",
    "distribucion": "distribución", "distribuciones": "distribuciones",
    "simetrica": "simétrica", "explicacion": "explicación", "interpretacion": "interpretación",
    "tambien": "también", "ademas": "además", "aqui": "aquí", "asi": "así", "segun": "según",
    "ultimo": "último", "ultima": "última", "ultimas": "últimas", "ultimos": "últimos",
    "unico": "único", "unica": "única", "especifico": "específico", "analisis": "análisis",
    "parametros": "parámetros", "parametro": "parámetro", "hiperparametros": "hiperparámetros",
    "validacion": "validación", "particion": "partición", "informacion": "información",
    "conclusion": "conclusión", "prediccion": "predicción", "correccion": "corrección",
    "comparacion": "comparación", "autocorrelacion": "autocorrelación",
    "autocorrelacionados": "autocorrelacionados", "tipico": "típico", "tipica": "típica",
    "aplicacion": "aplicación", "asociacion": "asociación", "relacion": "relación",
    "posicion": "posición", "version": "versión", "configuracion": "configuración",
    "seleccion": "selección", "evaluacion": "evaluación", "preparacion": "preparación",
    "generalizacion": "generalización", "integracion": "integración",
    "instrumentacion": "instrumentación", "remediacion": "remediación",
    "dosificacion": "dosificación", "atenuacion": "atenuación", "dilucion": "dilución",
    "asignacion": "asignación", "operacion": "operación", "operativas": "operativas",
    "categoria": "categoría", "categorias": "categorías", "geometria": "geometría",
    "climatico": "climático", "semiarido": "semiárido", "area": "área", "areas": "áreas",
    "deberia": "debería", "deberian": "deberían", "seria": "sería", "serian": "serían",
    "habria": "habría", "podria": "podría", "haria": "haría", "tendria": "tendría",
    "serviria": "serviría", "volveria": "volvería", "quedaria": "quedaría",
    "pondria": "pondría", "partiria": "partiría", "devolveria": "devolvería",
    "filtraria": "filtraría", "colocaria": "colocaría", "exigiria": "exigiría",
    "significaria": "significaría", "tardo": "tardó", "linea": "línea", "lineas": "líneas",
    "monotona": "monótona", "proposito": "propósito", "automatico": "automático",
    "pequenio": "pequeño", "pequenia": "pequeña", "tamanio": "tamaño",
    "desempenio": "desempeño", "grafico": "gráfico", "graficos": "gráficos",
    "diagnostico": "diagnóstico", "practicamente": "prácticamente", "basicas": "básicas",
    "optimo": "óptimo", "indice": "índice", "indices": "índices", "limite": "límite",
    "limites": "límites", "valido": "válido", "validos": "válidos", "atipicos": "atípicos",
    "sintesis": "síntesis", "caracterizacion": "caracterización", "hipotesis": "hipótesis",
    "parametrico": "paramétrico", "inflacion": "inflación", "perdida": "pérdida",
    "cuadratica": "cuadrática", "bateria": "batería", "cuales": "cuáles",
    "mayoria": "mayoría", "senal": "señal", "anio": "año", "anios": "años",
    "evalua": "evalúa", "continuo": "continuo", "util": "útil", "utiles": "útiles",
    "elegira": "elegirá", "declarara": "declarará", "recien": "recién",
    "cuanta": "cuánta", "estan": "están", "meteorologicos": "meteorológicos",
    "metodologicas": "metodológicas", "aleatoria": "aleatoria", "calibro": "calibró",
    "ingenuo": "ingenuo", "proximas": "próximas", "espanol": "español",
}

_FRASES = [
    (r"\bmm/dia\b", "mm/día"),
    (r"\bmas\b(?=\s+(?:que|de|bajo|alto|valiosa|relevante|estrechos|anchos|informativas|proximas|barato|corta|cercanas|potente|util|alla))",
     "más"),
    (r"\blo mas\b", "lo más"),
    (r"\bque problema\b", "qué problema"),
    (r"\bcon que criterio\b", "con qué criterio"),
    (r"\bque motores\b", "qué motores"),
    (r"\bde que todos\b", "de que todos"),
    (r"\bse ejecuto\b", "se ejecutó"),
    (r"\bse eligio\b", "se eligió"),
    (r"\bno covaria\b", "no covaría"),
    (r"\bsi covaria\b", "sí covaría"),
    (r"\bque si altera\b", "que sí altera"),
    (r"\bsi mide\b", "sí mide"),
    (r"\bpor que cada\b", "por qué cada"),
]

_RE_PALABRAS = {
    sin: re.compile(r"\b" + sin + r"\b", re.IGNORECASE) for sin in _PALABRAS
}


def _como_original(original: str, nueva: str) -> str:
    return nueva[:1].upper() + nueva[1:] if original[:1].isupper() else nueva


def acentuar(texto: str) -> str:
    """Devuelve el texto con las tildes restituidas. Idempotente."""
    if not texto:
        return texto

    for patron, reemplazo in _FRASES:
        texto = re.sub(patron, reemplazo, texto)

    for sin, rx in _RE_PALABRAS.items():
        con = _PALABRAS[sin]
        texto = rx.sub(lambda m, c=con: _como_original(m.group(0), c), texto)

    return texto
