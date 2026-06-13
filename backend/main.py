from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sys, os
sys.path.append(os.path.dirname(__file__))

from gemini_service import ask_gemini
from data_processor import process_file

import json

app = FastAPI(title="Dashboard Analisis Data LLM")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Simpan state sementara (pakai database di produksi)
current_data_context = {}

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    content = await file.read()
    result = process_file(content, file.filename)
    # Simpan konteks untuk Gemini
    current_data_context["summary"] = json.dumps(
        {k: v for k, v in result.items() if k != "charts"}, 
        ensure_ascii=False, default=str
    )
    return result

class ChatRequest(BaseModel):
    question: str

@app.post("/chat")
async def chat(req: ChatRequest):
    context = current_data_context.get("summary", "Belum ada data yang diupload.")
    answer = ask_gemini(req.question, context)
    return {"answer": answer}

@app.get("/health")
def health():
    return {"status": "ok"}