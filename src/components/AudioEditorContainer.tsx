import "./AudioEditorContainer.scss";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import ArrangementContainer from "./ArrangementContainer";
import MixerContainer from "./MixerContainer";
import PlayerContainer from "./PlayerContainer";
import { AudioEditorContext } from "./contexts";
import { TrackSize } from "../types";
import OutputContainer from "./OutputContainer";
import AudioEditor from "../core/AudioEditor";

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
    const [grouping, setGrouping] = useState(audioEditor.state.grouping);
    const [windowSize, setWindowSize] = useState([window.innerWidth, window.innerHeight]);
    const [trackSize, setTrackSize] = useState<TrackSize>("small");
    const [scrollerSize, setScrollerSize] = useState(windowSize[0] - 162);
    const [showMixer, setShowMixer] = useState(false);
    const editorContainerRef = useRef<HTMLDivElement>(null);
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
        grouping,
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
        windowSize,
        scrollerSize,
        trackSize,
        setTrackSize
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
        audioEditor.on("grouping", setGrouping);
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
            audioEditor.off("grouping", setGrouping);
            window.removeEventListener("resize", handleResize);
        };
    }, [audioEditor, handleResize]);
    useEffect(() => {
        let preCalculatedScrollerSize = windowSize[0] - 162;
        if (editorContainerRef.current) {
            const trackControlWidth = +window.getComputedStyle(editorContainerRef.current).getPropertyValue("--track-control-width").replace("px", "");
            preCalculatedScrollerSize = windowSize[0] - trackControlWidth - 2;
            const waveform = editorContainerRef.current.getElementsByClassName("waveform")[0];
            if (waveform) preCalculatedScrollerSize = waveform.getBoundingClientRect().width;
        }
        setScrollerSize(preCalculatedScrollerSize);
    }, [windowSize, trackSize]);
    useEffect(() => {
        const url = new URL(location.href);
        url.searchParams.set("g", trackGains.join("_"));
        window.history.replaceState({ trackGains }, "", url);
    }, [trackGains]);
    useEffect(() => {
        const url = new URL(location.href);
        url.searchParams.set("m", masterGain.toString());
        window.history.replaceState({ masterGain }, "", url);
    }, [masterGain]);
    useEffect(() => {
        const url = new URL(location.href);
        url.searchParams.set("gr", AudioEditor.toGroupingString(grouping));
        window.history.replaceState({ grouping }, "", url);
    }, [grouping]);
    return (
        <div id="audio-editor-container" className="audio-editor-container" ref={editorContainerRef}>
            <PlayerContainer {...componentProps} />
            <ArrangementContainer {...componentProps} />
            <MixerContainer {...componentProps} showMixer={showMixer} />
            <OutputContainer {...componentProps} peakAnalyserNode={audioEditor.player!.masterPeakAnalyserNode} showMixer={showMixer} setShowMixer={setShowMixer}/>
        </div>
    );
};

export default AudioEditorContainer;