import React, { useState } from 'react';
import { db } from './firebase';
import { collection, addDoc, getDocs, limit, orderBy, query } from 'firebase/firestore';

const getTimestamp = () => new Date().toISOString();
const prefectures = ['北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県', '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県', '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県', '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県', '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'];
const roomUsages = ['保育室','休憩室','多目的室','図書室','音楽室','乳児室','ほふく室','遊戯室（ホール）','調理室','職員室','その他',];
const checklistItems = [
  '室内に人がいない状態にしました(測定者のみ)。',
  '窓・ドア・カーテンを普段の状態にしました。',
  'エアコン・換気扇・空気清浄機など、音の出る機器を止めました。',
  '端末の音量を最大にし、通知音が鳴らないようにしました。',
  '屋外や隣の部屋から大きな音が聞こえない状態です。',
  '測定中は動かず、物音を立てないことを理解しました。',
];

export default function App() {
  const [page, setPage] = useState(1);
  const [prevPage, setPrevPage] = useState(1); // 直前のページ一時記録
  const [form, setForm] = useState({ name: '', pref: '', city: '', kids: '', usage: '', l: 0, w: 0, h: 0 });
  const [checklist, setChecklist] = useState(() => checklistItems.map(() => false));
  const [savedResults, setSavedResults] = useState([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState('');

  const V = form.l * form.w * form.h; // 室容積
  const dc = 0.057 * Math.sqrt(V / 0.5); // 直接音距離
  const getPoints = (vol) => vol < 100 ? 3 : vol < 200 ? 5 : 6;
  const numPoints = getPoints(V);

  // 必須入力チェック
  const isP3NextDisabled = page === 3 && (!form.name || form.l <= 0 || form.w <= 0 || form.h <= 0);
  const isNextDisabled = isP3NextDisabled || (page === 4 && checklist.some((checked) => !checked));

  // 間取り図スケーリング
  const maxDim = Math.max(form.l, form.w) || 1;
  const scale = 160 / maxDim;
  const svgW = form.w * scale;
  const svgL = form.l * scale;
  const rectX = 100 - svgW / 2;
  const rectY = 100 - svgL / 2;

  const planScale = 210 / Math.max(form.l, form.w || 1);
  const planWidth = form.w > 0 ? form.w * planScale : 0;
  const planHeight = form.l > 0 ? form.l * planScale : 0;
  const planX = form.w > 0 ? (320 - planWidth) / 2 : 0;
  const planY = form.l > 0 ? (260 - planHeight) / 2 : 0;

  const getPointCoords = (num) => {
    if (num === 3) return [{ x: 0.25, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.75, y: 0.5 }];
    if (num === 5) return [{ x: 0.25, y: 0.25 }, { x: 0.75, y: 0.25 }, { x: 0.5, y: 0.5 }, { x: 0.25, y: 0.75 }, { x: 0.75, y: 0.75 }];
    if (num === 6) return [{ x: 0.25, y: 0.25 }, { x: 0.5, y: 0.25 }, { x: 0.75, y: 0.25 }, { x: 0.25, y: 0.75 }, { x: 0.5, y: 0.75 }, { x: 0.75, y: 0.75 }];
    return [];
  };
  const formatDistance = (distance) => Number(distance.toFixed(2)).toString();
  const fillTestData = () => setForm((current) => ({
    ...current,
    name: 'テスト保育園',
    pref: '千葉県',
    city: '習志野市',
    usage: '保育室',
    l: 5,
    w: 7,
    h: 3,
  }));
  const handleRetrySamePlace = () => {
    setChecklist(checklistItems.map(() => false));
    setPage(4);
  };
  const handleMeasureDifferentPlace = () => {
    setForm({ name: '', pref: '', city: '', kids: '', usage: '', l: 0, w: 0, h: 0 });
    setChecklist(checklistItems.map(() => false));
    setPage(3);
  };

  const handleShowSavedResults = async () => {
    setPage(8);
    setResultsError('');
    if (!db) {
      setResultsError('Firebase の設定が未完了です。');
      return;
    }

    setResultsLoading(true);
    try {
      const resultsQuery = query(collection(db, 'measurements'), orderBy('date', 'desc'), limit(50));
      const snapshot = await getDocs(resultsQuery);
      setSavedResults(snapshot.docs.map((document) => ({ ...document.data(), id: document.id })));
    } catch (error) {
      console.error('測定結果の読み込みに失敗しました:', error);
      setResultsError('結果を読み込めませんでした。Firestore の読み取り権限を確認してください。');
    } finally {
      setResultsLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!db) {
      alert('Firebase の設定が未完了です。環境変数 VITE_FIREBASE_API_KEY と VITE_FIREBASE_APP_ID を設定してください。');
      return;
    }

    try {
      await addDoc(collection(db, 'measurements'), {
        facilityName: form.name,
        location: `${form.pref} ${form.city}`,
        kids: form.kids,
        usage: form.usage,
        depth: form.l,
        width: form.w,
        height: form.h,
        volume: V,
        dc: dc,
        points: numPoints,
        date: getTimestamp(),
      });
      alert('データをアップロードしました！');
    } catch (e) {
      alert('エラー: ' + e.message);
    }
  };

  const handleHelpClick = () => {
    if (page !== 0) {
      setPrevPage(page);
      setPage(0);
    }
  };

  // 統一ワンクリックボタンのボタンスタイル
  const headerButtonStyle = {
    width: '96px',
    height: '36px',
    boxSizing: 'border-box',
    whiteSpace: 'nowrap',
    fontSize: '14px',
    fontWeight: 'bold',
    padding: '8px',
    background: '#ffffff',
    color: '#333333',
    border: '1px solid #ced4da',
    borderRadius: '6px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
    cursor: 'pointer',
    outline: 'none',
  };

  return (
    <div style={{ width: '100%', boxSizing: 'border-box', padding: '20px', fontFamily: 'sans-serif', margin: '0 auto' }}>
      
      <div style={{ display: 'grid', gridTemplateColumns: '96px 96px', justifyContent: 'space-between', width: '100%', marginBottom: '20px' }}>
        <button onClick={() => setPage(1)} style={headerButtonStyle}>
          🏠 ホーム
        </button>
        <button onClick={handleHelpClick} style={headerButtonStyle}>
          ❓ ヘルプ
        </button>
      </div>

      {/* P0: アプリの説明（ヘルプ画面） */}
      {page === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', lineHeight: '1.6' }}>
          <h2>💡 アプリの説明（ヘルプ）</h2>
          <p>このアプリケーションは、保育施設における最適な音環境（残響時間）を整えるため、室容積や最適な測定ポイントを算出・ガイドする測定支援ツールです。</p>
          <ul style={{ margin: '0', paddingLeft: '20px' }}>
            <li><strong>自動算出:</strong> 部屋の寸法を入力するだけで室容積、推奨測定点数、直接音距離を瞬時に計算します。</li>
            <li><strong>ガイド機能:</strong> 室容積に合わせた最適なマッピング図を画面上に自動で描画します。</li>
          </ul>
          <button onClick={() => setPage(prevPage)} style={{ padding: '10px 20px', fontSize: '16px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', width: '100%' }}>
            元の画面に戻る
          </button>
        </div>
      )}

      {/* P1: ホーム画面 */}
      {page === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '12px', minHeight: 'calc(100svh - 96px)', textAlign: 'center' }}>
          <h1>保育士向け残響測定</h1>
          <button style={{ width: '100%', boxSizing: 'border-box', padding: '20px', fontSize: '18px' }} onClick={() => setPage(2)}>🔊 測定を始める</button>
          <button style={{ width: '100%', boxSizing: 'border-box', padding: '20px', fontSize: '18px' }} onClick={handleShowSavedResults}>📁 今までの結果</button>
        </div>
      )}

      {/* P2: 測定概要 */}
      {page === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left', lineHeight: '1.6' }}>
          <h2>当アプリの概要</h2>
          <p>このアプリは保育施設における残響時間を測定することによって、全国の保育施設の音環境をより良くしていくことを目的に開発されました。以下の手順で進んでいきます。</p>
          <ol style={{ margin: '0', paddingLeft: '24px' }}>
            <li><strong>準備:</strong> 施設名を含む基本情報の入力、また部屋の寸法を入力します。その後、チェックリストや指示に沿って正確な測定に向けた準備を行います。</li>
            <li><strong>測定:</strong> アプリから音を鳴らして、部屋の響きを記録します。測定中はできるだけ静かにしてください。</li>
            <li><strong>結果表示:</strong> 残響時間が表示され、データをアップロードすることによって結果が保存されます。その他、測定をやり直すことや別の場所で測定を行うことも出来ます。</li>
          </ol>
          <p>内容を確認したら「次へ」を押してください。</p>
        </div>
      )}

      {/* P3: 測定に必要な情報入力 */}
      {page === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h2 style={{ margin: '0', fontSize: '24px', fontWeight: '700', textAlign: 'left', color: '#1f2937' }}>施設・部屋の情報</h2>
          <button type="button" onClick={fillTestData} style={{ width: '100%', boxSizing: 'border-box', padding: '10px', border: '1px solid #9ca3af', borderRadius: '8px', background: '#f3f4f6', color: '#111827', fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}>
            テスト情報を入力
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: '#111827', fontSize: '18px', fontWeight: '700', textAlign: 'left' }}>
            <span>施設</span>
            <span style={{ color: '#111827', fontSize: '16px', fontWeight: '700' }}>施設名</span>
          </div>
          <input placeholder="※施設名を入力" value={form.name} onChange={e => setForm({...form, name: e.target.value})} style={{ width: '100%', boxSizing: 'border-box', padding: '10px', fontSize: '16px', color: '#374151', textAlign: 'left', border: '1px solid #d1d5db', borderRadius: '8px' }} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', fontSize: '16px', fontWeight: '600', gap: '6px', color: '#374151', textAlign: 'left' }}>
              <span>県</span>
              <select value={form.pref} onChange={e => setForm({...form, pref: e.target.value})} style={{ width: '100%', padding: '10px', boxSizing: 'border-box', fontSize: '16px', color: '#374151', textAlign: 'left', border: '1px solid #d1d5db', borderRadius: '8px' }}>
                <option value="">選択してください</option>
                {prefectures.map((pref) => (
                  <option key={pref} value={pref}>{pref}</option>
                ))}
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', fontSize: '16px', fontWeight: '600', gap: '6px', color: '#374151', textAlign: 'left' }}>
              <span>市町村</span>
              <input placeholder="市町村" value={form.city} onChange={e => setForm({...form, city: e.target.value})} style={{ width: '100%', boxSizing: 'border-box', padding: '10px', fontSize: '16px', color: '#374151', textAlign: 'left', border: '1px solid #d1d5db', borderRadius: '8px' }} />
            </label>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '16px', color: '#111827', fontSize: '18px', fontWeight: '700', textAlign: 'left' }}>
            <span>部屋</span>
            <span style={{ color: '#111827', fontSize: '16px', fontWeight: '700' }}>部屋の用途</span>
          </div>
          <select value={form.usage} onChange={e => setForm({...form, usage: e.target.value})} style={{ width: '100%', padding: '10px', boxSizing: 'border-box', fontSize: '16px', color: '#374151', textAlign: 'left', border: '1px solid #d1d5db', borderRadius: '8px' }}>
            <option value="">選択してください</option>
            {roomUsages.map((usage) => (
              <option key={usage} value={usage}>{usage}</option>
            ))}
          </select>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', fontSize: '16px', fontWeight: '600', gap: '6px', color: '#374151', textAlign: 'left' }}>
              <span>奥行 (m)</span>
              <input type="number" value={form.l || ''} onChange={e => setForm({...form, l: Number(e.target.value)})} style={{ width: '100%', boxSizing: 'border-box', padding: '10px', fontSize: '16px', color: '#374151', textAlign: 'left', border: '1px solid #d1d5db', borderRadius: '8px' }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', fontSize: '16px', fontWeight: '600', gap: '6px', color: '#374151', textAlign: 'left' }}>
              <span>幅 (m)</span>
              <input type="number" value={form.w || ''} onChange={e => setForm({...form, w: Number(e.target.value)})} style={{ width: '100%', boxSizing: 'border-box', padding: '10px', fontSize: '16px', color: '#374151', textAlign: 'left', border: '1px solid #d1d5db', borderRadius: '8px' }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', fontSize: '16px', fontWeight: '600', gap: '6px', color: '#374151', textAlign: 'left' }}>
              <span>高さ (m)</span>
              <input type="number" value={form.h || ''} onChange={e => setForm({...form, h: Number(e.target.value)})} style={{ width: '100%', boxSizing: 'border-box', padding: '10px', fontSize: '16px', color: '#374151', textAlign: 'left', border: '1px solid #d1d5db', borderRadius: '8px' }} />
            </label>
          </div>

          {isP3NextDisabled && <p style={{ color: '#b91c1c', fontSize: '13px', textAlign: 'left' }}>※「施設名」「奥行」「幅」「高さ」をすべて入力すると「次へ」に進めます。</p>}

          {/* 簡易間取り図 */}
          {form.l > 0 && form.w > 0 && (
            <div style={{ marginTop: '20px' }}>
              <div className="plan-wrap" style={{ width: '100%', margin: '0 auto' }}>
                <svg id="plan" viewBox="0 0 320 260" role="img" aria-label="入力した寸法にもとづく部屋の間取り図" style={{ width: '100%', height: 'auto', display: 'block' }}>
                  <text x={planX + planWidth / 2} y={planY - 10} textAnchor="middle" fontSize="13" fontWeight="700" fill="#111827">幅 {form.w}m</text>
                  <text x={planX - 10} y={planY + planHeight / 2} textAnchor="middle" fontSize="13" fontWeight="700" fill="#111827" transform={`rotate(-90 ${planX - 10} ${planY + planHeight / 2})`}>奥行 {form.l}m</text>
                  <rect x={planX} y={planY} width={planWidth} height={planHeight} fill="#dbeafe" stroke="#2563eb" strokeWidth="2" />
                  {Array.from({ length: Math.ceil(form.w) + 1 }).map((_, index) => {
                    const x = planX + (index / Math.max(1, Math.ceil(form.w))) * planWidth;
                    return <line key={`v-${index}`} x1={x} y1={planY} x2={x} y2={planY + planHeight} stroke="#cbd5e1" strokeWidth="1" />;
                  })}
                  {Array.from({ length: Math.ceil(form.l) + 1 }).map((_, index) => {
                    const y = planY + (index / Math.max(1, Math.ceil(form.l))) * planHeight;
                    return <line key={`h-${index}`} x1={planX} y1={y} x2={planX + planWidth} y2={y} stroke="#cbd5e1" strokeWidth="1" />;
                  })}
                </svg>
              </div>
            </div>
          )}
        </div>
      )}

      {/* P4: チェックリスト */}
      {page === 4 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h2>測定前チェックリスト</h2>
          <p style={{ textAlign: 'left' }}>正確に測定するため、すべての項目を確認してチェックを入れてください。</p>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: '12px', margin: '0', padding: '0', listStyle: 'none' }}>
            {checklistItems.map((item, index) => (
              <li key={item}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', color: '#111827', fontSize: '16px', lineHeight: '1.5', textAlign: 'left', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={checklist[index]}
                    onChange={(event) => setChecklist((current) => current.map((checked, itemIndex) => itemIndex === index ? event.target.checked : checked))}
                    style={{ width: '20px', height: '20px', flexShrink: '0', margin: '2px 0 0' }}
                  />
                  <span>{item}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* P5: 測定ガイド */}
      {page === 5 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h2>測定位置の確認</h2>
          {/* 測定点マッピング */}
          {form.l > 0 && form.w > 0 && (
            <div>
              <h4 style={{ margin: '0 0 8px', textAlign: 'left' }}>測定ポイント配置図</h4>
              <svg viewBox="0 0 320 260" style={{ width: '100%', height: 'auto', display: 'block' }}>
                <text x={planX + planWidth / 2} y={planY - 10} textAnchor="middle" fontSize="13" fontWeight="700" fill="#111827">幅 {formatDistance(form.w)}m</text>
                <text x={planX - 10} y={planY + planHeight / 2} textAnchor="middle" fontSize="13" fontWeight="700" fill="#111827" transform={`rotate(-90 ${planX - 10} ${planY + planHeight / 2})`}>奥行 {formatDistance(form.l)}m</text>
                <rect x={planX} y={planY} width={planWidth} height={planHeight} fill="#dbeafe" stroke="#2563eb" strokeWidth="2" />
                {getPointCoords(numPoints).map((pt, index) => {
                  const ptX = planX + pt.x * planWidth;
                  const ptY = planY + pt.y * planHeight;
                  const fromLeft = pt.x * form.w;
                  const fromTop = pt.y * form.l;
                  const distanceLabelY = pt.y >= 0.7 ? ptY - 16 : ptY + 17;
                  return (
                    <g key={index}>
                      <circle cx={ptX} cy={ptY} r="8" fill="#ff1744" stroke="#fff" strokeWidth="1.5" />
                      <text x={ptX} y={ptY + 4} textAnchor="middle" fontSize="10" fill="#fff" fontWeight="bold">{index + 1}</text>
                      <text x={ptX} y={distanceLabelY} textAnchor="middle" fontSize="9" fill="#111827" fontWeight="700">
                        <tspan x={ptX} dy="0">左 {formatDistance(fromLeft)}m</tspan>
                        <tspan x={ptX} dy="10">上 {formatDistance(fromTop)}m</tspan>
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
        </div>
      )}

      {/* P6: 測定開始 */}
      {page === 6 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h2>測定開始</h2>
          <p>測定を行ってください。</p>
        </div>
      )}

      {/* P7: 結果 */}
      {page === 7 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h2>測定結果</h2>
          <button style={{ padding: '15px 30px', fontSize: '18px', width: '100%', background: '#ff9900', color: 'white', border: 'none', borderRadius: '5px' }} onClick={handleUpload}>
            💾 結果をアップロードする
          </button>
          <button style={{ width: '100%', boxSizing: 'border-box', padding: '12px', fontSize: '16px' }} onClick={handleRetrySamePlace}>
            同じ場所で測定をやり直す
          </button>
          <button style={{ width: '100%', boxSizing: 'border-box', padding: '12px', fontSize: '16px' }} onClick={handleMeasureDifferentPlace}>
            別の場所で測定をする
          </button>
          <button style={{ width: '100%', boxSizing: 'border-box', padding: '12px', fontSize: '16px' }} onClick={() => setPage(1)}>
            🏠 ホームに戻る
          </button>
        </div>
      )}

      {page === 8 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
          <h2>保存済みの測定結果</h2>
          {resultsLoading ? (
            <p>結果を読み込んでいます...</p>
          ) : resultsError ? (
            <p role="alert" style={{ color: '#b91c1c' }}>{resultsError}</p>
          ) : savedResults.length === 0 ? (
            <p>保存済みの結果はありません。</p>
          ) : (
            <ul style={{ display: 'flex', flexDirection: 'column', gap: '16px', margin: '0', padding: '0', listStyle: 'none' }}>
              {savedResults.map((result) => (
                <li key={result.id} style={{ paddingBottom: '12px', borderBottom: '1px solid #d1d5db' }}>
                  <h3 style={{ margin: '0 0 4px', fontSize: '18px', color: '#111827' }}>{result.facilityName || '施設名未登録'}</h3>
                  <p>{result.location || '所在地未登録'} / {result.usage || '用途未登録'}</p>
                  <p>奥行 {result.depth ?? '未記録'}m × 幅 {result.width ?? '未記録'}m × 高さ {result.height ?? '未記録'}m</p>
                  <p>室容積 {result.volume ?? '未記録'}m³ / 推奨測定点数 {result.points ?? '未記録'}点</p>
                  <p>{result.date ? new Date(result.date).toLocaleString('ja-JP') : '日時不明'}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ナビゲーションボタン */}
      {page > 1 && page !== 0 && page !== 7 && (
        <div style={{ display: 'grid', gridTemplateColumns: page < 7 ? 'repeat(2, minmax(0, 1fr))' : '1fr', gap: '12px', marginTop: page === 3 ? '40px' : '16px' }}>
          <button style={{ width: '100%', boxSizing: 'border-box', padding: '10px 20px', fontSize: '16px' }} onClick={() => setPage(page === 8 ? 1 : page - 1)}>{page === 8 ? '🏠 ホームに戻る' : '◀ 戻る'}</button>
          {page < 7 && (
            <button 
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 20px', fontSize: '16px' }} 
              onClick={() => setPage(page + 1)}
              disabled={isNextDisabled}
            >
              次へ ▶
            </button>
          )}
        </div>
      )}
    </div>
  );
}