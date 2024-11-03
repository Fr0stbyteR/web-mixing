import "./OutputContainer.scss";
import { useCallback, useContext, useRef } from "react";
import { AudioEditorContext } from "./contexts";
import LevelMeter from "./LevelMeter";
import { AudioEditorConfiguration, VisualizationStyleOptions } from "../types";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import { AudioEditorState } from "../core/AudioEditor";
import PeakAnalyserNode from "../worklets/PeakAnalyserNode";
import GainInput from "./GainInput";
import OperableAudioBuffer from "../core/OperableAudioBuffer";
import WavEncoder from "../core/WavEncoder";
import { atodb, getMaxOfArray } from "../utils";

type Props = Pick<AudioEditorState, "playing" | "playhead" | "loop" | "selRange" | "viewRange" | "masterGain">
& Pick<VisualizationStyleOptions, "gridRulerColor" | "gridColor" | "textColor" | "monospaceFont">
 & {
    peakAnalyserNode: PeakAnalyserNode;
    configuration: AudioEditorConfiguration;
    scrollerSize: number;
    windowSize: number[];
};

const OutputContainer: React.FunctionComponent<Props> = (props) => {
    const { masterGain } = props;
    const audioEditor = useContext(AudioEditorContext)!;
    const aRef = useRef<HTMLAnchorElement>(null);
    const handleClickBounce = useCallback(async () => {
        if (!aRef.current) return;
        let audioBuffer = await audioEditor.player!.render();
        let operableAudioBuffer: OperableAudioBuffer = Object.setPrototypeOf(audioBuffer, OperableAudioBuffer.prototype);
        const buffer = operableAudioBuffer.toArray()
        let max = 0;
        buffer.forEach((b) => {
            const absArray = b.map(Math.abs) as any;
            max = Math.max(max, getMaxOfArray(absArray));
        });
        const gain = atodb(1 / max);
        audioEditor.setMasterGain(gain);
        audioBuffer = await audioEditor.player!.render(gain);
        operableAudioBuffer = Object.setPrototypeOf(audioBuffer, OperableAudioBuffer.prototype);
        const wav = WavEncoder.encode(operableAudioBuffer.toArray(), { sampleRate: audioBuffer.sampleRate, bitDepth: 24 });
        const url = window.URL.createObjectURL(new Blob([wav], { type: "audio/wav" }));
        aRef.current.href = url;
        aRef.current.download = `${audioEditor.name}.wav`;
        aRef.current.click();
    }, [audioEditor]);
    const handleClickNormalize = useCallback(async () => {
        const audioBuffer = await audioEditor.player!.render();
        const operableAudioBuffer: OperableAudioBuffer = Object.setPrototypeOf(audioBuffer, OperableAudioBuffer.prototype);
        const buffer = operableAudioBuffer.toArray();
        let max = 0;
        buffer.forEach((b) => {
            const absArray = b.map(Math.abs) as any;
            max = Math.max(max, getMaxOfArray(absArray));
        });
        const gain = atodb(1 / max);
        audioEditor.setMasterGain(gain);
    }, [audioEditor]);
    const handleChangeGain = useCallback((gain: number) => audioEditor.setMasterGain(gain), [audioEditor]);
    return (
        <div className="output-container">
            <div className="output-controls">
                <VSCodeButton onClick={handleClickBounce}>Bounce</VSCodeButton>
                <VSCodeButton onClick={handleClickNormalize}>Normalize</VSCodeButton>
                <span>Current Master Gain: </span>
                <GainInput gain={masterGain} unit="dB" onAdjust={handleChangeGain} onChange={handleChangeGain} />
                <a hidden ref={aRef}></a>
            </div>
            <div className="master-meter-container">
                <LevelMeter {...props} minDB={-70} maxDB={5} numberOfChannels={2} showRuler />
            </div>
        </div>
    );
};

export default OutputContainer;