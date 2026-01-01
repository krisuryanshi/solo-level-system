# Solo Level System ⚔️  
*A gamified daily productivity system inspired by RPG progression*

---

## Overview
Solo Level System is a full-stack web application that turns daily work and habits into a progression-based system. Users start each day, complete quests across different categories, earn experience points, level up, and allocate stat points that directly affect how the system behaves.

Rather than tracking productivity passively, the app frames each day as an active run, where consistency and effort are rewarded through visible growth and evolving UI feedback.

The project was built end-to-end, including authentication, persistence, progression logic, and deployment.

---

## Core Concept
The system is built around a few core ideas:

- Each day is a self-contained session  
- Tasks are framed as quests  
- Completing quests grants XP  
- XP leads to level ups  
- Level ups grant stat points  
- Stats influence how demanding future quests can be  

Progression is not only numerical. As users level up, the interface itself becomes more dynamic, reinforcing the feeling of growth over time.

---

## Authentication & Accounts 🔐
Users create accounts using a username and password. Authentication is handled using JSON Web Tokens and persists across sessions.

**Auth form (Login + Register)**  
![Auth form](./screenshots/auth.png)

Each account has its own progression data, templates, and daily history stored in MongoDB.

---

## Daily System 🗓️
Before any quests can be added, the user must explicitly start their day.

**Day not started**  
![Day not started](./screenshots/day-not-started.png)

**Day started (active dashboard)**  
![Day started](./screenshots/day-started.png)

- A day can only be started once  
- Quests are scoped to a single day  
- At midnight (Toronto time), the system automatically rolls over  
- Previous quests are cleared and a new day must be started  

This structure encourages intentional daily planning rather than passive task accumulation.

---

## Core Dashboard: Quests, XP & Stats 🎯📈
Once the day is active, the dashboard becomes fully interactive. Quest creation, XP tracking, and stat allocation all live within a single unified interface.

**Core dashboard (quests + XP + stats)**  
![Core dashboard](./screenshots/dashboard-core.png)

- Quests are created with a title, category, and duration  
- Completing quests grants XP  
- XP fills a progress bar toward the next level  
- Stat points are awarded on level-up and allocated manually  

Stats directly affect gameplay:

- Higher stats increase the maximum allowable minutes for quests of that type  
- This creates a feedback loop where growth unlocks higher effort ceilings  

---

## Quest Completion Feedback ✅
When a quest is completed, the system provides immediate feedback summarizing the outcome.

**Quest completion feedback**  
![Quest completion feedback](./screenshots/quest-complete.png)

The feedback includes:
- XP gained from the quest  
- Any level-ups triggered  
- Updated stat point totals when applicable  

This instant response ties effort directly to progression and reinforces consistent completion.

---

## Level-Based UI Progression ✨
The interface evolves visually as the player levels up. Visual effects are intentionally gated behind progression to mirror RPG-style power scaling.

### Level 1 – Base System
![Level 1 UI](./screenshots/ui-level-1.png)

- Minimal visual effects  
- Clean, subdued interface  
- Focus on structure and clarity  

### Mid-Level – System Awakening
![Mid-level UI](./screenshots/ui-mid-level.png)

- Subtle background motion  
- Increased visual depth  
- UI begins to feel more reactive  

### High-Level (20+) – Full System Mode
![High-level UI](./screenshots/ui-high-level.png)

- Dynamic background effects  
- Cursor-based lighting  
- Full visual feedback tied to progression  

---

## Templates System 📋
Frequently repeated quests can be saved as templates to speed up daily setup.

**Templates panel**  
![Templates panel](./screenshots/templates.png)

Templates:
- Persist across days  
- Allow quick quest creation with preset values  
- Reduce repetitive setup while keeping daily intent explicit  

---

## Tech Stack 🛠️

**Frontend**
- React  
- Vite  
- Custom CSS (no UI framework)

**Backend**
- Node.js  
- Express  
- MongoDB (Atlas)  
- JWT authentication  

**Deployment**
- Frontend: Vercel  
- Backend: Render  

---

## Repository Structure
```
solo-level-system/
│
├── client/                 # Frontend (Vite + React)
│ │
│ ├── public/               # Static assets served directly
│ │ └── favicon.svg         # Application favicon
│ │
│ ├── src/
│ │ ├── assets/             # UI images and visual assets
│ │ │ └── (images, icons)
│ │ │
│ │ ├── App.jsx             # Main application logic and state flow
│ │ ├── main.jsx            # React entry point and root render
│ │ ├── App.css             # Global styles + level-based visual effects
│ │ ├── index.css           # Base resets and shared styling
│ │ ├── SystemModal.jsx     # System-style modal overlays
│ │ │
│ │ └── components/         # Reusable UI components
│ │ ├── Account.jsx         # Account panel and logout logic
│ │ ├── QuestBoard.jsx      # Quest creation and display logic
│ │ ├── QuestItem.jsx       # Individual quest rendering
│ │ ├── StatsPanel.jsx      # Stat allocation UI
│ │ ├── Templates.jsx       # Template list and creation
│ │ └── LevelDisplay.jsx    # XP bar and level visualization
│ │
│ ├── index.html            # Vite HTML entry
│ ├── vite.config.js        # Vite configuration
│ ├── package.json          # Frontend dependencies and scripts
│ └── package-lock.json     # Dependency lockfile
│
├── server/                 # Backend (Node + Express)
│ │
│ ├── models/               # MongoDB schemas
│ │ ├── User.js             # User model (auth, stats, quests, progression)
│ │ └── Template.js         # Quest template model
│ │
│ ├── middleware/
│ │ └── auth.js             # JWT authentication middleware
│ │
│ ├── index.js              # Express server, routes, game logic
│ ├── package.json          # Backend dependencies and scripts
│ ├── package-lock.json     # Dependency lockfile
│ └── .env.example          # Environment variable template
│
├── .gitignore              # Prevents secrets and build artifacts
└── README.md               # Project documentation
```

---

## Environment & Deployment Notes
- All secrets are managed via environment variables  
- MongoDB credentials and JWT secrets are never committed  
- CORS is explicitly restricted to the production frontend domain  
- Vite environment variables are injected at build time  

---

## Notes
- The system is designed to scale with progression rather than reset daily effort limits  
- All validations (minutes, stats, XP) are enforced server-side  
- UI effects are tied directly to progression rather than user settings 
