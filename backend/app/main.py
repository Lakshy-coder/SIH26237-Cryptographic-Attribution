from fastapi import FastAPI
from backend.app.api import endpoints
from backend.app.db import init_db

app = FastAPI(title="Antigravity SIH26237 API")

@app.on_event("startup")
def on_startup():
    init_db()

app.include_router(endpoints.router, prefix="/api")

@app.get("/")
def read_root():
    return {"status": "ok"}
