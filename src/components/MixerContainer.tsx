import "./MixerContainer.scss";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { AudioEditorContext } from "./contexts";
import ArrangementTrackContainer from "./ArrangementTrackContainer";
import { AudioEditorConfiguration, AudioEditorState } from "../core/AudioEditor";
import { TrackSize, VisualizationStyleOptions } from "../types";
import { getCssFromPosition } from "../utils";
import MixerTrackContainer from "./MixerTrackContainer";

type Props = Pick<AudioEditorState, "masterGain" | "trackNames" | "trackGains" | "trackMutes" | "trackPans" | "trackSolos" | "loop" | "playhead" | "selRange" | "viewRange" | "grouping">
& Pick<VisualizationStyleOptions, "gridRulerColor" | "gridColor" | "textColor" | "monospaceFont">
& {
    configuration: AudioEditorConfiguration;
    windowSize: number[];
    scrollerSize: number;
    trackSize: TrackSize;
    setTrackSize: (trackSize: TrackSize) => any;
    showMixer: boolean;
};

const MixerContainer: React.FunctionComponent<Props> = (props) => {
    const { trackNames, trackGains, trackMutes, trackSolos, trackPans, playhead, selRange, viewRange, grouping, windowSize, scrollerSize, trackSize, setTrackSize, showMixer } = props;
    const audioEditor = useContext(AudioEditorContext)!;
    const [newWindowSize, setNewWindowSize] = useState(windowSize);
    const [movingTrack, setMovingTrack] = useState<[number, number, number] | null>(null);
    const groups: number[][] = [];
    let groupIndex = 0;
    const tracks: JSX.Element[] = [];
    for (let i = 0; i < grouping.length; i++) {
        const { id, linked } = grouping[i];
        if (i > 0 && !linked) groupIndex++;
        if (!groups[groupIndex]) groups[groupIndex] = [id];
        else groups[groupIndex].push(id);
    }
    for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        const trackProps = {
            ...props,
            key: i,
            position: i,
            groupIndex: i,
            group,
            names: group.map(id => audioEditor.state.trackNames[id]),
            gain: audioEditor.state.trackGains[group[0]],
            mutes: group.map(id => audioEditor.state.trackMutes[id]),
            solos: group.map(id => audioEditor.state.trackSolos[id]),
            pans: group.map(id => audioEditor.state.trackPans[id]),
            windowSize: newWindowSize,
            setMovingTrack
        }
        tracks.push(<MixerTrackContainer {...trackProps} />);
        
    }

    useEffect(() => setNewWindowSize([...windowSize]), [windowSize, showMixer]);
    return (
        <div id="mixer-container" className="mixer-container" hidden={!showMixer}>
            {showMixer ? tracks : null}
        </div>
    );
};

export default MixerContainer;