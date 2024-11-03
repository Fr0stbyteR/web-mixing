import { dbtoa } from "../utils";
import AudioEditor, { AudioEditorState } from "./AudioEditor";
import PeakAnalyserNode from "../worklets/PeakAnalyserNode";
import SplitterPlayerNode from "../worklets/SplitterPlayerNode";

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
    // readonly splitterNode: ChannelSplitterNode;
    readonly masterGainNode: GainNode;
    playing: boolean;
    currentSample: number;
    currentTime: number;
    // currentChannels: boolean[];
    splitterPlayerNode!: SplitterPlayerNode;
    masterPeakAnalyserNode!: PeakAnalyserNode;
    // monitoring: boolean;
    get context() {
        return this.editor.context;
    }
    get destination() {
        return this.context.destination;
    }
    handleLoopChanged = (loopIn: boolean) => {
    };
    handleSelRangeChanged = async (selRange: [number, number] | null) => {
        const { editor } = this;
        await this.splitterPlayerNode.setLoopRange(...(selRange ?? [0, editor.length]));
    };
    handleEnded = () => {
    };
    handlePlayerStateUpdated = async (state: Partial<AudioEditorState>) => {
        const { masterGain, trackGains, trackPans, trackMutes, trackSolos, loop: loop } = state;
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
        if (typeof loop === "boolean") {
            await this.splitterPlayerNode.setLoop(loop);
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
    async updateCursor() {
        if (!this.playing) return;
        this.editor.setPlayhead(await this.getCurrentSample(), true);
        this.scheduleUpdateCursor();
    }
    private constructor(editor: AudioEditor) {
        const { state, enabledChannels, numberOfChannels } = editor;
        const { selRange, playhead, masterGain, trackGains, trackPans } = state;
        this.editor = editor;
        this.playing = false;
        // this.monitoring = false;
        // this.dummyAnalyserNode = this.context.createAnalyser();
        
        // this.splitterNode = this.context.createChannelSplitter(numberOfChannels);
        this.masterGainNode = this.context.createGain();
        this.masterGainNode.gain.value = dbtoa(masterGain);
        for (let i = 0; i < numberOfChannels; i++) {
            this.muteGainNodePool[i] = this.context.createGain();
            this.muteGainNodePool[i].gain.value = enabledChannels[i] ? 1 : 0;
            // this.splitterNode.connect(this.muteGainNodePool[i], i, 0);
            this.gainNodePool[i] = this.context.createGain();
            this.gainNodePool[i].gain.value = dbtoa(trackGains[i]);
            this.muteGainNodePool[i].connect(this.gainNodePool[i]);
            this.stereoPannerNodePool[i] = this.context.createStereoPanner();
            this.stereoPannerNodePool[i].channelInterpretation = "discrete";
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
        await SplitterPlayerNode.register(audioWorklet);
        this.masterPeakAnalyserNode = new PeakAnalyserNode(this.context);
        this.splitterPlayerNode = new SplitterPlayerNode(this.editor.audioBuffer, this.context);
        for (let i = 0; i < this.editor.numberOfChannels; i++) {
            this.splitterPlayerNode.connect(this.muteGainNodePool[i], i, 0);
            this.peakAnalyserNodePool[i] = new PeakAnalyserNode(this.context);
            this.gainNodePool[i].connect(this.peakAnalyserNodePool[i]);
        }

    }
    async render(masterGain = 0) {
        const { sampleRate, numberOfChannels, length, audioBuffer, state } = this.editor;
        const { trackPans, trackGains } = state;
        const context = new OfflineAudioContext({ length, sampleRate, numberOfChannels: 2 });
        await SplitterPlayerNode.register(context.audioWorklet);
        const stereoPannerNodePool: StereoPannerNode[] = [];
        const gainNodePool: GainNode[] = [];
        const splitterPlayerNode = new SplitterPlayerNode(audioBuffer, context);
        const masterGainNode = context.createGain();
        masterGainNode.gain.value = dbtoa(masterGain);
        for (let i = 0; i < numberOfChannels; i++) {
            stereoPannerNodePool[i] = context.createStereoPanner();
            stereoPannerNodePool[i].channelInterpretation = "discrete";
            stereoPannerNodePool[i].pan.value = trackPans[i];
            gainNodePool[i] = context.createGain();
            gainNodePool[i].gain.value = dbtoa(trackGains[i]);
            splitterPlayerNode.connect(gainNodePool[i], i, 0);
            gainNodePool[i].connect(stereoPannerNodePool[i]);
            stereoPannerNodePool[i].connect(masterGainNode);
        }
        masterGainNode.connect(context.destination);
        await splitterPlayerNode.play();
        return context.startRendering();
    }
    async destroy() {
        // if (this.monitoring) this.stopMonitoring();
        if (this.playing) this.stop();
        await this.masterPeakAnalyserNode.destroy();
        await this.splitterPlayerNode.destroy();
    }
    async getCurrentSample() {
        const playhead = await this.splitterPlayerNode.getPlayhead();
        this.currentSample = playhead;
        return playhead;
    }
    async play(playheadIn?: number) {
        await this.stop();
        const { length, state } = this.editor;
        const { selRange, loop } = state;
        const playhead = playheadIn ?? state.playhead;
        this.currentTime = this.context.currentTime;
        this.currentSample = selRange ? selRange[0] : playhead;
        // bufferSourceNode.connect(this.dummyAnalyserNode);
        this.masterGainNode.connect(this.masterPeakAnalyserNode);
        await this.splitterPlayerNode.setLoop(loop);
        await this.splitterPlayerNode.setLoopRange(...(selRange ?? [0, length]));
        await this.splitterPlayerNode.setPlayhead(playhead);
        await this.splitterPlayerNode.play();
        this.playing = true;
        this.scheduleUpdateCursor();
    }
    async stop() {
        await this.splitterPlayerNode.stop();
        try {
            this.masterGainNode.disconnect(this.masterPeakAnalyserNode);
        } catch (error) { /* empty */ }
        this.playing = false;
    }
    async setPlayhead(playhead: number) {
        await this.play(playhead);
    }
}
