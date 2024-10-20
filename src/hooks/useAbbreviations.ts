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
    const [abbreviations, setAbbreviations] = useState<AbbreviationsData>({});
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchAbbreviations = async () => {
            try {
                // Protobufの型を動的に生成
                const root = protobuf.parse(protoDefinition).root;
                const AbbreviationsMessage = root.lookupType("Abbreviations");

                const currentVersion = localStorage.getItem('abbreviationsVersion') || '0';
                console.log('koko1');

                const versionCheckResponse = await fetch(`${WORKER_URL}/check-version?current=${currentVersion}`, {
                    mode: 'cors',
                    credentials: 'same-origin'
                });
                if (!versionCheckResponse.ok) throw new Error('Failed to check version');
                const versionData: VersionCheckResponse = await versionCheckResponse.json();


                const dataResponse = await fetch(`${WORKER_URL}/get-data?version=${versionData.latestVersion}`, {
                    mode: 'cors',
                    credentials: 'same-origin'
                });
                if (!dataResponse.ok) throw new Error('Failed to fetch data');

                // ArrayBufferとしてデータを取得
                const arrayBuffer = await dataResponse.arrayBuffer();
                console.log('koko');
                console.log(arrayBuffer);

                // Protobufデータをデコード
                const uint8Array = new Uint8Array(arrayBuffer);
                const decodedData = AbbreviationsMessage.decode(uint8Array);
                const abbreviationsData = AbbreviationsMessage.toObject(decodedData).abbreviations;

                setAbbreviations(abbreviationsData);
                localStorage.setItem('abbreviationsVersion', versionData.latestVersion.toString());
                localStorage.setItem('abbreviationsData', JSON.stringify(abbreviationsData));
            } catch (err) {
                console.error('Error fetching abbreviations:', err);
                setError('データの取得に失敗しました');
            } finally {
                setIsLoading(false);
            }
        };

        fetchAbbreviations();
    }, []);

    return { abbreviations, isLoading, error };
}