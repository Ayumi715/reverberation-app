// Firebase SDK から必要なモジュールをインポート
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// コピーした設定オブジェクト（プロジェクト ID は自動で紐づきます）
const firebaseConfig = {
  apiKey: "YOUR_API_KEY", // コンソールで表示された実際のキーに書き換えてください
  authDomain: "reverberation-60f82.firebaseapp.com",
  projectId: "reverberation-60f82",
  storageBucket: "reverberation-60f82.firebasestorage.app",
  messagingSenderId: "67631437602",
  appId: "YOUR_APP_ID"  // コンソールで表示された実際のIDに書き換えてください
};

// Firebaseアプリを初期化
const app = initializeApp(firebaseConfig);

// 他のコンポーネントで使えるように、Firestore インスタンスをエクスポート
export const db = getFirestore(app);
