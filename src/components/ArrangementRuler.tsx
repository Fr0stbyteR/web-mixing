import "./ArrangementRuler.scss";
import { useCallback, useContext, useEffect, useRef } from "react";
import { AudioEditorContext } from "./contexts";
import { AudioEditorConfiguration, AudioEditorState } from "../core/AudioEditor";
import { VSCodeDropdown, VSCodeOption } from "@vscode/webview-ui-toolkit/react";
import { getCssFromPosition, getRuler, setCanvasToFullSize } from "../utils";
import { TrackSize, VisualizationStyleOptions } from "../types";

type Props = Pick<AudioEditorState, "playhead" | "selRange" | "viewRange">
& Pick<VisualizationStyleOptions, "gridRulerColor" | "gridColor" | "textColor" | "monospaceFont">
 & {
    windowSize: number[];
    trackSize: TrackSize;
    setTrackSize: (size: TrackSize) => any;
    scrollerSize: number;
    configuration: AudioEditorConfiguration;
};

const ArrangementHorizontalScroller: React.FunctionComponent<Props> = ({ playhead, viewRange, selRange, windowSize, scrollerSize, trackSize, setTrackSize, configuration: { audioUnit, beatsPerMeasure, beatsPerMinute, division }, gridColor, gridRulerColor, monospaceFont, textColor }) => {
    const audioEditor = useContext(AudioEditorContext)!;
    const divSelRangeRef = useRef<HTMLDivElement>(null);
    const divVerticalRulerRef = useRef<HTMLDivElement>(null);
    const canvasVerticalRulerRef = useRef<HTMLCanvasElement>(null);
    const paintVerticalRuler = useCallback(() => {
        const canvas = canvasVerticalRulerRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;
        const [width, height] = setCanvasToFullSize(canvas);
        const { sampleRate } = audioEditor;
        const { ruler } = getRuler(viewRange, audioUnit, { sampleRate, beatsPerMeasure, beatsPerMinute, division });
        const [$drawFrom, $drawTo] = viewRange;
        const pixelsPerSample = width / ($drawTo - $drawFrom);
        ctx.clearRect(0, 0, width, height);
        ctx.strokeStyle = gridRulerColor;
        ctx.fillStyle = textColor;
        ctx.font = `12px ${monospaceFont}`;
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        ctx.fillText(audioUnit === "time" ? "hms" : audioUnit === "measure" ? `${beatsPerMinute} bpm` : "samps", 2, height - 14);
        ctx.textAlign = "center";
        ctx.beginPath();
        let text: string;
        let x: number;
        let y: number;
        for (const $str in ruler) {
            text = ruler[$str];
            x = (+$str - $drawFrom) * pixelsPerSample;
            y = text ? height - 10 : height - 5;
            ctx.moveTo(x, y);
            ctx.lineTo(x, height);
            if (text) ctx.fillText(text, x, y - 4);
        }
        ctx.stroke();
    }, [audioEditor, audioUnit, beatsPerMeasure, beatsPerMinute, division, gridRulerColor, monospaceFont, textColor, viewRange]);
    const handlePlayheadHandlerMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!divVerticalRulerRef.current) return;
        e.stopPropagation();
        e.preventDefault();
        const rect = divVerticalRulerRef.current.getBoundingClientRect();
        const { currentTarget, shiftKey } = e;
        if (currentTarget.classList.contains("editor-main-vertical-ruler-area")) {
            const [viewStart, viewEnd] = viewRange;
            const viewLength = viewEnd - viewStart;
            const to = viewStart + (e.clientX - rect.left) / rect.width * viewLength;
            if (shiftKey) audioEditor.setSelRange([playhead, to]);
            else audioEditor.setPlayhead(to);
        }
        if (currentTarget.classList.contains("editor-main-playhead-handler")) currentTarget.style.cursor = "grabbing";
        const handleMouseMove = (e: MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
            const x = e.clientX;
            if (x > rect.right) audioEditor.scrollH((x - rect.right) / 1000);
            else if (x < rect.left) audioEditor.scrollH((x - rect.left) / 1000);
            const [viewStart, viewEnd] = viewRange;
            const viewLength = viewEnd - viewStart;
            const to = viewStart + (x - rect.left) / rect.width * viewLength;
            if (shiftKey) audioEditor.setSelRange([playhead, to]);
            else audioEditor.setPlayhead(to);
        };
        const handleMouseUp = (e: MouseEvent) => {
            if (currentTarget.classList.contains("editor-main-playhead-handler")) currentTarget.style.cursor = "";
            e.stopPropagation();
            e.preventDefault();
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
    }, [audioEditor, playhead, viewRange]);
    const handlePlayheadHandlerDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        audioEditor.setSelRange(null);
    }, [audioEditor]);
    const handleSelRangeMoveMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!divVerticalRulerRef.current || !divSelRangeRef.current || !selRange) return;
        e.stopPropagation();
        e.preventDefault();
        const origin = { x: e.clientX, y: e.clientY };
        const parentRect = divVerticalRulerRef.current.getBoundingClientRect();
        const rect = divSelRangeRef.current.getBoundingClientRect();
        const curLeft = rect.left - parentRect.left;
        const { length } = audioEditor;
        const selLength = selRange[1] - selRange[0];
        divSelRangeRef.current.style.cursor = "grabbing";
        const handleMouseMove = (e: MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
            if (divSelRangeRef.current && e.movementX) {
                const x = e.clientX;
                if (x > parentRect.right) audioEditor.scrollH((x - parentRect.right) / 1000);
                else if (x < parentRect.left) audioEditor.scrollH((x - parentRect.left) / 1000);
                const [viewStart, viewEnd] = viewRange;
                const viewLength = viewEnd - viewStart;
                const left = curLeft + (x - origin.x);
                const startSample = Math.max(0, Math.min(length - selLength, viewStart + left / parentRect.width * viewLength));
                const endSample = startSample + selLength;
                audioEditor.setSelRange([startSample, endSample]);
            }
        };
        const handleMouseUp = (e: MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
            if (divSelRangeRef.current) divSelRangeRef.current.style.cursor = "grab";
            audioEditor.emitSelRangeToPlay();
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
    }, [audioEditor, selRange, viewRange]);
    const handleResizeStartMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!divVerticalRulerRef.current || !selRange) return;
        e.stopPropagation();
        e.preventDefault();
        const rect = divVerticalRulerRef.current.getBoundingClientRect();
        const end = selRange[1];
        const handleMouseMove = (e: MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
            if (divSelRangeRef.current && e.movementX) {
                const x = e.clientX;
                if (x > rect.right) audioEditor.scrollH((x - rect.right) / 1000);
                else if (x < rect.left) audioEditor.scrollH((x - rect.left) / 1000);
                const [viewStart, viewEnd] = viewRange;
                const viewLength = viewEnd - viewStart;
                const start = viewStart + (x - rect.left) / rect.width * viewLength;
                audioEditor.setSelRange([start, end]);
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
    }, [audioEditor, selRange, viewRange]);
    const handleResizeEndMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!divVerticalRulerRef.current || !selRange) return;
        e.stopPropagation();
        e.preventDefault();
        const rect = divVerticalRulerRef.current.getBoundingClientRect();
        const start = selRange[0];
        const handleMouseMove = (e: MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
            if (divSelRangeRef.current && e.movementX) {
                const x = e.clientX;
                if (x > rect.right) audioEditor.scrollH((x - rect.right) / 1000);
                else if (x < rect.left) audioEditor.scrollH((x - rect.left) / 1000);
                const [viewStart, viewEnd] = viewRange;
                const viewLength = viewEnd - viewStart;
                const end = viewStart + (x - rect.left) / rect.width * viewLength;
                audioEditor.setSelRange([start, end]);
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
    }, [audioEditor, selRange, viewRange]);
    const handleChangeTrackSize = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => setTrackSize(e.currentTarget.value as TrackSize), [setTrackSize]);
    useEffect(paintVerticalRuler, [paintVerticalRuler, windowSize]);
    const [viewStart, viewEnd] = viewRange;
    const [selStart, selEnd] = selRange || [0, 0];
    const selLeft = getCssFromPosition(viewRange, selStart);
    const selWidth = getCssFromPosition(viewRange, selStart, selEnd);
    const playheadLeft = getCssFromPosition(viewRange, playhead);
    return (
        <div className="arrangement-ruler-container">
            <div className="track-size-controls">
                <VSCodeDropdown name="Track Size" title="Track Size" value={trackSize} onChange={handleChangeTrackSize as any}>
                    <VSCodeOption value="tiny">Tiny</VSCodeOption>
                    <VSCodeOption value="small">Small</VSCodeOption>
                    <VSCodeOption value="medium">Medium</VSCodeOption>
                    <VSCodeOption value="large">Large</VSCodeOption>
                    <VSCodeOption value="huge">Huge</VSCodeOption>
                </VSCodeDropdown>
            </div>
            <div className="ruler" style={{ flex: `0 0 ${scrollerSize}px` }}>
                <div className="editor-main-playhead-container" hidden={playhead < viewStart || playhead > viewEnd}>
                    <div className="editor-main-playhead-handler" style={{ left: playheadLeft }} onMouseDown={handlePlayheadHandlerMouseDown} />
                    <div className="editor-main-playhead" style={{ left: playheadLeft }}></div>
                </div>
                <div className="editor-main-vertical-ruler-area" ref={divVerticalRulerRef} onMouseDown={handlePlayheadHandlerMouseDown} onDoubleClick={handlePlayheadHandlerDoubleClick}>
                    <canvas ref={canvasVerticalRulerRef} />
                    <div className="editor-main-selrange-handler" ref={divSelRangeRef} style={{ left: selLeft, width: `calc(${selWidth} - 4px)` }} hidden={!selRange} >
                        <div className="resize-handler resize-handler-w" onMouseDown={handleResizeStartMouseDown} />
                        <div className="editor-main-selrange-mover" onMouseDown={handleSelRangeMoveMouseDown} />
                        <div className="resize-handler resize-handler-e" onMouseDown={handleResizeEndMouseDown} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ArrangementHorizontalScroller;