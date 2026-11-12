"""Bounded AI assistance for drafting a marketing experiment from scored evidence."""
import json
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field
from threading import Lock

Treatment=Literal["creative","landing","query"]

class MediaEvidence(BaseModel):
    model_config=ConfigDict(extra="forbid")
    donor: str=Field(pattern=r"^C[1-9][0-9]?$")
    receiver: str=Field(pattern=r"^C[1-9][0-9]?$")
    signal: Literal["post-click drop","weaker click-through","higher click costs","cost increase"]
    allowed_treatment: Treatment
    cpl_change: float=Field(ge=0,le=1000000000)
    ctr_change: float | None=Field(ge=-1,le=1000000000)
    cvr_change: float | None=Field(ge=-1,le=1000000000)

class MediaDraft(BaseModel):
    treatment: Treatment
    evidence_ids: list[str]=Field(min_length=2,max_length=2)
    hypothesis: str=Field(min_length=10,max_length=240)
    variant: str=Field(min_length=10,max_length=240)

def create_media_writer(model_name=None, call_cap=100):
    lock=Lock()
    calls=0
    model=None
    if model_name:
        from langchain_anthropic import ChatAnthropic
        model=ChatAnthropic(model=model_name,max_tokens=300,timeout=3,max_retries=0).with_structured_output(MediaDraft)

    def write(evidence):
        nonlocal calls
        if model is None:
            return {"source":"rules"}
        with lock:
            if calls>=call_cap:
                return {"source":"rules"}
            calls+=1
        try:
            draft=model.invoke([
                ("system","Draft a hypothesis and a single-variable A/B test variant for a paid media experiment. "
                 "Use the allowed treatment and cite the donor and receiver IDs in that order. Use only the supplied metrics. "
                 "Describe a possible cause, do not claim a proven effect or invent details. "
                 "Do not recommend spending or changing targeting unless the treatment is query. "
                 "Do not include numerical claims; the application shows verified numbers separately."),
                ("human",json.dumps(evidence.model_dump())),
            ])
            return {"source":"claude",**draft.model_dump()}
        except Exception:
            return {"source":"rules"}
    return write
