from fastapi import FastAPI

app = FastAPI(title="ASOC ML Service")


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
