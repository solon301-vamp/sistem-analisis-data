import pandas as pd
import matplotlib.pyplot as plt
import io, base64

def process_file(file_bytes: bytes, filename: str) -> dict:
    if filename.endswith(".csv"):
        df = pd.read_csv(io.BytesIO(file_bytes))
    else:
        df = pd.read_excel(io.BytesIO(file_bytes))

    summary = {
        "rows": len(df),
        "columns": list(df.columns),
        "dtypes": df.dtypes.astype(str).to_dict(),
        "describe": df.describe(include="all").fillna("").to_dict(),
        "head": df.head(5).fillna("").to_dict(orient="records"),
        "nulls": df.isnull().sum().to_dict(),
    }

    # Buat chart otomatis untuk kolom numerik
    charts = []
    numeric_cols = df.select_dtypes(include="number").columns[:4]
    for col in numeric_cols:
        fig, ax = plt.subplots(figsize=(5, 3))
        df[col].dropna().plot(kind="hist", ax=ax, color="#4F7CFF", edgecolor="white")
        ax.set_title(col)
        ax.set_ylabel("Frekuensi")
        buf = io.BytesIO()
        plt.savefig(buf, format="png", bbox_inches="tight", dpi=90)
        plt.close()
        charts.append({
            "column": col,
            "image": base64.b64encode(buf.getvalue()).decode()
        })

    summary["charts"] = charts
    return summary