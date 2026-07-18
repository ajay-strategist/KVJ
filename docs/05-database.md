# 05 — Database Documentation

## Database type

**MongoDB** (document database), accessed through **Mongoose 8** ODM. Connection is established once at boot via `config/db.js` using `MONGO_URI` (an Atlas cluster is inferred). There is **no SQL, no stored procedures, no triggers, and no database-side views** — MongoDB does not use them and none are defined. "Relationships" are expressed as Mongoose `ObjectId` references (`ref`) and resolved at query time with `.populate()`; there are **no enforced foreign keys** at the database level. All integrity is application-enforced.

Every collection carries Mongoose `timestamps` (`createdAt`, `updatedAt`) unless noted.

## Collections (25 models)

### Core identity & org

| Collection | Key fields | Notes |
|-----------|-----------|-------|
| **User** | fullName, email (unique), password (bcrypt), role[Admin/Manager/Employee], status[Pending/Active/Deactivated], team→Team, grade, salaryRate, lastActiveAt, googleCalendar{tokens}, isTrainer | Password hashed in `pre('save')`; `matchPassword` method |
| **Team** | name (unique), description, manager→User | One manager per team |
| **Settings** | taskStatuses[], taskPriorities[], enabledModules{...}, orgName, orgLogo | Singleton config doc |

### Work management

| Collection | Key fields | Notes |
|-----------|-----------|-------|
| **Project** | name, description, client (string), startDate, endDate, status, projectGroup, managers[]→User, members[]→User | `client` is free text, **not** a Client ref |
| **Task** | title, description, category, project→Project, assignee→User (null=pool), team→Team, dueDate, priority, status, isOverdue, flaggedForReview, createdBy→User, recurring, timeLogs[], timer{}, archived, completedDate, transferPending/transferStatus, managerApprovalPending, pendingAssignee→User | Central work entity |
| **TaskComment** | task→Task, user→User, text | Threaded comments |
| **TaskTransfer** | task→Task, fromUser→User, toUser→User, status, adminStatus | Two-stage transfer approval |

### Time, attendance & leave

| Collection | Key fields | Notes |
|-----------|-----------|-------|
| **Attendance** | user→User, date, label, clockInTime, clockOutTime, clockInLocation{lat,long,accuracy,city}, breaks[], totalBreakDurationMinutes, totalHours, correctionLog[] | Geolocation + audit log |
| **Timesheet** | user→User, task→Task, project→Project, date, hoursSpent, notes, status, cost | Cost = hours × salaryRate |
| **Leave** | user→User, fromDate, toDate, reason, natureOfLeave[Medical/Personal], status, managerComment, daysTaken, approvedBy→User, isHalfDay, halfDaySlot, medicalReport*, reportStatus, reportDeadline | Medical-cert workflow |
| **LeaveType** | name (unique), daysPerYear, isCustom, color | Configurable leave categories |
| **LeaveBalance** | user→User, leaveType→LeaveType, year, totalDays, usedDays | `remainingDays` virtual; per user/type/year |
| **PublicHoliday** | name, date (unique) | Drives attendance labelling |

### Expenses

| Collection | Key fields | Notes |
|-----------|-----------|-------|
| **Expense** | user→User, team→Team, project→Project, expenseCategory, structured fields (location/batch/course/expenseType/vehicleType/distanceKm), amount, numberOfPersons, note, billImageUrl, driveFileId, driveViewLink, status[Pending/Approved/Rejected/Paid], managerNotes, + legacy fields | Bill stored in Google Drive |
| **ExpenseType** | name, category[Training/Office] | Unique (name+category) index |

### Communication

| Collection | Key fields | Notes |
|-----------|-----------|-------|
| **Channel** | name, description, type[General/Team/Custom/DM], team→Team, members[]→User, createdBy→User | DM = 2-member channel |
| **Message** | channel→Channel, sender→User, text, fileUrl/fileType/fileName, threadId→Message, mentions[]→User | Self-ref for threads |

### Training / trainers

| Collection | Key fields | Notes |
|-----------|-----------|-------|
| **TrainerLog** | userId→User, date, organisation, type, mode, startTime, endTime, duration | **No `timestamps`**; manual `createdAt` |
| **TrainingBatch** | college→College, course→Course, batch, createdBy→User | Unique (college+course+batch) |
| **College** | name (unique) | Reference |
| **Course** | name (unique) | Reference |
| **Client** | name (unique), contactPerson, email, phone, gstNumber, address, notes | **Exists but underused** — Projects store client as a string |

