import { dbtoa } from "../utils";
import AudioEditor, { AudioEditorState } from "./AudioEditor";
import PeakAnalyserNode from "../worklets/PeakAnalyserNode";

export default class AudioPlayer {
    static async init(editor: AudioEditor) {
        const audioPlayer = new AudioPlayer(editor);
        await audioPlayer.initPeakAnalyser();
        return audioPlayer;
    }
    readonly editor: AudioEditor;
    // readonly dummyAnalyserNode: AnalyserNode;
    readonly muteGainNodePool: GainNode[] = [];
    readonly stereoPannerNodePool: StereoPannerNode[] = [];
    readonly gainNodePool: GainNode[] = [];
    readonly peakAnalyserNodePool: PeakAnalyserNode[] = [];
    readonly splitterNode: ChannelSplitterNode;
    readonly masterGainNode: GainNode;
    playing: boolean;
    currentSample: number;
    currentTime: number;
    // currentChannels: boolean[];
    bufferSourceNode?: AudioBufferSourceNode;
    masterPeakAnalyserNode!: PeakAnalyserNode;
    // monitoring: boolean;
    get context() {
        return this.editor.context;
    }
    get destination() {
        return this.context.destination;
    }
    get loop() {
        return this.bufferSourceNode?.loop;
    }
    handleLoopChanged = (loopIn: boolean) => {
    };
    handleSelRangeChanged = (selRange: [number, number] | null) => {
        const { bufferSourceNode } = this;
        if (!bufferSourceNode) return;
        const { buffer, loop } = bufferSourceNode;
        if (!buffer) return;
        const { sampleRate } = buffer;
        if (loop) {
            if (selRange) {
                bufferSourceNode.loopStart = selRange[0] / sampleRate;
                bufferSourceNode.loopEnd = selRange[1] / sampleRate;
            } else {
                bufferSourceNode.loopStart = 0;
                bufferSourceNode.loopEnd = 0;
            }
        } else {
            bufferSourceNode.loopStart = 0;
            bufferSourceNode.loopEnd = 0;
            if (selRange) bufferSourceNode.stop(this.currentTime + (selRange[1] - this.currentSample) / sampleRate);
            else bufferSourceNode.stop(Number.MAX_VALUE);
        }
    };
    handleEnded = () => {
        const { bufferSourceNode } = this;
        if (!bufferSourceNode) return;
        this.editor.handlePlayerEnded(this.getCurrentSample());
        this.bufferSourceNode!.removeEventListener("ended", this.handleEnded);
        this.bufferSourceNode!.disconnect();
    };
    handlePlayerStateUpdated = (state: Partial<AudioEditorState>) => {
        const { masterGain, trackGains, trackPans, trackMutes, trackSolos, loop: loopIn } = state;
        if (trackMutes || trackSolos) {
            for (let i = 0; i < this.editor.numberOfChannels; i++) {
                this.muteGainNodePool[i].gain.setTargetAtTime(this.editor.enabledChannels[i] ? 1 : 0, this.context.currentTime, 0.01);
            }
        }
        if (trackGains) {
            for (let i = 0; i < this.editor.numberOfChannels; i++) {
                this.gainNodePool[i].gain.setTargetAtTime(dbtoa(trackGains[i]), this.context.currentTime, 0.01);
            }
        }
        if (trackPans) {
            for (let i = 0; i < this.editor.numberOfChannels; i++) {
                this.stereoPannerNodePool[i].pan.setTargetAtTime(trackPans[i], this.context.currentTime, 0.01);
            }
        }
        if (typeof masterGain === "number") {
            this.masterGainNode.gain.setTargetAtTime(dbtoa(masterGain), this.context.currentTime, 0.01);
        }
        if (typeof loopIn === "boolean") {
            const { bufferSourceNode, editor } = this;
            if (!bufferSourceNode) return;
            const { buffer, loop } = bufferSourceNode;
            if (!buffer) return;
            if (loop === loopIn) return;
            const { sampleRate } = buffer;
            const selRange = editor.state.selRange;
            bufferSourceNode.loop = loopIn;
            if (loopIn) {
                if (selRange) {
                    bufferSourceNode.loopStart = selRange[0] / sampleRate;
                    bufferSourceNode.loopEnd = selRange[1] / sampleRate;
                } else {
                    bufferSourceNode.loopStart = 0;
                    bufferSourceNode.loopEnd = 0;
                }
                bufferSourceNode.stop(Number.MAX_VALUE);
            } else {
                bufferSourceNode.loopStart = 0;
                bufferSourceNode.loopEnd = 0;
                if (selRange) bufferSourceNode.stop(this.currentTime + (selRange[1] - this.currentSample) / sampleRate);
                else bufferSourceNode.stop(Number.MAX_VALUE);
            }
        }
    };

