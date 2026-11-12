# Paid Media Experiment Studio

A React workspace for turning Google Ads and Meta Ads exports into a reviewable experiment. Import campaign data, check whether the reporting windows are comparable, diagnose the change in cost per lead, and draft a test a marketer can approve or decline.

## Try it

Use Node.js 22.12 or newer.

```sh
npm ci
npm run build
npm start
```

Open http://127.0.0.1:4174 and select **Analyze sample exports**. The synthetic example shows falling click-through on a Meta prospecting campaign. The studio suggests a creative test and shows a capped budget scenario separately.

| Step | Implementation |
| --- | --- |
| Validate inputs | CSV parsing checks reporting windows, attribution, conversion definitions, and funnel counts. |
| Diagnose performance | JavaScript compares CTR, CPC, conversion rate, and cost per lead; low volume blocks a spend recommendation. |
| Draft an experiment | Optional Claude integration drafts a hypothesis and one test variant from computed evidence. Rules provide a fallback. |
| Review | The server checks evidence IDs and permitted treatments, and PostgreSQL records approval decisions with version checks. |

The budget scenario is illustrative. This workspace uses exports and does not change live campaigns or spend. See [the sample CSV](example.csv) for the normalized import format.

## Optional Claude drafts

The main app runs without credentials. To use the optional Python brief API, create a virtual environment, then start the service in a second terminal:

```sh
python -m venv .venv
source .venv/bin/activate
pip install -r brief-api/requirements.txt
# Set ANTHROPIC_API_KEY and CLAUDE_MODEL in your shell before starting.
python -m uvicorn app:app --app-dir brief-api --host 127.0.0.1 --port 8002
```

JavaScript supplies the scored evidence. The Python service uses LangChain's `ChatAnthropic` with a Pydantic output schema for the hypothesis and variant. It enforces a call cap; invalid or unavailable model output falls back to a rule-based draft.

## Storage and checks

The default database is embedded PostgreSQL via PGlite, stored in `.media-data/`. Set `DATABASE_URL` to use an external PostgreSQL server. Set `MEDIA_AGENT_URL` if the brief service uses a different address.

```sh
npm test
```
