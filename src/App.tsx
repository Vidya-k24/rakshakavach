/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert, 
  ClipboardCheck, 
  History, 
  Zap, 
  HardHat, 
  Grip, 
  Footprints, 
  Glasses, 
  Umbrella, 
  Shirt, 
  Shield, 
  Aperture, 
  Headphones,
  Info,
  ChevronRight,
  PlusCircle,
  Trophy,
  BrainCircuit,
  Calendar,
  MessageSquare,
  Radio,
  X,
  Send,
  Loader2,
  Eye,
  Camera,
  Timer,
  BellRing
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TASKS, GEAR, Task, PPE } from './constants';
import { getRiskAnalysis, getDailyQuiz, askSafetyQuestion } from './services/geminiService';
import ReactMarkdown from 'react-markdown';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';
import { CallNumber } from 'capacitor-call-number';

// Icons map for Lucide components
const ICON_MAP: Record<string, any> = {
  HardHat, Grip, Footprints, Glasses, Umbrella, Shirt, Shield, Aperture, Headphones
};

export default function App() {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [checkedGear, setCheckedGear] = useState<Set<string>>(new Set());
  const [safetyScore, setSafetyScore] = useState(85);
  const [incidents, setIncidents] = useState<{id: string, date: string, type: string, description: string}[]>([]);
  const [riskAnalysis, setRiskAnalysis] = useState<{injury: string, severity: string, proTip: string} | null>(null);
  const [loadingRisk, setLoadingRisk] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizData, setQuizData] = useState<any>(null);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizCorrect, setQuizCorrect] = useState<boolean | null>(null);
  const [consecutiveDays, setConsecutiveDays] = useState(0);
  const [showChat, setShowChat] = useState(false);
  const [chatQuery, setChatQuery] = useState('');
  const [chatResponse, setChatResponse] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const [sosActive, setSosActive] = useState(false);
  const [sosCountdown, setSosCountdown] = useState(5);
  const [supervisorNum, setSupervisorNum] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showXRay, setShowXRay] = useState(false);
  const [xRayStep, setXRayStep] = useState(0);
  const [deadManTimer, setDeadManTimer] = useState<number | null>(null);
  const [showTimerModal, setShowTimerModal] = useState(false);

  const selectedTask = useMemo(() => TASKS.find(t => t.id === selectedTaskId), [selectedTaskId]);

  const safetyRank = useMemo(() => {
    if (safetyScore >= 95) return { name: 'Safety Legend', color: 'text-purple-400' };
    if (safetyScore >= 80) return { name: 'Safety Sentinel', color: 'text-safety-green' };
    if (safetyScore >= 60) return { name: 'Safety Pro', color: 'text-safety-yellow' };
    if (safetyScore >= 40) return { name: 'Safety Rookie', color: 'text-orange-400' };
    return { name: 'Hazard Risk', color: 'text-safety-red' };
  }, [safetyScore]);

  useEffect(() => {
    const initApp = async () => {
      // Load data from Preferences (Simulating Room DB)
      const { value: savedIncidents } = await Preferences.get({ key: 'raksha_incidents' });
      if (savedIncidents) setIncidents(JSON.parse(savedIncidents));

      const { value: savedScore } = await Preferences.get({ key: 'raksha_score' });
      if (savedScore) setSafetyScore(parseInt(savedScore));

      const { value: savedDays } = await Preferences.get({ key: 'raksha_days' });
      if (savedDays) setConsecutiveDays(parseInt(savedDays));

      // Schedule Start-of-Day Notification
      requestNotificationPermission();
    };

    initApp();
  }, []);

  useEffect(() => {
    let interval: any;
    if (deadManTimer !== null && deadManTimer > 0) {
      interval = setInterval(() => {
        setDeadManTimer(prev => (prev !== null ? prev - 1 : 0));
      }, 1000);
    } else if (deadManTimer === 0) {
      triggerSOS();
      setDeadManTimer(null);
    }
    return () => clearInterval(interval);
  }, [deadManTimer]);

  const saveSettings = async (num: string) => {
    setSupervisorNum(num);
    await Preferences.set({ key: 'supervisor_num', value: num });
    setShowSettings(false);
  };

  const requestNotificationPermission = async () => {
    const perm = await LocalNotifications.requestPermissions();
    if (perm.display === 'granted') {
      await LocalNotifications.schedule({
        notifications: [
          {
            title: "Start-of-Day Safety Check",
            body: "Shift starting soon! Open Raksha-Kavach to audit your PPE gear.",
            id: 1,
            schedule: { at: new Date(Date.now() + 1000 * 5) }, // Demo: 5 seconds from now
            sound: 'beep.wav',
          }
        ]
      });
    }
  };

  useEffect(() => {
    if (selectedTaskId) {
      setCheckedGear(new Set());
      setRiskAnalysis(null);
    }
  }, [selectedTaskId]);

  const handleGearToggle = (gearId: string) => {
    const newChecked = new Set(checkedGear);
    if (newChecked.has(gearId)) newChecked.delete(gearId);
    else newChecked.add(gearId);
    setCheckedGear(newChecked);
  };

  const calculateRiskLevel = () => {
    if (!selectedTask) return 0;
    const requiredCount = selectedTask.requiredGear.length;
    const checkedCount = Array.from(checkedGear).filter(g => selectedTask.requiredGear.includes(g)).length;
    return 100 - (checkedCount / requiredCount) * 100;
  };

  const getRiskColor = (level: number) => {
    if (level === 0) return 'text-safety-green';
    if (level < 40) return 'text-yellow-400';
    if (level < 70) return 'text-orange-500';
    return 'text-safety-red';
  };

  const runRiskAnalysis = async () => {
    if (!selectedTask) return;
    setLoadingRisk(true);
    const missing = selectedTask.requiredGear.filter(g => !checkedGear.has(g)).map(id => GEAR[id].name);
    if (missing.length === 0) {
      setRiskAnalysis({ injury: "None. You are fully protected.", severity: "Low", proTip: "Maintain your gear's integrity." });
    } else {
      const analysis = await getRiskAnalysis(selectedTask.name, missing);
      setRiskAnalysis(analysis);
    }
    setLoadingRisk(false);
  };

  const handleReportIncident = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newIncident = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString(),
      type: formData.get('type') as string,
      description: formData.get('description') as string,
    };
    const updated = [newIncident, ...incidents];
    setIncidents(updated);

    // Reset consecutive days on incident
    setConsecutiveDays(0);
    await Preferences.set({ key: 'raksha_days', value: '0' });

    await Preferences.set({ key: 'raksha_incidents', value: JSON.stringify(updated) });
    const newScore = Math.max(0, safetyScore - 10);
    setSafetyScore(newScore);
    await Preferences.set({ key: 'raksha_score', value: newScore.toString() });

    e.currentTarget.reset();
  };

  const loadQuiz = async () => {
    setShowQuiz(true);
    setQuizSubmitted(false);
    setQuizCorrect(null);
    const data = await getDailyQuiz();
    setQuizData(data);
  };

  const submitQuiz = async (index: number) => {
    setQuizSubmitted(true);
    const correct = index === quizData.correctIndex;
    setQuizCorrect(correct);
    if (correct) {
      const newScore = Math.min(100, safetyScore + 5);
      setSafetyScore(newScore);
      await Preferences.set({ key: 'raksha_score', value: newScore.toString() });

      // Increment consecutive days on correct quiz/safe day
      const newDays = consecutiveDays + 1;
      setConsecutiveDays(newDays);
      await Preferences.set({ key: 'raksha_days', value: newDays.toString() });
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatQuery.trim()) return;
    processChat(chatQuery);
  };

  const processChat = async (query: string) => {
    setChatQuery(query);
    setIsChatting(true);
    const response = await askSafetyQuestion(query);
    setChatResponse(response);
    setIsChatting(false);
  };

  const triggerSOS = () => {
    setSosActive(true);
    setSosCountdown(5);
    const interval = setInterval(async () => {
      setSosCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          // NEW: Truly Direct Call via Native Plugin
          CallNumber.call({ number: '112', bypassAppChooser: true });
          setSosActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-industrial-black border-b-4 border-safety-yellow p-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-safety-yellow p-1">
            <ShieldAlert className="text-industrial-black w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black tracking-tighter uppercase italic">Raksha-Kavach</h1>
        </div>
        
        <div className="flex items-center gap-6">
          <button
            onClick={() => setShowTimerModal(true)}
            className={`flex items-center gap-2 px-3 py-1.5 transition-colors ${deadManTimer !== null ? 'bg-safety-red animate-pulse' : 'bg-zinc-800 border border-zinc-700'}`}
          >
            <Timer className={`w-4 h-4 ${deadManTimer !== null ? 'text-white' : 'text-zinc-400'}`} />
            <span className={`text-[10px] font-black uppercase ${deadManTimer !== null ? 'text-white' : 'text-zinc-400'}`}>
              {deadManTimer !== null ? `Safety: ${Math.floor(deadManTimer/60)}:${(deadManTimer%60).toString().padStart(2,'0')}` : 'Safety Timer'}
            </span>
          </button>
          <button
            onClick={() => setShowXRay(true)}
            className="flex items-center gap-2 bg-zinc-800 border border-safety-yellow/30 px-3 py-1.5 hover:bg-zinc-700 transition-colors"
          >
            <Eye className="w-4 h-4 text-safety-yellow" />
            <span className="text-[10px] font-black uppercase text-safety-yellow">Hazard X-Ray</span>
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="text-zinc-500 hover:text-safety-yellow transition-colors"
          >
            <ShieldAlert className="w-5 h-5" />
          </button>
          <div className="hidden md:flex flex-col items-end">
            <span className="text-[10px] uppercase font-bold text-gray-400">Days Safe</span>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-safety-green" />
              <span className="text-xl font-mono font-bold text-safety-green">{consecutiveDays}</span>
            </div>
          </div>
          <div className="hidden md:flex flex-col items-end border-l border-zinc-800 pl-6">
            <span className="text-[10px] uppercase font-bold text-gray-400">Current Rank</span>
            <div className="flex items-center gap-2">
              <Shield className={`w-4 h-4 ${safetyRank.color}`} />
              <span className={`text-xl font-black italic uppercase tracking-tighter ${safetyRank.color}`}>
                {safetyRank.name}
              </span>
            </div>
          </div>
          <div className="hidden md:flex flex-col items-end border-l border-zinc-800 pl-6">
            <span className="text-[10px] uppercase font-bold text-gray-400">Current Rank</span>
            <div className="flex items-center gap-2">
              <Shield className={`w-4 h-4 ${safetyRank.color}`} />
              <span className={`text-xl font-black italic uppercase tracking-tighter ${safetyRank.color}`}>
                {safetyRank.name}
              </span>
            </div>
          </div>
          <div className="hidden md:flex flex-col items-end border-l border-zinc-800 pl-6">
            <span className="text-[10px] uppercase font-bold text-gray-400">Safety Score</span>
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-safety-yellow" />
              <span className="text-xl font-mono font-bold">{safetyScore}%</span>
            </div>
          </div>
          <button 
            onClick={loadQuiz}
            className="bg-safety-yellow text-industrial-black px-4 py-2 font-bold uppercase text-xs flex items-center gap-2 hover:bg-white transition-colors"
          >
            <BrainCircuit className="w-4 h-4" />
            <span className="hidden sm:inline">Daily Quiz</span>
          </button>
        </div>
      </header>

      <main className="flex-1 container mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Task & Checklist */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Task Selection */}
          <section className="bg-zinc-900 border border-zinc-800 p-6 rounded-none relative overflow-hidden group">
            <div className="absolute top-0 right-0 hazard-stripes h-2 w-32 opacity-20 group-hover:opacity-100 transition-opacity" />
            <h2 className="text-sm uppercase font-bold text-safety-yellow mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4" /> 01 Select Current Task
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {TASKS.map(task => (
                <button
                  key={task.id}
                  onClick={() => setSelectedTaskId(task.id)}
                  className={`p-4 border-2 flex flex-col text-left transition-all ${
                    selectedTaskId === task.id 
                    ? 'border-safety-yellow bg-safety-yellow/10' 
                    : 'border-zinc-800 hover:border-zinc-600 bg-zinc-900/50'
                  }`}
                >
                  <span className="text-lg font-bold">{task.name}</span>
                  <span className="text-xs text-zinc-500 mt-1">{task.description}</span>
                  <div className="mt-4 flex items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                      task.baseRisk === 'Extreme' ? 'bg-red-900 text-red-200' :
                      task.baseRisk === 'High' ? 'bg-orange-900 text-orange-200' :
                      'bg-green-900 text-green-200'
                    }`}>
                      {task.baseRisk} Risk
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* PPE Checklist */}
          {selectedTask && (
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-zinc-900 border border-zinc-800 p-6 rounded-none"
            >
              <h2 className="text-sm uppercase font-bold text-safety-yellow mb-6 flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4" /> 02 PPE Checklist: {selectedTask.name}
              </h2>
              
              <div className="flex flex-col lg:flex-row gap-8">
                <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {selectedTask.requiredGear.map(gearId => {
                    const gear = GEAR[gearId];
                    const Icon = ICON_MAP[gear.icon];
                    const isChecked = checkedGear.has(gearId);
                    return (
                      <button
                        key={gearId}
                        onClick={() => handleGearToggle(gearId)}
                        className={`group relative p-4 aspect-square flex flex-col items-center justify-center border-2 transition-all gap-2 ${
                          isChecked 
                          ? 'border-safety-green bg-safety-green/5' 
                          : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/50'
                        }`}
                      >
                        <div className={`p-2 transition-transform group-active:scale-95 ${
                          isChecked ? 'text-safety-green' : 'text-zinc-600'
                        }`}>
                          {Icon && <Icon className="w-8 h-8" />}
                        </div>
                        <span className={`text-[9px] uppercase font-bold text-center ${
                          isChecked ? 'text-white' : 'text-zinc-500'
                        }`}>{gear.name}</span>
                        
                        {isChecked && (
                          <CheckCircle2 className="absolute top-1 right-1 w-4 h-4 text-safety-green" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Simulated 3D Avatar (Icon-based) */}
                <div className="w-full lg:w-48 bg-zinc-800/50 border border-zinc-800 flex flex-col items-center justify-center p-6 relative">
                  <div className="text-[10px] uppercase font-bold text-zinc-500 absolute top-2 left-2">Simulation</div>
                  <div className="relative w-32 h-48 flex items-center justify-center">
                    {/* Character Base */}
                    <div className="absolute w-12 h-24 bg-zinc-700 rounded-full opacity-50" />
                    
                    {/* Layered Gear */}
                    <AnimatePresence>
                      {checkedGear.has('helmet') && (
                        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: -28, opacity: 1 }} className="absolute text-safety-yellow">
                          <HardHat className="w-10 h-10" />
                        </motion.div>
                      )}
                      {checkedGear.has('mask') && (
                        <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="absolute text-white z-10">
                          <Aperture className="w-6 h-6 mt-[-10px]" />
                        </motion.div>
                      )}
                      {(checkedGear.has('apron') || checkedGear.has('vest')) && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`absolute px-4 py-8 border-2 rounded ${checkedGear.has('vest') ? 'border-safety-yellow' : 'border-zinc-500'}`} />
                      )}
                      {checkedGear.has('gloves') && (
                        <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: -24, opacity: 1 }} className="absolute text-zinc-400">
                          <Grip className="w-6 h-6 mt-4" />
                        </motion.div>
                      )}
                      {checkedGear.has('boots') && (
                        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 24, opacity: 1 }} className="absolute text-zinc-300">
                          <Footprints className="w-10 h-10" />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Character Head/Body wireframe if no gear */}
                    {!checkedGear.has('helmet') && <div className="absolute w-6 h-6 rounded-full border border-zinc-600 top-[20%]" />}
                    <div className="absolute w-8 h-12 border border-zinc-600 top-[35%]" />
                  </div>
                  <div className="mt-4 text-[9px] uppercase font-bold text-zinc-500 text-center">Equipment Visualization</div>
                </div>
              </div>

              <div className="mt-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-t border-zinc-800 pt-6">
                <div>
                  <div className="text-[10px] uppercase font-bold text-zinc-500 mb-1">Equipment Compliance</div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-zinc-800 h-2 w-48 relative">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(checkedGear.size / selectedTask.requiredGear.length) * 100}%` }}
                        className="absolute h-full bg-safety-green shadow-[0_0_10px_rgba(34,197,94,0.5)]"
                      />
                    </div>
                    <span className="font-mono text-sm font-bold">
                      {checkedGear.size}/{selectedTask.requiredGear.length}
                    </span>
                  </div>
                </div>
                
                <button 
                  onClick={runRiskAnalysis}
                  disabled={loadingRisk}
                  className="bg-white text-industrial-black px-6 py-3 font-black uppercase text-sm hover:bg-safety-yellow transition-colors disabled:opacity-50"
                >
                  {loadingRisk ? 'Auditing...' : 'Analyze Risk Assessment'}
                </button>
              </div>
            </motion.section>
          )}

          {/* AI Risk Output */}
          <AnimatePresence>
            {riskAnalysis && (
              <motion.section
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="safety-border bg-zinc-900 p-8"
              >
                <div className="flex flex-col md:flex-row gap-8">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-4">
                      <AlertTriangle className={getRiskColor(calculateRiskLevel())} />
                      <h3 className="text-xl font-black uppercase tracking-tight">AI Safety Audit Result</h3>
                    </div>
                    
                    <div className="space-y-6">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-safety-yellow">Likely Injury Case</span>
                        <div className="text-lg font-bold leading-tight markdown-body">
                          <ReactMarkdown>{riskAnalysis.injury}</ReactMarkdown>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-zinc-800 p-3">
                          <span className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">Severity Rating</span>
                          <span className={`text-xl font-black uppercase ${
                            riskAnalysis.severity.toLowerCase().includes('high') || riskAnalysis.severity.toLowerCase().includes('extreme') 
                            ? 'text-safety-red' : 'text-safety-yellow'
                          }`}>
                            {riskAnalysis.severity}
                          </span>
                        </div>
                        <div className="bg-zinc-800 p-3">
                          <span className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">Audit Status</span>
                          <span className="text-xl font-black text-white uppercase italic">Verified</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="w-full md:w-64 bg-zinc-800 p-4 border-l-4 border-safety-yellow">
                    <Info className="w-6 h-6 text-safety-yellow mb-3" />
                    <h4 className="text-xs font-black uppercase mb-2">Safety Pro-Tip</h4>
                    <div className="text-sm text-zinc-300 italic markdown-body">
                      <ReactMarkdown>{riskAnalysis.proTip}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </div>

        {/* Right Column: Stats & Logs */}
        <div className="space-y-8">
          
          {/* Risk Meter Visual */}
          <section className="bg-zinc-900 border border-zinc-800 p-6 rounded-none">
            <h2 className="text-sm uppercase font-bold text-safety-yellow mb-4">Risk Level Meter</h2>
            <div className="relative h-48 flex items-end gap-1 px-4">
              {[...Array(10)].map((_, i) => {
                const level = calculateRiskLevel();
                const active = (10 - i) * 10 <= level;
                return (
                  <div 
                    key={i} 
                    className="flex-1 transition-all duration-500"
                    style={{ 
                      height: `${(i + 1) * 10}%`,
                      backgroundColor: active ? (level > 70 ? '#FF0000' : level > 40 ? '#F97316' : '#FFD700') : '#27272a'
                    }}
                  />
                );
              })}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className={`text-6xl font-black font-mono italic ${getRiskColor(calculateRiskLevel())}`}>
                  {Math.round(calculateRiskLevel())}%
                </span>
              </div>
            </div>
            <div className="mt-4 text-center">
              <span className="text-[10px] uppercase font-bold text-zinc-500">Live Mortality Projection</span>
            </div>
          </section>

          {/* Incident Reporter */}
          <section className="bg-zinc-900 border border-zinc-800 p-6 rounded-none">
            <h2 className="text-sm uppercase font-bold text-safety-yellow mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Report Near-Miss
            </h2>
            <form onSubmit={handleReportIncident} className="space-y-4">
              <div>
                <select 
                  name="type"
                  required
                  className="w-full bg-zinc-800 border-none p-3 text-sm focus:ring-2 focus:ring-safety-yellow outline-none"
                >
                  <option value="">Incident Category</option>
                  <option value="equipment">Equipment Failure</option>
                  <option value="slip">Slip/Trip/Fall</option>
                  <option value="exposure">Chemical Exposure</option>
                  <option value="behavior">Unsafe Behavior</option>
                </select>
              </div>
              <textarea 
                name="description"
                placeholder="Describe current observation..."
                required
                className="w-full bg-zinc-800 border-none p-3 text-sm h-24 focus:ring-2 focus:ring-safety-yellow outline-none resize-none"
              />
              <button 
                type="submit"
                className="w-full flex items-center justify-center gap-2 bg-zinc-700 hover:bg-zinc-600 p-3 text-xs font-bold uppercase transition-colors"
              >
                <PlusCircle className="w-4 h-4" /> Log Observation
              </button>
            </form>
          </section>

          {/* Incident Log */}
          <section className="bg-zinc-900 border border-zinc-800 p-6 rounded-none">
            <h2 className="text-sm uppercase font-bold text-zinc-500 mb-4 flex items-center gap-2">
              <History className="w-4 h-4" /> Incident History
            </h2>
            <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
              {incidents.length === 0 ? (
                <div className="text-zinc-600 text-xs italic text-center py-4">No logged incidents</div>
              ) : (
                incidents.map(inc => (
                  <div key={inc.id} className="bg-zinc-800/50 p-3 border-l-2 border-zinc-600 hover:border-safety-yellow transition-colors">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-[10px] font-bold uppercase text-zinc-500">{inc.type}</span>
                      <span className="text-[9px] font-mono text-zinc-600">{inc.date}</span>
                    </div>
                    <p className="text-xs text-zinc-300 leading-tight">{inc.description}</p>
                  </div>
                ))
              )}
            </div>
          </section>

        </div>
      </main>

      {/* Daily Quiz Modal */}
      <AnimatePresence>
        {showQuiz && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-industrial-black/90 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 border-4 border-safety-yellow w-full max-w-lg p-8 relative"
            >
              <button 
                onClick={() => setShowQuiz(false)}
                className="absolute top-4 right-4 text-zinc-500 hover:text-white"
              >
                <History className="w-6 h-6 rotate-45" />
              </button>

              {!quizData ? (
                <div className="flex flex-col items-center py-12 gap-4">
                  <div className="w-12 h-12 border-4 border-safety-yellow border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-bold uppercase tracking-widest animate-pulse">Syncing Safety Intelligence...</span>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="text-xs font-bold uppercase text-safety-yellow tracking-widest">Daily Safety Challenge</div>
                  <h3 className="text-xl font-bold leading-snug">{quizData.question}</h3>
                  
                  <div className="space-y-3">
                    {quizData.options.map((option: string, i: number) => (
                      <button
                        key={i}
                        disabled={quizSubmitted}
                        onClick={() => submitQuiz(i)}
                        className={`w-full text-left p-4 border-2 transition-all flex items-center justify-between ${
                          quizSubmitted
                          ? i === quizData.correctIndex 
                            ? 'border-safety-green bg-safety-green/10 text-safety-green' 
                            : 'border-zinc-800 text-zinc-600'
                          : 'border-zinc-800 hover:border-safety-yellow hover:bg-zinc-800'
                        }`}
                      >
                        <span className="text-sm font-medium">{option}</span>
                        {quizSubmitted && i === quizData.correctIndex && <CheckCircle2 className="w-5 h-5" />}
                        {quizSubmitted && i !== quizData.correctIndex && quizCorrect === false && i === quizCorrect && <AlertTriangle className="w-5 h-5 text-safety-red" />}
                      </button>
                    ))}
                  </div>

                  {quizSubmitted && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-4 ${quizCorrect ? 'bg-safety-green/10 border border-safety-green' : 'bg-red-900/10 border border-safety-red'}`}
                    >
                      <div className="text-xs font-bold uppercase mb-1">{quizCorrect ? 'Correct Bonus +2%' : 'Incorrect Response'}</div>
                      <p className="text-sm leading-tight opacity-80">{quizData.explanation}</p>
                      <button 
                        onClick={() => setShowQuiz(false)}
                        className="mt-4 w-full bg-white text-industrial-black py-2 text-xs font-bold uppercase"
                      >
                        Continue Work
                      </button>
                    </motion.div>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer / Status Bar */}
      <footer className="bg-zinc-900 border-t border-zinc-800 p-2 px-4 flex justify-between items-center text-[9px] uppercase font-bold text-zinc-500">
        <div className="flex gap-4">
          <span className="flex items-center gap-1"><Shield className="w-3 h-3 text-safety-green" /> System Operational</span>
          <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-safety-yellow" /> Site: Sector-7G</span>
        </div>
        <div className="font-mono">Sync v2.4.0-GENAI</div>
      </footer>

      {/* SOS Button */}
      <div className="fixed bottom-10 right-6 flex flex-col items-end gap-4 z-50">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowChat(!showChat)}
          className="bg-zinc-800 text-white p-4 rounded-full shadow-2xl border-2 border-zinc-700 hover:border-safety-yellow transition-colors"
        >
          <MessageSquare className="w-6 h-6" />
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={triggerSOS}
          className="bg-safety-red text-white p-4 rounded-full shadow-2xl border-2 border-white animate-pulse"
        >
          <Radio className="w-6 h-6" />
        </motion.button>
      </div>

      {/* Raksha-Bot Chat Modal */}
      <AnimatePresence>
        {showChat && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.9 }}
            className="fixed bottom-28 right-6 w-80 bg-zinc-900 border-2 border-zinc-800 shadow-2xl z-50 overflow-hidden"
          >
            <div className="bg-zinc-800 p-3 flex justify-between items-center border-b-2 border-safety-yellow">
              <div className="flex items-center gap-2">
                <BrainCircuit className="w-4 h-4 text-safety-yellow" />
                <span className="text-xs font-black uppercase">Raksha-AI Assistant</span>
              </div>
              <button onClick={() => setShowChat(false)}><X className="w-4 h-4 text-zinc-500 hover:text-white" /></button>
            </div>
            <div className="p-4 h-64 overflow-y-auto custom-scrollbar text-sm bg-zinc-900">
              {chatResponse ? (
                <div className="space-y-4">
                  <div className="bg-zinc-800 p-3 rounded-tr-xl rounded-bl-xl border-l-2 border-safety-yellow italic text-zinc-300">
                    {chatResponse}
                  </div>
                  <button onClick={() => {setChatResponse(''); setChatQuery('');}} className="text-[10px] uppercase font-bold text-zinc-500 hover:text-white">Ask another question</button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-col justify-center items-center text-center gap-3 mb-4">
                    <Info className="w-6 h-6 text-zinc-700" />
                    <p className="text-zinc-500 text-[10px] uppercase font-bold">Quick Safety Queries</p>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      "How to handle a gas leak?",
                      "Fire extinguisher protocol",
                      "Heatstroke prevention tips",
                      "Electrical shock first aid",
                      "Chemical spill cleanup",
                      "Confined space protocol",
                      "LOTO procedure steps",
                      "Eye injury first aid",
                      "Working near heavy machinery"
                    ].map((q, i) => (
                      <button
                        key={i}
                        onClick={() => processChat(q)}
                        className="text-left bg-zinc-800/50 hover:bg-zinc-800 p-2 text-[10px] border-l-2 border-zinc-700 hover:border-safety-yellow transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <form onSubmit={handleChatSubmit} className="p-3 bg-zinc-800 flex gap-2">
              <input
                value={chatQuery}
                onChange={(e) => setChatQuery(e.target.value)}
                placeholder="Type your safety query..."
                className="flex-1 bg-zinc-900 border-none p-2 text-xs focus:ring-1 focus:ring-safety-yellow outline-none text-white"
              />
              <button disabled={isChatting} className="text-safety-yellow disabled:opacity-50">
                {isChatting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SOS Alert Modal */}
      <AnimatePresence>
        {sosActive && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-red-900/90 backdrop-blur-xl">
            <motion.div
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              className="text-center"
            >
              <Radio className="w-24 h-24 text-white mx-auto mb-6 animate-ping" />
              <h2 className="text-6xl font-black text-white mb-2 uppercase italic">Emergency SOS</h2>
              <p className="text-xl text-white/80 font-bold mb-8 uppercase tracking-widest">Broadcasting to Sector-7G Command...</p>

              <div className="text-9xl font-black text-white mb-12">{sosCountdown}</div>

              <div className="flex flex-col gap-4 items-center">
                <button
                  onClick={async () => {
                    setSosActive(false);
                    await CallNumber.call({ number: '112', bypassAppChooser: true });
                  }}
                  className="bg-white text-red-900 px-12 py-6 text-2xl font-black uppercase hover:bg-zinc-200 transition-all shadow-[0_0_30px_rgba(255,255,255,0.5)]"
                >
                  Call 112
                </button>

                {supervisorNum && (
                  <button
                    onClick={async () => {
                      setSosActive(false);
                      await CallNumber.call({ number: supervisorNum, bypassAppChooser: true });
                    }}
                    className="bg-safety-yellow text-industrial-black px-12 py-4 text-xl font-black uppercase hover:bg-white transition-all"
                  >
                    Direct Supervisor
                  </button>
                )}

                <button
                  onClick={() => setSosActive(false)}
                  className="text-white/60 text-sm font-bold uppercase tracking-widest hover:text-white transition-colors"
                >
                  Cancel Protocol
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dead Man's Switch / Safety Timer Modal */}
      <AnimatePresence>
        {showTimerModal && (
          <div className="fixed inset-0 z-[170] flex items-center justify-center p-4 bg-industrial-black/95 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-zinc-900 border-2 border-safety-red p-8 max-w-sm w-full text-center"
            >
              <BellRing className="w-12 h-12 text-safety-red mx-auto mb-4 animate-bounce" />
              <h3 className="text-xl font-black uppercase mb-2 italic text-safety-red">Safety Watchdog</h3>
              <p className="text-xs text-zinc-400 mb-6">If you don't check-in before the timer ends, we will automatically call 112.</p>

              <div className="grid grid-cols-2 gap-3 mb-6">
                {[1, 5, 10, 30].map(m => (
                  <button
                    key={m}
                    onClick={() => { setDeadManTimer(m * 60); setShowTimerModal(false); }}
                    className="bg-zinc-800 hover:bg-zinc-700 p-3 text-xs font-bold text-white border border-zinc-700"
                  >
                    {m} Minutes
                  </button>
                ))}
              </div>

              {deadManTimer !== null && (
                <button
                  onClick={() => { setDeadManTimer(null); setShowTimerModal(false); }}
                  className="w-full bg-safety-green text-industrial-black font-black py-3 uppercase text-xs mb-2"
                >
                  I am Safe (Stop Timer)
                </button>
              )}

              <button
                onClick={() => setShowTimerModal(false)}
                className="w-full text-zinc-500 text-[10px] font-bold uppercase hover:text-white"
              >
                Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hazard X-Ray AR Simulation Modal */}
      <AnimatePresence>
        {showXRay && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-industrial-black/95 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 border-2 border-safety-yellow max-w-lg w-full relative overflow-hidden"
            >
              {/* Camera Viewfinder Overlay */}
              <div className="aspect-video bg-zinc-800 relative flex items-center justify-center border-b-2 border-zinc-800">
                <Camera className="w-12 h-12 text-zinc-700 absolute" />
                <div className="absolute inset-0 border-[20px] border-industrial-black/50" />

                {/* Simulated AR Hazards */}
                {xRayStep === 1 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 flex items-center justify-center">
                    <div className="w-32 h-32 border-2 border-safety-red rounded-full animate-ping absolute" />
                    <div className="bg-safety-red/20 border border-safety-red p-2 text-center">
                      <AlertTriangle className="w-6 h-6 text-safety-red mx-auto" />
                      <span className="text-[8px] font-black uppercase text-safety-red">Extreme Heat Source Detected</span>
                    </div>
                  </motion.div>
                )}
                {xRayStep === 2 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute top-10 right-10">
                    <div className="bg-blue-500/20 border border-blue-500 p-2">
                      <Zap className="w-6 h-6 text-blue-400 mx-auto animate-pulse" />
                      <span className="text-[8px] font-black uppercase text-blue-400">High Voltage Link</span>
                    </div>
                  </motion.div>
                )}

                <div className="absolute top-4 left-4 flex items-center gap-2">
                  <div className="w-2 h-2 bg-safety-red rounded-full animate-pulse" />
                  <span className="text-[8px] font-mono text-white/50 uppercase">Live AR Analysis</span>
                </div>
              </div>

              <div className="p-6">
                <h3 className="text-xl font-black uppercase italic mb-2">Hazard X-Ray (AR Scan)</h3>
                <p className="text-xs text-zinc-400 mb-6">
                  Uses computer vision to detect "invisible" workplace hazards like gas leaks, voltage, and structural stress.
                </p>

                <div className="space-y-4">
                  {xRayStep === 0 && (
                    <button
                      onClick={() => setXRayStep(1)}
                      className="w-full bg-safety-yellow text-industrial-black font-black py-4 uppercase text-sm tracking-widest"
                    >
                      Start Environment Scan
                    </button>
                  )}
                  {xRayStep === 1 && (
                    <div className="bg-red-900/20 border-l-4 border-safety-red p-4">
                      <h4 className="text-xs font-bold uppercase text-safety-red mb-1">Thermal Anomaly Detected</h4>
                      <p className="text-[10px] text-zinc-300">Potential pipe leak or overheating motor detected behind panel.</p>
                      <button onClick={() => setXRayStep(2)} className="mt-4 text-[10px] font-black uppercase text-white hover:underline">Scan Next Layer</button>
                    </div>
                  )}
                  {xRayStep === 2 && (
                    <div className="bg-blue-900/20 border-l-4 border-blue-500 p-4">
                      <h4 className="text-xs font-bold uppercase text-blue-400 mb-1">Static Electricity Warning</h4>
                      <p className="text-[10px] text-zinc-300">Surface tension exceeds safety limits. Use grounded tools.</p>
                      <button onClick={() => setXRayStep(0)} className="mt-4 text-[10px] font-black uppercase text-white hover:underline">Restart Scan</button>
                    </div>
                  )}

                  <button
                    onClick={() => { setShowXRay(false); setXRayStep(0); }}
                    className="w-full bg-zinc-800 text-white font-bold py-3 uppercase text-xs"
                  >
                    Exit X-Ray Mode
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-industrial-black/90 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-zinc-900 border-2 border-safety-yellow p-8 max-w-sm w-full"
            >
              <h3 className="text-xl font-black uppercase mb-6 italic">Safety Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase text-zinc-500 block mb-2">Supervisor Emergency Number</label>
                  <input
                    type="tel"
                    placeholder="Enter 10-digit number"
                    defaultValue={supervisorNum}
                    id="super-num"
                    className="w-full bg-zinc-800 border-none p-4 text-white font-mono focus:ring-2 focus:ring-safety-yellow outline-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => saveSettings((document.getElementById('super-num') as HTMLInputElement).value)}
                    className="flex-1 bg-safety-yellow text-industrial-black font-bold py-3 uppercase text-xs"
                  >
                    Save Protocol
                  </button>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="flex-1 bg-zinc-800 text-white font-bold py-3 uppercase text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