    updateCursorScheduled = false;
    $updateCursorRaf = -1;
    updateCursorCallback = () => {
        this.$updateCursorRaf = -1;
        this.updateCursorScheduled = false;
        this.updateCursor();
    };
    scheduleUpdateCursor = () => {
        if (this.updateCursorScheduled) return;
        if (this.$updateCursorRaf === -1) this.$updateCursorRaf = requestAnimationFrame(this.updateCursorCallback);
        this.updateCursorScheduled = true;
    };
    updateCursor() {
        if (!this.bufferSourceNode) return;
        this.editor.setPlayhead(this.getCurrentSample(), true);
        this.scheduleUpdateCursor();
    }
    private constructor(editor: AudioEditor) {
        const { state, enabledChannels, numberOfChannels } = editor;
        const { selRange, playhead, masterGain, trackGains, trackPans } = state;
        this.editor = editor;
        this.playing = false;
        // this.monitoring = false;
        // this.dummyAnalyserNode = this.context.createAnalyser();
        
        this.splitterNode = this.context.createChannelSplitter(numberOfChannels);
        this.masterGainNode = this.context.createGain();
        this.masterGainNode.gain.value = dbtoa(masterGain);
        for (let i = 0; i < numberOfChannels; i++) {
            this.muteGainNodePool[i] = this.context.createGain();
            this.muteGainNodePool[i].gain.value = enabledChannels[i] ? 1 : 0;
            this.splitterNode.connect(this.muteGainNodePool[i], i, 0);
            this.gainNodePool[i] = this.context.createGain();
            this.gainNodePool[i].gain.value = dbtoa(trackGains[i]);
            this.muteGainNodePool[i].connect(this.gainNodePool[i]);
            this.stereoPannerNodePool[i] = this.context.createStereoPanner();
            this.stereoPannerNodePool[i].pan.value = trackPans[i];
            this.gainNodePool[i].connect(this.stereoPannerNodePool[i]);
            this.stereoPannerNodePool[i].connect(this.masterGainNode);
        }
        this.masterGainNode.connect(this.destination);
        // .preFxGainNode.gain.value = dbtoa(preFxGain);
        // this.currentChannels = enabledChannels;
        this.currentTime = this.context.currentTime;
        this.currentSample = selRange ? selRange[0] : playhead;
        // this.destination.channelInterpretation = "discrete";
        this.editor.on("loop", this.handleLoopChanged);
        this.editor.on("selRangeToPlay", this.handleSelRangeChanged);
        this.editor.on("playerStateUpdated", this.handlePlayerStateUpdated);
    }
    private async initPeakAnalyser() {
        const audioWorklet = this.context.audioWorklet;
        await PeakAnalyserNode.register(audioWorklet);
        this.masterPeakAnalyserNode = new PeakAnalyserNode(this.context);
        for (let i = 0; i < this.editor.numberOfChannels; i++) {
            this.peakAnalyserNodePool[i] = new PeakAnalyserNode(this.context);
            this.gainNodePool[i].connect(this.peakAnalyserNodePool[i]);
        }
    }
    async destroy() {
        // if (this.monitoring) this.stopMonitoring();
        if (this.playing) this.stop();
        await this.masterPeakAnalyserNode.destroy();
    }
    getCurrentSample() {
        if (!this.bufferSourceNode) return 0;
        const { buffer } = this.bufferSourceNode;
        if (!buffer) return 0;
        const delta = (this.context.currentTime - this.currentTime) * buffer.sampleRate;
        const selRange = this.editor.state?.selRange || [0, buffer.length];
        this.currentSample += delta;
        this.currentTime = this.context.currentTime;
        if (this.loop) {
            if (this.currentSample > selRange[1]) this.currentSample = (this.currentSample - selRange[0]) % (selRange[1] - selRange[0]) + selRange[0];
        } else {
            if (this.currentSample > selRange[1]) this.currentSample = selRange[1];
        }
        return ~~this.currentSample;
    }
    play() {
        this.stop();
        const audio = this.editor;
        const { playhead, selRange, loop } = this.editor.state;
        const { sampleRate, numberOfChannels, audioBuffer } = audio;
        const offset = (selRange ? selRange[0] : playhead) / sampleRate;
        const duration = selRange ? (selRange[1] - selRange[0]) / sampleRate : undefined;
        const bufferSourceNode = this.context.createBufferSource();
        bufferSourceNode.channelCountMode = "explicit";
        bufferSourceNode.channelInterpretation = "discrete";
        bufferSourceNode.channelCount = numberOfChannels;
        this.currentTime = this.context.currentTime;
        this.currentSample = selRange ? selRange[0] : playhead;
        this.bufferSourceNode = bufferSourceNode;
        bufferSourceNode.buffer = audioBuffer;
        // bufferSourceNode.connect(this.dummyAnalyserNode);
        this.masterGainNode.connect(this.masterPeakAnalyserNode);
        bufferSourceNode.connect(this.splitterNode);
        bufferSourceNode.loop = !!loop;
        bufferSourceNode.addEventListener("ended", this.handleEnded);
        if (loop) {
            if (duration) {
                bufferSourceNode.loopStart = offset;
                bufferSourceNode.loopEnd = offset + duration;
            }
            bufferSourceNode.start(this.currentTime, offset);
        } else {
            bufferSourceNode.start(this.currentTime, offset);
            if (duration) bufferSourceNode.stop(this.currentTime + duration);
            else bufferSourceNode.stop(Number.MAX_VALUE);
        }
        this.playing = true;
        this.scheduleUpdateCursor();
    }
    stop() {
        try {
            this.masterGainNode.disconnect(this.masterPeakAnalyserNode);
        } catch (error) { /* empty */ }
        if (!this.bufferSourceNode) return;
        this.bufferSourceNode.stop();
        this.bufferSourceNode.removeEventListener("ended", this.handleEnded);
        this.bufferSourceNode.disconnect();
        delete this.bufferSourceNode;
        this.playing = false;
    }
}
