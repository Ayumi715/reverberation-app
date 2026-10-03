import React, { useState } from 'react';
import { db } from './firebase';
import { collection, addDoc } from 'firebase/firestore';

export default function App() {
  const [page, setPage] = useState(1);
  const [prevPage, setPrevPage] = useState(1); // 直前のページ一時記録
  const [form, setForm] = useState({ name: '', pref: '', city: '', kids: '', usage: '', l: 0, w: 0, h: 0 });

  const V = form.l * form.w * form.h; // 室容積
  const dc = 0.057 * Math.sqrt(V / 0.5); // 直接音距離
  const getPoints = (vol) => vol < 100 ? 3 : vol < 200 ? 5 : 6;
  const numPoints = getPoints(V);

  // 必須入力チェック
  const isNextDisabled = page === 3 && (!form.name || form.l <= 0 || form.w <= 0 || form.h <= 0);

  // 間取り図スケーリング
  const maxDim = Math.max(form.l, form.w) || 1;
  const scale = 160 / maxDim;
  const svgW = form.w * scale;
  const svgL = form.l * scale;
  const rectX = 100 - svgW / 2;
  const rectY = 100 - svgL / 2;

  const getPointCoords = (num) => {
    if (num === 3) return [{ x: 0.25, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.75, y: 0.5 }];
    if (num === 5) return [{ x: 0.25, y: 0.25 }, { x: 0.75, y: 0.25 }, { x: 0.5, y: 0.5 }, { x: 0.25, y: 0.75 }, { x: 0.75, y: 0.75 }];
    if (num === 6) return [{ x: 0.25, y: 0.25 }, { x: 0.5, y: 0.25 }, { x: 0.75, y: 0.25 }, { x: 0.25, y: 0.75 }, { x: 0.5, y: 0.75 }, { x: 0.75, y: 0.75 }];
    return [];
  };

  const handleUpload = async () => {
    try {
      await addDoc(collection(db, "measurements"), {
        facilityName: form.name,
        location: `${form.pref} ${form.city}`,
        kids: form.kids,
        usage: form.usage,
        volume: V,
        dc: dc,
        points: numPoints,
        date: new Date().toISOString()
      });
      alert("データをアップロードしました！");
    } catch (e) { alert("エラー: " + e.message); }
  };

  const handleHelpClick = () => {
    if (page !== 0) {
      setPrevPage(page);
      setPage(0);
    }
  };

  // 統一ワンクリックボタンのボタンスタイル
  const headerButtonStyle = {
    fontSize: '14px',
    fontWeight: 'bold',
    padding: '8px 16px',
    background: '#ffffff',
    color: '#333333',
    border: '1px solid #ced4da',
    borderRadius: '6px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
    cursor: 'pointer',
    outline: 'none',
  };

  return (
    <div style={{ padding: '70px 20px 20px', fontFamily: 'sans-serif', maxWidth: '500px', margin: '0 auto' }}>
      
      <div style={{ position: 'fixed', top: '12px', left: '12px', right: '12px', zIndex: 1000, display: 'flex', justifyContent: 'space-between', pointerEvents: 'none' }}>
        <button onClick={() => setPage(1)} style={{ ...headerButtonStyle, pointerEvents: 'auto' }}>
          🏠 ホーム
        </button>
        <button onClick={handleHelpClick} style={{ ...headerButtonStyle, pointerEvents: 'auto' }}>
          ❓ ヘルプ
        </button>
      </div>

      {/* P0: アプリの説明（ヘルプ画面） */}
      {page === 0 && (
        <div style={{ lineHeight: '1.6' }}>
          <h2>💡 アプリの説明（ヘルプ）</h2>
          <p>このアプリケーションは、保育施設における最適な音環境（残響時間）を整えるため、室容積や最適な測定ポイントを算出・ガイドする測定支援ツールです。</p>
          <ul>
            <li><strong>自動算出:</strong> 部屋の寸法を入力するだけで室容積、推奨測定点数、直接音距離を瞬時に計算します。</li>
            <li><strong>ガイド機能:</strong> 室容積に合わせた最適なマッピング図を画面上に自動で描画します。</li>
          </ul>
          <button onClick={() => setPage(prevPage)} style={{ marginTop: '20px', padding: '10px 20px', fontSize: '16px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', width: '100%' }}>
            元の画面に戻る
          </button>
        </div>
      )}

      {/* P1: ホーム画面 */}
      {page === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '40px' }}>
          <h1>保育士向け残響測定</h1>
          <button style={{ padding: '20px', fontSize: '18px' }} onClick={() => setPage(2)}>🔊 測定を始める</button>
          <button style={{ padding: '20px', fontSize: '18px' }} onClick={() => alert('今までの結果（実装予定）')}>📁 今までの結果</button>
        </div>
      )}

      {/* P2: 測定概要 */}
      {page === 2 && (
        <div>
          <h2>測定概要</h2>
          <p>（測定の概要。現在内容調整中。）</p>
        </div>
      )}

      {/* P3: 測定に必要な情報入力 */}
      {page === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h2>測定情報の入力（※は必須項目）</h2>
          <input placeholder="※施設名を入力" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          <input placeholder="県" value={form.pref} onChange={e => setForm({...form, pref: e.target.value})} />
          <input placeholder="市町村" value={form.city} onChange={e => setForm({...form, city: e.target.value})} />
          
          <h3>※部屋の寸法（数値を入力）</h3>
          <label>奥行 (m): <input type="number" value={form.l || ''} onChange={e => setForm({...form, l: Number(e.target.value)})} /></label>
          <label>幅 (m): <input type="number" value={form.w || ''} onChange={e => setForm({...form, w: Number(e.target.value)})} /></label>
          <label>高さ (m): <input type="number" value={form.h || ''} onChange={e => setForm({...form, h: Number(e.target.value)})} /></label>

          {/* 簡易間取り図 */}
          {form.l > 0 && form.w > 0 && (
            <div style={{ marginTop: '20px', textAlign: 'center', background: '#f5f5f5', padding: '15px', borderRadius: '8px' }}>
              <h4>簡易間取り図</h4>
              <svg width="200" height="200" style={{ border: '1px solid #ccc', background: '#fff' }}>
                <rect x={rectX} y={rectY} width={svgW} height={svgL} fill="#e0f7fa" stroke="#00acc1" strokeWidth="2" />
                <text x="100" y="105" textAnchor="middle" fontSize="12" fill="#006064">{form.w}m × {form.l}m</text>
              </svg>
            </div>
          )}
          {isNextDisabled && <p style={{ color: 'red', fontSize: '13px' }}>※「施設名」「奥行」「幅」「高さ」をすべて入力すると「次へ」に進めます。</p>}
        </div>
      )}

      {/* P4: チェックリスト */}
      {page === 4 && (
        <div>
          <h2>測定前チェックリスト</h2>
          <ul>
            <li>窓やドアは全て閉まっていますか？</li>
            <li>部屋の中は静かですか？</li>
          </ul>
        </div>
      )}

      {/* P5: 測定ガイド */}
      {page === 5 && (
        <div>
          <h2>測定位置の確認</h2>
          {/* 測定点マッピング */}
          {form.l > 0 && form.w > 0 && (
            <div style={{ textAlign: 'center', background: '#f5f5f5', padding: '15px', borderRadius: '8px' }}>
              <h4>測定ポイント配置図</h4>
              <svg width="200" height="200" style={{ border: '1px solid #ccc', background: '#fff' }}>
                <rect x={rectX} y={rectY} width={svgW} height={svgL} fill="#e0f7fa" stroke="#00acc1" strokeWidth="2" />
                {getPointCoords(numPoints).map((pt, index) => {
                  const ptX = rectX + pt.x * svgW;
                  const ptY = rectY + pt.y * svgL;
                  return (
                    <g key={index}>
                      <circle cx={ptX} cy={ptY} r="8" fill="#ff1744" stroke="#fff" strokeWidth="1.5" />
                      <text x={ptX} y={ptY + 4} textAnchor="middle" fontSize="10" fill="#fff" fontWeight="bold">{index + 1}</text>
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
        <div>
          <h2>測定開始</h2>
          <p>測定を行ってください。</p>
        </div>
      )}

      {/* P7: 結果 */}
      {page === 7 && (
        <div>
          <h2>測定結果</h2>
          <button style={{ padding: '15px 30px', fontSize: '18px', width: '100%', background: '#ff9900', color: 'white', border: 'none', borderRadius: '5px' }} onClick={handleUpload}>
            💾 結果をアップロードする
          </button>
        </div>
      )}

      {/* ナビゲーションボタン */}
      {page > 1 && page !== 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px' }}>
          <button style={{ padding: '10px 20px', fontSize: '16px' }} onClick={() => setPage(page - 1)}>◀ 戻る</button>
          {page < 7 && (
            <button 
              style={{ padding: '10px 20px', fontSize: '16px' }} 
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
