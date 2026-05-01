# WorkCycle

**Turn tasks into structured focus sessions.**

TaskFlow is a productivity system that combines tasks, sessions, and a focus timer into a single workflow.  
Instead of managing endless task lists, TaskFlow helps you structure your work into focused cycles.

---

## Overview

Most productivity tools treat tasks as isolated items.  
TaskFlow introduces a different approach — **work is organized into sessions**, where tasks, time, and progress are connected.

The goal is simple:  
> move from chaotic task lists to structured, trackable work cycles.

---

## Features

- **Session-based workflow**  
  Organize work into dedicated focus sessions

- **Task management**  
  Create and assign tasks to sessions

- **Focus timer (Pomodoro-style)**  
  Run timed work cycles with start/reset controls

- **Progress tracking**  
  Basic analytics to visualize completed work

- **Clean dashboard UI**  
  Everything in one place — no context switching

---

## How It Works

1. Create a session  
2. Add tasks  
3. Select a task  
4. Start the timer  
5. Complete focused work cycles  
6. Track your progress

---

## Tech Stack

- Frontend: React / Next.js (or your stack)
- Styling: Tailwind CSS / custom UI
- State Management: Local state
- Storage: LocalStorage

*(replace with your actual stack if needed)*

---

## AI Generator Setup

The `AI GENERATOR` page can turn a goal like `Create Landing website` into:

- a new Gemini-generated session name
- a matching task list added to that session

### Local setup

1. Create or choose a Google Cloud project
2. Enable Vertex AI for that project
3. Create a local `.env` file in the project root
4. Add your Vertex AI settings:
   - `GOOGLE_CLOUD_PROJECT=your-project-id`
   - `GOOGLE_CLOUD_LOCATION=us-central1`
5. Choose one auth method:
   - `GOOGLE_API_KEY=your-google-cloud-api-key`, or
   - `GOOGLE_APPLICATION_CREDENTIALS=path-to-service-account.json`, or
   - local ADC via `gcloud auth application-default login`
6. Optionally set `GOOGLE_AI_MODEL` if you want a model other than `gemini-2.5-flash`
7. Run `npm run dev`
8. Open the app and use the `AI GENERATOR` page

Example `.env`:

```env
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GOOGLE_CLOUD_LOCATION=us-central1
GOOGLE_API_KEY=your-google-cloud-api-key
# GOOGLE_AI_MODEL=gemini-2.5-flash
```

### How it works

The website calls a local API server at `/api/generate-plan`.
That server uses the `@google/genai` SDK in Vertex AI mode to call Gemini and returns:

- a short session name
- an ordered task list
- the intended outcome

The credentials stay in the local Node server and are not stored in the frontend bundle.
