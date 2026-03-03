import { useState, useRef, useEffect } from 'react'
import './App.css'

interface GrowthStage {
  minXp: number;
  label: string;
  emoji: string;
}

const STAGES: GrowthStage[] = [
  { minXp: 0, label: '土', emoji: '🟫' },
  { minXp: 60, label: '芽', emoji: '🌱' },
  { minXp: 120, label: '双葉', emoji: '🌿' },
  { minXp: 240, label: '若木', emoji: '🌳' },
  { minXp: 480, label: '開花', emoji: '🌸' },
  { minXp: 720, label: '結実', emoji: '🍓' },
];

interface StudyLog {
  minutes: number;
  category: string;
  date: string;
}

const DEFAULT_CATEGORIES = ['語学', '数学', 'プログラミング', '資格', '読書', 'その他'];

interface Plant {
  id: string;
  name: string;
  emoji: string;
  rarity: 'common' | 'rare' | 'legendary';
}

const PLANTS: Plant[] = [
  // Common (60%)
  { id: 'tomato', name: 'トマト', emoji: '🍅', rarity: 'common' },
  { id: 'eggplant', name: 'なす', emoji: '🍆', rarity: 'common' },
  { id: 'carrot', name: 'にんじん', emoji: '🥕', rarity: 'common' },
  { id: 'corn', name: 'とうもろこし', emoji: '🌽', rarity: 'common' },
  { id: 'potato', name: 'じゃがいも', emoji: '🥔', rarity: 'common' },
  { id: 'broccoli', name: 'ブロッコリー', emoji: '🥦', rarity: 'common' },
  // Rare (30%)
  { id: 'strawberry', name: 'いちご', emoji: '🍓', rarity: 'rare' },
  { id: 'grapes', name: 'ぶどう', emoji: '🍇', rarity: 'rare' },
  { id: 'melon', name: 'メロン', emoji: '🍈', rarity: 'rare' },
  { id: 'peach', name: 'もも', emoji: '🍑', rarity: 'rare' },
  // Legendary (10%)
  { id: 'rainbow_flower', name: '虹の花', emoji: '🌈', rarity: 'legendary' },
  { id: 'crystal_tree', name: '水晶の木', emoji: '💎', rarity: 'legendary' },
];

const HARVEST_XP = 720;
const STORAGE_KEYS = {
  MINUTES: 'greenStudy.minutesInCycle',
  PLANT_ID: 'greenStudy.currentPlantId',
  HARVEST_COUNT: 'greenStudy.harvestCount',
  COLLECTION: 'greenStudy.collection',
  STREAK: 'greenStudy.streakCount',
  LAST_STUDY: 'greenStudy.lastStudyDate',
  RECEIVED_GIFTS: 'greenStudy.receivedGiftIds',
  LOGS: 'greenStudy.studyLogs',
  CATEGORIES: 'greenStudy.categories',
};

const getTodayStr = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const isYesterday = (dateStr: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return target.getTime() === yesterday.getTime();
};

const getBgStage = (streak: number): number => {
  if (streak >= 30) return 5;
  if (streak >= 14) return 4;
  if (streak >= 7) return 3;
  if (streak >= 4) return 2;
  if (streak >= 1) return 1;
  return 0;
};

const getRandomPlant = (streakCount: number): Plant => {
  const rand = Math.random() * 100;
  let rarity: 'common' | 'rare' | 'legendary';

  let rates = { common: 60, rare: 30, legendary: 10 };

  if (streakCount >= 14) {
    rates = { common: 50, rare: 30, legendary: 20 };
  } else if (streakCount >= 7) {
    rates = { common: 40, rare: 50, legendary: 10 };
  } else if (streakCount >= 3) {
    rates = { common: 50, rare: 40, legendary: 10 };
  }

  if (rand < rates.legendary) {
    rarity = 'legendary';
  } else if (rand < rates.legendary + rates.rare) {
    rarity = 'rare';
  } else {
    rarity = 'common';
  }

  const pool = PLANTS.filter(p => p.rarity === rarity);
  return pool[Math.floor(Math.random() * pool.length)];
};

