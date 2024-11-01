import "./ArrangementContainer.scss";
import { useContext } from "react";
import { AudioEditorContext } from "./contexts";
import ArrangementTrackContainer from "./ArrangementTrackContainer";
import { AudioEditorState } from "../core/AudioEditor";
import ArrangementHorizontalScroller from "./ArrangementHorizontalScroller";

type Props = Pick<AudioEditorState, "masterGain" | "trackNames" | "trackGains" | "trackMutes" | "trackPans" | "trackSolos" | "loop" | "playhead" | "selRange" | "viewRange"> & {
    windowSize: number[];
};

const ArrangementContainer: React.FunctionComponent<Props> = (props) => {
    const { trackNames, trackGains, trackMutes, trackSolos, trackPans, viewRange } = props;
    const audioEditor = useContext(AudioEditorContext)!;
    const tracksContainers = [];
    for (let i = 0; i < audioEditor.audioBuffer.numberOfChannels; i++) {
        const props = {
            index: i,
            name: trackNames[i] || `${i + 1}`,
            gain: trackGains[i],
            mute: trackMutes[i],
            solo: trackSolos[i],
            pan: trackPans[i],
            viewRange
        };
        tracksContainers[i] = <ArrangementTrackContainer {...props} />
    }
    return (
        <div id="arrangement-container" className="arrangement-container">
            <div className="arrangement-horizontal-scroller-container">
                <ArrangementHorizontalScroller {...props} />
            </div>
            <div className="arrangement-vertical-scroller-container">
                
            </div>
            <div className="tracks-containers">
                {tracksContainers}
            </div>
        </div>
    );
};

export default ArrangementContainer;