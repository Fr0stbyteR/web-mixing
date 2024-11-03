export interface ISplitterPlayerProcessor {
    setLoopRange(start: number, end: number): void;
    setLoop(loop: boolean): void;
    play(): void;
    stop(): void;
    setPlayhead(playhead: number): void;
    getPlayhead(): number;
    destroy(): void;
}
export interface ISplitterPlayerNode {}
export interface SplitterPlayerOptions {
    audioBuffer: Float32Array[];
}
export type SplitterPlayerParameters = never;
