/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY || '';
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export async function getRiskAnalysis(task: string, missingGear: string[]) {
  if (!ai) {
    // Demo Mode Fallback
    const demoRisks: Record<string, any> = {
      "Industrial Welding": { injury: "Severe retinal damage and skin burns from UV radiation.", severity: "High", proTip: "Always check the shade level of your welding mask lens." },
      "Work at Height": { injury: "Fatal fall from height due to lack of fall arrest system.", severity: "Extreme", proTip: "Double-check your harness attachment points before climbing." },
      "Excavation / Digging": { injury: "Traumatic injury from trench collapse or moving machinery.", severity: "Medium", proTip: "Ensure trench shoring is in place for depths over 5 feet." },
      "Electrical Maintenance": { injury: "High-voltage electrocution leading to cardiac arrest.", severity: "Extreme", proTip: "Verify 'Lock-Out Tag-Out' (LOTO) is complete before touching wires." }
    };
    return demoRisks[task] || { injury: "Serious physical trauma from unprotected exposure.", severity: "High", proTip: "Don't take shortcuts with safety gear." };
  }
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `As an industrial safety expert, analyze the risk for a worker performing ${task} but missing the following PPE: ${missingGear.join(", ")}.
      Provide:
      1. A short, blunt "Likely Injury" warning.
      2. A "Risk Severity" (Low, Medium, High, Extreme).
      3. A tiny "Safety Pro-Tip".
      Format as JSON with keys: injury, severity, proTip.`,
      config: {
        responseMimeType: "application/json",
      },
    });
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Gemini Error:", error);
    return { injury: "Unknown risk", severity: "Unknown", proTip: "Follow local site rules." };
  }
}

export async function getDailyQuiz() {
  if (!ai) {
    // Demo Mode Fallback
    return {
      question: "What is the primary purpose of a 'Lock-Out Tag-Out' (LOTO) procedure?",
      options: ["To prevent theft", "To ensure machinery cannot be energized during repair", "To keep unauthorized people away", "To organize tool storage"],
      correctIndex: 1,
      explanation: "LOTO is a safety procedure used to ensure that dangerous machines are properly shut off and not able to be started up again prior to the completion of maintenance or repair work."
    };
  }
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `Generate a one-question multiple-choice safety quiz for industrial workers.
      Format as JSON with keys: question, options (array of strings), correctIndex (number), explanation.`,
      config: {
        responseMimeType: "application/json",
      },
    });
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Gemini Error:", error);
    return null;
  }
}

export async function askSafetyQuestion(question: string) {
  if (!ai) {
    // Demo Mode Fallback
    const q = question.toLowerCase();
    if (q.includes("gas leak")) return "Evacuate the area immediately, do not operate electrical switches, and report to the safety supervisor from a safe distance.";
    if (q.includes("fire")) return "Use the PASS method: Pull the pin, Aim at the base, Squeeze the handle, Sweep side to side.";
    if (q.includes("heat")) return "Drink plenty of water, take breaks in shaded areas, and watch for signs of dizziness or heavy sweating.";
    if (q.includes("first aid") || q.includes("shock")) return "Disconnect the power source if safe, call for medical help, and do not touch the victim with bare hands if they are still in contact with power.";
    if (q.includes("chemical") || q.includes("spill")) return "Identify the substance from its label or MSDS. Alert others, cordone off the area, and use appropriate absorption materials (spill kits) if trained to do so.";
    if (q.includes("confined")) return "Never enter without a permit, a dedicated standby person, and atmospheric testing. Ensure ventilation is active and rescue equipment is nearby.";
    if (q.includes("loto")) return "1. Prepare for shutdown. 2. Shut down equipment. 3. Isolate energy. 4. Apply locks/tags. 5. Release stored energy. 6. Verify isolation.";
    if (q.includes("eye")) return "Immediately flush the eye with clean water or saline for at least 15 minutes. Do not rub the eye. Seek medical attention immediately.";
    if (q.includes("machinery") || q.includes("heavy")) return "Maintain a safe distance, make eye contact with operators before approaching, and never stand in 'blind spots' or 'crush zones'.";
    if (q.includes("ppe") || q.includes("maintenance")) return "Inspect your gear daily for cracks, wear, or damage. Replace any equipment that has survived an impact or heavy fall.";
    return "To get a specific AI response, please add a Gemini API Key. For now, remember: Safety is no accident!";
  }
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `You are a safety expert at an industrial site. Answer this safety question briefly and professionally: ${question}`,
    });
    return response.text || "I'm not sure about that safety protocol. Please consult your supervisor.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Error connecting to safety database.";
  }
}

