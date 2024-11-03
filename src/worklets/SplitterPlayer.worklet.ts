// import { rms, zcr, setTypedArray, absMax } from "../../utils/buffer";
// import { mod } from "../../utils/math";
// import yinEstimate from "../../utils/yin";
import { AudioWorkletGlobalScope, TypedAudioParamDescriptor, TypedAudioWorkletNodeOptions } from "./types";
import { ISplitterPlayerProcessor, ISplitterPlayerNode, SplitterPlayerParameters, SplitterPlayerOptions } from "./SplitterPlayerWorklet.types";
import AudioWorkletProxyProcessor from "./AudioWorkletProxyProcessor";
import { absMax, mod, setTypedArray } from "../utils";

const processorId = "__AudioToolkit_SplitterPlayer";
declare const globalThis: AudioWorkletGlobalScope & { SharedArrayBuffer: typeof SharedArrayBuffer | typeof ArrayBuffer; Atomics: typeof Atomics };
if (!globalThis.SharedArrayBuffer) globalThis.SharedArrayBuffer = ArrayBuffer;
const { registerProcessor, sampleRate } = globalThis;

class SplitterPlayerProcessor extends AudioWorkletProxyProcessor<ISplitterPlayerProcessor, ISplitterPlayerNode, SplitterPlayerParameters, SplitterPlayerOptions> implements ISplitterPlayerProcessor {
    static get parameterDescriptors(): TypedAudioParamDescriptor<SplitterPlayerParameters>[] {
        return [];
    }
    private audioBuffer: Float32Array[];
    private length: number;
    private loop = false;
    private loopRange = [0, 1];
    private playing = false;
    private playhead = 0;

    private destroyed = false;
    constructor(options: TypedAudioWorkletNodeOptions<SplitterPlayerOptions>) {
        super(options);
        this.audioBuffer = options.processorOptions!.audioBuffer;
        this.length = this.audioBuffer[0].length;
        this.loopRange = [0, this.length];
    }
    
    setLoop(loop: boolean) {
        this.loop = loop;
        this.setPlayhead(this.playhead);
    }
    setLoopRange(start: number, end: number): void {
        this.loopRange = [start, end];
        this.setPlayhead(this.playhead);
    }
    play() {
        // this.playhead = this.loop ? this.loopRange[0] : 0;
        this.playing = true;
    }
    stop() {
        this.playing = false;
    }
    setPlayhead(playhead: number) {
        this.playhead = this.loop ? Math.max(0, Math.min(this.length, playhead)) : Math.max(this.loopRange[0], Math.min(this.loopRange[1], playhead));
    }
    getPlayhead() {
        return this.playhead;
    }
    destroy() {
        this.destroyed = true;
        this._disposed = true;
    }
    process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<SplitterPlayerParameters, Float32Array>) {
        if (this.destroyed) return false;
        const input = inputs[0];
        const bufferSize = Math.max(...outputs.map(c => c[0].length)) || 128;

        if (!this.playing) return true;
        // Write
        let { playhead } = this;
        let j = bufferSize;
        let k = 0;
        while (j > 0) {
            if (this.loop && playhead >= this.loopRange[1]) playhead = this.loopRange[0];
            if (!this.loop && playhead >= this.length) {
                playhead = 0;
                this.stop();
                return true;
            }
            const sampsToCopy = Math.min(this.loop ? this.loopRange[1] - playhead : this.length - playhead, j);
            for (let i = 0; i < outputs.length; i++) {
                outputs[i][0].set(this.audioBuffer[i].subarray(playhead, playhead + sampsToCopy), k)
            }
            j -= sampsToCopy;
            k += sampsToCopy;
            playhead += sampsToCopy;
        }
        this.playhead = playhead;
        return true;
    }
}
try {
    registerProcessor(processorId, SplitterPlayerProcessor);
} catch (error) {
    console.warn(error);
}
