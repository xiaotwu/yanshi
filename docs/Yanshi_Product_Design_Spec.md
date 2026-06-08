# Yanshi Product Design Spec

## 0. Core Principle

**Yanshi must feel simple on the surface and powerful underneath.**

The interface should not explain too much.  
The product should show state through layout, icons, motion, concise labels, and progressive disclosure.

Avoid:
- Long text inside buttons
- Repeated explanations under section titles
- Dense dashboard cards
- Overexplaining obvious options
- Technical logs in normal mode
- Too many labels around the same control

Use:
- Short labels
- Icons with tooltips
- Hover details
- Expandable details
- Settings descriptions only where needed
- Developer Mode for technical depth

---

# 1. Product Definition

## Name

**Yanshi**

Inspired by the ancient Chinese story of **Yan Shi**, the craftsman who created lifelike mechanical humans.

## Product Positioning

**Yanshi is a macOS-first AI Agent desktop workspace with animated virtual workers.**

It combines:

- A clean OpenHands-style Agent Workspace
- A graph-based Yanshi Runtime
- Multiple real Agent workers
- 2.5D / 3D Live Office visualization
- Computer Use
- Browser Use
- File / terminal / sandbox tools
- Project-based workspaces
- Workshop customization

## One-line Description

**Yanshi is an AI Agent workspace where virtual workers plan, execute, review, rest, and visualize real task progress inside a 2.5D/3D office.**

---

# 2. Product Goals

## Primary Goals

- Let users give tasks naturally.
- Let real Agents execute those tasks.
- Show progress clearly without exposing raw logs.
- Visualize Agent work through animated workers.
- Support customization through Workshop.
- Provide strong permission and approval control.
- Run as a native-feeling macOS desktop app.

## First Version User Focus

Primary:

- Ordinary users
- Power users
- Local productivity users

Secondary:

- Developers
- Agent builders
- Advanced automation users

## Main Use Cases

- Organize local files
- Research a topic
- Summarize webpages
- Operate desktop apps
- Generate reports
- Run browser tasks
- Manage project files
- Run code / terminal tasks in Developer Mode
- Create automations
- Customize virtual workers and office scenes

---

# 3. Product Shape

## Final Concept

```txt
Yanshi Desktop
├── OpenHands-style Agent Workspace
├── Yanshi Runtime
│   ├── LangGraph orchestration
│   └── OpenHands-style Action / Observation / Tools / Sandbox model
├── 2.5D / 3D Live Office
├── Multi-Agent worker system
├── Workshop customization
└── macOS native desktop integration
```

## Key Design Choice

Do not brand the product around OpenHands.

Use:

```txt
Yanshi Runtime
```

Internally inspired by:

```txt
LangGraph orchestration
+
OpenHands-style Action / Observation / Tools / Sandbox
```

Externally, the user only sees **Yanshi**.

---

# 4. Core UX

## Default Experience

User opens Yanshi and sees:

```txt
How can Yanshi help you today?
[ Composer ]
Recommended templates
```

The interface is minimal.

When the user starts a task:

```txt
Task starts
→ Agent Run begins
→ Workspace switches into Run view
→ Live Office auto-expands
→ Agent workers begin moving and working
```

## Main UX Modes

### Idle Mode

- Minimal task input
- Recommended templates
- No heavy panels
- Live Office closed by default

### Running Mode

- Hybrid transcript
- Plan summary
- Agent messages
- Tool summaries
- Approval cards
- Artifact cards
- Live Office auto-expanded

### Developer Mode

Adds:

- Raw events
- Graph state
- Action / Observation table
- Sandbox status
- Logs
- Tool calls
- Runtime debug data
- 3D debug overlay

---

# 5. App Platform

## Primary Platform

**macOS Desktop App**

## Desktop Shell

**Tauri**

## App Runtime Shape

```txt
Tauri shell
├── React + Vite UI
├── React Three Fiber Live Office
├── Python Yanshi Runtime sidecar
├── SQLite local database
├── Local file storage
├── macOS permission bridge
└── Menubar integration
```

## Runtime Lifecycle

