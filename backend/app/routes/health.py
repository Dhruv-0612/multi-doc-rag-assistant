from fastapi import APIRouter

router = APIRouter()


@router.get("/")
def root():
    return {"message": "Backend is running 🚀"}


@router.get("/health")
def health_check():
    return {"status": "ok"}