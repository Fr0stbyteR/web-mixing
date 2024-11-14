import "./ArrangementContainer.scss";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { AudioEditorContext } from "./contexts";
import ArrangementTrackContainer from "./ArrangementTrackContainer";
import { AudioEditorConfiguration, AudioEditorState } from "../core/AudioEditor";
import { TrackSize, VisualizationStyleOptions } from "../types";
import { getCssFromPosition } from "../utils";
import ArrangementRuler from "./ArrangementRuler";

type Props = Pick<AudioEditorState, "masterGain" | "trackNames" | "trackGains" | "trackMutes" | "trackPans" | "trackSolos" | "loop" | "playhead" | "selRange" | "viewRange" | "grouping">
& Pick<VisualizationStyleOptions, "gridRulerColor" | "gridColor" | "textColor" | "monospaceFont">
& {
    configuration: AudioEditorConfiguration;
    windowSize: number[];
    scrollerSize: number;
    trackSize: TrackSize;
    setTrackSize: (trackSize: TrackSize) => any;
};

const ArrangementContainer: React.FunctionComponent<Props> = (props) => {
    const { trackNames, trackGains, trackMutes, trackSolos, trackPans, playhead, selRange, viewRange, grouping, windowSize, scrollerSize, trackSize, setTrackSize } = props;
    const audioEditor = useContext(AudioEditorContext)!;
    const [newWindowSize, setNewWindowSize] = useState(windowSize);
    const [movingTrack, setMovingTrack] = useState<[number, number, number] | null>(null);
    const selectionOverlayRef = useRef<HTMLDivElement>(null);
    const { numberOfChannels } = audioEditor;
    const tracksContainers: JSX.Element[] = [];
    const movingTracks: JSX.Element[] = [];
    let groupIndex = 0;
    const tracksMoving = new Array(grouping.length).fill(false);
    if (typeof movingTrack?.[0] === "number") {
        tracksMoving[movingTrack[0]] = true;
        for (let i = movingTrack?.[0]; i >= 0; i--) {
            if (grouping[i].linked) tracksMoving[i] = true;
            else break;
        }
        for (let i = movingTrack?.[0] + 1; i < grouping.length; i++) {
            if (grouping[i].linked) tracksMoving[i] = true;
            else break;
        }
    }
    for (let i = 0; i < grouping.length; i++) {
        const { id, linked } = grouping[i];
        const isMoving = tracksMoving[i];
        if (i > 0 && !linked) groupIndex++;
        const trackProps = {
            ...props,
            key: id,
            index: id,
            position: i,
            groupIndex,
            total: numberOfChannels,
            numberOfChannels: 1,
            name: trackNames[id] || `${id + 1}`,
            gain: trackGains[id],
            mute: trackMutes[id],
            solo: trackSolos[id],
            pan: trackPans[id],
            linked,
            size: trackSize,
            windowSize: newWindowSize,
            setMovingTrack
        };
        const trackContainer = <ArrangementTrackContainer {...trackProps} />;
        if (isMoving) {
            movingTracks.push(trackContainer);
        } else {
            tracksContainers.push(trackContainer);
        }
    }
    if (typeof movingTrack?.[1] === "number") {
        tracksContainers.splice(movingTrack[1], 0, ...tracksMoving.filter(v => v).map(() => <div className={`track-move-target ${trackSize}`} />));
    }
    const handleResizeStartMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!selectionOverlayRef.current || !selRange) return;
        (document.activeElement as HTMLElement)?.blur();
        e.stopPropagation();
        e.preventDefault();
        const rect = selectionOverlayRef.current.getBoundingClientRect();
        const end = selRange[1];
        const handleMouseMove = (e: MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
            if (e.movementX) {
                const x = e.clientX;
                if (x > rect.right) audioEditor.scrollH((x - rect.right) / 1000);
                else if (x < rect.left) audioEditor.scrollH((x - rect.left) / 1000);
                const [viewStart, viewEnd] = audioEditor.state.viewRange;
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
    }, [audioEditor, selRange]);
    const handleResizeEndMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!selectionOverlayRef.current || !selRange) return;
        (document.activeElement as HTMLElement)?.blur();
        e.stopPropagation();
        e.preventDefault();
        const rect = selectionOverlayRef.current.getBoundingClientRect();
        const start = selRange[0];
        const handleMouseMove = (e: MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
            if (e.movementX) {
                const x = e.clientX;
                if (x > rect.right) audioEditor.scrollH((x - rect.right) / 1000);
                else if (x < rect.left) audioEditor.scrollH((x - rect.left) / 1000);
                const [viewStart, viewEnd] = audioEditor.state.viewRange;
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
    }, [audioEditor, selRange]);
    useEffect(() => setNewWindowSize([...windowSize]), [windowSize, trackSize]);
    const [viewStart, viewEnd] = viewRange;
    const [selStart, selEnd] = selRange || [0, 0];
    const selLeft = getCssFromPosition(viewRange, selStart);
    const selWidth = getCssFromPosition(viewRange, selStart, selEnd);
    const playheadLeft = getCssFromPosition(viewRange, playhead);
    return (
        <div id="arrangement-container" className="arrangement-container">
            <ArrangementRuler {...props} setTrackSize={setTrackSize} />
            <div className="tracks-containers">
                {movingTracks.length ? <div className="moving-tracks-container" style={{ top: `${movingTrack?.[2]}px` }}>{movingTracks}</div> : null}
                {tracksContainers}
            </div>
            <div className="selection-overlay" ref={selectionOverlayRef} style={{ width: `${scrollerSize}px` }}>
                <div className="selrange" style={{ left: selLeft, width: selWidth }} hidden={!selRange}>
                    <div className="resize-handler resize-handler-w" onMouseDown={handleResizeStartMouseDown} />
                    <div className="resize-handler resize-handler-e" onMouseDown={handleResizeEndMouseDown} />
                </div>
                <div className="playhead-container">
                    {playhead < viewStart || playhead > viewEnd ? null : <div className="playhead" style={{ left: playheadLeft }} />}
                </div>
            </div>
        </div>
    );
};

export default ArrangementContainer;