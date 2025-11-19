import React, { useState } from 'react';
import { Users, Mail, Play, Settings, Clock, CheckCircle, XCircle, Moon } from 'lucide-react';

const ROLES = {
  lupo: {
    name: 'Lupo Mannaro',
    description: 'Ogni notte elimini un giocatore. Vinci se i lupi diventano maggioranza.',
    team: 'lupi',
    icon: '🐺'
  },
  veggente: {
    name: 'Veggente',
    description: 'Ogni notte puoi scoprire il ruolo di un giocatore.',
    team: 'villaggio',
    icon: '🔮'
  },
  guardia: {
    name: 'Guardia del Corpo',
    description: 'Ogni notte puoi proteggere un giocatore dalla morte.',
    team: 'villaggio',
    icon: '🛡️'
  },
  cupido: {
    name: 'Cupido',
    description: 'La prima notte scegli due innamorati. Se uno muore, muore anche l\'altro.',
    team: 'villaggio',
    icon: '💘'
  },
  cacciatore: {
    name: 'Cacciatore',
    description: 'Quando muori, puoi eliminare un altro giocatore.',
    team: 'villaggio',
    icon: '🏹'
  },
  strega: {
    name: 'Strega',
    description: 'Hai una pozione di vita e una di morte da usare una volta ciascuna.',
    team: 'villaggio',
    icon: '🧙‍♀️'
  },
  villico: {
    name: 'Semplice Villico',
    description: 'Non hai poteri speciali. Usa la logica per trovare i lupi!',
    team: 'villaggio',
    icon: '👤'
  }
};

const EMAILJS_CONFIG = {
  serviceId: 'service_y5ydcb8',
  templateId: 'template_fk57qj7',
  publicKey: 'xhouAiPAy82A7TZl_'
};

// Inserisci qui la tua OpenAI API Key (opzionale - se vuoi usare ChatGPT)
const OPENAI_API_KEY = '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'; // es: 'sk-proj-...'

