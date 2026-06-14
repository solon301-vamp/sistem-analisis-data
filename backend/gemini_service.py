from dotenv import load_dotenv
load_dotenv()
import os
from google import genai

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

def ask_gemini(question: str, data_context: str) -> str:
    prompt = f"""Kamu adalah analis data profesional. 
Berikut konteks data yang diupload pengguna:

{data_context}

Pertanyaan pengguna: {question}

Berikan jawaban yang informatif, jelas, dan dalam Bahasa Indonesia."""

    response = client.models.generate_content(
        model="gemini-3.5-flash",
        contents=prompt
    )
    return response.text