const playHarvestSound = () => {
  const AudioContextClass =
    (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return;
  const audioCtx = new AudioContextClass();

  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.value = 520; // 軽い明るめ音

  gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(
    0.001,
    audioCtx.currentTime + 0.15
  );

  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  oscillator.start();
  oscillator.stop(audioCtx.currentTime + 0.15);
};


function App() {
  // Initial state from localStorage
  const [minutesInCycle, setMinutesInCycle] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.MINUTES);
    return saved ? parseInt(saved, 10) : 0;
  });
  const [currentPlantId, setCurrentPlantId] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PLANT_ID);
    return (saved && PLANTS.some(p => p.id === saved)) ? saved : PLANTS[0].id;
  });
  const [harvestCount, setHarvestCount] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.HARVEST_COUNT);
    return saved ? parseInt(saved, 10) : 0;
  });
  const [collection, setCollection] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.COLLECTION);
    return saved ? JSON.parse(saved) : {};
  });
  const [streakCount, setStreakCount] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.STREAK);
    return saved ? parseInt(saved, 10) : 0;
  });
  const [lastStudyDate, setLastStudyDate] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEYS.LAST_STUDY);
  });
  const [receivedGiftIds, setReceivedGiftIds] = useState<string[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.RECEIVED_GIFTS);
    return saved ? JSON.parse(saved) : [];
  });
  const [logs, setLogs] = useState<StudyLog[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.LOGS);
    return saved ? JSON.parse(saved) : [];
  });
  const [categories, setCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    return saved ? JSON.parse(saved) : DEFAULT_CATEGORIES;
  });

  const [view, setView] = useState<'home' | 'collection' | 'progress'>('home');
  const [studyTime, setStudyTime] = useState<number>(0);
  const [selectedCategory, setSelectedCategory] = useState<string>(DEFAULT_CATEGORIES[0]);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [editingCat, setEditingCat] = useState<{ oldName: string, newName: string } | null>(null);
  const [isWobbling, setIsWobbling] = useState(false);
  const wobbleTimerRef = useRef<number | null>(null);

  const [giftCodeInput, setGiftCodeInput] = useState('');
  const [giftMessage, setGiftMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  const [activeGiftCode, setActiveGiftCode] = useState<string | null>(null);

  const currentPlant = PLANTS.find(p => p.id === currentPlantId) || PLANTS[0];

  // Logic to reset streak if missed
  useEffect(() => {
    if (lastStudyDate) {
      const todayStr = getTodayStr();
      if (lastStudyDate !== todayStr && !isYesterday(lastStudyDate)) {
        setStreakCount(0);
      }
    }
  }, []);

  // Persistence effects
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MINUTES, minutesInCycle.toString());
  }, [minutesInCycle]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PLANT_ID, currentPlantId);
  }, [currentPlantId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.HARVEST_COUNT, harvestCount.toString());
  }, [harvestCount]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.COLLECTION, JSON.stringify(collection));
  }, [collection]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.STREAK, streakCount.toString());
  }, [streakCount]);

  useEffect(() => {
    if (lastStudyDate) {
      localStorage.setItem(STORAGE_KEYS.LAST_STUDY, lastStudyDate);
    }
  }, [lastStudyDate]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.RECEIVED_GIFTS, JSON.stringify(receivedGiftIds));
  }, [receivedGiftIds]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
  }, [logs]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
  }, [categories]);

  const currentStageIndex = [...STAGES].reverse().findIndex(stage => minutesInCycle >= stage.minXp);
  const currentStage = STAGES[STAGES.length - 1 - currentStageIndex];

  const nextStage = STAGES[STAGES.length - currentStageIndex];
  const xpToNext = nextStage ? nextStage.minXp - minutesInCycle : 0;

  const handleAddMinutes = () => {
    if (studyTime <= 0) return;

    setMinutesInCycle(prev => prev + studyTime);

    // Add to logs
    const todayStr = getTodayStr();
    setLogs(prev => [...prev, { minutes: studyTime, category: selectedCategory, date: todayStr }]);

    setStudyTime(0);

    // Update Streak
    if (lastStudyDate !== todayStr) {
      if (lastStudyDate && isYesterday(lastStudyDate)) {
        setStreakCount(prev => prev + 1);
      } else {
        setStreakCount(1);
      }
      setLastStudyDate(todayStr);
    }

    // Trigger wobble animation
    setIsWobbling(true);
    if (wobbleTimerRef.current) window.clearTimeout(wobbleTimerRef.current);
    wobbleTimerRef.current = window.setTimeout(() => {
      setIsWobbling(false);
    }, 500);
  };

  const handleHarvest = () => {
    if (minutesInCycle < HARVEST_XP) return;

    playHarvestSound();
    const leftover = minutesInCycle - HARVEST_XP;

    // Record current plant to collection before switching
    setCollection(prev => ({
      ...prev,
      [currentPlantId]: (prev[currentPlantId] || 0) + 1
    }));

    setMinutesInCycle(leftover);
    setHarvestCount(prev => prev + 1);

    // Lottery for next plant
    const nextPlant = getRandomPlant(streakCount);
    setCurrentPlantId(nextPlant.id);
  };

  const generateGiftCode = (plantId: string) => {
    const plant = PLANTS.find(p => p.id === plantId);
    if (!plant) return;

    const payload = {
      plantId: plant.id,
      rarity: plant.rarity,
      createdAt: new Date().toISOString(),
    };

    const code = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    setActiveGiftCode(code);
  };

  const handleReceiveGift = () => {
    if (!giftCodeInput.trim()) return;

    if (receivedGiftIds.includes(giftCodeInput)) {
      setGiftMessage({ text: 'このコードは受取済みです', type: 'error' });
      return;
    }

    try {
      const decoded = decodeURIComponent(escape(atob(giftCodeInput)));
      const payload = JSON.parse(decoded);

      if (!payload.plantId || !PLANTS.some(p => p.id === payload.plantId)) {
        throw new Error('Invalid plant ID');
      }

      setCollection(prev => ({
        ...prev,
        [payload.plantId]: (prev[payload.plantId] || 0) + 1
      }));
      setReceivedGiftIds(prev => [...prev, giftCodeInput]);
      setGiftCodeInput('');
      setGiftMessage({ text: '植物を受け取りました！', type: 'success' });

      const plant = PLANTS.find(p => p.id === payload.plantId);
      if (plant) playHarvestSound(); // Use harvest sound for success
    } catch (e) {
      setGiftMessage({ text: '無効なギフトコードです', type: 'error' });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('コピーしました！');
  };

  const handleReset = () => {
    if (window.confirm('データをリセットしますか？')) {
      localStorage.clear();
      setMinutesInCycle(0);
      setHarvestCount(0);
      setCurrentPlantId(PLANTS[0].id);
      setCollection({});
      setStreakCount(0);
      setLastStudyDate(null);
      setStudyTime(0);
      setLogs([]);
      setCategories(DEFAULT_CATEGORIES);
    }
  };

  const handleAddCategory = () => {
    const name = newCatName.trim();
    if (!name || name.length > 20) return;
    if (categories.some(c => c.toLowerCase() === name.toLowerCase())) {
      alert('そのカテゴリは既に存在します');
      return;
    }
    setCategories(prev => [...prev, name]);
    setSelectedCategory(name);
    setNewCatName('');
    setIsAddingCategory(false);
  };

  const handleDeleteCategory = (catName: string) => {
    if (catName === 'その他') return;
    if (!window.confirm(`「${catName}」を削除しますか？\nこのカテゴリの記録は「その他」に移動されます。`)) return;

    setLogs(prev => prev.map(log => log.category === catName ? { ...log, category: 'その他' } : log));
    setCategories(prev => prev.filter(c => c !== catName));
    if (selectedCategory === catName) setSelectedCategory('その他');
  };

  const handleRenameCategory = () => {
    if (!editingCat) return;
    const newName = editingCat.newName.trim();
    if (!newName || newName.length > 20) return;
    if (categories.some(c => c.toLowerCase() === newName.toLowerCase() && c !== editingCat.oldName)) {
      alert('そのカテゴリ名は既に存在します');
      return;
    }

    setLogs(prev => prev.map(log => log.category === editingCat.oldName ? { ...log, category: newName } : log));
    setCategories(prev => prev.map(c => c === editingCat.oldName ? newName : c));
    if (selectedCategory === editingCat.oldName) setSelectedCategory(newName);
    setEditingCat(null);
  };

  const rarityStars = {
    common: '★',
    rare: '★★',
    legendary: '★★★',
  };

  const bgStage = getBgStage(streakCount);

  return (
    <div className="app-wrap">
      <div className={`bg-layer bg-stage-${bgStage}`}>
        <div className="bg-decor grass"></div>
        <div className="bg-decor trees"></div>
        <div className="bg-decor petals"></div>
        <div className="bg-decor forest"></div>
      </div>
      <div className="container">
        <nav className="tabs">
          <button
            className={`tab-btn ${view === 'home' ? 'active' : ''}`}
            onClick={() => setView('home')}
          >
            育成
          </button>
          <button
            className={`tab-btn ${view === 'collection' ? 'active' : ''}`}
            onClick={() => setView('collection')}
          >
            図鑑
          </button>
          <button
            className={`tab-btn ${view === 'progress' ? 'active' : ''}`}
            onClick={() => setView('progress')}
          >
            経過
          </button>
        </nav>

        {view === 'home' ? (
          <div className="view-content">
            <div className="header">
              <div className="title-area">
                <h1>Green Study</h1>
                {streakCount > 0 && <span className="streak-badge">🔥 連続 {streakCount} 日</span>}
              </div>
              {harvestCount > 0 && <span className="harvest-badge">収穫: {harvestCount}</span>}
            </div>

            <div className={`plant-display ${currentPlant.rarity}`}>
              <span className={`plant-emoji ${isWobbling ? 'wobble' : ''}`}>
                {minutesInCycle >= 720 ? currentPlant.emoji : currentStage.emoji}
              </span>
            </div>

            <div className="stats">
              <div className="plant-info">
                <span className="plant-name">{currentPlant.name}</span>
                <span className={`rarity-tag ${currentPlant.rarity}`}>{rarityStars[currentPlant.rarity]}</span>
              </div>
              <div className="stage-badge">{currentStage.label}</div>
              <div className="xp-text">
                現在の経験値: <strong>{minutesInCycle}</strong> 分
              </div>
              {nextStage && (
                <div className="xp-next">
                  次のステージまであと <strong>{xpToNext}</strong> 分
                </div>
              )}
              <div className="lottery-info">
                現在の抽選確率:
                <span className="rate-item">C:{streakCount >= 14 ? 50 : streakCount >= 7 ? 40 : streakCount >= 3 ? 50 : 60}%</span>
                <span className="rate-item">R:{streakCount >= 14 ? 30 : streakCount >= 7 ? 50 : streakCount >= 3 ? 40 : 30}%</span>
                <span className="rate-item">L:{streakCount >= 14 ? 20 : 10}%</span>
              </div>
            </div>


            <div className="controls">
              <div className="input-group">
                <select
                  className="category-select"
                  value={selectedCategory}
                  onChange={(e) => {
                    if (e.target.value === 'ADD_NEW') {
                      setIsAddingCategory(true);
                    } else {
                      setSelectedCategory(e.target.value);
                    }
                  }}
                >
                  {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  <option value="ADD_NEW">＋カテゴリを追加…</option>
                </select>
                <input
                  type="number"
                  value={studyTime || ''}
                  onChange={(e) => setStudyTime(parseInt(e.target.value) || 0)}
                  placeholder="経過 (分)"
                  min="0"
                />
                <button className="btn-add" onClick={handleAddMinutes}>
                  Add
                </button>
              </div>

              {minutesInCycle >= HARVEST_XP && (
                <button className="btn-harvest" onClick={handleHarvest}>
                  Harvest
                </button>
              )}

              <button className="btn-reset" onClick={handleReset}>
                Reset
              </button>
            </div>
          </div>
        ) : view === 'collection' ? (
          <div className="view-content collection-view">
            <h2>植物図鑑</h2>

            <div className="collection-grid">
              {PLANTS.map(plant => {
                const count = collection[plant.id] || 0;
                const isDiscovered = count > 0;

                return (
                  <div key={plant.id} className={`collection-card ${isDiscovered ? plant.rarity : 'undiscovered'}`}>
                    <div className="card-emoji">{isDiscovered ? plant.emoji : '❓'}</div>
                    <div className="card-name">{isDiscovered ? plant.name : '？？？'}</div>
                    {isDiscovered && (
                      <>
                        <div className={`card-rarity ${plant.rarity}`}>{rarityStars[plant.rarity]}</div>
                        <button className="btn-gift-gen" onClick={() => generateGiftCode(plant.id)}>
                          🎁 ギフトコード
                        </button>
                      </>
                    )}
                    <div className="card-count">{count} 収穫</div>
                  </div>
                );
              })}
            </div>

            <div className="gift-footer">
              <span className="gift-footer-label">🎁 ギフトを受け取る</span>
              <div className="gift-footer-input-group">
                <input
                  type="text"
                  value={giftCodeInput}
                  onChange={(e) => setGiftCodeInput(e.target.value)}
                  placeholder="ギフトコード"
                />
                <button className="btn-gift-receive-small" onClick={handleReceiveGift}>
                  受け取る
                </button>
              </div>
              {giftMessage && (
                <div className={`gift-message-small ${giftMessage.type}`}>
                  {giftMessage.text}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="view-content progress-view">
            <h2>学習の経過</h2>

            <div className="stats-grid">
              <div className="stats-card">
                <span className="stats-label">累計</span>
                <span className="stats-value">{logs.reduce((acc, log) => acc + log.minutes, 0)}<small>分</small></span>
              </div>
              <div className="stats-card">
                <span className="stats-label">今週</span>
                <span className="stats-value">
                  {logs.filter(log => {
                    const d = new Date(log.date);
                    const now = new Date();
                    const diff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
                    return diff <= 7;
                  }).reduce((acc, log) => acc + log.minutes, 0)}
                  <small>分</small>
                </span>
              </div>
              <div className="stats-card">
                <span className="stats-label">今月</span>
                <span className="stats-value">
                  {logs.filter(log => {
                    const d = new Date(log.date);
                    const now = new Date();
                    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                  }).reduce((acc, log) => acc + log.minutes, 0)}
                  <small>分</small>
                </span>
              </div>
            </div>

            <div className="category-stats">
              <h3>カテゴリ別</h3>
              <div className="category-list">
                {categories.map(cat => {
                  const catMinutes = logs.filter(l => l.category === cat).reduce((acc, l) => acc + l.minutes, 0);
                  const totalMinutes = logs.reduce((acc, l) => acc + l.minutes, 0) || 1;
                  const percentage = (catMinutes / totalMinutes) * 100;

                  return (
                    <div key={cat} className="category-item">
                      <div className="category-info">
                        <div className="category-name-group">
                          <span className="cat-text">{cat}</span>
                          <div className="cat-actions">
                            <button className="btn-icon" onClick={() => setEditingCat({ oldName: cat, newName: cat })}>✏️</button>
                            {cat !== 'その他' && (
                              <button className="btn-icon" onClick={() => handleDeleteCategory(cat)}>🗑️</button>
                            )}
                          </div>
                        </div>
                        <span className="cat-val">{catMinutes}分</span>
                      </div>
                      <div className="category-bar-bg">
                        <div className="category-bar-fill" style={{ width: `${percentage}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {activeGiftCode && (
        <div className="modal-overlay" onClick={() => setActiveGiftCode(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>🎁 ギフトコード発行</h3>
            <p>このコードをコピーして送ってください：</p>
            <div className="code-display">
              {activeGiftCode}
            </div>
            <button className="btn-copy" onClick={() => copyToClipboard(activeGiftCode)}>
              コピーする
            </button>
            <button className="btn-close" onClick={() => setActiveGiftCode(null)}>
              閉じる
            </button>
          </div>
        </div>
      )}

      {isAddingCategory && (
        <div className="modal-overlay" onClick={() => setIsAddingCategory(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>カテゴリを追加</h3>
            <input
              type="text"
              autoFocus
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="カテゴリ名（20文字まで）"
              maxLength={20}
              onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
            />
            <button className="btn-add-cat" onClick={handleAddCategory}>追加</button>
            <button className="btn-close" onClick={() => setIsAddingCategory(false)}>閉じる</button>
          </div>
        </div>
      )}

      {editingCat && (
        <div className="modal-overlay" onClick={() => setEditingCat(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>カテゴリ名を編集</h3>
            <input
              type="text"
              autoFocus
              value={editingCat.newName}
              onChange={(e) => setEditingCat({ ...editingCat, newName: e.target.value })}
              placeholder="新しい名前"
              maxLength={20}
              onKeyDown={(e) => e.key === 'Enter' && handleRenameCategory()}
            />
            <button className="btn-add-cat" onClick={handleRenameCategory}>保存</button>
            <button className="btn-close" onClick={() => setEditingCat(null)}>キャンセル</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
