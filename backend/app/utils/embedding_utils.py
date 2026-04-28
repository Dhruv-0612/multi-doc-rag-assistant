import os
import time
import requests


HF_API_KEY = os.getenv("HUGGINGFACE_API_KEY")

API_URL = (
    "https://api-inference.huggingface.co/pipeline/feature-extraction/"
    "sentence-transformers/all-MiniLM-L6-v2"
)

headers = {
    "Authorization": f"Bearer {HF_API_KEY}"
}


def _call_huggingface(inputs: list[str]):
    if not HF_API_KEY:
        raise RuntimeError("HUGGINGFACE_API_KEY is missing.")

    payload = {
        "inputs": inputs,
        "options": {
            "wait_for_model": True
        }
    }

    for _ in range(3):
        response = requests.post(API_URL, headers=headers, json=payload, timeout=60)

        if response.status_code == 200:
            data = response.json()

            if isinstance(data, list):
                return data

        time.sleep(2)

    raise RuntimeError(f"HuggingFace embeddings failed: {response.text}")


def generate_embeddings(chunks: list[str]):
    embeddings = _call_huggingface(chunks)
    return embeddings


def generate_query_embedding(query: str):
    embedding = _call_huggingface([query])
    return embedding