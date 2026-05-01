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

- a new Google AI generated session name
- a matching task list added to that session

### Local setup

1. Create a Google AI API key
2. Create a local `.env` file in the project root
3. Add one of these variables to that file:
   - `GOOGLE_API_KEY`, or
   - `GEMINI_API_KEY`, or
   - `GOOGLE_AI_API_KEY`
3. Optionally set `GOOGLE_AI_MODEL` if you want a model other than `gemini-2.5-flash`
4. Run `npm run dev`
5. Open the app and use the `AI GENERATOR` page

### How it works

The website calls a local API server at `/api/generate-plan`.
That server calls the Google Gemini API with a JSON schema and returns:

- a short session name
- an ordered task list
- the intended outcome

The API key stays in the local Node server and is not stored in the frontend bundle.
