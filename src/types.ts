export type QuestData = Record<string, { path: string, files: string[] }>

export type AudioUnit = "time" | "sample" | "measure";
export interface AudioEditorConfiguration {
    audioUnit: AudioUnit;
    fftSize: number;
    fftOverlap: number;
    fftWindowFunction: string;
    beatsPerMinute: number;
    beatsPerMeasure: number;
    division: number;
}