```txt
Open Yanshi
→ Tauri starts Python Yanshi Runtime
→ UI connects through REST + WebSocket
→ User runs tasks
→ Runtime streams events
→ UI and Live Office update
→ Closing app prompts if tasks are running
```

## Server Behavior

The Yanshi Runtime starts and stops with the desktop app.

No manual server startup for normal users.

---

# 6. Technology Stack

## Frontend

```txt
React
Vite
TypeScript
Tailwind CSS
Zustand
React Three Fiber
three.js
@react-three/drei
```

## Desktop

```txt
Tauri
Rust commands
macOS permission bridge
Menubar / tray integration
Multi-window support
```

## Runtime

```txt
Python
LangGraph
FastAPI or equivalent REST server
WebSocket event stream
SQLite checkpointing
OpenHands-style Action / Observation / Tool model
```

## Storage

```txt
SQLite
+
File system
```

SQLite stores structured data.  
File system stores artifacts, packs, logs, screenshots, models, and workspace files.

---

# 7. Repository Structure

```txt
yanshi/
├── apps/
│   └── desktop/
│       ├── src-tauri/
│       └── src/
│           ├── app/
│           ├── features/
│           │   ├── new-task/
│           │   ├── projects/
│           │   ├── runs/
│           │   ├── workshop/
│           │   ├── settings/
│           │   ├── approvals/
│           │   ├── artifacts/
│           │   ├── developer/
│           │   └── live-office/
│           ├── components/
│           ├── stores/
│           ├── styles/
│           └── i18n/
│
├── runtime/
│   └── python/
│       ├── yanshi_runtime/
│       │   ├── graph/
│       │   ├── agents/
│       │   ├── tools/
│       │   ├── sandbox/
│       │   ├── approvals/
│       │   ├── artifacts/
│       │   ├── events/
│       │   ├── storage/
│       │   └── server/
│       └── tests/
│
├── packages/
│   ├── shared/
│   ├── ui/
│   └── live-office/
│
└── docs/
```

---

# 8. Navigation Structure

## Default Sidebar

```txt
Yanshi
New Task
Search
Projects
Runs
Workshop
Settings
```

## Conditional Sidebar Items

Show only when relevant:

```txt
Approvals
Artifacts
Developer
```

Rules:

- `Approvals` appears when pending approvals exist.
- `Artifacts` can be pinned by user or shown after task output.
- `Developer` appears only when Developer Mode is enabled.

## No Top Bar

Yanshi does not use a heavy top bar.

Model, permission, runtime status, and advanced settings live in:

- Composer config
- Settings
- Run details
- Developer Mode

---

# 9. New Task Page

## Layout

```txt
Centered title
Composer
Recommended templates
```

## Main Title

```txt
How can Yanshi help you today?
```

## Recommended Templates

Keep few and concise:

```txt
Organize files
Research a topic
Summarize webpage
Use computer
Create report
Plan my day
```

Do not add long descriptions under every template.  
Use one short subtitle at most.

---

# 10. Task Composer

## Placeholder

```txt
Ask Yanshi to do anything...
```

## Layout

```txt
+   Ask Yanshi to do anything...     [Config]   Mic   Send
```

## Input Behavior

- Single-line by default
- Auto-grows when text is longer
- After task starts, composer becomes follow-up input

## Plus Menu

Main items:

```txt
Upload files
Plan first
Start from template
Add to Project
Create automation
```

Secondary items:

```txt
Use Browser
Use Computer
Use Terminal
Use Workshop asset
```

## Config Button

Config is compact and status-based.

Example:

```txt
Medium ˅
```

If permission is risky:

```txt
[red shield icon] Medium ˅
```

Rules:

- Default permission: no icon
- Auto-review: warning / review icon
- Full access: red shield / exclamation icon
- Always show reasoning level
- Dropdown arrow included

Config menu contains:

```txt
Model
Reasoning
Permission
```

## Permission Modes

```txt
Default
Auto-review
Full access
```

## Reasoning Levels

```txt
Low
Medium
High
Extra High
```

## Plan Mode

Simple toggle:

```txt
Plan first
```

## Voice Input

Use microphone button.

