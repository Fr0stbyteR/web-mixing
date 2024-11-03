import processorUrl from "./SplitterPlayer.worklet?worker&url";
import AudioWorkletProxyNode from "./AudioWorkletProxyNode";
import { ISplitterPlayerNode, ISplitterPlayerProcessor, SplitterPlayerParameters, SplitterPlayerOptions } from "./SplitterPlayerWorklet.types";

export const processorId = "__AudioToolkit_SplitterPlayer";
export default class SplitterPlayerNode extends AudioWorkletProxyNode<ISplitterPlayerNode, ISplitterPlayerProcessor, SplitterPlayerParameters, SplitterPlayerOptions> implements ISplitterPlayerNode {
    static processorId = processorId;
    static processorUrl = processorUrl;
    static fnNames: (keyof ISplitterPlayerProcessor)[] = ["setLoop", "setLoopRange", "play", "stop", "setPlayhead", "getPlayhead", "destroy"];
    constructor(audioBuffer: Float32Array[], context: BaseAudioContext) {
        super(context, processorId, { numberOfInputs: 0, numberOfOutputs: audioBuffer.length, processorOptions: { audioBuffer } });
        const _destroy = this.destroy;
        this.destroy = async () => {
            await _destroy.call(this);
            this._disposed = true;
        };
    }
}
