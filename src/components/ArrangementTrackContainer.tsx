import "./ArrangementTrackContainer.scss";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { AudioEditorContext } from "./contexts";
import { VSCodeButton, VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react";
import GainInput from "./GainInput";
import { VisualizationStyleOptions } from "../types";
import LevelMeter from "./LevelMeter";
import WaveformWorker from "../workers/WaveformWorker";
import VectorImageProcessor, { VectorDataSlice } from "../core/VectorImageProcessor";
import { setCanvasToFullSize } from "../utils";

type Props = Pick<VisualizationStyleOptions, "gridRulerColor" | "gridColor" | "textColor" | "monospaceFont"> & {
    size?: "tiny" | "small" | "medium" | "large" | "huge",
    index: number;
    position: number;
    groupIndex: number;
    total: number;
    numberOfChannels: number;
    name: string;
    gain: number;
    mute: boolean;
    solo: boolean;
    pan: number;
    linked: boolean;
    viewRange: [number, number];
    windowSize: number[];
    setMovingTrack: React.Dispatch<React.SetStateAction<[number, number, number] | null>>;
}

const ArrangementTrackContainer: React.FunctionComponent<Props> = (props) => {
    const { size = "medium", index, position, groupIndex, total, name, gain, mute, solo, pan, linked, viewRange, windowSize, setMovingTrack } = props;
    const hue = groupIndex / Math.min(10, total) * 360 % 360;
    const backgroundColor = `hsl(${~~(hue)}deg 50% 30% / 10%)`;
    const phosphorColor = `hsl(${~~(hue)}deg 50% 50%)`;
    const audioEditor = useContext(AudioEditorContext)!;
    const [dataSlice, setDataSlice] = useState<VectorDataSlice>();
    const [calculating, setCalculating] = useState(false);
    const [needRender, setNeedRender] = useState(false);
    const [moving, setMoving] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const handleClickMute = useCallback(() => audioEditor.setMute(index, !mute), [audioEditor, index, mute]);
    const handleClickSolo = useCallback(() => audioEditor.setSolo(index, !solo), [audioEditor, index, solo]);
    const handleClickLink = useCallback(() => audioEditor.setLinked(position, !linked), [audioEditor, position, linked]);
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
        const parent = containerRef.current!.parentElement!;
        const canvasRect = canvas.getBoundingClientRect();
        const containerRect = parent.getBoundingClientRect();
        if (canvasRect.bottom <= containerRect.top || canvasRect.top >= containerRect.bottom) {
            setNeedRender(true);
            return;
        }
        VectorImageProcessor.paint(ctx, [dataSlice], { width, height }, { viewRange }, { phosphorColor });
        setNeedRender(false);
    }, [dataSlice, viewRange, phosphorColor]);
    const handleScrollEnd = useCallback((e: Event) => {
        const parent = containerRef.current?.parentElement;
        if (!parent) return;
        paint(canvasRef);
    }, [paint]);
    useEffect(() => {
        const parent = containerRef.current?.parentElement;
        if (!parent) return;
        if (needRender) {
            parent.addEventListener("scrollend", handleScrollEnd);
        }
        return () => parent.removeEventListener("scrollend", handleScrollEnd);
    }, [handleScrollEnd, needRender]);
    
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
        if (!e.altKey) return;
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
    const handleNameMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (linked) return;
        if (!containerRef.current) return;
        const nameSpan = e.currentTarget;
        nameSpan.style.cursor = "grabbing";
        nameSpan.style.userSelect = "none";
        const container = containerRef.current;
        const containerRect = container.getBoundingClientRect();
        const parent = containerRef.current.parentElement!;
        const parentRect = parent.getBoundingClientRect();
        const deltaY = e.clientY - containerRect.y;
        // container.style.top = `${e.clientY - parentRect.y - deltaY + parent.scrollTop}px`;
        // setMoving(true);
        setMovingTrack([position, position, e.clientY - parentRect.y - deltaY + parent.scrollTop]);
        const movingContainer = parent.getElementsByClassName("moving-tracks-container")[0] as HTMLDivElement;
        if (movingContainer) {
            movingContainer.style.top = `${e.clientY - parentRect.y - deltaY + parent.scrollTop}px`;
        }
        const handleMouseMove = (e: MouseEvent) => {
            const top = e.clientY - parentRect.y - deltaY + parent.scrollTop;
            if (movingContainer) {
                movingContainer.style.top = `${e.clientY - parentRect.y - deltaY + parent.scrollTop}px`;
            }
            const tracks = [...parent.children].filter(d => d.classList.contains("arrangement-track-container"));
            const hoverTrackIndex = tracks.findIndex((d) => {
                const rect = d.getBoundingClientRect();
                return rect.top <= e.clientY && rect.bottom > e.clientY;
            });
            if (hoverTrackIndex >= 0) {
                const hoverTrack = tracks[hoverTrackIndex];
                const rect = hoverTrack.getBoundingClientRect();
                const { grouping } = audioEditor.state;
                const tracksMoving = new Array(grouping.length).fill(false);
                tracksMoving[position] = true;
                for (let i = position; i >= 0; i--) {
                    if (grouping[i].linked) tracksMoving[i] = true;
                    else break;
                }
                for (let i = position + 1; i < grouping.length; i++) {
                    if (grouping[i].linked) tracksMoving[i] = true;
                    else break;
                }
                const tracksOnPlace = grouping.filter((v, i) => !tracksMoving[i]);
                if (e.clientY < rect.top + rect.height / 2 && !tracksOnPlace[hoverTrackIndex].linked) setMovingTrack([position, hoverTrackIndex, top]);
                else if (e.clientY >= rect.top + rect.height / 2 && !tracksOnPlace[hoverTrackIndex + 1]?.linked) setMovingTrack([position, hoverTrackIndex + 1, top]);
                else setMovingTrack((prev) => prev ? [prev[0], prev[1], top] : prev);
            } else {
                setMovingTrack((prev) => prev ? [prev[0], prev[1], top] : prev);
            }
            e.stopPropagation();
            e.preventDefault();
        };
        const handleMouseUp = (e: MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
            nameSpan.style.cursor = "grab";
            nameSpan.style.userSelect = "auto";
            setMovingTrack((movingTrack) => {
                if (!movingTrack) return null;
                const [from, to] = movingTrack;
                const { grouping } = audioEditor.state;
                const tracksMoving = new Array(grouping.length).fill(false);
                tracksMoving[from] = true;
                for (let i = from; i >= 0; i--) {
                    if (grouping[i].linked) tracksMoving[i] = true;
                    else break;
                }
                for (let i = from + 1; i < grouping.length; i++) {
                    if (grouping[i].linked) tracksMoving[i] = true;
                    else break;
                }
                const newGrouping = grouping.filter((v, i) => !tracksMoving[i]);
                newGrouping.splice(to, 0, ...grouping.filter((v, i) => tracksMoving[i]));
                audioEditor.setState({ grouping: newGrouping });
                return null;
            });
            // setMoving(false);
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
    }, [audioEditor, linked, position, setMovingTrack]);
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
    useEffect(() => {
        setTimeout(paint, 200, canvasRef);
    }, [paint, windowSize]);
    const panLeft = `${Math.min((pan + 1) * 0.5, 0.5) * 100}%`;
    const panWidth = `${Math.abs(pan) * 50}%`;
    return (
        <div style={{ backgroundColor }} className={`arrangement-track-container ${size}${moving ? " moving" : ""}${linked ? " linked" : ""}`} ref={containerRef}>
            <div className="controls-container">
                <div className="name" title={name} onMouseDown={handleNameMouseDown}>
                    {linked ? null : <span className="codicon codicon-move"></span>}
                    <span>{name}</span>
                </div>
                <div className="empty"></div>
                <div className="pan" title={`Pan: ${pan.toFixed(2)}`}>
                    <div className="pan-indicator" style={{ width: panWidth, left: panLeft }}></div>
                </div>
                <div className="controls">
                    <div className={`linked${linked ? " active" : ""}`}>
                        <VSCodeButton disabled={position === 0} tabIndex={-1} aria-label="Link" title="Link" appearance={size === "tiny" ? "icon" : "secondary"} onClick={handleClickLink}>
                            <span className="codicon codicon-link"></span>
                        </VSCodeButton>
                    </div>
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
                    <GainInput style={linked ? { pointerEvents: "none" } : {}} gain={gain} unit="dB" onChange={handleGainChange} onAdjust={handleGainChange} />
                </div>
                <div className="meter">
                    <LevelMeter {...props} peakAnalyserNode={audioEditor.player!.peakAnalyserNodePool[index]} showRuler={false} minDB={minDB} maxDB={maxDB} />
                    {linked ? null : <div className="gain-slider" style={{ left: `${(gain - minDB) / (maxDB - minDB) * 100}%` }} onMouseDown={handleMouseDownGainController} onDoubleClick={handleDoubleClickGainController} />}
                </div>
            </div>
            {
                calculating
                ? <VSCodeProgressRing />
                : <div className="waveform" onMouseDown={handleCanvasMouseDown} onWheel={handleCanvasWheel}>
                    <canvas ref={canvasRef} />
                </div>
            }
            
        </div>
    );
};

export default ArrangementTrackContainer;