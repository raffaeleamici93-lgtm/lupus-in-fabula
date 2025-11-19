import React, { useState, useEffect } from 'react';
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

const OPENAI_API_KEY = '';

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
  const [showLynchVoting, setShowLynchVoting] = useState(false);
  const [votes, setVotes] = useState({});

  useEffect(() => {
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
    
    // Database più ampio di enigmi predefiniti
    const allRiddles = [
      { enigma: "Sono leggero come una piuma, ma anche il più forte non può tenermi per più di 5 minuti. Cosa sono?", risposta: "respiro", indizio: "Pensate a qualcosa che fate continuamente..." },
      { enigma: "Ho città senza case, foreste senza alberi, fiumi senza acqua. Cosa sono?", risposta: "mappa", indizio: "È qualcosa che rappresenta il mondo..." },
      { enigma: "Più ne togli, più divento grande. Cosa sono?", risposta: "buco", indizio: "Pensate a qualcosa di vuoto..." },
      { enigma: "Ho 88 tasti ma non posso aprire nessuna porta. Cosa sono?", risposta: "pianoforte", indizio: "È uno strumento musicale..." },
      { enigma: "Vado su e giù ma non mi muovo mai. Cosa sono?", risposta: "scala", indizio: "Pensate a qualcosa che collega piani diversi..." },
      { enigma: "Ho un collo ma non ho testa. Cosa sono?", risposta: "bottiglia", indizio: "La usi per bere..." },
      { enigma: "Corro ma non ho gambe, urlo ma non ho bocca. Cosa sono?", risposta: "fiume", indizio: "Scorre in natura..." },
      { enigma: "Più sono grande, meno mi vedi. Cosa sono?", risposta: "buio", indizio: "È l'opposto della luce..." },
      { enigma: "Ho denti ma non posso mordere. Cosa sono?", risposta: "pettine", indizio: "Lo usi per i capelli..." },
      { enigma: "Sono sempre davanti a te ma non mi puoi vedere. Cosa sono?", risposta: "futuro", indizio: "Ha a che fare con il tempo..." },
      { enigma: "Ho quattro gambe al mattino, due a mezzogiorno e tre alla sera. Cosa sono?", risposta: "uomo", indizio: "Famoso enigma della Sfinge..." },
      { enigma: "Più è nero, più è pulito. Cosa sono?", risposta: "lavagna", indizio: "La trovi in classe..." },
      { enigma: "Ho ali ma non sono un uccello, volo senza motore. Cosa sono?", risposta: "aquilone", indizio: "Gioco con il vento..." },
      { enigma: "Sono pieno di buchi ma posso contenere acqua. Cosa sono?", risposta: "spugna", indizio: "La usi per lavare..." },
      { enigma: "Più dai, più divento leggero. Cosa sono?", risposta: "segreto", indizio: "Condividerlo ti alleggerisce..." },
      { enigma: "Ho una testa e una coda ma non ho corpo. Cosa sono?", risposta: "moneta", indizio: "La usi per pagare..." },
      { enigma: "Sono sempre in corsa ma non mi muovo mai. Cosa sono?", risposta: "orologio", indizio: "Segna il tempo..." },
      { enigma: "Ho mille occhi ma non vedo. Cosa sono?", risposta: "formaggio", indizio: "È un alimento con i buchi..." },
      { enigma: "Rompo senza essere toccato, parlo senza bocca. Cosa sono?", risposta: "silenzio", indizio: "È l'assenza di rumore..." },
      { enigma: "Sono il padre di tutti gli alberi ma non ho radici. Cosa sono?", risposta: "seme", indizio: "Da me nasce la pianta..." },
      { enigma: "Più mi asciughi, più divento bagnato. Cosa sono?", risposta: "asciugamano", indizio: "Lo usi dopo la doccia..." },
      { enigma: "Ho strade ma nessuna macchina, città ma nessuna casa. Cosa sono?", risposta: "gioco da tavolo", indizio: "Pensate al Monopoli..." },
      { enigma: "Tutti mi hanno ma nessuno può perdermi. Cosa sono?", risposta: "ombra", indizio: "Ti segue sempre..." },
      { enigma: "Ho voce ma non parlo, suono senza strumento. Cosa sono?", risposta: "eco", indizio: "Ti risponde nelle montagne..." },
      { enigma: "Sono dentro e fuori allo stesso tempo. Cosa sono?", risposta: "porta", indizio: "Separa due stanze..." },
      { enigma: "Più sono fresco, più sono caldo. Cosa sono?", risposta: "pane", indizio: "Appena sfornato..." },
      { enigma: "Ho pagine ma non sono un libro, ho foglie ma non sono un albero. Cosa sono?", risposta: "quaderno", indizio: "Ci scrivi sopra..." },
      { enigma: "Salgo ma non scendo mai. Cosa sono?", risposta: "età", indizio: "Aumenta con il tempo..." },
      { enigma: "Sono ovunque ma non occupo spazio. Cosa sono?", risposta: "aria", indizio: "La respiri..." },
      { enigma: "Ho radici che nessuno vede, sono più alto degli alberi, cresco senza crescere. Cosa sono?", risposta: "montagna", indizio: "È un rilievo naturale..." }
    ];
    
    // Filtra enigmi non ancora usati
    const availableRiddles = allRiddles.filter(r => !usedRiddles.has(r.enigma));
    
    // Se li abbiamo usati tutti, resetta
    let riddle;
    if (availableRiddles.length === 0) {
      setUsedRiddles(new Set());
      riddle = allRiddles[Math.floor(Math.random() * allRiddles.length)];
    } else {
      riddle = availableRiddles[Math.floor(Math.random() * availableRiddles.length)];
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
      setShowLynchVoting(false);
      setVotes({});
      setGameState(prev => ({ ...prev, phase: 'night', day: prev.day + 1 }));
      setCurrentRiddle(null);
      setTimerActive(false);
    }
  };

  const startLynchVoting = () => {
    setShowLynchVoting(true);
    setVotes({});
  };

  const castVote = (voterId, targetId) => {
    setVotes(prev => ({
      ...prev,
      [voterId]: targetId
    }));
  };

  const finalizeLynch = () => {
    const alivePlayers = gameState.players.filter(p => p.alive);
    const voteCounts = {};
    
    Object.values(votes).forEach(targetId => {
      voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
    });
    
    let maxVotes = 0;
    let lynched = null;
    
    Object.entries(voteCounts).forEach(([playerId, count]) => {
      if (count > maxVotes) {
        maxVotes = count;
        lynched = playerId;
      }
    });
    
    if (lynched) {
      const lynchedIndex = gameState.players.findIndex(p => p.name === lynched);
      if (lynchedIndex !== -1) {
        eliminatePlayer(lynchedIndex);
        setShowLynchVoting(false);
        setVotes({});
      }
    } else {
      alert('Nessun giocatore è stato linciato (pareggio o nessun voto)');
      setShowLynchVoting(false);
      setVotes({});
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
              <div>
                <div className="text-center mb-6">
                  <Moon size={48} className="mx-auto mb-3 text-blue-300" />
                  <h2 className="text-2xl font-bold text-white">🌙 Fase Notturna - Giorno {gameState.day}</h2>
                  <p className="text-white/60 text-sm mt-2">Il narratore legge le azioni dei ruoli speciali ai giocatori</p>
                </div>

                <div className="space-y-4 mb-6">
                  {gameState.players.filter(p => p.alive && p.role === 'lupo').length > 0 && (
                    <div className="bg-red-900/30 p-4 rounded-lg border-2 border-red-500/50">
                      <h3 className="text-white font-bold flex items-center gap-2 mb-2">
                        🐺 Lupi Mannari
                      </h3>
                      <p className="text-white/80 text-sm mb-3">
                        I lupi si svegliano e scelgono chi eliminare. Comunicano tra loro in silenzio.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {gameState.players.filter(p => p.alive && p.role === 'lupo').map((wolf, i) => (
                          <span key={i} className="px-3 py-1 bg-red-500/30 rounded text-white text-sm">
                            {wolf.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {gameState.players.filter(p => p.alive && p.role === 'veggente').length > 0 && (
                    <div className="bg-purple-900/30 p-4 rounded-lg border-2 border-purple-500/50">
                      <h3 className="text-white font-bold flex items-center gap-2 mb-2">
                        🔮 Veggente
                      </h3>
                      <p className="text-white/80 text-sm mb-3">
                        Il veggente si sveglia e può scoprire il ruolo di un giocatore.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {gameState.players.filter(p => p.alive && p.role === 'veggente').map((seer, i) => (
                          <span key={i} className="px-3 py-1 bg-purple-500/30 rounded text-white text-sm">
                            {seer.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {gameState.players.filter(p => p.alive && p.role === 'guardia').length > 0 && (
                    <div className="bg-blue-900/30 p-4 rounded-lg border-2 border-blue-500/50">
                      <h3 className="text-white font-bold flex items-center gap-2 mb-2">
                        🛡️ Guardia del Corpo
                      </h3>
                      <p className="text-white/80 text-sm mb-3">
                        La guardia si sveglia e sceglie un giocatore da proteggere (non può proteggere la stessa persona due notti di fila).
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {gameState.players.filter(p => p.alive && p.role === 'guardia').map((guard, i) => (
                          <span key={i} className="px-3 py-1 bg-blue-500/30 rounded text-white text-sm">
                            {guard.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {gameState.players.filter(p => p.alive && p.role === 'strega').length > 0 && (
                    <div className="bg-green-900/30 p-4 rounded-lg border-2 border-green-500/50">
                      <h3 className="text-white font-bold flex items-center gap-2 mb-2">
                        🧙‍♀️ Strega
                      </h3>
                      <p className="text-white/80 text-sm mb-3">
                        La strega si sveglia, scopre chi è stato attaccato e può usare la pozione di vita o di morte (una volta ciascuna per partita).
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {gameState.players.filter(p => p.alive && p.role === 'strega').map((witch, i) => (
                          <span key={i} className="px-3 py-1 bg-green-500/30 rounded text-white text-sm">
                            {witch.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-yellow-900/20 p-4 rounded-lg mb-6">
                  <h3 className="text-yellow-300 font-bold mb-2">📋 Istruzioni per il Narratore</h3>
                  <ol className="text-white/80 text-sm space-y-1 list-decimal list-inside">
                    <li>Leggi le azioni dei ruoli nell'ordine mostrato sopra</li>
                    <li>Fai aprire gli occhi solo ai giocatori con il ruolo attivo</li>
                    <li>Annota le scelte dei giocatori (chi viene attaccato, protetto, ecc.)</li>
                    <li>Risolvi le azioni: se qualcuno è protetto, non muore</li>
                    <li>Elimina il giocatore ucciso usando il pulsante "Elimina"</li>
                    <li>Clicca "Torna alla Fase Diurna" per continuare</li>
                  </ol>
                </div>

                <button
                  onClick={backToDayPhase}
                  className="w-full py-4 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-lg font-bold text-white hover:from-yellow-600 hover:to-orange-600 flex items-center justify-center gap-2"
                >
                  ☀️ Torna alla Fase Diurna
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">Fase Diurna - Enigma</h2>
                
                {showLynchVoting ? (
                  <div>
                    <div className="bg-red-900/30 p-4 sm:p-6 rounded-lg mb-6 border-2 border-red-500/50">
                      <h3 className="text-white font-bold text-lg mb-3">⚖️ Votazione per il Linciaggio</h3>
                      <p className="text-white/80 text-sm mb-4">
                        Ogni giocatore vota chi eliminare. Il giocatore con più voti viene linciato.
                      </p>
                      
                      <div className="space-y-4">
                        {gameState.players.filter(p => p.alive).map((voter, i) => (
                          <div key={i} className="bg-white/10 p-4 rounded">
                            <p className="text-white font-semibold mb-2">
                              Voto di {voter.name}:
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {gameState.players.filter(p => p.alive && p.name !== voter.name).map((target, j) => (
                                <button
                                  key={j}
                                  onClick={() => castVote(voter.name, target.name)}
                                  className={`px-3 py-2 rounded text-sm font-semibold transition-all ${
                                    votes[voter.name] === target.name
                                      ? 'bg-red-500 text-white'
                                      : 'bg-white/20 text-white/80 hover:bg-white/30'
                                  }`}
                                >
                                  {target.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      <div className="mt-6 flex flex-col sm:flex-row gap-2">
                        <button
                          onClick={finalizeLynch}
                          disabled={Object.keys(votes).length < gameState.players.filter(p => p.alive).length}
                          className="flex-1 py-3 bg-red-600 rounded font-bold text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Conferma Linciaggio
                        </button>
                        <button
                          onClick={() => setShowLynchVoting(false)}
                          className="flex-1 py-3 bg-gray-600 rounded font-bold text-white hover:bg-gray-700"
                        >
                          Annulla
                        </button>
                      </div>
                      
                      {Object.keys(votes).length < gameState.players.filter(p => p.alive).length && (
                        <p className="text-yellow-300 text-sm text-center mt-3">
                          Tutti devono votare per procedere ({Object.keys(votes).length}/{gameState.players.filter(p => p.alive).length})
                        </p>
                      )}
                    </div>
                  </div>
                ) : !currentRiddle ? (
                  <div className="text-center py-12">
                    <button
                      onClick={generateRiddle}
                      className="px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg font-bold text-white text-lg sm:text-xl hover:from-purple-600 hover:to-pink-600 mb-4"
                    >
                      Inizia Enigma
                    </button>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mt-4">
                      <button
                        onClick={startLynchVoting}
                        className="px-6 py-3 bg-gradient-to-r from-red-600 to-orange-600 rounded-lg font-bold text-white hover:from-red-700 hover:to-orange-700 flex items-center justify-center gap-2"
                      >
                        ⚖️ Votazione Linciaggio
                      </button>
                      <button
                        onClick={goToNightPhase}
                        className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg font-bold text-white hover:from-indigo-700 hover:to-purple-700 flex items-center justify-center gap-2"
                      >
                        <Moon size={20} />
                        Vai alla Fase Notturna
                      </button>
                    </div>
                  </div>
                ) : currentRiddle.loading ? (
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

                        <div className="flex flex-col sm:flex-row gap-2">
                          <button
                            onClick={generateRiddle}
                            className="flex-1 py-3 bg-blue-500/50 rounded font-semibold text-white hover:bg-blue-500/70 text-sm sm:text-base"
                          >
                            Genera Nuovo Enigma
                          </button>
                          <button
                            onClick={startLynchVoting}
                            className="flex-1 py-3 bg-gradient-to-r from-red-600 to-orange-600 rounded font-semibold text-white hover:from-red-700 hover:to-orange-700 flex items-center justify-center gap-2 text-sm sm:text-base"
                          >
                            ⚖️ Linciaggio
                          </button>
                          <button
                            onClick={goToNightPhase}
                            className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 rounded font-semibold text-white hover:from-indigo-700 hover:to-purple-700 flex items-center justify-center gap-2 text-sm sm:text-base"
                          >
                            <Moon size={18} />
                            Fase Notturna
                          </button>
                        </div>
                      </>
                    ) : (
                      <button
                        onClick={goToNightPhase}
                        className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg font-bold text-white hover:from-indigo-700 hover:to-purple-700 flex items-center justify-center gap-2 mb-3"
                      >
                        <Moon size={24} />
                        Passa alla Fase Notturna
                      </button>
                      <button
                        onClick={startLynchVoting}
                        className="w-full py-3 bg-gradient-to-r from-red-600 to-orange-600 rounded-lg font-bold text-white hover:from-red-700 hover:to-orange-700 flex items-center justify-center gap-2"
                      >
                        ⚖️ Votazione Linciaggio
                      </button>
                    </>
                  )}
                </>
              )}

                <div className="mt-6 p-4 bg-white/10 rounded">
                  <h3 className="text-white font-bold mb-2 text-sm sm:text-base">Come funziona:</h3>
                  <ul className="text-white/80 text-xs sm:text-sm space-y-1">
                    <li>• Durante il giorno, i giocatori risolvono enigmi insieme</li>
                    <li>• Più velocemente risolvete, più punti guadagnate!</li>
                    <li>• Usate "Votazione Linciaggio" per eliminare un sospetto</li>
                    <li>• Gli enigmi sono sempre diversi (30+ enigmi disponibili)</li>
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