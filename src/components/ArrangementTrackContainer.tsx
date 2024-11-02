import "./ArrangementTrackContainer.scss";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { AudioEditorContext } from "./contexts";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import GainInput from "./GainInput";
import { VisualizationStyleOptions } from "../types";
import LevelMeter from "./LevelMeter";
import WaveformWorker from "../workers/WaveformWorker";
import VectorImageProcessor, { VectorDataSlice } from "../core/VectorImageProcessor";
import { setCanvasToFullSize } from "../utils";

type Props = Pick<VisualizationStyleOptions, "gridRulerColor" | "gridColor" | "textColor" | "monospaceFont"> & {
    size?: "tiny" | "small" | "medium" | "large" | "huge",
    index: number;
    total: number;
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
    const { size = "medium", index, total, name, gain, mute, solo, pan, viewRange, windowSize } = props;
    const backgroundColor = `hsl(${~~(index / total * 365)}deg 50% 30% / 10%)`;
    const phosphorColor = `hsl(${~~(index / total * 365)}deg 50% 50%)`;
    const audioEditor = useContext(AudioEditorContext)!;
    const [dataSlice, setDataSlice] = useState<VectorDataSlice>();
    const [calculating, setCalculating] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const handleClickMute = useCallback(() => audioEditor.setMute(index, !mute), [audioEditor, index, mute]);
    const handleClickSolo = useCallback(() => audioEditor.setSolo(index, !solo), [audioEditor, index, solo]);
    const handleGainChange = useCallback((gain: number) => audioEditor.setGain(index, gain), [audioEditor, index]);
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
    
    const paint = useCallback((canvasRef: React.RefObject<HTMLCanvasElement>) => {
        if (!dataSlice) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;
        const [width, height] = setCanvasToFullSize(canvas);
        VectorImageProcessor.paint(ctx, [dataSlice], { width, height }, { viewRange }, { phosphorColor });
    }, [dataSlice, viewRange, phosphorColor]);
    const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        (document.activeElement as HTMLElement)?.blur();
        e.stopPropagation();
        e.preventDefault();
        const [viewStart, viewEnd] = viewRange;
        const viewLength = viewEnd - viewStart;
        const origin = { x: e.clientX, y: e.clientY };
        const rect = e.currentTarget.getBoundingClientRect();
        const playhead = viewStart + (e.clientX - rect.left) / rect.width * viewLength;
        audioEditor.setPlayhead(playhead);
        audioEditor.setSelRange(null);
        const handleMouseMove = (e: MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
            const x = e.clientX;
            if (x === origin.x) {
                audioEditor.setSelRange(null);
            } else {
                if (x > rect.right) audioEditor.scrollH((x - rect.right) / 1000);
                else if (x < rect.left) audioEditor.scrollH((x - rect.left) / 1000);
                const [viewStart, viewEnd] = audioEditor.state.viewRange;
                const viewLength = viewEnd - viewStart;
                const to = viewStart + Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * viewLength;
                audioEditor.setSelRange([playhead, to]);
            }
        };
        const handleMouseUp = (e: MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
            audioEditor.emitSelRangeToPlay();
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
    }, [audioEditor, viewRange]);
    const handleCanvasWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
        if (!e.deltaX && !e.deltaY) return;
        let divMainFlexContainer = e.currentTarget.parentElement;
        while (divMainFlexContainer && !divMainFlexContainer.classList.contains("editor-main-flex")) {
            divMainFlexContainer = divMainFlexContainer.parentElement;
        }
        if (divMainFlexContainer && divMainFlexContainer.scrollHeight > divMainFlexContainer.clientHeight) return;

        e.stopPropagation();
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
            audioEditor.scrollH(e.deltaX > 0 ? 0.01 : -0.01);
            return;
        }
        const [viewStart, viewEnd] = viewRange;
        const viewLength = viewEnd - viewStart;
        const origin = { x: e.clientX, y: e.clientY };
        const rect = e.currentTarget.getBoundingClientRect();
        const ref = viewStart + (origin.x - rect.left) / rect.width * viewLength;
        audioEditor.zoomH(ref, e.deltaY < 0 ? 1 : -1);
    }, [audioEditor, viewRange]);
    useEffect(() => {
        (async () => {
            setCalculating(true);
            const { timeDomainData, length } = audioEditor;
            const worker = new WaveformWorker();
            const vectors = [timeDomainData[index]];
            const ds = await worker.generateResized(vectors, { startIndex: 0, endIndex: length });
            setCalculating(false);
            setDataSlice({ ...ds, vectors });
        })();
    }, [audioEditor, index]);
    useEffect(() => paint(canvasRef), [paint, windowSize]);
    return (
        <div style={{ backgroundColor }} className={`arrangement-track-container ${size}`}>
            <div className="controls-container">
                <div className="name">{name}</div>
                <div className="controls">
                    <div className={`mute${mute ? " active" : ""}`}>
                        <VSCodeButton tabIndex={-1} aria-label="Mute" title="Mute" appearance={size === "tiny" ? "icon" : "secondary"} onClick={handleClickMute}>
                            <span>M</span>
                        </VSCodeButton>
                    </div>
                    <div className={`solo${solo ? " active" : ""}`}>
                        <VSCodeButton tabIndex={-1} aria-label="Solo" title="Solo" appearance={size === "tiny" ? "icon" : "secondary"} onClick={handleClickSolo}>
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
            <div className="waveform" onMouseDown={handleCanvasMouseDown} onWheel={handleCanvasWheel}>
                <canvas ref={canvasRef} />
            </div>
        </div>
    );
};

export default ArrangementTrackContainer;