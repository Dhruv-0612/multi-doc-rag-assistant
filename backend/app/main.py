from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.routes.health import router as health_router
from app.routes.upload import router as upload_router
from app.routes.search import router as search_router
from app.routes.chat import router as chat_router


load_dotenv()


app = FastAPI(
    title="Multi-Document RAG Assistant API",
    description="Backend API for uploading PDFs, indexing documents, searching chunks, and chatting with documents using RAG.",
    version="1.0.0",
)


ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
     "https://multi-doc-rag-assistant.vercel.app",
]


app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(health_router)
app.include_router(upload_router)
app.include_router(search_router)
app.include_router(chat_router)