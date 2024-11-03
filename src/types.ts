import { AudioEditorState } from "./core/AudioEditor";

export type QuestData = Record<string, { path: string; files: string[]; pans: number[] }>

export type AudioUnit = "time" | "sample" | "measure";

export type TrackSize = "tiny" | "small" | "medium" | "large" | "huge";

export interface AudioEditorConfiguration {
    audioUnit: AudioUnit;
    fftSize: number;
    fftOverlap: number;
    fftWindowFunction: string;
    beatsPerMinute: number;
    beatsPerMeasure: number;
    division: number;
}

export interface VisualizationStyleOptions {
    phosphorColor: string;
    separatorColor: string;
    playheadColor: string;
    gridColor: string;
    gridRulerColor: string;
    textColor: string;
    fadePathColor: string;
    labelFont: string;
    monospaceFont: string;
}

export interface VisualizationOptions extends VisualizationStyleOptions, Pick<AudioEditorState, "playhead" | "selRange" | "viewRange" | "trackMutes" | "trackSolos"> {
    moduleIndex: number;
    configuration: AudioEditorConfiguration;
    configuring: boolean;
    monitoring: boolean;
    rerenderId: number;
}
