import { useContext } from "react";
import { AudioEditorContext } from "./contexts";
import ArrangementTrackContainer from "./ArrangementTrackContainer";

const ArrangementContainer: React.FunctionComponent = () => {
    const audioEditor = useContext(AudioEditorContext)!;
    const tracksContainers = [];
    for (let i = 0; i < audioEditor.audioBuffer.numberOfChannels; i++) {
        tracksContainers[i] = <ArrangementTrackContainer />
    }
    return (
        <div id="arrangement-container">
            <div className="arrangement-horizontal-scroller-container">
                
            </div>
            <div className="tracks-containers">
                {tracksContainers}
            </div>
        </div>
    );
};

export default ArrangementContainer;