Behavior:

- Web Speech API or native macOS bridge if available
- Disabled state if unavailable
- No long helper text

## During Run

Composer stays active.

User can type:

```txt
Pause
Continue
Try another way
Use browser too
Explain this step
Stop after this action
```

---

# 11. Workspace / Run View

## Default Run Display

Use **Hybrid Transcript**.

Normal users see:

```txt
User task
Plan summary
Agent messages
Tool summaries
Approval cards
Artifact cards
Final result
```

Developer Mode can switch to:

```txt
Graph state
Actions
Observations
Raw events
Logs
```

## Plan Display

Default:

```txt
Plan created · 5 steps
[Expand]
```

Expanded:

```txt
1. Scan files
2. Classify items
3. Ask for approval
4. Move files
5. Create report
```

## Tool Calls

Default natural-language summary:

```txt
File Agent scanned 42 files.
Browser Agent read 3 pages.
Computer Agent captured the screen.
```

Expanded details:

```txt
Tool
Input
Risk level
Duration
Observation
Raw output
```

## Approval Card

Appears in workspace.

Example:

```txt
File Agent wants to move 20 files.
Approve / Deny
```

No long explanation unless expanded.

## Error Handling

Reviewer Agent explains errors.

Example:

```txt
Reviewer: Yanshi needs folder access before it can continue.
```

Technical details are collapsed.

## Tool Views

Browser, Computer, Terminal, Files, and Artifacts open as drawers or modals.

They do not permanently occupy the main workspace.

---

# 12. Projects

## Project Role

Project is the main long-term workspace.

A Project owns:

```txt
Tasks / Runs
Files
Knowledge
Agent Team
Live Office state
Artifacts
Automations
Settings
Activity timeline
```

Standalone tasks are also allowed.

## Project Page Layout

```txt
Left: Project list
Right: Project Workspace
```

## Project Tabs

```txt
Overview
Tasks / Runs
Files
Knowledge
Agents
Live Office
Artifacts
Automations
Settings
Activity / Timeline
```

## Agent Team

Each Project can have its own Agent Team.

Default:

```txt
Use global team template
```

Option:

```txt
Customize project team
```

---

# 13. Runs

## Runs Page

Supports group switching:

```txt
By time
By project
By status
```

## Run List Item

Show only concise information:

```txt
Task title
Status
Project
Time
Result summary
```

## Run Details

Default:

```txt
Hybrid Transcript
```

Developer Mode:

```txt
Developer Trace
```

---

# 14. Artifacts

Artifacts are first-class outputs.

## Entry Points

Artifacts can be opened from:

```txt
Run transcript
Project page
Artifacts drawer
Pinned Sidebar item
```

## Artifact Types

```txt
Report
Document
Code diff
Screenshot
Browser summary
Terminal log
Checklist
JSON
Image
Workflow
```

## Artifact Metadata

Each artifact links to:

```txt
Run
Project
Agent
Action
Source files / pages
Approvals
Created time
```

---

# 15. Workshop

## Workshop Purpose

Workshop lets users customize:

```txt
Agent appearance
Agent actions
Agent behavior
Office themes
Furniture
Sound packs
Agent profiles
Tool presets
Workspace templates
Demo runs
```

## Workshop Entry

Workshop appears in:

```txt
Sidebar
Settings
```

## Workshop Home Layout

```txt
Installed
Discover
Create
```

## First Version Scope

Support:

```txt
Installed packs
Online browse shell
Create pack
Agent Editor
Office Editor
Pack Security
Import / Export
```

## Pack Format

First version uses `.zip`.

Internal structure:

```txt
pack.zip
├── manifest.json
├── agents/
├── models/
├── animations/
├── themes/
├── furniture/
├── sounds/
├── profiles/
├── workflows/
├── demos/
└── preview.png
```

Future extension:

```txt
.yanshipack
```

## No Custom Scripts

First version does not allow custom JS, Python, or executable scripts.

Allowed:

```txt
JSON
Models
Textures
Animations
Sounds
Prompts
Profiles
Workflow descriptions
Demo descriptions
```

## Pack Install Flow

