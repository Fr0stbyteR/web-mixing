import "./PlayerContainer.scss";
import { FunctionComponent, useCallback, useContext, useState } from "react";
import { AudioEditorContext } from "./contexts";
import { AudioEditorConfiguration, AudioEditorState } from "../core/AudioEditor";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import TimeInput from "./TimeInput";
import ArrangementHorizontalScroller from "./ArrangementHorizontalScroller";
import { VisualizationStyleOptions } from "../types";

type Props = Pick<AudioEditorState, "playing" | "playhead" | "loop" | "selRange" | "viewRange">
& Pick<VisualizationStyleOptions, "gridRulerColor" | "gridColor" | "textColor" | "monospaceFont">
 & {
    configuration: AudioEditorConfiguration;
    scrollerSize: number;
    windowSize: number[];
};

const PlayerContainer: FunctionComponent<Props> = (props) => {
    const { playhead, playing, loop, configuration, scrollerSize } = props;
    const audioEditor = useContext(AudioEditorContext)!;
    const handlePlayheadChanged = (playhead: number) => audioEditor.setPlayhead(playhead);
    const [playheadBeforePlay, setPlayheadBeforePlay] = useState(playhead);
    const handleClickPlay = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        e.currentTarget.blur();
        if (audioEditor.context.state === "suspended") audioEditor.context.resume();
        if (playing === "playing") {
            audioEditor.setPlayhead(playheadBeforePlay);
            audioEditor.play();
        } else {
            setPlayheadBeforePlay(playhead);
            if (playing === "paused") audioEditor.resume();
            else audioEditor.play();
        }
    }, [audioEditor, playing, playheadBeforePlay, playhead]);
    const handleClickStop = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        e.currentTarget.blur();
        audioEditor.stop();
    }, [audioEditor]);
    const handleClickPause = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        e.currentTarget.blur();
        if (playing === "paused") audioEditor.resume();
        else audioEditor.pause();
    }, [audioEditor, playing]);
    const handleClickLoop = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        e.currentTarget.blur();
        audioEditor.setLoop(!loop);
    }, [audioEditor, loop]);
    const { sampleRate } = audioEditor;
    return (
        <div className="player-container">
            <div className="time-input-container">
                <TimeInput samples={playhead} sampleRate={sampleRate} {...configuration} onChange={handlePlayheadChanged} />
            </div>
            <div className="editor-main-player-controls-container">
                <span className="editor-main-player-controls">
                    <VSCodeButton tabIndex={-1} title="Stop" disabled={playing === "stopped"} appearance="icon" onClick={handleClickStop}>
                        <span className="codicon codicon-debug-stop"></span>
                    </VSCodeButton>
                    <VSCodeButton tabIndex={-1} title="Play" appearance="icon" onClick={handleClickPlay}>
                        <span className="codicon codicon-play"></span>
                    </VSCodeButton>
                    <VSCodeButton tabIndex={-1} title="Pause" appearance="icon" disabled={playing === "stopped"} onClick={handleClickPause}>
                        {playing === "paused" ? <span className="codicon codicon-debug-continue-small"></span> : <span className="codicon codicon-debug-pause"></span>}
                    </VSCodeButton>
                    <VSCodeButton tabIndex={-1} title="Loop" appearance="icon" className={loop ? "active" : ""} onClick={handleClickLoop}>
                        <span className="codicon codicon-refresh"></span>
                    </VSCodeButton>
                </span>
            </div>
            <div className="arrangement-horizontal-scroller-container" style={{ flex: `0 0 ${scrollerSize}px` }}>
                <ArrangementHorizontalScroller {...props} />
            </div>
        </div>
    );
};

export default PlayerContainer;
