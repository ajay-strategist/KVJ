# API Audit & Integration Specification

This document details the API layers of the application, analyzing both the active PostgREST gateway (Supabase) and the legacy Node.js Express endpoints.

---

## 1. Supabase PostgREST API Surface (Active Gateway)

The frontend React application communicates directly with Supabase via PostgREST. This gateway exposes PostgreSQL tables and functions as RESTful endpoints.

```
Request  ---> HTTPS ---> Supabase API Gateway (Kong) ---> PostgREST ---> PostgreSQL
(Header: Anon/JWT)                                                   (Executes with RLS context)
```

### Authentication & Authorization
- **Bearer JWT Injection**: The `SupabaseClient` auto-injects the session JWT into the `Authorization: Bearer <token>` header of every request.
- **Authorization Vulnerability**: Because RLS policies are set to `USING (true)`, the gateway allows any authenticated user to perform read and write requests across all tables, bypassing role constraints.

### Response & Error Formats
- **Standard Envelope**: Data is returned as a JSON array or object.
- **Error Body**: PostgREST wraps PostgreSQL database errors in a JSON structure:
  ```json
  {
    "code": "42P01",
    "message": "relation \"public.flwdsk_employees\" does not exist",
    "details": null,
    "hint": null
  }
  ```
- **Error Translation**: The frontend class [api-client.ts](file:///Users/apple/Downloads/flow-desk-main/src/shared/api-client/api-client.ts#L121) maps these error payloads into typed `AppError` codes (e.g., `VALIDATION`, `UNAUTHENTICATED`, `FORBIDDEN`).

### Database RPC Functions
- **Login Resolver**:
  - **Endpoint**: `/rest/v1/rpc/resolve_login_email`
  - **HTTP Method**: `POST`
  - **Payload**: `{"identifier": "username_or_phone"}`
  - **Purpose**: Translates credentials to emails. Runs with `SECURITY DEFINER` privileges to allow anonymous queries before login.

---

## 2. Legacy Express Backend API Surface (Inactive)

The Node.js server inside `/server` defines a separate API surface mapping to MongoDB. These routes are currently **not** called by the React frontend.

| Route Prefix | Controller | Methods | Description |
| :--- | :--- | :--- | :--- |
| `/api/auth` | `authController` | `POST /login`, `POST /logout` | Legacy session auth. |
| `/api/users` | `userController` | `GET /`, `PUT /:id` | Legacy user profile management. |
| `/api/attendance`| `attendanceController`| `POST /clock-in`, `POST /clock-out`| Legacy attendance logs (MongoDB). |
| `/api/leaves` | `leaveController` | `POST /apply`, `PUT /:id/approve` | Legacy leave request updates. |
| `/api/tasks` | `taskController` | `GET /`, `POST /`, `PUT /:id` | Legacy project tasks tracker. |
| `/api/expenses` | `expenseController` | `POST /claim`, `PUT /:id/approve` | Legacy business expense claims. |
| `/api/chat` | `chatController` | `GET /channels`, `POST /messages` | Legacy chat message logs. |

---

## 3. Recommended API Changes

1. **Restrict PostgREST write actions**:
   Secure the database endpoints by using granular RLS policies. This ensures that the PostgREST layer rejects unauthorized updates (e.g. employees trying to edit colleagues' records).
2. **Decommission Legacy Server Endpoint Files**:
   Remove the `/server/routes`, `/server/controllers`, and `/server/models` directories to prevent developer confusion. Since the frontend is fully migrated to Supabase, these legacy files are redundant.
3. **Move Cron Jobs to Edge Functions**:
   Move background tasks from `/server/cron` into Supabase Edge Functions or Scheduled database triggers. This maintains all scheduled business logic inside a single backend runtime.
