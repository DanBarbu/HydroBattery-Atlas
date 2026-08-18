"""WILL Core stub — Sprint 0 placeholder for the Mythic-derived C2 core.

The full fork lands in Sprint 1+. For Sprint 0 we expose the contract surfaces
the rest of the stack expects: a healthz endpoint and a versioned identity
endpoint. This lets compose-level integration tests pass without coupling the
team's Day-1 work to a third-party upstream image.
"""
from fastapi import FastAPI

app = FastAPI(title="WILL Core (stub)", version="0.0.0-sprint0")


@app.get("/healthz")
def healthz() -> dict:
    return {"status": "ok", "component": "will-core-stub"}


@app.get("/version")
def version() -> dict:
    return {
        "version": "0.0.0-sprint0",
        "note": "Stub. Mythic-derived core lands in Sprint 1+.",
    }
