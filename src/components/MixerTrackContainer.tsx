import "./MixerTrackContainer.scss";
import { useCallback, useContext, useEffect, useRef, useState, memo } from "react";
import { AudioEditorContext } from "./contexts";
import { VSCodeButton, VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react";
import GainInput from "./GainInput";
import { VisualizationStyleOptions } from "../types";
import LevelMeter from "./LevelMeter";
import WaveformWorker from "../workers/WaveformWorker";
import VectorImageProcessor, { VectorDataSlice } from "../core/VectorImageProcessor";
import { setCanvasToFullSize } from "../utils";
import PeakAnalyserNode from "../worklets/PeakAnalyserNode";

type Props = Pick<VisualizationStyleOptions, "gridRulerColor" | "gridColor" | "textColor" | "monospaceFont"> & {
    group: number[];
    position: number;
    groupIndex: number;
    names: string[];
    gain: number;
    mutes: boolean[];
    solos: boolean[];
    pans: number[];
    windowSize: number[];
    setMovingTrack: React.Dispatch<React.SetStateAction<[number, number, number] | null>>;
}

const MixerTrackLabelContainer: React.FunctionComponent<{ index: number; name: string; mute: boolean; solo: boolean; pan: number; setMovingTrack: React.Dispatch<React.SetStateAction<[number, number, number] | null>> }> = (props) => {
    const { index, name, mute, solo, pan, setMovingTrack } = props;
    const audioEditor = useContext(AudioEditorContext)!;
    const panLeft = `${Math.min((pan + 1) * 0.5, 0.5) * 100}%`;
    const panWidth = `${Math.abs(pan) * 50}%`;
    const handleClickMute = useCallback(() => audioEditor.setMute(index, !mute), [audioEditor, index, mute]);
    const handleClickSolo = useCallback(() => audioEditor.setSolo(index, !solo), [audioEditor, index, solo]);
    return (
        <div className="mixer-track-label-container" title={name}>
            <div className={`name${mute ? " mute" : ""}${solo ? " solo" : ""}`}>{name}</div>
            <div className="controls">
                <div className="pan" title={`Pan: ${pan.toFixed(2)}`}>
                    <div className="pan-indicator" style={{ width: panWidth, left: panLeft }}></div>
                </div>
                <div className={`mute${mute ? " active" : ""}`}>
                    <VSCodeButton tabIndex={-1} aria-label="Mute" title="Mute" appearance="icon" onClick={handleClickMute}>
                    </VSCodeButton>
                </div>
                <div className={`solo${solo ? " active" : ""}`}>
                    <VSCodeButton tabIndex={-1} aria-label="Solo" title="Solo" appearance="icon" onClick={handleClickSolo}>
                    </VSCodeButton>
                </div>
            </div>
        </div>
    );
};

const MixerTrackContainer: React.FunctionComponent<Props> = (props) => {
    const { group, position, groupIndex, gain, mutes, solos, pans, names, windowSize, setMovingTrack } = props;
    const hue = groupIndex / 7 * 360 * 7.5 / 7 % 360;
    const backgroundColor = `hsl(${~~(hue)}deg 50% 30% / 10%)`;
    const labelBackgroundColor = `hsl(${~~(hue)}deg 50% 20%)`;
    const phosphorColor = `hsl(${~~(hue)}deg 50% 50%)`;
    const borderLeftColor = `hsl(${~~(hue)}deg 50% 75%)`;
    const audioEditor = useContext(AudioEditorContext)!;
    const [peakAnalyserNode, setPeakAnalyserNode] = useState<PeakAnalyserNode | null>(null);
    const trackLabelsList = group.map((v, i) => <MixerTrackLabelContainer {...{ index: v, name: names[i], mute: mutes[i], solo: solos[i], pan: pans[i], setMovingTrack }} />);
    const minDB = -70;
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
            if (e.movementY) {
                const gain = Math.min(1, Math.max(0, (rect.bottom - e.clientY) / rect.height)) * (maxDB - minDB) + minDB;
                group.forEach(index => audioEditor.setGain(index, gain));
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
                group.forEach(index => audioEditor.setGain(index, originalGain));
                document.removeEventListener("mousemove", handleMouseMove);
                document.removeEventListener("mouseup", handleMouseUp);
                document.removeEventListener("keydown", handleKeyDown);
            }
        };
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
        document.addEventListener("keydown", handleKeyDown);
    }, [audioEditor, gain, group, minDB]);
    const handleDoubleClickGainController = useCallback(() => group.forEach(index => audioEditor.setGain(index, 0)), [audioEditor, group]);
    useEffect(() => {
        const peakAnalyserNode = new PeakAnalyserNode(audioEditor.context);
        for (let i = 0; i < group.length; i++) {
            const panner = audioEditor.player?.stereoPannerNodePool[group[i]];
            if (!panner) continue;
            panner.connect(peakAnalyserNode);
        }
        setPeakAnalyserNode(peakAnalyserNode);
        return () => {
            setPeakAnalyserNode(null);
            peakAnalyserNode.disconnect();
            peakAnalyserNode.destroy();
        }
    }, [audioEditor, group]);

    const groupName = group.length > 1 ? `Group ${groupIndex + 1}` : names[0];
    return (
        <div style={{ backgroundColor }} className="mixer-track-container">
            <div className="tracks-list">
                {trackLabelsList}
            </div>
            <div className="meter-gain-container">
                <div className="meter">
                    {peakAnalyserNode ? <LevelMeter {...props} peakAnalyserNode={peakAnalyserNode} numberOfChannels={2} orientation="vertical" minDB={minDB} maxDB={maxDB} /> : null}
                    <div className="gain-slider" style={{ bottom: `${(gain - minDB) / (maxDB - minDB) * 100}%` }} onMouseDown={handleMouseDownGainController} onDoubleClick={handleDoubleClickGainController} />
                </div>
            </div>
            <div className="group-name" title={groupName} style={{ backgroundColor: labelBackgroundColor }}>
                <span>{groupName}</span>
            </div>
        </div>
    );
};

export default MixerTrackContainer;