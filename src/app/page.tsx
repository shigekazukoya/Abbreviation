'use client';
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
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
  const [selectedAbbreviation, setSelectedAbbreviation] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [geminiResponse, setGeminiResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { abbreviations, isLoading: isAbbreviationsLoading, error } = useAbbreviations();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

   const handleAbbreviationSelect = useCallback(async (abbreviation: string) => {
    setSelectedAbbreviation(abbreviation);
    await getAbbreviationDetails(abbreviation);
  }, []);
  
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
    return fuse.search(input) as SearchResult[];
  }, [input, fuse]);

async function getAbbreviationDetails(abbreviation: string) {
    if (!abbreviation || !abbreviations) return;  // 早期リターン追加
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setGeminiResponse('');
    const meaning = (abbreviations as Abbreviations)[abbreviation];
    
    // meaningが存在しない場合の処理を追加
    if (!meaning) {
      setGeminiResponse('略語の意味が見つかりませんでした。');
      setIsLoading(false);
      return;
    }
    
    try {
      const response = await fetch('https://abbreviation-search.shigekazukoya.workers.dev/get-abbreviation-details', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          meaning,
          abbreviation  // 略語も送信
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      let accumulatedText = '';
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Response body is not readable');
      }

      while (true) {
        try {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6)) as { text?: string; error?: string; done?: boolean };
                
                if (data.error) {
                  setGeminiResponse('エラーが発生しました: ' + data.error);
                  break;
                }
                
                if (data.done) {
                  setIsLoading(false);
                  break;
                }
                
                if (data.text) {
                  accumulatedText += data.text;
                  setGeminiResponse(accumulatedText);
                }
              } catch (e) {
                console.error('Error parsing SSE data:', e);
              }
            }
          }
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            console.log('Request was aborted');
            return;
          }
          throw error;
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request was aborted');
        return;
      }
      console.error('Error fetching abbreviation details:', error);
      setGeminiResponse('データの取得中にエラーが発生しました。');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    if (searchResults.length > 0) {
      handleAbbreviationSelect(searchResults[0].item);
      setSelectedIndex(0);
    } else {
      setSelectedAbbreviation(null);
      setGeminiResponse(null);
    }
  }, [searchResults]);

  useEffect(() => {
    if (searchResults.length > 0) {
      handleAbbreviationSelect(searchResults[0].item);
      setSelectedIndex(0);
    } else {
      setSelectedAbbreviation(null);
      setGeminiResponse(null);
    }
  }, [searchResults, handleAbbreviationSelect]);

  useEffect(() => {
    if (searchResults[selectedIndex]) {
      handleAbbreviationSelect(searchResults[selectedIndex].item);
    }
  }, [selectedIndex, searchResults, handleAbbreviationSelect]);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value.toUpperCase());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prevIndex) => 
        prevIndex < searchResults.length - 1 ? prevIndex + 1 : prevIndex
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prevIndex) => (prevIndex > 0 ? prevIndex - 1 : prevIndex));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (searchResults[selectedIndex]) {
        handleAbbreviationSelect(searchResults[selectedIndex].item);
      }
    }
  };

  useEffect(() => {
    if (searchResults[selectedIndex]) {
      handleAbbreviationSelect(searchResults[selectedIndex].item);
    }
  }, [selectedIndex]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>略語検索アプリ</h1>
      <div className={styles.mainContent}>
        <div className={styles.leftSection}>
          <div className={styles.searchContainer}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="略語を入力してください"
              className={styles.input}
              disabled={isAbbreviationsLoading}
              inputMode="search"
            />
          </div>
          
          <div className={styles.resultSection}>
            {isAbbreviationsLoading ? (
              <p className={styles.loading}>データ読み込み中...</p>
            ) : error ? (
              <p className={styles.error}>{error}</p>
            ) : input ? (
              searchResults.length > 0 ? (
                <ul className={styles.resultList}>
                  {searchResults.map(({ item, score }, index) => (
                    <li 
                      key={item} 
                      className={`${styles.resultItem} ${selectedIndex === index ? styles.selected : ''}`}
                      onClick={() => {
                        setSelectedIndex(index);
                        handleAbbreviationSelect(item);
                      }}
                    >
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
        </div>

<div className={styles.rightSection}>
      {selectedAbbreviation && (
        <div className={styles.detailSection}>
          <h2>{selectedAbbreviation} - {(abbreviations as Abbreviations)[selectedAbbreviation]}</h2>
          {isLoading ? (
            <div className={styles.loadingContainer}>
              <p className={styles.loadingText}>回答を生成中...</p>
              {geminiResponse && (
                <div className={styles.markdownPreview}>
                  <ReactMarkdown>{geminiResponse}</ReactMarkdown>
                </div>
              )}
            </div>
          ) : geminiResponse ? (
            <div className={styles.markdownPreview}>
              <ReactMarkdown>{geminiResponse}</ReactMarkdown>
            </div>
          ) : (
            <p className={styles.error}>Gemini APIからの応答の取得に失敗しました。</p>
          )}
        </div>
          )}
        </div>
      </div>
    </div>
  );
}