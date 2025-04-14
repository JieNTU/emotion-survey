import React, { useState, useRef } from "react";

export default function MoodSurveyApp() {
  const [userID, setUserID] = useState("");
  const [stage, setStage] = useState("pre");
  const [isRunning, setIsRunning] = useState(false);
  const [responses, setResponses] = useState([]);
  const [currentQuestionTime, setCurrentQuestionTime] = useState(null);
  const [q1, setQ1] = useState(5);
  const [q2, setQ2] = useState(5);
  const [traffic, setTraffic] = useState(5);
  const [isWaiting, setIsWaiting] = useState(false);
  const [qPre, setQPre] = useState({ emotion: 5, arousal: 5, anxiety: 5, purpose: "", beenThere: "", usedGPS: "" });
  const [qPost, setQPost] = useState({ emotion: 5, arousal: 5, anxiety: 5, dist: "", time: "", shortestDist: "", shortestTime: "" });
  const intervalRef = useRef(null);

  const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxz8YFkWNmMNihqi2qB8NPNs8DNqzv-aKoeoZryQLDwQBOfQ9VOJKL4eHE4gibk4YzLng/exec";

  const pad = (v) => String(v).padStart(2, "0");
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
  };

  const validatePre = () => userID.trim() && qPre.purpose && qPre.beenThere && qPre.usedGPS;
  const validatePost = () => qPost.emotion && qPost.arousal && qPost.anxiety && qPost.time && qPost.dist && qPost.shortestDist && qPost.shortestTime;

  const startSurvey = () => {
    if (!validatePre()) {
      alert("\u8acb\u5b8c\u6574\u586b\u5beb\u51fa\u767c\u524d\u554f\u5377\u8207 ID");
      return;
    }
    setStage("survey");
    setIsRunning(true);
    triggerQuestion();
    intervalRef.current = setInterval(triggerQuestion, 60000);
  };

  const stopSurvey = () => {
    clearInterval(intervalRef.current);
    setIsRunning(false);
    setCurrentQuestionTime(null);
    setStage("post");
  };

  const submitResponse = () => {
    setResponses((prev) => [...prev, { id: userID, time: currentQuestionTime, Q1: q1, Q2: q2, Traffic: traffic }]);
    setCurrentQuestionTime(null);
    setIsWaiting(true);
  };

  const getFilledResponses = () => {
    if (responses.length === 0) return [];
    const dedupedMap = new Map();
    for (const r of responses) {
      const norm = normalizeToMinute(r.time);
      if (!dedupedMap.has(norm)) {
        dedupedMap.set(norm, { id: r.id, time: norm, Q1: r.Q1, Q2: r.Q2, Traffic: r.Traffic });
      }
    }
    const sortedTimes = [...dedupedMap.keys()].sort();
    const start = new Date(sortedTimes[0]);
    const end = new Date(sortedTimes[sortedTimes.length - 1]);
    const result = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      const key = cursor.toISOString();
      result.push(dedupedMap.has(key) ? dedupedMap.get(key) : { id: userID, time: key, Q1: "NA", Q2: "NA", Traffic: "NA" });
      cursor.setMinutes(cursor.getMinutes() + 1);
    }
    return result;
  };

  const uploadToGDrive = async (csvContent, filename) => {
    try {
      const res = await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
        },
        body: JSON.stringify({ csv: csvContent, filename }),
      });
      const txt = await res.text();
      alert(txt);
    } catch (err) {
      alert("\u274c \u4e0a\u50b3\u5931\u6557\uff1a" + err.message);
    }
  };

  const finalizeUpload = async () => {
    if (!validatePost()) {
      alert("\u8acb\u5b8c\u6574\u586b\u5beb\u7d50\u675f\u5f8c\u554f\u5377");
      return;
    }
    const data = getFilledResponses();
    if (data.length === 0) return;

    const csv = [
      ["ID", "Time", "Q1", "Q2", "Traffic"],
      ...data.map((r) => [r.id, r.time, r.Q1, r.Q2, r.Traffic]),
      [],
      ["Pre-Emotion", qPre.emotion],
      ["Pre-Arousal", qPre.arousal],
      ["Pre-Anxiety", qPre.anxiety],
      ["Pre-Purpose", qPre.purpose],
      ["Pre-Been There", qPre.beenThere],
      ["Pre-Used GPS", qPre.usedGPS],
      [],
      ["Post-Emotion", qPost.emotion],
      ["Post-Arousal", qPost.arousal],
      ["Post-Anxiety", qPost.anxiety],
      ["Post-Distance (km)", qPost.dist],
      ["Post-Duration (min)", qPost.time],
      ["Post-Shortest Distance?", qPost.shortestDist],
      ["Post-Shortest Time?", qPost.shortestTime],
    ].map((row) => row.join(",")).join("\n");

    const t = new Date();
    const filename = `${userID}_${pad(t.getMonth() + 1)}${pad(t.getDate())}_${pad(t.getHours())}${pad(t.getMinutes())}.csv`;

    uploadToGDrive(csv, filename);
    setStage("done");
  };

  // const RangeQuestion = ({ label, left, center, right, value, onChange }) => (
  //   <div style={{ marginTop: 20 }}>
  //     <label><strong>{label}</strong></label>
  //     <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
  //       <span>{left}</span><span>{center}</span><span>{right}</span>
  //     </div>
  //     <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', marginTop: 10 }}>
  //       {[1,2,3,4,5,6,7,8,9].map((v) => (
  //         <label key={v} style={{ flex: '1 0 10%', textAlign: 'center', marginBottom: 5 }}>
  //           <input type="radio" name={label} value={v} checked={value === v} onChange={() => onChange(v)} />
  //           <div>{v}</div>
  //         </label>
  //       ))}
  //     </div>
  //     <div>目前選擇：{value}</div>
  //   </div>
  // );

  const RadioQuestion = ({ label, options, value, onChange }) => (
    <div style={{ marginTop: 20 }}>
      <label><strong>{label}</strong></label><br />
      {options.map((opt, i) => (
        <label key={i} style={{ marginRight: 10 }}>
          <input type="radio" value={opt} checked={value === opt} onChange={() => onChange(opt)} style={{ marginRight: 5 }} />
          {opt}
        </label>
      ))}
    </div>
  );

  const RangeQuestion = ({ label, left, center, right, value, onChange }) => (
    <div style={{ marginTop: 32 }}>
      <label style={{ display: 'block', marginBottom: 12 }}><strong>{label}</strong></label>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', marginBottom: 8 }}>
        <span>{left}</span>
        <span style={{ marginLeft: 'auto', marginRight: 'auto' }}>{center}</span>
        <span>{right}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <label key={n} style={{ textAlign: 'center', fontSize: '12px', fontWeight: '600', flex: 1 }}>
            <input
              type="radio"
              name={label}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              style={{ transform: 'scale(1.5)', marginBottom: 4 }}
            /><br />
            {n}
          </label>
        ))}
      </div>
      <div style={{ textAlign: 'center', fontSize: 14, marginTop: 8 }}>目前選擇：{value}</div>
    </div>
  );
  
    return (
    <div style={{ padding: 20, fontFamily: 'Arial', maxWidth: 600, margin: 'auto' }}>
      {stage === 'pre' && (
        <div>
          <h3>出發前問卷</h3>
          <input placeholder="請輸入 ID" value={userID} onChange={(e) => setUserID(e.target.value)} style={{ width: '100%', marginBottom: 10 }} />
          <RadioQuestion label="您這趟的目的" options={["上學", "打工", "用餐", "購物", "遊憩（運動、出遊）", "其他"]} value={qPre.purpose} onChange={(val) => setQPre({ ...qPre, purpose: val })} />
          <RadioQuestion label={<span>您本次目的地<span style={{ color: 'red' }}>是否有去過</span>？</span>} options={["是", "否"]} value={qPre.beenThere} onChange={(val) => setQPre({ ...qPre, beenThere: val })} />
          <RadioQuestion label={<span>您本次是否有使用<span style={{ color: 'red' }}>導航</span>？</span>} options={["是", "否"]} value={qPre.usedGPS} onChange={(val) => setQPre({ ...qPre, usedGPS: val })} />
          <RangeQuestion label="您出發前此刻的情緒" left="非常不愉快" center="中立" right="非常愉快" value={qPre.emotion} onChange={(v) => setQPre({ ...qPre, emotion: v })} />
          <RangeQuestion label="您出發前此刻的激動程度" left="非常冷靜" center="中立" right="非常興奮" value={qPre.arousal} onChange={(v) => setQPre({ ...qPre, arousal: v })} />
          <RangeQuestion label="您出發前此刻的焦慮程度" left="非常不焦慮" center="中立" right="非常焦慮" value={qPre.anxiety} onChange={(v) => setQPre({ ...qPre, anxiety: v })} />
          <button onClick={startSurvey} style={{ marginTop: 20, backgroundColor: '#4caf50', color: '#fff', padding: '10px 20px', borderRadius: 6 }}>開始</button>
        </div>
      )}

      {stage === 'survey' && currentQuestionTime && (
        <div>
          <h3>問卷進行中：{new Date(currentQuestionTime).toLocaleTimeString()}</h3>
          <RangeQuestion label="Q1: 此刻的情緒" left="非常不愉快" center="中立" right="非常愉快" value={q1} onChange={setQ1} />
          <RangeQuestion label="Q2: 此刻的激動程度" left="非常冷靜" center="中立" right="非常興奮" value={q2} onChange={setQ2} />
          <RangeQuestion label="Q3: 此刻的路上擁擠程度" left="非常順暢" center="中等" right="非常擁擠" value={traffic} onChange={setTraffic} />
          <button onClick={submitResponse} style={{ marginTop: 20, backgroundColor: '#4caf50', color: '#fff', padding: '10px 20px', borderRadius: 6 }}>提交本次問卷</button>
        </div>
      )}

      {isRunning && isWaiting && (
        <p style={{ color: '#888', fontStyle: 'italic', marginTop: 20 }}>已提交，下一題問卷即將出現...</p>
      )}

      {stage === 'survey' && (
        <button onClick={stopSurvey} style={{ marginTop: 30, backgroundColor: '#f44336', color: '#fff', padding: '10px 20px', borderRadius: 6 }}>停止並填寫結束問卷</button>
      )}

      {stage === 'post' && (
        <div>
          <h3>結束後問卷</h3>
          <RangeQuestion label="您結束此刻的情緒" left="非常不愉快" center="中立" right="非常愉快" value={qPost.emotion} onChange={(v) => setQPost({ ...qPost, emotion: v })} />
          <RangeQuestion label="您結束此刻的激動程度" left="非常冷靜" center="中性" right="非常興奮" value={qPost.arousal} onChange={(v) => setQPost({ ...qPost, arousal: v })} />
          <RangeQuestion label="您結束此刻的焦慮程度" left="非常不焦慮" center="中立" right="非常焦慮" value={qPost.anxiety} onChange={(v) => setQPost({ ...qPost, anxiety: v })} />
          <div style={{ marginTop: 20 }}>
            <label><strong>您覺得大約騎了多久？（分鐘）</strong></label><br />
            <input placeholder="請填寫數字，可有小數點" value={qPost.time} onChange={(e) => setQPost({ ...qPost, time: e.target.value })} style={{ width: '100%' }} />
          </div>
          <div style={{ marginTop: 20 }}>
            <label><strong>您覺得大約騎了多遠？（公里）</strong></label><br />
            <input placeholder="請填寫數字，可有小數點" value={qPost.dist} onChange={(e) => setQPost({ ...qPost, dist: e.target.value })} style={{ width: '100%' }} />
          </div>
          <RadioQuestion label={<span>您覺得此次是<span style={{ color: 'red' }}>最短距離</span>路徑嗎？</span>} options={["是", "否"]} value={qPost.shortestDist} onChange={(val) => setQPost({ ...qPost, shortestDist: val })} />
          <RadioQuestion label={<span>您覺得此次是<span style={{ color: 'red' }}>最短時間</span>路徑嗎？</span>} options={["是", "否"]} value={qPost.shortestTime} onChange={(val) => setQPost({ ...qPost, shortestTime: val })} />
          <button onClick={finalizeUpload} style={{ marginTop: 20, backgroundColor: '#2196f3', color: '#fff', padding: '10px 20px', borderRadius: 6 }}>送出全部資料</button>
          <p style={{ fontSize: '0.9em', color: 'red', marginTop: 6 }}>
            請等待跳出上傳成功訊息再離開
          </p>
        </div>
      )}

      <div style={{ marginTop: 60, textAlign: 'center', fontSize: '0.8em', color: '#999' }}>
        臺大運輸與社會研究室製
      </div>
    </div>
  );

}
