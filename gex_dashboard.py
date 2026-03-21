"""
╔══════════════════════════════════════════════════════════════════╗
║           AGX GEX DASHBOARD — Gamma Exposure Calculator          ║
║           AlexGonXZ Trading Community                            ║
║           Compatible con Tradier API y CSV manual                ║
╚══════════════════════════════════════════════════════════════════╝

USO:
    python gex_dashboard.py --csv option_chain.csv
    python gex_dashboard.py --csv option_chain.csv --expirations 1  # solo próxima exp
    python gex_dashboard.py --csv option_chain.csv --expirations 2  # próximas 2 exp
    python gex_dashboard.py --demo                                  # datos de ejemplo

COLUMNAS REQUERIDAS EN EL CSV:
    expiration, strike, option_type (call/put),
    open_interest, implied_volatility, underlying_price
    gamma (opcional — se calcula con Black-Scholes si no existe)
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
from scipy.stats import norm
import argparse
import warnings
import sys
from datetime import datetime, date

warnings.filterwarnings('ignore')

# ══════════════════════════════════════════════════════
# CONFIGURACIÓN GLOBAL
# ══════════════════════════════════════════════════════
CONTRACT_SIZE   = 100       # contratos de opciones estándar
RISK_FREE_RATE  = 0.05      # tasa libre de riesgo (5%)
SIMULATION_RANGE = 0.10     # ±10% para simular zero gamma
SIMULATION_STEPS = 200      # puntos de simulación

# Colores AGX style
COLOR_BG        = '#03050a'
COLOR_GREEN     = '#00e5a0'
COLOR_RED       = '#ff3d5a'
COLOR_GOLD      = '#d4a843'
COLOR_CYAN      = '#00cfff'
COLOR_SILVER    = '#c8d8f0'
COLOR_SILVER2   = '#7a9ab8'
COLOR_GRID      = '#0d1220'


# ══════════════════════════════════════════════════════
# 1. BLACK-SCHOLES — CÁLCULO DE GAMMA
# ══════════════════════════════════════════════════════

def black_scholes_gamma(S, K, T, r, sigma):
    """
    Calcula el gamma de una opción usando Black-Scholes.
    
    Args:
        S: Precio del subyacente
        K: Strike price
        T: Tiempo hasta expiración en años
        r: Tasa libre de riesgo
        sigma: Volatilidad implícita
    
    Returns:
        gamma (float) o 0 si hay error
    """
    try:
        if T <= 0 or sigma <= 0 or S <= 0 or K <= 0:
            return 0.0
        d1 = (np.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * np.sqrt(T))
        gamma = norm.pdf(d1) / (S * sigma * np.sqrt(T))
        return gamma
    except Exception:
        return 0.0


def calculate_time_to_expiry(expiration_date):
    """
    Calcula el tiempo hasta expiración en años.
    
    Args:
        expiration_date: string o datetime
    
    Returns:
        float: años hasta expiración (mínimo 1/365)
    """
    try:
        if isinstance(expiration_date, str):
            for fmt in ['%Y-%m-%d', '%m/%d/%Y', '%d/%m/%Y', '%Y%m%d']:
                try:
                    exp = datetime.strptime(expiration_date, fmt).date()
                    break
                except ValueError:
                    continue
            else:
                return 1/365
        elif hasattr(expiration_date, 'date'):
            exp = expiration_date.date()
        else:
            exp = expiration_date

        today = date.today()
        days = (exp - today).days
        return max(days / 365.0, 1/365)  # mínimo 1 día
    except Exception:
        return 1/365


# ══════════════════════════════════════════════════════
# 2. CARGA Y VALIDACIÓN DE DATOS
# ══════════════════════════════════════════════════════

def load_and_validate(filepath):
    """
    Carga el CSV y valida/normaliza las columnas.
    
    Returns:
        pd.DataFrame limpio y validado
    """
    print(f"\n📂 Cargando datos desde: {filepath}")
    df = pd.read_csv(filepath)
    
    # Normalizar nombres de columnas
    df.columns = df.columns.str.strip().str.lower().str.replace(' ', '_').str.replace('/', '_')
    
    # Mapeo de columnas alternativas
    col_map = {
        'type': 'option_type',
        'kind': 'option_type',
        'opt_type': 'option_type',
        'oi': 'open_interest',
        'iv': 'implied_volatility',
        'vol': 'implied_volatility',
        'underlying': 'underlying_price',
        'spot': 'underlying_price',
        'price': 'underlying_price',
        'exp': 'expiration',
        'expiry': 'expiration',
        'exp_date': 'expiration',
    }
    df.rename(columns=col_map, inplace=True)
    
    # Verificar columnas obligatorias
    required = ['expiration', 'strike', 'option_type', 'open_interest',
                'implied_volatility', 'underlying_price']
    missing = [c for c in required if c not in df.columns]
    if missing:
        print(f"❌ Columnas faltantes: {missing}")
        print(f"   Columnas disponibles: {list(df.columns)}")
        sys.exit(1)
    
    # Limpiar datos
    df['strike']           = pd.to_numeric(df['strike'], errors='coerce')
    df['open_interest']    = pd.to_numeric(df['open_interest'], errors='coerce').fillna(0)
    df['implied_volatility']= pd.to_numeric(df['implied_volatility'], errors='coerce').fillna(0.3)
    df['underlying_price'] = pd.to_numeric(df['underlying_price'], errors='coerce')
    df['option_type']      = df['option_type'].str.strip().str.lower()
    
    # Normalizar option_type
    df['option_type'] = df['option_type'].replace({
        'c': 'call', 'p': 'put', 'calls': 'call', 'puts': 'put'
    })
    
    # Eliminar filas con datos críticos nulos
    df.dropna(subset=['strike', 'underlying_price'], inplace=True)
    df = df[df['option_type'].isin(['call', 'put'])]
    
    # Calcular gamma si no existe
    if 'gamma' not in df.columns or df['gamma'].isna().all():
        print("   ⚙️  Calculando gamma con Black-Scholes...")
        df['tte'] = df['expiration'].apply(calculate_time_to_expiry)
        df['gamma'] = df.apply(lambda row: black_scholes_gamma(
            S=row['underlying_price'],
            K=row['strike'],
            T=row['tte'],
            r=RISK_FREE_RATE,
            sigma=max(row['implied_volatility'], 0.01)
        ), axis=1)
    else:
        df['gamma'] = pd.to_numeric(df['gamma'], errors='coerce').fillna(0)
        df['tte'] = df['expiration'].apply(calculate_time_to_expiry)
    
    print(f"   ✅ {len(df)} contratos cargados | {df['expiration'].nunique()} expiraciones")
    return df


def filter_expirations(df, n_expirations=None):
    """
    Filtra por las próximas N expiraciones.
    
    Args:
        df: DataFrame completo
        n_expirations: número de expiraciones a incluir (None = todas)
    
    Returns:
        DataFrame filtrado
    """
    if n_expirations is None:
        return df
    
    exps = sorted(df['expiration'].unique())
    selected = exps[:n_expirations]
    df_filtered = df[df['expiration'].isin(selected)]
    print(f"   🔍 Filtrando a {n_expirations} expiración(es): {selected}")
    return df_filtered


# ══════════════════════════════════════════════════════
# 3. CÁLCULO DE GEX
# ══════════════════════════════════════════════════════

def calculate_gex(df):
    """
    Calcula el GEX por contrato y agrupa por strike.
    
    GEX = gamma × OI × contract_size × (spot²) × 0.01
    Calls = positivo | Puts = negativo
    
    Returns:
        df con columna 'gex', gex_by_strike (Series)
    """
    spot = df['underlying_price'].iloc[0]
    
    # GEX por contrato
    df['gex'] = (
        df['gamma'] *
        df['open_interest'] *
        CONTRACT_SIZE *
        (spot ** 2) *
        0.01
    )
    
    # Puts son negativos (dealer es long puts = negative gamma)
    df.loc[df['option_type'] == 'put', 'gex'] *= -1
    
    # GEX agrupado por strike
    gex_by_strike = df.groupby('strike')['gex'].sum().sort_index()
    
    return df, gex_by_strike


# ══════════════════════════════════════════════════════
# 4. NIVELES CLAVE
# ══════════════════════════════════════════════════════

def find_key_levels(df, gex_by_strike, spot):
    """
    Identifica los niveles gamma más importantes.
    
    Returns:
        dict con todos los niveles clave
    """
    levels = {}
    
    # GEX total neto
    levels['net_gex'] = gex_by_strike.sum()
    
    # Strike con mayor GEX positivo (Call Wall / Gamma Wall)
    positive_gex = gex_by_strike[gex_by_strike > 0]
    levels['call_wall'] = positive_gex.idxmax() if not positive_gex.empty else None
    levels['call_wall_gex'] = positive_gex.max() if not positive_gex.empty else 0
    
    # Strike con mayor GEX negativo (Put Wall)
    negative_gex = gex_by_strike[gex_by_strike < 0]
    levels['put_wall'] = negative_gex.idxmin() if not negative_gex.empty else None
    levels['put_wall_gex'] = negative_gex.min() if not negative_gex.empty else 0
    
    # Top 5 niveles por magnitud absoluta
    levels['top5'] = gex_by_strike.abs().nlargest(5).index.tolist()
    
    # Nivel más cercano por encima del spot
    above = gex_by_strike[gex_by_strike.index > spot]
    levels['nearest_above'] = above.index.min() if not above.empty else None
    
    # Nivel más cercano por debajo del spot
    below = gex_by_strike[gex_by_strike.index < spot]
    levels['nearest_below'] = below.index.max() if not below.empty else None
    
    # Gamma flip (donde el GEX neto acumulado cambia de signo)
    levels['gamma_flip'] = find_gamma_flip(gex_by_strike, spot)
    
    return levels


def find_gamma_flip(gex_by_strike, spot):
    """
    Encuentra el nivel donde el GEX total acumulado cambia de signo
    (punto de transición gamma positivo → negativo).
    """
    # Ordenar por cercanía al spot
    sorted_strikes = gex_by_strike.sort_index()
    
    # Buscar cruce por cero
    for i in range(1, len(sorted_strikes)):
        if sorted_strikes.iloc[i-1] * sorted_strikes.iloc[i] < 0:
            # Interpolación lineal para encontrar el cruce exacto
            s1, s2 = sorted_strikes.index[i-1], sorted_strikes.index[i]
            g1, g2 = sorted_strikes.iloc[i-1], sorted_strikes.iloc[i]
            flip = s1 + (0 - g1) * (s2 - s1) / (g2 - g1)
            return round(flip, 2)
    
    # Si no hay cruce, usar el strike con GEX más cercano a cero
    return gex_by_strike.abs().idxmin()


# ══════════════════════════════════════════════════════
# 5. ZERO GAMMA — SIMULACIÓN
# ══════════════════════════════════════════════════════

def simulate_zero_gamma(df, spot):
    """
    Simula el GEX total en diferentes precios del subyacente
    para encontrar el Zero Gamma (donde GEX cruza cero).
    
    Recalcula gamma en cada precio usando Black-Scholes.
    
    Returns:
        prices (array), gex_values (array), zero_gamma (float)
    """
    price_range = np.linspace(
        spot * (1 - SIMULATION_RANGE),
        spot * (1 + SIMULATION_RANGE),
        SIMULATION_STEPS
    )
    
    gex_values = []
    
    for price in price_range:
        total_gex = 0
        for _, row in df.iterrows():
            # Recalcular gamma al nuevo precio
            g = black_scholes_gamma(
                S=price,
                K=row['strike'],
                T=row['tte'],
                r=RISK_FREE_RATE,
                sigma=max(row['implied_volatility'], 0.01)
            )
            gex = g * row['open_interest'] * CONTRACT_SIZE * (price**2) * 0.01
            if row['option_type'] == 'put':
                gex *= -1
            total_gex += gex
        gex_values.append(total_gex)
    
    gex_values = np.array(gex_values)
    
    # Encontrar cruce por cero
    zero_gamma = None
    for i in range(1, len(gex_values)):
        if gex_values[i-1] * gex_values[i] < 0:
            # Interpolación
            p1, p2 = price_range[i-1], price_range[i]
            g1, g2 = gex_values[i-1], gex_values[i]
            zero_gamma = p1 + (0 - g1) * (p2 - p1) / (g2 - g1)
            break
    
    if zero_gamma is None:
        # No hay cruce — usar el precio donde GEX es mínimo en abs
        zero_gamma = price_range[np.argmin(np.abs(gex_values))]
    
    return price_range, gex_values, zero_gamma


# ══════════════════════════════════════════════════════
# 6. OUTPUT EN CONSOLA
# ══════════════════════════════════════════════════════

def print_results(levels, spot, zero_gamma, gex_by_strike):
    """Muestra los resultados en consola con formato profesional."""
    
    def fmt_price(p):
        return f"{p:,.2f}" if p else "N/A"
    
    def fmt_gex(g):
        if abs(g) >= 1e9:
            return f"${g/1e9:.2f}B"
        elif abs(g) >= 1e6:
            return f"${g/1e6:.2f}M"
        else:
            return f"${g:,.0f}"
    
    print("\n" + "═"*60)
    print("  AGX GEX DASHBOARD — RESULTADOS")
    print("═"*60)
    
    print(f"\n  📍 PRECIO ACTUAL:      {fmt_price(spot)}")
    print(f"  🔄 ZERO GAMMA:         {fmt_price(zero_gamma)}")
    
    direction = "↑ ENCIMA del spot" if zero_gamma and zero_gamma > spot else "↓ DEBAJO del spot"
    if zero_gamma:
        dist = abs(zero_gamma - spot) / spot * 100
        print(f"     └─ {direction} ({dist:.1f}% de distancia)")
    
    print(f"\n  📈 NET GEX TOTAL:      {fmt_gex(levels['net_gex'])}")
    regime = "POSITIVO (dealers long gamma — mercado contenido)" if levels['net_gex'] > 0 else "NEGATIVO (dealers short gamma — movimientos amplificados)"
    print(f"     └─ Régimen: {regime}")
    
    print(f"\n  🟢 CALL WALL:          {fmt_price(levels['call_wall'])}  [{fmt_gex(levels['call_wall_gex'])}]")
    print(f"  🔴 PUT WALL:           {fmt_price(levels['put_wall'])}  [{fmt_gex(levels['put_wall_gex'])}]")
    print(f"  🟡 GAMMA FLIP:         {fmt_price(levels['gamma_flip'])}")
    
    print(f"\n  ⬆️  NIVEL RESISTENCIA: {fmt_price(levels['nearest_above'])}")
    print(f"  ⬇️  NIVEL SOPORTE:     {fmt_price(levels['nearest_below'])}")
    
    print(f"\n  🏆 TOP 5 NIVELES POR MAGNITUD:")
    for i, strike in enumerate(levels['top5'], 1):
        gex = gex_by_strike[strike]
        tipo = "CALL" if gex > 0 else "PUT "
        bar = "█" * int(min(abs(gex) / levels['call_wall_gex'] * 20, 20)) if levels['call_wall_gex'] != 0 else ""
        color = "🟢" if gex > 0 else "🔴"
        print(f"  {color} #{i} Strike {fmt_price(strike):>10} | {tipo} | {fmt_gex(gex):>10} | {bar}")
    
    print("\n" + "═"*60 + "\n")


# ══════════════════════════════════════════════════════
# 7. VISUALIZACIÓN
# ══════════════════════════════════════════════════════

def plot_gex_dashboard(gex_by_strike, spot, zero_gamma, levels,
                        price_range, gex_curve, ticker=""):
    """
    Genera el dashboard visual de GEX con estilo AGX.
    
    Panel 1: Histograma de GEX por strike
    Panel 2: Curva GEX total vs precio del subyacente
    """
    plt.style.use('dark_background')
    fig = plt.figure(figsize=(18, 10), facecolor=COLOR_BG)
    fig.suptitle(
        f'AGX GEX DASHBOARD  {("— " + ticker) if ticker else ""}  |  Spot: {spot:,.2f}',
        color=COLOR_SILVER, fontsize=16, fontweight='bold',
        fontfamily='monospace', y=0.98
    )
    
    gs = gridspec.GridSpec(2, 2, figure=fig,
                           left=0.06, right=0.97,
                           top=0.93, bottom=0.08,
                           hspace=0.38, wspace=0.28)
    
    ax1 = fig.add_subplot(gs[0, :])   # Histograma GEX — fila superior completa
    ax2 = fig.add_subplot(gs[1, 0])   # Curva Zero Gamma
    ax3 = fig.add_subplot(gs[1, 1])   # Panel de niveles texto

    # ── PANEL 1: HISTOGRAMA GEX POR STRIKE ──
    strikes = gex_by_strike.index.values
    gex_vals = gex_by_strike.values

    # Escalar a millones
    gex_m = gex_vals / 1e6

    colors = [COLOR_GREEN if v >= 0 else COLOR_RED for v in gex_m]
    bars = ax1.bar(strikes, gex_m, color=colors, alpha=0.85,
                   width=(strikes[1]-strikes[0])*0.8 if len(strikes) > 1 else 1,
                   zorder=3)

    # Línea cero
    ax1.axhline(0, color=COLOR_SILVER2, linewidth=0.5, alpha=0.5)

    # Precio actual
    ax1.axvline(spot, color=COLOR_CYAN, linewidth=2, linestyle='--',
                label=f'Spot: {spot:,.0f}', zorder=4)

    # Zero Gamma
    if zero_gamma:
        ax1.axvline(zero_gamma, color=COLOR_GOLD, linewidth=1.5,
                    linestyle=':', label=f'Zero Gamma: {zero_gamma:,.0f}', zorder=4)

    # Call Wall
    if levels['call_wall']:
        ax1.axvline(levels['call_wall'], color=COLOR_GREEN, linewidth=1,
                    linestyle='-', alpha=0.6,
                    label=f"Call Wall: {levels['call_wall']:,.0f}")

    # Put Wall
    if levels['put_wall']:
        ax1.axvline(levels['put_wall'], color=COLOR_RED, linewidth=1,
                    linestyle='-', alpha=0.6,
                    label=f"Put Wall: {levels['put_wall']:,.0f}")

    ax1.set_facecolor(COLOR_GRID)
    ax1.set_title('GAMMA EXPOSURE (GEX) POR STRIKE', color=COLOR_GREEN,
                  fontfamily='monospace', fontsize=11, pad=8)
    ax1.set_xlabel('Strike', color=COLOR_SILVER2, fontfamily='monospace', fontsize=9)
    ax1.set_ylabel('GEX ($M)', color=COLOR_SILVER2, fontfamily='monospace', fontsize=9)
    ax1.tick_params(colors=COLOR_SILVER2, labelsize=8)
    ax1.grid(axis='y', color=COLOR_BG, linewidth=0.5, alpha=0.7)
    ax1.spines['bottom'].set_color(COLOR_SILVER2)
    ax1.spines['left'].set_color(COLOR_SILVER2)
    ax1.spines['top'].set_visible(False)
    ax1.spines['right'].set_visible(False)
    legend = ax1.legend(loc='upper right', fontsize=8,
                        facecolor=COLOR_BG, edgecolor=COLOR_SILVER2,
                        labelcolor=COLOR_SILVER)

    # Etiquetas en barras importantes
    for bar, val, strike in zip(bars, gex_m, strikes):
        if abs(val) >= np.percentile(np.abs(gex_m), 85):
            ax1.text(bar.get_x() + bar.get_width()/2,
                     val + (0.5 if val >= 0 else -1.5),
                     f'{strike:,.0f}',
                     ha='center', va='bottom' if val >= 0 else 'top',
                     color=COLOR_SILVER, fontsize=7, fontfamily='monospace')

    # ── PANEL 2: CURVA GEX TOTAL vs PRECIO ──
    gex_curve_m = gex_curve / 1e6

    # Área positiva (verde) y negativa (roja)
    ax2.fill_between(price_range, gex_curve_m, 0,
                     where=(gex_curve_m >= 0),
                     color=COLOR_GREEN, alpha=0.25, label='GEX Positivo')
    ax2.fill_between(price_range, gex_curve_m, 0,
                     where=(gex_curve_m < 0),
                     color=COLOR_RED, alpha=0.25, label='GEX Negativo')
    ax2.plot(price_range, gex_curve_m, color=COLOR_SILVER, linewidth=1.5, zorder=3)
    ax2.axhline(0, color=COLOR_SILVER2, linewidth=0.8, alpha=0.5)

    # Spot
    ax2.axvline(spot, color=COLOR_CYAN, linewidth=1.5, linestyle='--',
                label=f'Spot: {spot:,.0f}')

    # Zero Gamma
    if zero_gamma:
        zg_gex = np.interp(zero_gamma, price_range, gex_curve_m)
        ax2.axvline(zero_gamma, color=COLOR_GOLD, linewidth=1.5,
                    linestyle=':', label=f'Zero γ: {zero_gamma:,.0f}')
        ax2.scatter([zero_gamma], [zg_gex], color=COLOR_GOLD, s=80, zorder=5)

    ax2.set_facecolor(COLOR_GRID)
    ax2.set_title('GEX TOTAL vs PRECIO (Zero Gamma)', color=COLOR_GREEN,
                  fontfamily='monospace', fontsize=10, pad=8)
    ax2.set_xlabel('Precio Subyacente', color=COLOR_SILVER2,
                   fontfamily='monospace', fontsize=9)
    ax2.set_ylabel('Net GEX ($M)', color=COLOR_SILVER2,
                   fontfamily='monospace', fontsize=9)
    ax2.tick_params(colors=COLOR_SILVER2, labelsize=8)
    ax2.grid(color=COLOR_BG, linewidth=0.5, alpha=0.7)
    ax2.spines['bottom'].set_color(COLOR_SILVER2)
    ax2.spines['left'].set_color(COLOR_SILVER2)
    ax2.spines['top'].set_visible(False)
    ax2.spines['right'].set_visible(False)
    ax2.legend(loc='upper right', fontsize=8,
               facecolor=COLOR_BG, edgecolor=COLOR_SILVER2,
               labelcolor=COLOR_SILVER)

    # ── PANEL 3: TABLA DE NIVELES CLAVE ──
    ax3.set_facecolor(COLOR_GRID)
    ax3.set_xlim(0, 1)
    ax3.set_ylim(0, 1)
    ax3.axis('off')
    ax3.set_title('NIVELES CLAVE', color=COLOR_GREEN,
                  fontfamily='monospace', fontsize=10, pad=8)

    def fmt_p(p): return f"{p:>10,.2f}" if p else "    N/A"
    def fmt_g(g): return f"${abs(g)/1e6:.1f}M"

    net_color = COLOR_GREEN if levels['net_gex'] > 0 else COLOR_RED
    regime_txt = "POSITIVO ▲" if levels['net_gex'] > 0 else "NEGATIVO ▼"

    rows_data = [
        ("// PRECIO ACTUAL",  fmt_p(spot),                   COLOR_CYAN),
        ("// ZERO GAMMA",     fmt_p(zero_gamma),             COLOR_GOLD),
        ("",                  "",                            COLOR_BG),
        ("// NET GEX",        fmt_g(levels['net_gex']),      net_color),
        ("   RÉGIMEN",        regime_txt,                    net_color),
        ("",                  "",                            COLOR_BG),
        ("// CALL WALL",      fmt_p(levels['call_wall']),    COLOR_GREEN),
        ("// PUT WALL",       fmt_p(levels['put_wall']),     COLOR_RED),
        ("// GAMMA FLIP",     fmt_p(levels['gamma_flip']),   COLOR_GOLD),
        ("",                  "",                            COLOR_BG),
        ("// RESISTENCIA ↑",  fmt_p(levels['nearest_above']),COLOR_GREEN),
        ("// SOPORTE ↓",      fmt_p(levels['nearest_below']),COLOR_RED),
        ("",                  "",                            COLOR_BG),
        ("// TOP NIVELES:",   "",                            COLOR_SILVER2),
    ]

    for i, strike in enumerate(levels['top5'], 1):
        g = gex_by_strike[strike]
        c = COLOR_GREEN if g >= 0 else COLOR_RED
        t = "CALL" if g >= 0 else "PUT "
        rows_data.append((f"   #{i} {t}", fmt_p(strike), c))

    y_pos = 0.97
    for label, value, color in rows_data:
        if label == "":
            y_pos -= 0.025
            continue
        ax3.text(0.02, y_pos, label, color=COLOR_SILVER2,
                 fontfamily='monospace', fontsize=8.5, va='top')
        ax3.text(0.98, y_pos, value, color=color,
                 fontfamily='monospace', fontsize=8.5, va='top', ha='right',
                 fontweight='bold')
        y_pos -= 0.06

    # Watermark AGX
    fig.text(0.99, 0.01, 'AGX Community — AlexGonXZ Trading',
             color=COLOR_SILVER2, fontsize=7, ha='right',
             fontfamily='monospace', alpha=0.5)

    plt.savefig('gex_dashboard.png', dpi=150, bbox_inches='tight',
                facecolor=COLOR_BG)
    print("   📊 Gráfico guardado: gex_dashboard.png")
    plt.show()


# ══════════════════════════════════════════════════════
# 8. DATOS DE DEMO
# ══════════════════════════════════════════════════════

def generate_demo_data(ticker='NQ', spot=18400):
    """
    Genera datos de ejemplo realistas para NQ/ES.
    Útil para testear la herramienta sin CSV real.
    """
    np.random.seed(42)
    today = date.today()

    expirations = [
        today.replace(day=today.day + 1).strftime('%Y-%m-%d'),  # 0DTE
        today.replace(day=today.day + 7).strftime('%Y-%m-%d'),  # semanal
        today.replace(day=today.day + 30).strftime('%Y-%m-%d'), # mensual
    ]

    strikes = np.arange(spot - 600, spot + 700, 50)
    rows = []

    for exp in expirations:
        for strike in strikes:
            dist = abs(strike - spot) / spot
            for opt_type in ['call', 'put']:
                # OI más alto cerca del dinero
                oi_base = max(100, int(8000 * np.exp(-dist * 12) +
                              np.random.randint(50, 500)))
                iv = 0.18 + dist * 0.5 + np.random.uniform(-0.02, 0.02)
                rows.append({
                    'expiration': exp,
                    'strike': strike,
                    'option_type': opt_type,
                    'open_interest': oi_base,
                    'implied_volatility': round(iv, 4),
                    'underlying_price': spot
                })

    df = pd.DataFrame(rows)
    demo_path = 'demo_option_chain.csv'
    df.to_csv(demo_path, index=False)
    print(f"   ✅ Datos demo generados: {demo_path} ({len(df)} contratos)")
    return demo_path


# ══════════════════════════════════════════════════════
# 9. MAIN
# ══════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description='AGX GEX Dashboard — Gamma Exposure Calculator'
    )
    parser.add_argument('--csv',          type=str, help='Ruta al CSV de opciones')
    parser.add_argument('--expirations',  type=int, default=None,
                        help='Número de expiraciones a incluir (ej: 1=0DTE, 2=0DTE+semanal)')
    parser.add_argument('--ticker',       type=str, default='',
                        help='Nombre del ticker (NQ, ES, SPY...)')
    parser.add_argument('--demo',         action='store_true',
                        help='Usar datos de demo generados automáticamente')
    parser.add_argument('--no-plot',      action='store_true',
                        help='No mostrar gráfico (solo consola)')
    args = parser.parse_args()

    print("\n╔══════════════════════════════════════════════╗")
    print("║   AGX GEX DASHBOARD — AlexGonXZ Community   ║")
    print("╚══════════════════════════════════════════════╝")

    # Obtener ruta del CSV
    if args.demo:
        csv_path = generate_demo_data()
    elif args.csv:
        csv_path = args.csv
    else:
        # Intentar buscar CSV en directorio actual
        import glob
        csvs = glob.glob('*.csv')
        if csvs:
            csv_path = csvs[0]
            print(f"   🔍 CSV detectado automáticamente: {csv_path}")
        else:
            print("\n❌ No se encontró CSV. Usa --csv archivo.csv o --demo")
            print("   Ejemplo: python gex_dashboard.py --demo")
            sys.exit(1)

    # 1. Cargar datos
    df = load_and_validate(csv_path)

    # 2. Filtrar expiraciones
    df = filter_expirations(df, args.expirations)

    # 3. Obtener precio actual
    spot = df['underlying_price'].median()
    print(f"\n   📍 Precio spot: {spot:,.2f}")

    # 4. Calcular GEX
    print("\n   ⚙️  Calculando GEX...")
    df, gex_by_strike = calculate_gex(df)

    # 5. Niveles clave
    levels = find_key_levels(df, gex_by_strike, spot)

    # 6. Zero Gamma (simulación — puede tardar unos segundos)
    print("   ⚙️  Simulando Zero Gamma...")
    price_range, gex_curve, zero_gamma = simulate_zero_gamma(df, spot)

    # 7. Output consola
    print_results(levels, spot, zero_gamma, gex_by_strike)

    # 8. Visualización
    if not args.no_plot:
        print("   📊 Generando dashboard visual...")
        plot_gex_dashboard(
            gex_by_strike, spot, zero_gamma, levels,
            price_range, gex_curve, ticker=args.ticker or df.get('symbol', pd.Series([''])).iloc[0]
        )


if __name__ == '__main__':
    main()
