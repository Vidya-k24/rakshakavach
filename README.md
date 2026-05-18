# Raksha-Kavach: GenAI-Powered Industrial Safety Auditor

**Raksha-Kavach** is an advanced safety application designed to protect workers in high-risk industrial environments. By combining Generative AI, Augmented Reality (AR) simulation, and automated emergency response, it transforms safety protocols into an interactive, life-saving experience.

## 🚀 Key Features

- **GenAI Safety Auditor**: Analyzes PPE status using Google Gemini AI and predicts "Likely Injury" cases for missing gear.
- **Hazard X-Ray (AR Simulation)**: A unique tool to scan the workplace for invisible hazards like thermal anomalies and high-voltage static.
- **Safety Watchdog (Dead Man’s Switch)**: A critical safety timer that automatically triggers an SOS call if the worker becomes incapacitated.
- **Direct Emergency SOS**: Instant, one-tap calling to emergency services (112) or a site supervisor.
- **Safety Guardian Rank**: Gamifies safety compliance with ranks from "Rookie" to "Legend" based on safety scores and quiz streaks.
- **Daily Safety Quiz**: AI-generated challenges to build a proactive safety-first culture.

## 🛠️ Technical Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Framer Motion
- **Native Bridge**: Capacitor.js (Android SDK)
- **AI Engine**: Google Gemini 2.0 Flash
- **Persistence**: Capacitor Preferences (Native Mobile Storage)
- **Notifications**: Capacitor Local Notifications

## 📱 Installation & Run

1. **Clone the repository**
2. **Install dependencies**: `npm install`
3. **Android Build**:
   - `npm run build`
   - `npx cap sync android`
   - Open the `android` folder in Android Studio and click **Run**.

---
*Developed for the MindMatrix VTU Internship Program.*
