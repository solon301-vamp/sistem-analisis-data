import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib
matplotlib.use('Agg')
import io, base64

def process_file(file_bytes: bytes, filename: str) -> dict:
    # Baca file
    if filename.endswith(".csv"):
        df = pd.read_csv(io.BytesIO(file_bytes))
    else:
        df = pd.read_excel(io.BytesIO(file_bytes))

    # Konversi otomatis kolom yang seharusnya numerik
    for col in df.columns:
        try:
            converted = pd.to_numeric(df[col], errors='coerce')
            if converted.notna().sum() / len(df) > 0.5:
                df[col] = converted
        except:
            pass

    numeric_cols = df.select_dtypes(include="number").columns.tolist()
    categorical_cols = df.select_dtypes(include="object").columns.tolist()

    # === STATISTIK DASAR ===
    summary = {
        "rows": len(df),
        "columns": list(df.columns),
        "dtypes": df.dtypes.astype(str).to_dict(),
        "describe": df.describe(include="all").fillna("").to_dict(),
        "head": df.head(5).fillna("").to_dict(orient="records"),
        "nulls": df.isnull().sum().to_dict(),
        "numeric_cols": numeric_cols,
        "categorical_cols": categorical_cols,
    }

    # === ANALISIS STATISTIK OTOMATIS ===
    stats_analysis = {}

    # Korelasi
    if len(numeric_cols) >= 2:
        corr = df[numeric_cols].corr().round(3)
        stats_analysis["correlation"] = corr.to_dict()
        high_corr = []
        for i in range(len(numeric_cols)):
            for j in range(i+1, len(numeric_cols)):
                val = corr.iloc[i, j]
                if abs(val) >= 0.7:
                    high_corr.append({
                        "col1": numeric_cols[i],
                        "col2": numeric_cols[j],
                        "value": round(val, 3)
                    })
        stats_analysis["high_correlations"] = high_corr

    # Outlier (IQR method)
    outliers = {}
    for col in numeric_cols:
        Q1 = df[col].quantile(0.25)
        Q3 = df[col].quantile(0.75)
        IQR = Q3 - Q1
        lower = Q1 - 1.5 * IQR
        upper = Q3 + 1.5 * IQR
        outlier_count = ((df[col] < lower) | (df[col] > upper)).sum()
        if outlier_count > 0:
            outliers[col] = {
                "count": int(outlier_count),
                "lower_bound": round(lower, 3),
                "upper_bound": round(upper, 3)
            }
    stats_analysis["outliers"] = outliers

    # Skewness
    skewness = {}
    for col in numeric_cols:
        skew_val = round(df[col].skew(), 3)
        if abs(skew_val) > 0.5:
            skewness[col] = {
                "value": skew_val,
                "type": "right-skewed" if skew_val > 0 else "left-skewed"
            }
    stats_analysis["skewness"] = skewness

    summary["stats_analysis"] = stats_analysis

    # === VISUALISASI ===
    charts = []

    # 1. Histogram
    for col in numeric_cols[:4]:
        fig, ax = plt.subplots(figsize=(5, 3))
        df[col].dropna().plot(kind="hist", ax=ax, color="#4F7CFF", edgecolor="white", bins=15)
        ax.set_title(f"Distribusi {col}")
        ax.set_ylabel("Frekuensi")
        charts.append({"type": "histogram", "column": col, "image": fig_to_base64(fig)})

    # 2. Bar chart
    for col in categorical_cols[:2]:
        fig, ax = plt.subplots(figsize=(5, 3))
        df[col].value_counts().head(10).plot(kind="bar", ax=ax, color="#7C4FFF", edgecolor="white")
        ax.set_title(f"Frekuensi {col}")
        ax.set_ylabel("Jumlah")
        ax.tick_params(axis='x', rotation=45)
        plt.tight_layout()
        charts.append({"type": "bar", "column": col, "image": fig_to_base64(fig)})

    # 3. Line chart
    if len(numeric_cols) >= 1:
        fig, ax = plt.subplots(figsize=(6, 3))
        df[numeric_cols[0]].plot(ax=ax, color="#00C896", linewidth=1.5)
        ax.set_title(f"Tren {numeric_cols[0]}")
        ax.set_ylabel(numeric_cols[0])
        plt.tight_layout()
        charts.append({"type": "line", "column": numeric_cols[0], "image": fig_to_base64(fig)})

    # 4. Scatter plot
    if len(numeric_cols) >= 2:
        fig, ax = plt.subplots(figsize=(5, 3))
        ax.scatter(df[numeric_cols[0]], df[numeric_cols[1]], alpha=0.6, color="#FF6B6B", s=30)
        ax.set_xlabel(numeric_cols[0])
        ax.set_ylabel(numeric_cols[1])
        ax.set_title(f"Scatter: {numeric_cols[0]} vs {numeric_cols[1]}")
        plt.tight_layout()
        charts.append({"type": "scatter", "col1": numeric_cols[0], "col2": numeric_cols[1], "image": fig_to_base64(fig)})

    # 5. Heatmap korelasi
    if len(numeric_cols) >= 2:
        fig, ax = plt.subplots(figsize=(6, 4))
        corr_matrix = df[numeric_cols].corr()
        im = ax.imshow(corr_matrix.values, cmap='coolwarm', vmin=-1, vmax=1)
        ax.set_xticks(range(len(numeric_cols)))
        ax.set_yticks(range(len(numeric_cols)))
        ax.set_xticklabels(numeric_cols, rotation=45, ha='right', fontsize=8)
        ax.set_yticklabels(numeric_cols, fontsize=8)
        for i in range(len(numeric_cols)):
            for j in range(len(numeric_cols)):
                ax.text(j, i, f"{corr_matrix.iloc[i,j]:.2f}", ha='center', va='center', fontsize=7)
        plt.colorbar(im, ax=ax)
        ax.set_title("Heatmap Korelasi")
        plt.tight_layout()
        charts.append({"type": "heatmap", "image": fig_to_base64(fig)})

    # 6. Box plot
    if len(numeric_cols) >= 1:
        fig, ax = plt.subplots(figsize=(6, 3))
        df[numeric_cols[:5]].boxplot(ax=ax)
        ax.set_title("Box Plot (Deteksi Outlier)")
        ax.tick_params(axis='x', rotation=45)
        plt.tight_layout()
        charts.append({"type": "boxplot", "image": fig_to_base64(fig)})

    # 7. Pie chart
    if len(categorical_cols) >= 1:
        fig, ax = plt.subplots(figsize=(5, 4))
        df[categorical_cols[0]].value_counts().head(6).plot(
            kind="pie", ax=ax, autopct='%1.1f%%', startangle=90
        )
        ax.set_title(f"Proporsi {categorical_cols[0]}")
        ax.set_ylabel("")
        plt.tight_layout()
        charts.append({"type": "pie", "column": categorical_cols[0], "image": fig_to_base64(fig)})

    summary["charts"] = charts
    return summary

def fig_to_base64(fig):
    buf = io.BytesIO()
    plt.savefig(buf, format="png", bbox_inches="tight", dpi=90)
    plt.close()
    return base64.b64encode(buf.getvalue()).decode()