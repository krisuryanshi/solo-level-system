# Solo Level System  
**A Personal Project Inspired by the *System* from [Solo Leveling](https://en.wikipedia.org/wiki/Solo_Leveling)**

---

> **IMPORTANT**  
> Please allow up to ~45 seconds on first login due to server cold start.

---

## Overview
Solo Level System is a web application built to make daily work feel more structured. Each day starts fresh. Users add quests, complete them, gain XP, level up, and spend stat points. Stats directly affect how much time future quests are allowed to take.

The app is designed around starting and finishing a day on purpose rather than keeping long running task lists.

---

## Core Concept
The system follows a simple loop:

- Each day is its own session  
- Tasks are treated as quests  
- Completing quests gives XP  
- XP leads to level ups  
- Level ups give stat points  
- Stats affect future quest limits  

Progress is shown through numbers and through changes in the interface.

---

## Authentication & Accounts
Users create accounts with a username and password. Authentication uses JSON Web Tokens and stays active across sessions.

**Auth form (login and register)**  
![Auth form](./screenshots/auth.png)

Each account keeps its own progression data, templates, and daily history in MongoDB.

---

## Daily System
A day must be started before any quests can be added.

**Day not started**  
![Day not started](./screenshots/day-not-started.png)

**Day started (active dashboard)**  
![Day started](./screenshots/day-started.png)

- A day can only be started once  
- Quests belong to a single day  
- At midnight Toronto time, the day resets  
- A new day must be started after reset  

---

## Core Dashboard: Quests, XP, and Stats
Once the day is active, everything happens in one place.

**Quest creation and save as template option**  
![Quest creation](./screenshots/quest-create.png)

- Quests have a title, category, and duration  
- Quests can be saved as templates  
- XP and stat totals are always visible  

**Quest added to active list**  
![Quest added](./screenshots/quest-added.png)

---

## Quest Completion Feedback
When a quest is completed, the system responds right away.

**Quest completion without level up**  
![Quest completion](./screenshots/quest-complete.png)

**Quest completion with level up**  
![Quest completion with level up](./screenshots/quest-complete-levelup.png)

The feedback shows XP gained, level ups, and updated stat totals.

---

## Leveling & Stat Allocation
XP fills a bar toward the next level. Leveling up grants stat points that can be spent manually.

**Stat points and allocation panel**  
![Stats panel](./screenshots/stats.png)

Higher stats increase the maximum minutes allowed for quests in that category.

---

## Templates System
Repeated quests can be saved and reused.

**Templates panel**  
![Templates panel](./screenshots/templates.png)

Templates stay available across days and make setup faster.

---

## Level Based UI Progression
Visual changes unlock as the user levels up.

### Low Level UI (10+)
![Low level UI](./screenshots/ui-low-level.png)

### Mid Level UI (20+)
![Mid level UI](./screenshots/ui-mid-level.png)

### High Level UI (30+)
![High level UI](./screenshots/ui-high-level.png)

---

## Tech Stack

**Frontend**
- React  
- Vite  
- Custom CSS  

**Backend**
- Node.js  
- Express  
- MongoDB Atlas  
- JWT authentication  

**Deployment**
- Frontend hosted on Vercel  
- Backend hosted on Render  

---

## Repository Structure
```
solo-level-system/
│
├── client/                         # Frontend (Vite + React)
│ │
│ ├── public/                       # Static assets served directly
│ │ └── favicon.png                 # App favicon
│ │
│ ├── src/                          # Frontend source code
│ │ ├── App.jsx                     # Main application logic and state orchestration
│ │ ├── App.css                     # Global styles + level-based visual effects
│ │ ├── SystemModal.jsx             # System-style modal + notification overlays
│ │ ├── index.css                   # Base resets and shared styles
│ │ └── main.jsx                    # React entry point
│ │
│ ├── .gitignore                    # Client-specific ignores
│ ├── eslint.config.js              # ESLint configuration
│ ├── index.html                    # Vite HTML entry
│ ├── package.json                  # Frontend dependencies and scripts
│ ├── package-lock.json             # Frontend lockfile
│ ├── README.md                     # Frontend notes (if applicable)
│ └── vite.config.js                # Vite configuration
│
├── server/                         # Backend (Node + Express)
│ │
│ ├── middleware/                   # Request guards that run before routes
│ │ └── auth.js                     # JWT authentication middleware
│ │
│ ├── models/                       # MongoDB schemas (Mongoose models)
│ │ ├── Template.js                 # Quest template schema
│ │ └── User.js                     # User schema (auth, stats, quests, progression)
│ │
│ ├── index.js                      # Express server, routes, and system logic
│ ├── package.json                  # Backend dependencies and scripts
│ └── package-lock.json             # Backend lockfile
│
├── screenshots/                    # README screenshots (UI states & feature demos)
│ ├── auth.png                      # Login + register screen
│ ├── day-not-started.png           # Dashboard before starting a day
│ ├── day-started.png               # Dashboard after starting a day
│ ├── quest-create.png              # Entering a quest + save-as-template option
│ ├── quest-added.png               # Quest successfully added to the list
│ ├── quest-complete.png            # Quest completion feedback (no level-up)
│ ├── quest-complete-levelup.png    # Quest completion feedback with level-up
│ ├── stats.png                     # Stat points allocation panel
│ ├── templates.png                 # Templates panel
│ ├── ui-low-level.png              # Low-level UI visuals (10+)
│ ├── ui-mid-level.png              # Mid-level UI visuals (20+)
│ └── ui-high-level.png             # High-level UI visuals (30+)
│
├── .gitignore                      # Root ignores
└── README.md                       # Project documentation
```

---

## Notes
- Daily reset runs automatically at midnight Toronto time  
- Quest time limits are calculated from stored stat values  
- XP and stat updates are validated on the server  
- Authentication tokens are stored client side and verified on each request  
