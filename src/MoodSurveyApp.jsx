import React, { useState, useRef } from "react";

export default function MoodSurveyApp() {
  const [userID, setUserID] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [responses, setResponses] = useState([]);
  const [currentQuestionTime, setCurrentQuestionTime] = useState(null);
  const [q1, setQ1] = useState(5);
  const [q2, setQ2] = useState(5);
  const [isWaiting, setIsWaiting] = useState(false);
  const intervalRef = useRef(null);

  const pad = (v) => String(v).padStart(2, "0");

  const normalizeToMinute = (isoString) => {
    const date = new Date(isoString);
    date.setSeconds(0, 0);
    return date.toISOString();
  };

  const triggerQuestion = () => {
    const now = new Date();
    const newTime = now.toISOString();
    setCurrentQuestionTime(newTime);
    setQ1(5);
    setQ2(5);
    setIsWaiting(false);
  };

  const startSurvey = () => {
    if (!userID.trim()) {
      alert("請先輸入 ID");
      return;
    }
    setIsRunning(true);
    triggerQuestion();
    intervalRef.current = setInterval(triggerQuestion, 60000);
  };

  const stopSurvey = () => {
    clearInterval(intervalRef.current);
    setIsRunning(false);
  };

  const submitResponse = () => {
    setResponses((prev) => [
      ...prev,
      {
        id: userID,
        time: currentQuestionTime,
        Q1: q1 ?? "NA",
        Q2: q2 ?? "NA",
      },
    ]);
    setCurrentQuestionTime(null);
    setIsWaiting(true);
  };

  const getFilledResponses = () => {
    if (responses.length === 0) return [];

    const dedupedMap = new Map();
    for (const r of responses) {
      const norm = normalizeToMinute(r.time);
      if (!dedupedMap.has(norm)) {
        dedupedMap.set(norm, { id: r.id, time: norm, Q1: r.Q1, Q2: r.Q2 });
      }
    }

    const sortedTimes = [...dedupedMap.keys()].sort();
    const start = new Date(sortedTimes[0]);
    const end = new Date(sortedTimes[sortedTimes.length - 1]);
    const result = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      const key = cursor.toISOString();
      result.push(
        dedupedMap.has(key)
          ? dedupedMap.get(key)
          : { id: userID, time: key, Q1: "NA", Q2: "NA" }
      );
      cursor.setMinutes(cursor.getMinutes() + 1);
    }
    return result;
  };

  const uploadData = () => {
    const filled = getFilledResponses();
    if (filled.length === 0) {
      alert("尚未有任何資料");
      return;
    }

    const d = new Date(filled[filled.length - 1].time);
    const MM = pad(d.getMonth() + 1);
    const DD = pad(d.getDate());
    const hh = pad(d.getHours());
    const mm = pad(d.getMinutes());
    const filename = `${userID}_${MM}${DD}_${hh}${mm}.csv`;

    const header = "ID,Time,Q1,Q2\n";
    const rows = filled.map(r => `${r.id},${r.time},${r.Q1},${r.Q2}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: 20 }}>
      {!isRunning && (
        <div>
          <input
            placeholder="請輸入你的 ID"
            value={userID}
            onChange={(e) => setUserID(e.target.value)}
            style={{ padding: 6, margin: 4, border: "1px solid #ccc", borderRadius: 4 }}
          />
          <button
            onClick={startSurvey}
            style={{ padding: 8, margin: 4, backgroundColor: "#ddd", borderRadius: 6 }}
          >
            開始
          </button>
        </div>
      )}

      {isRunning && currentQuestionTime && (
        <div>
          <p>時間：{new Date(currentQuestionTime).toLocaleTimeString()}</p>

          <div style={{ marginTop: 20 }}>
            <label><strong>Q1: 不愉快 - 中立 - 愉快</strong></label>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span>非常不愉快</span>
              <span>中立</span>
              <span>非常愉快</span>
            </div>
            <input
              type="range"
              min="1"
              max="9"
              value={q1}
              onChange={(e) => setQ1(parseInt(e.target.value))}
              style={{ width: "100%" }}
            />
            <span>目前選擇：{q1}</span>
          </div>

          <div style={{ marginTop: 20 }}>
            <label><strong>Q2: 沉靜 - 中性 - 興奮</strong></label>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span>非常沉靜</span>
              <span>中性</span>
              <span>非常興奮</span>
            </div>
            <input
              type="range"
              min="1"
              max="9"
              value={q2}
              onChange={(e) => setQ2(parseInt(e.target.value))}
              style={{ width: "100%" }}
            />
            <span>目前選擇：{q2}</span>
          </div>

          <button
            onClick={submitResponse}
            style={{ padding: 8, marginTop: 12, backgroundColor: "#bbb", borderRadius: 6 }}
          >
            提交本次問卷
          </button>
        </div>
      )}

      {isRunning && isWaiting && (
        <div style={{ marginTop: 20, fontStyle: "italic", color: "#777" }}>
          ✅ 問卷已提交，請稍候，下一題問卷將於一分鐘後出現...
        </div>
      )}

      {isRunning && (
        <button
          onClick={stopSurvey}
          style={{ padding: 8, marginTop: 30, backgroundColor: "#f88", borderRadius: 6 }}
        >
          停止
        </button>
      )}

      {!isRunning && getFilledResponses().length > 0 && (
        <div style={{ marginTop: 30 }}>
          <h3>結果 (ID, Time, Q1, Q2)</h3>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th style={{ border: "1px solid #ccc", padding: 4 }}>ID</th>
                <th style={{ border: "1px solid #ccc", padding: 4 }}>Time</th>
                <th style={{ border: "1px solid #ccc", padding: 4 }}>Q1</th>
                <th style={{ border: "1px solid #ccc", padding: 4 }}>Q2</th>
              </tr>
            </thead>
            <tbody>
              {getFilledResponses().map((r, idx) => (
                <tr key={idx}>
                  <td style={{ border: "1px solid #ccc", padding: 4 }}>{r.id}</td>
                  <td style={{ border: "1px solid #ccc", padding: 4 }}>{r.time}</td>
                  <td style={{ border: "1px solid #ccc", padding: 4 }}>{r.Q1}</td>
                  <td style={{ border: "1px solid #ccc", padding: 4 }}>{r.Q2}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <button
            onClick={uploadData}
            style={{ marginTop: 12, padding: 10, backgroundColor: "#28a", color: "white", borderRadius: 6 }}
          >
            ⬆ 下載結果 CSV
          </button>
        </div>
      )}
    </div>
  );
}
