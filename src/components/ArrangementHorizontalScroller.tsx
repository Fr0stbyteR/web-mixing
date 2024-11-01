import "./ArrangementHorizontalScroller.scss";
import { useCallback, useContext, useRef } from "react";
import { AudioEditorContext } from "./contexts";
import { AudioEditorState } from "../core/AudioEditor";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import { getCssFromPosition } from "../utils";

type Props = Pick<AudioEditorState, "playhead" | "selRange" | "viewRange"> & {
    windowSize: number[];
};

const ArrangementHorizontalScroller: React.FunctionComponent<Props> = ({ playhead, viewRange, selRange, windowSize }) => {
    const audioEditor = useContext(AudioEditorContext)!;
    const divViewRangeRef = useRef<HTMLDivElement>(null);
    const handleMoveMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!divViewRangeRef.current) return;
        e.stopPropagation();
        e.preventDefault();
        const origin = { x: e.clientX, y: e.clientY };
        const parentRect = e.currentTarget.parentElement!.getBoundingClientRect();
        const rect = divViewRangeRef.current.getBoundingClientRect();
        const curLeft = rect.left - parentRect.left;
        const { length } = audioEditor;
        const viewLength = viewRange[1] - viewRange[0];
        divViewRangeRef.current.style.cursor = "grabbing";
        divViewRangeRef.current.classList.add("active");
        const handleMouseMove = (e: MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
            if (divViewRangeRef.current && e.movementX) {
                const x = e.clientX;
                const left = curLeft + (x - origin.x);
                const startSample = Math.max(0, Math.min(length - viewLength, left / parentRect.width * length));
                const endSample = startSample + viewLength;
                audioEditor.setViewRange([startSample, endSample]);
            }
        };
        const handleMouseUp = (e: MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
            if (divViewRangeRef.current) {
                divViewRangeRef.current.style.cursor = "grab";
                divViewRangeRef.current.classList.remove("active");
            }
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
    }, [audioEditor, viewRange]);
    const handleResizeStartMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!divViewRangeRef.current) return;
        e.stopPropagation();
        e.preventDefault();
        const origin = { x: e.clientX, y: e.clientY };
        const parent = divViewRangeRef.current.parentElement!;
        const parentRect = parent.getBoundingClientRect();
        const rect = divViewRangeRef.current.getBoundingClientRect();
        const curLeft = rect.left - parentRect.left;
        const curRight = parentRect.right - rect.right;
        const handleMouseMove = (e: MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
            if (divViewRangeRef.current && e.movementX) {
                const left = Math.max(0, Math.min(parentRect.width - curRight - 10, curLeft + (e.clientX - origin.x)));
                const startSample = left / parentRect.width * audioEditor.length;
                audioEditor.setViewRange([startSample, viewRange[1]]);
            }
        };
        const handleMouseUp = (e: MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
    }, [audioEditor, viewRange]);
    const handleResizeEndMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!divViewRangeRef.current) return;
        e.stopPropagation();
        e.preventDefault();
        const origin = { x: e.clientX, y: e.clientY };
        const parent = divViewRangeRef.current.parentElement!;
        const parentRect = parent.getBoundingClientRect();
        const rect = divViewRangeRef.current.getBoundingClientRect();
        const curWidth = rect.width;
        const curLeft = rect.left - parentRect.left;
        const handleMouseMove = (e: MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
            if (divViewRangeRef.current && e.movementX) {
                const width = Math.max(10, Math.min(parentRect.width - curLeft, curWidth - (origin.x - e.clientX)));
                const length = width / parentRect.width * audioEditor.length;
                audioEditor.setViewRange([viewRange[0], viewRange[0] + length]);
            }
        };
        const handleMouseUp = (e: MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
    }, [audioEditor, viewRange]);
    const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
        if (!e.deltaX && !e.deltaY) return;
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
            audioEditor.scrollH(e.deltaX > 0 ? 0.01 : -0.01);
            return;
        }
        const origin = { x: e.clientX, y: e.clientY };
        const rect = e.currentTarget.getBoundingClientRect();
        const ref = (origin.x - rect.left) / rect.width * audioEditor.length;
        audioEditor.zoomH(ref, e.deltaY < 0 ? 1 : -1);
    }, [audioEditor]);
    const handleClickSelectAll = useCallback(() => audioEditor.setViewRangeToAll(), [audioEditor]);
    const { length } = audioEditor;
    const range: [number, number] = [0, length];
    const [viewStart, viewEnd] = viewRange;
    const viewLeft = `${viewStart / length * 100}%`;
    const viewWidth = `calc(${(viewEnd - viewStart) / length * 100}% - 2px)`;
    const [selStart, selEnd] = selRange || [0, 0];
    const selLeft = getCssFromPosition(range, selStart);
    const selWidth = getCssFromPosition(range, selStart, selEnd);
    const playheadLeft = getCssFromPosition(range, playhead);
    return (
        <div className="arrangement-horizontal-scroller">
            <div className="editor-map-canvas-container" onWheel={handleWheel}>
                <div className="editor-map-playhead" style={{ left: playheadLeft }}></div>
                <div className="editor-map-selrange" style={{ left: selLeft, width: selWidth }} />
                <div className="editor-map-viewrange" ref={divViewRangeRef} style={{ left: viewLeft, width: viewWidth }} onMouseDown={handleMoveMouseDown}>
                    <div className="resize-handler resize-handler-w" onMouseDown={handleResizeStartMouseDown} />
                    <div className="resize-handler resize-handler-e" onMouseDown={handleResizeEndMouseDown} />
                </div>
            </div>
            <div className="editor-map-controls">
                <span className="editor-map-select-all">
                    <VSCodeButton tabIndex={-1} aria-label="View All" title="View All" appearance="icon" onClick={handleClickSelectAll}>
                        <span className="codicon codicon-symbol-array"></span>
                    </VSCodeButton>
                </span>
            </div>
        </div>
    );
};

export default ArrangementHorizontalScroller;