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

- a new Codex-generated session name
- a matching task list added to that session

### Local setup

1. Make sure the local `codex` CLI is installed and logged in
2. Run `npm run dev`
3. Open the app and use the `AI GENERATOR` page

### How it works

The website calls a local API server at `/api/generate-plan`.
That server runs `codex exec` with a JSON schema and returns:

- a short session name
- an ordered task list
- the intended outcome

No OpenAI API key is needed in the frontend for this mode.
