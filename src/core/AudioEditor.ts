import TypedEventEmitter from "@shren/typed-event-emitter";
import OperableAudioBuffer from "./OperableAudioBuffer";
import AudioPlayer from "./AudioPlayer";
import { dbtoa } from "../utils";
import { AudioEditorConfiguration, AudioUnit, GroupingItem } from "../types";
import { VectorDataSlice } from "./VectorImageProcessor";

export type {
    AudioEditorConfiguration,
    AudioUnit
};

export type AudioPlayingState = "stopped" | "paused" | "playing";

export interface AudioEditorState {
    isReady: boolean;
    playing: AudioPlayingState;
    monitoring: boolean;
    recording: boolean;
    loop: boolean;
    playhead: number;
    selRange: [number, number] | null;
    viewRange: [number, number];
    trackNames: string[];
    trackGains: number[];
    trackMutes: boolean[];
    trackSolos: boolean[];
    trackPans: number[];
    masterGain: number;
    grouping: GroupingItem[];
}

export interface AudioEditorEventMap extends Omit<AudioEditorState, "isReady"> {
    "selRangeToPlay": [number, number] | null;
    "ready": never;
    "state": AudioEditorState;
    "configuration": AudioEditorConfiguration;
    "playerStateUpdated": Partial<AudioEditorState>;
}

