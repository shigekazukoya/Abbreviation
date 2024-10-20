'use client';
import { useState, useMemo } from 'react';
import styles from '../styles/Home.module.css';
import { useAbbreviations } from '../hooks/useAbbreviations';
import Fuse from 'fuse.js';

type Abbreviations = {
  [key: string]: string;
};

type SearchResult = {
  item: string;
  score: number;
};

export default function Home() {
  const [input, setInput] = useState<string>('');
  const { abbreviations, isLoading, error } = useAbbreviations();
  
  const fuse = useMemo(() => {
    if (!abbreviations) return null;
    return new Fuse<string>(Object.keys(abbreviations as Abbreviations), {
      includeScore: true,
      threshold: 0.3,
      ignoreLocation: true,
    });
  }, [abbreviations]);

  const searchResults = useMemo(() => {
    if (!input || !fuse) return [];
    return fuse.search(input).slice(0, 5) as SearchResult[];  // 上位5件の結果を表示
  }, [input, fuse]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value.toUpperCase());
  };

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <div className={styles.topSection}>
          <h1 className={styles.title}>略語検索アプリ</h1>
          <div className={styles.searchContainer}>
            <input
              type="text"
              value={input}
              onChange={handleInputChange}
              placeholder="略語を入力してください"
              className={styles.input}
              disabled={isLoading}
            />
          </div>
        </div>
        
        <div className={styles.resultSection}>
          {isLoading ? (
            <p className={styles.loading}>データ読み込み中...</p>
          ) : error ? (
            <p className={styles.error}>{error}</p>
          ) : input ? (
            searchResults.length > 0 ? (
              <ul className={styles.resultList}>
                {searchResults.map(({ item, score }) => (
                  <li key={item} className={styles.resultItem}>
                    <span className={styles.abbreviation}>{item}</span>
                    <span className={styles.meaning}>{(abbreviations as Abbreviations)[item]}</span>
                    <span className={styles.score}>類似度: {((1 - score) * 100).toFixed(2)}%</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.noResult}>一致する略語が見つかりません</p>
            )
          ) : (
            <p className={styles.instruction}>略語を入力すると候補が表示されます</p>
          )}
        </div>
      </main>
    </div>
  );
}