```txt
Import
→ Validate
→ Preview
→ Show content list
→ Show suggested permissions
→ Enable selected content
```

## Pack Permission Rule

Packs can suggest permissions.  
They cannot silently change permissions.

## Agent Editor

First version supports:

```txt
Name
Appearance
Role
Personality
Tool permissions
Prompt / profile
Default station
Idle behavior
Sound
Motion pack
Task priority
```

## Office Editor

First version supports full map editing:

```txt
Rooms
Paths
Collisions
Furniture
Stations
Decorations
Lighting
Themes
```

---

# 16. 2.5D / 3D Live Office

## Purpose

Live Office visualizes real Agent work.

It is not just decoration.

## Forms

```txt
Mini Live Office
Full Office View
Pop-out Office Window
Always-on-top Office Window
```

## Opening Rules

- Default closed
- Auto-expands when task starts
- New user demo can open it
- User can close it during a run
- Project has its own office state
- Standalone task creates temporary office state

## Mini Office

Shown as right panel during active runs.

Contains:

```txt
3D office
Task title
Active Agents
Pending approvals
Artifacts count
```

No long logs.

## Full Office View

Shows current Project or standalone task office.

Supports:

```txt
Camera mode switch
Agent hover cards
Office inspection
Workshop editing entry
```

## Pop-out Window

Supports:

```txt
Normal window
Always-on-top window
```

---

# 17. Live Office Visual Design

## Camera

Mini Office:

```txt
Fixed rear angled view
```

Full Office:

```txt
Rear angled view
Isometric view
Switchable
```

## Default Style

```txt
Modern office
+
Light Yanshi workshop elements
```

Visual keywords:

```txt
Warm light
Modern desks
Soft ivory background
Wood texture
Jade-teal accent
Muted bronze details
Subtle mechanical elements
```

## Office Areas

```txt
Main Desk Area
Browser Station
Computer Station
Code / Terminal Station
File Room
Meeting Table
Review Desk
Artifact Shelf
Rest Area
Coffee Area
Break Room
Workshop Corner
```

## Break Room

Use Break Room instead of explicit restroom UI.

Allowed animation:

```txt
Worker enters Break Room
Status: On break
Optional phone / lazy animation
```

Keep tasteful and light.

---

# 18. Agent Actors

## Default Core Agents

First version has 5 core Agents:

```txt
Manager Agent
Browser Agent
Computer Agent
File Agent
Reviewer Agent
```

Developer Mode can enable:

```txt
Code / Terminal Agent
```

## Agent Layers

```txt
AgentProfile
AgentInstance
AgentActor3D
```

### AgentProfile

Defines:

```txt
Role
Prompt
Personality
Default tools
Default permissions
Default behavior
```

### AgentInstance

Defines:

```txt
Current task
Task queue
Project
Run state
Fatigue
Availability
Tool state
```

### AgentActor3D

Defines:

```txt
Appearance
Position
Animation
Expression
Station
Motion state
Hover card
```

## Agent Profile vs Animation

Agent profile affects ability and behavior.

Animation state is not strictly constrained by role.

A File Agent can still drink coffee, rest, or wander when idle.

---

# 19. Agent Behavior

## Behavior Modes

```txt
Professional
Balanced
Playful
```

Default:

```txt
Balanced
```

## Work Actions

```txt
typing
thinking
searching
reading
reviewing
using_browser
using_computer
organizing_files
creating_artifact
```

## Rest Actions

```txt
coffee_break
stretching
nap
snack_time
walking_around
break_room
```

## Lazy Actions

```txt
playing_phone
pretending_to_type
sleeping_at_desk
chatting_with_neighbor
watching_video
```

## Task State Actions

```txt
waiting_approval
blocked
failed
celebrating
handoff
meeting
```

## Fatigue

Fatigue affects only animation, not real task quality.

Example:

```txt
Low fatigue → coffee, stretch, phone
Medium fatigue → slower idle, staring, small breaks
High fatigue → nap, sleep at desk
```

## Agent Queue Display

Both:

```txt
Small queue bubble above Agent
Hover card with detailed queue
```

---

# 20. Visual Design System