class AudioEditor extends TypedEventEmitter<AudioEditorEventMap> {
    static DEFAULT_CONFIGURATION: AudioEditorConfiguration = {
        audioUnit: "time",
        fftSize: 1024,
        fftOverlap: 2,
        fftWindowFunction: "blackmanHarris",
        beatsPerMinute: 60,
        beatsPerMeasure: 4,
        division: 16
    };
    static async fromData(audioBuffer: Float32Array[], context: AudioContext, name: string, configuration: Partial<AudioEditorConfiguration> = {}, uri?: string, workspaceUri = location.href) {
        // const operableAudioBuffer: OperableAudioBuffer = Object.setPrototypeOf(audioBuffer, OperableAudioBuffer.prototype);
        // const timeDomainData = operableAudioBuffer.toArray(true);
        const audioEditor = new AudioEditor(audioBuffer, audioBuffer, name, context, { ...this.DEFAULT_CONFIGURATION, ...configuration }, uri, workspaceUri);
        await audioEditor.initPlayer();
        // await audioEditor.initModules(state);
        audioEditor.setState({ isReady: true });
        audioEditor.emit("ready");
        return audioEditor;
    }
    state: AudioEditorState = {
        isReady: false,
        playing: "stopped",
        monitoring: false,
        loop: true,
        recording: false,
        playhead: 0,
        selRange: null,
        viewRange: [0, 0],
        trackNames: [],
        trackGains: [],
        trackMutes: [],
        trackSolos: [],
        trackPans: [],
        masterGain: 0,
        grouping: []
    };
    dataSlices: VectorDataSlice[] = [];
    get name() {
        return this._name;
    }
    get length() {
        return this._audioBuffer[0].length;
    }
    get numberOfChannels() {
        return this._audioBuffer.length;
    }
    get sampleRate() {
        return this._context.sampleRate;
    }
    get duration() {
        return this._audioBuffer[0].length / this.sampleRate;
    }
    get audioBuffer() {
        return this._audioBuffer;
    }
    get timeDomainData() {
        return this._timeDomainData;
    }
    get context() {
        return this._context;
    }
    get player() {
        return this._player;
    }
    get configuration() {
        return this._configuration;
    }
    get uri() {
        return this._uri;
    }
    get workspaceUri() {
        return this._workspaceUri;
    }
    get enabledChannels() {
        if (this.state.trackSolos.includes(true)) return this.state.trackSolos.slice();
        return this.state.trackMutes.map(mute => !mute);
    }
    public makingEdit = true;
    private _player: AudioPlayer | null = null;
    private constructor(
        private _audioBuffer: Float32Array[],
        private _timeDomainData: Float32Array[],
        private _name: string,
        private _context: AudioContext,
        private _configuration: AudioEditorConfiguration,
        private _uri: string | undefined,
        private _workspaceUri: string | undefined
    ) {
        super();
        this.setState({
            trackGains: new Array(this.numberOfChannels).fill(0),
            trackMutes: new Array(this.numberOfChannels).fill(false),
            trackSolos: new Array(this.numberOfChannels).fill(false),
            trackPans: new Array(this.numberOfChannels).fill(0),
            viewRange: [0, this.length],
            grouping: new Array(this.numberOfChannels).fill(0).map((v, id) => ({ id, linked: false }))
        });
    }
    private async initPlayer() {
        this._player = await AudioPlayer.init(this);
    }
    setState(state: Partial<AudioEditorState>) {
        const oldState = { ...this.state };
        this.state = {
            ...this.state,
            ...state
        };
        for (const key in state) {
            if ((state as any)[key] !== (oldState as any)[key]) this.emit(key as any, (state as any)[key]);
        }
        this.emit("state", this.state);
        if ((["trackGains", "trackSolos", "trackMutes", "trackGains", "trackPans", "masterGain", "loop"] as (keyof AudioEditorState)[]).find(k => k in state)) {
            this.emit("playerStateUpdated", state);
        }
    }
    setConfiguration(configuration: Partial<AudioEditorConfiguration>) {
        this._configuration = { ...this._configuration, ...configuration };
        this.emit("configuration", this._configuration);
    }
    zoomH(refIn: number, factor: number) { // factor = 1 as zoomIn, -1 as zoomOut
        const { viewRange } = this.state;
        const { length } = this;
        const [viewStart, viewEnd] = viewRange;
        const viewLength = viewEnd - viewStart;
        const minRange = Math.min(length, 5);
        const ref = Math.max(0, Math.min(length, Math.round(refIn)));
        if (ref < viewStart || ref > viewEnd) {
            const start = Math.max(0, Math.min(length - viewLength, Math.round(ref - viewLength / 2)));
            const end = Math.max(viewLength, Math.min(length, Math.round(ref + viewLength / 2)));
            const range: [number, number] = [start, end];
            this.setState({ viewRange: range });
            this.emit("viewRange", range);
        } else if (factor < 0 || viewLength > minRange) {
            const multiplier = 1.5 ** -factor;
            const start = ref - (ref - viewStart) * multiplier;
            const end = ref + (viewEnd - ref) * multiplier;
            this.setViewRange([start, end]);
        }
    }
    scrollH(speed: number) { // spped = 1 as one full viewRange
        const { viewRange } = this.state;
        if (!speed) return viewRange.slice() as [number, number];
        const { length } = this;
        const [viewStart, viewEnd] = viewRange;
        const viewLength = viewEnd - viewStart;
        const deltaSamples = Math.round(speed > 0 ? Math.max(1, viewLength * speed) : Math.min(-1, viewLength * speed));
        const start = Math.max(0, Math.min(length - viewLength, viewStart + deltaSamples));
        const end = Math.min(length, Math.max(viewLength, viewEnd + deltaSamples));
        this.setViewRange([start, end]);
        return [start, end] as [number, number];
    }
    setGain(channel: number, value: number) {
        const array = this.state.trackGains.slice();
        const db = +value.toFixed(1);
        let currId = channel;
        let currIndex: number;
        let next: number | undefined;
        let nextGrouping: GroupingItem | undefined;
        do {
            array[currId] = db;
            currIndex = this.state.grouping.findIndex(({ id }) => id === currId);
            if (currIndex === -1) throw new Error(`Cannot find id ${currId} in the grouping table.`);
            next = this.state.grouping[currIndex + 1]?.id;
            if (typeof next !== "number") break;
            currId = next;
            nextGrouping = this.state.grouping.find(({ id }) => id === next);
        } while (nextGrouping?.linked)
        this.setState({ trackGains: array });
    }
    setGains(gains: number[]) {
        const array = this.state.trackGains.slice();
        for (let i = 0; i < Math.min(gains.length, array.length); i++) {
            array[i] = +gains[i].toFixed(1);
        }
        this.setState({ trackGains: array });
    }
    setSolo(channel: number, value: boolean) {
        const array = this.state.trackSolos.slice();
        array[channel] = value;
        this.setState({ trackSolos: array });
    }
    setMute(channel: number, value: boolean) {
        const array = this.state.trackMutes.slice();
        array[channel] = value;
        this.setState({ trackMutes: array });
    }
    setLoop(loop: boolean) {
        this.setState({ loop });
        this.emit("loop", loop);
    }
    setLinked(position: number, linked: boolean) {
        if (position === 0) return;
        const array = this.state.grouping.slice();
        array[position] = { ...array[position], linked };
        if (linked) this.setGain(array[position].id, this.state.trackGains[array[position - 1].id]);
        this.setState({ grouping: array });
    }
    async setPlayhead(playheadIn: number, fromPlayer?: boolean) {
        const shouldReplay = !fromPlayer && this.state.playing === "playing";
        if (shouldReplay) this.player!.setPlayhead(playheadIn);
        const { length } = this;
        const playhead = Math.max(0, Math.min(length, Math.round(playheadIn)));
        this.setState({ playhead });
        this.emit("playhead", playhead);
    }
    async selectAll() {
        this.setSelRangeToAll();
    }
    emitSelRangeToPlay() {
        this.emit("selRangeToPlay", this.state.selRange);
    }
    setSelRange(range: [number, number] | null) {
        if (!range) {
            this.setState({ selRange: null });
            this.emit("selRange", null);
            return;
        }
        const { length } = this;
        let [start, end] = range;
        if (end < start) [start, end] = [end, start];
        start = Math.max(0, Math.min(length - 1, Math.round(start)));
        end = Math.max(1, Math.min(length, Math.round(end)));
        if (start === end) {
            this.setState({ selRange: null });
            this.emit("selRange", null);
            return;
        }
        const selRange: [number, number] = [start, end];
        this.setState({ selRange, playhead: start });
        this.emit("selRange", selRange);
        this.emit("playhead", start);
    }
    setSelRangeToAll() {
        const { length } = this;
        const selRange: [number, number] = [0, length];
        this.setState({ selRange });
        this.emit("selRange", selRange);
        this.emitSelRangeToPlay();
    }
    setViewRange(range: [number, number]) {
        const { length } = this;
        let [start, end] = range;
        if (end < start) [start, end] = [end, start];
        const minRange = Math.min(length, 5);
        start = Math.max(0, Math.min(length - minRange, Math.round(start)));
        end = Math.max(minRange, Math.min(length, Math.round(end)));
        const viewRange: [number, number] = [start, end];
        this.setState({ viewRange });
        this.emit("viewRange", viewRange);
    }
    setViewRangeToAll() {
        const { length } = this;
        const viewRange: [number, number] = [0, length];
        this.setState({ viewRange });
        this.emit("viewRange", viewRange);
    }
    play() {
        const playing: AudioPlayingState = "playing";
        this.setState({ playing });
        this.emit("playing", playing);
        this.player!.play();
    }
    pause() {
        const playing: AudioPlayingState = "paused";
        this.setState({ playing });
        this.emit("playing", playing);
        this.player!.stop();
    }
    resume() {
        const playing: AudioPlayingState = "playing";
        this.setState({ playing });
        this.emit("playing", playing);
        this.player!.play();
    }
    stop() {
        const playing: AudioPlayingState = "stopped";
        this.setState({ playing });
        this.emit("playing", playing);
        this.player!.stop();
    }
    setMasterGain(masterGain: number) {
        this.setState({ masterGain: +masterGain.toFixed(1) });
    }
    handlePlayerEnded(playhead: number) {
        const playing: AudioPlayingState = "stopped";
        this.setState({ playing });
        this.emit("playing", playing);
        this.setPlayhead(playhead);
    };
    static fromGroupingString(str: string) {
        const ids = str.split(/[-_]/).map(v => +v);
        const linked = str.split("_").map(s => s.split("-").map((v, i) => i > 0)).flat();
        return ids.map((id, i) => ({ id, linked: linked[i] }) as GroupingItem);
    }
    static toGroupingString(grouping: GroupingItem[]) {
        return grouping.map((chain, i) => `${i === 0 ? "" : chain.linked ? "-" : "_"}${chain.id}`).join("");
    }
}

export default AudioEditor;
