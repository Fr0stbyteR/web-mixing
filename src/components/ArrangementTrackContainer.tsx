import "./ArrangementTrackContainer.scss";
import { useCallback, useContext, useRef } from "react";
import { AudioEditorContext } from "./contexts";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import GainInput from "./GainInput";
import { VisualizationStyleOptions } from "../types";
import LevelMeter from "./LevelMeter";

type Props = Pick<VisualizationStyleOptions, "gridRulerColor" | "gridColor" | "textColor" | "monospaceFont"> & {
    size?: "tiny" | "small" | "medium" | "large" | "huge",
    index: number;
    numberOfChannels: number;
    name: string;
    gain: number;
    mute: boolean;
    solo: boolean;
    pan: number;
    viewRange: [number, number];
    windowSize: number[];
}

const ArrangementTrackContainer: React.FunctionComponent<Props> = (props) => {
    const { size = "medium", index, name, gain, mute, solo, pan, viewRange } = props;
    const audioEditor = useContext(AudioEditorContext)!;
    const handleClickMute = useCallback(() => audioEditor.setMute(index, !mute), [audioEditor, index, mute]);
    const handleClickSolo = useCallback(() => audioEditor.setSolo(index, !solo), [audioEditor, index, solo]);
    const handleGainChange = useCallback((gain: number) => audioEditor.setGain(index, gain), [audioEditor, index]);
    const minDB = -100;
    const maxDB = 20;
    const handleMouseDownGainController = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
        e.preventDefault();
        const div = e.currentTarget;
        div.style.cursor = "grabbing";
        const rect = e.currentTarget.parentElement!.getBoundingClientRect();
        const originalGain = gain;
        const handleMouseMove = (e: MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
            if (e.movementX) {
                const gain = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)) * (maxDB - minDB) + minDB;
                audioEditor.setGain(index, gain);
            }
        };
        const handleMouseUp = () => {
            div.style.cursor = "grabbing";
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
            document.removeEventListener("keydown", handleKeyDown);
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.stopPropagation();
                e.preventDefault();
                audioEditor.setGain(index, originalGain);
                document.removeEventListener("mousemove", handleMouseMove);
                document.removeEventListener("mouseup", handleMouseUp);
                document.removeEventListener("keydown", handleKeyDown);
            }
        };
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
        document.addEventListener("keydown", handleKeyDown);
    }, [audioEditor, gain, index, minDB]);
    const handleDoubleClickGainController = useCallback(() => audioEditor.setGain(index, 0), [audioEditor, index]);
    return (
        <div className={`arrangement-track-container ${size}`}>
            <div className="controls-container">
                <div className="name">{name}</div>
                <div className="controls">
                    <div className={`mute${mute ? " active" : ""}`}>
                        <VSCodeButton tabIndex={-1} aria-label="Mute" title="Mute" appearance="secondary" onClick={handleClickMute}>
                            <span>M</span>
                        </VSCodeButton>
                    </div>
                    <div className={`solo${solo ? " active" : ""}`}>
                        <VSCodeButton tabIndex={-1} aria-label="Solo" title="Solo" appearance="secondary" onClick={handleClickSolo}>
                            <span>S</span>
                        </VSCodeButton>
                    </div>
                    <GainInput gain={gain} unit="dB" onChange={handleGainChange} onAdjust={handleGainChange} />
                </div>
                <div className="meter">
                    <LevelMeter {...props} peakAnalyserNode={audioEditor.player!.peakAnalyserNodePool[index]} showRuler={false} minDB={minDB} maxDB={maxDB} />
                    <div className="gain-slider" style={{ left: `${(gain - minDB) / (maxDB - minDB) * 100}%` }} onMouseDown={handleMouseDownGainController} onDoubleClick={handleDoubleClickGainController} />
                </div>
            </div>
            <div className="waveform"></div>
        </div>
    );
};

export default ArrangementTrackContainer;