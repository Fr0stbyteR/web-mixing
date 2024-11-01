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
    const [trackNames, setTrackNames] = useState(audioEditor.state.trackNames);
    const [trackGains, setTrackGains] = useState(audioEditor.state.trackGains);
    const [trackMutes, setTrackMutes] = useState(audioEditor.state.trackMutes);
    const [trackSolos, setTrackSolos] = useState(audioEditor.state.trackSolos);
    const [trackPans, setTrackPans] = useState(audioEditor.state.trackPans);
    const [masterGain, setMasterGain] = useState(audioEditor.state.masterGain);
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
        trackNames,
        trackGains,
        trackMutes,
        trackSolos,
        trackPans,
        masterGain,
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
        audioEditor.on("trackNames", setTrackNames);
        audioEditor.on("trackGains", setTrackGains);
        audioEditor.on("trackMutes", setTrackMutes);
        audioEditor.on("trackSolos", setTrackSolos);
        audioEditor.on("trackPans", setTrackPans);
        audioEditor.on("masterGain", setMasterGain);
        window.addEventListener("resize", handleResize);
        return () => {
            audioEditor.off("playhead", setPlayhead);
            audioEditor.off("viewRange", setViewRange);
            audioEditor.off("selRange", setSelRange);
            audioEditor.off("playing", setPlaying);
            audioEditor.off("loop", setLoop);
            audioEditor.off("trackNames", setTrackNames);
            audioEditor.off("trackGains", setTrackGains);
            audioEditor.off("trackMutes", setTrackMutes);
            audioEditor.off("trackSolos", setTrackSolos);
            audioEditor.off("trackPans", setTrackPans);
            audioEditor.off("masterGain", setMasterGain);
            window.removeEventListener("resize", handleResize);
        };
    }, [audioEditor, handleResize]);
    return (
        <div id="audio-editor-container" className="audio-editor-container">
            <PlayerContainer {...componentProps} />
            <ArrangementContainer {...componentProps} />
            <MixerContainer />
        </div>
    );
};

export default AudioEditorContainer;