import React, { useState, useRef } from "react";

export default function MoodSurveyApp() {
  const [userID, setUserID] = useState("");
  const [stage, setStage] = useState("pre");
  const [qPre, setQPre] = useState({ purposes: [], beenThere: "", usedGPS: "" });
  const [qPost, setQPost] = useState({});
  const [responses, setResponses] = useState([]);
  const [currentQuestionTime, setCurrentQuestionTime] = useState(null);
  const [q1, setQ1] = useState(5);
  const [q2, setQ2] = useState(5);
  const [traffic, setTraffic] = useState(5);
  const [isWaiting, setIsWaiting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef(null);
  const [customPurpose, setCustomPurpose] = useState("");
  const [postExtra, setPostExtra] = useState({ dist: "", time: "", shortestDist: "", shortestTime: "", distOther: "", timeOther: "" });

  const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwSutWjU5j2ESmBOe3xosORVOIc_z_aMyEAF--EetTZdwpWxVcyXguKyEiNFugS_EhcBw/exec";

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

  const startSurvey = () => {
    if (!userID.trim()) {
      alert("請先輸入 ID");
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

  const finalizeUpload = () => {
    const data = getFilledResponses();
    if (data.length === 0) return;

    const csv = [
      ["ID", "Time", "Q1", "Q2", "Traffic"],
      ...data.map((r) => [r.id, r.time, r.Q1, r.Q2, r.Traffic]),
    ].map((row) => row.join(",")).join("\n");

    const lastTime = data[data.length - 1].time;
    const t = new Date(lastTime);
    const filename = ${userID}_${pad(t.getMonth() + 1)}${pad(t.getDate())}_${pad(t.getHours())}${pad(t.getMinutes())}.csv;

    uploadToGDrive(csv, filename);
    setStage("done");
  };

  const submitResponse = () => {
    setResponses((prev) => [
      ...prev,
      {
        id: userID,
        time: currentQuestionTime,
        Q1: q1 ?? "NA",
        Q2: q2 ?? "NA",
        Traffic: traffic ?? "NA",
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
      result.push(
        dedupedMap.has(key)
          ? dedupedMap.get(key)
          : { id: userID, time: key, Q1: "NA", Q2: "NA", Traffic: "NA" }
      );
      cursor.setMinutes(cursor.getMinutes() + 1);
    }
    return result;
  };

  const uploadToGDrive = async (csvContent, filename) => {
    try {
      const res = await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvContent, filename, qPre: { ...qPre, customPurpose }, qPost: { ...qPost, ...postExtra } }),
      });
      const txt = await res.text();
      alert(txt);
    } catch (err) {
      alert("❌ 上傳失敗：" + err.message);
    }
  };

  const RangeQuestion = ({ label, left, center, right, value, onChange }) => (
    <div style={{ marginTop: 20 }}>
      <label><strong>{label}</strong></label>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
        <span>{left}</span>
        <span>{center}</span>
        <span>{right}</span>
      </div>
      <input
        type="range"
        min="1"
        max="9"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        style={{ width: "100%" }}
      />
      <span>目前選擇：{value}</span>
    </div>
  );

  const RadioQuestion = ({ label, options, value, onChange }) => (
    <div style={{ marginTop: 20 }}>
      <label><strong>{label}</strong></label><br />
      {options.map((opt, i) => (
        <label key={i} style={{ marginRight: 10 }}>
          <input
            type="radio"
            value={opt}
            checked={value === opt}
            onChange={() => onChange(opt)}
            style={{ marginRight: 5 }}
          />
          {opt}
        </label>
      ))}
    </div>
  );

  const CheckboxQuestion = ({ label, options, values, onChange }) => (
    <div style={{ marginTop: 20 }}>
      <label><strong>{label}</strong></label><br />
      {options.map((opt, i) => (
        <label key={i} style={{ marginRight: 10 }}>
          <input
            type="checkbox"
            value={opt}
            checked={values.includes(opt)}
            onChange={(e) => {
              if (e.target.checked) onChange([...values, opt]);
              else onChange(values.filter((v) => v !== opt));
            }}
            style={{ marginRight: 5 }}
          />
          {opt}
        </label>
      ))}
      {values.includes("其他") && (
        <div style={{ marginTop: 10 }}>
          <input
            placeholder="請填寫其他目的"
            value={customPurpose}
            onChange={(e) => setCustomPurpose(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>
      )}
    </div>
  );

  return (
    <div style={{ padding: 20, fontFamily: 'Arial', maxWidth: 600, margin: 'auto' }}>
      {stage === "pre" && (
        <div>
          <h3>出發前問卷</h3>
          <input placeholder="請輸入 ID" value={userID} onChange={(e) => setUserID(e.target.value)} style={{ width: '100%', marginBottom: 10 }} />
          <CheckboxQuestion label="您這趟的目的" options={["上學", "打工", "用餐", "購物", "遊憩（運動、出遊）", "其他"]} values={qPre.purposes} onChange={(vals) => setQPre({ ...qPre, purposes: vals })} />
          <RadioQuestion label="您本次目的地是否有去過？" options={["是", "否"]} value={qPre.beenThere} onChange={(val) => setQPre({ ...qPre, beenThere: val })} />
          <RadioQuestion label="您本次是否有使用導航？" options={["是", "否"]} value={qPre.usedGPS} onChange={(val) => setQPre({ ...qPre, usedGPS: val })} />
          <RangeQuestion label="您出發前此刻的情緒" left="非常不愉快" center="中立" right="非常愉快" value={qPre.emotion || 5} onChange={(v) => setQPre({ ...qPre, emotion: v })} />
          <RangeQuestion label="您出發前此刻的激動程度" left="非常冷靜" center="中性" right="非常興奮" value={qPre.arousal || 5} onChange={(v) => setQPre({ ...qPre, arousal: v })} />
          <RangeQuestion label="您出發前此刻的焦慮程度" left="非常不焦慮" center="中立" right="非常焦慮" value={qPre.anxiety || 5} onChange={(v) => setQPre({ ...qPre, anxiety: v })} />
           <button onClick={startSurvey} style={{ marginTop: 20, backgroundColor: '#4caf50', color: '#fff', padding: '10px 20px', borderRadius: 6 }}>開始</button>
        </div>
      )}

      {stage === "survey" && currentQuestionTime && (
        <div>
          <h3>問卷進行中：{new Date(currentQuestionTime).toLocaleTimeString()}</h3>
          <RangeQuestion label="Q1: 不愉快 - 中立 - 愉快" left="非常不愉快" center="中立" right="非常愉快" value={q1} onChange={setQ1} />
          <RangeQuestion label="Q2: 沉靜 - 中性 - 興奮" left="非常冷靜" center="中性" right="非常興奮" value={q2} onChange={setQ2} />
          <RangeQuestion label="Q3: 車流量" left="非常少" center="中等" right="非常多" value={traffic} onChange={setTraffic} />
          <button onClick={submitResponse} style={{ marginTop: 20, backgroundColor: '#4caf50', color: '#fff', padding: '10px 20px', borderRadius: 6 }}>
  提交本次問卷
</button>

        </div>
      )}

      {isRunning && isWaiting && (
        <p style={{ color: '#888', fontStyle: 'italic', marginTop: 20 }}>已提交，下一題問卷即將出現...</p>
      )}

      {stage === "survey" && (
        <button onClick={stopSurvey} style={{ marginTop: 30, backgroundColor: '#f44336', color: '#fff', padding: '10px 20px', borderRadius: 6 }}>停止並填寫結束問卷</button>
      )}

      {stage === "post" && (
        <div>
          <h3>結束後問卷</h3>
          <RangeQuestion label="您結束旅次此刻的情緒" left="非常不愉快" center="中立" right="非常愉快" value={qPost.emotion || 5} onChange={(v) => setQPost({ ...qPost, emotion: v })} />
          <RangeQuestion label="您結束旅次此刻的激動程度" left="非常冷靜" center="中性" right="非常興奮" value={qPost.arousal || 5} onChange={(v) => setQPost({ ...qPost, arousal: v })} />
          <RangeQuestion label="您結束旅次此刻的焦慮程度" left="非常不焦慮" center="中立" right="非常焦慮" value={qPost.anxiety || 5} onChange={(v) => setQPost({ ...qPost, anxiety: v })} />
          <div style={{ marginTop: 20 }}>
            <label><strong>您覺得大約騎了多久？（分鐘）</strong></label><br />
            <input value={postExtra.time} onChange={(e) => setPostExtra({ ...postExtra, time: e.target.value })} style={{ width: '100%' }} />
          </div>
          <div style={{ marginTop: 20 }}>
            <label><strong>您覺得大約騎了多遠？（公里）</strong></label><br />
            <input value={postExtra.dist} onChange={(e) => setPostExtra({ ...postExtra, dist: e.target.value })} style={{ width: '100%' }} />
          </div>
          <RadioQuestion label="您覺得此次是最短距離路徑嗎？" options={["是", "否"]} value={postExtra.shortestDist} onChange={(val) => setPostExtra({ ...postExtra, shortestDist: val })} />
          <RadioQuestion label="您覺得此次是最短時間路徑嗎？" options={["是", "否"]} value={postExtra.shortestTime} onChange={(val) => setPostExtra({ ...postExtra, shortestTime: val })} />
          <button onClick={finalizeUpload} style={{ marginTop: 20, backgroundColor: '#2196f3', color: '#fff', padding: '10px 20px', borderRadius: 6 }}>送出全部資料</button>
        </div>
      )}

      {stage === "done" && <p>✅ 資料已成功上傳，感謝您的填寫！</p>}
    </div>
  );
}