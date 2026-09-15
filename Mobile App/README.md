# KVJ FlowDesk Mobile Application (iOS & Android)

A modern, production-grade cross-platform mobile application built with **React Native & Expo (TypeScript)**, connected directly to the **KVJ Analytics Supabase Cloud** database.

---

## 📱 Features Included
- **🔐 Secure Authentication:** Employee login with email & password, persistent token storage via `expo-secure-store`.
- **📍 GPS Smart Punch Clock:** 1-tap clock-in/out with location detection, work type categorization (Office, Remote, College Campus), and automatic shift duration logging.
- **⏱️ Task Work Time Tracker:** Start, pause, and resume assigned tasks with mandatory work progress notes. Includes single-session enforcement to prevent double-counting.
- **🎓 Training Batches & Classroom Rollcall:** View assigned student batches, 1-tap present/absent student attendance roster, and daily training delivery report submission with topics covered and hours.
- **🏖️ Leave Management:** Apply for Casual, Medical, or Loss of Pay leaves with shift selection (Full Day / Half Day) and view real-time approval status.
- **👤 Employee Profile:** View designation, corporate role, and secure sign-out.

---

## 🚀 Quick Start (Testing on Real Devices in 60 seconds)

The fastest and easiest way to install and test the app on any **iPhone** or **Android phone** is using the official **Expo Go** client (no cables, Xcode, or Android Studio required):

### Step 1: Install Expo Go on your phone
- **iOS (iPhone/iPad):** Download **Expo Go** from the [Apple App Store](https://apps.apple.com/app/expo-go/id982107779).
- **Android:** Download **Expo Go** from the [Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent).

### Step 2: Start the mobile dev server
Open your terminal in the `Mobile App` folder:
```bash
cd "Mobile App"
npm install
npx expo start
```

### Step 3: Scan the QR Code
- **On iPhone:** Open the native **Camera** app, point it at the terminal QR code, and tap the notification banner to open in **Expo Go**.
- **On Android:** Open the **Expo Go** app, tap **Scan QR code**, and point at the terminal QR code.

The app will compile and launch directly on your device with hot-reloading!

---

## 📦 Building Installable Standalone Files (.APK for Android & .IPA for iOS)

To create standalone installable package files that can be distributed directly to staff or uploaded to app stores:

### 1. Install EAS CLI
```bash
npm install -g eas-cli
```

### 2. Log in or create a free Expo account
```bash
eas login
```

### 3. Generate Android APK (Direct Installation on any Android device)
Run:
```bash
eas build -p android --profile preview
```
- EAS will build a standard `.apk` file in the cloud.
- Once finished, you will receive a direct download link and QR code to download and install the `.apk` directly onto any Android phone.

### 4. Generate iOS Build (TestFlight or Ad-Hoc for iPhone)
Run:
```bash
eas build -p ios --profile preview
```
- For iOS internal distribution or submission to Apple TestFlight.

---

## 🛠️ Project Structure

```
Mobile App/
├── App.tsx                     # Root application wrapper (SafeArea, StatusBar, Auth)
├── app.json                    # Native bundle & permissions configuration
├── package.json                # React Native & Expo dependencies
├── tsconfig.json               # TypeScript configuration
├── assets/                     # App icon, splash screen, and adaptive icons
└── src/
    ├── context/
    │   └── AuthContext.tsx     # Supabase Auth provider & employee profile store
    ├── navigation/
    │   └── AppNavigator.tsx    # Bottom tabs & stack navigation
    ├── screens/
    │   ├── LoginScreen.tsx           # Modern dark-mode sign-in screen
    │   ├── DashboardScreen.tsx       # My Day shift & running task overview
    │   ├── AttendanceScreen.tsx      # GPS clock-in/out & work sessions
    │   ├── TasksScreen.tsx           # Tasks list & real-time work timer
    │   ├── TrainingBatchesScreen.tsx # Classroom rollcall & daily topics log
    │   ├── LeaveScreen.tsx           # Leave application & status tracking
    │   └── ProfileScreen.tsx         # Account details & sign-out
    ├── services/
    │   └── supabase.ts         # Supabase client with SecureStore integration
    └── theme/
        └── theme.ts            # KVJ Analytics design tokens & color palette
```

---

## ☁️ Backend Synchronization
This mobile app connects directly to the same live Supabase database instance as the web app:
- `flwdsk_employees`
- `flwdsk_employee_attendance`
- `flwdsk_work_sessions`
- `flwdsk_tasks`
- `flwdsk_task_work_sessions`
- `flwdsk_training_batches`
- `flwdsk_enrollments` / `flwdsk_student_records`
- `flwdsk_leave_requests`

Actions taken on mobile reflect in real-time on the management web portal.