## Indexes

Explicit/implicit indexes found:

- **Unique single-field:** `User.email`, `Team.name`, `LeaveType.name`, `PublicHoliday.date`, `College.name`, `Course.name`, `Client.name`.
- **Unique compound:** `ExpenseType (name, category)`, `TrainingBatch (college, course, batch)`.
- **Default `_id`** on every collection.

No other secondary indexes are declared. High-traffic query fields — `Attendance.user`+`date`, `Task.assignee`/`team`/`status`, `Leave.user`+`status`, `Message.channel`, `Timesheet.user`/`date` — are **not indexed**, which will become a performance concern at scale (see [10 — Performance](10-performance.md)).

## Views / stored procedures / functions / triggers

**None** (not applicable to MongoDB and none emulated). Equivalent logic lives in:
- **Virtuals:** `LeaveBalance.remainingDays`.
- **Hooks:** `User.pre('save')` password hashing.
- **Application "jobs" acting like triggers:** the six cron jobs (auto clock-out, overdue flagging, recurring generation, archive cleanup, leave reset, overdue reports) perform what a relational DB might do with scheduled events/triggers.

## Constraints

- `required`, `enum`, `min`, `unique`, and `default` are enforced at the **Mongoose schema level** (application layer), not by the database engine. E.g. `Expense.amount` min 0.01; role/status enums; `LeaveBalance.remainingDays` clamped ≥ 0.
- Referential integrity (that a referenced `ObjectId` actually exists, or cascade-deletes) is **not enforced** — deleting a User does not cascade to their Tasks/Attendance/etc.

## Entity-Relationship description (ER diagram narrative)

```
User ──1:manager── Team ──1:M── User (members via User.team)
User ──1:M── Attendance
User ──1:M── Leave ──M:1── LeaveType
User ──1:M── LeaveBalance ──M:1── LeaveType         (per year)
User ──1:M── Timesheet ──M:1── Task ──M:1── Project
User ──1:M── Expense ──M:1── Project / Team / ExpenseType
User ──1:M── TrainerLog
User M:M Project           (Project.managers[], Project.members[])
User M:M Channel           (Channel.members[])
Team ──1:M── Task
Project ──1:M── Task ──1:M── TaskComment
Task ──1:M── TaskTransfer  (fromUser, toUser → User)
Task ── timer{startedBy→User}, timeLogs[{user→User}]  (embedded)
Channel ──1:M── Message ──self:M── Message (threadId)
Message ──M:M── User (mentions[])
College ──1:M── TrainingBatch ──M:1── Course
Client   (standalone; logically related to Project.client by name only)
PublicHoliday (standalone; consumed by attendance/leave logic)
Settings (singleton; standalone)
```

Relationship summary in words: a **User** belongs to at most one **Team** (and a Team has one manager). Users generate **Attendance**, **Leave**, **LeaveBalance**, **Timesheet**, **Expense** and **TrainerLog** records. **Projects** and **Channels** have many-to-many user membership via embedded arrays. **Tasks** hang off Projects and Teams and spawn **Comments**, **Transfers**, embedded time logs and a timer. **Messages** belong to **Channels** and self-reference for threads. **TrainingBatch** joins **College** and **Course**. **Client**, **PublicHoliday** and **Settings** stand relatively alone.

## Data flow (storage lifecycle)

1. **Entry:** the SPA POSTs JSON (or multipart for files) to `/api/*`; controllers validate against Mongoose schemas.
2. **Persistence:** documents are written to MongoDB; files (expense bills, medical certs) are streamed to **Google Drive**, with only the Drive id/link stored in Mongo.
3. **Derivation:** hooks/virtuals/cron jobs derive values (hashed passwords, remaining leave days, total hours, overdue flags, recurring instances, costs).
4. **Retrieval:** GET endpoints query and `.populate()` references, filtered by role (Managers scoped to their team).
5. **Display:** pages render tables/boards/calendars; exports serialise to CSV/XLSX.
6. **Real-time:** mutations also emit Socket.IO events to the relevant rooms for live UI updates.
