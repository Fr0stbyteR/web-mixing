import { useContext } from "react";
import { AudioEditorContext } from "./contexts";

const ArrangementTrackContainer: React.FunctionComponent = () => {
    const audioEditor = useContext(AudioEditorContext)!;
    return (
        <div id="arrangement-track-container">
            <div className="controls"></div>
            <div className="waveform"></div>
        </div>
    );
};

export default ArrangementTrackContainer;