## Main UI Style

```txt
Warm
Minimal
Light
Professional
Soft
```

## Default Palette

```txt
Background: warm white / ivory
Panel: fog white / pale gray
Text: deep ink blue-gray
Primary: jade teal
Secondary: muted bronze
Danger: cinnabar red
Success: soft green
Info: pale steel blue
```

## Theme Support

Default:

```txt
Warm light theme
```

Also support:

```txt
Dark Mode
Workshop themes
```

3D Office may ship with Light theme first.

## Density

Main UI density:

```txt
Minimal
```

Use large whitespace.

Complexity appears only when the user expands details or enables Developer Mode.

## Buttons

Main UI:

```txt
Rounded capsule buttons
Short labels
Icon-first where possible
```

Workshop / Office Editor:

```txt
Subtle mechanical / workshop detail allowed
```

## Icons

Main UI:

```txt
Rounded linear icons
```

Live Office / brand areas:

```txt
Mechanical worker icons
Cartoon icons
```

## Typography

Use system font.

Brand title/logo can have custom treatment later.

## Logo

Two logo systems:

### Main App Logo

```txt
Mechanical worker mascot
Yanshi identity
```

### Menubar Icon

```txt
Seal-style symbol
Minimal
High contrast
```

## Mascot Reference

The character reference should inspire mood only.

Extracted mood:

```txt
Calm
Reliable
Elegant
Eastern fantasy
Light mechanical details
Dark hair
Jade-green accent
Soft red detail
```

Do not copy the source character design.

Yanshi’s mascot should be original.

---

# 21. Yanshi Runtime

## Runtime Definition

```txt
Yanshi Runtime =
LangGraph orchestration
+
Action / Observation execution model
+
Tool providers
+
Sandbox
+
Approvals
+
Event streaming
```

## Runtime Graph

Use mixed graph:

```txt
Fixed core graph
+
Dynamic Agent / Tool / Subgraph activation
```

Core shape:

```txt
User Task
→ Manager Node
→ Agent Router
→ Agent Nodes
→ Tool Executor
→ Reviewer / Permission
→ Observation
→ Artifact
→ Finalizer
```

## Manager Node

Responsible for:

```txt
Understanding user task
Creating plan
Splitting subtasks
Assigning Agents
Maintaining queues
Summarizing progress
Generating final response
Calling meetings
```

## Reviewer Agent

Responsible for:

```txt
Reviewing plan
Reviewing tool risk
Explaining failures
Determining approval needs
Creating user-readable errors
Checking final quality
Reviewing Computer Use behavior
```

## Tool Execution

Use mixed structure:

```txt
Unified ToolExecutorNode
+
Tool provider dispatch
+
Dedicated subgraphs for critical tools
```

Tool providers:

```txt
Browser
Computer
File
Terminal
Code
Search
Document
```

## Approval Logic

Approval is decided by:

```txt
Permission mode
+
Action risk
+
User session grant
```

## Multi-Agent Queue

Use:

```txt
Project-level queue
+
Agent-level queue
```

## Parallelism

Project can run multiple tasks in parallel.

Required protections:

```txt
Run Scheduler
Agent Queue Manager
Resource Lock Manager
Permission Gate
Pause / Cancel system
```

---

# 22. Action / Observation Model

All execution uses Action / Observation.

## Action Types

```txt
MessageAction
BrowserAction
ComputerAction
FileAction
TerminalAction
CodeAction
SearchAction
ReviewAction
PlanAction
ArtifactAction
```

## Observation Types

```txt
MessageObservation
BrowserObservation
ComputerObservation
FileObservation
TerminalObservation
CodeObservation
SearchObservation
ReviewObservation
ApprovalObservation
ErrorObservation
ArtifactObservation
```

Normal UI hides technical structure.

Developer Mode exposes it.

---

# 23. Permission System

## Permission Modes

```txt
Default
Auto-review
Full access
```

## Risk Levels

```txt
Low
Medium
High
Critical
```

## Approval Granularity

Supports:

```txt
Tool call approval
Action approval
Run approval
Session grant
```

## Computer Use Rules

Low risk:

