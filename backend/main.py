from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import sys, os, json, io
sys.path.append(os.path.dirname(__file__))

from gemini_service import ask_gemini
from data_processor import process_file

import pandas as pd

app = FastAPI(title="Dashboard Analisis Data LLM")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

current_data_context = {}
current_df = {}

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    content = await file.read()
    result = process_file(content, file.filename)
    current_data_context["summary"] = json.dumps(
        {k: v for k, v in result.items() if k != "charts"},
        ensure_ascii=False, default=str
    )
    # Simpan dataframe untuk export
    if file.filename.endswith(".csv"):
        current_df["data"] = pd.read_csv(io.BytesIO(content))
    else:
        current_df["data"] = pd.read_excel(io.BytesIO(content))
    current_df["filename"] = file.filename
    return result

class ChatRequest(BaseModel):
    question: str

@app.post("/chat")
async def chat(req: ChatRequest):
    context = current_data_context.get("summary", "Belum ada data yang diupload.")
    answer = ask_gemini(req.question, context)
    return {"answer": answer}

@app.get("/export/excel")
async def export_excel():
    if "data" not in current_df:
        return {"error": "Belum ada data"}
    df = current_df["data"]
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Data")
        df.describe().to_excel(writer, sheet_name="Statistik")
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=hasil_analisis.xlsx"}
    )

@app.get("/health")
def health():
    return {"status": "ok"}