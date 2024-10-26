import { useState, useEffect } from 'react';
import * as protobuf from 'protobufjs';

const WORKER_URL = 'https://abbreviation-search.shigekazukoya.workers.dev';

interface AbbreviationsData {
    [key: string]: string;
}

interface VersionCheckResponse {
    needsUpdate: boolean;
    latestVersion: number;
}

// Protobufの定義を文字列として保持
const protoDefinition = `
  syntax = "proto3";
  message Abbreviations {
    map<string, string> abbreviations = 1;
  }
`;

export function useAbbreviations() {
    const [abbreviations, setAbbreviations] = useState<AbbreviationsData | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchAbbreviations = async () => {
            try {
                // まず、ローカルストレージからデータを取得を試みる
                const cachedData = localStorage.getItem('abbreviationsData');
                if (cachedData) {
                    setAbbreviations(JSON.parse(cachedData));
                    setIsLoading(false);
                }

                // Protobufの型を動的に生成
                const root = protobuf.parse(protoDefinition).root;
                const AbbreviationsMessage = root.lookupType("Abbreviations");

                const currentVersion = localStorage.getItem('abbreviationsVersion') || '0';

                // バージョンチェック
                const versionCheckResponse = await fetch(`${WORKER_URL}/check-version?current=${currentVersion}`, {
                    mode: 'cors',
                    credentials: 'same-origin'
                });
                if (!versionCheckResponse.ok) throw new Error('Failed to check version');
                const versionData: VersionCheckResponse = await versionCheckResponse.json();

                // 更新が必要な場合のみ新しいデータを取得
                if (versionData.needsUpdate || !cachedData) {
                    const dataResponse = await fetch(`${WORKER_URL}/get-data?version=${versionData.latestVersion}`, {
                        mode: 'cors',
                        credentials: 'same-origin'
                    });
                    if (!dataResponse.ok) throw new Error('Failed to fetch data');

                    const arrayBuffer = await dataResponse.arrayBuffer();
                    const uint8Array = new Uint8Array(arrayBuffer);
                    const decodedData = AbbreviationsMessage.decode(uint8Array);
                    const abbreviationsData = AbbreviationsMessage.toObject(decodedData).abbreviations;

                    if (Object.keys(abbreviationsData).length === 0) {
                        throw new Error('Received empty abbreviations data');
                    }

                    setAbbreviations(abbreviationsData);
                    localStorage.setItem('abbreviationsVersion', versionData.latestVersion.toString());
                    localStorage.setItem('abbreviationsData', JSON.stringify(abbreviationsData));
                }
            } catch (err) {
                console.error('Error fetching abbreviations:', err);
                setError('データの取得に失敗しました');
                
                // エラー時にキャッシュされたデータを使用
                const cachedData = localStorage.getItem('abbreviationsData');
                if (cachedData) {
                    setAbbreviations(JSON.parse(cachedData));
                }
            } finally {
                setIsLoading(false);
            }
        };

        fetchAbbreviations();
    }, []);

    // nullチェックを追加
    return { 
        abbreviations: abbreviations || {}, 
        isLoading, 
        error,
        isReady: abbreviations !== null
    };
}