```txt
Observe
Screenshot
Read window title
```

Medium risk:

```txt
Click
Type
Shortcut
Open app
```

High risk:

```txt
Run command
Move files
Upload files
Submit form
```

Critical:

```txt
Payment
Delete important files
Send message
Change system settings
External transfer
```

## Full Access Boundary

Full access does not allow:

```txt
Payments
Destructive deletion
Sending messages
Changing system settings
Bypassing permission policy
```

---

# 24. macOS App Behavior

## Startup

Open directly to main page.

If first user:

```txt
Show onboarding modal
Try Demo / Not Now
```

## Runtime Failure

Show repair actions:

```txt
Restart Runtime
Open Logs
Check Python Environment
Reinstall Runtime Components
```

## Closing App

If runs are active:

```txt
Pause and quit
Keep running in background
Cancel
```

## Menubar

Shows:

```txt
Idle / Running / Approval needed
Current tasks
Open Yanshi
Open Live Office
Pause all
Quit
```

## Notifications

First version supports:

```txt
Task completed
Task failed
Approval needed
Automation started
Automation completed
Runtime error
Permission request
Workshop pack installed
```

## Global Shortcuts

Support:

```txt
Open / hide Yanshi
New task
Open Live Office
Pause all tasks
Screenshot to Yanshi
Voice input
Open Search
Open Approvals
```

---

# 25. Settings

## Default Settings

Normal mode:

```txt
General
Models
Permissions
Live Office
Workshop
Notifications
About
```

## Developer Mode Adds

```txt
Runtime
Tools
Computer Use
Browser Use
Sandbox
Events
Logs
Advanced
Database
Performance
3D Debug
```

## Settings Copy Rules

Settings can include explanations, but keep them concise.

Good:

```txt
Allow Yanshi to control your Mac during approved tasks.
```

Avoid:

```txt
This feature allows the application to use several underlying APIs to simulate user input...
```

Use “Learn more” for long explanations.

---

# 26. Developer Mode

Developer Mode includes:

```txt
Runtime status
LangGraph state
Event stream
Action / Observation table
Tool calls
Sandbox status
Logs
Provider requests
SQLite / database status
Performance monitor
3D Live Office debug overlay
```

Developer Mode must not pollute normal mode.

---

# 27. Data Model

## Project

```txt
id
name
description
createdAt
updatedAt
settings
agentTeamId
liveOfficeStateId
workspacePath
```

## Run

```txt
id
projectId?
standalone
task
status
managerAgentId
agentTaskIds
plan
startedAt
completedAt
artifacts
approvals
```

## AgentProfile

```txt
id
name
role
prompt
personality
defaultTools
defaultPermissions
defaultAppearance
defaultBehavior
```

## AgentInstance

```txt
id
profileId
projectId?
status
currentTask
taskQueue
fatigue
availability
toolState
```

## AgentActor3D

```txt
id
agentInstanceId
appearance
position
station
animation
expression
motionState
```

## Action

```txt
id
runId
agentId
type
input
riskLevel
status
createdAt
```

## Observation

```txt
id
actionId
runId
agentId
type
summary
structuredOutput
error?
artifactIds?
createdAt
```

## Approval

```txt
id
targetType
targetId
riskLevel
status
request
expiresAt?
sessionGrant?
```

## Artifact

```txt
id
runId
projectId?
agentId?
actionId?
kind
title
summary
path
metadata
createdAt
```

## WorkshopPack

```txt
id
name
version
author
manifestPath
installedPath
enabled
contentTypes
suggestedPermissions
securityStatus
```

## LiveOfficeState

```txt
id
projectId?
standaloneRunId?
theme
furnitureLayout
agentPositions
agentFatigue
agentQueues
cameraMode
updatedAt
```

---

# 28. Event Protocol

Every event includes:

```txt
eventId
type
schemaVersion
sourceRuntimeVersion
timestamp
projectId?
runId?
agentId?
payload
```

## Core Events

