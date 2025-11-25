import os
import uuid
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException


UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
}

router = APIRouter(prefix="/uploads", tags=["uploads"])


@router.post("/images")
async def upload_image(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    extension = os.path.splitext(file.filename or "")[1].lower() or ".jpg"
    filename = f"{uuid.uuid4().hex}{extension}"
    save_path = UPLOAD_DIR / filename

    try:
        contents = await file.read()
        save_path.write_bytes(contents)
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to save file") from exc

    return {"url": f"/uploads/{filename}"}

