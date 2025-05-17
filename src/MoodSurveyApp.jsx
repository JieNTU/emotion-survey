import React, { useState, useRef, useEffect } from 'react';

const MoodSurveyApp = () => {
  const wakeLockRef = useRef(null);
  const videoRef = useRef(null);
  const intervalRef = useRef(null);
  const countdownRef = useRef(null);
  const questionTimeoutRef = useRef(null);

  // 從 localStorage 初始化狀態
  const getInitialState = (key, defaultValue) => {
    const stored = localStorage.getItem(`moodSurvey_${key}`);
    return stored ? JSON.parse(stored) : defaultValue;
  };

  const [userID, setUserID] = useState(getInitialState('userID', ''));
  const [userName, setUserName] = useState(getInitialState('userName', ''));
  const [stage, setStage] = useState(getInitialState('stage', 'pre'));
  const [isRunning, setIsRunning] = useState(getInitialState('isRunning', false));
  const [responses, setResponses] = useState(getInitialState('responses', []));
  const [currentQuestionTime, setCurrentQuestionTime] = useState(getInitialState('currentQuestionTime', null));
  const [q1, setQ1] = useState(getInitialState('q1', 5));
  const [q2, setQ2] = useState(getInitialState('q2', 5));
  const [traffic, setTraffic] = useState(getInitialState('traffic', 5));
  const [isWaiting, setIsWaiting] = useState(getInitialState('isWaiting', false));
  const [uploading, setUploading] = useState(getInitialState('uploading', false));
  const [qPre, setQPre] = useState(getInitialState('qPre', { emotion: 5, arousal: 5, anxiety: 5, purpose: '', beenThere: '', usedGPS: '', passenger: '' }));
  const [qPost, setQPost] = useState(getInitialState('qPost', { emotion: 5, arousal: 5, anxiety: 5, dist: '', time: '', shortestDist: '', shortestTime: '' }));
  const [csvBackup, setCsvBackup] = useState(getInitialState('csvBackup', ''));
  const [filenameBackup, setFilenameBackup] = useState(getInitialState('filenameBackup', ''));
  const [countdown, setCountdown] = useState(getInitialState('countdown', 300));
  const [surveyStartTime, setSurveyStartTime] = useState(getInitialState('surveyStartTime', null));
  const [surveyEndTime, setSurveyEndTime] = useState(getInitialState('surveyEndTime', null));

  const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxz8YFkWNmMNihqi2qB8NPNs8DNqzv-aKoeoZryQLDwQBOfQ9VOJKL4eHE4gibk4YzLng/exec';

  // 每次狀態改變時儲存到 localStorage
  useEffect(() => {
    localStorage.setItem('moodSurvey_userID', JSON.stringify(userID));
    localStorage.setItem('moodSurvey_userName', JSON.stringify(userName));
    localStorage.setItem('moodSurvey_stage', JSON.stringify(stage));
    localStorage.setItem('moodSurvey_isRunning', JSON.stringify(isRunning));
    localStorage.setItem('moodSurvey_responses', JSON.stringify(responses));
    localStorage.setItem('moodSurvey_currentQuestionTime', JSON.stringify(currentQuestionTime));
    localStorage.setItem('moodSurvey_q1', JSON.stringify(q1));
    localStorage.setItem('moodSurvey_q2', JSON.stringify(q2));
    localStorage.setItem('moodSurvey_traffic', JSON.stringify(traffic));
    localStorage.setItem('moodSurvey_isWaiting', JSON.stringify(isWaiting));
    localStorage.setItem('moodSurvey_uploading', JSON.stringify(uploading));
    localStorage.setItem('moodSurvey_qPre', JSON.stringify(qPre));
    localStorage.setItem('moodSurvey_qPost', JSON.stringify(qPost));
    localStorage.setItem('moodSurvey_csvBackup', JSON.stringify(csvBackup));
    localStorage.setItem('moodSurvey_filenameBackup', JSON.stringify(filenameBackup));
    localStorage.setItem('moodSurvey_countdown', JSON.stringify(countdown));
    localStorage.setItem('moodSurvey_surveyStartTime', JSON.stringify(surveyStartTime));
    localStorage.setItem('moodSurvey_surveyEndTime', JSON.stringify(surveyEndTime));
  }, [userID, userName, stage, isRunning, responses, currentQuestionTime, q1, q2, traffic, isWaiting, uploading, qPre, qPost, csvBackup, filenameBackup, countdown, surveyStartTime, surveyEndTime]);

  // 頁面重整時檢查計時狀態
  useEffect(() => {
    if (stage === 'survey' && currentQuestionTime) {
      const questionTime = new Date(currentQuestionTime);
      const now = new Date();
      const timeDiff = (now - questionTime) / 1000; // 秒數差
      if (timeDiff < 300) {
        // 如果距離問題開始不到 5 分鐘，恢復計時
        const storedCountdown = getInitialState('countdown', 300);
        const adjustedCountdown = Math.min(storedCountdown, 300 - Math.floor(timeDiff));
        setCountdown(adjustedCountdown > 0 ? adjustedCountdown : 300);
        startCountdown();
      } else {
        // 如果超過 5 分鐘，重置問題並提醒使用者
        setCurrentQuestionTime(null);
        setIsWaiting(true);
        setCountdown(300);
        alert('⏳ 問卷已逾時，請等待下一題或停止問卷！');
      }
    } else {
      // 非 survey 階段或無 currentQuestionTime，清除計時
      clearInterval(countdownRef.current);
      setCountdown(300);
    }
  }, [stage, currentQuestionTime]);

  // 管理每分鐘觸發問題的間隔
  useEffect(() => {
    if (isRunning && stage === 'survey') {
      intervalRef.current = setInterval(() => {
        if (!currentQuestionTime && isWaiting) {
          triggerQuestion();
        }
      }, 60000);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning, stage, currentQuestionTime, isWaiting]);

  const pad = (v) => String(v).padStart(2, '0');
  const normalizeToMinute = (isoString) => {
    const date = new Date(isoString);
    date.setSeconds(0, 0);
    return date.toISOString();
  };

  const triggerQuestion = () => {
    const now = new Date().toISOString();
    setCurrentQuestionTime(now);
    setQ1(5);
    setQ2(5);
    setTraffic(5);
    setIsWaiting(false);
    setCountdown(300);
    startCountdown();
    // 清除任何現有的 timeout
    if (questionTimeoutRef.current) {
      clearTimeout(questionTimeoutRef.current);
    }
  };

  const updateQuestionProgress = (field, value) => {
    const existing = JSON.parse(localStorage.getItem('moodSurvey_currentQuestion') || '{}');
    const updated = { ...existing, [field]: value };
    localStorage.setItem('moodSurvey_currentQuestion', JSON.stringify(updated));
  };

  const handleQ1Change = (v) => {
    setQ1(v);
    updateQuestionProgress('q1', v);
  };

  const handleQ2Change = (v) => {
    setQ2(v);
    updateQuestionProgress('q2', v);
  };

  const handleTrafficChange = (v) => {
    setTraffic(v);
    updateQuestionProgress('traffic', v);
  };

  const validatePre = () =>
    userID.trim() &&
    userName.trim() &&
    qPre.purpose &&
    qPre.beenThere &&
    qPre.usedGPS &&
    qPre.passenger;

  const validatePost = () => {
    const fields = [qPost.emotion, qPost.arousal, qPost.anxiety, qPost.time, qPost.dist, qPost.shortestDist, qPost.shortestTime];
    return fields.every((v) => v !== '');
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && wakeLockRef.current) {
        wakeLockRef.current.release().then(() => {
          wakeLockRef.current = null;
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const startSurvey = async () => {
    alert('📍 請配戴手錶與心率帶，並於手錶按下開始');
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      }
    } catch (err) {
      console.warn('Wake Lock request failed:', err);
    }
    if (videoRef.current) {
      videoRef.current.play().catch(err => console.warn('iOS video play failed', err));
    }
    if (!validatePre()) {
      alert('請完整填寫出發前問卷');
      return;
    }
    const now = new Date().toISOString();
    setSurveyStartTime(now);
    setStage('survey');
    setIsRunning(true);
    triggerQuestion();
  };

  const stopSurvey = async () => {
    alert('📍 請記得停止手錶紀錄並儲存！ \n\n 📍 請記得填寫結束後問卷並上傳！');
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      } catch (err) {
        console.warn('Wake Lock release failed:', err);
      }
    }
    if (videoRef.current) videoRef.current.pause();
    clearInterval(intervalRef.current);
    clearTimeout(questionTimeoutRef.current);
    setIsRunning(false);
    setCurrentQuestionTime(null);
    setSurveyEndTime(new Date().toISOString());
    setStage('post');
    clearInterval(countdownRef.current);
    setCountdown(300);
  };

  const submitResponse = () => {
    setResponses((prev) => [...prev, { id: userID, time: currentQuestionTime, Q1: q1, Q2: q2, Traffic: traffic }]);
    setCurrentQuestionTime(null);
    setIsWaiting(true);
    clearInterval(countdownRef.current);
    // 設置 60 秒後觸發下一題
    if (questionTimeoutRef.current) {
      clearTimeout(questionTimeoutRef.current);
    }
    questionTimeoutRef.current = setTimeout(() => {
      if (isRunning && stage === 'survey') {
        triggerQuestion();
      }
    }, 60000);
  };

  const getFilledResponses = () => {
    if (!surveyStartTime) return [];
    const dedupedMap = new Map();
    for (const r of responses) {
      const norm = normalizeToMinute(r.time);
      dedupedMap.set(norm, { id: r.id, time: norm, Q1: r.Q1, Q2: r.Q2, Traffic: r.Traffic });
    }
    const start = new Date(surveyStartTime);
    const end = surveyEndTime ? new Date(surveyEndTime) : new Date();
    const result = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      const key = normalizeToMinute(cursor.toISOString());
      result.push(dedupedMap.has(key) ? dedupedMap.get(key) : { id: userID, time: key, Q1: 'NA', Q2: 'NA', Traffic: 'NA' });
      cursor.setMinutes(cursor.getMinutes() + 1);
    }
    return result;
  };

  const uploadToGDrive = async (csvContent, filename) => {
    try {
      const res = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ csv: csvContent, filename }),
      });
      const txt = await res.text();
      alert(txt + '\n\n 感謝您的協助！');
    } catch (err) {
      alert('❌ 上傳失敗：' + err.message + '\n將提供備份檔案下載。');
      setCsvBackup(csvContent);
      setFilenameBackup(filename);
      throw err;
    }
  };

  const downloadCSV = () => {
    const blob = new Blob([csvBackup], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filenameBackup || 'backup.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const finalizeUpload = async () => {
    if (!validatePost()) {
      alert('請完整填寫結束後問卷');
      return;
    }
    const data = getFilledResponses();
    if (data.length === 0) return;
    setUploading(true);
    const csv = [
      ['ID', 'Name', 'Time', 'Q1', 'Q2', 'Traffic'],
      ...data.map((r) => [r.id, userName, r.time, r.Q1, r.Q2, r.Traffic]),
      [],
      ['Pre-Emotion', qPre.emotion],
      ['Pre-Arousal', qPre.arousal],
      ['Pre-Anxiety', qPre.anxiety],
      ['Pre-Purpose', qPre.purpose],
      ['Pre-Been There', qPre.beenThere],
      ['Pre-Used GPS', qPre.usedGPS],
      ['Pre-Passenger', qPre.passenger],
      [],
      ['Post-Emotion', qPost.emotion],
      ['Post-Arousal', qPost.arousal],
      ['Post-Anxiety', qPost.anxiety],
      ['Post-Distance (km)', qPost.dist],
      ['Post-Duration (min)', qPost.time],
      ['Post-Shortest Distance?', qPost.shortestDist],
      ['Post-Shortest Time?', qPost.shortestTime],
    ].map((row) => row.join(',')).join('\n');

    const t = new Date();
    const filename = `${userID}_${pad(t.getMonth() + 1)}${pad(t.getDate())}_${pad(t.getHours())}${pad(t.getMinutes())}.csv`;
    try {
      await uploadToGDrive(csv, filename);
      setStage('done');
      // 清除 localStorage
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('moodSurvey_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (err) {
      // 留在 post 顯示備份下載區塊
    } finally {
      setUploading(false);
    }
  };

  const startCountdown = () => {
    clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          alert('⏳ 請靠邊填答問卷！');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const resetCountdown = () => {
    clearInterval(countdownRef.current);
    setCountdown(300);
    startCountdown();
  };

  // 重新開始問卷
  const resetSurvey = () => {
    // 清除 localStorage
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('moodSurvey_')) {
        localStorage.removeItem(key);
      }
    });
    // 重置所有狀態
    setUserID('');
    setUserName('');
    setStage('pre');
    setIsRunning(false);
    setResponses([]);
    setCurrentQuestionTime(null);
    setQ1(5);
    setQ2(5);
    setTraffic(5);
    setIsWaiting(false);
    setUploading(false);
    setQPre({ emotion: 5, arousal: 5, anxiety: 5, purpose: '', beenThere: '', usedGPS: '', passenger: '' });
    setQPost({ emotion: 5, arousal: 5, anxiety: 5, dist: '', time: '', shortestDist: '', shortestTime: '' });
    setCsvBackup('');
    setFilenameBackup('');
    setCountdown(300);
    setSurveyStartTime(null);
    setSurveyEndTime(null);
    clearInterval(intervalRef.current);
    clearInterval(countdownRef.current);
    clearTimeout(questionTimeoutRef.current);
    if (wakeLockRef.current) {
      wakeLockRef.current.release().then(() => {
        wakeLockRef.current = null;
      });
    }
    if (videoRef.current) videoRef.current.pause();
  };

  const RangeQuestion = ({ label, left, center, right, value, onChange }) => (
    <div className="mt-8">
      <label className="block mb-3 font-bold">{label}</label>
      <div className="flex justify-between text-base mb-2">
        <span>{left}</span>
        <span className="mx-auto">{center}</span>
        <span>{right}</span>
      </div>
      <div className="flex justify-between items-center mt-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <label key={n} className="text-center text-lg font-semibold flex-1">
            <input
              type="radio"
              name={label}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              className="accent-blue-500 scale-150 mb-1"
            /><br />
            {n}
          </label>
        ))}
      </div>
      <div className="text-center text-sm mt-2">目前選擇：{value}</div>
    </div>
  );

  const RadioQuestion = ({ label, options, value, onChange }) => (
    <div className="mt-5">
      <label className="font-bold">{label}</label><br />
      <div className="flex flex-wrap gap-4 mt-2">
        {options.map((opt) => (
          <label key={opt} className="text-lg font-medium flex items-center">
            <input
              type="radio"
              value={opt}
              checked={value === opt}
              onChange={() => onChange(opt)}
              className="mr-2"
            />
            {opt}
          </label>
        ))}
      </div>
    </div>
  );

  const Banner = ({ children }) => (
    <div className="bg-gradient-to-r from-purple-600 to-blue-500 p-4 text-center rounded-xl shadow-lg text-white text-2xl font-bold mb-6">
      {children}
    </div>
  );

  return (
    <div className="p-5 font-sans max-w-lg mx-auto">
      <h2 className="text-center text-2xl font-bold">情緒問卷調查</h2>
      {stage === 'pre' && (
        <div>
          <Banner>1. 出發前問卷</Banner>
          <input
            placeholder="請輸入 ID"
            value={userID}
            onChange={(e) => setUserID(e.target.value)}
            className="w-full mb-3 p-2 border rounded"
          />
          <input
            placeholder="請輸入姓名"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            className="w-full mb-3 p-2 border rounded"
          />
          <RadioQuestion
            label="您這趟的目的"
            options={['上學', '打工', '用餐', '購物', '遊憩（運動、出遊）', '返家', '接送', '其他']}
            value={qPre.purpose}
            onChange={(val) => setQPre({ ...qPre, purpose: val })}
          />
          <RadioQuestion
            label={<span>您本次目的地<span className="text-red-500">是否有去過</span>？</span>}
            options={['是', '否']}
            value={qPre.beenThere}
            onChange={(val) => setQPre({ ...qPre, beenThere: val })}
          />
          <RadioQuestion
            label={<span>您本次是否有使用<span className="text-red-500">導航</span>？</span>}
            options={['是', '否']}
            value={qPre.usedGPS}
            onChange={(val) => setQPre({ ...qPre, usedGPS: val })}
          />
          <RadioQuestion
            label={<span>您本次是否<span className="text-red-500">有乘客</span>？</span>}
            options={['有', '無']}
            value={qPre.passenger}
            onChange={(val) => setQPre({ ...qPre, passenger: val })}
          />
          <RangeQuestion
            label="您出發前此刻的情緒"
            left="非常不愉快"
            center="中立"
            right="非常愉快"
            value={qPre.emotion}
            onChange={(v) => setQPre({ ...qPre, emotion: v })}
          />
          <RangeQuestion
            label="您出發前此刻的激動程度"
            left="非常冷靜"
            center="中立"
            right="非常興奮"
            value={qPre.arousal}
            onChange={(v) => setQPre({ ...qPre, arousal: v })}
          />
          <RangeQuestion
            label="您出發前此刻的焦慮程度"
            left="非常不焦慮"
            center="中立"
            right="非常焦慮"
            value={qPre.anxiety}
            onChange={(v) => setQPre({ ...qPre, anxiety: v })}
          />
          <button
            onClick={startSurvey}
            className="mt-5 bg-green-500 text-white px-5 py-2 rounded-lg"
          >
            開始
          </button>
        </div>
      )}

      {stage === 'survey' && currentQuestionTime && (
        <div>
          <Banner>2. 情緒問卷：{new Date(currentQuestionTime).toLocaleTimeString()}</Banner>
          <div className={`bg-gray-100 p-3 rounded-lg border-2 border-dashed border-green-500 mb-4 text-center text-xl font-bold ${countdown <= 30 ? 'text-red-500' : 'text-gray-800'} shadow-inner`}>
            ⏳ 剩餘填答時間：{Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}
          </div>
          <h2 className="text-center text-red-500 font-bold">⭐ 請務必於每次停等紅燈時進行填答 ⭐</h2>
          <RangeQuestion
            label="Q1: 此刻的情緒"
            left="非常不愉快"
            center="中立"
            right="非常愉快"
            value={q1}
            onChange={handleQ1Change}
          />
          <RangeQuestion
            label="Q2: 此刻的激動程度"
            left="非常冷靜"
            center="中立"
            right="非常興奮"
            value={q2}
            onChange={handleQ2Change}
          />
          <RangeQuestion
            label="Q3: 此刻的路上擁擠程度"
            left="非常順暢"
            center="中等"
            right="非常擁擠"
            value={traffic}
            onChange={handleTrafficChange}
          />
          <button
            onClick={submitResponse}
            className="mt-5 bg-green-500 text-white px-5 py-2 rounded-lg"
          >
            提交本次問卷
          </button>
        </div>
      )}

      {isRunning && isWaiting && !currentQuestionTime && (
        <p className="text-gray-500 italic mt-5">已提交，下一題問卷將於一分鐘後出現...</p>
      )}

      {stage === 'survey' && (
        <button
          onClick={stopSurvey}
          className="mt-8 bg-red-500 text-white px-5 py-2 rounded-lg"
        >
          停止並填寫結束問卷
        </button>
      )}

      {stage === 'post' && (
        <div>
          <Banner>3. 結束後問卷</Banner>
          <RangeQuestion
            label="您結束此刻的情緒"
            left="非常不愉快"
            center="中立"
            right="非常愉快"
            value={qPost.emotion}
            onChange={(v) => setQPost({ ...qPost, emotion: v })}
          />
          <RangeQuestion
            label="您結束此刻的激動程度"
            left="非常冷靜"
            center="中性"
            right="非常興奮"
            value={qPost.arousal}
            onChange={(v) => setQPost({ ...qPost, arousal: v })}
          />
          <RangeQuestion
            label="您結束此刻的焦慮程度"
            left="非常不焦慮"
            center="中立"
            right="非常焦慮"
            value={qPost.anxiety}
            onChange={(v) => setQPost({ ...qPost, anxiety: v })}
          />
          <div className="mt-5">
            <label className="font-bold">您覺得大約騎了多久？（分鐘）</label><br />
            <input
              placeholder="請填寫數字，可有小數點"
              value={qPost.time}
              onChange={(e) => setQPost({ ...qPost, time: e.target.value })}
              className="w-full p-2 border rounded"
            />
          </div>
          <div className="mt-5">
            <label className="font-bold">您覺得大約騎了多遠？（公里）</label><br />
            <input
              placeholder="請填寫數字，可有小數點"
              value={qPost.dist}
              onChange={(e) => setQPost({ ...qPost, dist: e.target.value })}
              className="w-full p-2 border rounded"
            />
          </div>
          <RadioQuestion
            label={<span>您覺得此次是<span className="text-red-500">最短距離</span>路徑嗎？</span>}
            options={['是', '否']}
            value={qPost.shortestDist}
            onChange={(val) => setQPost({ ...qPost, shortestDist: val })}
          />
          <RadioQuestion
            label={<span>您覺得此次是<span className="text-red-500">最短時間</span>路徑嗎？</span>}
            options={['是', '否']}
            value={qPost.shortestTime}
            onChange={(val) => setQPost({ ...qPost, shortestTime: val })}
          />
          <button
            disabled={uploading}
            onClick={finalizeUpload}
            className={`mt-5 bg-blue-500 text-white px-5 py-2 rounded-lg ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {uploading ? '上傳中...' : '送出全部資料'}
          </button>
          <p className="text-sm text-red-500 mt-2">
            請等待跳出上傳成功訊息再離開
          </p>
          {csvBackup && !uploading && (
            <div className="mt-5">
              <button
                onClick={downloadCSV}
                className="bg-orange-500 text-white px-5 py-2 rounded-lg"
              >
                下載至裝置
              </button>
              <p className="text-red-500 mt-2">
                ⚠️ 資料未成功上傳，請下載保存再離開，並請寄至 geog404lab@gmail.com
              </p>
            </div>
          )}
        </div>
      )}

      {stage === 'done' && (
        <div className="text-center">
          <Banner>感謝您的參與！</Banner>
          <p className="text-lg">問卷已成功上傳，感謝您的協助！</p>
          <button
            onClick={resetSurvey}
            className="mt-5 bg-purple-500 text-white px-5 py-2 rounded-lg"
          >
            重新開始問卷
          </button>
        </div>
      )}

      <div className="mt-16 text-center text-sm text-gray-500">
        臺大運輸與社會研究室製
      </div>

      <video ref={videoRef} muted playsInline loop autoPlay className="hidden">
        <source src="silent.mp4" type="video/mp4" />
      </video>
    </div>
  );
};

export default MoodSurveyApp;