```txt
run.created
run.started
run.paused
run.resumed
run.completed
run.failed
run.cancelled

agent.created
agent.updated
agent.task.assigned
agent.task.started
agent.task.completed
agent.state.changed

plan.created
plan.updated

action.created
action.started
action.completed
action.failed

observation.created

approval.requested
approval.approved
approval.denied
approval.expired

artifact.created
artifact.updated
artifact.deleted

tool.call.requested
tool.call.started
tool.call.completed
tool.call.failed

project.created
project.updated
project.deleted

workshop.pack.imported
workshop.pack.enabled
workshop.pack.disabled

liveOffice.state.updated
runtime.status.changed
```

---

# 29. UI Copy Rules for Codex

This section is critical.

## General Rule

Use less text.

## Button Labels

Prefer:

```txt
Open
Run
Stop
Pause
Approve
Deny
Import
Export
Create
Edit
Save
```

Avoid:

```txt
Open this artifact
Start running this task
Approve this requested action
Create a new automation
```

## Section Titles

Use short titles:

```txt
Projects
Runs
Agents
Tools
Permissions
Artifacts
Workshop
```

Avoid subtitle paragraphs under every title.

## Help Text

Only use help text when:

- Option is dangerous
- Permission is unclear
- First-time setup is required
- Developer setting is technical

## Technical Details

Hide behind:

```txt
Details
Advanced
Developer Mode
View logs
View technical details
```

## Empty States

Use one sentence.

Good:

```txt
No runs yet.
```

Avoid:

```txt
Runs will appear here once Yanshi starts completing tasks for you...
```

## Tooltips

Use tooltips for icons.

Do not add permanent explanatory text next to every icon.

## Normal Mode

Normal mode should never look like a debug dashboard.

## Developer Mode

Developer Mode can be dense.

---

# 30. First Build Milestones

## Milestone 1: App Shell

- Tauri desktop app
- React + Vite UI
- Sidebar
- New Task page
- Composer
- Settings shell
- Runtime sidecar startup

## Milestone 2: Runtime Skeleton

- Python Runtime server
- REST + WebSocket
- LangGraph skeleton
- Event protocol
- SQLite storage
- Run creation

## Milestone 3: Agent System

- Manager Agent
- Browser Agent
- Computer Agent
- File Agent
- Reviewer Agent
- Agent profiles
- Agent queues

## Milestone 4: Run Workspace

- Hybrid transcript
- Plan summary
- Tool summaries
- Approval cards
- Artifact cards
- Run details

## Milestone 5: Live Office

- Lazy-loaded 3D scene
- Mini Office
- Full Office View
- 5 core Agent actors
- Office stations
- Event-to-animation mapping

## Milestone 6: macOS Integration

- Menubar
- Notifications
- Global shortcuts
- Permission settings
- Computer Use bridge

## Milestone 7: Workshop

- Installed / Discover / Create
- Import zip pack
- Pack validation
- Agent Editor
- Office Editor
- Pack security summary

## Milestone 8: Developer Mode

- Runtime status
- Event stream
- Graph state
- Action / Observation table
- Sandbox status
- Logs
- 3D debug overlay

---

# 31. Acceptance Criteria

Yanshi is successful when:

- A user can create a task from a simple composer.
- Yanshi creates a real Agent Run.
- Manager assigns work to Agents.
- Agents call tools through Yanshi Runtime.
- Risky actions request approval.
- The workspace shows a readable transcript.
- Technical details are expandable.
- Artifacts are created and traceable.
- Live Office animates Agent state.
- Each Project has its own Agent team and office state.
- Workshop can import and manage packs.
- macOS app handles runtime, permissions, notifications, and menubar.
- Normal UI stays simple and clean.
- Developer Mode exposes full internal state.

---

# 32. Final Product Statement

**Yanshi is a macOS-first AI Agent workspace powered by a graph-based Yanshi Runtime. It lets multiple virtual workers plan, execute, review, and visualize real tasks inside a customizable 2.5D/3D office.**

Chinese:

**Yanshi 是一个 macOS 优先的 AI Agent 工作台。它通过基于图编排的 Yanshi Runtime 执行真实任务，并用可自定义的 2.5D/3D 机关小人办公室展示 Agent 的工作、协作、审批、休息和产出。**
