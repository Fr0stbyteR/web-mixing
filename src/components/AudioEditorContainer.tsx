import "./AudioEditorContainer.scss";
import { useCallback, useContext, useEffect, useState } from "react";
import ArrangementContainer from "./ArrangementContainer";
import MixerContainer from "./MixerContainer";
import PlayerContainer from "./PlayerContainer";
import { AudioEditorContext } from "./contexts";

const AudioEditorContainer: React.FunctionComponent = () => {
    const audioEditor = useContext(AudioEditorContext)!;
    const [configuration, setConfiguration] = useState(audioEditor.configuration);
    const [playhead, setPlayhead] = useState(audioEditor.state.playhead);
    const [viewRange, setViewRange] = useState(audioEditor.state.viewRange);
    const [selRange, setSelRange] = useState(audioEditor.state.selRange);
    const [playing, setPlaying] = useState(audioEditor.state.playing);
    const [loop, setLoop] = useState(audioEditor.state.loop);
    const [windowSize, setWindowSize] = useState([window.innerWidth, window.innerHeight]);
    const phosphorColor = window.getComputedStyle(document.body).getPropertyValue("--vscode-menu-selectionBackground");
    const playheadColor = window.getComputedStyle(document.body).getPropertyValue("--vscode-minimap-findMatchHighlight");
    const gridColor = window.getComputedStyle(document.body).getPropertyValue("--vscode-menu-separatorBackground");
    const gridRulerColor = window.getComputedStyle(document.body).getPropertyValue("--vscode-menu-foreground");
    const monospaceFont = window.getComputedStyle(document.body).getPropertyValue("--vscode-font-family");
    const textColor = window.getComputedStyle(document.body).getPropertyValue("--vscode-list-highlightForeground");
    const componentProps = {
        playhead,
        viewRange,
        selRange,
        playing,
        loop,
        configuration,
        phosphorColor,
        playheadColor,
        gridColor,
        gridRulerColor,
        labelFont: monospaceFont,
        separatorColor: gridColor,
        fadePathColor: "yellow",
        monospaceFont,
        textColor,
        windowSize
    };
    const handleResize = useCallback(() => {
        setWindowSize([window.innerWidth, window.innerHeight]);
    }, []);
    useEffect(() => {
        audioEditor.on("playhead", setPlayhead);
        audioEditor.on("viewRange", setViewRange);
        audioEditor.on("selRange", setSelRange);
        audioEditor.on("playing", setPlaying);
        audioEditor.on("loop", setLoop);
        window.addEventListener("resize", handleResize);
        return () => {
            audioEditor.off("playhead", setPlayhead);
            audioEditor.off("viewRange", setViewRange);
            audioEditor.off("selRange", setSelRange);
            audioEditor.off("playing", setPlaying);
            audioEditor.off("loop", setLoop);
            window.removeEventListener("resize", handleResize);
        };
    }, [audioEditor, handleResize]);
    return (
        <div id="audio-editor-container" className="audio-editor-container">
            <PlayerContainer {...componentProps} />
            <ArrangementContainer />
            <MixerContainer />
        </div>
    );
};

export default AudioEditorContainer;