# Nexora — Smart Shortlisting Engine

Rank a batch of resumes against a Job Description using genuine hybrid **semantic + keyword matching**, with explainable, score-backed reasoning for the top candidates. Built for the [hackathon name] Resume Shortlisting challenge.

## What it does

Upload a Job Description and a batch of resumes (PDF or DOCX). Nexora extracts, cleans, and analyzes every resume, then returns a ranked, explainable shortlist — no manual metadata entry required, no black-box LLM scoring.

## Architecture

```
JD + Resumes (PDF/DOCX)
        │
        ▼
Extraction        → pdfplumber / easyOCR / python-docx
        │
        ▼
Normalization     → symspellpy (typos) / dateutil (dates) / rapidfuzz (headers)
        │
        ▼
Skill Extraction  → pulls required skills from the JD
        │
   ┌────┴────┐
   ▼         ▼
Keyword    Semantic
Matching   Matching
(BM25 +    (Qwen3-Embedding-4B
rapidfuzz)  cosine similarity)
   └────┬────┘
        ▼
Fusion → Explainable Ranker
        │
        ▼
Recruiter Dashboard (React frontend)
```

## Tech Stack

**Backend (Python)**
| Tool | Role |
|---|---|
| pdfplumber | Text-based PDF extraction |
| easyOCR | OCR fallback for scanned resumes |
| python-docx | Word document extraction |
| symspellpy | OCR typo correction |
| python-dateutil | Fuzzy date normalization |
| rapidfuzz | Fuzzy header & skill matching |
| rank_bm25 | Keyword/lexical scoring |
| sentence-transformers + Qwen3-Embedding-4B | Semantic similarity |
| FastAPI + Uvicorn | API server |

**Frontend**
| Tool | Role |
|---|---|
| React 18/19 + TypeScript | UI |
| Vite | Dev server / bundler |
| Recharts | Skill coverage & analytics visuals |
| Firebase | Auth |

## Setup

### 1. Backend
```bash
pip install pdfplumber easyocr python-docx symspellpy python-dateutil rapidfuzz rank_bm25 sentence-transformers torch fastapi uvicorn scikit-learn
```

> **Note:** First run downloads `Qwen/Qwen3-Embedding-4B` (~8GB) from Hugging Face. This happens once and is cached locally — subsequent runs load instantly and work fully offline.

### 2. Frontend
```bash
cd frontend
npm install
```

## Running the app

Two terminals, run simultaneously:

```bash
# Terminal 1 — backend
python -m uvicorn api:app --host 127.0.0.1 --port 8000 --reload
```

```bash
# Terminal 2 — frontend
cd frontend
npm run dev
```

Then open **http://localhost:5173**.

## API

### `POST /rank`
Accepts multipart form data: a JD (`jd_file` or `jd_text`) and multiple resume files (`resumes`).

Returns a ranked JSON array:
```json
[
  {
    "filename": "candidate_07.pdf",
    "final_score": 0.86,
    "keyword_score": 0.71,
    "semantic_score": 0.79,
    "matched_skills": ["React", "Node.js", "MongoDB"],
    "missing_skills": ["Docker"]
  }
]
```

## Project Structure

```
nexora/
├── extraction.py
├── normalization.py
├── skill_extraction.py
├── keyword_matching.py
├── semantic_matching.py
├── api.py
├── test_pipeline.py
└── frontend/
    ├── src/
    │   ├── main.tsx
    │   ├── types.ts
    │   ├── services/api.ts
    │   └── components/
    │       ├── JobCandidatesView.tsx
    │       ├── CandidateComparisonModal.tsx
    │       ├── CandidateDetailView.tsx
    │       ├── HiringSimulator.tsx
    │       ├── RecruiterChatbot.tsx
    │       ├── SkillCandidatesDrawer.tsx
    │       └── SkillCoverageTable.tsx
    └── package.json
```

## Known Limitation

Extraction reads text content directly, so it currently cannot distinguish genuine resume content from deliberately hidden text (e.g. white-on-white or off-margin tiny-font keyword stuffing intended to game keyword-based screening). Noted as a known adversarial gap for future work — see submission report for details.