export default function LupusGame() {
  const [screen, setScreen] = useState('setup');
  const [players, setPlayers] = useState([]);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerEmail, setNewPlayerEmail] = useState('');
  const [selectedRoles, setSelectedRoles] = useState(['lupo', 'veggente', 'guardia', 'villico']);
  const [gameState, setGameState] = useState(null);
  const [currentRiddle, setCurrentRiddle] = useState(null);
  const [riddleAnswer, setRiddleAnswer] = useState('');
  const [timeLeft, setTimeLeft] = useState(300);
  const [timerActive, setTimerActive] = useState(false);
  const [riddleStartTime, setRiddleStartTime] = useState(null);
  const [usedRiddles, setUsedRiddles] = useState(new Set());

  React.useEffect(() => {
    let interval;
    if (timerActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(t => t - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setTimerActive(false);
    }
    return () => clearInterval(interval);
  }, [timerActive, timeLeft]);

  const addPlayer = () => {
    if (newPlayerName && newPlayerEmail) {
      setPlayers([...players, { name: newPlayerName, email: newPlayerEmail, alive: true, points: 0 }]);
      setNewPlayerName('');
      setNewPlayerEmail('');
    }
  };

  const removePlayer = (index) => {
    setPlayers(players.filter((_, i) => i !== index));
  };

  const toggleRole = (roleKey) => {
    if (roleKey === 'lupo' || roleKey === 'villico') return;
    setSelectedRoles(prev => 
      prev.includes(roleKey) ? prev.filter(r => r !== roleKey) : [...prev, roleKey]
    );
  };

  const calculateWolves = (playerCount) => {
    if (playerCount < 5) return 1;
    if (playerCount < 9) return 2;
    if (playerCount < 13) return 3;
    return 4;
  };

  const assignRoles = () => {
    const numPlayers = players.length;
    const numWolves = calculateWolves(numPlayers);
    
    const rolePool = [];
    for (let i = 0; i < numWolves; i++) rolePool.push('lupo');
    
    const specialRoles = selectedRoles.filter(r => r !== 'lupo' && r !== 'villico');
    rolePool.push(...specialRoles);
    
    while (rolePool.length < numPlayers) {
      rolePool.push('villico');
    }
    
    const shuffled = rolePool.sort(() => Math.random() - 0.5);
    return players.map((p, i) => ({ ...p, role: shuffled[i] }));
  };

  const sendEmailViaAPI = async (player, role) => {
    try {
      const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service_id: EMAILJS_CONFIG.serviceId,
          template_id: EMAILJS_CONFIG.templateId,
          user_id: EMAILJS_CONFIG.publicKey,
          template_params: {
            player_name: player.name,
            to_email: player.email,
            role_icon: ROLES[role].icon,
            role_name: ROLES[role].name,
            role_description: ROLES[role].description
          }
        })
      });
      
      if (response.ok) {
        return { success: true };
      } else {
        const error = await response.text();
        return { success: false, error };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const startGame = async () => {
    const playersWithRoles = assignRoles();
    
    const sending = confirm(`Vuoi inviare le email con i ruoli a ${playersWithRoles.length} giocatori?`);
    
    if (sending) {
      let successCount = 0;
      let failCount = 0;
      
      for (const player of playersWithRoles) {
        const result = await sendEmailViaAPI(player, player.role);
        if (result.success) {
          successCount++;
        } else {
          console.error(`Errore invio email a ${player.name}:`, result.error);
          failCount++;
        }
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      alert(`✅ ${successCount} email inviate con successo!${failCount > 0 ? `\n⚠️ ${failCount} email non inviate` : ''}`);
    }
    
    setGameState({
      players: playersWithRoles,
      day: 1,
      phase: 'day',
      riddlesSolved: 0,
      totalPoints: 0
    });
    
    setScreen('game');
    setUsedRiddles(new Set());
    generateRiddle();
  };

  const generateRiddle = async () => {
    setCurrentRiddle({ loading: true });
    setRiddleStartTime(Date.now());
    
    let riddle = null;
    
    // Prova prima con ChatGPT se hai la chiave
    if (OPENAI_API_KEY) {
      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: "gpt-4o-mini", // Modello economico
            messages: [
              { 
                role: "user", 
                content: `Crea un enigma originale e divertente per un gioco di Lupus in Fabula. NON usare questi enigmi già usati: ${Array.from(usedRiddles).join(', ')}. L'enigma deve essere risolvibile in gruppo in 5 minuti. Rispondi SOLO con un JSON in questo formato:
{"enigma": "testo dell'enigma", "risposta": "risposta corretta", "indizio": "un piccolo aiuto"}` 
              }
            ],
            temperature: 1.2
          })
        });

        if (response.ok) {
          const data = await response.json();
          const text = data.choices[0].message.content;
          const cleanText = text.replace(/```json|```/g, "").trim();
          riddle = JSON.parse(cleanText);
        }
      } catch (error) {
        console.log("ChatGPT non disponibile, uso Claude...");
      }
    }
    
    // Fallback a Claude se ChatGPT non funziona
    if (!riddle) {
      try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1000,
            messages: [
              { 
                role: "user", 
                content: `Crea un enigma completamente NUOVO e originale per Lupus in Fabula. NON riutilizzare questi: ${Array.from(usedRiddles).join(', ')}. Rispondi SOLO con JSON:
{"enigma": "testo dell'enigma", "risposta": "risposta corretta", "indizio": "un piccolo aiuto"}` 
              }
            ],
            temperature: 1
          })
        });

        const data = await response.json();
        const text = data.content[0].text;
        const cleanText = text.replace(/```json|```/g, "").trim();
        riddle = JSON.parse(cleanText);
      } catch (error) {
        console.error("Errore generazione enigma:", error);
      }
    }
    
    // Fallback a enigmi predefiniti
    if (!riddle) {
      const fallbackRiddles = [
        { enigma: "Sono leggero come una piuma, ma anche il più forte non può tenermi per più di 5 minuti. Cosa sono?", risposta: "respiro", indizio: "Pensate a qualcosa che fate continuamente..." },
        { enigma: "Ho città senza case, foreste senza alberi, fiumi senza acqua. Cosa sono?", risposta: "mappa", indizio: "È qualcosa che rappresenta il mondo..." },
        { enigma: "Più ne togli, più divento grande. Cosa sono?", risposta: "buco", indizio: "Pensate a qualcosa di vuoto..." },
        { enigma: "Ho 88 tasti ma non posso aprire nessuna porta. Cosa sono?", risposta: "pianoforte", indizio: "È uno strumento musicale..." },
        { enigma: "Vado su e giù ma non mi muovo mai. Cosa sono?", risposta: "scala", indizio: "Pensate a qualcosa che collega piani diversi..." }
      ];
      
      const available = fallbackRiddles.filter(r => !usedRiddles.has(r.enigma));
      riddle = available.length > 0 ? available[Math.floor(Math.random() * available.length)] : fallbackRiddles[0];
    }
    
    setUsedRiddles(prev => new Set([...prev, riddle.enigma]));
    setCurrentRiddle(riddle);
    setTimeLeft(300);
    setTimerActive(true);
  };

  const calculatePoints = (timeElapsed) => {
    const seconds = Math.floor(timeElapsed / 1000);
    const maxPoints = 1000;
    const minPoints = 100;
    
    if (seconds <= 30) return maxPoints;
    if (seconds >= 300) return minPoints;
    
    const points = maxPoints - ((maxPoints - minPoints) * (seconds / 300));
    return Math.round(points);
  };

  const checkAnswer = () => {
    if (riddleAnswer.toLowerCase().trim() === currentRiddle.risposta.toLowerCase().trim()) {
      const timeElapsed = Date.now() - riddleStartTime;
      const points = calculatePoints(timeElapsed);
      
      alert(`✅ Risposta corretta!\n🎯 Punti guadagnati: ${points}\n⏱️ Tempo impiegato: ${Math.floor(timeElapsed/1000)}s`);
      
      setGameState(prev => ({ 
        ...prev, 
        riddlesSolved: prev.riddlesSolved + 1,
        totalPoints: prev.totalPoints + points
      }));
      setTimerActive(false);
      setRiddleAnswer('');
      setCurrentRiddle(null);
    } else {
      alert('❌ Risposta errata. Riprovate!');
    }
  };

  const goToNightPhase = () => {
    if (confirm('Passare alla fase notturna?')) {
      setGameState(prev => ({ ...prev, phase: 'night', day: prev.day + 1 }));
      setCurrentRiddle(null);
      setTimerActive(false);
      alert('🌙 Fase Notturna\n\nI giocatori con ruoli speciali effettuano le loro azioni. Il narratore coordina le scelte e poi si torna alla fase diurna.');
    }
  };

  const backToDayPhase = () => {
    setGameState(prev => ({ ...prev, phase: 'day' }));
    generateRiddle();
  };

  const eliminatePlayer = (playerIndex) => {
    if (confirm(`Confermi l'eliminazione di ${gameState.players[playerIndex].name}?`)) {
      const updatedPlayers = [...gameState.players];
      updatedPlayers[playerIndex].alive = false;
      setGameState(prev => ({ ...prev, players: updatedPlayers }));
      
      const alivePlayers = updatedPlayers.filter(p => p.alive);
      const aliveWolves = alivePlayers.filter(p => p.role === 'lupo').length;
      const aliveVillagers = alivePlayers.filter(p => p.role !== 'lupo').length;
      
      if (aliveWolves === 0) {
        alert('🎉 Il Villaggio ha vinto! Tutti i lupi sono stati eliminati!');
      } else if (aliveWolves >= aliveVillagers) {
        alert('🐺 I Lupi hanno vinto! Sono diventati maggioranza!');
      }
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (screen === 'setup') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-6 sm:mb-8 text-center">🌙 Lupus in Fabula</h1>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <Users size={24} />
              Giocatori ({players.length})
            </h2>
            
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <input
                type="text"
                placeholder="Nome"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                className="flex-1 px-4 py-2 rounded bg-white/20 text-white placeholder-white/60"
                onKeyPress={(e) => e.key === 'Enter' && addPlayer()}
              />
              <input
                type="email"
                placeholder="Email"
                value={newPlayerEmail}
                onChange={(e) => setNewPlayerEmail(e.target.value)}
                className="flex-1 px-4 py-2 rounded bg-white/20 text-white placeholder-white/60"
                onKeyPress={(e) => e.key === 'Enter' && addPlayer()}
              />
              <button onClick={addPlayer} className="px-6 py-2 bg-green-500 rounded font-semibold hover:bg-green-600 whitespace-nowrap">
                Aggiungi
              </button>
            </div>
            
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {players.map((p, i) => (
                <div key={i} className="flex justify-between items-center bg-white/20 p-3 rounded">
                  <div className="flex-1 min-w-0">
                    <span className="text-white font-semibold block truncate">{p.name}</span>
                    <span className="text-white/60 text-sm block truncate">{p.email}</span>
                  </div>
                  <button onClick={() => removePlayer(i)} className="text-red-400 hover:text-red-300 ml-2">
                    <XCircle size={20} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <Settings size={24} />
              Ruoli
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.entries(ROLES).map(([key, role]) => (
                <div 
                  key={key}
                  onClick={() => toggleRole(key)}
                  className={`p-4 rounded cursor-pointer transition-all ${
                    selectedRoles.includes(key) 
                      ? 'bg-green-500/30 border-2 border-green-400' 
                      : 'bg-white/10 border-2 border-transparent'
                  } ${(key === 'lupo' || key === 'villico') ? 'opacity-100' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl sm:text-3xl">{role.icon}</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-bold">{role.name}</h3>
                      <p className="text-white/70 text-sm">{role.description}</p>
                      {(key === 'lupo' || key === 'villico') && (
                        <p className="text-yellow-300 text-xs mt-1">* Obbligatorio</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {players.length > 0 && (
              <div className="mt-4 p-4 bg-blue-500/20 rounded">
                <p className="text-white text-sm">
                  <strong>Lupi Mannari previsti:</strong> {calculateWolves(players.length)}
                  <br />
                  <strong>Ruoli speciali:</strong> {selectedRoles.filter(r => r !== 'lupo' && r !== 'villico').length}
                  <br />
                  <strong>Villici:</strong> {Math.max(0, players.length - calculateWolves(players.length) - selectedRoles.filter(r => r !== 'lupo' && r !== 'villico').length)}
                </p>
              </div>
            )}
          </div>

          <button
            onClick={startGame}
            disabled={players.length < 4}
            className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg font-bold text-white text-lg sm:text-xl hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Play size={24} />
            Inizia Partita
          </button>
          
          {players.length < 4 && (
            <p className="text-yellow-300 text-center mt-2 text-sm">Servono almeno 4 giocatori</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Giorno {gameState.day}</h1>
            <p className="text-white/80 text-sm">Fase: {gameState.phase === 'day' ? '☀️ Diurna' : '🌙 Notturna'} | Punti: {gameState.totalPoints}</p>
          </div>
          <button 
            onClick={() => setScreen('setup')}
            className="px-4 py-2 bg-red-500/20 text-red-300 rounded hover:bg-red-500/30 text-sm"
          >
            Termina Partita
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="lg:col-span-1 bg-white/10 backdrop-blur-lg rounded-lg p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-4">Giocatori</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {gameState.players.map((p, i) => (
                <div 
                  key={i}
                  className={`p-3 rounded ${p.alive ? 'bg-white/20' : 'bg-red-900/30'}`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex-1 min-w-0">
                      <span className={`font-semibold block truncate ${p.alive ? 'text-white' : 'text-white/40 line-through'}`}>
                        {p.name}
                      </span>
                      <span className="text-xs text-white/60 block">{ROLES[p.role].icon} {ROLES[p.role].name}</span>
                    </div>
                    {p.alive && gameState.phase === 'night' && (
                      <button
                        onClick={() => eliminatePlayer(i)}
                        className="px-3 py-1 bg-red-500/50 text-white rounded text-xs hover:bg-red-500/70 ml-2"
                      >
                        Elimina
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-6 p-4 bg-blue-500/20 rounded">
              <p className="text-white text-sm">
                <strong>Vivi:</strong> {gameState.players.filter(p => p.alive).length}
                <br />
                <strong>Enigmi risolti:</strong> {gameState.riddlesSolved}
                <br />
                <strong>Punti totali:</strong> {gameState.totalPoints}
              </p>
            </div>
          </div>

          <div className="lg:col-span-2 bg-white/10 backdrop-blur-lg rounded-lg p-4 sm:p-6">
            {gameState.phase === 'night' ? (
              <div className="text-center py-12">
                <Moon size={64} className="mx-auto mb-4 text-blue-300" />
                <h2 className="text-2xl font-bold text-white mb-4">🌙 Fase Notturna</h2>
                <p className="text-white/80 mb-6">
                  I giocatori con ruoli speciali effettuano le loro azioni.<br />
                  Il narratore coordina: Lupi, Veggente, Guardia, ecc.
                </p>
                <button
                  onClick={backToDayPhase}
                  className="px-8 py-4 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-lg font-bold text-white hover:from-yellow-600 hover:to-orange-600"
                >
                  ☀️ Torna alla Fase Diurna
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">Fase Diurna - Enigma</h2>
                
                {currentRiddle ? (
                  <>
                    {currentRiddle.loading ? (
                      <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-16 w-16 border-4 border-white/30 border-t-white mx-auto mb-4"></div>
                        <p className="text-white">Generazione enigma...</p>
                      </div>
                    ) : (
                      <>
                        <div className="bg-purple-900/40 p-4 sm:p-6 rounded-lg mb-4 sm:mb-6">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2 text-white">
                              <Clock size={20} className="sm:w-6 sm:h-6" />
                              <span className="text-xl sm:text-2xl font-bold">{formatTime(timeLeft)}</span>
                            </div>
                            {timeLeft === 0 && (
                              <span className="text-red-400 font-bold text-sm sm:text-base">Tempo scaduto!</span>
                            )}
                          </div>
                          
                          <p className="text-white text-base sm:text-lg mb-4">{currentRiddle.enigma}</p>
                          
                          <details className="text-yellow-300 text-sm">
                            <summary className="cursor-pointer hover:text-yellow-200">💡 Indizio</summary>
                            <p className="mt-2">{currentRiddle.indizio}</p>
                          </details>
                        </div>

                        {timeLeft > 0 ? (
                          <>
                            <div className="flex flex-col sm:flex-row gap-2 mb-4">
                              <input
                                type="text"
                                placeholder="Inserisci la risposta..."
                                value={riddleAnswer}
                                onChange={(e) => setRiddleAnswer(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && checkAnswer()}
                                className="flex-1 px-4 py-3 rounded bg-white/20 text-white placeholder-white/60"
                              />
                              <button
                                onClick={checkAnswer}
                                className="px-6 py-3 bg-green-500 rounded font-semibold hover:bg-green-600 flex items-center justify-center gap-2 whitespace-nowrap"
                              >
                                <CheckCircle size={20} />
                                Verifica
                              </button>
                            </div>

                            <button
                              onClick={generateRiddle}
                              className="w-full py-3 bg-blue-500/50 rounded font-semibold text-white hover:bg-blue-500/70 text-sm sm:text-base"
                            >
                              Genera Nuovo Enigma
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={goToNightPhase}
                            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg font-bold text-white hover:from-indigo-700 hover:to-purple-700 flex items-center justify-center gap-2"
                          >
                            <Moon size={24} />
                            Passa alla Fase Notturna
                          </button>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <div className="text-center py-12">
                    <button
                      onClick={generateRiddle}
                      className="px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg font-bold text-white text-lg sm:text-xl hover:from-purple-600 hover:to-pink-600"
                    >
                      Inizia Fase Diurna
                    </button>
                  </div>
                )}

                <div className="mt-6 p-4 bg-white/10 rounded">
                  <h3 className="text-white font-bold mb-2 text-sm sm:text-base">Come funziona:</h3>
                  <ul className="text-white/80 text-xs sm:text-sm space-y-1">
                    <li>• Durante il giorno, i giocatori risolvono enigmi insieme</li>
                    <li>• Più velocemente risolvete, più punti guadagnate!</li>
                    <li>• Gli enigmi sono generati con AI e sempre diversi</li>
                    <li>• Solo tu (Game Master) devi avere l'app aperta</li>
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}