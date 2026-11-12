"""Optional standalone Claude brief service."""
import os
from fastapi import FastAPI
from media_brief import MediaEvidence, create_media_writer

write=create_media_writer(os.getenv("CLAUDE_MODEL"),int(os.getenv("MODEL_CALL_CAP","100")))
app=FastAPI(title="Paid Media Experiment Brief API")

@app.post("/media-brief")
def media_brief(evidence:MediaEvidence):
    return write(evidence)
