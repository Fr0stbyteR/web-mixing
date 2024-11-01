import { useContext, useRef } from "react";
import { AudioEditorContext } from "./contexts";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import GainInput from "./GainInput";

type Props = {
    index: number;
    name: string;
    gain: number;
    mute: boolean;
    solo: boolean;
    pan: number;
    viewRange: [number, number];
}

const ArrangementTrackContainer: React.FunctionComponent<Props> = ({ index, name, gain, mute, solo, pan, viewRange }) => {
    const audioEditor = useContext(AudioEditorContext)!;
    const canvasMeterRef = useRef<HTMLCanvasElement>(null);
    const handleClickMute = () => audioEditor.setMute(index, !mute);
    const handleClickSolo = () => audioEditor.setSolo(index, !mute);
    const handleGainChange = (gain: number) => audioEditor.setGain(index, gain);
    return (
        <div id="arrangement-track-container">
            <div className="controls">
                <div className="name">{name}</div>
                <div className="mute">
                    <VSCodeButton tabIndex={-1} aria-label="Mute" title="Mute" onClick={handleClickMute}>M</VSCodeButton>
                </div>
                <div className="solo">
                    <VSCodeButton tabIndex={-1} aria-label="Solo" title="Solo" onClick={handleClickSolo}>S</VSCodeButton>
                </div>
                <div className="meter">
                    <canvas ref={canvasMeterRef} />
                </div>
                <div className="gain">
                    <GainInput gain={gain} unit="dB" onChange={handleGainChange} />
                </div>
            </div>
            <div className="waveform"></div>
        </div>
    );
};

export default ArrangementTrackContainer;