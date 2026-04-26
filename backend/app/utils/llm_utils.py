import os
from typing import List, Dict, Any

from dotenv import load_dotenv
from groq import Groq

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")


def format_context(chunks: List[Dict[str, Any]]) -> str:
    if not chunks:
        return "No relevant context found."

    grouped_documents = {}

    for chunk in chunks:
        file_name = chunk.get("file_name", "unknown_file")
        text = chunk.get("text", "").strip()

        if not text:
            continue

        if file_name not in grouped_documents:
            grouped_documents[file_name] = []

        grouped_documents[file_name].append(text)

    formatted_parts = []

    for document_number, (file_name, texts) in enumerate(
        grouped_documents.items(),
        start=1,
    ):
        combined_text = "\n\n".join(texts[:8])

        formatted_parts.append(
            f"[DOCUMENT {document_number}]\n"
            f"File: {file_name}\n"
            f"Content:\n{combined_text}"
        )

    return "\n\n".join(formatted_parts)


def format_chat_history(chat_history: List[Dict[str, str]]) -> str:
    if not chat_history:
        return "No previous conversation."

    formatted_messages = []

    for message in chat_history[-6:]:
        role = message.get("role", "user")
        content = message.get("content", "").strip()

        if not content:
            continue

        formatted_messages.append(f"{role.upper()}: {content}")

    return "\n".join(formatted_messages)


def is_compare_query(user_query: str) -> bool:
    query = user_query.lower()

    compare_keywords = [
        "compare",
        "comparison",
        "difference",
        "differences",
        "similarities",
        "compare these documents",
        "compare documents",
    ]

    return any(keyword in query for keyword in compare_keywords)


def build_rag_prompt(
    user_query: str,
    context_text: str,
    chat_history_text: str,
) -> str:
    comparison_instructions = ""

    if is_compare_query(user_query):
        comparison_instructions = """
Special instructions for comparison questions:
- You MUST compare the uploaded documents using the provided document text.
- Treat each [DOCUMENT] block as one real uploaded PDF/document.
- Do NOT treat sources, chunks, or sections as separate documents.
- First identify what each uploaded document appears to be about.
- If the documents are unrelated, clearly say they are unrelated, but still compare their purpose, content, details, and use-case.
- Do not refuse just because the documents are different.
- Use this format:
  1. Document 1: brief description
  2. Document 2: brief description
  3. Similarities
  4. Differences
  5. Overall comparison
"""

    return f"""
You are a professional Multi-Document RAG Assistant.

Answer the user's latest question using ONLY the uploaded document text and the conversation history.

Strict rules:
- Do not use outside knowledge.
- Do not invent missing details.
- If the answer is not available in the uploaded document text, say exactly:
  "I could not find a confident answer in the uploaded documents."
- You may use conversation history only to understand references like "that", "second point", "make it shorter", or "explain more".
- Do not mention "context", "chunks", "retrieval", or "sources" in the answer.
- Do not include headings like "Final Answer", "Grounded Answer", or "Sources Used".
- Keep the answer clean and helpful.

Formatting rules:
- For simple factual questions, answer directly in 1–3 sentences.
- For summaries, use 3–6 bullet points.
- For key takeaways, use clear bullet points.
- For comparisons, compare the uploaded documents even if they are unrelated.
- For explanations, use simple language.
- Avoid long paragraphs.

{comparison_instructions}

Conversation history:
{chat_history_text}

User's latest question:
{user_query}

Uploaded document text:
{context_text}
""".strip()


def extract_sources(chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    sources = []
    seen = set()

    for chunk in chunks:
        chunk_id = chunk.get("chunk_id")
        file_name = chunk.get("file_name")
        text = chunk.get("text", "").strip()

        key = (chunk_id, file_name)
        if key in seen:
            continue

        seen.add(key)

        sources.append(
            {
                "chunk_id": chunk_id,
                "file_name": file_name,
                "text_preview": text[:300] + ("..." if len(text) > 300 else ""),
            }
        )

    return sources


def clean_answer(answer: str) -> str:
    cleaned = answer.strip()

    unwanted_phrases = [
        "**Final Answer:**",
        "Final Answer:",
        "**Grounded Final Answer:**",
        "Grounded Final Answer:",
        "**Sources Used:**",
        "Sources Used:",
        "Based on the context,",
        "Based on the provided context,",
        "Based on the uploaded document context,",
        "Based on the uploaded document text,",
        "Based on the conversation history,",
    ]

    for phrase in unwanted_phrases:
        cleaned = cleaned.replace(phrase, "")

    cleaned = cleaned.replace("**", "").strip()

    return cleaned


def generate_rag_answer(
    user_query: str,
    retrieved_chunks: List[Dict[str, Any]],
    chat_history: List[Dict[str, str]] | None = None,
) -> Dict[str, Any]:
    if not GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY is missing in environment variables.")

    if not retrieved_chunks:
        return {
            "answer": "I could not find a confident answer in the uploaded documents.",
            "sources": [],
        }

    client = Groq(api_key=GROQ_API_KEY)

    context_text = format_context(retrieved_chunks)
    chat_history_text = format_chat_history(chat_history or [])
    prompt = build_rag_prompt(user_query, context_text, chat_history_text)

    response = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a careful and professional RAG assistant. "
                    "Answer only from uploaded document text. "
                    "Use conversation history only for resolving follow-up references. "
                    "For comparison questions, compare available uploaded documents even when they are unrelated. "
                    "Never hallucinate. "
                    "Use clean formatting."
                ),
            },
            {
                "role": "user",
                "content": prompt,
            },
        ],
        temperature=0.1,
        max_tokens=1000,
    )

    raw_answer = response.choices[0].message.content
    answer = clean_answer(raw_answer)

    return {
        "answer": answer,
        "sources": extract_sources(retrieved_chunks),
    }